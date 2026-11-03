/**
 * CLIENTO - SETTINGS & BACKUP MODULE
 * Handles business profile, billing preferences, JSON import/export,
 * demo data reset, and discard restoration.
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

    // Export backup
    const exportBtn = document.getElementById('exportBackupBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        Storage.exportBackupJSON();
        Utils.showToast('Backup file downloaded successfully', 'success');
      });
    }

    // Import backup trigger
    const importFileInput = document.getElementById('importBackupFileInput');
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => {
        this.handleFileImport(e);
      });
    }

    // Clear demo data
    const clearDataBtn = document.getElementById('clearDemoDataBtn');
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', () => {
        this.handleClearData();
      });
    }

    // MySQL Database Migration
    const migrateBtn = document.getElementById('migrateToDatabaseBtn');
    if (migrateBtn) {
      migrateBtn.addEventListener('click', () => {
        this.handleDatabaseMigration();
      });
    }

    // Backend Connection Verification
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

  handleSave() {
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

    Storage.saveSettings({
      businessName: name,
      phone: bPhone.value.trim(),
      email,
      address: bAddress.value.trim(),
      currency: 'INR',
      billingPreference: prefDay,
      invoicePrefix: prefix
    });

    Utils.showToast('Settings saved successfully', 'success');
  },

  handleDiscard() {
    this.loadValues();
    Utils.showToast('Unsaved changes discarded', 'info');
  },

  async handleFileImport(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const confirmed = await Utils.confirm({
        title: 'Restore Backup Data',
        message: 'Restoring from backup will replace your current clients, invoices, payments, and expenses. Are you sure you wish to proceed?',
        confirmText: 'Restore Data',
        confirmDanger: true
      });

      if (!confirmed) {
        event.target.value = '';
        return;
      }

      Storage.importBackupJSON(parsed);
      Utils.showToast('Backup restored successfully! Updating application...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err) {
      Utils.showToast(`Import error: ${err.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  },

  async handleClearData() {
    const confirmed = await Utils.confirm({
      title: 'Reset All Data',
      message: 'This action will reset all client records, invoices, transactions, and expenses. Your workspace will be completely fresh. Are you sure?',
      confirmText: 'Reset All Data',
      confirmDanger: true
    });

    if (confirmed) {
      Storage.clearAllData();
      Utils.showToast('All data cleared. Workspace reset to clean slate.', 'info');
      setTimeout(() => {
        window.location.reload();
      }, 700);
    }
  },

  async handleVerifyBackend() {
    const checkBtn = document.getElementById('checkBackendStatusBtn');
    const badge = document.getElementById('backendStatusBadge');
    try {
      if (checkBtn) checkBtn.disabled = true;
      if (window.API && typeof API.getCsrfToken === 'function') {
        const token = await API.getCsrfToken();
        if (token) {
          if (badge) {
            badge.className = 'badge badge-success';
            badge.textContent = 'Backend Connected';
          }
          Utils.showToast('Backend connection verified! (PHP 8.2+ & MySQL 8.0 online)', 'success');
        } else {
          throw new Error('No CSRF token returned');
        }
      } else {
        throw new Error('API service layer not initialized');
      }
    } catch (err) {
      if (badge) {
        badge.className = 'badge badge-warning';
        badge.textContent = 'Backend Offline';
      }
      Utils.showToast(`Backend connection notice: ${err.message}. Offline localStorage active.`, 'warning');
    } finally {
      if (checkBtn) checkBtn.disabled = false;
      if (window.Utils && typeof Utils.refreshIcons === 'function') Utils.refreshIcons();
    }
  },

  async handleDatabaseMigration() {
    const migrateBtn = document.getElementById('migrateToDatabaseBtn');
    const feedbackEl = document.getElementById('migrationFeedback');

    if (!window.API || !API.migration) {
      Utils.showToast('API service layer not available.', 'error');
      return;
    }

    const clientsCount = Storage.getClients().length;
    const invoicesCount = Storage.getInvoices().length;
    const paymentsCount = Storage.getPayments().length;
    const expensesCount = Storage.getExpenses().length;

    const confirmed = await Utils.confirm({
      title: 'Migrate Local Data to MySQL Database',
      message: `You are about to migrate ${clientsCount} client(s), ${invoicesCount} invoice(s), ${paymentsCount} payment(s), and ${expensesCount} expense(s) into your normalized MySQL database. Your local browser storage will remain untouched as a backup. Proceed?`,
      confirmText: 'Start Migration'
    });

    if (!confirmed) return;

    const originalText = migrateBtn ? migrateBtn.innerHTML : '';
    try {
      if (migrateBtn) {
        migrateBtn.disabled = true;
        migrateBtn.innerHTML = '<i data-lucide="loader-2"></i> Migrating records...';
        if (window.Utils && typeof Utils.refreshIcons === 'function') Utils.refreshIcons();
      }

      const payload = {
        clients: Storage.getClients(),
        invoices: Storage.getInvoices(),
        payments: Storage.getPayments(),
        expenses: Storage.getExpenses(),
        settings: Storage.getSettings()
      };

      const res = await API.migration.migrateLocalStorage(payload);

      if (feedbackEl) {
        feedbackEl.style.display = 'block';
        feedbackEl.innerHTML = `
          <div style="background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);font-size:13px;line-height:1.6;">
            <div style="font-weight:600;color:var(--color-success);display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <i data-lucide="check-circle" style="width:16px;height:16px;"></i> Migration Completed Successfully
            </div>
            <div>• <strong>${res.clients_migrated}</strong> Client(s) migrated</div>
            <div>• <strong>${res.invoices_migrated}</strong> Invoice(s) imported</div>
            <div>• <strong>${res.payments_migrated}</strong> Payment transaction(s) recorded</div>
            <div>• <strong>${res.expenses_migrated}</strong> Expense item(s) organized</div>
            <div>• <strong>₹${(res.total_billed_imported || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> Total billed imported</div>
            <div style="margin-top:6px;color:var(--color-text-secondary);font-size:11.5px;">Timestamp: ${res.migrated_at}</div>
          </div>
        `;
        if (window.Utils && typeof Utils.refreshIcons === 'function') Utils.refreshIcons();
      }

      Utils.showToast('All local data successfully migrated to MySQL database!', 'success', 3500);
    } catch (err) {
      if (feedbackEl) {
        feedbackEl.style.display = 'block';
        feedbackEl.innerHTML = `
          <div style="background:var(--color-danger-bg);border:1px solid var(--color-danger);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);font-size:13px;color:var(--color-danger);line-height:1.5;">
            <strong>Migration Error:</strong> ${Utils.escapeHtml(err.message || 'Unknown error during database migration.')}
          </div>
        `;
      }
      Utils.showToast(`Migration failed: ${err.message}`, 'error', 4000);
    } finally {
      if (migrateBtn) {
        migrateBtn.disabled = false;
        migrateBtn.innerHTML = originalText;
        if (window.Utils && typeof Utils.refreshIcons === 'function') Utils.refreshIcons();
      }
    }
  }
};

window.Settings = Settings;
