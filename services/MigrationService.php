<?php
/**
 * CLIENTO - LOCAL STORAGE DATA MIGRATION SERVICE
 * Ingests, validates, maps, and imports existing frontend localStorage data into normalized MySQL tables.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/SettingsService.php';

class MigrationService {
    /**
     * Migrate full localStorage data dump into MySQL under the authenticated user
     */
    public static function migrate(int $userId, array $data): array {
        $db = Database::getConnection();

        $rawClients = $data['clients'] ?? [];
        $rawInvoices = $data['invoices'] ?? [];
        $rawPayments = $data['payments'] ?? [];
        $rawExpenses = $data['expenses'] ?? [];
        $rawSettings = $data['settings'] ?? null;

        $db->beginTransaction();
        try {
            $report = [
                'migrated_at' => date('Y-m-d H:i:s'),
                'clients_migrated' => 0,
                'invoices_migrated' => 0,
                'payments_migrated' => 0,
                'expenses_migrated' => 0,
                'settings_updated' => false,
                'total_billed_imported' => 0.0,
                'total_received_imported' => 0.0,
                'warnings' => []
            ];

            // Mapping lookup tables: oldCode => newDbId
            $clientMap = [];
            $invoiceMap = [];

            // 1. Migrate Settings
            if (is_array($rawSettings) && !empty($rawSettings)) {
                SettingsService::updateSettings($userId, [
                    'business_name' => $rawSettings['business_name'] ?? $rawSettings['businessName'] ?? '',
                    'phone' => $rawSettings['phone'] ?? '',
                    'email' => $rawSettings['email'] ?? '',
                    'address' => $rawSettings['address'] ?? '',
                    'currency' => $rawSettings['currency'] ?? 'INR',
                    'billing_preference' => (int)($rawSettings['billing_preference'] ?? $rawSettings['billingPreference'] ?? 5),
                    'invoice_prefix' => $rawSettings['invoice_prefix'] ?? $rawSettings['invoicePrefix'] ?? 'INV-'
                ]);
                $report['settings_updated'] = true;
            }

            // 2. Migrate Clients
            $clientInsert = $db->prepare('
                INSERT INTO clients (
                    user_id, client_code, name, company, phone, email,
                    service, monthly_amount, due_day, retainer_status,
                    status, joining_date, notes, created_at, updated_at
                ) VALUES (
                    :uid, :code, :name, :company, :phone, :email,
                    :service, :monthly, :due_day, :ret_status,
                    :status, :joining, :notes, :created, NOW()
                )
            ');

            foreach ($rawClients as $c) {
                $oldId = $c['id'] ?? ('cli_' . uniqid());
                $name = trim($c['name'] ?? 'Unnamed Client');
                $monthlyAmount = (float)($c['monthlyAmount'] ?? $c['monthly_amount'] ?? 0);
                $retainerStatus = $monthlyAmount > 0 ? ($c['retainerStatus'] ?? $c['retainer_status'] ?? 'active') : null;

                $clientInsert->execute([
                    ':uid' => $userId,
                    ':code' => $oldId,
                    ':name' => $name,
                    ':company' => trim($c['company'] ?? ''),
                    ':phone' => trim($c['phone'] ?? ''),
                    ':email' => trim($c['email'] ?? ''),
                    ':service' => trim($c['service'] ?? ''),
                    ':monthly' => $monthlyAmount,
                    ':due_day' => (int)($c['dueDay'] ?? $c['due_day'] ?? 5),
                    ':ret_status' => $retainerStatus,
                    ':status' => $c['status'] ?? 'active',
                    ':joining' => $c['joiningDate'] ?? $c['joining_date'] ?? date('Y-m-d'),
                    ':notes' => trim($c['notes'] ?? ''),
                    ':created' => !empty($c['createdAt']) ? date('Y-m-d H:i:s', strtotime($c['createdAt'])) : date('Y-m-d H:i:s')
                ]);

                $newCid = (int)$db->lastInsertId();
                $clientMap[$oldId] = $newCid;
                $report['clients_migrated']++;
            }

            // 3. Migrate Invoices
            $invoiceInsert = $db->prepare('
                INSERT INTO invoices (
                    user_id, client_id, invoice_code, invoice_number, service_name,
                    charge_type, notes, billing_month, amount, due_date, status, created_at, updated_at
                ) VALUES (
                    :uid, :cid, :code, :inv_num, :service,
                    :ctype, :notes, :month, :amount, :due, :status, :created, NOW()
                )
            ');

            foreach ($rawInvoices as $inv) {
                $oldInvId = $inv['id'] ?? ('inv_' . uniqid());
                $oldClientId = $inv['clientId'] ?? $inv['client_id'] ?? null;

                // Match client ID in mapping
                $mappedClientId = $clientMap[$oldClientId] ?? null;
                if (!$mappedClientId) {
                    // Try to find client by name
                    $cliName = trim($inv['clientName'] ?? $inv['client_name'] ?? '');
                    if ($cliName) {
                        $findCli = $db->prepare('SELECT id FROM clients WHERE user_id = :uid AND name = :name LIMIT 1');
                        $findCli->execute([':uid' => $userId, ':name' => $cliName]);
                        $mappedClientId = $findCli->fetchColumn();
                    }
                }

                if (!$mappedClientId) {
                    $report['warnings'][] = "Invoice {$oldInvId} could not be mapped to any client; skipped.";
                    continue;
                }

                $invNum = trim($inv['invoiceNumber'] ?? $inv['invoice_number'] ?? '');
                if (!$invNum) {
                    $invNum = Helpers::generateInvoiceNumber($userId);
                }

                // Check for duplicate invoice number under this user
                $dupCheck = $db->prepare('SELECT 1 FROM invoices WHERE user_id = :uid AND invoice_number = :num LIMIT 1');
                $dupCheck->execute([':uid' => $userId, ':num' => $invNum]);
                if ($dupCheck->fetch()) {
                    $invNum .= '-MIG';
                }

                $amount = (float)($inv['amount'] ?? 0);
                $chargeType = $inv['chargeType'] ?? $inv['charge_type'] ?? 'standard';
                $billingMonth = $inv['billingMonth'] ?? $inv['billing_month'] ?? date('Y-m');

                $invoiceInsert->execute([
                    ':uid' => $userId,
                    ':cid' => $mappedClientId,
                    ':code' => $oldInvId,
                    ':inv_num' => $invNum,
                    ':service' => trim($inv['serviceName'] ?? $inv['service_name'] ?? 'Service'),
                    ':ctype' => $chargeType,
                    ':notes' => trim($inv['notes'] ?? ''),
                    ':month' => $billingMonth,
                    ':amount' => $amount,
                    ':due' => $inv['dueDate'] ?? $inv['due_date'] ?? date('Y-m-d'),
                    ':status' => $inv['status'] ?? 'pending',
                    ':created' => !empty($inv['createdAt']) ? date('Y-m-d H:i:s', strtotime($inv['createdAt'])) : date('Y-m-d H:i:s')
                ]);

                $newIid = (int)$db->lastInsertId();
                $invoiceMap[$oldInvId] = $newIid;
                $report['invoices_migrated']++;
                $report['total_billed_imported'] += $amount;
            }

            // 4. Migrate Payments
            $paymentInsert = $db->prepare('
                INSERT INTO payments (
                    user_id, invoice_id, client_id, payment_code, amount,
                    payment_date, payment_method, notes, reference_number, created_at
                ) VALUES (
                    :uid, :iid, :cid, :code, :amount,
                    :pdate, :method, :notes, :ref, :created
                )
            ');

            foreach ($rawPayments as $p) {
                $oldPayId = $p['id'] ?? ('pay_' . uniqid());
                $oldInvId = $p['invoiceId'] ?? $p['invoice_id'] ?? null;
                $oldCliId = $p['clientId'] ?? $p['client_id'] ?? null;

                $mappedInvId = $invoiceMap[$oldInvId] ?? null;
                $mappedCliId = $clientMap[$oldCliId] ?? null;

                if (!$mappedInvId) {
                    $report['warnings'][] = "Payment {$oldPayId} could not be mapped to invoice {$oldInvId}; skipped.";
                    continue;
                }

                if (!$mappedCliId) {
                    // Resolve from invoice
                    $findCli = $db->prepare('SELECT client_id FROM invoices WHERE id = :iid LIMIT 1');
                    $findCli->execute([':iid' => $mappedInvId]);
                    $mappedCliId = (int)$findCli->fetchColumn();
                }

                $amount = (float)($p['amount'] ?? 0);

                $paymentInsert->execute([
                    ':uid' => $userId,
                    ':iid' => $mappedInvId,
                    ':cid' => $mappedCliId,
                    ':code' => $oldPayId,
                    ':amount' => $amount,
                    ':pdate' => $p['paymentDate'] ?? $p['payment_date'] ?? date('Y-m-d'),
                    ':method' => $p['paymentMethod'] ?? $p['payment_method'] ?? 'Bank Transfer',
                    ':notes' => trim($p['notes'] ?? ''),
                    ':ref' => trim($p['referenceNumber'] ?? $p['reference_number'] ?? ''),
                    ':created' => !empty($p['createdAt']) ? date('Y-m-d H:i:s', strtotime($p['createdAt'])) : date('Y-m-d H:i:s')
                ]);

                $report['payments_migrated']++;
                $report['total_received_imported'] += $amount;
            }

            // 5. Migrate Expenses
            $findCatStmt = $db->prepare('SELECT id FROM expense_categories WHERE user_id = :uid AND name = :name LIMIT 1');
            $insertCatStmt = $db->prepare('INSERT INTO expense_categories (user_id, name, is_default, created_at) VALUES (:uid, :name, 0, NOW())');

            $expInsert = $db->prepare('
                INSERT INTO expenses (
                    user_id, category_id, expense_code, title, category,
                    amount, date, description, created_at, updated_at
                ) VALUES (
                    :uid, :cat_id, :code, :title, :category,
                    :amount, :date, :desc, :created, NOW()
                )
            ');

            foreach ($rawExpenses as $e) {
                $oldExpId = $e['id'] ?? ('exp_' . uniqid());
                $category = trim($e['category'] ?? 'Other');

                $findCatStmt->execute([':uid' => $userId, ':name' => $category]);
                $catId = $findCatStmt->fetchColumn();

                if (!$catId) {
                    $insertCatStmt->execute([':uid' => $userId, ':name' => $category]);
                    $catId = (int)$db->lastInsertId();
                }

                $expInsert->execute([
                    ':uid' => $userId,
                    ':cat_id' => $catId ?: null,
                    ':code' => $oldExpId,
                    ':title' => trim($e['title'] ?? 'Expense'),
                    ':category' => $category,
                    ':amount' => (float)($e['amount'] ?? 0),
                    ':date' => $e['date'] ?? date('Y-m-d'),
                    ':desc' => trim($e['description'] ?? ''),
                    ':created' => !empty($e['createdAt']) ? date('Y-m-d H:i:s', strtotime($e['createdAt'])) : date('Y-m-d H:i:s')
                ]);

                $report['expenses_migrated']++;
            }

            // 6. Recalculate all invoice statuses based on newly imported payments
            $allInvoicesStmt = $db->prepare('SELECT id, amount, due_date FROM invoices WHERE user_id = :uid');
            $allInvoicesStmt->execute([':uid' => $userId]);
            $allInvs = $allInvoicesStmt->fetchAll();

            $today = date('Y-m-d');
            $updateStatusStmt = $db->prepare('UPDATE invoices SET status = :status WHERE id = :id');

            foreach ($allInvs as $inv) {
                $iid = (int)$inv['id'];
                $totalAmt = (float)$inv['amount'];

                $paidStmt = $db->prepare('SELECT COALESCE(SUM(amount), 0.00) FROM payments WHERE invoice_id = :iid');
                $paidStmt->execute([':iid' => $iid]);
                $paidAmt = (float)$paidStmt->fetchColumn();

                $status = 'pending';
                if ($paidAmt >= $totalAmt && $totalAmt > 0) {
                    $status = 'paid';
                } elseif ($paidAmt > 0) {
                    $status = 'partial';
                } elseif ($inv['due_date'] && $today > $inv['due_date']) {
                    $status = 'overdue';
                }

                $updateStatusStmt->execute([':status' => $status, ':id' => $iid]);
            }

            $db->commit();

            Helpers::logActivity(
                $userId,
                'migration',
                null,
                'import_localstorage',
                "Migrated {$report['clients_migrated']} clients, {$report['invoices_migrated']} invoices, {$report['payments_migrated']} payments, {$report['expenses_migrated']} expenses"
            );

            return $report;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }
}
