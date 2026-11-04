<?php
/**
 * /api/payments/detail.php?id={id}
 * GET: Retrieve single payment
 * DELETE: Delete payment and recalculate invoice status
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../services/PaymentService.php';

$userId = AuthMiddleware::requireAuth();
$paymentId = (int)($_GET['id'] ?? 0);
$method = Helpers::getRequestMethod();

if (!$paymentId) {
    Response::error('Missing payment ID parameter.', 400);
}

if ($method === 'GET') {
    $payment = PaymentService::getById($userId, $paymentId);
    if (!$payment) {
        Response::notFound('Payment not found.');
    }
    Response::success($payment, 'Payment retrieved');
}

if ($method === 'DELETE') {
    AuthMiddleware::verifyCsrf();
    try {
        $res = PaymentService::deletePayment($userId, $paymentId);
        Response::success($res, $res['message']);
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

Response::error('Method not allowed', 405);
