<?php
/**
 * /api/settings/index.php
 * GET: Retrieve user business profile & billing preferences
 * PUT/POST: Update user settings
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/SettingsService.php';

$userId = AuthMiddleware::requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $settings = SettingsService::getSettings($userId);
    Response::success($settings, 'Settings retrieved');
}

if ($method === 'PUT' || $method === 'POST') {
    AuthMiddleware::verifyCsrf();
    $input = Validator::getJsonInput();

    // Normalize camelCase to snake_case
    if (isset($input['businessName']) && !isset($input['business_name'])) {
        $input['business_name'] = $input['businessName'];
    }
    if (isset($input['billingPreference']) && !isset($input['billing_preference'])) {
        $input['billing_preference'] = $input['billingPreference'];
    }
    if (isset($input['invoicePrefix']) && !isset($input['invoice_prefix'])) {
        $input['invoice_prefix'] = $input['invoicePrefix'];
    }

    $validator = new Validator();
    $validator->optionalString($input, 'business_name', 'Business Name', 150);
    $validator->optionalString($input, 'phone', 'Phone Number', 30);
    $validator->email($input, 'email', 'Email Address', false);
    $validator->intRange($input, 'billing_preference', 'Default Due Day', 1, 28, false);
    $validator->optionalString($input, 'invoice_prefix', 'Invoice Prefix', 20);

    if ($validator->hasErrors()) {
        Response::validationError($validator->getErrors());
    }

    try {
        $updated = SettingsService::updateSettings($userId, $input);
        Response::success($updated, 'Settings updated successfully');
    } catch (Exception $e) {
        Response::error($e->getMessage(), 400);
    }
}

Response::error('Method not allowed', 405);
