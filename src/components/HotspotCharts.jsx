/**
 * HotspotCharts.jsx
 * Analytics charts for the Hotspot tab.
 * Uses Recharts for all chart rendering.
 *
 * Charts included:
 *   1. Monthly Trend       — line chart: CWO / Cases / PPM over time
 *   2. Top Locations       — horizontal bar: most incidents by location
 *   3. Top Event Types     — horizontal bar
 *   4. Top Problem Types   — horizontal bar (CWO + Cases only)
 *   5. Top Assets          — horizontal bar
 *   6. Status Distribution — stacked bar per source
 *   7. Priority Breakdown  — bar chart (CWO + Cases)
 *   8. Service Mix         — donut (Hard vs Soft)
 */
import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { parseDateToISO, toYearMonth, fmtYearMonth } from '../utils/dateHelpers.js';
import { CHART_COLORS, PRI_COLOR, SRC_COLOR, STATUS_META } from '../constants.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function topN(records, key, n = 10) {
  const counts = {};
  records.forEach(r => {
    const v = r[key] || '—';
    counts[v] = (counts[v] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, value]) => ({ name, value }));
}

const TOOLTIP_STYLE = {
  contentStyle: { background:'#0f172a', border:'1px solid #1e3a5f', borderRadius:10,
    fontSize:12, color:'#e2e8f0' },
  cursor: { fill:'#1e3a5f44' },
};

// ─── Shared chart card wrapper ─────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, span = 1 }) {
  return (
    <div style={{
      background:'#0a1628', border:'1px solid #1e3a5f', borderRadius:14,
      padding:'16px 20px', gridColumn: span > 1 ? `span ${span}` : undefined,
    }}>
      <div style={{ fontSize:13, fontWeight:700, color:'#f1f5f9', marginBottom:2 }}>{title}</div>
      {subtitle && <div style={{ fontSize:11, color:'#475569', marginBottom:12 }}>{subtitle}</div>}
      {!subtitle && <div style={{ marginBottom:14 }} />}
      {children}
    </div>
  );
}

// ─── 1. Monthly Trend ─────────────────────────────────────────────────────────
function TrendChart({ tagged }) {
  const data = useMemo(() => {
    const byMonth = {};
    tagged.forEach(r => {
      const ym = toYearMonth(parseDateToISO(r.date));
      if (!ym) return;
      if (!byMonth[ym]) byMonth[ym] = { month:ym, CWO:0, Case:0, PPM:0 };
      byMonth[ym][r._src]++;
    });
    return Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(d => ({ ...d, label: fmtYearMonth(d.month) }));
  }, [tagged]);

  if (data.length === 0) return <div style={{color:'#334155',fontSize:12,padding:20,textAlign:'center'}}>No date data available</div>;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top:4, right:16, left:-20, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="label" tick={{ fill:'#475569', fontSize:10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill:'#475569', fontSize:10 }} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend iconSize={8} wrapperStyle={{ fontSize:11, color:'#64748b' }} />
        <Line type="monotone" dataKey="CWO"  stroke={SRC_COLOR.CWO}  strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Case" stroke={SRC_COLOR.Case} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="PPM"  stroke={SRC_COLOR.PPM}  strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── 2–5. Horizontal bar for top-N dimension ──────────────────────────────────
function TopNChart({ records, dim, label, color, n = 10 }) {
  const data = useMemo(() => topN(records, dim, n), [records, dim, n]);
  if (data.length === 0) return <div style={{color:'#334155',fontSize:12,padding:16,textAlign:'center'}}>No data</div>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top:0, right:24, left:4, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={{ fill:'#475569', fontSize:10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fill:'#94a3b8', fontSize:11 }}
          axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar dataKey="value" name={label} fill={color} radius={[0,4,4,0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={i === 0 ? '#f97316' : color} fillOpacity={1 - i * 0.06} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── 6. Status distribution per source ───────────────────────────────────────
function StatusChart({ tagged }) {
  const data = useMemo(() => {
    const groups = { CWO:{}, Case:{}, PPM:{} };
    tagged.forEach(r => {
      const g = groups[r._src];
      if (!g) return;
      g[r.status] = (g[r.status] || 0) + 1;
    });
    // Collect all unique statuses
    const allStatuses = [...new Set(tagged.map(r => r.status))];
    return ['CWO','Case','PPM'].map(src => {
      const row = { src };
      allStatuses.forEach(s => { row[s] = groups[src][s] || 0; });
      return row;
    });
  }, [tagged]);

  const statuses = useMemo(() => [...new Set(tagged.map(r => r.status))], [tagged]);
  const STATUS_COLOR = {
    Completed:'#10b981', Closed:'#10b981', 'In Progress':'#f59e0b',
    Open:'#3b82f6', Scheduled:'#8b5cf6', Overdue:'#ef4444',
  };

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top:4, right:8, left:-20, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="src" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill:'#475569', fontSize:10 }} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend iconSize={8} wrapperStyle={{ fontSize:10, color:'#64748b' }} />
        {statuses.map(s => (
          <Bar key={s} dataKey={s} stackId="a"
            fill={STATUS_COLOR[s] || '#475569'} radius={[0,0,0,0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── 7. Priority breakdown ────────────────────────────────────────────────────
function PriorityChart({ tagged }) {
  const nonPPM = tagged.filter(r => r._src !== 'PPM');
  const data = useMemo(() => {
    const counts = {};
    nonPPM.forEach(r => {
      const p = r.priority || '—';
      counts[p] = (counts[p] || 0) + 1;
    });
    const order = ['Critical','High','Medium','Low'];
    const known = order.filter(p => counts[p]).map(p => ({ name:p, value:counts[p] }));
    const other = Object.entries(counts).filter(([k]) => !order.includes(k)).map(([name, value]) => ({ name, value }));
    return [...known, ...other];
  }, [nonPPM]);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top:4, right:8, left:-20, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill:'#475569', fontSize:10 }} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar dataKey="value" name="Records" radius={[4,4,0,0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={PRI_COLOR[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── 8. Service mix donut ─────────────────────────────────────────────────────
function ServiceMixChart({ tagged }) {
  const data = useMemo(() => {
    const hard = tagged.filter(r => r._service === 'Hard').length;
    const soft = tagged.filter(r => r._service === 'Soft').length;
    return [
      { name:'Hard Service', value:hard, color:'#38bdf8' },
      { name:'Soft Service', value:soft, color:'#fb923c' },
    ].filter(d => d.value > 0);
  }, [tagged]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ display:'flex', alignItems:'center', gap:16 }}>
      <ResponsiveContainer width={130} height={130}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={36} outerRadius={58}
            dataKey="value" paddingAngle={2}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip {...TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ flex:1 }}>
        {data.map(d => (
          <div key={d.name} style={{ marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontSize:12, color:d.color, fontWeight:700 }}>{d.name}</span>
              <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:'#94a3b8' }}>
                {d.value} ({total ? Math.round(d.value/total*100) : 0}%)
              </span>
            </div>
            <div style={{ height:4, background:'#1e293b', borderRadius:2, overflow:'hidden' }}>
              <div style={{ width:`${total?d.value/total*100:0}%`, height:'100%',
                background:d.color, borderRadius:2, transition:'width .5s' }} />
            </div>
          </div>
        ))}
        <div style={{ fontSize:11, color:'#334155', marginTop:8 }}>Total: {total}</div>
      </div>
    </div>
  );
}

// ─── KPI summary row ──────────────────────────────────────────────────────────
function KpiRow({ tagged }) {
  const cwo  = tagged.filter(r => r._src === 'CWO').length;
  const cas  = tagged.filter(r => r._src === 'Case').length;
  const ppm  = tagged.filter(r => r._src === 'PPM').length;
  const done = tagged.filter(r => ['Closed','Completed'].includes(r.status)).length;
  const ovd  = tagged.filter(r => r.status === 'Overdue').length;
  const pct  = tagged.length ? Math.round(done / tagged.length * 100) : 0;

  const kpis = [
    { label:'Total Records',   val:tagged.length, color:'#38bdf8', icon:'📊' },
    { label:'CWO',             val:cwo,           color:'#38bdf8', icon:'🔧' },
    { label:'Cases',           val:cas,           color:'#a78bfa', icon:'📋' },
    { label:'PPM',             val:ppm,           color:'#34d399', icon:'🗓' },
    { label:'Closed / Done',   val:`${done} (${pct}%)`, color:'#10b981', icon:'✅' },
    { label:'Overdue',         val:ovd,           color:'#ef4444', icon:'⚠️' },
  ];

  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
      {kpis.map(k => (
        <div key={k.label} style={{ flex:'1 1 100px', minWidth:100, background:'#0a1628',
          border:`1px solid ${k.color}33`, borderRadius:12, padding:'12px 16px',
          boxShadow:`0 2px 12px ${k.color}11` }}>
          <div style={{ fontSize:18 }}>{k.icon}</div>
          <div style={{ fontSize:22, fontWeight:800, color:k.color,
            fontFamily:"'JetBrains Mono',monospace", marginTop:2 }}>{k.val}</div>
          <div style={{ fontSize:10, color:'#475569', fontWeight:600,
            textTransform:'uppercase', letterSpacing:1, marginTop:2 }}>{k.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function HotspotCharts({ tagged }) {
  if (!tagged || tagged.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:'40px 20px', color:'#334155', fontSize:14 }}>
        No records to analyse. Adjust your date range or service filter.
      </div>
    );
  }

  const cwoAndCases = tagged.filter(r => r._src !== 'PPM');

  return (
    <div>
      <KpiRow tagged={tagged} />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:14 }}>

        {/* Monthly trend — full width */}
        <div style={{ gridColumn:'1 / -1' }}>
          <ChartCard title="📈 Monthly Trend" subtitle="Number of records created per month by source" span={2}>
            <TrendChart tagged={tagged} />
          </ChartCard>
        </div>

        {/* Top Locations */}
        <ChartCard title="📍 Top Locations" subtitle="Top 10 by total record count">
          <TopNChart records={tagged} dim="location" label="Records" color="#38bdf8" n={10} />
        </ChartCard>

        {/* Top Event Types */}
        <ChartCard title="⚡ Top Event Types" subtitle="Top 10 event types across all sources">
          <TopNChart records={tagged} dim="eventType" label="Records" color="#a78bfa" n={10} />
        </ChartCard>

        {/* Top Problem Types — CWO + Cases only */}
        <ChartCard title="🔎 Top Problem Types" subtitle="CWO + Cases only (top 10)">
          <TopNChart records={cwoAndCases} dim="problemType" label="Records" color="#f97316" n={10} />
        </ChartCard>

        {/* Top Assets */}
        <ChartCard title="🔩 Top Assets" subtitle="Most affected assets (top 10)">
          <TopNChart records={tagged} dim="asset" label="Records" color="#34d399" n={10} />
        </ChartCard>

        {/* Status distribution */}
        <ChartCard title="🟢 Status Distribution" subtitle="Open / In Progress / Closed breakdown per source">
          <StatusChart tagged={tagged} />
        </ChartCard>

        {/* Priority breakdown */}
        <ChartCard title="🔴 Priority Breakdown" subtitle="Critical / High / Medium / Low (CWO + Cases)">
          <PriorityChart tagged={tagged} />
        </ChartCard>

        {/* Service mix */}
        <ChartCard title="⚙️ Service Mix" subtitle="Hard vs Soft service classification">
          <ServiceMixChart tagged={tagged} />
        </ChartCard>

      </div>
    </div>
  );
}
