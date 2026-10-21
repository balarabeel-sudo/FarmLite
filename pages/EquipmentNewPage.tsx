// "List Your Equipment": pick a type, then fill the matching multi-step form (sell / rent out / offer a service).
// The same page edits an existing listing at /equipment/:id/edit.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import ImageUploader from '../ImageUploader'
import { uploadDocument } from '../imageUpload'
import NetworkError from '../NetworkError'
import { formatMoney } from '../moneyUtils'
import { COLORS } from '../shared'
import {
  ConfirmSheet, MultiChips, PageHeader, Pill, PrimaryButton, SectionCard, SelectField, Stepper, TextField, YesNoField, FieldShell,
} from '../EquipmentFormKit'
import {
  CONDITION_OPTIONS, COUNTRIES, CURRENCIES, DOC_MAX_COUNT, DOC_MAX_MB, EQUIPMENT_CATEGORIES, EQUIP_SELECT, PRICE_MODES, RENT_UNITS, SELLER_TYPES,
  SERVICE_CATEGORIES, SPEC_FIELDS, STEPS, WEEKDAYS, emptyForm, formFromRow, pageTitleFor, prettyDate, sellerTypeLabel, stepErrors, stepOfField,
  toPayload, validateForm, TYPE_TO_KIND,
} from '../equipmentConfig'
import type { EquipmentRow, Errors, Form, Kind } from '../equipmentConfig'

const KINDS: { kind: Kind; title: string; desc: string; icon: string }[] = [
  { kind: 'sale', title: 'Sell Equipment', desc: 'Sell tractors, machinery, tools or spare parts to farmers and agricultural businesses.', icon: 'tag' },
  { kind: 'rent', title: 'Rent Out Equipment', desc: 'Let farmers and agricultural businesses rent your machinery by the hour, day, week or month.', icon: 'tractor' },
  { kind: 'service', title: 'Offer Equipment Services', desc: 'Offer repair, maintenance, installation or other technical support for farm equipment.', icon: 'wrench' },
]

export default function EquipmentNewPage() {
  const { kind: kindParam, id: editId } = useParams()
  const navigate = useNavigate()

  if (editId) return <Wizard key={`edit-${editId}`} editId={editId} />
  if (kindParam === 'sale' || kindParam === 'rent' || kindParam === 'service') return <Wizard key={kindParam} kind={kindParam} />

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <PageHeader title="List Your Equipment" onBack={() => navigate('/equipment')} />
      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5, marginBottom: '16px' }}>What would you like to do? Each option has its own short form.</p>
        {KINDS.map((k) => (
          <button key={k.kind} type="button" onClick={() => navigate(`/equipment/new/${k.kind}`)}
            style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', padding: '16px', marginBottom: '12px', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', fontFamily: 'inherit' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--fx-tint-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={k.icon} size={24} color={COLORS.green} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '14.5px', fontWeight: 800, color: COLORS.text }}>{k.title}</p>
              <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.45, marginTop: '3px' }}>{k.desc}</p>
            </div>
            <Icon name="chevronRight" size={18} color={COLORS.textMuted} />
          </button>
        ))}
      </div>
    </div>
  )
}

type Defaults = { name: string; phone: string; country: string; companies: { id: string; name: string }[]; imageCap: number }

function Wizard({ kind: kindProp, editId }: { kind?: Kind; editId?: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [kind, setKind] = useState<Kind>(kindProp || 'sale')
  const [form, setForm] = useState<Form>(() => emptyForm(kindProp || 'sale'))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [defaults, setDefaults] = useState<Defaults>({ name: '', phone: '', country: '', companies: [], imageCap: 5 })
  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState<'' | 'draft' | 'publish' | 'save'>('')
  const [uploading, setUploading] = useState(false)
  const [docBusy, setDocBusy] = useState(false)
  const [docError, setDocError] = useState('')
  const [done, setDone] = useState<{ id: string; status: string; title: string } | null>(null)
  const [leaveAsk, setLeaveAsk] = useState(false)
  const [dirty, setDirty] = useState(false)
  const submitting = useRef(false)
  const docInput = useRef<HTMLInputElement>(null)

  const isEdit = !!editId
  const steps = STEPS[kind]
  const last = steps.length - 1
  const isReview = step === last

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
    if (errors[key as string]) setErrors((e) => { const n = { ...e }; delete n[key as string]; return n })
  }

  // load profile defaults (and the listing when editing)
  const load = async () => {
    if (!user) return
    setLoading(true)
    setLoadError('')
    const [meRes, coRes, rowRes] = await Promise.all([
      supabase.from('profiles').select('full_name, phone, whatsapp, country, is_premium, premium_until').eq('user_id', user.id).maybeSingle(),
      supabase.from('companies').select('id, name').eq('owner_id', user.id),
      editId ? supabase.from('equipment').select(EQUIP_SELECT).eq('id', editId).eq('seller_id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
    ])
    if (rowRes.error) { setLoadError('Could not load this listing.'); setLoading(false); return }
    const me: any = meRes.data
    const premium = !!me?.is_premium && (!me?.premium_until || new Date(me.premium_until).getTime() > Date.now())
    const d: Defaults = {
      name: me?.full_name || '',
      phone: me?.whatsapp || me?.phone || '',
      country: me?.country || '',
      companies: ((coRes.data || []) as any[]).map((c) => ({ id: c.id, name: c.name })),
      imageCap: premium ? 10 : 5,
    }
    setDefaults(d)

    if (editId) {
      const row = rowRes.data as EquipmentRow | null
      if (!row) { setLoadError('This listing was not found, or it is not yours to edit.'); setLoading(false); return }
      const k = TYPE_TO_KIND[row.listing_type]
      setKind(k)
      setForm(formFromRow(row))
      setReached(STEPS[k].length - 1)
    } else {
      setForm((f) => ({
        ...f,
        sellerName: f.sellerName || d.name,
        whatsapp: f.whatsapp || d.phone,
        country: d.country && COUNTRIES.includes(d.country) ? d.country : f.country,
      }))
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [user, editId])

  // warn before the browser closes a half-filled form
  useEffect(() => {
    if (!dirty || done) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty, done])

  const goBack = () => {
    if (dirty && !done) { setLeaveAsk(true); return }
    leave()
  }
  const leave = () => navigate(isEdit ? '/equipment/mine' : kindProp ? '/equipment/new' : '/equipment')

  const next = () => {
    const all = validateForm(form, 'draft')
    // each step only checks its own fields; required-to-publish checks run on the review step
    const publishAll = validateForm(form, 'publish')
    const here = stepErrors(kind, step, { ...all, ...stepErrors(kind, step, publishAll) })
    if (Object.keys(here).length) { setErrors(here); scrollTop(); return }
    setErrors({})
    const n = Math.min(step + 1, last)
    setStep(n)
    setReached((r) => Math.max(r, n))
    scrollTop()
  }
  const back = () => { setErrors({}); setStep((s) => Math.max(0, s - 1)); scrollTop() }
  const jump = (i: number) => { setErrors({}); setStep(i); scrollTop() }
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  // ----- documents (sale only): validated here, stored in the same media bucket as photos
  const addDocs = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setDocError('')
    const room = DOC_MAX_COUNT - form.documents.length
    const picked = Array.from(files).slice(0, Math.max(room, 0))
    if (picked.length === 0) { setDocError(`You can attach up to ${DOC_MAX_COUNT} documents.`); return }
    for (const f of picked) {
      const okType = f.type === 'application/pdf' || f.type.startsWith('image/')
      if (!okType) { setDocError('Only PDF files and photos can be attached.'); return }
      if (f.size > DOC_MAX_MB * 1024 * 1024) { setDocError(`“${f.name}” is larger than ${DOC_MAX_MB} MB.`); return }
    }
    setDocBusy(true)
    const urls: string[] = []
    for (const f of picked) {
      try { urls.push(await uploadDocument(f, 'documents')) } catch (e: any) { setDocError(e?.message || 'A document failed to upload.') }
    }
    setDocBusy(false)
    if (urls.length) set('documents', [...form.documents, ...urls])
  }

  // ----- saving
  const save = async (mode: 'draft' | 'publish' | 'save') => {
    if (!user || submitting.current || uploading || docBusy) return
    setSubmitError('')

    const wantsLive = mode === 'publish' || (mode === 'save' && form.status !== 'draft')
    const errs = validateForm(form, wantsLive ? 'publish' : 'draft')
    if (Object.keys(errs).length) {
      setErrors(errs)
      const first = Object.keys(errs)[0]
      setStep(stepOfField(kind, first))
      setSubmitError(wantsLive ? 'Some details need your attention. Please fix the fields marked in red.' : 'Please fix the fields marked in red.')
      scrollTop()
      return
    }

    // a rental provider can say "not available right now": the listing is saved but hidden until switched on again
    let status = form.status
    if (mode === 'draft') status = 'draft'
    else if (mode === 'publish') status = kind === 'rent' && !form.availableForRent ? 'unavailable' : 'available'
    else if (kind === 'rent' && status !== 'draft' && status !== 'sold') status = form.availableForRent ? 'available' : 'unavailable'

    submitting.current = true
    setBusy(mode)
    const payload = toPayload(form, status)
    const res = isEdit
      ? await supabase.from('equipment').update(payload).eq('id', editId!).eq('seller_id', user.id).select('id, status').maybeSingle()
      : await supabase.from('equipment').insert({ ...payload, seller_id: user.id }).select('id, status').maybeSingle()
    submitting.current = false
    setBusy('')

    if (res.error || !res.data) {
      // nothing is shown as successful, and everything the person typed stays on screen
      setSubmitError(res.error?.message || 'Your listing could not be saved. Check your connection and try again.')
      scrollTop()
      return
    }
    setDirty(false)
    setDone({ id: (res.data as any).id, status: (res.data as any).status, title: form.name.trim() })
    scrollTop()
  }

  const companyOptions = useMemo(() => defaults.companies.map((c): [string, string] => [c.id, c.name]), [defaults.companies])

  if (loading) return <Shell title={pageTitleFor(kind)} onBack={() => navigate(-1)}><p style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '13px', padding: '40px 0' }}>Loading…</p></Shell>
  if (loadError) return <Shell title="Edit listing" onBack={() => navigate('/equipment/mine')}><NetworkError onRetry={load} /><p style={{ textAlign: 'center', fontSize: '12.5px', color: COLORS.red, marginTop: '8px' }}>{loadError}</p></Shell>

  if (done) {
    const live = done.status === 'available'
    const draftSaved = done.status === 'draft'
    return (
      <Shell title={pageTitleFor(kind)} onBack={() => navigate('/equipment/mine')}>
        <SectionCard>
          <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '28px', background: 'var(--fx-tint-green)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={28} color={COLORS.green} strokeWidth={3} />
            </div>
            <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, marginTop: '12px' }}>
              {draftSaved ? 'Draft saved' : isEdit ? 'Changes saved' : 'Listing submitted'}
            </p>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.5 }}>“{done.title}”</p>
            <div style={{ marginTop: '10px' }}><Pill text={live ? 'Status: Live' : draftSaved ? 'Status: Draft (only you can see it)' : done.status === 'sold' ? 'Status: Sold' : 'Status: Unavailable (hidden from buyers)'} tone={live ? 'green' : 'orange'} /></div>
            {live && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '10px', lineHeight: 1.5 }}>It is visible to everyone on the Equipment Marketplace now. Farmxie may hide listings that break the rules.</p>}
          </div>
        </SectionCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!draftSaved && <PrimaryButton onClick={() => navigate(`/equipment/${done.id}`)}>View Listing</PrimaryButton>}
          <PrimaryButton tone={draftSaved ? 'green' : 'ghost'} onClick={() => navigate('/equipment/mine')}>Manage My Listings</PrimaryButton>
          {!isEdit && <PrimaryButton tone="ghost" onClick={() => navigate('/equipment/new')}>List Another</PrimaryButton>}
        </div>
      </Shell>
    )
  }

  const titles = steps.map((s) => s.title)
  const key = steps[step].key
  const publishErrors = isReview ? validateForm(form, form.status === 'draft' || !isEdit ? 'publish' : 'publish') : {}
  const reviewProblems = Object.keys(publishErrors)

  return (
    <Shell title={isEdit ? 'Edit listing' : pageTitleFor(kind)} onBack={goBack}>
      <Stepper titles={titles} current={step} reached={reached} onJump={jump} />

      {submitError && (
        <div role="alert" style={{ background: 'var(--fx-tint-red2)', border: '1px solid var(--fx-bd-red)', borderRadius: '12px', padding: '12px', marginBottom: '14px' }}>
          <p style={{ fontSize: '12.5px', color: COLORS.red, fontWeight: 700, lineHeight: 1.45 }}>{submitError}</p>
        </div>
      )}

      {/* ---------------------------------------------------------------- SALE */}
      {kind === 'sale' && key === 'info' && (
        <SectionCard>
          <TextField id="name" label="Equipment name" required value={form.name} onChange={(v) => set('name', v)} error={errors.name} placeholder="e.g. Massey Ferguson 290 tractor" maxLength={100} />
          <SelectField id="category" label="Equipment category" required value={form.category} onChange={(v) => set('category', v)} options={EQUIPMENT_CATEGORIES} error={errors.category} />
          <TextField id="brand" label="Brand or manufacturer" value={form.brand} onChange={(v) => set('brand', v)} error={errors.brand} placeholder="e.g. Massey Ferguson" maxLength={100} />
          <TextField id="model" label="Model" value={form.model} onChange={(v) => set('model', v)} placeholder="e.g. MF 290" maxLength={100} />
          <TextField id="year" label="Year of manufacture" value={form.year} onChange={(v) => set('year', v.replace(/\D/g, '').slice(0, 4))} error={errors.year} inputMode="numeric" placeholder="e.g. 2019" />
          <SelectField id="cond" label="Equipment condition" required value={form.conditionKey} onChange={(v) => set('conditionKey', v)} options={CONDITION_OPTIONS.map((o): [string, string] => [o.key, o.label])} error={errors.conditionKey} />
          <TextField id="desc" label="Description" required rows={4} value={form.description} onChange={(v) => set('description', v)} error={errors.description} maxLength={2000} placeholder="What is it, how has it been used, what is included?" />
          <TextField id="features" label="Main features" rows={3} value={form.features} onChange={(v) => set('features', v)} maxLength={1000} placeholder="One feature per line, e.g. 4WD, power steering" />
          <SpecsFields form={form} set={set} />
        </SectionCard>
      )}
      {kind === 'sale' && key === 'media' && (
        <>
          <SectionCard title="Photos" subtitle="Clear photos help your equipment sell. The first photo is the cover — tap “Make cover” on another one to change it.">
            <PhotoField form={form} set={set} cap={defaults.imageCap} onBusy={setUploading} error={errors.images} />
          </SectionCard>
          <SectionCard title="Supporting documents (optional)" subtitle={`Receipts, inspection reports or manuals. PDF or photo, up to ${DOC_MAX_MB} MB each, ${DOC_MAX_COUNT} files at most. Documents are visible to anyone who opens the listing.`}>
            {form.documents.map((u, i) => (
              <div key={u} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '10px', background: COLORS.bg, marginBottom: '8px' }}>
                <Icon name="fileText" size={16} color={COLORS.green} />
                <a href={u} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: '12.5px', color: COLORS.text, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Document {i + 1}</a>
                <button type="button" aria-label={`Remove document ${i + 1}`} onClick={() => set('documents', form.documents.filter((x) => x !== u))} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}><Icon name="close" size={14} color={COLORS.red} /></button>
              </div>
            ))}
            {form.documents.length < DOC_MAX_COUNT && (
              <PrimaryButton tone="ghost" icon="upload" disabled={docBusy} onClick={() => docInput.current?.click()}>{docBusy ? 'Uploading…' : 'Add a document'}</PrimaryButton>
            )}
            <input ref={docInput} type="file" accept="application/pdf,image/*" multiple style={{ display: 'none' }} onChange={(e) => { addDocs(e.target.files); e.target.value = '' }} />
            {docError && <p role="alert" style={{ fontSize: '11.5px', color: COLORS.red, marginTop: '8px', fontWeight: 600 }}>{docError}</p>}
          </SectionCard>
        </>
      )}
      {kind === 'sale' && key === 'price' && (
        <SectionCard>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 2 }}><TextField id="price" label="Selling price" required value={form.price} onChange={(v) => set('price', v.replace(/[^0-9.]/g, ''))} error={errors.price} inputMode="decimal" placeholder="Total price" hint="The total price for one item." /></div>
            <div style={{ flex: 1 }}><SelectField id="cur" label="Currency" value={form.currency} onChange={(v) => set('currency', v || 'NGN')} options={CURRENCIES} error={errors.currency} placeholder="Currency" /></div>
          </div>
          <YesNoField label="Is the price negotiable?" value={form.negotiable} onChange={(v) => set('negotiable', v)} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}><TextField id="qty" label="Quantity available" required value={form.quantity} onChange={(v) => set('quantity', v.replace(/\D/g, ''))} error={errors.quantity} inputMode="numeric" /></div>
            <div style={{ flex: 1 }}><TextField id="minorder" label="Minimum order" value={form.minOrder} onChange={(v) => set('minOrder', v.replace(/\D/g, ''))} error={errors.minOrder} inputMode="numeric" placeholder="Optional" /></div>
          </div>
          <YesNoField label="Delivery available?" value={form.deliveryAvailable} onChange={(v) => set('deliveryAvailable', v)} />
          {form.deliveryAvailable && <TextField id="deldet" label="Delivery details" rows={2} value={form.deliveryDetails} onChange={(v) => set('deliveryDetails', v)} maxLength={500} placeholder="Areas covered, cost, how long it takes" />}
          <YesNoField label="Can buyers collect it (pickup)?" value={form.pickupAvailable} onChange={(v) => set('pickupAvailable', v)} />
          <TextField id="warranty" label="Warranty information" rows={2} value={form.warranty} onChange={(v) => set('warranty', v)} maxLength={500} placeholder="Optional, e.g. 6 months on the engine" />
        </SectionCard>
      )}
      {kind === 'sale' && key === 'place' && <LocationFields form={form} set={set} errors={errors} addressHint="Optional. This is shown to buyers — use a business location or landmark, not your private home address." />}
      {kind === 'sale' && key === 'seller' && (
        <SectionCard subtitle="We filled in what we already know from your Farmxie profile. Change anything that is not right for this listing.">
          <ContactFields form={form} set={set} errors={errors} kind={kind} companyOptions={companyOptions} />
          <TextField id="bizdesc" label="Business description" rows={3} value={form.businessDescription} onChange={(v) => set('businessDescription', v)} maxLength={1000} placeholder="Optional. Tell buyers about your business." />
        </SectionCard>
      )}

      {/* ---------------------------------------------------------------- RENT */}
      {kind === 'rent' && key === 'info' && (
        <>
          <SectionCard>
            <TextField id="name" label="Equipment name" required value={form.name} onChange={(v) => set('name', v)} error={errors.name} placeholder="e.g. John Deere tractor with plough" maxLength={100} />
            <SelectField id="category" label="Equipment category" required value={form.category} onChange={(v) => set('category', v)} options={EQUIPMENT_CATEGORIES} error={errors.category} />
            <TextField id="brand" label="Brand" value={form.brand} onChange={(v) => set('brand', v)} maxLength={100} placeholder="Optional" />
            <TextField id="model" label="Model" value={form.model} onChange={(v) => set('model', v)} maxLength={100} placeholder="Optional" />
            <SelectField id="cond" label="Condition" required value={form.conditionKey} onChange={(v) => set('conditionKey', v)} options={CONDITION_OPTIONS.map((o): [string, string] => [o.key, o.label])} error={errors.conditionKey} />
            <TextField id="desc" label="Description" required rows={4} value={form.description} onChange={(v) => set('description', v)} error={errors.description} maxLength={2000} placeholder="What it can do, attachments included, condition…" />
            <SpecsFields form={form} set={set} />
          </SectionCard>
          <SectionCard title="Equipment photos" subtitle="The first photo is the cover.">
            <PhotoField form={form} set={set} cap={defaults.imageCap} onBusy={setUploading} error={errors.images} />
          </SectionCard>
        </>
      )}
      {kind === 'rent' && key === 'price' && (
        <>
          <SectionCard title="Rental rate" subtitle="What you charge to rent the equipment.">
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 2 }}><TextField id="price" label="Rental rate" required value={form.price} onChange={(v) => set('price', v.replace(/[^0-9.]/g, ''))} error={errors.price} inputMode="decimal" /></div>
              <div style={{ flex: 1 }}><SelectField id="cur" label="Currency" value={form.currency} onChange={(v) => set('currency', v || 'NGN')} options={CURRENCIES} placeholder="Currency" /></div>
            </div>
            <SelectField id="unit" label="Charged" required value={form.unit} onChange={(v) => set('unit', v)} options={RENT_UNITS} error={errors.unit} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}><TextField id="minp" label={`Minimum period (${unitWord(form.unit)}s)`} value={form.minPeriod} onChange={(v) => set('minPeriod', v.replace(/\D/g, ''))} error={errors.minPeriod} inputMode="numeric" placeholder="Optional" /></div>
              <div style={{ flex: 1 }}><TextField id="maxp" label={`Maximum period (${unitWord(form.unit)}s)`} value={form.maxPeriod} onChange={(v) => set('maxPeriod', v.replace(/\D/g, ''))} error={errors.maxPeriod} inputMode="numeric" placeholder="Optional" /></div>
            </div>
          </SectionCard>
          <SectionCard title="Security deposit" subtitle="Separate from the rental rate. Farmxie does not collect or hold deposits — you and the renter agree on this between yourselves.">
            <TextField id="deposit" label="Security deposit amount" value={form.deposit} onChange={(v) => set('deposit', v.replace(/[^0-9.]/g, ''))} error={errors.deposit} inputMode="decimal" placeholder="Optional" prefix={form.currency} />
          </SectionCard>
          <SectionCard title="What is included">
            <YesNoField label="Operator included?" value={form.operatorIncluded} onChange={(v) => set('operatorIncluded', v)} />
            <YesNoField label="Fuel included?" value={form.fuelIncluded} onChange={(v) => set('fuelIncluded', v)} />
            <YesNoField label="Delivery available?" value={form.deliveryAvailable} onChange={(v) => set('deliveryAvailable', v)} />
            {form.deliveryAvailable && (
              <>
                <TextField id="deldet" label="Delivery options" rows={2} value={form.deliveryDetails} onChange={(v) => set('deliveryDetails', v)} maxLength={500} placeholder="Where you deliver, how it works" />
                <TextField id="transport" label="Transportation fee" value={form.transportFee} onChange={(v) => set('transportFee', v.replace(/[^0-9.]/g, ''))} error={errors.transportFee} inputMode="decimal" placeholder="Optional" prefix={form.currency} />
              </>
            )}
            <TextField id="maint" label="Maintenance responsibilities" rows={2} value={form.maintenance} onChange={(v) => set('maintenance', v)} maxLength={1000} placeholder="Optional. Who pays for repairs, servicing, damage?" />
          </SectionCard>
        </>
      )}
      {kind === 'rent' && key === 'avail' && (
        <SectionCard subtitle="These are the dates and times you type in. Farmxie does not have a live booking calendar yet, so renters will contact you to confirm.">
          <YesNoField label="Available for rental?" value={form.availableForRent} onChange={(v) => set('availableForRent', v)} hint="If you choose No, the listing is saved but hidden from renters until you switch it on." />
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}><TextField id="from" label="Available from" type="date" value={form.availableFrom} onChange={(v) => set('availableFrom', v)} error={errors.availableFrom} /></div>
            <div style={{ flex: 1 }}><TextField id="until" label="Available until" type="date" value={form.availableUntil} onChange={(v) => set('availableUntil', v)} error={errors.availableUntil} /></div>
          </div>
          <MultiChips label="Available days" options={WEEKDAYS} value={form.availableDays} onChange={(v) => set('availableDays', v)} hint="Leave empty if you are available every day." />
          <TextField id="hours" label="Operating hours" value={form.operatingHours} onChange={(v) => set('operatingHours', v)} maxLength={100} placeholder="e.g. 7am – 5pm" />
          <TextField id="notice" label="Booking notice" value={form.bookingNotice} onChange={(v) => set('bookingNotice', v)} maxLength={300} placeholder="e.g. Please ask at least 2 days before" />
        </SectionCard>
      )}
      {kind === 'rent' && key === 'place' && (
        <>
          <LocationFields form={form} set={set} errors={errors} addressHint="Optional. Shown to renters — use a business location or landmark, not your private home address." />
          <SectionCard>
            <TextField id="area" label="Service area" value={form.serviceArea} onChange={(v) => set('serviceArea', v)} maxLength={300} placeholder="Where you can bring or use the equipment" />
            <TextField id="pickloc" label="Equipment pickup location" value={form.pickupLocation} onChange={(v) => set('pickupLocation', v)} maxLength={300} placeholder="Where renters collect it, if they can" />
          </SectionCard>
        </>
      )}
      {kind === 'rent' && key === 'seller' && (
        <>
          <SectionCard subtitle="We filled in what we already know from your Farmxie profile.">
            <ContactFields form={form} set={set} errors={errors} kind={kind} companyOptions={companyOptions} />
          </SectionCard>
          <SectionCard title="About you (optional)">
            <TextField id="exp" label="Experience" value={form.experience} onChange={(v) => set('experience', v)} maxLength={500} placeholder="e.g. 8 years renting tractors in Kaduna" />
            <TextField id="opq" label="Operator qualifications" value={form.operatorQualifications} onChange={(v) => set('operatorQualifications', v)} maxLength={500} placeholder="If an operator is included" />
            <TextField id="extra" label="Additional service information" rows={3} value={form.extraInfo} onChange={(v) => set('extraInfo', v)} maxLength={1000} placeholder="Rental terms or anything else renters should know" />
          </SectionCard>
        </>
      )}

      {/* ---------------------------------------------------------------- SERVICE */}
      {kind === 'service' && key === 'info' && (
        <SectionCard>
          <TextField id="name" label="Service name" required value={form.name} onChange={(v) => set('name', v)} error={errors.name} placeholder="e.g. Tractor repair and servicing" maxLength={100} />
          <SelectField id="svc" label="Service category" required value={form.serviceCategory} onChange={(v) => set('serviceCategory', v)} options={SERVICE_CATEGORIES} error={errors.serviceCategory} />
          <TextField id="desc" label="Description" required rows={4} value={form.description} onChange={(v) => set('description', v)} error={errors.description} maxLength={2000} placeholder="What you do, how you work, what customers can expect" />
          <TextField id="brands" label="Equipment brands supported" value={form.brandsSupported} onChange={(v) => set('brandsSupported', v)} maxLength={300} placeholder="Optional, e.g. Massey Ferguson, John Deere, Kubota" />
          <TextField id="exp" label="Experience" value={form.experience} onChange={(v) => set('experience', v)} maxLength={500} placeholder="Optional, e.g. 10 years as a tractor mechanic" />
        </SectionCard>
      )}
      {kind === 'service' && key === 'price' && (
        <SectionCard subtitle="You do not need a fixed price. Choose “Request a Quote” if you price each job separately.">
          <SelectField id="mode" label="Pricing method" required value={form.priceMode} onChange={(v) => set('priceMode', v)} options={PRICE_MODES} error={errors.priceMode} />
          {form.priceMode && form.priceMode !== 'quote' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 2 }}><TextField id="price" label={form.priceMode === 'hourly' ? 'Rate per hour' : form.priceMode === 'starting' ? 'Starting price' : 'Price'} required value={form.price} onChange={(v) => set('price', v.replace(/[^0-9.]/g, ''))} error={errors.price} inputMode="decimal" /></div>
              <div style={{ flex: 1 }}><SelectField id="cur" label="Currency" value={form.currency} onChange={(v) => set('currency', v || 'NGN')} options={CURRENCIES} placeholder="Currency" /></div>
            </div>
          )}
          {form.priceMode === 'quote' && <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>Customers will see “Request a quote” and contact you for a price.</p>}
        </SectionCard>
      )}
      {kind === 'service' && key === 'place' && (
        <>
          <SectionCard>
            <TextField id="area" label="Service areas" required value={form.serviceArea} onChange={(v) => set('serviceArea', v)} error={errors.serviceArea} maxLength={300} placeholder="e.g. Kaduna, Zaria and nearby towns" />
          </SectionCard>
          <LocationFields form={form} set={set} errors={errors} addressLabel="Workshop or business location" addressHint="Optional. Shown to customers — use a business location or landmark, not your private home address." />
        </>
      )}
      {kind === 'service' && key === 'media' && (
        <>
          <SectionCard title="Service photos (optional)" subtitle="Your workshop, your tools or past work.">
            <PhotoField form={form} set={set} cap={defaults.imageCap} onBusy={setUploading} error={errors.images} />
          </SectionCard>
          <SectionCard title="Contact details" subtitle="We filled in what we already know from your Farmxie profile.">
            <ContactFields form={form} set={set} errors={errors} kind={kind} companyOptions={companyOptions} />
          </SectionCard>
        </>
      )}

      {/* ---------------------------------------------------------------- REVIEW */}
      {isReview && (
        <>
          {reviewProblems.length > 0 && (
            <div role="alert" style={{ background: 'var(--fx-tint-amber2)', border: '1px solid var(--fx-bd-amber)', borderRadius: '12px', padding: '12px', marginBottom: '14px' }}>
              <p style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--fx-amber-text)', marginBottom: '6px' }}>Before you can submit:</p>
              {reviewProblems.map((k) => (
                <button key={k} type="button" onClick={() => jump(stepOfField(kind, k))} style={{ display: 'block', textAlign: 'left', background: 'none', border: 'none', padding: '3px 0', fontSize: '12px', color: 'var(--fx-amber-text)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                  {publishErrors[k]}
                </button>
              ))}
            </div>
          )}
          <Preview form={form} kind={kind} companies={defaults.companies} onEdit={jump} />
          {!isEdit || form.status === 'draft' ? (
            <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.5, margin: '2px 2px 14px' }}>
              When you submit, your listing goes live straight away so buyers can see it. You can pause, edit or delete it any time from My Listings.
            </p>
          ) : null}
        </>
      )}

      {/* ---------------------------------------------------------------- BUTTONS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
        {!isReview ? (
          <PrimaryButton onClick={next} disabled={uploading || docBusy}>{uploading || docBusy ? 'Uploading…' : 'Continue'}</PrimaryButton>
        ) : isEdit && form.status !== 'draft' ? (
          <PrimaryButton onClick={() => save('save')} disabled={!!busy || uploading || reviewProblems.length > 0} icon="check">{busy === 'save' ? 'Saving…' : 'Save Changes'}</PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => save('publish')} disabled={!!busy || uploading || reviewProblems.length > 0} icon="upload">{busy === 'publish' ? 'Submitting…' : 'Submit Listing'}</PrimaryButton>
        )}
        {isReview && (!isEdit || form.status === 'draft') && (
          <PrimaryButton tone="ghost" onClick={() => save('draft')} disabled={!!busy || uploading}>{busy === 'draft' ? 'Saving…' : 'Save as Draft'}</PrimaryButton>
        )}
        {isReview && <PrimaryButton tone="ghost" onClick={() => jump(0)} disabled={!!busy}>Edit Details</PrimaryButton>}
        {step > 0 && <PrimaryButton tone="ghost" onClick={back} disabled={!!busy}>Back</PrimaryButton>}
        {!isReview && (!isEdit || form.status === 'draft') && (
          <button type="button" onClick={() => save('draft')} disabled={!!busy || uploading}
            style={{ background: 'none', border: 'none', padding: '8px', fontSize: '12.5px', fontWeight: 800, color: COLORS.green, cursor: 'pointer', fontFamily: 'inherit' }}>
            {busy === 'draft' ? 'Saving draft…' : 'Save as draft and finish later'}
          </button>
        )}
      </div>

      <ConfirmSheet open={leaveAsk} title="Leave without saving?" body="The details you entered on this form will be lost. You can save it as a draft first from the last step."
        confirmLabel="Leave" danger onConfirm={() => { setLeaveAsk(false); setDirty(false); leave() }} onCancel={() => setLeaveAsk(false)} />
    </Shell>
  )
}

function unitWord(u: string): string {
  return u === 'season' ? 'season' : u || 'day'
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '50px' }}>
      <PageHeader title={title} onBack={onBack} />
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

type SetFn = <K extends keyof Form>(key: K, value: Form[K]) => void

function PhotoField({ form, set, cap, onBusy, error }: { form: Form; set: SetFn; cap: number; onBusy: (b: boolean) => void; error?: string }) {
  return (
    <div>
      <ImageUploader value={form.images} onChange={(urls) => set('images', urls)} folder="equipment" max={cap} onBusyChange={onBusy} />
      {error && <p role="alert" style={{ fontSize: '11.5px', color: COLORS.red, marginTop: '6px', fontWeight: 600 }}>{error}</p>}
    </div>
  )
}

function SpecsFields({ form, set }: { form: Form; set: SetFn }) {
  const setSpec = (k: string, v: string) => set('specs', { ...form.specs, [k]: v })
  return (
    <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '14px', marginTop: '4px' }}>
      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, marginBottom: '2px' }}>Specifications (optional)</p>
      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '12px' }}>Fill in what applies. Empty fields are not shown to buyers.</p>
      {SPEC_FIELDS.map((s) =>
        s.select
          ? <SelectField key={s.key} id={`spec-${s.key}`} label={s.label} value={form.specs[s.key] || ''} onChange={(v) => setSpec(s.key, v)} options={s.select} placeholder="Not specified" />
          : <TextField key={s.key} id={`spec-${s.key}`} label={s.label} value={form.specs[s.key] || ''} onChange={(v) => setSpec(s.key, v)} placeholder={s.placeholder} maxLength={200} />,
      )}
    </div>
  )
}

function LocationFields({ form, set, errors, addressHint, addressLabel = 'Address or business location' }: { form: Form; set: SetFn; errors: Errors; addressHint: string; addressLabel?: string }) {
  return (
    <SectionCard title="Where is it?">
      <SelectField id="country" label="Country" required value={form.country} onChange={(v) => set('country', v)} options={COUNTRIES} error={errors.country} />
      <TextField id="state" label="State or region" required value={form.state} onChange={(v) => set('state', v)} error={errors.state} maxLength={80} placeholder="e.g. Kaduna" />
      <TextField id="city" label="City or town" required value={form.city} onChange={(v) => set('city', v)} error={errors.city} maxLength={80} placeholder="e.g. Zaria" />
      <TextField id="address" label={addressLabel} value={form.address} onChange={(v) => set('address', v)} maxLength={200} hint={addressHint} />
    </SectionCard>
  )
}

function ContactFields({ form, set, errors, kind, companyOptions }: { form: Form; set: SetFn; errors: Errors; kind: Kind; companyOptions: Option2[] }) {
  const label = kind === 'sale' ? 'Seller or business name' : 'Provider or business name'
  return (
    <>
      <TextField id="sname" label={label} required value={form.sellerName} onChange={(v) => set('sellerName', v)} error={errors.sellerName} maxLength={100} />
      <SelectField id="stype" label={kind === 'sale' ? 'Seller type' : 'Provider type'} value={form.sellerType} onChange={(v) => set('sellerType', v)} options={SELLER_TYPES[kind]} placeholder="Choose (optional)" />
      {companyOptions.length > 0 && (
        <SelectField id="company" label="List under a company" value={form.companyId} onChange={(v) => set('companyId', v)} options={companyOptions} placeholder="Just me (personal listing)" hint="Choose one of your Farmxie companies to show it on this listing." />
      )}
      <TextField id="phone" label="Contact phone (WhatsApp)" required value={form.whatsapp} onChange={(v) => set('whatsapp', v)} error={errors.whatsapp} inputMode="tel" placeholder="+2348012345678"
        hint="Shown on the listing so buyers can call or message you on WhatsApp. Include the country code." />
      <TextField id="bemail" label="Business email" type="email" inputMode="email" value={form.businessEmail} onChange={(v) => set('businessEmail', v)} error={errors.businessEmail} placeholder="Optional" maxLength={120} />
    </>
  )
}
type Option2 = [string, string]

// The full listing as buyers will see it (summary rows grouped by step, with an Edit link on each group)
function Preview({ form, kind, companies, onEdit }: { form: Form; kind: Kind; companies: { id: string; name: string }[]; onEdit: (step: number) => void }) {
  const f = form
  const cond = CONDITION_OPTIONS.find((o) => o.key === f.conditionKey)?.label
  const yn = (v: boolean | null) => (v === null ? '' : v ? 'Yes' : 'No')
  const money = (s: string) => (s ? formatMoney(Number(s), f.currency) : '')
  const company = companies.find((c) => c.id === f.companyId)?.name
  const specsText = SPEC_FIELDS.map((s) => (f.specs[s.key] ? `${s.label}: ${f.specs[s.key]}` : '')).filter(Boolean).join('\n')

  type Row = [string, string]
  const rate = kind === 'rent' ? `${money(f.price)} ${RENT_UNITS.find((u) => u[0] === f.unit)?.[1]?.toLowerCase() || ''}`.trim()
    : kind === 'service' ? (f.priceMode === 'quote' ? 'Request a quote' : `${f.priceMode === 'starting' ? 'From ' : ''}${money(f.price)}${f.priceMode === 'hourly' ? ' per hour' : ''}`)
    : money(f.price)

  const groups: { title: string; step: number; rows: Row[] }[] = []
  if (kind === 'sale') {
    groups.push({ title: 'Equipment', step: 0, rows: [['Name', f.name], ['Category', f.category], ['Brand', f.brand], ['Model', f.model], ['Year', f.year], ['Condition', cond || ''], ['Description', f.description], ['Main features', f.features], ['Specifications', specsText]] })
    groups.push({ title: 'Photos and documents', step: 1, rows: [['Photos', f.images.length ? `${f.images.length} added` : ''], ['Documents', f.documents.length ? `${f.documents.length} attached` : '']] })
    groups.push({ title: 'Price and sale', step: 2, rows: [['Selling price', rate], ['Negotiable', yn(f.negotiable)], ['Quantity', f.quantity], ['Minimum order', f.minOrder], ['Delivery', f.deliveryAvailable ? (f.deliveryDetails ? `Yes — ${f.deliveryDetails}` : 'Yes') : 'No'], ['Pickup', yn(f.pickupAvailable)], ['Warranty', f.warranty]] })
    groups.push({ title: 'Location', step: 3, rows: [['Country', f.country], ['State', f.state], ['City', f.city], ['Address', f.address]] })
    groups.push({ title: 'Seller', step: 4, rows: [['Name', f.sellerName], ['Type', sellerTypeLabel(f.sellerType)], ['Company', company || ''], ['Phone', f.whatsapp], ['Email', f.businessEmail], ['About', f.businessDescription]] })
  } else if (kind === 'rent') {
    groups.push({ title: 'Equipment', step: 0, rows: [['Name', f.name], ['Category', f.category], ['Brand', f.brand], ['Model', f.model], ['Condition', cond || ''], ['Description', f.description], ['Specifications', specsText], ['Photos', f.images.length ? `${f.images.length} added` : '']] })
    groups.push({ title: 'Rental pricing', step: 1, rows: [['Rental rate', rate], ['Security deposit', money(f.deposit) ? `${money(f.deposit)} (separate from the rate)` : ''], ['Minimum period', f.minPeriod ? `${f.minPeriod} ${unitWord(f.unit)}(s)` : ''], ['Maximum period', f.maxPeriod ? `${f.maxPeriod} ${unitWord(f.unit)}(s)` : ''], ['Operator included', yn(f.operatorIncluded)], ['Fuel included', yn(f.fuelIncluded)], ['Delivery', f.deliveryAvailable ? (f.deliveryDetails ? `Yes — ${f.deliveryDetails}` : 'Yes') : 'No'], ['Transportation fee', money(f.transportFee)], ['Maintenance', f.maintenance]] })
    groups.push({ title: 'Availability', step: 2, rows: [['Available for rental', yn(f.availableForRent)], ['From', prettyDate(f.availableFrom)], ['Until', prettyDate(f.availableUntil)], ['Days', f.availableDays.map((d) => WEEKDAYS.find((w) => w[0] === d)?.[1] || d).join(', ')], ['Hours', f.operatingHours], ['Booking notice', f.bookingNotice]] })
    groups.push({ title: 'Location', step: 3, rows: [['Country', f.country], ['State', f.state], ['City', f.city], ['Service area', f.serviceArea], ['Pickup location', f.pickupLocation], ['Address', f.address]] })
    groups.push({ title: 'Provider', step: 4, rows: [['Name', f.sellerName], ['Type', sellerTypeLabel(f.sellerType)], ['Company', company || ''], ['Phone', f.whatsapp], ['Email', f.businessEmail], ['Experience', f.experience], ['Operator qualifications', f.operatorQualifications], ['More information', f.extraInfo]] })
  } else {
    groups.push({ title: 'Service', step: 0, rows: [['Name', f.name], ['Category', f.serviceCategory], ['Description', f.description], ['Brands supported', f.brandsSupported], ['Experience', f.experience]] })
    groups.push({ title: 'Pricing', step: 1, rows: [['Pricing', PRICE_MODES.find((p) => p[0] === f.priceMode)?.[1] || ''], ['Price', rate]] })
    groups.push({ title: 'Areas and location', step: 2, rows: [['Service areas', f.serviceArea], ['Country', f.country], ['State', f.state], ['City', f.city], ['Workshop location', f.address]] })
    groups.push({ title: 'Photos and contact', step: 3, rows: [['Photos', f.images.length ? `${f.images.length} added` : ''], ['Name', f.sellerName], ['Type', sellerTypeLabel(f.sellerType)], ['Company', company || ''], ['Phone', f.whatsapp], ['Email', f.businessEmail]] })
  }

  return (
    <>
      {f.images[0] && (
        <div style={{ borderRadius: '16px', overflow: 'hidden', marginBottom: '14px', background: 'var(--fx-grey2)' }}>
          <img src={f.images[0]} alt="Cover" style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      {groups.map((g) => {
        const rows = g.rows.filter((r) => r[1])
        return (
          <SectionCard key={g.title}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text }}>{g.title}</p>
              <button type="button" onClick={() => onEdit(g.step)} style={{ background: 'none', border: 'none', color: COLORS.green, fontWeight: 800, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
            </div>
            {rows.length === 0 ? <p style={{ fontSize: '12px', color: COLORS.textMuted }}>Nothing added yet.</p> : rows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: '10px', padding: '6px 0', borderTop: `1px solid ${COLORS.border}` }}>
                <p style={{ width: '38%', flexShrink: 0, fontSize: '12px', color: COLORS.textMuted }}>{k}</p>
                <p style={{ flex: 1, fontSize: '12.5px', color: COLORS.text, fontWeight: 600, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</p>
              </div>
            ))}
          </SectionCard>
        )
      })}
    </>
  )
}

// keeps FieldShell referenced for tree-shaking-safe type exports
export { FieldShell }
