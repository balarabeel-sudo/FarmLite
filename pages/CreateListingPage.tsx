import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import Icon from '../Icons'
import ImageUploader from '../ImageUploader'
import { fetchLimits } from '../premiumShared'
import {
  CATEGORIES, TYPE_FIELD, DETAIL_FIELDS, USES_QUANTITY, UNITS, CURRENCIES, COUNTRIES,
  categoryLabel, detailRows, unitText,
} from '../listingConfig'
import type { CategoryKey, FieldDef } from '../listingConfig'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
  gold: '#B8860B',
}

const STEPS = ['Category', 'Info', 'Details', 'Media', 'Pricing', 'Review']

type PriceType = 'fixed' | 'negotiable' | 'contact'
type Status = 'available' | 'sold' | 'inactive'

type FormState = {
  step: number
  category: CategoryKey | ''
  type: string
  customType: string
  title: string
  description: string
  details: Record<string, string>
  images: string[]
  priceType: PriceType
  price: string
  currency: string
  unit: string
  quantity: string
  minOrder: string
  freeDelivery: boolean
  country: string
  state: string
  city: string
  area: string
  companyId: string | null
  status: Status
}

const EMPTY: FormState = {
  step: 0, category: '', type: '', customType: '', title: '', description: '', details: {}, images: [],
  priceType: 'fixed', price: '', currency: 'NGN', unit: '', quantity: '', minOrder: '', freeDelivery: false,
  country: '', state: '', city: '', area: '', companyId: null, status: 'available',
}

type Usage = { used: number; limit: number; premium: boolean }

const ICON_PATHS: Record<string, ReactNode> = {
  leaf: <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l8-8" />,
  paw: <><circle cx="7" cy="9" r="1.8" /><circle cx="12" cy="6.5" r="1.8" /><circle cx="17" cy="9" r="1.8" /><path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.5 2.5 3 2s1.5-.5 2-.5 .5.5 2 .5 3-1 3-2.5c0-2-2-4-5-4z" /></>,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" />,
  sprout: <path d="M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6M12 15c0-3-2-5-6-5 0 3 2 5 6 5" />,
  box: <><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  handshake: <path d="M3 12l4-4 4 2 4-2 6 5-5 5-3-2-3 2-4-3zM7 8l-4 4" />,
  grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
}

function CatIcon({ name, size = 22, color = COLORS.greenDark }: { name: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name] || ICON_PATHS.grid}
    </svg>
  )
}

export default function CreateListingPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const { user } = useAuth()
  const { currency: appCurrency } = useLocale() as { currency?: string }

  const editing = !!editId
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limitHit, setLimitHit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [done, setDone] = useState<{ id: string; updated: boolean } | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [imageCap, setImageCap] = useState(5)
  const [draft, setDraft] = useState<FormState | null>(null)
  const [myCompany, setMyCompany] = useState<{ id: string; name: string } | null>(null)
  const [sellerName, setSellerName] = useState('')
  const topRef = useRef<HTMLDivElement>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setDetail = (key: string, value: string) => setForm((f) => ({ ...f, details: { ...f.details, [key]: value } }))

  // ---------- load ----------
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [profileRes, companyRes, limits] = await Promise.all([
        supabase.from('profiles').select('full_name, username, is_premium, premium_until, country').eq('user_id', user.id).maybeSingle(),
        supabase.from('companies').select('id, name').eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1),
        fetchLimits(),
      ])
      const p = profileRes.data as any
      setSellerName(p?.full_name || p?.username || 'You')
      setMyCompany(companyRes.data && companyRes.data.length ? (companyRes.data[0] as any) : null)
      const premium = !!p?.is_premium && (!p?.premium_until || new Date(p.premium_until).getTime() > Date.now())
      const cap = limits['listing_images']
      setImageCap(cap ? (premium ? cap.premium : cap.free) : premium ? 10 : 5)

      const base: FormState = {
        ...EMPTY,
        currency: appCurrency && CURRENCIES.includes(appCurrency) ? appCurrency : 'NGN',
        country: p?.country || '',
      }

      if (editId) {
        const { data } = await supabase.from('marketplace_listings').select('*').eq('id', editId).eq('seller_id', user.id).maybeSingle()
        if (!data) {
          setError('This listing could not be found.')
          setLoading(false)
          return
        }
        const l = data as any
        const d = (l.details || {}) as Record<string, any>
        const loc = (d.loc || {}) as Record<string, string>
        const cat = l.category as CategoryKey
        const knownTypes = TYPE_FIELD[cat]?.options || []
        const sub = l.subcategory || ''
        const { loc: _loc, min_order, ...detailFields } = d
        setForm({
          ...base,
          step: 1,
          category: cat,
          type: cat === 'other' ? '' : knownTypes.includes(sub) ? sub : sub ? 'Other' : '',
          customType: cat === 'other' ? sub : knownTypes.includes(sub) ? '' : sub,
          title: l.title || '',
          description: l.description || '',
          details: { ...detailFields, ...(l.condition && !detailFields.condition ? { condition: l.condition } : {}) } as Record<string, string>,
          images: l.images || [],
          priceType: l.contact_for_price ? 'contact' : l.negotiable ? 'negotiable' : 'fixed',
          price: l.contact_for_price ? '' : String(l.price),
          currency: l.currency || base.currency,
          unit: l.unit || '',
          quantity: l.quantity != null ? String(l.quantity) : '',
          minOrder: min_order ? String(min_order) : '',
          freeDelivery: !!l.free_delivery,
          country: loc.country || base.country,
          state: loc.state || '',
          city: loc.city || (!loc.country ? l.location || '' : ''),
          area: loc.area || '',
          companyId: l.company_id || null,
          status: l.status,
        })
      } else {
        setForm(base)
        const { data: dr } = await supabase.from('listing_drafts').select('data').eq('user_id', user.id).maybeSingle()
        if (dr?.data) setDraft(dr.data as FormState)
      }
      setLoading(false)
    })()
  }, [user, editId])

  // Active listings usage ("2 / 3 listings")
  useEffect(() => {
    if (!user) return
    supabase.rpc('listing_usage', { p_company: form.companyId }).then(({ data }) => {
      if (data) setUsage(data as Usage)
    })
  }, [user, form.companyId, done])

  const atLimit = !!usage && usage.used >= usage.limit && (!editing || form.status !== 'available')

  const cat = form.category as CategoryKey | ''
  const typeCfg = cat ? TYPE_FIELD[cat] : null
  const finalType = cat === 'other' ? form.customType.trim() : form.type === 'Other' ? form.customType.trim() || 'Other' : form.type
  const units = cat ? UNITS[cat] : []
  const usesQty = cat ? USES_QUANTITY[cat] : false

  const visibleFields = useMemo(
    () => (cat ? DETAIL_FIELDS[cat].filter((f) => !f.showIf || f.showIf(form.details)) : []),
    [cat, form.details],
  )

  // ---------- validation ----------
  const validate = (step: number): string | null => {
    if (step === 0 && !cat) return 'Choose what you are listing.'
    if (step === 1) {
      if (cat === 'other' ? !form.customType.trim() : !form.type) return `Choose the ${typeCfg?.label.toLowerCase() || 'type'}.`
      if (form.type === 'Other' && cat !== 'other' && !form.customType.trim()) return 'Type the name of the item.'
      if (form.title.trim().length < 3) return 'Enter a title.'
      if (form.description.trim().length < 10) return 'Add a short description (at least 10 characters).'
    }
    if (step === 2) {
      for (const f of visibleFields) if (f.required && !(form.details[f.key] || '').trim()) return `${f.label} is required.`
    }
    if (step === 3 && form.images.length === 0) return 'Add at least one photo of the actual item.'
    if (step === 4) {
      if (form.priceType !== 'contact') {
        const n = Number(form.price)
        if (form.price.trim() === '' || Number.isNaN(n) || n <= 0) return 'Enter a valid price.'
        if (units.length > 0 && cat !== 'services' && !form.unit) return 'Choose a unit.'
      }
      if (usesQty && form.quantity.trim() !== '' && (Number.isNaN(Number(form.quantity)) || Number(form.quantity) < 0)) return 'Enter a valid quantity.'
      if (usesQty && form.quantity.trim() !== '' && !form.unit) return 'Choose a unit for the quantity.'
      if (!form.country) return 'Choose the country.'
      if (!form.state.trim()) return 'Enter the state or province.'
      if (!form.city.trim()) return 'Enter the city or town.'
    }
    return null
  }

  const goTo = (step: number) => {
    set('step', step)
    setError(null)
    topRef.current?.scrollIntoView({ block: 'start' })
  }

  const next = () => {
    const e = validate(form.step)
    if (e) return setError(e)
    goTo(form.step + 1)
  }

  const back = () => {
    if (form.step === 0 || (editing && form.step === 1)) return navigate(-1)
    goTo(form.step - 1)
  }

  const pickCategory = (key: CategoryKey) => {
    if (key !== form.category) {
      // different category = different fields, so start those parts clean
      setForm((f) => ({ ...f, category: key, type: '', customType: '', details: {}, unit: '', quantity: '', minOrder: '' }))
    }
    setError(null)
    goTo(1)
  }

  // ---------- drafts ----------
  const saveDraft = async () => {
    if (!user) return
    const { error: e } = await supabase.from('listing_drafts').upsert({ user_id: user.id, data: form, updated_at: new Date().toISOString() })
    if (e) return setError('Could not save the draft. Try again.')
    setToast('Draft saved ✓')
    setTimeout(() => setToast(null), 2200)
  }

  const discardDraft = async () => {
    if (!user) return
    await supabase.from('listing_drafts').delete().eq('user_id', user.id)
    setDraft(null)
  }

  // ---------- publish ----------
  const buildPayload = () => {
    const details: Record<string, any> = {}
    visibleFields.forEach((f) => {
      const v = (form.details[f.key] || '').trim()
      if (v) details[f.key] = v
    })
    if (usesQty && form.minOrder.trim()) details.min_order = Number(form.minOrder)
    details.loc = { country: form.country, state: form.state.trim(), city: form.city.trim(), area: form.area.trim() }
    const contact = form.priceType === 'contact'
    return {
      category: cat,
      subcategory: finalType || null,
      condition: cat === 'equipment' ? form.details.condition || null : null,
      title: form.title.trim(),
      description: form.description.trim(),
      price: contact ? 0 : Number(form.price),
      currency: form.currency,
      unit: contact ? null : form.unit || null,
      quantity: usesQty && form.quantity.trim() !== '' ? Number(form.quantity) : null,
      location: [form.area.trim(), form.city.trim(), form.state.trim(), form.country].filter(Boolean).join(', '),
      negotiable: form.priceType === 'negotiable',
      contact_for_price: contact,
      free_delivery: form.freeDelivery,
      images: form.images,
      details,
      company_id: form.companyId,
      status: editing ? form.status : 'available',
    }
  }

  const publish = async () => {
    if (!user) return
    for (let s = 1; s <= 4; s++) {
      const e = validate(s)
      if (e) {
        goTo(s)
        return setError(e)
      }
    }
    setBusy(true)
    setError(null)
    setLimitHit(false)
    const payload = buildPayload()
    if (editing) {
      const { error: e } = await supabase.from('marketplace_listings').update(payload).eq('id', editId).eq('seller_id', user.id)
      setBusy(false)
      if (e) {
        setLimitHit((e as any).hint === 'listing_limit')
        return setError(e.message || 'Could not save your changes.')
      }
      setDone({ id: editId!, updated: true })
      return
    }
    const { data, error: e } = await supabase.from('marketplace_listings').insert({ ...payload, seller_id: user.id }).select('id').single()
    setBusy(false)
    if (e || !data) {
      setLimitHit((e as any)?.hint === 'listing_limit')
      return setError(e?.message || 'Could not publish your listing.')
    }
    await supabase.from('listing_drafts').delete().eq('user_id', user.id)
    setDone({ id: (data as any).id, updated: false })
  }

  // ---------- render ----------
  if (loading) {
    return <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: COLORS.textMuted }}>Loading…</div>
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: 480, margin: '0 auto', padding: '70px 20px', textAlign: 'center' }}>
        <div style={{ width: 66, height: 66, borderRadius: 33, background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Icon name="check" size={32} color="white" strokeWidth={3} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>{done.updated ? 'Changes saved ✓' : 'Listing Published ✓'}</h2>
        <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '6px 0 24px' }}>{done.updated ? 'Your listing was updated.' : 'Your listing is now live on Farmxie Marketplace.'}</p>
        <Btn label="View Listing" onClick={() => navigate(`/listing/${done.id}`, { replace: true })} />
        {!done.updated && <Btn ghost label="Create Another Listing" onClick={() => { setDone(null); setForm({ ...EMPTY, currency: form.currency, country: form.country, companyId: form.companyId }) }} />}
        <Btn ghost label="Back to Marketplace" onClick={() => navigate('/marketplace', { replace: true })} />
      </div>
    )
  }

  const reviewRows = detailRows(cat || 'other', form.details, form.details.condition)

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: 560, margin: '0 auto', paddingBottom: 110 }}>
      <div ref={topRef} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={back} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={22} color={COLORS.text} /></div>
        <p style={{ flex: 1, fontSize: 16, fontWeight: 800, color: COLORS.text }}>{editing ? 'Edit Listing' : 'Create Listing'}</p>
        {usage && (
          <span style={{ fontSize: 11, fontWeight: 700, color: usage.used >= usage.limit ? '#92400E' : COLORS.greenDark, background: usage.used >= usage.limit ? '#FEF3C7' : COLORS.greenSoft, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>
            {usage.used} / {usage.limit} listings
          </span>
        )}
      </div>

      <div style={{ padding: 16 }}>
        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          {STEPS.map((s, i) => {
            const active = i === form.step
            const reached = i < form.step
            const clickable = reached && !(editing && i === 0)
            return (
              <div key={s} onClick={clickable ? () => goTo(i) : undefined} style={{ flex: 1, textAlign: 'center', cursor: clickable ? 'pointer' : 'default' }}>
                <div style={{ width: 22, height: 22, borderRadius: 11, margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, background: active || reached ? COLORS.green : COLORS.card, color: active || reached ? 'white' : COLORS.textMuted, border: `1.5px solid ${active || reached ? COLORS.green : COLORS.border}` }}>
                  {reached ? <Icon name="check" size={12} color="white" strokeWidth={3} /> : i + 1}
                </div>
                <p style={{ fontSize: 9.5, fontWeight: active ? 800 : 600, color: active ? COLORS.text : COLORS.textMuted }}>{s}</p>
              </div>
            )
          })}
        </div>

        {/* Limit notice */}
        {atLimit && (
          <div style={{ background: '#FEF3C7', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>
              You've reached your {usage?.premium ? 'Premium' : 'Free'} listing limit.
            </p>
            <p style={{ fontSize: 12, color: '#92400E', margin: '4px 0 10px', lineHeight: 1.5 }}>
              {usage?.premium
                ? 'Mark a listing as sold or hidden to add a new one. You can still save this as a draft.'
                : 'Upgrade to Premium to create more listings. You can still save this as a draft.'}
            </p>
            {!usage?.premium && (
              <div onClick={() => navigate('/premium')} style={{ display: 'inline-block', background: COLORS.green, color: 'white', borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>Upgrade to Premium</div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
            <p style={{ fontSize: 12.5, color: COLORS.red, lineHeight: 1.5 }}>{error}</p>
            {limitHit && !usage?.premium && (
              <div onClick={() => navigate('/premium')} style={{ display: 'inline-block', marginTop: 8, background: COLORS.green, color: 'white', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Upgrade to Premium</div>
            )}
          </div>
        )}

        {/* STEP 0: category */}
        {form.step === 0 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>What are you listing?</h2>
            <p style={{ fontSize: 12.5, color: COLORS.textMuted, margin: '4px 0 14px' }}>Add your product, livestock, equipment or agricultural service to Farmxie Marketplace.</p>

            {draft && (
              <div style={{ background: COLORS.greenSoft, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: COLORS.greenDark }}>You have a saved draft</p>
                <p style={{ fontSize: 12, color: COLORS.text, margin: '3px 0 10px' }}>{draft.title || 'Untitled listing'}{draft.category ? ` · ${categoryLabel(draft.category)}` : ''}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={() => { setForm({ ...draft, status: 'available' }); setDraft(null) }} style={{ flex: 1, textAlign: 'center', background: COLORS.green, color: 'white', borderRadius: 10, padding: 9, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>Continue draft</div>
                  <div onClick={discardDraft} style={{ flex: 1, textAlign: 'center', background: COLORS.card, color: COLORS.red, border: '1px solid #FECACA', borderRadius: 10, padding: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Discard draft</div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {CATEGORIES.map((c) => (
                <div key={c.key} onClick={() => pickCategory(c.key)} style={{ background: COLORS.card, border: `2px solid ${form.category === c.key ? COLORS.green : COLORS.border}`, borderRadius: 16, padding: 14, cursor: 'pointer', gridColumn: c.key === 'other' ? 'span 2' : undefined }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: COLORS.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <CatIcon name={c.icon} />
                  </div>
                  <p style={{ fontSize: 13.5, fontWeight: 800, color: COLORS.text }}>{c.label}</p>
                  <p style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3, lineHeight: 1.4 }}>{c.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* STEP 1: basic information */}
        {form.step === 1 && cat && typeCfg && (
          <Section title="Basic information" sub={categoryLabel(cat)}>
            {myCompany && !editing && (
              <Field label="Sell as">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Chip active={!form.companyId} onClick={() => set('companyId', null)}>Personal</Chip>
                  <Chip active={form.companyId === myCompany.id} onClick={() => set('companyId', myCompany.id)}>{myCompany.name}</Chip>
                </div>
              </Field>
            )}
            {cat === 'other' ? (
              <Field label="Listing type"><input value={form.customType} onChange={(e) => set('customType', e.target.value)} placeholder="e.g. Storage space, Farm land" maxLength={60} style={input} /></Field>
            ) : (
              <>
                <Field label={typeCfg.label}>
                  <select value={form.type} onChange={(e) => set('type', e.target.value)} style={input}>
                    <option value="">Select…</option>
                    {typeCfg.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
                {form.type === 'Other' && (
                  <Field label="Which one?"><input value={form.customType} onChange={(e) => set('customType', e.target.value)} placeholder="Type it here" maxLength={60} style={input} /></Field>
                )}
              </>
            )}
            <Field label="Listing title">
              <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={cat === 'crop' ? 'e.g. Premium Maize Grain, 100kg' : 'Short, clear title'} maxLength={100} style={input} />
            </Field>
            <Field label="Description" hint={`${form.description.length}/1000`}>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={5} maxLength={1000} placeholder="Describe what you are offering, quality and anything buyers should know." style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
          </Section>
        )}

        {/* STEP 2: category details */}
        {form.step === 2 && cat && (
          <Section title="Details" sub="Only what matters for this kind of listing">
            {visibleFields.map((f) => <DetailInput key={f.key} f={f} value={form.details[f.key] || ''} onChange={(v) => setDetail(f.key, v)} />)}
          </Section>
        )}

        {/* STEP 3: media */}
        {form.step === 3 && (
          <Section title="Photos" sub={`Add up to ${imageCap} photos. The first photo is the cover.`}>
            <ImageUploader value={form.images} onChange={(urls: string[]) => set('images', urls)} folder="listings" max={imageCap} />
            <p style={{ fontSize: 11.5, color: COLORS.textMuted, margin: '10px 0' }}>Use a clear photo of the actual item.</p>
            {form.images.length > 1 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Order</p>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                  {form.images.map((url, i) => (
                    <div key={url} style={{ flexShrink: 0, width: 84 }}>
                      <div style={{ position: 'relative', width: 84, height: 70, borderRadius: 10, overflow: 'hidden', border: `2px solid ${i === 0 ? COLORS.green : COLORS.border}` }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {i === 0 && <span style={{ position: 'absolute', left: 4, top: 4, background: COLORS.green, color: 'white', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 6 }}>Cover</span>}
                      </div>
                      {i > 0 && (
                        <div onClick={() => set('images', [url, ...form.images.filter((u) => u !== url)])} style={{ marginTop: 4, textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: COLORS.greenDark, cursor: 'pointer' }}>Make cover</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Section>
        )}

        {/* STEP 4: pricing & location */}
        {form.step === 4 && cat && (
          <>
            <Section title="Pricing">
              <Field label="Price type">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip active={form.priceType === 'fixed'} onClick={() => set('priceType', 'fixed')}>Fixed price</Chip>
                  <Chip active={form.priceType === 'negotiable'} onClick={() => set('priceType', 'negotiable')}>Negotiable</Chip>
                  <Chip active={form.priceType === 'contact'} onClick={() => set('priceType', 'contact')}>Contact seller</Chip>
                </div>
              </Field>
              {form.priceType !== 'contact' && (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 2 }}>
                      <Field label="Price"><input value={form.price} onChange={(e) => set('price', e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" style={input} /></Field>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Field label="Currency">
                        <select value={form.currency} onChange={(e) => set('currency', e.target.value)} style={input}>
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>
                  {units.length > 0 && (
                    <Field label={cat === 'services' ? 'Pricing model' : 'Unit'}>
                      <select value={form.unit} onChange={(e) => set('unit', e.target.value)} style={input}>
                        <option value="">{cat === 'services' ? 'Fixed price' : 'Select…'}</option>
                        {units.map((u) => <option key={u} value={u}>{unitText(u)}</option>)}
                      </select>
                    </Field>
                  )}
                </>
              )}
              {usesQty && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}><Field label="Quantity available"><input value={form.quantity} onChange={(e) => set('quantity', e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="Optional" style={input} /></Field></div>
                  <div style={{ flex: 1 }}><Field label="Minimum order"><input value={form.minOrder} onChange={(e) => set('minOrder', e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="Optional" style={input} /></Field></div>
                </div>
              )}
              <div onClick={() => set('freeDelivery', !form.freeDelivery)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: form.freeDelivery ? COLORS.greenSoft : COLORS.bg, borderRadius: 12, padding: '11px 12px' }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${form.freeDelivery ? COLORS.green : COLORS.border}`, background: form.freeDelivery ? COLORS.green : COLORS.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {form.freeDelivery && <Icon name="check" size={14} color="white" strokeWidth={3} />}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>Free delivery</p>
                  <p style={{ fontSize: 11, color: COLORS.textMuted }}>Shown to buyers on the product page.</p>
                </div>
              </div>
            </Section>

            <Section title="Location" sub="Buyers see the area, never a house address.">
              <Field label="Country">
                <select value={form.country} onChange={(e) => set('country', e.target.value)} style={input}>
                  <option value="">Select…</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="State / Province"><input value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="e.g. Kaduna" maxLength={60} style={input} /></Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><Field label="City / Town"><input value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={60} style={input} /></Field></div>
                <div style={{ flex: 1 }}><Field label="Area (optional)"><input value={form.area} onChange={(e) => set('area', e.target.value)} maxLength={60} style={input} /></Field></div>
              </div>
            </Section>
          </>
        )}

        {/* STEP 5: review */}
        {form.step === 5 && cat && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, marginBottom: 12 }}>Review your listing</h2>
            <div style={{ background: COLORS.card, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ position: 'relative', height: 200, background: '#E5EFE5' }}>
                {form.images[0] && <img src={form.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {form.images.length > 1 && <span style={{ position: 'absolute', right: 10, bottom: 10, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999 }}>1/{form.images.length}</span>}
              </div>
              <div style={{ padding: 16 }}>
                <p style={{ fontSize: 17, fontWeight: 800, color: COLORS.text }}>{form.title}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: COLORS.green, margin: '4px 0' }}>
                  {form.priceType === 'contact' ? 'Contact seller' : `${form.currency} ${Number(form.price || 0).toLocaleString()}${form.unit ? ` / ${unitText(form.unit)}` : ''}`}
                  {form.priceType === 'negotiable' && <span style={{ fontSize: 11, color: '#F59E0B', marginLeft: 8 }}>Negotiable</span>}
                </p>
                <p style={{ fontSize: 12, color: COLORS.textMuted }}>{[form.area, form.city, form.state, form.country].filter(Boolean).join(', ')}</p>
                {form.freeDelivery && <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.greenDark, marginTop: 6 }}>🚚 Free delivery</p>}
                <div style={{ borderTop: `1px solid ${COLORS.bg}`, marginTop: 12 }}>
                  <PRow k="Category" v={categoryLabel(cat)} />
                  {finalType && <PRow k={typeCfg?.label || 'Type'} v={finalType} />}
                  {usesQty && form.quantity && <PRow k="Quantity" v={`${form.quantity} ${form.unit || ''} available`} />}
                  {usesQty && form.minOrder && <PRow k="Minimum order" v={`${form.minOrder} ${form.unit || ''}`} />}
                  {reviewRows.map((r) => <PRow key={r.label} k={r.label} v={r.value} />)}
                </div>
                <p style={{ fontSize: 13, fontWeight: 800, color: COLORS.text, margin: '12px 0 4px' }}>Description</p>
                <p style={{ fontSize: 12.5, color: COLORS.text, lineHeight: 1.5 }}>{form.description}</p>
                <p style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 12 }}>Seller: <b>{form.companyId && myCompany ? myCompany.name : sellerName}</b></p>
              </div>
            </div>

            {editing && (
              <Section title="Availability">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Chip active={form.status === 'available'} onClick={() => set('status', 'available')}>Available</Chip>
                  <Chip active={form.status === 'sold'} onClick={() => set('status', 'sold')}>Sold</Chip>
                  <Chip active={form.status === 'inactive'} onClick={() => set('status', 'inactive')}>Hidden</Chip>
                </div>
              </Section>
            )}

            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14, marginTop: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Listing visibility</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginTop: 4 }}>Standard</p>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)', background: COLORS.text, color: 'white', borderRadius: 999, padding: '9px 18px', fontSize: 12.5, fontWeight: 700, zIndex: 40 }}>{toast}</div>
      )}

      {/* Bottom actions */}
      {form.step > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', zIndex: 30 }}>
          <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', gap: 10 }}>
            {!editing && (
              <div onClick={saveDraft} style={{ flex: 1, textAlign: 'center', padding: 13, borderRadius: 12, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Save Draft</div>
            )}
            {form.step < 5 ? (
              <div onClick={next} style={{ flex: 2, textAlign: 'center', padding: 13, borderRadius: 12, background: COLORS.green, color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Next</div>
            ) : (
              <div onClick={busy || atLimit ? undefined : publish} style={{ flex: 2, textAlign: 'center', padding: 13, borderRadius: 12, background: busy || atLimit ? '#A7D7B4' : COLORS.green, color: 'white', fontWeight: 800, fontSize: 14, cursor: busy || atLimit ? 'default' : 'pointer' }}>
                {busy ? (editing ? 'Saving…' : 'Publishing…') : editing ? 'Save Changes' : 'Publish Listing'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const input: CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 13.5,
  boxSizing: 'border-box', background: COLORS.card, color: COLORS.text,
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{title}</p>
      {sub && <p style={{ fontSize: 11.5, color: COLORS.textMuted, margin: '3px 0 0' }}>{sub}</p>}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>{label}</p>
        {hint && <p style={{ fontSize: 10.5, color: COLORS.textMuted }}>{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <div onClick={onClick} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: active ? COLORS.green : COLORS.card, color: active ? 'white' : COLORS.textMuted, border: `1px solid ${active ? COLORS.green : COLORS.border}` }}>
      {children}
    </div>
  )
}

function DetailInput({ f, value, onChange }: { f: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={f.label + (f.required ? ' *' : '')}>
      {f.kind === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={input}>
          <option value="">Select…</option>
          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : f.kind === 'textarea' ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={f.placeholder} maxLength={500} style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
      ) : (
        <input
          type={f.kind === 'date' ? 'date' : 'text'}
          inputMode={f.kind === 'number' ? 'decimal' : undefined}
          value={value}
          onChange={(e) => onChange(f.kind === 'number' ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value)}
          placeholder={f.placeholder}
          maxLength={80}
          style={input}
        />
      )}
    </Field>
  )
}

function PRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '9px 0', borderBottom: `1px solid ${COLORS.bg}` }}>
      <span style={{ fontSize: 12.5, color: COLORS.textMuted }}>{k}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.text, textAlign: 'right' }}>{v}</span>
    </div>
  )
}

function Btn({ label, onClick, ghost }: { label: string; onClick: () => void; ghost?: boolean }) {
  return (
    <div onClick={onClick} style={{ textAlign: 'center', padding: 13, borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginTop: 10, background: ghost ? COLORS.card : COLORS.green, color: ghost ? COLORS.textMuted : 'white', border: ghost ? `1px solid ${COLORS.border}` : 'none' }}>
      {label}
    </div>
  )
}
