<?php
/**
 * CLIENTO - SESSION & AUTHENTICATION MIDDLEWARE
 * Handles secure session configuration, CSRF tokens, and authentication enforcement.
 */

require_once __DIR__ . '/response.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

class AuthMiddleware {
    private static bool $sessionStarted = false;

    /**
     * Start secure session with strict cookie parameters
     */
    public static function startSession(): void {
        if (self::$sessionStarted || session_status() === PHP_SESSION_ACTIVE) {
            self::$sessionStarted = true;
            return;
        }

        if (!headers_sent()) {
            $appConfig = require __DIR__ . '/../config/app.php';
            $sessionConfig = $appConfig['session'] ?? [];

            session_name($sessionConfig['name'] ?? 'CLIENTO_SESSID');

            session_set_cookie_params([
                'lifetime' => $sessionConfig['lifetime'] ?? 86400 * 7,
                'path' => $sessionConfig['path'] ?? '/',
                'domain' => $sessionConfig['domain'] ?? '',
                'secure' => $sessionConfig['secure'] ?? false,
                'httponly' => $sessionConfig['httponly'] ?? true,
                'samesite' => $sessionConfig['samesite'] ?? 'Lax'
            ]);
        }

        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        self::$sessionStarted = true;
    }

    /**
     * Enforce authentication and return the authenticated user ID
     */
    public static function requireAuth(): int {
        self::startSession();

        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            Response::unauthorized('Authentication required to access this resource.');
        }

        // Validate that user exists and is active in database
        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT id, status FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch();

        if (!$user || $user['status'] !== 'active') {
            self::logout();
            Response::unauthorized('Your account is inactive or no longer exists.');
        }

        return (int)$userId;
    }

    /**
     * Get currently authenticated user ID or null
     */
    public static function getUserId(): ?int {
        self::startSession();
        return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
    }

    /**
     * Login user and regenerate session ID to prevent session fixation
     */
    public static function login(int $userId, string $email, string $name): void {
        self::startSession();
        if (session_status() === PHP_SESSION_ACTIVE && !headers_sent()) {
            @session_regenerate_id(true);
        }

        $_SESSION['user_id'] = $userId;
        $_SESSION['user_email'] = $email;
        $_SESSION['user_name'] = $name;
        $_SESSION['logged_in_at'] = time();

        // Generate initial CSRF token for the session
        self::generateCsrfToken();
    }

    /**
     * Terminate session
     */
    public static function logout(): void {
        self::startSession();
        $_SESSION = [];

        if (ini_get('session.use_cookies') && !headers_sent()) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 86400,
                'path' => $params['path'] ?? '/',
                'domain' => $params['domain'] ?? '',
                'secure' => $params['secure'] ?? false,
                'httponly' => $params['httponly'] ?? true,
                'samesite' => $params['samesite'] ?? 'Lax'
            ]);
        }

        session_destroy();
    }

    /**
     * Generate or retrieve CSRF token
     */
    public static function generateCsrfToken(): string {
        self::startSession();
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    /**
     * Verify CSRF token for state-changing HTTP methods
     */
    public static function verifyCsrf(): void {
        $method = Helpers::getRequestMethod();
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }

        self::startSession();
        $storedToken = $_SESSION['csrf_token'] ?? '';
        if (empty($storedToken)) {
            Response::forbidden('CSRF session token missing. Please refresh and try again.');
        }

        // Check header first (e.g. X-CSRF-Token or FastCGI environment redirect header)
        $receivedToken = $_SERVER['HTTP_X_CSRF_TOKEN'] 
            ?? $_SERVER['REDIRECT_HTTP_X_CSRF_TOKEN'] 
            ?? '';

        if (empty($receivedToken)) {
            // Check query parameter fallback (crucial for shared hosting that strips custom headers)
            if (!empty($_GET['csrf_token'])) {
                $receivedToken = (string)$_GET['csrf_token'];
            } elseif (!empty($_POST['csrf_token'])) {
                $receivedToken = (string)$_POST['csrf_token'];
            } else {
                $raw = @file_get_contents('php://input');
                if (!empty($raw) && ($raw[0] === '{' || $raw[0] === '[')) {
                    $input = json_decode($raw, true);
                    if (is_array($input) && isset($input['csrf_token'])) {
                        $receivedToken = (string)$input['csrf_token'];
                    }
                }
            }
        }

        if (empty($receivedToken) || !hash_equals($storedToken, $receivedToken)) {
            Response::forbidden('Invalid CSRF token.');
        }
    }
}
