/**
 * CLIENTO - CUSTOM DATE PICKER COMPONENT
 * Enforces DD/MM/YYYY format across all date input fields (Joining Date, Due Date, Payment Date, Expense Date).
 * Bridges user-facing DD/MM/YYYY text with internal ISO YYYY-MM-DD values.
 * Features:
 *  - Auto typing mask (DD/MM/YYYY)
 *  - Interactive themed calendar popover dropdown
 *  - Transparent property interceptor (.value getter returns ISO, setter updates display to DD/MM/YYYY)
 */

const DatePicker = {
  activeInput: null,
  popoverEl: null,
  currentViewYear: null,
  currentViewMonth: null, // 0-indexed (0 = Jan, 11 = Dec)

  init() {
    this.createPopoverDOM();
    this.attachInputs();

    // Close calendar on outside click
    document.addEventListener('click', (e) => {
      if (!this.popoverEl || !this.popoverEl.classList.contains('open')) return;
      if (this.popoverEl.contains(e.target)) return;
      if (e.target.closest('.date-picker-toggle-btn') || e.target.closest('.date-picker-input')) return;
      this.closePopover();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.popoverEl && this.popoverEl.classList.contains('open')) {
        this.closePopover();
      }
    });

    // Reposition on window resize or scroll
    window.addEventListener('resize', () => {
      if (this.activeInput && this.popoverEl && this.popoverEl.classList.contains('open')) {
        this.positionPopover(this.activeInput);
      }
    });

    window.addEventListener('scroll', () => {
      if (this.activeInput && this.popoverEl && this.popoverEl.classList.contains('open')) {
        this.positionPopover(this.activeInput);
      }
    }, true);
  },

  createPopoverDOM() {
    if (document.getElementById('clientoCalendarPopover')) {
      this.popoverEl = document.getElementById('clientoCalendarPopover');
      return;
    }

    const pop = document.createElement('div');
    pop.id = 'clientoCalendarPopover';
    pop.className = 'cliento-calendar-popover';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Calendar Date Picker');
    pop.innerHTML = `
      <div class="cal-header">
        <button type="button" class="cal-nav-btn" id="calPrevMonthBtn" aria-label="Previous Month">
          <i data-lucide="chevron-left"></i>
        </button>
        <div class="cal-title" id="calTitleDisplay">November 2026</div>
        <button type="button" class="cal-nav-btn" id="calNextMonthBtn" aria-label="Next Month">
          <i data-lucide="chevron-right"></i>
        </button>
      </div>
      <div class="cal-weekdays">
        <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
      </div>
      <div class="cal-days-grid" id="calDaysGrid"></div>
      <div class="cal-footer">
        <button type="button" class="cal-quick-btn" id="calTodayBtn">Today</button>
        <button type="button" class="cal-quick-btn" id="calCloseBtn" style="color:var(--color-text-secondary);">Close</button>
      </div>
    `;
    document.body.appendChild(pop);
    this.popoverEl = pop;

    // Header navigation
    const prevBtn = document.getElementById('calPrevMonthBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.navigateMonth(-1);
      });
    }

    const nextBtn = document.getElementById('calNextMonthBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.navigateMonth(1);
      });
    }

    // Quick today button
    const todayBtn = document.getElementById('calTodayBtn');
    if (todayBtn) {
      todayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const todayIso = (window.Utils && typeof Utils.getTodayString === 'function') 
          ? Utils.getTodayString() 
          : new Date().toISOString().split('T')[0];
        if (this.activeInput) {
          this.setDateOnInput(this.activeInput, todayIso);
        }
        this.closePopover();
      });
    }

    // Close button
    const closeBtn = document.getElementById('calCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closePopover();
      });
    }

    if (window.lucide) {
      lucide.createIcons({ root: pop });
    }
  },

  attachInputs() {
    const inputs = document.querySelectorAll('.date-picker-input');
    inputs.forEach((input) => this.bindInput(input));
  },

  bindInput(input) {
    if (!input || input._datePickerInitialized) return;
    input._datePickerInitialized = true;

    // Store internal ISO value
    input._isoValue = '';

    // Wrap around native value property
    const originalValueProp = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    Object.defineProperty(input, 'value', {
      get() {
        if (input._isoValue) return input._isoValue;
        const raw = originalValueProp.get.call(input);
        if (raw) {
          const iso = (window.Utils && typeof Utils.dmyToIso === 'function') ? Utils.dmyToIso(raw) : null;
          if (iso) return iso;
        }
        return raw || '';
      },
      set(val) {
        if (!val) {
          input._isoValue = '';
          originalValueProp.set.call(input, '');
          return;
        }
        // If YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          input._isoValue = val;
          const dmy = (window.Utils && typeof Utils.isoToDmy === 'function') ? Utils.isoToDmy(val) : val;
          originalValueProp.set.call(input, dmy);
        } else if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(val)) {
          // If DD/MM/YYYY
          const iso = (window.Utils && typeof Utils.dmyToIso === 'function') ? Utils.dmyToIso(val) : val;
          input._isoValue = iso || val;
          const dmy = (iso && window.Utils && typeof Utils.isoToDmy === 'function') ? Utils.isoToDmy(iso) : val;
          originalValueProp.set.call(input, dmy);
        } else {
          input._isoValue = val;
          originalValueProp.set.call(input, val);
        }
      },
      configurable: true
    });

    // Auto-mask digits to DD/MM/YYYY on user input
    input.addEventListener('input', (e) => {
      let raw = originalValueProp.get.call(input);
      if (e.inputType === 'deleteContentBackward') {
        return;
      }
      const digits = raw.replace(/\D/g, '').slice(0, 8);
      let formatted = digits;
      if (digits.length > 4) {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
      } else if (digits.length > 2) {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
      }

      if (formatted !== raw) {
        originalValueProp.set.call(input, formatted);
      }

      // Check if complete DD/MM/YYYY
      if (digits.length === 8) {
        const iso = (window.Utils && typeof Utils.dmyToIso === 'function') ? Utils.dmyToIso(formatted) : null;
        if (iso) {
          input._isoValue = iso;
          input.setCustomValidity('');
        } else {
          input._isoValue = '';
          input.setCustomValidity('Please enter a valid date in DD/MM/YYYY format');
        }
      } else {
        input._isoValue = '';
      }
    });

    input.addEventListener('blur', () => {
      const v = originalValueProp.get.call(input).trim();
      if (!v) {
        input._isoValue = '';
        input.setCustomValidity('');
        return;
      }
      const iso = (window.Utils && typeof Utils.dmyToIso === 'function') ? Utils.dmyToIso(v) : null;
      if (iso) {
        input._isoValue = iso;
        originalValueProp.set.call(input, Utils.isoToDmy(iso));
        input.setCustomValidity('');
      } else {
        input._isoValue = '';
        input.setCustomValidity('Please enter a valid date in DD/MM/YYYY format');
      }
    });

    input.addEventListener('dblclick', () => {
      this.togglePopover(input);
    });

    // Attach toggle button if inside .date-input-wrapper
    const wrapper = input.closest('.date-input-wrapper');
    if (wrapper) {
      const btn = wrapper.querySelector('.date-picker-toggle-btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.togglePopover(input);
        });
      }
    }
  },

  togglePopover(input) {
    if (this.popoverEl && this.popoverEl.classList.contains('open') && this.activeInput === input) {
      this.closePopover();
    } else {
      this.openPopover(input);
    }
  },

  openPopover(input) {
    this.activeInput = input;

    // Determine initial view year & month
    let targetDate = new Date();
    const currentIso = input.value;
    if (currentIso && /^\d{4}-\d{2}-\d{2}$/.test(currentIso)) {
      const [y, m, d] = currentIso.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
    }

    this.currentViewYear = targetDate.getFullYear();
    this.currentViewMonth = targetDate.getMonth();

    this.renderCalendarGrid();
    this.positionPopover(input);

    this.popoverEl.classList.add('open');
    if (window.lucide) {
      lucide.createIcons({ root: this.popoverEl });
    }
  },

  closePopover() {
    if (this.popoverEl) {
      this.popoverEl.classList.remove('open');
    }
    this.activeInput = null;
  },

  positionPopover(input) {
    if (!this.popoverEl) return;
    const rect = input.getBoundingClientRect();
    const popWidth = 280;
    const popHeight = 310;

    let left = rect.left;
    if (left + popWidth > window.innerWidth - 12) {
      left = window.innerWidth - popWidth - 12;
    }
    if (left < 12) left = 12;

    let top = rect.bottom + 6;
    if (top + popHeight > window.innerHeight - 12 && rect.top - popHeight - 6 > 0) {
      top = rect.top - popHeight - 6; // flip above if needed
    }

    this.popoverEl.style.left = `${Math.round(left)}px`;
    this.popoverEl.style.top = `${Math.round(top)}px`;
  },

  navigateMonth(direction) {
    this.currentViewMonth += direction;
    if (this.currentViewMonth < 0) {
      this.currentViewMonth = 11;
      this.currentViewYear -= 1;
    } else if (this.currentViewMonth > 11) {
      this.currentViewMonth = 0;
      this.currentViewYear += 1;
    }
    this.renderCalendarGrid();
    if (window.lucide) {
      lucide.createIcons({ root: this.popoverEl });
    }
  },

  renderCalendarGrid() {
    if (!this.popoverEl) return;
    const titleEl = document.getElementById('calTitleDisplay');
    const gridEl = document.getElementById('calDaysGrid');
    if (!titleEl || !gridEl) return;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    titleEl.textContent = `${monthNames[this.currentViewMonth]} ${this.currentViewYear}`;

    // Compute active selected ISO date
    const selectedIso = this.activeInput ? this.activeInput.value : '';
    const todayIso = (window.Utils && typeof Utils.getTodayString === 'function') 
      ? Utils.getTodayString() 
      : new Date().toISOString().split('T')[0];

    // Days in current month
    const daysInCurrentMonth = new Date(this.currentViewYear, this.currentViewMonth + 1, 0).getDate();
    // Day of week of 1st day (0 = Sun, 1 = Mon ... 6 = Sat) -> Convert to Monday-first (0 = Mon, 6 = Sun)
    let firstDayIndex = new Date(this.currentViewYear, this.currentViewMonth, 1).getDay();
    firstDayIndex = (firstDayIndex + 6) % 7;

    // Days in previous month
    const daysInPrevMonth = new Date(this.currentViewYear, this.currentViewMonth, 0).getDate();

    gridEl.innerHTML = '';

    // 1. Prev month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = this.currentViewMonth === 0 ? 11 : this.currentViewMonth - 1;
      const prevYear = this.currentViewMonth === 0 ? this.currentViewYear - 1 : this.currentViewYear;
      const dateIso = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day-cell other-month';
      btn.textContent = dayNum;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.activeInput) this.setDateOnInput(this.activeInput, dateIso);
        this.closePopover();
      });
      gridEl.appendChild(btn);
    }

    // 2. Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateIso = `${this.currentViewYear}-${String(this.currentViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day-cell';
      btn.textContent = day;

      if (dateIso === todayIso) {
        btn.classList.add('today');
      }
      if (dateIso === selectedIso) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.activeInput) this.setDateOnInput(this.activeInput, dateIso);
        this.closePopover();
      });
      gridEl.appendChild(btn);
    }

    // 3. Next month leading days to complete 35 or 42 grid cells
    const totalRendered = firstDayIndex + daysInCurrentMonth;
    const totalCells = totalRendered > 35 ? 42 : 35;
    const nextDaysNeeded = totalCells - totalRendered;

    for (let day = 1; day <= nextDaysNeeded; day++) {
      const nextMonth = this.currentViewMonth === 11 ? 0 : this.currentViewMonth + 1;
      const nextYear = this.currentViewMonth === 11 ? this.currentViewYear + 1 : this.currentViewYear;
      const dateIso = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day-cell other-month';
      btn.textContent = day;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.activeInput) this.setDateOnInput(this.activeInput, dateIso);
        this.closePopover();
      });
      gridEl.appendChild(btn);
    }
  },

  setDateOnInput(input, isoDate) {
    input.value = isoDate;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
};

window.DatePicker = DatePicker;
