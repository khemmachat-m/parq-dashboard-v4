// ═══════════════════════════════════════════════════════════════════
// STATE — singleton shared across all modules
// ═══════════════════════════════════════════════════════════════════
export const S = {
  tab:               'cwo',
  setupStep:         1,
  folderHandle:      null,
  folderName:        null,
  setupStaged:       {},   // master data staged for step 2
  setupStagedTx:     {},   // exported files staged for step 3
  masterRaws:        {},
  masterMeta:        {},
  masters:           {},
  txParsed:          [],   // current tab rows (pre-enriched or enriched)
  txAlreadyEnriched: {},   // { tab: bool }
  txMeta:            {},   // { tab: { filename, originalName, lastUpdated, rows } }
  enrichedMeta:      {},   // { tab: { filename, lastEnriched, rows, cols } }
  _enrichedCache:    {},   // { tab: enrichedRows[] }
  reportWeeks:       [],
  selWeekIdx:        0,
};
