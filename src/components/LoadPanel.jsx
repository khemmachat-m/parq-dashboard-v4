/**
 * LoadPanel.jsx
 * Loads enriched CSVs from:
 *   A) GitHub raw URL (parq-dashboard public/enriched/)
 *   B) Manual file upload (drag-and-drop or picker)
 */
import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { GITHUB_ENRICHED_BASE, ENRICHED_FILES } from '../constants.js';
import { mapCWORow, mapCasesRow, mapPPMRow } from '../utils/columnMapper.js';

function parseCSV(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return result.data;
}

async function fetchCSV(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

export default function LoadPanel({ onLoad }) {
  const [status,   setStatus]   = useState('idle'); // idle | loading | error | done
  const [message,  setMessage]  = useState('');
  const [customBase, setCustomBase] = useState(GITHUB_ENRICHED_BASE);
  const [showCustom, setShowCustom] = useState(false);

  // Manual upload refs
  const cwoRef   = useRef();
  const caseRef  = useRef();
  const ppmRef   = useRef();
  const [manual, setManual] = useState({ CWO:null, Cases:null, PPM:null });

  // ── GitHub load ──────────────────────────────────────────────────────────────
  const loadFromGitHub = async () => {
    setStatus('loading'); setMessage('Fetching enriched CSVs from GitHub…');
    try {
      const base = customBase.replace(/\/$/, '');
      const [cwoText, caseText, ppmText] = await Promise.all([
        fetchCSV(`${base}/${ENRICHED_FILES.CWO}`),
        fetchCSV(`${base}/${ENRICHED_FILES.Cases}`),
        fetchCSV(`${base}/${ENRICHED_FILES.PPM}`),
      ]);
      const cwo   = parseCSV(cwoText).map(mapCWORow);
      const cases = parseCSV(caseText).map(mapCasesRow);
      const ppm   = parseCSV(ppmText).map(mapPPMRow);
      setStatus('done');
      setMessage(`✓ Loaded from GitHub — CWO: ${cwo.length} · Cases: ${cases.length} · PPM: ${ppm.length}`);
      onLoad({ cwo, cases, ppm, source:'github', loadedAt: new Date().toISOString() });
    } catch (e) {
      setStatus('error');
      setMessage(`GitHub load failed: ${e.message}. Try uploading files manually below.`);
    }
  };

  // ── Manual upload ────────────────────────────────────────────────────────────
  const readFile = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = () => rej(new Error('File read error'));
    reader.readAsText(file);
  });

  const handleFileChange = (key, file) => {
    if (!file) return;
    setManual(prev => ({ ...prev, [key]: file }));
  };

  const loadManual = async () => {
    if (!manual.CWO && !manual.Cases && !manual.PPM) return;
    setStatus('loading'); setMessage('Parsing uploaded files…');
    try {
      const parse = async (key, mapper) => {
        if (!manual[key]) return [];
        const text = await readFile(manual[key]);
        return parseCSV(text).map(mapper);
      };
      const cwo   = await parse('CWO',   mapCWORow);
      const cases = await parse('Cases', mapCasesRow);
      const ppm   = await parse('PPM',   mapPPMRow);
      setStatus('done');
      setMessage(`✓ Loaded from upload — CWO: ${cwo.length} · Cases: ${cases.length} · PPM: ${ppm.length}`);
      onLoad({ cwo, cases, ppm, source:'upload', loadedAt: new Date().toISOString() });
    } catch (e) {
      setStatus('error');
      setMessage(`Upload failed: ${e.message}`);
    }
  };

  const btn = (label, onClick, color='#38bdf8', disabled=false) => (
    <button onClick={onClick} disabled={disabled}
      style={{ padding:'9px 20px', borderRadius:10, border:`1.5px solid ${disabled?'#1e293b':color}`,
        background:disabled?'transparent':`${color}22`, color:disabled?'#334155':color,
        fontSize:13, fontWeight:700, cursor:disabled?'not-allowed':'pointer', transition:'all .2s',
        boxShadow:disabled?'none':`0 0 14px ${color}33` }}>
      {label}
    </button>
  );

  const fileChip = (label, key, color) => (
    <label style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px',
      background:'#0a1628', border:`1.5px solid ${manual[key]?color:'#1e293b'}`,
      borderRadius:10, cursor:'pointer', fontSize:12, color:manual[key]?color:'#475569',
      fontWeight:700, transition:'all .2s', userSelect:'none' }}>
      <input type="file" accept=".csv" ref={key==='CWO'?cwoRef:key==='Cases'?caseRef:ppmRef}
        style={{ display:'none' }}
        onChange={e => handleFileChange(key, e.target.files[0])} />
      {manual[key] ? `✓ ${manual[key].name}` : `+ ${label}`}
    </label>
  );

  return (
    <div style={{ background:'#0f172a', border:'1px solid #1e3a5f', borderRadius:16, padding:24, marginBottom:20 }}>
      <div style={{ fontSize:15, fontWeight:800, color:'#f1f5f9', fontFamily:"'Syne',sans-serif", marginBottom:4 }}>
        📂 Load Enriched Data
      </div>
      <div style={{ fontSize:12, color:'#475569', marginBottom:18 }}>
        Source: <code style={{color:'#38bdf8',fontSize:11}}>_Enriched.csv</code> files from{' '}
        <span style={{color:'#94a3b8'}}>parq-dashboard / public/enriched/</span>
      </div>

      {/* GitHub load section */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', letterSpacing:1.5,
          textTransform:'uppercase', marginBottom:8 }}>Auto-load from GitHub</div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {btn('☁️ Load from GitHub', loadFromGitHub, '#38bdf8', status==='loading')}
          <button onClick={() => setShowCustom(p => !p)}
            style={{ background:'none', border:'1px solid #1e293b', borderRadius:8,
              padding:'7px 12px', color:'#475569', fontSize:11, cursor:'pointer', fontWeight:600 }}>
            ⚙ Custom URL {showCustom?'▲':'▼'}
          </button>
        </div>
        {showCustom && (
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:11, color:'#475569', marginBottom:4 }}>GitHub raw base URL:</div>
            <input value={customBase} onChange={e => setCustomBase(e.target.value)}
              style={{ width:'100%', background:'#080f1a', border:'1px solid #1e3a5f',
                borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:12,
                fontFamily:"'JetBrains Mono',monospace", outline:'none' }} />
            <div style={{ fontSize:10, color:'#334155', marginTop:4 }}>
              Expected files: {Object.values(ENRICHED_FILES).join(' · ')}
            </div>
          </div>
        )}
      </div>

      {/* Manual upload */}
      <div style={{ borderTop:'1px solid #1e293b', paddingTop:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', letterSpacing:1.5,
          textTransform:'uppercase', marginBottom:8 }}>Or upload manually</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
          {fileChip('CWO Enriched',   'CWO',   '#38bdf8')}
          {fileChip('Cases Enriched', 'Cases', '#a78bfa')}
          {fileChip('PPM Enriched',   'PPM',   '#34d399')}
        </div>
        {btn('⬆ Load Uploaded Files', loadManual, '#a78bfa',
          !manual.CWO && !manual.Cases && !manual.PPM || status==='loading')}
      </div>

      {/* Status message */}
      {message && (
        <div style={{ marginTop:14, padding:'10px 14px', borderRadius:8, fontSize:12,
          background: status==='error'?'#1a0a0a':status==='done'?'#052e16':'#0a1628',
          border:`1px solid ${status==='error'?'#450a0a':status==='done'?'#064e3b':'#1e3a5f'}`,
          color: status==='error'?'#f87171':status==='done'?'#6ee7b7':'#94a3b8',
          fontWeight:600 }}>
          {status==='loading' && <span style={{marginRight:8}}>⏳</span>}
          {message}
        </div>
      )}
    </div>
  );
}
