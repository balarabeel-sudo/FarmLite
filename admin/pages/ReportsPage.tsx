import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { REPORT_REASONS, REPORT_TYPES, reasonLabel, typeLabel } from '../../reportShared'
import type { ReportStatus, ReportType } from '../../reportShared'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'

const A = {
  bg: '#F7F8F7', surface: '#FFFFFF', border: '#E3E7E3', borderSoft: '#EEF1EE',
  green: '#16A34A', greenDark: '#14532D', greenTint: '#ECF7EF',
  text: '#0F1A0F', textMuted: '#6B7280', textSoft: '#9AA39B',
  amber: '#92400E', amberBg: '#FFFBEB', amberChip: '#FEF3C7', amberLine: '#D9A441',
  red: '#B91C1C',
}

type Prof = {
  user_id: string; full_name: string | null; username: string | null; profile_image: string | null
  role: string | null; created_at: string; account_status: string | null; farmlite_id: string | null
}
type Snap = Record<string, unknown>
type Row = {
  id: string; report_code: string; reporter_id: string; reported_user_id: string | null
  content_id: string | null; content_table: string | null
  report_type: ReportType; reason: string; description: string | null; status: ReportStatus
  snapshot: Snap; reviewed_by: string | null; reviewed_at: string | null
  created_at: string; updated_at: string
  reporter: Prof | null; reported: Prof | null
}
type Ev = { id: string; action: string; note: string | null; actor_name: string | null; created_at: string }
type Filters = { q: string; status: string; type: string; from: string; to: string }
type Stats = { total: number; pending: number; review: number; resolved: number; dismissed: number; week: number }
type Confirm = { kind: 'remove' | 'restrict' | 'suspend' | 'restore' } | null
type RpcResult = PromiseLike<{ error: { message: string } | null }>

const PROF = 'user_id, full_name, username, profile_image, role, created_at, account_status, farmlite_id'
const SELECT = `id, report_code, reporter_id, reported_user_id, content_id, content_table, report_type, reason, description, status, snapshot, reviewed_by, reviewed_at, created_at, updated_at, reporter:profiles!reports_reporter_id_fkey(${PROF}), reported:profiles!reports_reported_user_id_fkey(${PROF})`
const NO_FILTERS: Filters = { q: '', status: 'all', type: 'all', from: '', to: '' }
const ROWS = [10, 25, 50]
const STATUS_LABEL: Record<ReportStatus, string> = { pending: 'Pending', under_review: 'Under Review', resolved: 'Resolved', dismissed: 'Dismissed' }
const STATUS_STYLE: Record<ReportStatus, { bg: string; color: string; dot: string }> = {
  pending: { bg: A.amberChip, color: A.amber, dot: A.amberLine },
  under_review: { bg: '#E8F0FE', color: '#1E40AF', dot: '#3B6FD4' },
  resolved: { bg: '#DCFCE7', color: '#166534', dot: '#16A34A' },
  dismissed: { bg: '#F1F3F1', color: '#4B5563', dot: '#9AA39B' },
}
const EVENT_LABEL: Record<string, string> = {
  submitted: 'Report submitted', under_review: 'Marked as under review', resolved: 'Report resolved',
  dismissed: 'Report dismissed', reopened: 'Report reopened', note: 'Admin note added',
  content_removed: 'Content removed', content_kept: 'Content kept', user_restricted: 'Account restricted',
  user_suspended: 'Account suspended', user_restored: 'Account restored',
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
const startOfDay = (d: string) => new Date(`${d}T00:00:00`).toISOString()
const endOfDay = (d: string) => new Date(`${d}T23:59:59.999`).toISOString()
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const initials = (n: string) => n.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?'
function relative(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
const pname = (p: Prof | null) => p?.full_name || p?.username || 'Unknown user'
const phandle = (p: Prof | null) => (p?.username ? `@${p.username}` : '')

function pageList(cur: number, total: number): (number | '…')[] {
  const keep = new Set([1, total, cur - 1, cur, cur + 1])
  const nums = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  nums.forEach((n, i) => { if (i > 0 && n - nums[i - 1] > 1) out.push('…'); out.push(n) })
  return out
}

// What the "Reported" column shows: the thing that was reported, and who owns it
function reportedSummary(r: Row): { main: string; sub: string } {
  const s = r.snapshot
  switch (r.report_type) {
    case 'user': return { main: pname(r.reported) !== 'Unknown user' ? pname(r.reported) : str(s.name) || 'Unknown user', sub: phandle(r.reported) || (str(s.username) ? `@${str(s.username)}` : '') }
    case 'post': return { main: str(s.excerpt) || 'Post', sub: `by ${pname(r.reported)}` }
    case 'comment': return { main: str(s.excerpt) || 'Comment', sub: `by ${pname(r.reported)}` }
    case 'group': return { main: str(s.name) || 'Group', sub: `owner ${pname(r.reported)}` }
    case 'marketplace': return { main: str(s.title) || 'Listing', sub: `seller ${pname(r.reported)}` }
    case 'company': return { main: str(s.name) || 'Company', sub: `owner ${pname(r.reported)}` }
    default: return { main: r.reported ? pname(r.reported) : 'No specific target', sub: r.reported ? phandle(r.reported) : '' }
  }
}

const ICONS: Record<string, string> = {
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  doc: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  shield: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  refresh: 'M20 12a8 8 0 11-2.3-5.7L20 8M20 3v5h-5',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
}
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function Avatar({ p, size = 32 }: { p: Prof | null; size?: number }) {
  const box = { width: size, height: size, borderRadius: '50%', flexShrink: 0 as const }
  if (p?.profile_image) return <img src={p.profile_image} alt="" style={{ ...box, objectFit: 'cover', border: `1px solid ${A.border}` }} />
  return (
    <span style={{ ...box, background: A.greenTint, color: A.greenDark, border: '1px solid #D3EBDA', fontSize: size * 0.38, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {initials(pname(p))}
    </span>
  )
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {STATUS_LABEL[status]}
    </span>
  )
}
function TypeChip({ type }: { type: string }) {
  return <span style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: `1px solid ${A.border}`, color: '#374151', background: A.surface, whiteSpace: 'nowrap' }}>{typeLabel(type)}</span>
}
function AccountBadge({ status }: { status: string | null }) {
  const s = status || 'active'
  const st = s === 'suspended' ? { bg: A.amberChip, color: A.amber } : s === 'restricted' ? { bg: '#E8F0FE', color: '#1E40AF' } : { bg: '#DCFCE7', color: '#166534' }
  return <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: st.bg, color: st.color }}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
}

const CSS = `
.rp-sub { font-size:13px; color:${A.textMuted}; line-height:1.5; }
.rp-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
.rp-stats { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px; margin-bottom:18px; }
.rp-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
.rp-input { padding:9px 12px; border-radius:8px; border:1px solid ${A.border}; font-size:12.5px; background:${A.surface}; color:${A.text}; font-family:inherit; box-sizing:border-box; }
.rp-list { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; }
.rp-table-wrap { overflow-x:auto; }
.rp-table { width:100%; border-collapse:collapse; font-size:12.5px; min-width:980px; }
.rp-table th { padding:10px 14px; font-size:11.5px; font-weight:700; color:${A.textMuted}; text-align:left; background:${A.bg}; border-bottom:1px solid ${A.border}; white-space:nowrap; }
.rp-table td { padding:12px 14px; border-bottom:1px solid ${A.borderSoft}; vertical-align:middle; }
.rp-row { cursor:pointer; }
.rp-row:hover { background:#FAFBFA; }
.rp-row.attn { background:${A.amberBg}; }
.rp-row.attn:hover { background:#FFF7DD; }
.rp-row.attn td:first-child { box-shadow: inset 3px 0 0 ${A.amberLine}; }
.rp-clamp { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.45; color:${A.text}; word-break:break-word; }
.rp-cards { display:none; }
.rp-card { padding:14px; border-bottom:1px solid ${A.borderSoft}; }
.rp-card.attn { background:${A.amberBg}; box-shadow: inset 3px 0 0 ${A.amberLine}; }
.rp-card:last-child { border-bottom:none; }
.rp-btn { font-family:inherit; cursor:pointer; border-radius:8px; font-size:12.5px; font-weight:700; padding:8px 14px; border:1px solid ${A.border}; background:${A.surface}; color:${A.text}; display:inline-flex; align-items:center; gap:7px; text-decoration:none; }
.rp-btn:hover:not(:disabled) { background:${A.bg}; }
.rp-btn:disabled { opacity:.55; cursor:default; }
.rp-btn.primary { background:${A.green}; border-color:${A.green}; color:#fff; }
.rp-btn.primary:hover:not(:disabled) { background:#15803D; }
.rp-btn.danger { color:${A.red}; }
.rp-btn.danger:hover:not(:disabled) { background:#FEF2F2; }
.rp-btn.solid-danger { background:${A.red}; border-color:${A.red}; color:#fff; }
.rp-btn.solid-danger:hover:not(:disabled) { background:#991B1B; }
.rp-icon-btn { font-family:inherit; cursor:pointer; width:30px; height:30px; border-radius:7px; border:1px solid transparent; background:transparent; color:${A.textMuted}; display:inline-flex; align-items:center; justify-content:center; }
.rp-icon-btn:hover { background:${A.bg}; border-color:${A.border}; color:${A.text}; }
.rp-page { min-width:30px; height:30px; padding:0 8px; border-radius:7px; border:1px solid transparent; background:transparent; font-family:inherit; font-size:12.5px; font-weight:600; color:${A.text}; cursor:pointer; }
.rp-page:hover:not(:disabled) { background:${A.bg}; border-color:${A.border}; }
.rp-page.on { background:${A.greenTint}; border-color:#BFE3CA; color:${A.greenDark}; font-weight:800; }
.rp-page:disabled { color:${A.textSoft}; cursor:default; }
.rp-foot { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; padding:12px 14px; border-top:1px solid ${A.border}; }
.rp-drawer { position:fixed; top:0; right:0; bottom:0; width:520px; max-width:100%; background:${A.surface}; z-index:61; display:flex; flex-direction:column; box-shadow:-8px 0 28px rgba(15,26,18,0.12); animation:rp-in .18s ease-out; }
@keyframes rp-in { from { transform:translateX(24px); opacity:0; } to { transform:none; opacity:1; } }
.rp-label { font-size:12px; font-weight:700; color:${A.textMuted}; margin-bottom:8px; }
.rp-box { border:1px solid ${A.border}; border-radius:10px; padding:12px; margin-bottom:20px; }
.rp-kv { display:flex; justify-content:space-between; gap:14px; padding:6px 0; font-size:12.5px; }
.rp-kv span:first-child { color:${A.textMuted}; }
.rp-kv span:last-child { color:${A.text}; font-weight:600; text-align:right; word-break:break-word; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, a:focus-visible { outline:2px solid ${A.green}; outline-offset:1px; }
@media (max-width:1100px) { .rp-stats { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width:960px) { .rp-table-wrap { display:none; } .rp-cards { display:block; } }
@media (max-width:480px) { .rp-stats { grid-template-columns:1fr; } }
@media (prefers-reduced-motion: reduce) { .rp-drawer { animation:none; } }
`

export default function ReportsPage() {
  const staff = useStaff()
  const canManage = staff.permissions.has('reports.manage')
  const canCommunity = staff.permissions.has('community.moderate')
  const canMarket = staff.permissions.has('marketplace.moderate')
  const canUsers = staff.permissions.has('users.manage')
  const [params, setParams] = useSearchParams()

  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [qInput, setQInput] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [sel, setSel] = useState<Row | null>(null)
  const [events, setEvents] = useState<Ev[] | null>(null)
  const [against, setAgainst] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [confirmNote, setConfirmNote] = useState('')
  const [toast, setToast] = useState<{ text: string; err: boolean } | null>(null)
  const reqId = useRef(0)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.err ? 5000 : 2800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === qInput ? f : { ...f, q: qInput }))
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [qInput])

  const loadStats = useCallback(async () => {
    const head = (status?: string) => {
      const q = supabase.from('reports').select('id', { count: 'exact', head: true })
      return status ? q.eq('status', status) : q
    }
    const week = supabase.from('reports').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
    const [t, p, u, r, d, w] = await Promise.all([head(), head('pending'), head('under_review'), head('resolved'), head('dismissed'), week])
    if (t.error) return
    setStats({ total: t.count || 0, pending: p.count || 0, review: u.count || 0, resolved: r.count || 0, dismissed: d.count || 0, week: w.count || 0 })
  }, [])

  const load = useCallback(async () => {
    const id = ++reqId.current
    setError(false)
    setLoading(true)
    const from = (page - 1) * perPage
    let query = supabase.from('reports').select(SELECT, { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + perPage - 1)
    if (filters.status !== 'all') query = query.eq('status', filters.status)
    if (filters.type !== 'all') query = query.eq('report_type', filters.type)
    if (filters.from) query = query.gte('created_at', startOfDay(filters.from))
    if (filters.to) query = query.lte('created_at', endOfDay(filters.to))

    // characters that would break the PostgREST filter syntax are dropped from the search text
    const term = filters.q.replace(/[,()%*:]/g, ' ').trim()
    if (term) {
      const { data: people } = await supabase.from('profiles').select('user_id').or(`full_name.ilike.*${term}*,username.ilike.*${term}*`).limit(50)
      const ids = (people || []).map((p: { user_id: string }) => p.user_id)
      const reasonKeys = REPORT_REASONS.filter((r) => r.label.toLowerCase().includes(term.toLowerCase())).map((r) => r.key)
      const parts = [
        `report_code.ilike.*${term}*`, `description.ilike.*${term}*`,
        `snapshot->>excerpt.ilike.*${term}*`, `snapshot->>title.ilike.*${term}*`, `snapshot->>name.ilike.*${term}*`,
      ]
      if (reasonKeys.length) parts.push(`reason.in.(${reasonKeys.join(',')})`)
      if (ids.length) parts.push(`reporter_id.in.(${ids.join(',')})`, `reported_user_id.in.(${ids.join(',')})`)
      query = query.or(parts.join(','))
    }

    const { data, error: e, count } = await query
    if (id !== reqId.current) return
    if (e) { setError(true); setLoading(false); return }
    setRows((data || []) as unknown as Row[])
    setTotal(count || 0)
    setLoading(false)
  }, [filters, page, perPage])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadStats() }, [loadStats])

  const loadDetail = useCallback(async (r: Row) => {
    setEvents(null)
    setAgainst(null)
    const [ev, cnt] = await Promise.all([
      supabase.from('report_events').select('id, action, note, actor_name, created_at').eq('report_id', r.id).order('created_at', { ascending: false }),
      r.reported_user_id
        ? supabase.from('reports').select('id', { count: 'exact', head: true }).eq('reported_user_id', r.reported_user_id)
        : Promise.resolve({ count: null }),
    ])
    setEvents((ev.data || []) as Ev[])
    setAgainst(cnt.count ?? null)
  }, [])

  const openReport = (r: Row) => { setSel(r); setNote(''); loadDetail(r) }
  const closeReport = () => { setSel(null); setConfirm(null) }

  // Opens the right report when staff follow a notification link like /admin/reports?open=<id>
  const openParam = params.get('open')
  useEffect(() => {
    if (!openParam) return
    ;(async () => {
      const { data } = await supabase.from('reports').select(SELECT).eq('id', openParam).maybeSingle()
      if (data) openReport(data as unknown as Row)
      setParams({}, { replace: true })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirm) setConfirm(null)
      else if (sel) closeReport()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, sel])

  const refreshOne = async (id: string) => {
    const { data } = await supabase.from('reports').select(SELECT).eq('id', id).maybeSingle()
    if (!data) return
    const fresh = data as unknown as Row
    setRows((prev) => prev.map((r) => (r.id === id ? fresh : r)))
    setSel((cur) => (cur && cur.id === id ? fresh : cur))
    loadDetail(fresh)
    loadStats()
  }

  const run = async (call: () => RpcResult, okText: string, id: string) => {
    setBusy(true)
    const { error: e } = await call()
    setBusy(false)
    if (e) { setToast({ text: e.message, err: true }); return false }
    setToast({ text: okText, err: false })
    await refreshOne(id)
    return true
  }
  const setStatus = (r: Row, status: ReportStatus, okText: string) =>
    run(() => supabase.rpc('admin_report_set_status', { p_id: r.id, p_status: status, p_note: null }), okText, r.id)
  const doAction = (r: Row, action: string, okText: string, n: string | null) =>
    run(() => supabase.rpc('admin_report_action', { p_id: r.id, p_action: action, p_note: n }), okText, r.id)
  const saveNote = async (r: Row) => {
    if (!note.trim()) return
    if (await run(() => supabase.rpc('admin_report_add_note', { p_id: r.id, p_note: note }), 'Note saved', r.id)) setNote('')
  }

  const runConfirm = async (r: Row) => {
    if (!confirm) return
    const n = confirmNote.trim() || null
    const map = {
      remove: { action: 'remove_content', text: r.report_type === 'marketplace' ? 'Listing removed' : r.report_type === 'comment' ? 'Comment removed' : 'Post removed' },
      restrict: { action: 'restrict_user', text: 'Account restricted' },
      suspend: { action: 'suspend_user', text: 'Account suspended' },
      restore: { action: 'restore_user', text: 'Account restored' },
    }[confirm.kind]
    const ok = await doAction(r, map.action, map.text, n)
    if (ok) { setConfirm(null); setConfirmNote('') }
  }

  const filtersActive = filters.status !== 'all' || filters.type !== 'all' || !!filters.from || !!filters.to || !!filters.q
  const clearFilters = () => { setFilters(NO_FILTERS); setQInput(''); setPage(1) }
  const setF = (patch: Partial<Filters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, totalPages)
  const shownFrom = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const shownTo = Math.min(safePage * perPage, total)

  const cards = [
    { label: 'Total Reports', value: stats?.total, icon: 'doc', note: stats ? `${stats.week} in the last 7 days` : '', warn: false },
    { label: 'Pending', value: stats?.pending, icon: 'clock', note: stats ? (stats.pending > 0 ? 'Awaiting review' : 'Nothing waiting') : '', warn: !!stats && stats.pending > 0 },
    { label: 'Under Review', value: stats?.review, icon: 'shield', note: stats ? (stats.review > 0 ? 'Being handled' : 'None in progress') : '', warn: false },
    { label: 'Resolved', value: stats?.resolved, icon: 'check', note: stats ? `${stats.dismissed} dismissed` : '', warn: false },
  ]

  const removed = !!events?.some((e) => e.action === 'content_removed')

  // content details block in the drawer, depending on report type
  const renderReported = (r: Row) => {
    const s = r.snapshot
    const owner = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Avatar p={r.reported} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: A.text }}>{pname(r.reported)}</p>
          <p style={{ fontSize: 12, color: A.textMuted }}>{phandle(r.reported)}{r.reported?.role ? ` · ${r.reported.role}` : ''}</p>
        </div>
        {r.report_type === 'user' && <AccountBadge status={r.reported?.account_status ?? str(s.account_status)} />}
      </div>
    )
    const text = (v: string) => <p style={{ fontSize: 13.5, color: A.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</p>
    const note2 = <p style={{ fontSize: 11.5, color: A.textSoft, marginTop: 10 }}>Details as they were when the report was submitted.</p>

    if (r.report_type === 'other') {
      return r.reported ? <div className="rp-box">{owner}</div> : <p style={{ fontSize: 12.5, color: A.textMuted, marginBottom: 20 }}>This report is not linked to a specific account or content.</p>
    }
    return (
      <div className="rp-box">
        {owner}
        {r.report_type === 'user' && (
          <>
            <div className="rp-kv"><span>FarmLite ID</span><span>{r.reported?.farmlite_id || '-'}</span></div>
            <div className="rp-kv"><span>Member since</span><span>{r.reported ? fmtDay(r.reported.created_at) : '-'}</span></div>
            <div className="rp-kv"><span>Reports against this account</span><span>{against ?? '...'}</span></div>
          </>
        )}
        {r.report_type === 'post' && (
          <>
            {text(str(s.excerpt))}
            <div className="rp-kv" style={{ marginTop: 6 }}><span>Posted</span><span>{s.posted_at ? `${fmtDay(str(s.posted_at))}, ${fmtTime(str(s.posted_at))}` : '-'}</span></div>
            <div className="rp-kv"><span>Engagement</span><span>{num(s.likes)} likes · {num(s.comments)} comments · {num(s.shares)} shares</span></div>
            {num(s.image_count) > 0 && <div className="rp-kv"><span>Attached images</span><span>{num(s.image_count)}</span></div>}
            {removed && <p style={{ fontSize: 12.5, fontWeight: 700, color: A.amber, marginTop: 8 }}>This post has been removed.</p>}
            {note2}
          </>
        )}
        {r.report_type === 'comment' && (
          <>
            {text(str(s.excerpt))}
            <div className="rp-kv" style={{ marginTop: 6 }}><span>Posted</span><span>{s.posted_at ? `${fmtDay(str(s.posted_at))}, ${fmtTime(str(s.posted_at))}` : '-'}</span></div>
            <div className="rp-kv"><span>On post</span><span>{str(s.parent_excerpt) ? `${str(s.parent_excerpt)}...` : 'Post no longer available'}</span></div>
            {removed && <p style={{ fontSize: 12.5, fontWeight: 700, color: A.amber, marginTop: 8 }}>This comment has been removed.</p>}
            {note2}
          </>
        )}
        {r.report_type === 'marketplace' && (
          <>
            <div className="rp-kv"><span>{str(s.kind) === 'equipment' ? 'Equipment' : 'Product'}</span><span>{str(s.title)}</span></div>
            <div className="rp-kv"><span>Price</span><span>{str(s.currency)} {num(s.price).toLocaleString()}{str(s.unit) ? ` / ${str(s.unit)}` : ''}</span></div>
            <div className="rp-kv"><span>Listing status</span><span>{removed || s.hidden === true ? 'Hidden by admin' : str(s.status) ? str(s.status).charAt(0).toUpperCase() + str(s.status).slice(1) : '-'}</span></div>
            {note2}
          </>
        )}
        {r.report_type === 'group' && (
          <>
            <div className="rp-kv"><span>Group</span><span>{str(s.name)}</span></div>
            <div className="rp-kv"><span>Members</span><span>{num(s.members)}</span></div>
            <div className="rp-kv"><span>Group status</span><span>Active</span></div>
            {str(s.description) && <p style={{ fontSize: 12.5, color: A.textMuted, marginTop: 6, lineHeight: 1.5 }}>{str(s.description)}</p>}
            {note2}
          </>
        )}
        {r.report_type === 'company' && (
          <>
            <div className="rp-kv"><span>Company</span><span>{str(s.name)}</span></div>
            <div className="rp-kv"><span>Category</span><span>{str(s.category) || '-'}</span></div>
            <div className="rp-kv"><span>Company status</span><span>{str(s.status) ? str(s.status).replace(/_/g, ' ') : '-'}</span></div>
            {note2}
          </>
        )}
      </div>
    )
  }

  const confirmCopy = (r: Row) => {
    if (!confirm) return null
    const noun = r.report_type === 'comment' ? 'comment' : r.report_type === 'marketplace' ? 'listing' : 'post'
    return {
      remove: { title: `Remove this ${noun}?`, body: noun === 'listing' ? 'The listing will be hidden from the marketplace and the seller will be notified.' : `The ${noun} will be deleted for everyone and the author will be notified. This cannot be undone.`, cta: `Remove ${noun}`, danger: true },
      restrict: { title: 'Restrict this account?', body: 'They will not be able to post new content until the restriction is lifted. They will be notified.', cta: 'Restrict account', danger: true },
      suspend: { title: 'Suspend this account?', body: 'They will be blocked from using FarmLite until the suspension is lifted. They will be notified.', cta: 'Suspend account', danger: true },
      restore: { title: 'Restore this account?', body: 'The account will be active again and the user will be notified.', cta: 'Restore account', danger: false },
    }[confirm.kind]
  }

  const rowOpenProps = (r: Row) => ({ onClick: () => openReport(r) })

  return (
    <AdminLayout title="Reports">
      <style>{CSS}</style>

      <div className="rp-head">
        <p className="rp-sub" style={{ paddingTop: 7 }}>Review and manage reports submitted by FarmLite users.</p>
        <button className="rp-btn" onClick={() => { load(); loadStats() }}><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      <div className="rp-stats">
        {cards.map((c) => (
          <div key={c.label} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: A.textMuted }}>{c.label}</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: c.warn ? A.amberChip : A.greenTint, color: c.warn ? A.amber : A.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={c.icon} size={15} />
              </span>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: A.text, margin: '6px 0 4px', lineHeight: 1.1 }}>{c.value === undefined ? '-' : c.value.toLocaleString()}</p>
            <p style={{ fontSize: 12, color: c.warn ? A.amber : A.textMuted, fontWeight: 600, minHeight: 16 }}>{c.note}</p>
          </div>
        ))}
      </div>

      <div className="rp-filters">
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 11, top: 9, color: A.textSoft, display: 'flex' }}><Icon name="search" size={15} /></span>
          <input className="rp-input" style={{ width: '100%', paddingLeft: 34 }} value={qInput} onChange={(e) => setQInput(e.target.value)}
            placeholder="Search report ID, reporter, reported user, content or reason" aria-label="Search reports" />
        </div>
        <select className="rp-input" value={filters.status} onChange={(e) => setF({ status: e.target.value })} aria-label="Status">
          <option value="all">Status: All</option>
          {(Object.keys(STATUS_LABEL) as ReportStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="rp-input" value={filters.type} onChange={(e) => setF({ type: e.target.value })} aria-label="Report type">
          <option value="all">Type: All</option>
          {REPORT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <label style={{ fontSize: 12, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
          From <input className="rp-input" type="date" value={filters.from} onChange={(e) => setF({ from: e.target.value })} />
        </label>
        <label style={{ fontSize: 12, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
          To <input className="rp-input" type="date" value={filters.to} onChange={(e) => setF({ to: e.target.value })} />
        </label>
        {filtersActive && <button className="rp-btn" onClick={clearFilters}>Clear</button>}
      </div>

      <div className="rp-list">
        {error ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>Could not load reports. You may not have permission to view them.</p>
            <button className="rp-btn" onClick={() => load()}>Try again</button>
          </div>
        ) : loading ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', fontSize: 13, color: A.textMuted }}>Loading reports...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <span style={{ width: 56, height: 56, borderRadius: '50%', background: A.greenTint, color: A.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Icon name="inbox" size={26} />
            </span>
            <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 6 }}>No reports found</p>
            <p style={{ fontSize: 13, color: A.textMuted, maxWidth: 360, margin: '0 auto', lineHeight: 1.55 }}>
              {filtersActive ? 'No reports match your search or filters.' : 'Reports submitted by FarmLite users will appear here.'}
            </p>
          </div>
        ) : (
          <>
            <div className="rp-table-wrap">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>Report ID</th><th>Reporter</th><th style={{ width: '24%' }}>Reported</th><th>Type</th>
                    <th>Reason</th><th>Date</th><th>Status</th><th style={{ width: 90 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const rep = reportedSummary(r)
                    return (
                      <tr key={r.id} className={`rp-row${r.status === 'pending' ? ' attn' : ''}`} {...rowOpenProps(r)}>
                        <td style={{ fontWeight: 700, color: A.text, whiteSpace: 'nowrap' }}>{r.report_code}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <Avatar p={r.reporter} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: A.text, whiteSpace: 'nowrap' }}>{pname(r.reporter)}</div>
                              <div style={{ fontSize: 11.5, color: A.textMuted }}>{phandle(r.reporter)}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="rp-clamp" style={{ maxWidth: 300, fontWeight: r.report_type === 'user' ? 700 : 500 }}>{rep.main}</div>
                          {rep.sub && <div style={{ fontSize: 11.5, color: A.textMuted, marginTop: 2 }}>{rep.sub}</div>}
                        </td>
                        <td><TypeChip type={r.report_type} /></td>
                        <td style={{ color: A.text, whiteSpace: 'nowrap' }}>{reasonLabel(r.reason)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ color: A.text }}>{fmtDay(r.created_at)}</div>
                          <div style={{ fontSize: 11.5, color: A.textMuted }}>{relative(r.created_at)}</div>
                        </td>
                        <td><StatusBadge status={r.status} /></td>
                        <td><button className="rp-btn" style={{ padding: '5px 12px' }} onClick={(e) => { e.stopPropagation(); openReport(r) }}>View</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="rp-cards">
              {rows.map((r) => {
                const rep = reportedSummary(r)
                return (
                  <div key={r.id} className={`rp-card${r.status === 'pending' ? ' attn' : ''}`}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: A.text }}>{r.report_code}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                      <Avatar p={r.reporter} size={30} />
                      <div style={{ fontSize: 12.5, color: A.textMuted }}>Reported by <b style={{ color: A.text }}>{pname(r.reporter)}</b></div>
                    </div>
                    <div className="rp-clamp" style={{ fontSize: 13, marginBottom: 4 }}>{rep.main}</div>
                    {rep.sub && <div style={{ fontSize: 11.5, color: A.textMuted, marginBottom: 8 }}>{rep.sub}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '8px 0 12px' }}>
                      <TypeChip type={r.report_type} />
                      <span style={{ fontSize: 12, color: A.text, fontWeight: 600 }}>{reasonLabel(r.reason)}</span>
                      <span style={{ fontSize: 12, color: A.textMuted }}>{relative(r.created_at)}</span>
                    </div>
                    <button className={`rp-btn${r.status === 'pending' ? ' primary' : ''}`} onClick={() => openReport(r)}><Icon name="eye" size={14} /> View</button>
                  </div>
                )
              })}
            </div>

            <div className="rp-foot">
              <span style={{ fontSize: 12.5, color: A.textMuted }}>Showing {shownFrom}-{shownTo} of {total} reports</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="rp-page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="chevL" size={13} /> Previous</button>
                {pageList(safePage, totalPages).map((p, idx) => (p === '…'
                  ? <span key={`g${idx}`} style={{ padding: '0 4px', color: A.textSoft }}>…</span>
                  : <button key={p} className={`rp-page${p === safePage ? ' on' : ''}`} onClick={() => setPage(p)} aria-current={p === safePage ? 'page' : undefined}>{p}</button>))}
                <button className="rp-page" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Next <Icon name="chevR" size={13} /></button>
              </div>
              <label style={{ fontSize: 12.5, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
                Rows per page
                <select className="rp-input" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}>
                  {ROWS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
          </>
        )}
      </div>

      {sel && (
        <>
          <div onClick={closeReport} style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.38)', zIndex: 60 }} />
          <aside className="rp-drawer" role="dialog" aria-label="Report details">
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: A.text }}>Report details</p>
                <p style={{ fontSize: 12, color: A.textMuted, marginTop: 2 }}>{sel.report_code} · {typeLabel(sel.report_type)}</p>
              </div>
              <StatusBadge status={sel.status} />
              <button className="rp-icon-btn" aria-label="Close" onClick={closeReport}><Icon name="close" size={16} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {sel.status === 'pending' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: A.amberBg, border: '1px solid #F3E2B8', borderRadius: 8, padding: '10px 12px', marginBottom: 18, color: A.amber, fontSize: 12.5, lineHeight: 1.5 }}>
                  <span style={{ marginTop: 1 }}><Icon name="alert" size={15} /></span>
                  <span>This report has not been reviewed yet.</span>
                </div>
              )}

              <p className="rp-label">Report information</p>
              <div className="rp-box">
                <div className="rp-kv"><span>Report ID</span><span>{sel.report_code}</span></div>
                <div className="rp-kv"><span>Submitted</span><span>{fmtDay(sel.created_at)}, {fmtTime(sel.created_at)}</span></div>
                <div className="rp-kv"><span>Status</span><span><StatusBadge status={sel.status} /></span></div>
                <div className="rp-kv"><span>Reason</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="flag" size={12} />{reasonLabel(sel.reason)}</span></div>
                <div style={{ borderTop: `1px solid ${A.borderSoft}`, marginTop: 6, paddingTop: 10 }}>
                  <p style={{ fontSize: 12, color: A.textMuted, marginBottom: 4 }}>Additional explanation from reporter</p>
                  <p style={{ fontSize: 13, color: sel.description ? A.text : A.textSoft, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {sel.description || 'No explanation provided.'}
                  </p>
                </div>
              </div>

              <p className="rp-label">Reporter</p>
              <div className="rp-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Avatar p={sel.reporter} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 800, color: A.text }}>{pname(sel.reporter)}</p>
                    <p style={{ fontSize: 12, color: A.textMuted }}>{phandle(sel.reporter)}</p>
                  </div>
                </div>
                <div className="rp-kv"><span>Role</span><span>{sel.reporter?.role || '-'}</span></div>
                <div className="rp-kv"><span>FarmLite ID</span><span>{sel.reporter?.farmlite_id || '-'}</span></div>
                <div className="rp-kv"><span>Member since</span><span>{sel.reporter ? fmtDay(sel.reporter.created_at) : '-'}</span></div>
              </div>

              <p className="rp-label">{sel.report_type === 'user' ? 'Reported account' : sel.report_type === 'other' ? 'Reported account (if any)' : `Reported ${typeLabel(sel.report_type).toLowerCase()}`}</p>
              {renderReported(sel)}

              {canManage && (
                <>
                  <p className="rp-label">Moderation actions</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                    {sel.report_type === 'user' && sel.reported && (
                      <>
                        {sel.reported.username && <a className="rp-btn" href={`/u/${sel.reported.username}`} target="_blank" rel="noreferrer"><Icon name="link" size={14} /> View Profile</a>}
                        {canUsers && sel.reported.account_status === 'active' && <button className="rp-btn danger" disabled={busy} onClick={() => { setConfirmNote(''); setConfirm({ kind: 'restrict' }) }}>Restrict Account</button>}
                        {canUsers && sel.reported.account_status !== 'suspended' && <button className="rp-btn danger" disabled={busy} onClick={() => { setConfirmNote(''); setConfirm({ kind: 'suspend' }) }}>Suspend Account</button>}
                        {canUsers && sel.reported.account_status !== 'active' && <button className="rp-btn" disabled={busy} onClick={() => { setConfirmNote(''); setConfirm({ kind: 'restore' }) }}>Restore Account</button>}
                      </>
                    )}
                    {(sel.report_type === 'post' || sel.report_type === 'comment') && sel.content_id && !removed && (
                      <>
                        {canCommunity && <button className="rp-btn danger" disabled={busy} onClick={() => { setConfirmNote(''); setConfirm({ kind: 'remove' }) }}>Remove {sel.report_type === 'post' ? 'Post' : 'Comment'}</button>}
                        <button className="rp-btn" disabled={busy} onClick={() => doAction(sel, 'keep_content', `${sel.report_type === 'post' ? 'Post' : 'Comment'} kept`, null)}>Keep {sel.report_type === 'post' ? 'Post' : 'Comment'}</button>
                      </>
                    )}
                    {sel.report_type === 'marketplace' && sel.content_id && !removed && sel.snapshot.hidden !== true && (
                      <>
                        <a className="rp-btn" href={sel.content_table === 'equipment' ? '/admin/equipment' : '/admin/marketplace'}><Icon name="link" size={14} /> View Listing</a>
                        {canMarket && <button className="rp-btn danger" disabled={busy} onClick={() => { setConfirmNote(''); setConfirm({ kind: 'remove' }) }}>Remove Listing</button>}
                      </>
                    )}
                    {sel.report_type === 'group' && sel.content_id && <a className="rp-btn" href={`/communities/${sel.content_id}`} target="_blank" rel="noreferrer"><Icon name="link" size={14} /> View Group</a>}
                    {sel.report_type === 'company' && <a className="rp-btn" href="/admin/companies"><Icon name="link" size={14} /> View Company</a>}
                    {sel.report_type === 'other' && !sel.reported && <span style={{ fontSize: 12.5, color: A.textMuted }}>Use the buttons below to close this report.</span>}
                  </div>
                </>
              )}

              <p className="rp-label">Admin notes</p>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11.5, color: A.textSoft, marginBottom: 6 }}>Internal only. Users never see these notes.</p>
                {canManage ? (
                  <>
                    <textarea className="rp-input" style={{ width: '100%', resize: 'vertical' }} rows={3} maxLength={2000} value={note}
                      onChange={(e) => setNote(e.target.value)} placeholder="Add internal note..." aria-label="Admin note" />
                    <div style={{ marginTop: 8 }}>
                      <button className="rp-btn" disabled={busy || !note.trim()} onClick={() => saveNote(sel)}>Save Note</button>
                    </div>
                  </>
                ) : <p style={{ fontSize: 12.5, color: A.textMuted }}>You can view reports but not add notes.</p>}
              </div>

              <p className="rp-label" style={{ marginBottom: 10 }}>Report history</p>
              {events === null ? (
                <p style={{ fontSize: 12.5, color: A.textMuted }}>Loading history...</p>
              ) : events.length === 0 ? (
                <p style={{ fontSize: 12.5, color: A.textMuted }}>No history yet.</p>
              ) : (
                <div style={{ paddingLeft: 4 }}>
                  {events.map((h, idx) => (
                    <div key={h.id} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: idx === events.length - 1 ? 0 : 16 }}>
                      {idx !== events.length - 1 && <span style={{ position: 'absolute', left: 4, top: 14, bottom: 0, width: 1, background: A.border }} />}
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: h.action === 'submitted' ? A.amberLine : A.green, marginTop: 4, flexShrink: 0, zIndex: 1 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12.5, color: A.text }}><b>{EVENT_LABEL[h.action] || h.action}</b>{h.actor_name ? ` by ${h.actor_name}` : ''}</p>
                        {h.note && <p style={{ fontSize: 12, color: A.textMuted, marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{h.note}</p>}
                        <p style={{ fontSize: 11.5, color: A.textSoft, marginTop: 1 }}>{fmtDay(h.created_at)}, {fmtTime(h.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: `1px solid ${A.border}`, display: 'flex', gap: 8, flexWrap: 'wrap', background: A.surface }}>
              {!canManage ? (
                <span style={{ fontSize: 12.5, color: A.textMuted }}>You have view-only access to reports.</span>
              ) : sel.status === 'resolved' || sel.status === 'dismissed' ? (
                <button className="rp-btn" disabled={busy} onClick={() => setStatus(sel, 'pending', 'Report reopened')}>Reopen Report</button>
              ) : (
                <>
                  {sel.status === 'pending' && <button className="rp-btn" disabled={busy} onClick={() => setStatus(sel, 'under_review', 'Marked as under review')}>Mark as Under Review</button>}
                  <button className="rp-btn primary" disabled={busy} onClick={() => setStatus(sel, 'resolved', 'Report resolved')}><Icon name="check" size={14} /> Resolve Report</button>
                  <button className="rp-btn" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => setStatus(sel, 'dismissed', 'Report dismissed')}>Dismiss Report</button>
                </>
              )}
            </div>
          </aside>
        </>
      )}

      {sel && confirm && (() => {
        const c = confirmCopy(sel)
        if (!c) return null
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.45)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setConfirm(null)}>
            <div role="alertdialog" aria-label={c.title} onClick={(e) => e.stopPropagation()} style={{ background: A.surface, borderRadius: 12, padding: 22, width: 420, maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 8 }}>{c.title}</p>
              <p style={{ fontSize: 13, color: A.textMuted, lineHeight: 1.55, marginBottom: 12 }}>{c.body}</p>
              <textarea className="rp-input" style={{ width: '100%', resize: 'vertical', marginBottom: 16 }} rows={2} maxLength={500} value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)} placeholder="Add a note for the history (optional)" aria-label="Note for history" />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="rp-btn" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
                <button className={`rp-btn ${c.danger ? 'solid-danger' : 'primary'}`} disabled={busy} onClick={() => runConfirm(sel)}>{busy ? 'Working...' : c.cta}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {toast && (
        <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: toast.err ? '#7F1D1D' : A.greenDark, color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '10px 16px', borderRadius: 8, zIndex: 80, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: 'calc(100vw - 32px)' }}>
          {toast.err ? <Icon name="alert" size={14} /> : <Icon name="check" size={14} />} {toast.text}
        </div>
      )}
    </AdminLayout>
  )
}
