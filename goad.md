\# MASTER DEVELOPMENT PROMPT — CLIENTO

\## Complete Client Management \& Monthly Payment Tracking Software



Act as a Senior Frontend Engineer, UI/UX Designer, Software Architect and QA Engineer.



Build a complete, functional, responsive Client Management \& Payment Tracking application named \*\*Cliento\*\* using pure HTML, CSS and Vanilla JavaScript.



This is a real working application, NOT a static dashboard mockup.



Follow every requirement below. Do not skip modules, invent unnecessary features, or leave non-functional buttons.



\---



\# 1. TECHNOLOGY STACK



Use ONLY:



\- HTML5

\- CSS3

\- Vanilla JavaScript (ES6+)

\- LocalStorage for persistent data.

\- SVG for charts and simple visual elements where required.

\- Lucide Icons for interface icons.



Do NOT use:

\- React

\- Vue

\- Angular

\- Next.js

\- Bootstrap

\- Tailwind CSS

\- jQuery

\- Backend frameworks

\- Unnecessary UI libraries

\- AI-generated illustrations

\- External image assets



Keep the application lightweight and fast.



\## Project structure



Create organized files:



```text

cliento/

│

├── index.html

├── css/

│   ├── style.css

│   ├── components.css

│   └── responsive.css

│

├── js/

│   ├── app.js

│   ├── storage.js

│   ├── dashboard.js

│   ├── clients.js

│   ├── payments.js

│   ├── expenses.js

│   ├── reports.js

│   ├── settings.js

│   └── utils.js

│

└── README.md

```



All modules must work together through a consistent application structure.



\---



\# 2. DESIGN SYSTEM



\## Design direction



Create a premium, minimal, professional financial SaaS dashboard.



Visual inspiration: The previously provided dashboard reference image.



The interface should feel like a polished professional business management tool.



Prioritize:

\- Clarity

\- Consistency

\- Readability

\- Proper spacing

\- Information hierarchy

\- Fast navigation

\- Minimal visual noise



Do not make it look like a generic AI-generated dashboard.



\## Color palette



Use this design system consistently:



| Token | Color |

|---|---|

| Primary | #171717 |

| Primary Hover | #303030 |

| Background | #FFFFFF |

| Secondary Background | #F8F9FA |

| Surface | #FFFFFF |

| Border | #E8EAED |

| Primary Text | #171717 |

| Secondary Text | #666666 |

| Muted Text | #888888 |

| Success | #16834A |

| Success Background | #EAF6EE |

| Warning | #A86508 |

| Warning Background | #FFF5E5 |

| Danger | #C43D3D |

| Danger Background | #FCEEEE |



Do not introduce unnecessary accent colors.



Use color only where it communicates meaning.



\## Typography



\- Use Inter or a similar clean sans-serif font.

\- Clear hierarchy between page headings, section headings, labels and body text.

\- Avoid oversized headings.

\- Use consistent font weights.

\- Financial numbers should use tabular numerals.

\- Maintain comfortable readability.



\## Spacing system



Use a consistent 4px-based spacing scale:



\- 4px

\- 8px

\- 12px

\- 16px

\- 20px

\- 24px

\- 32px

\- 40px



Avoid random spacing values.



\## Component design



Buttons:

\- Primary button: dark background, white text.

\- Secondary button: white background, subtle border.

\- Destructive button: restrained red styling.

\- Consistent height, padding and radius.

\- Clear hover, active, disabled and focus states.



Inputs:

\- White background.

\- Subtle border.

\- Consistent height.

\- Proper labels.

\- Visible focus ring.

\- Clear validation errors.



Tables:

\- Clean header row.

\- Consistent column alignment.

\- Proper row spacing.

\- Subtle horizontal dividers.

\- No unnecessary vertical borders.

\- Clear empty states.



Cards:

\- Use only when grouping information improves readability.

\- Subtle borders.

\- No excessive shadows.

\- No unnecessary nested cards.



Icons:

\- Lucide icons only.

\- Consistent 16px or 18px size.

\- No emojis.

\- No random Unicode symbols.

\- Icon-only buttons must have accessible labels.



\---



\# 3. APPLICATION LAYOUT



Create a consistent application shell shared across all pages.



\## Desktop layout



Three-column dashboard architecture is NOT required.



Use a simple two-part layout:



1\. Fixed left sidebar.

2\. Main content area.



Sidebar:

\- Fixed width approximately 240px.

\- White background.

\- Subtle right border.

\- Cliento logo/name at the top.

\- Navigation links.

\- Settings at the bottom.



Main content:

\- Flexible width.

\- Consistent horizontal padding.

\- Clean page header.

\- Proper content spacing.

\- Scrollable content area.



Do not add a permanent right-side activity panel.



Do not add fake profile widgets, random user avatars, chat panels, note widgets or unrelated content.



\## Sidebar navigation



1\. Dashboard

2\. Clients

3\. Payments

4\. Expenses

5\. Reports



Bottom navigation:

6\. Settings



Requirements:

\- Active page indicator.

\- Consistent Lucide icons.

\- Smooth navigation.

\- No full-page reload required.

\- Browser back/forward navigation should work appropriately.

\- Sidebar state should remain consistent between pages.



\## Mobile layout



\- Sidebar becomes a compact mobile navigation drawer.

\- Provide a clean menu toggle.

\- Close drawer after navigation.

\- Main content uses full available width.

\- Tables use horizontal scrolling when necessary.

\- Forms stack vertically.

\- Buttons remain accessible.

\- No horizontal page overflow.



\---



\# 4. DASHBOARD PAGE



Dashboard is the first screen after opening the application.



\## Page header



Display:

\- Good morning / afternoon / evening greeting based on local time.

\- Current date.

\- Short title: Dashboard.



Do not add long descriptions.



\## Summary metrics



Display exactly these four primary metrics:



1\. Total Clients

2\. Monthly Income

3\. Received Payments

4\. Pending Payments



Each metric should show:

\- Label.

\- Calculated amount or count.

\- Relevant comparison only if reliable historical data exists.



Do not generate fake percentage growth indicators.



\## Monthly Income Overview



Create a clean monthly income chart.



Requirements:

\- Display monthly income.

\- Show the last 6 months.

\- Use real payment data.

\- Include month labels.

\- Tooltip on hover.

\- Responsive SVG chart.

\- Proper empty state when no data exists.



Do not hardcode chart values.



\## Recent Payments



Display the latest 5 payment transactions.



Columns:

\- Client Name

\- Amount

\- Date

\- Payment Method

\- Status



Provide a View All link to Payments.



\## Recent Expenses



Display the latest 5 expenses.



Columns:

\- Expense Name

\- Category

\- Amount

\- Date



Provide a View All link to Expenses.



\## Upcoming Payments



Display upcoming client payment dues.



Show:

\- Client Name

\- Amount Due

\- Due Date

\- Payment Status



Only display genuinely upcoming or overdue records.



Do not duplicate unrelated activity widgets.



\---



\# 5. CLIENT MANAGEMENT PAGE



This is the central module of the application.



\## Page header



\- Title: Clients.

\- Total client count.

\- Add Client button.



\## Search and filters



\- Search by client name.

\- Search by phone number.

\- Filter by Active / Inactive.

\- Clear filters.



Search should work instantly without refreshing the page.



\## Client listing table



Columns:



1\. Client Name

2\. Phone

3\. Service

4\. Monthly Charge

5\. Due Date

6\. Status

7\. Actions



Actions:

\- View

\- Edit

\- Delete



Use a compact vertical three-dot menu for row actions.



Do not display unnecessary information in the table.



\## Add Client form



Open a clean modal or dedicated form panel.



Fields:



1\. Client Name — required.

2\. Phone Number — optional.

3\. Email — optional.

4\. Service Name — required.

5\. Monthly Payment Amount — required.

6\. Joining Date — required.

7\. Payment Due Day — required, 1–28.

8\. Client Status — Active / Inactive.



Buttons:

\- Save Client

\- Cancel



Validation:

\- Client name cannot be empty.

\- Service cannot be empty.

\- Monthly amount must be greater than zero.

\- Due day must be between 1 and 28.

\- Email must be valid when supplied.



Prevent accidental duplicate submissions.



\## Client details



Clicking View should open a dedicated client detail page or panel.



Display:

\- Client information.

\- Service details.

\- Monthly payment amount.

\- Joining date.

\- Payment due day.

\- Current status.

\- Total amount paid.

\- Outstanding balance.

\- Payment history.



Allow editing client details.



\## Delete client



Before deletion:

\- Display confirmation dialog.

\- Explain that the client's existing financial history will be preserved.

\- Never silently delete payment records.



Recommended behavior:

\- Deactivate clients instead of permanently deleting clients with financial history.

\- Preserve previous payments and invoices.



\---



\# 6. MONTHLY PAYMENT MANAGEMENT



This module must be reliable because it handles financial records.



\## Page header



Title: Payments.



Primary action:

Generate Monthly Payments.



\## Summary metrics



Display:



1\. Total Expected

2\. Total Received

3\. Total Pending



Use selected month as the reporting period.



\## Monthly payment generator



Generate payment records for active clients.



Billing rules:

\- Use each client's monthly charge.

\- Use the configured payment due day.

\- Generate one invoice per active client per billing month.

\- Each record must contain client ID, billing month, amount, due date and status.

\- Do not generate duplicate invoices for the same client and billing month.

\- Inactive clients must not receive new invoices.

\- Existing invoices must never be overwritten.

\- Changing a client's future monthly charge must not alter historical invoices.



Provide a confirmation step before generation.



After generation:

\- Show how many invoices were created.

\- Show how many were skipped because they already existed.



Generation must be idempotent.



\## Payment listing



Columns:



1\. Client Name

2\. Billing Month

3\. Invoice Amount

4\. Paid Amount

5\. Remaining Amount

6\. Due Date

7\. Status

8\. Actions



Search:

\- Client name.

\- Billing month.



Filters:

\- All

\- Paid

\- Partial

\- Pending

\- Overdue



\## Payment status logic



Status must be calculated from actual amounts:



Paid:

Paid amount equals or exceeds invoice amount.



Partial:

Paid amount is greater than zero but less than invoice amount.



Pending:

No amount has been received and the due date has not passed.



Overdue:

No amount has been received and the due date has passed.



A partially paid invoice past its due date should remain Partial, with overdue information displayed separately if appropriate.



Never mark an invoice as paid just because a button was clicked without recording a valid payment.



\## Record payment



Provide a Record Payment modal.



Fields:

\- Payment Amount.

\- Payment Date.

\- Payment Method.



Payment methods:

\- Cash

\- UPI

\- Bank Transfer

\- Other



Actions:

\- Save Payment

\- Cancel



Validation:

\- Amount must be greater than zero.

\- Payment cannot exceed the outstanding amount.

\- Payment date is required.

\- Payment method is required.



Support multiple partial payments against the same invoice.



Maintain a separate transaction history for each invoice.



\## Payment history



Display:

\- Payment date.

\- Amount received.

\- Payment method.

\- Related invoice.

\- Remaining balance.



Never overwrite previous transactions.



\## Payment actions



\- Record Payment.

\- View Details.

\- View History.



All actions must work.



\---



\# 7. EXPENSE MANAGEMENT PAGE



This page is mandatory and must not be skipped.



\## Page header



Title: Expenses.



Primary action:

Add Expense.



\## Summary



Display:

\- Total Expenses This Month.

\- Total Expenses Today.



\## Expense listing table



Columns:



1\. Expense Name

2\. Category

3\. Amount

4\. Date

5\. Description

6\. Actions



Actions:

\- Edit

\- Delete



\## Add Expense form



Fields:

\- Expense Title — required.

\- Category — required.

\- Amount — required.

\- Expense Date — required.

\- Description — optional.



Suggested categories:

\- Software

\- Hosting

\- Internet

\- Marketing

\- Office

\- Travel

\- Other



Allow selecting an existing category.



\## Validation



\- Expense title is required.

\- Amount must be greater than zero.

\- Date is required.

\- Category is required.



\## Search and filters



\- Search expense title.

\- Filter by category.

\- Filter by date/month.



\## Edit and Delete



\- Editing must update the original expense.

\- Deleting requires confirmation.

\- Updated expenses must immediately reflect in dashboard and reports.



Do not add vendor management, inventory, receipt attachment systems or unrelated accounting features.



\---



\# 8. REPORTS PAGE



Create a simple financial reporting module.



\## Summary metrics



Display:

\- Monthly Income.

\- Monthly Expenses.

\- Net Profit.

\- Received Payments.

\- Pending Payments.



\## Financial calculations



Monthly Income:

Total actual payments received during the selected month.



Monthly Expenses:

Total expenses recorded during the selected month.



Net Profit:



Net Profit = Actual Income Received - Total Expenses.



Pending Payments:

Outstanding invoice balances for the selected reporting period.



Do not treat generated but unpaid invoices as received income.



Do not mix invoice value and cash received.



\## Income vs Expenses chart



\- Display monthly income and expenses.

\- Use actual stored data.

\- Allow selecting a reporting period.

\- Clear legends.

\- Readable labels.

\- Responsive layout.



\## Monthly financial summary



Table columns:

\- Month

\- Income Received

\- Expenses

\- Net Profit

\- Pending Amount



\## Pending Payments Report



Display:

\- Client Name.

\- Billing Month.

\- Invoice Amount.

\- Paid Amount.

\- Remaining Balance.

\- Due Date.

\- Status.



\## Filters



\- Month.

\- Custom date range.



Changing filters must update all relevant report metrics and charts.



No fake data, fake growth percentages or unnecessary analytics.



\---



\# 9. SETTINGS PAGE



Keep this page extremely simple.



\## Business Information



Fields:

\- Business Name.

\- Phone Number.

\- Email.

\- Business Address.



\## Preferences



Fields:

\- Currency: INR (₹).

\- Monthly Billing Date / Default Billing Preference.

\- Invoice Prefix.



The actual billing due day for each client must remain configurable in the client record.



\## Actions



\- Save Changes.

\- Discard Changes.



Requirements:

\- Persist settings in LocalStorage.

\- Validate fields.

\- Display clear save confirmation.

\- Discard should restore the last saved values.

\- Never show duplicate Save or Discard buttons.



Do not add unnecessary settings.



\---



\# 10. DATA STRUCTURE AND STORAGE



Use LocalStorage with structured JSON.



Maintain separate keys for:



\- clients

\- invoices

\- payments

\- expenses

\- settings



Use stable unique IDs for every record.



Suggested data structure:



Client:

\- id

\- name

\- phone

\- email

\- service

\- monthlyAmount

\- joiningDate

\- dueDay

\- status

\- createdAt

\- updatedAt



Invoice:

\- id

\- clientId

\- billingMonth

\- amount

\- dueDate

\- status

\- createdAt



Payment:

\- id

\- invoiceId

\- clientId

\- amount

\- paymentDate

\- paymentMethod

\- createdAt



Expense:

\- id

\- title

\- category

\- amount

\- date

\- description

\- createdAt

\- updatedAt



Settings:

\- businessName

\- phone

\- email

\- address

\- currency

\- billingPreference

\- invoicePrefix



\## Storage requirements



\- All data must persist after page refresh.

\- Editing must update existing records.

\- Deletion must not corrupt related records.

\- Use safe JSON parsing.

\- Handle missing LocalStorage keys.

\- Provide default settings.

\- Prevent duplicate IDs.

\- Add a simple data export/import backup using JSON.

\- Validate imported data before replacing existing records.

\- Never silently overwrite user data.



Add a clear confirmation before restoring or replacing data.



IMPORTANT: LocalStorage is browser-specific. Clearly document that clearing browser data can remove stored records. Do not claim cloud backup or multi-device synchronization.



\---



\# 11. FINANCIAL CALCULATION RULES



All calculations must use actual stored records.



Dashboard Monthly Income:

Actual payment transactions within the current calendar month.



Dashboard Received Payments:

Actual amounts received within the current month.



Dashboard Pending Payments:

Outstanding balances of unpaid and partially paid invoices.



Dashboard Total Clients:

All saved clients, with active/inactive status available separately.



Expenses:

Sum of expenses based on expense date.



Net Profit:

Actual income received minus recorded expenses.



Payment history:

Sum of all transactions linked to an invoice.



Outstanding:

Invoice amount minus total payments received.



All monetary calculations must use safe integer arithmetic in paise wherever practical. Format displayed amounts in Indian Rupees.



Use:

₹1,25,000.00



Avoid floating-point rounding errors.



All calculations must update immediately after adding, editing or deleting relevant records.



\---



\# 12. UI/UX INTERACTION REQUIREMENTS



Every interactive element must have a real working action.



Implement:



\- Sidebar navigation.

\- Mobile navigation drawer.

\- Add buttons.

\- Edit buttons.

\- Delete buttons.

\- Search.

\- Filters.

\- Form validation.

\- Confirmation dialogs.

\- Modal open and close.

\- Escape key to close dialogs.

\- Click outside to close where appropriate.

\- Loading feedback where needed.

\- Success feedback.

\- Error feedback.

\- Empty states.

\- Table overflow handling.

\- Keyboard accessibility.



Do not use browser alert() for normal success notifications.



Use minimal toast notifications.



Use accessible semantic HTML:

\- header

\- nav

\- main

\- section

\- table

\- form

\- label

\- button



Use proper focus management for modals.



All inputs must have connected labels.



All icon-only controls must have accessible names.



Never rely only on colors to communicate payment status.



\---



\# 13. RESPONSIVE DESIGN



Test these viewport sizes:



Desktop:

1440px, 1280px, 1024px.



Tablet:

768px.



Mobile:

430px, 390px, 360px.



Rules:



Desktop:

\- Fixed sidebar.

\- Main content fills remaining width.

\- Tables display normally.



Tablet:

\- Sidebar can collapse.

\- Main content uses available width.

\- Cards and sections reflow.



Mobile:

\- Navigation drawer.

\- Single-column content.

\- Summary metrics in a compact 2-column grid where appropriate.

\- Forms stack vertically.

\- Tables scroll horizontally within their containers.

\- No content clipping.

\- No horizontal body scrolling.

\- Buttons must not overlap.



Do not simply shrink the desktop design.



Create genuinely usable mobile layouts.



\---



\# 14. PERFORMANCE AND CODE QUALITY



\- Keep JavaScript modular.

\- Avoid unnecessary DOM re-rendering.

\- Use event delegation where appropriate.

\- Avoid duplicate event listeners.

\- Avoid global variable pollution.

\- Use reusable functions for formatting and calculations.

\- Separate storage logic from UI logic.

\- Avoid hardcoded dashboard numbers.

\- Avoid fake placeholder actions.

\- Handle JavaScript errors gracefully.

\- Keep CSS organized.

\- Avoid excessive animations.

\- No unnecessary dependencies.



Do not put the entire application into one giant JavaScript file.



Do not create dead navigation links.



\---



\# 15. SAMPLE DATA



For demonstration purposes, initialize a small set of realistic sample records only on first launch.



Use:

\- 3–5 sample clients.

\- A few historical invoices.

\- A few paid and partial payment transactions.

\- 3–5 sample expenses.



Use INR amounts and realistic Indian payment methods.



Requirements:

\- Sample data must be clearly distinguishable from real user-entered data.

\- Provide an option to clear demonstration data.

\- Never reinsert deleted demo records after the first initialization.

\- Do not hardcode sample values into dashboard metrics or charts.



\---



\# 16. FINAL QUALITY ASSURANCE



Before declaring the application complete, test every module.



\## Dashboard

\- Are all 4 metrics calculated correctly?

\- Is monthly income chart based on real data?

\- Are Recent Payments and Recent Expenses visible?

\- Are upcoming payments correct?



\## Clients

\- Can a client be added?

\- Can a client be edited?

\- Can a client be deactivated?

\- Does client history remain available?

\- Does search work?



\## Payments

\- Can monthly invoices be generated?

\- Does generation prevent duplicates?

\- Can full payments be recorded?

\- Can partial payments be recorded?

\- Are balances correct?

\- Is payment history preserved?

\- Are overdue statuses calculated correctly?



\## Expenses

\- Can expenses be created?

\- Can expenses be edited?

\- Can expenses be deleted?

\- Do reports update after changes?



\## Reports

\- Are income and expenses calculated correctly?

\- Is net profit correct?

\- Are pending balances correct?

\- Do date filters work?



\## Settings

\- Do saved settings persist?

\- Does discard restore saved values?

\- Does invoice prefix work?



\## Responsive

\- No broken layouts.

\- No overlapping controls.

\- No horizontal body overflow.

\- All actions accessible on mobile.



\## Data integrity

\- Refresh the application and verify persistence.

\- Test empty datasets.

\- Test invalid input.

\- Test duplicate invoice generation.

\- Test partial payments.

\- Test deleting or deactivating a client with existing invoices.

\- Test data backup and restore.



\---



\# 17. STRICT DESIGN RESTRICTIONS



These restrictions are mandatory.



DO NOT ADD:



\- AI-generated UI elements.

\- Emojis.

\- Stock images.

\- Random illustrations.

\- User avatar grids.

\- Chat widgets.

\- Notes widgets.

\- Unnecessary right-side panels.

\- Fake notifications.

\- Fake analytics.

\- Fake percentage growth.

\- Unnecessary descriptions.

\- Large promotional banners.

\- Excessive dashboard cards.

\- Unnecessary gradients.

\- Excessive shadows.

\- Unrequested modules.

\- Unnecessary animations.

\- Decorative background patterns.

\- Random colors.

\- Duplicate buttons.

\- Duplicate navigation.

\- Placeholder links.

\- Non-functional buttons.



Keep the interface neat, compact, minimal and professional.



Every element must have a clear purpose.



\---



\# 18. DEVELOPMENT EXECUTION RULES



Follow this exact order:



1\. Set up the complete project structure.

2\. Build the global design system.

3\. Build the application shell and navigation.

4\. Implement LocalStorage and data models.

5\. Implement Client Management.

6\. Implement Monthly Payment Management.

7\. Implement Expense Management.

8\. Implement Dashboard calculations and charts.

9\. Implement Reports.

10\. Implement Settings.

11\. Implement responsive layouts.

12\. Perform complete functional and UI/UX testing.

13\. Fix all discovered issues.

14\. Prepare README with setup and usage instructions.



Do not stop after generating the dashboard.



Do not provide only screenshots or visual mockups.



Do not leave incomplete modules for later.



Build the complete working application.



If a requirement cannot be implemented, explicitly report the limitation instead of pretending it works.



\---



\# FINAL ACCEPTANCE CRITERIA



The project is complete only when:



\- All 6 pages exist.

\- All specified features work.

\- Client records persist.

\- Monthly invoice generation works without duplicates.

\- Full and partial payments work.

\- Expense management works.

\- Financial calculations are accurate.

\- Reports use actual data.

\- Settings persist.

\- All layouts are responsive.

\- No broken buttons or navigation.

\- No console errors during normal workflows.

\- The UI follows the defined design system.

\- No unnecessary features have been introduced.



\*\*Final deliverables:\*\*

1\. Complete source code.

2\. Organized HTML, CSS and JavaScript files.

3\. Working application.

4\. README documentation.

5\. Final QA report with PASS / FAIL for every module.



Do not declare completion until all acceptance criteria have been tested.



Build Cliento as a complete, lightweight and professional client and financial management application.

