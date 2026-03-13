import { useState, useRef, useEffect } from 'react';

export default function ColFilter({ col, values, active, onChange, color }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const isActive = active && active !== 'All';
  return (
    <span ref={ref} style={{ position:'relative', display:'inline-block' }}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ background:'none', border:'none', cursor:'pointer', padding:'0 2px',
          color:isActive ? color : '#475569', fontSize:12 }} title={`Filter ${col}`}>
        {isActive ? '●' : '⌄'}
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, zIndex:999, background:'#0f172a',
          border:'1px solid #334155', borderRadius:10, padding:6, minWidth:160,
          boxShadow:'0 16px 40px rgba(0,0,0,.6)', maxHeight:280, overflowY:'auto' }}>
          {['All', ...values].map(v => (
            <div key={v} onClick={() => { onChange(v); setOpen(false); }}
              style={{ padding:'7px 12px', borderRadius:6, cursor:'pointer', fontSize:12,
                fontWeight:v===active?700:400, color:v===active?color:'#cbd5e1',
                background:v===active?'#1e293b':'transparent' }}
              onMouseEnter={e => { if (v !== active) e.target.style.background='#1e293b'; }}
              onMouseLeave={e => { if (v !== active) e.target.style.background='transparent'; }}>
              {v}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
