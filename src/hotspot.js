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
  drillSort:   {},           // { groupKey: { col, dir } }
  drillFilter: {},           // { groupKey: { colKey: value } }
  colFilterOpen: null,       // 'groupKey::colKey' currently open dropdown
  modalRecord: null,         // record shown in detail modal
  recordCache: {},            // { uid: full record } for modal lookup
  tableSort:   { col:'total', dir:'desc' },  // grouped table sort
  tableSearch: '',                           // grouped table global search
  heatmapTab:  'case',                       // 'case' | 'cwo' | 'ppm'
  heatmapSort: { col: '__total__', dir: 'desc' }, // heatmap column sort
  heatmapDrill: null,  // { rowKey, colKey, records, color } — active cell drill-down
  heatmapDrillSort:   { col: 'date', dir: 'desc' },
  heatmapDrillFilter: {},   // { colKey: value }
  heatmapDrillColOpen: null, // colKey of open filter dropdown
  heatmapSearch: '',         // global search query for heatmap
  patternSrc:    'ALL',      // day-of-week pattern source filter
  patternCatSel: null,       // null = all selected; Set of selected category strings
  repeatView:    'asset',    // repeat offender view: 'asset' | 'location'
  repeatThresh:  3,          // minimum incidents to qualify as repeat offender
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

function classifySvc(r, src) {
  // 1. Trust enriched column produced during CSV enrichment
  if (src === 'PPM'  && r.category)         return r.category.includes('Soft') ? 'Soft' : 'Hard';
  if (src === 'CWO'  && r.cwoMainCat)       return r.cwoMainCat.includes('Soft') ? 'Soft' : 'Hard';
  if (src === 'Case' && r.caseMainCat)      return r.caseMainCat.includes('Soft') ? 'Soft' : 'Hard';
  // 2. Fallback: keyword scan across all text fields
  const hay = [r.asset, r.eventType, r.problemType, r.category, r.desc].join(' ').toLowerCase();
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
  const assetModel  = r.Asset_Model || '';
  const assetGroup  = [
    r.Asset_Name || r.AssetName || r.EquipmentTag || '—',
    r.Asset_Model || '',
    r.Location_FullName || r.Location_Name || r.LocationName || r.Location || '',
  ].filter(Boolean).join(' | ');
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
  // Enriched main-category columns (added during CSV enrichment)
  const cwoMainCat  = r.CWO_Main_Category  || '';
  const caseMainCat = r.Case_Main_Category || '';
  const svc = classifySvc({ asset, eventType, problemType, category, desc, cwoMainCat, caseMainCat }, src);

  // ── Extra fields per source ──
  const assetOpsStatus = r.Asset_OperationalStatus || '';
  // Case extras
  const shortDesc          = r.ShortDescription || '';
  const resolution         = r.Resolution || '';
  // CWO extras
  const pausedReason       = r.PausedReason || '';
  const completionComment  = r.CompletionComment || '';
  const closureComment     = r.ClosureComment || '';
  const clientVerComment   = r.ClientVerificationComment || '';
  const caseRefNo          = r.CaseRefNo || r.CaseReferenceNo || '';
  // PPM extras
  const masterWOTitle      = r.MasterWorkOrderTitle || r.TaskName || '';
  const checklistName      = r.ChecklistName || '';
  const ppmMainCat         = r.PPM_Main_Category || '';
  const ppmTaskCat         = r.PPM_Task_Category || '';
  const statusLabel        = r.Status_Label || '';
  const locationCustom     = r.Location_Custom || '';

  return { id, date, location, eventType, problemType, asset, assetGroup, assetModel,
    assetOpsStatus, priority, status, desc, category, _service:svc, _src:src, _raw:raw,
    shortDesc, resolution,
    pausedReason, completionComment, closureComment, clientVerComment, caseRefNo,
    masterWOTitle, checklistName, ppmMainCat, ppmTaskCat, statusLabel, locationCustom };
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
    const key = (HS.dim === 'asset' ? r.assetGroup : r[HS.dim]) || '—';
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

  const subTabs = ['table','analytics','patterns','repeat'].map(id => {
    const labels = { table:'📋 Table', analytics:'📊 Analytics', patterns:'📅 Patterns', repeat:'🔁 Repeat' };
    return `<button onclick="window._app.hsSubTab('${id}')"
      style="padding:6px 16px;border-radius:7px;border:none;cursor:pointer;font-size:12px;
      font-weight:700;font-family:inherit;
      background:${HS.subTab===id?'#f97316':'transparent'};
      color:${HS.subTab===id?'#0f172a':'#64748b'};transition:all .15s">
      ${labels[id]}
    </button>`;
  }).join('');

  const hard = [...HS.data.cwo, ...HS.data.cases, ...HS.data.ppm].filter(r => r._service === 'Hard').length;
  const soft = [...HS.data.cwo, ...HS.data.cases, ...HS.data.ppm].filter(r => r._service === 'Soft').length;
  const all  = hard + soft;

  const hasDate = HS.dateFrom || HS.dateTo;
  const summary = `${tagged.length.toLocaleString()} records${HS.subTab==='table'?' · '+groups.length+' groups':''}`;

  const svcBtns = [
    { val:'ALL',  label:'🌐 All Services',  count: all,  color:'#e2e8f0' },
    { val:'Hard', label:'⚙️ Hard Service',  count: hard, color:'#38bdf8' },
    { val:'Soft', label:'🧹 Soft Service',  count: soft, color:'#fb923c' },
  ].map(b => {
    const active = HS.svcFilter === b.val;
    return `<button onclick="window._app.hsSvcFilter('${b.val}')"
      style="display:inline-flex;align-items:center;gap:7px;padding:7px 18px;border-radius:20px;
      cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;transition:all .15s;
      border:1.5px solid ${active ? b.color : '#1e3a5f'};
      background:${active ? b.color + '22' : 'transparent'};
      color:${active ? b.color : '#475569'}">
      ${b.label}
      <span style="font-size:10px;opacity:.7;font-family:monospace">${b.count.toLocaleString()}</span>
    </button>`;
  }).join('');

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

    <!-- record summary -->
    <span style="margin-left:auto;font-size:11px;color:#475569">${summary}</span>
  </div>

  <!-- Service filter bar -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
    <span style="font-size:11px;color:#475569;font-weight:700;letter-spacing:1px;text-transform:uppercase">SERVICE:</span>
    ${svcBtns}
  </div>`;
}

// ─── Grouped table ────────────────────────────────────────────────
function groupedTableHtml(groups) {
  // ── Search filter — scans inside records across key fields ──
  const q = (HS.tableSearch || '').trim().toLowerCase();
  const filtered = q
    ? groups.filter(row => {
        // First check group name itself
        if (row.key.toLowerCase().includes(q)) return true;
        // Then scan individual records
        return row.records.some(r => [
          r.id, r.desc, r.asset, r.location, r.eventType,
          r.problemType, r.priority, r.status, r._src,
        ].some(v => v && String(v).toLowerCase().includes(q)));
      })
    : groups;

  // ── Sort ──
  const { col, dir } = HS.tableSort;
  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    if (col === 'group') {
      av = (a.key || '').toLowerCase();
      bv = (b.key || '').toLowerCase();
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    av = col === 'cwo' ? a.CWO : col === 'case' ? a.Case : col === 'ppm' ? a.PPM : a.total;
    bv = col === 'cwo' ? b.CWO : col === 'case' ? b.Case : col === 'ppm' ? b.PPM : b.total;
    return dir === 'asc' ? av - bv : bv - av;
  });

  const maxTotal = (groups[0]?.total) || 1;
  const THRESH = 2;

  // ── Sort header helper ──
  const thSort = (label, key, align='left') => {
    const active = col === key;
    const icon   = active ? (dir === 'asc' ? '↑' : '↓') : '↕';
    return `<th onclick='window._app.hsTableSort("${key}")'
      style="padding:9px 12px;text-align:${align};font-size:10px;font-weight:700;
      text-transform:uppercase;letter-spacing:1.5px;white-space:nowrap;cursor:pointer;
      user-select:none;color:${active?'#f97316':'#475569'};
      border-bottom:${active?'2px solid #f97316':'2px solid transparent'};
      transition:color .15s">
      ${label} <span style="font-size:9px;opacity:.7">${icon}</span>
    </th>`;
  };

  const rows = sorted.map((row, i) => {
    const isHot = row.total >= THRESH;
    const isExp = HS.expandedKey === row.key;
    const keyEsc = JSON.stringify(row.key).replace(/'/g, "\\'");

    const bar = `<div style="display:flex;gap:1px">
      ${row.CWO  > 0 ? `<div style="height:8px;background:#38bdf8;border-radius:2px 0 0 2px;width:${Math.max(2,row.CWO /maxTotal*100)}px"></div>` : ''}
      ${row.Case > 0 ? `<div style="height:8px;background:#a78bfa;width:${Math.max(2,row.Case/maxTotal*100)}px"></div>` : ''}
      ${row.PPM  > 0 ? `<div style="height:8px;background:#34d399;border-radius:0 2px 2px 0;width:${Math.max(2,row.PPM /maxTotal*100)}px"></div>` : ''}
    </div>`;

    const mainRow = `<tr onclick='window._app.hsToggleDrill(${keyEsc})'
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
      ${drillDownHtml(row, q)}
    </td></tr>` : '';

    return mainRow + drillRow;
  }).join('');

  const empty = sorted.length === 0
    ? `<tr><td colspan="8" style="text-align:center;padding:40px;color:#334155;font-size:13px">
        ${q ? `No groups match "<span style="color:#f97316">${q}</span>"` : 'No records match the current filters.'}
      </td></tr>` : '';

  const matchInfo = q
    ? `<span style="color:#f97316;font-weight:700">${sorted.length}</span> of ${groups.length} groups`
    : `${groups.length} groups`;

  return `
  <!-- Global Search -->
  <div style="position:relative;margin-bottom:12px;display:flex;gap:8px">
    <div style="position:relative;flex:1">
      <span style="position:absolute;left:13px;top:50%;transform:translateY(-50%);
        font-size:14px;color:#334155;pointer-events:none">⌕</span>
      <input id="hsSearchInput" type="text" value="${(HS.tableSearch||'').replace(/"/g,'&quot;')}"
        onkeydown="if(event.key==='Enter')window._app.hsTableSearch(this.value)"
        placeholder="Search all groups… (press Enter)"
        style="width:100%;box-sizing:border-box;padding:9px 36px 9px 36px;
        background:#080f1a;border:1.5px solid ${q?'#f97316':'#1e3a5f'};
        border-radius:10px;color:#e2e8f0;font-size:13px;outline:none;
        font-family:'DM Sans',sans-serif;transition:border-color .2s">
      ${q ? `<button onclick="window._app.hsTableSearch('');document.getElementById('hsSearchInput').value=''"
        style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
        background:none;border:none;cursor:pointer;color:#f97316;font-size:16px;
        line-height:1;font-family:inherit">×</button>` : ''}
    </div>
    <button onclick="window._app.hsTableSearch(document.getElementById('hsSearchInput').value)"
      style="padding:9px 18px;border-radius:10px;border:1.5px solid #f97316;
      background:${q?'#f97316':'transparent'};color:${q?'#0f172a':'#f97316'};
      font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
      white-space:nowrap;transition:all .15s">
      Search
    </button>
  </div>

  <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#0a1628">
          <th style="padding:9px 12px;width:22px"></th>
          <th style="padding:9px 12px;font-size:10px;font-weight:700;color:#475569;
            text-transform:uppercase;letter-spacing:1.5px;width:28px">#</th>
          ${thSort('Group',        'group', 'left')}
          ${thSort('CWO',          'cwo',   'left')}
          ${thSort('Cases',        'case',  'left')}
          ${thSort('PPM',          'ppm',   'left')}
          ${thSort('Total',        'total', 'left')}
          <th style="padding:9px 12px;font-size:10px;font-weight:700;color:#475569;
            text-transform:uppercase;letter-spacing:1.5px">Distribution</th>
        </tr>
      </thead>
      <tbody>${rows}${empty}</tbody>
    </table>
  </div>
  <div style="margin-top:12px;font-size:11px;color:#334155;display:flex;gap:16px;flex-wrap:wrap;align-items:center">
    <span><span style="color:#38bdf8">■</span> CWO</span>
    <span><span style="color:#a78bfa">■</span> Cases</span>
    <span><span style="color:#34d399">■</span> PPM</span>
    <span>🔥 Top hotspot &nbsp;● Other hotspots (≥2)</span>
    <span style="margin-left:auto;color:#475569">${matchInfo}</span>
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

// ─── Generic heatmap builder: rows=rowLabel, cols=colLabel, data=filtered records ──
function buildHeatmap(records, rowFn, colFn, rowLabel, colLabel, color, maxRows=20, maxCols=15) {
  if (!records.length) return `<div style="text-align:center;padding:24px;color:#334155;font-size:13px">No data for this filter.</div>`;

  // Count matrix
  const matrix = {};
  const colCounts = {};
  records.forEach(r => {
    const row = rowFn(r) || '—';
    const col = colFn(r) || '—';
    if (!matrix[row]) matrix[row] = {};
    matrix[row][col] = (matrix[row][col] || 0) + 1;
    colCounts[col] = (colCounts[col] || 0) + 1;
  });

  // Top cols by total
  const topCols = Object.entries(colCounts).sort((a,b)=>b[1]-a[1]).slice(0,maxCols).map(([k])=>k);

  // Row totals
  const rowTotals = Object.entries(matrix).map(([k, v]) => [k, Object.values(v).reduce((a,b)=>a+b,0)]);

  // Apply sort
  const { col: sortCol, dir: sortDir } = HS.heatmapSort;
  const sorted = [...rowTotals].sort((a, b) => {
    let av, bv;
    if (sortCol === '__total__') {
      av = a[1]; bv = b[1];
    } else if (sortCol === '__row__') {
      av = a[0].toLowerCase(); bv = b[0].toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    } else {
      av = (matrix[a[0]] || {})[sortCol] || 0;
      bv = (matrix[b[0]] || {})[sortCol] || 0;
    }
    return sortDir === 'asc' ? av - bv : bv - av;
  });
  const topRows = sorted.slice(0, maxRows).map(([k]) => k);

  if (!topRows.length || !topCols.length) return `<div style="text-align:center;padding:24px;color:#334155;font-size:13px">No data.</div>`;

  // Per-column max for independent color scaling
  const colMax = {};
  topCols.forEach(c => { colMax[c] = Math.max(1, ...topRows.map(r => (matrix[r]||{})[c]||0)); });

  const cellBg = (col, val) => {
    if (!val) return 'transparent';
    const t = val / colMax[col];
    const alpha = Math.round(20 + t * 210).toString(16).padStart(2,'0');
    return color + alpha;
  };

  // Sort icon helper
  const sortIcon = (key) => {
    if (sortCol !== key) return `<span style="font-size:8px;opacity:.35;margin-left:2px">↕</span>`;
    return `<span style="font-size:8px;margin-left:2px;color:${color}">${sortDir === 'asc' ? '↑' : '↓'}</span>`;
  };

  // Row label header (clickable)
  const thRow = `<th onclick='window._app.hsHeatmapSort("__row__")'
    style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;
    color:${sortCol==='__row__'?color:'#475569'};text-transform:uppercase;letter-spacing:.8px;
    border-bottom:2px solid ${sortCol==='__row__'?color:'#1e293b'};cursor:pointer;user-select:none;
    white-space:nowrap">
    ${rowLabel} ${sortIcon('__row__')}
  </th>`;

  // Column headers (clickable)
  const thCols = topCols.map(c => {
    const active = sortCol === c;
    const label  = c.length > 14 ? c.slice(0, 13) + '…' : c;
    return `<th onclick='window._app.hsHeatmapSort(${JSON.stringify(c)})'
      style="padding:6px 8px;font-size:9px;font-weight:700;
      color:${active ? color : '#475569'};
      text-transform:uppercase;letter-spacing:.8px;white-space:nowrap;
      max-width:110px;overflow:hidden;text-overflow:ellipsis;text-align:center;
      border-bottom:2px solid ${active ? color : '#1e293b'};
      cursor:pointer;user-select:none;transition:color .15s"
      title="${c.replace(/"/g,'&quot;')}">
      ${label} ${sortIcon(c)}
    </th>`;
  }).join('');

  // Total header (clickable)
  const thTotal = `<th onclick='window._app.hsHeatmapSort("__total__")'
    style="padding:6px 10px;font-size:9px;font-weight:700;
    color:${sortCol==='__total__'?color:'#475569'};
    text-transform:uppercase;letter-spacing:.8px;text-align:right;
    border-bottom:2px solid ${sortCol==='__total__'?color:'#1e293b'};
    cursor:pointer;user-select:none;white-space:nowrap">
    Total ${sortIcon('__total__')}
  </th>`;

  const drill = HS.heatmapDrill;

  const dataRows = topRows.map((row, i) => {
    const rowTotal = topCols.reduce((s,c)=>s+((matrix[row]||{})[c]||0),0);
    const cells = topCols.map(col => {
      const v = (matrix[row]||{})[col] || 0;
      const isActiveCol = sortCol === col;
      const isDrillActive = drill && drill.rowKey === row && drill.colKey === col;
      const clickable = v > 0;
      return `<td onclick='${clickable ? `window._app.hsHeatmapDrill(${JSON.stringify(row)},${JSON.stringify(col)})` : ''}'
        style="padding:5px 8px;text-align:center;font-size:11px;font-weight:${v?700:400};
        font-family:monospace;color:${v?color:'#1e3a5f'};background:${isDrillActive?color+'88':cellBg(col,v)};
        border-radius:3px;white-space:nowrap;
        cursor:${clickable?'pointer':'default'};
        outline:${isDrillActive?`2px solid ${color}`:(isActiveCol?`1px solid ${color}44`:'none')};
        transition:all .1s"
        ${clickable?`onmouseover="this.style.outline='2px solid ${color}'" onmouseout="this.style.outline='${isDrillActive?`2px solid ${color}`:(isActiveCol?`1px solid ${color}44`:'none')}'"`:''}>
        ${v||'·'}</td>`;
    }).join('');
    const isTotalSort = sortCol === '__total__';
    return `<tr style="border-top:1px solid #0a1628">
      <td style="padding:5px 10px;font-size:11px;white-space:nowrap;max-width:200px;
        overflow:hidden;text-overflow:ellipsis;
        color:${i===0?'#f87171':i<3?'#f97316':'#94a3b8'};font-weight:${i<3?700:400}"
        title="${row.replace(/"/g,'&quot;')}">
        ${i===0?'🔥 ':''}${row.length>28?row.slice(0,27)+'…':row}
      </td>
      ${cells}
      <td style="padding:5px 10px;font-family:monospace;font-size:11px;font-weight:700;
        color:${color};text-align:right;
        background:${isTotalSort?color+'11':'transparent'}">${rowTotal}</td>
    </tr>`;
  }).join('');

  // ── Drill panel ──
  let drillPanel = '';
  if (drill && drill.color === color) {
    const DCOLS = [
      { key:'_src',        label:'Source',       sortable:true,  filterable:true  },
      { key:'id',          label:'ID',           sortable:true,  filterable:false },
      { key:'date',        label:'Date',         sortable:true,  filterable:false },
      { key:'location',    label:'Location',     sortable:true,  filterable:true  },
      { key:'asset',       label:'Asset',        sortable:true,  filterable:true  },
      { key:'status',      label:'Status',       sortable:true,  filterable:true  },
      { key:'priority',    label:'Priority',     sortable:true,  filterable:true  },
      { key:'_cat',        label:'Event/Problem',sortable:true,  filterable:true  },
      { key:'desc',        label:'Description',  sortable:false, filterable:false },
    ];

    const ds   = HS.heatmapDrillSort;
    const df   = HS.heatmapDrillFilter;
    const dco  = HS.heatmapDrillColOpen;
    const PRI  = { Critical:0, High:1, Medium:2, Low:3 };

    // Map _cat field
    const withCat = drill.records.map(r => ({
      ...r,
      _cat: r.eventType || r.problemType || r.ppmTaskCat || '—',
    }));

    // Apply column filters
    let filtered = withCat;
    Object.entries(df).forEach(([k, v]) => {
      if (!v || v === 'All') return;
      filtered = filtered.filter(r => String(r[k] || '') === v);
    });

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (ds.col === 'priority') {
        const av = PRI[a.priority] ?? 9, bv = PRI[b.priority] ?? 9;
        return ds.dir === 'asc' ? av - bv : bv - av;
      }
      const av = String(a[ds.col] ?? '').toLowerCase();
      const bv = String(b[ds.col] ?? '').toLowerCase();
      return ds.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    const activeFilters = Object.values(df).filter(v => v && v !== 'All').length;

    // Filter values per column
    const fVals = {};
    DCOLS.filter(c => c.filterable).forEach(c => {
      fVals[c.key] = [...new Set(withCat.map(r => String(r[c.key] || '')).filter(Boolean))].sort();
    });

    // Header cells
    const thCells = DCOLS.map(c => {
      const isSorted  = ds.col === c.key;
      const hasFilter = df[c.key] && df[c.key] !== 'All';
      const accent    = color;
      const colColor  = (isSorted || hasFilter) ? accent : '#475569';
      const sortIcon  = isSorted ? (ds.dir === 'asc' ? '↑' : '↓') : '↕';

      const sortSpan = c.sortable
        ? `<span onclick="window._app.hsHeatmapDrillSort('${c.key}')"
            style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;
            padding:2px 4px;border-radius:4px;background:${isSorted?accent+'14':'transparent'}">
            ${c.label}
            <span style="font-size:9px;color:${isSorted?accent:'#334155'}">${sortIcon}</span>
          </span>`
        : `<span style="padding:2px 4px">${c.label}</span>`;

      let filterBtn = '';
      if (c.filterable) {
        const isOpen = dco === c.key;
        const cur    = df[c.key] || 'All';
        const dot    = hasFilter ? '●' : '⌄';
        const items  = ['All', ...fVals[c.key]].map(v =>
          `<div onclick="window._app.hsHeatmapDrillColFilter('${c.key}',${JSON.stringify(v)});event.stopPropagation()"
            style="padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;
            font-weight:${v===cur?700:400};color:${v===cur?accent:'#cbd5e1'};
            background:${v===cur?'#1e293b':'transparent'}"
            onmouseover="if(this.style.background!=='#1e293b')this.style.background='#1e293b'"
            onmouseout="if('${v}'!=='${cur}')this.style.background='transparent'">${v}</div>`
        ).join('');
        const dropdown = isOpen
          ? `<div style="position:absolute;top:100%;left:0;z-index:999;background:#0f172a;
              border:1px solid #334155;border-radius:10px;padding:6px;min-width:160px;
              box-shadow:0 16px 40px rgba(0,0,0,.6);max-height:260px;overflow-y:auto">
              ${items}</div>` : '';
        filterBtn = `<span style="position:relative;display:inline-block">
          <button onclick="window._app.hsHeatmapDrillColOpen('${c.key}');event.stopPropagation()"
            style="background:none;border:none;cursor:pointer;padding:0 2px;
            color:${hasFilter?accent:'#475569'};font-size:12px;font-family:inherit"
            title="Filter ${c.label}">${dot}</button>
          ${dropdown}
        </span>`;
      }

      return `<th style="padding:7px 10px;text-align:left;font-size:9px;font-weight:700;
        text-transform:uppercase;letter-spacing:1.2px;white-space:nowrap;user-select:none;
        color:${colColor};border-bottom:1px solid ${isSorted?accent+'44':'#1e293b'}">
        <span style="display:inline-flex;align-items:center;gap:4px">${sortSpan}${filterBtn}</span>
      </th>`;
    }).join('');

    const drillRows = filtered.slice(0, 200).map((r, i) => {
      const uid = (r._src + '_' + (r.id || i)).replace(/[^a-zA-Z0-9_-]/g, '_');
      HS.recordCache[uid] = r;
      const acc = SRC_COLOR[r._src] || color;
      return `<tr onclick='window._app.hsOpenModal("${uid}")'
        style="border-top:1px solid #0f1e30;cursor:pointer;background:${i%2===0?'transparent':'#060d18'};transition:background .1s"
        onmouseover="this.style.background='${acc}11'"
        onmouseout="this.style.background='${i%2===0?'transparent':'#060d18'}'">
        <td style="padding:7px 10px">${srcChipHtml(r._src)}</td>
        <td style="padding:7px 10px;font-size:11px;color:#94a3b8;font-family:monospace;white-space:nowrap">${r.id||'—'}</td>
        <td style="padding:7px 10px;font-size:11px;color:#64748b;white-space:nowrap">${r.date||'—'}</td>
        <td style="padding:7px 10px;font-size:11px;color:#94a3b8;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.location||'—'}</td>
        <td style="padding:7px 10px;font-size:11px;color:#cbd5e1;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.asset||'—'}</td>
        <td style="padding:7px 10px">${badgeHtml(r.status)}</td>
        <td style="padding:7px 10px">${priHtml(r.priority)}</td>
        <td style="padding:7px 10px;font-size:11px;color:#94a3b8;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r._cat||'—'}</td>
        <td style="padding:7px 10px;font-size:11px;color:#64748b;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${(r.desc||'').replace(/"/g,'&quot;')}">${(r.desc||'—').slice(0,80)}</td>
      </tr>`;
    }).join('');

    const more = filtered.length > 200
      ? `<tr><td colspan="9" style="text-align:center;padding:8px;font-size:11px;color:#475569">… and ${filtered.length-200} more</td></tr>` : '';
    const noRows = filtered.length === 0
      ? `<tr><td colspan="9" style="text-align:center;padding:20px;color:#334155;font-size:13px">No records match filters.</td></tr>` : '';

    const resetBtn = (activeFilters > 0)
      ? `<button onclick="window._app.hsHeatmapDrillReset()"
          style="padding:4px 10px;border-radius:6px;border:1px solid #f87171;background:#1a0a0a;
          color:#f87171;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">✕ Reset filters</button>` : '';

    drillPanel = `
    <div style="margin-top:16px;border:1px solid ${color}44;border-radius:12px;overflow:hidden">
      <div style="background:${color}11;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:700;color:${color}">
            📋 ${filtered.length}${activeFilters?'/'+drill.records.length:''} records
          </span>
          <span style="font-size:11px;color:#475569">${drill.rowKey} &nbsp;×&nbsp; ${drill.colKey}</span>
          ${activeFilters?`<span style="font-size:11px;color:${color};font-weight:700">${activeFilters} filter${activeFilters>1?'s':''} active</span>`:''}
          ${resetBtn}
        </div>
        <button onclick="window._app.hsHeatmapDrillClose()"
          style="background:none;border:1px solid #334155;border-radius:8px;padding:4px 12px;
          color:#64748b;font-size:11px;cursor:pointer;font-family:inherit">✕ Close</button>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:800px">
          <thead><tr style="background:#081020">${thCells}</tr></thead>
          <tbody>${drillRows}${noRows}${more}</tbody>
        </table>
      </div>
      <div style="padding:8px 16px;font-size:10px;color:#1e3a5f">
        ↑↓ Click column to sort &nbsp;⌄ Column filter &nbsp;💡 Click row for full detail
      </div>
    </div>`;
  }

  const svcNote = HS.svcFilter !== 'ALL'
    ? `<span style="color:${HS.svcFilter==='Hard'?'#38bdf8':'#fb923c'};font-weight:700;margin-left:8px">· ${HS.svcFilter} Service filter active</span>` : '';

  return `
  <div style="overflow-x:auto">
    <div style="font-size:10px;color:#475569;margin-bottom:8px">
      ${records.length.toLocaleString()} records · Top ${topRows.length} ${rowLabel}s × Top ${topCols.length} ${colLabel}s · Click any header to sort · Click any cell to drill down${svcNote}
    </div>
    <table style="width:100%;border-collapse:separate;border-spacing:2px;min-width:500px">
      <thead>
        <tr style="background:#050c18">
          ${thRow}${thCols}${thTotal}
        </tr>
      </thead>
      <tbody>${dataRows}</tbody>
    </table>
  </div>
  ${drillPanel}`;
}

function heatmapHtml(tagged) {
  const tab = HS.heatmapTab || 'case';
  const sq  = (HS.heatmapSearch || '').trim().toLowerCase();

  const applyFilter = (src) => {
    let base = tagged.filter(r => r._src === src);
    if (sq) base = base.filter(r => [
      r.id, r.desc, r.asset, r.location, r.eventType,
      r.problemType, r.ppmTaskCat, r.priority, r.status,
      r.locationCustom, r.category,
    ].some(v => v && String(v).toLowerCase().includes(sq)));
    return base;
  };

  const tabs = [
    { key:'case', label:'📋 Case', color:'#a78bfa' },
    { key:'cwo',  label:'🔧 CWO',  color:'#38bdf8' },
    { key:'ppm',  label:'📅 PPM',  color:'#34d399' },
  ];

  const tabBtns = tabs.map(t => {
    const active = tab === t.key;
    return `<button onclick="window._app.hsHeatmapTab('${t.key}')"
      style="padding:6px 16px;border-radius:7px;border:none;cursor:pointer;font-size:12px;
      font-weight:700;font-family:inherit;transition:all .15s;
      background:${active?t.color+'33':'transparent'};
      color:${active?t.color:'#475569'};
      border-bottom:${active?`2px solid ${t.color}`:'2px solid transparent'}">
      ${t.label}
    </button>`;
  }).join('');

  let heatContent = '';
  if (tab === 'case') {
    const records = applyFilter('Case');
    heatContent = buildHeatmap(
      records,
      r => r.location,     // row = Location_FullName
      r => r.eventType,    // col = EventType_Description
      'Location', 'Event Type', '#a78bfa'
    );
  } else if (tab === 'cwo') {
    const records = applyFilter('CWO');
    heatContent = buildHeatmap(
      records,
      r => r.location,     // row = Location_FullName
      r => r.problemType,  // col = ProblemType_Name
      'Location', 'Problem Type', '#38bdf8'
    );
  } else {
    const records = applyFilter('PPM');
    heatContent = buildHeatmap(
      records,
      r => r.locationCustom || r.location,  // row = Location_Custom
      r => r.ppmTaskCat || r.category,      // col = PPM_Task_Category
      'Location (Custom)', 'Task Category', '#34d399'
    );
  }

  const searchBar = `
  <div style="display:flex;gap:8px;margin-bottom:14px">
    <div style="position:relative;flex:1">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);
        font-size:14px;color:#334155;pointer-events:none">⌕</span>
      <input id="hsHeatmapSearchInput" type="text"
        value="${(HS.heatmapSearch||'').replace(/"/g,'&quot;')}"
        onkeydown="if(event.key==='Enter')window._app.hsHeatmapSearch(this.value)"
        placeholder="Search transactions in this tab… (press Enter)"
        style="width:100%;box-sizing:border-box;padding:8px 36px 8px 34px;
        background:#050c18;border:1.5px solid ${sq?'#f97316':'#1e3a5f'};
        border-radius:9px;color:#e2e8f0;font-size:12px;outline:none;
        font-family:'DM Sans',sans-serif;transition:border-color .2s">
      ${sq ? `<button onclick="window._app.hsHeatmapSearch('');document.getElementById('hsHeatmapSearchInput').value=''"
        style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
        background:none;border:none;cursor:pointer;color:#f97316;font-size:16px;
        line-height:1;font-family:inherit">×</button>` : ''}
    </div>
    <button onclick="window._app.hsHeatmapSearch(document.getElementById('hsHeatmapSearchInput').value)"
      style="padding:8px 16px;border-radius:9px;border:1.5px solid #f97316;
      background:${sq?'#f97316':'transparent'};color:${sq?'#0f172a':'#f97316'};
      font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;
      white-space:nowrap;transition:all .15s">Search</button>
  </div>`;

  return `
  <div style="background:#080f1a;border:1px solid #1e293b;border-radius:14px;
    padding:20px;margin-bottom:16px">
    <div style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:10px">
        🗺️ Location × Category Heatmap
      </div>
      <!-- heatmap sub-tabs -->
      <div style="display:inline-flex;gap:2px;background:#050c18;border-radius:9px;padding:3px;
        border:1px solid #1e293b">
        ${tabBtns}
      </div>
    </div>
    ${searchBar}
    ${heatContent}
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
  ${heatmapHtml(tagged)}
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

// ─── Day-of-week Patterns ────────────────────────────────────────────────────

// ─── Day-of-week Patterns ────────────────────────────────────────────────────

function patternsHtml(tagged) {
  if (!tagged.length) return `<div style="text-align:center;padding:40px;color:#334155;font-size:13px">No records to analyse.</div>`;

  const src      = HS.patternSrc || 'ALL';
  const srcColor = { ALL:'#f97316', CWO:'#38bdf8', Case:'#a78bfa', PPM:'#34d399' };
  const color    = srcColor[src];

  // Category field per source
  const CAT_FIELD = { CWO:'problemType', Case:'eventType', PPM:'ppmTaskCat' };
  const CAT_LABEL = { CWO:'Problem Type', Case:'Event Type', PPM:'Task Category' };

  // Source-filtered records (before category filter)
  const srcRows = src === 'ALL' ? tagged : tagged.filter(r => r._src === src);

  // Available categories for current source
  let availCats = [];
  if (src !== 'ALL') {
    const field = CAT_FIELD[src];
    availCats = [...new Set(srcRows.map(r => r[field] || '—').filter(Boolean))].sort();
  }

  // Resolve selected set — null means all selected
  const selSet = HS.patternCatSel; // null = all selected; Set = explicit selection
  const isAllSel = selSet === null; // only null means "all selected"

  // Apply category filter
  let rows = srcRows;
  if (src !== 'ALL' && selSet !== null) {
    const field = CAT_FIELD[src];
    rows = srcRows.filter(r => selSet.has(r[field] || '—'));
  }

  // Source filter buttons
  const srcBtns = ['ALL','CWO','Case','PPM'].map(s => {
    const cnt = s === 'ALL' ? tagged.length : tagged.filter(r => r._src === s).length;
    const c   = srcColor[s];
    const active = src === s;
    return `<button onclick="window._app.hsPatternSrc('${s}')"
      style="padding:5px 14px;border-radius:8px;border:1.5px solid ${active?c:'#1e293b'};
      background:${active?c+'22':'transparent'};color:${active?c:'#64748b'};
      font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s">
      ${s} <span style="opacity:.65;font-family:monospace">(${cnt.toLocaleString()})</span>
    </button>`;
  }).join('');

  // Category filter bar (only shown when a specific source is active)
  let catBar = '';
  if (src !== 'ALL' && availCats.length > 0) {
    const catBtns = availCats.map(cat => {
      const active = selSet === null || selSet.has(cat);
      const safecat = cat.replace(/'/g, "\\'");
      return `<button onclick='window._app.hsPatternCatToggle("${safecat}")'
        style="padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;
        font-family:inherit;cursor:pointer;transition:all .12s;white-space:nowrap;
        border:1.5px solid ${active?color:'#1e3a5f'};
        background:${active?color+'22':'transparent'};
        color:${active?color:'#334155'}">
        ${cat.length > 22 ? cat.slice(0,21)+'…' : cat}
      </button>`;
    }).join('');

    const numSel = selSet === null ? availCats.length : selSet.size;
    catBar = `
    <div style="background:#080f1a;border:1px solid #1e293b;border-radius:10px;padding:10px 14px;margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">
          ${CAT_LABEL[src]}:
        </span>
        <span style="font-size:10px;color:${color};font-family:monospace">${numSel}/${availCats.length} selected</span>
        <button onclick="window._app.hsPatternCatAll()"
          style="padding:2px 9px;border-radius:5px;border:1px solid #1e3a5f;background:transparent;
          color:#64748b;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">Select all</button>
        <button onclick="window._app.hsPatternCatNone()"
          style="padding:2px 9px;border-radius:5px;border:1px solid #1e3a5f;background:transparent;
          color:#64748b;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">Deselect all</button>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">${catBtns}</div>
    </div>`;
  }

  // Build day × hour matrix
  const DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const HOURS = Array.from({length:24}, (_,i) => i);

  const matrix = {};
  DAYS.forEach(d => { matrix[d] = {}; HOURS.forEach(h => { matrix[d][h] = 0; }); });

  let peakVal = 0, peakDay = '', peakHour = 0;

  rows.forEach(r => {
    if (!r.date) return;
    const raw = r._raw || {};
    const dt  = new Date(raw.CreatedOn || raw.PlannedDate || raw.ScheduledDate || r.date || '');
    if (isNaN(dt)) return;
    const dayIdx = (dt.getDay() + 6) % 7;
    const hour   = dt.getHours();
    const d = DAYS[dayIdx];
    matrix[d][hour]++;
    if (matrix[d][hour] > peakVal) { peakVal = matrix[d][hour]; peakDay = d; peakHour = hour; }
  });

  const dayTotals  = DAYS.map(d => ({ d, total: HOURS.reduce((s,h) => s + matrix[d][h], 0) }));
  const maxDayTotal = Math.max(1, ...dayTotals.map(x => x.total));
  const overallMax  = Math.max(1, peakVal);

  const cellBg = val => {
    if (!val) return 'transparent';
    const t = val / overallMax;
    const alpha = Math.round(20 + t * 215).toString(16).padStart(2,'0');
    return color + alpha;
  };

  const hourLabels = HOURS.map(h =>
    `<th style="padding:3px 2px;font-size:9px;color:#334155;font-weight:400;text-align:center;min-width:22px">${h === 0 ? '0' : h % 2 === 0 ? h : ''}</th>`
  ).join('');

  const heatRows = DAYS.map(d => {
    const cells = HOURS.map(h => {
      const v = matrix[d][h];
      const isPeak = d === peakDay && h === peakHour && v > 0;
      return `<td style="padding:2px;text-align:center">
        <div style="border-radius:3px;width:22px;height:22px;background:${cellBg(v)};
          display:flex;align-items:center;justify-content:center;margin:auto;
          font-size:8px;font-weight:700;color:${v/overallMax>0.4?color:'transparent'};
          outline:${isPeak?`2px solid ${color}`:'none'};box-sizing:border-box">
          ${v > 0 ? v : ''}
        </div>
      </td>`;
    }).join('');
    const rowTotal = dayTotals.find(x => x.d === d).total;
    const isWeekend = d === 'Sat' || d === 'Sun';
    return `<tr>
      <td style="padding:2px 8px 2px 0;font-size:11px;font-weight:700;
        color:${isWeekend?'#475569':'#94a3b8'};white-space:nowrap">${d}</td>
      ${cells}
      <td style="padding:2px 0 2px 8px;font-size:11px;font-weight:700;
        color:${color};font-family:monospace;white-space:nowrap">${rowTotal}</td>
    </tr>`;
  }).join('');

  // Day bar chart
  const dayBars = dayTotals.map(({ d, total }) => {
    const pct = Math.round(total / maxDayTotal * 100);
    const isWeekend = d === 'Sat' || d === 'Sun';
    const isMax = total === maxDayTotal;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
      <div style="font-size:10px;color:${color};font-family:monospace;font-weight:700">${total > 0 ? total : ''}</div>
      <div style="flex:1;width:100%;display:flex;flex-direction:column;justify-content:flex-end;min-height:80px">
        <div style="background:${color}${isMax?'ff':'66'};border-radius:3px 3px 0 0;width:100%;height:${pct}%;min-height:${total>0?3:0}px"></div>
      </div>
      <div style="font-size:10px;font-weight:700;color:${isWeekend?'#475569':'#94a3b8'}">${d}</div>
    </div>`;
  }).join('');

  const peakCallout = peakVal > 0 ? `
    <div style="display:inline-flex;align-items:center;gap:8px;background:#1a0a00;
      border:1px solid ${color}44;border-radius:10px;padding:8px 16px;margin-bottom:14px">
      <span style="font-size:16px">🔥</span>
      <span style="font-size:13px;color:#e2e8f0">Peak: <strong style="color:${color}">${peakDay} ${String(peakHour).padStart(2,'0')}:00–${String(peakHour+1).padStart(2,'0')}:00</strong>
        · <strong style="color:${color}">${peakVal}</strong> incidents</span>
      ${rows.length !== srcRows.length ? `<span style="font-size:10px;color:#475569">(${rows.length.toLocaleString()} of ${srcRows.length.toLocaleString()} records)</span>` : ''}
    </div>` : '';

  return `
  <div style="display:flex;flex-direction:column;gap:12px">
    <!-- Source filter -->
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="font-size:11px;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:1px">Source:</span>
      ${srcBtns}
    </div>

    <!-- Category filter -->
    ${catBar}

    ${peakCallout}

    <!-- Heatmap + Day bars -->
    <div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start">
      <div style="background:#080f1a;border:1px solid #1e293b;border-radius:12px;padding:16px;overflow-x:auto">
        <div style="font-size:12px;font-weight:700;color:#e2e8f0;margin-bottom:12px">Day × Hour heatmap</div>
        <table style="border-collapse:collapse">
          <thead>
            <tr>
              <th style="padding:3px 8px 3px 0;font-size:9px;color:#334155;text-align:left">DAY</th>
              ${hourLabels}
              <th style="padding:3px 0 3px 8px;font-size:9px;color:#334155">TOTAL</th>
            </tr>
          </thead>
          <tbody>${heatRows}</tbody>
        </table>
        <div style="margin-top:8px;font-size:10px;color:#334155">Hour labels shown every 2h · deeper color = more incidents · timezone = UTC from Mozart export</div>
      </div>
      <div style="background:#080f1a;border:1px solid #1e293b;border-radius:12px;padding:16px;min-width:200px">
        <div style="font-size:12px;font-weight:700;color:#e2e8f0;margin-bottom:12px">Busiest days</div>
        <div style="display:flex;gap:4px;align-items:flex-end;height:120px">${dayBars}</div>
      </div>
    </div>
  </div>`;
}


// ─── Repeat Offender Tracker ──────────────────────────────────────────────────

function repeatHtml(tagged) {
  if (!tagged.length) return `<div style="text-align:center;padding:40px;color:#334155;font-size:13px">No records to analyse.</div>`;

  const view   = HS.repeatView   || 'asset';
  const thresh = HS.repeatThresh || 3;

  const PRI_WEIGHT = { 'Cat 1':4, 'Cat 2':3, 'Cat 3':2, 'Cat 4':1, Critical:4, High:3, Medium:2, Low:1 };

  // Group by asset or location
  const keyFn = view === 'asset'
    ? r => r.asset && r.asset !== '—' ? r.asset : null
    : r => r.location && r.location !== '—' ? r.location : null;

  const map = {};
  tagged.forEach(r => {
    const k = keyFn(r);
    if (!k) return;
    if (!map[k]) map[k] = { key:k, records:[], open:0, closed:0, score:0, byMonth:{} };
    map[k].records.push(r);
    if (['Open','In Progress','Overdue','Scheduled'].includes(r.status)) map[k].open++;
    else map[k].closed++;
    const w = PRI_WEIGHT[r.priority] || 1;
    map[k].score += w;
    // Monthly bucket from date
    const month = (r.date || '').slice(0, 7); // YYYY-MM
    if (month) map[k].byMonth[month] = (map[k].byMonth[month] || 0) + 1;
  });

  // Filter by threshold and sort by score desc
  const offenders = Object.values(map)
    .filter(x => x.records.length >= thresh)
    .sort((a, b) => b.score - a.score);

  const maxScore = Math.max(1, offenders[0]?.score || 1);

  // Threshold selector
  const threshBtns = [2,3,5,10].map(n => {
    const active = thresh === n;
    return `<button onclick="window._app.hsRepeatThresh(${n})"
      style="padding:4px 12px;border-radius:6px;border:1.5px solid ${active?'#f87171':'#1e293b'};
      background:${active?'#f8717122':'transparent'};color:${active?'#f87171':'#64748b'};
      font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">≥${n}</button>`;
  }).join('');

  const viewBtns = ['asset','location'].map(v => {
    const active = view === v;
    const label  = v === 'asset' ? '🔩 Asset' : '📍 Location';
    return `<button onclick="window._app.hsRepeatView('${v}')"
      style="padding:6px 16px;border-radius:7px;border:none;cursor:pointer;font-size:12px;
      font-weight:700;font-family:inherit;
      background:${active?'#f87171':'#1e3a5f'};
      color:${active?'#0f172a':'#64748b'};transition:all .15s">${label}</button>`;
  }).join('');

  if (!offenders.length) return `
  <div style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div style="display:flex;gap:3px;background:#080f1a;border-radius:9px;padding:3px;border:1px solid #1e293b">${viewBtns}</div>
      <span style="font-size:11px;color:#475569;font-weight:700">THRESHOLD:</span>${threshBtns}
    </div>
    <div style="text-align:center;padding:40px;color:#334155;font-size:13px">
      No ${view}s with ≥${thresh} incidents in the current date range & filters.
    </div>
  </div>`;

  // Sparkline: get sorted months
  const allMonths = [...new Set(tagged.map(r => (r.date||'').slice(0,7)).filter(Boolean))].sort().slice(-6);

  const tableRows = offenders.map((x, i) => {
    const cnt    = x.records.length;
    const scorePct = Math.round(x.score / maxScore * 100);
    const openPct  = Math.round(x.open  / cnt * 100);
    const isTop    = i === 0;
    const isHot    = i < 3;
    // Get location or asset context for sub-label
    const subLabel = view === 'asset'
      ? [...new Set(x.records.map(r => r.location).filter(Boolean))][0] || ''
      : [...new Set(x.records.map(r => r._src))].join(' · ');

    // Sparkline bars
    const sparkMax = Math.max(1, ...allMonths.map(m => x.byMonth[m] || 0));
    const spark = allMonths.map(m => {
      const v = x.byMonth[m] || 0;
      const h = Math.max(2, Math.round(v / sparkMax * 24));
      return `<div style="width:8px;background:${v>0?'#f87171':'#1e293b'};border-radius:2px 2px 0 0;height:${h}px;align-self:flex-end" title="${m}: ${v}"></div>`;
    }).join('');

    // Status pill
    const openColor = x.open === 0 ? '#34d399' : x.open / cnt > 0.5 ? '#f87171' : '#fbbf24';

    // Most common src
    const srcCounts = {};
    x.records.forEach(r => { srcCounts[r._src] = (srcCounts[r._src]||0)+1; });
    const topSrc = Object.entries(srcCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
    const srcC = { CWO:'#38bdf8', Case:'#a78bfa', PPM:'#34d399' }[topSrc] || '#64748b';

    return `<tr onclick="window._app.hsRepeatDrill(${JSON.stringify(x.key)})"
      style="border-top:1px solid #0f1e30;cursor:pointer;transition:background .1s"
      onmouseover="this.style.background='#f8717111'"
      onmouseout="this.style.background='transparent'">
      <td style="padding:10px 12px;font-size:12px;color:${isTop?'#f87171':'#475569'};font-family:monospace;width:32px">${isTop?'🔥':i+1}</td>
      <td style="padding:10px 12px;max-width:220px">
        <div style="font-size:13px;font-weight:700;color:${isHot?'#f87171':'#e2e8f0'};
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.key}</div>
        <div style="font-size:10px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${subLabel}</div>
      </td>
      <td style="padding:10px 12px;font-family:monospace;font-size:13px;font-weight:700;color:#e2e8f0">${cnt}</td>
      <td style="padding:10px 12px;min-width:120px">
        <div style="height:6px;background:#1e293b;border-radius:3px;overflow:hidden;margin-bottom:3px">
          <div style="height:100%;width:${scorePct}%;background:#f87171;border-radius:3px"></div>
        </div>
        <div style="font-size:10px;color:#64748b;font-family:monospace">${x.score}</div>
      </td>
      <td style="padding:10px 12px">
        <span style="font-size:11px;font-weight:700;color:${openColor};font-family:monospace">${x.open}</span>
        <span style="font-size:10px;color:#334155"> / ${cnt}</span>
      </td>
      <td style="padding:10px 12px">
        <span style="background:${srcC}22;color:${srcC};border-radius:4px;padding:2px 7px;
          font-size:10px;font-weight:700;letter-spacing:.8px">${topSrc}</span>
      </td>
      <td style="padding:10px 12px">
        <div style="display:flex;gap:2px;align-items:flex-end;height:28px">${spark}</div>
        <div style="font-size:9px;color:#334155;margin-top:2px">last ${allMonths.length}mo</div>
      </td>
    </tr>`;
  }).join('');

  return `
  <div style="display:flex;flex-direction:column;gap:14px">
    <!-- Controls -->
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <div style="display:flex;gap:3px;background:#080f1a;border-radius:9px;padding:3px;border:1px solid #1e293b">${viewBtns}</div>
      <span style="font-size:11px;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:1px">Threshold:</span>
      ${threshBtns}
      <span style="margin-left:auto;font-size:11px;color:#475569">
        <span style="color:#f87171;font-weight:700">${offenders.length}</span> ${view}s with ≥${thresh} incidents
      </span>
    </div>

    <!-- Table -->
    <div style="background:#080f1a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;min-width:640px">
        <thead>
          <tr style="background:#050c18">
            ${['#', view === 'asset' ? 'Asset' : 'Location','Count','Score','Open','Top Source','Trend'].map(h =>
              `<th style="padding:9px 12px;text-align:left;font-size:9px;font-weight:700;
              color:#475569;text-transform:uppercase;letter-spacing:1.2px;
              border-bottom:1px solid #1e293b;white-space:nowrap">${h}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    <!-- Legend -->
    <div style="font-size:11px;color:#334155;display:flex;gap:16px;flex-wrap:wrap">
      <span>Score = count × priority weight (Cat 1=4, Cat 2=3, Cat 3=2, Cat 4=1)</span>
      <span style="color:#f87171">■</span><span>Open &gt;50% = red</span>
      <span style="color:#fbbf24">■</span><span>Open &lt;50% = amber</span>
      <span style="color:#34d399">■</span><span>All closed = green</span>
      <span>💡 Click any row to see all incidents</span>
    </div>
  </div>`;
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function detailModalHtml(r) {
  if (!r) return '';
  const color = SRC_COLOR[r._src] || '#38bdf8';

  // Helper: mapped field first, then raw CSV column fallbacks
  const raw = r._raw || {};
  const f = (mapped, ...rawKeys) => {
    if (mapped && String(mapped).trim() && mapped !== '—' && mapped !== 'undefined') return mapped;
    for (const k of rawKeys) { const v = raw[k]; if (v && String(v).trim()) return String(v).trim(); }
    return '';
  };

  // Common fields (all sources)
  const common = [
    ['ID',               f(r.id)],
    ['Source',           f(r._src)],
    ['Date',             f(r.date)],
    ['Location',         f(r.location, 'Location_Name')],
    ['Location (Full)',  f(r.location, 'Location_FullName')],
    ['Priority',         f(r.priority, 'Priority_Name')],
    ['Status',           f(r.statusLabel || r.status, 'Status_Label', 'Status')],
    ['Service',          f(r._service)],
  ];

  // Source-specific fields
  const specific =
    r._src === 'CWO' ? [
      ['Asset Name',            f(r.asset,             'Asset_Name', 'AssetName')],
      ['Asset Model',           f(r.assetModel,        'Asset_Model')],
      ['Asset Op. Status',      f(r.assetOpsStatus,    'Asset_OperationalStatus')],
      ['Event Type',            f(r.eventType,         'EventType_Description', 'EventType_Name')],
      ['Problem Type',          f(r.problemType,       'ProblemType_Description', 'ProblemType_Name')],
      ['Case Ref No',           f(r.caseRefNo,         'CaseRefNo', 'CaseReferenceNo')],
      ['Description',           f(r.desc,              'Description', 'ShortDescription')],
      ['Paused Reason',         f(r.pausedReason,      'PausedReason')],
      ['Completion Comment',    f(r.completionComment, 'CompletionComment')],
      ['Closure Comment',       f(r.closureComment,    'ClosureComment')],
      ['Client Verification',   f(r.clientVerComment,  'ClientVerificationComment')],
    ] : r._src === 'Case' ? [
      ['Asset Name',            f(r.asset,             'Asset_Name', 'EquipmentTag')],
      ['Asset Model',           f(r.assetModel,        'Asset_Model')],
      ['Asset Op. Status',      f(r.assetOpsStatus,    'Asset_OperationalStatus')],
      ['Event Type',            f(r.eventType,         'EventType_Description', 'EventType_Name')],
      ['Short Description',     f(r.shortDesc,         'ShortDescription', 'ShortDesc')],
      ['Resolution',            f(r.resolution,        'Resolution')],
    ] : [ // PPM
      ['Location Custom',       f(r.locationCustom,    'Location_Custom')],
      ['Asset Name',            f(r.asset,             'Asset_Name', 'AssetName')],
      ['Asset Model',           f(r.assetModel,        'Asset_Model')],
      ['Asset Op. Status',      f(r.assetOpsStatus,    'Asset_OperationalStatus')],
      ['Master WO Title',       f(r.masterWOTitle,     'MasterWorkOrderTitle', 'TaskName')],
      ['Checklist',             f(r.checklistName,     'ChecklistName')],
      ['PPM Main Category',     f(r.ppmMainCat,        'PPM_Main_Category')],
      ['PPM Task Category',     f(r.ppmTaskCat,        'PPM_Task_Category')],
      ['Status Label',          f(r.statusLabel,       'Status_Label')],
    ];

  const fields = [...common, ...specific]
    .filter(([,v]) => v && String(v).trim() !== '' && v !== 'undefined' && v !== '—');

  const rows = fields.map(([label, val]) => `
    <tr style="border-top:1px solid #1e293b">
      <td style="padding:10px 4px;font-size:10px;font-weight:700;color:#475569;
        text-transform:uppercase;letter-spacing:1.2px;width:160px;vertical-align:top;
        font-family:monospace;white-space:nowrap">${label}</td>
      <td style="padding:10px 4px;font-size:13px;color:#e2e8f0;line-height:1.6">${val}</td>
    </tr>`).join('');

  return `
  <div id="hsDetailModal" onclick="window._app.hsCloseModal()"
    style="position:fixed;inset:0;background:rgba(0,0,0,.82);display:flex;align-items:center;
    justify-content:center;z-index:2000;backdrop-filter:blur(6px)">
    <div onclick="event.stopPropagation()"
      style="background:#0f172a;border-radius:20px;padding:32px;max-width:560px;width:92%;
      box-shadow:0 0 0 1px ${color}44,0 32px 80px rgba(0,0,0,.7);
      max-height:88vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
        <div>
          <div style="font-size:10px;font-weight:700;color:${color};letter-spacing:2.5px;
            text-transform:uppercase;margin-bottom:4px">${r._src}</div>
          <div style="font-size:24px;font-weight:800;color:#f1f5f9">${r.id}</div>
          <div style="font-size:13px;color:#475569;margin-top:2px">${r.location} · ${r.date}</div>
        </div>
        <button onclick="window._app.hsCloseModal()"
          style="background:#1e293b;border:none;border-radius:10px;width:36px;height:36px;
          cursor:pointer;font-size:18px;color:#64748b;flex-shrink:0;font-family:inherit">×</button>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tbody>${rows}</tbody>
      </table>
    </div>
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

  const modalHtml = HS.modalRecord ? detailModalHtml(HS.modalRecord) : '';
  panel.innerHTML = `
  ${modalHtml}
  <div style="font-family:'DM Sans',sans-serif;color:#e2e8f0;background:#0f172a;
    border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,.4)">
    <div style="font-size:16px;font-weight:800;color:#f97316;margin-bottom:4px">🔥 Hotspot Analysis</div>
    <div style="font-size:12px;color:#475569;margin-bottom:20px">
      CWO + Cases + PPM grouped by dimension. Table view with drill-down and Analytics charts.
    </div>
    ${controlsHtml(tagged, groups)}
    ${HS.subTab === 'table'    ? groupedTableHtml(groups)  :
      HS.subTab === 'analytics' ? analyticsHtml(tagged)      :
      HS.subTab === 'patterns'  ? patternsHtml(tagged)       :
                                  repeatHtml(tagged)}
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
export function hsPatternSrc(src) {
  HS.patternSrc    = src;
  HS.patternCatSel = null; // reset category selection when source changes
  renderHotspot();
}
export function hsPatternCatToggle(cat) {
  const avail = _getPatternCats();
  if (HS.patternCatSel === null) {
    // Currently all selected — toggling one off: start with all, remove this one
    HS.patternCatSel = new Set(avail.filter(c => c !== cat));
  } else {
    // Explicit Set — toggle membership
    const s = new Set(HS.patternCatSel);
    if (s.has(cat)) { s.delete(cat); } else { s.add(cat); }
    // If all items now selected, reset to null (canonical "all" state)
    HS.patternCatSel = s.size === avail.length ? null : s;
  }
  renderHotspot();
}
export function hsPatternCatAll() {
  HS.patternCatSel = null;
  renderHotspot();
}
export function hsPatternCatNone() {
  HS.patternCatSel = new Set(); // empty = nothing selected
  renderHotspot();
}
function _getPatternCats() {
  const src = HS.patternSrc || 'ALL';
  if (src === 'ALL') return [];
  const tagged = getTagged();
  const field  = { CWO:'problemType', Case:'eventType', PPM:'ppmTaskCat' }[src];
  const rows   = tagged.filter(r => r._src === src);
  return [...new Set(rows.map(r => r[field] || '—').filter(Boolean))].sort();
}
export function hsRepeatView(view) {
  HS.repeatView = view; renderHotspot();
}
export function hsRepeatThresh(n) {
  HS.repeatThresh = n; renderHotspot();
}
export function hsRepeatDrill(key) {
  // Reuse grouped table expand — set expandedKey and switch to table tab
  const view = HS.repeatView || 'asset';
  // Find matching group in getTagged
  const tagged = getTagged();
  const keyFn = view === 'asset'
    ? r => r.asset && r.asset !== '—' ? r.asset : null
    : r => r.location && r.location !== '—' ? r.location : null;
  const recs = tagged.filter(r => keyFn(r) === key);
  // Open a modal-like approach: show detail modal can't do multiple — open the Table tab filtered
  HS.subTab = 'table';
  HS.tableSearch = key;
  HS.expandedKey = null;
  renderHotspot();
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
  HS.drillSrc[key] = src;
  HS.drillFilter[key] = {};
  renderHotspot();
}
export function hsDrillSort(key, col) {
  const cur = HS.drillSort[key] || { col:'date', dir:'desc' };
  HS.drillSort[key] = {
    col, dir: cur.col === col ? (cur.dir === 'asc' ? 'desc' : 'asc') : 'asc'
  };
  renderHotspot();
}
export function hsDrillColFilter(key, colKey, val) {
  if (!HS.drillFilter[key]) HS.drillFilter[key] = {};
  HS.drillFilter[key][colKey] = val;
  HS.colFilterOpen = null;
  renderHotspot();
}
export function hsToggleColFilter(key, colKey) {
  const k = `${key}::${colKey}`;
  HS.colFilterOpen = HS.colFilterOpen === k ? null : k;
  renderHotspot();
}
export function hsDrillReset(key) {
  HS.drillSrc[key]    = 'All';
  HS.drillFilter[key] = {};
  HS.drillSort[key]   = { col:'date', dir:'desc' };
  HS.colFilterOpen    = null;
  renderHotspot();
}
export function hsOpenModal(uid) {
  const rec = HS.recordCache[uid];
  if (!rec) return;
  HS.modalRecord = rec;
  renderHotspot();
}
export function hsCloseModal() {
  HS.modalRecord = null;
  renderHotspot();
}
export function hsTableSort(col) {
  if (HS.tableSort.col === col) {
    HS.tableSort.dir = HS.tableSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    HS.tableSort = { col, dir: col === 'group' ? 'asc' : 'desc' };
  }
  renderHotspot();
}
export function hsTableSearch(val) {
  HS.tableSearch = val;
  HS.expandedKey = null; // collapse any open row on search
  renderHotspot();
}
export function hsHeatmapTab(val) {
  HS.heatmapTab = val;
  HS.heatmapSort = { col: '__total__', dir: 'desc' };
  HS.heatmapDrill = null;
  HS.heatmapDrillSort   = { col: 'date', dir: 'desc' };
  HS.heatmapDrillFilter = {};
  HS.heatmapDrillColOpen = null;
  HS.heatmapSearch = '';
  renderHotspot();
}
export function hsHeatmapSearch(val) {
  HS.heatmapSearch = val;
  HS.heatmapDrill  = null; // close drill panel on new search
  HS.heatmapDrillFilter = {};
  renderHotspot();
}
export function hsHeatmapSort(col) {
  const cur = HS.heatmapSort;
  HS.heatmapSort = {
    col,
    dir: cur.col === col ? (cur.dir === 'asc' ? 'desc' : 'asc') : 'desc',
  };
  renderHotspot();
}
export function hsHeatmapDrill(rowKey, colKey) {
  // Find the matching records from the current tagged set
  const tagged = getTagged();
  const tab = HS.heatmapTab || 'case';
  const srcMap = { case: 'Case', cwo: 'CWO', ppm: 'PPM' };
  const src = srcMap[tab];
  const color = { case:'#a78bfa', cwo:'#38bdf8', ppm:'#34d399' }[tab];

  const rowFn = tab === 'ppm'
    ? r => r.locationCustom || r.location
    : r => r.location;
  const colFn = tab === 'case'
    ? r => r.eventType
    : tab === 'cwo'
    ? r => r.problemType
    : r => r.ppmTaskCat || r.category;

  const records = tagged
    .filter(r => r._src === src)
    .filter(r => (rowFn(r)||'—') === rowKey && (colFn(r)||'—') === colKey);

  // If same cell clicked again — toggle close
  if (HS.heatmapDrill?.rowKey === rowKey && HS.heatmapDrill?.colKey === colKey) {
    HS.heatmapDrill = null;
  } else {
    HS.heatmapDrill = { rowKey, colKey, records, color };
    HS.heatmapDrillSort   = { col: 'date', dir: 'desc' };
    HS.heatmapDrillFilter = {};
    HS.heatmapDrillColOpen = null;
  }
  renderHotspot();
}
export function hsHeatmapDrillClose() {
  HS.heatmapDrill = null;
  HS.heatmapDrillSort   = { col: 'date', dir: 'desc' };
  HS.heatmapDrillFilter = {};
  HS.heatmapDrillColOpen = null;
  renderHotspot();
}
export function hsHeatmapDrillSort(col) {
  const cur = HS.heatmapDrillSort;
  HS.heatmapDrillSort = { col, dir: cur.col === col ? (cur.dir === 'asc' ? 'desc' : 'asc') : 'asc' };
  HS.heatmapDrillColOpen = null;
  renderHotspot();
}
export function hsHeatmapDrillColFilter(colKey, val) {
  if (!HS.heatmapDrillFilter) HS.heatmapDrillFilter = {};
  HS.heatmapDrillFilter[colKey] = val;
  HS.heatmapDrillColOpen = null;
  renderHotspot();
}
export function hsHeatmapDrillColOpen(colKey) {
  HS.heatmapDrillColOpen = HS.heatmapDrillColOpen === colKey ? null : colKey;
  renderHotspot();
}
export function hsHeatmapDrillReset() {
  HS.heatmapDrillFilter  = {};
  HS.heatmapDrillSort    = { col: 'date', dir: 'desc' };
  HS.heatmapDrillColOpen = null;
  renderHotspot();
}
// ─── Drill-down sub-table (with sort / col-filter / detail modal) ────────────

const DRILL_COLS = [
  { key:'_src',     label:'Source',      sortable:true,  filterable:true  },
  { key:'id',       label:'ID',          sortable:true,  filterable:false },
  { key:'date',     label:'Date',        sortable:true,  filterable:false },
  { key:'location', label:'Location',    sortable:true,  filterable:true  },
  { key:'asset',    label:'Asset',       sortable:true,  filterable:true  },
  { key:'status',   label:'Status',      sortable:true,  filterable:true  },
  { key:'priority', label:'Priority',    sortable:true,  filterable:true  },
  { key:'desc',     label:'Description', sortable:false, filterable:false },
];

const PRI_ORDER = { Critical:0, High:1, Medium:2, Low:3 };

function getFilterValues(records, colKey) {
  const vals = colKey === '_src'
    ? [...new Set(records.map(r => r._src))]
    : [...new Set(records.map(r => r[colKey]).filter(Boolean))];
  return vals.sort();
}

function drillDownHtml(row, searchQ = '') {
  const gk      = row.key;
  const gkJson  = JSON.stringify(gk);
  const srcFilter   = HS.drillSrc[gk]    || 'All';
  const sort        = HS.drillSort[gk]   || { col:'date', dir:'desc' };
  const colFilters  = HS.drillFilter[gk] || {};
  const activeFilters = Object.values(colFilters).filter(v => v && v !== 'All').length;

  // Pre-filter by search query if active
  const q = searchQ.trim().toLowerCase();
  const baseRecords = q
    ? row.records.filter(r => [
        r.id, r.desc, r.asset, r.location, r.eventType,
        r.problemType, r.priority, r.status, r._src,
      ].some(v => v && String(v).toLowerCase().includes(q)))
    : row.records;

  // Filter by source
  let records = srcFilter === 'All' ? baseRecords : baseRecords.filter(r => r._src === srcFilter);
  // Apply column filters
  Object.entries(colFilters).forEach(([k, v]) => {
    if (!v || v === 'All') return;
    records = records.filter(r => (k === '_src' ? r._src : r[k]) === v);
  });
  // Sort
  records = [...records].sort((a, b) => {
    if (sort.col === 'priority') {
      const av = PRI_ORDER[a.priority] ?? 9, bv = PRI_ORDER[b.priority] ?? 9;
      return sort.dir === 'asc' ? av - bv : bv - av;
    }
    const av = String(sort.col === '_src' ? a._src : (a[sort.col] ?? '')).toLowerCase();
    const bv = String(sort.col === '_src' ? b._src : (b[sort.col] ?? '')).toLowerCase();
    return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  // Source filter chips — counts based on search-filtered base
  const srcBtns = ['All','CWO','Case','PPM'].map(s => {
    const cnt    = s === 'All' ? baseRecords.length : baseRecords.filter(r => r._src === s).length;
    const active = srcFilter === s;
    const c      = SRC_COLOR[s] || '#f97316';
    return `<button onclick='window._app.hsDrillSrc(${gkJson},"${s}")'
      style="padding:4px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;
      font-family:inherit;border:1px solid ${active?c:'#1e293b'};
      background:${active?c+'22':'transparent'};color:${active?c:'#64748b'};transition:all .15s">
      ${s} <span style="opacity:.65">(${cnt})</span>
    </button>`;
  }).join('');

  const resetBtn = (activeFilters > 0 || srcFilter !== 'All')
    ? `<button onclick='window._app.hsDrillReset(${gkJson})'
        style="padding:4px 12px;border-radius:6px;border:1px solid #f87171;background:#1a0a0a;
        color:#f87171;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">
        ✕ Reset
      </button>` : '';

  // Column headers with sort + filter
  const thCells = DRILL_COLS.map(c => {
    const isSorted  = sort.col === c.key;
    const hasFilter = colFilters[c.key] && colFilters[c.key] !== 'All';
    const accent    = '#f97316';
    const color     = (isSorted || hasFilter) ? accent : '#475569';
    const sortIcon  = isSorted ? (sort.dir === 'asc' ? '↑' : '↓') : '↕';
    const sortBtn   = c.sortable
      ? `<span onclick='window._app.hsDrillSort(${gkJson},"${c.key}")'
          style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;
          padding:2px 4px;border-radius:4px;background:${isSorted?'#f9731614':'transparent'}">
          ${c.label}
          <span style="font-size:9px;color:${isSorted?accent:'#334155'}">${sortIcon}</span>
        </span>`
      : `<span style="padding:2px 4px">${c.label}</span>`;

    // Col filter dropdown
    let filterBtn = '';
    if (c.filterable) {
      const vals = getFilterValues(row.records, c.key);
      const openKey = `${gkJson}::${c.key}`;
      const isOpen  = HS.colFilterOpen === `${gk}::${c.key}`;
      const curVal  = colFilters[c.key] || 'All';
      const filterDot = hasFilter ? '●' : '⌄';
      const dropdownItems = ['All', ...vals].map(v =>
        `<div onclick='window._app.hsDrillColFilter(${gkJson},"${c.key}",${JSON.stringify(v)});event.stopPropagation()'
          style="padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;
          font-weight:${v===curVal?700:400};color:${v===curVal?accent:'#cbd5e1'};
          background:${v===curVal?'#1e293b':'transparent'}"
          onmouseover="if('${v}'!=='${curVal}')this.style.background='#1e293b'"
          onmouseout="if('${v}'!=='${curVal}')this.style.background='transparent'">
          ${v}
        </div>`
      ).join('');
      const dropdown = isOpen
        ? `<div style="position:absolute;top:100%;left:0;z-index:999;background:#0f172a;
            border:1px solid #334155;border-radius:10px;padding:6px;min-width:160px;
            box-shadow:0 16px 40px rgba(0,0,0,.6);max-height:280px;overflow-y:auto">
            ${dropdownItems}
          </div>` : '';
      filterBtn = `<span style="position:relative;display:inline-block">
        <button onclick='window._app.hsToggleColFilter(${gkJson},"${c.key}");event.stopPropagation()' 
          style="background:none;border:none;cursor:pointer;padding:0 2px;
          color:${hasFilter?accent:'#475569'};font-size:12px;font-family:inherit"
          title="Filter ${c.label}">${filterDot}</button>
        ${dropdown}
      </span>`;
    }

    return `<th style="padding:9px 10px;text-align:left;white-space:nowrap;font-size:10px;
      font-weight:700;letter-spacing:1.3px;text-transform:uppercase;user-select:none;
      color:${color};border-bottom:1px solid ${isSorted?'#f9731644':'#1e293b'}">
      <span style="display:inline-flex;align-items:center;gap:4px">
        ${sortBtn}${filterBtn}
      </span>
    </th>`;
  }).join('');

  // Rows
  const tableRows = records.slice(0,200).map((r, i) => {
    const acc  = SRC_COLOR[r._src] || '#38bdf8';
    const desc = (r.desc || r.eventType || '—').slice(0, 80);
    const uid = (r._src + '_' + (r.id || i)).replace(/[^a-zA-Z0-9_-]/g, '_');
    HS.recordCache[uid] = r;
    return `<tr onclick='window._app.hsOpenModal("${uid}")'
      style="border-top:1px solid #0f1e30;cursor:pointer;background:${i%2===0?'transparent':'#060d18'};transition:background .1s"
      onmouseover="this.style.background='${acc}11'"
      onmouseout="this.style.background='${i%2===0?'transparent':'#060d18'}'">
      <td style="padding:9px 10px">${srcChipHtml(r._src)}</td>
      <td style="padding:9px 10px;font-size:12px;color:#94a3b8;font-family:monospace;white-space:nowrap">${r.id}</td>
      <td style="padding:9px 10px;font-size:12px;color:#64748b;white-space:nowrap">${r.date||'—'}</td>
      <td style="padding:9px 10px;font-size:12px;color:#94a3b8;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis">${r.location}</td>
      <td style="padding:9px 10px;font-size:12px;color:#cbd5e1;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis">${r.asset}</td>
      <td style="padding:9px 10px">${badgeHtml(r.status)}</td>
      <td style="padding:9px 10px">${priHtml(r.priority)}</td>
      <td style="padding:9px 10px;font-size:12px;color:#64748b;max-width:230px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${desc.replace(/"/g,'&quot;')}">${desc}</td>
    </tr>`;
  }).join('');

  const more = records.length > 200
    ? `<tr><td colspan="8" style="text-align:center;padding:10px;font-size:11px;color:#475569">
        … and ${records.length-200} more. Use filters to narrow down.
      </td></tr>` : '';

  const noRows = records.length === 0
    ? `<tr><td colspan="8" style="text-align:center;padding:24px;color:#334155;font-size:13px">
        No records match your filters.
      </td></tr>` : '';

  return `
  <div style="margin:0 0 0 32px;border-left:2px solid #1e3a5f;padding:14px 0 14px 18px">
    <!-- Source chips + reset -->
    <div style="display:flex;gap:6px;margin-bottom:12px;align-items:center;flex-wrap:wrap">
      <span style="font-size:10px;color:#475569;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-right:4px">SOURCE:</span>
      ${srcBtns}
      ${resetBtn}
      <div style="margin-left:auto;display:flex;gap:10px;align-items:center">
        ${activeFilters > 0 ? `<span style="font-size:11px;color:#f97316;font-weight:700">${activeFilters} filter${activeFilters>1?'s':''} active</span>` : ''}
        <span style="font-size:11px;color:#334155;font-family:monospace">${records.length}/${baseRecords.length} records${q ? ` <span style="color:#f97316">(search filtered)</span>` : ''}</span>
      </div>
    </div>
    <!-- Table -->
    <div style="overflow-x:auto;padding-right:16px">
      <table style="width:100%;border-collapse:collapse;min-width:700px">
        <thead>
          <tr style="background:#081020">${thCells}</tr>
        </thead>
        <tbody>${tableRows}${noRows}${more}</tbody>
      </table>
    </div>
    <div style="margin-top:10px;font-size:10px;color:#1e3a5f;display:flex;gap:16px">
      <span>↑↓ Click column to sort</span>
      <span>⌄ Column filter</span>
      <span>💡 Click row for full detail</span>
    </div>
  </div>`;
}

// ─── Analytics charts (pure SVG/HTML) ──────────────────────────────────────

