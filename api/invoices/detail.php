<?php
/**
 * /api/invoices/detail.php?id={id}
 * GET: Retrieve single invoice or payment history
 * PUT/PATCH: Update invoice
 * DELETE: Delete invoice
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/InvoiceService.php';

$userId = AuthMiddleware::requireAuth();
$invoiceId = (int)($_GET['id'] ?? 0);
$method = $_SERVER['REQUEST_METHOD'];

if (!$invoiceId) {
    Response::error('Missing invoice ID parameter.', 400);
}

if ($method === 'GET') {
    $isHistory = isset($_GET['history']) && ($_GET['history'] === '1' || $_GET['history'] === 'true');

    try {
        if ($isHistory) {
            $data = InvoiceService::getInvoiceHistory($userId, $invoiceId);
            Response::success($data, 'Invoice history retrieved');
        } else {
            $inv = InvoiceService::getById($userId, $invoiceId);
            if (!$inv) {
                Response::notFound('Invoice not found.');
            }
            Response::success($inv, 'Invoice details retrieved');
        }
    } catch (Exception $e) {
        Response::error($e->getMessage(), 404);
    }
}

if ($method === 'PUT' || $method === 'PATCH') {
    AuthMiddleware::verifyCsrf();
    $input = Validator::getJsonInput();

    $validator = new Validator();
    if (isset($input['amount'])) {
        $validator->positiveDecimal($input, 'amount', 'Invoice Amount');
    }
    if (isset($input['due_date'])) {
        $validator->date($input, 'due_date', 'Due Date');
    }
    if (isset($input['service_name'])) {
        $validator->optionalString($input, 'service_name', 'Service Name', 255);
    }

    if ($validator->hasErrors()) {
        Response::validationError($validator->getErrors());
    }

    try {
        $updated = InvoiceService::update($userId, $invoiceId, $input);
        Response::success($updated, 'Invoice updated successfully');
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

if ($method === 'DELETE') {
    AuthMiddleware::verifyCsrf();
    try {
        $res = InvoiceService::delete($userId, $invoiceId);
        Response::success($res, $res['message']);
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

Response::error('Method not allowed', 405);
