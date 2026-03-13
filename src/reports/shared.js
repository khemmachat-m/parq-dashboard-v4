// ═══════════════════════════════════════════════════════════════════
// SHARED HTML HELPERS  — used by all three report generators
// ═══════════════════════════════════════════════════════════════════
import { fmtDate } from '../utils.js';

export function sharedCSS(primary, light, accent, dark) {
  return `
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',Segoe UI,Arial,sans-serif;background:#F5F5F5;color:#222;font-size:13px;}
.page{max-width:1280px;margin:0 auto;background:white;padding:14px 16px;}
.page-title{background:${primary};color:white;text-align:center;padding:8px 12px;font-size:17px;font-weight:700;letter-spacing:.5px;margin-bottom:12px;}
.period-row{display:flex;justify-content:center;gap:30px;margin-bottom:12px;font-size:12px;color:#555;}
.period-row span strong{color:${primary};}
.sec-header{background:${primary};color:white;font-weight:700;font-size:13px;text-align:center;padding:5px 10px;border-radius:3px;margin-bottom:8px;}
.main-grid{display:grid;grid-template-columns:48% 52%;gap:14px;}
.left-col,.right-col{display:flex;flex-direction:column;gap:12px;}
.summary-inner{display:grid;grid-template-columns:210px 1fr;gap:14px;align-items:start;}
.donut-wrap{position:relative;width:190px;height:190px;margin:0 auto;}
.donut-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;}
.donut-center .big{font-size:28px;font-weight:700;color:#222;}
.donut-center .sub{font-size:11px;color:#555;}
.stats-row{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-top:8px;}
.stat-box{border:1.5px solid #ddd;border-radius:4px;padding:6px 4px;text-align:center;}
.stat-box .s-val{font-size:20px;font-weight:700;color:${primary};}
.stat-box .s-lbl{font-size:10px;color:#555;margin-top:1px;}
.stat-box .s-pct{font-size:11px;font-weight:600;color:#333;margin-top:2px;}
.stat-box.orange{background:#FFF0E6;border-color:#E87329;}
.stat-box.orange .s-val{color:#E87329;}
.stat-box.pink{background:#FFF0F0;border-color:#D9534F;}
.stat-box.pink .s-val{color:#D9534F;}
.stat-box.accent{background:${light};border-color:${accent};}
.stat-box.accent .s-val{color:${primary};}
.chart-label{font-size:12px;font-weight:600;color:#333;margin-bottom:6px;}
.hbar-row{display:flex;align-items:center;gap:6px;margin-bottom:5px;height:20px;}
.hbar-name{text-align:right;font-size:11px;color:#444;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hbar-track{flex:1;background:#EEE;height:14px;border-radius:2px;overflow:hidden;}
.hbar-fill{height:100%;border-radius:2px;}
.hbar-val{width:28px;font-size:11px;color:#333;font-weight:600;flex-shrink:0;}
.sla-row{display:flex;align-items:center;gap:6px;margin-bottom:5px;}
.sla-name{width:70px;text-align:right;font-size:11px;color:#444;flex-shrink:0;}
.sla-track{flex:1;background:#EEE;height:13px;border-radius:2px;overflow:hidden;}
.sla-fill{height:100%;border-radius:2px;}
.sla-val{font-size:11px;color:#333;font-weight:600;width:80px;}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.week-label{font-size:12px;font-weight:700;color:#333;margin-bottom:6px;}
.highlight-box{border:1px solid #DDD;padding:10px 12px;border-radius:4px;line-height:1.55;font-size:11.5px;color:#444;}
.compare-table{width:100%;border-collapse:collapse;font-size:12px;}
.compare-table thead th{background:${primary};color:white;padding:6px 8px;text-align:center;font-weight:600;}
.compare-table thead th.left{text-align:left;}
.compare-table tbody tr{border-bottom:1px solid #E8E8E8;}
.compare-table tbody tr:hover{background:${light};}
.compare-table tbody td{padding:6px 8px;}
.compare-table td.num{text-align:center;}
.compare-table td.no{text-align:center;color:#888;}
.ch-up{background:${light};color:${primary};font-weight:700;border-radius:3px;padding:1px 6px;white-space:nowrap;}
.ch-dn{background:#FFEBEE;color:#C62828;font-weight:700;border-radius:3px;padding:1px 6px;white-space:nowrap;}
.ch-fl{background:#F5F5F5;color:#777;font-weight:600;border-radius:3px;padding:1px 6px;}
.callout-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;}
.callout-a{background:#E8F5E9;border:1px solid #A5D6A7;border-radius:4px;padding:7px 10px;font-size:11.5px;}
.callout-b{background:${light};border:1px solid ${accent};border-radius:4px;padding:7px 10px;font-size:11.5px;}
.bottom-row{margin-top:12px;}
.bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.footnote{text-align:center;font-size:10px;color:#999;margin-top:10px;padding-top:8px;border-top:1px solid #EEE;}
.comp-badge{display:inline-block;padding:3px 10px;border-radius:12px;font-weight:700;font-size:13px;margin-left:6px;}
.comp-good{background:${light};color:${primary};}
.comp-warn{background:#FFF3E0;color:#E65100;}
.comp-bad{background:#FFEBEE;color:#C62828;}
`.trim();
}

export function hbars(items, color, nameWidth = '110px') {
  if (!items || !items.length)
    return '<p style="font-size:11px;color:#999;font-style:italic;">No data.</p>';
  const max = Math.max(...items.map(x => x.count)) || 1;
  return items.map(x => `<div class="hbar-row">
  <div class="hbar-name" style="width:${nameWidth};">${x.label}</div>
  <div class="hbar-track"><div class="hbar-fill" style="width:${Math.round(x.count / max * 100)}%;background:${color};"></div></div>
  <div class="hbar-val">${x.count}</div>
</div>`).join('\n');
}

export function compRows(rows) {
  return rows.map((r, i) => {
    const d  = r.delta;
    const ch = d > 0 ? `<span class="ch-up">${d} ▲</span>`
             : d < 0 ? `<span class="ch-dn">${Math.abs(d)} ▼</span>`
             :          `<span class="ch-fl">0 —</span>`;
    return `<tr><td class="no">${i + 1}</td><td>${r.type}</td><td class="num">${r.lw}</td><td class="num">${r.pw}</td><td class="num">${ch}</td></tr>`;
  }).join('\n');
}

export function slaBars(passLbl, passN, passPct, failLbl, failN, failPct, accent) {
  return `<div class="sla-row">
  <div class="sla-name">${passLbl}</div>
  <div class="sla-track"><div class="sla-fill" style="width:${passPct}%;background:${accent};"></div></div>
  <div class="sla-val">${passN} <span style="color:${accent};">(${passPct}%)</span></div>
</div>
<div class="sla-row">
  <div class="sla-name">${failLbl}</div>
  <div class="sla-track"><div class="sla-fill" style="width:${failPct}%;background:#D9534F;"></div></div>
  <div class="sla-val">${failN} <span style="color:#D9534F;">(${failPct}%)</span></div>
</div>`;
}

export function chartScript(pwLabels, pwData, lwLabels, lwData, pwColor, lwColor, suffix = 'cases') {
  return `<script>
const _bOpts=()=>({responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>\` \${ctx.raw} ${suffix}\`}}},scales:{x:{ticks:{font:{size:10},maxRotation:35,minRotation:20},grid:{display:false}},y:{ticks:{font:{size:10},precision:0},grid:{color:'#EEE'}}}});
new Chart(document.getElementById('pwChart'),{type:'bar',data:{labels:${JSON.stringify(pwLabels)},datasets:[{data:${JSON.stringify(pwData)},backgroundColor:'${pwColor}',borderRadius:3,borderSkipped:false}]},options:_bOpts()});
new Chart(document.getElementById('lwChart'),{type:'bar',data:{labels:${JSON.stringify(lwLabels)},datasets:[{data:${JSON.stringify(lwData)},backgroundColor:'${lwColor}',borderRadius:3,borderSkipped:false}]},options:_bOpts()});
<\/script>`;
}

export function wrapHtml(title, css, body) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"><\/script>
<style>${css}</style></head>
<body><div class="page">${body}</div></body></html>`;
}
