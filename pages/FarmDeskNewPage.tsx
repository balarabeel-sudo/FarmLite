import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import {
  FD, CATEGORIES, UNITS, CURRENCIES, SOURCE_SCOPES, DEADLINES, money,
} from '../farmDeskShared'

const TOTAL_STEPS = 8

type Form = {
  category: string
  title: string
  description: string
  quantity: string
  unit: string
  sourceScope: string
  sourceLocation: string
  destCountry: string
  destState: string
  destCity: string
  deliveryNote: string
  noBudget: boolean
  budgetMin: string
  budgetMax: string
  currency: string
  deadlineType: string
  deadlineDate: string
  requirements: string
}

export default function FarmDeskNewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params] = useSearchParams()

  // Marketplace integration: /farm-desk/new?q=500 bags maize&listing=<id>
  const prefill = (params.get('q') || '').trim()
  const listingId = params.get('listing')

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null)

  const [f, setF] = useState<Form>({
    category: '',
    title: prefill,
    description: '',
    quantity: '',
    unit: 'bags',
    sourceScope: 'anywhere',
    sourceLocation: '',
    destCountry: 'Nigeria',
    destState: '',
    destCity: '',
    deliveryNote: '',
    noBudget: true,
    budgetMin: '',
    budgetMax: '',
    currency: 'NGN',
    deadlineType: 'none',
    deadlineDate: '',
    requirements: '',
  })
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }))

  const isService = f.category === 'Agricultural Services'
  const needsCustomName = f.category === 'Other' || f.category === 'Agricultural Services'

  const pickCategory = (c: string) => {
    setF((prev) => {
      const custom = prev.title.trim() && !CATEGORIES.includes(prev.title) ? prev.title : ''
      const custom_needed = c === 'Other' || c === 'Agricultural Services'
      return { ...prev, category: c, title: custom_needed ? custom : custom || c }
    })
  }

  const stepError = (): string => {
    if (step === 1) {
      if (!f.category) return 'Please choose what you are looking for.'
      if (needsCustomName && !f.title.trim()) return 'Please type the product or service you need.'
    }
    if (step === 2) {
      if (!f.title.trim()) return 'Please enter the product or service name.'
      if (!isService && !(Number(f.quantity) > 0)) return 'Please enter the quantity you need.'
    }
    if (step === 3 && f.sourceScope !== 'anywhere' && !f.sourceLocation.trim()) return 'Please enter the preferred source location, or choose "Any available location".'
    if (step === 4) {
      if (!f.destCountry.trim()) return 'Please enter the destination country.'
      if (!f.destCity.trim()) return 'Please enter the destination city.'
    }
    if (step === 5 && !f.noBudget) {
      const min = Number(f.budgetMin)
      const max = Number(f.budgetMax)
      if (!(min > 0) && !(max > 0)) return 'Enter a minimum or maximum budget, or choose "No fixed budget".'
      if (min > 0 && max > 0 && min > max) return 'Minimum budget cannot be higher than maximum.'
    }
    if (step === 6 && f.deadlineType === 'date' && !f.deadlineDate) return 'Please choose the date.'
    return ''
  }

  const next = () => {
    const e = stepError()
    if (e) { setError(e); return }
    setError('')
    setStep((s) => Math.min(TOTAL_STEPS, s + 1))
  }

  const back = () => {
    setError('')
    if (step === 1) navigate(-1)
    else setStep((s) => s - 1)
  }

  const submit = async () => {
    if (!user || submitting) return
    setSubmitting(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('farm_desk_requests')
      .insert({
        customer_id: user.id,
        title: f.title.trim(),
        category: f.category.toLowerCase(),
        description: f.description.trim() || null,
        quantity: f.quantity ? Number(f.quantity) : null,
        unit: f.quantity ? f.unit : null,
        source_scope: f.sourceScope,
        source_location: f.sourceScope === 'anywhere' ? null : f.sourceLocation.trim(),
        dest_country: f.destCountry.trim(),
        dest_state: f.destState.trim() || null,
        dest_city: f.destCity.trim(),
        delivery_note: f.deliveryNote.trim() || null,
        no_fixed_budget: f.noBudget,
        budget_min: !f.noBudget && f.budgetMin ? Number(f.budgetMin) : null,
        budget_max: !f.noBudget && f.budgetMax ? Number(f.budgetMax) : null,
        currency: f.currency,
        deadline_type: f.deadlineType,
        deadline_date: f.deadlineType === 'date' ? f.deadlineDate : null,
        requirements: f.requirements.trim() || null,
        marketplace_listing_id: listingId || null,
      })
      .select('id, request_code')
      .single()

    setSubmitting(false)

    if (insertError || !data) {
      const msg = insertError?.message || ''
      if (/network|failed to fetch/i.test(msg)) setError('No internet connection. Check your network and try again.')
      else if (/cannot create/i.test(msg)) setError('Your account cannot create Farm Desk requests right now.')
      else setError('Could not submit your request. Please try again.')
      return
    }
    setCreated({ id: data.id, code: data.request_code })
  }

  // ---------- Success screen ----------
  if (created) {
    return (
      <div style={{ minHeight: '100vh', background: FD.bg, maxWidth: '480px', margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '36px', background: FD.green, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="checkCircle" size={38} color="white" />
        </div>
        <p style={{ fontSize: '20px', fontWeight: 800, color: FD.text, marginTop: '20px' }}>Request submitted</p>
        <p style={{ fontSize: '12.5px', color: FD.textMuted, marginTop: '6px', lineHeight: 1.5 }}>
          Farmxie has received your request and will start reviewing it. Keep your request ID for reference.
        </p>
        <div style={{ background: FD.card, border: `1px solid ${FD.border}`, borderRadius: '14px', padding: '16px', margin: '22px 0' }}>
          <p style={{ fontSize: '11px', color: FD.textMuted, fontWeight: 700 }}>REQUEST ID</p>
          <p style={{ fontSize: '22px', fontWeight: 800, color: FD.greenDark, marginTop: '4px', letterSpacing: '0.5px' }}>{created.code}</p>
        </div>
        <div onClick={() => navigate(`/farm-desk/${created.id}`, { replace: true })} style={{ background: FD.green, color: 'white', borderRadius: '12px', padding: '13px', fontSize: '13.5px', fontWeight: 800, cursor: 'pointer' }}>
          View Request
        </div>
        <div onClick={() => navigate('/farm-desk', { replace: true })} style={{ marginTop: '10px', border: `1px solid ${FD.border}`, background: FD.card, color: FD.text, borderRadius: '12px', padding: '13px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>
          Back to Farm Desk
        </div>
      </div>
    )
  }

  // ---------- Wizard ----------
  const scopeMeta = SOURCE_SCOPES.find((s) => s.key === f.sourceScope)

  return (
    <div style={{ height: '100dvh', background: FD.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: FD.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px 10px' }}>
          <div onClick={back} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={22} color={FD.text} />
          </div>
          <p style={{ fontSize: '16px', fontWeight: 800, color: FD.text, flex: 1 }}>New Request</p>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: FD.textMuted }}>Step {step} of {TOTAL_STEPS}</span>
        </div>
        <div style={{ height: '4px', background: FD.border }}>
          <div style={{ height: '100%', width: `${(step / TOTAL_STEPS) * 100}%`, background: FD.green, transition: 'width .25s' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {step === 1 && (
          <Section title="What are you looking for?" hint="Choose a category, or pick Other to type your own.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CATEGORIES.map((c) => (
                <Chip key={c} active={f.category === c} onClick={() => pickCategory(c)}>{c}</Chip>
              ))}
            </div>
            {needsCustomName && (
              <div style={{ marginTop: '16px' }}>
                <Label>{f.category === 'Other' ? 'Product or service' : 'Which service?'}</Label>
                <Input value={f.title} onChange={(v) => set('title', v)} placeholder={f.category === 'Other' ? 'e.g. Groundnut oil' : 'e.g. Tractor hire, veterinary service'} />
              </div>
            )}
          </Section>
        )}

        {step === 2 && (
          <Section title="Tell us the details" hint="The more specific you are, the faster Farmxie can find it.">
            <Label>Product / service name</Label>
            <Input value={f.title} onChange={(v) => set('title', v)} placeholder="e.g. White maize" />

            <Label top>Description (optional)</Label>
            <Textarea value={f.description} onChange={(v) => set('description', v)} placeholder='e.g. "White maize, food grade."' />

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <div style={{ flex: 1 }}>
                <Label>Quantity{isService ? ' (optional)' : ''}</Label>
                <Input value={f.quantity} onChange={(v) => set('quantity', v.replace(/[^0-9.]/g, ''))} placeholder="500" inputMode="decimal" />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Unit</Label>
                <Select value={f.unit} onChange={(v) => set('unit', v)} options={UNITS} />
              </div>
            </div>
          </Section>
        )}

        {step === 3 && (
          <Section title="Where should Farmxie look?" hint="This is a preference. You can leave it open.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SOURCE_SCOPES.map((s) => (
                <Radio key={s.key} active={f.sourceScope === s.key} onClick={() => set('sourceScope', s.key)}>{s.label}</Radio>
              ))}
            </div>
            {f.sourceScope !== 'anywhere' && (
              <div style={{ marginTop: '14px' }}>
                <Label>Preferred location</Label>
                <Input value={f.sourceLocation} onChange={(v) => set('sourceLocation', v)} placeholder={scopeMeta?.placeholder} />
              </div>
            )}
          </Section>
        )}

        {step === 4 && (
          <Section title="Where should the goods go?" hint="A general destination is enough. Do not enter a private address.">
            <Label>Country</Label>
            <Input value={f.destCountry} onChange={(v) => set('destCountry', v)} placeholder="Nigeria" />
            <Label top>State / Region (optional)</Label>
            <Input value={f.destState} onChange={(v) => set('destState', v)} placeholder="Kaduna State" />
            <Label top>City</Label>
            <Input value={f.destCity} onChange={(v) => set('destCity', v)} placeholder="Kaduna" />
            <Label top>Delivery note (optional)</Label>
            <Textarea value={f.deliveryNote} onChange={(v) => set('deliveryNote', v)} placeholder="e.g. Near the main market, truck access needed" rows={2} />
          </Section>
        )}

        {step === 5 && (
          <Section title="What is your budget?" hint="Optional. You do not have to give a budget.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Radio active={f.noBudget} onClick={() => set('noBudget', true)}>No fixed budget</Radio>
              <Radio active={!f.noBudget} onClick={() => set('noBudget', false)}>I have a budget</Radio>
            </div>
            {!f.noBudget && (
              <div style={{ marginTop: '14px' }}>
                <Label>Currency</Label>
                <Select value={f.currency} onChange={(v) => set('currency', v)} options={CURRENCIES} />
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <Label>Minimum</Label>
                    <Input value={f.budgetMin} onChange={(v) => set('budgetMin', v.replace(/[^0-9.]/g, ''))} placeholder="0" inputMode="decimal" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Label>Maximum</Label>
                    <Input value={f.budgetMax} onChange={(v) => set('budgetMax', v.replace(/[^0-9.]/g, ''))} placeholder="5000000" inputMode="decimal" />
                  </div>
                </div>
              </div>
            )}
          </Section>
        )}

        {step === 6 && (
          <Section title="When do you need it?" hint="Optional.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {DEADLINES.map((d) => (
                <Radio key={d.key} active={f.deadlineType === d.key} onClick={() => set('deadlineType', d.key)}>{d.label}</Radio>
              ))}
            </div>
            {f.deadlineType === 'date' && (
              <div style={{ marginTop: '14px' }}>
                <Label>Date</Label>
                <input
                  type="date"
                  value={f.deadlineDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => set('deadlineDate', e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}
          </Section>
        )}

        {step === 7 && (
          <Section title="Anything else Farmxie should know?" hint="Optional.">
            <Textarea
              value={f.requirements}
              onChange={(v) => set('requirements', v)}
              placeholder="e.g. Must be wholesale quality. Need a verified supplier. Prefer direct farmers. Need a company invoice."
              rows={6}
            />
          </Section>
        )}

        {step === 8 && (
          <Section title="Review your request" hint="Check everything before submitting.">
            <div style={{ background: FD.card, border: `1px solid ${FD.border}`, borderRadius: '14px', padding: '4px 14px' }}>
              <ReviewRow label="Product / service" value={f.title} />
              <ReviewRow label="Category" value={f.category} />
              {f.description && <ReviewRow label="Description" value={f.description} />}
              <ReviewRow label="Quantity" value={f.quantity ? `${Number(f.quantity).toLocaleString()} ${f.unit}` : '-'} />
              <ReviewRow label="Source" value={f.sourceScope === 'anywhere' ? 'Any available location' : f.sourceLocation} />
              <ReviewRow label="Destination" value={[f.destCity, f.destState, f.destCountry].filter(Boolean).join(', ')} />
              <ReviewRow
                label="Budget"
                value={
                  f.noBudget
                    ? 'No fixed budget'
                    : [f.budgetMin && `Min ${money(Number(f.budgetMin), f.currency)}`, f.budgetMax && `Max ${money(Number(f.budgetMax), f.currency)}`].filter(Boolean).join(' · ')
                }
              />
              <ReviewRow
                label="Deadline"
                value={f.deadlineType === 'date' ? f.deadlineDate : DEADLINES.find((d) => d.key === f.deadlineType)?.label || '-'}
              />
              <ReviewRow label="Requirements" value={f.requirements || '-'} last />
            </div>
          </Section>
        )}

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginTop: '16px' }}>
            <p style={{ fontSize: '12px', color: '#DC2626' }}>{error}</p>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', background: FD.card, borderTop: `1px solid ${FD.border}`, flexShrink: 0 }}>
        {step < TOTAL_STEPS ? (
          <div onClick={next} style={{ background: FD.green, color: 'white', borderRadius: '12px', padding: '14px', textAlign: 'center', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}>
            Continue
          </div>
        ) : (
          <div onClick={submit} style={{ background: FD.green, color: 'white', borderRadius: '12px', padding: '14px', textAlign: 'center', fontSize: '14px', fontWeight: 800, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Submitting...' : 'Submit Farm Desk Request'}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- small UI pieces ----------
const inputStyle: CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: '12px', border: `1px solid ${FD.border}`,
  background: FD.card, fontSize: '14px', color: FD.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: '19px', fontWeight: 800, color: FD.text, lineHeight: 1.3 }}>{title}</p>
      {hint && <p style={{ fontSize: '12.5px', color: FD.textMuted, marginTop: '5px', marginBottom: '18px', lineHeight: 1.5 }}>{hint}</p>}
      {children}
    </div>
  )
}

function Label({ children, top }: { children: ReactNode; top?: boolean }) {
  return <p style={{ fontSize: '12px', fontWeight: 700, color: FD.text, marginBottom: '6px', marginTop: top ? '16px' : 0 }}>{children}</p>
}

function Input({ value, onChange, placeholder, inputMode }: { value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: 'decimal' | 'text' }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} style={inputStyle} />
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <div onClick={onClick} style={{ padding: '10px 16px', borderRadius: '22px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${active ? FD.green : FD.border}`, background: active ? '#DCFCE7' : FD.card, color: active ? FD.greenDark : FD.text }}>
      {children}
    </div>
  )
}

function Radio({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '12px', cursor: 'pointer', border: `1.5px solid ${active ? FD.green : FD.border}`, background: active ? '#F0FDF4' : FD.card }}>
      <div style={{ width: '20px', height: '20px', borderRadius: '10px', border: `2px solid ${active ? FD.green : '#BBF7D0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {active && <div style={{ width: '10px', height: '10px', borderRadius: '5px', background: FD.green }} />}
      </div>
      <span style={{ fontSize: '13.5px', fontWeight: 600, color: FD.text }}>{children}</span>
    </div>
  )
}

function ReviewRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${FD.bg}` }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: FD.textMuted }}>{label}</p>
      <p style={{ fontSize: '13.5px', color: FD.text, marginTop: '3px', lineHeight: 1.45, wordBreak: 'break-word' }}>{value || '-'}</p>
    </div>
  )
}
