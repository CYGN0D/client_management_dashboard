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
        menu.style.right = '';
        menu.style.width = '';
        menu.style.maxWidth = '';
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

  clientsListViewMode: (function() {
    try {
      return localStorage.getItem('cliento_clients_list_view_mode') || 'table';
    } catch (e) {
      return 'table';
    }
  })(),

  setClientsListViewMode(mode) {
    this.clientsListViewMode = mode === 'grid' ? 'grid' : 'table';
    try {
      localStorage.setItem('cliento_clients_list_view_mode', this.clientsListViewMode);
    } catch (e) {}

    const tableContainer = document.getElementById('clientsTableViewContainer');
    const gridContainer = document.getElementById('clientsGridViewContainer');
    if (tableContainer && gridContainer) {
      tableContainer.style.display = this.clientsListViewMode === 'table' ? 'block' : 'none';
      gridContainer.style.display = this.clientsListViewMode === 'grid' ? 'grid' : 'none';
    }
    document.querySelectorAll('#clientsViewSwitcher .view-switch-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === this.clientsListViewMode);
    });
    Utils.refreshIcons();
  },

  getServicesPopupHtml(clientName, serviceList) {
    return `
      <div class="table-data-popup-header">
        <span class="table-data-popup-title">${Utils.escapeHtml(clientName || 'Client')} Services</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="table-data-popup-badge">${serviceList.length} Total</span>
          <button type="button" class="table-data-popup-close" title="Close" aria-label="Close">×</button>
        </div>
      </div>
      <div class="table-data-popup-tags">
        ${serviceList.map((s) => `
          <div class="table-data-popup-tag">
            <span class="badge-dot" style="background:#38BDF8;margin-right:6px;width:6px;height:6px;border-radius:50%;flex-shrink:0;"></span>
            <span>${Utils.escapeHtml(s)}</span>
          </div>
        `).join('')}
      </div>
    `.trim();
  },

  renderServiceChips(serviceList, maxVisible = 1, clientName = '', isTiny = false) {
    if (!serviceList || serviceList.length === 0) {
      return `<span class="table-secondary-text">—</span>`;
    }

    const popupHtml = this.getServicesPopupHtml(clientName, serviceList);
    const tagClass = isTiny ? 'client-service-tag-tiny' : 'client-service-tag';
    const moreClass = isTiny ? 'client-service-tag-tiny client-service-more' : 'client-service-tag client-service-more';

    if (serviceList.length <= maxVisible) {
      return serviceList.map((s) => `<span class="${tagClass}" title="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</span>`).join('');
    }

    const visibleTags = serviceList.slice(0, maxVisible).map((s) => `<span class="${tagClass}" title="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</span>`).join('');
    const extraCount = serviceList.length - maxVisible;
    const moreTag = `<button type="button" class="${moreClass}" data-table-popup="${Utils.escapeHtml(popupHtml)}" title="Click to view all ${serviceList.length} services" style="cursor:pointer;">+${extraCount} more</button>`;

    return `${visibleTags}${moreTag}`;
  },

  renderTable() {
    const tbody = document.getElementById('clientsTableBody');
    const gridContainer = document.getElementById('clientsGridViewContainer');
    if (!tbody) return;

    const clients = this.getFilteredClients();
    if (clients.length === 0) {
      const emptyHtml = `
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
      `;
      tbody.innerHTML = `<tr><td colspan="5">${emptyHtml}</td></tr>`;
      if (gridContainer) gridContainer.innerHTML = emptyHtml;
      this.setClientsListViewMode(this.clientsListViewMode);
      Utils.refreshIcons();
      return;
    }

    // Render Streamlined Modern Senior Data Table
    tbody.innerHTML = clients.map((client) => {
      const isStatusActive = client.status === 'active';
      const statusBadge = isStatusActive
        ? `<span class="badge badge-success"><span class="badge-dot"></span>Active</span>`
        : `<span class="badge badge-neutral"><span class="badge-dot"></span>Inactive</span>`;

      const hasRetainer = Boolean(client.monthlyAmount && client.monthlyAmount > 0);
      const isRetainerPaused = hasRetainer && client.retainerStatus === 'paused';

      const initials = this.getClientInitials(client.name);
      const avatarColor = this.getAvatarColor(client.name);

      const serviceList = (client.service || 'General Service')
        .split(/[,+&•]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const contactParts = [client.company, client.email, client.phone].filter(Boolean);

      // Rich data popups for extra details inspection
      const clientPopupHtml = `
        <div class="table-data-popup-header">
          <span class="table-data-popup-title">${Utils.escapeHtml(client.name)}</span>
          <span class="table-data-popup-badge">${isStatusActive ? 'Active Client' : 'Inactive'}</span>
        </div>
        ${client.company ? `<div class="table-data-popup-row"><span>Company</span><span>${Utils.escapeHtml(client.company)}</span></div>` : ''}
        ${client.email ? `<div class="table-data-popup-row"><span>Email</span><span>${Utils.escapeHtml(client.email)}</span></div>` : ''}
        ${client.phone ? `<div class="table-data-popup-row"><span>Phone</span><span>${Utils.escapeHtml(client.phone)}</span></div>` : ''}
        ${client.joiningDate ? `<div class="table-data-popup-row"><span>Joined</span><span>${Utils.formatDate(client.joiningDate)}</span></div>` : ''}
        ${serviceList.length ? `<div class="table-data-popup-tags">${serviceList.map((s) => `<span class="table-data-popup-tag">${Utils.escapeHtml(s)}</span>`).join('')}</div>` : ''}
      `.trim();

      const servicesPopupHtml = `
        <div class="table-data-popup-header">
          <span class="table-data-popup-title">${Utils.escapeHtml(client.name)}</span>
          <span class="table-data-popup-badge">${serviceList.length} Services</span>
        </div>
        <div class="table-data-popup-tags">
          ${serviceList.map((s) => `<span class="table-data-popup-tag">${Utils.escapeHtml(s)}</span>`).join('')}
        </div>
      `.trim();

      const retainerPopupHtml = hasRetainer ? `
        <div class="table-data-popup-header">
          <span class="table-data-popup-title">Monthly Retainer</span>
          <span class="table-data-popup-badge">${isRetainerPaused ? 'Paused' : 'Active'}</span>
        </div>
        <div class="table-data-popup-row"><span>Monthly Rate</span><span>${Utils.formatCurrency(client.monthlyAmount)} / mo</span></div>
        <div class="table-data-popup-row"><span>Billing Schedule</span><span>Day ${client.dueDay || 5} of every month</span></div>
        <div class="table-data-popup-row"><span>Status</span><span>${isRetainerPaused ? 'Subscription Paused' : 'Subscription Active'}</span></div>
      `.trim() : '';

      const servicesCellHtml = `
        <div class="table-tags-line">
          ${this.renderServiceChips(serviceList, 2, client.name, false)}
        </div>
      `;

      const monthlyCellHtml = hasRetainer ? `
        <div class="table-single-line" style="cursor:pointer;" onclick="Clients.viewClientDetails('${client.id}', 'services')" data-table-popup="${Utils.escapeHtml(retainerPopupHtml)}" title="${Utils.formatCurrency(client.monthlyAmount)} / mo • Day ${client.dueDay || 5}">
          <span class="tabular-nums font-semibold" style="color:var(--color-text-primary);font-size:13.5px;">${Utils.formatCurrency(client.monthlyAmount)}</span>
          <span style="font-size:11.5px;color:var(--color-text-muted);">/ mo</span>
          <span class="table-bullet">•</span>
          <span class="table-subtext-inline">Day ${client.dueDay || 5}</span>
          ${isRetainerPaused ? ' <span class="badge badge-warning" style="font-size:10px;padding:1px 5px;margin-left:2px;"><span class="badge-dot"></span>Paused</span>' : ''}
        </div>
      ` : `
        <span class="badge badge-neutral" style="font-size:11px;">Ad-hoc Project</span>
      `;

      return `
        <tr>
          <td>
            <div class="table-single-line" style="cursor:pointer;" onclick="Clients.viewClientDetails('${client.id}')" data-table-popup="${Utils.escapeHtml(clientPopupHtml)}" title="${Utils.escapeHtml(client.name + (contactParts.length ? ` • ${contactParts.join(' • ')}` : ''))}">
              <div class="table-avatar-sm" style="background:${avatarColor.bg};color:${avatarColor.text};border:1px solid ${avatarColor.border};">
                ${initials}
              </div>
              <span style="font-weight:600;color:var(--color-text-primary);font-size:13.5px;">${Utils.escapeHtml(client.name)}</span>
              ${client.company ? `<span class="table-bullet">•</span><span class="table-secondary-text" style="max-width:140px;">${Utils.escapeHtml(client.company)}</span>` : ''}
            </div>
          </td>
          <td>
            ${servicesCellHtml}
          </td>
          <td>
            ${monthlyCellHtml}
          </td>
          <td>
            ${statusBadge}
          </td>
          <td style="text-align:right;">
            <div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px;">
              <button class="btn btn-secondary btn-sm" onclick="Clients.viewClientDetails('${client.id}')" title="View Dossier" style="height:28px;padding:0 8px;font-size:11.5px;display:inline-flex;align-items:center;gap:4px;">
                <i data-lucide="eye" style="width:13px;height:13px;"></i> View
              </button>
              <div class="dropdown">
                <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, '${client.id}')" title="More options" aria-label="More options" style="width:28px;height:28px;">
                  <i data-lucide="more-vertical" style="width:13px;height:13px;"></i>
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

    // Render Senior SaaS Caliber Cards Grid
    if (gridContainer) {
      gridContainer.innerHTML = clients.map((client) => {
        const isStatusActive = client.status === 'active';
        const statusBadge = isStatusActive
          ? `<span class="badge badge-success"><span class="badge-dot"></span>Active</span>`
          : `<span class="badge badge-neutral"><span class="badge-dot"></span>Inactive</span>`;

        const hasRetainer = Boolean(client.monthlyAmount && client.monthlyAmount > 0);
        const isRetainerPaused = hasRetainer && client.retainerStatus === 'paused';
        const initials = this.getClientInitials(client.name);
        const avatarColor = this.getAvatarColor(client.name);

        const serviceList = (client.service || 'General Service')
          .split(/[,+&•]/)
          .map((s) => s.trim())
          .filter(Boolean);

        return `
          <div class="client-grid-card">
            <div class="client-grid-header">
              <div class="client-grid-identity" onclick="Clients.viewClientDetails('${client.id}')" style="cursor:pointer;">
                <div class="client-grid-avatar" style="background:${avatarColor.bg};color:${avatarColor.text};border-color:${avatarColor.border};">
                  ${initials}
                </div>
                <div class="client-grid-meta">
                  <div class="client-grid-name" title="${Utils.escapeHtml(client.name)}">
                    ${Utils.escapeHtml(client.name)}
                  </div>
                  ${client.company ? `<div class="client-grid-company">${Utils.escapeHtml(client.company)}</div>` : ''}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                ${statusBadge}
                <div class="dropdown">
                  <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'cardClient_${client.id}')" title="Actions" style="width:28px;height:28px;">
                    <i data-lucide="more-vertical" style="width:13px;height:13px;"></i>
                  </button>
                  <div id="cardClient_${client.id}" class="dropdown-menu">
                    <button type="button" class="dropdown-item" onclick="Payments.openCreateInvoiceModal('${client.id}')">
                      <i data-lucide="receipt"></i> Add Charge / Invoice
                    </button>
                    <button type="button" class="dropdown-item" onclick="Clients.openAddEditModal('${client.id}')">
                      <i data-lucide="edit-2"></i> Edit Profile
                    </button>
                    <div class="dropdown-divider"></div>
                    <button type="button" class="dropdown-item text-danger" onclick="Clients.confirmDeleteClient('${client.id}')">
                      <i data-lucide="${isStatusActive ? 'user-x' : 'trash-2'}"></i> ${isStatusActive ? 'Deactivate' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="client-grid-body">
              <div class="client-grid-rate-row" style="cursor:pointer;" onclick="Clients.viewClientDetails('${client.id}', 'services')" title="View retainer plan & services">
                <div class="client-grid-rate tabular-nums">
                  ${hasRetainer 
                    ? `${Utils.formatCurrency(client.monthlyAmount)} <small style="font-size:12px;color:var(--color-text-muted);font-weight:500;">/ mo</small>` 
                    : '<span style="font-size:13px;color:var(--color-text-secondary);font-weight:500;">Ad-hoc Project Billing</span>'}
                </div>
                ${isRetainerPaused ? '<span class="badge badge-warning" style="font-size:10px;padding:1px 5px;"><span class="badge-dot"></span>Paused</span>' : ''}
              </div>

              <div class="client-grid-chips">
                ${this.renderServiceChips(serviceList, 2, client.name, false)}
              </div>

              ${(client.phone || client.email) ? `
                <div class="client-grid-contact-row">
                  ${client.phone ? `
                    <span class="client-grid-contact-item" title="Phone: ${Utils.escapeHtml(client.phone)}">
                      <i data-lucide="phone" style="width:11px;height:11px;"></i> ${Utils.escapeHtml(client.phone)}
                    </span>
                  ` : ''}
                  ${client.email ? `
                    <span class="client-grid-contact-item" title="Email: ${Utils.escapeHtml(client.email)}">
                      <i data-lucide="mail" style="width:11px;height:11px;"></i> ${Utils.escapeHtml(client.email)}
                    </span>
                  ` : ''}
                </div>
              ` : ''}
            </div>

            <div class="client-grid-footer">
              <button type="button" class="btn btn-secondary btn-sm w-full" onclick="Clients.viewClientDetails('${client.id}')" style="height:32px;font-size:12px;font-weight:500;">
                <i data-lucide="arrow-right"></i> View Dossier
              </button>
              <button type="button" class="btn btn-primary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}')" title="Add Charge" style="height:32px;padding:0 10px;font-size:12px;">
                <i data-lucide="plus"></i> Add
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    this.setClientsListViewMode(this.clientsListViewMode);
    Utils.refreshIcons();
  },

  toggleActionMenu(event, targetId) {
    event.stopPropagation();
    const menuId = (typeof targetId === 'string' && (targetId.includes('_') || targetId.startsWith('menu') || targetId.startsWith('card') || targetId.startsWith('svc')))
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
      m.style.right = '';
      m.style.width = '';
      m.style.maxWidth = '';
    });

    if (!isOpen) {
      targetMenu.classList.add('show');

      const triggerBtn = event.currentTarget || event.target.closest('button');
      const isInTable = triggerBtn && triggerBtn.closest('table');

      if (isInTable) {
        // Table context: use fixed positioning to avoid overflow-x: auto clipping
        targetMenu.style.position = 'fixed';
        targetMenu.style.width = 'max-content';
        targetMenu.style.maxWidth = '210px';

        const rect = triggerBtn.getBoundingClientRect();
        const menuWidth = Math.min(targetMenu.offsetWidth || 180, 210);
        const menuHeight = targetMenu.offsetHeight || 140;

        let left = rect.right - menuWidth;
        if (left < 10) left = 10;
        if (left + menuWidth > window.innerWidth - 10) {
          left = window.innerWidth - menuWidth - 10;
        }

        let top = rect.bottom + 4;
        if (top + menuHeight > window.innerHeight - 10 && rect.top - menuHeight - 4 > 10) {
          top = rect.top - menuHeight - 4;
        }

        targetMenu.style.top = `${top}px`;
        targetMenu.style.left = `${left}px`;
        targetMenu.style.width = `${menuWidth}px`;
        targetMenu.style.maxWidth = '210px';
        targetMenu.style.zIndex = '1050';
      } else {
        // Card or general context: standard rock-solid absolute positioning anchored directly to .dropdown
        targetMenu.style.position = 'absolute';
        targetMenu.style.right = '0';
        targetMenu.style.top = '100%';
        targetMenu.style.left = 'auto';
        targetMenu.style.marginTop = '4px';
        targetMenu.style.width = 'max-content';
        targetMenu.style.maxWidth = '210px';
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

  viewClientDetails(clientId, targetTab = 'invoices') {
    document.querySelectorAll('.dropdown-menu.show').forEach((m) => m.classList.remove('show'));
    const client = Storage.getClientById(clientId);
    if (!client) return;

    this.activeDetailClientId = clientId;
    this.activeDetailTab = targetTab || 'invoices';
    if (window.App) {
      App.navigateTo('client-detail');
    } else {
      this.renderClientDetailPage(clientId);
    }
  },

  activeDetailTab: 'invoices',

  detailViewMode: (function() {
    try {
      return localStorage.getItem('cliento_detail_view_mode') || 'table';
    } catch (e) {
      return 'table';
    }
  })(),

  setDetailViewMode(mode) {
    this.detailViewMode = mode === 'cards' ? 'cards' : 'table';
    try {
      localStorage.setItem('cliento_detail_view_mode', this.detailViewMode);
    } catch (e) {}

    const card = document.querySelector('.client-ledger-card');
    if (card) {
      card.classList.toggle('view-table', this.detailViewMode === 'table');
      card.classList.toggle('view-cards', this.detailViewMode === 'cards');
    }
    document.querySelectorAll('.client-ledger-header .view-switch-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === this.detailViewMode);
    });
    Utils.refreshIcons();
  },

  getClientInitials(name) {
    if (!name) return 'CL';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  getAvatarColor(name) {
    const palettes = [
      { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563EB', border: 'rgba(59, 130, 246, 0.28)' }, // Blue
      { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.28)' }, // Emerald
      { bg: 'rgba(139, 92, 246, 0.12)', text: '#7C3AED', border: 'rgba(139, 92, 246, 0.28)' }, // Purple
      { bg: 'rgba(245, 158, 11, 0.12)', text: '#D97706', border: 'rgba(245, 158, 11, 0.28)' }, // Amber
      { bg: 'rgba(236, 72, 153, 0.12)', text: '#DB2777', border: 'rgba(236, 72, 153, 0.28)' }, // Pink
      { bg: 'rgba(14, 165, 233, 0.12)', text: '#0284C7', border: 'rgba(14, 165, 233, 0.28)' }, // Cyan
      { bg: 'rgba(99, 102, 241, 0.12)', text: '#4F46E5', border: 'rgba(99, 102, 241, 0.28)' }  // Indigo
    ];
    let hash = 0;
    const str = name || 'Client';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palettes[Math.abs(hash) % palettes.length];
  },

  switchDetailTab(tabName) {
    const validTabs = ['invoices', 'payments', 'services'];
    if (!validTabs.includes(tabName)) tabName = 'invoices';
    this.activeDetailTab = tabName;
    const container = document.getElementById('clientDetailPageContent');
    if (!container) return;
    container.querySelectorAll('.client-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    container.querySelectorAll('.client-tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `clientTabPanel_${tabName}`);
    });
    Utils.refreshIcons();
  },

  openSettingsModal(clientId) {
    const client = Storage.getClientById(clientId);
    if (!client) return;

    const invoices = Storage.getInvoices().filter((inv) => inv.clientId === clientId);
    const payments = Storage.getPayments().filter((p) => p.clientId === clientId);
    const isStatusActive = client.status === 'active';

    let totalBilledPaise = 0;
    invoices.forEach((inv) => {
      totalBilledPaise += Utils.toPaise(inv.totalAmount || inv.amount || 0);
    });
    let totalPaidPaise = 0;
    payments.forEach((p) => {
      totalPaidPaise += Utils.toPaise(p.amount || 0);
    });

    const modalBody = document.getElementById('clientSettingsModalBody');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:var(--space-4);padding-bottom:var(--space-4);border-bottom:1px solid var(--color-border);">
          <div style="width:44px;height:44px;border-radius:10px;background:var(--color-bg-secondary);border:1px solid var(--color-border);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:var(--color-text-primary);">
            ${this.getClientInitials(client.name)}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:15px;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${Utils.escapeHtml(client.name)}
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
              <span class="badge ${isStatusActive ? 'badge-success' : 'badge-neutral'}">
                <span class="badge-dot"></span>${isStatusActive ? 'Active' : 'Inactive'}
              </span>
              <span style="font-size:12px;color:var(--color-text-muted);">Joined ${Utils.formatDate(client.joiningDate)}</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom:var(--space-4);">
          <label class="form-label" style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:var(--color-text-muted);margin-bottom:6px;">Client ID</label>
          <div style="display:flex;align-items:center;gap:8px;background:var(--color-bg-secondary);padding:8px 12px;border-radius:var(--radius-md);border:1px solid var(--color-border);">
            <code style="font-family:monospace;font-size:12px;color:var(--color-text-primary);flex:1;word-break:break-all;">${client.id}</code>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Utils.copyToClipboard('${client.id}', 'Client ID copied')" style="height:28px;padding:0 8px;font-size:11.5px;">
              <i data-lucide="copy" style="width:13px;height:13px;"></i> Copy
            </button>
          </div>
        </div>

        <div style="margin-bottom:var(--space-5);">
          <label class="form-label" style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:var(--color-text-muted);margin-bottom:8px;">Financial Audit</label>
          <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:8px;">
            <div class="client-kpi-item interactive" style="background:var(--color-bg-secondary);padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--color-border-subtle);cursor:pointer;" onclick="Clients.closeSettingsModal(); Clients.switchDetailTab('invoices');" title="View all invoices">
              <div style="font-size:11px;color:var(--color-text-muted);display:flex;align-items:center;justify-content:space-between;">
                <span>Invoices Billed</span>
                <i data-lucide="arrow-right" style="width:12px;height:12px;opacity:0.6;"></i>
              </div>
              <div style="font-size:14px;font-weight:700;color:var(--color-text-primary);margin-top:2px;">${invoices.length} (${Utils.formatCurrency(Utils.fromPaise(totalBilledPaise))})</div>
            </div>
            <div class="client-kpi-item interactive" style="background:var(--color-bg-secondary);padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--color-border-subtle);cursor:pointer;" onclick="Clients.closeSettingsModal(); Clients.switchDetailTab('payments');" title="View settled payments">
              <div style="font-size:11px;color:var(--color-text-muted);display:flex;align-items:center;justify-content:space-between;">
                <span>Payments Settled</span>
                <i data-lucide="arrow-right" style="width:12px;height:12px;opacity:0.6;"></i>
              </div>
              <div style="font-size:14px;font-weight:700;color:var(--color-success);margin-top:2px;">${payments.length} (${Utils.formatCurrency(Utils.fromPaise(totalPaidPaise))})</div>
            </div>
          </div>
        </div>

        <!-- Danger Zone -->
        <div style="border:1px solid var(--color-danger);background:rgba(239, 68, 68, 0.04);border-radius:var(--radius-md);padding:14px;">
          <div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px;color:var(--color-danger);margin-bottom:4px;">
            <i data-lucide="alert-triangle" style="width:15px;height:15px;"></i> Account Controls & Danger Zone
          </div>
          <p style="font-size:12px;color:var(--color-text-secondary);line-height:1.4;margin-bottom:12px;">
            ${invoices.length > 0 || payments.length > 0
              ? 'Deactivating this client suspends automated billing while preserving complete historical invoices and payment audit logs.'
              : 'Permanently remove this client record and associated configurations.'}
          </p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${!isStatusActive ? `
              <button type="button" class="btn btn-secondary btn-sm w-full" onclick="Clients.reactivateClient('${client.id}')">
                <i data-lucide="check-circle"></i> Reactivate Client Account
              </button>
            ` : ''}
            <button type="button" class="btn ${isStatusActive ? 'btn-secondary' : 'btn-danger'} btn-sm w-full" onclick="Clients.closeSettingsModal(); Clients.confirmDeleteClient('${client.id}')" style="${isStatusActive ? 'color:var(--color-danger);border-color:var(--color-danger);' : ''}">
              <i data-lucide="${isStatusActive ? 'user-x' : 'trash-2'}"></i> ${isStatusActive ? 'Deactivate Client' : 'Delete Client Permanently'}
            </button>
          </div>
        </div>
      `;
    }

    Utils.openModal('clientSettingsModal');
    Utils.refreshIcons();
  },

  closeSettingsModal() {
    Utils.closeModal('clientSettingsModal');
  },

  reactivateClient(clientId) {
    Storage.updateClient(clientId, { status: 'active' });
    Utils.showToast('Client reactivated successfully.', 'success');
    this.closeSettingsModal();
    this.render();
    if (this.activeDetailClientId === clientId) {
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

    this.activeDetailClientId = clientId;

    // Backward compatibility hooks (if elements exist in DOM)
    const titleEl = document.getElementById('clientDetailPageTitle');
    const badgeEl = document.getElementById('clientDetailPageBadge');
    const subtitleEl = document.getElementById('clientDetailPageSubtitle');
    const actionsEl = document.getElementById('clientDetailPageActions');
    const contentEl = document.getElementById('clientDetailPageContent');
    if (!contentEl) return;

    if (titleEl) titleEl.textContent = client.name;

    const isStatusActive = client.status === 'active';
    const statusBadge = isStatusActive
      ? '<span class="badge badge-success"><span class="badge-dot"></span>Active</span>'
      : '<span class="badge badge-neutral"><span class="badge-dot"></span>Inactive</span>';

    if (badgeEl) badgeEl.innerHTML = statusBadge;
    if (subtitleEl) subtitleEl.textContent = `${client.service || 'Client'} · Joined ${Utils.formatDate(client.joiningDate)}`;

    // Calculate Invoices, Payments, and Retainers
    const invoices = Storage.getInvoices().filter((inv) => inv.clientId === clientId);
    const payments = Storage.getPayments().filter((p) => p.clientId === clientId);

    const totalBilledPaise = invoices.reduce((acc, inv) => acc + Utils.toPaise(inv.amount), 0);
    const totalPaidPaise = payments.reduce((acc, p) => acc + Utils.toPaise(p.amount), 0);
    const outstandingPaise = Math.max(totalBilledPaise - totalPaidPaise, 0);

    const hasMonthly = Boolean(client.monthlyAmount && client.monthlyAmount > 0);
    const oneTimeServices = invoices.filter((inv) => inv.chargeType !== 'retainer');
    const totalServicesCount = (hasMonthly ? 1 : 0) + oneTimeServices.length;

    const settlementPct = totalBilledPaise > 0 
      ? Math.min(100, Math.round((totalPaidPaise / totalBilledPaise) * 100)) 
      : 100;

    const unpaidInvoices = invoices.filter((inv) => {
      const rem = Utils.toPaise(inv.amount) - Utils.toPaise(inv.paidAmount || 0);
      return rem > 0;
    });

    const initials = this.getClientInitials(client.name);
    const avatarColor = this.getAvatarColor(client.name);
    const activeTab = this.activeDetailTab || 'invoices';

    // Parse services into tags
    const serviceList = (client.service || 'General Service')
      .split(/[,+&•]/)
      .map((s) => s.trim())
      .filter(Boolean);

    // Render helper: Invoices Table (Senior Minimalist Stripe-style)
    const renderInvoicesTable = () => {
      if (invoices.length === 0) {
        return `
          <div class="table-empty-box">
            <div class="table-empty-icon"><i data-lucide="receipt"></i></div>
            <div class="table-empty-title">No Invoices Yet</div>
            <div class="table-empty-desc">Create your first monthly retainer or one-off project bill for ${Utils.escapeHtml(client.name)}.</div>
            <button type="button" class="btn btn-primary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}')">
              <i data-lucide="plus"></i> Create Invoice
            </button>
          </div>
        `;
      }

      return `
        <div class="table-responsive">
          <table class="table-streamlined">
            <thead>
              <tr>
                <th style="min-width:140px;">Invoice</th>
                <th style="min-width:130px;">Billing Cycle</th>
                <th style="min-width:100px;">Status</th>
                <th style="min-width:130px;text-align:right;">Amount</th>
                <th style="min-width:110px;text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map((inv) => {
                const invPaise = Utils.toPaise(inv.amount);
                const paidPaise = Utils.toPaise(inv.paidAmount || 0);
                const remPaise = Math.max(invPaise - paidPaise, 0);

                let badgeHtml = '';
                if (inv.status === 'paid') {
                  badgeHtml = '<span class="badge badge-success"><span class="badge-dot"></span>Paid</span>';
                } else if (inv.status === 'partial') {
                  badgeHtml = '<span class="badge badge-warning"><span class="badge-dot"></span>Partial</span>';
                } else if (inv.status === 'overdue' || inv.isOverdue) {
                  badgeHtml = '<span class="badge badge-danger"><span class="badge-dot"></span>Overdue</span>';
                } else {
                  badgeHtml = '<span class="badge badge-neutral"><span class="badge-dot"></span>Pending</span>';
                }

                const invPopupHtml = `
                  <div class="table-data-popup-header">
                    <span class="table-data-popup-title">${Utils.escapeHtml(inv.invoiceNumber)}</span>
                    <span class="table-data-popup-badge">${inv.status.toUpperCase()}</span>
                  </div>
                  <div class="table-data-popup-row"><span>Service</span><span>${Utils.escapeHtml(inv.serviceName || 'Service')}</span></div>
                  <div class="table-data-popup-row"><span>Billing Month</span><span>${Utils.formatMonth(inv.billingMonth)}</span></div>
                  <div class="table-data-popup-row"><span>Due Date</span><span>${Utils.formatDate(inv.dueDate)}</span></div>
                  <div class="table-data-popup-row"><span>Total Amount</span><span>${Utils.formatCurrency(inv.amount)}</span></div>
                  <div class="table-data-popup-row"><span>Paid</span><span>${Utils.formatCurrency(inv.paidAmount || 0)}</span></div>
                  <div class="table-data-popup-row"><span>Remaining Due</span><span>${Utils.formatCurrency(Utils.fromPaise(remPaise))}</span></div>
                  ${inv.notes ? `<div class="table-data-popup-row"><span>Notes</span><span>${Utils.escapeHtml(inv.notes)}</span></div>` : ''}
                `.trim();

                return `
                  <tr>
                    <td>
                      <div class="table-single-line" data-table-popup="${Utils.escapeHtml(invPopupHtml)}" title="${Utils.escapeHtml(inv.invoiceNumber)} • ${Utils.escapeHtml(inv.serviceName || 'Service')}">
                        <span class="ledger-badge-code data-code-link" onclick="Payments.viewInvoiceHistory('${inv.id}')" title="View invoice payment history">${Utils.escapeHtml(inv.invoiceNumber)}</span>
                        <span class="table-bullet">•</span>
                        <span class="table-secondary-text" style="max-width:180px;">${Utils.escapeHtml(inv.serviceName || 'Service')}</span>
                      </div>
                    </td>
                    <td>
                      <div class="table-single-line" title="Billing: ${Utils.formatMonth(inv.billingMonth)} • Due: ${Utils.formatDate(inv.dueDate)}">
                        <span style="font-weight:500;">${Utils.formatMonth(inv.billingMonth)}</span>
                        <span class="table-bullet">•</span>
                        <span class="table-subtext-inline ${inv.isOverdue ? 'text-danger font-semibold' : ''}">Due ${Utils.formatDate(inv.dueDate)}</span>
                      </div>
                    </td>
                    <td>
                      ${badgeHtml}
                    </td>
                    <td style="text-align:right;">
                      <div class="table-single-line" style="justify-content:flex-end;">
                        <span class="tabular-nums" style="font-weight:700;color:var(--color-text-primary);font-size:13.5px;">${Utils.formatCurrency(inv.amount)}</span>
                        ${remPaise > 0 && paidPaise > 0 
                          ? `<span class="table-subtext-inline text-warning font-semibold" style="margin-left:4px;">(${Utils.formatCurrency(Utils.fromPaise(remPaise))} due)</span>` 
                          : ''}
                      </div>
                    </td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px;">
                        ${remPaise > 0 ? `
                          <button type="button" class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${inv.id}')" title="Record Payment" style="padding:2px 8px;height:26px;font-size:11.5px;display:inline-flex;align-items:center;gap:4px;">
                            <i data-lucide="plus-circle" style="width:12px;height:12px;"></i> Pay
                          </button>
                        ` : ''}
                        <div class="dropdown">
                          <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'invActionMenu_${inv.id}')" title="More options" aria-label="More options" style="width:26px;height:26px;">
                            <i data-lucide="more-vertical" style="width:13px;height:13px;"></i>
                          </button>
                          <div id="invActionMenu_${inv.id}" class="dropdown-menu">
                            <button type="button" class="dropdown-item" onclick="Payments.viewInvoiceHistory('${inv.id}')">
                              <i data-lucide="history"></i> Payment History
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
      `;
    };

    // Render helper: Invoices Card View (Senior SaaS Caliber)
    const renderInvoicesCards = () => {
      if (invoices.length === 0) {
        return `
          <div class="table-empty-box">
            <div class="table-empty-icon"><i data-lucide="receipt"></i></div>
            <div class="table-empty-title">No Invoices Yet</div>
            <div class="table-empty-desc">Create your first monthly retainer or one-off project bill for ${Utils.escapeHtml(client.name)}.</div>
            <button type="button" class="btn btn-primary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}')">
              <i data-lucide="plus"></i> Create Invoice
            </button>
          </div>
        `;
      }

      return `
        <div class="ledger-cards-grid">
          ${invoices.map((inv) => {
            const invPaise = Utils.toPaise(inv.amount);
            const paidPaise = Utils.toPaise(inv.paidAmount || 0);
            const remPaise = Math.max(invPaise - paidPaise, 0);

            let badgeHtml = '';
            if (inv.status === 'paid') {
              badgeHtml = '<span class="badge badge-success"><span class="badge-dot"></span>Paid</span>';
            } else if (inv.status === 'partial') {
              badgeHtml = '<span class="badge badge-warning"><span class="badge-dot"></span>Partial</span>';
            } else if (inv.status === 'overdue' || inv.isOverdue) {
              badgeHtml = '<span class="badge badge-danger"><span class="badge-dot"></span>Overdue</span>';
            } else {
              badgeHtml = '<span class="badge badge-neutral"><span class="badge-dot"></span>Pending</span>';
            }

            return `
              <div class="ledger-item-card">
                <div class="ledger-item-header">
                  <div class="ledger-item-identity">
                    <span class="ledger-badge-code data-code-link" style="cursor:pointer;" onclick="Payments.viewInvoiceHistory('${inv.id}')" title="View invoice payment history">${Utils.escapeHtml(inv.invoiceNumber)}</span>
                    ${badgeHtml}
                  </div>
                  <div class="dropdown">
                    <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'cardInvAction_${inv.id}')" title="Actions" style="width:28px;height:28px;">
                      <i data-lucide="more-vertical" style="width:14px;height:14px;"></i>
                    </button>
                    <div id="cardInvAction_${inv.id}" class="dropdown-menu">
                      <button type="button" class="dropdown-item" onclick="Payments.viewInvoiceHistory('${inv.id}')">
                        <i data-lucide="history"></i> Payment History
                      </button>
                      <div class="dropdown-divider"></div>
                      <button type="button" class="dropdown-item text-danger" onclick="Payments.confirmDeleteInvoice('${inv.id}')">
                        <i data-lucide="trash-2"></i> Delete Invoice
                      </button>
                    </div>
                  </div>
                </div>

                <div class="ledger-item-body">
                  <div class="ledger-item-title" title="${Utils.escapeHtml(inv.serviceName || 'Service')}">
                    ${Utils.escapeHtml(inv.serviceName || 'Service')}
                  </div>
                  <div class="ledger-item-meta">
                    <span class="ledger-meta-item"><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${Utils.formatMonth(inv.billingMonth)}</span>
                    <span class="ledger-meta-bullet">•</span>
                    <span class="ledger-meta-item ${inv.isOverdue ? 'text-danger' : ''}">Due ${Utils.formatDate(inv.dueDate)}</span>
                  </div>

                  <div class="ledger-item-price-row">
                    <div>
                      <div class="ledger-item-price tabular-nums">${Utils.formatCurrency(inv.amount)}</div>
                      ${remPaise > 0 && paidPaise > 0 ? `
                        <div class="ledger-item-price-subtext text-warning">${Utils.formatCurrency(Utils.fromPaise(remPaise))} due</div>
                      ` : ''}
                    </div>
                    ${remPaise > 0 ? `
                      <button type="button" class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${inv.id}')" style="height:30px;padding:0 10px;font-size:12px;font-weight:600;">
                        <i data-lucide="plus-circle" style="width:12px;height:12px;"></i> Pay
                      </button>
                    ` : `
                      <button type="button" class="btn btn-secondary btn-sm" onclick="Payments.viewInvoiceHistory('${inv.id}')" style="height:30px;padding:0 10px;font-size:12px;">
                        <i data-lucide="history" style="width:12px;height:12px;"></i> History
                      </button>
                    `}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    };

    // Render helper: Payments Table (Senior Minimalist)
    const renderPaymentsTable = () => {
      if (payments.length === 0) {
        return `
          <div class="table-empty-box">
            <div class="table-empty-icon"><i data-lucide="wallet"></i></div>
            <div class="table-empty-title">No Payments Recorded Yet</div>
            <div class="table-empty-desc">When this client pays an invoice, record settlement details (UPI, Bank Transfer, Cash) to track incoming cash flow.</div>
            ${unpaidInvoices.length > 0 ? `
              <button type="button" class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${unpaidInvoices[0].id}')">
                <i data-lucide="plus-circle"></i> Settle Open Due
              </button>
            ` : ''}
          </div>
        `;
      }

      return `
        <div class="table-responsive">
          <table class="table-streamlined">
            <thead>
              <tr>
                <th style="min-width:140px;">Date & Reference</th>
                <th style="min-width:120px;">Linked Charge</th>
                <th style="min-width:100px;">Method</th>
                <th style="min-width:120px;text-align:right;">Amount</th>
                <th style="min-width:70px;text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map((p) => {
                const payPopupHtml = `
                  <div class="table-data-popup-header">
                    <span class="table-data-popup-title">Settlement Record</span>
                    <span class="table-data-popup-badge">${Utils.escapeHtml(p.paymentMethod)}</span>
                  </div>
                  <div class="table-data-popup-row"><span>Payment Date</span><span>${Utils.formatDate(p.paymentDate)}</span></div>
                  <div class="table-data-popup-row"><span>Amount Received</span><span>+ ${Utils.formatCurrency(p.amount)}</span></div>
                  <div class="table-data-popup-row"><span>Linked Invoice</span><span>${Utils.escapeHtml(p.invoiceNumber || p.billingMonth)}</span></div>
                  ${p.notes ? `<div class="table-data-popup-row"><span>Notes</span><span>${Utils.escapeHtml(p.notes)}</span></div>` : ''}
                `.trim();

                return `
                  <tr>
                    <td>
                      <div class="table-single-line" data-table-popup="${Utils.escapeHtml(payPopupHtml)}" title="${Utils.formatDate(p.paymentDate)}${p.notes ? ` • ${Utils.escapeHtml(p.notes)}` : ''}">
                        <span class="tabular-nums" style="font-weight:600;color:var(--color-text-primary);font-size:13px;">${Utils.formatDate(p.paymentDate)}</span>
                        ${p.notes ? `<span class="table-bullet">•</span><span class="table-secondary-text" style="max-width:200px;">${Utils.escapeHtml(p.notes)}</span>` : ''}
                      </div>
                    </td>
                    <td>
                      <span class="ledger-badge-code data-code-link" style="cursor:pointer;" onclick="${p.invoiceId ? `Payments.viewInvoiceHistory('${p.invoiceId}')` : `Clients.switchDetailTab('invoices')`}" title="View linked invoice details">${Utils.escapeHtml(p.invoiceNumber || p.billingMonth)}</span>
                    </td>
                    <td>
                      <span class="badge badge-neutral">${Utils.escapeHtml(p.paymentMethod)}</span>
                    </td>
                    <td style="text-align:right;">
                      <span class="tabular-nums font-semibold" style="color:var(--color-success);font-size:13.5px;white-space:nowrap;">
                        + ${Utils.formatCurrency(p.amount)}
                      </span>
                    </td>
                    <td style="text-align:right;">
                      <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Payments.confirmDeletePayment('${p.id}')" title="Delete Payment Record" style="color:var(--color-danger);height:26px;width:26px;">
                        <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    // Render helper: Payments Card View
    const renderPaymentsCards = () => {
      if (payments.length === 0) {
        return `
          <div class="table-empty-box">
            <div class="table-empty-icon"><i data-lucide="wallet"></i></div>
            <div class="table-empty-title">No Payments Recorded Yet</div>
            <div class="table-empty-desc">When this client pays an invoice, record settlement details (UPI, Bank Transfer, Cash) to track incoming cash flow.</div>
            ${unpaidInvoices.length > 0 ? `
              <button type="button" class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${unpaidInvoices[0].id}')">
                <i data-lucide="plus-circle"></i> Settle Open Due
              </button>
            ` : ''}
          </div>
        `;
      }

      return `
        <div class="ledger-cards-grid">
          ${payments.map((p) => `
            <div class="ledger-item-card">
              <div class="ledger-item-header">
                <div class="ledger-item-identity">
                  <span class="badge badge-neutral">${Utils.escapeHtml(p.paymentMethod)}</span>
                  <span class="ledger-meta-item" style="font-size:12px;color:var(--color-text-muted);"><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${Utils.formatDate(p.paymentDate)}</span>
                </div>
                <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Payments.confirmDeletePayment('${p.id}')" title="Delete Payment Record" style="color:var(--color-danger);height:26px;width:26px;">
                  <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                </button>
              </div>

              <div class="ledger-item-body">
                <div class="ledger-item-title table-cell-truncate" title="Invoice ${Utils.escapeHtml(p.invoiceNumber || p.billingMonth)}">
                  <span class="data-link" style="cursor:pointer;" onclick="${p.invoiceId ? `Payments.viewInvoiceHistory('${p.invoiceId}')` : `Clients.switchDetailTab('invoices')`}" title="View linked invoice details">
                    Invoice ${Utils.escapeHtml(p.invoiceNumber || p.billingMonth)}
                    <i data-lucide="external-link" style="width:12px;height:12px;margin-left:4px;opacity:0.6;"></i>
                  </span>
                </div>
                <div class="ledger-item-meta table-cell-truncate">
                  ${p.notes ? Utils.escapeHtml(p.notes) : 'Standard settlement transaction'}
                </div>

                <div class="ledger-item-price-row">
                  <div class="ledger-item-price credit tabular-nums">+ ${Utils.formatCurrency(p.amount)}</div>
                  <span class="badge badge-success"><span class="badge-dot"></span>Settled</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    };

    // Render helper: Services Table (Senior Minimalist)
    const renderServicesTable = () => {
      if (totalServicesCount === 0) {
        return `
          <div class="table-empty-box">
            <div class="table-empty-icon"><i data-lucide="layers"></i></div>
            <div class="table-empty-title">No Services Configured</div>
            <div class="table-empty-desc">Configure a recurring monthly retainer plan or add project charges for ${Utils.escapeHtml(client.name)}.</div>
            <button type="button" class="btn btn-primary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}', '', 'retainer')">
              <i data-lucide="repeat"></i> Set Monthly Retainer
            </button>
          </div>
        `;
      }

      const retainerPopupHtml = hasMonthly ? `
        <div class="table-data-popup-header">
          <span class="table-data-popup-title">Monthly Retainer</span>
          <span class="table-data-popup-badge">${client.retainerStatus === 'paused' ? 'Paused' : 'Active'}</span>
        </div>
        <div class="table-data-popup-row"><span>Monthly Rate</span><span>${Utils.formatCurrency(client.monthlyAmount)} / mo</span></div>
        <div class="table-data-popup-row"><span>Billing Schedule</span><span>Day ${client.dueDay || 5} of every month</span></div>
        <div class="table-data-popup-row"><span>Services Included</span><span>${serviceList.join(', ') || 'General Retainer'}</span></div>
      `.trim() : '';

      return `
        <div class="table-responsive">
          <table class="table-streamlined">
            <thead>
              <tr>
                <th style="min-width:200px;">Service / Plan</th>
                <th style="min-width:150px;">Billing Schedule</th>
                <th style="min-width:90px;">Status</th>
                <th style="min-width:120px;text-align:right;">Rate / Fee</th>
                <th style="min-width:60px;text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${hasMonthly ? `
                <tr>
                  <td>
                    <div class="table-single-line" data-table-popup="${Utils.escapeHtml(retainerPopupHtml)}">
                      <span style="font-weight:600;color:var(--color-text-primary);font-size:13px;">Retainer Agreement</span>
                      <span class="table-bullet">•</span>
                      ${this.renderServiceChips(serviceList, 1, client.name, false)}
                    </div>
                  </td>
                  <td>
                    <div class="table-single-line">
                      <span style="font-weight:500;">Day ${client.dueDay || 5} of every month</span>
                    </div>
                  </td>
                  <td>
                    ${client.retainerStatus === 'paused' 
                      ? `<span class="badge badge-warning"><span class="badge-dot"></span>Paused</span>` 
                      : `<span class="badge badge-success"><span class="badge-dot"></span>Active</span>`}
                  </td>
                  <td style="text-align:right;">
                    <div class="tabular-nums" style="font-weight:700;font-size:13.5px;color:var(--color-text-primary);">
                      ${Utils.formatCurrency(client.monthlyAmount)} / mo
                    </div>
                  </td>
                  <td style="text-align:right;">
                    <div class="dropdown">
                      <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'svcActionsMenu_ret_${client.id}')" title="Actions" style="width:26px;height:26px;">
                        <i data-lucide="more-vertical" style="width:13px;height:13px;"></i>
                      </button>
                      <div id="svcActionsMenu_ret_${client.id}" class="dropdown-menu">
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
                const typeLabel = isAdvance ? 'Project Advance' : (inv.chargeType === 'one_time' ? 'One-Time Charge' : (inv.serviceName || 'Custom Service'));

                let statusBadge = '';
                if (inv.status === 'paid') {
                  statusBadge = '<span class="badge badge-success"><span class="badge-dot"></span>Settled</span>';
                } else if (inv.status === 'partial') {
                  statusBadge = '<span class="badge badge-warning"><span class="badge-dot"></span>Partial</span>';
                } else if (inv.status === 'overdue' || inv.isOverdue) {
                  statusBadge = '<span class="badge badge-danger"><span class="badge-dot"></span>Overdue</span>';
                } else {
                  statusBadge = '<span class="badge badge-neutral"><span class="badge-dot"></span>Pending</span>';
                }

                const invServiceList = (inv.serviceName || 'Service')
                  .split(/[,+&•]/)
                  .map((s) => s.trim())
                  .filter(Boolean);

                const invPopupHtml = `
                  <div class="table-data-popup-header">
                    <span class="table-data-popup-title">${Utils.escapeHtml(inv.invoiceNumber)}</span>
                    <span class="table-data-popup-badge">${inv.status.toUpperCase()}</span>
                  </div>
                  <div class="table-data-popup-row"><span>Charge Type</span><span>${Utils.escapeHtml(typeLabel)}</span></div>
                  <div class="table-data-popup-row"><span>Billing Month</span><span>${Utils.formatMonth(inv.billingMonth)}</span></div>
                  <div class="table-data-popup-row"><span>Due Date</span><span>${Utils.formatDate(inv.dueDate)}</span></div>
                  <div class="table-data-popup-row"><span>Amount</span><span>${Utils.formatCurrency(inv.amount)}</span></div>
                  ${remPaise > 0 ? `<div class="table-data-popup-row"><span>Remaining Due</span><span>${Utils.formatCurrency(Utils.fromPaise(remPaise))}</span></div>` : ''}
                  ${inv.notes ? `<div class="table-data-popup-row"><span>Notes</span><span>${Utils.escapeHtml(inv.notes)}</span></div>` : ''}
                  <div class="table-data-popup-row"><span>Services</span><span>${invServiceList.join(', ')}</span></div>
                `.trim();

                return `
                  <tr>
                    <td>
                      <div class="table-single-line" data-table-popup="${Utils.escapeHtml(invPopupHtml)}">
                        <span class="ledger-badge-code data-code-link" onclick="Payments.viewInvoiceHistory('${inv.id}')" title="View invoice payment history">${Utils.escapeHtml(inv.invoiceNumber)}</span>
                        <span class="table-bullet">•</span>
                        <span style="font-weight:600;color:var(--color-text-primary);font-size:13px;">${Utils.escapeHtml(typeLabel)}</span>
                        ${invServiceList.length > 0 ? `
                          <span class="table-bullet">•</span>
                          ${this.renderServiceChips(invServiceList, 1, inv.invoiceNumber, false)}
                        ` : ''}
                      </div>
                    </td>
                    <td>
                      <div class="table-single-line" title="Billing: ${Utils.formatMonth(inv.billingMonth)} • Due: ${Utils.formatDate(inv.dueDate)}">
                        <span style="font-weight:500;">${Utils.formatMonth(inv.billingMonth)}</span>
                        <span class="table-bullet">•</span>
                        <span class="table-subtext-inline">Due ${Utils.formatDate(inv.dueDate)}</span>
                      </div>
                    </td>
                    <td>
                      ${statusBadge}
                    </td>
                    <td style="text-align:right;">
                      <div class="tabular-nums" style="font-weight:700;font-size:13.5px;color:var(--color-text-primary);">
                        ${Utils.formatCurrency(inv.amount)}
                      </div>
                    </td>
                    <td style="text-align:right;">
                      <div class="dropdown">
                        <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'svcActionsMenu_inv_${inv.id}')" title="Actions" style="width:26px;height:26px;">
                          <i data-lucide="more-vertical" style="width:13px;height:13px;"></i>
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
                            <i data-lucide="trash-2"></i> Delete Charge
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    // Render helper: Services Card View
    const renderServicesCards = () => {
      if (totalServicesCount === 0) {
        return `
          <div class="table-empty-box">
            <div class="table-empty-icon"><i data-lucide="layers"></i></div>
            <div class="table-empty-title">No Services Configured</div>
            <div class="table-empty-desc">Configure a recurring monthly retainer plan or add project charges for ${Utils.escapeHtml(client.name)}.</div>
            <button type="button" class="btn btn-primary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}', '', 'retainer')">
              <i data-lucide="repeat"></i> Set Monthly Retainer
            </button>
          </div>
        `;
      }

      return `
        <div class="ledger-cards-grid">
          ${hasMonthly ? `
            <div class="ledger-item-card">
              <div class="ledger-item-header">
                <div class="ledger-item-identity">
                  <span class="badge badge-primary"><span class="badge-dot"></span>Monthly Retainer</span>
                  ${client.retainerStatus === 'paused' 
                    ? `<span class="badge badge-warning"><span class="badge-dot"></span>Paused</span>` 
                    : `<span class="badge badge-success"><span class="badge-dot"></span>Active</span>`}
                </div>
                <div class="dropdown">
                  <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'svcCardRetMenu_${client.id}')" title="Actions" style="width:28px;height:28px;">
                    <i data-lucide="more-vertical" style="width:14px;height:14px;"></i>
                  </button>
                  <div id="svcCardRetMenu_${client.id}" class="dropdown-menu">
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
              </div>

              <div class="ledger-item-body">
                <div class="ledger-item-title">Retainer Agreement</div>
                <div style="display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin:6px 0 8px 0;">
                  ${this.renderServiceChips(serviceList, 2, client.name, false)}
                </div>
                <div class="ledger-item-meta">
                  <span class="ledger-meta-item"><i data-lucide="calendar" style="width:12px;height:12px;"></i> Billed on Day ${client.dueDay || 5} of every month</span>
                </div>

                <div class="ledger-item-price-row">
                  <div>
                    <div class="ledger-item-price tabular-nums">${Utils.formatCurrency(client.monthlyAmount)} <small style="font-size:12px;font-weight:500;color:var(--color-text-muted);">/ mo</small></div>
                  </div>
                </div>
              </div>
            </div>
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
            } else if (inv.status === 'overdue' || inv.isOverdue) {
              statusBadge = '<span class="badge badge-danger"><span class="badge-dot"></span>Overdue</span>';
            } else {
              statusBadge = '<span class="badge badge-neutral"><span class="badge-dot"></span>Pending</span>';
            }

            const invServiceList = (inv.serviceName || 'Project Charge')
              .split(/[,+&•]/)
              .map((s) => s.trim())
              .filter(Boolean);

            return `
              <div class="ledger-item-card">
                <div class="ledger-item-header">
                  <div class="ledger-item-identity">
                    <span class="badge badge-neutral">${typeBadge}</span>
                    <span class="ledger-badge-code data-code-link" style="cursor:pointer;" onclick="Payments.viewInvoiceHistory('${inv.id}')" title="View invoice payment history">${Utils.escapeHtml(inv.invoiceNumber)}</span>
                  </div>
                  <div class="dropdown">
                    <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'cardSvc_${inv.id}')" title="Actions" style="width:28px;height:28px;">
                      <i data-lucide="more-vertical" style="width:14px;height:14px;"></i>
                    </button>
                    <div id="cardSvc_${inv.id}" class="dropdown-menu">
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
                        <i data-lucide="trash-2"></i> Delete Charge
                      </button>
                    </div>
                  </div>
                </div>

                <div class="ledger-item-body">
                  <div class="ledger-item-title" title="${Utils.escapeHtml(inv.serviceName || 'Project Charge')}">
                    ${invServiceList.length > 2 ? 'Project Charge' : Utils.escapeHtml(inv.serviceName || 'Project Charge')}
                  </div>
                  ${invServiceList.length > 1 ? `
                    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin:6px 0 8px 0;">
                      ${this.renderServiceChips(invServiceList, 2, inv.invoiceNumber, false)}
                    </div>
                  ` : ''}
                  <div class="ledger-item-meta">
                    <span class="ledger-meta-item"><i data-lucide="calendar" style="width:12px;height:12px;"></i> Cycle: ${Utils.formatMonth(inv.billingMonth)}</span>
                    <span class="ledger-meta-bullet">•</span>
                    <span class="ledger-meta-item">Due ${Utils.formatDate(inv.dueDate)}</span>
                  </div>

                  <div class="ledger-item-price-row">
                    <div>
                      <div class="ledger-item-price tabular-nums">${Utils.formatCurrency(inv.amount)}</div>
                      <div class="ledger-item-price-subtext">${statusBadge}</div>
                    </div>
                    ${remPaise > 0 ? `
                      <button type="button" class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${inv.id}')" style="height:30px;padding:0 10px;font-size:12px;font-weight:600;">
                        <i data-lucide="plus-circle" style="width:12px;height:12px;"></i> Pay
                      </button>
                    ` : `
                      <button type="button" class="btn btn-secondary btn-sm" onclick="Payments.viewInvoiceHistory('${inv.id}')" style="height:30px;padding:0 10px;font-size:12px;">
                        <i data-lucide="history" style="width:12px;height:12px;"></i> History
                      </button>
                    `}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    };

    // Build the Entire Senior UX Dossier Structure
    contentEl.innerHTML = `
      <!-- Breadcrumb Navigation -->
      <div class="client-detail-breadcrumb">
        <button type="button" class="btn-breadcrumb" onclick="App.navigateTo('clients')">
          <i data-lucide="arrow-left"></i> All Clients
        </button>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">${Utils.escapeHtml(client.name)}</span>
      </div>

      <!-- Hero Dossier Banner -->
      <div class="client-hero-card">
        <div class="client-hero-main">
          <div class="client-hero-avatar" style="background:${avatarColor.bg};color:${avatarColor.text};border-color:${avatarColor.border};">
            ${initials}
          </div>
          <div class="client-hero-info">
            <div class="client-hero-title-row">
              <h1 class="client-hero-name">${Utils.escapeHtml(client.name)}</h1>
              ${client.company ? `<span class="client-company-badge"><i data-lucide="building" style="width:12px;height:12px;"></i> ${Utils.escapeHtml(client.company)}</span>` : ''}
              ${statusBadge}
              ${hasMonthly ? (
                client.retainerStatus === 'paused'
                  ? `<span class="badge badge-warning"><span class="badge-dot"></span>Retainer Paused</span>`
                  : `<span class="badge badge-primary"><span class="badge-dot"></span>${Utils.formatCurrency(client.monthlyAmount)} / mo</span>`
              ) : `<span class="badge badge-neutral">Ad-hoc Project</span>`}
            </div>

            <!-- Minimalist Tiny Contact & Info Row -->
            <div class="client-hero-meta">
              ${client.email ? `
                <span class="client-meta-item" title="Email: ${Utils.escapeHtml(client.email)}">
                  <i data-lucide="mail"></i>
                  <a href="mailto:${Utils.escapeHtml(client.email)}" class="client-meta-text" style="color:inherit;text-decoration:none;">${Utils.escapeHtml(client.email)}</a>
                  <button type="button" class="client-meta-copy-btn" onclick="Utils.copyToClipboard('${client.email}', 'Email address copied')" title="Copy Email">
                    <i data-lucide="copy"></i>
                  </button>
                </span>
              ` : ''}
              ${client.phone ? `
                <span class="client-meta-item" title="Phone: ${Utils.escapeHtml(client.phone)}">
                  <i data-lucide="phone"></i>
                  <a href="tel:${Utils.escapeHtml(client.phone)}" class="client-meta-text" style="color:inherit;text-decoration:none;">${Utils.escapeHtml(client.phone)}</a>
                  <button type="button" class="client-meta-copy-btn" onclick="Utils.copyToClipboard('${client.phone}', 'Phone number copied')" title="Copy Phone Number">
                    <i data-lucide="copy"></i>
                  </button>
                </span>
              ` : ''}
              <span class="client-meta-item">
                <i data-lucide="calendar"></i>
                <span>Joined ${Utils.formatDate(client.joiningDate)}</span>
              </span>
              ${serviceList.length > 0 ? `
                <span class="client-meta-divider">•</span>
                <span class="client-meta-item" style="gap:4px;flex-wrap:nowrap;align-items:center;">
                  ${this.renderServiceChips(serviceList, 2, client.name, true)}
                </span>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="client-hero-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="Clients.openAddEditModal('${client.id}')" title="Edit Client Information">
            <i data-lucide="edit-2"></i> <span class="hide-mobile">Edit Profile</span><span class="show-mobile-inline">Edit</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Clients.openSettingsModal('${client.id}')" title="Client Account Settings">
            <i data-lucide="settings"></i> <span>Settings</span>
          </button>
          <button type="button" class="btn btn-primary btn-sm" onclick="Payments.openCreateInvoiceModal('${client.id}')" title="Add New Invoice / Charge">
            <i data-lucide="plus"></i> <span class="hide-mobile">Add Charge</span><span class="show-mobile-inline">Add</span>
          </button>
        </div>
      </div>

      <!-- Financial Overview (Desktop 3-Card Grid / Mobile Unified Strip) -->
      <div class="client-kpi-strip">
        <div class="client-kpi-col interactive" onclick="Clients.switchDetailTab('invoices')" title="View all billed invoices">
          <div class="kpi-col-header">
            <span class="kpi-col-label">Total Invoiced</span>
            <div class="kpi-col-icon"><i data-lucide="file-text"></i></div>
          </div>
          <div class="kpi-col-body">
            <div class="kpi-col-value tabular-nums">${Utils.formatCurrency(Utils.fromPaise(totalBilledPaise))}</div>
            <div class="kpi-col-sub">${invoices.length} billed</div>
          </div>
        </div>

        <div class="client-kpi-divider"></div>

        <div class="client-kpi-col interactive" onclick="Clients.switchDetailTab('payments')" title="View all settled payments">
          <div class="kpi-col-header">
            <span class="kpi-col-label">Total Received</span>
            <div class="kpi-col-icon text-success"><i data-lucide="check-circle-2"></i></div>
          </div>
          <div class="kpi-col-body">
            <div class="kpi-col-value tabular-nums text-success">${Utils.formatCurrency(Utils.fromPaise(totalPaidPaise))}</div>
            <div class="kpi-col-sub text-success">${payments.length} settled</div>
          </div>
        </div>

        <div class="client-kpi-divider"></div>

        <div class="client-kpi-col interactive" onclick="Clients.switchDetailTab('invoices')" title="View outstanding due">
          <div class="kpi-col-header">
            <span class="kpi-col-label">Outstanding Due</span>
            <div class="kpi-col-icon ${outstandingPaise > 0 ? 'text-danger' : 'text-success'}">
              <i data-lucide="${outstandingPaise > 0 ? 'alert-circle' : 'check'}"></i>
            </div>
          </div>
          <div class="kpi-col-body">
            <div class="kpi-col-value tabular-nums ${outstandingPaise > 0 ? 'text-danger' : 'text-success'}">${Utils.formatCurrency(Utils.fromPaise(outstandingPaise))}</div>
            <div class="kpi-col-sub ${outstandingPaise > 0 ? 'text-danger' : 'text-success'}">
              ${outstandingPaise > 0 ? `${unpaidInvoices.length} pending due` : 'All settled'}
            </div>
          </div>
        </div>
      </div>

      <!-- 2-Column Asymmetric Dossier Layout -->
      <div class="client-detail-layout">
        <!-- Main Workspace (Left Column) -->
        <div class="client-ledger-column">
          <div class="card client-ledger-card card-table-container view-${this.detailViewMode}" style="margin-bottom:var(--space-6);">
            <!-- Tab Navigation Header (Clean with View Switcher) -->
            <div class="client-ledger-header">
              <div class="client-tabs-nav" role="tablist">
                <button type="button" class="client-tab-btn ${activeTab === 'invoices' ? 'active' : ''}" data-tab="invoices" onclick="Clients.switchDetailTab('invoices')">
                  <i data-lucide="receipt"></i>
                  <span>Invoices</span>
                  <span class="client-tab-badge">${invoices.length}</span>
                </button>
                <button type="button" class="client-tab-btn ${activeTab === 'payments' ? 'active' : ''}" data-tab="payments" onclick="Clients.switchDetailTab('payments')">
                  <i data-lucide="check-circle"></i>
                  <span>Payments</span>
                  <span class="client-tab-badge">${payments.length}</span>
                </button>
                <button type="button" class="client-tab-btn ${activeTab === 'services' ? 'active' : ''}" data-tab="services" onclick="Clients.switchDetailTab('services')">
                  <i data-lucide="layers"></i>
                  <span>Services & Plans</span>
                  <span class="client-tab-badge">${totalServicesCount}</span>
                </button>
              </div>

              <!-- View Mode Segmented Switcher (Table vs. Cards) -->
              <div class="ledger-view-switcher" role="radiogroup" aria-label="View Mode">
                <button type="button" class="view-switch-btn ${this.detailViewMode === 'table' ? 'active' : ''}" data-view="table" onclick="Clients.setDetailViewMode('table')" title="Table View">
                  <i data-lucide="table"></i>
                  <span class="view-switch-label">Table</span>
                </button>
                <button type="button" class="view-switch-btn ${this.detailViewMode === 'cards' ? 'active' : ''}" data-view="cards" onclick="Clients.setDetailViewMode('cards')" title="Cards View">
                  <i data-lucide="layout-grid"></i>
                  <span class="view-switch-label">Cards</span>
                </button>
              </div>
            </div>

            <!-- Tab Panel 1: Invoices & Charges -->
            <div id="clientTabPanel_invoices" class="client-tab-panel ${activeTab === 'invoices' ? 'active' : ''}">
              <div class="ledger-view-table">
                ${renderInvoicesTable()}
              </div>
              <div class="ledger-view-cards">
                ${renderInvoicesCards()}
              </div>
            </div>

            <!-- Tab Panel 2: Payments History -->
            <div id="clientTabPanel_payments" class="client-tab-panel ${activeTab === 'payments' ? 'active' : ''}">
              <div class="ledger-view-table">
                ${renderPaymentsTable()}
              </div>
              <div class="ledger-view-cards">
                ${renderPaymentsCards()}
              </div>
            </div>

            <!-- Tab Panel 3: Services & Billing Plans -->
            <div id="clientTabPanel_services" class="client-tab-panel ${activeTab === 'services' ? 'active' : ''}">
              <div class="ledger-view-table">
                ${renderServicesTable()}
              </div>
              <div class="ledger-view-cards">
                ${renderServicesCards()}
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar Dossier (Right Column) -->
        <aside class="client-sidebar-column">
          <!-- Recurring Retainer Agreement -->
          <div class="sidebar-panel-card">
            <div class="sidebar-panel-header">
              <span class="sidebar-panel-title"><i data-lucide="repeat"></i> Retainer Agreement</span>
              ${hasMonthly ? `
                <div class="dropdown">
                  <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'sidebarRetMenu_${client.id}')" title="Retainer Options" style="width:28px;height:28px;">
                    <i data-lucide="more-vertical" style="width:14px;height:14px;"></i>
                  </button>
                  <div id="sidebarRetMenu_${client.id}" class="dropdown-menu">
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
              ` : ''}
            </div>

            ${hasMonthly ? `
              <div class="retainer-widget-banner" style="margin-bottom:0;cursor:pointer;" onclick="Clients.switchDetailTab('services')" title="View in Services & Plans">
                <div class="retainer-widget-rate">
                  ${Utils.formatCurrency(client.monthlyAmount)} <small>/ month</small>
                </div>
                <div class="retainer-widget-schedule">
                  <i data-lucide="calendar" style="width:13px;height:13px;"></i>
                  <span>Billed on Day ${client.dueDay || 5} of every month</span>
                </div>
                <div style="margin-top:8px;">
                  ${client.retainerStatus === 'paused' 
                    ? '<span class="badge badge-warning"><span class="badge-dot"></span>Subscription Paused</span>' 
                    : '<span class="badge badge-success"><span class="badge-dot"></span>Subscription Active</span>'}
                </div>
              </div>
            ` : `
              <div style="text-align:center;padding:var(--space-3) 0;">
                <div style="font-size:12.5px;color:var(--color-text-secondary);line-height:1.45;margin-bottom:var(--space-3);">
                  No active recurring subscription. This client is currently billed on an ad-hoc or project basis.
                </div>
                <button type="button" class="btn btn-secondary btn-sm w-full" onclick="Payments.openCreateInvoiceModal('${client.id}', '', 'retainer')">
                  <i data-lucide="plus"></i> Set Monthly Retainer
                </button>
              </div>
            `}
          </div>
        </aside>
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
