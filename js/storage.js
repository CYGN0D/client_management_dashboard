/**
 * CLIENTO - CENTRALIZED REST API DATA STORE
 * 100% Genuine PHP + MySQL/SQLite Backend Architecture.
 * All application data is fetched from and persisted into the backend database.
 * No business data is stored in browser localStorage.
 */

const Storage = {
  // In-memory collections populated directly from the backend REST API
  _clients: [],
  _invoices: [],
  _payments: [],
  _expenses: [],
  _settings: {
    businessName: '',
    phone: '',
    email: '',
    address: '',
    currency: 'INR',
    billingPreference: 5,
    invoicePrefix: 'INV-'
  },
  _isLoaded: false,

  DEFAULT_SETTINGS: {
    businessName: '',
    phone: '',
    email: '',
    address: '',
    currency: 'INR',
    billingPreference: 5,
    invoicePrefix: 'INV-'
  },

  /* ---------------- MAPPERS (Backend API <-> Frontend Models) ---------------- */
  _mapClientFromApi(c) {
    const monthlyAmount = parseFloat(c.monthly_amount !== undefined ? c.monthly_amount : c.monthlyAmount) || 0;
    const dueDay = c.due_day !== undefined ? (c.due_day ? parseInt(c.due_day, 10) : null) : (c.dueDay || null);
    const retainerStatus = c.retainer_status || c.retainerStatus || (monthlyAmount > 0 ? 'active' : null);
    const joiningDate = c.joining_date || c.joiningDate || Utils.getTodayString();

    return {
      id: String(c.id),
      client_code: c.client_code || ('cli_' + c.id),
      name: c.name || '',
      company: c.company || '',
      phone: c.phone || '',
      email: c.email || '',
      service: c.service || '',
      monthlyAmount,
      monthly_amount: monthlyAmount,
      dueDay,
      due_day: dueDay,
      retainerStatus,
      retainer_status: retainerStatus,
      status: c.status || 'active',
      joiningDate,
      joining_date: joiningDate,
      notes: c.notes || '',
      createdAt: c.created_at || c.createdAt || new Date().toISOString(),
      updatedAt: c.updated_at || c.updatedAt || new Date().toISOString(),
      total_invoiced: parseFloat(c.total_invoiced || c.total_billed || 0),
      total_paid: parseFloat(c.total_paid || 0),
      pending_balance: parseFloat(c.pending_balance || 0)
    };
  },

  _mapInvoiceFromApi(inv) {
    const amount = parseFloat(inv.amount) || 0;
    const paidAmount = parseFloat(inv.paid_amount !== undefined ? inv.paid_amount : inv.paidAmount) || 0;
    const clientId = String(inv.client_id !== undefined ? inv.client_id : inv.clientId);
    const today = Utils.getTodayString();

    let status = inv.status || 'pending';
    const invPaise = Utils.toPaise(amount);
    const paidPaise = Utils.toPaise(paidAmount);
    if (paidPaise >= invPaise && invPaise > 0) {
      status = 'paid';
    } else if (paidPaise > 0) {
      status = 'partial';
    } else if (inv.due_date && today > inv.due_date) {
      status = 'overdue';
    }

    return {
      id: String(inv.id),
      invoiceNumber: inv.invoice_number || inv.invoiceNumber || '',
      invoice_number: inv.invoice_number || inv.invoiceNumber || '',
      clientId,
      client_id: clientId,
      clientName: inv.client_name || inv.clientName || '',
      client_name: inv.client_name || inv.clientName || '',
      serviceName: inv.service_name || inv.serviceName || 'Service',
      service_name: inv.service_name || inv.serviceName || 'Service',
      chargeType: inv.charge_type || inv.chargeType || 'standard',
      charge_type: inv.charge_type || inv.chargeType || 'standard',
      notes: inv.notes || '',
      billingMonth: inv.billing_month || inv.billingMonth || '',
      billing_month: inv.billing_month || inv.billingMonth || '',
      amount,
      paidAmount,
      paid_amount: paidAmount,
      dueDate: inv.due_date || inv.dueDate || '',
      due_date: inv.due_date || inv.dueDate || '',
      status,
      isOverdue: (status === 'overdue' || (status === 'partial' && inv.due_date && today > inv.due_date)),
      createdAt: inv.created_at || inv.createdAt || new Date().toISOString(),
      updatedAt: inv.updated_at || inv.updatedAt || new Date().toISOString()
    };
  },

  _mapPaymentFromApi(p) {
    const amount = parseFloat(p.amount) || 0;
    const invoiceId = String(p.invoice_id !== undefined ? p.invoice_id : p.invoiceId);
    const clientId = String(p.client_id !== undefined ? p.client_id : p.clientId);

    return {
      id: String(p.id),
      invoiceId,
      invoice_id: invoiceId,
      invoiceNumber: p.invoice_number || p.invoiceNumber || '',
      clientId,
      client_id: clientId,
      clientName: p.client_name || p.clientName || '',
      amount,
      paymentDate: p.payment_date || p.paymentDate || Utils.getTodayString(),
      payment_date: p.payment_date || p.paymentDate || Utils.getTodayString(),
      paymentMethod: p.payment_method || p.paymentMethod || 'Bank Transfer',
      payment_method: p.payment_method || p.paymentMethod || 'Bank Transfer',
      referenceNumber: p.reference_number || p.referenceNumber || '',
      reference_number: p.reference_number || p.referenceNumber || '',
      notes: p.notes || '',
      createdAt: p.created_at || p.createdAt || new Date().toISOString()
    };
  },

  _mapExpenseFromApi(e) {
    const amount = parseFloat(e.amount) || 0;
    return {
      id: String(e.id),
      title: e.title || '',
      category: e.category || 'Other',
      amount,
      date: e.date || Utils.getTodayString(),
      description: e.description || '',
      createdAt: e.created_at || e.createdAt || new Date().toISOString(),
      updatedAt: e.updated_at || e.updatedAt || new Date().toISOString()
    };
  },

  _mapSettingsFromApi(s) {
    return {
      businessName: s.business_name || s.businessName || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      currency: s.currency || 'INR',
      billingPreference: parseInt(s.billing_preference !== undefined ? s.billing_preference : s.billingPreference, 10) || 5,
      invoicePrefix: s.invoice_prefix || s.invoicePrefix || 'INV-'
    };
  },

  /* ---------------- BACKEND REST API SYNC ---------------- */
  async syncFromBackend() {
    if (!window.API) return false;
    if (!window.Auth || typeof Auth.isAuthenticated !== 'function' || !Auth.isAuthenticated()) {
      return false;
    }

    try {
      const [clientsRes, invoicesRes, paymentsRes, expensesRes, settingsRes] = await Promise.allSettled([
        API.clients.getAll({ status: 'all' }),
        API.invoices.getAll({ status: 'all' }),
        API.payments.getAll(),
        API.expenses.getAll(),
        API.settings.get()
      ]);

      // 1. Process Clients
      if (clientsRes.status === 'fulfilled' && clientsRes.value) {
        const val = clientsRes.value;
        const list = Array.isArray(val) ? val : (val && val.clients ? val.clients : []);
        this._clients = list.map((c) => this._mapClientFromApi(c));
      }

      // 2. Process Invoices
      if (invoicesRes.status === 'fulfilled' && invoicesRes.value) {
        const val = invoicesRes.value;
        const list = Array.isArray(val) ? val : (val && val.invoices ? val.invoices : []);
        this._invoices = list.map((inv) => this._mapInvoiceFromApi(inv));
      }

      // 3. Process Payments
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value) {
        const val = paymentsRes.value;
        const list = Array.isArray(val) ? val : (val && val.payments ? val.payments : []);
        this._payments = list.map((p) => this._mapPaymentFromApi(p));
      }

      // 4. Process Expenses
      if (expensesRes.status === 'fulfilled' && expensesRes.value) {
        const val = expensesRes.value;
        const list = Array.isArray(val) ? val : (val && val.expenses ? val.expenses : []);
        this._expenses = list.map((exp) => this._mapExpenseFromApi(exp));
      }

      // 5. Process Settings
      if (settingsRes.status === 'fulfilled' && settingsRes.value) {
        const val = settingsRes.value;
        const s = val && val.settings ? val.settings : val;
        if (s && typeof s === 'object') {
          this._settings = this._mapSettingsFromApi(s);
        }
      }

      this._isLoaded = true;
      return true;
    } catch (err) {
      console.error('[Storage] Backend sync error:', err);
      return false;
    }
  },

  /* ---------------- Clients ---------------- */
  getClients() {
    return this._clients;
  },

  saveClients(clients) {
    this._clients = Array.isArray(clients) ? clients : [];
  },

  getClientById(id) {
    const idStr = String(id);
    return this._clients.find((c) => String(c.id) === idStr || String(c.client_code) === idStr) || null;
  },

  async addClient(clientData) {
    const monthlyAmount = parseFloat(clientData.monthlyAmount || clientData.monthly_amount) || 0;
    const retainerStatus = monthlyAmount > 0 ? (clientData.retainerStatus || clientData.retainer_status || 'active') : null;
    const dueDay = monthlyAmount > 0 ? (parseInt(clientData.dueDay || clientData.due_day, 10) || 5) : null;
    const joiningDate = clientData.joiningDate || clientData.joining_date || Utils.getTodayString();

    const payload = {
      name: clientData.name.trim(),
      company: (clientData.company || '').trim(),
      phone: (clientData.phone || '').trim(),
      email: (clientData.email || '').trim(),
      service: (clientData.service || '').trim(),
      monthly_amount: monthlyAmount,
      due_day: dueDay || 5,
      retainer_status: retainerStatus || 'active',
      status: clientData.status || 'active',
      joining_date: joiningDate,
      notes: (clientData.notes || '').trim()
    };

    if (!window.API || typeof API.clients === 'undefined') {
      throw new Error('API client is not available');
    }

    const created = await API.clients.create(payload);
    const newClient = this._mapClientFromApi(created);
    this._clients.unshift(newClient);
    return newClient;
  },

  async updateClient(id, clientData) {
    const idx = this._clients.findIndex((c) => String(c.id) === String(id));
    const current = idx !== -1 ? this._clients[idx] : {};

    const monthlyAmount = clientData.monthlyAmount !== undefined ? parseFloat(clientData.monthlyAmount) : (clientData.monthly_amount !== undefined ? parseFloat(clientData.monthly_amount) : (current.monthlyAmount || 0));
    let dueDay = current.dueDay;
    let retainerStatus = current.retainerStatus;
    if (monthlyAmount > 0) {
      dueDay = clientData.dueDay !== undefined ? (parseInt(clientData.dueDay, 10) || 5) : (clientData.due_day !== undefined ? (parseInt(clientData.due_day, 10) || 5) : (current.dueDay || 5));
      retainerStatus = clientData.retainerStatus !== undefined ? clientData.retainerStatus : (clientData.retainer_status !== undefined ? clientData.retainer_status : (current.retainerStatus || 'active'));
    }

    const payload = {
      name: clientData.name !== undefined ? clientData.name.trim() : (current.name || ''),
      company: clientData.company !== undefined ? clientData.company.trim() : (current.company || ''),
      phone: clientData.phone !== undefined ? clientData.phone.trim() : (current.phone || ''),
      email: clientData.email !== undefined ? clientData.email.trim() : (current.email || ''),
      service: clientData.service !== undefined ? clientData.service.trim() : (current.service || ''),
      monthly_amount: monthlyAmount,
      due_day: dueDay,
      retainer_status: retainerStatus,
      status: clientData.status || current.status || 'active',
      joining_date: clientData.joiningDate || clientData.joining_date || current.joiningDate || Utils.getTodayString(),
      notes: clientData.notes !== undefined ? clientData.notes.trim() : (current.notes || '')
    };

    if (!window.API || typeof API.clients === 'undefined') {
      throw new Error('API client is not available');
    }

    const updated = await API.clients.update(id, payload);
    const mapped = this._mapClientFromApi(updated);
    if (idx !== -1) {
      this._clients[idx] = mapped;
    } else {
      this._clients.unshift(mapped);
    }
    return mapped;
  },

  async deleteOrDeactivateClient(id) {
    if (!window.API || typeof API.clients === 'undefined') {
      throw new Error('API client is not available');
    }

    const res = await API.clients.delete(id);
    await this.syncFromBackend();
    return res || { action: 'deleted', message: 'Client removed' };
  },

  /* ---------------- Invoices ---------------- */
  getInvoices() {
    return this._invoices;
  },

  saveInvoices(invoices) {
    this._invoices = Array.isArray(invoices) ? invoices : [];
  },

  getInvoiceById(id) {
    const idStr = String(id);
    return this._invoices.find((inv) => String(inv.id) === idStr) || null;
  },

  async addInvoice(invoiceData) {
    const amount = parseFloat(invoiceData.amount) || 0;
    const clientId = invoiceData.clientId || invoiceData.client_id;

    const payload = {
      client_id: parseInt(clientId, 10) || clientId,
      service_name: (invoiceData.serviceName || invoiceData.service || 'Service').trim(),
      charge_type: invoiceData.chargeType || invoiceData.charge_type || 'standard',
      billing_month: invoiceData.billingMonth || invoiceData.billing_month,
      amount,
      due_date: invoiceData.dueDate || invoiceData.due_date,
      notes: (invoiceData.notes || '').trim()
    };

    if (!window.API || typeof API.invoices === 'undefined') {
      throw new Error('API client is not available');
    }

    const created = await API.invoices.create(payload);
    const newInvoice = this._mapInvoiceFromApi(created);
    this._invoices.unshift(newInvoice);
    return newInvoice;
  },

  async updateInvoice(id, invoiceData) {
    if (!window.API || typeof API.invoices === 'undefined') {
      throw new Error('API client is not available');
    }

    const updated = await API.invoices.update(id, invoiceData);
    const mapped = this._mapInvoiceFromApi(updated);
    const idx = this._invoices.findIndex((i) => String(i.id) === String(id));
    if (idx !== -1) {
      this._invoices[idx] = mapped;
    }
    return mapped;
  },

  async deleteInvoice(id) {
    if (!window.API || typeof API.invoices === 'undefined') {
      throw new Error('API client is not available');
    }

    await API.invoices.delete(id);
    await this.syncFromBackend();
    return true;
  },

  /* ---------------- Payments / Transactions ---------------- */
  getPayments() {
    return this._payments;
  },

  savePayments(payments) {
    this._payments = Array.isArray(payments) ? payments : [];
  },

  async recordPayment({ invoiceId, amount, paymentDate, paymentMethod, notes = '', referenceNumber = '' }) {
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const payload = {
      invoice_id: parseInt(invoiceId, 10) || invoiceId,
      amount: numAmount,
      payment_date: paymentDate || Utils.getTodayString(),
      payment_method: paymentMethod || 'Bank Transfer',
      notes: (notes || '').trim(),
      reference_number: (referenceNumber || '').trim()
    };

    if (!window.API || typeof API.payments === 'undefined') {
      throw new Error('API client is not available');
    }

    const res = await API.payments.record(payload);
    // Refresh both payments and invoices from database to get precise recalculations
    await this.syncFromBackend();
    return res;
  },

  getPaymentsByInvoiceId(invoiceId) {
    const idStr = String(invoiceId);
    return this._payments.filter((p) => String(p.invoiceId) === idStr || String(p.invoice_id) === idStr);
  },

  getPaymentsByClientId(clientId) {
    const idStr = String(clientId);
    return this._payments.filter((p) => String(p.clientId) === idStr || String(p.client_id) === idStr);
  },

  async deletePayment(id) {
    if (!window.API || typeof API.payments === 'undefined') {
      throw new Error('API client is not available');
    }

    await API.payments.delete(id);
    await this.syncFromBackend();
    return true;
  },

  /* ---------------- Expenses ---------------- */
  getExpenses() {
    return this._expenses;
  },

  saveExpenses(expenses) {
    this._expenses = Array.isArray(expenses) ? expenses : [];
  },

  getExpenseById(id) {
    const idStr = String(id);
    return this._expenses.find((exp) => String(exp.id) === idStr) || null;
  },

  async addExpense(expenseData) {
    const amount = parseFloat(expenseData.amount) || 0;

    const payload = {
      title: expenseData.title.trim(),
      category: expenseData.category.trim(),
      amount,
      date: expenseData.date || Utils.getTodayString(),
      description: (expenseData.description || '').trim()
    };

    if (!window.API || typeof API.expenses === 'undefined') {
      throw new Error('API client is not available');
    }

    const created = await API.expenses.create(payload);
    const newExpense = this._mapExpenseFromApi(created);
    this._expenses.unshift(newExpense);
    return newExpense;
  },

  async updateExpense(id, expenseData) {
    const amount = parseFloat(expenseData.amount) || 0;

    const payload = {
      title: expenseData.title.trim(),
      category: expenseData.category.trim(),
      amount,
      date: expenseData.date || Utils.getTodayString(),
      description: (expenseData.description || '').trim()
    };

    if (!window.API || typeof API.expenses === 'undefined') {
      throw new Error('API client is not available');
    }

    const updated = await API.expenses.update(id, payload);
    const mapped = this._mapExpenseFromApi(updated);
    const idx = this._expenses.findIndex((e) => String(e.id) === String(id));
    if (idx !== -1) {
      this._expenses[idx] = mapped;
    }
    return mapped;
  },

  async deleteExpense(id) {
    if (!window.API || typeof API.expenses === 'undefined') {
      throw new Error('API client is not available');
    }

    await API.expenses.delete(id);
    await this.syncFromBackend();
    return true;
  },

  /* ---------------- Settings ---------------- */
  getSettings() {
    return this._settings;
  },

  saveSettings(settings) {
    this._settings = { ...this.DEFAULT_SETTINGS, ...settings };
  },

  async saveSettingsToBackend(settingsData) {
    const payload = {
      business_name: settingsData.businessName !== undefined ? settingsData.businessName.trim() : (this._settings.businessName || ''),
      phone: settingsData.phone !== undefined ? settingsData.phone.trim() : (this._settings.phone || ''),
      email: settingsData.email !== undefined ? settingsData.email.trim() : (this._settings.email || ''),
      address: settingsData.address !== undefined ? settingsData.address.trim() : (this._settings.address || ''),
      currency: settingsData.currency || this._settings.currency || 'INR',
      billing_preference: parseInt(settingsData.billingPreference !== undefined ? settingsData.billingPreference : this._settings.billingPreference, 10) || 5,
      invoice_prefix: settingsData.invoicePrefix !== undefined ? settingsData.invoicePrefix.trim() : (this._settings.invoicePrefix || 'INV-')
    };

    if (!window.API || typeof API.settings === 'undefined') {
      throw new Error('API client is not available');
    }

    const updated = await API.settings.update(payload);
    const mapped = this._mapSettingsFromApi(updated);
    this._settings = mapped;
    return mapped;
  },

  /* ---------------- Monthly Invoices Batch Generation ---------------- */
  async generateMonthlyInvoices(billingMonth, clientIds = []) {
    if (!window.API || typeof API.invoices === 'undefined') {
      throw new Error('API client is not available');
    }

    const res = await API.invoices.generateMonthly(billingMonth, clientIds);
    await this.syncFromBackend();
    return res;
  },

  /* ---------------- Initialization & Storage Cleanup ---------------- */
  initStorage() {
    // Actively purge all legacy client-side localStorage database tables & obsolete auth keys
    const legacyKeys = [
      'cliento_clients',
      'cliento_invoices',
      'cliento_payments',
      'cliento_expenses',
      'cliento_settings',
      'cliento_initialized',
      'cliento_auth',
      'cliento_logged_out',
      'cliento_session'
    ];
    legacyKeys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore in restricted environments
      }
    });
  },

  clearAllData() {
    this._clients = [];
    this._invoices = [];
    this._payments = [];
    this._expenses = [];
    this._settings = { ...this.DEFAULT_SETTINGS };
    this.initStorage();
  },

  exportBackupJSON() {
    const backup = {
      app: 'Cliento',
      version: 2,
      database: 'MySQL / SQLite Backend',
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
    a.download = `cliento_database_backup_${Utils.getTodayString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

window.Storage = Storage;
