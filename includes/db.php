<?php
/**
 * CLIENTO - DATABASE CONNECTION SINGLETON
 * Core PDO wrapper supporting both local SQLite (.db file) and production MySQL 8.0+.
 */

class Database {
    private static ?PDO $instance = null;
    private static string $driver = 'sqlite';

    /**
     * Get or initialize PDO instance
     */
    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $config = require __DIR__ . '/../config/database.php';
            $driver = $config['default'] ?? 'sqlite';
            self::$driver = $driver;

            try {
                if ($driver === 'sqlite') {
                    $dbFile = $config['sqlite']['database'];
                    $dbDir = dirname($dbFile);
                    if (!is_dir($dbDir)) {
                        @mkdir($dbDir, 0777, true);
                    }
                    @chmod($dbDir, 0777);

                    $isNew = !file_exists($dbFile) || filesize($dbFile) === 0;

                    self::$instance = new PDO(
                        'sqlite:' . $dbFile,
                        null,
                        null,
                        $config['sqlite']['options'] ?? []
                    );

                    if (file_exists($dbFile)) {
                        @chmod($dbFile, 0666);
                    }

                    // Enable foreign keys
                    self::$instance->exec('PRAGMA foreign_keys = ON;');

                    // Journal mode: try WAL first, fallback safely for restricted shared hosting filesystems
                    try {
                        self::$instance->exec('PRAGMA journal_mode = WAL;');
                    } catch (Throwable $t) {
                        try {
                            self::$instance->exec('PRAGMA journal_mode = DELETE;');
                        } catch (Throwable $t2) {
                            // Continue
                        }
                    }

                    // Register custom NOW() function for query parity with MySQL
                    self::$instance->sqliteCreateFunction('NOW', function () {
                        return date('Y-m-d H:i:s');
                    });

                    // Auto-initialize schema & seed if fresh SQLite database
                    if ($isNew) {
                        self::initializeSqlite(self::$instance);
                    }
                } else {
                    $mysql = $config['mysql'];
                    $dsn = sprintf(
                        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                        $mysql['host'],
                        $mysql['port'],
                        $mysql['database'],
                        $mysql['charset']
                    );

                    self::$instance = new PDO(
                        $dsn,
                        $mysql['username'],
                        $mysql['password'],
                        $mysql['options'] ?? []
                    );

                    // Auto-initialize MySQL schema & seed if users table does not exist
                    try {
                        $check = self::$instance->query("SHOW TABLES LIKE 'users'")->fetch();
                        if (empty($check)) {
                            self::initializeMysql(self::$instance);
                        }
                    } catch (Throwable $t) {
                        // Ignore if table check fails
                    }
                }
            } catch (PDOException $e) {
                // In production, log error without exposing database credentials
                error_log('[Cliento DB Connection Error] ' . $e->getMessage());
                http_response_code(500);
                header('Content-Type: application/json; charset=UTF-8');
                echo json_encode([
                    'success' => false,
                    'message' => 'Database connection failed: ' . $e->getMessage(),
                    'errors' => []
                ]);
                exit;
            }
        }

        return self::$instance;
    }

    /**
     * Auto-initialize SQLite tables and default seed
     */
    private static function initializeSqlite(PDO $pdo): void {
        $schemaPath = dirname(__DIR__) . '/database/schema_sqlite.sql';
        $seedPath = dirname(__DIR__) . '/database/seeds/seed_sqlite.sql';

        if (file_exists($schemaPath)) {
            $pdo->exec(file_get_contents($schemaPath));
        }
        if (file_exists($seedPath)) {
            $pdo->exec(file_get_contents($seedPath));
        }
    }

    /**
     * Auto-initialize MySQL tables and default seed
     */
    private static function initializeMysql(PDO $pdo): void {
        $schemaPath = dirname(__DIR__) . '/database/schema.sql';
        $seedPath = dirname(__DIR__) . '/database/seeds/seed.sql';

        if (file_exists($schemaPath)) {
            $pdo->exec(file_get_contents($schemaPath));
        }
        if (file_exists($seedPath)) {
            $pdo->exec(file_get_contents($seedPath));
        }
    }

    /**
     * Return active driver name ('sqlite' or 'mysql')
     */
    public static function getDriver(): string {
        if (self::$instance === null) {
            self::getConnection();
        }
        return self::$driver;
    }

    /**
     * Check if active connection is SQLite
     */
    public static function isSqlite(): bool {
        return self::getDriver() === 'sqlite';
    }

    /**
     * Reset connection (useful for unit tests or driver switching)
     */
    public static function resetConnection(): void {
        self::$instance = null;
    }
}
