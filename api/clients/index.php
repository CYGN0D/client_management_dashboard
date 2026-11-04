<?php
/**
 * /api/clients/index.php
 * GET: List all clients for authenticated user
 * POST: Create a new client
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/ClientService.php';

$userId = AuthMiddleware::requireAuth();
$method = Helpers::getRequestMethod();

if ($method === 'GET') {
    $status = $_GET['status'] ?? null;
    $search = $_GET['search'] ?? null;

    $clients = ClientService::getAll($userId, $status, $search);
    Response::success($clients, 'Clients retrieved successfully');
}

if ($method === 'POST') {
    AuthMiddleware::verifyCsrf();
    $input = Validator::getJsonInput();

    // Normalize camelCase to snake_case
    if (isset($input['monthlyAmount']) && !isset($input['monthly_amount'])) {
        $input['monthly_amount'] = $input['monthlyAmount'];
    }
    if (isset($input['dueDay']) && !isset($input['due_day'])) {
        $input['due_day'] = $input['dueDay'];
    }
    if (isset($input['joiningDate']) && !isset($input['joining_date'])) {
        $input['joining_date'] = $input['joiningDate'];
    }
    if (isset($input['retainerStatus']) && !isset($input['retainer_status'])) {
        $input['retainer_status'] = $input['retainerStatus'];
    }

    $validator = new Validator();
    $validator->requireString($input, 'name', 'Client Name', 2, 150);
    $validator->optionalString($input, 'company', 'Company Name', 150);
    $validator->optionalString($input, 'phone', 'Phone Number', 50);
    $validator->email($input, 'email', 'Email Address', false);
    $validator->optionalString($input, 'service', 'Services', 1000);
    $validator->positiveDecimal($input, 'monthly_amount', 'Monthly Retainer Amount', true);
    $validator->intRange($input, 'due_day', 'Billing Due Day', 1, 28, false);
    $validator->date($input, 'joining_date', 'Joining Date', false);

    if ($validator->hasErrors()) {
        Response::validationError($validator->getErrors());
    }

    try {
        $client = ClientService::create($userId, $input);
        Response::created($client, 'Client created successfully');
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

Response::error('Method not allowed', 405);
