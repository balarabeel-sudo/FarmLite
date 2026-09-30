import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../AuthContext'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import {
  STATUS_META, PAYMENT_LABELS, CURRENCIES, UNITS, DEADLINES, money, fmtDate, fmtDateTime,
  destinationText, sourceText, quantityText,
} from '../../farmDeskShared'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', bg: '#F5F7F5', red: '#B91C1C' }
const STATUSES = ['new', 'reviewing', 'sourcing', 'options_found', 'quotation_ready', 'customer_review', 'confirmed', 'in_progress', 'completed', 'cancelled', 'unable_to_source']
const SOURCE_TYPES = [
  { v: 'farmer', l: 'Farmer' }, { v: 'company', l: 'Company' }, { v: 'cooperative', l: 'Cooperative' },
  { v: 'warehouse', l: 'Warehouse' }, { v: 'marketplace_seller', l: 'Marketplace seller' },
  { v: 'partner', l: 'Partner' }, { v: 'external_supplier', l: 'External supplier' },
]

type Req = any
type StaffMember = { id: string; user_id: string; full_name: string; role_name: string }

export default function AdminFarmDeskRequestPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()
  const staff = useStaff()
  const canManage = staff.permissions.has('trade_desk.manage')
  const canAssign = staff.permissions.has('trade_desk.assign')

  const [req, setReq] = useState<Req | null>(null)
  const [options, setOptions] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)

  // Controls
  const [statusSel, setStatusSel] = useState('')
  const [paymentSel, setPaymentSel] = useState('')
  const [assignSel, setAssignSel] = useState('')
  const [savingCtl, setSavingCtl] = useState(false)

  const [msgDraft, setMsgDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const [showSourceForm, setShowSourceForm] = useState(false)
  const [optionForm, setOptionForm] = useState<OptionDraft | null>(null)

  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 4000)
  }

  const load = async (silent = false) => {
    if (!id) return
    if (!silent) { setError(false); setLoading(true) }
    const [r, o, s, m, n, a, st] = await Promise.all([
      supabase.from('farm_desk_requests').select('*, customer:profiles!farm_desk_requests_customer_id_fkey(full_name, username, phone)').eq('id', id).maybeSingle(),
      supabase.from('farm_desk_options').select('*').eq('request_id', id).order('created_at', { ascending: true }),
      supabase.from('farm_desk_sources').select('*').eq('request_id', id).order('created_at', { ascending: true }),
      supabase.from('farm_desk_messages').select('*').eq('request_id', id).order('created_at', { ascending: true }),
      supabase.from('farm_desk_internal_notes').select('*').eq('request_id', id).order('created_at', { ascending: false }),
      supabase.from('farm_desk_activity').select('*').eq('request_id', id).order('created_at', { ascending: false }),
      supabase.rpc('farm_desk_assignable_staff'),
    ])
    if (r.error || o.error || s.error || m.error || n.error || a.error) {
      if (!silent) { setError(true); setLoading(false) }
      return
    }
    if (!r.data) { setNotFound(true); setLoading(false); return }
    setReq(r.data)
    setOptions(o.data || [])
    setSources(s.data || [])
    setMessages(m.data || [])
    setNotes(n.data || [])
    setActivity(a.data || [])
    if (!st.error) setStaffList((st.data || []) as any)
    if (!silent) {
      setStatusSel(r.data.status)
      setPaymentSel(r.data.payment_status)
      setAssignSel(r.data.assigned_staff_id || '')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const saveControls = async () => {
    if (!req || savingCtl) return
    const patch: Record<string, any> = {}
    if (statusSel !== req.status) patch.status = statusSel
    if (paymentSel !== req.payment_status) patch.payment_status = paymentSel
    if ((assignSel || null) !== (req.assigned_staff_id || null)) patch.assigned_staff_id = assignSel || null
    if (Object.keys(patch).length === 0) return flash(true, 'Nothing to update.')
    if (patch.status && !window.confirm(`Change status to "${STATUS_META[patch.status].label}"? The customer will be notified.`)) return

    setSavingCtl(true)
    const { error: err } = await supabase.from('farm_desk_requests').update(patch).eq('id', req.id)
    setSavingCtl(false)
    if (err) return flash(false, 'Could not update the request.')
    flash(true, 'Request updated.')
    await load(true)
    setStatusSel(patch.status ?? statusSel)
  }

  const assignToMe = () => {
    const me = staffList.find((s) => s.user_id === user?.id)
    if (me) setAssignSel(me.id)
  }

  const sendMessage = async () => {
    const body = msgDraft.trim()
    if (!body || !user || !req || busy) return
    setBusy(true)
    const { error: err } = await supabase.from('farm_desk_messages').insert({ request_id: req.id, sender_id: user.id, sender_type: 'staff', body })
    setBusy(false)
    if (err) return flash(false, 'Could not send the message.')
    setMsgDraft('')
    load(true)
  }

  const addNote = async () => {
    const body = noteDraft.trim()
    if (!body || !user || !req || busy) return
    setBusy(true)
    const { error: err } = await supabase.from('farm_desk_internal_notes').insert({ request_id: req.id, author_id: user.id, author_name: staff.fullName, body })
    setBusy(false)
    if (err) return flash(false, 'Could not save the note.')
    setNoteDraft('')
    load(true)
  }

  const setOptionStatus = async (o: any, status: string) => {
    if (status === 'offered' && !window.confirm(`Offer ${o.label} to the customer? They will see it and be notified.`)) return
    const { error: err } = await supabase.from('farm_desk_options').update({ status }).eq('id', o.id)
    if (err) return flash(false, 'Could not update the option.')
    flash(true, status === 'offered' ? 'Option offered to the customer.' : 'Option updated.')
    load(true)
  }

  const deleteOption = async (o: any) => {
    if (!window.confirm(`Delete draft ${o.label}?`)) return
    const { error: err } = await supabase.from('farm_desk_options').delete().eq('id', o.id)
    if (err) return flash(false, 'Could not delete the option.')
    load(true)
  }

  const deleteSource = async (s: any) => {
    if (!window.confirm(`Remove source "${s.name}"?`)) return
    const { error: err } = await supabase.from('farm_desk_sources').delete().eq('id', s.id)
    if (err) return flash(false, 'Could not remove the source.')
    load(true)
  }

  const startOption = (src?: any) => {
    const next = `Option ${String.fromCharCode(65 + (options.length % 26))}`
    setOptionForm({
      label: next,
      product: src?.product || req?.title || '',
      supplier: src?.name || '',
      location: src?.location || '',
      qty: src?.available_quantity != null ? String(src.available_quantity) : '',
      unit: src?.unit || req?.unit || 'bags',
      price: src?.price != null ? String(src.price) : '',
      currency: src?.currency || req?.currency || 'NGN',
      total: '',
      days: '',
      verification: src?.verification_status === 'verified' ? 'Verified' : '',
      note: '',
      companyId: src?.company_id || null,
      listingId: src?.listing_id || null,
      sourceId: src?.id || null,
    })
    setTimeout(() => document.getElementById('fd-option-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  if (loading) {
    return <AdminLayout title="Farm Desk"><p style={{ fontSize: '13px', color: A.textMuted }}>Loading request...</p></AdminLayout>
  }
  if (error) {
    return (
      <AdminLayout title="Farm Desk">
        <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '8px' }}>Could not load this request.</p>
          <span onClick={() => load()} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
        </div>
      </AdminLayout>
    )
  }
  if (notFound || !req) {
    return (
      <AdminLayout title="Farm Desk">
        <p style={{ fontSize: '13px', color: A.textMuted }}>Request not found.</p>
        <span onClick={() => navigate('/admin/farm-desk')} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Back to Farm Desk</span>
      </AdminLayout>
    )
  }

  const meta = STATUS_META[req.status] || STATUS_META.new
  const budgetText = req.no_fixed_budget
    ? 'No fixed budget'
    : [req.budget_min ? `Min ${money(req.budget_min, req.currency)}` : '', req.budget_max ? `Max ${money(req.budget_max, req.currency)}` : ''].filter(Boolean).join(' · ') || '-'
  const deadlineText = req.deadline_type === 'date' && req.deadline_date ? fmtDate(req.deadline_date) : DEADLINES.find((d) => d.key === req.deadline_type)?.label || '-'
  const assigneeName = staffList.find((s) => s.id === req.assigned_staff_id)?.full_name

  return (
    <AdminLayout title={req.request_code}>
      <div style={{ marginBottom: '14px' }}>
        <span onClick={() => navigate('/admin/farm-desk')} style={{ fontSize: '12.5px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>← Farm Desk</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <p style={{ fontSize: '19px', fontWeight: 800, color: A.text }}>{quantityText(req) !== '-' ? `${quantityText(req)} · ` : ''}{req.title}</p>
        <span style={{ fontSize: '11.5px', fontWeight: 800, background: meta.bg, color: meta.fg, padding: '4px 11px', borderRadius: '10px' }}>{meta.label}</span>
        <span style={{ fontSize: '12px', color: A.textMuted }}>{assigneeName ? `Assigned to ${assigneeName}` : 'Unassigned'}</span>
      </div>

      {toast && (
        <div style={{ position: 'fixed', top: '18px', right: '18px', zIndex: 100, background: toast.ok ? '#DCFCE7' : '#FEE2E2', border: `1px solid ${toast.ok ? '#86EFAC' : '#FCA5A5'}`, color: toast.ok ? '#14532D' : '#991B1B', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}>
          {toast.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* LEFT */}
        <div style={{ flex: '1 1 540px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card title="Customer & request">
            <Row label="Customer" value={req.customer?.full_name || 'Unknown'} />
            {req.customer?.username && <Row label="Username" value={`@${req.customer.username}`} />}
            {req.customer?.phone && <Row label="Phone" value={req.customer.phone} />}
            <Row label="Category" value={req.category} />
            <Row label="Quantity" value={quantityText(req)} />
            <Row label="Source (preferred)" value={sourceText(req)} />
            <Row label="Destination" value={destinationText(req)} />
            <Row label="Budget" value={budgetText} />
            <Row label="Deadline" value={deadlineText} />
            <Row label="Submitted" value={fmtDateTime(req.created_at)} />
            {req.description && <Block label="Description" value={req.description} />}
            {req.requirements && <Block label="Additional requirements" value={req.requirements} />}
            {req.delivery_note && <Block label="Delivery note" value={req.delivery_note} />}
            {req.marketplace_listing_id && <Row label="Started from listing" value={req.marketplace_listing_id} />}
          </Card>

          {/* Options */}
          <Card title="Sourcing options (visible to customer once offered)" action={canManage ? <LinkBtn onClick={() => startOption()}>+ New option</LinkBtn> : undefined}>
            {options.length === 0 && !optionForm && <p style={{ fontSize: '12.5px', color: A.textMuted }}>No options yet. Record a source, then create an option from it.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {options.map((o) => (
                <div key={o.id} style={{ border: `1px solid ${A.border}`, borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: A.text }}>{o.label} · {o.product}</p>
                    <Pill text={o.status.replace('_', ' ')} tone={o.status === 'offered' ? 'green' : o.status === 'accepted' ? 'green' : o.status === 'draft' ? 'gray' : 'red'} />
                  </div>
                  <p style={{ fontSize: '12px', color: A.textMuted, marginTop: '4px', lineHeight: 1.6 }}>
                    {[o.supplier_display_name, o.location].filter(Boolean).join(' · ')}
                    {o.price_per_unit != null && ` · ${money(o.price_per_unit, o.currency)}/${o.unit || 'unit'}`}
                    {o.estimated_total != null && ` · Total ${money(o.estimated_total, o.currency)}`}
                    {o.estimated_delivery_days != null && ` · ${o.estimated_delivery_days} days`}
                    {o.verification_label && ` · ${o.verification_label}`}
                  </p>
                  {canManage && (
                    <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                      {o.status === 'draft' && <LinkBtn onClick={() => setOptionStatus(o, 'offered')}>Offer to customer</LinkBtn>}
                      {o.status === 'offered' && <LinkBtn onClick={() => setOptionStatus(o, 'withdrawn')} danger>Withdraw</LinkBtn>}
                      {o.status === 'draft' && <LinkBtn onClick={() => deleteOption(o)} danger>Delete</LinkBtn>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {optionForm && (
              <div id="fd-option-form">
                <OptionFormPanel
                  draft={optionForm}
                  requestId={req.id}
                  userId={user?.id || ''}
                  onCancel={() => setOptionForm(null)}
                  onSaved={(offered) => { setOptionForm(null); flash(true, offered ? 'Option offered to the customer.' : 'Draft option saved.'); load(true) }}
                  onError={(t) => flash(false, t)}
                />
              </div>
            )}
          </Card>

          {/* Sources */}
          <Card title="Potential sources (private, never shown to the customer)" action={canManage ? <LinkBtn onClick={() => setShowSourceForm((v) => !v)}>{showSourceForm ? 'Close' : '+ Add source'}</LinkBtn> : undefined}>
            {sources.length === 0 && !showSourceForm && <p style={{ fontSize: '12.5px', color: A.textMuted }}>No sources recorded yet.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sources.map((s) => (
                <div key={s.id} style={{ border: `1px solid ${A.border}`, borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: A.text }}>{s.name} <span style={{ fontWeight: 500, color: A.textMuted }}>· {SOURCE_TYPES.find((t) => t.v === s.source_type)?.l}</span></p>
                    <Pill text={s.verification_status.replace('_', ' ')} tone={s.verification_status === 'verified' ? 'green' : 'gray'} />
                  </div>
                  <p style={{ fontSize: '12px', color: A.textMuted, marginTop: '4px', lineHeight: 1.6 }}>
                    {[s.product, s.location].filter(Boolean).join(' · ')}
                    {s.available_quantity != null && ` · ${Number(s.available_quantity).toLocaleString()} ${s.unit || ''} available`}
                    {s.price != null && ` · ${money(s.price, s.currency)}`}
                    {s.contact_method && ` · Contact: ${s.contact_method}`}
                  </p>
                  {s.notes && <p style={{ fontSize: '12px', color: A.text, marginTop: '4px' }}>{s.notes}</p>}
                  {canManage && (
                    <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                      <LinkBtn onClick={() => startOption(s)}>Create option from this</LinkBtn>
                      <LinkBtn onClick={() => deleteSource(s)} danger>Remove</LinkBtn>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {showSourceForm && (
              <SourceFormPanel
                requestId={req.id}
                userId={user?.id || ''}
                defaultProduct={req.title}
                defaultUnit={req.unit || 'bags'}
                onCancel={() => setShowSourceForm(false)}
                onSaved={() => { setShowSourceForm(false); flash(true, 'Source recorded.'); load(true) }}
                onError={(t) => flash(false, t)}
              />
            )}
          </Card>

          {/* Conversation */}
          <Card title="Conversation with customer">
            {messages.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: A.textMuted, marginBottom: '10px' }}>No messages yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px', maxHeight: '340px', overflowY: 'auto' }}>
                {messages.map((m) => {
                  const mine = m.sender_type === 'staff'
                  return (
                    <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                      <div style={{ background: mine ? A.green : A.bg, color: mine ? 'white' : A.text, padding: '9px 13px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                      <p style={{ fontSize: '10.5px', color: A.textMuted, marginTop: '3px', textAlign: mine ? 'right' : 'left' }}>{mine ? 'FarmLite' : 'Customer'} · {fmtDateTime(m.created_at)}</p>
                    </div>
                  )
                })}
              </div>
            )}
            {canManage ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <textarea value={msgDraft} onChange={(e) => setMsgDraft(e.target.value)} rows={2} maxLength={2000} placeholder="Write to the customer (they will be notified)..." style={{ ...inputStyle, flex: 1, resize: 'vertical' }} />
                <Btn onClick={sendMessage} disabled={!msgDraft.trim() || busy}>Send</Btn>
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: A.textMuted }}>You have view-only access.</p>
            )}
          </Card>
        </div>

        {/* RIGHT */}
        <div style={{ flex: '1 1 320px', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card title="Status & assignment">
            <Field label="Status">
              <select value={statusSel} onChange={(e) => setStatusSel(e.target.value)} disabled={!canManage} style={inputStyle}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </Field>
            <Field label="Payment status">
              <select value={paymentSel} onChange={(e) => setPaymentSel(e.target.value)} disabled={!canManage} style={inputStyle}>
                {Object.entries(PAYMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Assigned to">
              <select value={assignSel} onChange={(e) => setAssignSel(e.target.value)} disabled={!canAssign} style={inputStyle}>
                <option value="">Unassigned</option>
                {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role_name})</option>)}
              </select>
              {canAssign && <span onClick={assignToMe} style={{ display: 'inline-block', marginTop: '6px', fontSize: '12px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Assign to me</span>}
            </Field>
            {(canManage || canAssign) && (
              <Btn onClick={saveControls} disabled={savingCtl} full>{savingCtl ? 'Saving...' : 'Save changes'}</Btn>
            )}
            <p style={{ fontSize: '11px', color: A.textMuted, marginTop: '10px', lineHeight: 1.5 }}>Changing the status notifies the customer and is recorded in the audit log.</p>
          </Card>

          <Card title="Internal notes (staff only)">
            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>
              <p style={{ fontSize: '11.5px', color: '#92400E' }}>Customers can never see these notes.</p>
            </div>
            {canManage && (
              <div style={{ marginBottom: '12px' }}>
                <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} maxLength={4000} placeholder="e.g. Contacted supplier at 10:30. Confirmed 300 bags only." style={{ ...inputStyle, width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ marginTop: '8px' }}><Btn onClick={addNote} disabled={!noteDraft.trim() || busy}>Add note</Btn></div>
              </div>
            )}
            {notes.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: A.textMuted }}>No notes yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {notes.map((n) => (
                  <div key={n.id} style={{ borderLeft: `3px solid ${A.border}`, paddingLeft: '10px' }}>
                    <p style={{ fontSize: '12.5px', color: A.text, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{n.body}</p>
                    <p style={{ fontSize: '10.5px', color: A.textMuted, marginTop: '3px' }}>{n.author_name || 'Staff'} · {fmtDateTime(n.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Activity timeline">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activity.map((a) => (
                <div key={a.id}>
                  <p style={{ fontSize: '12.5px', color: A.text, fontWeight: 600 }}>
                    {a.detail || a.action}
                    {!a.is_customer_visible && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 800, color: '#92400E', background: '#FEF3C7', padding: '1px 6px', borderRadius: '6px' }}>INTERNAL</span>}
                  </p>
                  <p style={{ fontSize: '10.5px', color: A.textMuted, marginTop: '2px' }}>{a.actor_name || 'System'} · {fmtDateTime(a.created_at)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

// ---------------- Option form ----------------
type OptionDraft = {
  label: string; product: string; supplier: string; location: string; qty: string; unit: string
  price: string; currency: string; total: string; days: string; verification: string; note: string
  companyId: string | null; listingId: string | null; sourceId: string | null
}

function OptionFormPanel({ draft, requestId, userId, onCancel, onSaved, onError }: {
  draft: OptionDraft; requestId: string; userId: string; onCancel: () => void; onSaved: (offered: boolean) => void; onError: (t: string) => void
}) {
  const [f, setF] = useState<OptionDraft>(draft)
  const [saving, setSaving] = useState(false)
  const [finder, setFinder] = useState<'none' | 'companies' | 'listings'>('none')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const set = <K extends keyof OptionDraft>(k: K, v: OptionDraft[K]) => setF((p) => ({ ...p, [k]: v }))

  // Auto-fill the estimated total from quantity x price unless it is typed manually.
  const autoTotal = f.qty && f.price ? String(Number(f.qty) * Number(f.price)) : ''

  useEffect(() => {
    if (finder === 'none') return
    const term = q.trim().replace(/[%,()*\\]/g, ' ').trim()
    const t = setTimeout(async () => {
      if (!term) { setResults([]); return }
      if (finder === 'companies') {
        const { data } = await supabase.from('companies').select('id, name, status, trusted_partner, city, country').ilike('name', `%${term}%`).limit(6)
        setResults(data || [])
      } else {
        const { data } = await supabase
          .from('marketplace_listings')
          .select('id, title, price, currency, unit, quantity, location, seller:profiles!marketplace_listings_seller_id_fkey(full_name)')
          .ilike('title', `%${term}%`).eq('is_hidden_by_admin', false).limit(6)
        setResults(data || [])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, finder])

  const pickCompany = (c: any) => {
    setF((p) => ({
      ...p,
      supplier: c.name,
      location: [c.city, c.country].filter(Boolean).join(', ') || p.location,
      // Uses the company's existing verification status - no new badge is invented.
      verification: c.status === 'verified' ? (c.trusted_partner ? 'Verified FarmLite company · Trusted Partner' : 'Verified FarmLite company') : p.verification,
      companyId: c.id,
    }))
    setFinder('none'); setQ(''); setResults([])
  }

  const pickListing = (l: any) => {
    setF((p) => ({
      ...p,
      product: l.title,
      supplier: l.seller?.full_name || p.supplier,
      location: l.location || p.location,
      price: l.price != null ? String(l.price) : p.price,
      currency: l.currency || p.currency,
      unit: l.unit || p.unit,
      qty: l.quantity != null ? String(l.quantity) : p.qty,
      listingId: l.id,
    }))
    setFinder('none'); setQ(''); setResults([])
  }

  const save = async (offer: boolean) => {
    if (!f.label.trim() || !f.product.trim()) return onError('Label and product are required.')
    setSaving(true)
    const { error: err } = await supabase.from('farm_desk_options').insert({
      request_id: requestId,
      source_id: f.sourceId,
      label: f.label.trim(),
      product: f.product.trim(),
      supplier_display_name: f.supplier.trim() || null,
      location: f.location.trim() || null,
      available_quantity: f.qty ? Number(f.qty) : null,
      unit: f.unit,
      price_per_unit: f.price ? Number(f.price) : null,
      currency: f.currency,
      estimated_total: f.total ? Number(f.total) : autoTotal ? Number(autoTotal) : null,
      estimated_delivery_days: f.days ? Number(f.days) : null,
      verification_label: f.verification.trim() || null,
      company_id: f.companyId,
      listing_id: f.listingId,
      customer_note: f.note.trim() || null,
      status: offer ? 'offered' : 'draft',
      created_by: userId,
    })
    setSaving(false)
    if (err) return onError('Could not save the option.')
    onSaved(offer)
  }

  return (
    <div style={{ border: `1.5px solid ${A.green}`, borderRadius: '10px', padding: '14px', marginTop: '12px', background: '#FAFFFB' }}>
      <p style={{ fontSize: '12.5px', fontWeight: 800, color: A.text, marginBottom: '10px' }}>New sourcing option</p>
      <p style={{ fontSize: '11.5px', color: A.textMuted, marginBottom: '10px' }}>The customer sees everything here except the private source record. Do not put supplier phone numbers in these fields.</p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
        <LinkBtn onClick={() => setFinder(finder === 'companies' ? 'none' : 'companies')}>Find FarmLite company</LinkBtn>
        <LinkBtn onClick={() => setFinder(finder === 'listings' ? 'none' : 'listings')}>Find Marketplace listing</LinkBtn>
      </div>
      {finder !== 'none' && (
        <div style={{ marginBottom: '12px' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={finder === 'companies' ? 'Search company name' : 'Search listing title'} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          {results.map((r) => (
            <div key={r.id} onClick={() => (finder === 'companies' ? pickCompany(r) : pickListing(r))} style={{ padding: '8px 10px', border: `1px solid ${A.border}`, borderTop: 'none', fontSize: '12.5px', cursor: 'pointer', background: A.surface }}>
              {finder === 'companies'
                ? <><b>{r.name}</b> <span style={{ color: A.textMuted }}>· {r.status}{r.trusted_partner ? ' · Trusted Partner' : ''}{r.city ? ` · ${r.city}` : ''}</span></>
                : <><b>{r.title}</b> <span style={{ color: A.textMuted }}>· {r.seller?.full_name || 'Seller'}{r.price != null ? ` · ${money(r.price, r.currency)}` : ''}</span></>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Field label="Label"><input value={f.label} onChange={(e) => set('label', e.target.value)} style={inputStyle} /></Field>
        <Field label="Product"><input value={f.product} onChange={(e) => set('product', e.target.value)} style={inputStyle} /></Field>
        <Field label="Supplier name shown to customer"><input value={f.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="e.g. ABC Agro Ltd" style={inputStyle} /></Field>
        <Field label="Location"><input value={f.location} onChange={(e) => set('location', e.target.value)} style={inputStyle} /></Field>
        <Field label="Available quantity"><input value={f.qty} onChange={(e) => set('qty', e.target.value.replace(/[^0-9.]/g, ''))} style={inputStyle} /></Field>
        <Field label="Unit">
          <select value={f.unit} onChange={(e) => set('unit', e.target.value)} style={inputStyle}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
        </Field>
        <Field label="Price per unit"><input value={f.price} onChange={(e) => set('price', e.target.value.replace(/[^0-9.]/g, ''))} style={inputStyle} /></Field>
        <Field label="Currency">
          <select value={f.currency} onChange={(e) => set('currency', e.target.value)} style={inputStyle}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label={`Estimated total${autoTotal ? ` (auto: ${Number(autoTotal).toLocaleString()})` : ''}`}>
          <input value={f.total} onChange={(e) => set('total', e.target.value.replace(/[^0-9.]/g, ''))} placeholder={autoTotal} style={inputStyle} />
        </Field>
        <Field label="Estimated delivery (days)"><input value={f.days} onChange={(e) => set('days', e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} /></Field>
      </div>
      <Field label="Supplier verification (shown to customer)"><input value={f.verification} onChange={(e) => set('verification', e.target.value)} placeholder="e.g. Verified FarmLite company" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></Field>
      <Field label="Note to customer (optional)"><textarea value={f.note} onChange={(e) => set('note', e.target.value)} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} /></Field>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Btn onClick={() => save(true)} disabled={saving}>{saving ? 'Saving...' : 'Offer to customer'}</Btn>
        <Btn onClick={() => save(false)} disabled={saving} secondary>Save as draft</Btn>
        <Btn onClick={onCancel} secondary>Cancel</Btn>
      </div>
    </div>
  )
}

// ---------------- Source form ----------------
function SourceFormPanel({ requestId, userId, defaultProduct, defaultUnit, onCancel, onSaved, onError }: {
  requestId: string; userId: string; defaultProduct: string; defaultUnit: string; onCancel: () => void; onSaved: () => void; onError: (t: string) => void
}) {
  const [f, setF] = useState({ type: 'external_supplier', name: '', location: '', product: defaultProduct, qty: '', unit: defaultUnit, price: '', currency: 'NGN', contact: '', verification: 'unverified', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const save = async () => {
    if (!f.name.trim()) return onError('Source name is required.')
    setSaving(true)
    const { error: err } = await supabase.from('farm_desk_sources').insert({
      request_id: requestId,
      source_type: f.type,
      name: f.name.trim(),
      location: f.location.trim() || null,
      product: f.product.trim() || null,
      available_quantity: f.qty ? Number(f.qty) : null,
      unit: f.unit,
      price: f.price ? Number(f.price) : null,
      currency: f.currency,
      contact_method: f.contact.trim() || null,
      verification_status: f.verification,
      notes: f.notes.trim() || null,
      created_by: userId,
    })
    setSaving(false)
    if (err) return onError('Could not save the source.')
    onSaved()
  }

  return (
    <div style={{ border: `1.5px solid ${A.border}`, borderRadius: '10px', padding: '14px', marginTop: '12px' }}>
      <p style={{ fontSize: '11.5px', color: A.textMuted, marginBottom: '10px' }}>This record stays private. Recording an external supplier does not make them a FarmLite user or company.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Field label="Source type">
          <select value={f.type} onChange={(e) => set('type', e.target.value)} style={inputStyle}>{SOURCE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
        </Field>
        <Field label="Source name"><input value={f.name} onChange={(e) => set('name', e.target.value)} style={inputStyle} /></Field>
        <Field label="Location"><input value={f.location} onChange={(e) => set('location', e.target.value)} style={inputStyle} /></Field>
        <Field label="Product"><input value={f.product} onChange={(e) => set('product', e.target.value)} style={inputStyle} /></Field>
        <Field label="Available quantity"><input value={f.qty} onChange={(e) => set('qty', e.target.value.replace(/[^0-9.]/g, ''))} style={inputStyle} /></Field>
        <Field label="Unit"><select value={f.unit} onChange={(e) => set('unit', e.target.value)} style={inputStyle}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
        <Field label="Price per unit"><input value={f.price} onChange={(e) => set('price', e.target.value.replace(/[^0-9.]/g, ''))} style={inputStyle} /></Field>
        <Field label="Currency"><select value={f.currency} onChange={(e) => set('currency', e.target.value)} style={inputStyle}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Contact method (private)"><input value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="e.g. Phone, WhatsApp, email" style={inputStyle} /></Field>
        <Field label="Verification">
          <select value={f.verification} onChange={(e) => set('verification', e.target.value)} style={inputStyle}>
            <option value="unverified">Unverified</option><option value="verified">Verified</option><option value="unable_to_verify">Unable to verify</option>
          </select>
        </Field>
      </div>
      <Field label="Notes"><textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} /></Field>
      <div style={{ display: 'flex', gap: '10px' }}>
        <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save source'}</Btn>
        <Btn onClick={onCancel} secondary>Cancel</Btn>
      </div>
    </div>
  )
}

// ---------------- UI bits ----------------
const inputStyle: CSSProperties = {
  padding: '9px 11px', borderRadius: '8px', border: `1px solid ${A.border}`, fontSize: '13px', color: A.text, background: A.surface, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
}

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <p style={{ fontSize: '13px', fontWeight: 800, color: A.text }}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', padding: '7px 0', borderBottom: `1px solid ${A.bg}` }}>
      <span style={{ fontSize: '12px', color: A.textMuted, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '12.5px', color: A.text, fontWeight: 600, textAlign: 'right', wordBreak: 'break-word', textTransform: label === 'Category' ? 'capitalize' : 'none' }}>{value}</span>
    </div>
  )
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: `1px solid ${A.bg}` }}>
      <p style={{ fontSize: '12px', color: A.textMuted }}>{label}</p>
      <p style={{ fontSize: '12.5px', color: A.text, marginTop: '3px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: A.textMuted, marginBottom: '4px' }}>{label}</p>
      {children}
    </div>
  )
}

function Btn({ onClick, children, disabled, secondary, full }: { onClick: () => void; children: ReactNode; disabled?: boolean; secondary?: boolean; full?: boolean }) {
  return (
    <span
      onClick={disabled ? undefined : onClick}
      style={{ display: full ? 'block' : 'inline-block', textAlign: 'center', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1, background: secondary ? A.surface : A.green, color: secondary ? A.text : 'white', border: `1px solid ${secondary ? A.border : A.green}` }}>
      {children}
    </span>
  )
}

function LinkBtn({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) {
  return <span onClick={onClick} style={{ fontSize: '12.5px', fontWeight: 700, color: danger ? A.red : A.green, cursor: 'pointer' }}>{children}</span>
}

function Pill({ text, tone }: { text: string; tone: 'green' | 'gray' | 'red' }) {
  const c = tone === 'green' ? { bg: '#DCFCE7', fg: '#15803D' } : tone === 'red' ? { bg: '#FEE2E2', fg: '#B91C1C' } : { bg: '#E5E7EB', fg: '#374151' }
  return <span style={{ fontSize: '10.5px', fontWeight: 800, background: c.bg, color: c.fg, padding: '2px 9px', borderRadius: '10px', textTransform: 'capitalize', height: 'fit-content' }}>{text}</span>
}
