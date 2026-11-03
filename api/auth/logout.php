<?php
/**
 * POST /api/auth/logout.php
 * Terminate session
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';

AuthMiddleware::logout();
Response::success(null, 'Logged out successfully');
