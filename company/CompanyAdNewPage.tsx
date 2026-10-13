import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import ImageUploader from '../ImageUploader'
import SponsoredCard from '../SponsoredCard'
import type { AdData } from '../SponsoredCard'
import type { CompanyCtx } from './CompanyLayout'
import AdsTabs from './AdsTabs'
import { PLACEMENTS, adError, money } from './adShared'
import type { Placement } from './adShared'

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

type Listing = { id: string; title: string; category: string | null; status: string; price: number; currency: string; unit: string | null; images: string[] | null; location: string | null; contact_for_price: boolean }
type Pkg = { days: number; amount: number; base: number; currency: string; discount_percent: number }

// Only audience groups that the profile data can really match are selectable.
const AUDIENCES: { key: string; label: string; available: boolean; note?: string }[] = [
  { key: 'farmer', label: 'Farmers', available: true },
  { key: 'buyer', label: 'Buyers', available: true },
  { key: 'agribusiness', label: 'Agribusinesses', available: true },
  { key: 'company', label: 'Agricultural companies', available: true },
  { key: 'livestock', label: 'Livestock producers', available: false, note: 'Not available yet' },
  { key: 'equipment', label: 'Equipment buyers', available: false, note: 'Not available yet' },
]

const STEPS = ['Promote', 'Creative', 'Audience', 'Location', 'Placement', 'Duration', 'Preview', 'Submit']

// Route: /company/ads/new
// 8-step Create Ad wizard. The price is always calculated on the server; the browser only shows it.
export default function CompanyAdNewPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const verified = company.status === 'verified'

  const [step, setStep] = useState(1)
  const [targetType, setTargetType] = useState<'listing' | 'company'>('listing')
  const [listings, setListings] = useState<Listing[]>([])
  const [listingsLoaded, setListingsLoaded] = useState(false)
  const [listingId, setListingId] = useState<string>('')
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [customImage, setCustomImage] = useState<string[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [locDraft, setLocDraft] = useState('')
  const [placements, setPlacements] = useState<Placement[]>(['home', 'marketplace'])
  const [days, setDays] = useState<number>(7)
  const [packages, setPackages] = useState<Pkg[]>([])
  const [pricesLoaded, setPricesLoaded] = useState(false)
  const [branding, setBranding] = useState<{ cover_url: string | null; logo_url: string | null }>({ cover_url: null, logo_url: company.logo_url })
  const [about, setAbout] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // One key per wizard session: a repeated tap or a retry after a bad connection returns the same ad.
  const requestKey = useRef<string>(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : '')
  const submitting = useRef(false)

  useEffect(() => {
    supabase
      .from('marketplace_listings')
      .select('id, title, category, status, price, currency, unit, images, location, contact_for_price')
      .eq('company_id', company.id).eq('status', 'available').eq('is_hidden_by_admin', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data || []) as Listing[]
        setListings(rows)
        setListingsLoaded(true)
        const pre = params.get('listing')
        if (pre && rows.some((l) => l.id === pre)) {
          setTargetType('listing')
          setListingId(pre)
          const l = rows.find((x) => x.id === pre)!
          setHeadline(l.title.slice(0, 60))
          setImage(l.images?.[0] || null)
        }
      })
    supabase.from('companies').select('cover_url, logo_url, description').eq('id', company.id).maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data) {
          setBranding({ cover_url: data.cover_url || null, logo_url: data.logo_url || null })
          setAbout(data.description || null)
        }
      })
    supabase.rpc('ad_prices_for_company', { p_company: company.id }).then(({ data }) => {
      const pk = ((data as any)?.packages || []) as Pkg[]
      setPackages(pk)
      if (pk.length > 0 && !pk.some((p) => p.days === 7)) setDays(pk[0].days)
      setPricesLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const switchTarget = (t: 'listing' | 'company') => {
    setTargetType(t)
    if (t === 'company') {
      // The Companies page placement is for company ads only; listing ads cannot keep it.
      setImage(null)
      setCustomImage([])
    } else {
      setPlacements((p) => p.filter((x) => x !== 'companies'))
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
  const adHeadline = headline.trim() || (targetType === 'listing' ? listing?.title || 'Your headline' : company.name)

  const preview: AdData = {
    id: 'preview',
    target_type: targetType,
    headline: adHeadline,
    body: body.trim() || null,
    image_url: chosenImage,
    company: { id: company.id, name: company.name, logo_url: company.logo_url, is_premium: company.is_premium, premium_until: company.premium_until },
    listing: targetType === 'listing' && listing ? { id: listing.id, title: listing.title, price: listing.price, currency: listing.currency, unit: listing.unit, images: listing.images, location: listing.location, contact_for_price: listing.contact_for_price } : null,
  }

  // Validation for the step you are leaving.
  const validate = (s: number): string => {
    if (s === 1 && targetType === 'listing' && !listingId) return 'Choose the listing you want to promote.'
    if (s === 2) {
      if (headline.trim().length < 3) return 'Write a headline of at least 3 characters.'
      if (uploading) return 'Please wait for the image upload to finish.'
    }
    if (s === 5 && placements.length === 0) return 'Choose at least one placement.'
    if (s === 6 && !selectedPkg) return 'Choose how long the ad should run.'
    return ''
  }

  const next = () => {
    const msg = validate(step)
    if (msg) return setError(msg)
    setError('')
    setStep((s) => Math.min(8, s + 1))
    window.scrollTo({ top: 0 })
  }
  const back = () => { setError(''); setStep((s) => Math.max(1, s - 1)); window.scrollTo({ top: 0 }) }

  const submit = async () => {
    if (submitting.current) return
    for (let s = 1; s <= 6; s++) {
      const m = validate(s)
      if (m) { setStep(s); return setError(m) }
    }
    setError('')
    submitting.current = true
    setSaving(true)
    const { data, error: e } = await supabase.rpc('ad_create', {
      p_company: company.id, p_target_type: targetType, p_listing: targetType === 'listing' ? listingId : null,
      p_headline: headline.trim(), p_body: body.trim() || null, p_image: chosenImage,
      p_roles: roles, p_locations: locations, p_days: days, p_placements: placements,
      p_request_key: requestKey.current || null,
    })
    setSaving(false)
    if (e) {
      submitting.current = false
      return setError(adError(e))
    }
    navigate(`/company/ads/${data}?submitted=1`, { replace: true })
  }

  if (!verified) {
    return (
      <div style={{ maxWidth: 640 }}>
        <AdsTabs active="create" />
        <p style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: 10 }}>Your company must be verified before you can run ads.</p>
      </div>
    )
  }

  const placementOn = (k: Placement) => placements.includes(k)
  const togglePlacement = (k: Placement) => setPlacements(placementOn(k) ? placements.filter((x) => x !== k) : [...placements, k])

  return (
    <div style={{ maxWidth: 760 }}>
      <AdsTabs active="create" />

      {/* progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i + 1 <= step ? COLORS.green : COLORS.border }} />
          ))}
        </div>
        <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, marginTop: 8 }}>Step {step} of 8 · <span style={{ color: COLORS.text }}>{STEPS[step - 1]}</span></p>
      </div>

      {error && <div role="alert" style={{ background: '#FEE2E2', color: COLORS.red, borderRadius: 10, padding: '11px 14px', fontSize: '13px', fontWeight: 600, marginBottom: 14 }}>{error}</div>}

      {step === 1 && (
        <Section title="What do you want to promote?">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Choice active={targetType === 'listing'} onClick={() => switchTarget('listing')} title="A Marketplace listing" sub="One of your available products or services" />
            <Choice active={targetType === 'company'} onClick={() => switchTarget('company')} title="My company profile" sub="Your public company page" />
          </div>
          {targetType === 'listing' && (
            !listingsLoaded ? (
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: 14 }}>Loading your listings…</p>
            ) : listings.length === 0 ? (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>You have no available company listings to promote. Only available listings that belong to your company can be advertised.</p>
                <span onClick={() => navigate('/sell')} style={{ display: 'inline-block', marginTop: 8, fontSize: '13px', fontWeight: 800, color: COLORS.green, cursor: 'pointer' }}>Create a listing</span>
              </div>
            ) : (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {listings.map((l) => (
                  <div key={l.id} onClick={() => pickListing(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, cursor: 'pointer', background: listingId === l.id ? COLORS.greenSoft : COLORS.card, border: `2px solid ${listingId === l.id ? COLORS.green : COLORS.border}` }}>
                    <div style={{ width: 54, height: 54, borderRadius: 10, background: COLORS.greenSoft, overflow: 'hidden', flexShrink: 0 }}>
                      {l.images?.[0] && <img src={l.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
                      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 2 }}>{l.category || 'Uncategorised'} · Available</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
          {targetType === 'company' && (
            <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
              <div style={{ width: 54, height: 54, borderRadius: 10, background: COLORS.greenSoft, overflow: 'hidden', flexShrink: 0 }}>
                {branding.logo_url && <img src={branding.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{company.name}</p>
                {about && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 3, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{about}</p>}
              </div>
            </div>
          )}
        </Section>
      )}

      {step === 2 && (
        <Section title="Write your ad">
          <Label>Headline <Muted>({headline.length}/60)</Muted></Label>
          <input value={headline} maxLength={60} onChange={(e) => setHeadline(e.target.value)} placeholder="Short and clear" style={input} />
          <Label top>Description (optional) <Muted>({body.length}/140)</Muted></Label>
          <textarea value={body} maxLength={140} rows={2} onChange={(e) => setBody(e.target.value)} placeholder="One or two lines about your offer" style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
          <Label top>Image</Label>
          {imageChoices.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {imageChoices.map((u) => (
                  <img key={u} src={u} alt="" onClick={() => { setImage(u); setCustomImage([]) }} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, cursor: 'pointer', border: `2px solid ${!customImage[0] && image === u ? COLORS.green : 'transparent'}` }} />
                ))}
              </div>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
                {targetType === 'listing' ? 'The first photo of your listing is used automatically. Tap another photo to use it instead, or upload a new image below.' : 'Your company cover or logo can be used. Tap one, or upload a new image below.'}
              </p>
            </>
          )}
          <ImageUploader value={customImage} onChange={(v: string[]) => setCustomImage(v)} folder="ads" max={1} onBusyChange={setUploading} />
          {!customImage[0] && image && (
            <span onClick={() => setImage(null)} style={{ display: 'inline-block', marginTop: 8, fontSize: '12px', fontWeight: 700, color: COLORS.red, cursor: 'pointer' }}>Remove image</span>
          )}
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 10, lineHeight: 1.5 }}>
            Your ad opens {targetType === 'listing' ? 'the listing page' : 'your company page'} inside Farmxie. Links to other websites are not supported, and ads are plain text and images only.
          </p>
        </Section>
      )}

      {step === 3 && (
        <Section title="Who should see it?">
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: 12, lineHeight: 1.5 }}>Choose one or more groups. If you choose none, your ad is shown to everyone.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {AUDIENCES.map((r) => {
              const on = roles.includes(r.key)
              return (
                <span key={r.key} onClick={r.available ? () => setRoles(on ? roles.filter((x) => x !== r.key) : [...roles, r.key]) : undefined}
                  style={{ padding: '9px 16px', borderRadius: 999, fontSize: '12.5px', fontWeight: 700, cursor: r.available ? 'pointer' : 'not-allowed', opacity: r.available ? 1 : 0.55, background: on ? COLORS.green : COLORS.card, color: on ? 'white' : COLORS.textMuted, border: `1px solid ${on ? COLORS.green : COLORS.border}` }}>
                  {r.label}{r.note ? ` · ${r.note}` : ''}
                </span>
              )
            })}
          </div>
        </Section>
      )}

      {step === 4 && (
        <Section title="Where are your customers?">
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: 12, lineHeight: 1.5 }}>Add countries, states or cities. They are matched against the country and location people list on their profile. If you add none, the ad is eligible for everyone in the audience you chose.</p>
          <input value={locDraft} maxLength={60} disabled={locations.length >= 10} placeholder="Type a country, state or city, then press Enter" onChange={(e) => setLocDraft(e.target.value.replace(',', ''))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLocation() } }} onBlur={addLocation} style={input} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {locations.map((l) => (
              <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: COLORS.greenSoft, color: COLORS.greenDark, fontSize: '12px', fontWeight: 700, padding: '5px 6px 5px 11px', borderRadius: 999 }}>
                {l}<span onClick={() => setLocations(locations.filter((x) => x !== l))} style={{ cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 5px' }}>×</span>
              </span>
            ))}
          </div>
          {locations.length === 0 && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 10 }}>No location chosen: eligible everywhere.</p>}
        </Section>
      )}

      {step === 5 && (
        <Section title="Where should your advertisement appear?">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PLACEMENTS.map((p) => {
              const blocked = !!p.companyOnly && targetType !== 'company'
              const on = placementOn(p.key)
              return (
                <div key={p.key} onClick={blocked ? undefined : () => togglePlacement(p.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.55 : 1, background: on && !blocked ? COLORS.greenSoft : COLORS.card, border: `2px solid ${on && !blocked ? COLORS.green : COLORS.border}` }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on && !blocked ? COLORS.green : '#B7C7B7'}`, background: on && !blocked ? COLORS.green : 'transparent', color: 'white', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && !blocked ? '✓' : ''}</span>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{p.label}</p>
                    <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 2 }}>{blocked ? 'Only available when you promote your company profile.' : p.help}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 12, lineHeight: 1.5 }}>The price is the same for one placement or all of them. Paid placements are separate from the free Featured Visibility that comes with Premium.</p>
        </Section>
      )}

      {step === 6 && (
        <Section title="How long should it run?">
          {!pricesLoaded ? (
            <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading prices…</p>
          ) : packages.length === 0 ? (
            <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5 }}>Ads are not available for your country yet. Please check again soon.</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {packages.map((p) => (
                  <div key={p.days} onClick={() => setDays(p.days)} style={{ flex: '1 1 150px', padding: 16, borderRadius: 14, cursor: 'pointer', textAlign: 'center', background: days === p.days ? COLORS.greenSoft : COLORS.card, border: `2px solid ${days === p.days ? COLORS.green : COLORS.border}` }}>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text }}>{p.days} days</p>
                    <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.greenDark, marginTop: 6 }}>{money(p.amount, p.currency)}</p>
                    {p.discount_percent > 0 && <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: 4 }}><s>{money(p.base, p.currency)}</s> · {p.discount_percent}% Premium discount</p>}
                  </div>
                ))}
              </div>
              {selectedPkg && (
                <div style={{ marginTop: 16, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 14px' }}>
                  <Line label="Campaign" value={`${selectedPkg.days} days`} />
                  <Line label="Placements" value={placements.length ? placements.map((k) => PLACEMENTS.find((p) => p.key === k)?.label).join(', ') : 'None'} />
                  <Line label="Fees" value="None" />
                  <Line label="Total payable" value={money(selectedPkg.amount, selectedPkg.currency)} strong />
                </div>
              )}
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 12, lineHeight: 1.6 }}>
                You pay only after Farmxie approves your ad. If it is rejected, you are not charged. The campaign starts when your payment is confirmed. Farmxie does not guarantee a number of views, clicks, customers or sales.
              </p>
            </>
          )}
        </Section>
      )}

      {step === 7 && (
        <Section title="Preview">
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.5 }}>This is how your ad looks in each placement you chose.</p>
          {placements.map((k) => (
            <div key={k} style={{ marginBottom: 18 }}>
              <p style={{ fontSize: '12px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>{PLACEMENTS.find((p) => p.key === k)?.label}</p>
              {k === 'home' || k === 'search'
                ? <div style={{ maxWidth: 360 }}><SponsoredCard ad={preview} layout="wide" preview /></div>
                : <div style={{ width: 190 }}><SponsoredCard ad={preview} layout="grid" preview /></div>}
            </div>
          ))}
        </Section>
      )}

      {step === 8 && (
        <Section title="Review and submit">
          <Line label="Promoting" value={targetType === 'listing' ? `Listing: ${listing?.title ?? ''}` : `Company: ${company.name}`} />
          <Line label="Headline" value={adHeadline} />
          <Line label="Audience" value={roles.length ? roles.map((r) => AUDIENCES.find((a) => a.key === r)?.label).join(', ') : 'Everyone'} />
          <Line label="Location" value={locations.length ? locations.join(', ') : 'Everywhere'} />
          <Line label="Placements" value={placements.map((k) => PLACEMENTS.find((p) => p.key === k)?.label).join(', ')} />
          <Line label="Duration" value={`${days} days`} />
          <Line label="Total payable after approval" value={selectedPkg ? money(selectedPkg.amount, selectedPkg.currency) : ''} strong />
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 14, lineHeight: 1.6 }}>
            Your ad is not shown until Farmxie approves it and you pay. You will be notified as soon as the review is complete.
          </p>
        </Section>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        {step > 1 && (
          <div role="button" onClick={saving ? undefined : back} style={{ padding: '12px 22px', borderRadius: 12, background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontWeight: 800, fontSize: '13.5px', cursor: 'pointer' }}>Back</div>
        )}
        <div style={{ flex: 1 }} />
        {step < 8 ? (
          <div role="button" onClick={next} style={{ padding: '12px 30px', borderRadius: 12, background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '14px', cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>Continue</div>
        ) : (
          <div role="button" onClick={saving ? undefined : submit} style={{ padding: '12px 30px', borderRadius: 12, background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '14px', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Submitting…' : 'Submit for Review'}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: 14 }}>{title}</p>
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

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderTop: '1px solid #F1F5EF', fontSize: strong ? '14px' : '13px' }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ color: COLORS.text, fontWeight: strong ? 800 : 600, textAlign: 'right' }}>{value}</span>
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
