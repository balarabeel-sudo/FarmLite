import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import NetworkError from '../NetworkError'
import { COLORS } from '../shared'
import { ORDER_COLUMNS, STATUS_INFO, useMoney } from '../walletShared'
import type { Order } from '../walletShared'

type Tab = 'buying' | 'selling'

export default function OrdersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const money = useMoney()

  const [tab, setTab] = useState<Tab>('buying')
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)
    const col = tab === 'buying' ? 'buyer_id' : 'seller_id'
    const { data, error } = await supabase
      .from('orders').select(ORDER_COLUMNS).eq(col, user.id).order('created_at', { ascending: false }).limit(50)
    if (error) {
      setNetError(true)
      setLoading(false)
      return
    }
    setOrders((data || []).map((o: any) => ({ ...o, quantity: Number(o.quantity), unit_price: Number(o.unit_price), amount: Number(o.amount) })))
    setLoading(false)
  }

  useEffect(() => { load() }, [user, tab])

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate(-1)} />

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <TabButton label="My purchases" active={tab === 'buying'} onClick={() => setTab('buying')} />
          <TabButton label="My sales" active={tab === 'selling'} onClick={() => setTab('selling')} />
        </div>

        {netError ? (
          <NetworkError onRetry={load} />
        ) : loading ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, padding: '12px 4px' }}>Loading...</p>
        ) : orders.length === 0 ? (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '28px 16px', textAlign: 'center' }}>
            <Icon name="package" size={30} color={COLORS.textMuted} />
            <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginTop: '10px' }}>
              {tab === 'buying' ? 'No purchases yet' : 'No sales yet'}
            </p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '4px' }}>
              {tab === 'buying' ? 'Orders you place with escrow will appear here.' : 'Orders from buyers will appear here.'}
            </p>
            {tab === 'buying' && (
              <div onClick={() => navigate('/marketplace')} style={{ display: 'inline-block', marginTop: '14px', padding: '10px 18px', borderRadius: '10px', background: COLORS.green, color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
                Browse Marketplace
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {orders.map((o) => {
              const st = STATUS_INFO[o.status]
              return (
                <div key={o.id} onClick={() => navigate(`/orders/${o.id}`)} style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, flex: 1 }}>{o.listing_title || 'Order'}</p>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                      {st.label}
                    </span>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.green, marginTop: '6px' }}>{money.format(o.amount)}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>
                    {o.code} · {new Date(o.created_at).toLocaleDateString()}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
      background: active ? COLORS.green : COLORS.card, color: active ? 'white' : COLORS.text,
      border: `1px solid ${active ? COLORS.green : COLORS.border}`,
    }}>
      {label}
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Orders</p>
    </div>
  )
}
