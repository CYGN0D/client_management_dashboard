/**
 * CLIENTO - MAIN APPLICATION CONTROLLER
 * Routing, SPA hash navigation, mobile drawer toggling,
 * lifecycle initialization, and global event coordination.
 */

const App = {
  activePage: 'dashboard',

  init() {
    // 1. Initialize persistent storage layer (clean real data)
    Storage.initStorage();

    // 2. Initialize modal accessibility triggers
    Utils.initModalListeners();

    // 3. Initialize dark/light theme preference
    this.initTheme();

    // 4. Initialize all functional modules and attach form/button event listeners
    if (window.Clients && typeof Clients.init === 'function') Clients.init();
    if (window.Payments && typeof Payments.init === 'function') Payments.init();
    if (window.Expenses && typeof Expenses.init === 'function') Expenses.init();
    if (window.Dashboard && typeof Dashboard.init === 'function') Dashboard.init();
    if (window.Reports && typeof Reports.init === 'function') Reports.init();
    if (window.Settings && typeof Settings.init === 'function') Settings.init();

    // 4. Set up sidebar navigation and routing
    this.bindNavigation();

    // 5. Set up mobile hamburger drawer
    this.bindMobileDrawer();

    // 6. Route to initial page from URL hash or default to dashboard
    const initialHash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigateTo(initialHash, false);

    // 7. Handle browser back/forward buttons
    window.addEventListener('hashchange', () => {
      const page = window.location.hash.replace('#', '') || 'dashboard';
      this.navigateTo(page, false);
    });

    // 8. Refresh Lucide icons
    Utils.refreshIcons();
  },

  bindNavigation() {
    // Navigation links in sidebar
    document.querySelectorAll('[data-nav-page]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = link.getAttribute('data-nav-page');
        this.navigateTo(targetPage);
        this.closeMobileDrawer();
      });
    });
  },

  bindMobileDrawer() {
    const toggleBtn = document.getElementById('mobileMenuToggleBtn');
    const sidebar = document.querySelector('.app-sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (toggleBtn && sidebar && backdrop) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('drawer-open');
        backdrop.classList.toggle('active');
      });

      backdrop.addEventListener('click', () => {
        this.closeMobileDrawer();
      });
    }
  },

  closeMobileDrawer() {
    const sidebar = document.querySelector('.app-sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('drawer-open');
    if (backdrop) backdrop.classList.remove('active');
  },

  initTheme() {
    const savedTheme = localStorage.getItem('cliento_theme') || 
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.setTheme(savedTheme, false);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const curTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const nextTheme = curTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(nextTheme, true);
      });
    }
  },

  setTheme(theme, showToast = false) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cliento_theme', theme);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
      toggleBtn.innerHTML = `<i data-lucide="${theme === 'dark' ? 'sun' : 'moon'}" class="theme-toggle-icon"></i>`;
    }
    Utils.refreshIcons();

    if (showToast) {
      Utils.showToast(`${theme === 'dark' ? 'Dark' : 'Light'} theme applied`, 'info', 1800);
    }
  },

  navigateTo(pageId, updateHash = true) {
    const validPages = ['dashboard', 'clients', 'payments', 'expenses', 'reports', 'settings'];
    const page = validPages.includes(pageId) ? pageId : 'dashboard';
    this.activePage = page;

    if (updateHash && window.location.hash !== `#${page}`) {
      window.location.hash = `#${page}`;
    }

    // Toggle active page view
    document.querySelectorAll('.page-view').forEach((view) => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${page}`);
    if (activeView) {
      activeView.classList.add('active');
    }

    // Toggle active nav link
    document.querySelectorAll('.nav-item').forEach((item) => {
      if (item.getAttribute('data-nav-page') === page) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update top navbar breadcrumb title
    const navTitle = document.getElementById('topNavbarTitle');
    if (navTitle) {
      const titles = {
        dashboard: 'Dashboard Overview',
        clients: 'Client Management',
        payments: 'Monthly Invoicing & Payments',
        expenses: 'Operating Expenses',
        reports: 'Financial Reports & Profitability',
        settings: 'System & Business Preferences'
      };
      navTitle.textContent = titles[page] || 'Dashboard';
    }

    // Refresh page data on navigation
    switch (page) {
      case 'dashboard':
        if (window.Dashboard) Dashboard.render();
        break;
      case 'clients':
        if (window.Clients) Clients.render();
        break;
      case 'payments':
        if (window.Payments) Payments.render();
        break;
      case 'expenses':
        if (window.Expenses) Expenses.render();
        break;
      case 'reports':
        if (window.Reports) Reports.render();
        break;
      case 'settings':
        if (window.Settings) Settings.loadValues();
        break;
    }

    // Refresh Lucide icons
    Utils.refreshIcons();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
};

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
