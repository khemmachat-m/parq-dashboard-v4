// ═══════════════════════════════════════════════════════════════════
// SETUP  — 3-step onboarding, folder selection, master & tx uploads
// ═══════════════════════════════════════════════════════════════════
import Papa from 'papaparse';
import { S } from './state.js';
import { MASTER_CFG, TX_STANDARD, TX_ENRICHED, TX_LABELS } from './config.js';
import { FS_SUPPORTED, pickFolder, writeCsvToFolder, readCsvFromFolder, deleteFileFromFolder } from './fs.js';
import { dbGet, dbSet } from './db.js';
import { buildMasters } from './masters.js';
import { enrichForTab } from './enrich.js';
import { launchApp, scanFolder } from './app.js';

// ── File type detection ───────────────────────────────────────────
export function detectTxType(filename) {
  const n = filename.toLowerCase().replace(/[_\-.]/g, ' ');
  if (/\bcwo\b/.test(n) || /\bcorrective\b/.test(n))                                                          return 'cwo';
  if (/\bcase\b/.test(n) || /\bcases\b/.test(n))                                                              return 'cases';
  if (/\bppm\b/.test(n) || /\bpreventive\b/.test(n) || /\bplanned\b/.test(n) || /\bmaintenance\b/.test(n))   return 'ppm';
  return null;
}

// ── Step navigation ───────────────────────────────────────────────
export function goStep(n) {
  S.setupStep = n;
  document.getElementById('stepCard1').classList.toggle('hidden', n !== 1);
  document.getElementById('stepCard2').classList.toggle('hidden', n !== 2);
  document.getElementById('stepCard3').classList.toggle('hidden', n !== 3);
  if (n === 2) autoLoadMasterFromFolder().then(() => renderSetupUploadList());
  if (n === 3) {
    document.getElementById('finalFolderName').textContent = S.folderName || '';
    autoLoadTxFromFolder().then(() => renderStep3TxGrid());
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Auto-load master data files already in folder ─────────────────
async function autoLoadMasterFromFolder() {
  if (!S.folderHandle) return;
  for (const cfg of MASTER_CFG) {
    if (S.setupStaged[cfg.key]) continue; // already staged (user uploaded)
    try {
      const text = await readCsvFromFolder(S.folderHandle, cfg.filename);
      if (!text) continue;
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (result.data.length > 0) {
        S.setupStaged[cfg.key] = { rows: result.data, filename: cfg.filename, text, fromFolder: true };
      }
    } catch (_) { /* file not found — skip */ }
  }
}

// ── Auto-load exported TX files already in folder ────────────────
async function autoLoadTxFromFolder() {
  if (!S.folderHandle) return;
  for (const tab of ['cwo', 'cases', 'ppm']) {
    if (S.setupStagedTx[tab]) continue; // already staged by user
    try {
      const text = await readCsvFromFolder(S.folderHandle, TX_STANDARD[tab]);
      if (!text) continue;
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (result.data.length > 0) {
        S.setupStagedTx[tab] = {
          originalName: TX_STANDARD[tab],
          standardName: TX_STANDARD[tab],
          text, rows: result.data,
          fromFolder: true,
        };
      }
    } catch (_) { /* file not found — skip */ }
  }
}

// ── Step 1: choose working folder ─────────────────────────────────
export async function setupSelectFolder() {
  if (!FS_SUPPORTED) {
    alert('Your browser does not support the File System Access API.\nPlease use Chrome or Edge.');
    return;
  }
  try {
    const h = await pickFolder();
    S.folderHandle = h;
    S.folderName   = h.name;

    const hero = document.getElementById('folderHero');
    hero.classList.add('selected');
    hero.onclick = null;
    document.getElementById('folderHeroIcon').textContent  = '✅';
    document.getElementById('folderHeroLabel').textContent = h.name;
    const pathEl = document.getElementById('folderHeroPath');
    pathEl.textContent = h.name;
    pathEl.classList.remove('hidden');
    document.getElementById('btnStep1Next').disabled = false;
  } catch (e) {
    if (e.name !== 'AbortError') console.error(e);
  }
}

// ── Step 2: master data upload list ──────────────────────────────
export function renderSetupUploadList() {
  const list = document.getElementById('setupUploadList');
  list.innerHTML = MASTER_CFG.map(cfg => {
    const staged     = S.setupStaged[cfg.key];
    const done       = !!staged;
    const fromFolder = staged && staged.fromFolder;
    const icon       = done ? (fromFolder ? '📂' : '✅') : (cfg.req ? '📋' : '📄');
    const statusTag  = done
      ? (fromFolder
          ? `<span class="upload-row-status folder">Found in folder</span>`
          : `<span class="upload-row-status ok">Staged</span>`)
      : `<label class="btn-upload-row upload" style="cursor:pointer">
           Upload
           <input type="file" accept=".csv" style="display:none"
             onchange="window._app.handleSetupMasterUpload(event,'${cfg.key}')">
         </label>`;
    return `
      <div class="upload-row ${done ? 'done' : ''}" id="urow-${cfg.key}">
        <span class="upload-row-icon">${icon}</span>
        <div class="upload-row-info">
          <div class="upload-row-label">
            <span class="req-dot ${cfg.req ? 'req' : 'opt'}"></span>
            ${cfg.label}
            <span style="font-size:9px;color:var(--text-faint);font-weight:400">(${cfg.req ? 'Required' : 'Optional'})</span>
          </div>
          <div class="upload-row-filename">${done ? staged.filename : cfg.filename}</div>
          ${done ? `<div style="font-size:10px;color:var(--green);font-weight:600">✓ ${staged.rows.length.toLocaleString()} rows ready</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${statusTag}
          ${done ? `<label class="btn-upload-row reupload" style="cursor:pointer;font-size:10px;padding:3px 8px">
              🔄 Re-upload
              <input type="file" accept=".csv" style="display:none"
                onchange="window._app.handleSetupMasterUpload(event,'${cfg.key}')">
            </label>` : ''}
        </div>
      </div>`;
  }).join('');
  updateSetupProgress();
}

export async function handleSetupMasterUpload(event, key) {
  const file = event.target.files[0];
  if (!file) return;
  const text   = await file.text();
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  S.setupStaged[key] = { rows: result.data, filename: file.name, text };
  renderSetupUploadList();
}

export function updateSetupProgress() {
  const all     = MASTER_CFG;
  const req     = all.filter(c => c.req);
  const opt     = all.filter(c => !c.req);
  const loaded  = all.filter(c => S.setupStaged[c.key]);
  const reqDone = req.filter(c => S.setupStaged[c.key]);

  document.getElementById('pgLoaded').textContent = loaded.length;
  document.getElementById('pgReq').textContent    = `${reqDone.length}/${req.length}`;
  document.getElementById('pgOpt').textContent    = `${loaded.length - reqDone.length}/${opt.length}`;
  document.getElementById('btnStep2Next').disabled = reqDone.length < req.length;
}

// ── Step 3: exported file upload grid ────────────────────────────
export function renderStep3TxGrid() {
  const grid = document.getElementById('txUploadGrid');
  grid.innerHTML = ['cwo', 'cases', 'ppm'].map(tab => {
    const cfg    = TX_LABELS[tab];
    const staged = S.setupStagedTx[tab];
    const std    = TX_STANDARD[tab];

    if (staged) {
      const fromFolder = staged.fromFolder;
      const badge = fromFolder
        ? `<span class="tx-card-badge folder">📂 Found in folder</span>`
        : `<span class="tx-card-badge staged">✅ Staged</span>`;
      return `
        <div class="tx-upload-card staged" id="txcard-${tab}">
          <div class="tx-card-top">
            <span class="tx-card-icon">${cfg.icon}</span>
            <div class="tx-card-info">
              <div class="tx-card-label">${cfg.label}</div>
              <div class="tx-card-stored">${fromFolder ? `📂 ${staged.originalName}` : `→ saved as: ${std}`}</div>
            </div>
            ${badge}
          </div>
          <div class="tx-card-file-info">
            <span class="fname">${staged.originalName}</span>
            &nbsp;·&nbsp; ${staged.rows.length.toLocaleString()} rows
          </div>
          <div class="tx-card-btn-row">
            <label class="btn-tx-upload reupload" style="cursor:pointer">
              🔄 Re-upload
              <input type="file" accept=".csv" style="display:none"
                onchange="window._app.handleSetupTxUpload(event,'${tab}')">
            </label>
            <button class="btn-tx-upload remove" onclick="window._app.removeSetupTx('${tab}')">✕</button>
          </div>
        </div>`;
    }

    return `
      <div class="tx-upload-card" id="txcard-${tab}">
        <div class="tx-card-top">
          <span class="tx-card-icon">${cfg.icon}</span>
          <div class="tx-card-info">
            <div class="tx-card-label">${cfg.label}</div>
            <div class="tx-card-pattern">${cfg.hint}</div>
          </div>
          <span class="tx-card-badge">Optional</span>
        </div>
        <div class="tx-card-btn-row">
          <label class="btn-tx-upload upload" style="cursor:pointer">
            ↑ Upload exported file
            <input type="file" accept=".csv" style="display:none"
              onchange="window._app.handleSetupTxUpload(event,'${tab}')">
          </label>
        </div>
      </div>`;
  }).join('');
}

export async function handleSetupTxUpload(event, forcedTab) {
  const file = event.target.files[0];
  if (!file) return;

  const tab = forcedTab || detectTxType(file.name);
  if (!tab) {
    // Unknown type — show inline warning
    const w = document.getElementById('txUploadUnknown') || (() => {
      const el = document.createElement('div'); el.id = 'txUploadUnknown';
      document.getElementById('txUploadGrid').after(el); return el;
    })();
    w.innerHTML = `<div class="tx-upload-card unknown" style="margin-bottom:0">
      <div class="tx-card-top"><span class="tx-card-icon">⚠️</span>
        <div class="tx-card-info"><div class="tx-card-label">Unrecognised file: ${file.name}</div></div>
      </div>
      <div class="tx-card-unknown-warn">Cannot determine type from filename. Try a file named with CWO, Case, PPM, Corrective, Preventive, or Maintenance.</div>
    </div>`;
    return;
  }

  const text   = await file.text();
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  S.setupStagedTx[tab] = { originalName: file.name, standardName: TX_STANDARD[tab], text, rows: result.data };

  const w = document.getElementById('txUploadUnknown');
  if (w) w.innerHTML = '';
  renderStep3TxGrid();
}

export function removeSetupTx(tab) {
  delete S.setupStagedTx[tab];
  renderStep3TxGrid();
}

// ── Processing overlay helpers ───────────────────────────────────
export function procStep(id, state) {
  const el = document.getElementById('procStep-' + id);
  if (el) el.className = 'setup-proc-step ' + state;
}

// ── Complete setup (Step 3 → dashboard) ──────────────────────────
export async function completeSetup() {
  document.getElementById('setupProcessingOverlay').classList.remove('hidden');
  procStep('master', 'active');
  const now = new Date().toISOString();

  // 1. Write master data files to folder
  const meta = {};
  for (const cfg of MASTER_CFG) {
    const staged = S.setupStaged[cfg.key];
    if (!staged) continue;
    try { await writeCsvToFolder(S.folderHandle, cfg.filename, staged.text); } catch (e) { console.warn(e); }
    S.masterRaws[cfg.key] = staged.rows;
    meta[cfg.key] = { filename: cfg.filename, isOverride: false, lastUpdated: now, rowCount: staged.rows.length };
  }
  S.masterMeta = meta;
  S.masters    = buildMasters(S.masterRaws);
  procStep('master', 'done');

  // 2. Write raw TX files and enrich each
  const txMeta       = {};
  const enrichedMeta = {};

  for (const tab of ['cwo', 'cases', 'ppm']) {
    const staged = S.setupStagedTx[tab];
    procStep(tab, staged ? 'active' : 'done');
    if (!staged) continue;

    await deleteFileFromFolder(S.folderHandle, TX_STANDARD[tab]);
    try { await writeCsvToFolder(S.folderHandle, TX_STANDARD[tab], staged.text); } catch (e) { console.warn(e); }
    txMeta[tab] = { filename: TX_STANDARD[tab], originalName: staged.originalName, lastUpdated: now, rows: staged.rows.length };

    const enrichedRows = enrichForTab(tab, staged.rows);
    const enrichedCsv  = Papa.unparse(enrichedRows);

    procStep(tab, 'done');
    procStep('save', 'active');

    await deleteFileFromFolder(S.folderHandle, TX_ENRICHED[tab]);
    try { await writeCsvToFolder(S.folderHandle, TX_ENRICHED[tab], enrichedCsv); } catch (e) { console.warn(e); }
    enrichedMeta[tab] = {
      filename: TX_ENRICHED[tab], lastEnriched: now,
      rows: enrichedRows.length,
      cols: enrichedRows.length ? Object.keys(enrichedRows[0]).length : 0,
    };

    S.txAlreadyEnriched[tab] = true;
    S._enrichedCache[tab]    = enrichedRows;
  }
  procStep('save', 'done');

  // 3. Persist to IndexedDB
  await dbSet('folderHandle',  S.folderHandle);
  await dbSet('folderName',    S.folderName);
  await dbSet('masterMeta',    meta);
  await dbSet('txMeta',        txMeta);
  await dbSet('enrichedMeta',  enrichedMeta);

  S.txMeta       = txMeta;
  S.enrichedMeta = enrichedMeta;

  await new Promise(r => setTimeout(r, 600)); // let user see ticks
  document.getElementById('setupProcessingOverlay').classList.add('hidden');
  launchApp();
}

// ── Reopen last session (skip setup) ─────────────────────────────
export async function skipSetup() {
  const saved = await dbGet('folderHandle');
  if (!saved) { alert('No previous session found. Please select a folder first.'); return; }
  S.folderHandle = saved;
  S.folderName   = (await dbGet('folderName')) || saved.name;
  const perm = await saved.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    const p2 = await saved.requestPermission({ mode: 'readwrite' });
    if (p2 !== 'granted') { alert('Permission denied. Please choose your folder.'); return; }
  }
  S.masterMeta   = (await dbGet('masterMeta'))   || {};
  S.txMeta       = (await dbGet('txMeta'))       || {};
  S.enrichedMeta = (await dbGet('enrichedMeta')) || {};
  await scanFolder();
  launchApp();
}

// ── Change folder from main app ───────────────────────────────────
export async function changeFolder() {
  if (!FS_SUPPORTED) { alert('Use Chrome or Edge to use folder features.'); return; }
  S.setupStaged   = {};
  S.setupStagedTx = {};
  S.folderHandle  = null;
  S.folderName    = null;

  const hero = document.getElementById('folderHero');
  hero.classList.remove('selected');
  hero.onclick = window._app.setupSelectFolder;
  document.getElementById('folderHeroIcon').textContent  = '📁';
  document.getElementById('folderHeroLabel').textContent = 'Click to choose your working folder';
  document.getElementById('folderHeroPath').classList.add('hidden');
  document.getElementById('btnStep1Next').disabled = true;

  document.getElementById('appScreen').style.display   = 'none';
  document.getElementById('setupScreen').style.display = 'flex';
  goStep(1);
}

// ── Back to Setup from main app ───────────────────────────────────
export function goBackToSetup() {
  document.getElementById('appScreen').style.display   = 'none';
  document.getElementById('setupScreen').style.display = 'flex';
  if (S.folderName) document.getElementById('finalFolderName').textContent = S.folderName;
  renderStep3TxGrid();
  goStep(3);
}
