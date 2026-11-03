<?php
/**
 * CLIENTO - JSON RESPONSE HANDLER
 * Consistent REST API envelope serialization.
 */

class Response {
    /**
     * Send JSON response and exit
     */
    public static function json(
        bool $success,
        string $message,
        mixed $data = null,
        array $errors = [],
        int $statusCode = 200
    ): void {
        // Clear any previous output buffers to guarantee clean JSON output
        if (ob_get_length()) {
            ob_clean();
        }

        http_response_code($statusCode);
        header('Content-Type: application/json; charset=UTF-8');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');

        $response = [
            'success' => $success,
            'message' => $message,
            'data' => $data !== null ? $data : new stdClass()
        ];

        if (!empty($errors)) {
            $response['errors'] = $errors;
        }

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success(mixed $data = null, string $message = 'Operation successful', int $statusCode = 200): void {
        self::json(true, $message, $data, [], $statusCode);
    }

    public static function created(mixed $data = null, string $message = 'Resource created successfully'): void {
        self::json(true, $message, $data, [], 201);
    }

    public static function error(string $message = 'An error occurred', int $statusCode = 400, array $errors = []): void {
        self::json(false, $message, null, $errors, $statusCode);
    }

    public static function validationError(array $errors, string $message = 'Validation failed'): void {
        self::json(false, $message, null, $errors, 422);
    }

    public static function unauthorized(string $message = 'Authentication required'): void {
        self::json(false, $message, null, [], 401);
    }

    public static function forbidden(string $message = 'Access forbidden'): void {
        self::json(false, $message, null, [], 403);
    }

    public static function notFound(string $message = 'Resource not found'): void {
        self::json(false, $message, null, [], 404);
    }

    public static function serverError(string $message = 'Internal server error'): void {
        self::json(false, $message, null, [], 500);
    }
}
