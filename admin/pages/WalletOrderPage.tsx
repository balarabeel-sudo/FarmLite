import { useEffect, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import { ORDER_COLUMNS, EVIDENCE_COLUMNS, STATUS_INFO, TX_LABELS } from '../../walletShared'
import type { Order, DisputeEvidence } from '../../walletShared'

const A = { surface: '#FFFFFF', border: '#E3E7E3', bg: '#F7F8F7', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', red: '#DC2626' }

type Person = { full_name: string | null; username: string | null }
type LedgerRow = {
  id: string
  user_id: string
  type: string
  available_delta: number
  held_delta: number
  created_at: string
  note: string | null
}

const ngn = (n: number) => `NGN ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function WalletOrderPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const staff = useStaff()
  const canManage = staff.permissions.has('wallet.manage')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [people, setPeople] = useState<Record<string, Person>>({})
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [evidence, setEvidence] = useState<DisputeEvidence[]>([])

  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const load = async () => {
    if (!id) return
    setError(false)
    const [orderRes, ledgerRes, evidenceRes] = await Promise.all([
      supabase.from('orders').select(ORDER_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('wallet_transactions').select('id, user_id, type, available_delta, held_delta, created_at, note').eq('order_id', id).order('created_at', { ascending: true }),
      supabase.from('order_dispute_evidence').select(EVIDENCE_COLUMNS).eq('order_id', id).order('created_at', { ascending: true }),
    ])
    if (orderRes.error || ledgerRes.error || evidenceRes.error) { setError(true); setLoading(false); return }
    if (!orderRes.data) { setNotFound(true); setLoading(false); return }

    const o = orderRes.data as any
    const parsed: Order = { ...o, quantity: Number(o.quantity), unit_price: Number(o.unit_price), amount: Number(o.amount) }
    setOrder(parsed)
    setEvidence((evidenceRes.data || []) as DisputeEvidence[])
    setLedger((ledgerRes.data || []).map((t: any) => ({ ...t, available_delta: Number(t.available_delta), held_delta: Number(t.held_delta) })))

    const { data } = await supabase.from('profiles').select('user_id, full_name, username').in('user_id', [parsed.buyer_id, parsed.seller_id])
    const map: Record<string, Person> = {}
    for (const p of (data || []) as any[]) map[p.user_id] = { full_name: p.full_name, username: p.username }
    setPeople(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const nameOf = (uid: string) => {
    const p = people[uid]
    if (!p) return 'Unknown user'
    return p.full_name || p.username || 'Unknown user'
  }

  const resolve = async (action: 'release' | 'refund') => {
    if (!order) return
    if (!note.trim()) { setMessage({ type: 'error', text: 'A note is required. It is recorded with the decision.' }); return }
    const who = action === 'release' ? `release NGN ${order.amount.toLocaleString()} to the seller (${nameOf(order.seller_id)})` : `refund NGN ${order.amount.toLocaleString()} to the buyer (${nameOf(order.buyer_id)})`
    if (!window.confirm(`Are you sure you want to ${who}? This cannot be undone.`)) return

    setBusy(true)
    setMessage(null)
    const { error: rpcError } = await supabase.rpc('admin_resolve_dispute', { p_order_id: order.id, p_action: action, p_note: note.trim() })
    if (rpcError) {
      setMessage({ type: 'error', text: rpcError.message })
    } else {
      setMessage({ type: 'ok', text: action === 'release' ? 'Payment released to the seller.' : 'Buyer refunded.' })
      setNote('')
      await load()
    }
    setBusy(false)
  }

  const back = (
    <span onClick={() => navigate('/admin/wallet')} style={{ fontSize: '12.5px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>
      Back to orders
    </span>
  )

  if (loading) return <AdminLayout title="Order"><p style={{ fontSize: '13px', color: A.textMuted }}>Loading...</p></AdminLayout>
  if (error) return <AdminLayout title="Order"><p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '10px' }}>Could not load this order.</p><span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span></AdminLayout>
  if (notFound || !order) return <AdminLayout title="Order"><p style={{ fontSize: '13px', color: A.text, marginBottom: '10px' }}>Order not found.</p>{back}</AdminLayout>

  const st = STATUS_INFO[order.status]

  return (
    <AdminLayout title={`Order ${order.code}`}>
      <div style={{ marginBottom: '16px' }}>{back}</div>

      {message && (
        <div onClick={() => setMessage(null)} style={{
          padding: '11px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          background: message.type === 'ok' ? '#DCFCE7' : '#FEE2E2', color: message.type === 'ok' ? '#166534' : '#B91C1C',
        }}>{message.text}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
        <Panel title="Order">
          <Field label="Status"><span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: st.bg, color: st.color }}>{st.label}</span></Field>
          <Field label="Item">{order.listing_title || '-'}</Field>
          <Field label="Amount"><strong>{ngn(order.amount)}</strong></Field>
          <Field label="Quantity">{order.quantity.toLocaleString()} x {ngn(order.unit_price)}</Field>
          <Field label="Code">{order.code}</Field>
          <Field label="Ordered">{new Date(order.created_at).toLocaleString()}</Field>
          {order.completed_at && <Field label="Completed">{new Date(order.completed_at).toLocaleString()}</Field>}
        </Panel>

        <Panel title="Parties">
          <Field label="Buyer">{nameOf(order.buyer_id)}{people[order.buyer_id]?.username ? ` (@${people[order.buyer_id].username})` : ''}</Field>
          <Field label="Seller">{nameOf(order.seller_id)}{people[order.seller_id]?.username ? ` (@${people[order.seller_id].username})` : ''}</Field>
        </Panel>
      </div>

      {order.dispute_reason && (
        <>
        <Panel title="Dispute" style={{ marginTop: '16px' }}>
          {order.disputed_by && (
            <p style={{ fontSize: '12px', color: A.textMuted, marginBottom: '6px' }}>
              Opened by {nameOf(order.disputed_by)} ({order.disputed_by === order.buyer_id ? 'buyer' : 'seller'})
            </p>
          )}
          <p style={{ fontSize: '13px', color: A.text, lineHeight: 1.6 }}>{order.dispute_reason}</p>
        </Panel>

        <Panel title={`Evidence (${evidence.length})`} style={{ marginTop: '16px' }}>
          {evidence.length === 0 ? (
            <p style={{ fontSize: '12.5px', color: A.textMuted }}>No notes or photos were added by either side.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {evidence.map((ev) => (
                <div key={ev.id} style={{ borderBottom: `1px solid ${A.border}`, paddingBottom: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: A.text }}>
                    {nameOf(ev.user_id)} <span style={{ fontWeight: 500, color: A.textMuted }}>
                      ({ev.user_id === order.buyer_id ? 'buyer' : 'seller'}) · {new Date(ev.created_at).toLocaleString()}
                    </span>
                  </p>
                  {ev.note && <p style={{ fontSize: '13px', color: A.text, marginTop: '4px', lineHeight: 1.6 }}>{ev.note}</p>}
                  {ev.images.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {ev.images.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="Evidence" style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${A.border}`, display: 'block' }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
        </>
      )}

      {order.resolution_note && (
        <Panel title="Resolution note" style={{ marginTop: '16px' }}>
          <p style={{ fontSize: '13px', color: A.text, lineHeight: 1.6 }}>{order.resolution_note}</p>
        </Panel>
      )}

      {order.status === 'disputed' && (
        <Panel title="Resolve dispute" style={{ marginTop: '16px' }}>
          {canManage ? (
            <>
              <p style={{ fontSize: '12.5px', color: A.textMuted, marginBottom: '10px', lineHeight: 1.5 }}>
                The money is held. Releasing pays the seller; refunding returns it to the buyer's wallet. Your note is saved with the decision and in the audit log.
              </p>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Reason for your decision (required)"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${A.border}`, fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button disabled={busy} onClick={() => resolve('release')} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: A.green, color: 'white', fontSize: '13px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  Release to seller
                </button>
                <button disabled={busy} onClick={() => resolve('refund')} style={{ padding: '10px 18px', borderRadius: '8px', border: `1px solid ${A.red}`, background: A.surface, color: A.red, fontSize: '13px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  Refund buyer
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: '12.5px', color: A.textMuted }}>You can view this dispute but do not have permission to resolve it.</p>
          )}
        </Panel>
      )}

      <Panel title="Ledger entries for this order" style={{ marginTop: '16px' }} flush>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '560px' }}>
            <thead>
              <tr style={{ background: A.bg, textAlign: 'left' }}>
                {['Time', 'Wallet of', 'Type', 'Available', 'Held'].map((h) => (
                  <th key={h} style={{ padding: '9px 14px', fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: `1px solid ${A.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '14px', color: A.textMuted }}>No entries.</td></tr>
              ) : ledger.map((t) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${A.border}` }}>
                  <td style={{ padding: '10px 14px', color: A.textMuted, whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', color: A.text }}>{nameOf(t.user_id)}</td>
                  <td style={{ padding: '10px 14px', color: A.text }}>{TX_LABELS[t.type] || t.type}</td>
                  <Delta value={t.available_delta} />
                  <Delta value={t.held_delta} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AdminLayout>
  )
}

function Delta({ value }: { value: number }) {
  const color = value > 0 ? '#166534' : value < 0 ? '#B91C1C' : A.textMuted
  return <td style={{ padding: '10px 14px', fontWeight: 700, color, whiteSpace: 'nowrap' }}>{value === 0 ? '-' : `${value > 0 ? '+' : ''}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</td>
}

function Panel({ title, children, style, flush }: { title: string; children: ReactNode; style?: CSSProperties; flush?: boolean }) {
  return (
    <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', ...style }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', padding: '12px 16px', borderBottom: `1px solid ${A.border}` }}>{title}</p>
      <div style={flush ? undefined : { padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '6px 0', fontSize: '13px' }}>
      <span style={{ color: A.textMuted }}>{label}</span>
      <span style={{ color: A.text, textAlign: 'right' }}>{children}</span>
    </div>
  )
}
