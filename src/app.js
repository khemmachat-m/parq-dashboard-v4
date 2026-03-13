// ═══════════════════════════════════════════════════════════════════
// APP  — scan folder, launch main screen, tab switching, auto-load
// ═══════════════════════════════════════════════════════════════════
import Papa from 'papaparse';
import { S } from './state.js';
import { TX_STANDARD, TX_ENRICHED, MASTER_CFG } from './config.js';
import { dbSet } from './db.js';
import { readCsvFromFolder, writeCsvToFolder, deleteFileFromFolder } from './fs.js';
import { buildMasters } from './masters.js';
import { enrichForTab } from './enrich.js';
import { fmtDt } from './utils.js';
import { buildWeeks, renderWeeks } from './weeks.js';
import { clearResult } from './actions.js';

// ── Tab chip helper ───────────────────────────────────────────────
export function setTabChip(tab, state, text) {
  const chip = document.getElementById('chip-' + tab);
  if (!chip) return;
  chip.textContent = text;
  chip.className   = 'tab-chip ' + state;
}

// ── Tab switcher ──────────────────────────────────────────────────
export function switchTab(tab) {
  S.tab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  // ── Hotspot tab — show its panel, hide the main report UI ────────
  const hotspotPanel = document.getElementById('hotspotPanel');
  const reportUI     = document.getElementById('reportUI');
  if (tab === 'hotspot') {
    if (hotspotPanel) hotspotPanel.style.display = 'block';
    if (reportUI)     reportUI.style.display     = 'none';
    document.getElementById('autoLoadBar').style.display   = 'none';
    document.getElementById('dataStatusBar').style.display = 'none';
    document.getElementById('noDataBar').style.display     = 'none';
    window._app.initHotspot();
    return;
  }
  // ── Other tabs — hide hotspot, show report UI ────────────────────
  if (hotspotPanel) hotspotPanel.style.display = 'none';
  if (reportUI)     reportUI.style.display     = 'block';

  S.txParsed    = [];
  S.reportWeeks = [];
  S.selWeekIdx  = 0;
  clearResult();

  // Hide all status bars
  document.getElementById('autoLoadBar').style.display   = 'none';
  document.getElementById('dataStatusBar').style.display = 'none';
  document.getElementById('noDataBar').style.display     = 'none';

  const cache = S._enrichedCache?.[tab];
  if (cache && cache.length) {
    S.txParsed = cache;
    S.txAlreadyEnriched[tab] = true;
    const em   = S.enrichedMeta?.[tab] || {};
    const cols = cache.length ? Object.keys(cache[0]).length : 0;
    buildWeeks(); renderWeeks();

    document.getElementById('dsbTitle').textContent = TX_ENRICHED[tab];
    document.getElementById('dsbSub').textContent   =
      `Enriched ${fmtDt(em.lastEnriched)} · ${cache.length.toLocaleString()} rows · ${cols} columns`;
    document.getElementById('dsbStats').innerHTML = `
      <div style="text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--green);line-height:1">${cache.length.toLocaleString()}</div>
        <div style="font-size:9.5px;color:#15803D;margin-top:2px">Rows</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--green);line-height:1">${cols}</div>
        <div style="font-size:9.5px;color:#15803D;margin-top:2px">Columns</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--green);line-height:1">${S.reportWeeks.length}</div>
        <div style="font-size:9.5px;color:#15803D;margin-top:2px">Weeks</div>
      </div>`;
    document.getElementById('dataStatusBar').style.display = 'flex';
  } else {
    const TX_TAB_NAMES = { cwo: 'Corrective Work Orders', cases: 'Case Management', ppm: 'PPM Work Orders' };
    document.getElementById('noDataTitle').textContent = `No enriched data found for ${TX_TAB_NAMES[tab]}`;
    document.getElementById('noDataBar').style.display = 'flex';
    setTabChip(tab, 'empty', 'No data');
    renderWeeks();
  }
}

// ── Scan working folder (returning user) ─────────────────────────
export async function scanFolder() {
  if (!S.folderHandle) return;
  const meta = S.masterMeta || {};
  const now  = new Date().toISOString();

  // Load master data CSVs
  for (const cfg of MASTER_CFG) {
    try {
      const text   = await readCsvFromFolder(S.folderHandle, cfg.filename);
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      S.masterRaws[cfg.key] = result.data;
      meta[cfg.key] = {
        filename: cfg.filename, isOverride: false,
        lastUpdated: meta[cfg.key]?.lastUpdated || now,
        rowCount: result.data.length,
      };
    } catch (_) { /* not found — skip */ }
  }

  // Scan raw TX standard files (update txMeta if present)
  const txMeta = S.txMeta || {};
  for (const tab of ['cwo', 'cases', 'ppm']) {
    try {
      await readCsvFromFolder(S.folderHandle, TX_STANDARD[tab]);
      if (!txMeta[tab]) txMeta[tab] = { filename: TX_STANDARD[tab], originalName: TX_STANDARD[tab], lastUpdated: now, rows: 0 };
    } catch (_) {}
  }
  S.txMeta = txMeta;

  // Load enriched CSVs into cache
  const enrichedMeta = S.enrichedMeta || {};
  for (const tab of ['cwo', 'cases', 'ppm']) {
    try {
      const text   = await readCsvFromFolder(S.folderHandle, TX_ENRICHED[tab]);
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      S.txAlreadyEnriched[tab] = true;
      S._enrichedCache[tab]    = result.data;
      if (!enrichedMeta[tab]) {
        enrichedMeta[tab] = {
          filename: TX_ENRICHED[tab], lastEnriched: now,
          rows: result.data.length,
          cols: result.data.length ? Object.keys(result.data[0]).length : 0,
        };
      }
    } catch (_) { S.txAlreadyEnriched[tab] = false; }
  }
  S.enrichedMeta = enrichedMeta;
  S.masterMeta   = meta;
  S.masters      = buildMasters(S.masterRaws);

  await dbSet('masterMeta',   meta);
  await dbSet('txMeta',       txMeta);
  await dbSet('enrichedMeta', enrichedMeta);

  // ── Re-enrich stale files missing Asset_ columns ──────────────
  const hasAssets = (S.masterRaws.assets || []).length > 0;
  if (hasAssets) {
    for (const tab of ['cwo', 'cases', 'ppm']) {
      const cache = S._enrichedCache?.[tab];
      if (!cache || !cache.length) continue;
      if (Object.keys(cache[0]).some(k => k.startsWith('Asset_'))) continue; // already has assets
      try {
        const rawText   = await readCsvFromFolder(S.folderHandle, TX_STANDARD[tab]);
        const rawResult = Papa.parse(rawText, { header: true, skipEmptyLines: true });
        if (!rawResult.data.length) continue;
        const freshRows = enrichForTab(tab, rawResult.data);
        S._enrichedCache[tab]    = freshRows;
        S.txAlreadyEnriched[tab] = true;
        const freshCsv = Papa.unparse(freshRows);
        await deleteFileFromFolder(S.folderHandle, TX_ENRICHED[tab]);
        await writeCsvToFolder(S.folderHandle, TX_ENRICHED[tab], freshCsv);
        S.enrichedMeta[tab] = {
          filename: TX_ENRICHED[tab],
          lastEnriched: new Date().toISOString(),
          rows: freshRows.length,
          cols: freshRows.length ? Object.keys(freshRows[0]).length : 0,
        };
        console.log(`[scanFolder] Re-enriched ${tab} with asset data (${freshRows.length} rows)`);
      } catch (e) {
        console.warn(`[scanFolder] Could not re-enrich ${tab}:`, e.message);
      }
    }
    await dbSet('enrichedMeta', S.enrichedMeta);
  }
}

// ── Auto-load all enriched CSVs after app launch ─────────────────
export async function autoLoadAllEnriched() {
  let readyCount = 0;

  for (const tab of ['cwo', 'cases', 'ppm']) {
    // Already in cache (e.g., from completeSetup) — skip re-reading
    if (S._enrichedCache[tab]?.length) {
      readyCount++;
      setTabChip(tab, 'ready', `${S._enrichedCache[tab].length.toLocaleString()} rows`);
      continue;
    }
    // Try reading from folder
    if (S.folderHandle) {
      try {
        const text   = await readCsvFromFolder(S.folderHandle, TX_ENRICHED[tab]);
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        S._enrichedCache[tab]    = result.data;
        S.txAlreadyEnriched[tab] = true;
        const now = new Date().toISOString();
        if (!S.enrichedMeta[tab]) {
          S.enrichedMeta[tab] = {
            filename: TX_ENRICHED[tab], lastEnriched: now,
            rows: result.data.length,
            cols: result.data.length ? Object.keys(result.data[0]).length : 0,
          };
        }
        readyCount++;
        setTabChip(tab, 'ready', `${result.data.length.toLocaleString()} rows`);
      } catch (_) {
        S.txAlreadyEnriched[tab] = false;
        setTabChip(tab, 'empty', 'No data');
      }
    } else {
      setTabChip(tab, 'empty', 'No data');
    }
  }

  document.getElementById('appFolderSub').textContent =
    `${Object.keys(S.masterRaws).length} master files · ${readyCount}/3 enriched datasets ready`;
  await dbSet('enrichedMeta', S.enrichedMeta);
}

// ── Launch main app screen ────────────────────────────────────────
export function launchApp() {
  if (!S.enrichedMeta || !Object.keys(S.enrichedMeta).length) {
    dbGet('enrichedMeta').then(m => { if (m) S.enrichedMeta = m; });
  }
  document.getElementById('setupScreen').style.display  = 'none';
  document.getElementById('appScreen').style.display    = 'block';
  document.getElementById('appFolderName').textContent  = S.folderName || 'Working Folder';
  document.getElementById('appFolderSub').textContent   = 'Loading enriched datasets…';

  ['cwo', 'cases', 'ppm'].forEach(t => setTabChip(t, 'loading', 'Loading…'));

  autoLoadAllEnriched().then(() => {
    const defaultTab = ['cwo', 'cases', 'ppm'].find(t => S._enrichedCache?.[t]?.length) || 'cwo';
    switchTab(defaultTab);
    document.querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === defaultTab)
    );
  });
}
