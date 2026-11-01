/**
 * CLIENTO - MONTHLY PAYMENT MANAGEMENT MODULE
 * Handles monthly invoice generation (idempotent, batch), invoice listing,
 * status calculation, record payment with partial payment support, and transaction history.
 */

const Payments = {
  activeStatusFilter: 'all',
  activeMonthFilter: '', // '' means all months or selected month
  activeSearchQuery: '',

  init() {
    this.activeMonthFilter = Utils.getCurrentMonthString();
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Generate Payments button
    const genBtn = document.getElementById('generateInvoicesBtn');
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        this.openGenerateModal();
      });
    }

    // Generate Invoices form submission
    const genForm = document.getElementById('generateInvoicesForm');
    if (genForm) {
      genForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.executeGenerateInvoices();
      });
    }

    // Status filter
    const statusFilter = document.getElementById('paymentStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.activeStatusFilter = e.target.value;
        this.renderTable();
      });
    }

    // Month filter
    const monthFilter = document.getElementById('paymentMonthFilter');
    if (monthFilter) {
      monthFilter.addEventListener('change', (e) => {
        this.activeMonthFilter = e.target.value;
        this.render();
      });
    }

    // Search input
    const searchInput = document.getElementById('paymentSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.activeSearchQuery = e.target.value.trim().toLowerCase();
        this.renderTable();
      });
    }

    // Clear filters
    const clearBtn = document.getElementById('paymentClearFiltersBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.activeStatusFilter = 'all';
        this.activeMonthFilter = '';
        this.activeSearchQuery = '';
        if (statusFilter) statusFilter.value = 'all';
        if (monthFilter) monthFilter.value = '';
        if (searchInput) searchInput.value = '';
        this.render();
      });
    }

    // Record Payment form submission
    const recordForm = document.getElementById('recordPaymentForm');
    if (recordForm) {
      recordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleRecordPaymentSubmit();
      });
    }
  },

  render() {
    this.populateMonthFilter();
    this.renderMetrics();
    this.renderTable();
  },

  populateMonthFilter() {
    const monthSelect = document.getElementById('paymentMonthFilter');
    if (!monthSelect) return;

    const invoices = Storage.getInvoices();
    const uniqueMonths = Array.from(new Set(invoices.map((i) => i.billingMonth))).sort().reverse();
    const currentMonth = Utils.getCurrentMonthString();
    if (!uniqueMonths.includes(currentMonth)) {
      uniqueMonths.unshift(currentMonth);
    }

    const currentVal = this.activeMonthFilter;
    monthSelect.innerHTML = `
      <option value="">All Months</option>
      ${uniqueMonths.map((m) => `
        <option value="${m}" ${m === currentVal ? 'selected' : ''}>${Utils.formatMonth(m)}</option>
      `).join('')}
    `;
  },

  renderMetrics() {
    let invoices = Storage.getInvoices();
    if (this.activeMonthFilter) {
      invoices = invoices.filter((i) => i.billingMonth === this.activeMonthFilter);
    }

    let expectedPaise = 0;
    let receivedPaise = 0;

    invoices.forEach((inv) => {
      expectedPaise += Utils.toPaise(inv.amount);
      receivedPaise += Utils.toPaise(inv.paidAmount || 0);
    });

    const pendingPaise = Math.max(expectedPaise - receivedPaise, 0);

    const expEl = document.getElementById('paymentsMetricExpected');
    const recEl = document.getElementById('paymentsMetricReceived');
    const penEl = document.getElementById('paymentsMetricPending');

    if (expEl) expEl.textContent = Utils.formatCurrency(Utils.fromPaise(expectedPaise));
    if (recEl) recEl.textContent = Utils.formatCurrency(Utils.fromPaise(receivedPaise));
    if (penEl) penEl.textContent = Utils.formatCurrency(Utils.fromPaise(pendingPaise));
  },

  getFilteredInvoices() {
    let invoices = Storage.getInvoices();

    if (this.activeMonthFilter) {
      invoices = invoices.filter((i) => i.billingMonth === this.activeMonthFilter);
    }

    if (this.activeStatusFilter !== 'all') {
      if (this.activeStatusFilter === 'overdue') {
        invoices = invoices.filter((i) => i.status === 'overdue' || i.isOverdue);
      } else {
        invoices = invoices.filter((i) => i.status === this.activeStatusFilter);
      }
    }

    if (this.activeSearchQuery) {
      invoices = invoices.filter((i) => {
        const clientMatch = i.clientName.toLowerCase().includes(this.activeSearchQuery);
        const invMatch = i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(this.activeSearchQuery);
        const monthMatch = Utils.formatMonth(i.billingMonth).toLowerCase().includes(this.activeSearchQuery);
        return clientMatch || invMatch || monthMatch;
      });
    }

    return invoices;
  },

  renderTable() {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;

    const invoices = this.getFilteredInvoices();

    if (invoices.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <div class="empty-state-icon">
                <i data-lucide="receipt"></i>
              </div>
              <div class="empty-state-title">No invoices found</div>
              <div class="empty-state-text">
                ${this.activeSearchQuery || this.activeStatusFilter !== 'all' || this.activeMonthFilter
                  ? 'No records match your selected filters.'
                  : 'Click "Generate Monthly Payments" to bill all active clients for the month.'}
              </div>
              ${!this.activeSearchQuery && this.activeStatusFilter === 'all'
                ? '<button class="btn btn-primary btn-sm" onclick="Payments.openGenerateModal()"><i data-lucide="zap"></i> Generate Monthly Payments</button>'
                : ''}
            </div>
          </td>
        </tr>
      `;
      Utils.refreshIcons();
      return;
    }

    tbody.innerHTML = invoices.map((inv) => {
      const invPaise = Utils.toPaise(inv.amount);
      const paidPaise = Utils.toPaise(inv.paidAmount || 0);
      const remainingPaise = Math.max(invPaise - paidPaise, 0);
      const isFullyPaid = remainingPaise === 0;

      // Status badge
      let badgeHtml = '';
      if (inv.status === 'paid') {
        badgeHtml = `<span class="badge badge-success"><span class="badge-dot"></span>Paid</span>`;
      } else if (inv.status === 'partial') {
        badgeHtml = `<span class="badge badge-warning"><span class="badge-dot"></span>Partial ${inv.isOverdue ? '(Due)' : ''}</span>`;
      } else if (inv.status === 'overdue') {
        badgeHtml = `<span class="badge badge-danger"><span class="badge-dot"></span>Overdue</span>`;
      } else {
        badgeHtml = `<span class="badge badge-neutral"><span class="badge-dot"></span>Pending</span>`;
      }

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--color-text-primary);">${Utils.escapeHtml(inv.clientName)}</div>
            <div class="table-subtext">${Utils.escapeHtml(inv.invoiceNumber)}</div>
          </td>
          <td>${Utils.formatMonth(inv.billingMonth)}</td>
          <td class="tabular-nums" style="font-weight: 500;">${Utils.formatCurrency(inv.amount)}</td>
          <td class="tabular-nums" style="color: ${paidPaise > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)'}; font-weight: 500;">
            ${Utils.formatCurrency(Utils.fromPaise(paidPaise))}
          </td>
          <td class="tabular-nums" style="font-weight: 600; color: ${remainingPaise > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)'};">
            ${Utils.formatCurrency(Utils.fromPaise(remainingPaise))}
          </td>
          <td class="tabular-nums" style="${inv.isOverdue && !isFullyPaid ? 'color:var(--color-danger);font-weight:500;' : ''}">
            ${Utils.formatDate(inv.dueDate)}
          </td>
          <td>${badgeHtml}</td>
          <td class="actions-col">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:var(--space-2);">
              ${!isFullyPaid ? `
                <button class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${inv.id}')" title="Record Payment">
                  <i data-lucide="plus-circle"></i> Pay
                </button>
              ` : `
                <span class="badge badge-neutral" style="font-size:11px;">Settled</span>
              `}
              <button class="btn btn-secondary btn-icon btn-sm" onclick="Payments.viewInvoiceHistory('${inv.id}')" title="View History" aria-label="View invoice payment history">
                <i data-lucide="history"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    Utils.refreshIcons();
  },

  openGenerateModal() {
    const monthInput = document.getElementById('generateBillingMonth');
    const previewEl = document.getElementById('generatePreviewNotice');
    if (monthInput) {
      monthInput.value = Utils.getCurrentMonthString();
    }
    this.updateGeneratePreview();
    Utils.openModal('generateInvoicesModal');
  },

  updateGeneratePreview() {
    const monthInput = document.getElementById('generateBillingMonth');
    const previewEl = document.getElementById('generatePreviewNotice');
    if (!monthInput || !previewEl) return;

    const billingMonth = monthInput.value || Utils.getCurrentMonthString();
    const activeClients = Storage.getClients().filter((c) => c.status === 'active');
    const existingInvoices = Storage.getInvoices().filter((inv) => inv.billingMonth === billingMonth);
    const existingClientIds = new Set(existingInvoices.map((i) => i.clientId));

    const eligibleClients = activeClients.filter((c) => !existingClientIds.has(c.id));
    const skipCount = activeClients.length - eligibleClients.length;

    let totalAmountPaise = 0;
    eligibleClients.forEach((c) => {
      totalAmountPaise += Utils.toPaise(c.monthlyAmount);
    });

    previewEl.innerHTML = `
      <div style="background-color:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);font-size:13px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>Active Clients:</span>
          <strong>${activeClients.length}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>Invoices to Create:</span>
          <strong style="color:var(--color-success);">${eligibleClients.length} (${Utils.formatCurrency(Utils.fromPaise(totalAmountPaise))})</strong>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Already Generated (Skip):</span>
          <strong>${skipCount}</strong>
        </div>
      </div>
    `;
  },

  executeGenerateInvoices() {
    const monthInput = document.getElementById('generateBillingMonth');
    const billingMonth = monthInput ? monthInput.value : Utils.getCurrentMonthString();

    if (!billingMonth) {
      Utils.showToast('Please select a valid billing month', 'error');
      return;
    }

    const activeClients = Storage.getClients().filter((c) => c.status === 'active');
    if (activeClients.length === 0) {
      Utils.showToast('No active clients found. Add or activate clients first.', 'error');
      Utils.closeModal('generateInvoicesModal');
      return;
    }

    const existingInvoices = Storage.getInvoices().filter((inv) => inv.billingMonth === billingMonth);
    const existingClientIds = new Set(existingInvoices.map((i) => i.clientId));

    let createdCount = 0;
    let skippedCount = 0;

    activeClients.forEach((client) => {
      if (existingClientIds.has(client.id)) {
        skippedCount++;
      } else {
        const dueDate = Utils.calculateDueDate(billingMonth, client.dueDay);
        Storage.addInvoice({
          clientId: client.id,
          clientName: client.name,
          billingMonth,
          amount: client.monthlyAmount,
          dueDate
        });
        createdCount++;
      }
    });

    Utils.closeModal('generateInvoicesModal');

    if (createdCount > 0) {
      Utils.showToast(`Generation complete: ${createdCount} invoice(s) created, ${skippedCount} skipped (already billed).`, 'success');
    } else {
      Utils.showToast(`All ${skippedCount} active clients already have invoices for ${Utils.formatMonth(billingMonth)}.`, 'info');
    }

    this.activeMonthFilter = billingMonth;
    this.render();
    if (window.Dashboard) window.Dashboard.render();
    if (window.Reports) window.Reports.render();
  },

  openRecordPaymentModal(invoiceId) {
    const invoice = Storage.getInvoiceById(invoiceId);
    if (!invoice) return;

    const form = document.getElementById('recordPaymentForm');
    Utils.clearFieldErrors(form);
    form.reset();

    const invPaise = Utils.toPaise(invoice.amount);
    const paidPaise = Utils.toPaise(invoice.paidAmount || 0);
    const remainingPaise = Math.max(invPaise - paidPaise, 0);

    document.getElementById('recordPaymentInvoiceId').value = invoice.id;
    document.getElementById('recordPaymentClientName').textContent = invoice.clientName;
    document.getElementById('recordPaymentInvoiceNumber').textContent = invoice.invoiceNumber;
    document.getElementById('recordPaymentTotalAmount').textContent = Utils.formatCurrency(invoice.amount);
    document.getElementById('recordPaymentOutstanding').textContent = Utils.formatCurrency(Utils.fromPaise(remainingPaise));

    // Preset amount to full remaining balance for convenience
    const amountInput = document.getElementById('recordPaymentAmount');
    amountInput.value = Utils.fromPaise(remainingPaise);
    amountInput.max = Utils.fromPaise(remainingPaise);

    document.getElementById('recordPaymentDate').value = Utils.getTodayString();
    document.getElementById('recordPaymentMethod').value = 'Bank Transfer';

    Utils.openModal('recordPaymentModal');
  },

  handleRecordPaymentSubmit() {
    const form = document.getElementById('recordPaymentForm');
    Utils.clearFieldErrors(form);

    const invoiceId = document.getElementById('recordPaymentInvoiceId').value;
    const amountInput = document.getElementById('recordPaymentAmount');
    const dateInput = document.getElementById('recordPaymentDate');
    const methodInput = document.getElementById('recordPaymentMethod');
    const notesInput = document.getElementById('recordPaymentNotes');

    const invoice = Storage.getInvoiceById(invoiceId);
    if (!invoice) {
      Utils.showToast('Invoice not found', 'error');
      return;
    }

    const invPaise = Utils.toPaise(invoice.amount);
    const currentPaidPaise = Utils.toPaise(invoice.paidAmount || 0);
    const remainingPaise = invPaise - currentPaidPaise;

    const enteredAmount = parseFloat(amountInput.value);
    const enteredPaise = Utils.toPaise(enteredAmount);

    let isValid = true;
    if (isNaN(enteredAmount) || enteredPaise <= 0) {
      Utils.setFieldError(amountInput, 'Payment amount must be greater than zero');
      isValid = false;
    } else if (enteredPaise > remainingPaise) {
      Utils.setFieldError(amountInput, `Amount cannot exceed remaining balance of ${Utils.formatCurrency(Utils.fromPaise(remainingPaise))}`);
      isValid = false;
    }

    let paymentDate = dateInput.value;
    if (!paymentDate) {
      paymentDate = Utils.getTodayString();
      dateInput.value = paymentDate;
    }

    if (!isValid) return;

    try {
      Storage.recordPayment({
        invoiceId: invoice.id,
        amount: Utils.fromPaise(enteredPaise),
        paymentDate: paymentDate,
        paymentMethod: methodInput.value,
        notes: notesInput.value
      });

      Utils.showToast(`Payment of ${Utils.formatCurrency(Utils.fromPaise(enteredPaise))} recorded successfully`, 'success');
      Utils.closeModal('recordPaymentModal');
      this.render();
      if (window.Dashboard) window.Dashboard.render();
      if (window.Reports) window.Reports.render();
      if (window.Clients) window.Clients.render();
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  viewInvoiceHistory(invoiceId) {
    const invoice = Storage.getInvoiceById(invoiceId);
    if (!invoice) return;

    const payments = Storage.getPaymentsByInvoiceId(invoiceId);
    const invPaise = Utils.toPaise(invoice.amount);
    const paidPaise = Utils.toPaise(invoice.paidAmount || 0);
    const remainingPaise = Math.max(invPaise - paidPaise, 0);

    const container = document.getElementById('invoiceHistoryContent');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-4);padding-bottom:var(--space-3);border-bottom:1px solid var(--color-border);">
        <div>
          <h4 style="font-size:16px;font-weight:600;">${Utils.escapeHtml(invoice.clientName)}</h4>
          <div style="font-size:12px;color:var(--color-text-secondary);">${Utils.escapeHtml(invoice.invoiceNumber)} • Billing Month: ${Utils.formatMonth(invoice.billingMonth)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:var(--color-text-muted);">Invoice Amount</div>
          <div class="tabular-nums" style="font-size:16px;font-weight:600;">${Utils.formatCurrency(invoice.amount)}</div>
        </div>
      </div>

      <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-4);background:var(--color-bg-secondary);padding:var(--space-3);border-radius:var(--radius-md);">
        <div style="flex:1;">
          <div style="font-size:11px;color:var(--color-text-muted);text-transform:uppercase;">Total Paid</div>
          <div class="tabular-nums" style="font-size:15px;font-weight:600;color:var(--color-success);">${Utils.formatCurrency(Utils.fromPaise(paidPaise))}</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:11px;color:var(--color-text-muted);text-transform:uppercase;">Remaining Balance</div>
          <div class="tabular-nums" style="font-size:15px;font-weight:600;color:${remainingPaise > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)'};">${Utils.formatCurrency(Utils.fromPaise(remainingPaise))}</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:11px;color:var(--color-text-muted);text-transform:uppercase;">Due Date</div>
          <div class="tabular-nums" style="font-size:14px;font-weight:500;">${Utils.formatDate(invoice.dueDate)}</div>
        </div>
      </div>

      <div style="font-size:13px;font-weight:600;margin-bottom:var(--space-2);">Transactions (${payments.length})</div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${payments.length === 0 ? `
              <tr>
                <td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:var(--space-3);">No payments recorded yet for this invoice.</td>
              </tr>
            ` : payments.map((p) => `
              <tr>
                <td>${Utils.formatDate(p.paymentDate)}</td>
                <td class="tabular-nums" style="font-weight:600;color:var(--color-success);">${Utils.formatCurrency(p.amount)}</td>
                <td>${Utils.escapeHtml(p.paymentMethod)}</td>
                <td class="table-subtext">${p.notes ? Utils.escapeHtml(p.notes) : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    Utils.openModal('invoiceHistoryModal');
    Utils.refreshIcons();
  }
};

window.Payments = Payments;
