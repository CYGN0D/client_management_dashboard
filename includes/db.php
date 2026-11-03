<?php
/**
 * CLIENTO - DATABASE CONNECTION SINGLETON
 * Core PDO wrapper providing centralized database access.
 */

class Database {
    private static ?PDO $instance = null;

    /**
     * Get or initialize PDO instance
     */
    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $config = require __DIR__ . '/../config/database.php';
            
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                $config['host'],
                $config['port'],
                $config['database'],
                $config['charset']
            );

            try {
                self::$instance = new PDO(
                    $dsn,
                    $config['username'],
                    $config['password'],
                    $config['options']
                );
            } catch (PDOException $e) {
                // In production, log error without exposing database credentials
                error_log('[Cliento DB Connection Error] ' . $e->getMessage());
                http_response_code(500);
                header('Content-Type: application/json; charset=UTF-8');
                echo json_encode([
                    'success' => false,
                    'message' => 'Database connection failed. Please contact the administrator.',
                    'errors' => []
                ]);
                exit;
            }
        }

        return self::$instance;
    }

    /**
     * Reset connection (useful for unit tests or reconnections)
     */
    public static function resetConnection(): void {
        self::$instance = null;
    }
}
