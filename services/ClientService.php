<?php
/**
 * CLIENTO - CLIENT MANAGEMENT SERVICE
 * Business logic for client lifecycle, retainers, and dossier statistics.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

class ClientService {
    /**
     * Get all clients for a user with calculated financial summaries
     */
    public static function getAll(int $userId, ?string $statusFilter = null, ?string $search = null): array {
        $db = Database::getConnection();

        $sql = '
            SELECT 
                c.*,
                COALESCE(SUM(i.amount), 0.00) AS total_billed,
                COALESCE((
                    SELECT SUM(p.amount) 
                    FROM payments p 
                    WHERE p.client_id = c.id AND p.user_id = :uid_p
                ), 0.00) AS total_paid
            FROM clients c
            LEFT JOIN invoices i ON i.client_id = c.id AND i.user_id = :uid_i
            WHERE c.user_id = :uid_c
        ';

        $params = [
            ':uid_p' => $userId,
            ':uid_i' => $userId,
            ':uid_c' => $userId
        ];

        if ($statusFilter && $statusFilter !== 'all') {
            $sql .= ' AND c.status = :status';
            $params[':status'] = $statusFilter;
        }

        if ($search !== null && trim($search) !== '') {
            $term = '%' . trim($search) . '%';
            $sql .= ' AND (c.name LIKE :search_name OR c.company LIKE :search_co OR c.email LIKE :search_em OR c.service LIKE :search_svc)';
            $params[':search_name'] = $term;
            $params[':search_co'] = $term;
            $params[':search_em'] = $term;
            $params[':search_svc'] = $term;
        }

        $sql .= ' GROUP BY c.id ORDER BY c.created_at DESC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $clients = $stmt->fetchAll();

        return array_map(function ($c) {
            $billed = (float)$c['total_billed'];
            $paid = (float)$c['total_paid'];
            $outstanding = max(0.0, $billed - $paid);
            $monthlyAmount = (float)$c['monthly_amount'];

            return [
                'id' => (int)$c['id'],
                'client_code' => $c['client_code'] ?: ('cli_' . $c['id']),
                'name' => $c['name'],
                'company' => $c['company'] ?? '',
                'phone' => $c['phone'] ?? '',
                'email' => $c['email'] ?? '',
                'service' => $c['service'] ?? '',
                'monthly_amount' => $monthlyAmount,
                'due_day' => (int)($c['due_day'] ?? 5),
                'retainer_status' => $monthlyAmount > 0 ? ($c['retainer_status'] ?? 'active') : null,
                'status' => $c['status'],
                'joining_date' => $c['joining_date'],
                'notes' => $c['notes'] ?? '',
                'total_billed' => $billed,
                'total_paid' => $paid,
                'outstanding' => $outstanding,
                'created_at' => $c['created_at'],
                'updated_at' => $c['updated_at']
            ];
        }, $clients);
    }

    /**
     * Get a single client record by ID with ownership verification
     */
    public static function getById(int $userId, int $clientId): ?array {
        $db = Database::getConnection();
        $stmt = $db->prepare('
            SELECT * FROM clients 
            WHERE id = :id AND user_id = :uid 
            LIMIT 1
        ');
        $stmt->execute([':id' => $clientId, ':uid' => $userId]);
        $c = $stmt->fetch();

        if (!$c) return null;

        $monthlyAmount = (float)$c['monthly_amount'];

        return [
            'id' => (int)$c['id'],
            'client_code' => $c['client_code'] ?: ('cli_' . $c['id']),
            'name' => $c['name'],
            'company' => $c['company'] ?? '',
            'phone' => $c['phone'] ?? '',
            'email' => $c['email'] ?? '',
            'service' => $c['service'] ?? '',
            'monthly_amount' => $monthlyAmount,
            'due_day' => (int)($c['due_day'] ?? 5),
            'retainer_status' => $monthlyAmount > 0 ? ($c['retainer_status'] ?? 'active') : null,
            'status' => $c['status'],
            'joining_date' => $c['joining_date'],
            'notes' => $c['notes'] ?? '',
            'created_at' => $c['created_at'],
            'updated_at' => $c['updated_at']
        ];
    }

    /**
     * Create client with optional upfront project advance invoice/payment
     */
    public static function create(int $userId, array $data): array {
        $db = Database::getConnection();
        $monthlyAmount = isset($data['monthly_amount']) ? (float)$data['monthly_amount'] : 0.0;
        $retainerStatus = $monthlyAmount > 0 ? ($data['retainer_status'] ?? 'active') : null;
        $dueDay = $monthlyAmount > 0 ? (int)($data['due_day'] ?? 5) : 5;

        $db->beginTransaction();
        try {
            $stmt = $db->prepare('
                INSERT INTO clients (
                    user_id, client_code, name, company, phone, email, 
                    service, monthly_amount, due_day, retainer_status, 
                    status, joining_date, notes, created_at, updated_at
                ) VALUES (
                    :uid, :code, :name, :company, :phone, :email,
                    :service, :monthly, :due_day, :ret_status,
                    :status, :joining, :notes, NOW(), NOW()
                )
            ');

            $tempCode = $data['client_code'] ?? null;
            $stmt->execute([
                ':uid' => $userId,
                ':code' => $tempCode,
                ':name' => trim($data['name']),
                ':company' => trim($data['company'] ?? ''),
                ':phone' => trim($data['phone'] ?? ''),
                ':email' => trim($data['email'] ?? ''),
                ':service' => trim($data['service'] ?? ''),
                ':monthly' => $monthlyAmount,
                ':due_day' => $dueDay,
                ':ret_status' => $retainerStatus,
                ':status' => $data['status'] ?? 'active',
                ':joining' => $data['joining_date'] ?? date('Y-m-d'),
                ':notes' => trim($data['notes'] ?? '')
            ]);

            $clientId = (int)$db->lastInsertId();

            // Set default client_code if none provided
            if (empty($tempCode)) {
                $code = 'cli_' . $clientId;
                $updateCode = $db->prepare('UPDATE clients SET client_code = :code WHERE id = :id');
                $updateCode->execute([':code' => $code, ':id' => $clientId]);
            }

            // Handle optional initial project advance payment
            $initialAmount = isset($data['initial_amount']) ? (float)$data['initial_amount'] : 0.0;
            if ($initialAmount > 0) {
                $initialStatus = $data['initial_status'] ?? 'pending';
                $initialMethod = $data['initial_method'] ?? 'Bank Transfer';
                $joiningDate = $data['joining_date'] ?? date('Y-m-d');
                $billingMonth = substr($joiningDate, 0, 7);

                $invNumber = Helpers::generateInvoiceNumber($userId);
                $invStmt = $db->prepare('
                    INSERT INTO invoices (
                        user_id, client_id, invoice_number, service_name, charge_type,
                        notes, billing_month, amount, due_date, status, created_at, updated_at
                    ) VALUES (
                        :uid, :cid, :inv_num, :service, "one_time",
                        :notes, :month, :amount, :due_date, :status, NOW(), NOW()
                    )
                ');
                $invStmt->execute([
                    ':uid' => $userId,
                    ':cid' => $clientId,
                    ':inv_num' => $invNumber,
                    ':service' => trim($data['service'] ?? 'Project Advance / Initial Payment'),
                    ':notes' => 'Initial Project Advance / Upfront Payment',
                    ':month' => $billingMonth,
                    ':amount' => $initialAmount,
                    ':due_date' => $joiningDate,
                    ':status' => $initialStatus === 'paid' ? 'paid' : 'pending'
                ]);
                $invoiceId = (int)$db->lastInsertId();

                if ($initialStatus === 'paid') {
                    $payStmt = $db->prepare('
                        INSERT INTO payments (
                            user_id, invoice_id, client_id, amount, payment_date,
                            payment_method, notes, reference_number, created_at
                        ) VALUES (
                            :uid, :iid, :cid, :amount, :pdate,
                            :pmethod, :notes, :ref, NOW()
                        )
                    ');
                    $payStmt->execute([
                        ':uid' => $userId,
                        ':iid' => $invoiceId,
                        ':cid' => $clientId,
                        ':amount' => $initialAmount,
                        ':pdate' => $joiningDate,
                        ':pmethod' => $initialMethod,
                        ':notes' => 'Settled upfront advance on onboarding',
                        ':ref' => 'ADV-' . date('Ymd')
                    ]);
                }
            }

            $db->commit();

            Helpers::logActivity(
                $userId,
                'client',
                $clientId,
                'create',
                'Created client ' . $data['name']
            );

            return self::getById($userId, $clientId);
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /**
     * Update client record
     */
    public static function update(int $userId, int $clientId, array $data): array {
        $existing = self::getById($userId, $clientId);
        if (!$existing) {
            throw new Exception('Client not found or unauthorized.');
        }

        $db = Database::getConnection();
        $monthlyAmount = isset($data['monthly_amount']) ? (float)$data['monthly_amount'] : $existing['monthly_amount'];
        $retainerStatus = $monthlyAmount > 0 ? ($data['retainer_status'] ?? $existing['retainer_status'] ?? 'active') : null;
        $dueDay = $monthlyAmount > 0 ? (int)($data['due_day'] ?? $existing['due_day'] ?? 5) : 5;

        $stmt = $db->prepare('
            UPDATE clients SET
                name = :name,
                company = :company,
                phone = :phone,
                email = :email,
                service = :service,
                monthly_amount = :monthly,
                due_day = :due_day,
                retainer_status = :ret_status,
                status = :status,
                joining_date = :joining,
                notes = :notes,
                updated_at = NOW()
            WHERE id = :id AND user_id = :uid
        ');

        $stmt->execute([
            ':id' => $clientId,
            ':uid' => $userId,
            ':name' => isset($data['name']) ? trim($data['name']) : $existing['name'],
            ':company' => isset($data['company']) ? trim($data['company']) : $existing['company'],
            ':phone' => isset($data['phone']) ? trim($data['phone']) : $existing['phone'],
            ':email' => isset($data['email']) ? trim($data['email']) : $existing['email'],
            ':service' => isset($data['service']) ? trim($data['service']) : $existing['service'],
            ':monthly' => $monthlyAmount,
            ':due_day' => $dueDay,
            ':ret_status' => $retainerStatus,
            ':status' => $data['status'] ?? $existing['status'],
            ':joining' => $data['joining_date'] ?? $existing['joining_date'],
            ':notes' => isset($data['notes']) ? trim($data['notes']) : $existing['notes']
        ]);

        Helpers::logActivity(
            $userId,
            'client',
            $clientId,
            'update',
            'Updated client ' . ($data['name'] ?? $existing['name'])
        );

        return self::getById($userId, $clientId);
    }

    /**
     * Delete or deactivate client.
     * Preserves financial history integrity if invoices or payments exist.
     */
    public static function deleteOrDeactivate(int $userId, int $clientId): array {
        $existing = self::getById($userId, $clientId);
        if (!$existing) {
            throw new Exception('Client not found or unauthorized.');
        }

        $db = Database::getConnection();

        // Check for financial records
        $checkStmt = $db->prepare('
            SELECT 
                (SELECT COUNT(*) FROM invoices WHERE client_id = :cid_i AND user_id = :uid_i) AS inv_count,
                (SELECT COUNT(*) FROM payments WHERE client_id = :cid_p AND user_id = :uid_p) AS pay_count
        ');
        $checkStmt->execute([
            ':cid_i' => $clientId, ':uid_i' => $userId,
            ':cid_p' => $clientId, ':uid_p' => $userId
        ]);
        $counts = $checkStmt->fetch();

        $invCount = (int)($counts['inv_count'] ?? 0);
        $payCount = (int)($counts['pay_count'] ?? 0);

        if ($invCount > 0 || $payCount > 0) {
            // Soft-deactivate to protect financial integrity
            $deactivateStmt = $db->prepare('UPDATE clients SET status = "inactive", updated_at = NOW() WHERE id = :id AND user_id = :uid');
            $deactivateStmt->execute([':id' => $clientId, ':uid' => $userId]);

            Helpers::logActivity(
                $userId,
                'client',
                $clientId,
                'deactivate',
                'Deactivated client ' . $existing['name'] . ' (preserved ' . $invCount . ' invoices and ' . $payCount . ' payments)'
            );

            return [
                'action' => 'deactivated',
                'message' => 'Client deactivated. Financial and payment history preserved.',
                'client_id' => $clientId
            ];
        }

        // Hard delete if no financial history exists
        $delStmt = $db->prepare('DELETE FROM clients WHERE id = :id AND user_id = :uid');
        $delStmt->execute([':id' => $clientId, ':uid' => $userId]);

        Helpers::logActivity(
            $userId,
            'client',
            $clientId,
            'delete',
            'Permanently deleted client ' . $existing['name']
        );

        return [
            'action' => 'deleted',
            'message' => 'Client deleted successfully.',
            'client_id' => $clientId
        ];
    }

    /**
     * Toggle retainer active / paused status
     */
    public static function toggleRetainerStatus(int $userId, int $clientId): array {
        $existing = self::getById($userId, $clientId);
        if (!$existing) {
            throw new Exception('Client not found.');
        }

        $newStatus = ($existing['retainer_status'] === 'paused') ? 'active' : 'paused';

        $db = Database::getConnection();
        $stmt = $db->prepare('UPDATE clients SET retainer_status = :status, updated_at = NOW() WHERE id = :id AND user_id = :uid');
        $stmt->execute([':status' => $newStatus, ':id' => $clientId, ':uid' => $userId]);

        Helpers::logActivity(
            $userId,
            'client',
            $clientId,
            'retainer_toggle',
            'Retainer status for ' . $existing['name'] . ' toggled to ' . $newStatus
        );

        return self::getById($userId, $clientId);
    }

    /**
     * Get complete 360-degree client dossier details
     */
    public static function getDossier(int $userId, int $clientId): array {
        $client = self::getById($userId, $clientId);
        if (!$client) {
            throw new Exception('Client not found or unauthorized.');
        }

        $db = Database::getConnection();

        // 1. Invoices for client with live paid amount calculation
        $today = date('Y-m-d');
        $invStmt = $db->prepare('
            SELECT 
                i.*,
                COALESCE(SUM(p.amount), 0.00) AS paid_amount
            FROM invoices i
            LEFT JOIN payments p ON p.invoice_id = i.id AND p.user_id = :uid_p
            WHERE i.client_id = :cid AND i.user_id = :uid_i
            GROUP BY i.id
            ORDER BY i.due_date DESC, i.id DESC
        ');
        $invStmt->execute([
            ':uid_p' => $userId,
            ':cid' => $clientId,
            ':uid_i' => $userId
        ]);
        $invoices = $invStmt->fetchAll();

        $formattedInvoices = array_map(function ($inv) use ($today) {
            $amount = (float)$inv['amount'];
            $paid = (float)$inv['paid_amount'];
            $rem = max(0.0, $amount - $paid);

            let:
            $status = 'pending';
            if ($paid >= $amount && $amount > 0) {
                $status = 'paid';
            } elseif ($paid > 0) {
                $status = 'partial';
            } elseif ($inv['due_date'] && $today > $inv['due_date']) {
                $status = 'overdue';
            }

            return [
                'id' => (int)$inv['id'],
                'invoice_code' => $inv['invoice_code'] ?: ('inv_' . $inv['id']),
                'invoice_number' => $inv['invoice_number'],
                'service_name' => $inv['service_name'],
                'charge_type' => $inv['charge_type'],
                'notes' => $inv['notes'] ?? '',
                'billing_month' => $inv['billing_month'],
                'amount' => $amount,
                'paid_amount' => $paid,
                'remaining_due' => $rem,
                'due_date' => $inv['due_date'],
                'status' => $status,
                'is_overdue' => ($status === 'overdue' || ($status === 'partial' && $today > $inv['due_date'])),
                'created_at' => $inv['created_at']
            ];
        }, $invoices);

        // 2. Payments for client
        $payStmt = $db->prepare('
            SELECT p.*, i.invoice_number, i.billing_month
            FROM payments p
            JOIN invoices i ON i.id = p.invoice_id
            WHERE p.client_id = :cid AND p.user_id = :uid
            ORDER BY p.payment_date DESC, p.id DESC
        ');
        $payStmt->execute([':cid' => $clientId, ':uid' => $userId]);
        $payments = $payStmt->fetchAll();

        $formattedPayments = array_map(function ($p) {
            return [
                'id' => (int)$p['id'],
                'payment_code' => $p['payment_code'] ?: ('pay_' . $p['id']),
                'invoice_id' => (int)$p['invoice_id'],
                'invoice_number' => $p['invoice_number'],
                'billing_month' => $p['billing_month'],
                'amount' => (float)$p['amount'],
                'payment_date' => $p['payment_date'],
                'payment_method' => $p['payment_method'],
                'notes' => $p['notes'] ?? '',
                'reference_number' => $p['reference_number'] ?? '',
                'created_at' => $p['created_at']
            ];
        }, $payments);

        // 3. Financial overview calculations
        $totalBilled = array_reduce($formattedInvoices, fn($acc, $i) => $acc + $i['amount'], 0.0);
        $totalPaid = array_reduce($formattedPayments, fn($acc, $p) => $acc + $p['amount'], 0.0);
        $outstanding = max(0.0, $totalBilled - $totalPaid);
        $settlementPct = $totalBilled > 0 ? min(100, round(($totalPaid / $totalBilled) * 100)) : 100;

        return [
            'client' => $client,
            'summary' => [
                'total_billed' => $totalBilled,
                'total_paid' => $totalPaid,
                'outstanding' => $outstanding,
                'settlement_percentage' => $settlementPct,
                'total_invoices_count' => count($formattedInvoices),
                'total_payments_count' => count($formattedPayments)
            ],
            'invoices' => $formattedInvoices,
            'payments' => $formattedPayments
        ];
    }
}
