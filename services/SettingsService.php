<?php
/**
 * CLIENTO - SETTINGS SERVICE
 * Handles business profile configurations and billing preferences.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

class SettingsService {
    /**
     * Get user settings with fallback defaults
     */
    public static function getSettings(int $userId): array {
        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM settings WHERE user_id = :uid LIMIT 1');
        $stmt->execute([':uid' => $userId]);
        $s = $stmt->fetch();

        if (!$s) {
            // Provision initial default settings
            $insert = $db->prepare('
                INSERT INTO settings (user_id, business_name, email, currency, billing_preference, invoice_prefix, created_at, updated_at)
                VALUES (:uid, "", "", "INR", 5, "INV-", NOW(), NOW())
            ');
            $insert->execute([':uid' => $userId]);
            return self::getSettings($userId);
        }

        return [
            'id' => (int)$s['id'],
            'user_id' => (int)$s['user_id'],
            'business_name' => $s['business_name'] ?? '',
            'phone' => $s['phone'] ?? '',
            'email' => $s['email'] ?? '',
            'address' => $s['address'] ?? '',
            'currency' => $s['currency'] ?? 'INR',
            'billing_preference' => (int)($s['billing_preference'] ?? 5),
            'invoice_prefix' => $s['invoice_prefix'] ?? 'INV-',
            'created_at' => $s['created_at'],
            'updated_at' => $s['updated_at']
        ];
    }

    /**
     * Update user settings
     */
    public static function updateSettings(int $userId, array $data): array {
        $db = Database::getConnection();
        $current = self::getSettings($userId);

        $stmt = $db->prepare('
            UPDATE settings SET
                business_name = :bname,
                phone = :phone,
                email = :email,
                address = :address,
                currency = :currency,
                billing_preference = :billing_pref,
                invoice_prefix = :inv_prefix,
                updated_at = NOW()
            WHERE user_id = :uid
        ');

        $stmt->execute([
            ':uid' => $userId,
            ':bname' => isset($data['business_name']) ? trim($data['business_name']) : $current['business_name'],
            ':phone' => isset($data['phone']) ? trim($data['phone']) : $current['phone'],
            ':email' => isset($data['email']) ? trim($data['email']) : $current['email'],
            ':address' => isset($data['address']) ? trim($data['address']) : $current['address'],
            ':currency' => isset($data['currency']) ? trim($data['currency']) : 'INR',
            ':billing_pref' => isset($data['billing_preference']) ? (int)$data['billing_preference'] : $current['billing_preference'],
            ':inv_prefix' => isset($data['invoice_prefix']) ? trim($data['invoice_prefix']) : $current['invoice_prefix']
        ]);

        Helpers::logActivity(
            $userId,
            'settings',
            $current['id'],
            'update',
            'Updated business settings and billing preferences'
        );

        return self::getSettings($userId);
    }
}
