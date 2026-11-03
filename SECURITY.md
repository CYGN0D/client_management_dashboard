# Cliento — Security Implementation & Hardening Guide

This document specifies the security controls and defensive architecture implemented throughout the **Cliento** PHP and MySQL stack.

---

## 1. Security Architecture Matrix

| Vulnerability Vector | Mitigation Mechanism | Implementation Location |
|---|---|---|
| **SQL Injection (SQLi)** | 100% PDO prepared statements with parameter binding | `includes/db.php`, all `services/*.php` |
| **Credential Theft** | BCRYPT password hashing (`password_hash`, `password_verify`) | `services/AuthService.php` |
| **Session Hijacking / Fixation**| `session_regenerate_id(true)` upon login, `HttpOnly`, `SameSite=Lax` | `includes/auth.php` |
| **Cross-Site Request Forgery (CSRF)** | Cryptographic synchronizer token validation with `hash_equals()` | `includes/auth.php`, `js/api.js` |
| **Cross-Site Scripting (XSS)** | Input sanitization, output escaping, JSON charset enforcement | `includes/validation.php`, `js/utils.js` |
| **Insecure Direct Object Reference (IDOR)** | User ownership verification (`WHERE user_id = :uid`) on every query | All `services/*.php` |
| **Financial Ledger Tampering** | Server-side calculation, row locking (`FOR UPDATE`), atomic transactions | `services/PaymentService.php`, `InvoiceService.php` |
| **Information Leakage** | Production error concealment, centralized response envelope | `includes/response.php`, `config/app.php` |

---

## 2. Authentication & Credential Management

- **Password Storage:** Passwords are never stored in plaintext or weak hashes (MD5, SHA1). The application uses PHP's native `password_hash()` with `PASSWORD_BCRYPT` (cost factor 12) to produce salted 60-character hashes.
- **Verification:** Authentication employs `password_verify()`, which is resistant to timing attacks.
- **Session Lifecycle:**
  - Standard session name: `cliento_session`.
  - Cookie flags: `HttpOnly = true`, `SameSite = Lax`, `Secure = true` (over HTTPS).
  - Calling `session_regenerate_id(true)` invalidates the old session ID immediately upon credential verification.

---

## 3. Cross-Site Request Forgery (CSRF) Defense

Every active session generates a 64-character cryptographic token:
```php
$_SESSION['csrf_token'] = bin2hex(random_bytes(32));
```

- **Enforcement:** All state-changing HTTP requests (`POST`, `PUT`, `DELETE`) pass through `AuthMiddleware::verifyCsrf()`.
- **Transmission:** The frontend REST layer (`js/api.js`) automatically attaches the token to the `X-CSRF-Token` request header.
- **Validation:** Verification uses `hash_equals()` to prevent timing side-channel attacks:
  ```php
  if (!hash_equals($_SESSION['csrf_token'], $providedToken)) {
      Response::error('Invalid or missing CSRF token', 403);
  }
  ```

---

## 4. Multi-Tenant Data Isolation (Anti-IDOR)

Cliento enforces multi-tenant boundaries at the database query level:

- **Root Ownership:** Every client, invoice, payment, expense, category, and setting row contains an explicit `user_id` foreign key.
- **Tenant Scoping:**
  ```sql
  -- Lookups always filter by authenticated user ID:
  SELECT * FROM clients WHERE id = :id AND user_id = :uid;
  UPDATE invoices SET amount = :amt WHERE id = :id AND user_id = :uid;
  DELETE FROM expenses WHERE id = :id AND user_id = :uid;
  ```
- **Validation:** Attempting to view, modify, or delete a record belonging to another tenant returns `404 Not Found` or `403 Forbidden`, preventing any exposure of tenant existence.

---

## 5. SQL Injection Prevention

- **Emulated Prepares Disabled:**
  `PDO::ATTR_EMULATE_PREPARES => false` ensures that queries and parameter bindings are handled by MySQL's native prepared statement engine.
- **Zero Concatenation:** User inputs (including search terms and pagination offsets) are bound through named or positional parameters. Dynamic search queries bind `%term%` strings safely:
  ```php
  $stmt = $db->prepare('SELECT * FROM clients WHERE user_id = ? AND name LIKE ?');
  $stmt->execute([$userId, '%' . $searchTerm . '%']);
  ```

---

## 6. Financial Ledger & Concurrency Protection

- **Atomic Transactions:** Payment recordings, invoice cancellations, and batch retainer generations execute inside `beginTransaction()` ... `commit()`. If an exception occurs, `rollBack()` is invoked.
- **Row-Level Locking:** To prevent double-spending or race condition overpayments, balance queries execute with `FOR UPDATE`:
  ```sql
  SELECT amount, status FROM invoices WHERE id = :id AND user_id = :uid FOR UPDATE;
  ```

---

## 7. Production Hardening Checklist

When deploying Cliento to a production web server:

1. [x] **Disable Display of Errors:** Ensure `display_errors = Off` in `php.ini`. Application exceptions log to system logs instead of HTTP responses.
2. [x] **Enforce HTTPS:** Ensure HTTP requests are redirected to HTTPS. Session cookies will automatically receive the `Secure` attribute.
3. [x] **Configure Environment Variables:** Provide database credentials via environment variables rather than hardcoding credentials into files:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASS`
4. [x] **File Permissions:** Web server user (`www-data` or `nginx`) should have read-only access to PHP source files and write access only to session/temp directories.
