import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'

const A = {
  bg: '#F7F8F7', surface: '#FFFFFF', border: '#E3E7E3', borderSoft: '#EEF1EE',
  green: '#16A34A', greenDark: '#14532D', greenTint: '#ECF7EF',
  text: '#0F1A0F', textMuted: '#6B7280', textSoft: '#9AA39B',
  amber: '#92400E', amberBg: '#FFFBEB', amberLine: '#D9A441', blue: '#3B6FD4',
}

type Preset = 'today' | '7d' | '30d' | '90d' | 'custom'
type Point = { t: string; new: number; active: number; returning: number }
type ActivityRow = { kind: string; label: string; users: number; count: number; prev: number }
type Overview = {
  unit: 'hour' | 'day'
  users: { total: number; new: number; new_prev: number; active: number; active_prev: number; returning: number; dau: number; wau: number; mau: number; activities: number; activities_prev: number }
  companies: { total: number; verified: number; premium: number; new: number; new_prev: number; views: number }
  marketplace: {
    total: number; active: number; new: number; new_prev: number; equipment_total: number; equipment_active: number
    orders: number; orders_prev: number; completed: number; completed_prev: number; completed_total: number
    value: { currency: string; amount: number }[]
  }
  community: {
    posts_total: number; posts_new: number; posts_prev: number; comments: number; comments_prev: number; likes: number; likes_prev: number
    groups_total: number; groups_new: number; groups_active: number; joins: number; joins_prev: number
  }
  series: Point[]
  activity: ActivityRow[]
  geo_countries: { name: string; count: number }[]
  geo_states: { name: string; country: string | null; count: number }[]
  top_communities: { name: string; members_count: number; posts: number; joins: number }[]
  top_categories: { category: string; active_listings: number; new_listings: number; orders: number }[]
  top_companies: { name: string; views_count: number; followers_count: number }[]
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' }, { key: '7d', label: '7 Days' }, { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' }, { key: 'custom', label: 'Custom Range' },
]

const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const n0 = (v: number) => v.toLocaleString()
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
function niceMax(v: number) {
  if (v <= 4) return 4
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}
function computeRange(preset: Preset, cFrom: string, cTo: string): { from: Date; to: Date } | null {
  const now = new Date()
  if (preset === 'custom') {
    if (!cFrom || !cTo || cFrom > cTo) return null
    const from = new Date(`${cFrom}T00:00:00`)
    const to = new Date(`${cTo}T00:00:00`)
    to.setDate(to.getDate() + 1)
    if ((to.getTime() - from.getTime()) / 86400000 > 366) return null
    return { from, to }
  }
  const days = preset === 'today' ? 1 : preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  const start = midnight(now)
  start.setDate(start.getDate() - (days - 1))
  const end = midnight(now)
  end.setDate(end.getDate() + 1)
  return { from: start, to: end }
}
type Tone = 'up' | 'down' | 'flat'
function change(cur: number, prev: number): { text: string; tone: Tone } {
  if (prev === 0 && cur === 0) return { text: 'No change', tone: 'flat' }
  if (prev === 0) return { text: 'New activity', tone: 'up' }
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return { text: 'No change', tone: 'flat' }
  return { text: `${pct > 0 ? '+' : ''}${pct}%`, tone: pct > 0 ? 'up' : 'down' }
}
const money = (currency: string, amount: number) => {
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount) } catch { return `${currency} ${n0(amount)}` }
}

const ICONS: Record<string, string> = {
  users: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-1a4 4 0 00-3-3.9M16 4.2a3.5 3.5 0 010 6.6',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  plus: 'M12 5v14M5 12h14',
  building: 'M4 21V5l8-2v18M12 9l8 2v10M8 9h.01M8 13h.01M8 17h.01M16 14h.01M16 18h.01',
  store: 'M4 9l1-5h14l1 5M4 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0M5 11v9h14v-9',
  message: 'M21 12a8 8 0 01-11.5 7.2L4 20l1.2-4.3A8 8 0 1121 12z',
  group: 'M12 3l9 5v8l-9 5-9-5V8zM12 12l9-4M12 12v9M12 12L3 8',
  swap: 'M7 7h13l-3-3M17 17H4l3 3',
  up: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  down: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  refresh: 'M20 12a8 8 0 11-2.3-5.7L20 8M20 3v5h-5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
}
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}
const NoData = () => <span style={{ color: A.textSoft, fontSize: 12.5, fontWeight: 600 }}>No data available</span>
const toneColor = { up: A.green, down: A.textMuted, flat: A.textMuted }
function Delta({ c }: { c: { text: string; tone: Tone } }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: toneColor[c.tone] }}>
      {c.tone !== 'flat' && <Icon name={c.tone} size={12} />}{c.text}
    </span>
  )
}
function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div style={{ border: `1px solid ${A.border}`, borderRadius: 8, padding: '10px 12px', minWidth: 0 }}>
      <p style={{ fontSize: 12, color: A.textMuted, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 800, color: A.text, margin: '2px 0' }}>{value}</p>
      {hint && <p style={{ fontSize: 11.5, color: A.textSoft }}>{hint}</p>}
    </div>
  )
}
function Bars({ rows, empty }: { rows: { label: string; value: number; right?: string }[]; empty: string }) {
  if (rows.length === 0) return <p style={{ fontSize: 13, color: A.textMuted, padding: '28px 0', textAlign: 'center' }}>{empty}</p>
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ color: A.text, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
            <span style={{ color: A.textMuted, whiteSpace: 'nowrap' }}>{r.right ?? n0(r.value)}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: A.borderSoft }}>
            <div style={{ height: '100%', width: `${(r.value / max) * 100}%`, borderRadius: 3, background: A.green }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const CSS = `
.an-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
.an-sub { font-size:13px; color:${A.textMuted}; line-height:1.5; }
.an-tools { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.an-grid4 { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px; margin-bottom:18px; }
.an-row { display:grid; gap:14px; margin-bottom:18px; }
.an-row.r21 { grid-template-columns:minmax(0,2fr) minmax(0,1fr); }
.an-row.r11 { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
.an-panel { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; padding:16px; min-width:0; }
.an-title { font-size:13.5px; font-weight:800; color:${A.text}; }
.an-hint { font-size:12px; color:${A.textMuted}; margin-top:2px; }
.an-tiles { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; margin-top:14px; }
.an-tiles.t3 { grid-template-columns:repeat(3, minmax(0,1fr)); }
.an-input { padding:9px 12px; border-radius:8px; border:1px solid ${A.border}; font-size:12.5px; background:${A.surface}; color:${A.text}; font-family:inherit; box-sizing:border-box; }
.an-btn { font-family:inherit; cursor:pointer; border-radius:8px; font-size:12.5px; font-weight:700; padding:8px 14px; border:1px solid ${A.border}; background:${A.surface}; color:${A.text}; display:inline-flex; align-items:center; gap:7px; }
.an-btn:hover { background:${A.bg}; }
.an-seg { display:inline-flex; border:1px solid ${A.border}; border-radius:8px; overflow:hidden; background:${A.surface}; }
.an-seg button { font-family:inherit; font-size:12.5px; font-weight:700; padding:8px 12px; border:none; border-right:1px solid ${A.border}; background:transparent; color:${A.textMuted}; cursor:pointer; white-space:nowrap; }
.an-seg button:last-child { border-right:none; }
.an-seg button:hover { background:${A.bg}; color:${A.text}; }
.an-seg button.on { background:${A.greenTint}; color:${A.greenDark}; }
.an-list { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; }
.an-table-wrap { overflow-x:auto; }
.an-table { width:100%; border-collapse:collapse; font-size:12.5px; min-width:560px; }
.an-table th { padding:10px 14px; font-size:11.5px; font-weight:700; color:${A.textMuted}; text-align:left; background:${A.bg}; border-bottom:1px solid ${A.border}; white-space:nowrap; }
.an-table td { padding:12px 14px; border-bottom:1px solid ${A.borderSoft}; vertical-align:middle; }
.an-table tr:last-child td { border-bottom:none; }
.an-mini { width:100%; border-collapse:collapse; font-size:12.5px; margin-top:12px; }
.an-mini th { text-align:left; font-size:11.5px; color:${A.textMuted}; padding:6px 0; border-bottom:1px solid ${A.border}; }
.an-mini td { padding:9px 0; border-bottom:1px solid ${A.borderSoft}; color:${A.text}; }
.an-mini tr:last-child td { border-bottom:none; }
button:focus-visible, input:focus-visible { outline:2px solid ${A.green}; outline-offset:1px; }
@media (max-width:1100px) { .an-grid4 { grid-template-columns:repeat(2, minmax(0,1fr)); } .an-row.r21, .an-row.r11 { grid-template-columns:minmax(0,1fr); } }
@media (max-width:480px) { .an-grid4 { grid-template-columns:1fr; } .an-tiles.t3 { grid-template-columns:repeat(2, minmax(0,1fr)); } }
`

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<Preset>('30d')
  const [cFrom, setCFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return localDate(d) })
  const [cTo, setCTo] = useState(() => localDate(new Date()))
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const reqId = useRef(0)

  const range = computeRange(preset, cFrom, cTo)
  const fromIso = range?.from.toISOString() ?? ''
  const toIso = range?.to.toISOString() ?? ''
  const customInvalid = preset === 'custom' && !range

  useEffect(() => {
    if (!fromIso) return
    const id = ++reqId.current
    setLoading(true)
    setError(false)
    supabase
      .rpc('admin_analytics_overview', { p_from: fromIso, p_to: toIso, p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' })
      .then(({ data: d, error: e }: { data: unknown; error: unknown }) => {
        if (id !== reqId.current) return
        if (e || !d) { setError(true); setLoading(false); return }
        setData(d as Overview)
        setLoading(false)
      })
  }, [fromIso, toIso, tick])

  const periodText = range ? (preset === 'today' ? 'Today' : `${fmtDay(range.from)} - ${fmtDay(new Date(range.to.getTime() - 1))}`) : ''
  const retry = () => setTick((n) => n + 1)

  const u = data?.users
  const empty = !!data && u!.total === 0 && u!.activities === 0 && data.companies.total === 0 && data.marketplace.total === 0
  const series = data?.series ?? []
  const maxVal = niceMax(Math.max(0, ...series.map((s) => Math.max(s.new, s.active, s.returning))))
  const W = 600
  const H = 200
  const xAt = (i: number) => (series.length <= 1 ? W / 2 : (i / (series.length - 1)) * W)
  const path = (key: 'new' | 'active' | 'returning') => series.map((s, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${(H - (s[key] / maxVal) * H).toFixed(1)}`).join(' ')
  const labelFor = (t: string) => {
    const [d, h] = t.split('T')
    const [y, m, dd] = d.split('-').map(Number)
    return data?.unit === 'hour' ? `${h.slice(0, 2)}:00` : new Date(y, m - 1, dd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  const hv = hover !== null ? series[hover] : null
  const hasSeriesData = series.some((s) => s.new + s.active + s.returning > 0)

  const avgActivity = u && u.active > 0 ? u.activities / u.active : null
  const cards = data ? [
    { label: 'Total Users', value: n0(u!.total), icon: 'users', sub: <span style={{ fontSize: 12, color: A.textMuted, fontWeight: 600 }}>{u!.new > 0 ? `+${n0(u!.new)} in this period` : 'No new users in this period'}</span> },
    { label: 'Active Users', value: n0(u!.active), icon: 'pulse', sub: <Delta c={change(u!.active, u!.active_prev)} /> },
    { label: 'New Users', value: n0(u!.new), icon: 'plus', sub: <Delta c={change(u!.new, u!.new_prev)} /> },
    { label: 'Total Companies', value: n0(data.companies.total), icon: 'building', sub: <span style={{ fontSize: 12, color: A.textMuted, fontWeight: 600 }}>{n0(data.companies.verified)} verified</span> },
    { label: 'Marketplace Listings', value: n0(data.marketplace.total), icon: 'store', sub: <span style={{ fontSize: 12, color: A.textMuted, fontWeight: 600 }}>{n0(data.marketplace.active)} active</span> },
    { label: 'Community Posts', value: n0(data.community.posts_total), icon: 'message', sub: <Delta c={change(data.community.posts_new, data.community.posts_prev)} /> },
    { label: 'Groups', value: n0(data.community.groups_total), icon: 'group', sub: <span style={{ fontSize: 12, color: A.textMuted, fontWeight: 600 }}>{data.community.groups_new > 0 ? `+${n0(data.community.groups_new)} in this period` : 'No new groups'}</span> },
    { label: 'Total Transactions', value: n0(data.marketplace.completed_total), icon: 'swap', sub: <span style={{ fontSize: 12, color: A.textMuted, fontWeight: 600 }}>Completed orders</span> },
  ] : []

  const activityRows = data?.activity ?? []
  const tableRows = data ? [
    { label: 'New registrations', users: u!.new, count: u!.new, prev: u!.new_prev },
    ...activityRows,
  ] : []
  const showGeo = !!data && (data.geo_countries.length > 0 || data.geo_states.length > 0)

  return (
    <AdminLayout title="Analytics">
      <style>{CSS}</style>

      <div className="an-head">
        <p className="an-sub" style={{ paddingTop: 7, maxWidth: 540 }}>Monitor FarmLite growth, user activity, engagement, marketplace performance, and overall platform activity.</p>
        <div className="an-tools">
          <div className="an-seg" role="group" aria-label="Date range">
            {PRESETS.map((p) => <button key={p.key} className={preset === p.key ? 'on' : ''} onClick={() => setPreset(p.key)} aria-pressed={preset === p.key}>{p.label}</button>)}
          </div>
          {preset === 'custom' && (
            <>
              <input className="an-input" type="date" value={cFrom} max={cTo || undefined} onChange={(e) => setCFrom(e.target.value)} aria-label="From date" />
              <input className="an-input" type="date" value={cTo} min={cFrom || undefined} onChange={(e) => setCTo(e.target.value)} aria-label="To date" />
            </>
          )}
          <button className="an-btn" onClick={retry}><Icon name="refresh" size={14} /> Refresh</button>
        </div>
      </div>

      {customInvalid && (
        <div style={{ background: A.amberBg, border: '1px solid #F3E2B8', color: A.amber, borderRadius: 8, padding: '10px 12px', fontSize: 12.5, marginBottom: 16 }}>
          Choose a start and end date (the start must not be after the end, and the range can be at most one year).
        </div>
      )}

      {error ? (
        <div className="an-panel" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>Unable to load analytics data.</p>
          <button className="an-btn" onClick={retry}>Try again</button>
        </div>
      ) : !data ? (
        <div className="an-panel" style={{ textAlign: 'center', padding: '48px 20px', fontSize: 13, color: A.textMuted }}>{customInvalid ? '' : 'Loading analytics...'}</div>
      ) : empty ? (
        <div className="an-panel" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <span style={{ width: 56, height: 56, borderRadius: '50%', background: A.greenTint, color: A.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Icon name="chart" size={26} />
          </span>
          <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 6 }}>No analytics data available</p>
          <p style={{ fontSize: 13, color: A.textMuted, maxWidth: 360, margin: '0 auto', lineHeight: 1.55 }}>Analytics will appear here once people start using FarmLite.</p>
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <p style={{ fontSize: 12, color: A.textMuted, marginBottom: 10 }}>Showing {periodText}. Changes compare with the previous period of the same length.</p>

          <div className="an-grid4">
            {cards.map((c) => (
              <div key={c.label} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: A.textMuted }}>{c.label}</span>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: A.greenTint, color: A.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.icon} size={15} /></span>
                </div>
                <p style={{ fontSize: 26, fontWeight: 800, color: A.text, margin: '6px 0 4px', lineHeight: 1.1 }}>{c.value}</p>
                <div style={{ minHeight: 16 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          <div className="an-row r21">
            <div className="an-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                  <p className="an-title">User Growth</p>
                  <p className="an-hint">{periodText}</p>
                </div>
                <div style={{ fontSize: 12, color: A.textMuted, textAlign: 'right', minHeight: 32 }}>
                  {hv ? (
                    <>
                      <b style={{ color: A.text }}>{labelFor(hv.t)}</b>
                      <div>{hv.new} new · {hv.active} active · {hv.returning} returning</div>
                    </>
                  ) : (
                    <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {[['New users', A.green], ['Active users', A.greenDark], ['Returning users', A.amberLine]].map(([l, c]) => (
                        <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 3, borderRadius: 2, background: c }} />{l}</span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
              {!hasSeriesData ? (
                <p style={{ fontSize: 13, color: A.textMuted, textAlign: 'center', padding: '60px 0' }}>No data available for this period.</p>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: H, fontSize: 11, color: A.textSoft, textAlign: 'right', minWidth: 26 }}>
                    <span>{maxVal}</span><span>{Math.round(maxVal / 2)}</span><span>0</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ position: 'relative', height: H, borderBottom: `1px solid ${A.border}` }} onMouseLeave={() => setHover(null)}>
                      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: `1px dashed ${A.borderSoft}` }} />
                      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, borderTop: `1px dashed ${A.borderSoft}` }} />
                      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} role="img" aria-label="User growth over time" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                        <path d={path('returning')} fill="none" stroke={A.amberLine} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                        <path d={path('active')} fill="none" stroke={A.greenDark} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                        <path d={path('new')} fill="none" stroke={A.green} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                        {hover !== null && <line x1={xAt(hover)} x2={xAt(hover)} y1="0" y2={H} stroke={A.textSoft} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />}
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                        {series.map((s, i) => <div key={s.t} style={{ flex: 1 }} onMouseEnter={() => setHover(i)} title={`${labelFor(s.t)}: ${s.new} new, ${s.active} active, ${s.returning} returning`} />)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: A.textSoft, marginTop: 6 }}>
                      <span>{series[0] ? labelFor(series[0].t) : ''}</span>
                      <span>{series.length > 2 ? labelFor(series[Math.floor((series.length - 1) / 2)].t) : ''}</span>
                      <span>{series.length > 1 ? labelFor(series[series.length - 1].t) : ''}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="an-panel">
              <p className="an-title">User activity</p>
              <p className="an-hint">People who posted, commented, liked, joined a group, listed, ordered, registered a company or used FarmBot</p>
              <div className="an-tiles">
                <Tile label="Daily Active Users" value={n0(u!.dau)} hint="Last 24 hours" />
                <Tile label="Weekly Active Users" value={n0(u!.wau)} hint="Last 7 days" />
                <Tile label="Monthly Active Users" value={n0(u!.mau)} hint="Last 30 days" />
                <Tile label="Returning users" value={n0(u!.returning)} hint="Joined before this period" />
                <Tile label="Average Sessions" value={<NoData />} hint="Sessions are not tracked" />
                <Tile label="Average Platform Activity" value={avgActivity === null ? <NoData /> : avgActivity.toFixed(1)} hint="Actions per active user" />
              </div>
            </div>
          </div>

          <div className="an-panel" style={{ marginBottom: 18 }}>
            <p className="an-title">Platform activity</p>
            <p className="an-hint" style={{ marginBottom: 14 }}>What happened on FarmLite in this period</p>
            <Bars
              empty="No data available for this period."
              rows={activityRows.filter((r) => r.count > 0).map((r) => ({ label: r.kind === 'order' ? 'Product interactions (orders placed)' : r.label, value: r.count, right: `${n0(r.count)} · ${change(r.count, r.prev).text}` }))}
            />
          </div>

          <div className="an-row r11">
            <div className="an-panel">
              <p className="an-title">Marketplace analytics</p>
              <p className="an-hint">Listings and orders</p>
              <div className="an-tiles t3">
                <Tile label="Total listings" value={n0(data.marketplace.total)} />
                <Tile label="Active listings" value={n0(data.marketplace.active)} />
                <Tile label="New listings" value={n0(data.marketplace.new)} hint={change(data.marketplace.new, data.marketplace.new_prev).text} />
                <Tile label="Completed transactions" value={n0(data.marketplace.completed)} hint={change(data.marketplace.completed, data.marketplace.completed_prev).text} />
                <Tile label="Marketplace activity" value={n0(data.marketplace.orders)} hint="Orders placed" />
                <Tile label="Equipment listings" value={n0(data.marketplace.equipment_total)} hint={`${n0(data.marketplace.equipment_active)} active`} />
              </div>
              <p style={{ fontSize: 12, color: A.textMuted, margin: '12px 0 4px', fontWeight: 600 }}>Completed transaction value</p>
              {data.marketplace.value.length === 0 ? <NoData /> : (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {data.marketplace.value.map((v) => <span key={v.currency} style={{ fontSize: 15, fontWeight: 800, color: A.text }}>{money(v.currency, v.amount)}</span>)}
                </div>
              )}
            </div>

            <div className="an-panel">
              <p className="an-title">Community analytics</p>
              <p className="an-hint">Posts, comments and groups</p>
              <div className="an-tiles t3">
                <Tile label="Total posts" value={n0(data.community.posts_total)} />
                <Tile label="New posts" value={n0(data.community.posts_new)} hint={change(data.community.posts_new, data.community.posts_prev).text} />
                <Tile label="Comments" value={n0(data.community.comments)} hint={change(data.community.comments, data.community.comments_prev).text} />
                <Tile label="Active communities" value={n0(data.community.groups_active)} hint={`of ${n0(data.community.groups_total)} groups`} />
                <Tile label="Community engagement" value={n0(data.community.likes + data.community.comments)} hint="Likes and comments" />
                <Tile label="Group joins" value={n0(data.community.joins)} hint={change(data.community.joins, data.community.joins_prev).text} />
              </div>
            </div>
          </div>

          <div className="an-panel" style={{ marginBottom: 18 }}>
            <p className="an-title">Company analytics</p>
            <p className="an-hint">Registered companies and verification</p>
            <div className="an-tiles t3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <Tile label="Registered companies" value={n0(data.companies.total)} />
              <Tile label="Verified companies" value={n0(data.companies.verified)} />
              <Tile label="Premium companies" value={n0(data.companies.premium)} />
              <Tile label="New registrations" value={n0(data.companies.new)} hint={change(data.companies.new, data.companies.new_prev).text} />
              <Tile label="Company page activity" value={n0(data.companies.views)} hint="Page views, all time" />
            </div>
          </div>

          {showGeo && (
            <div className="an-row r11">
              <div className="an-panel">
                <p className="an-title">Companies by country</p>
                <p className="an-hint" style={{ marginBottom: 14 }}>Based on company registration details</p>
                <Bars empty="No data available" rows={data.geo_countries.map((g) => ({ label: g.name, value: g.count }))} />
              </div>
              <div className="an-panel">
                <p className="an-title">Companies by state / region</p>
                <p className="an-hint" style={{ marginBottom: 14 }}>No private addresses are shown</p>
                <Bars empty="No data available" rows={data.geo_states.map((g) => ({ label: g.country ? `${g.name} (${g.country})` : g.name, value: g.count }))} />
              </div>
            </div>
          )}

          <p className="an-title" style={{ marginBottom: 10 }}>Top platform activities</p>
          <div className="an-row r11" style={{ marginBottom: 14 }}>
            <div className="an-panel">
              <p className="an-title">Most active communities</p>
              <p className="an-hint">Posts and new members in this period</p>
              {data.top_communities.length === 0 ? <div style={{ padding: '18px 0' }}><NoData /></div> : (
                <table className="an-mini"><thead><tr><th>Community</th><th>Posts</th><th>Joins</th><th>Members</th></tr></thead>
                  <tbody>{data.top_communities.map((c) => <tr key={c.name}><td style={{ fontWeight: 700 }}>{c.name}</td><td>{n0(c.posts)}</td><td>{n0(c.joins)}</td><td>{n0(c.members_count)}</td></tr>)}</tbody></table>
              )}
            </div>
            <div className="an-panel">
              <p className="an-title">Most active marketplace categories</p>
              <p className="an-hint">Orders in this period and current active listings</p>
              {data.top_categories.length === 0 ? <div style={{ padding: '18px 0' }}><NoData /></div> : (
                <table className="an-mini"><thead><tr><th>Category</th><th>Orders</th><th>Active</th><th>New</th></tr></thead>
                  <tbody>{data.top_categories.map((c) => <tr key={c.category}><td style={{ fontWeight: 700 }}>{c.category}</td><td>{n0(c.orders)}</td><td>{n0(c.active_listings)}</td><td>{n0(c.new_listings)}</td></tr>)}</tbody></table>
              )}
            </div>
          </div>
          <div className="an-row r11">
            <div className="an-panel">
              <p className="an-title">Most viewed listings</p>
              <p className="an-hint">Listing views are not tracked yet</p>
              <div style={{ padding: '18px 0' }}><NoData /></div>
            </div>
            <div className="an-panel">
              <p className="an-title">Most viewed companies</p>
              <p className="an-hint">Page views, all time</p>
              {data.top_companies.length === 0 ? <div style={{ padding: '18px 0' }}><NoData /></div> : (
                <table className="an-mini"><thead><tr><th>Company</th><th>Views</th><th>Followers</th></tr></thead>
                  <tbody>{data.top_companies.map((c) => <tr key={c.name}><td style={{ fontWeight: 700 }}>{c.name}</td><td>{n0(c.views_count)}</td><td>{n0(c.followers_count)}</td></tr>)}</tbody></table>
              )}
            </div>
          </div>

          <p className="an-title" style={{ marginBottom: 10 }}>Activity breakdown</p>
          <div className="an-list">
            <div className="an-table-wrap">
              <table className="an-table">
                <thead><tr><th>Activity</th><th>Users</th><th>Activity Count</th><th>Period</th><th>Change</th></tr></thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.label}>
                      <td style={{ fontWeight: 700, color: A.text }}>{r.label}</td>
                      <td>{n0(r.users)}</td>
                      <td>{n0(r.count)}</td>
                      <td style={{ color: A.textMuted, whiteSpace: 'nowrap' }}>{periodText}</td>
                      <td><Delta c={change(r.count, r.prev)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
