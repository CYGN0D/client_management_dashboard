<?php
/**
 * CLIENTO - APPLICATION ENTRY POINT & ROUTER
 * Compatible with PHP 8.2+ Built-in Web Server, Apache, LiteSpeed, and Nginx.
 */

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

// Router mode for PHP built-in web server: `php -S localhost:3000 index.php`
if (php_sapi_name() === 'cli-server') {
    $filePath = __DIR__ . $uri;

    // Serve existing static assets directly
    if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        if ($ext !== 'php') {
            return false; // Built-in server serves static file
        }
    }
}

// Check if request is directed to an API endpoint (works on all SAPIs and subdirectories)
if (preg_match('#/api/(.+)$#', $uri, $matches)) {
    $endpoint = $matches[1];
    $apiFile = __DIR__ . '/api/' . $endpoint;
    if (is_dir($apiFile)) {
        $apiFile = rtrim($apiFile, '/') . '/index.php';
    } elseif (!file_exists($apiFile) && file_exists($apiFile . '.php')) {
        $apiFile = $apiFile . '.php';
    }
    if (file_exists($apiFile)) {
        require $apiFile;
        exit;
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
