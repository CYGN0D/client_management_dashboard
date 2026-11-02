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

    // Charge mode segmented buttons (One-Time vs Retainer)
    const modeOneTimeBtn = document.getElementById('chargeModeOneTimeBtn');
    const modeRetainerBtn = document.getElementById('chargeModeRetainerBtn');
    if (modeOneTimeBtn) {
      modeOneTimeBtn.addEventListener('click', () => this.setChargeMode('one_time'));
    }
    if (modeRetainerBtn) {
      modeRetainerBtn.addEventListener('click', () => this.setChargeMode('retainer'));
    }

    const genStartingInvCb = document.getElementById('createInvoiceGenStartingInv');
    if (genStartingInvCb) {
      genStartingInvCb.addEventListener('change', () => this.updateSubmitButtonLabel());
    }

    // Auto update amount and due date when client or month is changed
    const clientSelect = document.getElementById('createInvoiceClientId');
    const monthInput = document.getElementById('createInvoiceMonth');
    const serviceInput = document.getElementById('createInvoiceService');
    const amountInput = document.getElementById('createInvoiceAmount');
    const retAmountInput = document.getElementById('createInvoiceRetainerAmount');
    const retServiceInput = document.getElementById('createInvoiceRetainerService');

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
    if (retAmountInput) {
      retAmountInput.addEventListener('input', () => {
        delete retAmountInput.dataset.autoFilled;
      });
    }
    if (retServiceInput) {
      retServiceInput.addEventListener('input', () => {
        delete retServiceInput.dataset.autoFilled;
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

      // Rich data popup for extra details inspection
      const invPopupHtml = `
        <div class="table-data-popup-header">
          <span class="table-data-popup-title">${Utils.escapeHtml(inv.invoiceNumber)}</span>
          <span class="table-data-popup-badge">${inv.status.toUpperCase()}</span>
        </div>
        <div class="table-data-popup-row"><span>Client</span><span>${Utils.escapeHtml(inv.clientName)}</span></div>
        <div class="table-data-popup-row"><span>Service</span><span>${Utils.escapeHtml(inv.serviceName || 'Service')}</span></div>
        <div class="table-data-popup-row"><span>Billing Month</span><span>${Utils.formatMonth(inv.billingMonth)}</span></div>
        <div class="table-data-popup-row"><span>Due Date</span><span>${Utils.formatDate(inv.dueDate)}</span></div>
        <div class="table-data-popup-row"><span>Total Amount</span><span>${Utils.formatCurrency(inv.amount)}</span></div>
        <div class="table-data-popup-row"><span>Paid Amount</span><span>${Utils.formatCurrency(inv.paidAmount || 0)}</span></div>
        <div class="table-data-popup-row"><span>Remaining Due</span><span>${Utils.formatCurrency(Utils.fromPaise(remainingPaise))}</span></div>
        ${inv.notes ? `<div class="table-data-popup-row"><span>Notes</span><span>${Utils.escapeHtml(inv.notes)}</span></div>` : ''}
      `.trim();

      return `
        <tr class="table-card-row">
          <td class="table-card-main">
            <div class="table-single-line" data-table-popup="${Utils.escapeHtml(invPopupHtml)}" title="${Utils.escapeHtml(inv.clientName)} • ${Utils.escapeHtml(inv.invoiceNumber)} (${Utils.escapeHtml(inv.serviceName || 'Service')})">
              <span class="data-link" style="font-weight: 600; color: var(--color-text-primary); font-size: 13.5px; cursor: pointer;" onclick="Clients.viewClientDetails('${inv.clientId}')" title="View client dossier">${Utils.escapeHtml(inv.clientName)}</span>
              <span class="table-bullet">•</span>
              <span class="tabular-nums data-code-link" style="cursor:pointer;" onclick="Payments.viewInvoiceHistory('${inv.id}')" title="View invoice payment history">${Utils.escapeHtml(inv.invoiceNumber)}</span>
              <span class="table-secondary-text" style="max-width:140px;">(${Utils.escapeHtml(inv.serviceName || 'Service')})</span>
            </div>
          </td>
          <td data-label="Billing Month" style="white-space:nowrap;">${Utils.formatMonth(inv.billingMonth)}</td>
          <td data-label="Invoice Amount" class="tabular-nums" style="font-weight: 500; white-space:nowrap;">${Utils.formatCurrency(inv.amount)}</td>
          <td data-label="Paid Amount" class="tabular-nums" style="color: ${paidPaise > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)'}; font-weight: 500; white-space:nowrap;">
            ${Utils.formatCurrency(Utils.fromPaise(paidPaise))}
          </td>
          <td data-label="Remaining" class="tabular-nums" style="font-weight: 600; color: ${remainingPaise > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)'}; white-space:nowrap;">
            ${Utils.formatCurrency(Utils.fromPaise(remainingPaise))}
          </td>
          <td data-label="Due Date" class="tabular-nums" style="${inv.isOverdue && !isFullyPaid ? 'color:var(--color-danger);font-weight:500;' : ''} white-space:nowrap;">
            ${Utils.formatDate(inv.dueDate)}
          </td>
          <td data-label="Status">${badgeHtml}</td>
          <td class="actions-col" data-label="Actions">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;width:100%;">
              ${!isFullyPaid ? `
                <button class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${inv.id}')" title="Record Payment" style="padding:2px 10px;height:28px;font-size:12px;display:inline-flex;align-items:center;gap:4px;">
                  <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> Pay
                </button>
              ` : `
                <span class="badge badge-neutral" style="font-size:11px;">Settled</span>
              `}
              <div class="dropdown">
                <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'payActionMenu_${inv.id}')" title="More options" aria-label="More options" style="width:28px;height:28px;">
                  <i data-lucide="more-vertical" style="width:14px;height:14px;"></i>
                </button>
                <div id="payActionMenu_${inv.id}" class="dropdown-menu">
                  <button type="button" class="dropdown-item" onclick="Payments.viewInvoiceHistory('${inv.id}')">
                    <i data-lucide="history"></i> View History
                  </button>
                  <div class="dropdown-divider"></div>
                  <button type="button" class="dropdown-item text-danger" onclick="Payments.confirmDeleteInvoice('${inv.id}')">
                    <i data-lucide="trash-2"></i> Delete Invoice
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    Utils.refreshIcons();
  },

  setChargeMode(mode) {
    this.activeChargeMode = mode === 'retainer' ? 'retainer' : 'one_time';
    const isRetainer = this.activeChargeMode === 'retainer';

    const oneTimeBtn = document.getElementById('chargeModeOneTimeBtn');
    const retainerBtn = document.getElementById('chargeModeRetainerBtn');
    const oneTimeFields = document.getElementById('chargeModeOneTimeFields');
    const retainerFields = document.getElementById('chargeModeRetainerFields');

    if (oneTimeBtn) {
      oneTimeBtn.classList.toggle('active', !isRetainer);
      oneTimeBtn.setAttribute('aria-selected', !isRetainer ? 'true' : 'false');
    }
    if (retainerBtn) {
      retainerBtn.classList.toggle('active', isRetainer);
      retainerBtn.setAttribute('aria-selected', isRetainer ? 'true' : 'false');
    }

    if (oneTimeFields) oneTimeFields.style.display = !isRetainer ? 'grid' : 'none';
    if (retainerFields) retainerFields.style.display = isRetainer ? 'grid' : 'none';

    this.updateSubmitButtonLabel();
    this.syncCreateInvoiceFields();
    Utils.refreshIcons();
  },

  updateSubmitButtonLabel() {
    const submitBtn = document.getElementById('createInvoiceSubmitBtn');
    if (!submitBtn) return;
    if (this.activeChargeMode === 'retainer') {
      const genStartingCb = document.getElementById('createInvoiceGenStartingInv');
      if (genStartingCb && genStartingCb.checked) {
        submitBtn.innerHTML = '<i data-lucide="check"></i> Save Retainer & Generate Invoice';
      } else {
        submitBtn.innerHTML = '<i data-lucide="check"></i> Save Retainer Plan';
      }
    } else {
      submitBtn.innerHTML = '<i data-lucide="check"></i> Create Invoice';
    }
    Utils.refreshIcons();
  },

  openCreateInvoiceModal(prefillClientId = null, defaultService = '', defaultMode = null) {
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

    // Determine initial charge mode
    let targetMode = defaultMode;
    if (!targetMode) {
      if (prefillClientId) {
        const client = Storage.getClientById(prefillClientId);
        // If client already has a retainer, default to one_time for additional charges
        targetMode = 'one_time';
      } else {
        targetMode = 'one_time';
      }
    }

    this.setChargeMode(targetMode);

    if (defaultService && serviceInput) {
      serviceInput.value = defaultService;
      delete serviceInput.dataset.autoFilled;
    }

    Utils.openModal('createInvoiceModal');
  },

  syncCreateInvoiceFields() {
    const clientSelect = document.getElementById('createInvoiceClientId');
    if (!clientSelect) return;

    const clientId = clientSelect.value;
    const client = clientId ? Storage.getClientById(clientId) : null;

    const monthInput = document.getElementById('createInvoiceMonth');
    const serviceInput = document.getElementById('createInvoiceService');
    const amountInput = document.getElementById('createInvoiceAmount');
    const dueDateInput = document.getElementById('createInvoiceDueDate');

    const retService = document.getElementById('createInvoiceRetainerService');
    const retAmount = document.getElementById('createInvoiceRetainerAmount');
    const retDueDay = document.getElementById('createInvoiceDueDay');
    const retMonth = document.getElementById('createInvoiceRetainerMonth');

    const curMonth = Utils.getCurrentMonthString();

    if (!client) {
      if (serviceInput) serviceInput.value = '';
      if (amountInput) amountInput.value = '';
      if (dueDateInput) dueDateInput.value = '';
      if (retService) retService.value = '';
      if (retAmount) retAmount.value = '';
      if (retMonth) retMonth.removeAttribute('min');
      return;
    }

    const clientJoinMonth = (client.joiningDate || '').substring(0, 7);

    // Sync One-Time fields
    if (monthInput && !monthInput.value) {
      monthInput.value = curMonth;
    }
    // Leave serviceInput clean so it doesn't force client's retainer service name into one-time custom changes
    if (serviceInput && serviceInput.dataset.autoFilled === 'true') {
      serviceInput.value = '';
      delete serviceInput.dataset.autoFilled;
    }
    if (dueDateInput && (!dueDateInput.value || dueDateInput.dataset.autoFilled === 'true')) {
      const rawDue = (client.monthlyAmount && client.monthlyAmount > 0 && client.dueDay)
        ? Utils.calculateDueDate(monthInput.value || curMonth, client.dueDay)
        : Utils.getTodayString();
      dueDateInput.value = Utils.isoToDmy(rawDue);
      dueDateInput.dataset.autoFilled = 'true';
    }

    // Sync Retainer fields
    if (retService && (!retService.value || retService.dataset.autoFilled === 'true')) {
      retService.value = client.service || 'Monthly Retainer';
      retService.dataset.autoFilled = 'true';
    }
    if (retAmount && (!retAmount.value || retAmount.dataset.autoFilled === 'true')) {
      retAmount.value = (client.monthlyAmount && client.monthlyAmount > 0) ? client.monthlyAmount : '';
      retAmount.dataset.autoFilled = 'true';
    }
    if (retDueDay) {
      retDueDay.value = String(client.dueDay || 5);
    }
    if (retMonth) {
      if (clientJoinMonth) {
        retMonth.min = clientJoinMonth;
        if (!retMonth.value || retMonth.value < clientJoinMonth) {
          retMonth.value = curMonth >= clientJoinMonth ? curMonth : clientJoinMonth;
        }
      } else if (!retMonth.value) {
        retMonth.value = curMonth;
      }
    }

    // Retainer status banner handling
    const retainerStatusBox = document.getElementById('createInvoiceRetainerStatusBox');
    const retainerStatusDesc = document.getElementById('createInvoiceRetainerStatusDesc');
    const retainerPauseBtn = document.getElementById('createInvoiceRetainerPauseBtn');
    const retainerDeleteBtn = document.getElementById('createInvoiceRetainerDeleteBtn');

    if (retainerStatusBox) {
      const hasRetainer = Boolean(client.monthlyAmount && client.monthlyAmount > 0);
      if (hasRetainer) {
        retainerStatusBox.style.display = 'block';
        const isPaused = client.retainerStatus === 'paused';
        if (retainerStatusDesc) {
          retainerStatusDesc.innerHTML = `
            <span>${Utils.formatCurrency(client.monthlyAmount)} / mo</span>
            <span style="opacity:0.4;">•</span>
            <span>Due Day ${client.dueDay || 5}</span>
            ${isPaused 
              ? `<span class="badge badge-warning" style="font-size:11px;padding:2px 6px;"><span class="badge-dot"></span>Paused</span>` 
              : `<span class="badge badge-success" style="font-size:11px;padding:2px 6px;"><span class="badge-dot"></span>Active</span>`}
          `;
        }
        if (retainerPauseBtn) {
          retainerPauseBtn.innerHTML = isPaused
            ? `<i data-lucide="play" style="width:12px;height:12px;"></i> Resume Retainer`
            : `<i data-lucide="pause" style="width:12px;height:12px;"></i> Pause Retainer`;
          retainerPauseBtn.onclick = () => this.toggleClientRetainer(client.id);
        }
        if (retainerDeleteBtn) {
          retainerDeleteBtn.onclick = () => this.deleteClientRetainer(client.id);
        }
        Utils.refreshIcons();
      } else {
        retainerStatusBox.style.display = 'none';
      }
    }
  },

  async handleCreateInvoiceSubmit() {
    const form = document.getElementById('createInvoiceForm');
    Utils.clearFieldErrors(form);

    const clientSelect = document.getElementById('createInvoiceClientId');
    const clientId = clientSelect ? clientSelect.value : '';

    if (!clientId) {
      Utils.setFieldError(clientSelect, 'Please select a client');
      return;
    }

    const client = Storage.getClientById(clientId);
    if (!client) {
      Utils.showToast('Selected client not found', 'error');
      return;
    }

    const clientJoinMonth = (client.joiningDate || '').substring(0, 7);

    // ==========================================================
    // MODE 1: SETUP MONTHLY RETAINER (RECURRING)
    // ==========================================================
    if (this.activeChargeMode === 'retainer') {
      const retServiceInput = document.getElementById('createInvoiceRetainerService');
      const retAmountInput = document.getElementById('createInvoiceRetainerAmount');
      const retDueDayInput = document.getElementById('createInvoiceDueDay');
      const retMonthInput = document.getElementById('createInvoiceRetainerMonth');
      const genStartingCb = document.getElementById('createInvoiceGenStartingInv');
      const retNotesInput = document.getElementById('createInvoiceRetainerNotes');

      let isValid = true;
      const retainerService = retServiceInput ? retServiceInput.value.trim() : '';
      if (!retainerService) {
        Utils.setFieldError(retServiceInput, 'Please specify the retainer service / package name');
        isValid = false;
      }

      const retainerAmount = parseFloat(retAmountInput.value);
      if (isNaN(retainerAmount) || retainerAmount <= 0) {
        Utils.setFieldError(retAmountInput, 'Monthly retainer amount must be greater than zero');
        isValid = false;
      }

      const dueDay = parseInt(retDueDayInput.value, 10) || 5;
      const startingMonth = retMonthInput.value;
      if (!startingMonth) {
        Utils.setFieldError(retMonthInput, 'Starting billing month is required');
        isValid = false;
      } else if (clientJoinMonth && startingMonth < clientJoinMonth) {
        Utils.setFieldError(
          retMonthInput,
          `Starting billing month cannot be earlier than client joining date (${Utils.formatDate(client.joiningDate)})`
        );
        isValid = false;
      }

      if (!isValid) return;

      // 1. Update client profile with recurring retainer details
      Storage.updateClient(client.id, {
        monthlyAmount: retainerAmount,
        dueDay,
        service: retainerService,
        retainerStatus: 'active'
      });

      // 2. Generate starting month invoice if checked
      const shouldGenerateInvoice = genStartingCb ? genStartingCb.checked : true;
      if (shouldGenerateInvoice) {
        let dueDate = Utils.calculateDueDate(startingMonth, dueDay);
        if (startingMonth === clientJoinMonth && client.joiningDate && dueDate < client.joiningDate) {
          dueDate = client.joiningDate;
        }

        // Check if invoice already exists for same client and month
        const existing = Storage.getInvoices().find(
          (inv) => inv.clientId === client.id && inv.billingMonth === startingMonth
        );

        if (existing) {
          const proceed = await Utils.confirm({
            title: 'Invoice Already Exists for this Month',
            message: `An invoice (${existing.invoiceNumber} • ${existing.serviceName || 'Service'}) already exists for ${client.name} in ${Utils.formatMonth(startingMonth)}. Do you want to create an additional retainer invoice for this month?`,
            confirmText: 'Create Additional Invoice',
            confirmDanger: false
          });
          if (!proceed) {
            Utils.showToast(`Monthly retainer plan of ${Utils.formatCurrency(retainerAmount)} saved for ${client.name}`, 'success');
            Utils.closeModal('createInvoiceModal');
            this.render();
            if (window.Dashboard) window.Dashboard.render();
            if (window.Clients) {
              Clients.render();
              if (Clients.activeDetailClientId === client.id) Clients.renderClientDetailPage(client.id);
            }
            return;
          }
        }

        const notes = retNotesInput ? retNotesInput.value.trim() : '';
        Storage.addInvoice({
          clientId: client.id,
          clientName: client.name,
          serviceName: retainerService,
          chargeType: 'retainer',
          notes: notes || `Monthly Retainer for ${Utils.formatMonth(startingMonth)}`,
          billingMonth: startingMonth,
          amount: retainerAmount,
          dueDate
        });

        Utils.showToast(`Monthly retainer of ${Utils.formatCurrency(retainerAmount)} set & ${Utils.formatMonth(startingMonth)} invoice generated!`, 'success');
      } else {
        Utils.showToast(`Monthly retainer plan of ${Utils.formatCurrency(retainerAmount)} saved for ${client.name}`, 'success');
      }

      Utils.closeModal('createInvoiceModal');
      this.activeMonthFilter = startingMonth;
      this.render();
      if (window.Dashboard) window.Dashboard.render();
      if (window.Reports) window.Reports.render();
      if (window.Clients) {
        Clients.render();
        if (Clients.activeDetailClientId === client.id) Clients.renderClientDetailPage(client.id);
      }
      return;
    }

    // ==========================================================
    // MODE 2: ONE-TIME / EXTRA CHANGES
    // ==========================================================
    const serviceInput = document.getElementById('createInvoiceService');
    const monthInput = document.getElementById('createInvoiceMonth');
    const amountInput = document.getElementById('createInvoiceAmount');
    const dueDateInput = document.getElementById('createInvoiceDueDate');
    const categorySelect = document.getElementById('createInvoiceCategory');
    const notesInput = document.getElementById('createInvoiceNotes');

    let isValid = true;
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

    const rawDueDate = dueDateInput.value.trim();
    const dueDate = Utils.dmyToIso(rawDueDate) || rawDueDate || Utils.calculateDueDate(billingMonth, 5);

    if (!isValid) return;

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

    const chargeCategory = categorySelect ? categorySelect.value : 'custom_changes';
    const newInvoice = Storage.addInvoice({
      clientId: client.id,
      clientName: client.name,
      serviceName,
      chargeType: chargeCategory,
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
    if (window.Clients) {
      Clients.render();
      if (Clients.activeDetailClientId === client.id) Clients.renderClientDetailPage(client.id);
    }
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
      const isRetainerPaused = hasRetainer && c.retainerStatus === 'paused';
      const clientJoinMonth = (c.joiningDate || '').substring(0, 7);
      const isPriorToJoining = !!(clientJoinMonth && billingMonth < clientJoinMonth);
      const canBill = isActive && hasRetainer && !isRetainerPaused && !isAlreadyBilled && !isPriorToJoining;
      let dueDate = Utils.calculateDueDate(billingMonth, c.dueDay || 5);
      if (c.joiningDate && dueDate < c.joiningDate) {
        dueDate = c.joiningDate;
      }

      let statusBadge = '';
      if (isAlreadyBilled) {
        statusBadge = `<span class="badge badge-neutral"><span class="badge-dot"></span>Already Billed (${existing.invoiceNumber})</span>`;
      } else if (!isActive) {
        statusBadge = `<span class="badge badge-warning"><span class="badge-dot"></span>Inactive</span>`;
      } else if (isRetainerPaused) {
        statusBadge = `
          <div style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span class="badge badge-warning" title="Monthly retainer is paused"><span class="badge-dot"></span>Retainer Paused</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Payments.quickToggleRetainer('${c.id}', true)" style="padding:2px 8px;font-size:11px;height:24px;">Resume</button>
          </div>
        `;
      } else if (isPriorToJoining) {
        const formattedJoin = c.joiningDate ? Utils.formatDate(c.joiningDate) : 'Joining Date';
        statusBadge = `<span class="badge badge-neutral" title="Client joined on ${formattedJoin}"><span class="badge-dot"></span>Not Yet Joined (${formattedJoin})</span>`;
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
          <td style="font-weight:600;"><div class="table-single-line" title="${Utils.escapeHtml(c.name)}">${Utils.escapeHtml(c.name)}</div></td>
          <td>
            <div class="table-single-line" title="${Utils.escapeHtml(c.service || 'Service Retainer')} • Recurring">
              <span style="font-weight:500;">${Utils.escapeHtml(c.service || 'Service Retainer')}</span>
              <span class="table-bullet">•</span>
              <span class="table-secondary-text">Recurring</span>
            </div>
          </td>
          <td class="tabular-nums" style="font-weight:600;">${hasRetainer ? Utils.formatCurrency(c.monthlyAmount) : '<span class="table-subtext">—</span>'}</td>
          <td class="tabular-nums">${isPriorToJoining ? '<span class="table-subtext">—</span>' : Utils.formatDate(dueDate)}</td>
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
        submitBtn.innerHTML = `<i data-lucide="zap"></i> Generate (${selectedCount}) · ${Utils.formatCurrency(Utils.fromPaise(totalPaise))}`;
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
        const clientJoinMonth = (client.joiningDate || '').substring(0, 7);
        if (clientJoinMonth && billingMonth < clientJoinMonth) {
          return;
        }
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
          <h4 class="data-link" onclick="Utils.closeModal('invoiceHistoryModal'); Clients.viewClientDetails('${invoice.clientId}');" style="font-size:16px;font-weight:600;cursor:pointer;" title="View client profile and dossier">
            ${Utils.escapeHtml(invoice.clientName)}
            <i data-lucide="external-link" style="width:14px;height:14px;margin-left:4px;opacity:0.6;"></i>
          </h4>
          <div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">
            <span class="ledger-badge-code">${Utils.escapeHtml(invoice.invoiceNumber)}</span> • Billing Month: ${Utils.formatMonth(invoice.billingMonth)}
            ${invoice.serviceName ? ` • ${Utils.escapeHtml(invoice.serviceName)}` : ''}
          </div>
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
              <th style="text-align:right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${payments.length === 0 ? `
              <tr>
                <td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:var(--space-3);">No payments recorded yet for this invoice.</td>
              </tr>
            ` : payments.map((p) => `
              <tr>
                <td>${Utils.formatDate(p.paymentDate)}</td>
                <td class="tabular-nums" style="font-weight:600;color:var(--color-success);">${Utils.formatCurrency(p.amount)}</td>
                <td>${Utils.escapeHtml(p.paymentMethod)}</td>
                <td class="table-subtext">${p.notes ? Utils.escapeHtml(p.notes) : '—'}</td>
                <td style="text-align:right;">
                  <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Payments.confirmDeletePayment('${p.id}')" title="Delete Payment Transaction" style="color:var(--color-danger);height:26px;width:26px;padding:0;display:inline-flex;align-items:center;justify-content:center;">
                    <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const footerLeft = document.getElementById('invoiceHistoryFooterLeft');
    if (footerLeft) {
      footerLeft.innerHTML = `
        <button type="button" class="btn btn-secondary btn-sm" onclick="Payments.confirmDeleteInvoice('${invoice.id}', true)" style="color:var(--color-danger);border-color:var(--color-border);display:inline-flex;align-items:center;gap:6px;">
          <i data-lucide="trash-2" style="width:13px;height:13px;"></i> Delete Invoice
        </button>
      `;
    }

    Utils.openModal('invoiceHistoryModal');
    Utils.refreshIcons();
  },

  async confirmDeleteInvoice(invoiceId, isFromModal = false) {
    const invoice = Storage.getInvoiceById(invoiceId);
    if (!invoice) return;

    const payments = Storage.getPaymentsByInvoiceId(invoiceId);
    const paidPaise = Utils.toPaise(invoice.paidAmount || 0);

    let message = `Are you sure you want to delete invoice ${invoice.invoiceNumber} (${Utils.escapeHtml(invoice.serviceName || 'Service')}) for ${Utils.escapeHtml(invoice.clientName)} (${Utils.formatCurrency(invoice.amount)})?`;
    if (payments.length > 0) {
      message = `Invoice ${invoice.invoiceNumber} has ${payments.length} recorded payment transaction(s) totaling ${Utils.formatCurrency(Utils.fromPaise(paidPaise))}. Deleting this invoice will also permanently remove these transaction records and update all revenue totals. Are you sure you want to proceed?`;
    }

    const confirmed = await Utils.confirm({
      title: 'Delete Invoice / Bill?',
      message: message,
      confirmText: 'Delete Invoice',
      confirmDanger: true
    });

    if (!confirmed) return;

    if (isFromModal) {
      Utils.closeModal('invoiceHistoryModal');
    }

    Storage.deleteInvoice(invoiceId);
    Utils.showToast(`Invoice ${invoice.invoiceNumber} deleted successfully`, 'success');

    this.render();
    if (window.Dashboard) window.Dashboard.render();
    if (window.Reports) window.Reports.render();
    if (window.Clients) {
      Clients.render();
      if (Clients.activeDetailClientId === invoice.clientId) {
        Clients.renderClientDetailPage(invoice.clientId);
      }
    }
  },

  async confirmDeletePayment(paymentId) {
    const payments = Storage.getPayments();
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return;

    const confirmed = await Utils.confirm({
      title: 'Delete Payment Transaction?',
      message: `Delete recorded payment of ${Utils.formatCurrency(payment.amount)} (${payment.paymentMethod || 'Payment'}) on ${Utils.formatDate(payment.paymentDate)}? Outstanding invoice balance will be updated accordingly.`,
      confirmText: 'Delete Payment',
      confirmDanger: true
    });

    if (!confirmed) return;

    Storage.deletePayment(paymentId);
    Utils.showToast(`Payment of ${Utils.formatCurrency(payment.amount)} deleted`, 'success');

    if (payment.invoiceId) {
      const inv = Storage.getInvoiceById(payment.invoiceId);
      if (inv) {
        this.viewInvoiceHistory(payment.invoiceId);
      } else {
        Utils.closeModal('invoiceHistoryModal');
      }
    }

    this.render();
    if (window.Dashboard) window.Dashboard.render();
    if (window.Reports) window.Reports.render();
    if (window.Clients) {
      Clients.render();
      if (Clients.activeDetailClientId === payment.clientId) {
        Clients.renderClientDetailPage(payment.clientId);
      }
    }
  },

  async toggleClientRetainer(clientId) {
    const client = Storage.getClientById(clientId);
    if (!client || !client.monthlyAmount || client.monthlyAmount <= 0) return;

    const isPaused = client.retainerStatus === 'paused';
    const newStatus = isPaused ? 'active' : 'paused';

    if (!isPaused) {
      const confirmed = await Utils.confirm({
        title: 'Pause Monthly Retainer?',
        message: `Pause monthly recurring retainer (${Utils.formatCurrency(client.monthlyAmount)} / mo) for "${client.name}"? While paused, automated monthly billing will be suspended for this client.`,
        confirmText: 'Pause Retainer',
        confirmDanger: false
      });
      if (!confirmed) return;
    }

    Storage.updateClient(clientId, { retainerStatus: newStatus });
    Utils.showToast(
      newStatus === 'paused'
        ? `Monthly retainer paused for ${client.name}`
        : `Monthly retainer resumed for ${client.name}`,
      'success'
    );

    this.syncCreateInvoiceFields();
    this.render();
    if (window.Clients) {
      Clients.render();
      if (Clients.activeDetailClientId === clientId) Clients.renderClientDetailPage(clientId);
    }
  },

  async deleteClientRetainer(clientId) {
    const client = Storage.getClientById(clientId);
    if (!client) return;

    const confirmed = await Utils.confirm({
      title: 'Delete Monthly Retainer Plan?',
      message: `Are you sure you want to delete and remove the recurring monthly retainer (${Utils.formatCurrency(client.monthlyAmount)} / mo) for "${client.name}"? Existing invoices and payment history will remain intact, but future monthly recurring charges will no longer apply.`,
      confirmText: 'Delete Retainer',
      confirmDanger: true
    });

    if (!confirmed) return;

    Storage.updateClient(clientId, {
      monthlyAmount: 0,
      dueDay: null,
      retainerStatus: null
    });

    // Reset retainer inputs in modal
    const retAmount = document.getElementById('createInvoiceRetainerAmount');
    if (retAmount) retAmount.value = '';

    Utils.showToast(`Monthly retainer deleted for ${client.name}`, 'success');

    this.syncCreateInvoiceFields();
    this.render();
    if (window.Clients) {
      Clients.render();
      if (Clients.activeDetailClientId === clientId) Clients.renderClientDetailPage(clientId);
    }
  },

  async quickToggleRetainer(clientId, refreshGenerateModal = false) {
    const client = Storage.getClientById(clientId);
    if (!client || !client.monthlyAmount || client.monthlyAmount <= 0) return;

    const isPaused = client.retainerStatus === 'paused';
    const newStatus = isPaused ? 'active' : 'paused';

    Storage.updateClient(clientId, { retainerStatus: newStatus });
    Utils.showToast(
      newStatus === 'paused'
        ? `Monthly retainer paused for ${client.name}`
        : `Monthly retainer resumed for ${client.name}`,
      'success'
    );

    if (refreshGenerateModal) {
      this.renderGenerateClientsList();
    }
    this.render();
    if (window.Clients) {
      Clients.render();
      if (Clients.activeDetailClientId === clientId) Clients.renderClientDetailPage(clientId);
    }
  },

  toggleActionMenu(event, menuId) {
    if (window.Clients && Clients.toggleActionMenu) {
      Clients.toggleActionMenu(event, menuId);
    }
  }
};

window.Payments = Payments;
