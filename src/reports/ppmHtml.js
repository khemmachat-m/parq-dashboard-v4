// ═══════════════════════════════════════════════════════════════════
// PPM HTML GENERATOR  — blue theme #1A4A8A
// ═══════════════════════════════════════════════════════════════════
import { fmtDate } from '../utils.js';
import { sharedCSS, hbars, compRows, chartScript, wrapHtml } from './shared.js';

export function generatePPMHtml(lw, pw, cmp, lwStart, lwEnd, pwStart, pwEnd, reportDate) {
  const lwLabel = `${fmtDate(lwStart)} – ${fmtDate(lwEnd)}`;
  const pwLabel = `${fmtDate(pwStart)} – ${fmtDate(pwEnd)}`;
  const PRIMARY = '#1A4A8A', DARK = '#0D2B5C', ACCENT = '#3A7EBF', LIGHT = '#E3F2FD', PW_CLR = '#5B8FC9';
  const HARD_CLR = '#1A4A8A', SOFT_CLR = '#E87329';
  const top = cmp[0] || { type: 'N/A', lw: 0, pw: 0 };
  const donutTotal = lw.total || 1;
  const badgeCls = lw.compliancePct >= 80 ? 'comp-good' : lw.compliancePct >= 60 ? 'comp-warn' : 'comp-bad';

  // Hard vs Soft Service split from mainCategories
  const hardLW  = (lw.mainCategories || []).find(x => x.label === 'Hard Service');
  const softLW  = (lw.mainCategories || []).find(x => x.label === 'Soft Service');
  const hardCount = hardLW ? hardLW.count : 0;
  const softCount = softLW ? softLW.count : 0;
  const pct = (n, t) => t ? Math.round(n / t * 100) : 0;
  const hardPct = pct(hardCount, lw.total);
  const softPct = pct(softCount, lw.total);

  const body = `
<div class="page-title">WEEKLY OPS MEETING — Planned Preventive Maintenance (PPM) | The PARQ</div>
<div class="period-row">
  <span>Report Date: <strong>${fmtDate(reportDate)}</strong></span>
  <span>Last Week: <strong>${lwLabel}</strong></span>
  <span>Previous Week: <strong>${pwLabel}</strong></span>
</div>
<div class="main-grid">
  <div class="left-col">
    <div>
      <div class="sec-header">PPM Summary (Last Week)</div>
      <div class="summary-inner">
        <div><div class="donut-wrap"><canvas id="donutChart" width="190" height="190"></canvas>
          <div class="donut-center"><div class="big">${lw.total}</div><div class="sub">PPM orders</div></div>
        </div></div>
        <div>
          <div class="chart-label">Hard Service vs Soft Service</div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            <div style="flex:1;background:${HARD_CLR};color:#fff;border-radius:6px;padding:8px 6px;text-align:center;">
              <div style="font-size:20px;font-weight:700;">${hardCount}</div>
              <div style="font-size:10px;opacity:.85;">Hard Service</div>
              <div style="font-size:12px;font-weight:600;">${hardPct}%</div>
            </div>
            <div style="flex:1;background:${SOFT_CLR};color:#fff;border-radius:6px;padding:8px 6px;text-align:center;">
              <div style="font-size:20px;font-weight:700;">${softCount}</div>
              <div style="font-size:10px;opacity:.85;">Soft Service</div>
              <div style="font-size:12px;font-weight:600;">${softPct}%</div>
            </div>
          </div>
          <div class="chart-label" style="margin-top:8px;">PPM Orders by Location (Top 15)</div>
          <div style="position:relative;height:220px;">
            <canvas id="zoneChart"></canvas>
          </div>
        </div>
      </div>
      <div class="stats-row" style="margin-top:10px;">
        <div class="stat-box accent"><div class="s-val">${lw.closed}</div><div class="s-lbl">Closed</div><div class="s-pct">${lw.closedPct}%</div></div>
        <div class="stat-box orange"><div class="s-val">${lw.inProgress}</div><div class="s-lbl">In Progress</div><div class="s-pct">&nbsp;</div></div>
        <div class="stat-box pink"><div class="s-val">${lw.overdue}</div><div class="s-lbl">Overdue</div><div class="s-pct">${lw.overduePct}%</div></div>
        <div class="stat-box"><div class="s-val">${lw.cancelled}</div><div class="s-lbl">Cancelled</div><div class="s-pct">&nbsp;</div></div>
      </div>
      <div style="margin-top:10px;">
        <div class="chart-label">PPM Compliance Rate (Last Week) <span class="comp-badge ${badgeCls}">${lw.compliancePct}%</span></div>
        <div class="sla-row"><div class="sla-name">Closed</div><div class="sla-track"><div class="sla-fill" style="width:${lw.compliancePct}%;background:${ACCENT};"></div></div><div class="sla-val">${lw.closed} <span style="color:${ACCENT};">(${lw.compliancePct}%)</span></div></div>
        <div class="sla-row"><div class="sla-name">Overdue</div><div class="sla-track"><div class="sla-fill" style="width:${lw.overduePct}%;background:#D9534F;"></div></div><div class="sla-val">${lw.overdue} <span style="color:#D9534F;">(${lw.overduePct}%)</span></div></div>
      </div>
    </div>
    <div>
      <div class="sec-header">Top PPM Task Categories by Week</div>
      <div class="two-col">
        <div><div class="week-label">${pwLabel}</div>${hbars(pw.categories, PW_CLR, '130px')}</div>
        <div><div class="week-label">${lwLabel}</div>${hbars(lw.categories, PRIMARY, '130px')}</div>
      </div>
    </div>
  </div>
  <div class="right-col">
    <div>
      <div class="sec-header">PPM Highlights (Last Week: ${lwLabel})</div>
      <div class="highlight-box">
        <p style="color:#888;font-style:italic;">Auto-generated PPM report — add narrative highlights manually.</p><br>
        <p><strong>Top Category:</strong> ${top.type} — ${top.lw} orders last week (vs ${top.pw} previous week).</p><br>
        <p><strong>Hard Service: ${hardCount} orders (${hardPct}%)</strong> &nbsp;|&nbsp; <strong>Soft Service: ${softCount} orders (${softPct}%)</strong></p><br>
        <p><strong>Overdue: ${lw.overdue} order(s)</strong> require follow-up or rescheduling.</p><br>
        <p><strong>Overall Compliance: ${lw.compliancePct}%</strong> (${lw.closed} closed / ${lw.total} total this week).</p>
      </div>
    </div>
    <div>
      <div class="sec-header">Comparing PPM Task Categories</div>
      <table class="compare-table"><thead><tr>
        <th>No.</th><th class="left">Task Category</th>
        <th>Last Week<br><small>(${lwLabel})</small></th>
        <th>Previous Week<br><small>(${pwLabel})</small></th>
        <th>Change</th>
      </tr></thead><tbody>${compRows(cmp)}</tbody></table>
      <div class="callout-grid">
        <div class="callout-a"><strong style="color:#1B5E20;">Prev Week Compliance (${pwLabel})</strong><br>Closed: ${pw.closed} (${pw.compliancePct}%) &nbsp;|&nbsp; Overdue: ${pw.overdue} (${pw.overduePct}%)</div>
        <div class="callout-b"><strong style="color:${PRIMARY};">Last Week Compliance (${lwLabel})</strong><br>Closed: ${lw.closed} (${lw.compliancePct}%) &nbsp;|&nbsp; Overdue: ${lw.overdue} (${lw.overduePct}%)</div>
      </div>
    </div>
  </div>
</div>
<div class="bottom-row">
  <div class="sec-header" style="margin-top:12px;">Weekly PPM Volume Comparison by Task Category</div>
  <div class="bottom-grid">
    <div><div class="chart-label" style="margin-bottom:8px;">${pwLabel}: ${pw.total} PPM Orders by Category</div><canvas id="pwChart" height="200"></canvas></div>
    <div><div class="chart-label" style="margin-bottom:8px;">${lwLabel}: ${lw.total} PPM Orders by Category</div><canvas id="lwChart" height="200"></canvas></div>
  </div>
</div>
<div class="footnote">Data Source: PARQ_PPM_Enriched.csv &nbsp;|&nbsp; Last Week: ${lwLabel} (${lw.total} records) &nbsp;|&nbsp; Previous Week: ${pwLabel} (${pw.total} records) &nbsp;|&nbsp; Generated: ${fmtDate(reportDate)}</div>
<script>
new Chart(document.getElementById('donutChart'),{type:'doughnut',data:{labels:['Closed','In Progress','Overdue','Cancelled'],datasets:[{data:[${lw.closed},${lw.inProgress},${lw.overdue},${lw.cancelled}],backgroundColor:['${PRIMARY}','#E87329','#D9534F','#CCCCCC'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:false,cutout:'62%',plugins:{legend:{display:true,position:'bottom',labels:{font:{size:10},boxWidth:12,padding:8}},tooltip:{callbacks:{label:ctx=>\` \${ctx.label}: \${ctx.raw} (\${Math.round(ctx.raw/${donutTotal}*100)}%)\`}}}}});
(function(){
  const zLabels = ${JSON.stringify(lw.zones.map(e => e.label))};
  const zData   = ${JSON.stringify(lw.zones.map(e => e.count))};
  const maxVal  = Math.max(...zData, 1);
  new Chart(document.getElementById('zoneChart'), {
    type: 'bar',
    data: {
      labels: zLabels,
      datasets: [{ data: zData, backgroundColor: '${ACCENT}', borderRadius: 3, barThickness: 12 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => \` \${ctx.raw} orders\` } }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: Math.ceil(maxVal * 1.15),
          ticks: { font: { size: 9 }, maxTicksLimit: 5 },
          grid: { color: '#eee' }
        },
        y: {
          ticks: {
            font: { size: 9 },
            callback: function(val, idx) {
              const lbl = zLabels[idx] || '';
              return lbl.length > 28 ? lbl.slice(0, 26) + '…' : lbl;
            }
          },
          grid: { display: false }
        }
      }
    }
  });
})();
<\/script>
${chartScript(pw.categories.map(e => e.label), pw.categories.map(e => e.count), lw.categories.map(e => e.label), lw.categories.map(e => e.count), PW_CLR, PRIMARY, 'orders')}`;

  return wrapHtml('PARQ – PPM Weekly Dashboard', sharedCSS(PRIMARY, LIGHT, ACCENT, DARK), body);
}
