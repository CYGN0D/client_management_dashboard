/**
 * CLIENTO - DASHBOARD MODULE
 * Calculates summary metrics, renders responsive SVG 6-month income chart,
 * displays Recent Payments, Recent Expenses, and Upcoming/Overdue Dues.
 */

const Dashboard = {
  init() {
    this.render();
  },

  render() {
    this.renderHeader();
    this.renderMetrics();
    this.renderIncomeChart();
    this.renderRecentPayments();
    this.renderRecentExpenses();
    this.renderUpcomingPayments();
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

  renderMetrics() {
    const clients = Storage.getClients();
    const activeClients = clients.filter((c) => c.status === 'active');

    const currentMonth = Utils.getCurrentMonthString();
    const payments = Storage.getPayments();
    const invoices = Storage.getInvoices();

    // Actual payments received in current month
    let monthlyIncomePaise = 0;
    let monthlyTxCount = 0;
    payments.forEach((p) => {
      if (p.paymentDate && p.paymentDate.startsWith(currentMonth)) {
        monthlyIncomePaise += Utils.toPaise(p.amount);
        monthlyTxCount++;
      }
    });

    // Outstanding / Pending balances across all invoices
    let pendingPaise = 0;
    let pendingCount = 0;
    invoices.forEach((inv) => {
      const invPaise = Utils.toPaise(inv.amount);
      const paidPaise = Utils.toPaise(inv.paidAmount || 0);
      const rem = invPaise - paidPaise;
      if (rem > 0) {
        pendingPaise += rem;
        pendingCount++;
      }
    });

    // 1. Total Clients
    const clientValEl = document.getElementById('metricTotalClients');
    if (clientValEl) clientValEl.textContent = clients.length;

    // 2. Monthly Income
    const incomeValEl = document.getElementById('metricMonthlyIncome');
    if (incomeValEl) incomeValEl.textContent = Utils.formatCurrency(Utils.fromPaise(monthlyIncomePaise));

    // 3. Received Payments
    const recValEl = document.getElementById('metricReceivedPayments');
    if (recValEl) recValEl.textContent = Utils.formatCurrency(Utils.fromPaise(monthlyIncomePaise));

    // 4. Pending Payments
    const penValEl = document.getElementById('metricPendingPayments');
    if (penValEl) penValEl.textContent = Utils.formatCurrency(Utils.fromPaise(pendingPaise));
  },

  renderIncomeChart() {
    const container = document.getElementById('dashboardIncomeChart');
    if (!container) return;

    const months = Utils.getLastNMonths(6); // e.g. ['2026-06', ..., '2026-11']
    const payments = Storage.getPayments();

    // Aggregate monthly actual income received
    const monthlyData = months.map((m) => {
      let totalPaise = 0;
      let txCount = 0;
      payments.forEach((p) => {
        if (p.paymentDate && p.paymentDate.startsWith(m)) {
          totalPaise += Utils.toPaise(p.amount);
          txCount++;
        }
      });
      return {
        month: m,
        label: Utils.formatShortMonth(m),
        amount: Utils.fromPaise(totalPaise),
        txCount
      };
    });

    const hasData = monthlyData.some((d) => d.amount > 0);
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

    // Chart dimensions
    const width = 640;
    const height = 220;
    const padLeft = 65;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 35;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const maxVal = Math.max(...monthlyData.map((d) => d.amount), 10000);
    // Nice round upper ceiling
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

    // Bars
    const barWidth = Math.min(chartW / months.length * 0.45, 42);
    const slotWidth = chartW / months.length;

    let barsHtml = '';
    monthlyData.forEach((d, idx) => {
      const barH = ceilVal > 0 ? (d.amount / ceilVal) * chartH : 0;
      const x = padLeft + (idx * slotWidth) + (slotWidth / 2) - (barWidth / 2);
      const y = padTop + chartH - barH;
      const isCurrent = d.month === Utils.getCurrentMonthString();

      barsHtml += `
        <g class="chart-bar-group" 
           onmouseenter="Dashboard.showTooltip(event, '${Utils.escapeHtml(Utils.formatMonth(d.month))}', '${Utils.formatCurrency(d.amount)}', ${d.txCount})"
           onmouseleave="Dashboard.hideTooltip()">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barH, 2)}" rx="3" ry="3"
                class="chart-bar" fill="${isCurrent ? 'var(--color-primary)' : '#4B5563'}" />
          <!-- Invisible wide hover hit box -->
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

  renderRecentPayments() {
    const tbody = document.getElementById('dashboardRecentPaymentsBody');
    if (!tbody) return;

    const payments = Storage.getPayments().slice(0, 5);

    if (payments.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No recent payment transactions.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = payments.map((p) => {
      const payPopupHtml = `
        <div class="table-data-popup-header">
          <span class="table-data-popup-title">Settlement Record</span>
          <span class="table-data-popup-badge">${Utils.escapeHtml(p.paymentMethod)}</span>
        </div>
        <div class="table-data-popup-row"><span>Client</span><span>${Utils.escapeHtml(p.clientName)}</span></div>
        <div class="table-data-popup-row"><span>Amount</span><span>+ ${Utils.formatCurrency(p.amount)}</span></div>
        <div class="table-data-popup-row"><span>Date</span><span>${Utils.formatDate(p.paymentDate)}</span></div>
        ${p.invoiceNumber ? `<div class="table-data-popup-row"><span>Linked Invoice</span><span>${Utils.escapeHtml(p.invoiceNumber)}</span></div>` : ''}
      `.trim();

      return `
        <tr>
          <td>
            <div class="table-single-line" data-table-popup="${Utils.escapeHtml(payPopupHtml)}" title="${Utils.escapeHtml(p.clientName)}${p.invoiceNumber ? ` • ${Utils.escapeHtml(p.invoiceNumber)}` : ''}">
              <span class="data-link" style="font-weight:600;color:var(--color-text-primary);" onclick="Clients.viewClientDetails('${p.clientId}')" title="View client dossier">${Utils.escapeHtml(p.clientName)}</span>
              ${p.invoiceId ? `<span class="table-bullet">•</span><span class="ledger-badge-code data-code-link" onclick="Payments.viewInvoiceHistory('${p.invoiceId}')" title="View invoice history">${Utils.escapeHtml(p.invoiceNumber || 'Invoice')}</span>` : ''}
            </div>
          </td>
          <td class="tabular-nums" style="font-weight:600;color:var(--color-success);white-space:nowrap;">+ ${Utils.formatCurrency(p.amount)}</td>
          <td style="white-space:nowrap;">${Utils.formatDate(p.paymentDate)}</td>
          <td style="white-space:nowrap;"><span class="badge badge-neutral">${Utils.escapeHtml(p.paymentMethod)}</span></td>
          <td style="white-space:nowrap;">
            ${p.invoiceId ? `
              <span class="badge badge-success data-link" onclick="Payments.viewInvoiceHistory('${p.invoiceId}')" title="View invoice history" style="cursor:pointer;">
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

  renderRecentExpenses() {
    const tbody = document.getElementById('dashboardRecentExpensesBody');
    if (!tbody) return;

    const expenses = Storage.getExpenses().slice(0, 5);

    if (expenses.length === 0) {
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

  renderUpcomingPayments() {
    const tbody = document.getElementById('dashboardUpcomingPaymentsBody');
    if (!tbody) return;

    // Filter unpaid or partially paid invoices
    const invoices = Storage.getInvoices().filter((inv) => {
      const invPaise = Utils.toPaise(inv.amount);
      const paidPaise = Utils.toPaise(inv.paidAmount || 0);
      return invPaise > paidPaise;
    });

    // Sort by due date ascending
    invoices.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    const upcoming = invoices.slice(0, 5);

    if (upcoming.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No upcoming or overdue payments due. All client accounts are settled!</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = upcoming.map((inv) => {
      const remPaise = Utils.toPaise(inv.amount) - Utils.toPaise(inv.paidAmount || 0);
      let badgeHtml = '';
      if (inv.status === 'overdue' || inv.isOverdue) {
        badgeHtml = `<span class="badge badge-danger"><span class="badge-dot"></span>Overdue</span>`;
      } else if (inv.status === 'partial') {
        badgeHtml = `<span class="badge badge-warning"><span class="badge-dot"></span>Partial Due</span>`;
      } else {
        badgeHtml = `<span class="badge badge-neutral"><span class="badge-dot"></span>Due Soon</span>`;
      }

      const upPopupHtml = `
        <div class="table-data-popup-header">
          <span class="table-data-popup-title">${Utils.escapeHtml(inv.invoiceNumber)}</span>
          <span class="table-data-popup-badge">${inv.status.toUpperCase()}</span>
        </div>
        <div class="table-data-popup-row"><span>Client</span><span>${Utils.escapeHtml(inv.clientName)}</span></div>
        <div class="table-data-popup-row"><span>Service</span><span>${Utils.escapeHtml(inv.serviceName || 'Service')}</span></div>
        <div class="table-data-popup-row"><span>Due Date</span><span>${Utils.formatDate(inv.dueDate)}</span></div>
        <div class="table-data-popup-row"><span>Amount Due</span><span>${Utils.formatCurrency(Utils.fromPaise(remPaise))}</span></div>
      `.trim();

      return `
        <tr class="table-card-row">
          <td class="table-card-main">
            <div class="table-single-line" data-table-popup="${Utils.escapeHtml(upPopupHtml)}" title="${Utils.escapeHtml(inv.clientName)} • ${Utils.escapeHtml(inv.invoiceNumber)} (${Utils.escapeHtml(inv.serviceName || 'Service')})">
              <span class="data-link" style="font-weight: 600; color: var(--color-text-primary); font-size: 13.5px; cursor: pointer;" onclick="Clients.viewClientDetails('${inv.clientId}')" title="View client dossier">${Utils.escapeHtml(inv.clientName)}</span>
              <span class="table-bullet">•</span>
              <span class="ledger-badge-code data-code-link" onclick="Payments.viewInvoiceHistory('${inv.id}')" title="View invoice history">${Utils.escapeHtml(inv.invoiceNumber)}</span>
              <span class="table-secondary-text" style="max-width:130px;">(${Utils.escapeHtml(inv.serviceName || 'Service')})</span>
            </div>
          </td>
          <td data-label="Amount Due" class="tabular-nums" style="font-weight:600;color:var(--color-primary);white-space:nowrap;">${Utils.formatCurrency(Utils.fromPaise(remPaise))}</td>
          <td data-label="Due Date" class="tabular-nums" style="${inv.isOverdue ? 'color:var(--color-danger);font-weight:600;' : ''} white-space:nowrap;">${Utils.formatDate(inv.dueDate)}</td>
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
  }
};

window.Dashboard = Dashboard;
