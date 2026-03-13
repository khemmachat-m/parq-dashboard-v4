// ═══════════════════════════════════════════════════════════════════
// ENRICHMENT  — joins raw Mozart exports with master data lookups
// ═══════════════════════════════════════════════════════════════════
import { S } from './state.js';
import { lookup } from './masters.js';
import { getEventLabel, getPPMTaskCategoryLabel, getPPMMainCategoryLabel, getLocationCustom } from './aggregate.js';

export function enrichCases(rows, M) {
  const { priority, location, assetByTag, eventTypeByCode } = M;
  return rows.map(row => {
    const out = { ...row };
    const p = lookup(priority, row.PriorityLevelId);
    if (p.Name) out.Priority_Name = p.Name;
    const l = lookup(location, row.LocationId);
    if (l.LocationCode)      out.Location_LocationCode      = l.LocationCode;
    if (l.Name)              out.Location_Name              = l.Name;
    if (l.FullName)          out.Location_FullName          = l.FullName;
    if (l.FloorNo)           out.Location_FloorNo           = l.FloorNo;
    if (l.ExternalReference) out.Location_ExternalReference = l.ExternalReference;
    // Asset join: EquipmentTag (Cases row) → EquipmentTag (Assets.csv)
    const tagKey = (row.EquipmentTag || '').trim().toLowerCase();
    const a = (assetByTag && tagKey) ? (assetByTag[tagKey] || {}) : {};
    out.Asset_Id                = a.Id                || '';
    out.Asset_LocationId        = a.LocationId        || '';
    out.Asset_Manufacturer      = a.Manufacturer      || '';
    out.Asset_Model             = a.Model             || '';
    out.Asset_Name              = a.Name              || '';
    out.Asset_OperationalStatus = a.OperationalStatus || '';
    out.Asset_ParentAssetId     = a.ParentAssetId     || '';
    out.Asset_SerialNumber      = a.SerialNumber      || '';
    const et = lookup(eventTypeByCode, row.EventTypeCode);
    if (et.Id)              out.EventType_Id              = et.Id;
    if (et.Description)     out.EventType_Description     = et.Description;
    if (et.EventCategoryId) out.EventType_EventCategoryId = et.EventCategoryId;
    if (et.PriorityLevelId) out.EventType_PriorityLevelId = et.PriorityLevelId;
    return out;
  });
}

export function enrichCWO(rows, M) {
  const { priority, location, asset, problemType } = M;
  return rows.map(row => {
    const out = { ...row };
    const p = lookup(priority, row.PriorityId);
    if (p.Name) out.Priority_Name = p.Name;
    const l = lookup(location, row.LocationId);
    if (l.LocationCode)      out.Location_LocationCode      = l.LocationCode;
    if (l.Name)              out.Location_Name              = l.Name;
    if (l.FullName)          out.Location_FullName          = l.FullName;
    if (l.FloorNo)           out.Location_FloorNo           = l.FloorNo;
    if (l.ExternalReference) out.Location_ExternalReference = l.ExternalReference;
    const top = lookup(location, row.TopLocationId);
    if (top.Name)         out.TopLocation_Name     = top.Name;
    if (top.FullName)     out.TopLocation_FullName = top.FullName;
    if (top.LocationCode) out.TopLocation_Code     = top.LocationCode;
    // Asset join: AssetId (CWO row) → Id (Assets.csv)
    const a = lookup(asset, row.AssetId);
    out.Asset_Id                = a.Id                || '';
    out.Asset_LocationId        = a.LocationId        || '';
    out.Asset_Manufacturer      = a.Manufacturer      || '';
    out.Asset_Model             = a.Model             || '';
    out.Asset_Name              = a.Name              || '';
    out.Asset_OperationalStatus = a.OperationalStatus || '';
    out.Asset_ParentAssetId     = a.ParentAssetId     || '';
    out.Asset_SerialNumber      = a.SerialNumber      || '';
    const pt = lookup(problemType, row.ProblemTypeId);
    if (pt.Code)        out.ProblemType_Code        = pt.Code;
    if (pt.Description) out.ProblemType_Description = pt.Description;
    // Keyword-matched problem type label — user can review/correct in the CSV
    out.ProblemType_Name = getEventLabel(out);
    return out;
  });
}

export const PPM_STATUS = {
  1: 'Scheduled', 2: 'In Progress', 3: 'Overdue',
  4: 'Completed', 5: 'Cancelled',   7: 'Closed', 8: 'Cancelled',
};

export function enrichPPM(rows, M) {
  const { priority, location, asset, serviceCategory, frequencyType } = M;
  return rows.map(row => {
    const out = { ...row };
    const p = lookup(priority, row.PriorityId);
    if (p.Name)      out.Priority_Name      = p.Name;
    if (p.ColorCode) out.Priority_ColorCode = p.ColorCode;
    const l = lookup(location, row.LocationId);
    if (l.LocationCode)      out.Location_LocationCode      = l.LocationCode;
    if (l.Name)              out.Location_Name              = l.Name;
    if (l.FullName)          out.Location_FullName          = l.FullName;
    if (l.FloorNo)           out.Location_FloorNo           = l.FloorNo;
    if (l.ExternalReference) out.Location_ExternalReference = l.ExternalReference;
    const top = lookup(location, row.TopLocationId);
    if (top.Name)         out.TopLocation_Name     = top.Name;
    if (top.FullName)     out.TopLocation_FullName = top.FullName;
    if (top.LocationCode) out.TopLocation_Code     = top.LocationCode;
    const a = lookup(asset, row.AssetId);
    if (a.Name)         out.Asset_Name         = a.Name;
    if (a.EquipmentTag) out.Asset_EquipmentTag = a.EquipmentTag;
    const svc = lookup(serviceCategory, row.ServiceCategoryId);
    if (svc.Name) out.ServiceCategory_Name = svc.Name;
    if (svc.Code) out.ServiceCategory_Code = svc.Code;
    const fr = lookup(frequencyType, row.FrequencyTypeId);
    if (fr.Name) out.FrequencyType_Name = fr.Name;
    if (fr.Code) out.FrequencyType_Code = fr.Code;
    out.Status_Label = PPM_STATUS[+row.StatusId] || 'Unknown';
    // Keyword-derived category columns — user can review/correct in the enriched CSV
    out.PPM_Task_Category = getPPMTaskCategoryLabel(out);
    out.PPM_Main_Category = getPPMMainCategoryLabel(out);
    out.Location_Custom   = getLocationCustom(out);
    return out;
  });
}

/** Dispatch enrichment to the correct function based on tab */
export function enrichForTab(tab, rows) {
  if (tab === 'cases') return enrichCases(rows, S.masters);
  if (tab === 'cwo')   return enrichCWO(rows, S.masters);
  if (tab === 'ppm')   return enrichPPM(rows, S.masters);
  return rows;
}

export function enrich(rows) { return enrichForTab(S.tab, rows); }
