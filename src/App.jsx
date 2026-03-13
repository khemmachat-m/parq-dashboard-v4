/**
 * App.jsx — parq-dashboard-v4
 * PARQ Hotspot Analytics Dashboard
 * Standalone: reads enriched CSVs directly (no IndexedDB bridge needed)
 */
import { useState, useMemo } from 'react';
import LoadPanel from './components/LoadPanel.jsx';
import HotspotPanel from './components/HotspotPanel.jsx';
import { classifyService } from './utils/classifyService.js';

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ data, onReset }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
      <div style={{ background:'linear-gradient(135deg,#f97316,#dc2626)', borderRadius:14,
        width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:24, flexShrink:0, boxShadow:'0 0 20px #f9731644' }}>🔥</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:22, fontWeight:800, color:'#f1f5f9',
          fontFamily:"'Syne',sans-serif", letterSpacing:'-0.5px' }}>
          PARQ Hotspot Analytics
        </div>
        <div style={{ fontSize:12, color:'#475569', marginTop:1 }}>
          JLL Smart City OB · JOB152 · v4
        </div>
      </div>
      {data && (
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div style={{ fontSize:11, color:'#475569', background:'#0f172a',
            border:'1px solid #1e3a5f', borderRadius:8, padding:'6px 12px', lineHeight:1.6 }}>
            <span style={{color:'#34d399',fontWeight:700}}>✓ {data.source === 'github' ? 'Loaded from GitHub' : 'Uploaded'}</span>
            <span style={{color:'#334155', margin:'0 6px'}}>·</span>
            <span style={{color:'#38bdf8'}}>{data.cwo.length} CWO</span>
            <span style={{color:'#334155', margin:'0 4px'}}>·</span>
            <span style={{color:'#a78bfa'}}>{data.cases.length} Cases</span>
            <span style={{color:'#334155', margin:'0 4px'}}>·</span>
            <span style={{color:'#34d399'}}>{data.ppm.length} PPM</span>
          </div>
          <button onClick={onReset}
            style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #1e3a5f',
              background:'transparent', color:'#475569', fontSize:11, fontWeight:700,
              cursor:'pointer' }}>
            ↺ Change Data
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Service filter bar ───────────────────────────────────────────────────────
function ServiceFilter({ value, onChange }) {
  const opts = [
    { key:'ALL',  label:'All Services', icon:'🌐', color:'#94a3b8' },
    { key:'Hard', label:'Hard Service',  icon:'⚙️', color:'#38bdf8' },
    { key:'Soft', label:'Soft Service',  icon:'🧹', color:'#fb923c' },
  ];
  return (
    <div style={{ display:'flex', gap:8, marginBottom:20, alignItems:'center',
      background:'#0f172a', borderRadius:12, padding:'10px 16px', border:'1px solid #1e293b' }}>
      <span style={{ fontSize:11, fontWeight:700, color:'#475569',
        textTransform:'uppercase', letterSpacing:1.5, marginRight:4 }}>Service:</span>
      {opts.map(s => (
        <button key={s.key} onClick={() => onChange(s.key)}
          style={{ padding:'7px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700,
            border:`1.5px solid ${value===s.key?s.color:'#1e293b'}`,
            background:value===s.key?`${s.color}22`:'transparent',
            color:value===s.key?s.color:'#475569', transition:'all .2s',
            boxShadow:value===s.key?`0 0 12px ${s.color}33`:'none' }}>
          {s.icon} {s.label}
        </button>
      ))}
      <div style={{ marginLeft:'auto', fontSize:11, color:'#334155' }}>
        {value==='Hard' && <><span style={{color:'#38bdf8',fontWeight:700}}>⚙️ Engineering</span> · AHU, FCU, Pump, CCTV, Lift…</>}
        {value==='Soft' && <><span style={{color:'#fb923c',fontWeight:700}}>🧹 Support</span> · Pest, Cleaning, Housekeeping, Security…</>}
        {value==='ALL'  && 'Showing all service types'}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [data,          setData]          = useState(null);
  const [serviceFilter, setServiceFilter] = useState('ALL');

  // Tag records with _service on load
  const taggedData = useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      cwo:   data.cwo.map(r   => ({ ...r, _service:classifyService(r) })),
      cases: data.cases.map(r => ({ ...r, _service:classifyService(r) })),
      ppm:   data.ppm.map(r   => ({ ...r, _service:classifyService(r) })),
    };
  }, [data]);

  return (
    <div style={{ fontFamily:"'Outfit',system-ui,sans-serif", background:'#080f1a',
      minHeight:'100vh', padding:'20px 20px 60px', color:'#e2e8f0' }}>

      <Header data={data} onReset={() => setData(null)} />

      {/* Load panel shown until data is loaded */}
      {!data && <LoadPanel onLoad={setData} />}

      {/* Main dashboard */}
      {taggedData && (
        <>
          <ServiceFilter value={serviceFilter} onChange={setServiceFilter} />

          <div style={{ background:'#0f172a', borderRadius:16, padding:24,
            boxShadow:'0 2px 16px rgba(0,0,0,.4)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <span style={{ fontSize:18, fontWeight:800, color:'#f97316',
                fontFamily:"'Syne',sans-serif" }}>🔥 Hotspot Analysis</span>
            </div>
            <div style={{ fontSize:13, color:'#475569', marginBottom:20 }}>
              CWO + Cases + PPM grouped by dimension — Table view with drill-down, and Analytics charts.
            </div>
            <HotspotPanel
              cwo={taggedData.cwo}
              cases={taggedData.cases}
              ppm={taggedData.ppm}
              serviceFilter={serviceFilter}
            />
          </div>
        </>
      )}
    </div>
  );
}
