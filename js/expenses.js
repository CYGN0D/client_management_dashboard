/**
 * CLIENTO - EXPENSE MANAGEMENT MODULE
 * Handles expense logging, category & month filtering, instant search,
 * Add/Edit expense modal, and safe deletion.
 */

const Expenses = {
  activeSearchQuery: '',
  activeCategoryFilter: 'all',
  activeMonthFilter: '',

  CATEGORIES: [
    'Software',
    'Hosting',
    'Internet',
    'Marketing',
    'Office',
    'Travel',
    'Other'
  ],

  init() {
    this.activeMonthFilter = Utils.getCurrentMonthString();
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Add Expense button
    const addBtn = document.getElementById('addExpenseBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.openAddEditModal();
      });
    }

    // Form submit
    const form = document.getElementById('expenseForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    // Search input
    const searchInput = document.getElementById('expenseSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.activeSearchQuery = e.target.value.trim().toLowerCase();
        this.renderTable();
      });
    }

    // Category filter
    const catFilter = document.getElementById('expenseCategoryFilter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.activeCategoryFilter = e.target.value;
        this.renderTable();
      });
    }

    // Month filter
    const monthFilter = document.getElementById('expenseMonthFilter');
    if (monthFilter) {
      monthFilter.addEventListener('change', (e) => {
        this.activeMonthFilter = e.target.value;
        this.render();
      });
    }

    // Clear filters
    const clearBtn = document.getElementById('expenseClearFiltersBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.activeSearchQuery = '';
        this.activeCategoryFilter = 'all';
        this.activeMonthFilter = '';
        if (searchInput) searchInput.value = '';
        if (catFilter) catFilter.value = 'all';
        if (monthFilter) monthFilter.value = '';
        this.render();
      });
    }
  },

  render() {
    this.populateCategoryFilter();
    this.populateMonthFilter();
    this.renderSummary();
    this.renderTable();
  },

  populateCategoryFilter() {
    const catSelect = document.getElementById('expenseCategoryFilter');
    if (!catSelect) return;

    const currentVal = this.activeCategoryFilter;
    catSelect.innerHTML = `
      <option value="all">All Categories</option>
      ${this.CATEGORIES.map((cat) => `
        <option value="${cat}" ${cat === currentVal ? 'selected' : ''}>${cat}</option>
      `).join('')}
    `;
  },

  populateMonthFilter() {
    const monthSelect = document.getElementById('expenseMonthFilter');
    if (!monthSelect) return;

    const expenses = Storage.getExpenses();
    const months = Array.from(new Set(expenses.map((e) => e.date.substring(0, 7)))).sort().reverse();
    const currentMonth = Utils.getCurrentMonthString();
    if (!months.includes(currentMonth)) {
      months.unshift(currentMonth);
    }

    const currentVal = this.activeMonthFilter;
    monthSelect.innerHTML = `
      <option value="">All Months</option>
      ${months.map((m) => `
        <option value="${m}" ${m === currentVal ? 'selected' : ''}>${Utils.formatMonth(m)}</option>
      `).join('')}
    `;
  },

  renderSummary() {
    const expenses = Storage.getExpenses();
    const currentMonth = Utils.getCurrentMonthString();
    const today = Utils.getTodayString();

    let thisMonthPaise = 0;
    let todayPaise = 0;

    expenses.forEach((e) => {
      const p = Utils.toPaise(e.amount);
      if (e.date && e.date.startsWith(currentMonth)) {
        thisMonthPaise += p;
      }
      if (e.date === today) {
        todayPaise += p;
      }
    });

    const monthEl = document.getElementById('expensesTotalMonth');
    const todayEl = document.getElementById('expensesTotalToday');

    if (monthEl) monthEl.textContent = Utils.formatCurrency(Utils.fromPaise(thisMonthPaise));
    if (todayEl) todayEl.textContent = Utils.formatCurrency(Utils.fromPaise(todayPaise));
  },

  getFilteredExpenses() {
    let expenses = Storage.getExpenses();

    if (this.activeMonthFilter) {
      expenses = expenses.filter((e) => e.date && e.date.startsWith(this.activeMonthFilter));
    }

    if (this.activeCategoryFilter !== 'all') {
      expenses = expenses.filter((e) => e.category === this.activeCategoryFilter);
    }

    if (this.activeSearchQuery) {
      expenses = expenses.filter((e) => {
        const titleMatch = e.title.toLowerCase().includes(this.activeSearchQuery);
        const descMatch = e.description && e.description.toLowerCase().includes(this.activeSearchQuery);
        return titleMatch || descMatch;
      });
    }

    return expenses;
  },

  renderTable() {
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;

    const expenses = this.getFilteredExpenses();

    if (expenses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-state-icon">
                <i data-lucide="credit-card"></i>
              </div>
              <div class="empty-state-title">No expenses recorded</div>
              <div class="empty-state-text">
                ${this.activeSearchQuery || this.activeCategoryFilter !== 'all' || this.activeMonthFilter
                  ? 'No expenses match your active filter.'
                  : 'Track your operating costs by logging your first business expense.'}
              </div>
              ${!this.activeSearchQuery && this.activeCategoryFilter === 'all'
                ? '<button class="btn btn-primary btn-sm" onclick="Expenses.openAddEditModal()"><i data-lucide="plus"></i> Add Expense</button>'
                : ''}
            </div>
          </td>
        </tr>
      `;
      Utils.refreshIcons();
      return;
    }

    tbody.innerHTML = expenses.map((exp) => {
      const expPopupHtml = `
        <div class="table-data-popup-header">
          <span class="table-data-popup-title">${Utils.escapeHtml(exp.title)}</span>
          <span class="table-data-popup-badge">${Utils.escapeHtml(exp.category)}</span>
        </div>
        <div class="table-data-popup-row"><span>Amount</span><span>${Utils.formatCurrency(exp.amount)}</span></div>
        <div class="table-data-popup-row"><span>Date</span><span>${Utils.formatDate(exp.date)}</span></div>
        ${exp.description ? `<div class="table-data-popup-row"><span>Description</span><span>${Utils.escapeHtml(exp.description)}</span></div>` : ''}
      `.trim();

      return `
        <tr class="table-card-row">
          <td class="table-card-main">
            <div class="table-single-line" data-table-popup="${Utils.escapeHtml(expPopupHtml)}" style="font-weight: 600; color: var(--color-text-primary); font-size: 13.5px;" title="${Utils.escapeHtml(exp.title)}">${Utils.escapeHtml(exp.title)}</div>
          </td>
          <td data-label="Category" style="white-space:nowrap;">
            <span class="badge badge-neutral">${Utils.escapeHtml(exp.category)}</span>
          </td>
          <td data-label="Amount" class="tabular-nums" style="font-weight: 600; color: var(--color-text-primary); white-space:nowrap;">
            ${Utils.formatCurrency(exp.amount)}
          </td>
          <td data-label="Date" style="white-space:nowrap;">${Utils.formatDate(exp.date)}</td>
          <td data-label="Description">
            <div class="table-single-line table-secondary-text" style="max-width: 240px;" title="${Utils.escapeHtml(exp.description || '')}">
              ${exp.description ? Utils.escapeHtml(exp.description) : '—'}
            </div>
          </td>
          <td class="actions-col" data-label="Actions">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:var(--space-2);width:100%;">
              <button class="btn btn-secondary btn-icon btn-sm" onclick="Expenses.openAddEditModal('${exp.id}')" title="Edit Expense" aria-label="Edit Expense">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn btn-danger btn-icon btn-sm" onclick="Expenses.confirmDeleteExpense('${exp.id}')" title="Delete Expense" aria-label="Delete Expense">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    Utils.refreshIcons();
  },

  openAddEditModal(expenseId = null) {
    const form = document.getElementById('expenseForm');
    const modalTitle = document.getElementById('expenseModalTitle');
    Utils.clearFieldErrors(form);
    form.reset();

    const idInput = document.getElementById('expenseFormId');
    const titleInput = document.getElementById('expenseTitle');
    const catSelect = document.getElementById('expenseCategory');
    const amountInput = document.getElementById('expenseAmount');
    const dateInput = document.getElementById('expenseDate');
    const descInput = document.getElementById('expenseDescription');

    // Populate category dropdown
    catSelect.innerHTML = this.CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');

    if (expenseId) {
      const exp = Storage.getExpenseById(expenseId);
      if (!exp) return;
      modalTitle.textContent = 'Edit Expense';
      idInput.value = exp.id;
      titleInput.value = exp.title;
      catSelect.value = exp.category;
      amountInput.value = exp.amount;
      dateInput.value = exp.date;
      descInput.value = exp.description || '';
    } else {
      modalTitle.textContent = 'Add Expense';
      idInput.value = '';
      catSelect.value = 'Software';
      dateInput.value = Utils.getTodayString();
    }

    Utils.openModal('expenseModal');
  },

  async handleFormSubmit() {
    const form = document.getElementById('expenseForm');
    Utils.clearFieldErrors(form);

    const id = document.getElementById('expenseFormId').value;
    const titleInput = document.getElementById('expenseTitle');
    const catSelect = document.getElementById('expenseCategory');
    const amountInput = document.getElementById('expenseAmount');
    const dateInput = document.getElementById('expenseDate');
    const descInput = document.getElementById('expenseDescription');

    let isValid = true;
    const title = titleInput.value.trim();
    if (!title) {
      Utils.setFieldError(titleInput, 'Expense title is required');
      isValid = false;
    }

    const category = catSelect.value;
    if (!category) {
      Utils.setFieldError(catSelect, 'Category is required');
      isValid = false;
    }

    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
      Utils.setFieldError(amountInput, 'Amount must be greater than zero');
      isValid = false;
    }

    let date = dateInput.value;
    if (!date) {
      date = Utils.getTodayString();
      dateInput.value = date;
    }

    if (!isValid) return;

    const payload = {
      title,
      category,
      amount,
      date,
      description: descInput.value.trim()
    };

    try {
      if (id) {
        await Storage.updateExpense(id, payload);
        Utils.showToast('Expense updated successfully', 'success');
      } else {
        await Storage.addExpense(payload);
        Utils.showToast('Expense added successfully', 'success');
      }
    } catch (err) {
      console.error(err);
      return;
    }

    Utils.closeModal('expenseModal');
    this.render();
    if (window.Dashboard) window.Dashboard.render();
    if (window.Reports) window.Reports.render();
  },

  async confirmDeleteExpense(expenseId) {
    const exp = Storage.getExpenseById(expenseId);
    if (!exp) return;

    const confirmed = await Utils.confirm({
      title: 'Delete Expense',
      message: `Are you sure you want to delete the expense "${exp.title}" (${Utils.formatCurrency(exp.amount)})?`,
      confirmText: 'Delete Expense',
      confirmDanger: true
    });

    if (confirmed) {
      await Storage.deleteExpense(expenseId);
      Utils.showToast('Expense deleted', 'info');
      this.render();
      if (window.Dashboard) window.Dashboard.render();
      if (window.Reports) window.Reports.render();
    }
  }
};

window.Expenses = Expenses;
