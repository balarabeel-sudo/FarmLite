import { useEffect, useMemo, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import ImageUploader from '../ImageUploader'
import SponsoredCard from '../SponsoredCard'
import type { AdData } from '../SponsoredCard'
import type { CompanyCtx } from './CompanyLayout'
import { adError, money } from './adShared'

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

type Listing = { id: string; title: string; price: number; currency: string; unit: string | null; images: string[] | null; location: string | null; contact_for_price: boolean }
type Pkg = { days: number; amount: number; base: number; currency: string; discount_percent: number }

const ROLES: { key: string; label: string }[] = [
  { key: 'farmer', label: 'Farmers' },
  { key: 'buyer', label: 'Buyers' },
  { key: 'agribusiness', label: 'Agribusinesses' },
]

// Route: /company/ads/new
// Create Ad: what to promote, content, audience, location, duration (the package price is the budget), preview, submit.
export default function CompanyAdNewPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const verified = company.status === 'verified'

  const [targetType, setTargetType] = useState<'listing' | 'company'>('listing')
  const [listings, setListings] = useState<Listing[]>([])
  const [listingId, setListingId] = useState<string>('')
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [customImage, setCustomImage] = useState<string[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [locDraft, setLocDraft] = useState('')
  const [days, setDays] = useState<number>(7)
  const [packages, setPackages] = useState<Pkg[]>([])
  const [pricesLoaded, setPricesLoaded] = useState(false)
  const [branding, setBranding] = useState<{ cover_url: string | null; logo_url: string | null }>({ cover_url: null, logo_url: company.logo_url })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('marketplace_listings')
      .select('id, title, price, currency, unit, images, location, contact_for_price')
      .eq('company_id', company.id).eq('status', 'available').eq('is_hidden_by_admin', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setListings((data || []) as Listing[]))
    supabase.from('companies').select('cover_url, logo_url').eq('id', company.id).maybeSingle()
      .then(({ data }: { data: any }) => { if (data) setBranding({ cover_url: data.cover_url || null, logo_url: data.logo_url || null }) })
    supabase.rpc('ad_prices_for_company', { p_company: company.id }).then(({ data }) => {
      const pk = ((data as any)?.packages || []) as Pkg[]
      setPackages(pk)
      if (pk.length > 0 && !pk.some((p) => p.days === 7)) setDays(pk[0].days)
      setPricesLoaded(true)
    })
  }, [company.id])

  const listing = listings.find((l) => l.id === listingId) || null

  const pickListing = (id: string) => {
    setListingId(id)
    const l = listings.find((x) => x.id === id)
    if (l) {
      setHeadline((h) => h || l.title.slice(0, 60))
      setImage(l.images?.[0] || null)
      setCustomImage([])
    }
  }

  const imageChoices = useMemo(() => {
    const list: string[] = []
    if (targetType === 'listing') (listing?.images || []).forEach((u) => list.push(u))
    else { if (branding.cover_url) list.push(branding.cover_url); if (branding.logo_url) list.push(branding.logo_url) }
    return list
  }, [targetType, listing, branding])

  const addLocation = () => {
    const t = locDraft.trim().slice(0, 60)
    setLocDraft('')
    if (!t || locations.length >= 10 || locations.some((x) => x.toLowerCase() === t.toLowerCase())) return
    setLocations([...locations, t])
  }

  const chosenImage = customImage[0] || image
  const selectedPkg = packages.find((p) => p.days === days) || null

  const preview: AdData = {
    id: 'preview',
    target_type: targetType,
    headline: headline.trim() || (targetType === 'listing' ? listing?.title || 'Your headline' : company.name),
    body: body.trim() || null,
    image_url: chosenImage,
    company: { id: company.id, name: company.name, logo_url: company.logo_url, is_premium: company.is_premium, premium_until: company.premium_until },
    listing: targetType === 'listing' && listing ? { id: listing.id, title: listing.title, price: listing.price, currency: listing.currency, unit: listing.unit, images: listing.images, location: listing.location, contact_for_price: listing.contact_for_price } : null,
  }

  const submit = async () => {
    setError('')
    if (targetType === 'listing' && !listingId) return setError('Choose the listing you want to promote.')
    if (headline.trim().length < 3) return setError('Write a headline of at least 3 characters.')
    if (!selectedPkg) return setError('Choose how long the ad should run.')
    if (uploading) return setError('Please wait for the image upload to finish.')
    setSaving(true)
    const { data, error: e } = await supabase.rpc('ad_create', {
      p_company: company.id, p_target_type: targetType, p_listing: targetType === 'listing' ? listingId : null,
      p_headline: headline.trim(), p_body: body.trim() || null, p_image: chosenImage,
      p_roles: roles, p_locations: locations, p_days: days,
    })
    setSaving(false)
    if (e) return setError(adError(e))
    navigate(`/company/ads/${data}?submitted=1`, { replace: true })
  }

  if (!verified) {
    return (
      <div style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text }}>Create ad</h1>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: 10 }}>Your company must be verified before you can run ads.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span onClick={() => navigate('/company/ads')} style={{ fontSize: '13px', fontWeight: 700, color: COLORS.green, cursor: 'pointer' }}>‹ Ads</span>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text }}>Create ad</h1>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 520px', minWidth: 0 }}>
          {error && <div style={{ background: '#FEE2E2', color: COLORS.red, borderRadius: 10, padding: '11px 14px', fontSize: '13px', fontWeight: 600, marginBottom: 14 }}>{error}</div>}

          <Section n="1" title="What do you want to promote?">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Choice active={targetType === 'listing'} onClick={() => setTargetType('listing')} title="A listing" sub="Product or service in the Marketplace" />
              <Choice active={targetType === 'company'} onClick={() => setTargetType('company')} title="My company" sub="Your company page" />
            </div>
            {targetType === 'listing' && (
              listings.length === 0 ? (
                <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: 12 }}>You have no available company listings yet. Create a listing first.</p>
              ) : (
                <select value={listingId} onChange={(e) => pickListing(e.target.value)} style={{ ...input, marginTop: 14 }}>
                  <option value="">Choose a listing</option>
                  {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              )
            )}
          </Section>

          <Section n="2" title="Write your ad">
            <Label>Headline <Muted>({headline.length}/60)</Muted></Label>
            <input value={headline} maxLength={60} onChange={(e) => setHeadline(e.target.value)} placeholder="Short and clear" style={input} />
            <Label top>Text (optional) <Muted>({body.length}/140)</Muted></Label>
            <textarea value={body} maxLength={140} rows={2} onChange={(e) => setBody(e.target.value)} placeholder="One or two lines about your offer" style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
            <Label top>Image</Label>
            {imageChoices.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {imageChoices.map((u) => (
                  <img key={u} src={u} alt="" onClick={() => { setImage(u); setCustomImage([]) }} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, cursor: 'pointer', border: `2px solid ${!customImage[0] && image === u ? COLORS.green : 'transparent'}` }} />
                ))}
              </div>
            )}
            <ImageUploader value={customImage} onChange={(v: string[]) => setCustomImage(v)} folder="ads" max={1} onBusyChange={setUploading} />
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 6 }}>Pick one of your images, or upload a new one.</p>
          </Section>

          <Section n="3" title="Who should see it?">
            <Label>Audience <Muted>(leave empty for everyone)</Muted></Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ROLES.map((r) => {
                const on = roles.includes(r.key)
                return (
                  <span key={r.key} onClick={() => setRoles(on ? roles.filter((x) => x !== r.key) : [...roles, r.key])} style={{ padding: '8px 16px', borderRadius: 999, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', background: on ? COLORS.green : COLORS.card, color: on ? 'white' : COLORS.textMuted, border: `1px solid ${on ? COLORS.green : COLORS.border}` }}>{r.label}</span>
                )
              })}
            </div>
            <Label top>Location <Muted>(leave empty to show everywhere)</Muted></Label>
            <input value={locDraft} maxLength={60} disabled={locations.length >= 10} placeholder="Type a country, state or city, then press Enter" onChange={(e) => setLocDraft(e.target.value.replace(',', ''))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLocation() } }} onBlur={addLocation} style={input} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {locations.map((l) => (
                <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: COLORS.greenSoft, color: COLORS.greenDark, fontSize: '12px', fontWeight: 700, padding: '5px 6px 5px 11px', borderRadius: 999 }}>
                  {l}<span onClick={() => setLocations(locations.filter((x) => x !== l))} style={{ cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 5px' }}>×</span>
                </span>
              ))}
            </div>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 8 }}>Matched against the country and location people list on their profile.</p>
          </Section>

          <Section n="4" title="How long should it run?">
            {!pricesLoaded ? (
              <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading prices…</p>
            ) : packages.length === 0 ? (
              <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5 }}>Ads are not available for your country yet. Please check again soon.</p>
            ) : (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {packages.map((p) => (
                  <div key={p.days} onClick={() => setDays(p.days)} style={{ flex: '1 1 150px', padding: 16, borderRadius: 14, cursor: 'pointer', textAlign: 'center', background: days === p.days ? COLORS.greenSoft : COLORS.card, border: `2px solid ${days === p.days ? COLORS.green : COLORS.border}` }}>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text }}>{p.days} days</p>
                    <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.greenDark, marginTop: 6 }}>{money(p.amount, p.currency)}</p>
                    {p.discount_percent > 0 && <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: 4 }}><s>{money(p.base, p.currency)}</s> · {p.discount_percent}% Premium discount</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 40 }}>
            <div role="button" onClick={saving ? undefined : submit} style={{ padding: '13px 28px', borderRadius: 12, background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '14px', cursor: saving ? 'default' : 'pointer', opacity: saving || uploading ? 0.6 : 1 }}>
              {saving ? 'Submitting…' : 'Submit for review'}
            </div>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, maxWidth: 360, lineHeight: 1.5 }}>FarmLite checks every ad first. You only pay after it is approved.</p>
          </div>
        </div>

        <div style={{ flex: '0 0 250px', position: 'sticky', top: 20 }}>
          <p style={{ fontSize: '12px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Preview</p>
          <SponsoredCard ad={preview} layout="grid" preview />
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 14 }}>In the Home feed the ad appears as a larger card:</p>
          <div style={{ marginTop: 8, width: 330, maxWidth: '100%' }}><SponsoredCard ad={preview} layout="wide" preview /></div>
          {selectedPkg && (
            <div style={{ marginTop: 14, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontSize: '12px', color: COLORS.textMuted }}>Total after approval</p>
              <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text, marginTop: 2 }}>{money(selectedPkg.amount, selectedPkg.currency)}</p>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 2 }}>{selectedPkg.days} days</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 26, height: 26, borderRadius: 13, background: COLORS.greenSoft, color: COLORS.greenDark, fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{title}</p>
      </div>
      {children}
    </div>
  )
}

function Choice({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <div onClick={onClick} style={{ flex: '1 1 200px', padding: '14px 16px', borderRadius: 14, cursor: 'pointer', background: active ? COLORS.greenSoft : COLORS.card, border: `2px solid ${active ? COLORS.green : COLORS.border}` }}>
      <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{title}</p>
      <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 3 }}>{sub}</p>
    </div>
  )
}

function Label({ children, top }: { children: ReactNode; top?: boolean }) {
  return <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, margin: `${top ? 16 : 0}px 0 6px` }}>{children}</p>
}
function Muted({ children }: { children: ReactNode }) {
  return <span style={{ fontWeight: 500, color: COLORS.textMuted }}>{children}</span>
}

const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 12px',
  fontSize: '13.5px', color: COLORS.text, background: COLORS.card, outline: 'none',
}
