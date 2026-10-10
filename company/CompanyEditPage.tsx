import { useEffect, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import ImageUploader from '../ImageUploader'
import { isPremiumActive } from '../premiumShared'
import type { CompanyCtx } from './CompanyLayout'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#B91C1C',
}

const CATEGORY_SUGGESTIONS = [
  'Agribusiness', 'Agricultural Company', 'Farm', 'Agro-Dealer', 'Food Processing', 'Livestock',
  'Agricultural Technology', 'Farm Equipment', 'Agricultural Services', 'Agricultural Investment', 'Seed', 'Agro-Chemicals', 'Other',
]

const SOCIALS: { key: string; label: string; placeholder: string }[] = [
  { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/yourcompany' },
  { key: 'instagram', label: 'Instagram', placeholder: 'instagram.com/yourcompany' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'x.com/yourcompany' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/company/yourcompany' },
  { key: 'youtube', label: 'YouTube', placeholder: 'youtube.com/@yourcompany' },
]

type Form = {
  name: string
  category: string
  business_type: string
  description: string
  country: string
  state: string
  city: string
  address: string
  phone: string
  whatsapp: string
  website: string
  logo_url: string | null
  cover_url: string | null
  gallery: string[]
  products: string[]
  services: string[]
  social_links: Record<string, string>
}

const DESCRIPTION_MAX = 600

// Route: /company/edit  (inside the desktop company dashboard)
// The owner edits the public company profile. Status, Premium and verification can never be changed here:
// the database trigger ignores those fields for owners.
export default function CompanyEditPage() {
  const { company, reload } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const premium = isPremiumActive(company.is_premium, company.premium_until)
  const galleryMax = premium ? 12 : 6
  const nameLocked = company.status === 'verified'

  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    const { data, error: e } = await supabase
      .from('companies')
      .select('name, category, business_type, description, country, state, city, address, phone, whatsapp, website, logo_url, cover_url, gallery, products, services, social_links')
      .eq('id', company.id)
      .maybeSingle()
    if (e || !data) {
      setLoadError(true)
      setLoading(false)
      return
    }
    const d = data as any
    setForm({
      name: d.name || '',
      category: d.category || '',
      business_type: d.business_type || '',
      description: d.description || '',
      country: d.country || '',
      state: d.state || '',
      city: d.city || '',
      address: d.address || '',
      phone: d.phone || '',
      whatsapp: d.whatsapp || '',
      website: d.website || '',
      logo_url: d.logo_url || null,
      cover_url: d.cover_url || null,
      gallery: d.gallery || [],
      products: d.products || [],
      services: d.services || [],
      social_links: (d.social_links && typeof d.social_links === 'object') ? d.social_links : {},
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [company.id])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setSaved(false)
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  const busy = (b: boolean) => setUploading((n) => Math.max(0, n + (b ? 1 : -1)))

  const normalizeUrl = (v: string) => {
    const t = v.trim()
    if (!t) return ''
    return /^https?:\/\//i.test(t) ? t : `https://${t}`
  }
  const validPhone = (v: string) => !v.trim() || v.replace(/\D/g, '').length >= 7

  const save = async () => {
    if (!form || saving) return
    setError('')

    if (!nameLocked && !form.name.trim()) return setError('Company name is required.')
    if (!form.category.trim()) return setError('Choose or type a category.')
    if (!validPhone(form.phone)) return setError('Enter a valid phone number.')
    if (!validPhone(form.whatsapp)) return setError('Enter a valid WhatsApp number.')
    if (uploading > 0) return setError('Please wait for the photo upload to finish.')

    const social: Record<string, string> = {}
    Object.entries(form.social_links).forEach(([k, v]) => {
      const url = normalizeUrl(v || '')
      if (url) social[k] = url
    })

    const location = [form.city.trim(), form.country.trim()].filter(Boolean).join(', ')

    const payload: Record<string, unknown> = {
      category: form.category.trim(),
      business_type: form.business_type.trim() || null,
      description: form.description.trim() || null,
      country: form.country.trim() || null,
      state: form.state.trim() || null,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
      location: location || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      website: normalizeUrl(form.website) || null,
      logo_url: form.logo_url,
      cover_url: form.cover_url,
      gallery: form.gallery,
      products: form.products,
      services: form.services,
      social_links: social,
    }
    if (!nameLocked) payload.name = form.name.trim()

    setSaving(true)
    const { error: e } = await supabase.from('companies').update(payload).eq('id', company.id)
    setSaving(false)

    if (e) {
      setError(e.message || 'Could not save. Please try again.')
      return
    }
    setSaved(true)
    await reload()
  }

  if (loading) return <p style={{ fontSize: '13px', color: COLORS.textMuted, padding: '20px 0' }}>Loading…</p>
  if (loadError || !form) {
    return (
      <div style={{ padding: '20px 0' }}>
        <p style={{ fontSize: '13px', color: COLORS.red, marginBottom: '10px' }}>Could not load your company details.</p>
        <span onClick={load} style={{ fontSize: '13px', fontWeight: 800, color: COLORS.green, cursor: 'pointer' }}>Try again</span>
      </div>
    )
  }

  const saveDisabled = saving || uploading > 0

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Company</p>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text, marginTop: '2px' }}>Edit Company</h1>
        </div>
        <div onClick={() => navigate(`/companies/${company.id}`)} style={ghostBtn}>View public page</div>
        <div role="button" onClick={save} style={{ ...primaryBtn, opacity: saveDisabled ? 0.6 : 1, cursor: saveDisabled ? 'default' : 'pointer' }}>
          {saving ? 'Saving…' : uploading > 0 ? 'Uploading…' : 'Save changes'}
        </div>
      </div>

      {error && <Banner kind="error">{error}</Banner>}
      {saved && !error && <Banner kind="ok">Your company profile was updated.</Banner>}

      <Card title="Branding" hint="Your logo and cover appear on your public company page.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          <div>
            <Label>Company logo</Label>
            <ImageUploader value={form.logo_url ? [form.logo_url] : []} onChange={(v: string[]) => set('logo_url', v[0] || null)} folder="company-logos" max={1} onBusyChange={busy} />
            <Hint>Square image works best.</Hint>
          </div>
          <div>
            <Label>Cover image</Label>
            <ImageUploader value={form.cover_url ? [form.cover_url] : []} onChange={(v: string[]) => set('cover_url', v[0] || null)} folder="company-covers" max={1} onBusyChange={busy} />
            <Hint>Wide image, for example 1200 × 400.</Hint>
          </div>
        </div>
      </Card>

      <Card title="Basic information">
        <Grid>
          <Field label="Company name" note={nameLocked ? 'Your company is verified, so the name can only be changed by Farmxie support.' : undefined}>
            <input value={form.name} disabled={nameLocked} maxLength={80} onChange={(e) => set('name', e.target.value)} style={{ ...input, ...(nameLocked ? disabled : {}) }} />
          </Field>
          <Field label="Category">
            <input list="company-categories" value={form.category} maxLength={60} onChange={(e) => set('category', e.target.value)} placeholder="Choose or type" style={input} />
            <datalist id="company-categories">{CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Business type">
            <input value={form.business_type} maxLength={80} onChange={(e) => set('business_type', e.target.value)} placeholder="Optional" style={input} />
          </Field>
        </Grid>
        <div style={{ marginTop: '14px' }}>
          <Field label="Description" note={`${form.description.length}/${DESCRIPTION_MAX}`}>
            <textarea value={form.description} rows={4} maxLength={DESCRIPTION_MAX} onChange={(e) => set('description', e.target.value)} placeholder="What does your company do?" style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
        </div>
      </Card>

      <Card title="Location">
        <Grid>
          <Field label="Country"><input value={form.country} maxLength={60} onChange={(e) => set('country', e.target.value)} style={input} /></Field>
          <Field label="State / Region"><input value={form.state} maxLength={60} onChange={(e) => set('state', e.target.value)} style={input} /></Field>
          <Field label="City / Town"><input value={form.city} maxLength={60} onChange={(e) => set('city', e.target.value)} style={input} /></Field>
        </Grid>
        <div style={{ marginTop: '14px' }}>
          <Field label="Business address" note="Shown on your About tab. Leave empty to keep it private.">
            <input value={form.address} maxLength={160} onChange={(e) => set('address', e.target.value)} style={input} />
          </Field>
        </div>
      </Card>

      <Card title="Public contact" hint="Only what you enter here is shown publicly.">
        <Grid>
          <Field label="Phone"><input value={form.phone} inputMode="tel" maxLength={25} onChange={(e) => set('phone', e.target.value)} placeholder="+234 …" style={input} /></Field>
          <Field label="WhatsApp"><input value={form.whatsapp} inputMode="tel" maxLength={25} onChange={(e) => set('whatsapp', e.target.value)} placeholder="+234 …" style={input} /></Field>
          <Field label="Website"><input value={form.website} maxLength={120} onChange={(e) => set('website', e.target.value)} placeholder="yourcompany.com" style={input} /></Field>
        </Grid>
        <div style={{ marginTop: '14px' }}>
          <Grid>
            {SOCIALS.map((s) => (
              <Field key={s.key} label={s.label}>
                <input value={form.social_links[s.key] || ''} maxLength={160} onChange={(e) => set('social_links', { ...form.social_links, [s.key]: e.target.value })} placeholder={s.placeholder} style={input} />
              </Field>
            ))}
          </Grid>
        </div>
      </Card>

      <Card title="What you offer">
        <Grid>
          <Field label="Products / business focus">
            <Tags value={form.products} onChange={(v) => set('products', v)} placeholder="Type and press Enter" />
          </Field>
          <Field label="Services">
            <Tags value={form.services} onChange={(v) => set('services', v)} placeholder="Type and press Enter" />
          </Field>
        </Grid>
      </Card>

      <Card title="Photo gallery" hint={`Up to ${galleryMax} photos${premium ? '' : ' on the free plan (12 with Company Premium)'}.`}>
        <ImageUploader value={form.gallery} onChange={(v: string[]) => set('gallery', v)} folder="company-gallery" max={galleryMax} onBusyChange={busy} />
      </Card>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '40px' }}>
        <div role="button" onClick={save} style={{ ...primaryBtn, opacity: saveDisabled ? 0.6 : 1, cursor: saveDisabled ? 'default' : 'pointer' }}>
          {saving ? 'Saving…' : uploading > 0 ? 'Uploading…' : 'Save changes'}
        </div>
        {saved && !error && <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.greenDark }}>Saved</span>}
      </div>
    </div>
  )
}

function Tags({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim().slice(0, 40)
    setDraft('')
    if (!t || value.length >= 12) return
    if (value.some((x) => x.toLowerCase() === t.toLowerCase())) return
    onChange([...value, t])
  }
  return (
    <div>
      <input
        value={draft}
        placeholder={value.length >= 12 ? 'Maximum 12 reached' : placeholder}
        disabled={value.length >= 12}
        onChange={(e) => setDraft(e.target.value.replace(',', ''))}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        onBlur={add}
        style={input}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
        {value.map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: COLORS.greenSoft, color: COLORS.greenDark, fontSize: '12px', fontWeight: 700, padding: '5px 6px 5px 11px', borderRadius: '999px' }}>
            {t}
            <span role="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} style={{ cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: '0 5px' }}>×</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{title}</p>
      {hint && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '3px' }}>{hint}</p>}
      <div style={{ marginTop: '16px' }}>{children}</div>
    </div>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>{children}</div>
}

function Field({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {note && <Hint>{note}</Hint>}
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>{children}</p>
}

function Hint({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '5px', lineHeight: 1.4 }}>{children}</p>
}

function Banner({ kind, children }: { kind: 'error' | 'ok'; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '16px', padding: '11px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: kind === 'error' ? '#FEE2E2' : COLORS.greenSoft, color: kind === 'error' ? COLORS.red : COLORS.greenDark }}>
      {children}
    </div>
  )
}

const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '10px 12px',
  fontSize: '13.5px', color: COLORS.text, background: COLORS.card, outline: 'none',
}
const disabled: CSSProperties = { background: COLORS.bg, color: COLORS.textMuted, cursor: 'not-allowed' }
const primaryBtn: CSSProperties = { padding: '11px 22px', borderRadius: '12px', background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '13px' }
const ghostBtn: CSSProperties = { padding: '10px 16px', borderRadius: '12px', background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.greenDark, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }
