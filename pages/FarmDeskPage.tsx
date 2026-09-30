import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../AuthContext'
import AdminLayout from '../AdminLayout'
import { STATUS_META, fmtDate, timeAgo, quantityText } from '../../farmDeskShared'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', bg: '#F5F7F5' }
const PAGE = 25

const STATUS_ORDER = ['new', 'reviewing', 'sourcing', 'options_found', 'quotation_ready', 'customer_review', 'confirmed', 'in_progress', 'completed', 'cancelled', 'unable_to_source']
const ACTIVE = ['new', 'reviewing', 'sourcing', 'options_found', 'quotation_ready', 'customer_review', 'confirmed', 'in_progress']

type Row = {
  id: string
  request_code: string
  title: string
  quantity: number | null
  unit: string | null
  source_scope: string
  source_location: string | null
  dest_city: string | null
  dest_state: string | null
  dest_country: string | null
  status: string
  assigned_staff_id: string | null
  created_at: string
  updated_at: string
  customer: { full_name: string | null; username: string | null } | null
}

type StaffMember = { id: string; user_id: string; full_name: string; role_name: string }

type Analytics = {
  total: number
  by_status: Record<string, number>
  avg_resolution_hours: number | null
  top_products: { name: string; count: number }[]
  top_locations: { name: string; count: number }[]
  volume: { day: string; count: number }[]
}

const SELECT = 'id, request_code, title, quantity, unit, source_scope, source_location, dest_city, dest_state, dest_country, status, assigned_staff_id, created_at, updated_at, customer:profiles!farm_desk_requests_customer_id_fkey(full_name, username)'

export default function AdminFarmDeskPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(false)

  const [status, setStatus] = useState('all')
  const [assigned, setAssigned] = useState('all') // all | unassigned | mine | <staff id>
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [showInsights, setShowInsights] = useState(false)

  const myStaffId = staffList.find((s) => s.user_id === user?.id)?.id || null

  // Debounce search typing.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const loadMeta = async () => {
    const [s, a] = await Promise.all([
      supabase.rpc('farm_desk_assignable_staff'),
      supabase.rpc('farm_desk_analytics'),
    ])
    if (!s.error) setStaffList((s.data || []) as any)
    if (!a.error) setAnalytics(a.data as any)
  }

  const buildQuery = async (from: number) => {
    let q = supabase.from('farm_desk_requests').select(SELECT).order('created_at', { ascending: false }).range(from, from + PAGE - 1)
    if (status !== 'all') q = q.eq('status', status)
    if (assigned === 'unassigned') q = q.is('assigned_staff_id', null)
    else if (assigned === 'mine') q = q.eq('assigned_staff_id', myStaffId || '00000000-0000-0000-0000-000000000000')
    else if (assigned !== 'all') q = q.eq('assigned_staff_id', assigned)

    if (search) {
      const term = search.replace(/[%,()*\\]/g, ' ').trim()
      if (term) {
        // Also match customers by name/username.
        const { data: people } = await supabase
          .from('profiles')
          .select('user_id')
          .or(`full_name.ilike.%${term}%,username.ilike.%${term}%`)
          .limit(30)
        const ids = (people || []).map((p: any) => p.user_id)
        const parts = [
          `request_code.ilike.%${term}%`,
          `title.ilike.%${term}%`,
          `dest_city.ilike.%${term}%`,
          `source_location.ilike.%${term}%`,
        ]
        if (ids.length) parts.push(`customer_id.in.(${ids.join(',')})`)
        q = q.or(parts.join(','))
      }
    }
    return q
  }

  const load = async () => {
    setError(false)
    setLoading(true)
    const q = await buildQuery(0)
    const { data, error: err } = await q
    if (err) {
      setError(true)
      setLoading(false)
      return
    }
    setRows((data || []) as any)
    setHasMore((data?.length || 0) === PAGE)
    setLoading(false)
  }

  const loadMore = async () => {
    setLoadingMore(true)
    const q = await buildQuery(rows.length)
    const { data, error: err } = await q
    if (!err && data) {
      setRows((prev) => [...prev, ...(data as any)])
      setHasMore(data.length === PAGE)
    }
    setLoadingMore(false)
  }

  useEffect(() => { loadMeta() }, [])
  useEffect(() => { load() }, [status, assigned, search, myStaffId])

  const staffName = (id: string | null) => (id ? staffList.find((s) => s.id === id)?.full_name || 'Assigned' : null)
  const by = analytics?.by_status || {}
  const count = (keys: string[]) => keys.reduce((n, k) => n + (by[k] || 0), 0)

  const maxVol = Math.max(1, ...(analytics?.volume || []).map((v) => v.count))

  return (
    <AdminLayout title="Farm Desk">
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <Kpi label="Total requests" value={analytics?.total ?? '-'} />
        <Kpi label="New" value={analytics ? by.new || 0 : '-'} highlight={(by.new || 0) > 0} />
        <Kpi label="Active" value={analytics ? count(ACTIVE) : '-'} />
        <Kpi label="Completed" value={analytics ? by.completed || 0 : '-'} />
        <Kpi label="Cancelled" value={analytics ? by.cancelled || 0 : '-'} />
        <Kpi label="Unable to source" value={analytics ? by.unable_to_source || 0 : '-'} />
        <Kpi
          label="Avg. resolution"
          value={analytics?.avg_resolution_hours == null ? '-' : analytics.avg_resolution_hours >= 48 ? `${(analytics.avg_resolution_hours / 24).toFixed(1)} d` : `${analytics.avg_resolution_hours} h`}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <span onClick={() => setShowInsights((v) => !v)} style={{ fontSize: '12.5px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>
          {showInsights ? 'Hide insights' : 'Show insights'}
        </span>
      </div>

      {showInsights && analytics && (
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <Panel title="Most requested products">
            <RankList items={analytics.top_products} />
          </Panel>
          <Panel title="Most requested destinations">
            <RankList items={analytics.top_locations} />
          </Panel>
          <Panel title="Requests, last 30 days" wide>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '90px' }}>
              {analytics.volume.map((v) => (
                <div key={v.day} title={`${v.day}: ${v.count}`} style={{ flex: 1, background: v.count ? A.green : '#E5E7EB', height: `${Math.max(4, (v.count / maxVol) * 100)}%`, borderRadius: '2px' }} />
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Status filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <FilterChip active={status === 'all'} onClick={() => setStatus('all')}>All{analytics ? ` (${analytics.total})` : ''}</FilterChip>
        {STATUS_ORDER.map((s) => (
          <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
            {STATUS_META[s].label}{analytics ? ` (${by[s] || 0})` : ''}
          </FilterChip>
        ))}
      </div>

      {/* Search + assignment filter */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search request ID, customer, product or location"
          style={{ flex: '1 1 280px', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${A.border}`, fontSize: '13px', outline: 'none', background: A.surface }}
        />
        <select
          value={assigned}
          onChange={(e) => setAssigned(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${A.border}`, fontSize: '13px', background: A.surface, minWidth: '190px' }}>
          <option value="all">All staff</option>
          <option value="unassigned">Unassigned</option>
          <option value="mine">Assigned to me</option>
          {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>

      {/* Table */}
      {error ? (
        <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '8px' }}>Could not load Farm Desk requests.</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
        </div>
      ) : (
        <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '1000px' }}>
            <thead>
              <tr style={{ background: A.bg, textAlign: 'left' }}>
                {['Request ID', 'Customer', 'Product', 'Quantity', 'Source', 'Destination', 'Assigned to', 'Status', 'Created', 'Updated'].map((h) => (
                  <th key={h} style={{ padding: '11px 12px', fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding: '28px', textAlign: 'center', color: A.textMuted }}>Loading requests...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: '28px', textAlign: 'center', color: A.textMuted }}>No requests match these filters.</td></tr>
              ) : (
                rows.map((r) => {
                  const meta = STATUS_META[r.status] || STATUS_META.new
                  const assignee = staffName(r.assigned_staff_id)
                  return (
                    <tr key={r.id} onClick={() => navigate(`/admin/farm-desk/${r.id}`)} style={{ borderTop: `1px solid ${A.border}`, cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFCFA')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px', fontWeight: 700, color: A.green, whiteSpace: 'nowrap' }}>{r.request_code}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600, color: A.text }}>{r.customer?.full_name || 'Unknown'}</div>
                        {r.customer?.username && <div style={{ fontSize: '11px', color: A.textMuted }}>@{r.customer.username}</div>}
                      </td>
                      <td style={{ padding: '12px', color: A.text, fontWeight: 600 }}>{r.title}</td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{quantityText(r)}</td>
                      <td style={{ padding: '12px' }}>{r.source_scope === 'anywhere' || !r.source_location ? 'Anywhere' : r.source_location}</td>
                      <td style={{ padding: '12px' }}>{[r.dest_city, r.dest_country].filter(Boolean).join(', ') || '-'}</td>
                      <td style={{ padding: '12px', color: assignee ? A.text : A.textMuted }}>{assignee || 'Unassigned'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, background: meta.bg, color: meta.fg, padding: '3px 9px', borderRadius: '10px', whiteSpace: 'nowrap' }}>{meta.label}</span>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap', color: A.textMuted }}>{fmtDate(r.created_at)}</td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap', color: A.textMuted }}>{timeAgo(r.updated_at)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <span onClick={loadingMore ? undefined : loadMore} style={{ display: 'inline-block', padding: '9px 22px', borderRadius: '8px', border: `1px solid ${A.border}`, background: A.surface, fontSize: '13px', fontWeight: 700, color: A.text, cursor: 'pointer' }}>
            {loadingMore ? 'Loading...' : 'Load more'}
          </span>
        </div>
      )}
    </AdminLayout>
  )
}

function Kpi({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? '#FEF3C7' : A.surface, border: `1px solid ${highlight ? '#FDE68A' : A.border}`, borderRadius: '10px', padding: '14px 16px' }}>
      <p style={{ fontSize: '21px', fontWeight: 800, color: highlight ? '#B45309' : A.text }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p style={{ fontSize: '11.5px', color: A.textMuted, marginTop: '3px' }}>{label}</p>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <span onClick={onClick} style={{ padding: '7px 13px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: `1px solid ${active ? A.green : A.border}`, background: active ? '#DCFCE7' : A.surface, color: active ? '#14532D' : A.textMuted }}>
      {children}
    </span>
  )
}

function Panel({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '14px 16px', flex: wide ? '2 1 360px' : '1 1 240px' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: A.text, marginBottom: '10px' }}>{title}</p>
      {children}
    </div>
  )
}

function RankList({ items }: { items: { name: string; count: number }[] }) {
  if (items.length === 0) return <p style={{ fontSize: '12px', color: A.textMuted }}>No data yet.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((i) => (
        <div key={i.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12.5px' }}>
          <span style={{ color: A.text, textTransform: 'capitalize' }}>{i.name}</span>
          <span style={{ fontWeight: 700, color: A.textMuted }}>{i.count}</span>
        </div>
      ))}
    </div>
  )
}
