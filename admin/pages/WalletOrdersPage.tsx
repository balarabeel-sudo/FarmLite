import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { ORDER_COLUMNS, STATUS_INFO } from '../../walletShared'
import type { Order, OrderStatus } from '../../walletShared'

const A = { surface: '#FFFFFF', border: '#E3E7E3', bg: '#F7F8F7', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280' }

type Person = { full_name: string | null; username: string | null }
type Filter = 'all' | OrderStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'disputed', label: 'Disputes' },
  { value: 'escrow_held', label: 'In escrow' },
  { value: 'completed', label: 'Completed' },
  { value: 'refunded', label: 'Refunded' },
]

const ngn = (n: number) => `NGN ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function WalletOrdersPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [people, setPeople] = useState<Record<string, Person>>({})
  const [heldTotal, setHeldTotal] = useState(0)
  const [disputeCount, setDisputeCount] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const load = async () => {
    setError(false)
    setLoading(true)
    const [listRes, heldRes, disputeRes] = await Promise.all([
      supabase.from('orders').select(ORDER_COLUMNS).order('created_at', { ascending: false }).limit(200),
      supabase.from('orders').select('amount').in('status', ['escrow_held', 'disputed']).limit(5000),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'disputed'),
    ])
    if (listRes.error || heldRes.error || disputeRes.error) {
      setError(true)
      setLoading(false)
      return
    }
    const list = (listRes.data || []).map((o: any) => ({ ...o, quantity: Number(o.quantity), unit_price: Number(o.unit_price), amount: Number(o.amount) })) as Order[]
    setOrders(list)
    setHeldTotal((heldRes.data || []).reduce((s: number, o: any) => s + Number(o.amount), 0))
    setDisputeCount(disputeRes.count || 0)

    const ids = Array.from(new Set(list.flatMap((o) => [o.buyer_id, o.seller_id])))
    if (ids.length) {
      const { data } = await supabase.from('profiles').select('user_id, full_name, username').in('user_id', ids)
      const map: Record<string, Person> = {}
      for (const p of (data || []) as any[]) map[p.user_id] = { full_name: p.full_name, username: p.username }
      setPeople(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const nameOf = (id: string) => people[id]?.full_name || people[id]?.username || 'Unknown'

  const visible = useMemo(() => {
    const term = search.trim().toUpperCase()
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false
      if (!term) return true
      return o.code.includes(term) || (o.listing_title || '').toUpperCase().includes(term)
    })
  }, [orders, filter, search])

  return (
    <AdminLayout title="Wallet & Escrow">
      {error ? (
        <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '10px' }}>Could not load orders. You may not have permission to view them.</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <Kpi label="Held in escrow (incl. disputes)" value={loading ? '...' : ngn(heldTotal)} />
            <Kpi label="Open disputes" value={loading ? '...' : String(disputeCount)} alert={disputeCount > 0} onClick={() => setFilter('disputed')} />
            <Kpi label="Orders loaded (latest 200)" value={loading ? '...' : String(orders.length)} />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
            {FILTERS.map((f) => {
              const active = filter === f.value
              return (
                <span key={f.value} onClick={() => setFilter(f.value)} style={{
                  padding: '6px 13px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  background: active ? A.green : A.surface, color: active ? 'white' : A.text, border: `1px solid ${active ? A.green : A.border}`,
                }}>
                  {f.label}
                </span>
              )
            })}
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or item"
              style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${A.border}`, fontSize: '12.5px', minWidth: '200px', background: A.surface }}
            />
          </div>

          <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '760px' }}>
              <thead>
                <tr style={{ background: A.bg, textAlign: 'left' }}>
                  {['Code', 'Item', 'Buyer', 'Seller', 'Amount', 'Status', 'Date'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: `1px solid ${A.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: '18px 14px', color: A.textMuted }}>Loading orders...</td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '18px 14px', color: A.textMuted }}>No orders match.</td></tr>
                ) : (
                  visible.map((o) => {
                    const st = STATUS_INFO[o.status]
                    return (
                      <tr key={o.id} onClick={() => navigate(`/admin/wallet/${o.id}`)} style={{ cursor: 'pointer', borderBottom: `1px solid ${A.border}` }}>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: A.text, whiteSpace: 'nowrap' }}>{o.code}</td>
                        <td style={{ padding: '11px 14px', color: A.text, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.listing_title || '-'}</td>
                        <td style={{ padding: '11px 14px', color: A.text }}>{nameOf(o.buyer_id)}</td>
                        <td style={{ padding: '11px 14px', color: A.text }}>{nameOf(o.seller_id)}</td>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: A.text, whiteSpace: 'nowrap' }}>{ngn(o.amount)}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '11px 14px', color: A.textMuted, whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  )
}

function Kpi({ label, value, alert, onClick }: { label: string; value: string; alert?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: alert ? '#FEF2F2' : A.surface, border: `1px solid ${alert ? '#FECACA' : A.border}`, borderRadius: '10px', padding: '16px',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <p style={{ fontSize: '20px', fontWeight: 800, color: alert ? '#B91C1C' : A.text }}>{value}</p>
      <p style={{ fontSize: '12px', color: A.textMuted, marginTop: '4px' }}>{label}</p>
    </div>
  )
}
