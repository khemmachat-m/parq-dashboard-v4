/**
 * HotspotPanel.jsx
 * Main Hotspot container.
 * Sub-tabs: Table (grouped) | Analytics (charts)
 */
import { useState, useMemo } from 'react';
import { SRC_COLOR, HOTSPOT_THRESH } from '../constants.js';
import { parseDateToISO, DATE_PRESETS } from '../utils/dateHelpers.js';
import { classifyService } from '../utils/classifyService.js';
import HotspotDrillDown from './HotspotDrillDown.jsx';
import HotspotCharts from './HotspotCharts.jsx';
import DetailModal from './DetailModal.jsx';

const DIM_OPTS = [
  { key:'location',    label:'Location'     },
  { key:'eventType',   label:'Event Type'   },
  { key:'problemType', label:'Problem Type' },
  { key:'asset',       label:'Asset'        },
];

export default function HotspotPanel({ cwo, cases, ppm, serviceFilter }) {
  const [dim,         setDim]         = useState('location');
  const [expandedRow, setExpandedRow] = useState(null);
  const [modalRec,    setModalRec]    = useState(null);
  const [modalType,   setModalType]   = useState(null);
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [subTab,      setSubTab]      = useState('table'); // 'table' | 'analytics'

  // Tag all records with source + service
  const tagged = useMemo(() => {
    const tag = (arr, src) => arr.map(r => ({ ...r, _src:src, _service:classifyService(r) }));
    let all = [...tag(cwo,'CWO'), ...tag(cases,'Case'), ...tag(ppm,'PPM')];
    if (serviceFilter !== 'ALL') all = all.filter(r => r._service === serviceFilter);
    if (dateFrom) all = all.filter(r => parseDateToISO(r.date) >= dateFrom);
    if (dateTo)   all = all.filter(r => parseDateToISO(r.date) <= dateTo);
    return all;
  }, [cwo, cases, ppm, serviceFilter, dateFrom, dateTo]);

  // Grouped table data
  const groups = useMemo(() => {
    const map = {};
    tagged.forEach(r => {
      const key = r[dim] || 'Unknown';
      if (!map[key]) map[key] = { key, CWO:0, Case:0, PPM:0, total:0, records:[] };
      map[key][r._src]++;
      map[key].total++;
      map[key].records.push(r);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [tagged, dim]);

  const maxTotal = groups[0]?.total || 1;
  const openDetail = r => { setModalRec(r); setModalType(r._src === 'Case' ? 'Cases' : r._src); };

  // ── Sub-tab buttons ──────────────────────────────────────────────────────────
  const SubTabBtn = ({ id, label }) => (
    <button onClick={() => setSubTab(id)}
      style={{ padding:'6px 16px', borderRadius:8, border:'none', cursor:'pointer',
        fontSize:12, fontWeight:700,
        background:subTab===id?'#f97316':'#1e293b',
        color:subTab===id?'#0f172a':'#64748b', transition:'all .15s' }}>
      {label}
    </button>
  );

  return (
    <>
      {/* ── Controls bar ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>

        {/* Sub-tabs */}
        <div style={{ display:'flex', gap:4, background:'#080f1a', borderRadius:10, padding:4,
          border:'1px solid #1e293b' }}>
          <SubTabBtn id="table"     label="📋 Table"     />
          <SubTabBtn id="analytics" label="📊 Analytics" />
        </div>

        {/* Group-by (only relevant for table tab) */}
        {subTab === 'table' && (
          <>
            <span style={{ fontSize:12, color:'#475569', fontWeight:700, marginLeft:4 }}>GROUP BY:</span>
            {DIM_OPTS.map(d => (
              <button key={d.key} onClick={() => { setDim(d.key); setExpandedRow(null); }}
                style={{ padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                  fontSize:12, fontWeight:700,
                  background:dim===d.key?'#f97316':'#1e293b',
                  color:dim===d.key?'#0f172a':'#94a3b8', transition:'all .15s' }}>
                {d.label}
              </button>
            ))}
          </>
        )}

        {/* Date range */}
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'#080f1a',
          border:`1.5px solid ${(dateFrom||dateTo)?'#f97316':'#1e293b'}`, borderRadius:8,
          padding:'4px 10px', transition:'all .2s',
          boxShadow:(dateFrom||dateTo)?'0 0 10px #f9731622':'none' }}>
          <span style={{ fontSize:11, color:'#475569', fontWeight:600 }}>From</span>
          <input type="date" value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setExpandedRow(null); }}
            style={{ background:'none', border:'none', color:'#e2e8f0', fontSize:12,
              outline:'none', fontFamily:"'JetBrains Mono',monospace", cursor:'pointer' }} />
          <span style={{ fontSize:11, color:'#475569', fontWeight:600 }}>To</span>
          <input type="date" value={dateTo}
            onChange={e => { setDateTo(e.target.value); setExpandedRow(null); }}
            style={{ background:'none', border:'none', color:'#e2e8f0', fontSize:12,
              outline:'none', fontFamily:"'JetBrains Mono',monospace", cursor:'pointer' }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setExpandedRow(null); }}
              style={{ background:'none', border:'none', cursor:'pointer', color:'#f97316',
                fontSize:14, padding:'0 2px', lineHeight:1 }}>×</button>
          )}
        </div>

        {/* Quick presets */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {DATE_PRESETS.map(p => {
            const [pf, pt] = p.get();
            const active = dateFrom === pf && dateTo === pt;
            return (
              <button key={p.label} onClick={() => { setDateFrom(pf); setDateTo(pt); setExpandedRow(null); }}
                style={{ padding:'4px 9px', borderRadius:6,
                  border:`1px solid ${active?'#f97316':'#1e293b'}`, cursor:'pointer',
                  fontSize:10, fontWeight:active?700:500,
                  background:active?'#f9731622':'transparent',
                  color:active?'#f97316':'#475569', transition:'all .15s', whiteSpace:'nowrap' }}>
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Record counter */}
        <span style={{ marginLeft:'auto', fontSize:12, color:'#334155' }}>
          {serviceFilter !== 'ALL' && (
            <span style={{ color:serviceFilter==='Hard'?'#38bdf8':'#fb923c', fontWeight:700 }}>
              {serviceFilter} · {' '}
            </span>
          )}
          {(dateFrom || dateTo) && (
            <span style={{ color:'#f97316', fontWeight:700 }}>
              {dateFrom||'…'} → {dateTo||'…'} · {' '}
            </span>
          )}
          {tagged.length} records
          {subTab === 'table' && ` · ${groups.length} groups`}
        </span>
      </div>

      {/* ── Analytics tab ─────────────────────────────────────────────────────── */}
      {subTab === 'analytics' && <HotspotCharts tagged={tagged} />}

      {/* ── Table tab ─────────────────────────────────────────────────────────── */}
      {subTab === 'table' && (
        <>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#0a1628' }}>
                  {['','#','Group','CWO','Cases','PPM','Total','Distribution'].map(h => (
                    <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:10,
                      fontWeight:700, color:'#475569', textTransform:'uppercase',
                      letterSpacing:1.5, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px 10px',
                    color:'#334155', fontSize:13 }}>
                    No records match the current filters.
                  </td></tr>
                )}
                {groups.map((row, i) => {
                  const isHot      = row.total >= HOTSPOT_THRESH;
                  const isExpanded = expandedRow === row.key;
                  return (
                    <>
                      <tr key={row.key}
                        onClick={() => setExpandedRow(isExpanded ? null : row.key)}
                        style={{ borderTop:'1px solid #1e293b', cursor:'pointer',
                          transition:'background .15s',
                          background:isExpanded?'#0d1f36':isHot&&i===0?'#1a0a0a':'transparent' }}
                        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background='#0d1f2a'; }}
                        onMouseLeave={e => { e.currentTarget.style.background=isExpanded?'#0d1f36':isHot&&i===0?'#1a0a0a':'transparent'; }}>

                        <td style={{ padding:'11px 8px 11px 12px', width:24 }}>
                          <span style={{ fontSize:12, display:'inline-block', color:isExpanded?'#f97316':'#334155',
                            transition:'transform .2s', transform:isExpanded?'rotate(90deg)':'none' }}>▶</span>
                        </td>
                        <td style={{ padding:'11px 12px', fontSize:11, color:'#475569',
                          fontFamily:"'JetBrains Mono',monospace", width:32 }}>{i+1}</td>
                        <td style={{ padding:'11px 12px', fontSize:13,
                          color:isHot?'#f87171':'#e2e8f0', fontWeight:isHot?700:400 }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:7 }}>
                            {isHot && i===0 && <span>🔥</span>}
                            {isHot && i>0  && <span style={{ width:8, height:8, borderRadius:'50%',
                              background:'#f97316', flexShrink:0 }} />}
                            {row.key}
                          </span>
                        </td>
                        <td style={{ padding:'11px 12px', fontFamily:"'JetBrains Mono',monospace",
                          fontSize:13, color:'#38bdf8' }}>{row.CWO||0}</td>
                        <td style={{ padding:'11px 12px', fontFamily:"'JetBrains Mono',monospace",
                          fontSize:13, color:'#a78bfa' }}>{row.Case||0}</td>
                        <td style={{ padding:'11px 12px', fontFamily:"'JetBrains Mono',monospace",
                          fontSize:13, color:'#34d399' }}>{row.PPM||0}</td>
                        <td style={{ padding:'11px 12px', fontFamily:"'JetBrains Mono',monospace",
                          fontSize:14, fontWeight:800, color:isHot?'#f87171':'#e2e8f0' }}>{row.total}</td>
                        <td style={{ padding:'11px 12px' }}>
                          <div style={{ display:'flex', gap:1 }}>
                            {row.CWO  > 0 && <div style={{ height:9, background:'#38bdf8', borderRadius:'2px 0 0 2px',
                              width:`${Math.max(2,(row.CWO /maxTotal)*110)}px` }} />}
                            {row.Case > 0 && <div style={{ height:9, background:'#a78bfa',
                              width:`${Math.max(2,(row.Case/maxTotal)*110)}px` }} />}
                            {row.PPM  > 0 && <div style={{ height:9, background:'#34d399', borderRadius:'0 2px 2px 0',
                              width:`${Math.max(2,(row.PPM /maxTotal)*110)}px` }} />}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && <HotspotDrillDown records={row.records} onOpenDetail={openDetail} />}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop:12, fontSize:11, color:'#334155', display:'flex', gap:16, flexWrap:'wrap' }}>
            <span><span style={{color:'#38bdf8'}}>■</span> CWO</span>
            <span><span style={{color:'#a78bfa'}}>■</span> Cases</span>
            <span><span style={{color:'#34d399'}}>■</span> PPM</span>
            <span>🔥 Top hotspot  ●  Other hotspots (≥{HOTSPOT_THRESH})</span>
            <span style={{color:'#f97316'}}>▶ Click row to expand drill-down</span>
          </div>
        </>
      )}

      <DetailModal record={modalRec} type={modalType}
        onClose={() => { setModalRec(null); setModalType(null); }} />
    </>
  );
}
