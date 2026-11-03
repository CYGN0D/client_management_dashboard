<?php
/**
 * POST /api/auth/login.php
 * Authenticate user and initialize secure session
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/validation.php';
require_once __DIR__ . '/../../services/AuthService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$input = Validator::getJsonInput();
$validator = new Validator();
$validator->email($input, 'email', 'Email Address');
$validator->requireString($input, 'password', 'Password', 4);

if ($validator->hasErrors()) {
    Response::validationError($validator->getErrors());
}

try {
    $result = AuthService::login($input['email'], $input['password']);
    Response::success($result, 'Logged in successfully');
} catch (Exception $e) {
    Response::error($e->getMessage(), 401);
}
