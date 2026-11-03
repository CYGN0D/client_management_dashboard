<?php
/**
 * CLIENTO - FINANCIAL REPORTS & DASHBOARD METRICS SERVICE
 * Centralized calculation engine for financial KPIs, trends, and audits.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

class ReportService {
    /**
     * Compute real-time dashboard KPIs, charts, and activity feeds
     */
    public static function getDashboardMetrics(int $userId): array {
        $db = Database::getConnection();
        $currentMonth = date('Y-m');
        $today = date('Y-m-d');

        // 1. Total Clients
        $clientStmt = $db->prepare('SELECT COUNT(*) FROM clients WHERE user_id = :uid');
        $clientStmt->execute([':uid' => $userId]);
        $totalClients = (int)$clientStmt->fetchColumn();

        // 2. Monthly Income (actual payments received in current month)
        $incomeStmt = $db->prepare('
            SELECT COALESCE(SUM(amount), 0.00) 
            FROM payments 
            WHERE user_id = :uid AND payment_date LIKE :month
        ');
        $incomeStmt->execute([':uid' => $userId, ':month' => $currentMonth . '%']);
        $monthlyIncome = (float)$incomeStmt->fetchColumn();

        // 3. Outstanding / Pending across all invoices
        $invStmt = $db->prepare('
            SELECT 
                i.amount,
                COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id AND p.user_id = :uid_p), 0.00) AS paid_amount
            FROM invoices i
            WHERE i.user_id = :uid_i
        ');
        $invStmt->execute([':uid_p' => $userId, ':uid_i' => $userId]);
        $allInvoices = $invStmt->fetchAll();

        $totalPending = 0.0;
        foreach ($allInvoices as $inv) {
            $rem = (float)$inv['amount'] - (float)$inv['paid_amount'];
            if ($rem > 0) {
                $totalPending += $rem;
            }
        }

        // 4. Last 6 Months Income Trend for Chart
        $sixMonths = [];
        for ($i = 5; $i >= 0; $i--) {
            $m = date('Y-m', strtotime("-{$i} month"));
            $sixMonths[$m] = [
                'month' => $m,
                'label' => date('M', strtotime($m . '-01')),
                'amount' => 0.0,
                'tx_count' => 0
            ];
        }

        $minMonth = array_key_first($sixMonths);
        $chartStmt = $db->prepare('
            SELECT 
                SUBSTRING(payment_date, 1, 7) AS month_key,
                SUM(amount) AS total_amount,
                COUNT(*) AS tx_count
            FROM payments
            WHERE user_id = :uid AND payment_date >= :min_date
            GROUP BY SUBSTRING(payment_date, 1, 7)
        ');
        $chartStmt->execute([':uid' => $userId, ':min_date' => $minMonth . '-01']);
        $chartRows = $chartStmt->fetchAll();

        foreach ($chartRows as $cr) {
            $m = $cr['month_key'];
            if (isset($sixMonths[$m])) {
                $sixMonths[$m]['amount'] = (float)$cr['total_amount'];
                $sixMonths[$m]['tx_count'] = (int)$cr['tx_count'];
            }
        }

        // 5. Recent Payments (latest 5)
        $recPayStmt = $db->prepare('
            SELECT p.*, i.invoice_number, c.name AS client_name
            FROM payments p
            JOIN invoices i ON i.id = p.invoice_id
            JOIN clients c ON c.id = p.client_id
            WHERE p.user_id = :uid
            ORDER BY p.payment_date DESC, p.id DESC
            LIMIT 5
        ');
        $recPayStmt->execute([':uid' => $userId]);
        $recentPayments = array_map(function ($p) {
            return [
                'id' => (int)$p['id'],
                'invoice_id' => (int)$p['invoice_id'],
                'invoice_number' => $p['invoice_number'],
                'client_name' => $p['client_name'],
                'amount' => (float)$p['amount'],
                'payment_date' => $p['payment_date'],
                'payment_method' => $p['payment_method']
            ];
        }, $recPayStmt->fetchAll());

        // 6. Recent Expenses (latest 5)
        $recExpStmt = $db->prepare('
            SELECT * FROM expenses
            WHERE user_id = :uid
            ORDER BY date DESC, id DESC
            LIMIT 5
        ');
        $recExpStmt->execute([':uid' => $userId]);
        $recentExpenses = array_map(function ($e) {
            return [
                'id' => (int)$e['id'],
                'title' => $e['title'],
                'category' => $e['category'],
                'amount' => (float)$e['amount'],
                'date' => $e['date']
            ];
        }, $recExpStmt->fetchAll());

        // 7. Upcoming and Overdue Dues
        $duesStmt = $db->prepare('
            SELECT 
                i.*,
                c.name AS client_name,
                COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id AND p.user_id = :uid_p), 0.00) AS paid_amount
            FROM invoices i
            JOIN clients c ON c.id = i.client_id
            WHERE i.user_id = :uid_i
            HAVING (amount - paid_amount) > 0
            ORDER BY i.due_date ASC
            LIMIT 10
        ');
        $duesStmt->execute([':uid_p' => $userId, ':uid_i' => $userId]);
        $upcomingDues = array_map(function ($d) use ($today) {
            $amount = (float)$d['amount'];
            $paid = (float)$d['paid_amount'];
            $rem = max(0.0, $amount - $paid);
            $isOverdue = ($d['due_date'] && $today > $d['due_date']);

            return [
                'id' => (int)$d['id'],
                'invoice_number' => $d['invoice_number'],
                'client_name' => $d['client_name'],
                'service_name' => $d['service_name'],
                'billing_month' => $d['billing_month'],
                'amount' => $amount,
                'paid_amount' => $paid,
                'remaining_due' => $rem,
                'due_date' => $d['due_date'],
                'is_overdue' => $isOverdue
            ];
        }, $duesStmt->fetchAll());

        return [
            'metrics' => [
                'total_clients' => $totalClients,
                'monthly_income' => $monthlyIncome,
                'received_payments' => $monthlyIncome,
                'pending_payments' => $totalPending
            ],
            'income_chart' => array_values($sixMonths),
            'recent_payments' => $recentPayments,
            'recent_expenses' => $recentExpenses,
            'upcoming_dues' => $upcomingDues
        ];
    }

    /**
     * Compute comprehensive financial report for specified period
     */
    public static function getFinancialReport(int $userId, string $period = 'last6'): array {
        $db = Database::getConnection();
        $today = date('Y-m-d');
        $currentMonth = date('Y-m');

        // Determine months filter
        $months = [];
        if ($period === 'last6') {
            for ($i = 5; $i >= 0; $i--) {
                $months[] = date('Y-m', strtotime("-{$i} month"));
            }
        } elseif ($period === 'current') {
            $months[] = $currentMonth;
        } elseif ($period !== 'all' && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period)) {
            $months[] = $period;
        }

        // Fetch payments for period
        $paySql = 'SELECT * FROM payments WHERE user_id = ?';
        $payParams = [$userId];
        if (!empty($months)) {
            $placeholders = implode(',', array_fill(0, count($months), '?'));
            $paySql .= " AND SUBSTRING(payment_date, 1, 7) IN ({$placeholders})";
            $payParams = array_merge([$userId], array_values($months));
        }
        $payStmt = $db->prepare($paySql);
        $payStmt->execute($payParams);
        $payments = $payStmt->fetchAll();

        $totalReceived = array_reduce($payments, fn($acc, $p) => $acc + (float)$p['amount'], 0.0);

        // Fetch expenses for period
        $expSql = 'SELECT * FROM expenses WHERE user_id = ?';
        $expParams = [$userId];
        if (!empty($months)) {
            $placeholders = implode(',', array_fill(0, count($months), '?'));
            $expSql .= " AND SUBSTRING(date, 1, 7) IN ({$placeholders})";
            $expParams = array_merge([$userId], array_values($months));
        }
        $expStmt = $db->prepare($expSql);
        $expStmt->execute($expParams);
        $expenses = $expStmt->fetchAll();

        $totalExpenses = array_reduce($expenses, fn($acc, $e) => $acc + (float)$e['amount'], 0.0);

        // Fetch invoices for period
        $invSql = '
            SELECT 
                i.*,
                c.name AS client_name,
                COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id AND p.user_id = ?), 0.00) AS paid_amount
            FROM invoices i
            JOIN clients c ON c.id = i.client_id
            WHERE i.user_id = ?
        ';
        $invParams = [$userId, $userId];
        if (!empty($months)) {
            $placeholders = implode(',', array_fill(0, count($months), '?'));
            $invSql .= " AND i.billing_month IN ({$placeholders})";
            $invParams = array_merge([$userId, $userId], array_values($months));
        }
        $invStmt = $db->prepare($invSql);
        $invStmt->execute($invParams);
        $invoices = $invStmt->fetchAll();

        $totalInvoiced = 0.0;
        $totalPending = 0.0;
        $pendingInvoices = [];

        foreach ($invoices as $inv) {
            $amount = (float)$inv['amount'];
            $paid = (float)$inv['paid_amount'];
            $rem = max(0.0, $amount - $paid);
            $totalInvoiced += $amount;

            if ($rem > 0) {
                $totalPending += $rem;
                $isOverdue = ($inv['due_date'] && $today > $inv['due_date']);
                $pendingInvoices[] = [
                    'id' => (int)$inv['id'],
                    'invoice_number' => $inv['invoice_number'],
                    'client_name' => $inv['client_name'],
                    'service_name' => $inv['service_name'],
                    'billing_month' => $inv['billing_month'],
                    'amount' => $amount,
                    'paid_amount' => $paid,
                    'remaining_due' => $rem,
                    'due_date' => $inv['due_date'],
                    'status' => $paid > 0 ? 'partial' : ($isOverdue ? 'overdue' : 'pending'),
                    'is_overdue' => $isOverdue
                ];
            }
        }

        $netIncome = round($totalReceived - $totalExpenses, 2);

        // Monthly Breakdown Table
        $allUniqueMonths = [];
        foreach ($invoices as $i) $allUniqueMonths[$i['billing_month']] = true;
        foreach ($payments as $p) $allUniqueMonths[substr($p['payment_date'], 0, 7)] = true;
        foreach ($expenses as $e) $allUniqueMonths[substr($e['date'], 0, 7)] = true;
        krsort($allUniqueMonths);

        $monthlyBreakdown = [];
        foreach (array_keys($allUniqueMonths) as $m) {
            if (!empty($months) && !in_array($m, $months, true)) {
                continue;
            }

            $mBilled = 0.0;
            foreach ($invoices as $inv) {
                if ($inv['billing_month'] === $m) $mBilled += (float)$inv['amount'];
            }

            $mReceived = 0.0;
            foreach ($payments as $p) {
                if (str_starts_with($p['payment_date'], $m)) $mReceived += (float)$p['amount'];
            }

            $mExp = 0.0;
            foreach ($expenses as $e) {
                if (str_starts_with($e['date'], $m)) $mExp += (float)$e['amount'];
            }

            $monthlyBreakdown[] = [
                'month' => $m,
                'label' => date('F Y', strtotime($m . '-01')),
                'billed' => $mBilled,
                'received' => $mReceived,
                'expenses' => $mExp,
                'net' => round($mReceived - $mExp, 2)
            ];
        }

        return [
            'period' => $period,
            'summary' => [
                'total_invoiced' => $totalInvoiced,
                'total_received' => $totalReceived,
                'total_pending' => $totalPending,
                'total_expenses' => $totalExpenses,
                'net_income' => $netIncome,
                'received_count' => count($payments)
            ],
            'monthly_breakdown' => $monthlyBreakdown,
            'pending_invoices' => $pendingInvoices
        ];
    }
}
