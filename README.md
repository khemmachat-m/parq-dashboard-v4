# PARQ Hotspot Analytics — v4

**JLL Smart City OB · JOB152 · The PARQ, Bangkok**

Standalone hotspot analytics dashboard.  
Reads enriched CSVs produced by **parq-dashboard** (Process 1) directly — no IndexedDB bridge needed.

---

## Data Sources

Expects these enriched CSV files (output of parq-dashboard Process 1):

| File | Description |
|---|---|
| `PARQ_CWO_Enriched.csv` | Corrective Work Orders with resolved labels |
| `PARQ_Case_Enriched.csv` | Cases with resolved labels |
| `PARQ_PPM_Enriched.csv` | PPM Work Orders with resolved labels |

### Auto-load path (GitHub)
```
https://raw.githubusercontent.com/Khemmachat-m/parq-dashboard/main/public/enriched/
```
Click **☁️ Load from GitHub** on the load panel to fetch all three files automatically.

### Manual upload
Drag-and-drop or select each `_Enriched.csv` file from your local working folder.

---

## Features

### 📋 Table View
- Groups all records (CWO + Cases + PPM) by: **Location / Event Type / Problem Type / Asset**
- Hotspot highlighting (top row 🔥, others ●)
- Distribution bar showing CWO / Cases / PPM split
- **Drill-down** per group: expandable sub-table with column sort, filter, source chip
- Full detail modal on record click

### 📊 Analytics View
- **Monthly Trend** — line chart of record volume over time
- **Top Locations** — horizontal bar, top 10
- **Top Event Types** — horizontal bar, top 10
- **Top Problem Types** — CWO + Cases only
- **Top Assets** — most affected equipment
- **Status Distribution** — stacked bar per source
- **Priority Breakdown** — Critical / High / Medium / Low
- **Service Mix** — Hard vs Soft donut

### Filters (apply to both views)
- **Date range** — From / To with quick presets (Last 7d, Last 30d, This month, Last month, This year)
- **Service type** — All / Hard / Soft

---

## Column Auto-Detection

`src/utils/columnMapper.js` tries multiple candidate column names per field, supporting:
- Enriched label columns (`Location`, `EventType`, `AssetName`, etc.)
- Original Mozart ID columns as fallback
- Mixed export generations

---

## Setup

```bash
npm install
npm run dev        # local dev
npm run build      # production build → dist/
```

## Deploy to GitHub Pages

1. Push to `Khemmachat-m/parq-dashboard-v4` on GitHub
2. Settings → Pages → Source → **GitHub Actions**
3. GitHub Actions will auto-build and deploy on every push to `main`

Live URL: `https://khemmachat-m.github.io/parq-dashboard-v4/`

---

## Project Structure

```
src/
├── App.jsx                        ← App shell, service filter, data state
├── main.jsx                       ← React entry point
├── constants.js                   ← Colors, thresholds, GitHub URLs
├── components/
│   ├── LoadPanel.jsx              ← GitHub auto-load + manual upload
│   ├── HotspotPanel.jsx           ← Main hotspot container (table + analytics tabs)
│   ├── HotspotCharts.jsx          ← All analytics charts (Recharts)
│   ├── HotspotDrillDown.jsx       ← Expandable drill-down sub-table
│   ├── DetailModal.jsx            ← Full record detail popup
│   ├── ColFilter.jsx              ← Column dropdown filter
│   └── Atoms.jsx                  ← Badge, PriDot, SrcChip, MiniBar
└── utils/
    ├── columnMapper.js            ← Flexible enriched CSV column detection
    ├── dateHelpers.js             ← Date parsing, presets, month formatting
    └── classifyService.js         ← Hard / Soft service classification
```
