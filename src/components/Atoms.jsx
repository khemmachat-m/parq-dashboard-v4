import { STATUS_META, PRI_COLOR, SRC_COLOR } from '../constants.js';

export const Badge = ({ status }) => {
  const c = STATUS_META[status] || { bg:'#1e293b', text:'#94a3b8', dot:'#64748b' };
  return (
    <span style={{ background:c.bg, color:c.text, borderRadius:20, padding:'3px 10px',
      fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:c.dot, flexShrink:0 }} />
      {status}
    </span>
  );
};

export const PriDot = ({ p }) => (
  <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600,
    color:PRI_COLOR[p]||'#94a3b8' }}>
    <span style={{ width:7, height:7, borderRadius:'50%', background:PRI_COLOR[p]||'#9ca3af' }} />{p}
  </span>
);

export const SrcChip = ({ src }) => (
  <span style={{ background:`${SRC_COLOR[src]||'#94a3b8'}22`, color:SRC_COLOR[src]||'#94a3b8',
    borderRadius:6, padding:'2px 8px', fontSize:10, fontWeight:700,
    letterSpacing:1, textTransform:'uppercase' }}>{src}</span>
);

export const MiniBar = ({ v, color }) => (
  <div style={{ background:'#1e293b', borderRadius:4, height:5, width:60,
    display:'inline-block', verticalAlign:'middle', overflow:'hidden' }}>
    <div style={{ width:`${Number(v)||0}%`, height:'100%', background:color, borderRadius:4 }} />
  </div>
);
