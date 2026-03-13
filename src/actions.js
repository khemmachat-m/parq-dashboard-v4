// ═══════════════════════════════════════════════════════════════════
// ACTIONS  — generate, download, save, progress UI
// ═══════════════════════════════════════════════════════════════════
import Papa from 'papaparse';
import { S } from './state.js';
import { TX_CFG, TX_ENRICHED, DATE_FIELDS } from './config.js';
import { enrich, enrichForTab } from './enrich.js';
import { fmtDate, fmtWk, pad } from './utils.js';
// import { aggregateCWO, aggregateCases, aggregatePPM, evtCountsFromRows, catCountsFromRows, buildCmp } from './aggregate.js'; <- Old
import { aggregateCWO, aggregateCases, aggregatePPM, evtCountsFromRows, evtCountsFromRowsCases, catCountsFromRows, buildCmp } from './aggregate.js'; // <- New
import { generateCWOHtml }  from './reports/cwoHtml.js';
import { generateCaseHtml } from './reports/caseHtml.js';
import { generatePPMHtml }  from './reports/ppmHtml.js';
import { buildWeeks, renderWeeks } from './weeks.js';

// ── Progress bar ──────────────────────────────────────────────────
export function setProgress(pct, lbl) {
  document.getElementById('progressWrap').classList.remove('hidden');
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLbl').textContent  = lbl;
}
export function hideProgress() { document.getElementById('progressWrap').classList.add('hidden'); }
export function clearResult()  { document.getElementById('resultBanner').classList.add('hidden'); hideProgress(); }

export function showOK(t, b) {
  const el = document.getElementById('resultBanner');
  el.className = 'banner ok';
  el.innerHTML = `<div class="banner-title">${t}</div><div class="banner-body">${b}</div>`;
  el.classList.remove('hidden');
}
export function showErr(m) {
  const el = document.getElementById('resultBanner');
  el.className = 'banner err';
  el.innerHTML = `<div class="banner-title">Error</div><div class="banner-body">${m}</div>`;
  el.classList.remove('hidden');
}

// ── File download helper ──────────────────────────────────────────
export function triggerDownload(content, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

export function outFilename() {
  const pfx = TX_CFG[S.tab].prefix;
  const d   = new Date();
  return `${pfx}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
}

// ── Download enriched CSV ─────────────────────────────────────────
export function runDownload() {
  if (!S.txParsed.length) { showErr('No enriched data loaded. Upload an exported file first.'); return; }
  clearResult(); setProgress(30, 'Preparing download…');
  const enriched = S.txAlreadyEnriched[S.tab] ? S.txParsed : enrich(S.txParsed);
  const csv = Papa.unparse(enriched);
  const fn  = TX_ENRICHED[S.tab];
  setProgress(80, 'Downloading…');
  triggerDownload(csv, fn);
  setProgress(100, 'Done'); setTimeout(hideProgress, 1200);
  showOK('✅ Enriched CSV downloaded!',
    `${enriched.length.toLocaleString()} rows · <span style="font-family:var(--mono);font-size:11px">${fn}</span>`);
}

// ── Save to working folder ────────────────────────────────────────
import { deleteFileFromFolder, writeCsvToFolder } from './fs.js';

export async function runSaveLocal() {
  if (!S.txParsed.length) { showErr('No enriched data loaded. Upload an exported file first.'); return; }
  if (!S.folderHandle)    { showErr('No working folder selected.'); return; }
  clearResult(); setProgress(30, 'Preparing data…');
  const enriched = S.txAlreadyEnriched[S.tab] ? S.txParsed : enrich(S.txParsed);
  const csv = Papa.unparse(enriched);
  const fn  = TX_ENRICHED[S.tab];
  setProgress(65, 'Writing to folder…');
  try {
    await deleteFileFromFolder(S.folderHandle, fn);
    await writeCsvToFolder(S.folderHandle, fn, csv);
    setProgress(100, 'Saved!'); setTimeout(hideProgress, 1200);
    showOK('✅ Saved to working folder!',
      `${enriched.length.toLocaleString()} rows<br>` +
      `<span style="font-family:var(--mono);font-size:11px">${fn}</span> in <strong>${S.folderName}</strong>`);
  } catch (e) { hideProgress(); showErr(`Could not save: ${e.message}`); }
}

// ── Filter rows by week ───────────────────────────────────────────
export function filterRowsByWeek(rows, mon, sun) {
  const fields = DATE_FIELDS[S.tab] || [];
  const sunEnd = new Date(sun); sunEnd.setHours(23, 59, 59, 999);
  return rows.filter(row => {
    for (const f of fields) {
      const v = row[f]; if (!v) continue;
      const d = new Date(v);
      if (!isNaN(d) && d >= mon && d <= sunEnd) return true;
    }
    return false;
  });
}

// ── Generate and open HTML report in new tab ──────────────────────
export function runGenerate() {
  if (!S.txParsed.length) { showErr('No enriched data loaded. Upload an exported file first.'); return; }
  const week = S.reportWeeks[S.selWeekIdx];
  if (!week)  { showErr('Please select a report week first.'); return; }
  clearResult(); setProgress(20, 'Filtering rows…');

  const rows   = S.txAlreadyEnriched[S.tab] ? S.txParsed : enrich(S.txParsed);
  const prevWk = S.reportWeeks[S.selWeekIdx + 1];
  const lwRows = filterRowsByWeek(rows, week.monday, week.sunday);
  const pwRows = prevWk ? filterRowsByWeek(rows, prevWk.monday, prevWk.sunday) : [];

  setProgress(55, 'Building report…');
  const reportDate = new Date();
  const pw0 = prevWk || week; // fallback if no previous week
  let html;

  if (S.tab === 'cwo') {
    const lw  = aggregateCWO(lwRows), pw = aggregateCWO(pwRows);
    const cmp = buildCmp(evtCountsFromRows(lwRows), evtCountsFromRows(pwRows));
    html = generateCWOHtml(lw, pw, cmp, week.monday, week.sunday, pw0.monday, pw0.sunday, reportDate);
  } else if (S.tab === 'cases') {
    const lw  = aggregateCases(lwRows), pw = aggregateCases(pwRows);
    const cmp = buildCmp(evtCountsFromRowsCases(lwRows), evtCountsFromRowsCases(pwRows));   // ← new    
    html = generateCaseHtml(lw, pw, cmp, week.monday, week.sunday, pw0.monday, pw0.sunday, reportDate);
  } else {
    const lw  = aggregatePPM(lwRows), pw = aggregatePPM(pwRows);
    const cmp = buildCmp(catCountsFromRows(lwRows), catCountsFromRows(pwRows));
    html = generatePPMHtml(lw, pw, cmp, week.monday, week.sunday, pw0.monday, pw0.sunday, reportDate);
  }

  setProgress(90, 'Opening dashboard…');
  window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
  setProgress(100, 'Done'); setTimeout(hideProgress, 1200);
  showOK('✅ Dashboard opened',
    `${lwRows.length.toLocaleString()} rows in selected week · ${S.tab.toUpperCase()} report`);
}
