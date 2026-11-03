-- ============================================================================
-- CLIENTO — SQLITE DATABASE SCHEMA (cliento.db)
-- Supports local offline zero-configuration deployment
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  business_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT DEFAULT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  billing_preference INTEGER NOT NULL DEFAULT 5,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 3. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_code TEXT DEFAULT NULL,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  company TEXT DEFAULT NULL,
  phone TEXT DEFAULT NULL,
  email TEXT DEFAULT NULL,
  service TEXT DEFAULT NULL,
  monthly_amount NUMERIC NOT NULL DEFAULT 0.00,
  due_day INTEGER DEFAULT 5,
  retainer_status TEXT DEFAULT 'active' CHECK(retainer_status IN ('active', 'paused')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  joining_date DATE NOT NULL,
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clients_user_status ON clients (user_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients (user_id, name);
CREATE INDEX IF NOT EXISTS idx_clients_code ON clients (user_id, client_code);

-- 4. INVOICES TABLE
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_code TEXT DEFAULT NULL,
  user_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  invoice_number TEXT NOT NULL,
  service_name TEXT NOT NULL DEFAULT 'Service',
  charge_type TEXT NOT NULL DEFAULT 'standard' CHECK(charge_type IN ('retainer', 'one_time', 'project_advance', 'custom_changes', 'standard')),
  notes TEXT DEFAULT NULL,
  billing_month TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'partial', 'paid', 'overdue')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
  UNIQUE(user_id, invoice_number),
  UNIQUE(client_id, billing_month, charge_type)
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_month ON invoices (user_id, billing_month);
CREATE INDEX IF NOT EXISTS idx_invoices_client_status ON invoices (client_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices (user_id, due_date, status);

-- 5. INVOICE ITEMS TABLE
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1.00,
  unit_price NUMERIC NOT NULL DEFAULT 0.00,
  total_amount NUMERIC NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items (invoice_id);

-- 6. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_code TEXT DEFAULT NULL,
  user_id INTEGER NOT NULL,
  invoice_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
  notes TEXT DEFAULT NULL,
  reference_number TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_user_date ON payments (user_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments (client_id);

-- 7. EXPENSE CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(user_id, name)
);

-- 8. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_code TEXT DEFAULT NULL,
  user_id INTEGER NOT NULL,
  category_id INTEGER DEFAULT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  description TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES expense_categories (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (user_id, category);

-- 9. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER DEFAULT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  ip_address TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_user_date ON activity_logs (user_id, created_at);
