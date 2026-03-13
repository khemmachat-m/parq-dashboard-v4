import { useState, useMemo } from 'react';
import { SRC_COLOR, PRI_ORDER } from '../constants.js';
import { Badge, PriDot, SrcChip, MiniBar } from './Atoms.jsx';
import ColFilter from './ColFilter.jsx';

const DRILL_COLS = [
  { key:'_src',     label:'Source',      sortable:true,  filterable:true  },
  { key:'id',       label:'ID',          sortable:true,  filterable:false },
  { key:'date',     label:'Date',        sortable:true,  filterable:false },
  { key:'location', label:'Location',    sortable:true,  filterable:true  },
  { key:'asset',    label:'Asset',       sortable:true,  filterable:true  },
  { key:'status',   label:'Status',      sortable:true,  filterable:true  },
  { key:'priority', label:'Priority',    sortable:true,  filterable:true  },
  { key:'_desc',    label:'Description', sortable:false, filterable:false },
];

export default function HotspotDrillDown({ records, onOpenDetail }) {
  const [srcFilter,  setSrcFilter]  = useState('All');
  const [sortCol,    setSortCol]    = useState('date');
  const [sortDir,    setSortDir]    = useState('desc');
  const [colFilters, setColFilters] = useState({});

  const filterValues = useMemo(() => {
    const out = {};
    DRILL_COLS.filter(c => c.filterable).forEach(c => {
      const vals = c.key === '_src'
        ? [...new Set(records.map(r => r._src))]
        : [...new Set(records.map(r => r[c.key]).filter(Boolean))];
      out[c.key] = vals.sort();
    });
    return out;
  }, [records]);

  const processed = useMemo(() => {
    let rows = srcFilter === 'All' ? records : records.filter(r => r._src === srcFilter);
    Object.entries(colFilters).forEach(([k, v]) => {
      if (!v || v === 'All') return;
      rows = rows.filter(r => (k === '_src' ? r._src : r[k]) === v);
    });
    rows = [...rows].sort((a, b) => {
      if (sortCol === 'priority') {
        const av = PRI_ORDER[a.priority] ?? 9, bv = PRI_ORDER[b.priority] ?? 9;
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const av = String(sortCol === '_src' ? a._src : a[sortCol] ?? '').toLowerCase();
      const bv = String(sortCol === '_src' ? b._src : b[sortCol] ?? '').toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return rows;
  }, [records, srcFilter, colFilters, sortCol, sortDir]);

  const handleSort = key => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(key); setSortDir('asc'); }
  };

  const activeFilters = Object.values(colFilters).filter(v => v && v !== 'All').length;
  const resetDrill    = () => { setColFilters({}); setSrcFilter('All'); setSortCol('date'); setSortDir('desc'); };

  return (
    <tr>
      <td colSpan={8} style={{ padding:0, background:'#050c18' }}>
        <div style={{ margin:'0 0 0 32px', borderLeft:'2px solid #1e3a5f', padding:'14px 0 14px 18px' }}>
          {/* Source chips */}
          <div style={{ display:'flex', gap:6, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:10, color:'#475569', fontWeight:700, letterSpacing:1.5,
              textTransform:'uppercase', marginRight:4 }}>Source:</span>
            {['All','CWO','Case','PPM'].map(s => {
              const cnt    = s === 'All' ? records.length : records.filter(r => r._src === s).length;
              const active = srcFilter === s;
              return (
                <button key={s} onClick={() => { setSrcFilter(s); setColFilters({}); }}
                  style={{ padding:'4px 12px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700,
                    border:`1px solid ${active?(SRC_COLOR[s]||'#f97316'):'#1e293b'}`,
                    background:active?`${(SRC_COLOR[s]||'#f97316')}22`:'transparent',
                    color:active?(SRC_COLOR[s]||'#f97316'):'#64748b', transition:'all .15s' }}>
                  {s} <span style={{ opacity:.65 }}>({cnt})</span>
                </button>
              );
            })}
            {(activeFilters > 0 || srcFilter !== 'All') && (
              <button onClick={resetDrill}
                style={{ padding:'4px 12px', borderRadius:6, border:'1px solid #f87171',
                  background:'#1a0a0a', color:'#f87171', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                ✕ Reset
              </button>
            )}
            <div style={{ marginLeft:'auto', display:'flex', gap:10, alignItems:'center' }}>
              {activeFilters > 0 && <span style={{ fontSize:11, color:'#f97316', fontWeight:700 }}>{activeFilters} filter{activeFilters>1?'s':''} active</span>}
              <span style={{ fontSize:11, color:'#334155', fontFamily:"'JetBrains Mono',monospace" }}>{processed.length}/{records.length} records</span>
            </div>
          </div>

          {/* Sub-table */}
          <div style={{ overflowX:'auto', paddingRight:16 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
              <thead>
                <tr style={{ background:'#081020' }}>
                  {DRILL_COLS.map(c => {
                    const isSorted  = sortCol === c.key;
                    const hasFilter = colFilters[c.key] && colFilters[c.key] !== 'All';
                    const accent    = '#f97316';
                    return (
                      <th key={c.key} style={{ padding:'9px 10px', textAlign:'left', whiteSpace:'nowrap',
                        fontSize:10, fontWeight:700, letterSpacing:1.3, textTransform:'uppercase',
                        userSelect:'none', color:isSorted||hasFilter?accent:'#475569',
                        borderBottom:`1px solid ${isSorted?'#f9731644':'#1e293b'}` }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                          {c.sortable
                            ? <span onClick={() => handleSort(c.key)}
                                style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:3,
                                  padding:'2px 4px', borderRadius:4, background:isSorted?'#f9731614':'transparent' }}>
                                {c.label}
                                <span style={{ fontSize:9, color:isSorted?accent:'#334155' }}>
                                  {isSorted ? (sortDir==='asc'?'↑':'↓') : '↕'}
                                </span>
                              </span>
                            : <span style={{ padding:'2px 4px' }}>{c.label}</span>}
                          {c.filterable && filterValues[c.key] && (
                            <ColFilter col={c.label} values={filterValues[c.key]}
                              active={colFilters[c.key]||'All'}
                              onChange={v => setColFilters(prev => ({ ...prev, [c.key]:v }))}
                              color={accent} />
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {processed.length === 0 && (
                  <tr><td colSpan={DRILL_COLS.length}
                    style={{ textAlign:'center', padding:'24px 10px', color:'#334155', fontSize:13 }}>
                    No records match your filters.
                  </td></tr>
                )}
                {processed.map((r, i) => {
                  const acc  = SRC_COLOR[r._src] || '#38bdf8';
                  const desc = r.description || r.subject || r.eventType || '—';
                  return (
                    <tr key={r.id || i} onClick={() => onOpenDetail(r)}
                      style={{ borderTop:'1px solid #0f1e30', cursor:'pointer',
                        background:i%2===0?'transparent':'#060d18', transition:'background .1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background=`${acc}11`; }}
                      onMouseLeave={e => { e.currentTarget.style.background=i%2===0?'transparent':'#060d18'; }}>
                      <td style={{ padding:'9px 10px' }}><SrcChip src={r._src} /></td>
                      <td style={{ padding:'9px 10px', fontSize:12, color:'#94a3b8', fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap' }}>{r.id}</td>
                      <td style={{ padding:'9px 10px', fontSize:12, color:'#64748b', whiteSpace:'nowrap' }}>{r.date}</td>
                      <td style={{ padding:'9px 10px', fontSize:12, color:'#94a3b8', whiteSpace:'nowrap', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis' }}>{r.location}</td>
                      <td style={{ padding:'9px 10px', fontSize:12, color:'#cbd5e1', whiteSpace:'nowrap', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis' }}>{r.asset}</td>
                      <td style={{ padding:'9px 10px' }}><Badge status={r.status} /></td>
                      <td style={{ padding:'9px 10px' }}>
                        {r._src === 'PPM'
                          ? <><MiniBar v={r.completion} color="#34d399" /><span style={{ marginLeft:6, fontSize:11, color:'#64748b' }}>{r.completion}%</span></>
                          : <PriDot p={r.priority} />}
                      </td>
                      <td style={{ padding:'9px 10px', fontSize:12, color:'#64748b', maxWidth:230,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }} title={desc}>{desc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:10, fontSize:10, color:'#1e3a5f', display:'flex', gap:16 }}>
            <span>↑↓ Click column to sort</span>
            <span>⌄ Column filter</span>
            <span>💡 Click row for full detail</span>
          </div>
        </div>
      </td>
    </tr>
  );
}
