<?php
/**
 * /api/clients/detail.php?id={id}
 * GET: Retrieve single client or full dossier
 * PUT/PATCH: Update client
 * DELETE: Delete or deactivate client
 * POST: Custom actions (e.g. action=toggle_retainer)
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/ClientService.php';

$userId = AuthMiddleware::requireAuth();
$clientId = (int)($_GET['id'] ?? 0);
$method = Helpers::getRequestMethod();

if (!$clientId) {
    Response::error('Missing client ID parameter.', 400);
}

if ($method === 'GET') {
    $isDossier = isset($_GET['dossier']) && ($_GET['dossier'] === '1' || $_GET['dossier'] === 'true');

    try {
        if ($isDossier) {
            $data = ClientService::getDossier($userId, $clientId);
            Response::success($data, 'Client dossier retrieved');
        } else {
            $client = ClientService::getById($userId, $clientId);
            if (!$client) {
                Response::notFound('Client not found.');
            }
            Response::success($client, 'Client details retrieved');
        }
    } catch (Exception $e) {
        Response::error($e->getMessage(), 404);
    }
}

if ($method === 'PUT' || $method === 'PATCH') {
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
    if (isset($input['name'])) {
        $validator->requireString($input, 'name', 'Client Name', 2, 150);
    }
    if (isset($input['email'])) {
        $validator->email($input, 'email', 'Email Address', false);
    }
    if (isset($input['monthly_amount'])) {
        $validator->positiveDecimal($input, 'monthly_amount', 'Monthly Retainer Amount', true);
    }
    if (isset($input['due_day'])) {
        $validator->intRange($input, 'due_day', 'Billing Due Day', 1, 28, false);
    }
    if (isset($input['joining_date'])) {
        $validator->date($input, 'joining_date', 'Joining Date', false);
    }

    if ($validator->hasErrors()) {
        Response::validationError($validator->getErrors());
    }

    try {
        $updated = ClientService::update($userId, $clientId, $input);
        Response::success($updated, 'Client updated successfully');
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

if ($method === 'DELETE' || ($method === 'POST' && (($_GET['action'] ?? '') === 'delete' || ($_POST['action'] ?? '') === 'delete'))) {
    AuthMiddleware::verifyCsrf();
    $permanent = isset($_GET['permanent']) && ($_GET['permanent'] === '1' || $_GET['permanent'] === 'true' || $_GET['permanent'] === 1);
    $force = isset($_GET['force']) && ($_GET['force'] === '1' || $_GET['force'] === 'true' || $_GET['force'] === 1);
    
    try {
        if ($permanent || $force) {
            $res = ClientService::deletePermanently($userId, $clientId);
        } else {
            $res = ClientService::deleteOrDeactivate($userId, $clientId);
        }
        Response::success($res, $res['message']);
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

if ($method === 'POST') {
    AuthMiddleware::verifyCsrf();
    $action = $_GET['action'] ?? '';

    if ($action === 'toggle_retainer') {
        try {
            $updated = ClientService::toggleRetainerStatus($userId, $clientId);
            Response::success($updated, 'Retainer status updated');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    Response::error('Invalid action requested', 400);
}

Response::error('Method not allowed', 405);
