<?php
/**
 * CLIENTO - AUTOMATED TEST RUNNER & ARCHITECTURAL VERIFICATION SUITE
 * Tests all financial business logic, constraints, transactions, isolation, and security.
 */

// Enable all errors for test runner
error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../services/AuthService.php';
require_once __DIR__ . '/../services/ClientService.php';
require_once __DIR__ . '/../services/InvoiceService.php';
require_once __DIR__ . '/../services/PaymentService.php';
require_once __DIR__ . '/../services/ExpenseService.php';
require_once __DIR__ . '/../services/ReportService.php';
require_once __DIR__ . '/../services/SettingsService.php';
require_once __DIR__ . '/../services/MigrationService.php';

class TestRunner {
    private int $passed = 0;
    private int $failed = 0;
    private array $failures = [];
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function assert(bool $condition, string $testName, string $failureDetails = ''): void {
        if ($condition) {
            $this->passed++;
            echo "  \033[32m✔ PASS\033[0m: {$testName}\n";
        } else {
            $this->failed++;
            $this->failures[] = "{$testName}: {$failureDetails}";
            echo "  \033[31m✖ FAIL\033[0m: {$testName} - {$failureDetails}\n";
        }
    }

    public function assertThrows(callable $fn, string $expectedMessageSubstr, string $testName): void {
        try {
            $fn();
            $this->failed++;
            $this->failures[] = "{$testName}: Expected exception containing '{$expectedMessageSubstr}', but none was thrown.";
            echo "  \033[31m✖ FAIL\033[0m: {$testName} - No exception thrown\n";
        } catch (Exception $e) {
            if (empty($expectedMessageSubstr) || stripos($e->getMessage(), $expectedMessageSubstr) !== false) {
                $this->passed++;
                echo "  \033[32m✔ PASS\033[0m: {$testName} (Caught expected: {$e->getMessage()})\n";
            } else {
                $this->failed++;
                $this->failures[] = "{$testName}: Expected message containing '{$expectedMessageSubstr}', got: '{$e->getMessage()}'";
                echo "  \033[31m✖ FAIL\033[0m: {$testName} - Message mismatch: {$e->getMessage()}\n";
            }
        }
    }

    public function runAll(): void {
        echo "====================================================================\n";
        echo "  CLIENTO PHP + MYSQL ARCHITECTURAL TEST SUITE\n";
        echo "====================================================================\n\n";

        $testUserAId = $this->setupTestUser('Test Studio A', 'test_a_' . time() . '@cliento.com');
        $testUserBId = $this->setupTestUser('Test Studio B', 'test_b_' . time() . '@cliento.com');

        $this->testUserAuthentication($testUserAId);
        $this->testClientCrud($testUserAId, $testUserBId);
        $this->testInvoiceCreationAndValidation($testUserAId);
        $this->testPaymentWorkflowAndOverpaymentPrevention($testUserAId);
        $this->testIdempotentMonthlyInvoiceGeneration($testUserAId);
        $this->testHistoricalPreservationOnClientRateChange($testUserAId);
        $this->testClientSoftDeactivationWithFinancialHistory($testUserAId);
        $this->testExpenseManagementAndCategories($testUserAId);
        $this->testDashboardAndFinancialReportCalculations($testUserAId);
        $this->testMultiUserDataIsolation($testUserAId, $testUserBId);
        $this->testSqlInjectionPrevention($testUserAId);
        $this->testDatabaseTransactionRollback($testUserAId);
        $this->testLocalStorageMigration($testUserAId);

        $this->cleanupTestUsers([$testUserAId, $testUserBId]);

        echo "\n====================================================================\n";
        echo "  TEST SUMMARY\n";
        echo "====================================================================\n";
        echo "  Total Passed: \033[32m{$this->passed}\033[0m\n";
        echo "  Total Failed: " . ($this->failed > 0 ? "\033[31m{$this->failed}\033[0m" : "0") . "\n";

        if ($this->failed > 0) {
            echo "\nFailures:\n";
            foreach ($this->failures as $f) {
                echo " - {$f}\n";
            }
            exit(1);
        } else {
            echo "\n\033[32mAll architecture and business logic tests passed successfully!\033[0m\n\n";
            exit(0);
        }
    }

    private function setupTestUser(string $name, string $email): int {
        $user = AuthService::register($name, $email, 'SecurePass@123');
        return $user['id'];
    }

    private function cleanupTestUsers(array $userIds): void {
        foreach ($userIds as $uid) {
            $this->db->prepare('DELETE FROM users WHERE id = :id')->execute([':id' => $uid]);
        }
    }

    // ---------------- Test Modules ----------------

    private function testUserAuthentication(int $userId): void {
        echo "[1] Testing Authentication & Password Verification\n";

        $stmt = $this->db->prepare('SELECT email FROM users WHERE id = :id');
        $stmt->execute([':id' => $userId]);
        $email = $stmt->fetchColumn();

        $loginRes = AuthService::login($email, 'SecurePass@123');
        $this->assert($loginRes['id'] === $userId, 'AuthService::login returns correct user ID');
        $this->assert(!empty($loginRes['csrf_token']), 'AuthService::login issues CSRF token');

        $this->assertThrows(function () use ($email) {
            AuthService::login($email, 'WrongPassword!');
        }, 'Invalid email or password', 'AuthService::login rejects wrong password');
    }

    private function testClientCrud(int $userId, int $otherUserId): void {
        echo "\n[2] Testing Client Lifecycle & Validations\n";

        $client = ClientService::create($userId, [
            'name' => 'Acme Corporation',
            'company' => 'Acme Inc.',
            'phone' => '+91 98765 43210',
            'email' => 'contact@acme.com',
            'service' => 'UI/UX Design, Web Development',
            'monthly_amount' => 5000.00,
            'due_day' => 10,
            'retainer_status' => 'active',
            'joining_date' => '2026-01-15'
        ]);

        $this->assert($client['name'] === 'Acme Corporation', 'Client created with correct name');
        $this->assert($client['monthly_amount'] === 5000.0, 'Client monthly retainer rate set to 5000.00');
        $this->assert($client['due_day'] === 10, 'Client retainer due day set to 10');

        // Update client
        $updated = ClientService::update($userId, $client['id'], [
            'company' => 'Acme Global Ltd.',
            'monthly_amount' => 6500.00
        ]);
        $this->assert($updated['company'] === 'Acme Global Ltd.', 'Client company updated');
        $this->assert($updated['monthly_amount'] === 6500.0, 'Client monthly amount updated to 6500.00');

        // Retainer toggle
        $toggled = ClientService::toggleRetainerStatus($userId, $client['id']);
        $this->assert($toggled['retainer_status'] === 'paused', 'Client retainer status paused');
        $toggledBack = ClientService::toggleRetainerStatus($userId, $client['id']);
        $this->assert($toggledBack['retainer_status'] === 'active', 'Client retainer status resumed to active');
    }

    private function testInvoiceCreationAndValidation(int $userId): void {
        echo "\n[3] Testing Invoice Creation, Code Uniqueness & Status Derivation\n";

        $client = ClientService::getAll($userId)[0];

        $inv1 = InvoiceService::create($userId, [
            'client_id' => $client['id'],
            'amount' => 4500.00,
            'service_name' => 'Web Development',
            'charge_type' => 'one_time',
            'billing_month' => '2026-10',
            'due_date' => '2026-10-25'
        ]);

        $this->assert($inv1['amount'] === 4500.0, 'Invoice created with amount 4500.00');
        $this->assert($inv1['status'] === 'overdue', 'Unpaid invoice with past due date derived as overdue');
        $this->assert($inv1['paid_amount'] === 0.0, 'Unpaid invoice paid_amount is 0.00');
        $this->assert($inv1['remaining_due'] === 4500.0, 'Remaining balance equals invoice total');

        // Invoice with future due date
        $inv2 = InvoiceService::create($userId, [
            'client_id' => $client['id'],
            'amount' => 2000.00,
            'service_name' => 'SEO Optimization',
            'charge_type' => 'one_time',
            'billing_month' => '2026-12',
            'due_date' => '2026-12-25'
        ]);
        $this->assert($inv2['status'] === 'pending', 'Unpaid invoice with future due date derived as pending');
    }

    private function testPaymentWorkflowAndOverpaymentPrevention(int $userId): void {
        echo "\n[4] Testing Payment Recording, Partial Payments, and Overpayment Prevention\n";

        $client = ClientService::getAll($userId)[0];

        $invoice = InvoiceService::create($userId, [
            'client_id' => $client['id'],
            'amount' => 1000.00,
            'service_name' => 'Consulting Session',
            'charge_type' => 'standard',
            'billing_month' => '2026-11',
            'due_date' => '2026-11-20'
        ]);

        // 1. Partial payment of 400
        $pay1 = PaymentService::recordPayment($userId, [
            'invoice_id' => $invoice['id'],
            'amount' => 400.00,
            'payment_date' => '2026-11-05',
            'payment_method' => 'UPI',
            'notes' => 'First partial installment'
        ]);

        $this->assert($pay1['payment']['amount'] === 400.0, 'First payment record created for 400.00');
        $this->assert($pay1['invoice']['paid_amount'] === 400.0, 'Invoice paid_amount updated to 400.00');
        $this->assert($pay1['invoice']['status'] === 'partial', 'Invoice status derived as partial');
        $this->assert($pay1['invoice']['remaining_due'] === 600.0, 'Invoice remaining balance is 600.00');

        // 2. Overpayment attempt (paying 700 when only 600 remains) -> MUST FAIL
        $this->assertThrows(function () use ($userId, $invoice) {
            PaymentService::recordPayment($userId, [
                'invoice_id' => $invoice['id'],
                'amount' => 700.00,
                'payment_date' => '2026-11-06'
            ]);
        }, 'exceeds the remaining balance', 'Overpayment of 700 against 600 balance strictly rejected');

        // 3. Negative amount attempt -> MUST FAIL
        $this->assertThrows(function () use ($userId, $invoice) {
            PaymentService::recordPayment($userId, [
                'invoice_id' => $invoice['id'],
                'amount' => -50.00
            ]);
        }, 'greater than zero', 'Negative payment amount strictly rejected');

        // 4. Exact remaining payment of 600
        $pay2 = PaymentService::recordPayment($userId, [
            'invoice_id' => $invoice['id'],
            'amount' => 600.00,
            'payment_date' => '2026-11-07',
            'payment_method' => 'Bank Transfer'
        ]);

        $this->assert($pay2['invoice']['paid_amount'] === 1000.0, 'Invoice paid_amount equals total 1000.00');
        $this->assert($pay2['invoice']['status'] === 'paid', 'Invoice status derived as paid / settled');
        $this->assert($pay2['invoice']['remaining_due'] === 0.0, 'Invoice remaining balance is 0.00');

        // 5. Subsequent payment attempt on fully settled invoice -> MUST FAIL
        $this->assertThrows(function () use ($userId, $invoice) {
            PaymentService::recordPayment($userId, [
                'invoice_id' => $invoice['id'],
                'amount' => 10.00
            ]);
        }, 'exceeds the remaining balance', 'Payment on fully settled invoice strictly rejected');
    }

    private function testIdempotentMonthlyInvoiceGeneration(int $userId): void {
        echo "\n[5] Testing Idempotent Monthly Retainer Generation\n";

        // Create 2 active clients with monthly retainer amounts
        $c1 = ClientService::create($userId, [
            'name' => 'Monthly Client Alpha',
            'monthly_amount' => 3000.00,
            'due_day' => 5,
            'retainer_status' => 'active',
            'joining_date' => '2026-01-01'
        ]);

        $c2 = ClientService::create($userId, [
            'name' => 'Monthly Client Beta',
            'monthly_amount' => 4500.00,
            'due_day' => 15,
            'retainer_status' => 'active',
            'joining_date' => '2026-01-01'
        ]);

        // Run monthly generation for 2026-11
        $run1 = InvoiceService::generateMonthlyInvoices($userId, '2026-11', [$c1['id'], $c2['id']]);
        $this->assert($run1['created_count'] === 2, 'First generation creates exactly 2 invoices');
        $this->assert($run1['total_amount'] === 7500.0, 'First generation total is 7500.00 (3000 + 4500)');

        // Run monthly generation AGAIN for 2026-11 -> MUST BE IDEMPOTENT (0 duplicates)
        $run2 = InvoiceService::generateMonthlyInvoices($userId, '2026-11', [$c1['id'], $c2['id']]);
        $this->assert($run2['created_count'] === 0, 'Second run creates 0 duplicate invoices');
        $this->assert($run2['skipped_count'] === 2, 'Second run skips the 2 already-billed clients');

        // Verify database unique constraint prevents duplicate retainer insert
        $this->assertThrows(function () use ($userId, $c1) {
            $stmt = $this->db->prepare('
                INSERT INTO invoices (user_id, client_id, invoice_number, service_name, charge_type, billing_month, amount, due_date)
                VALUES (:uid, :cid, "TEST-DUP", "Retainer", "retainer", "2026-11", 3000, "2026-11-05")
            ');
            $stmt->execute([':uid' => $userId, ':cid' => $c1['id']]);
        }, '', 'Database UNIQUE KEY uk_client_retainer_month prevents duplicate insert');
    }

    private function testHistoricalPreservationOnClientRateChange(int $userId): void {
        echo "\n[6] Testing Historical Invoice Preservation When Client Retainer Rate Changes\n";

        $client = ClientService::create($userId, [
            'name' => 'Evolving Rate Client',
            'monthly_amount' => 2000.00,
            'due_day' => 5,
            'retainer_status' => 'active',
            'joining_date' => '2026-01-01'
        ]);

        // Generate invoice for 2026-08 at 2000 rate
        $run = InvoiceService::generateMonthlyInvoices($userId, '2026-08', [$client['id']]);
        $invId = $run['invoices'][0]['id'];

        // Client gets a price hike to 3500 in September
        ClientService::update($userId, $client['id'], [
            'monthly_amount' => 3500.00
        ]);

        // The historical August invoice must REMAIN at 2000.00!
        $augustInvoice = InvoiceService::getById($userId, $invId);
        $this->assert($augustInvoice['amount'] === 2000.0, 'Historical invoice preserved at original 2000.00 rate');

        // New September invoice should be generated at 3500.00
        $sepRun = InvoiceService::generateMonthlyInvoices($userId, '2026-09', [$client['id']]);
        $sepInv = InvoiceService::getById($userId, $sepRun['invoices'][0]['id']);
        $this->assert($sepInv['amount'] === 3500.0, 'New billing cycle invoice generated at new 3500.00 rate');
    }

    private function testClientSoftDeactivationWithFinancialHistory(int $userId): void {
        echo "\n[7] Testing Client Deactivation When Financial Records Exist\n";

        $client = ClientService::create($userId, [
            'name' => 'Financial Client',
            'monthly_amount' => 1000.00,
            'joining_date' => '2026-01-01'
        ]);

        $inv = InvoiceService::create($userId, [
            'client_id' => $client['id'],
            'amount' => 1000.00,
            'billing_month' => '2026-11',
            'due_date' => '2026-11-20'
        ]);

        PaymentService::recordPayment($userId, [
            'invoice_id' => $inv['id'],
            'amount' => 500.00
        ]);

        // Attempt deletion -> should soft-deactivate to preserve financial ledger
        $res = ClientService::deleteOrDeactivate($userId, $client['id']);
        $this->assert($res['action'] === 'deactivated', 'Client with invoices is soft-deactivated, not deleted');

        $refreshed = ClientService::getById($userId, $client['id']);
        $this->assert($refreshed['status'] === 'inactive', 'Client status marked inactive');

        // Financial records still intact
        $dossier = ClientService::getDossier($userId, $client['id']);
        $this->assert(count($dossier['invoices']) === 1, 'Invoices remain preserved in client dossier');
        $this->assert(count($dossier['payments']) === 1, 'Payments remain preserved in client dossier');
    }

    private function testExpenseManagementAndCategories(int $userId): void {
        echo "\n[8] Testing Expense Creation, Categorization, and Deletion\n";

        $exp1 = ExpenseService::create($userId, [
            'title' => 'Figma Professional Annual Subscription',
            'category' => 'Software',
            'amount' => 1200.00,
            'date' => '2026-11-01',
            'description' => 'Design team license'
        ]);

        $this->assert($exp1['amount'] === 1200.0, 'Expense created with amount 1200.00');
        $this->assert($exp1['category'] === 'Software', 'Expense categorized as Software');

        // Custom category creation
        $exp2 = ExpenseService::create($userId, [
            'title' => 'AWS Cloud Infrastructure',
            'category' => 'Cloud Hosting',
            'amount' => 850.00,
            'date' => '2026-11-02'
        ]);

        $categories = ExpenseService::getCategories($userId);
        $hasCloudCat = array_reduce($categories, fn($acc, $c) => $acc || $c['name'] === 'Cloud Hosting', false);
        $this->assert($hasCloudCat, 'Custom category auto-created and mapped');

        // Delete expense
        $del = ExpenseService::delete($userId, $exp2['id']);
        $this->assert($del['action'] === 'deleted', 'Expense deleted successfully');
    }

    private function testDashboardAndFinancialReportCalculations(int $userId): void {
        echo "\n[9] Testing Dashboard and Financial Calculations Engine\n";

        $dash = ReportService::getDashboardMetrics($userId);
        $this->assert(isset($dash['metrics']['total_clients']), 'Dashboard returns total_clients');
        $this->assert(isset($dash['metrics']['monthly_income']), 'Dashboard returns monthly_income');
        $this->assert(isset($dash['metrics']['pending_payments']), 'Dashboard returns pending_payments');
        $this->assert(is_array($dash['income_chart']) && count($dash['income_chart']) === 6, 'Dashboard returns 6-month chart dataset');

        $report = ReportService::getFinancialReport($userId, 'last6');
        $this->assert(isset($report['summary']['total_invoiced']), 'Report calculates total_invoiced');
        $this->assert(isset($report['summary']['total_received']), 'Report calculates total_received');
        $this->assert(isset($report['summary']['total_expenses']), 'Report calculates total_expenses');
        $this->assert(isset($report['summary']['net_income']), 'Report calculates net_income = received - expenses');

        $expectedNet = round($report['summary']['total_received'] - $report['summary']['total_expenses'], 2);
        $this->assert(abs($report['summary']['net_income'] - $expectedNet) < 0.01, 'Net Income matches exact mathematical formula');
    }

    private function testMultiUserDataIsolation(int $userAId, int $userBId): void {
        echo "\n[10] Testing Multi-User Data Isolation (Tenant A vs Tenant B)\n";

        // User A creates client A
        $clientA = ClientService::create($userAId, [
            'name' => 'Secret Client of User A',
            'monthly_amount' => 9999.00
        ]);

        // User B tries to fetch Client A by ID -> MUST RETURN NULL
        $fetchedByB = ClientService::getById($userBId, $clientA['id']);
        $this->assert($fetchedByB === null, 'User B cannot view User A client (returns null)');

        // User B tries to update Client A -> MUST THROW EXCEPTION
        $this->assertThrows(function () use ($userBId, $clientA) {
            ClientService::update($userBId, $clientA['id'], ['name' => 'Hijacked Client']);
        }, 'not found or unauthorized', 'User B cannot update User A client (strictly blocked)');

        // User B tries to delete Client A -> MUST THROW EXCEPTION
        $this->assertThrows(function () use ($userBId, $clientA) {
            ClientService::deleteOrDeactivate($userBId, $clientA['id']);
        }, 'not found or unauthorized', 'User B cannot delete User A client (strictly blocked)');

        // Verify Client A name was not tampered with
        $refreshedA = ClientService::getById($userAId, $clientA['id']);
        $this->assert($refreshedA['name'] === 'Secret Client of User A', 'User A client data remains untampered');
    }

    private function testSqlInjectionPrevention(int $userId): void {
        echo "\n[11] Testing SQL Injection Prevention in Queries\n";

        $maliciousPayload = "'; DROP TABLE users; -- ' OR '1'='1";

        // Searching with SQL injection string should safely escape and execute without syntax error
        $clients = ClientService::getAll($userId, null, $maliciousPayload);
        $this->assert(is_array($clients), 'Malicious search query safely handled via prepared statements');

        // Verify users table still exists and is untouched
        $stmt = $this->db->query('SELECT COUNT(*) FROM users');
        $this->assert((int)$stmt->fetchColumn() > 0, 'Users table intact after SQL injection attack simulation');
    }

    private function testDatabaseTransactionRollback(int $userId): void {
        echo "\n[12] Testing Atomic Transaction Rollback on Failure\n";

        $client = ClientService::getAll($userId)[0];
        $invBefore = count(InvoiceService::getAll($userId));

        // Attempt an invalid operation that fails mid-way
        try {
            $this->db->beginTransaction();
            $stmt = $this->db->prepare('INSERT INTO invoices (user_id, client_id, invoice_number, service_name, billing_month, amount, due_date) VALUES (:uid, :cid, "ROLLBACK-TEST", "Svc", "2026-11", 500, "2026-11-20")');
            $stmt->execute([':uid' => $userId, ':cid' => $client['id']]);

            // Deliberate constraint violation error
            throw new Exception('Simulated mid-operation transaction failure');
            $this->db->commit();
        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
        }

        $invAfter = count(InvoiceService::getAll($userId));
        $this->assert($invBefore === $invAfter, 'Transaction rolled back cleanly without leaving orphan records');
    }

    private function testLocalStorageMigration(int $userId): void {
        echo "\n[13] Testing LocalStorage Payload Migration Engine\n";

        $dump = [
            'clients' => [
                [
                    'id' => 'cli_legacy_1',
                    'name' => 'Legacy Client Apex',
                    'company' => 'Apex Corp',
                    'monthlyAmount' => 4000,
                    'service' => 'Full Stack Dev',
                    'joiningDate' => '2026-03-01',
                    'status' => 'active'
                ]
            ],
            'invoices' => [
                [
                    'id' => 'inv_legacy_1',
                    'clientId' => 'cli_legacy_1',
                    'invoiceNumber' => 'INV-LEGACY-001',
                    'serviceName' => 'Full Stack Dev',
                    'chargeType' => 'retainer',
                    'billingMonth' => '2026-03',
                    'amount' => 4000,
                    'dueDate' => '2026-03-10',
                    'status' => 'paid'
                ]
            ],
            'payments' => [
                [
                    'id' => 'pay_legacy_1',
                    'invoiceId' => 'inv_legacy_1',
                    'clientId' => 'cli_legacy_1',
                    'amount' => 4000,
                    'paymentDate' => '2026-03-08',
                    'paymentMethod' => 'Bank Transfer',
                    'notes' => 'Settled upfront via NEFT'
                ]
            ],
            'expenses' => [
                [
                    'id' => 'exp_legacy_1',
                    'title' => 'Domain Name Renewal',
                    'category' => 'Internet',
                    'amount' => 1500,
                    'date' => '2026-03-05'
                ]
            ],
            'settings' => [
                'businessName' => 'Legacy Migrated Studio',
                'currency' => 'INR',
                'invoicePrefix' => 'LGC-'
            ]
        ];

        $report = MigrationService::migrate($userId, $dump);

        $this->assert($report['clients_migrated'] === 1, 'Migration imports 1 client');
        $this->assert($report['invoices_migrated'] === 1, 'Migration imports 1 invoice');
        $this->assert($report['payments_migrated'] === 1, 'Migration imports 1 payment');
        $this->assert($report['expenses_migrated'] === 1, 'Migration imports 1 expense');
        $this->assert($report['settings_updated'] === true, 'Migration updates business settings');

        // Verify imported invoice status is properly verified as settled
        $stmt = $this->db->prepare('SELECT status FROM invoices WHERE user_id = :uid AND invoice_number = "INV-LEGACY-001"');
        $stmt->execute([':uid' => $userId]);
        $status = $stmt->fetchColumn();
        $this->assert($status === 'paid', 'Migrated invoice status verified as paid');
    }
}

// Run the test suite
$runner = new TestRunner();
$runner->runAll();
