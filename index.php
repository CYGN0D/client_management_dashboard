<?php
/**
 * CLIENTO - APPLICATION ENTRY POINT & ROUTER
 * Compatible with PHP 8.2+ Built-in Web Server, Apache, and Nginx.
 */

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

// Router mode for PHP built-in web server: `php -S localhost:8000 index.php`
if (php_sapi_name() === 'cli-server') {
    $filePath = __DIR__ . $uri;

    // Serve existing static assets directly
    if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        if ($ext !== 'php') {
            return false; // Built-in server serves static file
        }
    }

    // Direct API script requests
    if (str_starts_with($uri, '/api/')) {
        $apiScript = __DIR__ . $uri;
        if (file_exists($apiScript)) {
            require $apiScript;
            exit;
        }
    }
}

// Serve main frontend single-page application
$indexHtml = __DIR__ . '/index.html';
if (file_exists($indexHtml)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($indexHtml);
    exit;
}

echo "Cliento frontend index.html not found.";
