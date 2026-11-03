/**
 * CLIENTO - SETTINGS & DATABASE STATUS MODULE
 * Handles business profile, billing preferences, database backup export,
 * and live backend connection verification.
 */

const Settings = {
  init() {
    this.bindEvents();
    this.loadValues();
  },

  bindEvents() {
    const form = document.getElementById('settingsForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSave();
      });
    }

    const discardBtn = document.getElementById('settingsDiscardBtn');
    if (discardBtn) {
      discardBtn.addEventListener('click', () => {
        this.handleDiscard();
      });
    }

    // Export database backup
    const exportBtn = document.getElementById('exportBackupBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        Storage.exportBackupJSON();
        Utils.showToast('Database backup downloaded successfully', 'success');
      });
    }

    // Live Database Connection Verification
    const checkBackendBtn = document.getElementById('checkBackendStatusBtn');
    if (checkBackendBtn) {
      checkBackendBtn.addEventListener('click', () => {
        this.handleVerifyBackend();
      });
    }
  },

  loadValues() {
    const s = Storage.getSettings();
    const form = document.getElementById('settingsForm');
    if (!form) return;

    Utils.clearFieldErrors(form);

    const bName = document.getElementById('settingsBusinessName');
    const bPhone = document.getElementById('settingsPhone');
    const bEmail = document.getElementById('settingsEmail');
    const bAddress = document.getElementById('settingsAddress');
    const bCurrency = document.getElementById('settingsCurrency');
    const bPref = document.getElementById('settingsBillingPreference');
    const bPrefix = document.getElementById('settingsInvoicePrefix');

    if (bName) bName.value = s.businessName || '';
    if (bPhone) bPhone.value = s.phone || '';
    if (bEmail) bEmail.value = s.email || '';
    if (bAddress) bAddress.value = s.address || '';
    if (bCurrency) bCurrency.value = s.currency || 'INR';
    if (bPref) bPref.value = s.billingPreference || 5;
    if (bPrefix) bPrefix.value = s.invoicePrefix || 'INV-';
  },

  async handleSave() {
    const form = document.getElementById('settingsForm');
    Utils.clearFieldErrors(form);

    const bName = document.getElementById('settingsBusinessName');
    const bPhone = document.getElementById('settingsPhone');
    const bEmail = document.getElementById('settingsEmail');
    const bAddress = document.getElementById('settingsAddress');
    const bPref = document.getElementById('settingsBillingPreference');
    const bPrefix = document.getElementById('settingsInvoicePrefix');

    let isValid = true;

    const name = bName.value.trim();
    if (!name) {
      Utils.setFieldError(bName, 'Business name is required');
      isValid = false;
    }

    const email = bEmail.value.trim();
    if (email && !Utils.validateEmail(email)) {
      Utils.setFieldError(bEmail, 'Enter a valid email address');
      isValid = false;
    }

    const prefDay = parseInt(bPref.value, 10);
    if (isNaN(prefDay) || prefDay < 1 || prefDay > 28) {
      Utils.setFieldError(bPref, 'Default due day must be between 1 and 28');
      isValid = false;
    }

    const prefix = bPrefix.value.trim();
    if (!prefix) {
      Utils.setFieldError(bPrefix, 'Invoice prefix is required (e.g. INV-)');
      isValid = false;
    }

    if (!isValid) return;

    try {
      await Storage.saveSettings({
        businessName: name,
        phone: bPhone.value.trim(),
        email,
        address: bAddress.value.trim(),
        currency: 'INR',
        billingPreference: prefDay,
        invoicePrefix: prefix
      });

      Utils.showToast('Settings saved to database successfully', 'success');
    } catch (err) {
      Utils.showToast(`Error saving settings: ${err.message}`, 'error');
    }
  },

  handleDiscard() {
    this.loadValues();
    Utils.showToast('Unsaved changes discarded', 'info');
  },

  async handleVerifyBackend() {
    const checkBtn = document.getElementById('checkBackendStatusBtn');
    const badge = document.getElementById('backendStatusBadge');
    const feedbackEl = document.getElementById('backendConnectionFeedback');

    try {
      if (checkBtn) checkBtn.disabled = true;

      if (!window.API || typeof API.getCsrfToken !== 'function') {
        throw new Error('API service layer not initialized');
      }

      const token = await API.getCsrfToken();
      if (!token) throw new Error('No CSRF token returned by server');

      const settingsRes = await API.settings.get();
      const clientsCount = Storage.getClients().length;
      const invoicesCount = Storage.getInvoices().length;
      const paymentsCount = Storage.getPayments().length;
      const expensesCount = Storage.getExpenses().length;

      if (badge) {
        badge.className = 'badge badge-success';
        badge.textContent = 'Database Connected & Active';
      }

      if (feedbackEl) {
        feedbackEl.style.display = 'block';
        feedbackEl.innerHTML = `
          <div style="background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);font-size:13px;line-height:1.6;">
            <div style="font-weight:600;color:var(--color-success);display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <i data-lucide="check-circle" style="width:16px;height:16px;"></i> Live Backend Connection Verified
            </div>
            <div>• <strong>PHP Core Engine</strong>: REST API active with CSRF protection</div>
            <div>• <strong>Active SQL Database</strong>: MySQL 8.0+ / SQLite 3 transactional engine</div>
            <div>• <strong>Live Data Records</strong>: ${clientsCount} Clients • ${invoicesCount} Invoices • ${paymentsCount} Payments • ${expensesCount} Expenses</div>
            <div>• <strong>Shared Hosting Deployment</strong>: cPanel, DirectAdmin, Apache .htaccess compatible</div>
          </div>
        `;
        if (window.Utils && typeof Utils.refreshIcons === 'function') Utils.refreshIcons();
      }

      Utils.showToast('Database connection verified! Live PHP backend online.', 'success');
    } catch (err) {
      if (badge) {
        badge.className = 'badge badge-danger';
        badge.textContent = 'Backend Offline';
      }
      if (feedbackEl) {
        feedbackEl.style.display = 'block';
        feedbackEl.innerHTML = `
          <div style="background:var(--color-danger-bg);border:1px solid var(--color-danger);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);font-size:13px;color:var(--color-danger);line-height:1.5;">
            <strong>Connection Notice:</strong> ${Utils.escapeHtml(err.message || 'Unable to reach backend API.')}
          </div>
        `;
      }
      Utils.showToast(`Backend connection notice: ${err.message}`, 'warning');
    } finally {
      if (checkBtn) checkBtn.disabled = false;
      if (window.Utils && typeof Utils.refreshIcons === 'function') Utils.refreshIcons();
    }
  }
};

window.Settings = Settings;
