<?php
/**
 * /api/migrate/index.php
 * POST: Ingest frontend localStorage JSON dump and migrate into MySQL
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/MigrationService.php';

$userId = AuthMiddleware::requireAuth();

if (Helpers::getRequestMethod() !== 'POST') {
    Response::error('Method not allowed', 405);
}

AuthMiddleware::verifyCsrf();
$input = Validator::getJsonInput();

if (empty($input)) {
    Response::error('Empty migration payload provided.', 400);
}

// Support both direct payload or nested backup format { app: 'Cliento', data: { ... } }
$payload = isset($input['data']) && is_array($input['data']) ? $input['data'] : $input;

try {
    $report = MigrationService::migrate($userId, $payload);
    Response::success($report, 'Data migrated into MySQL database successfully');
} catch (Exception $e) {
    Response::error('Migration failed: ' . $e->getMessage(), 500);
}
