// ═══════════════════════════════════════════════════════════════════
// MASTER DATA  — lookup map builders
// ═══════════════════════════════════════════════════════════════════

export function buildLookup(rows, idCol = 'Id') {
  const m = {};
  for (const r of rows) {
    const v = r[idCol];
    if (v != null && v !== '') m[String(v).trim()] = r;
  }
  return m;
}

export function buildAssetByTagMap(rows) {
  const m = {};
  for (const r of rows) {
    const t = (r.EquipmentTag || '').trim();
    if (t) m[t.toLowerCase()] = r;
  }
  return m;
}

export function buildEventTypeByCodeMap(rows) {
  const m = {};
  for (const r of rows) {
    const c = (r.Code || '').trim();
    if (c) m[c] = r;
  }
  return m;
}

export function lookup(map, id) {
  if (!map || id == null || id === '') return {};
  return map[String(id).trim()] || {};
}

export function buildMasters(raws) {
  return {
    priority:        buildLookup(raws.priorities        || []),
    location:        buildLookup(raws.locations         || []),
    asset:           buildLookup(raws.assets            || []),
    assetByTag:      buildAssetByTagMap(raws.assets     || []),
    eventType:       buildLookup(raws.eventTypes        || []),
    eventTypeByCode: buildEventTypeByCodeMap(raws.eventTypes || []),
    problemType:     buildLookup(raws.problemTypes      || []),
    serviceCategory: buildLookup(raws.serviceCategories || []),
    frequencyType:   buildLookup(raws.frequencyTypes    || []),
  };
}
