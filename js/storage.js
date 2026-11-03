/**
 * CLIENTO - LOCAL STORAGE & BACKEND API DATA BRIDGE
 * Bridges frontend UI operations directly to Core PHP REST API endpoints
 * while maintaining responsive offline-capable in-memory & localStorage caching.
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

  /* ---------------- MAPPERS (API <-> Frontend Models) ---------------- */
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
      status: inv.status || 'pending',
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

  /* ---------------- BACKEND SYNC ---------------- */
  async syncFromBackend() {
    if (!window.API) return false;

    try {
      // 1. Fetch Clients
      try {
        const clientsRes = await API.clients.getAll({ status: 'all' });
        const list = Array.isArray(clientsRes) ? clientsRes : (clientsRes && clientsRes.clients ? clientsRes.clients : null);
        if (Array.isArray(list)) {
          this.saveClients(list.map((c) => this._mapClientFromApi(c)));
        }
      } catch (e) {
        console.warn('[Sync] Clients fetch error:', e.message);
      }

      // 2. Fetch Invoices
      try {
        const invoicesRes = await API.invoices.getAll({ status: 'all' });
        const list = Array.isArray(invoicesRes) ? invoicesRes : (invoicesRes && invoicesRes.invoices ? invoicesRes.invoices : null);
        if (Array.isArray(list)) {
          this.saveInvoices(list.map((inv) => this._mapInvoiceFromApi(inv)));
        }
      } catch (e) {
        console.warn('[Sync] Invoices fetch error:', e.message);
      }

      // 3. Fetch Payments
      try {
        const paymentsRes = await API.payments.getAll();
        const list = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes && paymentsRes.payments ? paymentsRes.payments : null);
        if (Array.isArray(list)) {
          this.savePayments(list.map((p) => this._mapPaymentFromApi(p)));
        }
      } catch (e) {
        console.warn('[Sync] Payments fetch error:', e.message);
      }

      // 4. Fetch Expenses
      try {
        const expensesRes = await API.expenses.getAll();
        const list = Array.isArray(expensesRes) ? expensesRes : (expensesRes && expensesRes.expenses ? expensesRes.expenses : null);
        if (Array.isArray(list)) {
          this.saveExpenses(list.map((exp) => this._mapExpenseFromApi(exp)));
        }
      } catch (e) {
        console.warn('[Sync] Expenses fetch error:', e.message);
      }

      // 5. Fetch Settings
      try {
        const settingsRes = await API.settings.get();
        const s = settingsRes && settingsRes.settings ? settingsRes.settings : settingsRes;
        if (s && typeof s === 'object') {
          this.saveSettings(this._mapSettingsFromApi(s));
        }
      } catch (e) {
        console.warn('[Sync] Settings fetch error:', e.message);
      }

      return true;
    } catch (err) {
      console.warn('[Storage] Backend sync error:', err);
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
    const idStr = String(id);
    return this.getClients().find((c) => String(c.id) === idStr || String(c.client_code) === idStr) || null;
  },

  async addClient(clientData) {
    const clients = this.getClients();
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

    let newClient = null;

    // Send direct REST API request
    if (window.API && typeof API.clients !== 'undefined') {
      try {
        const created = await API.clients.create(payload);
        if (created) {
          newClient = this._mapClientFromApi(created);
        }
      } catch (err) {
        console.error('[API Create Client Error]', err);
        Utils.showToast(err.message || 'Error saving client to database', 'error');
        throw err;
      }
    }

    if (!newClient) {
      // Local fallback
      newClient = {
        id: Utils.generateId('cli'),
        ...payload,
        monthlyAmount,
        dueDay,
        retainerStatus,
        joiningDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    clients.unshift(newClient);
    this.saveClients(clients);
    return newClient;
  },

  async updateClient(id, clientData) {
    const clients = this.getClients();
    const idx = clients.findIndex((c) => String(c.id) === String(id));
    if (idx === -1) return null;

    const monthlyAmount = clientData.monthlyAmount !== undefined ? parseFloat(clientData.monthlyAmount) : (clientData.monthly_amount !== undefined ? parseFloat(clientData.monthly_amount) : clients[idx].monthlyAmount);
    let dueDay = clients[idx].dueDay;
    let retainerStatus = clients[idx].retainerStatus;
    if (monthlyAmount > 0) {
      dueDay = clientData.dueDay !== undefined ? (parseInt(clientData.dueDay, 10) || 5) : (clientData.due_day !== undefined ? (parseInt(clientData.due_day, 10) || 5) : (clients[idx].dueDay || 5));
      retainerStatus = clientData.retainerStatus !== undefined ? clientData.retainerStatus : (clientData.retainer_status !== undefined ? clientData.retainer_status : (clients[idx].retainerStatus || 'active'));
    }

    const payload = {
      name: clientData.name !== undefined ? clientData.name.trim() : clients[idx].name,
      company: clientData.company !== undefined ? clientData.company.trim() : (clients[idx].company || ''),
      phone: clientData.phone !== undefined ? clientData.phone.trim() : clients[idx].phone,
      email: clientData.email !== undefined ? clientData.email.trim() : clients[idx].email,
      service: clientData.service !== undefined ? clientData.service.trim() : clients[idx].service,
      monthly_amount: monthlyAmount,
      due_day: dueDay,
      retainer_status: retainerStatus,
      status: clientData.status || clients[idx].status,
      joining_date: clientData.joiningDate || clientData.joining_date || clients[idx].joiningDate,
      notes: clientData.notes !== undefined ? clientData.notes.trim() : (clients[idx].notes || '')
    };

    // Send direct REST API request
    if (window.API && typeof API.clients !== 'undefined' && !isNaN(parseInt(id, 10))) {
      try {
        const updated = await API.clients.update(id, payload);
        if (updated) {
          clients[idx] = this._mapClientFromApi(updated);
          this.saveClients(clients);
          return clients[idx];
        }
      } catch (err) {
        console.error('[API Update Client Error]', err);
        Utils.showToast(err.message || 'Error updating client in database', 'error');
        throw err;
      }
    }

    clients[idx] = {
      ...clients[idx],
      ...payload,
      monthlyAmount,
      dueDay,
      retainerStatus,
      joiningDate: payload.joining_date,
      updatedAt: new Date().toISOString()
    };
    this.saveClients(clients);
    return clients[idx];
  },

  async deleteOrDeactivateClient(id) {
    if (window.API && typeof API.clients !== 'undefined' && !isNaN(parseInt(id, 10))) {
      try {
        const res = await API.clients.delete(id);
        await this.syncFromBackend();
        return res || { action: 'deleted', message: 'Client removed' };
      } catch (err) {
        console.error('[API Delete Client Error]', err);
        Utils.showToast(err.message || 'Error deleting client from database', 'error');
        throw err;
      }
    }

    const invoices = this.getInvoices().filter((inv) => String(inv.clientId) === String(id));
    const payments = this.getPayments().filter((p) => String(p.clientId) === String(id));

    if (invoices.length > 0 || payments.length > 0) {
      await this.updateClient(id, { status: 'inactive' });
      return { action: 'deactivated', message: 'Client deactivated. Financial records preserved.' };
    } else {
      const clients = this.getClients().filter((c) => String(c.id) !== String(id));
      this.saveClients(clients);
      return { action: 'deleted', message: 'Client deleted.' };
    }
  },

  /* ---------------- Invoices ---------------- */
  getInvoices() {
    const invoices = this._get(this.KEYS.INVOICES, []);
    const today = Utils.getTodayString();
    return invoices.map((inv) => {
      const invPaise = Utils.toPaise(inv.amount);
      const paidPaise = Utils.toPaise(inv.paidAmount || inv.paid_amount || 0);

      let status = inv.status || 'pending';
      if (paidPaise >= invPaise && invPaise > 0) {
        status = 'paid';
      } else if (paidPaise > 0) {
        status = 'partial';
      } else if (inv.dueDate && today > inv.dueDate) {
        status = 'overdue';
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
    const idStr = String(id);
    return this.getInvoices().find((inv) => String(inv.id) === idStr) || null;
  },

  async addInvoice(invoiceData) {
    const invoices = this.getInvoices();
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

    let newInvoice = null;

    if (window.API && typeof API.invoices !== 'undefined' && !isNaN(parseInt(clientId, 10))) {
      try {
        const created = await API.invoices.create(payload);
        if (created) {
          newInvoice = this._mapInvoiceFromApi(created);
        }
      } catch (err) {
        console.error('[API Create Invoice Error]', err);
        Utils.showToast(err.message || 'Error saving invoice to database', 'error');
        throw err;
      }
    }

    if (!newInvoice) {
      const settings = this.getSettings();
      const count = invoices.length + 1;
      const invNumber = `${settings.invoicePrefix || 'INV-'}${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
      newInvoice = {
        id: Utils.generateId('inv'),
        invoiceNumber: invNumber,
        clientId: String(clientId),
        clientName: invoiceData.clientName || '',
        ...payload,
        paidAmount: 0,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
    }

    invoices.unshift(newInvoice);
    this.saveInvoices(invoices);
    return newInvoice;
  },

  async deleteInvoice(id) {
    if (window.API && typeof API.invoices !== 'undefined' && !isNaN(parseInt(id, 10))) {
      try {
        await API.invoices.delete(id);
        await this.syncFromBackend();
        return true;
      } catch (err) {
        console.error('[API Delete Invoice Error]', err);
        Utils.showToast(err.message || 'Error deleting invoice from database', 'error');
        throw err;
      }
    }

    const invoices = this._get(this.KEYS.INVOICES, []).filter((inv) => String(inv.id) !== String(id));
    this.saveInvoices(invoices);
    const payments = this.getPayments().filter((p) => String(p.invoiceId) !== String(id));
    this.savePayments(payments);
    return true;
  },

  /* ---------------- Payments / Transactions ---------------- */
  getPayments() {
    return this._get(this.KEYS.PAYMENTS, []);
  },

  savePayments(payments) {
    return this._set(this.KEYS.PAYMENTS, payments);
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

    if (window.API && typeof API.payments !== 'undefined' && !isNaN(parseInt(invoiceId, 10))) {
      try {
        const res = await API.payments.record(payload);
        // Re-sync payments and invoices directly from database
        await this.syncFromBackend();
        return res;
      } catch (err) {
        console.error('[API Record Payment Error]', err);
        Utils.showToast(err.message || 'Error recording payment in database', 'error');
        throw err;
      }
    }

    // Local fallback
    const invoices = this._get(this.KEYS.INVOICES, []);
    const invIndex = invoices.findIndex((inv) => String(inv.id) === String(invoiceId));
    if (invIndex === -1) {
      throw new Error('Invoice not found');
    }

    const invoice = invoices[invIndex];
    const invPaise = Utils.toPaise(invoice.amount);
    const existingPaidPaise = Utils.toPaise(invoice.paidAmount || 0);
    const remainingPaise = invPaise - existingPaidPaise;
    const paymentPaise = Utils.toPaise(amount);

    if (paymentPaise > remainingPaise) {
      throw new Error(`Payment cannot exceed outstanding balance of ${Utils.formatCurrency(Utils.fromPaise(remainingPaise))}`);
    }

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
      referenceNumber: (referenceNumber || '').trim(),
      createdAt: new Date().toISOString()
    };

    payments.unshift(newPayment);
    this.savePayments(payments);

    const newPaidPaise = existingPaidPaise + paymentPaise;
    invoice.paidAmount = Utils.fromPaise(newPaidPaise);
    invoice.status = newPaidPaise >= invPaise ? 'paid' : 'partial';
    this.saveInvoices(invoices);

    return { payment: newPayment, invoice };
  },

  getPaymentsByInvoiceId(invoiceId) {
    const idStr = String(invoiceId);
    return this.getPayments().filter((p) => String(p.invoiceId) === idStr || String(p.invoice_id) === idStr);
  },

  getPaymentsByClientId(clientId) {
    const idStr = String(clientId);
    return this.getPayments().filter((p) => String(p.clientId) === idStr || String(p.client_id) === idStr);
  },

  async deletePayment(id) {
    if (window.API && typeof API.payments !== 'undefined' && !isNaN(parseInt(id, 10))) {
      try {
        await API.payments.delete(id);
        await this.syncFromBackend();
        return true;
      } catch (err) {
        console.error('[API Delete Payment Error]', err);
        Utils.showToast(err.message || 'Error deleting payment from database', 'error');
        throw err;
      }
    }

    const payments = this.getPayments();
    const pIndex = payments.findIndex((p) => String(p.id) === String(id));
    if (pIndex === -1) return false;

    const payment = payments[pIndex];
    payments.splice(pIndex, 1);
    this.savePayments(payments);

    if (payment.invoiceId) {
      const invoices = this._get(this.KEYS.INVOICES, []);
      const inv = invoices.find((i) => String(i.id) === String(payment.invoiceId));
      if (inv) {
        const remainingPayments = payments.filter((p) => String(p.invoiceId) === String(payment.invoiceId));
        const totalPaidPaise = remainingPayments.reduce((acc, p) => acc + Utils.toPaise(p.amount), 0);
        inv.paidAmount = Utils.fromPaise(totalPaidPaise);
        const invPaise = Utils.toPaise(inv.amount);
        inv.status = (totalPaidPaise >= invPaise && invPaise > 0) ? 'paid' : (totalPaidPaise > 0 ? 'partial' : 'pending');
        this.saveInvoices(invoices);
      }
    }
    return true;
  },

  /* ---------------- Expenses ---------------- */
  getExpenses() {
    return this._get(this.KEYS.EXPENSES, []);
  },

  saveExpenses(expenses) {
    return this._set(this.KEYS.EXPENSES, expenses);
  },

  getExpenseById(id) {
    const idStr = String(id);
    return this.getExpenses().find((exp) => String(exp.id) === idStr) || null;
  },

  async addExpense(expenseData) {
    const expenses = this.getExpenses();
    const amount = parseFloat(expenseData.amount) || 0;

    const payload = {
      title: expenseData.title.trim(),
      category: expenseData.category.trim(),
      amount,
      date: expenseData.date || Utils.getTodayString(),
      description: (expenseData.description || '').trim()
    };

    let newExpense = null;

    if (window.API && typeof API.expenses !== 'undefined') {
      try {
        const created = await API.expenses.create(payload);
        if (created) {
          newExpense = this._mapExpenseFromApi(created);
        }
      } catch (err) {
        console.error('[API Create Expense Error]', err);
        Utils.showToast(err.message || 'Error saving expense to database', 'error');
        throw err;
      }
    }

    if (!newExpense) {
      newExpense = {
        id: Utils.generateId('exp'),
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    expenses.unshift(newExpense);
    this.saveExpenses(expenses);
    return newExpense;
  },

  async updateExpense(id, expenseData) {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex((e) => String(e.id) === String(id));
    if (idx === -1) return null;

    const payload = {
      title: expenseData.title !== undefined ? expenseData.title.trim() : expenses[idx].title,
      category: expenseData.category !== undefined ? expenseData.category.trim() : expenses[idx].category,
      amount: expenseData.amount !== undefined ? parseFloat(expenseData.amount) : expenses[idx].amount,
      date: expenseData.date || expenses[idx].date,
      description: expenseData.description !== undefined ? expenseData.description.trim() : expenses[idx].description
    };

    if (window.API && typeof API.expenses !== 'undefined' && !isNaN(parseInt(id, 10))) {
      try {
        const updated = await API.expenses.update(id, payload);
        if (updated) {
          expenses[idx] = this._mapExpenseFromApi(updated);
          this.saveExpenses(expenses);
          return expenses[idx];
        }
      } catch (err) {
        console.error('[API Update Expense Error]', err);
        Utils.showToast(err.message || 'Error updating expense in database', 'error');
        throw err;
      }
    }

    expenses[idx] = {
      ...expenses[idx],
      ...payload,
      updatedAt: new Date().toISOString()
    };
    this.saveExpenses(expenses);
    return expenses[idx];
  },

  async deleteExpense(id) {
    if (window.API && typeof API.expenses !== 'undefined' && !isNaN(parseInt(id, 10))) {
      try {
        await API.expenses.delete(id);
        await this.syncFromBackend();
        return true;
      } catch (err) {
        console.error('[API Delete Expense Error]', err);
        Utils.showToast(err.message || 'Error deleting expense from database', 'error');
        throw err;
      }
    }

    const expenses = this.getExpenses().filter((e) => String(e.id) !== String(id));
    this.saveExpenses(expenses);
    return true;
  },

  /* ---------------- Settings ---------------- */
  getSettings() {
    const stored = this._get(this.KEYS.SETTINGS, null);
    if (!stored) {
      return { ...this.DEFAULT_SETTINGS };
    }
    return { ...this.DEFAULT_SETTINGS, ...stored };
  },

  async saveSettings(settingsData) {
    const current = this.getSettings();
    const updated = {
      ...current,
      businessName: (settingsData.businessName || settingsData.business_name || '').trim(),
      phone: (settingsData.phone || '').trim(),
      email: (settingsData.email || '').trim(),
      address: (settingsData.address || '').trim(),
      currency: 'INR',
      billingPreference: parseInt(settingsData.billingPreference || settingsData.billing_preference, 10) || 5,
      invoicePrefix: (settingsData.invoicePrefix || settingsData.invoice_prefix || 'INV-').trim()
    };

    if (window.API && typeof API.settings !== 'undefined') {
      try {
        await API.settings.update({
          business_name: updated.businessName,
          phone: updated.phone,
          email: updated.email,
          address: updated.address,
          currency: 'INR',
          billing_preference: updated.billingPreference,
          invoice_prefix: updated.invoicePrefix
        });
      } catch (err) {
        console.error('[API Update Settings Error]', err);
      }
    }

    return this._set(this.KEYS.SETTINGS, updated);
  },

  /* ---------------- Monthly Invoices Batch Generation ---------------- */
  async generateMonthlyInvoices(billingMonth, clientIds = []) {
    if (window.API && typeof API.invoices !== 'undefined') {
      try {
        const res = await API.invoices.generateMonthly(billingMonth, clientIds);
        await this.syncFromBackend();
        return res;
      } catch (err) {
        console.error('[API Monthly Generator Error]', err);
        Utils.showToast(err.message || 'Error generating invoices', 'error');
        throw err;
      }
    }
  },

  /* ---------------- Initialization ---------------- */
  initStorage() {
    if (!localStorage.getItem(this.KEYS.INITIALIZED)) {
      localStorage.setItem(this.KEYS.INITIALIZED, 'true');
    }
  },

  clearAllData() {
    localStorage.removeItem(this.KEYS.CLIENTS);
    localStorage.removeItem(this.KEYS.INVOICES);
    localStorage.removeItem(this.KEYS.PAYMENTS);
    localStorage.removeItem(this.KEYS.EXPENSES);
    localStorage.removeItem(this.KEYS.SETTINGS);
    localStorage.setItem(this.KEYS.INITIALIZED, 'true');
  },

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
