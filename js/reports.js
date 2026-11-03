/**
 * CLIENTO - FINANCIAL REPORTS MODULE
 * Computes exact financial metrics, renders SVG Income vs Expenses comparison chart,
 * displays Monthly Financial Breakdown table, and Pending Payments Audit table
 * computed directly from the PHP Backend Report Engine.
 */

const Reports = {
  activePeriod: 'last6', // 'last6' | 'current' | 'all' | 'YYYY-MM'

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const periodFilter = document.getElementById('reportPeriodFilter');
    if (periodFilter) {
      periodFilter.addEventListener('change', (e) => {
        this.activePeriod = e.target.value;
        this.render();
      });
    }
  },

  async render() {
    this.populatePeriodFilter();

    let reportData = null;
    if (window.API && typeof API.reports !== 'undefined') {
      try {
        reportData = await API.reports.getFinancialReport(this.activePeriod);
      } catch (err) {
        console.warn('[Reports] Could not fetch backend financial report:', err.message);
      }
    }

    if (reportData) {
      this.renderMetrics(reportData.summary);
      this.renderIncomeExpenseChart(reportData.monthly_breakdown);
      this.renderMonthlySummaryTable(reportData.monthly_breakdown);
      this.renderPendingPaymentsTable(reportData.pending_invoices);
    } else {
      // Fallback using in-memory store
      this.renderMetricsFromStore();
      this.renderIncomeExpenseChartFromStore();
      this.renderMonthlySummaryTableFromStore();
      this.renderPendingPaymentsTableFromStore();
    }

    Utils.refreshIcons();
  },

  populatePeriodFilter() {
    const filter = document.getElementById('reportPeriodFilter');
    if (!filter) return;

    const invoices = Storage.getInvoices();
    const payments = Storage.getPayments();
    const expenses = Storage.getExpenses();

    const allMonths = new Set();
    invoices.forEach((i) => i.billingMonth && allMonths.add(i.billingMonth));
    payments.forEach((p) => p.paymentDate && allMonths.add(p.paymentDate.substring(0, 7)));
    expenses.forEach((e) => e.date && allMonths.add(e.date.substring(0, 7)));

    const sortedMonths = Array.from(allMonths).sort().reverse();
    const currentVal = this.activePeriod;

    filter.innerHTML = `
      <option value="last6" ${currentVal === 'last6' ? 'selected' : ''}>Last 6 Months</option>
      <option value="current" ${currentVal === 'current' ? 'selected' : ''}>Current Month (${Utils.formatMonth(Utils.getCurrentMonthString())})</option>
      <option value="all" ${currentVal === 'all' ? 'selected' : ''}>All Recorded Time</option>
      ${sortedMonths.map((m) => `
        <option value="${m}" ${currentVal === m ? 'selected' : ''}>${Utils.formatMonth(m)}</option>
      `).join('')}
    `;
  },

  renderMetrics(summary) {
    if (!summary) return;

    const incomeEl = document.getElementById('reportMetricIncome');
    const expenseEl = document.getElementById('reportMetricExpenses');
    const profitEl = document.getElementById('reportMetricProfit');
    const receivedEl = document.getElementById('reportMetricReceived');
    const pendingEl = document.getElementById('reportMetricPending');

    const totalReceived = summary.total_received || 0;
    const totalExpenses = summary.total_expenses || 0;
    const netIncome = summary.net_income !== undefined ? summary.net_income : (totalReceived - totalExpenses);
    const totalPending = summary.total_pending || 0;
    const receivedCount = summary.received_count || 0;

    if (incomeEl) incomeEl.textContent = Utils.formatCurrency(totalReceived);
    if (expenseEl) expenseEl.textContent = Utils.formatCurrency(totalExpenses);

    if (profitEl) {
      profitEl.textContent = Utils.formatCurrency(netIncome);
      profitEl.style.color = netIncome >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
    }

    if (receivedEl) receivedEl.textContent = `${receivedCount} received`;
    if (pendingEl) pendingEl.textContent = Utils.formatCurrency(totalPending);
  },

  renderIncomeExpenseChart(breakdown) {
    const container = document.getElementById('reportsComparisonChart');
    if (!container) return;

    // Use breakdown or last 6 months
    let chartList = Array.isArray(breakdown) && breakdown.length > 0 ? breakdown.slice(0, 6).reverse() : [];

    if (chartList.length === 0) {
      const months = Utils.getLastNMonths(6);
      chartList = months.map((m) => ({
        month: m,
        label: Utils.formatShortMonth(m),
        received: 0,
        expenses: 0
      }));
    }

    const hasData = chartList.some((d) => (d.received || d.income || 0) > 0 || (d.expenses || d.expense || 0) > 0);
    if (!hasData) {
      container.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6) 0;">
          <div class="empty-state-icon"><i data-lucide="bar-chart-3"></i></div>
          <div class="empty-state-title">No financial data recorded</div>
          <div class="empty-state-text">Your monthly income vs expenses comparison will appear here once transactions are recorded.</div>
        </div>
      `;
      Utils.refreshIcons();
      return;
    }

    const maxVal = Math.max(
      ...chartList.map((d) => Math.max(d.received || d.income || 0, d.expenses || d.expense || 0)),
      10000
    );

    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const ceilVal = Math.ceil(maxVal / magnitude) * magnitude;

    const width = 640;
    const height = 230;
    const padLeft = 65;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 35;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Y Axis ticks
    const tickCount = 4;
    let gridLinesHtml = '';
    for (let i = 0; i <= tickCount; i++) {
      const val = (ceilVal / tickCount) * i;
      const y = padTop + chartH - (i / tickCount) * chartH;
      gridLinesHtml += `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#E8EAED" stroke-width="1" stroke-dasharray="4 4" />
        <text x="${padLeft - 8}" y="${y + 3}" text-anchor="end" class="chart-axis-text">₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(0)}</text>
      `;
    }

    const slotWidth = chartW / chartList.length;
    const barWidth = Math.min(slotWidth * 0.28, 22);
    const gap = 4;

    let barsHtml = '';
    chartList.forEach((d, idx) => {
      const income = d.received !== undefined ? d.received : (d.income || 0);
      const expense = d.expenses !== undefined ? d.expenses : (d.expense || 0);

      const incomeH = ceilVal > 0 ? (income / ceilVal) * chartH : 0;
      const expenseH = ceilVal > 0 ? (expense / ceilVal) * chartH : 0;

      const slotCenter = padLeft + (idx * slotWidth) + (slotWidth / 2);
      const xIncome = slotCenter - barWidth - (gap / 2);
      const xExpense = slotCenter + (gap / 2);

      const yIncome = padTop + chartH - incomeH;
      const yExpense = padTop + chartH - expenseH;
      const monthLabel = d.label || Utils.formatShortMonth(d.month);

      barsHtml += `
        <g class="chart-bar-group"
           onmouseenter="Reports.showTooltip(event, '${Utils.escapeHtml(Utils.formatMonth(d.month))}', '${Utils.formatCurrency(income)}', '${Utils.formatCurrency(expense)}')"
           onmouseleave="Reports.hideTooltip()">
          <!-- Income Bar (Primary) -->
          <rect x="${xIncome}" y="${yIncome}" width="${barWidth}" height="${Math.max(incomeH, 2)}" rx="2" ry="2" fill="var(--color-primary)" />
          <!-- Expense Bar (Muted) -->
          <rect x="${xExpense}" y="${yExpense}" width="${barWidth}" height="${Math.max(expenseH, 2)}" rx="2" ry="2" fill="#9CA3AF" />
          <!-- Hit box -->
          <rect x="${padLeft + (idx * slotWidth)}" y="${padTop}" width="${slotWidth}" height="${chartH}" fill="transparent" style="cursor:pointer;" />
          <text x="${slotCenter}" y="${height - 12}" text-anchor="middle" class="chart-axis-text">${monthLabel}</text>
        </g>
      `;
    });

    container.innerHTML = `
      <div style="position:relative;">
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
          ${gridLinesHtml}
          ${barsHtml}
        </svg>
        <div id="reportsChartTooltip" class="chart-tooltip"></div>
      </div>
      <div class="chart-legend" style="justify-content:center;">
        <div class="chart-legend-item">
          <span class="chart-legend-color" style="background-color:var(--color-primary);"></span>
          <span>Income Received</span>
        </div>
        <div class="chart-legend-item">
          <span class="chart-legend-color" style="background-color:#9CA3AF;"></span>
          <span>Expenses</span>
        </div>
      </div>
    `;
  },

  showTooltip(event, monthName, incomeStr, expenseStr) {
    const tooltip = document.getElementById('reportsChartTooltip');
    if (!tooltip) return;

    const container = tooltip.parentElement;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    tooltip.innerHTML = `
      <div style="font-size:11px;opacity:0.85;margin-bottom:3px;">${monthName}</div>
      <div style="font-size:12px;">Income: <strong>${incomeStr}</strong></div>
      <div style="font-size:12px;opacity:0.9;">Expenses: <strong>${expenseStr}</strong></div>
    `;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.opacity = '1';
  },

  hideTooltip() {
    const tooltip = document.getElementById('reportsChartTooltip');
    if (tooltip) tooltip.style.opacity = '0';
  },

  renderMonthlySummaryTable(breakdown) {
    const tbody = document.getElementById('reportMonthlySummaryBody');
    if (!tbody) return;

    if (!Array.isArray(breakdown) || breakdown.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No monthly data available for this period.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = breakdown.map((m) => {
      const income = m.received !== undefined ? m.received : 0;
      const expenses = m.expenses !== undefined ? m.expenses : 0;
      const net = m.net !== undefined ? m.net : (income - expenses);
      const pending = Math.max(0, (m.billed || 0) - income);

      return `
        <tr>
          <td style="font-weight:600;">
            <span class="data-link" onclick="Payments.activeMonthFilter = '${m.month}'; App.navigateTo('payments');" title="Filter payments for ${Utils.formatMonth(m.month)}" style="cursor:pointer;">
              ${Utils.formatMonth(m.month)} <i data-lucide="arrow-right" style="width:12px;height:12px;margin-left:2px;opacity:0.6;"></i>
            </span>
          </td>
          <td class="tabular-nums" style="font-weight:600;color:var(--color-success);">${Utils.formatCurrency(income)}</td>
          <td class="tabular-nums" style="font-weight:500;">${Utils.formatCurrency(expenses)}</td>
          <td class="tabular-nums" style="font-weight:600;color:${net >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
            ${Utils.formatCurrency(net)}
          </td>
          <td class="tabular-nums" style="font-weight:500;color:${pending > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)'};">
            ${Utils.formatCurrency(pending)}
          </td>
        </tr>
      `;
    }).join('');
    Utils.refreshIcons();
  },

  renderPendingPaymentsTable(pendingInvoices) {
    const tbody = document.getElementById('reportPendingPaymentsBody');
    if (!tbody) return;

    if (!Array.isArray(pendingInvoices) || pendingInvoices.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No pending or overdue payments. All client accounts are fully settled!</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pendingInvoices.map((inv) => {
      const rem = inv.remaining_due !== undefined ? inv.remaining_due : (inv.amount - (inv.paid_amount || 0));
      const paid = inv.paid_amount || 0;
      const clientName = inv.client_name || inv.clientName || 'Client';
      const invNum = inv.invoice_number || inv.invoiceNumber || '';
      const serviceName = inv.service_name || inv.serviceName || 'Service';
      const billingMonth = inv.billing_month || inv.billingMonth || '';
      const dueDate = inv.due_date || inv.dueDate || '';
      const isOverdue = inv.is_overdue || inv.isOverdue;

      let badgeHtml = '';
      if (isOverdue) {
        badgeHtml = `<span class="badge badge-danger"><span class="badge-dot"></span>Overdue</span>`;
      } else if (paid > 0) {
        badgeHtml = `<span class="badge badge-warning"><span class="badge-dot"></span>Partial</span>`;
      } else {
        badgeHtml = `<span class="badge badge-neutral"><span class="badge-dot"></span>Pending</span>`;
      }

      const repPopupHtml = `
        <div class="table-data-popup-header">
          <span class="table-data-popup-title">${Utils.escapeHtml(invNum)}</span>
          <span class="table-data-popup-badge">${isOverdue ? 'OVERDUE' : (paid > 0 ? 'PARTIAL' : 'PENDING')}</span>
        </div>
        <div class="table-data-popup-row"><span>Client</span><span>${Utils.escapeHtml(clientName)}</span></div>
        <div class="table-data-popup-row"><span>Service</span><span>${Utils.escapeHtml(serviceName)}</span></div>
        <div class="table-data-popup-row"><span>Billing Month</span><span>${Utils.formatMonth(billingMonth)}</span></div>
        <div class="table-data-popup-row"><span>Due Date</span><span>${Utils.formatDate(dueDate)}</span></div>
        <div class="table-data-popup-row"><span>Invoice Amount</span><span>${Utils.formatCurrency(inv.amount)}</span></div>
        <div class="table-data-popup-row"><span>Paid Amount</span><span>${Utils.formatCurrency(paid)}</span></div>
        <div class="table-data-popup-row"><span>Remaining Due</span><span>${Utils.formatCurrency(rem)}</span></div>
      `.trim();

      return `
        <tr class="table-card-row">
          <td class="table-card-main">
            <div class="table-single-line" data-table-popup="${Utils.escapeHtml(repPopupHtml)}" title="${Utils.escapeHtml(clientName)} • ${Utils.escapeHtml(invNum)} (${Utils.escapeHtml(serviceName)})">
              <span class="data-link" style="font-weight: 600; color: var(--color-text-primary); font-size: 13.5px; cursor: pointer;" onclick="Clients.viewClientDetails('${inv.client_id || inv.clientId}')" title="View client dossier">${Utils.escapeHtml(clientName)}</span>
              <span class="table-bullet">•</span>
              <span class="ledger-badge-code data-code-link" onclick="Payments.viewInvoiceHistory('${inv.id}')" title="View invoice history">${Utils.escapeHtml(invNum)}</span>
              <span class="table-secondary-text" style="max-width:130px;">(${Utils.escapeHtml(serviceName)})</span>
            </div>
          </td>
          <td data-label="Billing Month" style="white-space:nowrap;">${Utils.formatMonth(billingMonth)}</td>
          <td data-label="Invoice Amount" class="tabular-nums" style="white-space:nowrap;">${Utils.formatCurrency(inv.amount)}</td>
          <td data-label="Paid Amount" class="tabular-nums" style="color:var(--color-success);white-space:nowrap;">${Utils.formatCurrency(paid)}</td>
          <td data-label="Remaining" class="tabular-nums" style="font-weight:600;color:var(--color-danger);white-space:nowrap;">${Utils.formatCurrency(rem)}</td>
          <td data-label="Due Date" class="tabular-nums" style="${isOverdue ? 'color:var(--color-danger);font-weight:500;' : ''} white-space:nowrap;">${Utils.formatDate(dueDate)}</td>
          <td data-label="Status">${badgeHtml}</td>
          <td class="actions-col" data-label="Action">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;width:100%;">
              <button class="btn btn-secondary btn-icon btn-sm" onclick="Payments.viewInvoiceHistory('${inv.id}')" title="View Invoice History" style="width:28px;height:28px;">
                <i data-lucide="history" style="width:14px;height:14px;"></i>
              </button>
              <button class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${inv.id}')" title="Record Payment" style="padding:2px 10px;height:28px;font-size:12px;display:inline-flex;align-items:center;gap:4px;">
                <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> Pay
              </button>
              <div class="dropdown">
                <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="Clients.toggleActionMenu(event, 'reportPayActionMenu_${inv.id}')" title="More options" aria-label="More options" style="width:28px;height:28px;">
                  <i data-lucide="more-vertical" style="width:14px;height:14px;"></i>
                </button>
                <div id="reportPayActionMenu_${inv.id}" class="dropdown-menu">
                  <button type="button" class="dropdown-item" onclick="Payments.viewInvoiceHistory('${inv.id}')">
                    <i data-lucide="history"></i> View History
                  </button>
                  <div class="dropdown-divider"></div>
                  <button type="button" class="dropdown-item text-danger" onclick="Payments.confirmDeleteInvoice('${inv.id}')">
                    <i data-lucide="trash-2"></i> Delete Invoice
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    Utils.refreshIcons();
  },

  /* ---------------- Offline Store Fallbacks ---------------- */
  renderMetricsFromStore() {
    const invoices = Storage.getInvoices();
    const payments = Storage.getPayments();
    const expenses = Storage.getExpenses();

    let totalReceived = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    let totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    let totalPending = invoices.reduce((acc, inv) => acc + Math.max(0, (inv.amount || 0) - (inv.paidAmount || 0)), 0);

    this.renderMetrics({
      total_received: totalReceived,
      total_expenses: totalExpenses,
      net_income: totalReceived - totalExpenses,
      total_pending: totalPending,
      received_count: payments.length
    });
  },

  renderIncomeExpenseChartFromStore() {
    const months = Utils.getLastNMonths(6);
    const payments = Storage.getPayments();
    const expenses = Storage.getExpenses();

    const stats = months.map((m) => {
      let income = 0;
      payments.forEach((p) => {
        if (p.paymentDate && p.paymentDate.startsWith(m)) income += (p.amount || 0);
      });
      let exp = 0;
      expenses.forEach((e) => {
        if (e.date && e.date.startsWith(m)) exp += (e.amount || 0);
      });
      return {
        month: m,
        label: Utils.formatShortMonth(m),
        received: income,
        expenses: exp
      };
    });

    this.renderIncomeExpenseChart(stats);
  },

  renderMonthlySummaryTableFromStore() {
    this.renderMonthlySummaryTable([]);
  },

  renderPendingPaymentsTableFromStore() {
    const invoices = Storage.getInvoices().filter((inv) => (inv.amount || 0) > (inv.paidAmount || 0));
    this.renderPendingPaymentsTable(invoices);
  }
};

window.Reports = Reports;
