<?php
/**
 * /api/reports/index.php
 * GET: Financial reporting and dashboard KPI feeds
 * Params:
 *  - type: 'dashboard' | 'financial'
 *  - period: 'last6' | 'current' | 'all' | 'YYYY-MM'
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../services/ReportService.php';

$userId = AuthMiddleware::requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$type = $_GET['type'] ?? 'dashboard';

try {
    if ($type === 'dashboard') {
        $data = ReportService::getDashboardMetrics($userId);
        Response::success($data, 'Dashboard metrics retrieved');
    } elseif ($type === 'financial') {
        $period = $_GET['period'] ?? 'last6';
        $data = ReportService::getFinancialReport($userId, $period);
        Response::success($data, 'Financial report retrieved');
    } else {
        Response::error('Invalid report type requested. Use "dashboard" or "financial".', 400);
    }
} catch (Exception $e) {
    Response::error($e->getMessage(), 400);
}
