<?php
/**
 * /api/payments/index.php
 * GET: List all payments
 * POST: Record new payment against an invoice
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/PaymentService.php';

$userId = AuthMiddleware::requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $month = $_GET['month'] ?? null;
    $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : null;
    $invoiceId = isset($_GET['invoice_id']) ? (int)$_GET['invoice_id'] : null;

    $payments = PaymentService::getAll($userId, $month, $clientId, $invoiceId);
    Response::success($payments, 'Payments retrieved successfully');
}

if ($method === 'POST') {
    AuthMiddleware::verifyCsrf();
    $input = Validator::getJsonInput();

    $validator = new Validator();
    $validator->intRange($input, 'invoice_id', 'Invoice Selection', 1, PHP_INT_MAX);
    $validator->positiveDecimal($input, 'amount', 'Payment Amount');
    $validator->date($input, 'payment_date', 'Payment Date', false);
    $validator->optionalString($input, 'payment_method', 'Payment Method', 50);

    if ($validator->hasErrors()) {
        Response::validationError($validator->getErrors());
    }

    try {
        $result = PaymentService::recordPayment($userId, $input);
        Response::created($result, 'Payment recorded successfully');
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

Response::error('Method not allowed', 405);
