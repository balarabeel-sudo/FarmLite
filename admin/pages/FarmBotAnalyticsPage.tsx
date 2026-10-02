import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'

const A = {
  bg: '#F7F8F7', surface: '#FFFFFF', border: '#E3E7E3', borderSoft: '#EEF1EE',
  green: '#16A34A', greenDark: '#14532D', greenTint: '#ECF7EF',
  text: '#0F1A0F', textMuted: '#6B7280', textSoft: '#9AA39B',
  amber: '#92400E', amberBg: '#FFFBEB', amberChip: '#FEF3C7', amberLine: '#D9A441',
}

type Preset = 'today' | '7d' | '30d' | '90d' | 'custom'
type Point = { t: string; total: number; failed: number }
type Overview = {
  unit: 'hour' | 'day'
  total: number; total_prev: number; active_users: number; active_users_prev: number
  today: number; yesterday: number; completed: number; failed: number; avg_ms: number | null
  total_users: number; new_users: number; returning_users: number; repeat_users: number
  series: Point[]; topics: { topic: string; count: number }[]
  errors: { type: string; count: number; last_at: string }[]
}
type Prof = { user_id: string; full_name: string | null; username: string | null; profile_image: string | null; role: string | null }
type QRow = {
  id: string; user_id: string | null; query: string; topic: string | null
  response_status: 'completed' | 'failed'; response_ms: number | null
  error_type: string | null; error_detail: string | null; created_at: string; user: Prof | null
}

const TOPICS = ['Crop Diseases', 'Livestock', 'Farming Methods', 'Fertilizer', 'Pest Control', 'Weather', 'Market Prices', 'Farm Equipment', 'Crop Production', 'General Agriculture']
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' }, { key: '7d', label: 'Last 7 days' }, { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' }, { key: 'custom', label: 'Custom range' },
]
const ERROR_LABEL: Record<string, string> = {
  quota_limit: 'Daily quota reached', api_timeout: 'API timeout', service_unavailable: 'Service unavailable',
  ai_response_error: 'AI response error', database_error: 'Database error', internal_error: 'Internal error',
}
const ROWS = [10, 25, 50]
const PROF = 'user_id, full_name, username, profile_image, role'
const SELECT = `id, user_id, query, topic, response_status, response_ms, error_type, error_detail, created_at, user:profiles!farmbot_events_user_id_fkey(${PROF})`

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const initials = (n: string) => n.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?'
const pname = (p: Prof | null) => p?.full_name || p?.username || 'Deleted user'
const ms = (v: number | null) => (v === null || v === undefined ? '-' : v < 1000 ? `${v} ms` : `${(v / 1000).toFixed(1)} s`)
function relative(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
function pageList(cur: number, total: number): (number | '…')[] {
  const keep = new Set([1, total, cur - 1, cur, cur + 1])
  const nums = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  nums.forEach((n, i) => { if (i > 0 && n - nums[i - 1] > 1) out.push('…'); out.push(n) })
  return out
}
function niceMax(v: number) {
  if (v <= 4) return 4
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

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

function change(cur: number, prev: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (prev === 0 && cur === 0) return { text: 'No change vs previous period', tone: 'flat' }
  if (prev === 0) return { text: 'New activity this period', tone: 'up' }
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return { text: 'No change vs previous period', tone: 'flat' }
  return { text: `${pct > 0 ? '+' : ''}${pct}% vs previous period`, tone: pct > 0 ? 'up' : 'down' }
}

const ICONS: Record<string, string> = {
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  message: 'M21 12a8 8 0 01-11.5 7.2L4 20l1.2-4.3A8 8 0 1121 12z',
  users: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-1a4 4 0 00-3-3.9M16 4.2a3.5 3.5 0 010 6.6',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  refresh: 'M20 12a8 8 0 11-2.3-5.7L20 8M20 3v5h-5',
  up: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  down: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  leaf: 'M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c3-5 6-8 10-10',
}
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function Avatar({ p, size = 30 }: { p: Prof | null; size?: number }) {
  const box = { width: size, height: size, borderRadius: '50%', flexShrink: 0 as const }
  if (p?.profile_image) return <img src={p.profile_image} alt="" style={{ ...box, objectFit: 'cover', border: `1px solid ${A.border}` }} />
  return (
    <span style={{ ...box, background: A.greenTint, color: A.greenDark, border: '1px solid #D3EBDA', fontSize: size * 0.38, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {initials(pname(p))}
    </span>
  )
}
function ResponseBadge({ status }: { status: 'completed' | 'failed' }) {
  const s = status === 'completed' ? { bg: '#DCFCE7', color: '#166534', dot: '#16A34A', label: 'Completed' } : { bg: A.amberChip, color: A.amber, dot: A.amberLine, label: 'Failed' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />{s.label}
    </span>
  )
}
function TopicChip({ topic }: { topic: string | null }) {
  return <span style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: `1px solid ${A.border}`, color: '#374151', background: A.surface, whiteSpace: 'nowrap' }}>{topic || 'General Agriculture'}</span>
}

const CSS = `
.fb-sub { font-size:13px; color:${A.textMuted}; line-height:1.5; }
.fb-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
.fb-tools { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.fb-grid4 { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px; margin-bottom:18px; }
.fb-row { display:grid; gap:14px; margin-bottom:18px; }
.fb-row.r21 { grid-template-columns:minmax(0,2fr) minmax(0,1fr); }
.fb-row.r11 { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
.fb-panel { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; padding:16px; min-width:0; }
.fb-title { font-size:13.5px; font-weight:800; color:${A.text}; }
.fb-hint { font-size:12px; color:${A.textMuted}; margin-top:2px; }
.fb-input { padding:9px 12px; border-radius:8px; border:1px solid ${A.border}; font-size:12.5px; background:${A.surface}; color:${A.text}; font-family:inherit; box-sizing:border-box; }
.fb-list { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; }
.fb-table-wrap { overflow-x:auto; }
.fb-table { width:100%; border-collapse:collapse; font-size:12.5px; min-width:880px; }
.fb-table.small { min-width:520px; }
.fb-table th { padding:10px 14px; font-size:11.5px; font-weight:700; color:${A.textMuted}; text-align:left; background:${A.bg}; border-bottom:1px solid ${A.border}; white-space:nowrap; }
.fb-table td { padding:12px 14px; border-bottom:1px solid ${A.borderSoft}; vertical-align:middle; }
.fb-table tr:last-child td { border-bottom:none; }
.fb-qrow { cursor:pointer; }
.fb-qrow:hover { background:#FAFBFA; }
.fb-qrow.attn { background:${A.amberBg}; }
.fb-qrow.attn:hover { background:#FFF7DD; }
.fb-qrow.attn td:first-child { box-shadow: inset 3px 0 0 ${A.amberLine}; }
.fb-clamp { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.45; color:${A.text}; word-break:break-word; }
.fb-cards { display:none; }
.fb-card { padding:14px; border-bottom:1px solid ${A.borderSoft}; }
.fb-card.attn { background:${A.amberBg}; box-shadow: inset 3px 0 0 ${A.amberLine}; }
.fb-card:last-child { border-bottom:none; }
.fb-btn { font-family:inherit; cursor:pointer; border-radius:8px; font-size:12.5px; font-weight:700; padding:8px 14px; border:1px solid ${A.border}; background:${A.surface}; color:${A.text}; display:inline-flex; align-items:center; gap:7px; }
.fb-btn:hover:not(:disabled) { background:${A.bg}; }
.fb-btn:disabled { opacity:.55; cursor:default; }
.fb-seg { display:inline-flex; border:1px solid ${A.border}; border-radius:8px; overflow:hidden; background:${A.surface}; }
.fb-seg button { font-family:inherit; font-size:12.5px; font-weight:700; padding:8px 12px; border:none; border-right:1px solid ${A.border}; background:transparent; color:${A.textMuted}; cursor:pointer; white-space:nowrap; }
.fb-seg button:last-child { border-right:none; }
.fb-seg button:hover { background:${A.bg}; color:${A.text}; }
.fb-seg button.on { background:${A.greenTint}; color:${A.greenDark}; }
.fb-icon-btn { font-family:inherit; cursor:pointer; width:30px; height:30px; border-radius:7px; border:1px solid transparent; background:transparent; color:${A.textMuted}; display:inline-flex; align-items:center; justify-content:center; }
.fb-icon-btn:hover { background:${A.bg}; border-color:${A.border}; color:${A.text}; }
.fb-page { min-width:30px; height:30px; padding:0 8px; border-radius:7px; border:1px solid transparent; background:transparent; font-family:inherit; font-size:12.5px; font-weight:600; color:${A.text}; cursor:pointer; }
.fb-page:hover:not(:disabled) { background:${A.bg}; border-color:${A.border}; }
.fb-page.on { background:${A.greenTint}; border-color:#BFE3CA; color:${A.greenDark}; font-weight:800; }
.fb-page:disabled { color:${A.textSoft}; cursor:default; }
.fb-foot { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; padding:12px 14px; border-top:1px solid ${A.border}; }
.fb-bar { flex:1 1 0; min-width:2px; display:flex; align-items:flex-end; height:100%; cursor:default; }
.fb-bar > div { width:100%; background:${A.green}; border-radius:2px 2px 0 0; position:relative; overflow:hidden; min-height:0; }
.fb-bar:hover > div { background:#15803D; }
.fb-drawer { position:fixed; top:0; right:0; bottom:0; width:480px; max-width:100%; background:${A.surface}; z-index:61; display:flex; flex-direction:column; box-shadow:-8px 0 28px rgba(15,26,18,0.12); animation:fb-in .18s ease-out; }
@keyframes fb-in { from { transform:translateX(24px); opacity:0; } to { transform:none; opacity:1; } }
.fb-label { font-size:12px; font-weight:700; color:${A.textMuted}; margin-bottom:8px; }
.fb-box { border:1px solid ${A.border}; border-radius:10px; padding:12px; margin-bottom:20px; }
.fb-kv { display:flex; justify-content:space-between; gap:14px; padding:6px 0; font-size:12.5px; }
.fb-kv span:first-child { color:${A.textMuted}; }
.fb-kv span:last-child { color:${A.text}; font-weight:600; text-align:right; word-break:break-word; }
button:focus-visible, input:focus-visible, select:focus-visible { outline:2px solid ${A.green}; outline-offset:1px; }
@media (max-width:1100px) { .fb-grid4 { grid-template-columns:repeat(2, minmax(0,1fr)); } .fb-row.r21, .fb-row.r11 { grid-template-columns:minmax(0,1fr); } }
@media (max-width:960px) { .fb-table-wrap.q { display:none; } .fb-cards { display:block; } }
@media (max-width:480px) { .fb-grid4 { grid-template-columns:1fr; } }
@media (prefers-reduced-motion: reduce) { .fb-drawer { animation:none; } }
`

export default function FarmBotAnalyticsPage() {
  const [preset, setPreset] = useState<Preset>('7d')
  const [cFrom, setCFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return localDate(d) })
  const [cTo, setCTo] = useState(() => localDate(new Date()))
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  const [rows, setRows] = useState<QRow[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [sel, setSel] = useState<QRow | null>(null)
  const reqOverview = useRef(0)
  const reqList = useRef(0)

  const range = computeRange(preset, cFrom, cTo)
  const fromIso = range?.from.toISOString() ?? ''
  const toIso = range?.to.toISOString() ?? ''
  const customInvalid = preset === 'custom' && !range

  useEffect(() => {
    const t = setTimeout(() => { setQ((cur) => (cur === qInput ? cur : qInput)); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [qInput])

  useEffect(() => {
    if (!fromIso) return
    const id = ++reqOverview.current
    setLoading(true)
    setError(false)
    supabase
      .rpc('admin_farmbot_overview', { p_from: fromIso, p_to: toIso, p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' })
      .then(({ data: d, error: e }: { data: unknown; error: unknown }) => {
        if (id !== reqOverview.current) return
        if (e || !d) { setError(true); setLoading(false); return }
        setData(d as Overview)
        setLoading(false)
      })
  }, [fromIso, toIso, tick])

  const loadList = useCallback(async () => {
    if (!fromIso) return
    const id = ++reqList.current
    setListError(false)
    setListLoading(true)
    const from = (page - 1) * perPage
    let query = supabase.from('farmbot_events').select(SELECT, { count: 'exact' })
      .gte('created_at', fromIso).lt('created_at', toIso)
      .order('created_at', { ascending: false }).range(from, from + perPage - 1)
    if (topic !== 'all') query = query.eq('topic', topic)
    if (status !== 'all') query = query.eq('response_status', status)
    const term = q.replace(/[,()%*:]/g, ' ').trim()
    if (term) {
      const { data: people } = await supabase.from('profiles').select('user_id').or(`full_name.ilike.*${term}*,username.ilike.*${term}*`).limit(50)
      const ids = (people || []).map((p: { user_id: string }) => p.user_id)
      query = query.or(ids.length ? `query.ilike.*${term}*,user_id.in.(${ids.join(',')})` : `query.ilike.*${term}*`)
    }
    const { data: d, error: e, count } = await query
    if (id !== reqList.current) return
    if (e) { setListError(true); setListLoading(false); return }
    setRows((d || []) as unknown as QRow[])
    setTotal(count || 0)
    setListLoading(false)
  }, [fromIso, toIso, page, perPage, topic, status, q])

  useEffect(() => { loadList() }, [loadList, tick])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const choosePreset = (p: Preset) => { setPreset(p); setPage(1) }
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, totalPages)
  const shownFrom = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const shownTo = Math.min(safePage * perPage, total)
  const filtersActive = topic !== 'all' || status !== 'all' || !!q

  const never = !!data && data.total_users === 0 && !loading && !error
  const avgPer = data && data.active_users > 0 ? data.total / data.active_users : 0
  const avgPrev = data && data.active_users_prev > 0 ? data.total_prev / data.active_users_prev : 0

  const todayDiff = data ? data.today - data.yesterday : 0
  const cards = data ? [
    { label: 'Total Queries', value: data.total.toLocaleString(), icon: 'message', ...change(data.total, data.total_prev) },
    { label: 'Active Users', value: data.active_users.toLocaleString(), icon: 'users', ...change(data.active_users, data.active_users_prev) },
    { label: 'Queries Today', value: data.today.toLocaleString(), icon: 'clock', text: todayDiff === 0 ? 'Same as yesterday' : `${todayDiff > 0 ? '+' : ''}${todayDiff} vs yesterday`, tone: (todayDiff > 0 ? 'up' : todayDiff < 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat' },
    { label: 'Average Queries/User', value: avgPer.toFixed(1), icon: 'chart', ...change(Number(avgPer.toFixed(1)), Number(avgPrev.toFixed(1))) },
  ] : []
  const toneColor = { up: A.green, down: A.textMuted, flat: A.textMuted }

  const series = data?.series ?? []
  const maxVal = niceMax(Math.max(0, ...series.map((s) => s.total)))
  const labelFor = (t: string) => {
    const [d, h] = t.split('T')
    const [y, m, dd] = d.split('-').map(Number)
    const date = new Date(y, m - 1, dd)
    return data?.unit === 'hour'
      ? `${h.slice(0, 2)}:00`
      : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  const hv = hover !== null ? series[hover] : null
  const topMax = Math.max(1, ...(data?.topics ?? []).map((t) => t.count))
  const topSum = (data?.topics ?? []).reduce((s, t) => s + t.count, 0)
  const errRate = data && data.total > 0 ? (data.failed / data.total) * 100 : 0

  const periodText = range
    ? preset === 'today' ? 'Today' : `${fmtDay(range.from.toISOString())} - ${fmtDay(new Date(range.to.getTime() - 1).toISOString())}`
    : ''

  return (
    <AdminLayout title="FarmBot Analytics">
      <style>{CSS}</style>

      <div className="fb-head">
        <p className="fb-sub" style={{ paddingTop: 7, maxWidth: 520 }}>Monitor FarmBot usage, user activity, conversations, and agriculture-related AI interactions.</p>
        <div className="fb-tools">
          <div className="fb-seg" role="group" aria-label="Date range">
            {PRESETS.map((p) => <button key={p.key} className={preset === p.key ? 'on' : ''} onClick={() => choosePreset(p.key)} aria-pressed={preset === p.key}>{p.label}</button>)}
          </div>
          {preset === 'custom' && (
            <>
              <input className="fb-input" type="date" value={cFrom} max={cTo || undefined} onChange={(e) => { setCFrom(e.target.value); setPage(1) }} aria-label="From date" />
              <input className="fb-input" type="date" value={cTo} min={cFrom || undefined} onChange={(e) => { setCTo(e.target.value); setPage(1) }} aria-label="To date" />
            </>
          )}
          <button className="fb-btn" onClick={() => setTick((n) => n + 1)}><Icon name="refresh" size={14} /> Refresh</button>
        </div>
      </div>

      {customInvalid && (
        <div style={{ background: A.amberBg, border: '1px solid #F3E2B8', color: A.amber, borderRadius: 8, padding: '10px 12px', fontSize: 12.5, marginBottom: 16 }}>
          Choose a start and end date (the start must not be after the end, and the range can be at most one year).
        </div>
      )}

      {error ? (
        <div className="fb-panel" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>Could not load FarmBot analytics. You may not have permission to view them.</p>
          <button className="fb-btn" onClick={() => setTick((n) => n + 1)}>Try again</button>
        </div>
      ) : never ? (
        <div className="fb-panel" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <span style={{ width: 56, height: 56, borderRadius: '50%', background: A.greenTint, color: A.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Icon name="leaf" size={26} />
          </span>
          <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 6 }}>No FarmBot analytics available</p>
          <p style={{ fontSize: 13, color: A.textMuted, maxWidth: 360, margin: '0 auto', lineHeight: 1.55 }}>
            FarmBot activity will appear here once users begin interacting with FarmBot.
          </p>
        </div>
      ) : (
        <>
          <div className="fb-grid4">
            {(loading && !data ? [0, 1, 2, 3] : cards).map((c, i) => (typeof c === 'number' ? (
              <div key={i} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '14px 16px', minHeight: 104 }}>
                <p style={{ fontSize: 12.5, color: A.textSoft }}>Loading...</p>
              </div>
            ) : (
              <div key={c.label} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '14px 16px', opacity: loading ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: A.textMuted }}>{c.label}</span>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: A.greenTint, color: A.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={c.icon} size={15} />
                  </span>
                </div>
                <p style={{ fontSize: 26, fontWeight: 800, color: A.text, margin: '6px 0 4px', lineHeight: 1.1 }}>{c.value}</p>
                <p style={{ fontSize: 12, color: toneColor[c.tone], display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                  {(c.tone === 'up' || c.tone === 'down') && <Icon name={c.tone} size={12} />}{c.text}
                </p>
              </div>
            )))}
          </div>

          <div className="fb-row r21">
            <div className="fb-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                  <p className="fb-title">FarmBot Queries</p>
                  <p className="fb-hint">{periodText}</p>
                </div>
                <div style={{ fontSize: 12, color: A.textMuted, textAlign: 'right', minHeight: 32 }}>
                  {hv ? (
                    <>
                      <b style={{ color: A.text }}>{hv.total} {hv.total === 1 ? 'query' : 'queries'}</b>{hv.failed > 0 ? `, ${hv.failed} failed` : ''}
                      <div>{labelFor(hv.t)}</div>
                    </>
                  ) : (
                    <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: A.green }} />Queries</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: A.amberLine }} />Failed</span>
                    </span>
                  )}
                </div>
              </div>
              {data && data.total === 0 ? (
                <p style={{ fontSize: 13, color: A.textMuted, textAlign: 'center', padding: '60px 0' }}>No FarmBot activity in this period.</p>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 200, fontSize: 11, color: A.textSoft, textAlign: 'right', minWidth: 26 }}>
                    <span>{maxVal}</span><span>{Math.round(maxVal / 2)}</span><span>0</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div role="img" aria-label={`FarmBot queries over time, ${data?.total ?? 0} in total`} style={{ position: 'relative', height: 200, borderBottom: `1px solid ${A.border}` }} onMouseLeave={() => setHover(null)}>
                      {[0, 50].map((p) => <div key={p} style={{ position: 'absolute', left: 0, right: 0, bottom: `${p === 0 ? 100 : 50}%`, borderTop: `1px dashed ${A.borderSoft}` }} />)}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: series.length > 45 ? 1 : 3 }}>
                        {series.map((s, i) => (
                          <div key={s.t} className="fb-bar" onMouseEnter={() => setHover(i)} title={`${labelFor(s.t)}: ${s.total}`}>
                            <div style={{ height: `${(s.total / maxVal) * 100}%`, opacity: hover !== null && hover !== i ? 0.6 : 1 }}>
                              {s.failed > 0 && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${(s.failed / s.total) * 100}%`, background: A.amberLine }} />}
                            </div>
                          </div>
                        ))}
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

            <div className="fb-panel">
              <p className="fb-title">Top agriculture topics</p>
              <p className="fb-hint" style={{ marginBottom: 14 }}>What users ask FarmBot about</p>
              {!data || data.topics.length === 0 ? (
                <p style={{ fontSize: 13, color: A.textMuted, padding: '40px 0', textAlign: 'center' }}>No topics in this period.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {data.topics.slice(0, 10).map((t) => (
                    <div key={t.topic}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                        <span style={{ color: A.text, fontWeight: 600 }}>{t.topic}</span>
                        <span style={{ color: A.textMuted }}>{t.count} · {Math.round((t.count / Math.max(topSum, 1)) * 100)}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: A.borderSoft }}>
                        <div style={{ height: '100%', width: `${(t.count / topMax) * 100}%`, borderRadius: 3, background: A.green }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="fb-row r11">
            <div className="fb-panel">
              <p className="fb-title">FarmBot user activity</p>
              <p className="fb-hint" style={{ marginBottom: 14 }}>How many people use FarmBot and how often</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
                {[
                  ['Total FarmBot users', data?.total_users, 'Ever used FarmBot'],
                  ['New FarmBot users', data?.new_users, 'First question in this period'],
                  ['Returning users', data?.returning_users, 'Used it before this period'],
                  ['Active FarmBot users', data?.active_users, 'Asked at least once'],
                ].map(([label, value, hint]) => (
                  <div key={label as string} style={{ border: `1px solid ${A.border}`, borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 12, color: A.textMuted, fontWeight: 600 }}>{label}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: A.text, margin: '2px 0' }}>{value === undefined ? '-' : (value as number).toLocaleString()}</p>
                    <p style={{ fontSize: 11.5, color: A.textSoft }}>{hint}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: A.textMuted, marginTop: 12 }}>
                <b style={{ color: A.text }}>{data?.repeat_users ?? 0}</b> {(data?.repeat_users ?? 0) === 1 ? 'user asked' : 'users asked'} FarmBot two or more times in this period.
              </p>
            </div>

            <div className="fb-panel">
              <p className="fb-title">FarmBot performance</p>
              <p className="fb-hint" style={{ marginBottom: 14 }}>How well FarmBot is answering</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
                {[
                  ['Successful responses', data ? data.completed.toLocaleString() : '-', data && data.total > 0 ? `${Math.round((data.completed / data.total) * 100)}% of queries` : '', false],
                  ['Failed responses', data ? data.failed.toLocaleString() : '-', data && data.failed > 0 ? 'Needs a look' : 'None', !!data && data.failed > 0],
                  ['Average response time', ms(data?.avg_ms ?? null), data?.avg_ms == null ? 'Not recorded yet' : 'Completed answers', false],
                  ['Error rate', data ? `${errRate.toFixed(errRate > 0 && errRate < 10 ? 1 : 0)}%` : '-', data ? `${data.failed} of ${data.total}` : '', !!data && errRate >= 10],
                ].map(([label, value, hint, warn]) => (
                  <div key={label as string} style={{ border: `1px solid ${warn ? '#F3E2B8' : A.border}`, background: warn ? A.amberBg : A.surface, borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 12, color: A.textMuted, fontWeight: 600 }}>{label}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: warn ? A.amber : A.text, margin: '2px 0' }}>{value}</p>
                    <p style={{ fontSize: 11.5, color: A.textSoft }}>{hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="fb-list" style={{ marginBottom: 18 }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${A.border}` }}>
              <p className="fb-title">FarmBot error monitoring</p>
              <p className="fb-hint">Technical and API errors in this period. For admin monitoring only.</p>
            </div>
            {!data || data.errors.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: A.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ color: A.green, display: 'flex' }}><Icon name="check" size={16} /></span> No errors recorded in this period.
              </div>
            ) : (
              <div className="fb-table-wrap">
                <table className="fb-table small">
                  <thead><tr><th>Error type</th><th>Occurrences</th><th>Last occurrence</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.errors.map((e) => {
                      const active = Date.now() - new Date(e.last_at).getTime() < 3600000
                      return (
                        <tr key={e.type}>
                          <td style={{ fontWeight: 700, color: A.text }}>{ERROR_LABEL[e.type] || e.type}</td>
                          <td>{e.count.toLocaleString()}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtDay(e.last_at)}, {fmtTime(e.last_at)} <span style={{ color: A.textMuted }}>({relative(e.last_at)})</span></td>
                          <td>
                            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: active ? A.amberChip : '#DCFCE7', color: active ? A.amber : '#166534' }}>
                              {active ? 'Active' : 'Recovered'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <p className="fb-title">Query activity</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
              <span style={{ position: 'absolute', left: 11, top: 9, color: A.textSoft, display: 'flex' }}><Icon name="search" size={15} /></span>
              <input className="fb-input" style={{ width: '100%', paddingLeft: 34 }} value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search query text or user" aria-label="Search queries" />
            </div>
            <select className="fb-input" value={topic} onChange={(e) => { setTopic(e.target.value); setPage(1) }} aria-label="Topic">
              <option value="all">Topic: All</option>
              {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="fb-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Response status">
              <option value="all">Response: All</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            {filtersActive && <button className="fb-btn" onClick={() => { setTopic('all'); setStatus('all'); setQInput(''); setQ(''); setPage(1) }}>Clear</button>}
          </div>

          <div className="fb-list">
            {listError ? (
              <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>Could not load query activity.</p>
                <button className="fb-btn" onClick={() => setTick((n) => n + 1)}>Try again</button>
              </div>
            ) : listLoading ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', fontSize: 13, color: A.textMuted }}>Loading queries...</div>
            ) : rows.length === 0 ? (
              <div style={{ padding: '44px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: A.text, marginBottom: 6 }}>No queries found</p>
                <p style={{ fontSize: 13, color: A.textMuted }}>{filtersActive ? 'No queries match your search or filters.' : 'No one asked FarmBot anything in this period.'}</p>
              </div>
            ) : (
              <>
                <div className="fb-table-wrap q">
                  <table className="fb-table">
                    <thead>
                      <tr><th>User</th><th style={{ width: '34%' }}>Query</th><th>Topic</th><th>Date</th><th>Response Status</th><th style={{ width: 90 }}>Action</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className={`fb-qrow${r.response_status === 'failed' ? ' attn' : ''}`} onClick={() => setSel(r)}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <Avatar p={r.user} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: A.text, whiteSpace: 'nowrap' }}>{pname(r.user)}</div>
                                <div style={{ fontSize: 11.5, color: A.textMuted }}>{r.user?.username ? `@${r.user.username}` : ''}</div>
                              </div>
                            </div>
                          </td>
                          <td><div className="fb-clamp" style={{ maxWidth: 380 }}>{r.query}</div></td>
                          <td><TopicChip topic={r.topic} /></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ color: A.text }}>{fmtDay(r.created_at)}, {fmtTime(r.created_at)}</div>
                            <div style={{ fontSize: 11.5, color: A.textMuted }}>{relative(r.created_at)}</div>
                          </td>
                          <td><ResponseBadge status={r.response_status} /></td>
                          <td><button className="fb-btn" style={{ padding: '5px 12px' }} onClick={(e) => { e.stopPropagation(); setSel(r) }}>View</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="fb-cards">
                  {rows.map((r) => (
                    <div key={r.id} className={`fb-card${r.response_status === 'failed' ? ' attn' : ''}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <Avatar p={r.user} size={32} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: A.text }}>{pname(r.user)}</div>
                          <div style={{ fontSize: 11.5, color: A.textMuted }}>{relative(r.created_at)}</div>
                        </div>
                        <ResponseBadge status={r.response_status} />
                      </div>
                      <div className="fb-clamp" style={{ fontSize: 13, marginBottom: 10 }}>{r.query}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <TopicChip topic={r.topic} />
                        <button className="fb-btn" onClick={() => setSel(r)}><Icon name="eye" size={14} /> View</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="fb-foot">
                  <span style={{ fontSize: 12.5, color: A.textMuted }}>Showing {shownFrom}-{shownTo} of {total} queries</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button className="fb-page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="chevL" size={13} /> Previous</button>
                    {pageList(safePage, totalPages).map((p, idx) => (p === '…'
                      ? <span key={`g${idx}`} style={{ padding: '0 4px', color: A.textSoft }}>…</span>
                      : <button key={p} className={`fb-page${p === safePage ? ' on' : ''}`} onClick={() => setPage(p)} aria-current={p === safePage ? 'page' : undefined}>{p}</button>))}
                    <button className="fb-page" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Next <Icon name="chevR" size={13} /></button>
                  </div>
                  <label style={{ fontSize: 12.5, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Rows per page
                    <select className="fb-input" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}>
                      {ROWS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {sel && (
        <>
          <div onClick={() => setSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.38)', zIndex: 60 }} />
          <aside className="fb-drawer" role="dialog" aria-label="Query details">
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: A.text }}>Query details</p>
                <p style={{ fontSize: 12, color: A.textMuted, marginTop: 2 }}>{fmtDay(sel.created_at)}, {fmtTime(sel.created_at)}</p>
              </div>
              <ResponseBadge status={sel.response_status} />
              <button className="fb-icon-btn" aria-label="Close" onClick={() => setSel(null)}><Icon name="close" size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <p className="fb-label">User</p>
              <div className="fb-box" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar p={sel.user} size={40} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 800, color: A.text }}>{pname(sel.user)}</p>
                  <p style={{ fontSize: 12, color: A.textMuted }}>{sel.user?.username ? `@${sel.user.username}` : ''}{sel.user?.role ? ` · ${sel.user.role}` : ''}</p>
                </div>
              </div>

              <p className="fb-label">Query</p>
              <div className="fb-box">
                <p style={{ fontSize: 13.5, color: A.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{sel.query}</p>
              </div>

              <p className="fb-label">Details</p>
              <div className="fb-box">
                <div className="fb-kv"><span>Topic</span><span>{sel.topic || 'General Agriculture'}</span></div>
                <div className="fb-kv"><span>Date and time</span><span>{fmtDay(sel.created_at)}, {fmtTime(sel.created_at)}</span></div>
                <div className="fb-kv"><span>Response status</span><span><ResponseBadge status={sel.response_status} /></span></div>
                <div className="fb-kv"><span>Response time</span><span>{sel.response_ms === null ? 'Not recorded' : ms(sel.response_ms)}</span></div>
              </div>

              {(sel.response_status === 'failed' || sel.error_type) && (
                <>
                  <p className="fb-label">Error information</p>
                  <div style={{ background: A.amberBg, border: '1px solid #F3E2B8', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: A.amber, fontSize: 13, fontWeight: 800, marginBottom: sel.error_detail ? 8 : 0 }}>
                      <Icon name="alert" size={15} />{sel.error_type ? ERROR_LABEL[sel.error_type] || sel.error_type : 'Unknown error'}
                    </div>
                    {sel.error_detail && <p style={{ fontSize: 12, color: '#78350F', lineHeight: 1.55, wordBreak: 'break-word', fontFamily: 'ui-monospace, Menlo, monospace' }}>{sel.error_detail}</p>}
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </AdminLayout>
  )
}
