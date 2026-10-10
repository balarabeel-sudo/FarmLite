import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'

const A = {
  bg: '#F7F8F7', surface: '#FFFFFF', border: '#E3E7E3', borderSoft: '#EEF1EE',
  green: '#16A34A', greenDark: '#14532D', greenTint: '#ECF7EF',
  text: '#0F1A0F', textMuted: '#6B7280', textSoft: '#9AA39B',
  amber: '#92400E', amberBg: '#FFFBEB', amberChip: '#FEF3C7', amberLine: '#D9A441', red: '#B91C1C',
}

type NStatus = 'draft' | 'scheduled' | 'sent' | 'failed'
type Row = {
  id: string; code: string; title: string; message: string; type: string; audience: string
  audience_params: { user_ids?: string[]; community_id?: string }; audience_label: string | null
  status: NStatus; scheduled_at: string | null; sent_at: string | null
  targeted_count: number | null; delivered_count: number | null; failed_count: number | null; failure_reason: string | null
  created_by_name: string | null; created_at: string
}
type Delivery = { targeted: number | null; delivered: number | null; failed: number | null; read: number }
type Picked = { user_id: string; name: string; username: string | null }
type Form = { title: string; message: string; type: string; audience: string; users: Picked[]; communityId: string; delivery: 'now' | 'draft' | 'schedule'; scheduleAt: string }
type Menu = { id: string; x: number; y: number; up: boolean } | null
type Confirm = { kind: 'send' | 'delete' | 'unschedule'; row: Row; count?: number | null } | null

const TYPES = [
  { key: 'system', label: 'System' }, { key: 'community', label: 'Community' }, { key: 'marketplace', label: 'Marketplace' },
  { key: 'farmbot', label: 'FarmBot' }, { key: 'company', label: 'Company' }, { key: 'security', label: 'Security' }, { key: 'promotional', label: 'Promotional' },
]
const AUDIENCES = [
  { key: 'all', label: 'All Users' }, { key: 'active', label: 'Active Users' }, { key: 'users', label: 'Specific Users' },
  { key: 'group', label: 'Specific Group / Community' }, { key: 'companies', label: 'Companies' }, { key: 'verified', label: 'Verified Users' },
]
const STATUS_LABEL: Record<NStatus, string> = { draft: 'Draft', scheduled: 'Scheduled', sent: 'Sent', failed: 'Failed' }
const STATUS_STYLE: Record<NStatus, { bg: string; color: string; dot: string }> = {
  draft: { bg: '#F1F3F1', color: '#4B5563', dot: '#9AA39B' },
  scheduled: { bg: '#E8F0FE', color: '#1E40AF', dot: '#3B6FD4' },
  sent: { bg: '#DCFCE7', color: '#166534', dot: '#16A34A' },
  failed: { bg: A.amberChip, color: A.amber, dot: A.amberLine },
}
const ROWS = [10, 25, 50]
const typeLabel = (k: string) => TYPES.find((t) => t.key === k)?.label || k
const EMPTY_FORM: Form = { title: '', message: '', type: 'system', audience: 'all', users: [], communityId: '', delivery: 'now', scheduleAt: '' }

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const fmtFull = (iso: string) => `${fmtDay(iso)}, ${fmtTime(iso)}`
const startOfDay = (d: string) => new Date(`${d}T00:00:00`).toISOString()
const endOfDay = (d: string) => new Date(`${d}T23:59:59.999`).toISOString()
const pname = (p: { full_name: string | null; username: string | null }) => p.full_name || p.username || 'Unknown user'
function pageList(cur: number, total: number): (number | '…')[] {
  const keep = new Set([1, total, cur - 1, cur, cur + 1])
  const nums = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  nums.forEach((n, i) => { if (i > 0 && n - nums[i - 1] > 1) out.push('…'); out.push(n) })
  return out
}
const toLocalInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

function rowDate(r: Row): { label: string; iso: string } {
  if (r.status === 'sent' && r.sent_at) return { label: 'Sent', iso: r.sent_at }
  if (r.status === 'scheduled' && r.scheduled_at) return { label: 'Scheduled', iso: r.scheduled_at }
  return { label: 'Created', iso: r.created_at }
}
function paramsFromForm(f: Form) {
  if (f.audience === 'users') return { user_ids: f.users.map((u) => u.user_id) }
  if (f.audience === 'group') return { community_id: f.communityId }
  return {}
}
function audienceLabel(f: Form, groups: { id: string; name: string }[]) {
  if (f.audience === 'users') return `${f.users.length} specific ${f.users.length === 1 ? 'user' : 'users'}`
  if (f.audience === 'group') return `Group: ${groups.find((g) => g.id === f.communityId)?.name || '-'}`
  return { all: 'All users', active: 'Active users (last 30 days)', companies: 'Company owners', verified: 'Verified users' }[f.audience] || ''
}

const ICONS: Record<string, string> = {
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  bell: 'M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 004 0',
  send: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  x: 'M18 6L6 18M6 6l12 12',
  refresh: 'M20 12a8 8 0 11-2.3-5.7L20 8M20 3v5h-5',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
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
function StatusBadge({ status }: { status: NStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />{STATUS_LABEL[status]}
    </span>
  )
}
function TypeChip({ type }: { type: string }) {
  return <span style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: `1px solid ${A.border}`, color: '#374151', background: A.surface, whiteSpace: 'nowrap' }}>{typeLabel(type)}</span>
}
function Preview({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 10, padding: 12 }}>
      <p style={{ fontSize: 11.5, fontWeight: 700, color: A.textMuted, marginBottom: 8 }}>Preview (in-app)</p>
      <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ width: 36, height: 36, borderRadius: '50%', background: A.greenTint, color: A.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="bell" size={17} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: A.text, wordBreak: 'break-word' }}>{title.trim() || 'Notification title'}</p>
          <p style={{ fontSize: 12.5, color: A.textMuted, lineHeight: 1.5, marginTop: 2, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{message.trim() || 'Your message will appear here.'}</p>
          <p style={{ fontSize: 11.5, color: A.textSoft, marginTop: 6 }}>Just now</p>
        </div>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: A.green, marginTop: 6, flexShrink: 0 }} />
      </div>
    </div>
  )
}

const CSS = `
.nt-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
.nt-sub { font-size:13px; color:${A.textMuted}; line-height:1.5; }
.nt-stats { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px; margin-bottom:18px; }
.nt-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
.nt-input { padding:9px 12px; border-radius:8px; border:1px solid ${A.border}; font-size:12.5px; background:${A.surface}; color:${A.text}; font-family:inherit; box-sizing:border-box; }
.nt-list { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; }
.nt-table-wrap { overflow-x:auto; }
.nt-table { width:100%; border-collapse:collapse; font-size:12.5px; min-width:900px; }
.nt-table th { padding:10px 14px; font-size:11.5px; font-weight:700; color:${A.textMuted}; text-align:left; background:${A.bg}; border-bottom:1px solid ${A.border}; white-space:nowrap; }
.nt-table td { padding:12px 14px; border-bottom:1px solid ${A.borderSoft}; vertical-align:middle; }
.nt-row { cursor:pointer; }
.nt-row:hover { background:#FAFBFA; }
.nt-row.attn { background:${A.amberBg}; }
.nt-row.attn:hover { background:#FFF7DD; }
.nt-row.attn td:first-child { box-shadow: inset 3px 0 0 ${A.amberLine}; }
.nt-clamp { display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; line-height:1.45; word-break:break-word; }
.nt-cards { display:none; }
.nt-card { padding:14px; border-bottom:1px solid ${A.borderSoft}; }
.nt-card.attn { background:${A.amberBg}; box-shadow: inset 3px 0 0 ${A.amberLine}; }
.nt-card:last-child { border-bottom:none; }
.nt-btn { font-family:inherit; cursor:pointer; border-radius:8px; font-size:12.5px; font-weight:700; padding:8px 14px; border:1px solid ${A.border}; background:${A.surface}; color:${A.text}; display:inline-flex; align-items:center; gap:7px; }
.nt-btn:hover:not(:disabled) { background:${A.bg}; }
.nt-btn:disabled { opacity:.55; cursor:default; }
.nt-btn.primary { background:${A.green}; border-color:${A.green}; color:#fff; }
.nt-btn.primary:hover:not(:disabled) { background:#15803D; }
.nt-btn.danger { color:${A.red}; }
.nt-btn.danger:hover:not(:disabled) { background:#FEF2F2; }
.nt-btn.solid-danger { background:${A.red}; border-color:${A.red}; color:#fff; }
.nt-btn.solid-danger:hover:not(:disabled) { background:#991B1B; }
.nt-icon-btn { font-family:inherit; cursor:pointer; width:30px; height:30px; border-radius:7px; border:1px solid transparent; background:transparent; color:${A.textMuted}; display:inline-flex; align-items:center; justify-content:center; }
.nt-icon-btn:hover { background:${A.bg}; border-color:${A.border}; color:${A.text}; }
.nt-menu-item { width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; font-family:inherit; font-size:12.5px; font-weight:600; color:${A.text}; cursor:pointer; text-align:left; border-radius:6px; }
.nt-menu-item:hover { background:${A.bg}; }
.nt-menu-item.danger { color:${A.red}; }
.nt-page { min-width:30px; height:30px; padding:0 8px; border-radius:7px; border:1px solid transparent; background:transparent; font-family:inherit; font-size:12.5px; font-weight:600; color:${A.text}; cursor:pointer; }
.nt-page:hover:not(:disabled) { background:${A.bg}; border-color:${A.border}; }
.nt-page.on { background:${A.greenTint}; border-color:#BFE3CA; color:${A.greenDark}; font-weight:800; }
.nt-page:disabled { color:${A.textSoft}; cursor:default; }
.nt-foot { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; padding:12px 14px; border-top:1px solid ${A.border}; }
.nt-drawer { position:fixed; top:0; right:0; bottom:0; width:480px; max-width:100%; background:${A.surface}; z-index:61; display:flex; flex-direction:column; box-shadow:-8px 0 28px rgba(15,26,18,0.12); animation:nt-in .18s ease-out; }
@keyframes nt-in { from { transform:translateX(24px); opacity:0; } to { transform:none; opacity:1; } }
.nt-label { font-size:12px; font-weight:700; color:${A.textMuted}; margin-bottom:6px; display:block; }
.nt-box { border:1px solid ${A.border}; border-radius:10px; padding:12px; margin-bottom:20px; }
.nt-kv { display:flex; justify-content:space-between; gap:14px; padding:6px 0; font-size:12.5px; }
.nt-kv span:first-child { color:${A.textMuted}; }
.nt-kv span:last-child { color:${A.text}; font-weight:600; text-align:right; word-break:break-word; }
.nt-modal { background:${A.surface}; border-radius:12px; width:640px; max-width:100%; max-height:calc(100vh - 32px); display:flex; flex-direction:column; box-shadow:0 20px 50px rgba(0,0,0,0.25); }
.nt-radio { display:flex; align-items:center; gap:8px; padding:9px 12px; border:1.5px solid ${A.border}; border-radius:8px; cursor:pointer; font-size:12.5px; font-weight:600; color:${A.text}; flex:1; min-width:120px; }
.nt-radio.on { border-color:${A.green}; background:#F3FAF5; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline:2px solid ${A.green}; outline-offset:1px; }
@media (max-width:1100px) { .nt-stats { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width:960px) { .nt-table-wrap { display:none; } .nt-cards { display:block; } }
@media (max-width:480px) { .nt-stats { grid-template-columns:1fr; } }
@media (prefers-reduced-motion: reduce) { .nt-drawer { animation:none; } }
`

export default function NotificationsPage() {
  const staff = useStaff()
  const canSend = staff.permissions.has('notifications.send')

  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<{ total: number; sent: number; scheduled: number; failed: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [tick, setTick] = useState(0)
  const [menu, setMenu] = useState<Menu>(null)

  const [sel, setSel] = useState<Row | null>(null)
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [editor, setEditor] = useState<{ id: string | null } | null>(null)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [userHits, setUserHits] = useState<Picked[]>([])
  const [audCount, setAudCount] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ text: string; err: boolean } | null>(null)
  const reqId = useRef(0)

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
      else if (editor) setEditor(null)
      else if (sel) setSel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, menu, editor, sel])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) }
  }, [menu])

  const loadStats = useCallback(async () => {
    const head = (s?: string) => {
      const query = supabase.from('admin_notifications').select('id', { count: 'exact', head: true })
      return s ? query.eq('status', s) : query
    }
    const [t, s, sc, f] = await Promise.all([head(), head('sent'), head('scheduled'), head('failed')])
    if (t.error) return
    setStats({ total: t.count || 0, sent: s.count || 0, scheduled: sc.count || 0, failed: f.count || 0 })
  }, [])

  const load = useCallback(async () => {
    const id = ++reqId.current
    setError(false)
    setLoading(true)
    const start = (page - 1) * perPage
    let query = supabase.from('admin_notifications').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(start, start + perPage - 1)
    if (status !== 'all') query = query.eq('status', status)
    if (type !== 'all') query = query.eq('type', type)
    if (from) query = query.gte('created_at', startOfDay(from))
    if (to) query = query.lte('created_at', endOfDay(to))
    const term = q.replace(/[,()%*:]/g, ' ').trim()
    if (term) query = query.or(`title.ilike.*${term}*,message.ilike.*${term}*,code.ilike.*${term}*`)
    const { data, error: e, count } = await query
    if (id !== reqId.current) return
    if (e) { setError(true); setLoading(false); return }
    setRows((data || []) as Row[])
    setTotal(count || 0)
    setLoading(false)
  }, [page, perPage, status, type, from, to, q])

  // Scheduled notifications are normally sent by a background job every minute; this also sends any that are due when the page opens.
  useEffect(() => { supabase.rpc('admin_dispatch_due_notifications').then(() => { setTick((n) => n + 1) }) }, [])
  useEffect(() => { load() }, [load, tick])
  useEffect(() => { loadStats() }, [loadStats, tick])

  const loadDelivery = useCallback(async (r: Row) => {
    setDelivery(null)
    if (r.status !== 'sent') return
    const { data } = await supabase.rpc('admin_notification_delivery', { p_id: r.id })
    if (data) setDelivery(data as Delivery)
  }, [])

  const openDetails = (r: Row) => { setMenu(null); setSel(r); loadDelivery(r) }
  const refresh = () => setTick((n) => n + 1)

  const rpc = async (call: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, okText: string) => {
    setBusy(true)
    const { data, error: e } = await call()
    setBusy(false)
    if (e) { setToast({ text: e.message, err: true }); return { ok: false as const, data: null } }
    if (okText) setToast({ text: okText, err: false })
    return { ok: true as const, data }
  }

  const reloadOne = async (id: string) => {
    const { data } = await supabase.from('admin_notifications').select('*').eq('id', id).maybeSingle()
    if (!data) { setSel(null); return }
    const fresh = data as Row
    setSel((cur) => (cur && cur.id === id ? fresh : cur))
    loadDelivery(fresh)
  }

  // ---- editor ----
  useEffect(() => {
    if (!editor) return
    supabase.from('communities').select('id, name').order('name').limit(200).then(({ data }: { data: { id: string; name: string }[] | null }) => setGroups(data || []))
  }, [editor])

  useEffect(() => {
    if (!editor || form.audience !== 'users') return
    const term = userQuery.replace(/[,()%*:]/g, ' ').trim()
    if (term.length < 2) { setUserHits([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, username').or(`full_name.ilike.*${term}*,username.ilike.*${term}*,farmlite_id.ilike.*${term}*`).limit(8)
      setUserHits(((data || []) as { user_id: string; full_name: string | null; username: string | null }[]).map((p) => ({ user_id: p.user_id, name: pname(p), username: p.username })))
    }, 300)
    return () => clearTimeout(t)
  }, [editor, form.audience, userQuery])

  const formParams = JSON.stringify(paramsFromForm(form))
  useEffect(() => {
    if (!editor) return
    const ready = form.audience === 'users' ? form.users.length > 0 : form.audience === 'group' ? !!form.communityId : true
    if (!ready) { setAudCount(null); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const { data, error: e } = await supabase.rpc('admin_notification_count', { p_audience: form.audience, p_params: JSON.parse(formParams) })
      if (!cancelled) setAudCount(e ? null : (data as number))
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [editor, form.audience, form.users.length, form.communityId, formParams])

  const openCreate = () => { setForm(EMPTY_FORM); setFormError(''); setUserQuery(''); setUserHits([]); setAudCount(null); setEditor({ id: null }) }
  const openEdit = async (r: Row) => {
    setMenu(null)
    setSel(null)
    let users: Picked[] = []
    if (r.audience === 'users' && r.audience_params.user_ids?.length) {
      const { data } = await supabase.from('profiles').select('user_id, full_name, username').in('user_id', r.audience_params.user_ids)
      users = ((data || []) as { user_id: string; full_name: string | null; username: string | null }[]).map((p) => ({ user_id: p.user_id, name: pname(p), username: p.username }))
    }
    setForm({
      title: r.title, message: r.message, type: r.type, audience: r.audience, users, communityId: r.audience_params.community_id || '',
      delivery: r.status === 'scheduled' ? 'schedule' : 'draft', scheduleAt: r.scheduled_at ? toLocalInput(new Date(r.scheduled_at)) : '',
    })
    setFormError(''); setUserQuery(''); setUserHits([]); setAudCount(null)
    setEditor({ id: r.id })
  }

  const validate = (): string => {
    const t = form.title.trim()
    const m = form.message.trim()
    if (t.length < 3 || t.length > 100) return 'Title must be 3 to 100 characters.'
    if (m.length < 3 || m.length > 500) return 'Message must be 3 to 500 characters.'
    if (form.audience === 'users' && form.users.length === 0) return 'Choose at least one user.'
    if (form.audience === 'group' && !form.communityId) return 'Choose a group.'
    if (form.delivery === 'schedule') {
      if (!form.scheduleAt) return 'Choose a date and time to send.'
      if (new Date(form.scheduleAt).getTime() <= Date.now() + 30000) return 'The schedule time must be in the future.'
    }
    return ''
  }

  const saveForm = async (as: 'draft' | 'scheduled') => {
    return rpc(() => supabase.rpc('admin_notification_save', {
      p_id: editor?.id ?? null, p_title: form.title, p_message: form.message, p_type: form.type, p_audience: form.audience,
      p_params: paramsFromForm(form), p_status: as, p_scheduled_at: as === 'scheduled' ? new Date(form.scheduleAt).toISOString() : null,
    }), as === 'scheduled' ? 'Notification scheduled' : 'Draft saved')
  }

  const submitForm = async () => {
    const err = validate()
    setFormError(err)
    if (err) return
    if (form.delivery === 'now') {
      setConfirm({ kind: 'send', row: { id: editor?.id || '', code: '', title: form.title.trim(), message: form.message.trim(), type: form.type, audience: form.audience, audience_params: paramsFromForm(form), audience_label: audienceLabel(form, groups), status: 'draft', scheduled_at: null, sent_at: null, targeted_count: null, delivered_count: null, failed_count: null, failure_reason: null, created_by_name: null, created_at: new Date().toISOString() }, count: audCount })
      return
    }
    const res = await saveForm(form.delivery === 'schedule' ? 'scheduled' : 'draft')
    if (res.ok) { setEditor(null); refresh() }
  }

  const askSend = async (r: Row) => {
    setMenu(null)
    const { data } = await supabase.rpc('admin_notification_count', { p_audience: r.audience, p_params: r.audience_params })
    setConfirm({ kind: 'send', row: r, count: typeof data === 'number' ? data : null })
  }

  const runConfirm = async () => {
    if (!confirm) return
    const r = confirm.row
    if (confirm.kind === 'delete') {
      const res = await rpc(() => supabase.rpc('admin_notification_delete', { p_id: r.id }), 'Draft deleted')
      if (res.ok) { setConfirm(null); setSel(null); refresh() }
    } else if (confirm.kind === 'unschedule') {
      const res = await rpc(() => supabase.rpc('admin_notification_unschedule', { p_id: r.id }), 'Schedule cancelled')
      if (res.ok) { setConfirm(null); refresh(); await reloadOne(r.id) }
    } else {
      let id = r.id
      if (editor) {
        // sending straight from the create / edit form: save it first, then send it
        const saved = await saveForm('draft')
        if (!saved.ok) { setConfirm(null); return }
        id = saved.data as string
      }
      const res = await rpc(() => supabase.rpc('admin_notification_send', { p_id: id }), '')
      if (!res.ok) { setConfirm(null); refresh(); return }
      const out = res.data as { status: string; delivered: number | null; reason: string | null }
      setToast(out.status === 'sent' ? { text: `Sent to ${out.delivered ?? 0} ${out.delivered === 1 ? 'user' : 'users'}`, err: false } : { text: out.reason || 'Sending failed', err: true })
      setConfirm(null); setEditor(null); refresh()
      if (sel) await reloadOne(sel.id)
    }
  }

  const duplicate = async (r: Row) => {
    setMenu(null)
    const res = await rpc(() => supabase.rpc('admin_notification_duplicate', { p_id: r.id }), 'Copy saved as a draft')
    if (res.ok) { setSel(null); refresh() }
  }

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const up = rect.bottom + 190 > window.innerHeight
    setMenu({ id, x: Math.max(8, rect.right - 208), y: up ? rect.top - 4 : rect.bottom + 4, up })
  }
  const menuRow = menu ? rows.find((r) => r.id === menu.id) || null : null

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, totalPages)
  const shownFrom = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const shownTo = Math.min(safePage * perPage, total)
  const filtersActive = status !== 'all' || type !== 'all' || !!from || !!to || !!q
  const clearFilters = () => { setStatus('all'); setType('all'); setFrom(''); setTo(''); setQInput(''); setQ(''); setPage(1) }

  const cards = [
    { label: 'Total Notifications', value: stats?.total, icon: 'bell', warn: false },
    { label: 'Sent', value: stats?.sent, icon: 'send', warn: false },
    { label: 'Scheduled', value: stats?.scheduled, icon: 'clock', warn: false },
    { label: 'Failed', value: stats?.failed, icon: 'alert', warn: (stats?.failed || 0) > 0 },
  ]

  const actionButtons = (r: Row) => (
    <button className="nt-icon-btn" aria-label={`Manage ${r.code}`} aria-haspopup="menu" onClick={(e) => openMenu(e, r.id)}><Icon name="more" /></button>
  )

  return (
    <AdminLayout title="Notifications">
      <style>{CSS}</style>

      <div className="nt-head">
        <p className="nt-sub" style={{ paddingTop: 7 }}>Create, manage, and monitor notifications across Farmxie.</p>
        {canSend && <button className="nt-btn primary" onClick={openCreate}><Icon name="plus" size={14} /> Create Notification</button>}
      </div>

      <div className="nt-stats">
        {cards.map((c) => (
          <div key={c.label} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: A.textMuted }}>{c.label}</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: c.warn ? A.amberChip : A.greenTint, color: c.warn ? A.amber : A.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.icon} size={15} /></span>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: A.text, marginTop: 6, lineHeight: 1.1 }}>{c.value === undefined ? '-' : c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="nt-filters">
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 11, top: 9, color: A.textSoft, display: 'flex' }}><Icon name="search" size={15} /></span>
          <input className="nt-input" style={{ width: '100%', paddingLeft: 34 }} value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search title, message or notification ID" aria-label="Search notifications" />
        </div>
        <select className="nt-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Status">
          <option value="all">Status: All</option>
          {(Object.keys(STATUS_LABEL) as NStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="nt-input" value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} aria-label="Type">
          <option value="all">Type: All</option>
          {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <label style={{ fontSize: 12, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>From <input className="nt-input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></label>
        <label style={{ fontSize: 12, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>To <input className="nt-input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></label>
        {filtersActive && <button className="nt-btn" onClick={clearFilters}>Clear</button>}
      </div>

      <div className="nt-list">
        {error ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>Could not load notifications. You may not have permission to view them.</p>
            <button className="nt-btn" onClick={refresh}><Icon name="refresh" size={14} /> Try again</button>
          </div>
        ) : loading ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', fontSize: 13, color: A.textMuted }}>Loading notifications...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <span style={{ width: 56, height: 56, borderRadius: '50%', background: A.greenTint, color: A.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Icon name="inbox" size={26} /></span>
            <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 6 }}>{filtersActive ? 'No notifications found' : 'No notifications yet'}</p>
            <p style={{ fontSize: 13, color: A.textMuted, maxWidth: 360, margin: '0 auto', lineHeight: 1.55 }}>
              {filtersActive ? 'No notifications match your search or filters.' : 'Notifications created by Farmxie administrators will appear here.'}
            </p>
          </div>
        ) : (
          <>
            <div className="nt-table-wrap">
              <table className="nt-table">
                <thead>
                  <tr><th style={{ width: '32%' }}>Notification</th><th>Type</th><th>Audience</th><th>Status</th><th>Date</th><th>Sent</th><th style={{ width: 130 }}>Action</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const d = rowDate(r)
                    return (
                      <tr key={r.id} className={`nt-row${r.status === 'failed' ? ' attn' : ''}`} onClick={() => openDetails(r)}>
                        <td>
                          <div style={{ fontWeight: 700, color: A.text }} className="nt-clamp">{r.title}</div>
                          <div style={{ color: A.textMuted, marginTop: 2, maxWidth: 360 }} className="nt-clamp">{r.message}</div>
                          <div style={{ fontSize: 11.5, color: A.textSoft, marginTop: 2 }}>{r.code}</div>
                        </td>
                        <td><TypeChip type={r.type} /></td>
                        <td style={{ color: A.text }}>{r.audience_label || '-'}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ color: A.text }}>{fmtDay(d.iso)}, {fmtTime(d.iso)}</div>
                          <div style={{ fontSize: 11.5, color: A.textMuted }}>{d.label}</div>
                        </td>
                        <td style={{ color: A.text }}>{r.status === 'sent' ? (r.delivered_count ?? 0).toLocaleString() : '-'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button className="nt-btn" style={{ padding: '5px 12px' }} onClick={(e) => { e.stopPropagation(); openDetails(r) }}>View</button>
                            {canSend && actionButtons(r)}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="nt-cards">
              {rows.map((r) => {
                const d = rowDate(r)
                return (
                  <div key={r.id} className={`nt-card${r.status === 'failed' ? ' attn' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 11.5, color: A.textSoft }}>{r.code}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: A.text }}>{r.title}</p>
                    <p className="nt-clamp" style={{ fontSize: 12.5, color: A.textMuted, margin: '2px 0 10px' }}>{r.message}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, color: A.textMuted }}>
                      <TypeChip type={r.type} /><span>{r.audience_label}</span><span>{d.label} {fmtDay(d.iso)}</span>
                      {r.status === 'sent' && <span>{(r.delivered_count ?? 0).toLocaleString()} delivered</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="nt-btn" onClick={() => openDetails(r)}><Icon name="eye" size={14} /> View</button>
                      {canSend && <span style={{ marginLeft: 'auto' }}>{actionButtons(r)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="nt-foot">
              <span style={{ fontSize: 12.5, color: A.textMuted }}>Showing {shownFrom}-{shownTo} of {total} notifications</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="nt-page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="chevL" size={13} /> Previous</button>
                {pageList(safePage, totalPages).map((p, idx) => (p === '…'
                  ? <span key={`g${idx}`} style={{ padding: '0 4px', color: A.textSoft }}>…</span>
                  : <button key={p} className={`nt-page${p === safePage ? ' on' : ''}`} onClick={() => setPage(p)} aria-current={p === safePage ? 'page' : undefined}>{p}</button>))}
                <button className="nt-page" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Next <Icon name="chevR" size={13} /></button>
              </div>
              <label style={{ fontSize: 12.5, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
                Rows per page
                <select className="nt-input" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}>{ROWS.map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </label>
            </div>
          </>
        )}
      </div>

      {menu && menuRow && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 64 }} />
          <div role="menu" style={{ position: 'fixed', left: menu.x, top: menu.y, transform: menu.up ? 'translateY(-100%)' : 'none', width: 208, background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(15,26,18,0.16)', padding: 5, zIndex: 65 }}>
            <button role="menuitem" className="nt-menu-item" onClick={() => openDetails(menuRow)}><Icon name="eye" size={15} /> View</button>
            {menuRow.status === 'draft' && (
              <>
                <button role="menuitem" className="nt-menu-item" onClick={() => openEdit(menuRow)}><Icon name="edit" size={15} /> Edit</button>
                <button role="menuitem" className="nt-menu-item" onClick={() => askSend(menuRow)}><Icon name="send" size={15} /> Send</button>
                <div style={{ height: 1, background: A.borderSoft, margin: '5px 4px' }} />
                <button role="menuitem" className="nt-menu-item danger" onClick={() => { setMenu(null); setConfirm({ kind: 'delete', row: menuRow }) }}><Icon name="trash" size={15} /> Delete</button>
              </>
            )}
            {menuRow.status === 'scheduled' && (
              <>
                <button role="menuitem" className="nt-menu-item" onClick={() => openEdit(menuRow)}><Icon name="edit" size={15} /> Edit</button>
                <button role="menuitem" className="nt-menu-item danger" onClick={() => { setMenu(null); setConfirm({ kind: 'unschedule', row: menuRow }) }}><Icon name="x" size={15} /> Cancel Schedule</button>
              </>
            )}
            {menuRow.status === 'sent' && <button role="menuitem" className="nt-menu-item" onClick={() => duplicate(menuRow)}><Icon name="copy" size={15} /> Duplicate</button>}
            {menuRow.status === 'failed' && (
              <>
                <button role="menuitem" className="nt-menu-item" onClick={() => askSend(menuRow)}><Icon name="refresh" size={15} /> Retry</button>
                <button role="menuitem" className="nt-menu-item" onClick={() => openEdit(menuRow)}><Icon name="edit" size={15} /> Edit</button>
              </>
            )}
          </div>
        </>
      )}

      {sel && (
        <>
          <div onClick={() => setSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.38)', zIndex: 60 }} />
          <aside className="nt-drawer" role="dialog" aria-label="Notification details">
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: A.text }}>Notification details</p>
                <p style={{ fontSize: 12, color: A.textMuted, marginTop: 2 }}>{sel.code}</p>
              </div>
              <StatusBadge status={sel.status} />
              <button className="nt-icon-btn" aria-label="Close" onClick={() => setSel(null)}><Icon name="close" size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {sel.status === 'failed' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: A.amberBg, border: '1px solid #F3E2B8', borderRadius: 8, padding: '10px 12px', marginBottom: 18, color: A.amber, fontSize: 12.5, lineHeight: 1.5 }}>
                  <span style={{ marginTop: 1 }}><Icon name="alert" size={15} /></span>
                  <span>This notification was not delivered{sel.failure_reason ? `: ${sel.failure_reason}` : '.'}</span>
                </div>
              )}
              <span className="nt-label">Content</span>
              <div className="nt-box">
                <p style={{ fontSize: 14, fontWeight: 800, color: A.text, wordBreak: 'break-word' }}>{sel.title}</p>
                <p style={{ fontSize: 13, color: A.text, lineHeight: 1.6, marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{sel.message}</p>
              </div>

              <span className="nt-label">Details</span>
              <div className="nt-box">
                <div className="nt-kv"><span>Type</span><span>{typeLabel(sel.type)}</span></div>
                <div className="nt-kv"><span>Audience</span><span>{sel.audience_label || '-'}</span></div>
                <div className="nt-kv"><span>Channel</span><span>In-App</span></div>
                <div className="nt-kv"><span>Status</span><span><StatusBadge status={sel.status} /></span></div>
                <div className="nt-kv"><span>Created by</span><span>{sel.created_by_name || '-'}</span></div>
                <div className="nt-kv"><span>Created</span><span>{fmtFull(sel.created_at)}</span></div>
                {sel.scheduled_at && sel.status === 'scheduled' && <div className="nt-kv"><span>Scheduled for</span><span>{fmtFull(sel.scheduled_at)}</span></div>}
                {sel.sent_at && <div className="nt-kv"><span>Sent</span><span>{fmtFull(sel.sent_at)}</span></div>}
              </div>

              {sel.status === 'sent' && (
                <>
                  <span className="nt-label">Delivery</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginBottom: 20 }}>
                    {([['Targeted', delivery?.targeted], ['Delivered', delivery?.delivered], ['Failed', delivery?.failed], ['Read', delivery?.read]] as [string, number | null | undefined][]).map(([l, v]) => (
                      <div key={l} style={{ border: `1px solid ${A.border}`, borderRadius: 8, padding: '10px 12px' }}>
                        <p style={{ fontSize: 12, color: A.textMuted, fontWeight: 600 }}>{l}</p>
                        <p style={{ fontSize: 20, fontWeight: 800, color: A.text, marginTop: 2 }}>{v === undefined || v === null ? '-' : v.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {canSend && sel.status !== 'sent' && (
              <div style={{ padding: '14px 20px', borderTop: `1px solid ${A.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sel.status === 'draft' && (
                  <>
                    <button className="nt-btn primary" disabled={busy} onClick={() => askSend(sel)}><Icon name="send" size={14} /> Send</button>
                    <button className="nt-btn" disabled={busy} onClick={() => openEdit(sel)}><Icon name="edit" size={14} /> Edit</button>
                    <button className="nt-btn danger" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => setConfirm({ kind: 'delete', row: sel })}><Icon name="trash" size={14} /> Delete</button>
                  </>
                )}
                {sel.status === 'scheduled' && (
                  <>
                    <button className="nt-btn" disabled={busy} onClick={() => openEdit(sel)}><Icon name="edit" size={14} /> Edit</button>
                    <button className="nt-btn danger" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => setConfirm({ kind: 'unschedule', row: sel })}>Cancel Schedule</button>
                  </>
                )}
                {sel.status === 'failed' && (
                  <>
                    <button className="nt-btn primary" disabled={busy} onClick={() => askSend(sel)}><Icon name="refresh" size={14} /> Retry</button>
                    <button className="nt-btn" disabled={busy} onClick={() => openEdit(sel)}><Icon name="edit" size={14} /> Edit</button>
                  </>
                )}
              </div>
            )}
            {canSend && sel.status === 'sent' && (
              <div style={{ padding: '14px 20px', borderTop: `1px solid ${A.border}` }}>
                <button className="nt-btn" disabled={busy} onClick={() => duplicate(sel)}><Icon name="copy" size={14} /> Duplicate</button>
              </div>
            )}
          </aside>
        </>
      )}

      {editor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.45)', zIndex: 66, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { if (!busy) setEditor(null) }}>
          <div className="nt-modal" role="dialog" aria-label={editor.id ? 'Edit notification' : 'Create notification'} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center' }}>
              <p style={{ flex: 1, fontSize: 15, fontWeight: 800, color: A.text }}>{editor.id ? 'Edit Notification' : 'Create Notification'}</p>
              <button className="nt-icon-btn" aria-label="Close" onClick={() => setEditor(null)}><Icon name="close" size={16} /></button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="nt-label" htmlFor="nt-title">Title</label>
                <input id="nt-title" className="nt-input" style={{ width: '100%' }} maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Notification title" />
              </div>
              <div>
                <label className="nt-label" htmlFor="nt-msg">Message</label>
                <textarea id="nt-msg" className="nt-input" style={{ width: '100%', resize: 'vertical' }} rows={3} maxLength={500} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Notification content" />
                <p style={{ fontSize: 11.5, color: A.textSoft, textAlign: 'right', marginTop: 2 }}>{form.message.length}/500</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label className="nt-label" htmlFor="nt-type">Type</label>
                  <select id="nt-type" className="nt-input" style={{ width: '100%' }} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="nt-label" htmlFor="nt-aud">Audience</label>
                  <select id="nt-aud" className="nt-input" style={{ width: '100%' }} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                    {AUDIENCES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select>
                </div>
              </div>

              {form.audience === 'group' && (
                <div>
                  <label className="nt-label" htmlFor="nt-group">Group</label>
                  <select id="nt-group" className="nt-input" style={{ width: '100%' }} value={form.communityId} onChange={(e) => setForm({ ...form, communityId: e.target.value })}>
                    <option value="">Choose a group</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              {form.audience === 'users' && (
                <div>
                  <label className="nt-label" htmlFor="nt-user">Users</label>
                  <input id="nt-user" className="nt-input" style={{ width: '100%' }} value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Search by name, username or Farmxie ID" />
                  {userHits.length > 0 && (
                    <div style={{ border: `1px solid ${A.border}`, borderRadius: 8, marginTop: 6 }}>
                      {userHits.filter((h) => !form.users.some((u) => u.user_id === h.user_id)).map((h) => (
                        <button key={h.user_id} className="nt-menu-item" style={{ borderRadius: 0 }} onClick={() => { setForm({ ...form, users: [...form.users, h] }); setUserQuery(''); setUserHits([]) }}>
                          <Icon name="plus" size={14} /> {h.name}{h.username ? <span style={{ color: A.textMuted, fontWeight: 500 }}> @{h.username}</span> : null}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.users.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {form.users.map((u) => (
                        <span key={u.user_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 6px 4px 10px', borderRadius: 999, background: A.greenTint, color: A.greenDark }}>
                          {u.name}
                          <button aria-label={`Remove ${u.name}`} onClick={() => setForm({ ...form, users: form.users.filter((x) => x.user_id !== u.user_id) })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: A.greenDark, display: 'flex', padding: 2 }}><Icon name="x" size={12} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p style={{ fontSize: 12.5, color: A.textMuted, marginTop: -6 }}>
                {audCount === null ? 'Choose who should receive this.' : <>This will reach <b style={{ color: A.text }}>{audCount.toLocaleString()}</b> {audCount === 1 ? 'user' : 'users'}.</>}
              </p>

              <div>
                <span className="nt-label">Channel</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: A.greenTint, color: A.greenDark }}><Icon name="bell" size={13} /> In-App</span>
                <p style={{ fontSize: 11.5, color: A.textSoft, marginTop: 4 }}>Notifications appear in the Farmxie notification list. Push notifications are not set up yet.</p>
              </div>

              <div>
                <span className="nt-label">Delivery</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {([['now', 'Send Now'], ['draft', 'Save as Draft'], ['schedule', 'Schedule']] as ['now' | 'draft' | 'schedule', string][]).map(([k, l]) => (
                    <label key={k} className={`nt-radio${form.delivery === k ? ' on' : ''}`}>
                      <input type="radio" name="delivery" checked={form.delivery === k} onChange={() => setForm({ ...form, delivery: k })} style={{ accentColor: A.green }} />{l}
                    </label>
                  ))}
                </div>
                {form.delivery === 'schedule' && (
                  <input className="nt-input" type="datetime-local" style={{ marginTop: 10 }} value={form.scheduleAt} min={toLocalInput(new Date(Date.now() + 60000))} onChange={(e) => setForm({ ...form, scheduleAt: e.target.value })} aria-label="Send date and time" />
                )}
              </div>

              <Preview title={form.title} message={form.message} />
              {formError && <p style={{ fontSize: 12.5, color: A.red }}>{formError}</p>}
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${A.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="nt-btn" disabled={busy} onClick={() => setEditor(null)}>Cancel</button>
              <button className="nt-btn primary" disabled={busy} onClick={submitForm}>
                {busy ? 'Working...' : form.delivery === 'now' ? 'Review & Send' : form.delivery === 'schedule' ? 'Schedule Notification' : 'Save Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.45)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { if (!busy) setConfirm(null) }}>
          <div role="alertdialog" aria-label="Confirm" onClick={(e) => e.stopPropagation()} style={{ background: A.surface, borderRadius: 12, padding: 22, width: 420, maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            {confirm.kind === 'send' ? (
              <>
                <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 10 }}>Send Notification?</p>
                <div style={{ border: `1px solid ${A.border}`, borderRadius: 8, padding: '4px 12px', marginBottom: 12 }}>
                  <div className="nt-kv"><span>Title</span><span>{confirm.row.title}</span></div>
                  <div className="nt-kv"><span>Audience</span><span>{confirm.row.audience_label || '-'}</span></div>
                  <div className="nt-kv"><span>Targeted users</span><span>{confirm.count === null || confirm.count === undefined ? 'Not available' : confirm.count.toLocaleString()}</span></div>
                </div>
                <p style={{ fontSize: 12.5, color: A.textMuted, lineHeight: 1.5, marginBottom: 16 }}>It will be sent right away and cannot be unsent.</p>
              </>
            ) : confirm.kind === 'delete' ? (
              <>
                <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 8 }}>Delete this draft?</p>
                <p style={{ fontSize: 13, color: A.textMuted, lineHeight: 1.55, marginBottom: 16 }}>"{confirm.row.title}" will be permanently deleted.</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 8 }}>Cancel this schedule?</p>
                <p style={{ fontSize: 13, color: A.textMuted, lineHeight: 1.55, marginBottom: 16 }}>"{confirm.row.title}" will not be sent automatically. It goes back to your drafts.</p>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="nt-btn" disabled={busy} onClick={() => setConfirm(null)}>{confirm.kind === 'unschedule' ? 'Keep Schedule' : 'Cancel'}</button>
              <button className={`nt-btn ${confirm.kind === 'send' ? 'primary' : 'solid-danger'}`} disabled={busy} onClick={runConfirm}>
                {busy ? 'Working...' : confirm.kind === 'send' ? 'Send Notification' : confirm.kind === 'delete' ? 'Delete Draft' : 'Cancel Schedule'}
              </button>
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
