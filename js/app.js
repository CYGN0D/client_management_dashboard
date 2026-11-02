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

    // 2. Initialize pure & clean authentication
    if (window.Auth && typeof Auth.init === 'function') {
      Auth.init();
    }

    // 3. Initialize modal accessibility triggers & universal table popups
    Utils.initModalListeners();
    if (typeof Utils.initTablePopups === 'function') {
      Utils.initTablePopups();
    }

    // 3. Initialize dark/light theme preference
    this.initTheme();

    // 4. Initialize custom DD/MM/YYYY datepicker component
    if (window.DatePicker && typeof DatePicker.init === 'function') {
      DatePicker.init();
    }

    // 5. Initialize all functional modules and attach form/button event listeners
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
    const handleHashRouting = (updateHash = false) => {
      const rawHash = window.location.hash.replace('#', '') || 'dashboard';
      if (rawHash.startsWith('client-detail')) {
        let clientId = null;
        if (rawHash.includes(':')) {
          clientId = rawHash.split(':')[1];
        } else if (rawHash.includes('?id=')) {
          clientId = rawHash.split('?id=')[1];
        } else if (rawHash.includes('/')) {
          clientId = rawHash.split('/')[1];
        }
        if (clientId && window.Clients) {
          Clients.activeDetailClientId = clientId;
        }
        this.navigateTo('client-detail', updateHash);
      } else {
        this.navigateTo(rawHash, updateHash);
      }
    };

    handleHashRouting(false);

    // 7. Handle browser back/forward buttons
    window.addEventListener('hashchange', () => {
      handleHashRouting(false);
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
      toggleBtn.addEventListener('click', (e) => {
        this.toggleThemeWithCircleAnimation(e);
      });
    }
  },

  isThemeAnimating: false,

  async toggleThemeWithCircleAnimation(event) {
    if (this.isThemeAnimating) return;

    const curTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = curTheme === 'dark' ? 'light' : 'dark';

    // If user prefers reduced motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.setTheme(nextTheme);
      return;
    }

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (!toggleBtn) {
      this.setTheme(nextTheme);
      return;
    }

    // Origin: Center coordinates of the theme toggle button
    const rect = toggleBtn.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    // Maximum distance from button to any corner of the viewport
    const endRadius = Math.ceil(Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    ));

    this.isThemeAnimating = true;

    // 1. Preferred modern path: View Transitions API (Reveals entire UI forward)
    if (document.startViewTransition) {
      try {
        const transition = document.startViewTransition(() => {
          this.setTheme(nextTheme, false);
        });

        await transition.ready;

        // Animate incoming new theme expanding forward from the button center
        const anim = document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: 460,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );

        await anim.finished;
        this.isThemeAnimating = false;
        return;
      } catch (e) {
        // Fallback to overlay animation if view transition failed
      }
    }

    // 2. Universal Fallback: Expanding Circle Overlay (Always Forward from 0px to endRadius)
    const overlay = document.getElementById('themeCircleOverlay');
    if (!overlay || !Element.prototype.animate) {
      this.setTheme(nextTheme);
      this.isThemeAnimating = false;
      return;
    }

    // Set overlay background color to the incoming target theme color
    overlay.style.backgroundColor = nextTheme === 'dark' ? '#0C0D10' : '#FFFFFF';
    overlay.style.visibility = 'visible';
    overlay.style.opacity = '1';

    // Always forward: 0px -> endRadius
    const anim = overlay.animate([
      { clipPath: `circle(0px at ${x}px ${y}px)` },
      { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` }
    ], {
      duration: 460,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards'
    });

    anim.onfinish = () => {
      this.setTheme(nextTheme);
      overlay.style.visibility = 'hidden';
      overlay.style.opacity = '0';
      anim.cancel();
      this.isThemeAnimating = false;
    };
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cliento_theme', theme);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
      toggleBtn.innerHTML = `<i data-lucide="${theme === 'dark' ? 'sun' : 'moon'}" class="theme-toggle-icon"></i>`;
    }
    Utils.refreshIcons();
  },

  navigateTo(pageId, updateHash = true) {
    const validPages = ['dashboard', 'clients', 'payments', 'expenses', 'reports', 'settings', 'client-detail'];
    const page = validPages.includes(pageId) ? pageId : 'dashboard';
    this.activePage = page;

    if (updateHash) {
      if (page === 'client-detail' && window.Clients && Clients.activeDetailClientId) {
        if (window.location.hash !== `#client-detail:${Clients.activeDetailClientId}`) {
          window.location.hash = `#client-detail:${Clients.activeDetailClientId}`;
        }
      } else if (window.location.hash !== `#${page}`) {
        window.location.hash = `#${page}`;
      }
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
      const navTarget = item.getAttribute('data-nav-page');
      if (navTarget === page || (page === 'client-detail' && navTarget === 'clients')) {
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
        'client-detail': 'Client Overview',
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
      case 'client-detail':
        if (window.Clients && Clients.activeDetailClientId) {
          Clients.renderClientDetailPage(Clients.activeDetailClientId);
        }
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
