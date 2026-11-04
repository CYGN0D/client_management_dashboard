<?php
/**
 * /api/expenses/detail.php?id={id}
 * GET: Retrieve single expense
 * PUT/PATCH: Update expense
 * DELETE: Delete expense
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/ExpenseService.php';

$userId = AuthMiddleware::requireAuth();
$expenseId = (int)($_GET['id'] ?? 0);
$method = Helpers::getRequestMethod();

if (!$expenseId) {
    Response::error('Missing expense ID parameter.', 400);
}

if ($method === 'GET') {
    $expense = ExpenseService::getById($userId, $expenseId);
    if (!$expense) {
        Response::notFound('Expense not found.');
    }
    Response::success($expense, 'Expense retrieved');
}

if ($method === 'PUT' || $method === 'PATCH') {
    AuthMiddleware::verifyCsrf();
    $input = Validator::getJsonInput();

    $validator = new Validator();
    if (isset($input['title'])) {
        $validator->requireString($input, 'title', 'Expense Title', 2, 150);
    }
    if (isset($input['amount'])) {
        $validator->positiveDecimal($input, 'amount', 'Expense Amount');
    }
    if (isset($input['date'])) {
        $validator->date($input, 'date', 'Expense Date');
    }

    if ($validator->hasErrors()) {
        Response::validationError($validator->getErrors());
    }

    try {
        $updated = ExpenseService::update($userId, $expenseId, $input);
        Response::success($updated, 'Expense updated successfully');
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

if ($method === 'DELETE' || ($method === 'POST' && (($_GET['action'] ?? '') === 'delete' || ($_POST['action'] ?? '') === 'delete'))) {
    AuthMiddleware::verifyCsrf();
    try {
        $res = ExpenseService::delete($userId, $expenseId);
        Response::success($res, $res['message']);
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

Response::error('Method not allowed', 405);
