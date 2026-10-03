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

type LStatus = 'active' | 'sold' | 'paused' | 'suspended'
type ListRow = {
  id: string; title: string; category: string; price: number; currency: string; unit: string | null; quantity: number | null
  image: string | null; image_count: number; status: LStatus; flagged: boolean; created_at: string
  seller_id: string; seller_name: string | null; seller_username: string | null; seller_image: string | null
  rep_open: number; rep_total: number
}
type Overview = {
  total: number; active: number; sold: number; paused: number; suspended: number; flagged: number; reported: number; sellers: number
  orders_30: number; orders_prev: number; new_30: number; new_prev: number; completed_30: number; completed_prev: number
  sellers_30: number; sellers_prev: number
  categories: { category: string; listings: number; active: number; sold: number; suspended: number }[]
  series: { t: string; listings: number; orders: number }[]
}
type Seller = {
  user_id: string; full_name: string | null; username: string | null; profile_image: string | null; role: string | null
  is_verified: boolean; account_status: string
}
type Detail = {
  listing: {
    id: string; title: string; description: string | null; category: string; price: number; currency: string; unit: string | null
    quantity: number | null; location: string | null; images: string[]; status: LStatus; seller_status: string; negotiable: boolean | null
    flagged: boolean; created_at: string; company_id: string | null
  }
  seller: (Seller & { listings: number; active_listings: number }) | null
  company: { id: string; name: string; status: string } | null
  activity: { saves: number; orders: number; reports: number; open_reports: number }
  reports: { id: string; code: string; reason: string; status: string; created_at: string }[]
  history: { action: string; actor: string | null; at: string; note: string | null }[]
}
type SellerDetail = Seller & {
  member_since: string; location: string | null; listings: number; active_listings: number; sold_listings: number; suspended_listings: number
  orders_received: number; completed_sales: number; reports_against: number
  recent: { id: string; title: string; status: LStatus; price: number; currency: string; created_at: string }[]
}
type Order = { id: string; code: string; listing_title: string | null; buyer_id: string; seller_id: string; amount: number; currency: string; status: string; created_at: string }
type Menu = { id: string; x: number; y: number; up: boolean } | null
type ConfirmKind = 'suspend' | 'restore' | 'remove'
type Confirm = { kind: ConfirmKind; id: string; title: string; image: string | null; seller: string; price: string } | null
type Mode = 'view' | 'reports'

const STATUS_LABEL: Record<LStatus, string> = { active: 'Active', sold: 'Sold', paused: 'Paused', suspended: 'Suspended' }
const STATUS_STYLE: Record<LStatus, { bg: string; color: string; dot: string }> = {
  active: { bg: '#DCFCE7', color: '#166534', dot: '#16A34A' },
  sold: { bg: '#E8F0FE', color: '#1E40AF', dot: A.blue },
  paused: { bg: '#F1F3F1', color: '#4B5563', dot: '#9AA39B' },
  suspended: { bg: A.amberChip, color: A.amber, dot: A.amberLine },
}
const CATEGORY_LABEL: Record<string, string> = { crop: 'Crops', livestock: 'Livestock', seed: 'Seeds' }
const catLabel = (c: string) => CATEGORY_LABEL[c] || c
const ORDER_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  escrow_held: { label: 'In escrow', bg: '#E8F0FE', color: '#1E40AF' },
  completed: { label: 'Completed', bg: '#DCFCE7', color: '#166534' },
  disputed: { label: 'Disputed', bg: A.amberChip, color: A.amber },
  refunded: { label: 'Refunded', bg: '#F1F3F1', color: '#4B5563' },
  cancelled: { label: 'Cancelled', bg: '#F1F3F1', color: '#4B5563' },
}
const ROWS = [10, 25, 50]

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const fmtFull = (iso: string) => `${fmtDay(iso)}, ${fmtTime(iso)}`
const startOfDay = (d: string) => new Date(`${d}T00:00:00`).toISOString()
const nextDay = (d: string) => { const x = new Date(`${d}T00:00:00`); x.setDate(x.getDate() + 1); return x.toISOString() }
const initials = (n: string) => n.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?'
const sname = (n: string | null, u: string | null) => n || u || 'Unknown seller'
const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`
const n0 = (v: number) => v.toLocaleString()
function money(currency: string, amount: number) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount) } catch { return `${currency} ${n0(amount)}` }
}
const priceText = (r: { price: number; currency: string; unit: string | null }) => `${money(r.currency, r.price)}${r.unit ? ` / ${r.unit}` : ''}`
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
  store: 'M4 9l1-5h14l1 5M4 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0M5 11v9h14v-9',
  users: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-1a4 4 0 00-3-3.9M16 4.2a3.5 3.5 0 010 6.6',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  image: 'M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM9 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM21 16l-5-5-9-9',
  up: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  down: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
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
function Thumb({ src, size = 44 }: { src: string | null; size?: number }) {
  const [bad, setBad] = useState(false)
  const box = { width: size, height: size, borderRadius: 8, flexShrink: 0 as const, border: `1px solid ${A.border}` }
  if (!src || bad) return <span style={{ ...box, background: A.bg, color: A.textSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={size * 0.4} /></span>
  return <img src={src} alt="" onError={() => setBad(true)} style={{ ...box, objectFit: 'cover' }} />
}
function Avatar({ name, src, size = 30 }: { name: string; src: string | null; size?: number }) {
  const box = { width: size, height: size, borderRadius: '50%', flexShrink: 0 as const }
  if (src) return <img src={src} alt="" style={{ ...box, objectFit: 'cover', border: `1px solid ${A.border}` }} />
  return <span style={{ ...box, background: A.greenTint, color: A.greenDark, border: '1px solid #D3EBDA', fontSize: size * 0.38, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{initials(name)}</span>
}
function StatusBadge({ status }: { status: LStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />{STATUS_LABEL[status]}
    </span>
  )
}
const FlagTag = () => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: A.amber, marginLeft: 6 }}><Icon name="flag" size={11} />Flagged</span>
function CatChip({ c }: { c: string }) {
  return <span style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: `1px solid ${A.border}`, color: '#374151', background: A.surface, whiteSpace: 'nowrap' }}>{catLabel(c)}</span>
}
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
.mk-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
.mk-sub { font-size:13px; color:${A.textMuted}; line-height:1.5; }
.mk-stats { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:14px; margin-bottom:18px; }
.mk-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
.mk-input { padding:9px 12px; border-radius:8px; border:1px solid ${A.border}; font-size:12.5px; background:${A.surface}; color:${A.text}; font-family:inherit; box-sizing:border-box; }
.mk-list { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; }
.mk-table-wrap { overflow-x:auto; }
.mk-table { width:100%; border-collapse:collapse; font-size:12.5px; min-width:980px; }
.mk-table.small { min-width:640px; }
.mk-table th { padding:10px 14px; font-size:11.5px; font-weight:700; color:${A.textMuted}; text-align:left; background:${A.bg}; border-bottom:1px solid ${A.border}; white-space:nowrap; }
.mk-table td { padding:12px 14px; border-bottom:1px solid ${A.borderSoft}; vertical-align:middle; }
.mk-table tr:last-child td { border-bottom:none; }
.mk-row { cursor:pointer; }
.mk-row:hover { background:#FAFBFA; }
.mk-row.attn { background:${A.amberBg}; }
.mk-row.attn:hover { background:#FFF7DD; }
.mk-row.attn td:first-child { box-shadow: inset 3px 0 0 ${A.amberLine}; }
.mk-clamp { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.45; word-break:break-word; }
.mk-cards { display:none; }
.mk-card { padding:14px; border-bottom:1px solid ${A.borderSoft}; }
.mk-card.attn { background:${A.amberBg}; box-shadow: inset 3px 0 0 ${A.amberLine}; }
.mk-card:last-child { border-bottom:none; }
.mk-panel { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; padding:16px; min-width:0; }
.mk-title { font-size:13.5px; font-weight:800; color:${A.text}; }
.mk-hint { font-size:12px; color:${A.textMuted}; margin-top:2px; }
.mk-tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-top:14px; }
.mk-row2 { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; margin-bottom:18px; }
.mk-btn { font-family:inherit; cursor:pointer; border-radius:8px; font-size:12.5px; font-weight:700; padding:8px 14px; border:1px solid ${A.border}; background:${A.surface}; color:${A.text}; display:inline-flex; align-items:center; gap:7px; text-decoration:none; }
.mk-btn:hover:not(:disabled) { background:${A.bg}; }
.mk-btn:disabled { opacity:.55; cursor:default; }
.mk-btn.primary { background:${A.green}; border-color:${A.green}; color:#fff; }
.mk-btn.primary:hover:not(:disabled) { background:#15803D; }
.mk-btn.danger { color:${A.red}; }
.mk-btn.danger:hover:not(:disabled) { background:#FEF2F2; }
.mk-btn.solid-danger { background:${A.red}; border-color:${A.red}; color:#fff; }
.mk-btn.solid-danger:hover:not(:disabled) { background:#991B1B; }
.mk-icon-btn { font-family:inherit; cursor:pointer; width:30px; height:30px; border-radius:7px; border:1px solid transparent; background:transparent; color:${A.textMuted}; display:inline-flex; align-items:center; justify-content:center; }
.mk-icon-btn:hover { background:${A.bg}; border-color:${A.border}; color:${A.text}; }
.mk-link { font-family:inherit; border:none; background:transparent; padding:0; cursor:pointer; color:inherit; font-weight:700; text-align:left; }
.mk-link:hover { color:${A.green}; text-decoration:underline; }
.mk-menu-item { width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; font-family:inherit; font-size:12.5px; font-weight:600; color:${A.text}; cursor:pointer; text-align:left; border-radius:6px; }
.mk-menu-item:hover:not(:disabled) { background:${A.bg}; }
.mk-menu-item:disabled { color:${A.textSoft}; cursor:default; }
.mk-menu-item.danger { color:${A.red}; }
.mk-page { min-width:30px; height:30px; padding:0 8px; border-radius:7px; border:1px solid transparent; background:transparent; font-family:inherit; font-size:12.5px; font-weight:600; color:${A.text}; cursor:pointer; }
.mk-page:hover:not(:disabled) { background:${A.bg}; border-color:${A.border}; }
.mk-page.on { background:${A.greenTint}; border-color:#BFE3CA; color:${A.greenDark}; font-weight:800; }
.mk-page:disabled { color:${A.textSoft}; cursor:default; }
.mk-foot { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; padding:12px 14px; border-top:1px solid ${A.border}; }
.mk-drawer { position:fixed; top:0; right:0; bottom:0; width:520px; max-width:100%; background:${A.surface}; z-index:61; display:flex; flex-direction:column; box-shadow:-8px 0 28px rgba(15,26,18,0.12); animation:mk-in .18s ease-out; }
@keyframes mk-in { from { transform:translateX(24px); opacity:0; } to { transform:none; opacity:1; } }
.mk-label { font-size:12px; font-weight:700; color:${A.textMuted}; margin-bottom:8px; display:block; }
.mk-box { border:1px solid ${A.border}; border-radius:10px; padding:12px; margin-bottom:20px; }
.mk-kv { display:flex; justify-content:space-between; gap:14px; padding:6px 0; font-size:12.5px; }
.mk-kv span:first-child { color:${A.textMuted}; }
.mk-kv span:last-child { color:${A.text}; font-weight:600; text-align:right; word-break:break-word; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, a:focus-visible { outline:2px solid ${A.green}; outline-offset:1px; }
@media (max-width:1200px) { .mk-stats { grid-template-columns:repeat(3, minmax(0,1fr)); } }
@media (max-width:1000px) { .mk-row2 { grid-template-columns:minmax(0,1fr); } }
@media (max-width:960px) { .mk-table-wrap.q { display:none; } .mk-cards { display:block; } .mk-stats { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width:480px) { .mk-stats { grid-template-columns:1fr; } }
@media (prefers-reduced-motion: reduce) { .mk-drawer { animation:none; } }
`

export default function MarketplacePage() {
  const staff = useStaff()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const canModerate = staff.permissions.has('marketplace.moderate')
  const canManage = staff.permissions.has('marketplace.manage')
  const canReports = staff.permissions.has('reports.view')
  const canWallet = staff.permissions.has('wallet.view')

  const [ov, setOv] = useState<Overview | null>(null)
  const [ovError, setOvError] = useState(false)
  const [rows, setRows] = useState<ListRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
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
  const [sellerId, setSellerId] = useState<string | null>(null)
  const [seller, setSeller] = useState<SellerDetail | null>(null)
  const [imgIdx, setImgIdx] = useState(0)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [confirmNote, setConfirmNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ text: string; err: boolean } | null>(null)
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
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
      else if (sellerId) setSellerId(null)
      else if (drawer) setDrawer(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, menu, sellerId, drawer])
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) }
  }, [menu])

  const loadOverview = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('admin_marketplace_overview', { p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' })
    if (e || !data) { setOvError(true); return }
    setOvError(false)
    setOv(data as Overview)
  }, [])

  const load = useCallback(async () => {
    const id = ++reqList.current
    setError(false)
    setLoading(true)
    const { data, error: e } = await supabase.rpc('admin_marketplace_list', {
      p_search: q || null, p_status: status, p_category: category,
      p_from: from ? startOfDay(from) : null, p_to: to ? nextDay(to) : null, p_reported: reportedOnly,
      p_limit: perPage, p_offset: (page - 1) * perPage,
    })
    if (id !== reqList.current) return
    if (e || !data) { setError(true); setLoading(false); return }
    const d = data as { total: number; rows: ListRow[] }
    setRows(d.rows)
    setTotal(d.total)
    setLoading(false)
  }, [q, status, category, from, to, reportedOnly, page, perPage])

  useEffect(() => { load() }, [load, tick])
  useEffect(() => { loadOverview() }, [loadOverview, tick])

  const loadOrders = useCallback(async () => {
    if (!canWallet) return
    const { data, error: e } = await supabase.from('orders').select('id, code, listing_title, buyer_id, seller_id, amount, currency, status, created_at').order('created_at', { ascending: false }).limit(10)
    if (e) { setOrders([]); return }
    const list = (data || []) as Order[]
    setOrders(list)
    const ids = [...new Set(list.flatMap((o) => [o.buyer_id, o.seller_id]))]
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('user_id, full_name, username').in('user_id', ids)
      const map: Record<string, string> = {}
      ;((ps || []) as { user_id: string; full_name: string | null; username: string | null }[]).forEach((p) => { map[p.user_id] = sname(p.full_name, p.username) })
      setNames(map)
    }
  }, [canWallet])
  useEffect(() => { loadOrders() }, [loadOrders, tick])

  const loadDetail = useCallback(async (id: string) => {
    setDetail(null)
    setDetailError('')
    setImgIdx(0)
    const { data, error: e } = await supabase.rpc('admin_marketplace_detail', { p_id: id })
    if (e || !data) { setDetailError(e?.message || 'Unable to load this listing.'); return }
    setDetail(data as Detail)
  }, [])

  const openDrawer = (id: string, mode: Mode) => { setMenu(null); setSellerId(null); setDrawer({ id, mode }); loadDetail(id) }
  const closeDrawer = () => { setDrawer(null); setSellerId(null); setDetail(null) }

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

  const openSeller = async (userId: string) => {
    setMenu(null)
    setSeller(null)
    setSellerId(userId)
    if (!drawer) setDrawer({ id: '', mode: 'view' })
    const { data, error: e } = await supabase.rpc('admin_marketplace_seller', { p_user_id: userId })
    if (e || !data) { setToast({ text: e?.message || 'Unable to load this seller.', err: true }); setSellerId(null); return }
    setSeller(data as SellerDetail)
  }

  const act = async (id: string, action: string, note: string | null, okText: string) => {
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_listing_action', { p_id: id, p_action: action, p_note: note })
    setBusy(false)
    if (e) { setToast({ text: e.message, err: true }); return false }
    setToast({ text: okText, err: false })
    setTick((n) => n + 1)
    if (action === 'remove') { closeDrawer() } else if (drawer?.id === id) { await loadDetail(id) }
    return true
  }

  const askConfirm = (kind: ConfirmKind, r: { id: string; title: string; image: string | null; seller: string; price: string }) => {
    setMenu(null)
    setConfirmNote('')
    setConfirm({ kind, ...r })
  }
  const runConfirm = async () => {
    if (!confirm) return
    const note = confirmNote.trim() || null
    const map = { suspend: ['suspend', 'Listing suspended'], restore: ['restore', 'Listing restored'], remove: ['remove', 'Listing removed'] }[confirm.kind]
    const ok = await act(confirm.id, map[0], confirm.kind === 'restore' ? null : note, map[1])
    if (ok) setConfirm(null)
  }

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const up = rect.bottom + 280 > window.innerHeight
    setMenu({ id, x: Math.max(8, rect.right - 220), y: up ? rect.top - 4 : rect.bottom + 4, up })
  }
  const menuRow = menu ? rows.find((r) => r.id === menu.id) || null : null
  const rowInfo = (r: ListRow) => ({ id: r.id, title: r.title, image: r.image, seller: sname(r.seller_name, r.seller_username), price: priceText(r) })

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, totalPages)
  const shownFrom = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const shownTo = Math.min(safePage * perPage, total)
  const filtersActive = status !== 'all' || category !== 'all' || !!from || !!to || reportedOnly || !!q
  const clearFilters = () => { setStatus('all'); setCategory('all'); setFrom(''); setTo(''); setReportedOnly(false); setQInput(''); setQ(''); setPage(1) }
  const noListings = !loading && !error && total === 0 && !filtersActive

  const cards = ov ? [
    { label: 'Total Listings', value: n0(ov.total), icon: 'store', warn: false, note: `${n0(ov.sold)} sold` },
    { label: 'Active Listings', value: n0(ov.active), icon: 'check', warn: false, note: ov.paused > 0 ? `${n0(ov.paused)} paused by sellers` : 'Visible to buyers' },
    { label: 'Reported Listings', value: n0(ov.reported), icon: 'flag', warn: ov.reported > 0, note: ov.reported > 0 ? 'Have open reports' : 'No open reports' },
    { label: 'Total Sellers', value: n0(ov.sellers), icon: 'users', warn: false, note: `${n0(ov.sellers_30)} listed in the last 30 days` },
    { label: 'Marketplace Activity', value: n0(ov.orders_30), icon: 'pulse', warn: false, note: 'Orders in the last 30 days' },
  ] : []

  const chartMax = ov ? Math.max(4, ...ov.series.map((s) => Math.max(s.listings, s.orders))) : 4
  const L = detail?.listing
  const canRemove = canManage

  const detailActions = () => {
    if (!detail || !L) return null
    const info = { id: L.id, title: L.title, image: L.images[0] || null, seller: detail.seller ? sname(detail.seller.full_name, detail.seller.username) : 'Unknown seller', price: priceText(L) }
    if (!canModerate && !canRemove) return <span style={{ fontSize: 12.5, color: A.textMuted }}>You have view-only access to the marketplace.</span>
    return (
      <>
        {canModerate && (L.status === 'suspended'
          ? <button className="mk-btn primary" disabled={busy} onClick={() => askConfirm('restore', info)}><Icon name="restore" size={14} /> Restore Listing</button>
          : <button className="mk-btn" disabled={busy} onClick={() => askConfirm('suspend', info)}><Icon name="eyeOff" size={14} /> Suspend Listing</button>)}
        {canModerate && (L.flagged
          ? <button className="mk-btn" disabled={busy} onClick={() => act(L.id, 'unflag', null, 'Flag cleared')}>Clear Flag</button>
          : <button className="mk-btn" disabled={busy} onClick={() => act(L.id, 'flag', null, 'Flagged for review')}><Icon name="flag" size={14} /> Flag</button>)}
        {canRemove && <button className="mk-btn danger" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => askConfirm('remove', info)}><Icon name="trash" size={14} /> Remove Listing</button>}
      </>
    )
  }

  const rowButtons = (r: ListRow) => (
    <button className="mk-icon-btn" aria-label={`Manage ${shortId(r.id)}`} aria-haspopup="menu" onClick={(e) => openMenu(e, r.id)}><Icon name="more" /></button>
  )

  const copy = (k: ConfirmKind) => ({
    suspend: { title: 'Suspend Listing?', body: 'The listing will be hidden from buyers. The seller is notified and you can restore it later.', cta: 'Confirm', danger: true },
    restore: { title: 'Restore Listing?', body: 'The listing will be visible to buyers again and the seller is notified.', cta: 'Confirm', danger: false },
    remove: { title: 'Remove Listing?', body: 'The listing is permanently deleted, along with the saves buyers made on it. Past orders keep their details. This cannot be undone.', cta: 'Confirm', danger: true },
  }[k])

  return (
    <AdminLayout title="Marketplace">
      <style>{CSS}</style>

      <div className="mk-head">
        <p className="mk-sub" style={{ paddingTop: 7, maxWidth: 560 }}>Manage and monitor products, sellers, listings, and marketplace activity across FarmLite.</p>
        <button className="mk-btn" onClick={() => setTick((n) => n + 1)}><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      {!ovError && (
        <div className="mk-stats">
          {(ov ? cards : [0, 1, 2, 3, 4]).map((c, i) => (typeof c === 'number' ? (
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

      <div className="mk-filters">
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 11, top: 9, color: A.textSoft, display: 'flex' }}><Icon name="search" size={15} /></span>
          <input className="mk-input" style={{ width: '100%', paddingLeft: 34 }} value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search product, seller, listing ID or category" aria-label="Search listings" />
        </div>
        <select className="mk-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Status">
          <option value="all">Status: All</option>
          {(Object.keys(STATUS_LABEL) as LStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="mk-input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} aria-label="Category">
          <option value="all">Category: All</option>
          {Object.keys(CATEGORY_LABEL).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <label style={{ fontSize: 12, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>From <input className="mk-input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></label>
        <label style={{ fontSize: 12, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>To <input className="mk-input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></label>
        <label style={{ fontSize: 12.5, color: A.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={reportedOnly} onChange={(e) => { setReportedOnly(e.target.checked); setPage(1) }} style={{ accentColor: A.green }} /> Reported only
        </label>
        {filtersActive && <button className="mk-btn" onClick={clearFilters}>Clear</button>}
      </div>

      <div className="mk-list" style={{ marginBottom: 18 }}>
        {error ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>Unable to load marketplace data.</p>
            <button className="mk-btn" onClick={() => setTick((n) => n + 1)}><Icon name="refresh" size={14} /> Try again</button>
          </div>
        ) : loading ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', fontSize: 13, color: A.textMuted }}>Loading marketplace...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <span style={{ width: 56, height: 56, borderRadius: '50%', background: A.greenTint, color: A.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Icon name="inbox" size={26} /></span>
            <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 6 }}>No marketplace listings found</p>
            <p style={{ fontSize: 13, color: A.textMuted, maxWidth: 360, margin: '0 auto', lineHeight: 1.55 }}>
              {noListings ? 'Marketplace listings will appear here when sellers publish products.' : 'No listings match your search or filters.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mk-table-wrap q">
              <table className="mk-table">
                <thead>
                  <tr><th style={{ width: '27%' }}>Product</th><th>Seller</th><th>Category</th><th>Price</th><th>Status</th><th>Date</th><th>Reports</th><th style={{ width: 130 }}>Action</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={`mk-row${r.rep_open > 0 || r.flagged ? ' attn' : ''}`} onClick={() => openDrawer(r.id, 'view')}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Thumb src={r.image} />
                          <div style={{ minWidth: 0 }}>
                            <div className="mk-clamp" style={{ fontWeight: 700, color: A.text, maxWidth: 260 }}>{r.title}</div>
                            <div style={{ fontSize: 11.5, color: A.textSoft, marginTop: 2 }}>{shortId(r.id)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={sname(r.seller_name, r.seller_username)} src={r.seller_image} size={28} />
                          <button className="mk-link" style={{ color: A.text }} onClick={(e) => { e.stopPropagation(); openSeller(r.seller_id) }}>{sname(r.seller_name, r.seller_username)}</button>
                        </div>
                      </td>
                      <td><CatChip c={r.category} /></td>
                      <td style={{ color: A.text, whiteSpace: 'nowrap' }}>{priceText(r)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><StatusBadge status={r.status} />{r.flagged && <FlagTag />}</td>
                      <td style={{ whiteSpace: 'nowrap', color: A.text }}>{fmtDay(r.created_at)}</td>
                      <td>
                        {r.rep_total === 0 ? <span style={{ color: A.textSoft }}>None</span> : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color: r.rep_open > 0 ? A.amber : A.textMuted }}><Icon name="flag" size={12} />{r.rep_total}</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button className="mk-btn" style={{ padding: '5px 12px' }} onClick={(e) => { e.stopPropagation(); openDrawer(r.id, 'view') }}>View</button>
                          {rowButtons(r)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mk-cards">
              {rows.map((r) => (
                <div key={r.id} className={`mk-card${r.rep_open > 0 || r.flagged ? ' attn' : ''}`}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <Thumb src={r.image} size={52} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="mk-clamp" style={{ fontWeight: 700, fontSize: 13.5, color: A.text }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: A.textMuted, marginTop: 2 }}>{priceText(r)}</div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, color: A.textMuted }}>
                    <CatChip c={r.category} />
                    <button className="mk-link" style={{ color: A.text, fontSize: 12 }} onClick={() => openSeller(r.seller_id)}>{sname(r.seller_name, r.seller_username)}</button>
                    <span>{fmtDay(r.created_at)}</span>
                    {r.flagged && <FlagTag />}
                    {r.rep_total > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: r.rep_open > 0 ? A.amber : A.textMuted }}><Icon name="flag" size={12} />{r.rep_total} {r.rep_total === 1 ? 'report' : 'reports'}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="mk-btn" onClick={() => openDrawer(r.id, 'view')}><Icon name="eye" size={14} /> View</button>
                    <span style={{ marginLeft: 'auto' }}>{rowButtons(r)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mk-foot">
              <span style={{ fontSize: 12.5, color: A.textMuted }}>Showing {shownFrom}-{shownTo} of {total} listings</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="mk-page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="chevL" size={13} /> Previous</button>
                {pageList(safePage, totalPages).map((p, idx) => (p === '…'
                  ? <span key={`g${idx}`} style={{ padding: '0 4px', color: A.textSoft }}>…</span>
                  : <button key={p} className={`mk-page${p === safePage ? ' on' : ''}`} onClick={() => setPage(p)} aria-current={p === safePage ? 'page' : undefined}>{p}</button>))}
                <button className="mk-page" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Next <Icon name="chevR" size={13} /></button>
              </div>
              <label style={{ fontSize: 12.5, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
                Rows per page
                <select className="mk-input" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}>{ROWS.map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </label>
            </div>
          </>
        )}
      </div>

      {ov && (
        <>
          <div className="mk-panel" style={{ marginBottom: 18 }}>
            <p className="mk-title">Marketplace activity</p>
            <p className="mk-hint">Last 30 days. Listing views and buyer inquiries are not tracked yet, so they are not shown.</p>
            <div className="mk-tiles">
              <Tile label="New listings" value={n0(ov.new_30)} hint={change(ov.new_30, ov.new_prev).text} tone={change(ov.new_30, ov.new_prev).tone} />
              <Tile label="Active listings" value={n0(ov.active)} hint="Right now" />
              <Tile label="Seller activity" value={n0(ov.sellers_30)} hint={`sellers who listed · ${change(ov.sellers_30, ov.sellers_prev).text}`} tone={change(ov.sellers_30, ov.sellers_prev).tone} />
              <Tile label="Orders placed" value={n0(ov.orders_30)} hint={change(ov.orders_30, ov.orders_prev).text} tone={change(ov.orders_30, ov.orders_prev).tone} />
              <Tile label="Completed transactions" value={n0(ov.completed_30)} hint={change(ov.completed_30, ov.completed_prev).text} tone={change(ov.completed_30, ov.completed_prev).tone} />
            </div>
            {ov.new_30 + ov.orders_30 > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: A.textMuted, marginBottom: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: A.green }} />New listings</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: A.blue }} />Orders placed</span>
                </div>
                <div role="img" aria-label="New listings and orders per day over the last 30 days" style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90, borderBottom: `1px solid ${A.border}` }}>
                  {ov.series.map((s) => (
                    <div key={s.t} title={`${fmtDay(s.t)}: ${s.listings} listings, ${s.orders} orders`} style={{ flex: 1, minWidth: 2, display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%' }}>
                      <div style={{ flex: 1, height: `${(s.listings / chartMax) * 100}%`, background: A.green, borderRadius: '2px 2px 0 0' }} />
                      <div style={{ flex: 1, height: `${(s.orders / chartMax) * 100}%`, background: A.blue, borderRadius: '2px 2px 0 0' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: A.textSoft, marginTop: 6 }}>
                  <span>{ov.series[0] ? fmtDay(ov.series[0].t) : ''}</span><span>{ov.series.length ? fmtDay(ov.series[ov.series.length - 1].t) : ''}</span>
                </div>
              </div>
            )}
          </div>

          <div className="mk-list" style={{ marginBottom: 18 }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${A.border}` }}>
              <p className="mk-title">Categories</p>
              <p className="mk-hint">The marketplace categories sellers choose from.</p>
            </div>
            {ov.categories.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: A.textMuted }}>No data available</div>
            ) : (
              <div className="mk-table-wrap">
                <table className="mk-table small">
                  <thead><tr><th>Category</th><th>Listings</th><th>Active</th><th>Sold</th><th>Suspended</th></tr></thead>
                  <tbody>
                    {ov.categories.map((c) => (
                      <tr key={c.category}>
                        <td style={{ fontWeight: 700, color: A.text }}>{catLabel(c.category)}</td>
                        <td>{n0(c.listings)}</td><td>{n0(c.active)}</td><td>{n0(c.sold)}</td><td>{n0(c.suspended)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {canWallet && orders && (
        <div className="mk-list">
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${A.border}` }}>
            <p className="mk-title">Recent transactions</p>
            <p className="mk-hint">The latest orders placed in the marketplace.</p>
          </div>
          {orders.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: A.textMuted }}>No transactions yet.</div>
          ) : (
            <div className="mk-table-wrap">
              <table className="mk-table small" style={{ minWidth: 820 }}>
                <thead><tr><th>Transaction ID</th><th>Buyer</th><th>Seller</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {orders.map((o) => {
                    const st = ORDER_STATUS[o.status] || { label: o.status, bg: '#F1F3F1', color: '#4B5563' }
                    return (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 700, color: A.text, whiteSpace: 'nowrap' }}>{o.code}</td>
                        <td>{names[o.buyer_id] || '-'}</td><td>{names[o.seller_id] || '-'}</td>
                        <td><div className="mk-clamp" style={{ maxWidth: 220 }}>{o.listing_title || '-'}</div></td>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{money(o.currency, o.amount)}</td>
                        <td><span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtFull(o.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {menu && menuRow && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 64 }} />
          <div role="menu" style={{ position: 'fixed', left: menu.x, top: menu.y, transform: menu.up ? 'translateY(-100%)' : 'none', width: 220, background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(15,26,18,0.16)', padding: 5, zIndex: 65 }}>
            <button role="menuitem" className="mk-menu-item" onClick={() => openDrawer(menuRow.id, 'view')}><Icon name="eye" size={15} /> View</button>
            <button role="menuitem" className="mk-menu-item" onClick={() => openSeller(menuRow.seller_id)}><Icon name="users" size={15} /> View Seller</button>
            <button role="menuitem" className="mk-menu-item" disabled={menuRow.rep_total === 0} onClick={() => openDrawer(menuRow.id, 'reports')}>
              <Icon name="flag" size={15} /> View Reports{menuRow.rep_total > 0 ? ` (${menuRow.rep_total})` : ''}
            </button>
            {(canModerate || canRemove) && <div style={{ height: 1, background: A.borderSoft, margin: '5px 4px' }} />}
            {canModerate && (menuRow.status === 'suspended'
              ? <button role="menuitem" className="mk-menu-item" onClick={() => askConfirm('restore', rowInfo(menuRow))}><Icon name="restore" size={15} /> Restore</button>
              : <button role="menuitem" className="mk-menu-item" onClick={() => askConfirm('suspend', rowInfo(menuRow))}><Icon name="eyeOff" size={15} /> Suspend</button>)}
            {canModerate && (menuRow.flagged
              ? <button role="menuitem" className="mk-menu-item" onClick={() => { setMenu(null); void act(menuRow.id, 'unflag', null, 'Flag cleared') }}><Icon name="flag" size={15} /> Clear Flag</button>
              : <button role="menuitem" className="mk-menu-item" onClick={() => { setMenu(null); void act(menuRow.id, 'flag', null, 'Flagged for review') }}><Icon name="flag" size={15} /> Flag for Review</button>)}
            {canRemove && <button role="menuitem" className="mk-menu-item danger" onClick={() => askConfirm('remove', rowInfo(menuRow))}><Icon name="trash" size={15} /> Remove</button>}
          </div>
        </>
      )}

      {drawer && (
        <>
          <div onClick={closeDrawer} style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.38)', zIndex: 60 }} />
          <aside className="mk-drawer" role="dialog" aria-label={sellerId ? 'Seller details' : 'Listing details'}>
            {sellerId ? (
              <>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  {drawer.id && <button className="mk-icon-btn" aria-label="Back to listing" onClick={() => setSellerId(null)}><Icon name="chevL" size={16} /></button>}
                  <p style={{ flex: 1, fontSize: 15, fontWeight: 800, color: A.text }}>Seller details</p>
                  <button className="mk-icon-btn" aria-label="Close" onClick={closeDrawer}><Icon name="close" size={16} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                  {!seller ? <p style={{ fontSize: 13, color: A.textMuted }}>Loading seller...</p> : (
                    <>
                      <div className="mk-box" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={sname(seller.full_name, seller.username)} src={seller.profile_image} size={48} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 800, color: A.text }}>{sname(seller.full_name, seller.username)}</p>
                          <p style={{ fontSize: 12, color: A.textMuted }}>{seller.username ? `@${seller.username}` : ''}</p>
                        </div>
                      </div>
                      <span className="mk-label">Seller</span>
                      <div className="mk-box">
                        <div className="mk-kv"><span>Seller type</span><span>{seller.role || '-'}</span></div>
                        <div className="mk-kv"><span>Verification</span><span>{seller.is_verified ? 'Verified' : 'Not verified'}</span></div>
                        <div className="mk-kv"><span>Account status</span><span style={{ textTransform: 'capitalize' }}>{seller.account_status}</span></div>
                        <div className="mk-kv"><span>Member since</span><span>{fmtDay(seller.member_since)}</span></div>
                        {seller.location && <div className="mk-kv"><span>Location</span><span>{seller.location}</span></div>}
                      </div>
                      <span className="mk-label">Marketplace activity</span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginBottom: 20 }}>
                        <Tile label="Listings" value={n0(seller.listings)} />
                        <Tile label="Active listings" value={n0(seller.active_listings)} />
                        <Tile label="Sold listings" value={n0(seller.sold_listings)} />
                        <Tile label="Suspended listings" value={n0(seller.suspended_listings)} />
                        <Tile label="Orders received" value={n0(seller.orders_received)} />
                        <Tile label="Completed sales" value={n0(seller.completed_sales)} />
                      </div>
                      {seller.reports_against > 0 && <p style={{ fontSize: 12.5, color: A.amber, fontWeight: 700, marginBottom: 20 }}>{seller.reports_against} {seller.reports_against === 1 ? 'report has' : 'reports have'} been filed against this seller.</p>}
                      <span className="mk-label">Recent listings</span>
                      {seller.recent.length === 0 ? <p style={{ fontSize: 12.5, color: A.textMuted }}>No listings.</p> : (
                        <div style={{ border: `1px solid ${A.border}`, borderRadius: 10 }}>
                          {seller.recent.map((x, idx) => (
                            <button key={x.id} onClick={() => openDrawer(x.id, 'view')} style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit', border: 'none', borderTop: idx ? `1px solid ${A.borderSoft}` : 'none', background: 'transparent', padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="mk-clamp" style={{ fontSize: 12.5, fontWeight: 700, color: A.text }}>{x.title}</div>
                                <div style={{ fontSize: 11.5, color: A.textMuted }}>{money(x.currency, x.price)} · {fmtDay(x.created_at)}</div>
                              </div>
                              <StatusBadge status={x.status} />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: A.text }}>Listing details</p>
                    <p style={{ fontSize: 12, color: A.textMuted, marginTop: 2 }}>{shortId(drawer.id)}</p>
                  </div>
                  {L && <StatusBadge status={L.status} />}
                  <button className="mk-icon-btn" aria-label="Close" onClick={closeDrawer}><Icon name="close" size={16} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                  {detailError ? (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                      <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>{detailError}</p>
                      <button className="mk-btn" onClick={() => loadDetail(drawer.id)}>Try again</button>
                    </div>
                  ) : !detail || !L ? <p style={{ fontSize: 13, color: A.textMuted }}>Loading listing...</p> : (
                    <>
                      {(detail.activity.open_reports > 0 || L.flagged) && (
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: A.amberBg, border: '1px solid #F3E2B8', borderRadius: 8, padding: '10px 12px', marginBottom: 18, color: A.amber, fontSize: 12.5, lineHeight: 1.5 }}>
                          <span style={{ marginTop: 1 }}><Icon name="alert" size={15} /></span>
                          <span>{detail.activity.open_reports > 0 ? `This listing has ${detail.activity.open_reports} open ${detail.activity.open_reports === 1 ? 'report' : 'reports'}.` : 'This listing is flagged for review.'}</span>
                        </div>
                      )}

                      <span className="mk-label">Product</span>
                      <div className="mk-box">
                        {L.images.length > 0 ? (
                          <div style={{ marginBottom: 12 }}>
                            <img src={L.images[Math.min(imgIdx, L.images.length - 1)]} alt={L.title} style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 8, border: `1px solid ${A.border}`, background: A.bg }} />
                            {L.images.length > 1 && (
                              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                                {L.images.map((src, i) => (
                                  <button key={src + i} aria-label={`Image ${i + 1}`} onClick={() => setImgIdx(i)} style={{ padding: 0, border: `2px solid ${i === imgIdx ? A.green : 'transparent'}`, borderRadius: 8, background: 'transparent', cursor: 'pointer' }}>
                                    <Thumb src={src} size={48} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : <div style={{ marginBottom: 12 }}><Thumb src={null} size={64} /></div>}
                        <p style={{ fontSize: 14, fontWeight: 800, color: A.text, wordBreak: 'break-word' }}>{L.title}{L.flagged && <FlagTag />}</p>
                        <p style={{ fontSize: 13, color: L.description ? A.text : A.textSoft, lineHeight: 1.6, margin: '6px 0 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{L.description || 'No description.'}</p>
                        <div className="mk-kv"><span>Category</span><span>{catLabel(L.category)}</span></div>
                        <div className="mk-kv"><span>Price</span><span>{priceText(L)}{L.negotiable ? ' (negotiable)' : ''}</span></div>
                        <div className="mk-kv"><span>Currency</span><span>{L.currency}</span></div>
                        <div className="mk-kv"><span>Quantity</span><span>{L.quantity === null ? 'Not set' : `${n0(L.quantity)}${L.unit ? ` ${L.unit}` : ''}`}</span></div>
                        <div className="mk-kv"><span>Availability</span><span>{L.seller_status === 'available' ? 'Available' : L.seller_status === 'sold' ? 'Sold' : 'Paused by seller'}</span></div>
                        <div className="mk-kv"><span>Status</span><span><StatusBadge status={L.status} /></span></div>
                        {L.location && <div className="mk-kv"><span>Location</span><span>{L.location}</span></div>}
                        <div className="mk-kv"><span>Date created</span><span>{fmtFull(L.created_at)}</span></div>
                      </div>

                      <span className="mk-label">Seller</span>
                      {detail.seller ? (
                        <div className="mk-box">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <Avatar name={sname(detail.seller.full_name, detail.seller.username)} src={detail.seller.profile_image} size={40} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontSize: 13.5, fontWeight: 800, color: A.text }}>{sname(detail.seller.full_name, detail.seller.username)}</p>
                              <p style={{ fontSize: 12, color: A.textMuted }}>{detail.seller.username ? `@${detail.seller.username}` : ''}</p>
                            </div>
                            <button className="mk-btn" style={{ padding: '5px 12px' }} onClick={() => openSeller(detail.seller!.user_id)}>View Seller</button>
                          </div>
                          <div className="mk-kv"><span>Seller type</span><span>{detail.seller.role || '-'}</span></div>
                          <div className="mk-kv"><span>Verification</span><span>{detail.seller.is_verified ? 'Verified' : 'Not verified'}</span></div>
                          <div className="mk-kv"><span>Listings</span><span>{n0(detail.seller.listings)} ({n0(detail.seller.active_listings)} active)</span></div>
                          {detail.company && <div className="mk-kv"><span>Company</span><span>{detail.company.name}</span></div>}
                        </div>
                      ) : <p style={{ fontSize: 12.5, color: A.textMuted, marginBottom: 20 }}>This seller account no longer exists.</p>}

                      <span className="mk-label">Listing activity</span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 6 }}>
                        <Tile label="Saves" value={n0(detail.activity.saves)} />
                        <Tile label="Orders" value={n0(detail.activity.orders)} />
                        <Tile label="Reports" value={n0(detail.activity.reports)} />
                      </div>
                      <p style={{ fontSize: 11.5, color: A.textSoft, marginBottom: 20 }}>Views and inquiries are not tracked yet.</p>

                      <div ref={reportsRef} style={{ scrollMarginTop: 8 }}>
                        <span className="mk-label">Reports ({detail.reports.length})</span>
                        {detail.reports.length === 0 ? <p style={{ fontSize: 12.5, color: A.textMuted, marginBottom: 20 }}>No one has reported this listing.</p> : (
                          <div style={{ border: `1px solid ${drawer.mode === 'reports' ? A.amberLine : A.border}`, borderRadius: 10, marginBottom: 20 }}>
                            {detail.reports.map((r, idx) => (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderTop: idx ? `1px solid ${A.borderSoft}` : 'none', fontSize: 12.5 }}>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontWeight: 700, color: A.text }}>{r.code}</p>
                                  <p style={{ color: A.textMuted }}>{r.reason.replace(/_/g, ' ')} · {r.status.replace(/_/g, ' ')} · {fmtDay(r.created_at)}</p>
                                </div>
                                {canReports && <button className="mk-btn" style={{ padding: '5px 12px' }} onClick={() => navigate(`/admin/reports?open=${r.id}`)}><Icon name="link" size={13} /> Open report</button>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <span className="mk-label">Moderation history</span>
                      {detail.history.length === 0 ? <p style={{ fontSize: 12.5, color: A.textMuted }}>No moderation actions yet.</p> : (
                        <div style={{ paddingLeft: 4 }}>
                          {detail.history.map((h, idx) => (
                            <div key={h.at + idx} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: idx === detail.history.length - 1 ? 0 : 16 }}>
                              {idx !== detail.history.length - 1 && <span style={{ position: 'absolute', left: 4, top: 14, bottom: 0, width: 1, background: A.border }} />}
                              <span style={{ width: 9, height: 9, borderRadius: '50%', background: A.green, marginTop: 4, flexShrink: 0, zIndex: 1 }} />
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 12.5, color: A.text }}><b style={{ textTransform: 'capitalize' }}>{h.action.replace('marketplace.', '')}</b>{h.actor ? ` by ${h.actor}` : ''}</p>
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
                {detail && L && <div style={{ padding: '14px 20px', borderTop: `1px solid ${A.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>{detailActions()}</div>}
              </>
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
                <p className="mk-clamp" style={{ fontSize: 13, fontWeight: 700, color: A.text }}>{confirm.title}</p>
                <p style={{ fontSize: 12, color: A.textMuted }}>{confirm.price} · {confirm.seller}</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: A.textMuted, lineHeight: 1.55, marginBottom: 12 }}>{copy(confirm.kind).body}</p>
            {confirm.kind !== 'restore' && (
              <textarea className="mk-input" style={{ width: '100%', resize: 'vertical', marginBottom: 16 }} rows={2} maxLength={500} value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)} placeholder="Reason (optional, shown to the seller)" aria-label="Reason" />
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="mk-btn" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              <button className={`mk-btn ${copy(confirm.kind).danger ? 'solid-danger' : 'primary'}`} disabled={busy} onClick={() => void runConfirm()}>{busy ? 'Working...' : copy(confirm.kind).cta}</button>
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
