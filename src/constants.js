// ─── GitHub source URLs (parq-dashboard public/enriched/) ────────────────────
export const GITHUB_ENRICHED_BASE =
  'https://raw.githubusercontent.com/Khemmachat-m/parq-dashboard/main/public/enriched';

export const ENRICHED_FILES = {
  CWO:   'PARQ_CWO_Enriched.csv',
  Cases: 'PARQ_Case_Enriched.csv',
  PPM:   'PARQ_PPM_Enriched.csv',
};

// ─── Status palette ───────────────────────────────────────────────────────────
export const STATUS_META = {
  Completed:     { bg:'#064e3b', text:'#6ee7b7', dot:'#10b981' },
  Closed:        { bg:'#064e3b', text:'#6ee7b7', dot:'#10b981' },
  'In Progress': { bg:'#451a03', text:'#fcd34d', dot:'#f59e0b' },
  Open:          { bg:'#1e3a5f', text:'#93c5fd', dot:'#3b82f6' },
  Scheduled:     { bg:'#2e1065', text:'#c4b5fd', dot:'#8b5cf6' },
  Overdue:       { bg:'#450a0a', text:'#fca5a5', dot:'#ef4444' },
};

export const STATUS_GROUP = {
  done:     ['Closed','Completed'],
  active:   ['In Progress'],
  pending:  ['Open','Scheduled'],
  overdue:  ['Overdue'],
};

// ─── Priority ─────────────────────────────────────────────────────────────────
export const PRI_COLOR = { Critical:'#f87171', High:'#fb923c', Medium:'#fbbf24', Low:'#94a3b8' };
export const PRI_ORDER = { Critical:0, High:1, Medium:2, Low:3 };

// ─── Source/tab colours ───────────────────────────────────────────────────────
export const SRC_COLOR  = { CWO:'#38bdf8', Case:'#a78bfa', PPM:'#34d399' };
export const TAB_COLOR  = { CWO:'#38bdf8', Cases:'#a78bfa', PPM:'#34d399' };

// ─── Hotspot threshold ────────────────────────────────────────────────────────
export const HOTSPOT_THRESH = 2;

// ─── Chart palette (Recharts) ─────────────────────────────────────────────────
export const CHART_COLORS = [
  '#38bdf8','#a78bfa','#34d399','#f97316','#f87171',
  '#fbbf24','#60a5fa','#e879f9','#4ade80','#fb923c',
];
