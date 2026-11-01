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
  }
};

window.Settings = Settings;
