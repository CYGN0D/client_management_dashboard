<?php
/**
 * CLIENTO - INVOICE SERVICE & MONTHLY BILLING GENERATOR
 * Handles invoice creation, lifecycle status derivation, and idempotent monthly retainer generation.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

class InvoiceService {
    /**
     * Get all invoices with live derived settlement status
     */
    public static function getAll(
        int $userId,
        ?string $statusFilter = null,
        ?string $monthFilter = null,
        ?int $clientId = null,
        ?string $search = null
    ): array {
        $db = Database::getConnection();
        $today = date('Y-m-d');

        $sql = '
            SELECT 
                i.*,
                c.name AS client_name,
                c.email AS client_email,
                c.phone AS client_phone,
                c.company AS client_company,
                COALESCE(SUM(p.amount), 0.00) AS paid_amount
            FROM invoices i
            JOIN clients c ON c.id = i.client_id
            LEFT JOIN payments p ON p.invoice_id = i.id AND p.user_id = :uid_p
            WHERE i.user_id = :uid_i
        ';

        $params = [
            ':uid_p' => $userId,
            ':uid_i' => $userId
        ];

        if ($monthFilter && $monthFilter !== 'all') {
            $sql .= ' AND i.billing_month = :month';
            $params[':month'] = $monthFilter;
        }

        if ($clientId) {
            $sql .= ' AND i.client_id = :client_id';
            $params[':client_id'] = $clientId;
        }

        if ($search !== null && trim($search) !== '') {
            $term = '%' . trim($search) . '%';
            $sql .= ' AND (i.invoice_number LIKE :search_inv OR c.name LIKE :search_cli OR i.service_name LIKE :search_svc OR i.notes LIKE :search_notes)';
            $params[':search_inv'] = $term;
            $params[':search_cli'] = $term;
            $params[':search_svc'] = $term;
            $params[':search_notes'] = $term;
        }

        $sql .= ' GROUP BY i.id ORDER BY i.due_date DESC, i.id DESC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $invoices = [];
        foreach ($rows as $inv) {
            $amount = (float)$inv['amount'];
            $paid = (float)$inv['paid_amount'];
            $rem = max(0.0, $amount - $paid);

            $status = 'pending';
            if ($paid >= $amount && $amount > 0) {
                $status = 'paid';
            } elseif ($paid > 0) {
                $status = 'partial';
            } elseif ($inv['due_date'] && $today > $inv['due_date']) {
                $status = 'overdue';
            }

            $isOverdue = ($status === 'overdue' || ($status === 'partial' && $inv['due_date'] && $today > $inv['due_date']));

            // Filter by live derived status if requested
            if ($statusFilter && $statusFilter !== 'all') {
                if ($statusFilter === 'overdue' && !$isOverdue) {
                    continue;
                } elseif ($statusFilter !== 'overdue' && $status !== $statusFilter) {
                    continue;
                }
            }

            $invoices[] = [
                'id' => (int)$inv['id'],
                'invoice_code' => $inv['invoice_code'] ?: ('inv_' . $inv['id']),
                'invoice_number' => $inv['invoice_number'],
                'client_id' => (int)$inv['client_id'],
                'client_name' => $inv['client_name'],
                'client_email' => $inv['client_email'] ?? '',
                'client_phone' => $inv['client_phone'] ?? '',
                'client_company' => $inv['client_company'] ?? '',
                'service_name' => $inv['service_name'],
                'charge_type' => $inv['charge_type'],
                'notes' => $inv['notes'] ?? '',
                'billing_month' => $inv['billing_month'],
                'amount' => $amount,
                'paid_amount' => $paid,
                'remaining_due' => $rem,
                'due_date' => $inv['due_date'],
                'status' => $status,
                'is_overdue' => $isOverdue,
                'created_at' => $inv['created_at'],
                'updated_at' => $inv['updated_at']
            ];
        }

        return $invoices;
    }

    /**
     * Get single invoice by ID with live paid amount
     */
    public static function getById(int $userId, int $invoiceId): ?array {
        $db = Database::getConnection();
        $today = date('Y-m-d');

        $stmt = $db->prepare('
            SELECT 
                i.*,
                c.name AS client_name,
                c.email AS client_email,
                c.phone AS client_phone,
                c.company AS client_company,
                COALESCE(SUM(p.amount), 0.00) AS paid_amount
            FROM invoices i
            JOIN clients c ON c.id = i.client_id
            LEFT JOIN payments p ON p.invoice_id = i.id AND p.user_id = :uid_p
            WHERE i.id = :id AND i.user_id = :uid_i
            GROUP BY i.id
            LIMIT 1
        ');
        $stmt->execute([
            ':id' => $invoiceId,
            ':uid_p' => $userId,
            ':uid_i' => $userId
        ]);
        $inv = $stmt->fetch();

        if (!$inv) return null;

        $amount = (float)$inv['amount'];
        $paid = (float)$inv['paid_amount'];
        $rem = max(0.0, $amount - $paid);

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
            'client_id' => (int)$inv['client_id'],
            'client_name' => $inv['client_name'],
            'client_email' => $inv['client_email'] ?? '',
            'client_phone' => $inv['client_phone'] ?? '',
            'client_company' => $inv['client_company'] ?? '',
            'service_name' => $inv['service_name'],
            'charge_type' => $inv['charge_type'],
            'notes' => $inv['notes'] ?? '',
            'billing_month' => $inv['billing_month'],
            'amount' => $amount,
            'paid_amount' => $paid,
            'remaining_due' => $rem,
            'due_date' => $inv['due_date'],
            'status' => $status,
            'is_overdue' => ($status === 'overdue' || ($status === 'partial' && $inv['due_date'] && $today > $inv['due_date'])),
            'created_at' => $inv['created_at'],
            'updated_at' => $inv['updated_at']
        ];
    }

    /**
     * Create a new invoice / project charge
     */
    public static function create(int $userId, array $data): array {
        $db = Database::getConnection();

        // Verify client belongs to user
        $clientStmt = $db->prepare('SELECT id, name FROM clients WHERE id = :cid AND user_id = :uid LIMIT 1');
        $clientStmt->execute([':cid' => $data['client_id'], ':uid' => $userId]);
        $client = $clientStmt->fetch();
        if (!$client) {
            throw new Exception('Invalid client selected or unauthorized.');
        }

        $invNumber = !empty($data['invoice_number']) ? trim($data['invoice_number']) : Helpers::generateInvoiceNumber($userId);
        $amount = (float)$data['amount'];
        if ($amount <= 0) {
            throw new Exception('Invoice amount must be greater than zero.');
        }

        $chargeType = $data['charge_type'] ?? 'standard';
        $billingMonth = $data['billing_month'] ?? date('Y-m');

        // Retainer duplicate prevention check
        if ($chargeType === 'retainer') {
            $dupStmt = $db->prepare('
                SELECT id, invoice_number 
                FROM invoices 
                WHERE client_id = :cid AND billing_month = :month AND charge_type = "retainer"
                LIMIT 1
            ');
            $dupStmt->execute([':cid' => $data['client_id'], ':month' => $billingMonth]);
            $existing = $dupStmt->fetch();
            if ($existing) {
                throw new Exception("Monthly retainer invoice ({$existing['invoice_number']}) already exists for {$client['name']} for {$billingMonth}.");
            }
        }

        $db->beginTransaction();
        try {
            $stmt = $db->prepare('
                INSERT INTO invoices (
                    user_id, client_id, invoice_code, invoice_number, service_name,
                    charge_type, notes, billing_month, amount, due_date, status, created_at, updated_at
                ) VALUES (
                    :uid, :cid, :code, :inv_num, :service,
                    :ctype, :notes, :month, :amount, :due, "pending", NOW(), NOW()
                )
            ');

            $tempCode = $data['invoice_code'] ?? null;
            $stmt->execute([
                ':uid' => $userId,
                ':cid' => (int)$data['client_id'],
                ':code' => $tempCode,
                ':inv_num' => $invNumber,
                ':service' => trim($data['service_name'] ?? 'Service'),
                ':ctype' => $chargeType,
                ':notes' => trim($data['notes'] ?? ''),
                ':month' => $billingMonth,
                ':amount' => $amount,
                ':due' => $data['due_date'] ?? date('Y-m-d')
            ]);

            $invoiceId = (int)$db->lastInsertId();

            if (empty($tempCode)) {
                $code = 'inv_' . $invoiceId;
                $db->prepare('UPDATE invoices SET invoice_code = :c WHERE id = :id')->execute([':c' => $code, ':id' => $invoiceId]);
            }

            // Optional itemized line items
            if (!empty($data['items']) && is_array($data['items'])) {
                $itemStmt = $db->prepare('
                    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_amount, created_at)
                    VALUES (:iid, :desc, :qty, :price, :total, NOW())
                ');
                foreach ($data['items'] as $item) {
                    $qty = (float)($item['quantity'] ?? 1);
                    $price = (float)($item['unit_price'] ?? 0);
                    $total = (float)($item['total_amount'] ?? ($qty * $price));
                    $itemStmt->execute([
                        ':iid' => $invoiceId,
                        ':desc' => trim($item['description'] ?? 'Item'),
                        ':qty' => $qty,
                        ':price' => $price,
                        ':total' => $total
                    ]);
                }
            }

            $db->commit();

            Helpers::logActivity(
                $userId,
                'invoice',
                $invoiceId,
                'create',
                "Created invoice {$invNumber} for {$client['name']} (" . Helpers::formatCurrency($amount) . ")"
            );

            return self::getById($userId, $invoiceId);
        } catch (Exception $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            if (str_contains($e->getMessage(), 'UNIQUE constraint failed') || str_contains($e->getMessage(), 'Duplicate entry') || str_contains($e->getMessage(), 'uk_client_retainer_month')) {
                if ($chargeType === 'retainer') {
                    throw new Exception("Monthly retainer invoice already exists for {$client['name']} for {$billingMonth}.");
                } else {
                    throw new Exception("Invoice number '{$invNumber}' already exists. Please choose a different invoice number.");
                }
            }
            throw $e;
        }
    }

    /**
     * Update an invoice
     */
    public static function update(int $userId, int $invoiceId, array $data): array {
        $existing = self::getById($userId, $invoiceId);
        if (!$existing) {
            throw new Exception('Invoice not found or unauthorized.');
        }

        $db = Database::getConnection();
        $amount = isset($data['amount']) ? (float)$data['amount'] : $existing['amount'];
        if ($amount < $existing['paid_amount']) {
            throw new Exception('Invoice amount cannot be reduced below already settled payments of ' . Helpers::formatCurrency($existing['paid_amount']));
        }

        $stmt = $db->prepare('
            UPDATE invoices SET
                service_name = :service,
                notes = :notes,
                amount = :amount,
                due_date = :due_date,
                updated_at = NOW()
            WHERE id = :id AND user_id = :uid
        ');

        $stmt->execute([
            ':id' => $invoiceId,
            ':uid' => $userId,
            ':service' => isset($data['service_name']) ? trim($data['service_name']) : $existing['service_name'],
            ':notes' => isset($data['notes']) ? trim($data['notes']) : $existing['notes'],
            ':amount' => $amount,
            ':due_date' => $data['due_date'] ?? $existing['due_date']
        ]);

        Helpers::logActivity(
            $userId,
            'invoice',
            $invoiceId,
            'update',
            "Updated invoice {$existing['invoice_number']}"
        );

        return self::getById($userId, $invoiceId);
    }

    /**
     * Delete an invoice and its associated payment transactions
     */
    public static function delete(int $userId, int $invoiceId): array {
        $existing = self::getById($userId, $invoiceId);
        if (!$existing) {
            throw new Exception('Invoice not found or unauthorized.');
        }

        $db = Database::getConnection();
        $db->beginTransaction();
        try {
            // Delete invoice (ON DELETE CASCADE in schema removes payments & items)
            $stmt = $db->prepare('DELETE FROM invoices WHERE id = :id AND user_id = :uid');
            $stmt->execute([':id' => $invoiceId, ':uid' => $userId]);

            $db->commit();

            Helpers::logActivity(
                $userId,
                'invoice',
                $invoiceId,
                'delete',
                "Deleted invoice {$existing['invoice_number']} and its linked payments"
            );

            return [
                'action' => 'deleted',
                'message' => "Invoice {$existing['invoice_number']} deleted successfully.",
                'invoice_id' => $invoiceId
            ];
        } catch (Exception $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            if (str_contains($e->getMessage(), 'UNIQUE constraint failed') || str_contains($e->getMessage(), 'Duplicate entry') || str_contains($e->getMessage(), 'uk_client_retainer_month')) {
                if ($chargeType === 'retainer') {
                    throw new Exception("Monthly retainer invoice already exists for {$client['name']} for {$billingMonth}.");
                } else {
                    throw new Exception("Invoice number '{$invNumber}' already exists. Please choose a different invoice number.");
                }
            }
            throw $e;
        }
    }

    /**
     * Idempotent Monthly Invoice Generation
     * Generates monthly retainer invoices for active clients
     */
    public static function generateMonthlyInvoices(int $userId, string $billingMonth, array $selectedClientIds = []): array {
        $db = Database::getConnection();

        // 1. Fetch eligible active clients with positive monthly retainer rate
        $sql = '
            SELECT id, name, service, monthly_amount, due_day, joining_date, retainer_status
            FROM clients
            WHERE user_id = ? 
              AND status = "active" 
              AND monthly_amount > 0 
              AND retainer_status = "active"
        ';
        $params = [$userId];

        if (!empty($selectedClientIds)) {
            $inPlaceholders = implode(',', array_fill(0, count($selectedClientIds), '?'));
            $sql .= " AND id IN ({$inPlaceholders})";
            $params = array_merge([$userId], array_values($selectedClientIds));
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $clients = $stmt->fetchAll();

        // 2. Fetch existing retainer invoices for this month to prevent duplicates
        $existingStmt = $db->prepare('
            SELECT client_id 
            FROM invoices 
            WHERE user_id = :uid AND billing_month = :month AND charge_type = "retainer"
        ');
        $existingStmt->execute([':uid' => $userId, ':month' => $billingMonth]);
        $existingClientIds = $existingStmt->fetchAll(PDO::FETCH_COLUMN);
        $existingSet = array_flip($existingClientIds);

        $createdCount = 0;
        $totalAmount = 0.0;
        $skippedCount = 0;
        $createdInvoices = [];

        $db->beginTransaction();
        try {
            $insertStmt = $db->prepare('
                INSERT INTO invoices (
                    user_id, client_id, invoice_code, invoice_number, service_name,
                    charge_type, notes, billing_month, amount, due_date, status, created_at, updated_at
                ) VALUES (
                    :uid, :cid, :code, :inv_num, :service,
                    "retainer", :notes, :month, :amount, :due, "pending", NOW(), NOW()
                )
            ');

            foreach ($clients as $c) {
                $cid = (int)$c['id'];

                // Skip if already generated for this month
                if (isset($existingSet[$cid])) {
                    $skippedCount++;
                    continue;
                }

                // Skip if client joined in a future month
                $joinMonth = substr($c['joining_date'], 0, 7);
                if ($joinMonth && $billingMonth < $joinMonth) {
                    $skippedCount++;
                    continue;
                }

                $amount = (float)$c['monthly_amount'];
                $dueDate = Helpers::calculateDueDate($billingMonth, (int)($c['due_day'] ?? 5));
                $invNumber = Helpers::generateInvoiceNumber($userId);
                $serviceName = !empty($c['service']) ? $c['service'] : 'Monthly Retainer';
                $notes = "Monthly Retainer for " . date('F Y', strtotime($billingMonth . '-01'));

                $insertStmt->execute([
                    ':uid' => $userId,
                    ':cid' => $cid,
                    ':code' => null,
                    ':inv_num' => $invNumber,
                    ':service' => $serviceName,
                    ':notes' => $notes,
                    ':month' => $billingMonth,
                    ':amount' => $amount,
                    ':due' => $dueDate
                ]);

                $newId = (int)$db->lastInsertId();
                $code = 'inv_' . $newId;
                $db->prepare('UPDATE invoices SET invoice_code = :c WHERE id = :id')->execute([':c' => $code, ':id' => $newId]);

                $createdCount++;
                $totalAmount += $amount;
                $createdInvoices[] = [
                    'id' => $newId,
                    'invoice_number' => $invNumber,
                    'client_id' => $cid,
                    'client_name' => $c['name'],
                    'amount' => $amount,
                    'due_date' => $dueDate
                ];
            }

            $db->commit();

            if ($createdCount > 0) {
                Helpers::logActivity(
                    $userId,
                    'invoice',
                    null,
                    'generate_monthly',
                    "Generated {$createdCount} invoices for {$billingMonth} totaling " . Helpers::formatCurrency($totalAmount)
                );
            }

            return [
                'billing_month' => $billingMonth,
                'created_count' => $createdCount,
                'skipped_count' => $skippedCount,
                'total_amount' => $totalAmount,
                'invoices' => $createdInvoices
            ];
        } catch (Exception $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            if (str_contains($e->getMessage(), 'UNIQUE constraint failed') || str_contains($e->getMessage(), 'Duplicate entry') || str_contains($e->getMessage(), 'uk_client_retainer_month')) {
                if ($chargeType === 'retainer') {
                    throw new Exception("Monthly retainer invoice already exists for {$client['name']} for {$billingMonth}.");
                } else {
                    throw new Exception("Invoice number '{$invNumber}' already exists. Please choose a different invoice number.");
                }
            }
            throw $e;
        }
    }

    /**
     * Get payment history for an invoice
     */
    public static function getInvoiceHistory(int $userId, int $invoiceId): array {
        $invoice = self::getById($userId, $invoiceId);
        if (!$invoice) {
            throw new Exception('Invoice not found or unauthorized.');
        }

        $db = Database::getConnection();
        $stmt = $db->prepare('
            SELECT * FROM payments 
            WHERE invoice_id = :iid AND user_id = :uid 
            ORDER BY payment_date DESC, id DESC
        ');
        $stmt->execute([':iid' => $invoiceId, ':uid' => $userId]);
        $payments = $stmt->fetchAll();

        return [
            'invoice' => $invoice,
            'payments' => array_map(function ($p) {
                return [
                    'id' => (int)$p['id'],
                    'payment_code' => $p['payment_code'] ?: ('pay_' . $p['id']),
                    'amount' => (float)$p['amount'],
                    'payment_date' => $p['payment_date'],
                    'payment_method' => $p['payment_method'],
                    'notes' => $p['notes'] ?? '',
                    'reference_number' => $p['reference_number'] ?? '',
                    'created_at' => $p['created_at']
                ];
            }, $payments)
        ];
    }
}
