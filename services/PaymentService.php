<?php
/**
 * CLIENTO - PAYMENT & SETTLEMENT SERVICE
 * Handles payment recording with overpayment prevention, partial payments, and atomic updates.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/InvoiceService.php';

class PaymentService {
    /**
     * Get payment transactions
     */
    public static function getAll(
        int $userId,
        ?string $monthFilter = null,
        ?int $clientId = null,
        ?int $invoiceId = null
    ): array {
        $db = Database::getConnection();

        $sql = '
            SELECT 
                p.*,
                i.invoice_number,
                i.billing_month,
                i.service_name,
                c.name AS client_name,
                c.company AS client_company
            FROM payments p
            JOIN invoices i ON i.id = p.invoice_id
            JOIN clients c ON c.id = p.client_id
            WHERE p.user_id = :uid
        ';

        $params = [':uid' => $userId];

        if ($monthFilter && $monthFilter !== 'all') {
            $sql .= ' AND p.payment_date LIKE :month';
            $params[':month'] = $monthFilter . '%';
        }

        if ($clientId) {
            $sql .= ' AND p.client_id = :client_id';
            $params[':client_id'] = $clientId;
        }

        if ($invoiceId) {
            $sql .= ' AND p.invoice_id = :invoice_id';
            $params[':invoice_id'] = $invoiceId;
        }

        $sql .= ' ORDER BY p.payment_date DESC, p.id DESC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        return array_map(function ($p) {
            return [
                'id' => (int)$p['id'],
                'payment_code' => $p['payment_code'] ?: ('pay_' . $p['id']),
                'invoice_id' => (int)$p['invoice_id'],
                'invoice_number' => $p['invoice_number'],
                'billing_month' => $p['billing_month'],
                'service_name' => $p['service_name'],
                'client_id' => (int)$p['client_id'],
                'client_name' => $p['client_name'],
                'client_company' => $p['client_company'] ?? '',
                'amount' => (float)$p['amount'],
                'payment_date' => $p['payment_date'],
                'payment_method' => $p['payment_method'],
                'notes' => $p['notes'] ?? '',
                'reference_number' => $p['reference_number'] ?? '',
                'created_at' => $p['created_at']
            ];
        }, $rows);
    }

    /**
     * Get single payment by ID
     */
    public static function getById(int $userId, int $paymentId): ?array {
        $db = Database::getConnection();
        $stmt = $db->prepare('
            SELECT p.*, i.invoice_number, c.name AS client_name
            FROM payments p
            JOIN invoices i ON i.id = p.invoice_id
            JOIN clients c ON c.id = p.client_id
            WHERE p.id = :id AND p.user_id = :uid
            LIMIT 1
        ');
        $stmt->execute([':id' => $paymentId, ':uid' => $userId]);
        $p = $stmt->fetch();

        if (!$p) return null;

        return [
            'id' => (int)$p['id'],
            'payment_code' => $p['payment_code'] ?: ('pay_' . $p['id']),
            'invoice_id' => (int)$p['invoice_id'],
            'invoice_number' => $p['invoice_number'],
            'client_id' => (int)$p['client_id'],
            'client_name' => $p['client_name'],
            'amount' => (float)$p['amount'],
            'payment_date' => $p['payment_date'],
            'payment_method' => $p['payment_method'],
            'notes' => $p['notes'] ?? '',
            'reference_number' => $p['reference_number'] ?? '',
            'created_at' => $p['created_at']
        ];
    }

    /**
     * Record payment transaction against an invoice
     * Strict business rules:
     * - payment amount > 0
     * - payment amount <= remaining balance
     * - atomic database transaction
     * - updates invoice status
     */
    public static function recordPayment(int $userId, array $data): array {
        $db = Database::getConnection();
        $invoiceId = (int)($data['invoice_id'] ?? 0);
        $amount = (float)($data['amount'] ?? 0);

        if ($amount <= 0) {
            throw new Exception('Payment amount must be greater than zero.');
        }

        $db->beginTransaction();
        try {
            // Lock invoice record for update to prevent concurrent double-settlement race conditions
            $forUpdate = Database::getDriver() === 'sqlite' ? '' : 'FOR UPDATE';
            $stmt = $db->prepare("
                SELECT id, client_id, invoice_number, amount, due_date
                FROM invoices
                WHERE id = :id AND user_id = :uid
                $forUpdate
            ");
            $stmt->execute([':id' => $invoiceId, ':uid' => $userId]);
            $invoice = $stmt->fetch();

            if (!$invoice) {
                throw new Exception('Invoice not found or unauthorized.');
            }

            // Calculate currently settled payments for this invoice
            $paidStmt = $db->prepare('
                SELECT COALESCE(SUM(amount), 0.00) 
                FROM payments 
                WHERE invoice_id = :iid AND user_id = :uid
            ');
            $paidStmt->execute([':iid' => $invoiceId, ':uid' => $userId]);
            $currentPaid = (float)$paidStmt->fetchColumn();

            $totalInvoiceAmount = (float)$invoice['amount'];
            $remainingBalance = max(0.0, round($totalInvoiceAmount - $currentPaid, 2));

            if ($amount > ($remainingBalance + 0.001)) { // Allow 0.001 delta for floating point precision
                throw new Exception(
                    'Payment amount of ' . Helpers::formatCurrency($amount) . 
                    ' exceeds the remaining balance of ' . Helpers::formatCurrency($remainingBalance)
                );
            }

            $paymentDate = !empty($data['payment_date']) ? $data['payment_date'] : date('Y-m-d');
            $paymentMethod = !empty($data['payment_method']) ? trim($data['payment_method']) : 'Bank Transfer';
            $notes = trim($data['notes'] ?? '');
            $ref = trim($data['reference_number'] ?? '');

            // Insert payment record
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
                ':cid' => (int)$invoice['client_id'],
                ':amount' => $amount,
                ':pdate' => $paymentDate,
                ':pmethod' => $paymentMethod,
                ':notes' => $notes,
                ':ref' => $ref
            ]);
            $paymentId = (int)$db->lastInsertId();

            $tempCode = $data['payment_code'] ?? null;
            $code = $tempCode ?: ('pay_' . $paymentId);
            $db->prepare('UPDATE payments SET payment_code = :c WHERE id = :id')->execute([':c' => $code, ':id' => $paymentId]);

            // Determine new invoice status
            $newPaidTotal = round($currentPaid + $amount, 2);
            $newStatus = ($newPaidTotal >= $totalInvoiceAmount) ? 'paid' : 'partial';

            $updateInv = $db->prepare('UPDATE invoices SET status = :status, updated_at = NOW() WHERE id = :id');
            $updateInv->execute([':status' => $newStatus, ':id' => $invoiceId]);

            $db->commit();

            Helpers::logActivity(
                $userId,
                'payment',
                $paymentId,
                'record_payment',
                'Recorded payment of ' . Helpers::formatCurrency($amount) . " for invoice {$invoice['invoice_number']} ({$paymentMethod})"
            );

            return [
                'payment' => self::getById($userId, $paymentId),
                'invoice' => InvoiceService::getById($userId, $invoiceId)
            ];
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /**
     * Delete payment transaction and recalculate invoice status
     */
    public static function deletePayment(int $userId, int $paymentId): array {
        $payment = self::getById($userId, $paymentId);
        if (!$payment) {
            throw new Exception('Payment record not found or unauthorized.');
        }

        $db = Database::getConnection();
        $db->beginTransaction();
        try {
            $invoiceId = $payment['invoice_id'];

            // Delete payment
            $delStmt = $db->prepare('DELETE FROM payments WHERE id = :id AND user_id = :uid');
            $delStmt->execute([':id' => $paymentId, ':uid' => $userId]);

            // Recalculate remaining payments for the invoice
            $paidStmt = $db->prepare('
                SELECT COALESCE(SUM(amount), 0.00) 
                FROM payments 
                WHERE invoice_id = :iid AND user_id = :uid
            ');
            $paidStmt->execute([':iid' => $invoiceId, ':uid' => $userId]);
            $remainingPaid = (float)$paidStmt->fetchColumn();

            // Fetch invoice amount & due date
            $invStmt = $db->prepare('SELECT amount, due_date FROM invoices WHERE id = :id AND user_id = :uid');
            $invStmt->execute([':id' => $invoiceId, ':uid' => $userId]);
            $invoice = $invStmt->fetch();

            if ($invoice) {
                $totalInv = (float)$invoice['amount'];
                $today = date('Y-m-d');

                let:
                $newStatus = 'pending';
                if ($remainingPaid >= $totalInv && $totalInv > 0) {
                    $newStatus = 'paid';
                } elseif ($remainingPaid > 0) {
                    $newStatus = 'partial';
                } elseif ($invoice['due_date'] && $today > $invoice['due_date']) {
                    $newStatus = 'overdue';
                }

                $updateInv = $db->prepare('UPDATE invoices SET status = :status, updated_at = NOW() WHERE id = :id');
                $updateInv->execute([':status' => $newStatus, ':id' => $invoiceId]);
            }

            $db->commit();

            Helpers::logActivity(
                $userId,
                'payment',
                $paymentId,
                'delete_payment',
                'Deleted payment receipt of ' . Helpers::formatCurrency($payment['amount']) . " from invoice {$payment['invoice_number']}"
            );

            return [
                'action' => 'deleted',
                'message' => 'Payment record deleted and invoice status recalculated.',
                'payment_id' => $paymentId,
                'invoice' => $invoice ? InvoiceService::getById($userId, $invoiceId) : null
            ];
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }
}
