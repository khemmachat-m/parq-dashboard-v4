// ═══════════════════════════════════════════════════════════════════
// HOTSPOT — Hotspot Analytics page for parq-dashboard-v3
// Reads from S._enrichedCache (already loaded by scanFolder/autoLoad)
// or from manual file upload if cache is empty.
// ═══════════════════════════════════════════════════════════════════
import Papa from 'papaparse';
import { S } from './state.js';

// ─── Hotspot internal state ───────────────────────────────────────
export const HS = {
  data:        { cwo: [], cases: [], ppm: [] },  // mapped rows
  dim:         'location',   // current group-by key
  subTab:      'table',      // 'table' | 'analytics'
  dateFrom:    '',
  dateTo:      '',
  svcFilter:   'ALL',        // 'ALL' | 'Hard' | 'Soft'
  expandedKey: null,         // which group row is expanded
  drillSrc:    {},           // { groupKey: 'All'|'CWO'|'Case'|'PPM' }
  pending:     { cwo:false, cases:false, ppm:false },
};

// ─── Status label mapping (v3 enriched StatusId) ──────────────────
const STATUS_LABEL = {
  '1':'Scheduled','2':'In Progress','3':'Overdue',
  '4':'Completed','5':'Cancelled','7':'Closed','8':'Cancelled',
  'open':'Open','in progress':'In Progress','closed':'Closed',
  'completed':'Completed','overdue':'Overdue','cancelled':'Cancelled',
  'scheduled':'Scheduled',
};

const STATUS_DOT = {
  Completed:'#10b981', Closed:'#10b981', 'In Progress':'#f59e0b',
  Open:'#3b82f6', Scheduled:'#8b5cf6', Overdue:'#ef4444', Cancelled:'#94a3b8',
};
const STATUS_BG = {
  Completed:'#052e16', Closed:'#052e16', 'In Progress':'#451a03',
  Open:'#1e3a5f', Scheduled:'#2e1065', Overdue:'#450a0a', Cancelled:'#1e293b',
};
const STATUS_TEXT = {
  Completed:'#6ee7b7', Closed:'#6ee7b7', 'In Progress':'#fcd34d',
  Open:'#93c5fd', Scheduled:'#c4b5fd', Overdue:'#fca5a5', Cancelled:'#94a3b8',
};
const PRI_COLOR = { Critical:'#f87171', High:'#fb923c', Medium:'#fbbf24', Low:'#94a3b8' };
const SRC_COLOR = { CWO:'#38bdf8', Case:'#a78bfa', PPM:'#34d399' };

// ─── Service classification ───────────────────────────────────────
const HARD_KW = ['ahu','fcu','pump','cctv','fan','hv ','switchgear','chiller','cooling tower',
  'lift','escalator','fire','pipe','drain','hvac','electrical','plumbing','boiler',
  'generator','ups','bms','socket','lighting','ventilation','compressor','thermostat','mechanical'];
const SOFT_KW = ['pest','cleaning','housekeep','security','waste','landscape','garden',
  'janitorial','sanitiz','uniform','receptionist','parking','signage','access card','cosmetic','concierge'];

function classifySvc(r) {
  const hay = [r.asset, r.eventType, r.problemType, r.category].join(' ').toLowerCase();
  if (SOFT_KW.some(k => hay.includes(k))) return 'Soft';
  if (HARD_KW.some(k => hay.includes(k))) return 'Hard';
  return 'Hard';
}

// ─── Date helpers ─────────────────────────────────────────────────
function toISO(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  try { const d = new Date(s); if (!isNaN(d)) return d.toISOString().slice(0,10); } catch {}
  return '';
}
function isoNow() { return new Date().toISOString().slice(0,10); }
function isoOffset(days) {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0,10);
}
function toYM(iso) { return iso ? iso.slice(0,7) : ''; }
function fmtYM(ym) {
  if (!ym) return '';
  const [y,m] = ym.split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m,10)-1] + ' ' + y.slice(2);
}

const DATE_PRESETS = [
  { label:'Last 7d',   from:() => isoOffset(-6),                         to:() => isoNow() },
  { label:'Last 30d',  from:() => isoOffset(-29),                        to:() => isoNow() },
  { label:'This month',from:() => { const t=new Date(); return new Date(t.getFullYear(),t.getMonth(),1).toISOString().slice(0,10); },
                        to:()  => { const t=new Date(); return new Date(t.getFullYear(),t.getMonth()+1,0).toISOString().slice(0,10); } },
  { label:'Last month',from:() => { const t=new Date(); return new Date(t.getFullYear(),t.getMonth()-1,1).toISOString().slice(0,10); },
                        to:()  => { const t=new Date(); return new Date(t.getFullYear(),t.getMonth(),0).toISOString().slice(0,10); } },
  { label:'This year', from:() => { const t=new Date(); return new Date(t.getFullYear(),0,1).toISOString().slice(0,10); },
                        to:()  => { const t=new Date(); return new Date(t.getFullYear(),11,31).toISOString().slice(0,10); } },
];

// ─── Map enriched CSV row → unified hotspot record ────────────────
function mapRow(raw, src) {
  const r = raw;
  const id =
    src === 'CWO'  ? (r.Name       || r.WorkOrderId  || r.Id || '') :
    src === 'Case' ? (r.No         || r.CaseNo        || r.CaseNumber || r.Id || '') :
                     (r.Id         || r.PPMId         || r.Name || '');

  const date = toISO(r.CreatedOn || r.PlannedDate || r.ScheduledDate || r.DueDate || '');

  const location    = r.Location_FullName || r.Location_Name || r.LocationName || r.Location || '—';
  const eventType   = r.EventType_Description || r.EventType_Name || r.EventTypeCode || '—';
  const problemType = r.ProblemType_Description || r.ProblemType_Name || r.ProblemType_Code || '—';
  const asset       = r.Asset_Name || r.AssetName || r.EquipmentTag || '—';
  const priority    = r.Priority_Name || r.PriorityName || '—';
  const category    = r.ServiceCategory_Name || r.PPM_Main_Category || '';

  let status;
  if (src === 'PPM') {
    status = r.Status_Label || STATUS_LABEL[String(r.StatusId||'').trim()] || 'Scheduled';
  } else {
    const sid = String(r.StatusId || '').trim().toLowerCase();
    status = STATUS_LABEL[sid] || STATUS_LABEL[r.StatusId] || r.Status || 'Open';
  }

  const desc = r.Description || r.ShortDescription || r.Subject || r.TaskName || '';
  const svc  = classifySvc({ asset, eventType, problemType, category });

  return { id, date, location, eventType, problemType, asset, priority, status, desc, category, _service:svc, _src:src, _raw:raw };
}

// ─── Load data from S._enrichedCache ─────────────────────────────
function loadFromCache() {
  HS.data.cwo   = (S._enrichedCache?.cwo   || []).map(r => mapRow(r, 'CWO'));
  HS.data.cases = (S._enrichedCache?.cases || []).map(r => mapRow(r, 'Case'));
  HS.data.ppm   = (S._enrichedCache?.ppm   || []).map(r => mapRow(r, 'PPM'));
}

// ─── Get filtered + tagged records ───────────────────────────────
function getTagged() {
  let all = [...HS.data.cwo, ...HS.data.cases, ...HS.data.ppm];
  if (HS.svcFilter !== 'ALL') all = all.filter(r => r._service === HS.svcFilter);
  if (HS.dateFrom) all = all.filter(r => r.date >= HS.dateFrom);
  if (HS.dateTo)   all = all.filter(r => r.date <= HS.dateTo);
  return all;
}

// ─── Group records by current dimension ──────────────────────────
function getGroups(tagged) {
  const map = {};
  tagged.forEach(r => {
    const key = r[HS.dim] || '—';
    if (!map[key]) map[key] = { key, CWO:0, Case:0, PPM:0, total:0, records:[] };
    map[key][r._src]++;
    map[key].total++;
    map[key].records.push(r);
  });
  return Object.values(map).sort((a,b) => b.total - a.total);
}

// ─── Top-N helper ────────────────────────────────────────────────
function topN(records, key, n=10) {
  const counts = {};
  records.forEach(r => { const v = r[key]||'—'; counts[v]=(counts[v]||0)+1; });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([name,value])=>({name,value}));
}

// ═══════════════════════════════════════════════════════════════════
// RENDER — HTML builders
// ═══════════════════════════════════════════════════════════════════

function badgeHtml(status) {
  const bg   = STATUS_BG[status]   || '#1e293b';
  const text = STATUS_TEXT[status] || '#94a3b8';
  const dot  = STATUS_DOT[status]  || '#64748b';
  return `<span style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:${text};border-radius:20px;padding:3px 9px;font-size:10px;font-weight:700;white-space:nowrap"><span style="width:5px;height:5px;border-radius:50%;background:${dot};flex-shrink:0"></span>${status}</span>`;
}

function srcChipHtml(src) {
  const c = SRC_COLOR[src] || '#94a3b8';
  return `<span style="background:${c}22;color:${c};border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${src}</span>`;
}

function priHtml(p) {
  const c = PRI_COLOR[p] || '#94a3b8';
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:${c}"><span style="width:6px;height:6px;border-radius:50%;background:${c}"></span>${p}</span>`;
}

// ─── Upload panel ─────────────────────────────────────────────────
function uploadPanelHtml() {
  const tabs = [
    { key:'cwo',   label:'CWO Enriched',   color:'#38bdf8', icon:'🔧' },
    { key:'cases', label:'Cases Enriched',  color:'#a78bfa', icon:'📋' },
    { key:'ppm',   label:'PPM Enriched',    color:'#34d399', icon:'📅' },
  ];
  const chips = tabs.map(t => {
    const loaded = HS.data[t.key].length > 0;
    return `<label style="display:flex;align-items:center;gap:8px;padding:10px 16px;
      background:#0a1628;border:1.5px solid ${loaded ? t.color : '#1e3a5f'};
      border-radius:12px;cursor:pointer;font-size:13px;font-weight:700;
      color:${loaded ? t.color : '#475569'};transition:all .2s;user-select:none">
      <input type="file" accept=".csv" style="display:none"
        onchange="window._app.hsUpload('${t.key}',this.files[0])">
      ${t.icon} ${loaded ? '✓ ' + HS.data[t.key].length.toLocaleString() + ' rows' : '+ ' + t.label}
    </label>`;
  }).join('');

  const allLoaded = HS.data.cwo.length || HS.data.cases.length || HS.data.ppm.length;
  return `
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
    min-height:60vh;padding:40px 20px;gap:24px;text-align:center">
    <div style="font-size:48px">🔥</div>
    <div>
      <div style="font-size:22px;font-weight:800;color:#f1f5f9;margin-bottom:8px">
        Load Enriched Data
      </div>
      <div style="font-size:13px;color:#475569;max-width:400px;line-height:1.7">
        Upload your <code style="color:#38bdf8;background:#0f172a;padding:1px 6px;border-radius:4px">_Enriched.csv</code>
        files from your working folder to begin hotspot analysis.
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${chips}</div>
    ${allLoaded ? `
    <button onclick="window._app.hsGoDashboard()"
      style="padding:12px 28px;border-radius:12px;background:linear-gradient(135deg,#f97316,#dc2626);
      color:#fff;font-size:14px;font-weight:800;border:none;cursor:pointer;
      box-shadow:0 4px 20px #f9731644;font-family:inherit">
      🔥 Open Hotspot Dashboard →
    </button>` : ''}
  </div>`;
}

// ─── Controls bar ─────────────────────────────────────────────────
function controlsHtml(tagged, groups) {
  const dims = [
    { key:'location',    label:'Location'     },
    { key:'eventType',   label:'Event Type'   },
    { key:'problemType', label:'Problem Type' },
    { key:'asset',       label:'Asset'        },
  ];
  const dimBtns = dims.map(d =>
    `<button onclick="window._app.hsSetDim('${d.key}')"
      style="padding:6px 14px;border-radius:8px;border:none;cursor:pointer;font-size:12px;
      font-weight:700;font-family:inherit;
      background:${HS.dim===d.key?'#f97316':'#1e293b'};
      color:${HS.dim===d.key?'#0f172a':'#94a3b8'};transition:all .15s">
      ${d.label}
    </button>`
  ).join('');

  const presetBtns = DATE_PRESETS.map(p => {
    const f = p.from(), t = p.to();
    const active = HS.dateFrom===f && HS.dateTo===t;
    return `<button onclick="window._app.hsPreset('${f}','${t}')"
      style="padding:4px 9px;border-radius:6px;border:1px solid ${active?'#f97316':'#1e3a5f'};
      cursor:pointer;font-size:10px;font-weight:${active?700:500};font-family:inherit;
      background:${active?'#f9731622':'transparent'};
      color:${active?'#f97316':'#475569'};white-space:nowrap">
      ${p.label}
    </button>`;
  }).join('');

  const subTabs = ['table','analytics'].map(id => {
    const labels = { table:'📋 Table', analytics:'📊 Analytics' };
    return `<button onclick="window._app.hsSubTab('${id}')"
      style="padding:6px 16px;border-radius:7px;border:none;cursor:pointer;font-size:12px;
      font-weight:700;font-family:inherit;
      background:${HS.subTab===id?'#f97316':'transparent'};
      color:${HS.subTab===id?'#0f172a':'#64748b'};transition:all .15s">
      ${labels[id]}
    </button>`;
  }).join('');

  const hasDate = HS.dateFrom || HS.dateTo;
  const summary = `${tagged.length.toLocaleString()} records${HS.subTab==='table'?' · '+groups.length+' groups':''}`;

  return `
  <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
    <!-- sub-tabs -->
    <div style="display:flex;gap:3px;background:#080f1a;border-radius:9px;padding:3px;
      border:1px solid #1e293b">${subTabs}</div>

    ${HS.subTab==='table' ? `
    <!-- group-by -->
    <span style="font-size:11px;color:#475569;font-weight:700;margin-left:4px">GROUP BY:</span>
    ${dimBtns}` : ''}

    <!-- date range -->
    <div style="display:flex;align-items:center;gap:5px;background:#080f1a;
      border:1.5px solid ${hasDate?'#f97316':'#1e3a5f'};border-radius:8px;padding:4px 10px;
      box-shadow:${hasDate?'0 0 10px #f9731622':'none'};transition:all .2s">
      <span style="font-size:10px;color:#475569;font-weight:600">From</span>
      <input type="date" value="${HS.dateFrom}"
        onchange="window._app.hsDateFrom(this.value)"
        style="background:none;border:none;color:#e2e8f0;font-size:11px;outline:none;
        font-family:monospace;cursor:pointer">
      <span style="font-size:10px;color:#475569;font-weight:600">To</span>
      <input type="date" value="${HS.dateTo}"
        onchange="window._app.hsDateTo(this.value)"
        style="background:none;border:none;color:#e2e8f0;font-size:11px;outline:none;
        font-family:monospace;cursor:pointer">
      ${hasDate ? `<button onclick="window._app.hsClearDate()"
        style="background:none;border:none;cursor:pointer;color:#f97316;font-size:13px;padding:0 2px;line-height:1">×</button>` : ''}
    </div>

    <!-- quick presets -->
    <div style="display:flex;gap:4px;flex-wrap:wrap">${presetBtns}</div>

    <!-- summary -->
    <span style="margin-left:auto;font-size:11px;color:#475569">
      ${HS.svcFilter!=='ALL'?`<span style="color:${HS.svcFilter==='Hard'?'#38bdf8':'#fb923c'};font-weight:700">${HS.svcFilter} · </span>`:''}
      ${summary}
    </span>
  </div>`;
}

// ─── Grouped table ────────────────────────────────────────────────
function groupedTableHtml(groups) {
  const maxTotal = groups[0]?.total || 1;
  const THRESH = 2;

  const rows = groups.map((row, i) => {
    const isHot = row.total >= THRESH;
    const isExp = HS.expandedKey === row.key;
    const keyEsc = JSON.stringify(row.key).replace(/'/g, "\\'");

    const bar = `<div style="display:flex;gap:1px">
      ${row.CWO  > 0 ? `<div style="height:8px;background:#38bdf8;border-radius:2px 0 0 2px;width:${Math.max(2,row.CWO /maxTotal*100)}px"></div>` : ''}
      ${row.Case > 0 ? `<div style="height:8px;background:#a78bfa;width:${Math.max(2,row.Case/maxTotal*100)}px"></div>` : ''}
      ${row.PPM  > 0 ? `<div style="height:8px;background:#34d399;border-radius:0 2px 2px 0;width:${Math.max(2,row.PPM /maxTotal*100)}px"></div>` : ''}
    </div>`;

    const mainRow = `<tr onclick="window._app.hsToggleDrill(${keyEsc})"
      style="border-top:1px solid #1e293b;cursor:pointer;transition:background .15s;
      background:${isExp?'#0d1f36':isHot&&i===0?'#1a0a0a':'transparent'}"
      onmouseover="if(!${isExp})this.style.background='#0d1f2a'"
      onmouseout="this.style.background='${isExp?'#0d1f36':isHot&&i===0?'#1a0a0a':'transparent'}'">
      <td style="padding:10px 8px 10px 12px;width:22px">
        <span style="font-size:11px;color:${isExp?'#f97316':'#334155'};display:inline-block;
          transition:transform .2s;transform:${isExp?'rotate(90deg)':'none'}">▶</span>
      </td>
      <td style="padding:10px 12px;font-size:10px;color:#475569;font-family:monospace;width:28px">${i+1}</td>
      <td style="padding:10px 12px;font-size:13px;color:${isHot?'#f87171':'#e2e8f0'};font-weight:${isHot?700:400}">
        <span style="display:inline-flex;align-items:center;gap:7px">
          ${isHot&&i===0?'<span>🔥</span>':''}
          ${isHot&&i>0?'<span style="width:7px;height:7px;border-radius:50%;background:#f97316;flex-shrink:0"></span>':''}
          ${row.key}
        </span>
      </td>
      <td style="padding:10px 12px;font-family:monospace;font-size:13px;color:#38bdf8">${row.CWO||0}</td>
      <td style="padding:10px 12px;font-family:monospace;font-size:13px;color:#a78bfa">${row.Case||0}</td>
      <td style="padding:10px 12px;font-family:monospace;font-size:13px;color:#34d399">${row.PPM||0}</td>
      <td style="padding:10px 12px;font-family:monospace;font-size:14px;font-weight:800;color:${isHot?'#f87171':'#e2e8f0'}">${row.total}</td>
      <td style="padding:10px 12px">${bar}</td>
    </tr>`;

    const drillRow = isExp ? `<tr><td colspan="8" style="padding:0;background:#050c18">
      ${drillDownHtml(row)}
    </td></tr>` : '';

    return mainRow + drillRow;
  }).join('');

  const empty = groups.length === 0 ?
    `<tr><td colspan="8" style="text-align:center;padding:40px;color:#334155;font-size:13px">No records match the current filters.</td></tr>` : '';

  return `
  <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#0a1628">
          ${['','#','Group','CWO','Cases','PPM','Total','Distribution'].map(h =>
            `<th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;
            color:#475569;text-transform:uppercase;letter-spacing:1.5px;white-space:nowrap">${h}</th>`
          ).join('')}
        </tr>
      </thead>
      <tbody>${rows}${empty}</tbody>
    </table>
  </div>
  <div style="margin-top:12px;font-size:11px;color:#334155;display:flex;gap:16px;flex-wrap:wrap">
    <span><span style="color:#38bdf8">■</span> CWO</span>
    <span><span style="color:#a78bfa">■</span> Cases</span>
    <span><span style="color:#34d399">■</span> PPM</span>
    <span>🔥 Top hotspot &nbsp;● Other hotspots (≥2)</span>
    <span style="color:#f97316">▶ Click row to expand</span>
  </div>`;
}

// ─── Drill-down sub-table ─────────────────────────────────────────
function drillDownHtml(row) {
  const keyEsc = JSON.stringify(row.key).replace(/'/g, "\\'");
  const srcFilter = HS.drillSrc[row.key] || 'All';
  let records = srcFilter === 'All' ? row.records : row.records.filter(r => r._src === srcFilter);
  records = [...records].sort((a,b) => (b.date||'').localeCompare(a.date||''));

  const srcBtns = ['All','CWO','Case','PPM'].map(s => {
    const cnt    = s === 'All' ? row.records.length : row.records.filter(r => r._src === s).length;
    const active = srcFilter === s;
    const c      = SRC_COLOR[s] || '#f97316';
    return `<button onclick="window._app.hsDrillSrc(${keyEsc},'${s}')"
      style="padding:3px 11px;border-radius:5px;cursor:pointer;font-size:10px;font-weight:700;
      font-family:inherit;border:1px solid ${active?c:'#1e293b'};
      background:${active?c+'22':'transparent'};color:${active?c:'#64748b'};transition:all .15s">
      ${s} (${cnt})
    </button>`;
  }).join('');

  const tableRows = records.slice(0,100).map((r,i) => {
    const acc = SRC_COLOR[r._src] || '#38bdf8';
    const desc = (r.desc || r.eventType || '—').slice(0,80);
    return `<tr style="border-top:1px solid #0f1e30;background:${i%2===0?'transparent':'#060d18'}"
      onmouseover="this.style.background='${acc}11'"
      onmouseout="this.style.background='${i%2===0?'transparent':'#060d18'}'">
      <td style="padding:7px 10px">${srcChipHtml(r._src)}</td>
      <td style="padding:7px 10px;font-size:11px;color:#94a3b8;font-family:monospace;white-space:nowrap">${r.id}</td>
      <td style="padding:7px 10px;font-size:11px;color:#64748b;white-space:nowrap">${r.date||'—'}</td>
      <td style="padding:7px 10px;font-size:11px;color:#94a3b8;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.location}</td>
      <td style="padding:7px 10px;font-size:11px;color:#cbd5e1;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.asset}</td>
      <td style="padding:7px 10px">${badgeHtml(r.status)}</td>
      <td style="padding:7px 10px">${r._src==='PPM'?'<span style="color:#34d399;font-size:11px">'+r._raw.ActualCompletion+'%</span>':priHtml(r.priority)}</td>
      <td style="padding:7px 10px;font-size:11px;color:#64748b;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${desc.replace(/"/g,'&quot;')}">${desc}</td>
    </tr>`;
  }).join('');

  const more = records.length > 100 ?
    `<tr><td colspan="8" style="padding:10px 12px;font-size:11px;color:#475569;text-align:center">
      … and ${(records.length-100).toLocaleString()} more rows. Use filters to narrow down.
    </td></tr>` : '';

  return `
  <div style="margin:0 0 0 28px;border-left:2px solid #1e3a5f;padding:12px 0 12px 16px">
    <div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">
      <span style="font-size:10px;color:#475569;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-right:2px">SOURCE:</span>
      ${srcBtns}
      <span style="margin-left:auto;font-size:10px;color:#334155;font-family:monospace">${records.length} records</span>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;min-width:650px">
        <thead>
          <tr style="background:#081020">
            ${['Source','ID','Date','Location','Asset','Status','Priority','Description'].map(h =>
              `<th style="padding:7px 10px;text-align:left;font-size:9px;font-weight:700;
              color:#475569;text-transform:uppercase;letter-spacing:1.3px;border-bottom:1px solid #1e293b">${h}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>${tableRows}${more}</tbody>
      </table>
    </div>
    <div style="margin-top:8px;font-size:9px;color:#1e3a5f">💡 Showing up to 100 rows · Use Source filter to narrow</div>
  </div>`;
}

// ─── Analytics charts (pure SVG/HTML) ────────────────────────────

function kpiHtml(tagged) {
  const cwo   = tagged.filter(r=>r._src==='CWO').length;
  const cases = tagged.filter(r=>r._src==='Case').length;
  const ppm   = tagged.filter(r=>r._src==='PPM').length;
  const done  = tagged.filter(r=>['Closed','Completed'].includes(r.status)).length;
  const ovd   = tagged.filter(r=>r.status==='Overdue').length;
  const pct   = tagged.length ? Math.round(done/tagged.length*100) : 0;

  const kpis = [
    { label:'Total',   val:tagged.length, color:'#38bdf8', icon:'📊' },
    { label:'CWO',     val:cwo,           color:'#38bdf8', icon:'🔧' },
    { label:'Cases',   val:cases,         color:'#a78bfa', icon:'📋' },
    { label:'PPM',     val:ppm,           color:'#34d399', icon:'📅' },
    { label:'Done',    val:`${done} (${pct}%)`, color:'#10b981', icon:'✅' },
    { label:'Overdue', val:ovd,           color:'#ef4444', icon:'⚠️' },
  ];

  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
    ${kpis.map(k=>`
    <div style="flex:1 1 90px;min-width:90px;background:#0a1628;border:1px solid ${k.color}33;
      border-radius:11px;padding:12px 14px">
      <div style="font-size:16px">${k.icon}</div>
      <div style="font-size:20px;font-weight:800;color:${k.color};font-family:monospace;margin-top:2px">${k.val}</div>
      <div style="font-size:9px;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:2px">${k.label}</div>
    </div>`).join('')}
  </div>`;
}

function hBarChartHtml(title, subtitle, items, color) {
  if (!items.length) return '';
  const max = items[0].value || 1;
  const bars = items.map((item, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
      <div style="width:130px;font-size:11px;color:#94a3b8;text-align:right;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0"
        title="${item.name.replace(/"/g,'&quot;')}">${item.name}</div>
      <div style="flex:1;background:#1e293b;border-radius:3px;height:14px;overflow:hidden">
        <div style="height:100%;background:${i===0?'#f97316':color};border-radius:3px;
          width:${Math.max(2,item.value/max*100)}%;opacity:${1-i*0.05}"></div>
      </div>
      <div style="font-size:11px;color:#64748b;font-family:monospace;width:32px;text-align:right;flex-shrink:0">${item.value}</div>
    </div>`).join('');

  return `<div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:13px;padding:16px 18px">
    <div style="font-size:12px;font-weight:700;color:#f1f5f9;margin-bottom:2px">${title}</div>
    <div style="font-size:10px;color:#475569;margin-bottom:12px">${subtitle}</div>
    ${bars}
  </div>`;
}

function trendChartHtml(tagged) {
  const byMonth = {};
  tagged.forEach(r => {
    const ym = toYM(r.date);
    if (!ym) return;
    if (!byMonth[ym]) byMonth[ym] = { CWO:0, Case:0, PPM:0 };
    byMonth[ym][r._src]++;
  });
  const months = Object.keys(byMonth).sort();
  if (months.length === 0) return '';

  const allVals = months.flatMap(m => [byMonth[m].CWO, byMonth[m].Case, byMonth[m].PPM]);
  const maxV = Math.max(...allVals, 1);
  const W = 560, H = 140, padL = 36, padB = 24, padT = 10, padR = 10;
  const cW = Math.max(1, (W - padL - padR) / months.length);
  const xPos = i => padL + i * cW + cW/2;
  const yPos = v => padT + (H - padT - padB) * (1 - v/maxV);

  const makePath = (key, color) => {
    const pts = months.map((m,i) => `${xPos(i).toFixed(1)},${yPos(byMonth[m][key]).toFixed(1)}`);
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
  };

  const dots = (key, color) => months.map((m,i) =>
    `<circle cx="${xPos(i).toFixed(1)}" cy="${yPos(byMonth[m][key]).toFixed(1)}" r="3" fill="${color}"/>`
  ).join('');

  const xLabels = months.map((m,i) =>
    i % Math.max(1, Math.floor(months.length/6)) === 0
      ? `<text x="${xPos(i).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#475569">${fmtYM(m)}</text>`
      : ''
  ).join('');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct =>
    `<line x1="${padL}" y1="${yPos(maxV*pct).toFixed(1)}" x2="${W-padR}" y2="${yPos(maxV*pct).toFixed(1)}" stroke="#1e293b" stroke-width="0.5"/>
     <text x="${padL-4}" y="${(yPos(maxV*pct)+3).toFixed(1)}" text-anchor="end" font-size="8" fill="#334155">${Math.round(maxV*pct)}</text>`
  ).join('');

  return `<div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:13px;padding:16px 18px;grid-column:1 / -1">
    <div style="font-size:12px;font-weight:700;color:#f1f5f9;margin-bottom:2px">📈 Monthly Trend</div>
    <div style="font-size:10px;color:#475569;margin-bottom:12px">Records created per month by source</div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-height:140px;overflow:visible">
      ${yTicks}
      ${makePath('CWO','#38bdf8')}${makePath('Case','#a78bfa')}${makePath('PPM','#34d399')}
      ${dots('CWO','#38bdf8')}${dots('Case','#a78bfa')}${dots('PPM','#34d399')}
      ${xLabels}
    </svg>
    <div style="display:flex;gap:14px;margin-top:6px">
      ${['CWO:#38bdf8','Case:#a78bfa','PPM:#34d399'].map(s=>{const[l,c]=s.split(':');
        return `<span style="font-size:10px;color:${c};display:flex;align-items:center;gap:4px">
          <span style="display:inline-block;width:18px;height:2px;background:${c};border-radius:1px"></span>${l}</span>`;
      }).join('')}
    </div>
  </div>`;
}

function statusStackHtml(tagged) {
  const sources = ['CWO','Case','PPM'];
  const allStatuses = [...new Set(tagged.map(r=>r.status))];
  const data = sources.map(src => {
    const rows = tagged.filter(r => r._src === src);
    const counts = {};
    rows.forEach(r => { counts[r.status]=(counts[r.status]||0)+1; });
    return { src, total:rows.length, counts };
  });

  const bars = data.map(d => {
    if (!d.total) return `<div style="margin-bottom:8px">
      <div style="font-size:11px;color:#475569;margin-bottom:4px">${d.src}</div>
      <div style="font-size:10px;color:#334155;font-style:italic">No data</div>
    </div>`;
    const segs = allStatuses.map(s => {
      const pct = d.total ? (d.counts[s]||0)/d.total*100 : 0;
      if (!pct) return '';
      const c = STATUS_DOT[s] || '#64748b';
      return `<div title="${s}: ${d.counts[s]||0}" style="height:100%;width:${pct.toFixed(1)}%;background:${c};transition:width .3s"></div>`;
    }).join('');
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;color:${SRC_COLOR[d.src]};font-weight:700">${d.src}</span>
        <span style="font-size:10px;color:#334155;font-family:monospace">${d.total}</span>
      </div>
      <div style="display:flex;height:14px;border-radius:3px;overflow:hidden;background:#1e293b">${segs}</div>
    </div>`;
  }).join('');

  const legend = allStatuses.map(s =>
    `<span style="font-size:10px;color:#94a3b8;display:flex;align-items:center;gap:3px">
      <span style="width:8px;height:8px;border-radius:50%;background:${STATUS_DOT[s]||'#64748b'}"></span>${s}</span>`
  ).join('');

  return `<div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:13px;padding:16px 18px">
    <div style="font-size:12px;font-weight:700;color:#f1f5f9;margin-bottom:2px">🟢 Status Distribution</div>
    <div style="font-size:10px;color:#475569;margin-bottom:14px">Breakdown per source</div>
    ${bars}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">${legend}</div>
  </div>`;
}

function svcMixHtml(tagged) {
  const hard = tagged.filter(r=>r._service==='Hard').length;
  const soft = tagged.filter(r=>r._service==='Soft').length;
  const total = hard + soft || 1;
  const hp = Math.round(hard/total*100), sp = 100-hp;
  return `<div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:13px;padding:16px 18px">
    <div style="font-size:12px;font-weight:700;color:#f1f5f9;margin-bottom:2px">⚙️ Service Mix</div>
    <div style="font-size:10px;color:#475569;margin-bottom:14px">Hard vs Soft classification</div>
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:12px;color:#38bdf8;font-weight:700">⚙️ Hard Service</span>
        <span style="font-size:12px;color:#38bdf8;font-weight:700;font-family:monospace">${hard} (${hp}%)</span>
      </div>
      <div style="height:12px;background:#1e293b;border-radius:6px;overflow:hidden">
        <div style="height:100%;width:${hp}%;background:#38bdf8;border-radius:6px"></div>
      </div>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:12px;color:#fb923c;font-weight:700">🧹 Soft Service</span>
        <span style="font-size:12px;color:#fb923c;font-weight:700;font-family:monospace">${soft} (${sp}%)</span>
      </div>
      <div style="height:12px;background:#1e293b;border-radius:6px;overflow:hidden">
        <div style="height:100%;width:${sp}%;background:#fb923c;border-radius:6px"></div>
      </div>
    </div>
    <div style="font-size:10px;color:#334155;margin-top:10px">Total: ${hard+soft}</div>
  </div>`;
}

function analyticsHtml(tagged) {
  if (!tagged.length) return `<div style="text-align:center;padding:40px;color:#334155;font-size:13px">
    No records to analyse. Adjust your filters.
  </div>`;

  const nonPPM = tagged.filter(r=>r._src!=='PPM');
  const locs   = topN(tagged,  'location',    10);
  const evts   = topN(tagged,  'eventType',   10);
  const probs  = topN(nonPPM,  'problemType', 10);
  const assets = topN(tagged,  'asset',       10);
  const pris   = topN(nonPPM,  'priority',    6);

  return `
  ${kpiHtml(tagged)}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px">
    ${trendChartHtml(tagged)}
    ${hBarChartHtml('📍 Top Locations','Top 10 by total count',locs,'#38bdf8')}
    ${hBarChartHtml('⚡ Top Event Types','Top 10 across all sources',evts,'#a78bfa')}
    ${hBarChartHtml('🔎 Top Problem Types','CWO + Cases only (top 10)',probs,'#f97316')}
    ${hBarChartHtml('🔩 Top Assets','Most affected assets (top 10)',assets,'#34d399')}
    ${statusStackHtml(tagged)}
    ${hBarChartHtml('🔴 Priority Breakdown','CWO + Cases (top 6)',pris,'#fbbf24')}
    ${svcMixHtml(tagged)}
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN RENDER ENTRY
// ═══════════════════════════════════════════════════════════════════
export function renderHotspot() {
  const panel = document.getElementById('hotspotPanel');
  if (!panel) return;

  const hasData = HS.data.cwo.length || HS.data.cases.length || HS.data.ppm.length;

  if (!hasData) {
    panel.innerHTML = `
    <div style="font-family:'DM Sans',sans-serif;color:#e2e8f0;background:#080f1a;
      min-height:60vh;border-radius:16px;padding:24px">
      ${uploadPanelHtml()}
    </div>`;
    return;
  }

  const tagged = getTagged();
  const groups = getGroups(tagged);

  panel.innerHTML = `
  <div style="font-family:'DM Sans',sans-serif;color:#e2e8f0;background:#0f172a;
    border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,.4)">
    <div style="font-size:16px;font-weight:800;color:#f97316;margin-bottom:4px">🔥 Hotspot Analysis</div>
    <div style="font-size:12px;color:#475569;margin-bottom:20px">
      CWO + Cases + PPM grouped by dimension. Table view with drill-down and Analytics charts.
    </div>
    ${controlsHtml(tagged, groups)}
    ${HS.subTab === 'table' ? groupedTableHtml(groups) : analyticsHtml(tagged)}
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API — called by window._app
// ═══════════════════════════════════════════════════════════════════

/** Called when Hotspot tab is activated */
export function initHotspot() {
  loadFromCache();
  renderHotspot();
}

/** Upload handler — called per file input */
export function hsUpload(key, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const result = Papa.parse(e.target.result, { header:true, skipEmptyLines:true });
    const srcMap = { cwo:'CWO', cases:'Case', ppm:'PPM' };
    HS.data[key] = result.data.map(r => mapRow(r, srcMap[key]));
    // Also push into S._enrichedCache so tab chips update
    if (!S._enrichedCache) S._enrichedCache = {};
    S._enrichedCache[key] = result.data;
    renderHotspot();
  };
  reader.readAsText(file);
}

/** After upload — proceed to dashboard */
export function hsGoDashboard() {
  renderHotspot();
}

export function hsSetDim(dim) {
  HS.dim = dim; HS.expandedKey = null; renderHotspot();
}
export function hsSubTab(tab) {
  HS.subTab = tab; renderHotspot();
}
export function hsDateFrom(val) {
  HS.dateFrom = val; HS.expandedKey = null; renderHotspot();
}
export function hsDateTo(val) {
  HS.dateTo = val; HS.expandedKey = null; renderHotspot();
}
export function hsClearDate() {
  HS.dateFrom = ''; HS.dateTo = ''; HS.expandedKey = null; renderHotspot();
}
export function hsPreset(from, to) {
  HS.dateFrom = from; HS.dateTo = to; HS.expandedKey = null; renderHotspot();
}
export function hsSvcFilter(val) {
  HS.svcFilter = val; HS.expandedKey = null; renderHotspot();
}
export function hsToggleDrill(key) {
  HS.expandedKey = HS.expandedKey === key ? null : key; renderHotspot();
}
export function hsDrillSrc(key, src) {
  HS.drillSrc[key] = src; renderHotspot();
}
