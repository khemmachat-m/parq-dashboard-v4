/** Normalise any Mozart date string to YYYY-MM-DD for comparison. */
export function parseDateToISO(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2,'0')}-${dmY[1].padStart(2,'0')}`;
  try {
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  } catch {}
  return '';
}

export function isoDate(d) { return d.toISOString().slice(0, 10); }

/** Returns 'YYYY-MM' for grouping by month. */
export function toYearMonth(isoStr) {
  return isoStr ? isoStr.slice(0, 7) : '';
}

/** Format 'YYYY-MM' → 'Mon YY' label. */
export function fmtYearMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${mon[parseInt(m,10)-1]} ${y.slice(2)}`;
}

export const DATE_PRESETS = [
  { label:'Last 7d',  get() { const t=new Date(); const f=new Date(t); f.setDate(f.getDate()-6);   return [isoDate(f),isoDate(t)]; } },
  { label:'Last 30d', get() { const t=new Date(); const f=new Date(t); f.setDate(f.getDate()-29);  return [isoDate(f),isoDate(t)]; } },
  { label:'This month',get(){ const t=new Date(); return [isoDate(new Date(t.getFullYear(),t.getMonth(),1)),isoDate(new Date(t.getFullYear(),t.getMonth()+1,0))]; } },
  { label:'Last month',get(){ const t=new Date(); return [isoDate(new Date(t.getFullYear(),t.getMonth()-1,1)),isoDate(new Date(t.getFullYear(),t.getMonth(),0))]; } },
  { label:'This year', get(){ const t=new Date(); return [isoDate(new Date(t.getFullYear(),0,1)),isoDate(new Date(t.getFullYear(),11,31))]; } },
];
