/**
 * CLIENTO - AUTHENTICATION MODULE
 * Pure, clean, minimalist login handling.
 * Features:
 *  - Email & password verification
 *  - Password visibility toggle (eye button)
 *  - Zero descriptions or marketing fluff
 *  - State persistence in localStorage
 */

const Auth = {
  AUTH_KEY: 'cliento_auth',
  USER_EMAIL_KEY: 'cliento_user_email',

  async init() {
    this.bindLoginForm();
    this.bindPasswordToggle();
    this.bindLogout();
    await this.ensureBackendSession();
    this.checkAuthState();
  },

  async ensureBackendSession() {
    if (window.API && typeof API.auth !== 'undefined') {
      try {
        const me = await API.auth.me();
        if (me && me.id) {
          localStorage.setItem(this.AUTH_KEY, 'true');
          localStorage.setItem(this.USER_EMAIL_KEY, me.email || 'admin@cliento.com');
          return;
        }
      } catch (e) {
        // Auto-login default admin for local development if auth is flagged
        const isAuth = localStorage.getItem(this.AUTH_KEY) === 'true';
        if (isAuth) {
          const email = localStorage.getItem(this.USER_EMAIL_KEY) || 'admin@cliento.com';
          try {
            await API.auth.login(email, 'admin123');
          } catch (err) {
            // Keep on login screen
          }
        }
      }
    }
  },

  isAuthenticated() {
    return localStorage.getItem(this.AUTH_KEY) === 'true';
  },

  checkAuthState() {
    const loginView = document.getElementById('loginView');
    const appContainer = document.querySelector('.app-container');

    if (this.isAuthenticated()) {
      if (loginView) loginView.style.display = 'none';
      if (appContainer) appContainer.style.display = 'flex';
      const userEmailEl = document.getElementById('settingsUserEmailText');
      if (userEmailEl) {
        userEmailEl.textContent = localStorage.getItem(this.USER_EMAIL_KEY) || 'admin@cliento.com';
      }
      // Refresh lucide icons when app container becomes visible
      if (window.Utils && typeof Utils.refreshIcons === 'function') {
        Utils.refreshIcons();
      }
    } else {
      if (loginView) {
        loginView.style.display = 'flex';
        // Pre-fill email if previously used
        const savedEmail = localStorage.getItem(this.USER_EMAIL_KEY) || 'admin@cliento.com';
        const emailInput = document.getElementById('loginEmail');
        if (emailInput && !emailInput.value) {
          emailInput.value = savedEmail;
        }
      }
      if (appContainer) appContainer.style.display = 'none';
    }
  },

  bindLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');
      const errorAlert = document.getElementById('loginErrorAlert');
      const submitBtn = document.getElementById('loginSubmitBtn');

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!email || !password) {
        if (errorAlert) {
          errorAlert.textContent = 'Please enter both email and password';
          errorAlert.style.display = 'block';
        }
        return;
      }

      // Basic email check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        if (errorAlert) {
          errorAlert.textContent = 'Please enter a valid email address';
          errorAlert.style.display = 'block';
        }
        return;
      }

      if (password.length < 4) {
        if (errorAlert) {
          errorAlert.textContent = 'Password must be at least 4 characters';
          errorAlert.style.display = 'block';
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
      }

      try {
        if (window.API && typeof API.auth !== 'undefined') {
          await API.auth.login(email, password);
        }

        localStorage.setItem(this.AUTH_KEY, 'true');
        localStorage.setItem(this.USER_EMAIL_KEY, email);

        if (errorAlert) errorAlert.style.display = 'none';
        if (passwordInput) passwordInput.value = '';

        this.checkAuthState();

        // Sync fresh database data from backend
        if (window.Storage && typeof Storage.syncFromBackend === 'function') {
          await Storage.syncFromBackend();
          if (window.Clients) Clients.render();
          if (window.Payments) Payments.render();
          if (window.Expenses) Expenses.render();
          if (window.Dashboard) Dashboard.render();
          if (window.Reports) Reports.render();
        }

        if (window.Utils && typeof Utils.showToast === 'function') {
          Utils.showToast('Logged in successfully', 'success', 1800);
        }
      } catch (err) {
        if (errorAlert) {
          errorAlert.textContent = err.message || 'Invalid email or password';
          errorAlert.style.display = 'block';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Log In';
        }
      }
    });
  },

  bindPasswordToggle() {
    const toggleBtn = document.getElementById('togglePasswordVisibilityBtn');
    const passwordInput = document.getElementById('loginPassword');
    if (!toggleBtn || !passwordInput) return;

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';

      const icon = toggleBtn.querySelector('i, svg');
      if (icon) {
        icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        if (window.Utils && typeof Utils.refreshIcons === 'function') {
          Utils.refreshIcons();
        }
      }
    });
  },

  bindLogout() {
    document.addEventListener('click', (e) => {
      const logoutBtn = e.target.closest('#logoutBtn, .btn-logout');
      if (logoutBtn) {
        e.preventDefault();
        this.logout();
      }
    });
  },

  logout() {
    localStorage.removeItem(this.AUTH_KEY);
    this.checkAuthState();
    if (window.Utils && typeof Utils.showToast === 'function') {
      Utils.showToast('Logged out successfully', 'info', 1800);
    }
    const passwordInput = document.getElementById('loginPassword');
    if (passwordInput) passwordInput.value = '';
    const errorAlert = document.getElementById('loginErrorAlert');
    if (errorAlert) errorAlert.style.display = 'none';
  }
};

window.Auth = Auth;
