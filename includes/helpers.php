<?php
/**
 * CLIENTO - UTILITY HELPERS
 * Centralized formatting, logging, and ID generation.
 */

require_once __DIR__ . '/db.php';

class Helpers {
    /**
     * Get effective HTTP request method with Method Tunneling support for shared hosting
     * (Supports X-HTTP-Method-Override header, FastCGI redirect header, _method query param, and _method form/JSON body)
     */
    public static function getRequestMethod(): string {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($method === 'POST') {
            // 1. Check HTTP header (standard or Apache FastCGI environment prefix)
            $override = $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] 
                ?? $_SERVER['REDIRECT_HTTP_X_HTTP_METHOD_OVERRIDE'] 
                ?? '';
            if (!empty($override)) {
                return strtoupper(trim($override));
            }

            // 2. Check query string ?_method=DELETE or ?_method=PUT
            if (!empty($_GET['_method'])) {
                return strtoupper(trim((string)$_GET['_method']));
            }

            // 3. Check parsed form body $_POST['_method']
            if (!empty($_POST['_method'])) {
                return strtoupper(trim((string)$_POST['_method']));
            }

            // 4. Check JSON body if Content-Type is application/json
            $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
            if (stripos($contentType, 'application/json') !== false) {
                $raw = @file_get_contents('php://input');
                if (!empty($raw) && ($raw[0] === '{' || $raw[0] === '[')) {
                    $json = json_decode($raw, true);
                    if (is_array($json) && !empty($json['_method'])) {
                        return strtoupper(trim((string)$json['_method']));
                    }
                }
            }
        }
        return $method;
    }

    /**
     * Record an audit action into activity_logs
     */
    public static function logActivity(
        int $userId,
        string $entityType,
        ?int $entityId,
        string $action,
        string $description
    ): void {
        try {
            $db = Database::getConnection();
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            $stmt = $db->prepare('
                INSERT INTO activity_logs (user_id, entity_type, entity_id, action, description, ip_address, created_at)
                VALUES (:user_id, :entity_type, :entity_id, :action, :description, :ip, NOW())
            ');
            $stmt->execute([
                ':user_id' => $userId,
                ':entity_type' => $entityType,
                ':entity_id' => $entityId,
                ':action' => $action,
                ':description' => $description,
                ':ip' => substr($ip, 0, 45)
            ]);
        } catch (Exception $e) {
            // Activity log failure should never break core transaction
            error_log('[Cliento Activity Log Warning] ' . $e->getMessage());
        }
    }

    /**
     * Generate the next sequential unique invoice number for a user
     */
    public static function generateInvoiceNumber(int $userId, ?string $prefix = null): string {
        $db = Database::getConnection();
        
        if ($prefix === null) {
            $stmt = $db->prepare('SELECT invoice_prefix FROM settings WHERE user_id = :uid LIMIT 1');
            $stmt->execute([':uid' => $userId]);
            $row = $stmt->fetch();
            $prefix = !empty($row['invoice_prefix']) ? trim($row['invoice_prefix']) : 'INV-';
        }

        $year = date('Y');
        $prefixPattern = $prefix . $year . '-%';

        // Get max sequence number for this year and prefix
        $stmt = $db->prepare('
            SELECT invoice_number 
            FROM invoices 
            WHERE user_id = :uid AND invoice_number LIKE :pattern 
            ORDER BY id DESC 
            LIMIT 1
        ');
        $stmt->execute([
            ':uid' => $userId,
            ':pattern' => $prefixPattern
        ]);
        $lastInv = $stmt->fetchColumn();

        $nextSeq = 1;
        if ($lastInv) {
            // Extract trailing sequence number
            $parts = explode('-', $lastInv);
            $lastNum = (int)end($parts);
            if ($lastNum > 0) {
                $nextSeq = $lastNum + 1;
            }
        }

        // Double check uniqueness loop
        do {
            $candidate = sprintf('%s%s-%04d', $prefix, $year, $nextSeq);
            $checkStmt = $db->prepare('SELECT 1 FROM invoices WHERE user_id = :uid AND invoice_number = :inv LIMIT 1');
            $checkStmt->execute([':uid' => $userId, ':inv' => $candidate]);
            if (!$checkStmt->fetch()) {
                return $candidate;
            }
            $nextSeq++;
        } while ($nextSeq < 999999);

        return sprintf('%s%s-%04d', $prefix, $year, time() % 10000);
    }

    /**
     * Calculate monthly retainer due date given a month string and due day
     */
    public static function calculateDueDate(string $billingMonth, int $dueDay): string {
        // e.g. billingMonth = '2026-11', dueDay = 5 -> '2026-11-05'
        $parts = explode('-', $billingMonth);
        $year = (int)($parts[0] ?? date('Y'));
        $month = (int)($parts[1] ?? date('m'));

        $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
        $clampedDay = min(max(1, $dueDay), $daysInMonth);

        return sprintf('%04d-%02d-%02d', $year, $month, $clampedDay);
    }

    /**
     * Format currency amount for display
     */
    public static function formatCurrency(float $amount, string $currency = 'INR'): string {
        $formatted = number_format($amount, 2, '.', ',');
        return $currency === 'INR' ? '₹' . $formatted : $currency . ' ' . $formatted;
    }
}
