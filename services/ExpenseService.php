<?php
/**
 * CLIENTO - EXPENSE MANAGEMENT SERVICE
 * Handles business expenditures, categorization, and filtering.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

class ExpenseService {
    /**
     * Get expenses with filtering and search
     */
    public static function getAll(
        int $userId,
        ?string $categoryFilter = null,
        ?string $monthFilter = null,
        ?string $search = null
    ): array {
        $db = Database::getConnection();

        $sql = '
            SELECT e.* 
            FROM expenses e 
            WHERE e.user_id = :uid
        ';
        $params = [':uid' => $userId];

        if ($categoryFilter && $categoryFilter !== 'all') {
            $sql .= ' AND e.category = :category';
            $params[':category'] = $categoryFilter;
        }

        if ($monthFilter && $monthFilter !== 'all') {
            $sql .= ' AND e.date LIKE :month';
            $params[':month'] = $monthFilter . '%';
        }

        if ($search !== null && trim($search) !== '') {
            $term = '%' . trim($search) . '%';
            $sql .= ' AND (e.title LIKE :search_title OR e.description LIKE :search_desc OR e.category LIKE :search_cat)';
            $params[':search_title'] = $term;
            $params[':search_desc'] = $term;
            $params[':search_cat'] = $term;
        }

        $sql .= ' ORDER BY e.date DESC, e.id DESC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        return array_map(function ($e) {
            return [
                'id' => (int)$e['id'],
                'expense_code' => $e['expense_code'] ?: ('exp_' . $e['id']),
                'category_id' => $e['category_id'] ? (int)$e['category_id'] : null,
                'title' => $e['title'],
                'category' => $e['category'],
                'amount' => (float)$e['amount'],
                'date' => $e['date'],
                'description' => $e['description'] ?? '',
                'created_at' => $e['created_at'],
                'updated_at' => $e['updated_at']
            ];
        }, $rows);
    }

    /**
     * Get single expense
     */
    public static function getById(int $userId, int $expenseId): ?array {
        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM expenses WHERE id = :id AND user_id = :uid LIMIT 1');
        $stmt->execute([':id' => $expenseId, ':uid' => $userId]);
        $e = $stmt->fetch();

        if (!$e) return null;

        return [
            'id' => (int)$e['id'],
            'expense_code' => $e['expense_code'] ?: ('exp_' . $e['id']),
            'category_id' => $e['category_id'] ? (int)$e['category_id'] : null,
            'title' => $e['title'],
            'category' => $e['category'],
            'amount' => (float)$e['amount'],
            'date' => $e['date'],
            'description' => $e['description'] ?? '',
            'created_at' => $e['created_at'],
            'updated_at' => $e['updated_at']
        ];
    }

    /**
     * Create an expense
     */
    public static function create(int $userId, array $data): array {
        $db = Database::getConnection();
        $amount = (float)($data['amount'] ?? 0);
        if ($amount <= 0) {
            throw new Exception('Expense amount must be greater than zero.');
        }

        $category = trim($data['category'] ?? 'Other');

        // Resolve or create category
        $catStmt = $db->prepare('SELECT id FROM expense_categories WHERE user_id = :uid AND name = :name LIMIT 1');
        $catStmt->execute([':uid' => $userId, ':name' => $category]);
        $catId = $catStmt->fetchColumn();

        if (!$catId) {
            $insertCat = $db->prepare('INSERT INTO expense_categories (user_id, name, is_default, created_at) VALUES (:uid, :name, 0, NOW())');
            $insertCat->execute([':uid' => $userId, ':name' => $category]);
            $catId = (int)$db->lastInsertId();
        }

        $stmt = $db->prepare('
            INSERT INTO expenses (
                user_id, category_id, expense_code, title, category,
                amount, date, description, created_at, updated_at
            ) VALUES (
                :uid, :cat_id, :code, :title, :category,
                :amount, :date, :desc, NOW(), NOW()
            )
        ');

        $tempCode = $data['expense_code'] ?? null;
        $stmt->execute([
            ':uid' => $userId,
            ':cat_id' => $catId,
            ':code' => $tempCode,
            ':title' => trim($data['title']),
            ':category' => $category,
            ':amount' => $amount,
            ':date' => $data['date'] ?? date('Y-m-d'),
            ':desc' => trim($data['description'] ?? '')
        ]);

        $expenseId = (int)$db->lastInsertId();

        if (empty($tempCode)) {
            $code = 'exp_' . $expenseId;
            $db->prepare('UPDATE expenses SET expense_code = :c WHERE id = :id')->execute([':c' => $code, ':id' => $expenseId]);
        }

        Helpers::logActivity(
            $userId,
            'expense',
            $expenseId,
            'create',
            'Created expense ' . $data['title'] . ' (' . Helpers::formatCurrency($amount) . ')'
        );

        return self::getById($userId, $expenseId);
    }

    /**
     * Update an expense
     */
    public static function update(int $userId, int $expenseId, array $data): array {
        $existing = self::getById($userId, $expenseId);
        if (!$existing) {
            throw new Exception('Expense not found or unauthorized.');
        }

        $db = Database::getConnection();
        $amount = isset($data['amount']) ? (float)$data['amount'] : $existing['amount'];
        $category = isset($data['category']) ? trim($data['category']) : $existing['category'];

        $stmt = $db->prepare('
            UPDATE expenses SET
                title = :title,
                category = :category,
                amount = :amount,
                date = :date,
                description = :desc,
                updated_at = NOW()
            WHERE id = :id AND user_id = :uid
        ');

        $stmt->execute([
            ':id' => $expenseId,
            ':uid' => $userId,
            ':title' => isset($data['title']) ? trim($data['title']) : $existing['title'],
            ':category' => $category,
            ':amount' => $amount,
            ':date' => $data['date'] ?? $existing['date'],
            ':desc' => isset($data['description']) ? trim($data['description']) : $existing['description']
        ]);

        Helpers::logActivity(
            $userId,
            'expense',
            $expenseId,
            'update',
            'Updated expense ' . ($data['title'] ?? $existing['title'])
        );

        return self::getById($userId, $expenseId);
    }

    /**
     * Delete an expense
     */
    public static function delete(int $userId, int $expenseId): array {
        $existing = self::getById($userId, $expenseId);
        if (!$existing) {
            throw new Exception('Expense not found or unauthorized.');
        }

        $db = Database::getConnection();
        $stmt = $db->prepare('DELETE FROM expenses WHERE id = :id AND user_id = :uid');
        $stmt->execute([':id' => $expenseId, ':uid' => $userId]);

        Helpers::logActivity(
            $userId,
            'expense',
            $expenseId,
            'delete',
            'Deleted expense ' . $existing['title']
        );

        return [
            'action' => 'deleted',
            'message' => 'Expense deleted successfully.',
            'expense_id' => $expenseId
        ];
    }

    /**
     * Get categories for a user
     */
    public static function getCategories(int $userId): array {
        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT id, name, is_default FROM expense_categories WHERE user_id = :uid ORDER BY is_default DESC, name ASC');
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll();
    }
}
