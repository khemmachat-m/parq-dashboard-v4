/**
 * columnMapper.js
 * Auto-detects human-readable enriched CSV column names.
 * Tries candidates in priority order; falls back to empty string.
 *
 * Handles enriched output from parq-dashboard (v1) which may use:
 *   - Label columns added by enrichment:  Location, EventType, AssetName, etc.
 *   - Original Mozart columns still present: LocationId, EventTypeId, etc.
 *   - Mixed naming from different export generations.
 */

// ─── Candidate column names per internal key ──────────────────────────────────

const CWO_CANDIDATES = {
  id:          ['Name','WO_Number','WorkOrderNo','WorkOrder','Id'],
  date:        ['CreatedOn','Created On','CreateDate','Date','OpenedDate'],
  location:    ['Location','LocationName','LocationFullName','FullName','LocationLabel','Site'],
  eventType:   ['EventType','EventTypeName','Event Type','EventTypeLabel','EventTypeDescription','EventTypeDesc'],
  problemType: ['ProblemType','ProblemTypeName','Problem Type','ProblemTypeLabel','ProblemTypeDesc'],
  asset:       ['AssetName','Asset','AssetLabel','EquipmentName','Equipment','AssetDesc'],
  priority:    ['Priority','PriorityName','PriorityLabel'],
  status:      ['Status','StatusName','StatusLabel'],
  description: ['Description','ShortDescription','ShortDesc','Subject','Summary'],
  resolution:  ['ClosureComment','Resolution','CompletionComment','ClosingComment'],
  technician:  ['CreatedBy','Technician','AssignedTo','HandledBy','Engineer'],
  category:    ['Category','ServiceCategory','ServiceCategoryName'],
};

const CASES_CANDIDATES = {
  id:          ['CaseNo','CaseNumber','Id','CaseId','Name'],
  date:        ['CreatedOn','Created On','Date','OpenedDate','ReportDate'],
  location:    ['LocationName','Location','LocationFullName','FullName','LocationLabel','Site'],
  eventType:   ['EventType','EventTypeName','Event Type','EventTypeLabel'],
  problemType: ['ProblemType','ProblemTypeName','Problem Type','ProblemTypeLabel'],
  asset:       ['AssetName','Asset','EquipmentTag','Equipment','EquipmentName','AssetLabel'],
  priority:    ['Priority','PriorityName','PriorityLabel'],
  status:      ['Status','StatusName','StatusLabel'],
  subject:     ['Description','Subject','Summary','CaseDescription','ShortDescription'],
  description: ['Description','Details','CaseDetails'],
  completioncomment: ['CompletionComment','CompletedComment','ResolutionComment'],
  closurecomment:    ['ClosureComment','ClosingComment','CloseComment'],
  raisedBy:    ['CreatedBy','RaisedBy','ReportedBy','ReportedByName','RaisedByName'],
  category:    ['Category','ServiceCategory','ServiceCategoryName'],
};

const PPM_CANDIDATES = {
  id:          ['Id','PPM_Id','Name','WorkOrderId','TaskId'],
  date:        ['CreatedOn','Created On','Date','ScheduledDate','PlannedDate'],
  location:    ['Location','LocationName','LocationFullName','FullName','Site'],
  eventType:   ['EventType','EventTypeName','Event Type','EventTypeLabel'],
  asset:       ['AssetName','Asset','EquipmentName','Equipment','AssetLabel'],
  frequency:   ['FrequencyType','FrequencyTypeName','Frequency','FrequencyLabel'],
  status:      ['Status','StatusName','StatusLabel'],
  completion:  ['ActualCompletion','Completion','CompletionPercentage','CompletionPct','Progress'],
  isOverdue:   ['IsOverdue','Overdue'],
  isCancelled: ['IsCancelled','Cancelled'],
  isActive:    ['IsActive','Active'],
  closedOn:    ['ClosedOn','ClosedDate','CompletedDate'],
  completedBy: ['CompletedBy','ClosedBy'],
  technician:  ['CreatedBy','Technician','AssignedTo','Engineer'],
  category:    ['Category','ServiceCategory','ServiceCategoryName'],
};

// ─── Core resolver ────────────────────────────────────────────────────────────
/**
 * Given a CSV row (object with original column names as keys),
 * resolve candidates in order, returning the first non-empty match.
 */
function resolve(row, candidates) {
  for (const col of candidates) {
    const val = row[col];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

// ─── Public mappers ───────────────────────────────────────────────────────────

export function mapCWORow(raw) {
  const r = raw;
  return {
    id:          resolve(r, CWO_CANDIDATES.id),
    date:        resolve(r, CWO_CANDIDATES.date),
    location:    resolve(r, CWO_CANDIDATES.location)    || '—',
    eventType:   resolve(r, CWO_CANDIDATES.eventType)   || '—',
    problemType: resolve(r, CWO_CANDIDATES.problemType) || '—',
    asset:       resolve(r, CWO_CANDIDATES.asset)       || '—',
    priority:    resolve(r, CWO_CANDIDATES.priority)    || '—',
    status:      resolve(r, CWO_CANDIDATES.status)      || '—',
    description: resolve(r, CWO_CANDIDATES.description),
    resolution:  resolve(r, CWO_CANDIDATES.resolution),
    technician:  resolve(r, CWO_CANDIDATES.technician),
    category:    resolve(r, CWO_CANDIDATES.category),
    _raw:        r,   // keep raw row for inspection
  };
}

export function mapCasesRow(raw) {
  const r = raw;
  return {
    id:               resolve(r, CASES_CANDIDATES.id),
    date:             resolve(r, CASES_CANDIDATES.date),
    location:         resolve(r, CASES_CANDIDATES.location)    || '—',
    eventType:        resolve(r, CASES_CANDIDATES.eventType)   || '—',
    problemType:      resolve(r, CASES_CANDIDATES.problemType) || '—',
    asset:            resolve(r, CASES_CANDIDATES.asset)       || '—',
    priority:         resolve(r, CASES_CANDIDATES.priority)    || '—',
    status:           resolve(r, CASES_CANDIDATES.status)      || '—',
    subject:          resolve(r, CASES_CANDIDATES.subject),
    description:      resolve(r, CASES_CANDIDATES.description),
    completioncomment:resolve(r, CASES_CANDIDATES.completioncomment),
    closurecomment:   resolve(r, CASES_CANDIDATES.closurecomment),
    raisedBy:         resolve(r, CASES_CANDIDATES.raisedBy),
    category:         resolve(r, CASES_CANDIDATES.category),
    _raw:             r,
  };
}

export function mapPPMRow(raw) {
  const r = raw;
  // Derive status from boolean flags (same logic as v2) if status column is empty
  let status = resolve(r, PPM_CANDIDATES.status);
  if (!status || status === '—') {
    const bool = v => String(v).toLowerCase() === 'true';
    if (bool(r.IsOverdue || r.Overdue))        status = 'Overdue';
    else if (bool(r.IsCancelled || r.Cancelled)) status = 'Cancelled';
    else if (r.ClosedOn || r.CompletedBy)        status = 'Completed';
    else if (bool(r.IsActive || r.Active))       status = 'In Progress';
    else                                         status = 'Scheduled';
  }
  // Completion % — normalise to numeric
  let completion = resolve(r, PPM_CANDIDATES.completion);
  if (completion) {
    const n = parseFloat(String(completion).replace('%',''));
    completion = isNaN(n) ? '' : String(Math.round(n));
  }
  return {
    id:          resolve(r, PPM_CANDIDATES.id),
    date:        resolve(r, PPM_CANDIDATES.date),
    location:    resolve(r, PPM_CANDIDATES.location)  || '—',
    eventType:   resolve(r, PPM_CANDIDATES.eventType) || '—',
    asset:       resolve(r, PPM_CANDIDATES.asset)     || '—',
    frequency:   resolve(r, PPM_CANDIDATES.frequency) || '—',
    category:    resolve(r, PPM_CANDIDATES.category),
    status,
    completion,
    technician:  resolve(r, PPM_CANDIDATES.technician),
    _raw:        r,
  };
}

// ─── Detect which columns were found (for debug banner) ───────────────────────
export function detectColumns(rows, candidates) {
  if (!rows || !rows.length) return {};
  const headers = Object.keys(rows[0]);
  const found = {};
  for (const [key, cands] of Object.entries(candidates)) {
    found[key] = cands.find(c => headers.includes(c)) || null;
  }
  return found;
}
