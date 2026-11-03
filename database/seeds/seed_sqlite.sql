-- ============================================================================
-- CLIENTO — DEFAULT SQLITE SEED
-- Default user: admin@cliento.com / admin123
-- ============================================================================

INSERT OR IGNORE INTO users (id, name, email, password_hash, status, created_at, updated_at)
VALUES (1, 'Admin', 'admin@cliento.com', '$2y$10$WGtHEko/1sliPx/n/5TdcuDM0XtpcE4N1B9z366HZCjfwzjOD8ade', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO settings (user_id, business_name, phone, email, address, currency, billing_preference, invoice_prefix, created_at, updated_at)
VALUES (1, '', '', 'admin@cliento.com', '', 'INR', 5, 'INV-', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO expense_categories (user_id, name, is_default, created_at)
VALUES
  (1, 'Software', 1, CURRENT_TIMESTAMP),
  (1, 'Hosting', 1, CURRENT_TIMESTAMP),
  (1, 'Internet', 1, CURRENT_TIMESTAMP),
  (1, 'Marketing', 1, CURRENT_TIMESTAMP),
  (1, 'Office', 1, CURRENT_TIMESTAMP),
  (1, 'Travel', 1, CURRENT_TIMESTAMP),
  (1, 'Other', 1, CURRENT_TIMESTAMP);
