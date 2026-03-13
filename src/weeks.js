// ═══════════════════════════════════════════════════════════════════
// WEEK SELECTOR  — build and render week dropdown
// ═══════════════════════════════════════════════════════════════════
import { S } from './state.js';
import { DATE_FIELDS } from './config.js';
import { fmtWk } from './utils.js';

export function getMonday(d) {
  const dt = new Date(d); dt.setHours(0, 0, 0, 0);
  const day = dt.getDay(); dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
  return dt;
}

export function getSunday(mon) {
  const d = new Date(mon); d.setDate(d.getDate() + 6); return d;
}

export function buildWeeks() {
  const fields = DATE_FIELDS[S.tab] || [];
  const rows   = S.txParsed;
  if (!rows.length) { S.reportWeeks = []; return; }
  const dateField = fields.find(f => rows[0][f] != null) || null;
  if (!dateField)   { S.reportWeeks = []; return; }
  const monSet = new Set();
  for (const r of rows) {
    const d = new Date(r[dateField]);
    if (!isNaN(d)) monSet.add(getMonday(d).getTime());
  }
  S.reportWeeks = [...monSet]
    .sort((a, b) => b - a)
    .map(ts => ({ monday: new Date(ts), sunday: getSunday(new Date(ts)) }));
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const thisMon = getMonday(today).getTime();
  const defIdx  = S.reportWeeks.findIndex(w => w.monday.getTime() < thisMon);
  S.selWeekIdx  = defIdx >= 0 ? defIdx : 0;
}

export function renderWeeks() {
  const sel   = document.getElementById('weekSelect');
  const weeks = S.reportWeeks;
  if (!weeks.length) {
    sel.innerHTML = '<option value="">— upload a transaction file first —</option>';
    document.getElementById('selWeekDates').textContent = '—';
    document.getElementById('cmpWeekDates').textContent = '—';
    return;
  }
  sel.innerHTML = weeks.map((w, i) =>
    `<option value="${i}" ${i === S.selWeekIdx ? 'selected' : ''}>${fmtWk(w.monday)} – ${fmtWk(w.sunday)}${i === S.selWeekIdx ? ' (most recent)' : ''}</option>`
  ).join('');
  refreshWeekBoxes();
}

export function onWeekChange() {
  S.selWeekIdx = parseInt(document.getElementById('weekSelect').value, 10);
  refreshWeekBoxes();
}

export function refreshWeekBoxes() {
  const w = S.reportWeeks; const i = S.selWeekIdx;
  document.getElementById('selWeekDates').textContent =
    w[i]     ? `${fmtWk(w[i].monday)} – ${fmtWk(w[i].sunday)}` : '—';
  document.getElementById('cmpWeekDates').textContent =
    w[i + 1] ? `${fmtWk(w[i + 1].monday)} – ${fmtWk(w[i + 1].sunday)}` : '—';
}
