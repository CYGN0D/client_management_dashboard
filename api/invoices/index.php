<?php
/**
 * /api/invoices/index.php
 * GET: List all invoices for authenticated user
 * POST: Create a new invoice / project charge
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/InvoiceService.php';

$userId = AuthMiddleware::requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = $_GET['status'] ?? null;
    $month = $_GET['month'] ?? null;
    $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : null;
    $search = $_GET['search'] ?? null;

    $invoices = InvoiceService::getAll($userId, $status, $month, $clientId, $search);
    Response::success($invoices, 'Invoices retrieved successfully');
}

if ($method === 'POST') {
    AuthMiddleware::verifyCsrf();
    $input = Validator::getJsonInput();

    $validator = new Validator();
    $validator->intRange($input, 'client_id', 'Client Selection', 1, PHP_INT_MAX);
    $validator->positiveDecimal($input, 'amount', 'Invoice Amount');
    $validator->month($input, 'billing_month', 'Billing Month');
    $validator->date($input, 'due_date', 'Due Date');
    $validator->optionalString($input, 'service_name', 'Service / Plan Name', 255);
    $validator->inEnum($input, 'charge_type', 'Charge Category', [
        'retainer', 'one_time', 'project_advance', 'custom_changes', 'standard'
    ], false);

    if ($validator->hasErrors()) {
        Response::validationError($validator->getErrors());
    }

    try {
        $invoice = InvoiceService::create($userId, $input);
        Response::created($invoice, 'Invoice created successfully');
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

Response::error('Method not allowed', 405);
