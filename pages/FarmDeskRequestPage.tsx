import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import NetworkError from '../NetworkError'
import { PhotoPreviews, PhotoButton, MessagePhotos, uploadMessagePhotos } from '../FarmDeskPhotos'
import {
  FD, STATUS_META, PAYMENT_LABELS, money, fmtDate, fmtDateTime, destinationText, sourceText, quantityText,
  DEADLINES, type FarmDeskRequest,
} from '../farmDeskShared'

type Option = {
  id: string
  label: string
  product: string
  supplier_display_name: string | null
  location: string | null
  available_quantity: number | null
  unit: string | null
  price_per_unit: number | null
  currency: string
  estimated_total: number | null
  estimated_delivery_days: number | null
  verification_label: string | null
  customer_note: string | null
  status: 'offered' | 'accepted' | 'declined' | 'not_selected'
}

type Payment = { id: string; amount: number; currency: string; status: 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'cancelled'; method: string | null }
type Msg = { id: string; sender_type: 'customer' | 'staff'; body: string; images: string[]; created_at: string }
type Activity = { id: string; action: string; detail: string | null; created_at: string }

const CLOSED = ['completed', 'cancelled']

export default function FarmDeskRequestPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()

  const [req, setReq] = useState<FarmDeskRequest | null>(null)
  const [options, setOptions] = useState<Option[]>([])
  const [messages, setMessages] = useState<Msg[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const msgRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const load = async (silent = false) => {
    if (!user || !id) return
    if (!silent) { setNetError(false); setLoading(true) }

    const [r, o, m, a, pay] = await Promise.all([
      supabase.from('farm_desk_requests').select('*').eq('id', id).maybeSingle(),
      supabase.from('farm_desk_options').select('*').eq('request_id', id).order('created_at', { ascending: true }),
      supabase.from('farm_desk_messages').select('id, sender_type, body, images, created_at').eq('request_id', id).order('created_at', { ascending: true }),
      supabase.from('farm_desk_activity').select('id, action, detail, created_at').eq('request_id', id).order('created_at', { ascending: true }),
      supabase.from('farm_desk_payments').select('id, amount, currency, status, method').eq('request_id', id).order('created_at', { ascending: true }),
    ])

    if (r.error || o.error || m.error || a.error) {
      if (!silent) { setNetError(true); setLoading(false) }
      return
    }
    if (!r.data) { setNotFound(true); setLoading(false); return }

    setReq(r.data as any)
    setOptions((o.data || []) as any)
    setMessages((m.data || []) as any)
    setActivity((a.data || []) as any)
    // Payments are optional context: if they fail to load the rest of the page still works
    setPayments(((pay.data || []) as any[]).map((p) => ({ ...p, amount: Number(p.amount) })) as Payment[])
    setLoading(false)
  }

  useEffect(() => { load() }, [user, id])

  // Light polling so new FarmLite replies show up without reopening the page.
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(true) }, 20000)
    return () => clearInterval(t)
  }, [user, id])

  const respond = async (action: string, optionId?: string) => {
    if (!id || busy) return
    setBusy(true)
    setNotice('')
    const { error } = await supabase.rpc('farm_desk_respond', {
      p_request_id: id,
      p_action: action,
      p_option_id: optionId ?? null,
    })
    setBusy(false)
    if (error) {
      setNotice(/network|failed to fetch/i.test(error.message) ? 'No internet connection. Please try again.' : 'Could not complete that action. Please try again.')
      return
    }
    await load(true)
  }

  const accept = (o: Option) => { if (window.confirm(`Accept ${o.label}? FarmLite will move your request to Confirmed.`)) respond('accept_option', o.id) }
  const decline = (o: Option) => { if (window.confirm(`Decline ${o.label}?`)) respond('decline_option', o.id) }
  const another = () => { if (window.confirm('Ask FarmLite to look for another option?')) respond('request_another') }
  const cancel = () => { if (window.confirm('Cancel this request? This cannot be undone.')) respond('cancel') }

  const askQuestion = (o: Option) => {
    setDraft(`About ${o.label}: `)
    setTimeout(() => {
      msgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      inputRef.current?.focus()
    }, 50)
  }

  const send = async () => {
    const body = draft.trim()
    if ((!body && photos.length === 0) || !user || !id || sending) return
    setSending(true)
    setNotice('')

    let images: string[] = []
    if (photos.length > 0) {
      try {
        images = await uploadMessagePhotos(photos, user.id, id)
      } catch (e: any) {
        setSending(false)
        setNotice(/network|failed to fetch/i.test(e?.message || '') ? 'No internet connection. Your photos were not sent.' : 'Could not upload your photos. Please try again.')
        return
      }
    }

    const { data, error } = await supabase
      .from('farm_desk_messages')
      .insert({ request_id: id, sender_id: user.id, sender_type: 'customer', body, images })
      .select('id, sender_type, body, images, created_at')
      .single()
    setSending(false)
    if (error || !data) {
      setNotice(/network|failed to fetch/i.test(error?.message || '') ? 'No internet connection. Your message was not sent.' : 'Could not send your message. Please try again.')
      return
    }
    setMessages((prev) => [...prev, data as any])
    setDraft('')
    setPhotos([])
  }

  if (netError) {
    return (
      <Shell onBack={() => navigate('/farm-desk')} title="Farm Desk">
        <NetworkError onRetry={() => load()} />
      </Shell>
    )
  }

  if (loading) {
    return (
      <Shell onBack={() => navigate('/farm-desk')} title="Farm Desk">
        <div style={{ padding: '16px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ background: FD.card, border: `1px solid ${FD.border}`, borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ height: '12px', width: '35%', background: FD.bg, borderRadius: '6px' }} />
              <div style={{ height: '14px', width: '70%', background: FD.bg, borderRadius: '6px', marginTop: '12px' }} />
              <div style={{ height: '10px', width: '50%', background: FD.bg, borderRadius: '6px', marginTop: '12px' }} />
            </div>
          ))}
        </div>
      </Shell>
    )
  }

  if (notFound || !req) {
    return (
      <Shell onBack={() => navigate('/farm-desk')} title="Farm Desk">
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <p style={{ fontSize: '15px', fontWeight: 800, color: FD.text }}>Request not found</p>
          <p style={{ fontSize: '12.5px', color: FD.textMuted, marginTop: '6px' }}>It may have been removed, or it does not belong to your account.</p>
          <div onClick={() => navigate('/farm-desk')} style={{ display: 'inline-block', marginTop: '16px', background: FD.green, color: 'white', borderRadius: '12px', padding: '11px 22px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Back to Farm Desk
          </div>
        </div>
      </Shell>
    )
  }

  const meta = STATUS_META[req.status] || STATUS_META.new
  const closed = CLOSED.includes(req.status)
  const offered = options.filter((o) => o.status === 'offered')
  const needsDecision = offered.length > 0 && !closed && req.status !== 'confirmed'

  const budgetText = req.no_fixed_budget
    ? 'No fixed budget'
    : [req.budget_min ? `Min ${money(req.budget_min, req.currency)}` : '', req.budget_max ? `Max ${money(req.budget_max, req.currency)}` : ''].filter(Boolean).join(' · ') || '-'
  const deadlineText = req.deadline_type === 'date' && req.deadline_date
    ? fmtDate(req.deadline_date)
    : DEADLINES.find((d) => d.key === req.deadline_type)?.label || '-'

  return (
    <Shell onBack={() => navigate('/farm-desk')} title={req.request_code}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Title + status */}
        <div style={{ background: FD.card, border: `1px solid ${FD.border}`, borderRadius: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: FD.textMuted }}>FARM DESK · {req.request_code}</span>
            <span style={{ fontSize: '10.5px', fontWeight: 800, background: meta.bg, color: meta.fg, padding: '3px 10px', borderRadius: '10px' }}>{meta.label}</span>
          </div>
          <p style={{ fontSize: '18px', fontWeight: 800, color: FD.text, marginTop: '8px', lineHeight: 1.3 }}>
            {quantityText(req) !== '-' ? `${quantityText(req)} of ` : ''}{req.title}
          </p>
          <p style={{ fontSize: '12.5px', color: FD.textMuted, marginTop: '6px' }}>{meta.hint}</p>
        </div>

        {needsDecision && (
          <div style={{ background: '#EDE9FE', border: '1px solid #DDD6FE', borderRadius: '12px', padding: '12px 14px' }}>
            <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#5B21B6' }}>
              FarmLite has {offered.length === 1 ? 'an option' : `${offered.length} options`} for you. Review below and choose.
            </p>
          </div>
        )}

        {notice && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '10px 14px' }}>
            <p style={{ fontSize: '12px', color: '#92400E' }}>{notice}</p>
          </div>
        )}

        {/* Sourcing options */}
        {options.length > 0 && (
          <Card title="Sourcing options">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {options.map((o) => (
                <div key={o.id} style={{ border: `1.5px solid ${o.status === 'accepted' ? FD.green : FD.border}`, borderRadius: '14px', padding: '14px', background: o.status === 'accepted' ? '#F0FDF4' : FD.card, opacity: o.status === 'declined' || o.status === 'not_selected' ? 0.65 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: FD.green, letterSpacing: '0.4px' }}>{o.label.toUpperCase()}</span>
                    {o.status !== 'offered' && (
                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: o.status === 'accepted' ? FD.green : FD.textMuted }}>
                        {o.status === 'accepted' ? 'Accepted' : o.status === 'declined' ? 'Declined' : 'Not selected'}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: FD.text, marginTop: '6px' }}>{o.product}</p>
                  <div style={{ marginTop: '8px' }}>
                    {o.supplier_display_name && <Line label="Supplier" value={o.supplier_display_name} />}
                    {o.location && <Line label="Location" value={o.location} />}
                    {o.available_quantity !== null && <Line label="Available" value={`${Number(o.available_quantity).toLocaleString()} ${o.unit || ''}`} />}
                    {o.price_per_unit !== null && <Line label="Price" value={`${money(o.price_per_unit, o.currency)}${o.unit ? ` per ${o.unit.replace(/s$/, '')}` : ''}`} />}
                    {o.estimated_total !== null && <Line label="Estimated total" value={money(o.estimated_total, o.currency)} bold />}
                    {o.estimated_delivery_days !== null && <Line label="Est. delivery" value={`${o.estimated_delivery_days} day${o.estimated_delivery_days === 1 ? '' : 's'}`} />}
                    {o.verification_label && <Line label="Verification" value={o.verification_label} />}
                  </div>
                  {o.customer_note && <p style={{ fontSize: '12px', color: FD.textMuted, marginTop: '8px', lineHeight: 1.5 }}>{o.customer_note}</p>}

                  {o.status === 'offered' && !closed && (
                    <div style={{ marginTop: '12px' }}>
                      <div onClick={() => accept(o)} style={{ background: FD.green, color: 'white', borderRadius: '10px', padding: '11px', textAlign: 'center', fontSize: '13px', fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                        Accept Option
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <div onClick={() => askQuestion(o)} style={{ flex: 1, border: `1px solid ${FD.border}`, borderRadius: '10px', padding: '10px', textAlign: 'center', fontSize: '12.5px', fontWeight: 700, color: FD.text, cursor: 'pointer' }}>
                          Ask a Question
                        </div>
                        <div onClick={() => decline(o)} style={{ flex: 1, border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', textAlign: 'center', fontSize: '12.5px', fontWeight: 700, color: '#B91C1C', cursor: 'pointer' }}>
                          Decline
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!closed && req.status !== 'confirmed' && (
              <div onClick={another} style={{ marginTop: '12px', textAlign: 'center', fontSize: '12.5px', fontWeight: 700, color: FD.green, cursor: 'pointer', padding: '6px' }}>
                Request another option
              </div>
            )}
          </Card>
        )}

        {/* Request details */}
        <Card title="Request details">
          <Line label="Category" value={req.category ? req.category.charAt(0).toUpperCase() + req.category.slice(1) : '-'} />
          <Line label="Quantity" value={quantityText(req)} />
          <Line label="Source" value={sourceText(req)} />
          <Line label="Destination" value={destinationText(req)} />
          <Line label="Budget" value={budgetText} />
          <Line label="Deadline" value={deadlineText} />
          {req.payment_status !== 'not_required' && <Line label="Payment" value={PAYMENT_LABELS[req.payment_status] || req.payment_status} />}
          {req.description && <Block label="Description" value={req.description} />}
          {req.requirements && <Block label="Additional requirements" value={req.requirements} />}
          {req.delivery_note && <Block label="Delivery note" value={req.delivery_note} />}
          <Line label="Submitted" value={fmtDate(req.created_at)} last />
        </Card>

        {/* Messages */}
        <div ref={msgRef}>
          <Card title="Messages with FarmLite">
            {payments.filter((p) => p.status !== 'cancelled').map((p) => (
              <PaymentStrip key={p.id} payment={p} onPay={() => navigate(`/wallet?pay=${p.id}`)} />
            ))}
            {messages.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: FD.textMuted, textAlign: 'center', padding: '12px 0' }}>
                No messages yet. Ask FarmLite anything about this request.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                {messages.map((m) => {
                  const mine = m.sender_type === 'customer'
                  return (
                    <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      {!mine && <p style={{ fontSize: '10.5px', fontWeight: 800, color: FD.green, marginBottom: '3px' }}>FarmLite</p>}
                      <div style={{ background: mine ? FD.green : FD.bg, color: mine ? 'white' : FD.text, padding: '9px 13px', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', fontSize: '13px', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        <MessagePhotos images={m.images} />
                        {m.body}
                      </div>
                      <p style={{ fontSize: '10px', color: FD.textMuted, marginTop: '3px', textAlign: mine ? 'right' : 'left' }}>{fmtDateTime(m.created_at)}</p>
                    </div>
                  )
                })}
              </div>
            )}
            {req.status !== 'cancelled' && (
              <div>
                <PhotoPreviews files={photos} onChange={setPhotos} />
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                <PhotoButton files={photos} onChange={setPhotos} disabled={sending} />
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  maxLength={2000}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Write a message..."
                  style={{ flex: 1, resize: 'none', padding: '10px 14px', borderRadius: '18px', border: `1px solid ${FD.border}`, background: FD.bg, fontSize: '13px', color: FD.text, outline: 'none', fontFamily: 'inherit', maxHeight: '100px' }}
                />
                <div onClick={send} style={{ width: '40px', height: '40px', borderRadius: '20px', background: (draft.trim() || photos.length > 0) && !sending ? FD.green : '#BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (draft.trim() || photos.length > 0) && !sending ? 'pointer' : 'default', flexShrink: 0 }}>
                  <Icon name="send" size={16} color="white" />
                </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Timeline */}
        <Card title="Activity timeline">
          <div>
            {activity.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '5px', background: i === activity.length - 1 ? FD.green : '#86EFAC', marginTop: '4px' }} />
                  {i < activity.length - 1 && <div style={{ width: '2px', flex: 1, background: FD.border, marginTop: '2px' }} />}
                </div>
                <div style={{ paddingBottom: '14px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: FD.text }}>{a.detail || a.action}</p>
                  <p style={{ fontSize: '11px', color: FD.textMuted, marginTop: '2px' }}>{fmtDateTime(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {!closed && (
          <div onClick={cancel} style={{ textAlign: 'center', padding: '12px', fontSize: '12.5px', fontWeight: 700, color: '#B91C1C', cursor: 'pointer' }}>
            Cancel this request
          </div>
        )}
      </div>
    </Shell>
  )
}

function PaymentStrip({ payment: p, onPay }: { payment: Payment; onPay: () => void }) {
  const amount = `${p.currency} ${Number(p.amount).toLocaleString()}`
  const paid = p.status === 'paid'
  const refunded = p.status === 'refunded'
  const canPayFromWallet = p.status === 'pending' && p.currency === 'NGN'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', marginBottom: '12px',
      background: paid ? '#F0FDF4' : refunded ? '#EFF6FF' : '#FFFBEB',
      border: `1px solid ${paid ? '#BBF7D0' : refunded ? '#BFDBFE' : '#FDE68A'}`,
    }}>
      <Icon name={paid ? 'checkCircle' : 'wallet'} size={18} color={paid ? FD.green : refunded ? '#1D4ED8' : '#B45309'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '12.5px', fontWeight: 800, color: FD.text }}>
          {paid ? 'You have paid' : refunded ? 'Payment refunded' : p.status === 'partially_paid' ? 'Part payment received' : 'Payment due'}
        </p>
        <p style={{ fontSize: '12px', color: FD.textMuted, marginTop: '1px' }}>
          {amount}{paid && p.method === 'wallet' ? ' · paid from wallet' : ''}{refunded && p.method === 'wallet' ? ' · returned to your wallet' : ''}
        </p>
        {p.status === 'pending' && p.currency !== 'NGN' && (
          <p style={{ fontSize: '11px', color: FD.textMuted, marginTop: '2px' }}>Message FarmLite below to arrange this payment.</p>
        )}
      </div>
      {canPayFromWallet && (
        <div onClick={onPay} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: FD.green, color: 'white', borderRadius: '999px', padding: '7px 12px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Icon name="wallet" size={14} color="white" /> Pay with wallet
        </div>
      )}
    </div>
  )
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: FD.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: FD.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 5 }}>
        <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={FD.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: FD.text }}>{title}</p>
      </div>
      {children}
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: FD.card, border: `1px solid ${FD.border}`, borderRadius: '16px', padding: '16px' }}>
      <p style={{ fontSize: '13.5px', fontWeight: 800, color: FD.text, marginBottom: '12px' }}>{title}</p>
      {children}
    </div>
  )
}

function Line({ label, value, bold, last }: { label: string; value: string; bold?: boolean; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', padding: '8px 0', borderBottom: last ? 'none' : `1px solid ${FD.bg}` }}>
      <span style={{ fontSize: '12px', color: FD.textMuted, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '12.5px', color: FD.text, fontWeight: bold ? 800 : 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: `1px solid ${FD.bg}` }}>
      <p style={{ fontSize: '12px', color: FD.textMuted }}>{label}</p>
      <p style={{ fontSize: '12.5px', color: FD.text, marginTop: '3px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{value}</p>
    </div>
  )
}
