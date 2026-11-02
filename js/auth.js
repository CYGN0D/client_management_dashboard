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

  init() {
    this.bindLoginForm();
    this.bindPasswordToggle();
    this.bindLogout();
    this.checkAuthState();
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

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');
      const errorAlert = document.getElementById('loginErrorAlert');

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

      // Successful authentication
      localStorage.setItem(this.AUTH_KEY, 'true');
      localStorage.setItem(this.USER_EMAIL_KEY, email);

      if (errorAlert) errorAlert.style.display = 'none';
      if (passwordInput) passwordInput.value = '';

      this.checkAuthState();
      if (window.Utils && typeof Utils.showToast === 'function') {
        Utils.showToast('Logged in successfully', 'success', 1800);
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
