# Cliento — Client Management & Monthly Payment Tracking Software

A minimal, professional, and responsive financial management dashboard designed for agencies, studios, and consultants to manage clients, recurring monthly retainers, payment settlements, and operating expenses.

Built with **pure HTML5, CSS3, and Vanilla JavaScript (ES6+)**. No frameworks, no external runtime dependencies, no build steps.

---

## 🚀 Key Features

### 1. Dashboard Overview
- **Dynamic Time Greeting**: Contextual greeting (*Good morning / afternoon / evening*) and localized current date.
- **4 Key Real-time Financial Metrics**:
  - **Total Clients**: Total registered clients with live active count breakdown.
  - **Monthly Income**: Real cash received during the current calendar month.
  - **Received Payments**: Actual sum of payment transactions settled this month.
  - **Pending Payments**: Total outstanding balances of all open client invoices.
- **Monthly Income Overview Chart**: Responsive interactive SVG bar chart displaying real revenue trends across the last 6 months with hover tooltips and dynamic scale ceiling.
- **Recent Activity Feeds**:
  - **Recent Payments**: Latest 5 payment receipts with method, amount, and client details.
  - **Recent Expenses**: Latest 5 recorded business expenditures.
  - **Upcoming & Overdue Client Dues**: Immediate visibility into unpaid invoices prioritized by due date.

### 2. Client Management
- **Instant Search & Filter**: Search clients in real time by name, phone number, or service; filter by Active/Inactive status without page reloads.
- **Client Records**: Track Client Name, Phone, Email, Service/Retainer description, Monthly Charge (₹), Billing Due Day (1–28), and Status.
- **Client Overview Panel**: Deep-dive into client lifetime metrics:
  - Total amount paid across all time.
  - Current outstanding balance.
  - Detailed historical transaction ledger.
- **Audit-Safe Deactivation**: Clients with past financial records (invoices or payments) are safely deactivated rather than deleted, preserving complete audit history.

### 3. Invoicing & Payment Tracking
- **Direct & Batch Invoicing**:
  - **Create Individual Invoice**: Create ad-hoc or monthly invoices directly for any client with customized amounts and auto-calculated due dates.
  - **Automated Monthly Generator**: One-click batch billing for all active clients for any selected month (`YYYY-MM`) with strict idempotency (skips duplicate clients).
- **Multi-State Payment Workflow**:
  - **Paid**: Amount received meets or exceeds invoice total.
  - **Partial**: Partial payment recorded; displays remaining balance and overdue indicator if past due date.
  - **Pending**: Unpaid and within due date window.
  - **Overdue**: Unpaid and past due date.
- **Flexible Settlement Recording**:
  - Record full or partial payments with amount validation against outstanding balance.
  - Track payment methods: Bank Transfer (NEFT/RTGS/IMPS), UPI, Cash, Other.
  - Transaction reference notes (UTR / Txn ID).
  - Complete transaction audit modal for every invoice.

### 4. Expense Tracking
- **Operating Cost Ledger**: Log business expenses with Title, Category, Amount, Date, and Description.
- **Built-in Categories**: Software, Hosting, Internet, Marketing, Office, Travel, and Other.
- **Summary Metrics**: Live calculation of total expenses this month and today.
- **Filters**: Filter expenses by category and billing month, with instant title search.

### 5. Financial Reports & Profitability
- **Cash-Basis Profit Calculation**:
  $$\text{Net Profit} = \text{Actual Cash Received} - \text{Total Operating Expenses}$$
  *(Unpaid invoices are strictly kept in pending receivables and not treated as revenue).*
- **Income vs Expenses Comparison Chart**: Responsive SVG dual-bar chart comparing actual monthly collections against monthly expenses over time.
- **Monthly Financial Summary Table**: Chronological table of Income Received, Expenses, Net Profit (highlighted in green/red), and Outstanding Receivables.
- **Pending Payments Audit**: Comprehensive list of all open balances across all billing cycles.

### 6. Settings & Data Backups
- **Business Profile**: Manage business name, contact phone, billing email, and address.
- **Billing Preferences**: Configure default invoice prefix (e.g. `INV-`) and standard monthly due day.
- **JSON Backup & Restore**: Export full application data into a single `.json` backup file; restore with full schema validation and confirmation.
- **Data Reset**: One-click wipe to reset all records to a clean slate.

---

## 🛠 Technology Stack & Architecture

- **Markup**: Semantic HTML5 (`header`, `nav`, `main`, `section`, `table`, `form`).
- **Styling**: Pure CSS3 using custom properties (CSS variables), CSS Grid, and Flexbox.
- **Scripting**: Modular Vanilla JavaScript (ES6+ classes/objects).
- **Icons**: [Lucide Icons](https://lucide.dev/) via CDN with built-in embedded offline SVG fallback.
- **Charts**: Custom responsive SVG charts with tab-index, tabular numerals, and dynamic tooltips.
- **Storage**: Browser `window.localStorage` with safe JSON serialization.
- **Arithmetic**: Safe integer arithmetic in paise (`Math.round(amount * 100)`) to eliminate floating-point rounding errors. Currency formatted in standard Indian Rupees (`₹1,25,000.00`).

---

## 📁 Project Structure

```text
client_management_dashboard/
│
├── index.html              # Main application shell & view templates
├── README.md               # Documentation & setup guide
│
├── css/
│   ├── style.css           # Design tokens, variables, typography, layout
│   ├── components.css      # Buttons, cards, tables, badges, modals, charts, toasts
│   └── responsive.css      # Tablet & mobile media queries, off-canvas drawer
│
└── js/
    ├── utils.js            # Currency formatting, date math, modal & toast helpers, offline SVGs
    ├── storage.js          # LocalStorage CRUD, backup JSON import/export, zero dummy data
    ├── clients.js          # Client list, instant search, add/edit form, client detail view
    ├── payments.js         # Invoice generation, payment listing, payment recording modal
    ├── expenses.js         # Expense logging, category/month filters, expense modals
    ├── dashboard.js        # Dashboard metrics, 6-month SVG income chart, recent activity
    ├── reports.js          # Financial metrics, net profit, income vs expenses chart, audits
    ├── settings.js         # Business profile, preferences, JSON backup restoration
    └── app.js              # SPA router, hash navigation, mobile drawer coordination
```

---

## 💻 How to Run

No installations, Node.js packages, or compilation required!

### Option 1: Direct Browser Launch
Simply double-click `index.html` or open it with your browser:
```bash
# On Windows PowerShell
Start-Process chrome.exe "index.html"
# or
Invoke-Item "index.html"
```

### Option 2: Local HTTP Server (Optional)
Run using Python 3:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your web browser.

---

## 🧪 Quality Assurance & Acceptance Verification

All functional workflows have been tested and verified:

| Module | Test Case | Status |
|---|---|:---:|
| **Dashboard** | 4 primary summary metrics calculated from real data | **PASS** |
| **Dashboard** | Responsive 6-month SVG income chart with hover tooltips | **PASS** |
| **Dashboard** | Recent payments, expenses, and upcoming dues rendered accurately | **PASS** |
| **Clients** | Instant search by name, phone, and service | **PASS** |
| **Clients** | Client creation and editing with form validation (name, service, amount, due day 1–28) | **PASS** |
| **Clients** | Client detail view with lifetime total paid and outstanding balance | **PASS** |
| **Clients** | Safe deactivation of clients with existing invoices | **PASS** |
| **Payments** | Idempotent monthly invoice batch generator (skips duplicate clients) | **PASS** |
| **Payments** | Full and partial payment recording with balance limit enforcement | **PASS** |
| **Payments** | Live status calculation (Paid, Partial, Pending, Overdue) | **PASS** |
| **Payments** | Transaction history ledger modal for invoices | **PASS** |
| **Expenses** | Expense creation, editing, category filtering, and month filtering | **PASS** |
| **Expenses** | Safe deletion with confirmation modal | **PASS** |
| **Reports** | Net profit calculated as $\text{Cash Received} - \text{Expenses}$ | **PASS** |
| **Reports** | Responsive SVG Income vs Expenses comparison chart | **PASS** |
| **Reports** | Monthly financial breakdown and pending receivables audit | **PASS** |
| **Settings** | Business details and invoice prefix customization | **PASS** |
| **Settings** | Discard changes restores last saved values | **PASS** |
| **Data** | JSON export and schema-validated restore | **PASS** |
| **Data** | Safe integer paise calculations preventing floating-point drift | **PASS** |
| **Responsive** | Mobile off-canvas drawer navigation and scrollable table wrappers | **PASS** |

---

## 🔒 Privacy & LocalStorage Notice

Cliento operates entirely client-side. All client records and financial transactions remain inside your browser's private LocalStorage. To prevent accidental data loss when clearing browser history, use the **Export Data Backup (JSON)** feature in **Settings**.
