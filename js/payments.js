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

    // Client-based generator month change & selection controls
    const genMonthInput = document.getElementById('generateBillingMonth');
    if (genMonthInput) {
      genMonthInput.addEventListener('change', () => this.renderGenerateClientsList());
    }

    const selectAllBtn = document.getElementById('genSelectAllBtn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        const tbody = document.getElementById('generateClientsListBody');
        if (tbody) {
          tbody.querySelectorAll('.gen-client-checkbox:not(:disabled)').forEach((cb) => { cb.checked = true; });
          this.recalculateGenerateTotals();
        }
      });
    }

    const deselectAllBtn = document.getElementById('genDeselectAllBtn');
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', () => {
        const tbody = document.getElementById('generateClientsListBody');
        if (tbody) {
          tbody.querySelectorAll('.gen-client-checkbox').forEach((cb) => { cb.checked = false; });
          this.recalculateGenerateTotals();
        }
      });
    }

    const masterCheckbox = document.getElementById('genMasterCheckbox');
    if (masterCheckbox) {
      masterCheckbox.addEventListener('change', (e) => {
        const tbody = document.getElementById('generateClientsListBody');
        if (tbody) {
          tbody.querySelectorAll('.gen-client-checkbox:not(:disabled)').forEach((cb) => { cb.checked = e.target.checked; });
          this.recalculateGenerateTotals();
        }
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

    // Create Invoice form submission
    const createInvForm = document.getElementById('createInvoiceForm');
    if (createInvForm) {
      createInvForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateInvoiceSubmit();
      });
    }

    // Auto update amount and due date when client or month is changed
    const clientSelect = document.getElementById('createInvoiceClientId');
    const monthInput = document.getElementById('createInvoiceMonth');
    const serviceInput = document.getElementById('createInvoiceService');
    const amountInput = document.getElementById('createInvoiceAmount');

    if (clientSelect) {
      clientSelect.addEventListener('change', () => this.syncCreateInvoiceFields());
    }
    if (monthInput) {
      monthInput.addEventListener('change', () => this.syncCreateInvoiceFields());
    }
    if (serviceInput) {
      serviceInput.addEventListener('input', () => {
        delete serviceInput.dataset.autoFilled;
      });
    }
    if (amountInput) {
      amountInput.addEventListener('input', () => {
        delete amountInput.dataset.autoFilled;
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
        const serviceMatch = i.serviceName && i.serviceName.toLowerCase().includes(this.activeSearchQuery);
        const notesMatch = i.notes && i.notes.toLowerCase().includes(this.activeSearchQuery);
        const monthMatch = Utils.formatMonth(i.billingMonth).toLowerCase().includes(this.activeSearchQuery);
        return clientMatch || invMatch || serviceMatch || notesMatch || monthMatch;
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
                  : 'Create an invoice / add a charge for an individual client or run monthly recurring generation.'}
              </div>
              ${!this.activeSearchQuery && this.activeStatusFilter === 'all'
                ? `
                  <div style="display:flex;gap:var(--space-2);justify-content:center;flex-wrap:wrap;margin-top:var(--space-2);">
                    <button class="btn btn-primary btn-sm" onclick="Payments.openCreateInvoiceModal()"><i data-lucide="plus"></i> Add Charge / Invoice</button>
                    <button class="btn btn-secondary btn-sm" onclick="Payments.openGenerateModal()"><i data-lucide="zap"></i> Generate Monthly Payments</button>
                  </div>
                `
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
        <tr class="table-card-row">
          <td class="table-card-main">
            <div style="font-weight: 600; color: var(--color-text-primary); font-size: 14px;">${Utils.escapeHtml(inv.clientName)}</div>
            <div class="table-subtext">
              <span class="tabular-nums" style="font-weight:500;">${Utils.escapeHtml(inv.invoiceNumber)}</span>
              <span style="opacity:0.5;"> • </span>
              <span style="color:var(--color-text-secondary);">${Utils.escapeHtml(inv.serviceName || 'Service')}</span>
              ${inv.notes ? `<span title="${Utils.escapeHtml(inv.notes)}" style="cursor:help;margin-left:4px;display:inline-flex;align-items:center;vertical-align:-2px;color:var(--color-text-muted);" aria-label="Notes: ${Utils.escapeHtml(inv.notes)}"><i data-lucide="info" style="width:13px;height:13px;"></i></span>` : ''}
            </div>
          </td>
          <td data-label="Billing Month">${Utils.formatMonth(inv.billingMonth)}</td>
          <td data-label="Invoice Amount" class="tabular-nums" style="font-weight: 500;">${Utils.formatCurrency(inv.amount)}</td>
          <td data-label="Paid Amount" class="tabular-nums" style="color: ${paidPaise > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)'}; font-weight: 500;">
            ${Utils.formatCurrency(Utils.fromPaise(paidPaise))}
          </td>
          <td data-label="Remaining" class="tabular-nums" style="font-weight: 600; color: ${remainingPaise > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)'};">
            ${Utils.formatCurrency(Utils.fromPaise(remainingPaise))}
          </td>
          <td data-label="Due Date" class="tabular-nums" style="${inv.isOverdue && !isFullyPaid ? 'color:var(--color-danger);font-weight:500;' : ''}">
            ${Utils.formatDate(inv.dueDate)}
          </td>
          <td data-label="Status">${badgeHtml}</td>
          <td class="actions-col" data-label="Actions">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:var(--space-2);width:100%;">
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

  openCreateInvoiceModal(prefillClientId = null, defaultService = '') {
    const clients = Storage.getClients();
    if (clients.length === 0) {
      Utils.showToast('No clients found. Please add a client first.', 'info');
      if (window.Clients) Clients.openAddEditModal();
      return;
    }

    const form = document.getElementById('createInvoiceForm');
    if (form) {
      Utils.clearFieldErrors(form);
      form.reset();
    }

    const clientSelect = document.getElementById('createInvoiceClientId');
    const serviceInput = document.getElementById('createInvoiceService');
    const monthInput = document.getElementById('createInvoiceMonth');
    const chargeTypeSelect = document.getElementById('createInvoiceChargeType');

    if (monthInput) {
      monthInput.value = Utils.getCurrentMonthString();
    }

    if (clientSelect) {
      clientSelect.innerHTML = `
        <option value="">-- Choose Client --</option>
        ${clients.map((c) => `
          <option value="${c.id}" ${c.id === prefillClientId ? 'selected' : ''}>
            ${Utils.escapeHtml(c.name)} ${c.service ? `(${Utils.escapeHtml(c.service)})` : ''}
          </option>
        `).join('')}
      `;
    }

    this.syncCreateInvoiceFields();

    if (defaultService && serviceInput) {
      serviceInput.value = defaultService;
      delete serviceInput.dataset.autoFilled;
    }

    if (defaultService && chargeTypeSelect) {
      chargeTypeSelect.value = 'custom_changes';
    }

    Utils.openModal('createInvoiceModal');
  },

  syncCreateInvoiceFields() {
    const clientSelect = document.getElementById('createInvoiceClientId');
    const serviceInput = document.getElementById('createInvoiceService');
    const monthInput = document.getElementById('createInvoiceMonth');
    const amountInput = document.getElementById('createInvoiceAmount');
    const dueDateInput = document.getElementById('createInvoiceDueDate');

    if (!clientSelect || !monthInput || !amountInput || !dueDateInput) return;

    const clientId = clientSelect.value;
    const month = monthInput.value || Utils.getCurrentMonthString();

    if (!clientId) {
      if (serviceInput) serviceInput.value = '';
      amountInput.value = '';
      dueDateInput.value = '';
      return;
    }

    const client = Storage.getClientById(clientId);
    if (client) {
      if (serviceInput && (!serviceInput.value || serviceInput.dataset.autoFilled === 'true')) {
        serviceInput.value = client.service || 'Monthly Retainer';
        serviceInput.dataset.autoFilled = 'true';
      }
      if (!amountInput.value || amountInput.dataset.autoFilled === 'true') {
        amountInput.value = (client.monthlyAmount && client.monthlyAmount > 0) ? client.monthlyAmount : '';
        amountInput.dataset.autoFilled = 'true';
      }
      dueDateInput.value = Utils.calculateDueDate(month, client.dueDay || 5);
    }
  },

  async handleCreateInvoiceSubmit() {
    const form = document.getElementById('createInvoiceForm');
    Utils.clearFieldErrors(form);

    const clientSelect = document.getElementById('createInvoiceClientId');
    const serviceInput = document.getElementById('createInvoiceService');
    const monthInput = document.getElementById('createInvoiceMonth');
    const amountInput = document.getElementById('createInvoiceAmount');
    const dueDateInput = document.getElementById('createInvoiceDueDate');
    const chargeTypeSelect = document.getElementById('createInvoiceChargeType');
    const notesInput = document.getElementById('createInvoiceNotes');

    let isValid = true;
    const clientId = clientSelect.value;
    if (!clientId) {
      Utils.setFieldError(clientSelect, 'Please select a client');
      isValid = false;
    }

    const serviceName = serviceInput ? serviceInput.value.trim() : '';
    if (!serviceName) {
      Utils.setFieldError(serviceInput, 'Please specify the service name or charge description');
      isValid = false;
    }

    const billingMonth = monthInput.value;
    if (!billingMonth) {
      Utils.setFieldError(monthInput, 'Billing month is required');
      isValid = false;
    }

    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
      Utils.setFieldError(amountInput, 'Charge amount must be greater than zero');
      isValid = false;
    }

    const dueDate = dueDateInput.value || Utils.calculateDueDate(billingMonth, 5);

    if (!isValid) return;

    const client = Storage.getClientById(clientId);
    if (!client) {
      Utils.showToast('Selected client not found', 'error');
      return;
    }

    // Check duplicate invoice for same client and month
    const existing = Storage.getInvoices().find(
      (inv) => inv.clientId === clientId && inv.billingMonth === billingMonth
    );

    if (existing) {
      const proceed = await Utils.confirm({
        title: 'Add Additional Invoice / Charge?',
        message: `An invoice (${existing.invoiceNumber} • ${existing.serviceName || 'Service'}) already exists for ${client.name} in ${Utils.formatMonth(billingMonth)}. Do you want to add this additional charge (${serviceName}) as a new invoice?`,
        confirmText: 'Create Additional Invoice',
        confirmDanger: false
      });
      if (!proceed) return;
    }

    const newInvoice = Storage.addInvoice({
      clientId: client.id,
      clientName: client.name,
      serviceName,
      chargeType: chargeTypeSelect ? chargeTypeSelect.value : 'custom_changes',
      notes: notesInput ? notesInput.value.trim() : '',
      billingMonth,
      amount,
      dueDate
    });

    Utils.showToast(`Invoice ${newInvoice.invoiceNumber} for ${client.name} (${serviceName}) created`, 'success');
    Utils.closeModal('createInvoiceModal');
    this.activeMonthFilter = billingMonth;
    this.render();
    if (window.Dashboard) window.Dashboard.render();
    if (window.Reports) window.Reports.render();
    if (window.Clients) Clients.render();
  },

  openGenerateModal() {
    const monthInput = document.getElementById('generateBillingMonth');
    if (monthInput) {
      monthInput.value = this.activeMonthFilter || Utils.getCurrentMonthString();
    }
    this.renderGenerateClientsList();
    Utils.openModal('generateInvoicesModal');
  },

  renderGenerateClientsList() {
    const monthInput = document.getElementById('generateBillingMonth');
    const tbody = document.getElementById('generateClientsListBody');
    if (!tbody) return;

    const billingMonth = (monthInput && monthInput.value) || Utils.getCurrentMonthString();
    const clients = Storage.getClients();

    if (clients.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">
            No clients registered yet. Please add a client first.
          </td>
        </tr>
      `;
      this.recalculateGenerateTotals();
      return;
    }

    const existingInvoices = Storage.getInvoices().filter((inv) => inv.billingMonth === billingMonth);
    const existingMap = new Map();
    existingInvoices.forEach((inv) => existingMap.set(inv.clientId, inv));

    tbody.innerHTML = clients.map((c) => {
      const existing = existingMap.get(c.id);
      const isAlreadyBilled = !!existing;
      const isActive = c.status === 'active';
      const hasRetainer = c.monthlyAmount && c.monthlyAmount > 0;
      const canBill = isActive && hasRetainer && !isAlreadyBilled;
      const dueDate = Utils.calculateDueDate(billingMonth, c.dueDay || 5);

      let statusBadge = '';
      if (isAlreadyBilled) {
        statusBadge = `<span class="badge badge-neutral"><span class="badge-dot"></span>Already Billed (${existing.invoiceNumber})</span>`;
      } else if (!isActive) {
        statusBadge = `<span class="badge badge-warning"><span class="badge-dot"></span>Inactive</span>`;
      } else if (!hasRetainer) {
        statusBadge = `<span class="badge badge-neutral" title="No recurring monthly retainer configured"><span class="badge-dot"></span>No Retainer (Ad-hoc)</span>`;
      } else {
        statusBadge = `<span class="badge badge-success"><span class="badge-dot"></span>Ready to Bill</span>`;
      }

      return `
        <tr style="${!canBill ? 'opacity:0.6;' : ''}">
          <td style="text-align:center;">
            <input type="checkbox" 
                   class="gen-client-checkbox" 
                   data-client-id="${c.id}" 
                   data-amount="${c.monthlyAmount || 0}"
                   data-due-date="${dueDate}"
                   ${!canBill ? 'disabled' : ''} 
                   ${canBill ? 'checked' : ''}>
          </td>
          <td style="font-weight:600;">${Utils.escapeHtml(c.name)}</td>
          <td>
            <div style="font-weight:500;">${Utils.escapeHtml(c.service || 'Service Retainer')}</div>
            <div class="table-subtext">Monthly Recurring</div>
          </td>
          <td class="tabular-nums" style="font-weight:600;">${hasRetainer ? Utils.formatCurrency(c.monthlyAmount) : '<span class="table-subtext">—</span>'}</td>
          <td class="tabular-nums">${Utils.formatDate(dueDate)}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');

    // Attach listener to every checkbox
    tbody.querySelectorAll('.gen-client-checkbox').forEach((cb) => {
      cb.addEventListener('change', () => this.recalculateGenerateTotals());
    });

    this.recalculateGenerateTotals();
    Utils.refreshIcons();
  },

  recalculateGenerateTotals() {
    const tbody = document.getElementById('generateClientsListBody');
    const countEl = document.getElementById('genSelectedCount');
    const totalEl = document.getElementById('genSelectedTotal');
    const submitBtn = document.getElementById('genSubmitBtn');
    const masterCb = document.getElementById('genMasterCheckbox');

    if (!tbody) return;

    const checkboxes = tbody.querySelectorAll('.gen-client-checkbox:not(:disabled)');
    let selectedCount = 0;
    let totalPaise = 0;

    checkboxes.forEach((cb) => {
      if (cb.checked) {
        selectedCount++;
        totalPaise += Utils.toPaise(cb.getAttribute('data-amount') || 0);
      }
    });

    if (countEl) countEl.textContent = `${selectedCount} of ${checkboxes.length} client(s)`;
    if (totalEl) totalEl.textContent = Utils.formatCurrency(Utils.fromPaise(totalPaise));

    if (masterCb) {
      masterCb.checked = checkboxes.length > 0 && selectedCount === checkboxes.length;
      masterCb.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;
    }

    if (submitBtn) {
      if (selectedCount === 0) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i data-lucide="zap"></i> Select Clients to Bill`;
      } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i data-lucide="zap"></i> Generate ${selectedCount} Invoice(s) (${Utils.formatCurrency(Utils.fromPaise(totalPaise))})`;
      }
    }
  },

  executeGenerateInvoices() {
    const monthInput = document.getElementById('generateBillingMonth');
    const billingMonth = (monthInput && monthInput.value) || Utils.getCurrentMonthString();

    const tbody = document.getElementById('generateClientsListBody');
    if (!tbody) return;

    const checkedBoxes = tbody.querySelectorAll('.gen-client-checkbox:checked:not(:disabled)');
    if (checkedBoxes.length === 0) {
      Utils.showToast('Please select at least one client to generate invoices for', 'info');
      return;
    }

    let createdCount = 0;
    let totalPaise = 0;

    checkedBoxes.forEach((cb) => {
      const clientId = cb.getAttribute('data-client-id');
      const amount = parseFloat(cb.getAttribute('data-amount')) || 0;
      const dueDate = cb.getAttribute('data-due-date') || Utils.calculateDueDate(billingMonth, 5);
      const client = Storage.getClientById(clientId);

      if (client) {
        Storage.addInvoice({
          clientId: client.id,
          clientName: client.name,
          serviceName: client.service || 'Monthly Retainer',
          chargeType: 'retainer',
          notes: `Monthly Retainer for ${Utils.formatMonth(billingMonth)}`,
          billingMonth,
          amount,
          dueDate
        });
        createdCount++;
        totalPaise += Utils.toPaise(amount);
      }
    });

    Utils.closeModal('generateInvoicesModal');
    Utils.showToast(`Generated ${createdCount} invoice(s) totaling ${Utils.formatCurrency(Utils.fromPaise(totalPaise))} for ${Utils.formatMonth(billingMonth)}`, 'success');

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
