/**
 * CLIENTO - AUTHENTICATION MODULE
 * Pure, authoritative server-side session authentication.
 * Server session cookie is the SOLE authority for authentication state.
 */

const Auth = {
  currentUser: null,
  USER_EMAIL_KEY: 'cliento_user_email',
  _isLoggingOut: false,
  _isHandlingExpiry: false,

  async init() {
    this.bindLoginForm();
    this.bindPasswordToggle();
    this.bindLogout();

    // Clean up any legacy/insecure client-side auth tokens
    try {
      localStorage.removeItem('cliento_auth');
      localStorage.removeItem('cliento_logged_out');
    } catch (e) {}

    // Verify session directly with the server
    const isAuthed = await this.verifyServerSession();
    this.checkAuthState();
    return isAuthed;
  },

  /**
   * Verify session validity with backend /api/auth/me.php
   */
  async verifyServerSession() {
    if (!window.API || typeof API.auth === 'undefined') {
      this.currentUser = null;
      return false;
    }

    try {
      const me = await API.auth.me();
      if (me && me.id) {
        this.currentUser = me;
        if (me.email) {
          try {
            localStorage.setItem(this.USER_EMAIL_KEY, me.email);
          } catch (e) {}
        }
        return true;
      }
    } catch (e) {
      // 401 Unauthorized or network error: session not active
      this.currentUser = null;
    }

    this.currentUser = null;
    return false;
  },

  isAuthenticated() {
    return Boolean(this.currentUser && this.currentUser.id);
  },

  checkAuthState() {
    const loginView = document.getElementById('loginView');
    const appContainer = document.querySelector('.app-container');
    const email = (this.currentUser && this.currentUser.email) ||
                  localStorage.getItem(this.USER_EMAIL_KEY) ||
                  '';

    if (this.isAuthenticated()) {
      if (loginView) loginView.style.display = 'none';
      if (appContainer) appContainer.style.display = 'flex';

      const userEmailEl = document.getElementById('settingsUserEmailText');
      if (userEmailEl) userEmailEl.textContent = this.currentUser.email;

      const sidebarEmailEl = document.getElementById('sidebarUserEmail');
      if (sidebarEmailEl) sidebarEmailEl.textContent = this.currentUser.email;

      if (window.Utils && typeof Utils.refreshIcons === 'function') {
        Utils.refreshIcons();
      }
    } else {
      if (loginView) {
        loginView.style.display = 'flex';
        const emailInput = document.getElementById('loginEmail');
        if (emailInput && !emailInput.value && email) {
          emailInput.value = email;
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
        if (!window.API || typeof API.auth === 'undefined') {
          throw new Error('API service unavailable.');
        }

        const res = await API.auth.login(email, password);
        this.currentUser = res;

        try {
          localStorage.setItem(this.USER_EMAIL_KEY, email);
        } catch (e) {}

        if (errorAlert) errorAlert.style.display = 'none';
        if (passwordInput) passwordInput.value = '';

        this.checkAuthState();

        // Sync fresh database data from backend and render all modules
        if (window.Storage && typeof Storage.syncFromBackend === 'function') {
          await Storage.syncFromBackend();
        }
        if (window.App && typeof App.renderAllPages === 'function') {
          App.renderAllPages();
        }

        if (window.Utils && typeof Utils.showToast === 'function') {
          Utils.showToast(`Welcome back, ${res.name || 'Admin'}!`, 'success', 2000);
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
    const toggleBtn = document.getElementById('togglePasswordVisibilityBtn') || document.getElementById('loginTogglePassword');
    const passwordInput = document.getElementById('loginPassword');
    if (!toggleBtn || !passwordInput) return;

    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

      const icon = toggleBtn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        if (window.Utils && typeof Utils.refreshIcons === 'function') {
          Utils.refreshIcons();
        }
      }
    });
  },

  bindLogout() {
    document.addEventListener('click', async (e) => {
      const logoutBtn = e.target.closest('#logoutBtn, .btn-logout');
      if (logoutBtn) {
        e.preventDefault();
        const confirmed = await Utils.confirm({
          title: 'Log Out',
          message: 'Are you sure you want to end your current session?',
          confirmText: 'Log Out',
          confirmDanger: true
        });

        if (confirmed) {
          await this.logout();
        }
      }
    });
  },

  async logout() {
    if (this._isLoggingOut) return;
    this._isLoggingOut = true;

    try {
      if (window.API && typeof API.auth !== 'undefined') {
        await API.auth.logout();
      }
    } catch (e) {
      // Continue client cleanup even if network fails
    }

    this.currentUser = null;

    if (window.Storage) {
      Storage.clearAllData();
    }

    if (window.Clients) {
      Clients.activeDetailClientId = null;
    }

    this.checkAuthState();

    if (window.Utils && typeof Utils.showToast === 'function') {
      Utils.showToast('Logged out successfully', 'info', 1800);
    }

    const passwordInput = document.getElementById('loginPassword');
    if (passwordInput) passwordInput.value = '';
    const errorAlert = document.getElementById('loginErrorAlert');
    if (errorAlert) errorAlert.style.display = 'none';

    this._isLoggingOut = false;
  },

  handleSessionExpired() {
    if (this._isHandlingExpiry || !this.currentUser) return;
    this._isHandlingExpiry = true;

    this.currentUser = null;

    if (window.Storage) {
      Storage.clearAllData();
    }

    if (window.Clients) {
      Clients.activeDetailClientId = null;
    }

    this.checkAuthState();

    if (window.Utils && typeof Utils.showToast === 'function') {
      Utils.showToast('Your session has expired. Please log in again.', 'warning', 2500);
    }

    setTimeout(() => {
      this._isHandlingExpiry = false;
    }, 1500);
  }
};

window.Auth = Auth;
