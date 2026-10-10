import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'

const A = {
  bg: '#F7F8F7', surface: '#FFFFFF', border: '#E3E7E3', borderSoft: '#EEF1EE',
  green: '#16A34A', greenDark: '#14532D', greenTint: '#ECF7EF',
  text: '#0F1A0F', textMuted: '#6B7280', textSoft: '#9AA39B',
  amber: '#92400E', amberBg: '#FFFBEB', amberChip: '#FEF3C7', amberLine: '#D9A441', red: '#B91C1C', blue: '#3B6FD4',
}

type GStatus = 'active' | 'suspended'
type ListRow = {
  id: string; name: string; icon_url: string | null; cover_url: string | null; members_count: number; status: GStatus; created_at: string
  owner_id: string; creator_name: string | null; creator_username: string | null; creator_image: string | null; creator_verified: boolean
  posts_total: number; posts_30: number; last_activity: string; rep_open: number; rep_total: number
}
type Overview = {
  total: number; active: number; suspended: number; reported: number; new_30: number; new_prev: number; recently_active: number
  members_total: number; posts_total: number; joins_30: number; joins_prev: number
  series: { t: string; groups: number; joins: number; posts: number }[]
  top: { id: string; name: string; members_count: number; posts: number; joins: number }[]
}
type ReportRef = { id: string; code: string; reason: string; status: string; created_at: string }
type Member = { user_id: string; full_name: string | null; username: string | null; profile_image: string | null; role: string; joined_at: string; account_status: string; is_verified: boolean }
type Detail = {
  group: { id: string; name: string; description: string | null; icon_url: string | null; cover_url: string | null; status: GStatus; created_at: string; members_count: number }
  creator: {
    user_id: string; full_name: string | null; username: string | null; profile_image: string | null; role: string | null; is_verified: boolean; account_status: string
    other_groups: { id: string; name: string; status: GStatus; members: number }[]; reports_against: number
    reports: { id: string; code: string; type: string; reason: string; status: string; created_at: string }[]
  } | null
  activity: { members: number; posts_total: number; posts_30: number; joins_30: number; last_post_at: string | null; last_join_at: string | null }
  recent_posts: { id: string; author: string | null; username: string | null; excerpt: string; created_at: string; images: number; reports_open: number; report_id: string | null }[]
  members: Member[]
  reports: ReportRef[]
  history: { action: string; actor: string | null; at: string; note: string | null }[]
}
type Menu = { id: string; x: number; y: number; up: boolean } | null
type ConfirmKind = 'suspend' | 'restore' | 'remove'
type Confirm = { kind: ConfirmKind; id: string; name: string; image: string | null; members: number; posts: number } | null
type Mode = 'view' | 'reports'

const STATUS_LABEL: Record<GStatus, string> = { active: 'Active', suspended: 'Suspended' }
const STATUS_STYLE: Record<GStatus, { bg: string; color: string; dot: string }> = {
  active: { bg: '#DCFCE7', color: '#166534', dot: '#16A34A' },
  suspended: { bg: A.amberChip, color: A.amber, dot: A.amberLine },
}
const ROWS = [10, 25, 50]

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const fmtFull = (iso: string) => `${fmtDay(iso)}, ${fmtTime(iso)}`
const startOfDay = (d: string) => new Date(`${d}T00:00:00`).toISOString()
const nextDay = (d: string) => { const x = new Date(`${d}T00:00:00`); x.setDate(x.getDate() + 1); return x.toISOString() }
const initials = (n: string) => n.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?'
const pn = (n: string | null, u: string | null) => n || u || 'Unknown user'
const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`
const n0 = (v: number) => v.toLocaleString()
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
type Tone = 'up' | 'down' | 'flat'
function change(cur: number, prev: number): { text: string; tone: Tone } {
  if (prev === 0 && cur === 0) return { text: 'No change', tone: 'flat' }
  if (prev === 0) return { text: 'New activity', tone: 'up' }
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return { text: 'No change', tone: 'flat' }
  return { text: `${pct > 0 ? '+' : ''}${pct}% vs previous 30 days`, tone: pct > 0 ? 'up' : 'down' }
}
const toneColor = { up: A.green, down: A.textMuted, flat: A.textMuted }
const lastActive = (r: { last_activity: string }) => relative(r.last_activity)

const ICONS: Record<string, string> = {
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0112 6c6.5 0 10 6 10 6a17 17 0 01-3.2 3.9M6.6 7.6A17 17 0 002 12s3.5 6 10 6a10 10 0 004.2-.9M9.9 9.9a3 3 0 004.2 4.2',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  restore: 'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  refresh: 'M20 12a8 8 0 11-2.3-5.7L20 8M20 3v5h-5',
  group: 'M12 3l9 5v8l-9 5-9-5V8zM12 12l9-4M12 12v9M12 12L3 8',
  users: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-1a4 4 0 00-3-3.9M16 4.2a3.5 3.5 0 010 6.6',
  plus: 'M12 5v14M5 12h14',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  image: 'M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM9 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM21 16l-5-5-9-9',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  verified: 'M12 3l2.4 1.8 3 .1.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3 .1L12 21l-2.4-1.8-3-.1-.9-2.9L3.3 14.4l.9-2.9-.9-2.9 2.4-1.8.9-2.9 3-.1zM9 12l2 2 4-4',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
}
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  if (name === 'more') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}
function Thumb({ src, size = 44, round }: { src: string | null; size?: number; round?: boolean }) {
  const [bad, setBad] = useState(false)
  const box = { width: size, height: size, borderRadius: round ? '50%' : 8, flexShrink: 0 as const, border: `1px solid ${A.border}` }
  if (!src || bad) return <span style={{ ...box, background: A.greenTint, color: A.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="group" size={size * 0.45} /></span>
  return <img src={src} alt="" onError={() => setBad(true)} style={{ ...box, objectFit: 'cover' }} />
}
function Avatar({ name, src, size = 30 }: { name: string; src: string | null; size?: number }) {
  const box = { width: size, height: size, borderRadius: '50%', flexShrink: 0 as const }
  if (src) return <img src={src} alt="" style={{ ...box, objectFit: 'cover', border: `1px solid ${A.border}` }} />
  return <span style={{ ...box, background: A.greenTint, color: A.greenDark, border: '1px solid #D3EBDA', fontSize: size * 0.38, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{initials(name)}</span>
}
function StatusBadge({ status }: { status: GStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />{STATUS_LABEL[status]}
    </span>
  )
}
const ReportedTag = ({ n }: { n?: number }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: A.amber, background: A.amberChip, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
    <Icon name="flag" size={11} />Reported{n && n > 1 ? ` (${n})` : ''}
  </span>
)
const Verified = () => <span title="Verified" style={{ color: A.green, display: 'inline-flex', marginLeft: 4 }}><Icon name="verified" size={13} /></span>
function Tile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: Tone }) {
  return (
    <div style={{ border: `1px solid ${A.border}`, borderRadius: 8, padding: '10px 12px', minWidth: 0 }}>
      <p style={{ fontSize: 12, color: A.textMuted, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 800, color: A.text, margin: '2px 0' }}>{value}</p>
      {hint && <p style={{ fontSize: 11.5, color: tone ? toneColor[tone] : A.textSoft, fontWeight: tone ? 600 : 400 }}>{hint}</p>}
    </div>
  )
}

const CSS = `
.gp-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
.gp-sub { font-size:13px; color:${A.textMuted}; line-height:1.5; }
.gp-stats { display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); gap:14px; margin-bottom:18px; }
.gp-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
.gp-input { padding:9px 12px; border-radius:8px; border:1px solid ${A.border}; font-size:12.5px; background:${A.surface}; color:${A.text}; font-family:inherit; box-sizing:border-box; }
.gp-list { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; }
.gp-table-wrap { overflow-x:auto; }
.gp-table { width:100%; border-collapse:collapse; font-size:12.5px; min-width:980px; }
.gp-table th { padding:10px 14px; font-size:11.5px; font-weight:700; color:${A.textMuted}; text-align:left; background:${A.bg}; border-bottom:1px solid ${A.border}; white-space:nowrap; }
.gp-table td { padding:12px 14px; border-bottom:1px solid ${A.borderSoft}; vertical-align:middle; }
.gp-table tr:last-child td { border-bottom:none; }
.gp-row { cursor:pointer; }
.gp-row:hover { background:#FAFBFA; }
.gp-row.attn { background:${A.amberBg}; }
.gp-row.attn:hover { background:#FFF7DD; }
.gp-row.attn td:first-child { box-shadow: inset 3px 0 0 ${A.amberLine}; }
.gp-clamp { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.45; word-break:break-word; }
.gp-cards { display:none; }
.gp-card { padding:14px; border-bottom:1px solid ${A.borderSoft}; }
.gp-card.attn { background:${A.amberBg}; box-shadow: inset 3px 0 0 ${A.amberLine}; }
.gp-card:last-child { border-bottom:none; }
.gp-panel { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; padding:16px; min-width:0; }
.gp-title { font-size:13.5px; font-weight:800; color:${A.text}; }
.gp-hint { font-size:12px; color:${A.textMuted}; margin-top:2px; }
.gp-tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-top:14px; }
.gp-row2 { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; margin-bottom:18px; }
.gp-btn { font-family:inherit; cursor:pointer; border-radius:8px; font-size:12.5px; font-weight:700; padding:8px 14px; border:1px solid ${A.border}; background:${A.surface}; color:${A.text}; display:inline-flex; align-items:center; gap:7px; text-decoration:none; }
.gp-btn:hover:not(:disabled) { background:${A.bg}; }
.gp-btn:disabled { opacity:.55; cursor:default; }
.gp-btn.primary { background:${A.green}; border-color:${A.green}; color:#fff; }
.gp-btn.primary:hover:not(:disabled) { background:#15803D; }
.gp-btn.danger { color:${A.red}; }
.gp-btn.danger:hover:not(:disabled) { background:#FEF2F2; }
.gp-btn.solid-danger { background:${A.red}; border-color:${A.red}; color:#fff; }
.gp-btn.solid-danger:hover:not(:disabled) { background:#991B1B; }
.gp-icon-btn { font-family:inherit; cursor:pointer; width:30px; height:30px; border-radius:7px; border:1px solid transparent; background:transparent; color:${A.textMuted}; display:inline-flex; align-items:center; justify-content:center; }
.gp-icon-btn:hover { background:${A.bg}; border-color:${A.border}; color:${A.text}; }
.gp-link { font-family:inherit; border:none; background:transparent; padding:0; cursor:pointer; color:inherit; font-weight:700; text-align:left; text-decoration:none; }
.gp-link:hover { color:${A.green}; text-decoration:underline; }
.gp-menu-item { width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; font-family:inherit; font-size:12.5px; font-weight:600; color:${A.text}; cursor:pointer; text-align:left; border-radius:6px; }
.gp-menu-item:hover:not(:disabled) { background:${A.bg}; }
.gp-menu-item:disabled { color:${A.textSoft}; cursor:default; }
.gp-menu-item.danger { color:${A.red}; }
.gp-page { min-width:30px; height:30px; padding:0 8px; border-radius:7px; border:1px solid transparent; background:transparent; font-family:inherit; font-size:12.5px; font-weight:600; color:${A.text}; cursor:pointer; }
.gp-page:hover:not(:disabled) { background:${A.bg}; border-color:${A.border}; }
.gp-page.on { background:${A.greenTint}; border-color:#BFE3CA; color:${A.greenDark}; font-weight:800; }
.gp-page:disabled { color:${A.textSoft}; cursor:default; }
.gp-foot { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; padding:12px 14px; border-top:1px solid ${A.border}; }
.gp-drawer { position:fixed; top:0; right:0; bottom:0; width:540px; max-width:100%; background:${A.surface}; z-index:61; display:flex; flex-direction:column; box-shadow:-8px 0 28px rgba(15,26,18,0.12); animation:gp-in .18s ease-out; }
@keyframes gp-in { from { transform:translateX(24px); opacity:0; } to { transform:none; opacity:1; } }
.gp-label { font-size:12px; font-weight:700; color:${A.textMuted}; margin-bottom:8px; display:block; }
.gp-box { border:1px solid ${A.border}; border-radius:10px; padding:12px; margin-bottom:20px; }
.gp-kv { display:flex; justify-content:space-between; gap:14px; padding:6px 0; font-size:12.5px; }
.gp-kv span:first-child { color:${A.textMuted}; }
.gp-kv span:last-child { color:${A.text}; font-weight:600; text-align:right; word-break:break-word; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, a:focus-visible { outline:2px solid ${A.green}; outline-offset:1px; }
@media (max-width:1300px) { .gp-stats { grid-template-columns:repeat(3, minmax(0,1fr)); } }
@media (max-width:1000px) { .gp-row2 { grid-template-columns:minmax(0,1fr); } }
@media (max-width:960px) { .gp-table-wrap.q { display:none; } .gp-cards { display:block; } }
@media (max-width:600px) { .gp-stats { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width:420px) { .gp-stats { grid-template-columns:1fr; } }
@media (prefers-reduced-motion: reduce) { .gp-drawer { animation:none; } }
`

export default function GroupsPage() {
  const staff = useStaff()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const canManage = staff.permissions.has('groups.manage')
  const canReports = staff.permissions.has('reports.view')

  const [ov, setOv] = useState<Overview | null>(null)
  const [ovError, setOvError] = useState(false)
  const [rows, setRows] = useState<ListRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reportedOnly, setReportedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [tick, setTick] = useState(0)
  const [menu, setMenu] = useState<Menu>(null)

  const [drawer, setDrawer] = useState<{ id: string; mode: Mode } | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailError, setDetailError] = useState('')
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [confirmNote, setConfirmNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ text: string; err: boolean } | null>(null)
  const reqList = useRef(0)
  const reportsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.err ? 5000 : 2800)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    const t = setTimeout(() => { setQ((cur) => (cur === qInput ? cur : qInput)); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [qInput])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirm) setConfirm(null)
      else if (menu) setMenu(null)
      else if (drawer) setDrawer(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, menu, drawer])
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) }
  }, [menu])

  const loadOverview = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('admin_groups_overview', { p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' })
    if (e || !data) { setOvError(true); return }
    setOvError(false)
    setOv(data as Overview)
  }, [])

  const load = useCallback(async () => {
    const id = ++reqList.current
    setError(false)
    setLoading(true)
    const { data, error: e } = await supabase.rpc('admin_groups_list', {
      p_search: q || null, p_status: status, p_from: from ? startOfDay(from) : null, p_to: to ? nextDay(to) : null,
      p_reported: reportedOnly, p_limit: perPage, p_offset: (page - 1) * perPage,
    })
    if (id !== reqList.current) return
    if (e || !data) { setError(true); setLoading(false); return }
    const d = data as { total: number; rows: ListRow[] }
    setRows(d.rows)
    setTotal(d.total)
    setLoading(false)
  }, [q, status, from, to, reportedOnly, page, perPage])

  useEffect(() => { load() }, [load, tick])
  useEffect(() => { loadOverview() }, [loadOverview, tick])

  const loadDetail = useCallback(async (id: string) => {
    setDetail(null)
    setDetailError('')
    const { data, error: e } = await supabase.rpc('admin_groups_detail', { p_id: id })
    if (e || !data) { setDetailError(e?.message || 'Unable to load this group.'); return }
    setDetail(data as Detail)
  }, [])

  const openDrawer = (id: string, mode: Mode) => { setMenu(null); setDrawer({ id, mode }); loadDetail(id) }
  const closeDrawer = () => { setDrawer(null); setDetail(null) }

  const openParam = params.get('open')
  useEffect(() => {
    if (!openParam) return
    openDrawer(openParam, 'view')
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam])

  useEffect(() => {
    if (drawer?.mode === 'reports' && detail) reportsRef.current?.scrollIntoView({ block: 'start' })
  }, [drawer, detail])

  const act = async (id: string, action: string, note: string | null, okText: string) => {
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_group_action', { p_id: id, p_action: action, p_note: note })
    setBusy(false)
    if (e) { setToast({ text: e.message, err: true }); return false }
    setToast({ text: okText, err: false })
    setTick((n) => n + 1)
    if (action === 'remove') closeDrawer()
    else if (drawer?.id === id) await loadDetail(id)
    return true
  }

  const askConfirm = (kind: ConfirmKind, r: { id: string; name: string; image: string | null; members: number; posts: number }) => {
    setMenu(null)
    setConfirmNote('')
    setConfirm({ kind, ...r })
  }
  const runConfirm = async () => {
    if (!confirm) return
    const note = confirm.kind === 'restore' ? null : confirmNote.trim() || null
    const map = { suspend: 'Group suspended', restore: 'Group restored', remove: 'Group removed' }[confirm.kind]
    if (await act(confirm.id, confirm.kind, note, map)) setConfirm(null)
  }

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const up = rect.bottom + 230 > window.innerHeight
    setMenu({ id, x: Math.max(8, rect.right - 220), y: up ? rect.top - 4 : rect.bottom + 4, up })
  }
  const menuRow = menu ? rows.find((r) => r.id === menu.id) || null : null
  const rowInfo = (r: ListRow) => ({ id: r.id, name: r.name, image: r.icon_url || r.cover_url, members: r.members_count, posts: r.posts_total })

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, totalPages)
  const shownFrom = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const shownTo = Math.min(safePage * perPage, total)
  const filtersActive = status !== 'all' || !!from || !!to || reportedOnly || !!q
  const clearFilters = () => { setStatus('all'); setFrom(''); setTo(''); setReportedOnly(false); setQInput(''); setQ(''); setPage(1) }
  const noGroups = !loading && !error && total === 0 && !filtersActive

  const cards = ov ? [
    { label: 'Total Groups', value: n0(ov.total), icon: 'group', warn: false, note: `${n0(ov.members_total)} members in total` },
    { label: 'Active Groups', value: n0(ov.active), icon: 'check', warn: false, note: `${n0(ov.recently_active)} active in the last 30 days` },
    { label: 'Suspended Groups', value: n0(ov.suspended), icon: 'eyeOff', warn: ov.suspended > 0, note: ov.suspended > 0 ? 'Hidden from outsiders' : 'None suspended' },
    { label: 'Reported Groups', value: n0(ov.reported), icon: 'flag', warn: ov.reported > 0, note: ov.reported > 0 ? 'Have open reports' : 'No open reports' },
    { label: 'New Groups', value: n0(ov.new_30), icon: 'plus', warn: false, note: change(ov.new_30, ov.new_prev).text },
    { label: 'Group Posts', value: n0(ov.posts_total), icon: 'pulse', warn: false, note: 'Posts shared inside groups' },
  ] : []

  const chartMax = ov ? Math.max(4, ...ov.series.map((s) => Math.max(s.joins, s.posts, s.groups))) : 4
  const G = detail?.group
  const reportsUi = (list: ReportRef[]) => list.map((r, idx) => (
    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderTop: idx ? `1px solid ${A.borderSoft}` : 'none', fontSize: 12.5 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontWeight: 700, color: A.text }}>{r.code}</p>
        <p style={{ color: A.textMuted }}>{r.reason.replace(/_/g, ' ')} · {r.status.replace(/_/g, ' ')} · {fmtDay(r.created_at)}</p>
      </div>
      {canReports && <button className="gp-btn" style={{ padding: '5px 12px' }} onClick={() => navigate(`/admin/reports?open=${r.id}`)}><Icon name="link" size={13} /> Open report</button>}
    </div>
  ))

  const rowButtons = (r: ListRow) => (
    <button className="gp-icon-btn" aria-label={`Manage ${shortId(r.id)}`} aria-haspopup="menu" onClick={(e) => openMenu(e, r.id)}><Icon name="more" /></button>
  )

  const copy = (k: ConfirmKind) => ({
    suspend: { title: 'Suspend Group?', body: 'The group is hidden from people outside it, and nobody can post in it or join it. Current members can still read it. You can restore it later.', danger: true },
    restore: { title: 'Restore Group?', body: 'The group becomes visible and active again, and the owner is notified.', danger: false },
    remove: { title: 'Remove Group?', body: 'The group is permanently deleted together with its members list, its posts and the items saved from it. This cannot be undone.', danger: true },
  }[k])

  return (
    <AdminLayout title="Groups">
      <style>{CSS}</style>

      <div className="gp-head">
        <p className="gp-sub" style={{ paddingTop: 7, maxWidth: 560 }}>Manage and monitor groups, members, activity, and reported content across Farmxie.</p>
        <button className="gp-btn" onClick={() => setTick((n) => n + 1)}><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      {!ovError && (
        <div className="gp-stats">
          {(ov ? cards : [0, 1, 2, 3, 4, 5]).map((c, i) => (typeof c === 'number' ? (
            <div key={i} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '14px 16px', minHeight: 104 }}><p style={{ fontSize: 12.5, color: A.textSoft }}>Loading...</p></div>
          ) : (
            <div key={c.label} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: A.textMuted }}>{c.label}</span>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: c.warn ? A.amberChip : A.greenTint, color: c.warn ? A.amber : A.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.icon} size={15} /></span>
              </div>
              <p style={{ fontSize: 26, fontWeight: 800, color: A.text, margin: '6px 0 4px', lineHeight: 1.1 }}>{c.value}</p>
              <p style={{ fontSize: 12, color: c.warn ? A.amber : A.textMuted, fontWeight: 600 }}>{c.note}</p>
            </div>
          )))}
        </div>
      )}

      <div className="gp-filters">
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 11, top: 9, color: A.textSoft, display: 'flex' }}><Icon name="search" size={15} /></span>
          <input className="gp-input" style={{ width: '100%', paddingLeft: 34 }} value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search group, ID, creator, username or description" aria-label="Search groups" />
        </div>
        <select className="gp-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Status">
          <option value="all">Status: All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <label style={{ fontSize: 12, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>Created from <input className="gp-input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></label>
        <label style={{ fontSize: 12, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>to <input className="gp-input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></label>
        <label style={{ fontSize: 12.5, color: A.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={reportedOnly} onChange={(e) => { setReportedOnly(e.target.checked); setPage(1) }} style={{ accentColor: A.green }} /> Reported only
        </label>
        {filtersActive && <button className="gp-btn" onClick={clearFilters}>Clear</button>}
      </div>

      <div className="gp-list" style={{ marginBottom: 18 }}>
        {error ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>Unable to load groups. You may not have permission to view them.</p>
            <button className="gp-btn" onClick={() => setTick((n) => n + 1)}><Icon name="refresh" size={14} /> Try again</button>
          </div>
        ) : loading ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', fontSize: 13, color: A.textMuted }}>Loading groups...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <span style={{ width: 56, height: 56, borderRadius: '50%', background: A.greenTint, color: A.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Icon name="inbox" size={26} /></span>
            <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 6 }}>No groups found</p>
            <p style={{ fontSize: 13, color: A.textMuted, maxWidth: 360, margin: '0 auto', lineHeight: 1.55 }}>
              {noGroups ? 'Groups will appear here when people create them in Farmxie.' : 'No groups match your search or filters.'}
            </p>
          </div>
        ) : (
          <>
            <div className="gp-table-wrap q">
              <table className="gp-table">
                <thead>
                  <tr><th style={{ width: '24%' }}>Group</th><th>Creator</th><th>Members</th><th>Visibility</th><th>Activity</th><th>Status</th><th>Date Created</th><th style={{ width: 130 }}>Action</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={`gp-row${r.rep_open > 0 ? ' attn' : ''}`} onClick={() => openDrawer(r.id, 'view')}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Thumb src={r.icon_url || r.cover_url} />
                          <div style={{ minWidth: 0 }}>
                            <div className="gp-clamp" style={{ fontWeight: 700, color: A.text, maxWidth: 240 }}>{r.name}</div>
                            <div style={{ fontSize: 11.5, color: A.textSoft, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {shortId(r.id)}{r.rep_open > 0 && <ReportedTag n={r.rep_open} />}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={pn(r.creator_name, r.creator_username)} src={r.creator_image} size={28} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: A.text, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>{pn(r.creator_name, r.creator_username)}{r.creator_verified && <Verified />}</div>
                            <div style={{ fontSize: 11.5, color: A.textMuted }}>{r.creator_username ? `@${r.creator_username}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: A.text }}>{n0(r.members_count)}</td>
                      <td style={{ color: A.text }}>Public</td>
                      <td>
                        <div style={{ color: A.text, whiteSpace: 'nowrap' }}>{n0(r.posts_30)} {r.posts_30 === 1 ? 'post' : 'posts'} in 30 days</div>
                        <div style={{ fontSize: 11.5, color: A.textMuted }}>Last active {lastActive(r)}</div>
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td style={{ whiteSpace: 'nowrap', color: A.text }}>{fmtDay(r.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button className="gp-btn" style={{ padding: '5px 12px' }} onClick={(e) => { e.stopPropagation(); openDrawer(r.id, 'view') }}>View</button>
                          {rowButtons(r)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="gp-cards">
              {rows.map((r) => (
                <div key={r.id} className={`gp-card${r.rep_open > 0 ? ' attn' : ''}`}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <Thumb src={r.icon_url || r.cover_url} size={48} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="gp-clamp" style={{ fontWeight: 700, fontSize: 13.5, color: A.text }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: A.textMuted, marginTop: 2 }}>{n0(r.members_count)} members · Public</div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, color: A.textMuted }}>
                    <span>by <b style={{ color: A.text }}>{pn(r.creator_name, r.creator_username)}</b></span>
                    <span>{n0(r.posts_30)} posts in 30 days</span>
                    <span>Last active {lastActive(r)}</span>
                    {r.rep_open > 0 && <ReportedTag n={r.rep_open} />}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="gp-btn" onClick={() => openDrawer(r.id, 'view')}><Icon name="eye" size={14} /> View</button>
                    <span style={{ marginLeft: 'auto' }}>{rowButtons(r)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="gp-foot">
              <span style={{ fontSize: 12.5, color: A.textMuted }}>Showing {shownFrom}-{shownTo} of {total} groups</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="gp-page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="chevL" size={13} /> Previous</button>
                {pageList(safePage, totalPages).map((p, idx) => (p === '…'
                  ? <span key={`g${idx}`} style={{ padding: '0 4px', color: A.textSoft }}>…</span>
                  : <button key={p} className={`gp-page${p === safePage ? ' on' : ''}`} onClick={() => setPage(p)} aria-current={p === safePage ? 'page' : undefined}>{p}</button>))}
                <button className="gp-page" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Next <Icon name="chevR" size={13} /></button>
              </div>
              <label style={{ fontSize: 12.5, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
                Rows per page
                <select className="gp-input" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}>{ROWS.map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </label>
            </div>
          </>
        )}
      </div>

      {ov && ov.total > 0 && (
        <div className="gp-row2">
          <div className="gp-panel">
            <p className="gp-title">Group activity</p>
            <p className="gp-hint">Last 30 days</p>
            <div className="gp-tiles">
              <Tile label="New groups" value={n0(ov.new_30)} hint={change(ov.new_30, ov.new_prev).text} tone={change(ov.new_30, ov.new_prev).tone} />
              <Tile label="New members" value={n0(ov.joins_30)} hint={change(ov.joins_30, ov.joins_prev).text} tone={change(ov.joins_30, ov.joins_prev).tone} />
              <Tile label="Active groups" value={n0(ov.recently_active)} hint={`${n0(ov.total - ov.recently_active)} inactive`} />
            </div>
            {ov.series.some((s) => s.groups + s.joins + s.posts > 0) ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: A.textMuted, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: A.green }} />New members</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: A.blue }} />Group posts</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: A.amberLine }} />Groups created</span>
                </div>
                <div role="img" aria-label="New members, group posts and new groups per day over the last 30 days" style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90, borderBottom: `1px solid ${A.border}` }}>
                  {ov.series.map((s) => (
                    <div key={s.t} title={`${fmtDay(s.t)}: ${s.joins} new members, ${s.posts} posts, ${s.groups} new groups`} style={{ flex: 1, minWidth: 2, display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%' }}>
                      <div style={{ flex: 1, height: `${(s.joins / chartMax) * 100}%`, background: A.green, borderRadius: '2px 2px 0 0' }} />
                      <div style={{ flex: 1, height: `${(s.posts / chartMax) * 100}%`, background: A.blue, borderRadius: '2px 2px 0 0' }} />
                      <div style={{ flex: 1, height: `${(s.groups / chartMax) * 100}%`, background: A.amberLine, borderRadius: '2px 2px 0 0' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: A.textSoft, marginTop: 6 }}>
                  <span>{fmtDay(ov.series[0].t)}</span><span>{fmtDay(ov.series[ov.series.length - 1].t)}</span>
                </div>
              </div>
            ) : <p style={{ fontSize: 12.5, color: A.textMuted, marginTop: 14 }}>No data available for the last 30 days.</p>}
            <p style={{ fontSize: 11.5, color: A.textSoft, marginTop: 12 }}>All groups are public today, so there is no public and private split to show.</p>
          </div>

          <div className="gp-panel">
            <p className="gp-title">Most active groups</p>
            <p className="gp-hint">Posts and new members in the last 30 days</p>
            {ov.top.length === 0 ? <p style={{ fontSize: 13, color: A.textMuted, padding: '28px 0', textAlign: 'center' }}>No data available</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 12 }}>
                <thead><tr>{['Group', 'Posts', 'New members', 'Members'].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 11.5, color: A.textMuted, padding: '6px 0', borderBottom: `1px solid ${A.border}` }}>{h}</th>)}</tr></thead>
                <tbody>
                  {ov.top.map((t) => (
                    <tr key={t.id}>
                      <td style={{ padding: '9px 0', borderBottom: `1px solid ${A.borderSoft}` }}><button className="gp-link" style={{ color: A.text }} onClick={() => openDrawer(t.id, 'view')}>{t.name}</button></td>
                      <td style={{ padding: '9px 0', borderBottom: `1px solid ${A.borderSoft}` }}>{n0(t.posts)}</td>
                      <td style={{ padding: '9px 0', borderBottom: `1px solid ${A.borderSoft}` }}>{n0(t.joins)}</td>
                      <td style={{ padding: '9px 0', borderBottom: `1px solid ${A.borderSoft}` }}>{n0(t.members_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {menu && menuRow && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 64 }} />
          <div role="menu" style={{ position: 'fixed', left: menu.x, top: menu.y, transform: menu.up ? 'translateY(-100%)' : 'none', width: 220, background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(15,26,18,0.16)', padding: 5, zIndex: 65 }}>
            <button role="menuitem" className="gp-menu-item" onClick={() => openDrawer(menuRow.id, 'view')}><Icon name="eye" size={15} /> View</button>
            <button role="menuitem" className="gp-menu-item" disabled={menuRow.rep_total === 0} onClick={() => openDrawer(menuRow.id, 'reports')}>
              <Icon name="flag" size={15} /> Review Reports{menuRow.rep_total > 0 ? ` (${menuRow.rep_total})` : ''}
            </button>
            {canManage && <div style={{ height: 1, background: A.borderSoft, margin: '5px 4px' }} />}
            {canManage && (menuRow.status === 'suspended'
              ? <button role="menuitem" className="gp-menu-item" onClick={() => askConfirm('restore', rowInfo(menuRow))}><Icon name="restore" size={15} /> Restore</button>
              : <button role="menuitem" className="gp-menu-item" onClick={() => askConfirm('suspend', rowInfo(menuRow))}><Icon name="eyeOff" size={15} /> Suspend</button>)}
            {canManage && <button role="menuitem" className="gp-menu-item danger" onClick={() => askConfirm('remove', rowInfo(menuRow))}><Icon name="trash" size={15} /> Remove</button>}
          </div>
        </>
      )}

      {drawer && (
        <>
          <div onClick={closeDrawer} style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.38)', zIndex: 60 }} />
          <aside className="gp-drawer" role="dialog" aria-label="Group details">
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: A.text }}>Group details</p>
                <p style={{ fontSize: 12, color: A.textMuted, marginTop: 2 }}>{shortId(drawer.id)}</p>
              </div>
              {G && <StatusBadge status={G.status} />}
              <button className="gp-icon-btn" aria-label="Close" onClick={closeDrawer}><Icon name="close" size={16} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {detailError ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>{detailError}</p>
                  <button className="gp-btn" onClick={() => loadDetail(drawer.id)}>Try again</button>
                </div>
              ) : !detail || !G ? <p style={{ fontSize: 13, color: A.textMuted }}>Loading group...</p> : (
                <>
                  {detail.reports.some((r) => r.status === 'pending' || r.status === 'under_review') && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: A.amberBg, border: '1px solid #F3E2B8', borderRadius: 8, padding: '10px 12px', marginBottom: 18, color: A.amber, fontSize: 12.5, lineHeight: 1.5 }}>
                      <span style={{ marginTop: 1 }}><Icon name="alert" size={15} /></span>
                      <span>This group has open reports.</span>
                    </div>
                  )}
                  {G.status === 'suspended' && (
                    <div style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 18, color: A.textMuted, fontSize: 12.5, lineHeight: 1.5 }}>
                      This group is suspended. People outside it cannot see it, and nobody can post in it or join it.
                    </div>
                  )}

                  <span className="gp-label">Group information</span>
                  <div className="gp-box">
                    {G.cover_url && <img src={G.cover_url} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 8, border: `1px solid ${A.border}`, marginBottom: 12, background: A.bg }} />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <Thumb src={G.icon_url || G.cover_url} size={52} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 800, color: A.text, wordBreak: 'break-word' }}>{G.name}</p>
                        <p style={{ fontSize: 12, color: A.textSoft }}>{shortId(G.id)}</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 13, color: G.description ? A.text : A.textSoft, lineHeight: 1.6, marginBottom: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{G.description || 'No description.'}</p>
                    <div className="gp-kv"><span>Visibility</span><span>Public</span></div>
                    <div className="gp-kv"><span>Status</span><span><StatusBadge status={G.status} /></span></div>
                    <div className="gp-kv"><span>Creator</span><span>{detail.creator ? pn(detail.creator.full_name, detail.creator.username) : 'Unknown'}</span></div>
                    <div className="gp-kv"><span>Date created</span><span>{fmtFull(G.created_at)}</span></div>
                  </div>

                  <span className="gp-label">Group activity</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginBottom: 20 }}>
                    <Tile label="Total members" value={n0(detail.activity.members)} hint={`${n0(detail.activity.joins_30)} joined in 30 days`} />
                    <Tile label="Total posts" value={n0(detail.activity.posts_total)} hint={`${n0(detail.activity.posts_30)} in 30 days`} />
                    <Tile label="Last post" value={<span style={{ fontSize: 14 }}>{detail.activity.last_post_at ? relative(detail.activity.last_post_at) : 'No posts yet'}</span>} />
                    <Tile label="Last new member" value={<span style={{ fontSize: 14 }}>{detail.activity.last_join_at ? relative(detail.activity.last_join_at) : '-'}</span>} />
                  </div>

                  <span className="gp-label">Recent posts</span>
                  {detail.recent_posts.length === 0 ? <p style={{ fontSize: 12.5, color: A.textMuted, marginBottom: 20 }}>No posts in this group yet.</p> : (
                    <div style={{ border: `1px solid ${A.border}`, borderRadius: 10, marginBottom: 20 }}>
                      {detail.recent_posts.map((p, idx) => (
                        <div key={p.id} style={{ padding: '10px 12px', borderTop: idx ? `1px solid ${A.borderSoft}` : 'none', background: p.reports_open > 0 ? A.amberBg : 'transparent' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: A.text }}>{p.author || 'Unknown user'}{p.username ? <span style={{ color: A.textMuted, fontWeight: 500 }}> @{p.username}</span> : null}</span>
                            <span style={{ fontSize: 11.5, color: A.textSoft, whiteSpace: 'nowrap' }}>{relative(p.created_at)}</span>
                          </div>
                          <p className="gp-clamp" style={{ fontSize: 12.5, color: A.text, whiteSpace: 'pre-wrap' }}>{p.excerpt || (p.images > 0 ? '(image post)' : '')}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            {p.reports_open > 0 && <ReportedTag n={p.reports_open} />}
                            {p.report_id && canReports && <button className="gp-btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => navigate(`/admin/reports?open=${p.report_id}`)}><Icon name="link" size={12} /> Open report</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <span className="gp-label">Members ({n0(detail.activity.members)})</span>
                  <div style={{ border: `1px solid ${A.border}`, borderRadius: 10, marginBottom: 20 }}>
                    {detail.members.map((m, idx) => (
                      <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: idx ? `1px solid ${A.borderSoft}` : 'none' }}>
                        <Avatar name={pn(m.full_name, m.username)} src={m.profile_image} size={32} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: A.text, display: 'flex', alignItems: 'center' }}>{pn(m.full_name, m.username)}{m.is_verified && <Verified />}</div>
                          <div style={{ fontSize: 11.5, color: A.textMuted }}>{m.username ? `@${m.username}` : ''} · joined {fmtDay(m.joined_at)}</div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: m.role === 'owner' ? A.greenDark : A.textMuted, textTransform: 'capitalize' }}>{m.role}</span>
                          <span style={{ fontSize: 11, color: m.account_status === 'active' ? A.textSoft : A.amber, textTransform: 'capitalize' }}>{m.account_status}</span>
                        </div>
                        {m.username && <a className="gp-icon-btn" href={`/u/${m.username}`} target="_blank" rel="noreferrer" aria-label={`View ${pn(m.full_name, m.username)} profile`} title="View profile"><Icon name="link" size={14} /></a>}
                      </div>
                    ))}
                    {detail.activity.members > detail.members.length && <p style={{ fontSize: 11.5, color: A.textSoft, padding: '8px 12px', borderTop: `1px solid ${A.borderSoft}` }}>Showing the first {detail.members.length} members.</p>}
                  </div>

                  <span className="gp-label">Creator</span>
                  {detail.creator ? (
                    <div className="gp-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <Avatar name={pn(detail.creator.full_name, detail.creator.username)} src={detail.creator.profile_image} size={40} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 13.5, fontWeight: 800, color: A.text, display: 'flex', alignItems: 'center' }}>{pn(detail.creator.full_name, detail.creator.username)}{detail.creator.is_verified && <Verified />}</p>
                          <p style={{ fontSize: 12, color: A.textMuted }}>{detail.creator.username ? `@${detail.creator.username}` : ''}</p>
                        </div>
                        {detail.creator.username && <a className="gp-btn" style={{ padding: '5px 12px' }} href={`/u/${detail.creator.username}`} target="_blank" rel="noreferrer"><Icon name="link" size={13} /> View Profile</a>}
                      </div>
                      <div className="gp-kv"><span>Verification</span><span>{detail.creator.is_verified ? 'Verified' : 'Not verified'}</span></div>
                      <div className="gp-kv"><span>Account status</span><span style={{ textTransform: 'capitalize' }}>{detail.creator.account_status}</span></div>
                      <div className="gp-kv"><span>Reports against creator</span><span style={{ color: detail.creator.reports_against > 0 ? A.amber : A.text }}>{detail.creator.reports_against}</span></div>
                      {detail.creator.other_groups.length > 0 && (
                        <div style={{ marginTop: 8, borderTop: `1px solid ${A.borderSoft}`, paddingTop: 8 }}>
                          <p style={{ fontSize: 12, color: A.textMuted, marginBottom: 4 }}>Other groups by this creator</p>
                          {detail.creator.other_groups.map((o) => (
                            <button key={o.id} className="gp-link" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', fontSize: 12.5, color: A.text, padding: '4px 0' }} onClick={() => openDrawer(o.id, 'view')}>
                              <span>{o.name}</span><span style={{ color: A.textMuted, fontWeight: 500 }}>{n0(o.members)} members{o.status === 'suspended' ? ' · suspended' : ''}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {detail.creator.reports.length > 0 && (
                        <div style={{ marginTop: 8, borderTop: `1px solid ${A.borderSoft}`, paddingTop: 8 }}>
                          <p style={{ fontSize: 12, color: A.textMuted, marginBottom: 4 }}>Reports about this creator</p>
                          {detail.creator.reports.map((r) => (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12.5, padding: '4px 0' }}>
                              <span><b>{r.code}</b> <span style={{ color: A.textMuted }}>{r.type} · {r.reason.replace(/_/g, ' ')}</span></span>
                              {canReports && <button className="gp-link" style={{ fontSize: 12, color: A.green }} onClick={() => navigate(`/admin/reports?open=${r.id}`)}>Open</button>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : <p style={{ fontSize: 12.5, color: A.textMuted, marginBottom: 20 }}>The creator account no longer exists.</p>}

                  <div ref={reportsRef} style={{ scrollMarginTop: 8 }}>
                    <span className="gp-label">Reports on this group ({detail.reports.length})</span>
                    {detail.reports.length === 0 ? <p style={{ fontSize: 12.5, color: A.textMuted, marginBottom: 20 }}>No one has reported this group.</p> : (
                      <div style={{ border: `1px solid ${drawer.mode === 'reports' ? A.amberLine : A.border}`, borderRadius: 10, marginBottom: 20 }}>{reportsUi(detail.reports)}</div>
                    )}
                  </div>

                  <span className="gp-label">Moderation history</span>
                  {detail.history.length === 0 ? <p style={{ fontSize: 12.5, color: A.textMuted }}>No moderation actions yet.</p> : (
                    <div style={{ paddingLeft: 4 }}>
                      {detail.history.map((h, idx) => (
                        <div key={h.at + idx} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: idx === detail.history.length - 1 ? 0 : 16 }}>
                          {idx !== detail.history.length - 1 && <span style={{ position: 'absolute', left: 4, top: 14, bottom: 0, width: 1, background: A.border }} />}
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: A.green, marginTop: 4, flexShrink: 0, zIndex: 1 }} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 12.5, color: A.text }}><b style={{ textTransform: 'capitalize' }}>{h.action.replace('groups.', '')}</b>{h.actor ? ` by ${h.actor}` : ''}</p>
                            {h.note && <p style={{ fontSize: 12, color: A.textMuted, marginTop: 2, wordBreak: 'break-word' }}>{h.note}</p>}
                            <p style={{ fontSize: 11.5, color: A.textSoft, marginTop: 1 }}>{fmtFull(h.at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {detail && G && (
              <div style={{ padding: '14px 20px', borderTop: `1px solid ${A.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!canManage ? <span style={{ fontSize: 12.5, color: A.textMuted }}>You have view-only access to groups.</span> : (
                  <>
                    {G.status === 'suspended'
                      ? <button className="gp-btn primary" disabled={busy} onClick={() => askConfirm('restore', { id: G.id, name: G.name, image: G.icon_url || G.cover_url, members: detail.activity.members, posts: detail.activity.posts_total })}><Icon name="restore" size={14} /> Restore Group</button>
                      : <button className="gp-btn" disabled={busy} onClick={() => askConfirm('suspend', { id: G.id, name: G.name, image: G.icon_url || G.cover_url, members: detail.activity.members, posts: detail.activity.posts_total })}><Icon name="eyeOff" size={14} /> Suspend Group</button>}
                    <button className="gp-btn danger" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => askConfirm('remove', { id: G.id, name: G.name, image: G.icon_url || G.cover_url, members: detail.activity.members, posts: detail.activity.posts_total })}><Icon name="trash" size={14} /> Remove Group</button>
                  </>
                )}
              </div>
            )}
          </aside>
        </>
      )}

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.45)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { if (!busy) setConfirm(null) }}>
          <div role="alertdialog" aria-label={copy(confirm.kind).title} onClick={(e) => e.stopPropagation()} style={{ background: A.surface, borderRadius: 12, padding: 22, width: 440, maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 8 }}>{copy(confirm.kind).title}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${A.border}`, borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <Thumb src={confirm.image} size={44} />
              <div style={{ minWidth: 0 }}>
                <p className="gp-clamp" style={{ fontSize: 13, fontWeight: 700, color: A.text }}>{confirm.name}</p>
                <p style={{ fontSize: 12, color: A.textMuted }}>{n0(confirm.members)} members · {n0(confirm.posts)} posts</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: A.textMuted, lineHeight: 1.55, marginBottom: 12 }}>{copy(confirm.kind).body}</p>
            {confirm.kind !== 'restore' && (
              <textarea className="gp-input" style={{ width: '100%', resize: 'vertical', marginBottom: 16 }} rows={2} maxLength={500} value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)} placeholder="Reason (optional, shown to the group owner)" aria-label="Reason" />
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="gp-btn" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              <button className={`gp-btn ${copy(confirm.kind).danger ? 'solid-danger' : 'primary'}`} disabled={busy} onClick={() => void runConfirm()}>{busy ? 'Working...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: toast.err ? '#7F1D1D' : A.greenDark, color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '10px 16px', borderRadius: 8, zIndex: 80, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: 'calc(100vw - 32px)' }}>
          <Icon name={toast.err ? 'alert' : 'check'} size={14} /> {toast.text}
        </div>
      )}
    </AdminLayout>
  )
}
