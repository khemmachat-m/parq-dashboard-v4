// ═══════════════════════════════════════════════════════════════════
// CASES HTML GENERATOR  — purple theme #7B2D8B
// ═══════════════════════════════════════════════════════════════════
import { fmtDate } from '../utils.js';
import { sharedCSS, hbars, compRows, slaBars, chartScript, wrapHtml } from './shared.js';

export function generateCaseHtml(lw, pw, cmp, lwStart, lwEnd, pwStart, pwEnd, reportDate) {
  const lwLabel = `${fmtDate(lwStart)} – ${fmtDate(lwEnd)}`;
  const pwLabel = `${fmtDate(pwStart)} – ${fmtDate(pwEnd)}`;
  const PRIMARY = '#7B2D8B', DARK = '#4A0060', ACCENT = '#AB47BC', LIGHT = '#F3E5F5', PW_CLR = '#CE93D8';
  const top = cmp[0] || { type: 'N/A', lw: 0, pw: 0 };
  const donutTotal = lw.total || 1;

  const body = `
<div class="page-title">WEEKLY OPS MEETING — Case Management | The PARQ</div>
<div class="period-row">
  <span>Report Date: <strong>${fmtDate(reportDate)}</strong></span>
  <span>Last Week: <strong>${lwLabel}</strong></span>
  <span>Previous Week: <strong>${pwLabel}</strong></span>
</div>
<div class="main-grid">
  <div class="left-col">
    <div>
      <div class="sec-header">Case Summary (Last Week)</div>
      <div class="summary-inner">
        <div><div class="donut-wrap"><canvas id="donutChart" width="190" height="190"></canvas>
          <div class="donut-center"><div class="big">${lw.total}</div><div class="sub">Total cases</div></div>
        </div></div>
        <div>
          <div class="chart-label">Cases by priority level</div>
          ${hbars(lw.priorities, ACCENT, '110px')}
          <div class="chart-label" style="margin-top:10px;">Cases by Location</div>
          ${hbars(lw.locations, ACCENT, '110px')}
        </div>
      </div>
      <div class="stats-row" style="margin-top:10px;">
        <div class="stat-box accent"><div class="s-val">${lw.resolved}</div><div class="s-lbl">TotalResolved</div><div class="s-pct">${lw.resolvePct}%</div></div>
        <div class="stat-box"><div class="s-val">${lw.cancelled}</div><div class="s-lbl">Cancelled</div><div class="s-pct">&nbsp;</div></div>
        <div class="stat-box orange"><div class="s-val">${lw.active}</div><div class="s-lbl">TotalActive</div><div class="s-pct">${lw.activePct}%</div></div>
        <div class="stat-box pink"><div class="s-val">${lw.slaFail}</div><div class="s-lbl">SLA Failed</div><div class="s-pct">&nbsp;</div></div>
      </div>
      <div style="margin-top:10px;">
        <div class="chart-label">SLA Completion (Last Week)</div>
        ${slaBars('Passed', lw.slaPass, lw.slaPassPct, 'Failed', lw.slaFail, lw.slaFailPct, ACCENT)}
      </div>
    </div>
    <div>
      <div class="sec-header">Top Event Type by Week</div>
      <div class="two-col">
        <div><div class="week-label">${pwLabel}</div>${hbars(pw.events, PW_CLR, '130px')}</div>
        <div><div class="week-label">${lwLabel}</div>${hbars(lw.events, PRIMARY, '130px')}</div>
      </div>
    </div>
    ${lw.assets && lw.assets.length ? `<div><div class="sec-header">Top Assets with Cases (Last Week)</div>${hbars(lw.assets, '#3A7EBF', '220px')}</div>` : ''}
  </div>
  <div class="right-col">
    <div>
      <div class="sec-header">Highlight Cases (Last Week: ${lwLabel})</div>
      <div class="highlight-box">
        <p style="color:#888;font-style:italic;">Auto-generated report — add narrative highlights manually.</p><br>
        <p><strong>Top Event Type:</strong> ${top.type} — ${top.lw} cases last week (vs ${top.pw} previous week).</p><br>
        <p><strong>SLA Pass Rate:</strong> ${lw.slaPassPct}% this week vs ${pw.slaPassPct}% previous week.</p><br>
        <p><strong>Active cases:</strong> ${lw.active} (${lw.activePct}%) require follow-up.</p>
      </div>
    </div>
    <div>
      <div class="sec-header">Comparing Cases by Event Type</div>
      <table class="compare-table"><thead><tr>
        <th>No.</th><th class="left">Event Type</th>
        <th>Last Week<br><small>(${lwLabel})</small></th>
        <th>Previous Week<br><small>(${pwLabel})</small></th>
        <th>Change</th>
      </tr></thead><tbody>${compRows(cmp)}</tbody></table>
      <div class="callout-grid">
        <div class="callout-a"><strong style="color:#4A0060;">Prev Week SLA (${pwLabel})</strong><br>Passed: ${pw.slaPass} (${pw.slaPassPct}%) &nbsp;|&nbsp; Failed: ${pw.slaFail} (${pw.slaFailPct}%)</div>
        <div class="callout-b"><strong style="color:${PRIMARY};">Last Week SLA (${lwLabel})</strong><br>Passed: ${lw.slaPass} (${lw.slaPassPct}%) &nbsp;|&nbsp; Failed: ${lw.slaFail} (${lw.slaFailPct}%)</div>
      </div>
    </div>
  </div>
</div>
<div class="bottom-row">
  <div class="sec-header" style="margin-top:12px;">Weekly Case Volume Comparison</div>
  <div class="bottom-grid">
    <div><div class="chart-label" style="margin-bottom:8px;">${pwLabel}: ${pw.total} Total Cases</div><canvas id="pwChart" height="200"></canvas></div>
    <div><div class="chart-label" style="margin-bottom:8px;">${lwLabel}: ${lw.total} Total Cases</div><canvas id="lwChart" height="200"></canvas></div>
  </div>
</div>
<div class="footnote">Data Source: PARQ_Cases_Enriched.csv &nbsp;|&nbsp; Last Week: ${lwLabel} (${lw.total} records) &nbsp;|&nbsp; Previous Week: ${pwLabel} (${pw.total} records) &nbsp;|&nbsp; Generated: ${fmtDate(reportDate)}</div>
<script>
new Chart(document.getElementById('donutChart'),{type:'doughnut',data:{labels:['Total Resolved','Total Active','Cancelled'],datasets:[{data:[${lw.resolved},${lw.active},${lw.cancelled}],backgroundColor:['${PRIMARY}','#E87329','#CCCCCC'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:false,cutout:'62%',plugins:{legend:{display:true,position:'bottom',labels:{font:{size:10},boxWidth:12,padding:8}},tooltip:{callbacks:{label:ctx=>\` \${ctx.label}: \${ctx.raw} (\${Math.round(ctx.raw/${donutTotal}*100)}%)\`}}}}});
<\/script>
${chartScript(pw.events.map(e => e.label), pw.events.map(e => e.count), lw.events.map(e => e.label), lw.events.map(e => e.count), PW_CLR, PRIMARY, 'cases')}`;

  return wrapHtml('PARQ – Case Management Weekly Dashboard', sharedCSS(PRIMARY, LIGHT, ACCENT, DARK), body);
}
