/**
 * CLIENTO - DASHBOARD MODULE
 * Displays summary metrics, responsive SVG 6-month income chart,
 * Recent Payments, Recent Expenses, and Upcoming/Overdue Dues
 * computed directly from the PHP Backend Report Engine.
 */

const Dashboard = {
  init() {
    this.render();
  },

  async render() {
    this.renderHeader();

    let metricsData = null;
    if (window.API && typeof API.reports !== 'undefined') {
      try {
        metricsData = await API.reports.getDashboardMetrics();
      } catch (err) {
        console.warn('[Dashboard] Could not fetch backend report metrics:', err.message);
      }
    }

    if (metricsData) {
      this.renderMetrics(metricsData.metrics);
      this.renderIncomeChart(metricsData.income_chart);
      this.renderRecentPayments(metricsData.recent_payments);
      this.renderRecentExpenses(metricsData.recent_expenses);
      this.renderUpcomingPayments(metricsData.upcoming_dues);
    } else {
      // Fallback using in-memory store if offline
      this.renderMetricsFromStore();
      this.renderIncomeChartFromStore();
      this.renderRecentPaymentsFromStore();
      this.renderRecentExpensesFromStore();
      this.renderUpcomingPaymentsFromStore();
    }

    Utils.refreshIcons();
  },

  renderHeader() {
    const greetingEl = document.getElementById('dashboardGreeting');
    const dateEl = document.getElementById('dashboardCurrentDate');

    if (greetingEl) {
      greetingEl.textContent = `${Utils.getGreeting()}`;
    }

    if (dateEl) {
      const now = new Date();
      const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('en-GB', options);
    }
  },

  renderMetrics(metrics) {
    if (!metrics) return;

    const clientValEl = document.getElementById('metricTotalClients');
    if (clientValEl) clientValEl.textContent = metrics.total_clients || 0;

    const incomeValEl = document.getElementById('metricMonthlyIncome');
    if (incomeValEl) incomeValEl.textContent = Utils.formatCurrency(metrics.monthly_income || 0);

    const recValEl = document.getElementById('metricReceivedPayments');
    if (recValEl) recValEl.textContent = Utils.formatCurrency(metrics.received_payments || 0);

    const penValEl = document.getElementById('metricPendingPayments');
    if (penValEl) penValEl.textContent = Utils.formatCurrency(metrics.pending_payments || 0);
  },

  renderIncomeChart(monthlyData) {
    const container = document.getElementById('dashboardIncomeChart');
    if (!container) return;

    if (!Array.isArray(monthlyData) || monthlyData.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6) 0;">
          <div class="empty-state-icon"><i data-lucide="bar-chart-2"></i></div>
          <div class="empty-state-title">No income data available</div>
          <div class="empty-state-text">Record payments to view monthly income trends over the last 6 months.</div>
        </div>
      `;
      Utils.refreshIcons();
      return;
    }

    const hasData = monthlyData.some((d) => (d.amount || 0) > 0);
    if (!hasData) {
      container.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6) 0;">
          <div class="empty-state-icon"><i data-lucide="bar-chart-2"></i></div>
          <div class="empty-state-title">No income data available</div>
          <div class="empty-state-text">Record payments to view monthly income trends over the last 6 months.</div>
        </div>
      `;
      Utils.refreshIcons();
      return;
    }

    const width = 640;
    const height = 220;
    const padLeft = 65;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 35;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const maxVal = Math.max(...monthlyData.map((d) => d.amount || 0), 10000);
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const ceilVal = Math.ceil(maxVal / magnitude) * magnitude;

    // Y Axis grid ticks (4 intervals)
    const tickCount = 4;
    let gridLinesHtml = '';
    for (let i = 0; i <= tickCount; i++) {
      const val = (ceilVal / tickCount) * i;
      const y = padTop + chartH - (i / tickCount) * chartH;
      gridLinesHtml += `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="chart-grid-line" stroke="#E8EAED" stroke-width="1" />
        <text x="${padLeft - 8}" y="${y + 3}" text-anchor="end" class="chart-axis-text">₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(0)}</text>
      `;
    }

    const slotWidth = chartW / monthlyData.length;
    const barWidth = Math.min(slotWidth * 0.45, 42);

    let barsHtml = '';
    monthlyData.forEach((d, idx) => {
      const amt = d.amount || 0;
      const barH = ceilVal > 0 ? (amt / ceilVal) * chartH : 0;
      const x = padLeft + (idx * slotWidth) + (slotWidth / 2) - (barWidth / 2);
      const y = padTop + chartH - barH;
      const isCurrent = d.month === Utils.getCurrentMonthString();
      const txCount = d.tx_count || d.txCount || 0;

      barsHtml += `
        <g class="chart-bar-group" 
           onmouseenter="Dashboard.showTooltip(event, '${Utils.escapeHtml(Utils.formatMonth(d.month))}', '${Utils.formatCurrency(amt)}', ${txCount})"
           onmouseleave="Dashboard.hideTooltip()">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barH, 2)}" rx="3" ry="3"
                class="chart-bar" fill="${isCurrent ? 'var(--color-primary)' : '#4B5563'}" />
          <!-- Hit box -->
          <rect x="${padLeft + (idx * slotWidth)}" y="${padTop}" width="${slotWidth}" height="${chartH}" fill="transparent" style="cursor:pointer;" />
          <text x="${x + barWidth / 2}" y="${height - 12}" text-anchor="middle" class="chart-axis-text" font-weight="${isCurrent ? '600' : '400'}">${d.label}</text>
        </g>
      `;
    });

    container.innerHTML = `
      <div style="position:relative;">
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
          ${gridLinesHtml}
          ${barsHtml}
        </svg>
        <div id="dashboardChartTooltip" class="chart-tooltip"></div>
      </div>
    `;
  },

  showTooltip(event, monthName, amountStr, txCount) {
    const tooltip = document.getElementById('dashboardChartTooltip');
    if (!tooltip) return;

    const container = tooltip.parentElement;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    tooltip.innerHTML = `
      <div style="font-size:11px;opacity:0.85;margin-bottom:2px;">${monthName}</div>
      <div style="font-weight:600;font-size:13px;">${amountStr}</div>
      <div style="font-size:10px;opacity:0.75;margin-top:2px;">${txCount} payment${txCount === 1 ? '' : 's'}</div>
    `;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.opacity = '1';
  },

  hideTooltip() {
    const tooltip = document.getElementById('dashboardChartTooltip');
    if (tooltip) {
      tooltip.style.opacity = '0';
    }
  },

  renderRecentPayments(payments) {
    const tbody = document.getElementById('dashboardRecentPaymentsBody');
    if (!tbody) return;

    if (!Array.isArray(payments) || payments.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No recent payment transactions.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = payments.map((p) => {
      const clientName = p.client_name || p.clientName || 'Client';
      const invNum = p.invoice_number || p.invoiceNumber || '';
      const invId = p.invoice_id || p.invoiceId || '';
      const method = p.payment_method || p.paymentMethod || 'Bank Transfer';
      const date = p.payment_date || p.paymentDate || '';
      const amount = parseFloat(p.amount) || 0;

      const payPopupHtml = `
        <div class="table-data-popup-header">
          <span class="table-data-popup-title">Settlement Record</span>
          <span class="table-data-popup-badge">${Utils.escapeHtml(method)}</span>
        </div>
        <div class="table-data-popup-row"><span>Client</span><span>${Utils.escapeHtml(clientName)}</span></div>
        <div class="table-data-popup-row"><span>Amount</span><span>+ ${Utils.formatCurrency(amount)}</span></div>
        <div class="table-data-popup-row"><span>Date</span><span>${Utils.formatDate(date)}</span></div>
        ${invNum ? `<div class="table-data-popup-row"><span>Linked Invoice</span><span>${Utils.escapeHtml(invNum)}</span></div>` : ''}
      `.trim();

      return `
        <tr>
          <td>
            <div class="table-single-line" data-table-popup="${Utils.escapeHtml(payPopupHtml)}" title="${Utils.escapeHtml(clientName)}${invNum ? ` • ${Utils.escapeHtml(invNum)}` : ''}">
              <span class="data-link" style="font-weight:600;color:var(--color-text-primary);" onclick="Clients.viewClientDetails('${p.client_id || p.clientId}')" title="View client dossier">${Utils.escapeHtml(clientName)}</span>
              ${invId ? `<span class="table-bullet">•</span><span class="ledger-badge-code data-code-link" onclick="Payments.viewInvoiceHistory('${invId}')" title="View invoice history">${Utils.escapeHtml(invNum || 'Invoice')}</span>` : ''}
            </div>
          </td>
          <td class="tabular-nums" style="font-weight:600;color:var(--color-success);white-space:nowrap;">+ ${Utils.formatCurrency(amount)}</td>
          <td style="white-space:nowrap;">${Utils.formatDate(date)}</td>
          <td style="white-space:nowrap;"><span class="badge badge-neutral">${Utils.escapeHtml(method)}</span></td>
          <td style="white-space:nowrap;">
            ${invId ? `
              <span class="badge badge-success data-link" onclick="Payments.viewInvoiceHistory('${invId}')" title="View invoice history" style="cursor:pointer;">
                <span class="badge-dot"></span>Received
              </span>
            ` : `
              <span class="badge badge-success"><span class="badge-dot"></span>Received</span>
            `}
          </td>
        </tr>
      `;
    }).join('');
    Utils.refreshIcons();
  },

  renderRecentExpenses(expenses) {
    const tbody = document.getElementById('dashboardRecentExpensesBody');
    if (!tbody) return;

    if (!Array.isArray(expenses) || expenses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No recent expenses recorded.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = expenses.map((exp) => `
      <tr style="cursor:pointer;" onclick="App.navigateTo('expenses')" title="View in expenses manager">
        <td style="font-weight:600;"><div class="table-cell-truncate data-link" style="max-width:180px;" title="${Utils.escapeHtml(exp.title)}">${Utils.escapeHtml(exp.title)}</div></td>
        <td style="white-space:nowrap;"><span class="badge badge-neutral">${Utils.escapeHtml(exp.category)}</span></td>
        <td class="tabular-nums" style="font-weight:600;white-space:nowrap;">${Utils.formatCurrency(exp.amount)}</td>
        <td style="white-space:nowrap;">${Utils.formatDate(exp.date)}</td>
      </tr>
    `).join('');
  },

  renderUpcomingPayments(dues) {
    const tbody = document.getElementById('dashboardUpcomingPaymentsBody');
    if (!tbody) return;

    if (!Array.isArray(dues) || dues.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No upcoming or overdue payments due. All client accounts are settled!</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = dues.map((inv) => {
      const rem = inv.remaining_due !== undefined ? inv.remaining_due : (inv.amount - (inv.paid_amount || 0));
      const clientName = inv.client_name || inv.clientName || 'Client';
      const invNum = inv.invoice_number || inv.invoiceNumber || '';
      const serviceName = inv.service_name || inv.serviceName || 'Service';
      const dueDate = inv.due_date || inv.dueDate || '';
      const isOverdue = inv.is_overdue || inv.isOverdue;

      let badgeHtml = '';
      if (isOverdue) {
        badgeHtml = `<span class="badge badge-danger"><span class="badge-dot"></span>Overdue</span>`;
      } else if (inv.paid_amount > 0 || inv.paidAmount > 0) {
        badgeHtml = `<span class="badge badge-warning"><span class="badge-dot"></span>Partial Due</span>`;
      } else {
        badgeHtml = `<span class="badge badge-neutral"><span class="badge-dot"></span>Due Soon</span>`;
      }

      const upPopupHtml = `
        <div class="table-data-popup-header">
          <span class="table-data-popup-title">${Utils.escapeHtml(invNum)}</span>
          <span class="table-data-popup-badge">${isOverdue ? 'OVERDUE' : 'DUE'}</span>
        </div>
        <div class="table-data-popup-row"><span>Client</span><span>${Utils.escapeHtml(clientName)}</span></div>
        <div class="table-data-popup-row"><span>Service</span><span>${Utils.escapeHtml(serviceName)}</span></div>
        <div class="table-data-popup-row"><span>Due Date</span><span>${Utils.formatDate(dueDate)}</span></div>
        <div class="table-data-popup-row"><span>Amount Due</span><span>${Utils.formatCurrency(rem)}</span></div>
      `.trim();

      return `
        <tr class="table-card-row">
          <td class="table-card-main">
            <div class="table-single-line" data-table-popup="${Utils.escapeHtml(upPopupHtml)}" title="${Utils.escapeHtml(clientName)} • ${Utils.escapeHtml(invNum)} (${Utils.escapeHtml(serviceName)})">
              <span class="data-link" style="font-weight: 600; color: var(--color-text-primary); font-size: 13.5px; cursor: pointer;" onclick="Clients.viewClientDetails('${inv.client_id || inv.clientId}')" title="View client dossier">${Utils.escapeHtml(clientName)}</span>
              <span class="table-bullet">•</span>
              <span class="ledger-badge-code data-code-link" onclick="Payments.viewInvoiceHistory('${inv.id}')" title="View invoice history">${Utils.escapeHtml(invNum)}</span>
              <span class="table-secondary-text" style="max-width:130px;">(${Utils.escapeHtml(serviceName)})</span>
            </div>
          </td>
          <td data-label="Amount Due" class="tabular-nums" style="font-weight:600;color:var(--color-primary);white-space:nowrap;">${Utils.formatCurrency(rem)}</td>
          <td data-label="Due Date" class="tabular-nums" style="${isOverdue ? 'color:var(--color-danger);font-weight:600;' : ''} white-space:nowrap;">${Utils.formatDate(dueDate)}</td>
          <td data-label="Status">${badgeHtml}</td>
          <td class="actions-col" data-label="Action">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;width:100%;">
              <button class="btn btn-secondary btn-icon btn-sm" onclick="Payments.viewInvoiceHistory('${inv.id}')" title="View Invoice History" style="width:28px;height:28px;">
                <i data-lucide="history" style="width:14px;height:14px;"></i>
              </button>
              <button class="btn btn-primary btn-sm" onclick="Payments.openRecordPaymentModal('${inv.id}')" title="Record Payment">
                <i data-lucide="plus-circle"></i> Pay
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    Utils.refreshIcons();
  },

  /* ---------------- Offline In-Memory Fallbacks ---------------- */
  renderMetricsFromStore() {
    const clients = Storage.getClients();
    const currentMonth = Utils.getCurrentMonthString();
    const payments = Storage.getPayments();
    const invoices = Storage.getInvoices();

    let monthlyIncome = 0;
    payments.forEach((p) => {
      if (p.paymentDate && p.paymentDate.startsWith(currentMonth)) {
        monthlyIncome += (p.amount || 0);
      }
    });

    let pending = 0;
    invoices.forEach((inv) => {
      const rem = (inv.amount || 0) - (inv.paidAmount || 0);
      if (rem > 0) pending += rem;
    });

    this.renderMetrics({
      total_clients: clients.length,
      monthly_income: monthlyIncome,
      received_payments: monthlyIncome,
      pending_payments: pending
    });
  },

  renderIncomeChartFromStore() {
    const months = Utils.getLastNMonths(6);
    const payments = Storage.getPayments();

    const chartData = months.map((m) => {
      let total = 0;
      let count = 0;
      payments.forEach((p) => {
        if (p.paymentDate && p.paymentDate.startsWith(m)) {
          total += (p.amount || 0);
          count++;
        }
      });
      return {
        month: m,
        label: Utils.formatShortMonth(m),
        amount: total,
        tx_count: count
      };
    });

    this.renderIncomeChart(chartData);
  },

  renderRecentPaymentsFromStore() {
    this.renderRecentPayments(Storage.getPayments().slice(0, 5));
  },

  renderRecentExpensesFromStore() {
    this.renderRecentExpenses(Storage.getExpenses().slice(0, 5));
  },

  renderUpcomingPaymentsFromStore() {
    const invoices = Storage.getInvoices().filter((inv) => (inv.amount || 0) > (inv.paidAmount || 0));
    invoices.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    this.renderUpcomingPayments(invoices.slice(0, 5));
  }
};

window.Dashboard = Dashboard;
