/**
 * CLIENTO - CLIENT MANAGEMENT MODULE
 * Handles client listing, real-time search/filtering, Add/Edit client forms,
 * client detail view with financial history, and safe deactivation.
 */

const Clients = {
  activeSearchQuery: '',
  activeStatusFilter: 'all',

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('clientSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.activeSearchQuery = e.target.value.trim().toLowerCase();
        this.renderTable();
      });
    }

    // Status filter
    const statusFilter = document.getElementById('clientStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.activeStatusFilter = e.target.value;
        this.renderTable();
      });
    }

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clientClearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        this.activeSearchQuery = '';
        this.activeStatusFilter = 'all';
        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = 'all';
        this.renderTable();
      });
    }

    // Add Client modal trigger
    const addClientBtn = document.getElementById('addClientBtn');
    if (addClientBtn) {
      addClientBtn.addEventListener('click', () => {
        this.openAddEditModal();
      });
    }

    // Client form submit
    const clientForm = document.getElementById('clientForm');
    if (clientForm) {
      clientForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu.show').forEach((menu) => {
          menu.classList.remove('show');
        });
      }
    });
  },

  render() {
    this.renderStats();
    this.renderTable();
  },

  renderStats() {
    const clients = Storage.getClients();
    const countBadge = document.getElementById('clientTotalBadge');
    if (countBadge) {
      const activeCount = clients.filter((c) => c.status === 'active').length;
      countBadge.textContent = `${clients.length} total (${activeCount} active)`;
    }
  },

  getFilteredClients() {
    let clients = Storage.getClients();

    if (this.activeStatusFilter !== 'all') {
      clients = clients.filter((c) => c.status === this.activeStatusFilter);
    }

    if (this.activeSearchQuery) {
      clients = clients.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(this.activeSearchQuery);
        const phoneMatch = c.phone && c.phone.toLowerCase().includes(this.activeSearchQuery);
        const serviceMatch = c.service && c.service.toLowerCase().includes(this.activeSearchQuery);
        return nameMatch || phoneMatch || serviceMatch;
      });
    }

    return clients;
  },

  renderTable() {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    const clients = this.getFilteredClients();
    if (clients.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <div class="empty-state-icon">
                <i data-lucide="users"></i>
              </div>
              <div class="empty-state-title">No clients found</div>
              <div class="empty-state-text">
                ${this.activeSearchQuery || this.activeStatusFilter !== 'all' 
                  ? 'No clients match your filter criteria.' 
                  : 'Get started by creating your first client record.'}
              </div>
              ${!this.activeSearchQuery && this.activeStatusFilter === 'all' 
                ? '<button class="btn btn-primary btn-sm" onclick="Clients.openAddEditModal()"><i data-lucide="plus"></i> Add Client</button>' 
                : ''}
            </div>
          </td>
        </tr>
      `;
      Utils.refreshIcons();
      return;
    }

    tbody.innerHTML = clients.map((client) => {
      const isStatusActive = client.status === 'active';
      const statusBadge = isStatusActive
        ? `<span class="badge badge-success"><span class="badge-dot"></span>Active</span>`
        : `<span class="badge badge-neutral"><span class="badge-dot"></span>Inactive</span>`;

      const hasMonthlyRetainer = (parseFloat(client.monthlyAmount) || 0) > 0;
      const monthlyHtml = hasMonthlyRetainer
        ? `
          <div class="tabular-nums" style="font-weight: 500;">${Utils.formatCurrency(client.monthlyAmount)} / mo</div>
          ${client.monthlyDescription ? `<div class="table-subtext" title="${Utils.escapeHtml(client.monthlyDescription)}">${Utils.escapeHtml(client.monthlyDescription)}</div>` : ''}
        `
        : `<span class="badge badge-neutral" style="font-size:11px;font-weight:normal;">No Retainer (On Demand)</span>`;

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--color-text-primary);">${Utils.escapeHtml(client.name)}</div>
            ${client.email ? `<div class="table-subtext">${Utils.escapeHtml(client.email)}</div>` : ''}
          </td>
          <td>${client.phone ? Utils.escapeHtml(client.phone) : '<span class="table-subtext">—</span>'}</td>
          <td>${Utils.escapeHtml(client.service)}</td>
          <td>${monthlyHtml}</td>
          <td>${hasMonthlyRetainer ? `Day ${client.dueDay} of month` : '<span class="table-subtext">—</span>'}</td>
          <td>${statusBadge}</td>
          <td class="actions-col">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:var(--space-2);">
              <button class="btn btn-secondary btn-icon btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}', 'changes')" title="Add Extra Charge / Changes" aria-label="Add Extra Charge / Changes">
                <i data-lucide="receipt"></i>
              </button>
              <button class="btn btn-secondary btn-icon btn-sm" onclick="Clients.viewClientDetails('${client.id}')" title="View Details" aria-label="View Details">
                <i data-lucide="eye"></i>
              </button>
              <button class="btn btn-secondary btn-icon btn-sm" onclick="Clients.openAddEditModal('${client.id}')" title="Edit Client" aria-label="Edit Client">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn ${isStatusActive ? 'btn-secondary' : 'btn-danger'} btn-icon btn-sm" onclick="Clients.confirmDeleteClient('${client.id}')" title="${isStatusActive ? 'Deactivate Client' : 'Delete Client'}" aria-label="${isStatusActive ? 'Deactivate Client' : 'Delete Client'}">
                <i data-lucide="${isStatusActive ? 'user-x' : 'trash-2'}"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    Utils.refreshIcons();
  },

  toggleActionMenu(event, clientId) {
    event.stopPropagation();
    const menuId = `clientActionsMenu_${clientId}`;
    const targetMenu = document.getElementById(menuId);
    const isOpen = targetMenu.classList.contains('show');

    // Close all other dropdowns
    document.querySelectorAll('.dropdown-menu.show').forEach((m) => m.classList.remove('show'));

    if (!isOpen) {
      targetMenu.classList.add('show');
    }
  },

  openAddEditModal(clientId = null) {
    // Close dropdowns
    document.querySelectorAll('.dropdown-menu.show').forEach((m) => m.classList.remove('show'));

    const form = document.getElementById('clientForm');
    const modalTitle = document.getElementById('clientModalTitle');
    Utils.clearFieldErrors(form);
    form.reset();

    const idInput = document.getElementById('clientFormId');
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    const emailInput = document.getElementById('clientEmail');
    const serviceInput = document.getElementById('clientService');
    const amountInput = document.getElementById('clientMonthlyAmount');
    const monthlyDescInput = document.getElementById('clientMonthlyDescription');
    const joiningDateInput = document.getElementById('clientJoiningDate');
    const dueDayInput = document.getElementById('clientDueDay');
    const statusInput = document.getElementById('clientStatus');

    if (clientId) {
      const client = Storage.getClientById(clientId);
      if (!client) return;
      modalTitle.textContent = 'Edit Client';
      idInput.value = client.id;
      nameInput.value = client.name;
      phoneInput.value = client.phone || '';
      emailInput.value = client.email || '';
      serviceInput.value = client.service;
      amountInput.value = (client.monthlyAmount > 0) ? client.monthlyAmount : '';
      if (monthlyDescInput) monthlyDescInput.value = client.monthlyDescription || '';
      joiningDateInput.value = client.joiningDate || Utils.getTodayString();
      dueDayInput.value = client.dueDay || 5;
      statusInput.value = client.status || 'active';
    } else {
      modalTitle.textContent = 'Add New Client';
      idInput.value = '';
      if (monthlyDescInput) monthlyDescInput.value = '';
      joiningDateInput.value = Utils.getTodayString();
      const settings = Storage.getSettings();
      dueDayInput.value = settings.billingPreference || 5;
      statusInput.value = 'active';
    }

    Utils.openModal('clientModal');
  },

  handleFormSubmit() {
    const form = document.getElementById('clientForm');
    Utils.clearFieldErrors(form);

    const id = document.getElementById('clientFormId').value;
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    const emailInput = document.getElementById('clientEmail');
    const serviceInput = document.getElementById('clientService');
    const amountInput = document.getElementById('clientMonthlyAmount');
    const monthlyDescInput = document.getElementById('clientMonthlyDescription');
    const joiningDateInput = document.getElementById('clientJoiningDate');
    const dueDayInput = document.getElementById('clientDueDay');
    const statusInput = document.getElementById('clientStatus');

    let isValid = true;

    // Validation
    const name = nameInput.value.trim();
    if (!name) {
      Utils.setFieldError(nameInput, 'Client name is required');
      isValid = false;
    }

    const service = serviceInput.value.trim();
    if (!service) {
      Utils.setFieldError(serviceInput, 'Primary service type is required');
      isValid = false;
    }

    // Monthly charge is completely optional (0 if empty)
    let amount = 0;
    if (amountInput.value && amountInput.value.trim() !== '') {
      amount = parseFloat(amountInput.value);
      if (isNaN(amount) || amount < 0) {
        Utils.setFieldError(amountInput, 'Monthly charge must be a positive number or 0');
        isValid = false;
      }
    }

    const monthlyDescription = monthlyDescInput ? monthlyDescInput.value.trim() : '';

    const dueDay = parseInt(dueDayInput.value, 10);
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 28) {
      Utils.setFieldError(dueDayInput, 'Due day must be between 1 and 28');
      isValid = false;
    }

    const email = emailInput.value.trim();
    if (email && !Utils.validateEmail(email)) {
      Utils.setFieldError(emailInput, 'Enter a valid email address');
      isValid = false;
    }

    let joiningDate = joiningDateInput.value;
    if (!joiningDate) {
      joiningDate = Utils.getTodayString();
      joiningDateInput.value = joiningDate;
    }

    if (!isValid) return;

    const payload = {
      name,
      phone: phoneInput.value.trim(),
      email,
      service,
      monthlyAmount: amount,
      monthlyDescription,
      dueDay,
      joiningDate,
      status: statusInput.value
    };

    if (id) {
      Storage.updateClient(id, payload);
      Utils.showToast('Client details updated successfully', 'success');
    } else {
      Storage.addClient(payload);
      Utils.showToast('New client created successfully', 'success');
    }

    Utils.closeModal('clientModal');
    this.render();
    if (window.Dashboard) window.Dashboard.render();
    if (window.Payments) window.Payments.render();
  },

  viewClientDetails(clientId) {
    document.querySelectorAll('.dropdown-menu.show').forEach((m) => m.classList.remove('show'));
    const client = Storage.getClientById(clientId);
    if (!client) return;

    const container = document.getElementById('clientDetailContent');
    if (!container) return;

    // Calculate client metrics
    const invoices = Storage.getInvoices().filter((inv) => inv.clientId === clientId);
    const payments = Storage.getPayments().filter((p) => p.clientId === clientId);

    const totalBilledPaise = invoices.reduce((acc, inv) => acc + Utils.toPaise(inv.amount), 0);
    const totalPaidPaise = payments.reduce((acc, p) => acc + Utils.toPaise(p.amount), 0);
    const outstandingPaise = Math.max(totalBilledPaise - totalPaidPaise, 0);

    const isStatusActive = client.status === 'active';
    const statusBadge = isStatusActive
      ? `<span class="badge badge-success"><span class="badge-dot"></span>Active</span>`
      : `<span class="badge badge-neutral"><span class="badge-dot"></span>Inactive</span>`;

    const hasRetainer = (parseFloat(client.monthlyAmount) || 0) > 0;

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-5);">
        <div>
          <h3 style="font-size:18px;font-weight:600;margin-bottom:4px;">${Utils.escapeHtml(client.name)}</h3>
          <div style="font-size:13px;color:var(--color-text-secondary);">${Utils.escapeHtml(client.service)}</div>
        </div>
        <div>${statusBadge}</div>
      </div>

      <!-- Financial Summary Cards -->
      <div class="stat-grid stat-grid-3" style="margin-bottom:var(--space-6);">
        <div class="stat-card" style="padding:var(--space-3) var(--space-4);">
          <div class="stat-label">Monthly Retainer</div>
          <div class="stat-value" style="font-size:18px;">${hasRetainer ? Utils.formatCurrency(client.monthlyAmount) : '₹0.00'}</div>
          <div class="stat-subtext">${hasRetainer && client.monthlyDescription ? Utils.escapeHtml(client.monthlyDescription) : (hasRetainer ? 'Recurring Retainer' : 'On Demand / Project-based')}</div>
        </div>
        <div class="stat-card" style="padding:var(--space-3) var(--space-4);">
          <div class="stat-label">Total Paid</div>
          <div class="stat-value" style="font-size:18px;color:var(--color-success);">${Utils.formatCurrency(Utils.fromPaise(totalPaidPaise))}</div>
          <div class="stat-subtext">Lifetime payments</div>
        </div>
        <div class="stat-card" style="padding:var(--space-3) var(--space-4);">
          <div class="stat-label">Outstanding Balance</div>
          <div class="stat-value" style="font-size:18px;color:${outstandingPaise > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)'};">${Utils.formatCurrency(Utils.fromPaise(outstandingPaise))}</div>
          <div class="stat-subtext">Unsettled amount</div>
        </div>
      </div>

      <!-- Profile Details -->
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card-header">
          <div class="card-title">Client Details</div>
          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}', 'changes')">
              <i data-lucide="plus-circle"></i> + Add Extra Charge / Changes
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}', 'monthly')">
              <i data-lucide="receipt"></i> Bill Retainer
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Clients.openAddEditModal('${client.id}')">
              <i data-lucide="edit-2"></i> Edit Client
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Primary Service</span>
              <span class="detail-value">${Utils.escapeHtml(client.service)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Monthly Retainer</span>
              <span class="detail-value">${hasRetainer ? `${Utils.formatCurrency(client.monthlyAmount)} / mo` : 'None (Project-based / On Demand)'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Retainer Purpose</span>
              <span class="detail-value">${client.monthlyDescription ? Utils.escapeHtml(client.monthlyDescription) : '—'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Billing Due Day</span>
              <span class="detail-value">${hasRetainer ? `Day ${client.dueDay} of every month` : 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Phone</span>
              <span class="detail-value">${client.phone ? Utils.escapeHtml(client.phone) : '—'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Billing Email</span>
              <span class="detail-value">${client.email ? Utils.escapeHtml(client.email) : '—'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Joining Date</span>
              <span class="detail-value">${Utils.formatDate(client.joiningDate)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Invoices & Extra Charges List -->
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card-header">
          <div class="card-title">Invoices & Extra Charges (${invoices.length})</div>
          <button class="btn btn-secondary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}', 'changes')">
            <i data-lucide="plus"></i> New Charge
          </button>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice / Service</th>
                <th>Cycle</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No invoices or charges recorded for this client yet.</td>
                </tr>
              ` : invoices.map((inv) => {
                const isPaid = inv.status === 'paid';
                return `
                  <tr>
                    <td>
                      <div style="font-weight:600;">${Utils.escapeHtml(inv.invoiceNumber)}</div>
                      <div style="font-size:12px;color:var(--color-text-secondary);display:inline-flex;align-items:center;gap:4px;">
                        ${inv.invoiceType === 'changes' ? '<span class="badge badge-warning" style="font-size:10px;padding:0 5px;">Changes</span>' : ''}
                        <span>${Utils.escapeHtml(inv.serviceName || 'Monthly Retainer')}</span>
                      </div>
                    </td>
                    <td>${Utils.formatMonth(inv.billingMonth)}</td>
                    <td class="tabular-nums" style="font-weight:600;">${Utils.formatCurrency(inv.amount)}</td>
                    <td class="tabular-nums">${Utils.formatDate(inv.dueDate)}</td>
                    <td>
                      <span class="badge badge-${inv.status === 'paid' ? 'success' : inv.status === 'partial' ? 'warning' : inv.status === 'overdue' ? 'danger' : 'neutral'}">
                        ${inv.status.toUpperCase()}
                      </span>
                    </td>
                    <td style="text-align:right;">
                      ${!isPaid ? `
                        <button class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${inv.id}')">
                          <i data-lucide="plus-circle"></i> Pay
                        </button>
                      ` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Payment Transactions History -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Payment History (${payments.length})</div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Invoice</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No payment transactions recorded for this client yet.</td>
                </tr>
              ` : payments.map((p) => `
                <tr>
                  <td>${Utils.formatDate(p.paymentDate)}</td>
                  <td class="tabular-nums" style="font-weight:600;color:var(--color-success);">${Utils.formatCurrency(p.amount)}</td>
                  <td>${Utils.escapeHtml(p.paymentMethod)}</td>
                  <td>${Utils.escapeHtml(p.invoiceNumber || p.billingMonth)}</td>
                  <td class="table-subtext">${p.notes ? Utils.escapeHtml(p.notes) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    Utils.openModal('clientDetailModal');
    Utils.refreshIcons();
  },

  async confirmDeleteClient(clientId) {
    document.querySelectorAll('.dropdown-menu.show').forEach((m) => m.classList.remove('show'));
    const client = Storage.getClientById(clientId);
    if (!client) return;

    const invoices = Storage.getInvoices().filter((inv) => inv.clientId === clientId);
    const payments = Storage.getPayments().filter((p) => p.clientId === clientId);
    const hasHistory = invoices.length > 0 || payments.length > 0;

    const confirmed = await Utils.confirm({
      title: hasHistory ? 'Deactivate Client' : 'Delete Client',
      message: hasHistory
        ? `Client "${client.name}" has ${invoices.length} invoice(s) and ${payments.length} payment(s). To maintain audit integrity, deactivating this client stops future billing while preserving all historical records.`
        : `Are you sure you want to permanently delete client "${client.name}"? This action cannot be undone.`,
      confirmText: hasHistory ? 'Deactivate Client' : 'Delete Client',
      confirmDanger: true
    });

    if (confirmed) {
      const res = Storage.deleteOrDeactivateClient(clientId);
      Utils.showToast(res.message, 'info');
      this.render();
      if (window.Dashboard) window.Dashboard.render();
      if (window.Payments) window.Payments.render();
    }
  }
};

window.Clients = Clients;
