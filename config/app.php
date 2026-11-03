<?php
/**
 * CLIENTO - APPLICATION CONFIGURATION
 * Environment settings, security flags, and session attributes.
 */

// Ensure environment variables are loaded
if (!function_exists('cliento_load_env')) {
    require_once __DIR__ . '/database.php';
} else {
    cliento_load_env(dirname(__DIR__) . '/.env');
}

return [
    'app_name' => getenv('APP_NAME') ?: 'Cliento',
    'app_env' => getenv('APP_ENV') ?: 'production', // 'development' | 'production'
    'timezone' => getenv('APP_TIMEZONE') ?: 'Asia/Kolkata',
    'session' => [
        'name' => getenv('SESSION_NAME') ?: 'CLIENTO_SESSID',
        'lifetime' => (int)(getenv('SESSION_LIFETIME') ?: (86400 * 7)), // 7 days
        'path' => '/',
        'domain' => '',
        'secure' => getenv('SESSION_SECURE') === 'true' || (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
        'httponly' => true,
        'samesite' => 'Lax'
    ],
    'csrf' => [
        'header' => 'X-CSRF-Token',
        'session_key' => 'cliento_csrf_token'
    ]
];
