// ═══════════════════════════════════════════════════════════════════
// DATA AGGREGATION  — computes lw / pw / cmp objects for generators
// ═══════════════════════════════════════════════════════════════════

export function _pct(n, total) { return total ? Math.round(n / total * 100) : 0; }

export function toSortedArr(counts, limit = 999) {
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Return human-readable event type label for a CWO / Cases row */
export function getEventLabel(row) {
  const desc = (row.EventType_Description || row.EventTypeDescription || '').trim();
  if (desc && desc !== '0' && desc !== '') return desc;
  const txt = (row.Description || row.Subject || row.Name || row.Title || '').toLowerCase();
  if (!txt) return 'Other';

  // ── TEST / Demo records ───────────────────────────────────────────
  if (/^test|test cwo|test case|test l\d/i.test(txt))                      return 'TEST / Demo';

  // ── AC water drip (must check before general water) ──────────────
  if (/น้ำแอร์|น้ำ.*แอร์.*หยด|ac.*water|water.*ac|vsd.?fault|vsd.?error/i.test(txt)) return 'Aircon / Temperature';

  // ── Aircon / Temperature (Thai + English) ────────────────────────
  if (/แอร์|หนาว|ร้อน|อุณหภูมิ|สลับแอร์|ตรวจเช็คแอร์|ปรับอุณหภูมิ/i.test(txt))   return 'Aircon / Temperature';
  if (/aircon|a\.c\.|a\/c|temperature|cooling|hvac|chiller/i.test(txt))             return 'Aircon / Temperature';

  // ── Air Quality / Environment ─────────────────────────────────────
  if (/pm 2\.5|pm2\.5|ระบายกลิ่น|กลิ่น|air quality/i.test(txt))                    return 'Air Quality';

  // ── Lighting (catch missed patterns first) ────────────────────────
  if (/ไฟเพดาน|ไฟหลืบ|ไฟเส้น|ไฟหน้า/i.test(txt))                                  return 'Lighting Faulty';

  // ── Lighting (Thai + English) ────────────────────────────────────
  if (/โคมไฟ|ไฟดับ|ไฟไม่ติด|ไฟไม่มี|แสงสว่าง|หลอดไฟ/i.test(txt))                   return 'Lighting Faulty';
  if (/light|lamp|bulb|luminaire|led|fluorescent/i.test(txt))                         return 'Lighting Faulty';

  // ── Sanitary / WC (Thai + English — before water to avoid conflict) ──
  if (/ห้องน้ำ|โถชักโครก|โถฉี่|ห้องส้วม|อ่างล้างมือ/i.test(txt))                    return 'Sanitary / WC';
  if (/toilet|wc|bathroom|sanitary|sewage/i.test(txt))                                return 'Sanitary / WC';

  // ── Water Leak / Plumbing (Thai + English) ───────────────────────
  if (/น้ำหยด|น้ำรั่ว|น้ำไหล|น้ำท่วม|ท่อน้ำ|คราบน้ำ|พื้นเปียก/i.test(txt))        return 'Water Leak / Plumbing';
  if (/water|leak|plumb|drain|pipe|flood|overflow/i.test(txt))                        return 'Water Leak / Plumbing';

  // ── Water Overflow (missed by general pattern) ────────────────────
  if (/น้ำเอ่อ|น้ำล้น|ท่อตัน|ท่อระบาย/i.test(txt))                                  return 'Water Leak / Plumbing';

  // ── Lift / Escalator (Thai + English) ───────────────────────────
  if (/ลิฟต์|ลิฟท์|บันไดเลื่อน/i.test(txt))                                          return 'Lift / Elevator';
  if (/lift|elevator|escalator/i.test(txt))                                            return 'Lift / Elevator';

  // ── Door / Lock / Access (Thai + English) ───────────────────────
  if (/ประตู|ล็อค|ล๊อค|กุญแจ|บานประตู/i.test(txt))                                   return 'Door / Lock';
  if (/door|lock|access|gate|barrier|hinge|handle/i.test(txt))                        return 'Door / Lock';

  // ── Cleaning (Thai + English) ────────────────────────────────────
  if (/แม่บ้าน|ทำความสะอาด|เช็ดน้ำ|กวาด/i.test(txt))                                 return 'Cleaning';
  if (/clean|dirt|stain|hygiene|waste|rubbish|trash/i.test(txt))                      return 'Cleaning';

  // ── Log Sheet / Routine Checks ───────────────────────────────────
  if (/log sheet|จดมิเตอร์|จด log|ตรวจเช็ค|จดค่า|meter reading/i.test(txt))          return 'Log Sheet / Routine';

  // ── Display / Signage ────────────────────────────────────────────
  if (/จอภาพ|จอโฆษณา|display|screen|signage/i.test(txt))                              return 'Display / Signage';

  // ── Fire Alarm (English only — Thai fire alarms use fire|alarm) ──
  if (/fire|alarm|smoke|sprinkler/i.test(txt))                                         return 'Fire Alarm';

  // ── Electrical (Thai + English) ──────────────────────────────────
  if (/ไฟฝั่ง|ไฟปราสาท|สวิตช์|ปลั๊ก|ไฟรั่ว|สายไฟ|แผงไฟ/i.test(txt))                return 'Electrical';
  if (/electric|power|socket|outlet|breaker|fuse/i.test(txt))                         return 'Electrical';

  // ── Floor / Tile / Ceiling ───────────────────────────────────────
  if (/กระเบื้อง|ฝ้า/i.test(txt))                                                      return 'Floor / Tile';
  if (/floor|tile|carpet|ceiling/i.test(txt))                                          return 'Floor / Tile';

  // ── Structural / Fixture ─────────────────────────────────────────
  if (/หลุด|ร่วง|แตก|ชำรุด|เสียหาย|ครอบ|สแตนเลส|อะลูมิเนียม/i.test(txt))           return 'Structural / Fixture';

  // ── Pest Control ─────────────────────────────────────────────────
  if (/แมลง|หนู|แมลงสาบ|pest|insect|rodent|cockroach|rat/i.test(txt))                return 'Pest Control';

  return 'Other';
}

/** Return event label for Cases — uses enriched EventType_Description directly */
export function getCaseEventLabel(row) {
  const desc = (row.EventType_Description || '').trim();
  return (desc && desc !== '0') ? desc : 'Unknown';
}

// ─── PPM CATEGORY FUNCTIONS ──────────────────────────────────────────────────

/**
 * Return a specific task category label for a PPM row.
 * Reads from PPM_Task_Category (enriched column) if already set,
 * otherwise derives it from MasterWorkOrderTitle.
 */
export function getPPMTaskCategoryLabel(row) {
  // Prefer pre-enriched column
  const saved = (row.PPM_Task_Category || '').trim();
  if (saved && saved !== 'Other') return saved;

  const t  = (row.MasterWorkOrderTitle || row.Name || row.Title || '').trim();
  const tl = t.toLowerCase();
  if (!t) return 'Uncategorised';

  // ── TEST / Demo ──────────────────────────────────────────────────
  if (/^test|^for ops app testing/i.test(t))                                    return 'TEST / Demo';

  // ── Soft Services ────────────────────────────────────────────────
  if (/pest control|termite/i.test(tl))                                         return 'Pest Control';
  if (/water plant|รดน้ำ|trim branch|ตัดแต่ง|ground cover|พืชคลุม|remove weed|กำจัดวัชพืช|fertiliz|ปุ๋ย|planting|เพราะชำ|restore ground|ปลูกซ่อม|rental plant|ดูแลรักษาต้นไม้|loosening the soil|inspect every stake|replace the herb|พรวนดิน|chemicals for disease|ป้องกันโรค/i.test(tl)) return 'Horticulture';
  if (/operate team work schedule/i.test(tl))                                   return 'Operations Scheduling';
  // ── Cleaning sub-types (Toilet checked first — "Car Park Toilet Cleaning" → Toilet) ──
  if (/cleaning|clean ahu room|ทำความสะอาดห้องเครื่อง/i.test(tl)) {
    if (/toilet/i.test(tl))                                                     return 'Cleaning - Toilet';
    if (/car park|carpark/i.test(tl))                                           return 'Cleaning - Carpark';
    if (/common area/i.test(tl))                                                return 'Cleaning - Common Area';
    if (/ahu|clean ahu|ทำความสะอาดห้องเครื่อง/i.test(tl))                      return 'Cleaning - AHU Room';
    if (/\d+f\b/i.test(tl))                                                     return 'Cleaning - Floor';
    return 'Cleaning';
  }

  // ── Fire & Life Safety ───────────────────────────────────────────
  if (/fire extinguisher|fire hose cabinet|fire suppression|fire protection shaft|fire pump|preaction|fire alarm/i.test(tl)) return 'Fire Safety';
  if (/emergency light|exit sign|central battery/i.test(tl))                   return 'Emergency Lighting';

  // ── HVAC ────────────────────────────────────────────────────────
  if (/chiller/i.test(tl))                                                      return 'Chiller';
  if (/cooling tower/i.test(tl))                                                return 'Cooling Tower';
  if (/air handling unit|\bahu\b|\bahe\b|\bpau\b|primary air handling/i.test(tl)) return 'Air Handling Unit (AHU)';
  if (/fan coil unit|\bfcu\b/i.test(tl))                                        return 'Fan Coil Unit (FCU)';
  if (/split type/i.test(tl))                                                   return 'Split Type AC';
  if (/exhaust fan|pressurized air fan|kitchen exhaust|kitchen make.?fan|fresh air fan|carpark.*fan|jet fan|smoke extraction|make.?up fan/i.test(tl)) return 'Ventilation / Fans';

  // ── Electrical ──────────────────────────────────────────────────
  if (/generator|gcp of generator/i.test(tl))                                  return 'Generator';
  if (/transformer|high.?volt|switchgear|capacitor bank|main distribution board|\bmdb\b|emergen.*distribution|sub distribution|load center|busduct|motor control center|ahu.*distribution|grounding|central \d+ floor|central.*wing/i.test(tl)) return 'Electrical Distribution';
  if (/lightning protection/i.test(tl))                                         return 'Lightning Protection';

  // ── Plumbing & Water ────────────────────────────────────────────
  if (/chilled water pump|condenser water pump|cold water.*pump|booster pump/i.test(tl)) return 'Water Pumps';
  if (/drainage|sewage|waste water|recycle water|recycle tank|underground water tank|roof water tank|swimming pool|fountain|sanitary shaft|pressure reducing valve/i.test(tl)) return 'Plumbing / Water Systems';

  // ── Lifts & Escalators ──────────────────────────────────────────
  if (/lift|elevator|escalator/i.test(tl))                                      return 'Lifts & Escalators';

  // ── Security Systems ────────────────────────────────────────────
  if (/cctv|public address/i.test(tl))                                          return 'CCTV & PA System';

  // ── Other Hard Services ──────────────────────────────────────────
  if (/gas station/i.test(tl))                                                  return 'Gas Station';

  return 'Uncategorised';
}

/**
 * Return 'Hard Service' or 'Soft Service' for a PPM row.
 * Hard Service = Engineering / Technical maintenance.
 * Soft Service = Cleaning, Horticulture, Pest Control, Operations Scheduling.
 */
export function getPPMMainCategoryLabel(row) {
  const task = getPPMTaskCategoryLabel(row);
  const SOFT = new Set(['Cleaning', 'Cleaning - Toilet', 'Cleaning - Carpark',
                        'Cleaning - Common Area', 'Cleaning - AHU Room', 'Cleaning - Floor',
                        'Pest Control', 'Horticulture', 'Operations Scheduling']);
  if (task === 'TEST / Demo') return 'TEST / Demo';
  return SOFT.has(task) ? 'Soft Service' : 'Hard Service';
}

// ─── LOCATION_CUSTOM HELPERS ─────────────────────────────────────────────────

export function extractPPMFloor(title) {
  const t = (title || '').trim();
  let m = t.match(/\b(B?\d+|Roof|R)\s*[-–]\s*(B?\d+|Roof|R)\s+Floor\b/i);
  if (m) return `${m[1].toUpperCase()}-${m[2].toUpperCase()} Floor`;
  m = t.match(/\b(\d{1,2})\s+Floor\b/i);
  if (m) return `${m[1]}F`;
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+Floor\b/i);
  if (m) return `${m[1]}F`;
  m = t.match(/\b(\d{1,2})F\b/i);
  if (m) return `${m[1]}F`;
  m = t.match(/\b(B\d+[A-Z]?)\b/i);
  if (m) return m[1].toUpperCase();
  if (/\bRoof(?:top)?\b/i.test(t)) return 'Roof';
  if (/\bLMR\b/i.test(t)) return 'LMR';
  if (/\bLM\s+Floor\b/i.test(t)) return 'LM';
  m = t.match(/ชั้น\s*(\d+)/);
  if (m) return `${m[1]}F`;
  return '';
}

export function extractPPMRoom(title) {
  const tl = (title || '').toLowerCase();
  const rooms = [];
  if (/\btoilet/.test(tl))                 rooms.push('Toilet');
  if (/\bcommon\s+area\b/.test(tl))        rooms.push('Common Area');
  if (/\bperimeter\b/.test(tl))            rooms.push('Perimeter');
  if (/\bq[\s-]*garden\b/.test(tl))        rooms.push('Q Garden');
  else if (/\bgarden\b/.test(tl))          rooms.push('Garden');
  if (/\bcarpark\b|car\s*park\b/.test(tl)) rooms.push('Carpark');
  if (/\bpantry\b/.test(tl))              rooms.push('Pantry');
  if (/\bahu\d?\s*room\b/.test(tl))        rooms.push('AHU Room');
  if (/\bee\s*room\b/.test(tl))            rooms.push('EE Room');
  if (/\bsystem\s*room\b/.test(tl))        rooms.push('System Room');
  if (/\blobby\b/.test(tl))               rooms.push('Lobby');
  if (/\bretail\b/.test(tl))              rooms.push('Retail');
  if (/\bfood\s*street\b/.test(tl))        rooms.push('Food Street');
  if (/\bpavilion\b/.test(tl))            rooms.push('Pavilion');
  if (/\bpool|fountain\b/.test(tl))        rooms.push('Pool/Fountain');
  if (/\brooftop\b/.test(tl))             rooms.push('Rooftop');
  return rooms.join(', ');
}

export function extractPPMZone(title) {
  const tl = (title || '').toLowerCase();
  const zones = [];
  if (/\beast\s+wing\b/.test(tl))    zones.push('East Wing');
  else if (/\beast\b/.test(tl))      zones.push('East');
  if (/\bwest\s+wing\b/.test(tl))    zones.push('West Wing');
  else if (/\bwest\b/.test(tl))      zones.push('West');
  if (/\btower\s+e\b/.test(tl))      zones.push('Tower E');
  if (/\btower\s+w\b/.test(tl))      zones.push('Tower W');
  return zones.join(', ');
}

export function getLocationCustom(row) {
  const title = row.MasterWorkOrderTitle || row.Name || row.Title || '';
  const parts = [extractPPMFloor(title), extractPPMRoom(title), extractPPMZone(title)]
    .filter(Boolean);
  return parts.join(' | ');
}

// ─── STATUS & SLA HELPERS ────────────────────────────────────────────────────

/** Detect closed / cancelled / active status from a CWO or Cases row */
export function getRowStatus(row) {
  const s = (row.StatusId || row.Status || row.WorkOrderStatus || row.CaseStatus || '').toString().toLowerCase();
  if (/cancel/.test(s))                         return 'cancelled';
  if (/clos|resolv|complet|done|finish/.test(s)) return 'resolved';
  if (s === '3' || s === '4' || s === '5')       return 'resolved'; // common Mozart numeric IDs
  return 'active';
}

/** Detect SLA pass / fail from a row */
export function getSLAStatus(row) {
  const failed = (row.IsSLAFailed || '').toString().toLowerCase();
  if (failed === 'true' || failed === '1')  return 'fail';
  if (failed === 'false' || failed === '0') return 'pass';
  const sla = (row.SLAResult || row.SLAPassed || row.IsSLAPassed || row.SLAStatus || '').toString().toLowerCase();
  if (/fail|false|no/.test(sla)) return 'fail';
  return 'pass';
}

// ─── AGGREGATION ─────────────────────────────────────────────────────────────

export function aggregateCWO(rows) {
  const total = rows.length;
  let resolved = 0, active = 0, cancelled = 0, slaFail = 0, slaPass = 0;
  const priCounts = {}, locCounts = {}, evtCounts = {}, assetCounts = {};
  for (const r of rows) {
    const status = getRowStatus(r);
    if (status === 'cancelled')     cancelled++;
    else if (status === 'resolved') resolved++;
    else                            active++;
    getSLAStatus(r) === 'fail' ? slaFail++ : slaPass++;
    const pri = r.Priority_Name || r.PriorityId || 'Unknown';
    priCounts[pri] = (priCounts[pri] || 0) + 1;
    const loc = r.TopLocation_Name || r.Location_Name || r.LocationId || 'Unknown';
    locCounts[loc] = (locCounts[loc] || 0) + 1;
    // Use saved ProblemType_Name from enriched CSV if available, else keyword-match
    const evt = (r.ProblemType_Name && r.ProblemType_Name !== 'Other')
      ? r.ProblemType_Name
      : getEventLabel(r);
    evtCounts[evt] = (evtCounts[evt] || 0) + 1;
    const assetName = r.Asset_Name || '';
    const assetLoc  = r.Location_FullName || '';
    const asset = assetName
      ? (assetLoc ? `${assetName} (${assetLoc})` : assetName)
      : '';
    if (asset) assetCounts[asset] = (assetCounts[asset] || 0) + 1;
  }
  return {
    total, resolved, active, cancelled,
    resolvePct: _pct(resolved, total), activePct: _pct(active, total),
    slaPass, slaFail,
    slaPassPct: _pct(slaPass, total), slaFailPct: _pct(slaFail, total),
    priorities: toSortedArr(priCounts),
    locations:  toSortedArr(locCounts, 6),
    events:     toSortedArr(evtCounts, 10),
    assets:     toSortedArr(assetCounts, 5),
  };
}

export function aggregateCases(rows) {
  const total = rows.length;
  let resolved = 0, active = 0, cancelled = 0, slaFail = 0, slaPass = 0;
  const priCounts = {}, locCounts = {}, evtCounts = {}, assetCounts = {};
  for (const r of rows) {
    const status = getRowStatus(r);
    if (status === 'cancelled')     cancelled++;
    else if (status === 'resolved') resolved++;
    else                            active++;
    getSLAStatus(r) === 'fail' ? slaFail++ : slaPass++;
    const pri = r.Priority_Name || r.PriorityLevelId || 'Unknown';
    priCounts[pri] = (priCounts[pri] || 0) + 1;
    const loc = r.Location_Name || r.LocationId || 'Unknown';
    locCounts[loc] = (locCounts[loc] || 0) + 1;
    const evt = getCaseEventLabel(r);
    evtCounts[evt] = (evtCounts[evt] || 0) + 1;
    const assetName = r.Asset_Name || '';
    const assetLoc  = r.Location_FullName || '';
    const asset = assetName
      ? (assetLoc ? `${assetName} (${assetLoc})` : assetName)
      : '';
    if (asset) assetCounts[asset] = (assetCounts[asset] || 0) + 1;
  }
  return {
    total, resolved, active, cancelled,
    resolvePct: _pct(resolved, total), activePct: _pct(active, total),
    slaPass, slaFail,
    slaPassPct: _pct(slaPass, total), slaFailPct: _pct(slaFail, total),
    priorities: toSortedArr(priCounts),
    locations:  toSortedArr(locCounts, 6),
    events:     toSortedArr(evtCounts, 10),
    assets:     toSortedArr(assetCounts, 5),
  };
}

export function aggregatePPM(rows) {
  const total = rows.length;
  let closed = 0, inProgress = 0, overdue = 0, cancelled = 0;
  const freqCounts = {}, zoneCounts = {}, taskCatCounts = {}, mainCatCounts = {};
  for (const r of rows) {
    const isOD  = /true|1|yes/i.test(r.IsOverdue   || '');
    const isCxl = /true|1|yes/i.test(r.IsCancelled || '');
    const isAct = /true|1|yes/i.test(r.IsActive    || '');
    if (isCxl)      cancelled++;
    else if (isOD)  overdue++;
    else if (isAct) inProgress++;
    else            closed++;

    const freq = r.FrequencyType_Name || r.FrequencyId || 'Unknown';
    freqCounts[freq] = (freqCounts[freq] || 0) + 1;

    const zone = (r.Location_Custom || '').trim() || 'Building-wide';
    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;

    // Use enriched columns if present, else derive on-the-fly
    const taskCat = (r.PPM_Task_Category && r.PPM_Task_Category !== 'Uncategorised')
      ? r.PPM_Task_Category
      : getPPMTaskCategoryLabel(r);
    taskCatCounts[taskCat] = (taskCatCounts[taskCat] || 0) + 1;

    const mainCat = (r.PPM_Main_Category && r.PPM_Main_Category !== 'Uncategorised')
      ? r.PPM_Main_Category
      : getPPMMainCategoryLabel(r);
    mainCatCounts[mainCat] = (mainCatCounts[mainCat] || 0) + 1;
  }
  const nonCxl = total - cancelled;
  return {
    total, closed, inProgress, overdue, cancelled,
    closedPct:     _pct(closed,  total),
    overduePct:    _pct(overdue, total),
    compliancePct: _pct(closed,  nonCxl || 1),
    frequencies:   toSortedArr(freqCounts, 8),
    zones:         toSortedArr(zoneCounts, 15),
    // 'categories' kept for backward compat — now uses task categories
    categories:    toSortedArr(taskCatCounts, 12),
    mainCategories: toSortedArr(mainCatCounts),
  };
}

// For CWO — uses keyword matching
export function evtCountsFromRows(rows) {
  const c = {};
  rows.forEach(r => { const e = getEventLabel(r); c[e] = (c[e] || 0) + 1; });
  return c;
}

// For Cases — uses enriched EventType_Description directly
export function evtCountsFromRowsCases(rows) {
  const c = {};
  rows.forEach(r => { const e = getCaseEventLabel(r); c[e] = (c[e] || 0) + 1; });
  return c;
}

export function catCountsFromRows(rows) {
  const c = {};
  rows.forEach(r => {
    const k = (r.PPM_Task_Category && r.PPM_Task_Category !== 'Uncategorised')
      ? r.PPM_Task_Category
      : getPPMTaskCategoryLabel(r);
    c[k] = (c[k] || 0) + 1;
  });
  return c;
}

export function buildCmp(lwC, pwC) {
  return Array.from(new Set([...Object.keys(lwC), ...Object.keys(pwC)]))
    .map(type => ({ type, lw: lwC[type] || 0, pw: pwC[type] || 0, delta: (lwC[type] || 0) - (pwC[type] || 0) }))
    .sort((a, b) => b.lw - a.lw || b.pw - a.pw)
    .slice(0, 12);
}
