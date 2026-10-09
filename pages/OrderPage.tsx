import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import NetworkError from '../NetworkError'
import ImageUploader from '../ImageUploader'
import { COLORS } from '../shared'
import {
  ORDER_COLUMNS, EVIDENCE_COLUMNS, MAX_EVIDENCE_PHOTOS, STATUS_INFO, useMoney, verifyOrderCode, verifyErrorMessage,
  openOrderDispute, addDisputeEvidence,
} from '../walletShared'
import type { Order, DisputeEvidence } from '../walletShared'

type Person = { full_name: string | null; username: string | null }

export default function OrderPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()
  const money = useMoney()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [other, setOther] = useState<Person | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState('')
  const [reason, setReason] = useState('')
  const [reasonPhotos, setReasonPhotos] = useState<string[]>([])
  const [evidence, setEvidence] = useState<DisputeEvidence[]>([])
  const [evNote, setEvNote] = useState('')
  const [evPhotos, setEvPhotos] = useState<string[]>([])
  const [showEvidenceForm, setShowEvidenceForm] = useState(false)
  const [showDispute, setShowDispute] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const load = async () => {
    if (!user || !id) return
    setNetError(false)
    const { data, error } = await supabase.from('orders').select(ORDER_COLUMNS).eq('id', id).maybeSingle()
    if (error) { setNetError(true); setLoading(false); return }
    if (!data) { setNotFound(true); setLoading(false); return }
    const o = { ...(data as any), quantity: Number((data as any).quantity), unit_price: Number((data as any).unit_price), amount: Number((data as any).amount) } as Order
    setOrder(o)
    if (o.status === 'disputed' || o.dispute_reason) {
      const { data: ev } = await supabase.from('order_dispute_evidence').select(EVIDENCE_COLUMNS).eq('order_id', o.id).order('created_at', { ascending: true })
      setEvidence((ev || []) as DisputeEvidence[])
    }
    const otherId = o.buyer_id === user.id ? o.seller_id : o.buyer_id
    const { data: p } = await supabase.from('profiles').select('full_name, username').eq('user_id', otherId).maybeSingle()
    setOther((p as Person) || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [user, id])

  const isBuyer = !!order && order.buyer_id === user?.id
  const isSeller = !!order && order.seller_id === user?.id

  const copyCode = async () => {
    if (!order) return
    try {
      await navigator.clipboard.writeText(order.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable */ }
  }

  const submitCode = async () => {
    if (!code.trim()) { setMessage({ type: 'error', text: 'Enter the code from the buyer.' }); return }
    setBusy(true)
    setMessage(null)
    try {
      const res = await verifyOrderCode(code)
      if (res.ok) {
        setMessage({ type: 'ok', text: `Payment of ${money.formatNgn(res.amount || 0)} has been added to your wallet.` })
        setCode('')
        await load()
      } else {
        setMessage({ type: 'error', text: verifyErrorMessage(res.error) })
      }
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message })
    }
    setBusy(false)
  }

  const submitDispute = async () => {
    if (!order) return
    if (!reason.trim()) { setMessage({ type: 'error', text: 'Please describe the problem.' }); return }
    setBusy(true)
    setMessage(null)
    try {
      await openOrderDispute(order.id, reason.trim(), reasonPhotos)
      setShowDispute(false)
      setReason('')
      setReasonPhotos([])
      setMessage({ type: 'ok', text: 'Dispute opened. Farmxie staff will review it.' })
      await load()
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message })
    }
    setBusy(false)
  }

  const submitEvidence = async () => {
    if (!order) return
    if (!evNote.trim() && evPhotos.length === 0) { setMessage({ type: 'error', text: 'Add a note or at least one photo.' }); return }
    setBusy(true)
    setMessage(null)
    try {
      await addDisputeEvidence(order.id, evNote.trim(), evPhotos)
      setEvNote('')
      setEvPhotos([])
      setShowEvidenceForm(false)
      setMessage({ type: 'ok', text: 'Evidence added. Farmxie staff have been notified.' })
      await load()
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message })
    }
    setBusy(false)
  }

  if (netError) {
    return (
      <Shell onBack={() => navigate(-1)}>
        <NetworkError onRetry={load} />
      </Shell>
    )
  }

  if (loading) return <Shell onBack={() => navigate(-1)}><p style={{ padding: '16px', fontSize: '12.5px', color: COLORS.textMuted }}>Loading...</p></Shell>
  if (notFound || !order) return <Shell onBack={() => navigate(-1)}><p style={{ padding: '16px', fontSize: '13px', color: COLORS.text }}>Order not found.</p></Shell>

  const st = STATUS_INFO[order.status]
  const otherName = other?.full_name || other?.username || (isBuyer ? 'Seller' : 'Buyer')

  return (
    <Shell onBack={() => navigate(-1)}>
      <div style={{ padding: '16px' }}>
        {message && (
          <div onClick={() => setMessage(null)} style={{
            padding: '11px 13px', borderRadius: '10px', marginBottom: '12px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
            background: message.type === 'ok' ? '#DCFCE7' : '#FEE2E2', color: message.type === 'ok' ? '#166534' : '#B91C1C',
          }}>{message.text}</div>
        )}

        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, flex: 1 }}>{order.listing_title || 'Order'}</p>
            <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
          </div>
          <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.green, marginTop: '8px' }}>{money.format(order.amount)}</p>
          {money.isForeign && <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '2px' }}>Charged as {money.formatNgn(order.amount)}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '14px' }}>
            <Line label={isBuyer ? 'Seller' : 'Buyer'} value={otherName} />
            <Line label="Quantity" value={`${order.quantity.toLocaleString()} x ${money.formatNgn(order.unit_price)}`} />
            <Line label="Ordered" value={new Date(order.created_at).toLocaleString()} />
            {order.completed_at && <Line label="Completed" value={new Date(order.completed_at).toLocaleString()} />}
            <Line label="Order code" value={isSeller ? 'Held by the buyer' : order.code} />
          </div>
        </div>

        {/* Buyer: the release code */}
        {isBuyer && order.status === 'escrow_held' && (
          <div style={{ background: '#F0FDF4', border: `1px solid ${COLORS.green}`, borderRadius: '16px', padding: '16px', marginTop: '14px', textAlign: 'center' }}>
            <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted }}>Your release code</p>
            <p style={{ fontSize: '26px', fontWeight: 800, color: COLORS.text, letterSpacing: '1.5px', marginTop: '6px' }}>{order.code}</p>
            <div onClick={copyCode} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px', fontWeight: 700, color: COLORS.green, cursor: 'pointer' }}>
              <Icon name={copied ? 'check' : 'copy'} size={14} color={COLORS.green} /> {copied ? 'Copied' : 'Copy code'}
            </div>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '10px', lineHeight: 1.5 }}>
              Your money is held safely. Give this code to the seller only after you have received your goods. Once the seller enters it, the payment is released.
            </p>
          </div>
        )}

        {/* Seller: enter the buyer's code */}
        {isSeller && order.status === 'escrow_held' && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginTop: '14px' }}>
            <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>Received the buyer's code?</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '4px 0 10px', lineHeight: 1.5 }}>
              The buyer's payment is held in escrow. After delivery, enter the code to receive it.
            </p>
            <input
              placeholder="QR-00000000" value={code} autoCapitalize="characters" onChange={(e) => setCode(e.target.value)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '14px', fontWeight: 700, letterSpacing: '1px', boxSizing: 'border-box', background: COLORS.bg }}
            />
            <div onClick={busy ? undefined : submitCode} style={{ textAlign: 'center', padding: '12px', borderRadius: '10px', background: COLORS.green, color: 'white', fontSize: '13px', fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Verifying...' : 'Verify and receive payment'}
            </div>
          </div>
        )}

        {order.status === 'disputed' && (
          <div style={{ background: '#FEF2F2', borderRadius: '16px', padding: '16px', marginTop: '14px' }}>
            <p style={{ fontSize: '13px', fontWeight: 800, color: '#B91C1C' }}>Under review</p>
            <p style={{ fontSize: '12px', color: COLORS.text, marginTop: '6px', lineHeight: 1.5 }}>{order.dispute_reason}</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '8px' }}>The money stays held until Farmxie staff decide.</p>
          </div>
        )}

        {order.status === 'disputed' && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginTop: '14px' }}>
            <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>Evidence</p>
            {evidence.length === 0 ? (
              <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '6px' }}>No evidence added yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                {evidence.map((ev) => (
                  <div key={ev.id} style={{ background: COLORS.bg, borderRadius: '12px', padding: '10px 12px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted }}>
                      {ev.user_id === user?.id ? 'You' : otherName} · {new Date(ev.created_at).toLocaleString()}
                    </p>
                    {ev.note && <p style={{ fontSize: '12.5px', color: COLORS.text, marginTop: '4px', lineHeight: 1.5 }}>{ev.note}</p>}
                    {ev.images.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {ev.images.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!showEvidenceForm ? (
              <div onClick={() => setShowEvidenceForm(true)} style={{ marginTop: '12px', textAlign: 'center', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.green}`, color: COLORS.green, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
                Add evidence
              </div>
            ) : (
              <div style={{ marginTop: '12px' }}>
                <textarea
                  value={evNote} onChange={(e) => setEvNote(e.target.value)} rows={3} placeholder="Add details (optional if you add photos)"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '8px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg, fontFamily: 'inherit' }}
                />
                <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Photos (up to {MAX_EVIDENCE_PHOTOS})</p>
                <div style={{ marginBottom: '12px' }}>
                  <ImageUploader value={evPhotos} onChange={setEvPhotos} folder="disputes" max={MAX_EVIDENCE_PHOTOS} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div onClick={() => { setShowEvidenceForm(false); setEvNote(''); setEvPhotos([]) }} style={{ flex: 1, textAlign: 'center', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>Cancel</div>
                  <div onClick={busy ? undefined : submitEvidence} style={{ flex: 1, textAlign: 'center', padding: '11px', borderRadius: '10px', background: COLORS.green, color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    {busy ? 'Sending...' : 'Submit'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {(order.status === 'completed' || order.status === 'refunded') && order.resolution_note && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginTop: '14px' }}>
            <p style={{ fontSize: '12px', fontWeight: 800, color: COLORS.text }}>Staff note</p>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '4px', lineHeight: 1.5 }}>{order.resolution_note}</p>
          </div>
        )}

        {order.status === 'escrow_held' && (
          <div style={{ marginTop: '14px' }}>
            {!showDispute ? (
              <div onClick={() => setShowDispute(true)} style={{ textAlign: 'center', padding: '12px', borderRadius: '10px', border: '1px solid #FCA5A5', color: '#B91C1C', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', background: COLORS.card }}>
                Report a problem
              </div>
            ) : (
              <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>What went wrong?</p>
                <textarea
                  value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Describe the problem"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, margin: '8px 0', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg, fontFamily: 'inherit' }}
                />
                <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Photos (optional, up to {MAX_EVIDENCE_PHOTOS})</p>
                <div style={{ marginBottom: '12px' }}>
                  <ImageUploader value={reasonPhotos} onChange={setReasonPhotos} folder="disputes" max={MAX_EVIDENCE_PHOTOS} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div onClick={() => { setShowDispute(false); setReason(''); setReasonPhotos([]) }} style={{ flex: 1, textAlign: 'center', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>Cancel</div>
                  <div onClick={busy ? undefined : submitDispute} style={{ flex: 1, textAlign: 'center', padding: '11px', borderRadius: '10px', background: '#DC2626', color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    {busy ? 'Sending...' : 'Open dispute'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <p style={{ fontSize: '12px', color: COLORS.textMuted }}>{label}</p>
      <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, textAlign: 'right' }}>{value}</p>
    </div>
  )
}

function Shell({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Order</p>
      </div>
      {children}
    </div>
  )
}
