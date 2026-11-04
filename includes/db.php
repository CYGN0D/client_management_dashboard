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

                    // Enable foreign keys and set busy timeout for shared hosting concurrent writes
                    self::$instance->exec('PRAGMA foreign_keys = ON;');
                    self::$instance->exec('PRAGMA busy_timeout = 5000;');

                    // Journal mode for shared hosting:
                    // DELETE mode is universally supported across all shared hosting filesystems (including CageFS/NFS)
                    // Avoid WAL because WAL requires POSIX shared memory (/dev/shm) which fails silently on shared hosts.
                    try {
                        self::$instance->exec('PRAGMA journal_mode = DELETE;');
                        self::$instance->exec('PRAGMA synchronous = NORMAL;');
                    } catch (Throwable $t) {
                        // Fallback gracefully
                    }

                    // Register custom NOW() function for query parity with MySQL
                    self::$instance->sqliteCreateFunction('NOW', function () {
                        return date('Y-m-d H:i:s');
                    });

                    // Auto-initialize schema & seed if fresh SQLite database, or auto-migrate existing databases
                    if ($isNew) {
                        self::initializeSqlite(self::$instance);
                    } else {
                        self::autoMigrateSqlite(self::$instance);
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
     * Auto-migrate existing SQLite databases to drop restrictive table-level UNIQUE(client_id, billing_month, charge_type)
     * and replace it with conditional unique index on retainers.
     */
    private static function autoMigrateSqlite(PDO $pdo): void {
        try {
            $stmt = $pdo->query("SELECT sql FROM sqlite_master WHERE type='table' AND name='invoices'");
            $sql = $stmt ? (string)$stmt->fetchColumn() : '';
            if (str_contains($sql, 'UNIQUE(client_id, billing_month, charge_type)') || str_contains($sql, 'invoices.client_id, invoices.billing_month, invoices.charge_type')) {
                $pdo->exec("PRAGMA foreign_keys = OFF;");
                $pdo->beginTransaction();
                $pdo->exec("
                    CREATE TABLE invoices_migrated (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      invoice_code TEXT DEFAULT NULL,
                      user_id INTEGER NOT NULL,
                      client_id INTEGER NOT NULL,
                      invoice_number TEXT NOT NULL,
                      service_name TEXT NOT NULL DEFAULT 'Service',
                      charge_type TEXT NOT NULL DEFAULT 'standard',
                      notes TEXT DEFAULT NULL,
                      billing_month TEXT NOT NULL,
                      amount NUMERIC NOT NULL,
                      due_date DATE NOT NULL,
                      status TEXT NOT NULL DEFAULT 'pending',
                      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
                      UNIQUE(user_id, invoice_number)
                    );
                ");
                $pdo->exec("
                    INSERT INTO invoices_migrated (id, invoice_code, user_id, client_id, invoice_number, service_name, charge_type, notes, billing_month, amount, due_date, status, created_at, updated_at)
                    SELECT id, invoice_code, user_id, client_id, invoice_number, service_name, charge_type, notes, billing_month, amount, due_date, status, created_at, updated_at FROM invoices;
                ");
                $pdo->exec("DROP TABLE invoices;");
                $pdo->exec("ALTER TABLE invoices_migrated RENAME TO invoices;");
                $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS uk_client_retainer_month ON invoices(client_id, billing_month) WHERE charge_type = 'retainer';");
                $pdo->commit();
                $pdo->exec("PRAGMA foreign_keys = ON;");
            }
        } catch (Throwable $t) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('[Cliento SQLite Auto-Migrate Notice] ' . $t->getMessage());
        }
    }

    /**
     * Auto-migrate existing MySQL databases
     */
    private static function autoMigrateMysql(PDO $pdo): void {
        try {
            $pdo->exec("ALTER TABLE invoices DROP INDEX uk_client_retainer_month;");
            $pdo->exec("CREATE INDEX idx_client_billing_month ON invoices(client_id, billing_month);");
        } catch (Throwable $t) {
            // Already migrated or index does not exist
        }
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
