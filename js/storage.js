/**
 * CLIENTO - LOCAL STORAGE & DATA LAYER
 * Handles LocalStorage persistence, safe serialization, schemas,
 * import/export backups, and state sync.
 * Zero dummy data: Starts with a completely clean workspace.
 */

const Storage = {
  KEYS: {
    CLIENTS: 'cliento_clients',
    INVOICES: 'cliento_invoices',
    PAYMENTS: 'cliento_payments',
    EXPENSES: 'cliento_expenses',
    SETTINGS: 'cliento_settings',
    INITIALIZED: 'cliento_initialized'
  },

  DEFAULT_SETTINGS: {
    businessName: '',
    phone: '',
    email: '',
    address: '',
    currency: 'INR',
    billingPreference: 5, // Default monthly billing due day (1-28)
    invoicePrefix: 'INV-'
  },

  /**
   * Safe JSON getItem with fallback
   */
  _get(key, fallback = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.error(`Storage error reading ${key}:`, e);
      return fallback;
    }
  },

  /**
   * Safe JSON setItem
   */
  _set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.error(`Storage error writing ${key}:`, e);
      Utils.showToast('Storage quota exceeded or storage error', 'error');
      return false;
    }
  },

  /* ---------------- Clients ---------------- */
  getClients() {
    return this._get(this.KEYS.CLIENTS, []);
  },

  saveClients(clients) {
    return this._set(this.KEYS.CLIENTS, clients);
  },

  getClientById(id) {
    return this.getClients().find((c) => c.id === id) || null;
  },

  addClient(clientData) {
    const clients = this.getClients();
    const newClient = {
      id: Utils.generateId('cli'),
      name: clientData.name.trim(),
      phone: (clientData.phone || '').trim(),
      email: (clientData.email || '').trim(),
      service: clientData.service.trim(),
      monthlyAmount: parseFloat(clientData.monthlyAmount) || 0,
      joiningDate: clientData.joiningDate || Utils.getTodayString(),
      dueDay: parseInt(clientData.dueDay, 10) || 5,
      status: clientData.status || 'active', // 'active' | 'inactive'
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    clients.unshift(newClient);
    this.saveClients(clients);
    return newClient;
  },

  updateClient(id, clientData) {
    const clients = this.getClients();
    const idx = clients.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    clients[idx] = {
      ...clients[idx],
      name: clientData.name !== undefined ? clientData.name.trim() : clients[idx].name,
      phone: clientData.phone !== undefined ? clientData.phone.trim() : clients[idx].phone,
      email: clientData.email !== undefined ? clientData.email.trim() : clients[idx].email,
      service: clientData.service !== undefined ? clientData.service.trim() : clients[idx].service,
      monthlyAmount: clientData.monthlyAmount !== undefined ? parseFloat(clientData.monthlyAmount) : clients[idx].monthlyAmount,
      joiningDate: clientData.joiningDate || clients[idx].joiningDate,
      dueDay: clientData.dueDay !== undefined ? parseInt(clientData.dueDay, 10) : clients[idx].dueDay,
      status: clientData.status || clients[idx].status,
      updatedAt: new Date().toISOString()
    };
    this.saveClients(clients);
    return clients[idx];
  },

  /**
   * Delete or deactivate client.
   * If client has financial records (invoices/payments), deactivates to preserve history.
   */
  deleteOrDeactivateClient(id) {
    const invoices = this.getInvoices().filter((inv) => inv.clientId === id);
    const payments = this.getPayments().filter((p) => p.clientId === id);

    if (invoices.length > 0 || payments.length > 0) {
      // Deactivate instead of hard delete to preserve financial history integrity
      this.updateClient(id, { status: 'inactive' });
      return { action: 'deactivated', message: 'Client deactivated. Financial records preserved.' };
    } else {
      // Permanent delete if no financial history exists
      const clients = this.getClients().filter((c) => c.id !== id);
      this.saveClients(clients);
      return { action: 'deleted', message: 'Client deleted.' };
    }
  },

  /* ---------------- Invoices ---------------- */
  getInvoices() {
    const invoices = this._get(this.KEYS.INVOICES, []);
    // Always compute current live status based on today's date and paid amount
    const today = Utils.getTodayString();
    return invoices.map((inv) => {
      const invPaise = Utils.toPaise(inv.amount);
      const paidPaise = Utils.toPaise(inv.paidAmount || 0);

      let status = 'pending';
      if (paidPaise >= invPaise && invPaise > 0) {
        status = 'paid';
      } else if (paidPaise > 0) {
        status = 'partial';
      } else if (inv.dueDate && today > inv.dueDate) {
        status = 'overdue';
      } else {
        status = 'pending';
      }

      return {
        ...inv,
        status,
        isOverdue: (status === 'overdue' || (status === 'partial' && inv.dueDate && today > inv.dueDate))
      };
    });
  },

  saveInvoices(invoices) {
    return this._set(this.KEYS.INVOICES, invoices);
  },

  getInvoiceById(id) {
    return this.getInvoices().find((inv) => inv.id === id) || null;
  },

  addInvoice(invoiceData) {
    const invoices = this._get(this.KEYS.INVOICES, []);
    const settings = this.getSettings();
    const count = invoices.length + 1;
    const invNumber = `${settings.invoicePrefix || 'INV-'}${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const newInvoice = {
      id: Utils.generateId('inv'),
      invoiceNumber: invNumber,
      clientId: invoiceData.clientId,
      clientName: invoiceData.clientName,
      billingMonth: invoiceData.billingMonth, // YYYY-MM
      amount: parseFloat(invoiceData.amount) || 0,
      paidAmount: 0,
      dueDate: invoiceData.dueDate, // YYYY-MM-DD
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    invoices.unshift(newInvoice);
    this.saveInvoices(invoices);
    return newInvoice;
  },

  /* ---------------- Payments / Transactions ---------------- */
  getPayments() {
    return this._get(this.KEYS.PAYMENTS, []);
  },

  savePayments(payments) {
    return this._set(this.KEYS.PAYMENTS, payments);
  },

  /**
   * Record a new payment transaction against an invoice
   */
  recordPayment({ invoiceId, amount, paymentDate, paymentMethod, notes = '' }) {
    const invoices = this._get(this.KEYS.INVOICES, []);
    const invIndex = invoices.findIndex((inv) => inv.id === invoiceId);
    if (invIndex === -1) {
      throw new Error('Invoice not found');
    }

    const invoice = invoices[invIndex];
    const invPaise = Utils.toPaise(invoice.amount);
    const existingPaidPaise = Utils.toPaise(invoice.paidAmount || 0);
    const remainingPaise = invPaise - existingPaidPaise;
    const paymentPaise = Utils.toPaise(amount);

    if (paymentPaise <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
    if (paymentPaise > remainingPaise) {
      throw new Error(`Payment cannot exceed outstanding balance of ${Utils.formatCurrency(Utils.fromPaise(remainingPaise))}`);
    }

    // Create payment transaction
    const payments = this.getPayments();
    const newPayment = {
      id: Utils.generateId('pay'),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      billingMonth: invoice.billingMonth,
      amount: Utils.fromPaise(paymentPaise),
      paymentDate: paymentDate || Utils.getTodayString(),
      paymentMethod: paymentMethod || 'Bank Transfer',
      notes: (notes || '').trim(),
      createdAt: new Date().toISOString()
    };

    payments.unshift(newPayment);
    this.savePayments(payments);

    // Update invoice paid amount
    const newPaidPaise = existingPaidPaise + paymentPaise;
    invoice.paidAmount = Utils.fromPaise(newPaidPaise);
    if (newPaidPaise >= invPaise) {
      invoice.status = 'paid';
    } else {
      invoice.status = 'partial';
    }

    this.saveInvoices(invoices);
    return { payment: newPayment, invoice };
  },

  getPaymentsByInvoiceId(invoiceId) {
    return this.getPayments().filter((p) => p.invoiceId === invoiceId);
  },

  getPaymentsByClientId(clientId) {
    return this.getPayments().filter((p) => p.clientId === clientId);
  },

  /* ---------------- Expenses ---------------- */
  getExpenses() {
    return this._get(this.KEYS.EXPENSES, []);
  },

  saveExpenses(expenses) {
    return this._set(this.KEYS.EXPENSES, expenses);
  },

  getExpenseById(id) {
    return this.getExpenses().find((exp) => exp.id === id) || null;
  },

  addExpense(expenseData) {
    const expenses = this.getExpenses();
    const newExpense = {
      id: Utils.generateId('exp'),
      title: expenseData.title.trim(),
      category: expenseData.category.trim(),
      amount: parseFloat(expenseData.amount) || 0,
      date: expenseData.date || Utils.getTodayString(),
      description: (expenseData.description || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    expenses.unshift(newExpense);
    this.saveExpenses(expenses);
    return newExpense;
  },

  updateExpense(id, expenseData) {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex((e) => e.id === id);
    if (idx === -1) return null;

    expenses[idx] = {
      ...expenses[idx],
      title: expenseData.title !== undefined ? expenseData.title.trim() : expenses[idx].title,
      category: expenseData.category !== undefined ? expenseData.category.trim() : expenses[idx].category,
      amount: expenseData.amount !== undefined ? parseFloat(expenseData.amount) : expenses[idx].amount,
      date: expenseData.date || expenses[idx].date,
      description: expenseData.description !== undefined ? expenseData.description.trim() : expenses[idx].description,
      updatedAt: new Date().toISOString()
    };
    this.saveExpenses(expenses);
    return expenses[idx];
  },

  deleteExpense(id) {
    const expenses = this.getExpenses().filter((e) => e.id !== id);
    this.saveExpenses(expenses);
  },

  /* ---------------- Settings ---------------- */
  getSettings() {
    const stored = this._get(this.KEYS.SETTINGS, null);
    if (!stored) {
      return { ...this.DEFAULT_SETTINGS };
    }
    return { ...this.DEFAULT_SETTINGS, ...stored };
  },

  saveSettings(settingsData) {
    const current = this.getSettings();
    const updated = {
      ...current,
      businessName: (settingsData.businessName || '').trim(),
      phone: (settingsData.phone || '').trim(),
      email: (settingsData.email || '').trim(),
      address: (settingsData.address || '').trim(),
      currency: 'INR',
      billingPreference: parseInt(settingsData.billingPreference, 10) || 5,
      invoicePrefix: (settingsData.invoicePrefix || 'INV-').trim()
    };
    return this._set(this.KEYS.SETTINGS, updated);
  },

  /* ---------------- Clean Initialization & Reset ---------------- */
  initStorage() {
    // Purge any residual demo data from previous runs to ensure 100% real user data
    const clients = this.getClients();
    const dummyIds = ['cli_apex', 'cli_zenith', 'cli_brightedge', 'cli_kiran'];
    const hasDummy = clients.some((c) => dummyIds.includes(c.id));

    if (hasDummy) {
      this.clearAllData();
      return;
    }

    const settings = this._get(this.KEYS.SETTINGS, null);
    if (settings && settings.businessName === 'Cliento Studio') {
      this.clearAllData();
      return;
    }

    if (!localStorage.getItem(this.KEYS.INITIALIZED)) {
      localStorage.setItem(this.KEYS.INITIALIZED, 'true');
    }
  },

  /**
   * Reset all data to clean blank slate
   */
  clearAllData() {
    localStorage.removeItem(this.KEYS.CLIENTS);
    localStorage.removeItem(this.KEYS.INVOICES);
    localStorage.removeItem(this.KEYS.PAYMENTS);
    localStorage.removeItem(this.KEYS.EXPENSES);
    localStorage.removeItem(this.KEYS.SETTINGS);
    localStorage.setItem(this.KEYS.INITIALIZED, 'true');
  },

  /**
   * Export all data as JSON
   */
  exportBackupJSON() {
    const backup = {
      app: 'Cliento',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        clients: this.getClients(),
        invoices: this.getInvoices(),
        payments: this.getPayments(),
        expenses: this.getExpenses(),
        settings: this.getSettings()
      }
    };
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cliento_backup_${Utils.getTodayString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Import backup from parsed JSON object with schema validation
   */
  importBackupJSON(parsedData) {
    if (!parsedData || !parsedData.data) {
      throw new Error('Invalid backup file format: missing data block');
    }
    const { clients, invoices, payments, expenses, settings } = parsedData.data;
    if (!Array.isArray(clients) || !Array.isArray(invoices) || !Array.isArray(payments) || !Array.isArray(expenses)) {
      throw new Error('Invalid backup structure: expected array collections');
    }

    this.saveClients(clients);
    this.saveInvoices(invoices);
    this.savePayments(payments);
    this.saveExpenses(expenses);
    if (settings && typeof settings === 'object') {
      this.saveSettings(settings);
    }
    localStorage.setItem(this.KEYS.INITIALIZED, 'true');
    return true;
  }
};

window.Storage = Storage;
