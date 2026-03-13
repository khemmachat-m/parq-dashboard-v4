import { TAB_COLOR, PRI_COLOR } from '../constants.js';
import { Badge, PriDot, MiniBar } from './Atoms.jsx';

export default function DetailModal({ record, type, onClose }) {
  if (!record) return null;
  const color = TAB_COLOR[type] || '#38bdf8';

  const SvcLabel = () => (
    <span style={{ color:record._service==='Soft'?'#fb923c':'#38bdf8', fontWeight:700 }}>
      {record._service} Service
    </span>
  );

  const fields =
    type === 'CWO' ? [
      ['ID', record.id], ['Date', record.date], ['Location', record.location],
      ['Event Type', record.eventType], ['Problem Type', record.problemType],
      ['Asset', record.asset], ['Service', <SvcLabel />],
      ['Priority', <PriDot p={record.priority} />], ['Status', <Badge status={record.status} />],
      ['Technician', record.technician],
      ['Description', record.description || <em style={{color:'#475569'}}>—</em>],
      ['Resolution', record.resolution || <em style={{color:'#475569'}}>Not yet resolved</em>],
    ] : type === 'Cases' ? [
      ['ID', record.id], ['Date', record.date], ['Location', record.location],
      ['Event Type', record.eventType], ['Problem Type', record.problemType],
      ['Asset', record.asset], ['Service', <SvcLabel />],
      ['Priority', <PriDot p={record.priority} />], ['Status', <Badge status={record.status} />],
      ['Raised By', record.raisedBy],
      ['Subject', record.subject || <em style={{color:'#475569'}}>—</em>],
      ['Completion Comment', record.completioncomment || <em style={{color:'#475569'}}>—</em>],
      ['Closure Comment', record.closurecomment || <em style={{color:'#475569'}}>—</em>],
    ] : [
      ['ID', record.id], ['Date', record.date], ['Location', record.location],
      ['Event Type', record.eventType], ['Asset', record.asset],
      ['Service', <SvcLabel />], ['Frequency', record.frequency],
      ['Status', <Badge status={record.status} />],
      ['Completion', <><MiniBar v={record.completion} color={color} /><span style={{marginLeft:8,fontSize:12,color:'#94a3b8'}}>{record.completion}%</span></>],
      ['Technician', record.technician],
    ];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.82)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:2000, backdropFilter:'blur(6px)' }}
      onClick={onClose}>
      <div style={{ background:'#0f172a', borderRadius:20, padding:32, maxWidth:560, width:'92%',
        boxShadow:`0 0 0 1px ${color}44, 0 32px 80px rgba(0,0,0,.7)`,
        maxHeight:'88vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color, letterSpacing:2.5,
              textTransform:'uppercase', marginBottom:4 }}>{type}</div>
            <div style={{ fontSize:24, fontWeight:800, color:'#f1f5f9',
              fontFamily:"'Syne',sans-serif" }}>{record.id}</div>
            <div style={{ fontSize:13, color:'#475569', marginTop:2 }}>
              {record.location} · {record.date}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:'#1e293b', border:'none', borderRadius:10, width:36, height:36,
              cursor:'pointer', fontSize:18, color:'#64748b', flexShrink:0 }}>×</button>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <tbody>
            {fields.map(([label, val], i) => (
              <tr key={i} style={{ borderTop:'1px solid #1e293b' }}>
                <td style={{ padding:'10px 4px', fontSize:10, fontWeight:700, color:'#475569',
                  textTransform:'uppercase', letterSpacing:1.2, width:150, verticalAlign:'top',
                  fontFamily:"'JetBrains Mono',monospace" }}>{label}</td>
                <td style={{ padding:'10px 4px', fontSize:13, color:'#e2e8f0', lineHeight:1.6 }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
