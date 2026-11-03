<?php
/**
 * GET /api/auth/csrf.php
 * Retrieve or refresh CSRF token
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';

AuthMiddleware::startSession();
$token = AuthMiddleware::generateCsrfToken();

Response::success([
    'csrf_token' => $token,
    'user_id' => AuthMiddleware::getUserId()
], 'CSRF token issued');
