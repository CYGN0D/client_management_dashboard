/**
 * CLIENTO - UTILITY FUNCTIONS
 * Currency formatting, date manipulation, safe integer arithmetic,
 * toast notifications, modal helpers, and validation.
 */

const Utils = {
  /**
   * Convert Rupees to safe integer Paise (1 INR = 100 paise)
   * @param {number|string} rupees 
   * @returns {number} Integer paise
   */
  toPaise(rupees) {
    const num = typeof rupees === 'string' ? parseFloat(rupees.replace(/[^\d.-]/g, '')) : Number(rupees);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  },

  /**
   * Convert safe integer Paise back to decimal Rupees
   * @param {number} paise 
   * @returns {number}
   */
  fromPaise(paise) {
    const p = Number(paise);
    if (isNaN(p)) return 0;
    return p / 100;
  },

  /**
   * Format numeric amount as Indian Rupees (₹1,25,000.00)
   * @param {number|string} amount 
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount) {
    const val = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(val);
    } catch (e) {
      return `₹${val.toFixed(2)}`;
    }
  },

  /**
   * Get current date as YYYY-MM-DD
   */
  getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Get current month as YYYY-MM
   */
  getCurrentMonthString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  },

  /**
   * Format date string to DD/MM/YYYY format everywhere
   * Accepts YYYY-MM-DD or DD/MM/YYYY and outputs DD/MM/YYYY
   * @param {string} dateStr 
   */
  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dateStr)) {
        return dateStr.replace(/-/g, '/');
      }
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = String(parseInt(parts[1], 10)).padStart(2, '0');
        const day = String(parseInt(parts[2], 10)).padStart(2, '0');
        return `${day}/${month}/${year}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  },

  /**
   * Convert ISO YYYY-MM-DD to DD/MM/YYYY
   */
  isoToDmy(isoStr) {
    if (!isoStr) return '';
    const m = String(isoStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return isoStr;
    return `${m[3]}/${m[2]}/${m[1]}`;
  },

  /**
   * Convert DD/MM/YYYY or DD-MM-YYYY to ISO YYYY-MM-DD
   */
  dmyToIso(dmyStr) {
    if (!dmyStr) return '';
    const m = String(dmyStr).trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (!m) return '';
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    const d = parseInt(day, 10);
    const mo = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return '';
    return `${year}-${month}-${day}`;
  },

  /**
   * Format YYYY-MM to readable month like "November 2026"
   * @param {string} monthStr 
   */
  formatMonth(monthStr) {
    if (!monthStr) return '—';
    try {
      const [year, month] = monthStr.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    } catch (e) {
      return monthStr;
    }
  },

  /**
   * Get short month name from YYYY-MM (e.g. "Nov '26")
   */
  formatShortMonth(monthStr) {
    if (!monthStr) return '';
    try {
      const [year, month] = monthStr.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return d.toLocaleDateString('en-IN', { month: 'short' });
    } catch (e) {
      return monthStr;
    }
  },

  /**
   * Return dynamic time-based greeting
   */
  getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon';
    } else {
      return 'Good evening';
    }
  },

  /**
   * Get array of the last N billing months (YYYY-MM) in chronological order
   */
  getLastNMonths(count = 6) {
    const result = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      result.push(`${year}-${month}`);
    }
    return result;
  },

  /**
   * Calculate due date string YYYY-MM-DD for a given year-month and due day (1-28)
   */
  calculateDueDate(yearMonth, dueDay) {
    const day = Math.min(Math.max(parseInt(dueDay, 10) || 5, 1), 28);
    const dayStr = String(day).padStart(2, '0');
    return `${yearMonth}-${dayStr}`;
  },

  /**
   * Unique ID generation
   */
  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  },

  /**
   * Minimal toast notification
   * @param {string} message 
   * @param {'success'|'error'|'info'} type 
   * @param {number} duration 
   */
  showToast(message, type = 'info', duration = 3200) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icon
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width:16px;height:16px;flex-shrink:0;"></i>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    this.refreshIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.2s ease-out';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  },

  /**
   * Copy text to clipboard with fallback and toast confirmation
   */
  copyToClipboard(text, label = 'Copied to clipboard') {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(label, 'success', 1800);
      }).catch(() => {
        this._fallbackCopy(text, label);
      });
    } else {
      this._fallbackCopy(text, label);
    }
  },

  _fallbackCopy(text, label) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.showToast(label, 'success', 1800);
    } catch (e) {
      this.showToast('Could not copy to clipboard', 'info', 1800);
    }
  },

  /**
   * Simple confirmation dialog (no browser alert/confirm)
   */
  confirm({ title = 'Confirm Action', message, confirmText = 'Confirm', confirmDanger = false }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const titleEl = document.getElementById('confirmModalTitle');
      const msgEl = document.getElementById('confirmModalMessage');
      const okBtn = document.getElementById('confirmModalOkBtn');
      const cancelBtn = document.getElementById('confirmModalCancelBtn');

      if (!modal || !okBtn || !cancelBtn) {
        resolve(window.confirm(message));
        return;
      }

      titleEl.textContent = title;
      msgEl.textContent = message;
      okBtn.textContent = confirmText;

      if (confirmDanger) {
        okBtn.className = 'btn btn-danger-solid';
      } else {
        okBtn.className = 'btn btn-primary';
      }

      const cleanup = (confirmed) => {
        modal.classList.remove('open');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKey);
        resolve(confirmed);
      };

      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onKey = (e) => {
        if (e.key === 'Escape') cleanup(false);
      };

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKey);

      modal.classList.add('open');
      okBtn.focus();
    });
  },

  /**
   * Open modal helper
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      modal.style.display = 'flex';
      const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea, button.btn-primary');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 50);
      }
    }
  },

  /**
   * Close modal helper
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      modal.style.display = 'none';
    }
  },

  /**
   * Setup global modal dismiss triggers (Escape key & backdrop click)
   */
  initModalListeners() {
    if (this._modalListenersBound) return;
    this._modalListenersBound = true;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal-backdrop.open');
        openModals.forEach((m) => {
          m.classList.remove('open');
          m.style.display = 'none';
        });
      }
    });

    document.addEventListener('click', (e) => {
      // Backdrop click
      if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
        e.target.classList.remove('open');
        e.target.style.display = 'none';
      }
      // Close button click ([data-modal-close] or .modal-close)
      const closeBtn = e.target.closest('[data-modal-close], .modal-close');
      if (closeBtn) {
        e.preventDefault();
        const backdrop = closeBtn.closest('.modal-backdrop');
        if (backdrop) {
          backdrop.classList.remove('open');
          backdrop.style.display = 'none';
        }
      }
    });
  },

  /**
   * Form validation helpers
   */
  setFieldError(inputEl, errorMsg) {
    if (!inputEl) return;
    inputEl.classList.add('is-invalid');
    const group = inputEl.closest('.form-group');
    if (group) {
      let errEl = group.querySelector('.form-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'form-error';
        group.appendChild(errEl);
      }
      errEl.textContent = errorMsg;
    }
  },

  clearFieldErrors(formEl) {
    if (!formEl) return;
    formEl.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
    formEl.querySelectorAll('.form-error').forEach((el) => {
      el.textContent = '';
    });
  },

  validateEmail(email) {
    if (!email) return true; // Optional field
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Refresh Lucide icons with offline fallback
   */
  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try {
        window.lucide.createIcons();
        return;
      } catch (e) {
        console.warn('Lucide createIcons error:', e);
      }
    }

    // Offline SVG Fallback
    const icons = {
      'layout-dashboard': '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
      'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
      'user-x': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/>',
      'receipt': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6"/><path d="M16 12h-6"/><path d="M16 16h-6"/>',
      'wallet': '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
      'bar-chart-3': '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
      'bar-chart-2': '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
      'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      'menu': '<line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/>',
      'plus': '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      'trending-up': '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
      'check-circle-2': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
      'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
      'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      'file-text': '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
      'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
      'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      'arrow-right': '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
      'more-vertical': '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
      'eye': '<path d="2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
      'edit-2': '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
      'trash-2': '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
      'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
      'plus-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
      'history': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/><polyline points="12 7 12 12 15 15"/>',
      'calendar': '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
      'credit-card': '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
      'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
      'x': '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      'check': '<polyline points="20 6 9 17 4 12"/>',
      'search': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
      'info': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
      'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
      'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
      'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
      'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
      'mail': '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
      'repeat': '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
      'layers': '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
      'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
      'play': '<polygon points="6 3 20 12 6 21 6 3"/>',
      'pause': '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
      'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      'building': '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
      'table': '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
      'layout-grid': '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'
    };

    document.querySelectorAll('[data-lucide]').forEach((el) => {
      const name = el.getAttribute('data-lucide');
      if (icons[name]) {
        el.outerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name}">${icons[name]}</svg>`;
      }
    });
  },

  /**
   * Universal Interactive Data Popup Tooltip for tables
   */
  initTablePopups() {
    if (this._tablePopupsInitialized) return;
    this._tablePopupsInitialized = true;

    let popupEl = document.getElementById('tableDataPopup');
    if (!popupEl) {
      popupEl = document.createElement('div');
      popupEl.id = 'tableDataPopup';
      popupEl.className = 'table-data-popup';
      document.body.appendChild(popupEl);
    }

    let hideTimeout = null;

    const showPopup = (target) => {
      const content = target.getAttribute('data-table-popup');
      if (!content) return;

      clearTimeout(hideTimeout);
      popupEl.innerHTML = content;
      popupEl.classList.add('show');
      popupEl._activeTarget = target;

      const rect = target.getBoundingClientRect();
      const popupRect = popupEl.getBoundingClientRect();

      let top = rect.top - popupRect.height - 8;
      let left = rect.left + (rect.width / 2) - (popupRect.width / 2);

      // Flip below if not enough room above
      if (top < 10) {
        top = rect.bottom + 8;
      }

      // Check right & left bounds
      if (left < 10) left = 10;
      if (left + popupRect.width > window.innerWidth - 10) {
        left = window.innerWidth - popupRect.width - 10;
      }

      // Check bottom bounds
      if (top + popupRect.height > window.innerHeight - 10) {
        top = window.innerHeight - popupRect.height - 10;
        if (top < 10) top = 10;
      }

      popupEl.style.top = `${top}px`;
      popupEl.style.left = `${left}px`;
    };

    const hidePopup = () => {
      hideTimeout = setTimeout(() => {
        popupEl.classList.remove('show');
        popupEl._activeTarget = null;
      }, 150);
    };

    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-table-popup]');
      if (target) {
        showPopup(target);
      } else if (!e.target.closest('#tableDataPopup')) {
        hidePopup();
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('[data-table-popup]');
      if (target) {
        hidePopup();
      }
    });

    popupEl.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
    });

    popupEl.addEventListener('mouseleave', () => {
      hidePopup();
    });

    popupEl.addEventListener('click', (e) => {
      if (e.target.closest('.table-data-popup-close')) {
        popupEl.classList.remove('show');
        popupEl._activeTarget = null;
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('#tableDataPopup')) return;

      const target = e.target.closest('[data-table-popup]');
      if (target) {
        if (popupEl.classList.contains('show') && popupEl._activeTarget === target) {
          popupEl.classList.remove('show');
          popupEl._activeTarget = null;
        } else {
          showPopup(target);
        }
      } else {
        popupEl.classList.remove('show');
        popupEl._activeTarget = null;
      }
    });

    window.addEventListener('scroll', () => {
      if (popupEl.classList.contains('show')) {
        popupEl.classList.remove('show');
        popupEl._activeTarget = null;
      }
    }, { passive: true });
  }
};

// Auto-initialize when document is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Utils.initTablePopups());
  } else {
    Utils.initTablePopups();
  }
}

window.Utils = Utils;
