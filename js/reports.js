/**
 * CLIENTO - FINANCIAL REPORTS MODULE
 * Computes exact financial metrics, renders SVG Income vs Expenses comparison chart,
 * displays Monthly Financial Breakdown table, and Pending Payments Audit table.
 */

const Reports = {
  activePeriod: 'last6', // 'last6' | 'current' | specific 'YYYY-MM'

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

  render() {
    this.populatePeriodFilter();
    this.renderMetrics();
    this.renderIncomeExpenseChart();
    this.renderMonthlySummaryTable();
    this.renderPendingPaymentsTable();
  },

  populatePeriodFilter() {
    const filter = document.getElementById('reportPeriodFilter');
    if (!filter) return;

    const invoices = Storage.getInvoices();
    const payments = Storage.getPayments();
    const expenses = Storage.getExpenses();

    // Collect all unique months
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

  /**
   * Filter payments, expenses, and invoices by current active period
   */
  getPeriodData() {
    let payments = Storage.getPayments();
    let expenses = Storage.getExpenses();
    let invoices = Storage.getInvoices();

    if (this.activePeriod === 'last6') {
      const last6 = Utils.getLastNMonths(6);
      payments = payments.filter((p) => p.paymentDate && last6.includes(p.paymentDate.substring(0, 7)));
      expenses = expenses.filter((e) => e.date && last6.includes(e.date.substring(0, 7)));
      invoices = invoices.filter((i) => i.billingMonth && last6.includes(i.billingMonth));
    } else if (this.activePeriod === 'current') {
      const cur = Utils.getCurrentMonthString();
      payments = payments.filter((p) => p.paymentDate && p.paymentDate.startsWith(cur));
      expenses = expenses.filter((e) => e.date && e.date.startsWith(cur));
      invoices = invoices.filter((i) => i.billingMonth === cur);
    } else if (this.activePeriod !== 'all') {
      const specificMonth = this.activePeriod;
      payments = payments.filter((p) => p.paymentDate && p.paymentDate.startsWith(specificMonth));
      expenses = expenses.filter((e) => e.date && e.date.startsWith(specificMonth));
      invoices = invoices.filter((i) => i.billingMonth === specificMonth);
    }

    return { payments, expenses, invoices };
  },

  renderMetrics() {
    const { payments, expenses, invoices } = this.getPeriodData();

    // Income Received: Sum of actual payment receipts
    let incomePaise = 0;
    payments.forEach((p) => {
      incomePaise += Utils.toPaise(p.amount);
    });

    // Expenses: Sum of actual expense entries
    let expensePaise = 0;
    expenses.forEach((e) => {
      expensePaise += Utils.toPaise(e.amount);
    });

    // Net Profit: Income Received minus Expenses
    const netProfitPaise = incomePaise - expensePaise;

    // Pending: Remaining balances on invoices for this period
    let pendingPaise = 0;
    invoices.forEach((inv) => {
      const invPaise = Utils.toPaise(inv.amount);
      const paidPaise = Utils.toPaise(inv.paidAmount || 0);
      const rem = invPaise - paidPaise;
      if (rem > 0) pendingPaise += rem;
    });

    // DOM update
    const incomeEl = document.getElementById('reportMetricIncome');
    const expenseEl = document.getElementById('reportMetricExpenses');
    const profitEl = document.getElementById('reportMetricProfit');
    const receivedEl = document.getElementById('reportMetricReceived');
    const pendingEl = document.getElementById('reportMetricPending');

    if (incomeEl) incomeEl.textContent = Utils.formatCurrency(Utils.fromPaise(incomePaise));
    if (expenseEl) expenseEl.textContent = Utils.formatCurrency(Utils.fromPaise(expensePaise));
    
    if (profitEl) {
      profitEl.textContent = Utils.formatCurrency(Utils.fromPaise(netProfitPaise));
      profitEl.style.color = netProfitPaise >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
    }

    if (receivedEl) receivedEl.textContent = `${payments.length} received`;
    if (pendingEl) pendingEl.textContent = Utils.formatCurrency(Utils.fromPaise(pendingPaise));
  },

  renderIncomeExpenseChart() {
    const container = document.getElementById('reportsComparisonChart');
    if (!container) return;

    // Display last 6 months for chart visualization
    const months = Utils.getLastNMonths(6);
    const payments = Storage.getPayments();
    const expenses = Storage.getExpenses();

    const monthlyStats = months.map((m) => {
      let incomePaise = 0;
      payments.forEach((p) => {
        if (p.paymentDate && p.paymentDate.startsWith(m)) {
          incomePaise += Utils.toPaise(p.amount);
        }
      });

      let expensePaise = 0;
      expenses.forEach((e) => {
        if (e.date && e.date.startsWith(m)) {
          expensePaise += Utils.toPaise(e.amount);
        }
      });

      return {
        month: m,
        label: Utils.formatShortMonth(m),
        income: Utils.fromPaise(incomePaise),
        expense: Utils.fromPaise(expensePaise)
      };
    });

    const hasData = monthlyStats.some((d) => d.income > 0 || d.expense > 0);
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
      ...monthlyStats.map((d) => Math.max(d.income, d.expense)),
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

    const slotWidth = chartW / months.length;
    const barWidth = Math.min(slotWidth * 0.28, 22);
    const gap = 4;

    let barsHtml = '';
    monthlyStats.forEach((d, idx) => {
      const incomeH = ceilVal > 0 ? (d.income / ceilVal) * chartH : 0;
      const expenseH = ceilVal > 0 ? (d.expense / ceilVal) * chartH : 0;

      const slotCenter = padLeft + (idx * slotWidth) + (slotWidth / 2);
      const xIncome = slotCenter - barWidth - (gap / 2);
      const xExpense = slotCenter + (gap / 2);

      const yIncome = padTop + chartH - incomeH;
      const yExpense = padTop + chartH - expenseH;

      barsHtml += `
        <g class="chart-bar-group"
           onmouseenter="Reports.showTooltip(event, '${Utils.escapeHtml(Utils.formatMonth(d.month))}', '${Utils.formatCurrency(d.income)}', '${Utils.formatCurrency(d.expense)}')"
           onmouseleave="Reports.hideTooltip()">
          <!-- Income Bar (Primary Dark) -->
          <rect x="${xIncome}" y="${yIncome}" width="${barWidth}" height="${Math.max(incomeH, 2)}" rx="2" ry="2" fill="var(--color-primary)" />
          <!-- Expense Bar (Muted / Slate) -->
          <rect x="${xExpense}" y="${yExpense}" width="${barWidth}" height="${Math.max(expenseH, 2)}" rx="2" ry="2" fill="#9CA3AF" />
          <!-- Hit box -->
          <rect x="${padLeft + (idx * slotWidth)}" y="${padTop}" width="${slotWidth}" height="${chartH}" fill="transparent" style="cursor:pointer;" />
          <text x="${slotCenter}" y="${height - 12}" text-anchor="middle" class="chart-axis-text">${d.label}</text>
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

  renderMonthlySummaryTable() {
    const tbody = document.getElementById('reportMonthlySummaryBody');
    if (!tbody) return;

    const invoices = Storage.getInvoices();
    const payments = Storage.getPayments();
    const expenses = Storage.getExpenses();

    // Unique months
    const allMonths = new Set();
    invoices.forEach((i) => i.billingMonth && allMonths.add(i.billingMonth));
    payments.forEach((p) => p.paymentDate && allMonths.add(p.paymentDate.substring(0, 7)));
    expenses.forEach((e) => e.date && allMonths.add(e.date.substring(0, 7)));

    const months = Array.from(allMonths).sort().reverse();

    if (months.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No monthly data available yet.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = months.map((m) => {
      let incomePaise = 0;
      payments.forEach((p) => {
        if (p.paymentDate && p.paymentDate.startsWith(m)) {
          incomePaise += Utils.toPaise(p.amount);
        }
      });

      let expensePaise = 0;
      expenses.forEach((e) => {
        if (e.date && e.date.startsWith(m)) {
          expensePaise += Utils.toPaise(e.amount);
        }
      });

      const netPaise = incomePaise - expensePaise;

      let pendingPaise = 0;
      invoices.forEach((inv) => {
        if (inv.billingMonth === m) {
          const invPaise = Utils.toPaise(inv.amount);
          const paidPaise = Utils.toPaise(inv.paidAmount || 0);
          const rem = invPaise - paidPaise;
          if (rem > 0) pendingPaise += rem;
        }
      });

      return `
        <tr>
          <td style="font-weight:600;">${Utils.formatMonth(m)}</td>
          <td class="tabular-nums" style="font-weight:600;color:var(--color-success);">${Utils.formatCurrency(Utils.fromPaise(incomePaise))}</td>
          <td class="tabular-nums" style="font-weight:500;">${Utils.formatCurrency(Utils.fromPaise(expensePaise))}</td>
          <td class="tabular-nums" style="font-weight:600;color:${netPaise >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
            ${Utils.formatCurrency(Utils.fromPaise(netPaise))}
          </td>
          <td class="tabular-nums" style="font-weight:500;color:${pendingPaise > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)'};">
            ${Utils.formatCurrency(Utils.fromPaise(pendingPaise))}
          </td>
        </tr>
      `;
    }).join('');
  },

  renderPendingPaymentsTable() {
    const tbody = document.getElementById('reportPendingPaymentsBody');
    if (!tbody) return;

    const invoices = Storage.getInvoices().filter((inv) => {
      const invPaise = Utils.toPaise(inv.amount);
      const paidPaise = Utils.toPaise(inv.paidAmount || 0);
      return invPaise > paidPaise;
    });

    if (invoices.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No pending or overdue payments. All client accounts are fully settled!</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = invoices.map((inv) => {
      const invPaise = Utils.toPaise(inv.amount);
      const paidPaise = Utils.toPaise(inv.paidAmount || 0);
      const remPaise = invPaise - paidPaise;

      let badgeHtml = '';
      if (inv.status === 'overdue' || inv.isOverdue) {
        badgeHtml = `<span class="badge badge-danger"><span class="badge-dot"></span>Overdue</span>`;
      } else if (inv.status === 'partial') {
        badgeHtml = `<span class="badge badge-warning"><span class="badge-dot"></span>Partial</span>`;
      } else {
        badgeHtml = `<span class="badge badge-neutral"><span class="badge-dot"></span>Pending</span>`;
      }

      return `
        <tr>
          <td>
            <div style="font-weight:600;">${Utils.escapeHtml(inv.clientName)}</div>
            <div class="table-subtext">${inv.invoiceType === 'changes' ? 'Changes: ' : ''}${Utils.escapeHtml(inv.serviceName || inv.invoiceNumber)}</div>
          </td>
          <td>${Utils.formatMonth(inv.billingMonth)}</td>
          <td class="tabular-nums">${Utils.formatCurrency(inv.amount)}</td>
          <td class="tabular-nums" style="color:var(--color-success);">${Utils.formatCurrency(Utils.fromPaise(paidPaise))}</td>
          <td class="tabular-nums" style="font-weight:600;color:var(--color-danger);">${Utils.formatCurrency(Utils.fromPaise(remPaise))}</td>
          <td class="tabular-nums" style="${inv.isOverdue ? 'color:var(--color-danger);font-weight:500;' : ''}">${Utils.formatDate(inv.dueDate)}</td>
          <td>${badgeHtml}</td>
          <td style="text-align:right;">
            <button class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${inv.id}')" title="Record Payment">
              <i data-lucide="plus-circle"></i> Pay
            </button>
          </td>
        </tr>
      `;
    }).join('');
    Utils.refreshIcons();
  }
};

window.Reports = Reports;
