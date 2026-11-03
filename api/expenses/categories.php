<?php
/**
 * /api/expenses/categories.php
 * GET: List expense categories
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../services/ExpenseService.php';

$userId = AuthMiddleware::requireAuth();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $categories = ExpenseService::getCategories($userId);
    Response::success($categories, 'Categories retrieved');
}

Response::error('Method not allowed', 405);
