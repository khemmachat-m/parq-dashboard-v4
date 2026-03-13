// ═══════════════════════════════════════════════════════════════════
// TX FILE HANDLER  — "Update data" button in main app status bar
// ═══════════════════════════════════════════════════════════════════
import Papa from 'papaparse';
import { S } from './state.js';
import { TX_STANDARD, TX_ENRICHED } from './config.js';
import { writeCsvToFolder, deleteFileFromFolder } from './fs.js';
import { dbSet } from './db.js';
import { enrichForTab } from './enrich.js';
import { setProgress, hideProgress, showOK } from './actions.js';
import { buildWeeks, renderWeeks } from './weeks.js';
import { setTabChip, switchTab } from './app.js';
import { detectTxType } from './setup.js';

export async function handleTxFile(file) {
  if (!file) return;

  setProgress(10, 'Reading file…');
  const text   = await file.text();
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });

  const detectedTab  = detectTxType(file.name) || S.tab;
  const stdName      = TX_STANDARD[detectedTab];
  const enrichedName = TX_ENRICHED[detectedTab];

  // Switch tab if the uploaded file is for a different tab
  if (detectedTab !== S.tab) {
    S.tab = detectedTab;
    document.querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === detectedTab)
    );
  }

  setProgress(30, 'Saving raw export to folder…');
  if (S.folderHandle) {
    await deleteFileFromFolder(S.folderHandle, stdName);
    try { await writeCsvToFolder(S.folderHandle, stdName, text); } catch (e) { console.warn(e); }
  }

  const now = new Date().toISOString();
  S.txMeta[detectedTab] = { filename: stdName, originalName: file.name, lastUpdated: now, rows: result.data.length };
  await dbSet('txMeta', S.txMeta);

  setProgress(55, 'Enriching data…');
  const enrichedRows = enrichForTab(detectedTab, result.data);
  const enrichedCsv  = Papa.unparse(enrichedRows);

  setProgress(80, 'Saving enriched CSV to folder…');
  if (S.folderHandle) {
    await deleteFileFromFolder(S.folderHandle, enrichedName);
    try { await writeCsvToFolder(S.folderHandle, enrichedName, enrichedCsv); } catch (e) { console.warn(e); }
  }

  S.enrichedMeta[detectedTab] = {
    filename: enrichedName, lastEnriched: now,
    rows: enrichedRows.length,
    cols: enrichedRows.length ? Object.keys(enrichedRows[0]).length : 0,
  };
  await dbSet('enrichedMeta', S.enrichedMeta);

  S._enrichedCache[detectedTab] = enrichedRows;
  S.txAlreadyEnriched[detectedTab] = true;
  S.txParsed = enrichedRows;

  setProgress(100, 'Done');
  setTimeout(hideProgress, 1200);

  buildWeeks(); renderWeeks();
  switchTab(detectedTab);
  setTabChip(detectedTab, 'ready', `${enrichedRows.length.toLocaleString()} rows`);
  showOK('✅ Data enriched & saved',
    `${enrichedRows.length.toLocaleString()} rows · ${Object.keys(enrichedRows[0] || {}).length} columns<br>` +
    `<span style="font-family:var(--mono);font-size:11px">${enrichedName}</span> saved to folder`);
}
