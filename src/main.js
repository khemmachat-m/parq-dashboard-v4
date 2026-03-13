// ═══════════════════════════════════════════════════════════════════
// MAIN  — entry point, init, and window._app bridge for inline HTML
// ═══════════════════════════════════════════════════════════════════
import './style.css';
import { S } from './state.js';
import { FS_SUPPORTED } from './fs.js';
import { dbGet, dbSet } from './db.js';
import { scanFolder, launchApp, switchTab } from './app.js';
import {
  goStep, setupSelectFolder, completeSetup, skipSetup,
  changeFolder, goBackToSetup,
  handleSetupMasterUpload, handleSetupTxUpload, removeSetupTx,
} from './setup.js';
import { onWeekChange } from './weeks.js';
import { runGenerate, runDownload, runSaveLocal } from './actions.js';
import { handleTxFile } from './txUI.js';
import {
  initHotspot, hsUpload, hsGoDashboard,
  hsSetDim, hsSubTab, hsDateFrom, hsDateTo,
  hsClearDate, hsPreset, hsSvcFilter, hsToggleDrill, hsDrillSrc,
  hsDrillSort, hsDrillColFilter, hsToggleColFilter, hsDrillReset,
  hsOpenModal, hsCloseModal,
} from './hotspot.js';

// ── Expose all functions needed by inline HTML onclick handlers ───
// Using window._app so Vite bundling doesn't tree-shake them away.
window._app = {
  setupSelectFolder,
  goStep,
  completeSetup,
  skipSetup,
  changeFolder,
  goBackToSetup,
  handleSetupMasterUpload,
  handleSetupTxUpload,
  removeSetupTx,
  switchTab,
  onWeekChange,
  runGenerate,
  runDownload,
  runSaveLocal,
  handleTxFile,
  // ── Hotspot ──
  initHotspot,
  hsUpload,
  hsGoDashboard,
  hsSetDim,
  hsSubTab,
  hsDateFrom,
  hsDateTo,
  hsClearDate,
  hsPreset,
  hsSvcFilter,
  hsToggleDrill,
  hsDrillSrc,
  hsDrillSort,
  hsDrillColFilter,
  hsToggleColFilter,
  hsDrillReset,
  hsOpenModal,
  hsCloseModal,
};

// ── Init ─────────────────────────────────────────────────────────
async function init() {
  if (!FS_SUPPORTED) {
    alert('This app requires Chrome or Edge (File System Access API).\nSome features will not work in other browsers.');
  }

  const savedHandle = await dbGet('folderHandle');
  const savedName   = await dbGet('folderName');

  if (!savedHandle) {
    document.getElementById('setupScreen').style.display = 'flex';
    goStep(1);
    return;
  }

  S.folderHandle = savedHandle;
  S.folderName   = savedName || savedHandle.name;
  S.masterMeta   = (await dbGet('masterMeta')) || {};
  S.txMeta       = (await dbGet('txMeta'))     || {};

  const perm = await savedHandle.queryPermission({ mode: 'readwrite' });

  if (perm === 'granted') {
    await scanFolder();
    launchApp();
  } else {
    try {
      const p2 = await savedHandle.requestPermission({ mode: 'readwrite' });
      if (p2 === 'granted') {
        await scanFolder();
        launchApp();
      } else {
        throw new Error('denied');
      }
    } catch (_) {
      document.getElementById('setupScreen').style.display = 'flex';
      goStep(1);
    }
  }
}

init();
