<?php
/**
 * POST /api/auth/register.php
 * Register a new user account
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/AuthService.php';

if (Helpers::getRequestMethod() !== 'POST') {
    Response::error('Method not allowed', 405);
}

$input = Validator::getJsonInput();
$validator = new Validator();
$validator->requireString($input, 'name', 'Full Name', 2, 100);
$validator->email($input, 'email', 'Email Address');
$validator->requireString($input, 'password', 'Password', 6, 128);

if ($validator->hasErrors()) {
    Response::validationError($validator->getErrors());
}

try {
    $result = AuthService::register($input['name'], $input['email'], $input['password']);
    Response::created($result, 'Account created successfully');
} catch (Exception $e) {
    Response::error($e->getMessage(), 400);
}
