// ═══════════════════════════════════════════════════════════════════
// CONFIG — PARQ Dashboard Generator · JLL · JOB152
// ═══════════════════════════════════════════════════════════════════

export const MASTER_CFG = [
  { key: 'priorities',        label: 'Priorities',          filename: 'Priorities.csv',                req: true,  tabs: ['cwo', 'cases', 'ppm'] },
  { key: 'locations',         label: 'Locations',           filename: 'Locations.csv',                 req: true,  tabs: ['cwo', 'cases', 'ppm'] },
  { key: 'assets',            label: 'Assets',              filename: 'Assets.csv',                    req: false, tabs: ['cwo', 'cases', 'ppm'] },
  { key: 'problemTypes',      label: 'Problem Types',       filename: 'Problem_Types.csv',             req: false, tabs: ['cwo'] },
  { key: 'eventTypes',        label: 'Event Types',         filename: 'Event_Types.csv',               req: false, tabs: ['cases'] },
  { key: 'serviceCategories', label: 'Service Categories',  filename: 'MZ_PARQ_Service_Categories.csv',req: false, tabs: ['ppm'] },
  { key: 'frequencyTypes',    label: 'Frequency Types',     filename: 'MZ_PARQ_Frequency_Types.csv',   req: false, tabs: ['ppm'] },
];

export const TX_CFG = {
  cwo:   { pattern: 'MZ_PARQ_CWO_*.csv',   prefix: 'PARQ_CWO_Enriched' },
  cases: { pattern: 'MZ_PARQ_Cases_*.csv', prefix: 'PARQ_Case_Enriched' },
  ppm:   { pattern: 'MZ_PARQ_PPM_*.csv',   prefix: 'PARQ_PPM_Enriched' },
};

export const TX_STANDARD = {
  cwo:   'PARQ_CWO_Export.csv',
  cases: 'PARQ_Cases_Export.csv',
  ppm:   'PARQ_PPM_Export.csv',
};

export const TX_ENRICHED = {
  cwo:   'PARQ_CWO_Enriched.csv',
  cases: 'PARQ_Cases_Enriched.csv',
  ppm:   'PARQ_PPM_Enriched.csv',
};

export const TX_LABELS = {
  cwo:   { icon: '🔧', label: 'Corrective Work Orders', hint: 'Contains: CWO, Corrective, Work Order' },
  cases: { icon: '📋', label: 'Case Management',        hint: 'Contains: Case, Case Management' },
  ppm:   { icon: '📅', label: 'PPM Work Orders',        hint: 'Contains: PPM, Preventive, Maintenance, Planned' },
};

export const DATE_FIELDS = {
  cwo:   ['CreatedOn', 'SubmittedDate', 'RequestedDate', 'OpenedDate'],
  cases: ['CreatedOn', 'SubmittedDate', 'OpenedDate', 'ReportedDate'],
  ppm:   ['PlannedDate', 'ScheduledDate', 'DueDate', 'CreatedOn'],
};
