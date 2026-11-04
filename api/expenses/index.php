<?php
/**
 * /api/expenses/index.php
 * GET: List expenses
 * POST: Create expense
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/ExpenseService.php';

$userId = AuthMiddleware::requireAuth();
$method = Helpers::getRequestMethod();

if ($method === 'GET') {
    $category = $_GET['category'] ?? null;
    $month = $_GET['month'] ?? null;
    $search = $_GET['search'] ?? null;

    $expenses = ExpenseService::getAll($userId, $category, $month, $search);
    Response::success($expenses, 'Expenses retrieved successfully');
}

if ($method === 'POST') {
    AuthMiddleware::verifyCsrf();
    $input = Validator::getJsonInput();

    $validator = new Validator();
    $validator->requireString($input, 'title', 'Expense Title', 2, 150);
    $validator->requireString($input, 'category', 'Category', 2, 100);
    $validator->positiveDecimal($input, 'amount', 'Expense Amount');
    $validator->date($input, 'date', 'Expense Date', false);

    if ($validator->hasErrors()) {
        Response::validationError($validator->getErrors());
    }

    try {
        $expense = ExpenseService::create($userId, $input);
        Response::created($expense, 'Expense created successfully');
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

Response::error('Method not allowed', 405);
