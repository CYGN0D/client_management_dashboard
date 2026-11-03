<?php
/**
 * CLIENTO - AUTHENTICATION SERVICE
 * Business logic for user login, registration, and profile resolution.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

class AuthService {
    /**
     * Authenticate user credentials and start authenticated session
     */
    public static function login(string $email, string $password): array {
        $db = Database::getConnection();
        $stmt = $db->prepare('
            SELECT id, name, email, password_hash, status 
            FROM users 
            WHERE email = :email 
            LIMIT 1
        ');
        $stmt->execute([':email' => strtolower(trim($email))]);
        $user = $stmt->fetch();

        if (!$user) {
            throw new Exception('Invalid email or password.');
        }

        if ($user['status'] !== 'active') {
            throw new Exception('Your account is inactive. Please contact support.');
        }

        if (!password_verify($password, $user['password_hash'])) {
            throw new Exception('Invalid email or password.');
        }

        // Establish session and regenerate session ID
        AuthMiddleware::login((int)$user['id'], $user['email'], $user['name']);

        Helpers::logActivity(
            (int)$user['id'],
            'user',
            (int)$user['id'],
            'login',
            'User logged in successfully'
        );

        return [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'csrf_token' => AuthMiddleware::generateCsrfToken()
        ];
    }

    /**
     * Register a new user account with default settings & categories
     */
    public static function register(string $name, string $email, string $password): array {
        $db = Database::getConnection();
        $email = strtolower(trim($email));

        // Check if email already registered
        $stmt = $db->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        if ($stmt->fetch()) {
            throw new Exception('An account with this email address already exists.');
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);

        $db->beginTransaction();
        try {
            $insertStmt = $db->prepare('
                INSERT INTO users (name, email, password_hash, status, created_at, updated_at)
                VALUES (:name, :email, :hash, "active", NOW(), NOW())
            ');
            $insertStmt->execute([
                ':name' => trim($name),
                ':email' => $email,
                ':hash' => $hash
            ]);
            $userId = (int)$db->lastInsertId();

            // Create initial default settings
            $settingsStmt = $db->prepare('
                INSERT INTO settings (user_id, business_name, email, currency, billing_preference, invoice_prefix, created_at, updated_at)
                VALUES (:uid, :bname, :email, "INR", 5, "INV-", NOW(), NOW())
            ');
            $settingsStmt->execute([
                ':uid' => $userId,
                ':bname' => trim($name) . ' Studio',
                ':email' => $email
            ]);

            // Seed default expense categories
            $categories = ['Software', 'Hosting', 'Internet', 'Marketing', 'Office', 'Travel', 'Other'];
            $catStmt = $db->prepare('
                INSERT INTO expense_categories (user_id, name, is_default, created_at)
                VALUES (:uid, :name, 1, NOW())
            ');
            foreach ($categories as $cat) {
                $catStmt->execute([':uid' => $userId, ':name' => $cat]);
            }

            $db->commit();

            AuthMiddleware::login($userId, $email, trim($name));

            Helpers::logActivity(
                $userId,
                'user',
                $userId,
                'register',
                'New account registered and provisioned'
            );

            return [
                'id' => $userId,
                'name' => trim($name),
                'email' => $email,
                'csrf_token' => AuthMiddleware::generateCsrfToken()
            ];
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /**
     * Get current authenticated user details
     */
    public static function me(int $userId): array {
        $db = Database::getConnection();
        $stmt = $db->prepare('
            SELECT u.id, u.name, u.email, u.status, u.created_at,
                   s.business_name, s.currency, s.invoice_prefix, s.billing_preference
            FROM users u
            LEFT JOIN settings s ON s.user_id = u.id
            WHERE u.id = :id
            LIMIT 1
        ');
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch();

        if (!$user) {
            throw new Exception('User not found.');
        }

        return [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'business_name' => $user['business_name'] ?? '',
            'currency' => $user['currency'] ?? 'INR',
            'invoice_prefix' => $user['invoice_prefix'] ?? 'INV-',
            'billing_preference' => (int)($user['billing_preference'] ?? 5),
            'csrf_token' => AuthMiddleware::generateCsrfToken()
        ];
    }
}
