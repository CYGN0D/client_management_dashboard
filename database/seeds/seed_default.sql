-- ============================================================================
-- CLIENTO — DEFAULT PROVISIONING SEED
-- Default user: admin@cliento.com / admin123
-- Default settings & standard expense categories
-- ============================================================================

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `status`, `created_at`, `updated_at`)
VALUES (1, 'Admin', 'admin@cliento.com', '$2y$10$WGtHEko/1sliPx/n/5TdcuDM0XtpcE4N1B9z366HZCjfwzjOD8ade', 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

INSERT INTO `settings` (`user_id`, `business_name`, `phone`, `email`, `address`, `currency`, `billing_preference`, `invoice_prefix`, `created_at`, `updated_at`)
VALUES (1, '', '', 'admin@cliento.com', '', 'INR', 5, 'INV-', NOW(), NOW())
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

INSERT INTO `expense_categories` (`user_id`, `name`, `is_default`, `created_at`)
VALUES
  (1, 'Software', 1, NOW()),
  (1, 'Hosting', 1, NOW()),
  (1, 'Internet', 1, NOW()),
  (1, 'Marketing', 1, NOW()),
  (1, 'Office', 1, NOW()),
  (1, 'Travel', 1, NOW()),
  (1, 'Other', 1, NOW())
ON DUPLICATE KEY UPDATE `is_default` = 1;
