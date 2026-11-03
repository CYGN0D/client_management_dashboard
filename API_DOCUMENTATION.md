# Cliento — REST API Documentation

This specification documents the REST-style JSON API architecture for **Cliento**, powered by Core PHP 8.2+ and MySQL 8.0+.

---

## 1. Architectural Conventions

- **Base Path:** `/api`
- **Communication Protocol:** HTTP/1.1 or HTTP/2 over HTTPS
- **Payload Format:** `application/json; charset=UTF-8`
- **Authentication:** Secure session cookies (`HttpOnly`, `SameSite=Lax`, `Secure` in production)
- **CSRF Protection:** State-changing requests (`POST`, `PUT`, `DELETE`) require the `X-CSRF-Token` header.
- **Tenant Isolation:** Every operation automatically scopes data to the authenticated session's user ID.

---

## 2. Standardized Response Envelope

### Success Response (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Response (`400`, `401`, `403`, `404`, `422`, `500`)
```json
{
  "success": false,
  "message": "Validation failed on submitted fields",
  "errors": {
    "field_name": "Specific actionable validation error"
  }
}
```

---

## 3. Authentication Endpoints (`/api/auth`)

### 3.1. Fetch CSRF Token
`GET /api/auth/csrf.php`
- **Access:** Public
- **Response:**
  ```json
  {
    "success": true,
    "message": "CSRF token initialized",
    "data": {
      "csrf_token": "a4f89b9d3e8e24c6...",
      "authenticated": false
    }
  }
  ```

### 3.2. User Login
`POST /api/auth/login.php`
- **Access:** Public
- **Headers:** `X-CSRF-Token: <token>`
- **Request Body:**
  ```json
  {
    "email": "admin@cliento.com",
    "password": "Password@123"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "id": 1,
        "name": "Cliento Admin",
        "email": "admin@cliento.com"
      },
      "csrf_token": "b8f19c..."
    }
  }
  ```

### 3.3. User Registration
`POST /api/auth/register.php`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "name": "Sarah Designer",
    "email": "sarah@design.io",
    "password": "SecurePassword#2026",
    "business_name": "Sarah Design Studio"
  }
  ```
- **Response (`201 Created`):** Automatically initializes default settings and default expense categories.

### 3.4. Current User Session
`GET /api/auth/me.php`
- **Access:** Authenticated
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": 1, "name": "Sarah Designer", "email": "sarah@design.io" },
      "csrf_token": "..."
    }
  }
  ```

### 3.5. Logout
`POST /api/auth/logout.php`
- **Access:** Authenticated
- **Response:** Destroys PHP session and clears session cookies.

---

## 4. Clients Endpoints (`/api/clients`)

### 4.1. List Clients
`GET /api/clients/index.php`
- **Query Parameters:**
  - `status`: `all` | `active` (default) | `inactive`
  - `retainer`: `all` | `active` | `paused`
  - `search`: String (searches name, company, phone, email)
  - `page`: Integer (default: 1)
  - `limit`: Integer (default: 50, max: 200)
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "clients": [
        {
          "id": 12,
          "name": "Apex Media Lab",
          "company": "Apex Inc",
          "phone": "+91 98765 43210",
          "email": "contact@apex.com",
          "service": "Mobile App Development, SEO",
          "monthly_amount": 4900.00,
          "due_day": 5,
          "retainer_status": "active",
          "status": "active",
          "joining_date": "2026-01-15",
          "total_invoiced": 4900.00,
          "total_paid": 4900.00,
          "pending_balance": 0.00
        }
      ],
      "pagination": {
        "total": 1,
        "page": 1,
        "limit": 50,
        "pages": 1
      }
    }
  }
  ```

### 4.2. Create Client
`POST /api/clients/index.php`
- **Request Body:**
  ```json
  {
    "name": "Zenith Cloud Corp",
    "company": "Zenith Cloud Solutions",
    "phone": "+91 98111 22334",
    "email": "billing@zenithcloud.com",
    "service": "Cloud Hosting & DevOps",
    "monthly_amount": 7500.00,
    "due_day": 10,
    "retainer_status": "active",
    "joining_date": "2026-11-01",
    "notes": "Annual enterprise contract"
  }
  ```
- **Response (`201 Created`):** Returns the created client record with calculated initial totals.

### 4.3. Client 360° Dossier
`GET /api/clients/detail.php?id={clientId}`
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "client": { "id": 12, "name": "Apex Media Lab", ... },
      "invoices": [ ... ],
      "payments": [ ... ],
      "financials": {
        "total_invoiced": 4900.00,
        "total_paid": 4900.00,
        "pending_balance": 0.00,
        "total_invoices_count": 1,
        "settled_invoices_count": 1
      }
    }
  }
  ```

### 4.4. Update Client
`PUT /api/clients/detail.php?id={clientId}`
- **Request Body:** Partial or complete client payload.
- **Behavior:** Historical invoices retain their historical billing rates; new changes apply to future generation cycles.

### 4.5. Delete / Deactivate Client
`DELETE /api/clients/detail.php?id={clientId}`
- **Behavior:**
  - If the client has existing invoices or payments, the client is **soft-deactivated** (`status = 'inactive'`) to preserve accounting integrity.
  - If no financial records exist, the record is safely hard-deleted.

---

## 5. Invoices Endpoints (`/api/invoices`)

### 5.1. List Invoices
`GET /api/invoices/index.php`
- **Query Parameters:**
  - `month`: `YYYY-MM` (e.g. `2026-11`)
  - `status`: `all` | `pending` | `partial` | `paid` | `overdue`
  - `client_id`: Integer
  - `search`: String (searches invoice number, client name, service name)
  - `page`: Integer
  - `limit`: Integer
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "invoices": [
        {
          "id": 45,
          "invoice_number": "INV-2026-0001",
          "client_id": 12,
          "client_name": "Apex Media Lab",
          "service_name": "Retainer Agreement",
          "charge_type": "retainer",
          "billing_month": "2026-11",
          "amount": 4900.00,
          "paid_amount": 4900.00,
          "remaining_balance": 0.00,
          "due_date": "2026-11-05",
          "status": "paid"
        }
      ],
      "pagination": { ... }
    }
  }
  ```

### 5.2. Create Manual Invoice
`POST /api/invoices/index.php`
- **Request Body:**
  ```json
  {
    "client_id": 12,
    "service_name": "Brand Identity Design",
    "charge_type": "one_time",
    "billing_month": "2026-11",
    "amount": 15000.00,
    "due_date": "2026-11-20",
    "notes": "Upfront advance deposit"
  }
  ```

### 5.3. Idempotent Monthly Retainer Generation
`POST /api/invoices/generate.php`
- **Request Body:**
  ```json
  {
    "month": "2026-11"
  }
  ```
- **Idempotency Guarantee:**
  - Identifies eligible active clients (`status = 'active'`, `retainer_status = 'active'`, `monthly_amount > 0`).
  - Skips any client that already has a retainer invoice for `2026-11`.
  - Generates sequential unique invoice numbers.
  - Safe to execute repeatedly without duplicating invoices or overwriting payments.
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Monthly retainer invoices generated",
    "data": {
      "month": "2026-11",
      "generated_count": 2,
      "skipped_count": 5,
      "total_amount_billed": 12400.00,
      "invoices": [ ... ]
    }
  }
  ```

### 5.4. Invoice Detail
`GET /api/invoices/detail.php?id={invoiceId}`
- Returns full invoice details with calculated balances and linked transaction ledger.

### 5.5. Delete Invoice
`DELETE /api/invoices/detail.php?id={invoiceId}`
- Removes invoice and linked payments within an atomic database transaction.

---

## 6. Payments Endpoints (`/api/payments`)

### 6.1. Record Payment
`POST /api/payments/index.php`
- **Request Body:**
  ```json
  {
    "invoice_id": 45,
    "amount": 2500.00,
    "payment_date": "2026-11-03",
    "payment_method": "UPI",
    "reference_number": "UPI/20261103/987123",
    "notes": "First milestone payment"
  }
  ```
- **Server-Side Validation & Overpayment Prevention:**
  - Queries remaining balance with `FOR UPDATE` row lock.
  - Strictly rejects `amount <= 0`.
  - Strictly rejects `amount > remaining_balance` with `422 Unprocessable Entity`.
  - Recalculates invoice status (`partial` if `balance > 0`, `paid` if `balance == 0`).
- **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Payment recorded successfully",
    "data": {
      "payment_id": 89,
      "invoice_id": 45,
      "amount": 2500.00,
      "paid_amount": 2500.00,
      "remaining_balance": 2400.00,
      "invoice_status": "partial"
    }
  }
  ```

### 6.2. Delete / Void Payment
`DELETE /api/payments/detail.php?id={paymentId}`
- Removes payment record and rolls back invoice `paid_amount` and `status` atomically.

---

## 7. Expenses Endpoints (`/api/expenses`)

### 7.1. List Expenses
`GET /api/expenses/index.php`
- **Query Parameters:** `month`, `category`, `search`, `page`, `limit`

### 7.2. Create Expense
`POST /api/expenses/index.php`
- **Request Body:**
  ```json
  {
    "title": "Adobe Creative Cloud",
    "category": "Software",
    "amount": 4200.00,
    "date": "2026-11-01",
    "description": "Monthly master studio license"
  }
  ```

### 7.3. List / Create Categories
- `GET /api/expenses/categories.php`: Returns user categories.
- `POST /api/expenses/categories.php`: Creates a new custom category.

---

## 8. Financial Reports & Dashboard (`/api/reports`)

### 8.1. Dashboard Real-Time Metrics
`GET /api/reports/index.php?type=dashboard`
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "total_clients": 4,
      "active_retainers": 3,
      "monthly_income": 12400.00,
      "pending_payments": 4851.00,
      "chart_data": [
        { "month": "2026-06", "label": "Jun", "income": 4900.00, "expenses": 1200.00 },
        { "month": "2026-11", "label": "Nov", "income": 7500.00, "expenses": 4200.00 }
      ]
    }
  }
  ```

### 8.2. Comprehensive Financial Audit Report
`GET /api/reports/index.php?type=financial&period=last6`
- **Query Parameters:** `period` = `this_month` | `last_month` | `last6` | `this_year` | `all`
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "summary": {
        "total_invoiced": 45000.00,
        "total_received": 38000.00,
        "total_pending": 7000.00,
        "total_expenses": 14200.00,
        "net_income": 23800.00
      },
      "monthly_breakdown": [ ... ],
      "pending_invoices": [ ... ]
    }
  }
  ```

---

## 9. Data Migration Endpoint (`/api/migrate`)

### 9.1. LocalStorage Ingestion
`POST /api/migrate/index.php`
- **Request Body:**
  ```json
  {
    "data": {
      "clients": [ ... ],
      "invoices": [ ... ],
      "payments": [ ... ],
      "expenses": [ ... ],
      "settings": { ... }
    }
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Data migrated into MySQL database successfully",
    "data": {
      "migrated_at": "2026-11-03 14:00:00",
      "clients_migrated": 4,
      "invoices_migrated": 12,
      "payments_migrated": 9,
      "expenses_migrated": 6,
      "settings_updated": true,
      "total_billed_imported": 48500.00,
      "total_received_imported": 39000.00,
      "warnings": []
    }
  }
  ```
