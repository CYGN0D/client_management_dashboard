<?php
/**
 * /api/invoices/generate.php
 * POST: Idempotent monthly retainer invoice generation
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/InvoiceService.php';

$userId = AuthMiddleware::requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

AuthMiddleware::verifyCsrf();
$input = Validator::getJsonInput();

// Normalize parameters
if (isset($input['billingMonth']) && !isset($input['billing_month'])) {
    $input['billing_month'] = $input['billingMonth'];
}
if (isset($input['month']) && !isset($input['billing_month'])) {
    $input['billing_month'] = $input['month'];
}
if (isset($input['clientIds']) && !isset($input['client_ids'])) {
    $input['client_ids'] = $input['clientIds'];
}

$validator = new Validator();
$validator->month($input, 'billing_month', 'Billing Month');

if ($validator->hasErrors()) {
    Response::validationError($validator->getErrors());
}

$billingMonth = $input['billing_month'];
$clientIds = isset($input['client_ids']) && is_array($input['client_ids'])
    ? array_map('intval', $input['client_ids'])
    : [];

try {
    $result = InvoiceService::generateMonthlyInvoices($userId, $billingMonth, $clientIds);
    Response::success($result, "Generated {$result['created_count']} monthly invoice(s)");
} catch (Exception $e) {
    Response::error($e->getMessage(), 400);
}
