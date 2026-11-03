/**
 * CLIENTO - CENTRALIZED REST API CLIENT
 * Encapsulates all backend HTTP communication, CSRF tokens, session state,
 * error handling, and payload transformations.
 */

const API = {
  BASE_URL: 'api',
  csrfToken: null,

  /**
   * Fetch CSRF token or read cached token
   */
  async getCsrfToken() {
    if (this.csrfToken) return this.csrfToken;

    try {
      const res = await fetch(`${this.BASE_URL}/auth/csrf.php`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (data && data.success && data.data && data.data.csrf_token) {
        this.csrfToken = data.data.csrf_token;
        return this.csrfToken;
      }
    } catch (e) {
      console.warn('[Cliento API] Failed to fetch CSRF token:', e);
    }
    return '';
  },

  /**
   * Universal fetch wrapper with automatic CSRF, JSON headers, and error handling
   */
  async request(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = {
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    // Attach CSRF token on state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = await this.getCsrfToken();
      if (csrf) {
        headers['X-CSRF-Token'] = csrf;
      }
    }

    // Attach Content-Type for JSON body
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json; charset=UTF-8';
      options.body = JSON.stringify(options.body);
    }

    try {
      const url = `${this.BASE_URL}/${endpoint}`;
      const response = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: 'same-origin'
      });

      const json = await response.json().catch(() => ({
        success: false,
        message: `HTTP ${response.status}: Non-JSON response received from server.`
      }));

      // Handle 401 Unauthorized (session expired)
      if (response.status === 401) {
        if (!endpoint.startsWith('auth/me') && !endpoint.startsWith('auth/login')) {
          if (window.Auth && typeof Auth.logout === 'function') {
            Auth.logout();
          }
        }
        throw new Error(json.message || 'Session expired. Please log in again.');
      }

      if (!response.ok || !json.success) {
        const errorMsg = json.message || `Request failed with status ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.errors = json.errors || {};
        throw err;
      }

      // Update CSRF token if returned in response data
      if (json.data && json.data.csrf_token) {
        this.csrfToken = json.data.csrf_token;
      }

      return json;
    } catch (err) {
      console.error(`[Cliento API Error] ${method} ${endpoint}:`, err);
      throw err;
    }
  },

  /* ---------------- AUTHENTICATION ---------------- */
  auth: {
    async login(email, password) {
      const res = await API.request('auth/login.php', {
        method: 'POST',
        body: { email, password }
      });
      return res.data;
    },

    async register(name, email, password) {
      const res = await API.request('auth/register.php', {
        method: 'POST',
        body: { name, email, password }
      });
      return res.data;
    },

    async logout() {
      const res = await API.request('auth/logout.php', { method: 'POST' });
      API.csrfToken = null;
      return res.data;
    },

    async me() {
      const res = await API.request('auth/me.php', { method: 'GET' });
      return res.data;
    }
  },

  /* ---------------- CLIENTS ---------------- */
  clients: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      const endpoint = `clients/index.php${query ? '?' + query : ''}`;
      const res = await API.request(endpoint, { method: 'GET' });
      return res.data;
    },

    async getById(id, isDossier = false) {
      const endpoint = `clients/detail.php?id=${encodeURIComponent(id)}${isDossier ? '&dossier=1' : ''}`;
      const res = await API.request(endpoint, { method: 'GET' });
      return res.data;
    },

    async create(clientData) {
      const res = await API.request('clients/index.php', {
        method: 'POST',
        body: clientData
      });
      return res.data;
    },

    async update(id, clientData) {
      const res = await API.request(`clients/detail.php?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: clientData
      });
      return res.data;
    },

    async delete(id) {
      const res = await API.request(`clients/detail.php?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return res.data;
    },

    async toggleRetainer(id) {
      const res = await API.request(`clients/detail.php?id=${encodeURIComponent(id)}&action=toggle_retainer`, {
        method: 'POST'
      });
      return res.data;
    }
  },

  /* ---------------- INVOICES ---------------- */
  invoices: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      const endpoint = `invoices/index.php${query ? '?' + query : ''}`;
      const res = await API.request(endpoint, { method: 'GET' });
      return res.data;
    },

    async getById(id, isHistory = false) {
      const endpoint = `invoices/detail.php?id=${encodeURIComponent(id)}${isHistory ? '&history=1' : ''}`;
      const res = await API.request(endpoint, { method: 'GET' });
      return res.data;
    },

    async create(invoiceData) {
      const res = await API.request('invoices/index.php', {
        method: 'POST',
        body: invoiceData
      });
      return res.data;
    },

    async update(id, invoiceData) {
      const res = await API.request(`invoices/detail.php?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: invoiceData
      });
      return res.data;
    },

    async delete(id) {
      const res = await API.request(`invoices/detail.php?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return res.data;
    },

    async generateMonthly(billingMonth, clientIds = []) {
      const res = await API.request('invoices/generate.php', {
        method: 'POST',
        body: {
          billing_month: billingMonth,
          client_ids: clientIds
        }
      });
      return res.data;
    }
  },

  /* ---------------- PAYMENTS ---------------- */
  payments: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      const endpoint = `payments/index.php${query ? '?' + query : ''}`;
      const res = await API.request(endpoint, { method: 'GET' });
      return res.data;
    },

    async record(paymentData) {
      const res = await API.request('payments/index.php', {
        method: 'POST',
        body: paymentData
      });
      return res.data;
    },

    async delete(id) {
      const res = await API.request(`payments/detail.php?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return res.data;
    }
  },

  /* ---------------- EXPENSES ---------------- */
  expenses: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      const endpoint = `expenses/index.php${query ? '?' + query : ''}`;
      const res = await API.request(endpoint, { method: 'GET' });
      return res.data;
    },

    async getById(id) {
      const res = await API.request(`expenses/detail.php?id=${encodeURIComponent(id)}`, {
        method: 'GET'
      });
      return res.data;
    },

    async create(expenseData) {
      const res = await API.request('expenses/index.php', {
        method: 'POST',
        body: expenseData
      });
      return res.data;
    },

    async update(id, expenseData) {
      const res = await API.request(`expenses/detail.php?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: expenseData
      });
      return res.data;
    },

    async delete(id) {
      const res = await API.request(`expenses/detail.php?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return res.data;
    },

    async getCategories() {
      const res = await API.request('expenses/categories.php', { method: 'GET' });
      return res.data;
    }
  },

  /* ---------------- REPORTS & DASHBOARD ---------------- */
  reports: {
    async getDashboardMetrics() {
      const res = await API.request('reports/index.php?type=dashboard', { method: 'GET' });
      return res.data;
    },

    async getFinancialReport(period = 'last6') {
      const res = await API.request(`reports/index.php?type=financial&period=${encodeURIComponent(period)}`, {
        method: 'GET'
      });
      return res.data;
    }
  },

  /* ---------------- SETTINGS ---------------- */
  settings: {
    async get() {
      const res = await API.request('settings/index.php', { method: 'GET' });
      return res.data;
    },

    async update(settingsData) {
      const res = await API.request('settings/index.php', {
        method: 'POST',
        body: settingsData
      });
      return res.data;
    }
  },

  /* ---------------- DATA MIGRATION ---------------- */
  migration: {
    async migrateLocalStorage(payload) {
      const res = await API.request('migrate/index.php', {
        method: 'POST',
        body: payload
      });
      return res.data;
    }
  }
};

window.API = API;
