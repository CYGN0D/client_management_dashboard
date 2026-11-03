<?php
/**
 * CLIENTO - APPLICATION CONFIGURATION
 * Environment settings, security flags, and session attributes.
 */

return [
    'app_name' => 'Cliento',
    'app_env' => getenv('APP_ENV') ?: 'production', // 'development' | 'production'
    'timezone' => 'Asia/Kolkata',
    'session' => [
        'name' => 'CLIENTO_SESSID',
        'lifetime' => 86400 * 7, // 7 days
        'path' => '/',
        'domain' => '',
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
        'httponly' => true,
        'samesite' => 'Lax'
    ],
    'csrf' => [
        'header' => 'X-CSRF-Token',
        'session_key' => 'cliento_csrf_token'
    ]
];
