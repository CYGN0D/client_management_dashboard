<?php
/**
 * GET /api/auth/me.php
 * Retrieve authenticated user profile and active CSRF token
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../services/AuthService.php';

$userId = AuthMiddleware::requireAuth();

try {
    $me = AuthService::me($userId);
    Response::success($me, 'User profile fetched');
} catch (Exception $e) {
    Response::error($e->getMessage(), 404);
}
