import { useCallback, useEffect, useState } from 'react'
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

type EStatus = 'active' | 'sold' | 'paused' | 'suspended'
type EType = 'buy' | 'rent' | 'service'

type Overview = {
  total: number; sale: number; rent: number; service: number; active: number; suspended: number; flagged: number; reported: number
  providers: number; new_30: number; new_prev: number
  categories: { category: string; listings: number }[]
}
type Row = {
  id: string; name: string; listing_type: EType; category: string | null; price: number; currency: string; unit: string | null; price_mode: string | null
  image: string | null; status: EStatus; flagged: boolean; created_at: string; seller_id: string; city: string | null; state: string | null
  seller_name: string | null; seller_username: string | null; seller_image: string | null; rep_open: number; rep_total: number
}
type Detail = {
  listing: {
    id: string; name: string; listing_type: EType; category: string | null; brand: string | null; model: string | null; description: string | null
    price: number; currency: string; unit: string | null; price_mode: string | null; images: string[]; status: EStatus; seller_status: string
    flagged: boolean; created_at: string; city: string | null; state: string | null; country: string | null; whatsapp: string | null
    business_email: string | null; seller_name: string | null; company_id: string | null
  }
  seller: { user_id: string; full_name: string | null; username: string | null; profile_image: string | null; is_verified: boolean; account_status: string; listings: number; suspended: number } | null
  company: { id: string; name: string; status: string } | null
  activity: { saves: number; reports: number; open_reports: number }
  reports: { id: string; code: string; reason: string; status: string; created_at: string }[]
  history: { action: string; actor: string | null; at: string; note: string | null }[]
}
type Kind = 'suspend' | 'restore' | 'remove'
type Confirm = { kind: Kind; id: string; name: string } | null

const STATUS_LABEL: Record<EStatus, string> = { active: 'Active', sold: 'Sold', paused: 'Unavailable', suspended: 'Suspended' }
const STATUS_STYLE: Record<EStatus, { bg: string; color: string; dot: string }> = {
  active: { bg: '#DCFCE7', color: '#166534', dot: '#16A34A' },
  sold: { bg: '#E8F0FE', color: '#1E40AF', dot: A.blue },
  paused: { bg: '#F1F3F1', color: '#4B5563', dot: '#9AA39B' },
  suspended: { bg: A.amberChip, color: A.amber, dot: A.amberLine },
}
const TYPE_LABEL: Record<EType, string> = { buy: 'For Sale', rent: 'For Rent', service: 'Service' }
const ROWS = [10, 25, 50]

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtFull = (iso: string) => `${fmtDay(iso)}, ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
const sname = (n: string | null, u: string | null) => n || u || 'Unknown owner'
const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`
const n0 = (v: number) => v.toLocaleString()
function money(currency: string, amount: number) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount) } catch { return `${currency} ${n0(amount)}` }
}
function priceText(r: { listing_type: EType; price: number; currency: string; unit: string | null; price_mode: string | null }) {
  if (r.listing_type === 'service') {
    if (r.price_mode === 'quote') return 'Quote on request'
    if (r.price_mode === 'starting') return `From ${money(r.currency, r.price)}`
    if (r.price_mode === 'hourly') return `${money(r.currency, r.price)} / hour`
    return money(r.currency, r.price)
  }
  return `${money(r.currency, r.price)}${r.listing_type === 'rent' && r.unit ? ` / ${r.unit}` : ''}`
}
function change(cur: number, prev: number): string {
  if (prev === 0 && cur === 0) return 'No change'
  if (prev === 0) return 'New activity'
  const pct = Math.round(((cur - prev) / prev) * 100)
  return pct === 0 ? 'No change' : `${pct > 0 ? '+' : ''}${pct}% vs previous 30 days`
}

function Thumb({ src, size = 44 }: { src: string | null; size?: number }) {
  const [bad, setBad] = useState(false)
  const box = { width: size, height: size, borderRadius: 8, flexShrink: 0 as const, border: `1px solid ${A.border}` }
  if (!src || bad) return <span style={{ ...box, background: A.bg, color: A.textSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>No photo</span>
  return <img src={src} alt="" onError={() => setBad(true)} style={{ ...box, objectFit: 'cover' }} />
}
function StatusBadge({ status }: { status: EStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />{STATUS_LABEL[status]}
    </span>
  )
}
function TypeChip({ t }: { t: EType }) {
  return <span style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: `1px solid ${A.border}`, color: '#374151', background: A.surface, whiteSpace: 'nowrap' }}>{TYPE_LABEL[t]}</span>
}

const CSS = `
.eq-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
.eq-sub { font-size:13px; color:${A.textMuted}; line-height:1.5; }
.eq-stats { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:14px; margin-bottom:18px; }
.eq-stat { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; padding:14px 16px; min-width:0; }
.eq-stat.warn { border-color:${A.amberLine}; background:${A.amberBg}; }
.eq-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
.eq-input { padding:9px 12px; border-radius:8px; border:1px solid ${A.border}; font-size:12.5px; background:${A.surface}; color:${A.text}; font-family:inherit; box-sizing:border-box; }
.eq-list { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; }
.eq-wrap { overflow-x:auto; }
.eq-table { width:100%; border-collapse:collapse; font-size:12.5px; min-width:940px; }
.eq-table th { padding:10px 14px; font-size:11.5px; font-weight:700; color:${A.textMuted}; text-align:left; background:${A.bg}; border-bottom:1px solid ${A.border}; white-space:nowrap; }
.eq-table td { padding:12px 14px; border-bottom:1px solid ${A.borderSoft}; vertical-align:middle; }
.eq-table tr:last-child td { border-bottom:none; }
.eq-row { cursor:pointer; }
.eq-row:hover { background:#FAFBFA; }
.eq-row.attn { background:${A.amberBg}; }
.eq-row.attn td:first-child { box-shadow: inset 3px 0 0 ${A.amberLine}; }
.eq-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; border:1px solid ${A.border}; background:${A.surface}; color:${A.text}; font-size:12.5px; font-weight:700; cursor:pointer; font-family:inherit; }
.eq-btn:disabled { opacity:.55; cursor:default; }
.eq-btn.primary { background:${A.green}; border-color:${A.green}; color:#fff; }
.eq-btn.danger { color:${A.red}; border-color:#F3C6C6; }
.eq-btn.sm { padding:5px 10px; font-size:12px; }
.eq-pager { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-top:1px solid ${A.border}; flex-wrap:wrap; font-size:12.5px; color:${A.textMuted}; }
.eq-overlay { position:fixed; inset:0; background:rgba(15,26,15,.4); z-index:60; display:flex; justify-content:flex-end; }
.eq-drawer { width:560px; max-width:100%; background:${A.surface}; height:100%; overflow-y:auto; box-shadow:-8px 0 30px rgba(0,0,0,.12); }
.eq-sec { padding:16px 20px; border-bottom:1px solid ${A.borderSoft}; }
.eq-sec h3 { font-size:13px; font-weight:800; color:${A.text}; margin:0 0 10px; }
.eq-kv { display:flex; gap:12px; padding:5px 0; font-size:12.5px; }
.eq-kv span:first-child { width:130px; flex-shrink:0; color:${A.textMuted}; }
.eq-modal-wrap { position:fixed; inset:0; background:rgba(15,26,15,.45); z-index:80; display:flex; align-items:center; justify-content:center; padding:16px; }
.eq-modal { background:${A.surface}; border-radius:12px; padding:20px; width:440px; max-width:100%; }
.eq-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:90; padding:10px 16px; border-radius:8px; font-size:13px; font-weight:700; color:#fff; box-shadow:0 6px 20px rgba(0,0,0,.2); }
@media (max-width: 1100px) { .eq-stats { grid-template-columns:repeat(3, minmax(0,1fr)); } }
@media (max-width: 700px) { .eq-stats { grid-template-columns:repeat(2, minmax(0,1fr)); } }
`

export default function AdminEquipmentPage() {
  const staff = useStaff()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const canManage = staff.permissions.has('equipment.manage')

  const [ov, setOv] = useState<Overview | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [reportedOnly, setReportedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailError, setDetailError] = useState('')
  const [imgIdx, setImgIdx] = useState(0)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ text: string; err: boolean } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.err ? 5000 : 2800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [qInput])

  const loadOverview = useCallback(async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const { data, error: e } = await supabase.rpc('admin_equipment_overview', { p_tz: tz })
    if (!e && data) setOv(data as Overview)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: e } = await supabase.rpc('admin_equipment_list', {
      p_search: q || null, p_status: status, p_type: type, p_reported: reportedOnly, p_limit: perPage, p_offset: (page - 1) * perPage,
    })
    if (e || !data) { setError(e?.message || 'Unable to load equipment listings.'); setLoading(false); return }
    setRows((data as any).rows as Row[])
    setTotal((data as any).total as number)
    setLoading(false)
  }, [q, status, type, reportedOnly, page, perPage])

  useEffect(() => { load() }, [load, tick])
  useEffect(() => { loadOverview() }, [loadOverview, tick])

  const loadDetail = useCallback(async (id: string) => {
    setDetail(null)
    setDetailError('')
    setImgIdx(0)
    const { data, error: e } = await supabase.rpc('admin_equipment_detail', { p_id: id })
    if (e || !data) { setDetailError(e?.message || 'Unable to load this listing.'); return }
    setDetail(data as Detail)
  }, [])

  const openDrawer = (id: string) => { setDrawerId(id); loadDetail(id) }
  const closeDrawer = () => { setDrawerId(null); setDetail(null) }

  // deep links such as /admin/equipment?open=<listing id>
  const openParam = params.get('open')
  useEffect(() => {
    if (!openParam) return
    openDrawer(openParam)
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam])

  const act = async (id: string, action: string, noteText: string | null, okText: string) => {
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_equipment_action', { p_id: id, p_action: action, p_note: noteText })
    setBusy(false)
    if (e) { setToast({ text: e.message, err: true }); return false }
    setToast({ text: okText, err: false })
    setTick((n) => n + 1)
    if (action === 'remove') closeDrawer()
    else if (drawerId === id) await loadDetail(id)
    return true
  }

  const ask = (kind: Kind, id: string, name: string) => { setNote(''); setConfirm({ kind, id, name }) }
  const runConfirm = async () => {
    if (!confirm) return
    const map = { suspend: ['suspend', 'Listing suspended'], restore: ['restore', 'Listing restored'], remove: ['remove', 'Listing removed'] }[confirm.kind]
    const ok = await act(confirm.id, map[0], confirm.kind === 'restore' ? null : note.trim() || null, map[1])
    if (ok) setConfirm(null)
  }
  const copy = {
    suspend: { title: 'Suspend this listing?', body: 'It will be hidden from buyers and the owner is notified. You can restore it later.', danger: true },
    restore: { title: 'Restore this listing?', body: 'It will be visible to buyers again and the owner is notified.', danger: false },
    remove: { title: 'Remove this listing?', body: 'It is permanently deleted, along with saves other members made on it. This cannot be undone.', danger: true },
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, totalPages)
  const shownFrom = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const shownTo = Math.min(safePage * perPage, total)
  const filtersActive = type !== 'all' || status !== 'all' || reportedOnly || !!q
  const clearFilters = () => { setType('all'); setStatus('all'); setReportedOnly(false); setQInput(''); setQ(''); setPage(1) }

  const cards = ov ? [
    { label: 'Total Listings', value: n0(ov.total), note: `${n0(ov.sale)} sale · ${n0(ov.rent)} rent · ${n0(ov.service)} services`, warn: false },
    { label: 'Active Listings', value: n0(ov.active), note: ov.suspended > 0 ? `${n0(ov.suspended)} suspended` : 'Visible to buyers', warn: false },
    { label: 'Reported Listings', value: n0(ov.reported), note: ov.reported > 0 ? 'Have open reports' : 'No open reports', warn: ov.reported > 0 },
    { label: 'Equipment Providers', value: n0(ov.providers), note: 'Members with listings', warn: false },
    { label: 'New in 30 days', value: n0(ov.new_30), note: change(ov.new_30, ov.new_prev), warn: false },
  ] : []

  const L = detail?.listing
  const place = (l: { city: string | null; state: string | null; country: string | null }) => [l.city, l.state, l.country].filter(Boolean).join(', ')

  return (
    <AdminLayout title="Equipment">
      <style>{CSS}</style>

      <div className="eq-head">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: A.text, margin: 0 }}>Equipment Listings</h2>
          <p className="eq-sub">Review equipment for sale, rentals and equipment services. Drafts are private and not shown here.</p>
        </div>
        <button className="eq-btn" onClick={() => setTick((n) => n + 1)}>Refresh</button>
      </div>

      <div className="eq-stats">
        {cards.map((c) => (
          <div key={c.label} className={`eq-stat${c.warn ? ' warn' : ''}`}>
            <p style={{ fontSize: 12, color: A.textMuted, fontWeight: 600 }}>{c.label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: A.text, margin: '4px 0' }}>{c.value}</p>
            <p style={{ fontSize: 11.5, color: c.warn ? A.amber : A.textSoft }}>{c.note}</p>
          </div>
        ))}
        {!ov && Array.from({ length: 5 }).map((_, i) => <div key={i} className="eq-stat" style={{ height: 88 }} />)}
      </div>

      <div className="eq-filters">
        <input className="eq-input" style={{ width: 280 }} placeholder="Search name, brand, place or owner" value={qInput} onChange={(e) => setQInput(e.target.value)} aria-label="Search equipment" />
        <select className="eq-input" value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} aria-label="Listing type">
          <option value="all">All types</option><option value="buy">For Sale</option><option value="rent">For Rent</option><option value="service">Services</option>
        </select>
        <select className="eq-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Status">
          <option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="paused">Unavailable</option><option value="sold">Sold</option>
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: A.text, fontWeight: 600 }}>
          <input type="checkbox" checked={reportedOnly} onChange={(e) => { setReportedOnly(e.target.checked); setPage(1) }} /> Reported only
        </label>
        {filtersActive && <button className="eq-btn sm" onClick={clearFilters}>Clear filters</button>}
      </div>

      <div className="eq-list">
        {error ? (
          <div style={{ padding: 36, textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: A.text }}>Unable to load listings</p>
            <p className="eq-sub" style={{ margin: '6px 0 14px' }}>{error}</p>
            <button className="eq-btn primary" onClick={() => setTick((n) => n + 1)}>Try again</button>
          </div>
        ) : loading ? (
          <div style={{ padding: 36, textAlign: 'center', color: A.textMuted, fontSize: 13 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: A.text }}>{filtersActive ? 'No listings match these filters' : 'No equipment listings yet'}</p>
            <p className="eq-sub" style={{ margin: '6px 0 14px' }}>{filtersActive ? 'Try removing a filter or searching for something else.' : 'Listings appear here as soon as members publish them.'}</p>
            {filtersActive && <button className="eq-btn" onClick={clearFilters}>Clear filters</button>}
          </div>
        ) : (
          <div className="eq-wrap">
            <table className="eq-table">
              <thead><tr><th>Listing</th><th>Type</th><th>Owner</th><th>Price</th><th>Location</th><th>Reports</th><th>Status</th><th>Listed</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`eq-row${r.status === 'suspended' || r.rep_open > 0 ? ' attn' : ''}`} onClick={() => openDrawer(r.id)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <Thumb src={r.image} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 700, color: A.text, maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}{r.flagged && <span style={{ color: A.amber, fontSize: 11, fontWeight: 700, marginLeft: 6 }}>⚑ Flagged</span>}</p>
                          <p style={{ fontSize: 11.5, color: A.textSoft }}>{shortId(r.id)}{r.category ? ` · ${r.category}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td><TypeChip t={r.listing_type} /></td>
                    <td style={{ color: A.text }}>{sname(r.seller_name, r.seller_username)}{r.seller_username && <span style={{ color: A.textSoft }}> @{r.seller_username}</span>}</td>
                    <td style={{ fontWeight: 700, color: A.text, whiteSpace: 'nowrap' }}>{priceText(r)}</td>
                    <td style={{ color: A.textMuted }}>{[r.city, r.state].filter(Boolean).join(', ') || '—'}</td>
                    <td>{r.rep_open > 0 ? <span style={{ color: A.amber, fontWeight: 700 }}>{r.rep_open} open</span> : <span style={{ color: A.textSoft }}>{r.rep_total > 0 ? `${r.rep_total} closed` : '—'}</span>}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={{ color: A.textMuted, whiteSpace: 'nowrap' }}>{fmtDay(r.created_at)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <button className="eq-btn sm" onClick={() => openDrawer(r.id)}>View</button>{' '}
                      {canManage && (r.status === 'suspended'
                        ? <button className="eq-btn sm" onClick={() => ask('restore', r.id, r.name)}>Restore</button>
                        : <button className="eq-btn sm" onClick={() => ask('suspend', r.id, r.name)}>Suspend</button>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!error && !loading && total > 0 && (
          <div className="eq-pager">
            <span>Showing {shownFrom}–{shownTo} of {n0(total)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <select className="eq-input" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }} aria-label="Rows per page">
                {ROWS.map((n) => <option key={n} value={n}>{n} per page</option>)}
              </select>
              <button className="eq-btn sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</button>
              <span>Page {safePage} of {totalPages}</span>
              <button className="eq-btn sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Next</button>
            </span>
          </div>
        )}
      </div>

      {drawerId && (
        <div className="eq-overlay" onClick={closeDrawer}>
          <div className="eq-drawer" role="dialog" aria-label="Equipment listing details" onClick={(e) => e.stopPropagation()}>
            <div className="eq-sec" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: A.text }}>Listing {shortId(drawerId)}</p>
              <button className="eq-btn sm" onClick={closeDrawer}>Close</button>
            </div>

            {detailError ? (
              <div className="eq-sec"><p style={{ color: A.red, fontSize: 13, marginBottom: 10 }}>{detailError}</p><button className="eq-btn" onClick={() => loadDetail(drawerId)}>Try again</button></div>
            ) : !detail || !L ? (
              <div className="eq-sec" style={{ color: A.textMuted, fontSize: 13 }}>Loading…</div>
            ) : (
              <>
                {L.images.length > 0 && (
                  <div className="eq-sec">
                    <img src={L.images[imgIdx] || L.images[0]} alt={L.name} style={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 8, border: `1px solid ${A.border}` }} />
                    {L.images.length > 1 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto' }}>
                        {L.images.map((u, i) => (
                          <button key={u} aria-label={`Photo ${i + 1}`} onClick={() => setImgIdx(i)} style={{ padding: 0, border: `2px solid ${i === imgIdx ? A.green : 'transparent'}`, borderRadius: 6, background: 'none', cursor: 'pointer' }}>
                            <img src={u} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="eq-sec">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                    <StatusBadge status={L.status} /><TypeChip t={L.listing_type} />
                    {L.flagged && <span style={{ color: A.amber, fontSize: 12, fontWeight: 700 }}>⚑ Flagged</span>}
                    {L.status === 'suspended' && <span style={{ fontSize: 11.5, color: A.textMuted }}>(owner status: {L.seller_status})</span>}
                  </div>
                  <p style={{ fontSize: 17, fontWeight: 800, color: A.text }}>{L.name}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: A.green, margin: '6px 0' }}>{priceText(L)}</p>
                  <div className="eq-kv"><span>Category</span><span>{L.category || '—'}</span></div>
                  {(L.brand || L.model) && <div className="eq-kv"><span>Brand / model</span><span>{[L.brand, L.model].filter(Boolean).join(' ')}</span></div>}
                  <div className="eq-kv"><span>Location</span><span>{place(L) || '—'}</span></div>
                  <div className="eq-kv"><span>Listed</span><span>{fmtFull(L.created_at)}</span></div>
                  <div className="eq-kv"><span>Contact</span><span>{[L.whatsapp, L.business_email].filter(Boolean).join(' · ') || '—'}</span></div>
                  {L.description && <p style={{ fontSize: 12.5, color: A.text, lineHeight: 1.6, marginTop: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{L.description}</p>}
                </div>

                <div className="eq-sec">
                  <h3>Owner</h3>
                  {detail.seller ? (
                    <>
                      <div className="eq-kv"><span>Name</span><span>{sname(detail.seller.full_name, detail.seller.username)}{detail.seller.is_verified ? ' ✓' : ''}</span></div>
                      {detail.seller.username && <div className="eq-kv"><span>Username</span><span>@{detail.seller.username}</span></div>}
                      <div className="eq-kv"><span>Account</span><span>{detail.seller.account_status}</span></div>
                      <div className="eq-kv"><span>Listings</span><span>{detail.seller.listings} total · {detail.seller.suspended} suspended</span></div>
                      {detail.seller.username && <div style={{ marginTop: 8 }}><button className="eq-btn sm" onClick={() => window.open(`/u/${detail.seller!.username}`, '_blank')}>Open public profile</button></div>}
                    </>
                  ) : <p className="eq-sub">This account no longer exists.</p>}
                  {detail.company && <div className="eq-kv" style={{ marginTop: 6 }}><span>Company</span><span>{detail.company.name} ({detail.company.status})</span></div>}
                </div>

                <div className="eq-sec">
                  <h3>Activity</h3>
                  <div className="eq-kv"><span>Saved by</span><span>{detail.activity.saves} member{detail.activity.saves === 1 ? '' : 's'}</span></div>
                  <div className="eq-kv"><span>Reports</span><span>{detail.activity.reports} total · {detail.activity.open_reports} open</span></div>
                </div>

                <div className="eq-sec">
                  <h3>Reports</h3>
                  {detail.reports.length === 0 ? <p className="eq-sub">No reports for this listing.</p> : detail.reports.map((r) => (
                    <div key={r.id} className="eq-kv" style={{ alignItems: 'center' }}>
                      <span>{r.code}</span>
                      <span style={{ flex: 1 }}>{r.reason.replace(/_/g, ' ')} · {r.status.replace(/_/g, ' ')} · {fmtDay(r.created_at)}</span>
                      {staff.permissions.has('reports.view') && <button className="eq-btn sm" onClick={() => navigate(`/admin/reports?open=${r.id}`)}>Open</button>}
                    </div>
                  ))}
                </div>

                <div className="eq-sec">
                  <h3>Moderation history</h3>
                  {detail.history.length === 0 ? <p className="eq-sub">No moderation actions yet.</p> : detail.history.map((h, i) => (
                    <div key={i} style={{ padding: '6px 0', fontSize: 12.5, borderTop: i ? `1px solid ${A.borderSoft}` : 'none' }}>
                      <p style={{ color: A.text, fontWeight: 700 }}>{h.action.replace('equipment.', '')} <span style={{ fontWeight: 400, color: A.textMuted }}>by {h.actor || 'Staff'} · {fmtFull(h.at)}</span></p>
                      {h.note && <p style={{ color: A.textMuted }}>Note: {h.note}</p>}
                    </div>
                  ))}
                </div>

                <div className="eq-sec" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: 'none' }}>
                  {!canManage ? <span style={{ fontSize: 12.5, color: A.textMuted }}>You have view-only access to equipment.</span> : (
                    <>
                      {L.status === 'suspended'
                        ? <button className="eq-btn primary" disabled={busy} onClick={() => ask('restore', L.id, L.name)}>Restore Listing</button>
                        : <button className="eq-btn" disabled={busy} onClick={() => ask('suspend', L.id, L.name)}>Suspend Listing</button>}
                      {L.flagged
                        ? <button className="eq-btn" disabled={busy} onClick={() => act(L.id, 'unflag', null, 'Flag cleared')}>Clear Flag</button>
                        : <button className="eq-btn" disabled={busy} onClick={() => act(L.id, 'flag', null, 'Flagged for review')}>Flag</button>}
                      <button className="eq-btn danger" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => ask('remove', L.id, L.name)}>Remove Listing</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirm && (
        <div className="eq-modal-wrap" onClick={() => { if (!busy) setConfirm(null) }}>
          <div className="eq-modal" role="alertdialog" aria-label={copy[confirm.kind].title} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 800, color: A.text }}>{copy[confirm.kind].title}</p>
            <p style={{ fontSize: 12.5, color: A.textMuted, margin: '2px 0 10px' }}>“{confirm.name}”</p>
            <p style={{ fontSize: 13, color: A.text, lineHeight: 1.5 }}>{copy[confirm.kind].body}</p>
            {confirm.kind !== 'restore' && (
              <>
                <label htmlFor="eq-note" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: A.text, margin: '14px 0 6px' }}>Reason (shown to the owner, optional)</label>
                <textarea id="eq-note" className="eq-input" rows={3} maxLength={500} style={{ width: '100%' }} value={note} onChange={(e) => setNote(e.target.value)} />
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="eq-btn" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              <button className={`eq-btn ${copy[confirm.kind].danger ? 'danger' : 'primary'}`} disabled={busy} onClick={runConfirm}>{busy ? 'Please wait…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="eq-toast" role="status" style={{ background: toast.err ? A.red : A.greenDark }}>{toast.text}</div>}
    </AdminLayout>
  )
}
