<?php
/**
 * CLIENTO - DATABASE CONFIGURATION
 * PDO MySQL connection parameters with environment variable overrides.
 */

// Auto-load .env if available and not yet loaded
if (!function_exists('cliento_load_env')) {
    function cliento_load_env(string $filePath): void {
        if (!file_exists($filePath) || !is_readable($filePath)) {
            return;
        }
        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            if (str_contains($line, '=')) {
                [$key, $value] = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                if ((str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                    (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                    $value = substr($value, 1, -1);
                }
                if (!getenv($key)) {
                    putenv("$key=$value");
                    $_ENV[$key] = $value;
                    $_SERVER[$key] = $value;
                }
            }
        }
    }
}
cliento_load_env(dirname(__DIR__) . '/.env');

// Ensure SQLite database path is resolved as an absolute path
$rawDb = getenv('DB_DATABASE');
if (!empty($rawDb)) {
    if (!str_starts_with($rawDb, '/') && !preg_match('/^[a-zA-Z]:[\\\\\/]/', $rawDb)) {
        $sqliteDbPath = dirname(__DIR__) . '/' . ltrim($rawDb, '/');
    } else {
        $sqliteDbPath = $rawDb;
    }
} else {
    $sqliteDbPath = dirname(__DIR__) . '/database/cliento.db';
}

return [
    'default' => getenv('DB_CONNECTION') ?: 'sqlite',
    'sqlite' => [
        'database' => $sqliteDbPath,
        'options' => [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    ],
    'mysql' => [
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'port' => getenv('DB_PORT') ?: '3306',
        'database' => getenv('DB_NAME') ?: 'cliento_db',
        'username' => getenv('DB_USER') ?: 'cliento_user',
        'password' => getenv('DB_PASS') ?: 'ClientoSecure@2026',
        'charset' => 'utf8mb4',
        'collation' => 'utf8mb4_unicode_ci',
        'options' => [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
        ]
    ]
];
