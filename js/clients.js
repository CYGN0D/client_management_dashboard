/**
 * CLIENTO - CLIENT MANAGEMENT MODULE
 * Handles client listing, real-time search/filtering, Add/Edit client forms,
 * client detail view with financial history, and safe deactivation.
 */

const Clients = {
  activeSearchQuery: '',
  activeStatusFilter: 'all',
  activeDetailClientId: null,

  init() {
    this.bindEvents();
    this.bindServiceChips();
    this.bindInitialPaymentEvents();
    this.render();
  },

  bindServiceChips() {
    const container = document.getElementById('clientServiceChips');
    const serviceInput = document.getElementById('clientService');
    if (!container || !serviceInput) return;

    container.addEventListener('click', (e) => {
      const pill = e.target.closest('.service-pill, .service-chip');
      if (!pill) return;
      e.preventDefault();

      const serviceName = pill.getAttribute('data-service');
      let currentServices = serviceInput.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const existsIdx = currentServices.findIndex(
        (s) => s.toLowerCase() === serviceName.toLowerCase()
      );

      if (existsIdx >= 0) {
        currentServices.splice(existsIdx, 1);
        pill.classList.remove('active');
      } else {
        currentServices.push(serviceName);
        pill.classList.add('active');
      }

      serviceInput.value = currentServices.join(', ');
      Utils.clearFieldErrors(serviceInput);
    });

    serviceInput.addEventListener('input', () => {
      this.syncServiceChips(serviceInput.value);
    });
  },

  syncServiceChips(serviceText) {
    const container = document.getElementById('clientServiceChips');
    if (!container) return;
    const pills = container.querySelectorAll('.service-pill, .service-chip');
    const current = (serviceText || '').toLowerCase();
    pills.forEach((pill) => {
      const name = (pill.getAttribute('data-service') || '').toLowerCase();
      if (current && (current.includes(name) || name.split(' ').some(w => w.length > 3 && current.includes(w)))) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  },

  bindInitialPaymentEvents() {
    const statusSelect = document.getElementById('clientInitialStatus');
    const methodGroup = document.getElementById('clientInitialMethodGroup');
    const paymentInput = document.getElementById('clientInitialPayment');

    if (statusSelect && methodGroup) {
      statusSelect.addEventListener('change', () => {
        methodGroup.style.display = statusSelect.value === 'paid' ? '' : 'none';
        if (statusSelect.value === 'none' && paymentInput) {
          paymentInput.value = '';
        }
      });
    }

    if (paymentInput && statusSelect) {
      paymentInput.addEventListener('input', () => {
        const val = parseFloat(paymentInput.value);
        if (val > 0 && statusSelect.value === 'none') {
          statusSelect.value = 'paid';
          if (methodGroup) methodGroup.style.display = '';
        }
      });
    }
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



    // Close dropdowns on outside click or scroll
    const closeAllDropdowns = () => {
      document.querySelectorAll('.dropdown-menu.show').forEach((menu) => {
        menu.classList.remove('show');
        menu.style.position = '';
        menu.style.top = '';
        menu.style.left = '';
      });
    };

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) {
        closeAllDropdowns();
      }
    });

    window.addEventListener('scroll', closeAllDropdowns, { passive: true });
    window.addEventListener('resize', closeAllDropdowns);
  },

  render() {
    this.renderStats();
    this.renderTable();
    if (this.activeDetailClientId && window.App && App.activePage === 'client-detail') {
      this.renderClientDetailPage(this.activeDetailClientId);
    }
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

      const hasRetainer = Boolean(client.monthlyAmount && client.monthlyAmount > 0);
      const isRetainerPaused = hasRetainer && client.retainerStatus === 'paused';
      const monthlyDisplay = hasRetainer
        ? `<span class="tabular-nums" style="font-weight: 500;">${Utils.formatCurrency(client.monthlyAmount)}</span>${isRetainerPaused ? ' <span class="badge badge-warning" style="font-size:10px;padding:1px 5px;margin-left:4px;"><span class="badge-dot"></span>Paused</span>' : ''}`
        : `<span class="badge badge-neutral" style="font-size:11px;">No Retainer (Ad-hoc)</span>`;

      return `
        <tr class="table-card-row">
          <td class="table-card-main">
            <div class="table-cell-truncate" style="font-weight: 600; color: var(--color-text-primary); font-size: 14px; max-width: 220px; cursor: pointer;" onclick="Clients.viewClientDetails('${client.id}')" title="View ${Utils.escapeHtml(client.name)}">${Utils.escapeHtml(client.name)}</div>
            ${client.email ? `<div class="table-subtext table-cell-truncate" style="max-width: 220px;" title="${Utils.escapeHtml(client.email)}">${Utils.escapeHtml(client.email)}</div>` : ''}
          </td>
          <td data-label="Phone" style="white-space:nowrap;">${client.phone ? Utils.escapeHtml(client.phone) : '<span class="table-subtext">—</span>'}</td>
          <td data-label="Service">
            <div class="table-cell-truncate" style="max-width: 200px;" title="${Utils.escapeHtml(client.service)}">${Utils.escapeHtml(client.service)}</div>
          </td>
          <td data-label="Monthly Charge" style="white-space:nowrap;">${monthlyDisplay}</td>
          <td data-label="Due Date" style="white-space:nowrap;">${(client.monthlyAmount && client.monthlyAmount > 0 && client.dueDay) ? `Day ${client.dueDay} of month` : '<span class="table-subtext">—</span>'}</td>
          <td data-label="Status">${statusBadge}</td>
          <td class="actions-col" data-label="Actions">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;width:100%;">
              <button class="btn btn-secondary btn-icon btn-sm" onclick="Clients.viewClientDetails('${client.id}')" title="View Details" aria-label="View Details" style="width:28px;height:28px;">
                <i data-lucide="eye" style="width:14px;height:14px;"></i>
              </button>
              <div class="dropdown">
                <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, '${client.id}')" title="More options" aria-label="More options" style="width:28px;height:28px;">
                  <i data-lucide="more-vertical" style="width:14px;height:14px;"></i>
                </button>
                <div id="clientActionsMenu_${client.id}" class="dropdown-menu">
                  <button type="button" class="dropdown-item" onclick="Payments.openCreateInvoiceModal('${client.id}')">
                    <i data-lucide="receipt"></i> Add Charge / Invoice
                  </button>
                  <button type="button" class="dropdown-item" onclick="Clients.openAddEditModal('${client.id}')">
                    <i data-lucide="edit-2"></i> Edit Client Profile
                  </button>
                  <div class="dropdown-divider"></div>
                  <button type="button" class="dropdown-item text-danger" onclick="Clients.confirmDeleteClient('${client.id}')">
                    <i data-lucide="${isStatusActive ? 'user-x' : 'trash-2'}"></i> ${isStatusActive ? 'Deactivate Client' : 'Delete Client'}
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

  toggleActionMenu(event, targetId) {
    event.stopPropagation();
    const menuId = (typeof targetId === 'string' && (targetId.includes('_') || targetId.startsWith('menu')))
      ? targetId
      : `clientActionsMenu_${targetId}`;
    const targetMenu = document.getElementById(menuId);
    if (!targetMenu) return;

    const isOpen = targetMenu.classList.contains('show');

    // Close all other dropdowns
    document.querySelectorAll('.dropdown-menu.show').forEach((m) => {
      m.classList.remove('show');
      m.style.position = '';
      m.style.top = '';
      m.style.left = '';
    });

    if (!isOpen) {
      targetMenu.classList.add('show');

      // Floating position coordinates so dropdown is never clipped by table or card boundary
      const triggerBtn = event.currentTarget || event.target.closest('button');
      if (triggerBtn) {
        const rect = triggerBtn.getBoundingClientRect();
        const menuWidth = 185;
        const menuHeight = targetMenu.offsetHeight || 160;

        let left = rect.right - menuWidth;
        if (left < 10) left = 10;
        if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;

        let top = rect.bottom + 4;
        if (top + menuHeight > window.innerHeight - 10 && rect.top - menuHeight - 4 > 10) {
          top = rect.top - menuHeight - 4;
        }

        targetMenu.style.position = 'fixed';
        targetMenu.style.top = `${top}px`;
        targetMenu.style.left = `${left}px`;
        targetMenu.style.zIndex = '1050';
      }
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
    const joiningDateInput = document.getElementById('clientJoiningDate');
    const statusInput = document.getElementById('clientStatus');

    const initialAmountGroup = document.getElementById('clientInitialAmountGroup');
    const initialStatusGroup = document.getElementById('clientInitialStatusGroup');
    const initialMethodGroup = document.getElementById('clientInitialMethodGroup');
    const initialPaymentInput = document.getElementById('clientInitialPayment');
    const initialStatusSelect = document.getElementById('clientInitialStatus');
    const initialMethodSelect = document.getElementById('clientInitialMethod');

    if (clientId) {
      const client = Storage.getClientById(clientId);
      if (!client) return;
      modalTitle.textContent = 'Edit Client';
      idInput.value = client.id;
      nameInput.value = client.name;
      phoneInput.value = client.phone || '';
      emailInput.value = client.email || '';
      serviceInput.value = client.service;
      joiningDateInput.value = Utils.isoToDmy(client.joiningDate) || client.joiningDate || Utils.isoToDmy(Utils.getTodayString());
      statusInput.value = client.status || 'active';

      // Hide initial advance section when editing an established client
      if (initialAmountGroup) initialAmountGroup.style.display = 'none';
      if (initialStatusGroup) initialStatusGroup.style.display = 'none';
      if (initialMethodGroup) initialMethodGroup.style.display = 'none';

      this.syncServiceChips(client.service);
    } else {
      modalTitle.textContent = 'Add New Client';
      idInput.value = '';
      nameInput.value = '';
      phoneInput.value = '';
      emailInput.value = '';
      serviceInput.value = '';
      joiningDateInput.value = Utils.isoToDmy(Utils.getTodayString());
      statusInput.value = 'active';

      // Show initial advance section for onboarding new client
      if (initialAmountGroup) initialAmountGroup.style.display = '';
      if (initialStatusGroup) initialStatusGroup.style.display = '';
      if (initialPaymentInput) initialPaymentInput.value = '';
      if (initialStatusSelect) initialStatusSelect.value = 'paid';
      if (initialMethodSelect) initialMethodSelect.value = 'Bank Transfer';
      if (initialMethodGroup) initialMethodGroup.style.display = '';

      this.syncServiceChips('');
    }

    Utils.openModal('clientModal');
    Utils.refreshIcons();
  },

  handleFormSubmit() {
    const form = document.getElementById('clientForm');
    Utils.clearFieldErrors(form);

    const id = document.getElementById('clientFormId').value;
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    const emailInput = document.getElementById('clientEmail');
    const serviceInput = document.getElementById('clientService');
    const joiningDateInput = document.getElementById('clientJoiningDate');
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
      Utils.setFieldError(serviceInput, 'Please select or enter at least one service');
      isValid = false;
    }

    let amount = 0;
    let dueDay = null;
    if (id) {
      const existingClient = Storage.getClientById(id);
      if (existingClient) {
        amount = existingClient.monthlyAmount || 0;
        dueDay = existingClient.dueDay || null;
      }
    }

    const email = emailInput.value.trim();
    if (email && !Utils.validateEmail(email)) {
      Utils.setFieldError(emailInput, 'Enter a valid email address');
      isValid = false;
    }

    let joiningDateRaw = joiningDateInput.value.trim();
    let joiningDate = '';
    if (!joiningDateRaw) {
      joiningDate = Utils.getTodayString();
      joiningDateInput.value = Utils.isoToDmy(joiningDate);
    } else {
      joiningDate = Utils.dmyToIso(joiningDateRaw) || joiningDateRaw;
    }

    // Initial project payment validation (for new clients)
    let initialAmount = 0;
    const initialPaymentInput = document.getElementById('clientInitialPayment');
    const initialStatusSelect = document.getElementById('clientInitialStatus');
    const initialMethodSelect = document.getElementById('clientInitialMethod');

    if (!id && initialPaymentInput && initialPaymentInput.value.trim() !== '') {
      initialAmount = parseFloat(initialPaymentInput.value);
      if (isNaN(initialAmount) || initialAmount < 0) {
        Utils.setFieldError(initialPaymentInput, 'Initial payment must be 0 or greater');
        isValid = false;
      }
    }

    if (!isValid) return;

    const payload = {
      name,
      phone: phoneInput.value.trim(),
      email,
      service,
      monthlyAmount: amount,
      joiningDate,
      dueDay,
      status: statusInput.value
    };

    if (id) {
      Storage.updateClient(id, payload);
      Utils.showToast('Client details updated successfully', 'success');
    } else {
      const newClient = Storage.addClient(payload);

      // Handle First-Time Project Advance Payment if entered
      if (initialAmount > 0 && initialStatusSelect && initialStatusSelect.value !== 'none') {
        const initialStatus = initialStatusSelect.value;
        const initialMethod = initialMethodSelect ? initialMethodSelect.value : 'Bank Transfer';

        // Automatically create project advance invoice
        const invPayload = {
          clientId: newClient.id,
          serviceName: service || 'Project Advance / Initial Payment',
          billingMonth: (joiningDate || Utils.getTodayString()).substring(0, 7),
          amount: initialAmount,
          dueDate: joiningDate || Utils.getTodayString(),
          chargeType: 'one_time',
          notes: 'Initial Project Advance / Upfront Payment'
        };

        const invoice = Storage.addInvoice(invPayload);

        // If marked paid/received upfront, auto-record payment receipt
        if (initialStatus === 'paid' && invoice) {
          Storage.recordPayment({
            invoiceId: invoice.id,
            amount: initialAmount,
            paymentDate: joiningDate || Utils.getTodayString(),
            paymentMethod: initialMethod,
            notes: 'Project Advance received upfront upon onboarding'
          });
        }

        Utils.showToast(`Client created & advance of ${Utils.formatCurrency(initialAmount)} recorded!`, 'success');
      } else {
        Utils.showToast('New client created successfully', 'success');
      }
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

    this.activeDetailClientId = clientId;
    if (window.App) {
      App.navigateTo('client-detail');
    } else {
      this.renderClientDetailPage(clientId);
    }
  },

  renderClientDetailPage(clientId) {
    if (!clientId) return;
    const client = Storage.getClientById(clientId);
    if (!client) {
      if (window.App) App.navigateTo('clients');
      return;
    }

    const titleEl = document.getElementById('clientDetailPageTitle');
    const badgeEl = document.getElementById('clientDetailPageBadge');
    const subtitleEl = document.getElementById('clientDetailPageSubtitle');
    const actionsEl = document.getElementById('clientDetailPageActions');
    const contentEl = document.getElementById('clientDetailPageContent');
    if (!contentEl) return;

    if (titleEl) {
      titleEl.textContent = client.name;
    }

    const isStatusActive = client.status === 'active';
    const statusBadge = isStatusActive
      ? '<span class="badge badge-success"><span class="badge-dot"></span>Active</span>'
      : '<span class="badge badge-neutral"><span class="badge-dot"></span>Inactive</span>';

    if (badgeEl) {
      badgeEl.innerHTML = statusBadge;
    }

    if (subtitleEl) {
      subtitleEl.textContent = `${client.service || 'Client'} · Joined ${Utils.formatDate(client.joiningDate)}`;
    }

    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="btn btn-secondary" onclick="Clients.openAddEditModal('${client.id}')">
          <i data-lucide="edit-2"></i> Edit Client
        </button>
        <button class="btn btn-primary" onclick="Payments.openCreateInvoiceModal('${client.id}')">
          <i data-lucide="plus"></i> Add Charge
        </button>
      `;
    }

    // Invoices and payments
    const invoices = Storage.getInvoices().filter((inv) => inv.clientId === clientId);
    const payments = Storage.getPayments().filter((p) => p.clientId === clientId);

    const totalBilledPaise = invoices.reduce((acc, inv) => acc + Utils.toPaise(inv.amount), 0);
    const totalPaidPaise = payments.reduce((acc, p) => acc + Utils.toPaise(p.amount), 0);
    const outstandingPaise = Math.max(totalBilledPaise - totalPaidPaise, 0);

    const hasMonthly = Boolean(client.monthlyAmount && client.monthlyAmount > 0);
    const oneTimeServices = invoices.filter((inv) => inv.chargeType !== 'retainer');
    const totalServicesCount = (hasMonthly ? 1 : 0) + oneTimeServices.length;

    contentEl.innerHTML = `
      <!-- Financial Summary Cards -->
      <div class="stat-grid stat-grid-3" style="margin-bottom:var(--space-6);">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Total Billed</span>
            <div class="stat-icon"><i data-lucide="file-text"></i></div>
          </div>
          <div class="stat-value">${Utils.formatCurrency(Utils.fromPaise(totalBilledPaise))}</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Total Paid</span>
            <div class="stat-icon" style="color:var(--color-success);"><i data-lucide="check-circle"></i></div>
          </div>
          <div class="stat-value" style="color:var(--color-success);">${Utils.formatCurrency(Utils.fromPaise(totalPaidPaise))}</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Outstanding Balance</span>
            <div class="stat-icon" style="color:${outstandingPaise > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)'};"><i data-lucide="alert-circle"></i></div>
          </div>
          <div class="stat-value" style="color:${outstandingPaise > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)'};">${Utils.formatCurrency(Utils.fromPaise(outstandingPaise))}</div>
        </div>
      </div>

      <!-- Client Profile Details Card -->
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
          <div class="card-title">Client Information</div>
          <div>${statusBadge}</div>
        </div>
        <div class="card-body">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Service / Purpose</span>
              <span class="detail-value" style="font-weight:600;">${Utils.escapeHtml(client.service)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Phone</span>
              <span class="detail-value">${client.phone ? `<a href="tel:${Utils.escapeHtml(client.phone)}" style="color:inherit;text-decoration:none;font-weight:500;">${Utils.escapeHtml(client.phone)}</a>` : '<span style="color:var(--color-text-muted);">—</span>'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Email</span>
              <span class="detail-value">${client.email ? `<a href="mailto:${Utils.escapeHtml(client.email)}" style="color:inherit;text-decoration:none;font-weight:500;">${Utils.escapeHtml(client.email)}</a>` : '<span style="color:var(--color-text-muted);">—</span>'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Joining Date</span>
              <span class="detail-value">${Utils.formatDate(client.joiningDate)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Monthly Retainer</span>
              <span class="detail-value" style="display:flex;align-items:center;gap:8px;">
                ${hasMonthly 
                  ? `<span class="tabular-nums" style="font-weight:600;">${Utils.formatCurrency(client.monthlyAmount)} / mo</span> ${client.retainerStatus === 'paused' ? '<span class="badge badge-warning" style="font-size:11px;padding:2px 6px;"><span class="badge-dot"></span>Paused</span>' : '<span class="badge badge-success" style="font-size:11px;padding:2px 6px;"><span class="badge-dot"></span>Active</span>'}` 
                  : '<span style="color:var(--color-text-muted);">No Retainer (Ad-hoc)</span>'}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Billing Due Day</span>
              <span class="detail-value">${(hasMonthly && client.dueDay) ? `Day ${client.dueDay} of every month` : 'Project / Ad-hoc'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Total Invoices Billed</span>
              <span class="detail-value">${invoices.length}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Outstanding Balance</span>
              <span class="detail-value" style="font-weight:600;color:${outstandingPaise > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">${Utils.formatCurrency(Utils.fromPaise(outstandingPaise))}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Services & Billing Plans Section -->
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2);">
          <div>
            <div class="card-title">Services & Billing Plans (${totalServicesCount})</div>
            <div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">Configured recurring retainer subscriptions and one-time service charges</div>
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;">
            ${!hasMonthly ? `
              <button class="btn btn-secondary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}', '', 'retainer')">
                <i data-lucide="repeat"></i> Set Monthly Retainer
              </button>
            ` : ''}
            <button class="btn btn-primary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}', '', 'one_time')">
              <i data-lucide="plus"></i> Add Charge / Service
            </button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Service / Description</th>
                <th>Type</th>
                <th>Billing Schedule / Due</th>
                <th>Rate / Amount</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${totalServicesCount === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-6);">
                    No services or billing charges configured yet for this client.
                  </td>
                </tr>
              ` : `
                ${hasMonthly ? `
                  <tr>
                    <td>
                      <div class="table-cell-truncate" style="font-weight:600;color:var(--color-text-primary);max-width:240px;" title="${Utils.escapeHtml(client.service || 'Monthly Retainer')}">${Utils.escapeHtml(client.service || 'Monthly Retainer')}</div>
                      <div class="table-subtext">Recurring Monthly Retainer Agreement</div>
                    </td>
                    <td style="white-space:nowrap;">
                      <span class="badge badge-primary"><span class="badge-dot"></span>Monthly Retainer</span>
                    </td>
                    <td style="white-space:nowrap;">
                      <span style="font-weight:500;">Day ${client.dueDay || 5} of every month</span>
                    </td>
                    <td class="tabular-nums" style="font-weight:600;white-space:nowrap;">
                      ${Utils.formatCurrency(client.monthlyAmount)} / mo
                    </td>
                    <td style="white-space:nowrap;">
                      ${client.retainerStatus === 'paused' 
                        ? `<span class="badge badge-warning"><span class="badge-dot"></span>Paused</span>` 
                        : `<span class="badge badge-success"><span class="badge-dot"></span>Active</span>`}
                    </td>
                    <td style="text-align:right;white-space:nowrap;">
                      <div class="dropdown">
                        <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'svcActionsMenu_retainer_${client.id}')" title="Service Actions" aria-label="Service actions" style="width:30px;height:30px;">
                          <i data-lucide="more-vertical" style="width:16px;height:16px;"></i>
                        </button>
                        <div id="svcActionsMenu_retainer_${client.id}" class="dropdown-menu">
                          ${client.retainerStatus === 'paused' ? `
                            <button type="button" class="dropdown-item" onclick="Clients.toggleRetainerStatus('${client.id}')">
                              <i data-lucide="play"></i> Resume Retainer
                            </button>
                          ` : `
                            <button type="button" class="dropdown-item" onclick="Clients.toggleRetainerStatus('${client.id}')">
                              <i data-lucide="pause"></i> Pause Retainer
                            </button>
                          `}
                          <button type="button" class="dropdown-item" onclick="Payments.openCreateInvoiceModal('${client.id}', '', 'retainer')">
                            <i data-lucide="edit-2"></i> Edit Plan & Rate
                          </button>
                          <div class="dropdown-divider"></div>
                          <button type="button" class="dropdown-item text-danger" onclick="Clients.removeRetainer('${client.id}')">
                            <i data-lucide="trash-2"></i> Delete Retainer Plan
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ` : ''}

                ${oneTimeServices.map((inv) => {
                  const remPaise = Utils.toPaise(inv.amount) - Utils.toPaise(inv.paidAmount || 0);
                  const isAdvance = inv.chargeType === 'project_advance' || (inv.notes && inv.notes.toLowerCase().includes('advance'));
                  const typeBadge = isAdvance ? 'Project Advance' : 'One-Time Charge';

                  let statusBadge = '';
                  if (inv.status === 'paid') {
                    statusBadge = '<span class="badge badge-success"><span class="badge-dot"></span>Settled</span>';
                  } else if (inv.status === 'partial') {
                    statusBadge = '<span class="badge badge-warning"><span class="badge-dot"></span>Partial</span>';
                  } else if (inv.status === 'overdue') {
                    statusBadge = '<span class="badge badge-danger"><span class="badge-dot"></span>Overdue</span>';
                  } else {
                    statusBadge = '<span class="badge badge-neutral"><span class="badge-dot"></span>Pending</span>';
                  }

                  return `
                    <tr>
                      <td>
                        <div class="table-cell-truncate" style="font-weight:600;color:var(--color-text-primary);max-width:240px;" title="${Utils.escapeHtml(inv.serviceName || 'Service')}">${Utils.escapeHtml(inv.serviceName || 'Service')}</div>
                        <div class="table-subtext table-cell-truncate" style="max-width:240px;">
                          <span>${Utils.escapeHtml(inv.invoiceNumber)}</span>
                          ${inv.notes ? ` • <span title="${Utils.escapeHtml(inv.notes)}">${Utils.escapeHtml(inv.notes)}</span>` : ''}
                        </div>
                      </td>
                      <td style="white-space:nowrap;">
                        <span class="badge badge-neutral"><span class="badge-dot"></span>${typeBadge}</span>
                      </td>
                      <td style="white-space:nowrap;">
                        <span>${Utils.formatMonth(inv.billingMonth)}</span>
                        <span class="table-subtext" style="display:block;">Due ${Utils.formatDate(inv.dueDate)}</span>
                      </td>
                      <td class="tabular-nums" style="font-weight:600;white-space:nowrap;">
                        ${Utils.formatCurrency(inv.amount)}
                      </td>
                      <td style="white-space:nowrap;">
                        ${statusBadge}
                      </td>
                      <td style="text-align:right;white-space:nowrap;">
                        <div class="dropdown">
                          <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'svcActionsMenu_inv_${inv.id}')" title="Service Actions" aria-label="Service actions" style="width:30px;height:30px;">
                            <i data-lucide="more-vertical" style="width:16px;height:16px;"></i>
                          </button>
                          <div id="svcActionsMenu_inv_${inv.id}" class="dropdown-menu">
                            ${remPaise > 0 ? `
                              <button type="button" class="dropdown-item" onclick="Payments.openRecordPaymentModal('${inv.id}')">
                                <i data-lucide="plus-circle"></i> Record Payment
                              </button>
                            ` : ''}
                            <button type="button" class="dropdown-item" onclick="Payments.viewInvoiceHistory('${inv.id}')">
                              <i data-lucide="history"></i> Payment History
                            </button>
                            <div class="dropdown-divider"></div>
                            <button type="button" class="dropdown-item text-danger" onclick="Payments.confirmDeleteInvoice('${inv.id}')">
                              <i data-lucide="trash-2"></i> Delete Charge / Bill
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Invoices & Charges History -->
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2);">
          <div class="card-title">Invoices & Charges (${invoices.length})</div>
          <button class="btn btn-secondary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}')">
            <i data-lucide="plus"></i> New Charge
          </button>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Service / Charge</th>
                <th>Month</th>
                <th>Amount</th>
                <th>Status</th>
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-6);">No invoices or charges recorded for this client yet.</td>
                </tr>
              ` : invoices.map((inv) => {
                const remPaise = Utils.toPaise(inv.amount) - Utils.toPaise(inv.paidAmount || 0);
                return `
                  <tr>
                    <td class="tabular-nums" style="font-weight:600;white-space:nowrap;">${inv.invoiceNumber}</td>
                    <td>
                      <div class="table-cell-truncate" style="font-weight:500;max-width:220px;" title="${Utils.escapeHtml(inv.serviceName || 'Service')}">${Utils.escapeHtml(inv.serviceName || 'Service')}</div>
                      ${inv.notes ? `<div class="table-subtext table-cell-truncate" style="max-width:220px;" title="${Utils.escapeHtml(inv.notes)}">${Utils.escapeHtml(inv.notes)}</div>` : ''}
                    </td>
                    <td style="white-space:nowrap;">${Utils.formatMonth(inv.billingMonth)}</td>
                    <td class="tabular-nums" style="font-weight:600;white-space:nowrap;">${Utils.formatCurrency(inv.amount)}</td>
                    <td style="white-space:nowrap;">
                      ${inv.status === 'paid' ? '<span class="badge badge-success"><span class="badge-dot"></span>Paid</span>' : (inv.status === 'partial' ? '<span class="badge badge-warning"><span class="badge-dot"></span>Partial</span>' : '<span class="badge badge-danger"><span class="badge-dot"></span>Pending</span>')}
                    </td>
                    <td style="text-align:right;white-space:nowrap;">
                      <div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px;">
                        ${remPaise > 0 ? `
                          <button class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${inv.id}')" title="Record Payment" style="padding:2px 10px;height:28px;font-size:12px;display:inline-flex;align-items:center;gap:4px;">
                            <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> Pay
                          </button>
                        ` : `
                          <span class="badge badge-neutral" style="font-size:11px;">Settled</span>
                        `}
                        <div class="dropdown">
                          <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'invActionMenu_${inv.id}')" title="More options" aria-label="More options" style="width:28px;height:28px;">
                            <i data-lucide="more-vertical" style="width:14px;height:14px;"></i>
                          </button>
                          <div id="invActionMenu_${inv.id}" class="dropdown-menu">
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
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Payment Transactions History -->
      <div class="card" style="margin-bottom:var(--space-6);">
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
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-6);">No payment transactions recorded for this client yet.</td>
                </tr>
              ` : payments.map((p) => `
                <tr>
                  <td style="white-space:nowrap;">${Utils.formatDate(p.paymentDate)}</td>
                  <td class="tabular-nums" style="font-weight:600;color:var(--color-success);white-space:nowrap;">${Utils.formatCurrency(p.amount)}</td>
                  <td style="white-space:nowrap;">${Utils.escapeHtml(p.paymentMethod)}</td>
                  <td style="white-space:nowrap;">${Utils.escapeHtml(p.invoiceNumber || p.billingMonth)}</td>
                  <td class="table-subtext table-cell-truncate" style="max-width:220px;" title="${Utils.escapeHtml(p.notes || '')}">${p.notes ? Utils.escapeHtml(p.notes) : '—'}</td>
                  <td style="text-align:right;white-space:nowrap;">
                    <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Payments.confirmDeletePayment('${p.id}')" title="Delete Payment Transaction" style="color:var(--color-danger);height:26px;width:26px;padding:0;display:inline-flex;align-items:center;justify-content:center;">
                      <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

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

      if (res.action === 'deleted') {
        if (window.App && App.activePage === 'client-detail') {
          App.navigateTo('clients');
        }
      } else if (this.activeDetailClientId === clientId) {
        this.renderClientDetailPage(clientId);
      }
    }
  },

  async toggleRetainerStatus(clientId) {
    const client = Storage.getClientById(clientId);
    if (!client || !client.monthlyAmount || client.monthlyAmount <= 0) return;

    const isPaused = client.retainerStatus === 'paused';
    const newStatus = isPaused ? 'active' : 'paused';

    if (!isPaused) {
      const confirmed = await Utils.confirm({
        title: 'Pause Monthly Retainer?',
        message: `Pause monthly recurring retainer (${Utils.formatCurrency(client.monthlyAmount)} / mo) for "${client.name}"? While paused, automated monthly billing will be temporarily suspended for this client.`,
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

    this.render();
    if (this.activeDetailClientId === clientId) {
      this.renderClientDetailPage(clientId);
    }
    if (window.Payments) Payments.render();
  },

  async removeRetainer(clientId) {
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

    Utils.showToast(`Monthly retainer deleted for ${client.name}`, 'success');

    this.render();
    if (this.activeDetailClientId === clientId) {
      this.renderClientDetailPage(clientId);
    }
    if (window.Payments) Payments.render();
  }
};

window.Clients = Clients;
