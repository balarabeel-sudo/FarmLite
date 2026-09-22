import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import ImageUploader from '../ImageUploader'
import { formatMoney } from '../moneyUtils'
import { validatePhone, cleanPhone, whatsappLink } from '../phoneUtils'
import { COLORS, inputStyle, labelStyle, ErrorBanner, CompanyBadges } from '../shared'

type Company = {
  id: string
  owner_id: string
  name: string
  category: string
  business_type: string | null
  description: string | null
  location: string | null
  country: string | null
  state: string | null
  city: string | null
  address: string | null
  logo_url: string | null
  cover_url: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  gallery: string[] | null
  products: string[] | null
  services: string[] | null
  representative_name: string | null
  representative_role: string | null
  registration_authority: string | null
  registration_number: string | null
  status: string
  is_premium: boolean
  premium_until: string | null
  trusted_partner: boolean
  views_count: number
  rating: number
  followers_count: number
}

type Listing = {
  id: string
  title: string
  price: number
  currency: string
  unit: string | null
  images: string[] | null
}

const COMPANY_COLUMNS = `
  id, owner_id, name, category, business_type, description, location, country, state, city, address,
  logo_url, cover_url, phone, whatsapp, website, gallery, products, services,
  representative_name, representative_role, registration_authority, registration_number,
  status, is_premium, premium_until, trusted_partner, views_count, rating, followers_count
`.replace(/\s+/g, ' ').trim()

const REP_ROLE_LABELS: Record<string, string> = {
  founder: 'Founder', director: 'Director', manager: 'Manager', representative: 'Business Representative',
}

const STATUS_INFO: Record<string, { text: string; color: string }> = {
  pending: { text: 'Your company is waiting for review. Only you can see it until it is verified.', color: '#92400E' },
  needs_review: { text: 'FarmLite needs more information before this company can be verified. Edit your details below.', color: '#92400E' },
  rejected: { text: 'This company was not approved. Contact FarmLite support for details.', color: '#991B1B' },
}

export default function CompanyDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [company, setCompany] = useState<Company | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [following, setFollowing] = useState(false)
  const [viewer, setViewer] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const [galleryCap, setGalleryCap] = useState(6)

  const [logo, setLogo] = useState<string[]>([])
  const [cover, setCover] = useState<string[]>([])
  const [gallery, setGallery] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [website, setWebsite] = useState('')
  const [productsText, setProductsText] = useState('')
  const [servicesText, setServicesText] = useState('')
  const [repName, setRepName] = useState('')
  const [repRole, setRepRole] = useState('founder')

  const load = async () => {
    if (!id || !user) return
    setNetError(false)
    setLoading(true)

    const [companyRes, listingsRes, followRes] = await Promise.all([
      supabase.from('companies').select(COMPANY_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('marketplace_listings').select('id, title, price, currency, unit, images').eq('company_id', id).eq('status', 'available'),
      supabase.from('company_followers').select('company_id').eq('user_id', user.id).eq('company_id', id).maybeSingle(),
    ])

    if (companyRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    const c = companyRes.data as Company | null
    setCompany(c)
    setListings((listingsRes.data || []) as any)
    setFollowing(!!followRes.data)
    if (c) fillForm(c)
    setLoading(false)

    if (c && c.owner_id !== user.id) {
      supabase.rpc('increment_company_views', { p_company_id: c.id })
    }
  }

  const fillForm = (c: Company) => {
    setLogo(c.logo_url ? [c.logo_url] : [])
    setCover(c.cover_url ? [c.cover_url] : [])
    setGallery(c.gallery || [])
    setGalleryCap(c.is_premium ? 12 : 6)
    setDescription(c.description || '')
    setLocation(c.location || '')
    setPhone(c.phone || '')
    setWhatsapp(c.whatsapp || '')
    setWebsite(c.website || '')
    setProductsText((c.products || []).join(', '))
    setServicesText((c.services || []).join(', '))
    setRepName(c.representative_name || '')
    setRepRole(c.representative_role || 'founder')
  }

  useEffect(() => { load() }, [id, user])

  const toggleFollow = async () => {
    if (!user || !company) return
    if (following) {
      await supabase.from('company_followers').delete().eq('user_id', user.id).eq('company_id', company.id)
      setFollowing(false)
      setCompany((prev) => prev ? { ...prev, followers_count: Math.max(prev.followers_count - 1, 0) } : prev)
    } else {
      await supabase.from('company_followers').insert({ user_id: user.id, company_id: company.id })
      setFollowing(true)
      setCompany((prev) => prev ? { ...prev, followers_count: prev.followers_count + 1 } : prev)
    }
  }

  const handleSave = async () => {
    if (!user || !company || uploading) return
    setFormError('')
    const phoneErr = validatePhone(phone) || validatePhone(whatsapp)
    if (phoneErr) {
      setFormError(phoneErr)
      return
    }
    if (!repName.trim()) {
      setFormError("Enter the representative's full name.")
      return
    }
    let site = website.trim()
    if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`

    const products = productsText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20)
    const services = servicesText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20)

    setSaving(true)
    const { error } = await supabase.from('companies').update({
      logo_url: logo[0] || null,
      cover_url: cover[0] || null,
      gallery,
      description: description.trim() || null,
      location: location.trim() || null,
      phone: cleanPhone(phone) || null,
      whatsapp: cleanPhone(whatsapp) || null,
      website: site || null,
      products,
      services,
      representative_name: repName.trim(),
      representative_role: repRole,
    }).eq('id', company.id).eq('owner_id', user.id)
    setSaving(false)

    if (error) {
      setFormError(error.message || 'Could not save your changes. Try again.')
      return
    }
    setEditing(false)
    load()
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate(-1)} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: '16px' }}><ListCardSkeleton count={4} /></div>
      </div>
    )
  }

  if (!company) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORS.textMuted, fontSize: '13px' }}>Company not found.</div>
      </div>
    )
  }

  const isOwner = company.owner_id === user?.id
  const photos = company.gallery || []
  const products = company.products || []
  const services = company.services || []
  const statusInfo = STATUS_INFO[company.status]

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate(-1)} />

      <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, height: '120px', position: 'relative', overflow: 'hidden' }}>
        {company.cover_url && <img src={company.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-end', marginTop: '-30px' }}>
          <div style={{ width: '68px', height: '68px', borderRadius: '16px', background: '#DCFCE7', border: `3px solid ${COLORS.bg}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {company.logo_url ? <img src={company.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="building" size={28} color={COLORS.green} />}
          </div>
          <div style={{ paddingBottom: '2px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{company.name}</p>
              <CompanyBadges verified={company.status === 'verified'} premium={company.is_premium} trustedPartner={company.trusted_partner} size={15} />
            </div>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>
              {company.category}{company.business_type ? ` · ${company.business_type}` : ''}
            </p>
          </div>
        </div>

        {company.location && (
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Icon name="mapPin" size={12} color={COLORS.textMuted} /> {company.location}
          </p>
        )}

        {isOwner && statusInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FEF3C7', borderRadius: '10px', padding: '10px 12px', marginTop: '12px' }}>
            <Icon name="alertTriangle" size={14} color={COLORS.orange} />
            <p style={{ fontSize: '11.5px', color: statusInfo.color }}>{statusInfo.text}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', margin: '16px 0' }}>
          <Stat label="Followers" value={company.followers_count} />
          <Stat label="Rating" value={company.rating > 0 ? Number(company.rating).toFixed(1) : '—'} />
          <Stat label="Listings" value={listings.length} />
          {isOwner && <Stat label="Views" value={company.views_count} />}
        </div>

        {isOwner && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 13px', borderRadius: '12px', marginBottom: '14px',
            background: company.is_premium ? 'linear-gradient(135deg, #FEF3C7, #FDE68A)' : COLORS.card,
            border: `1px solid ${company.is_premium ? '#F59E0B' : COLORS.border}`,
          }}>
            <Icon name="crown" size={16} color={company.is_premium ? '#D97706' : COLORS.textMuted} />
            <p style={{ fontSize: '11.5px', color: COLORS.text }}>
              {company.is_premium
                ? company.premium_until
                  ? `Premium active until ${new Date(company.premium_until).toLocaleDateString()}`
                  : 'Premium active'
                : 'Not on Premium yet — more photos and priority in search. Pricing coming soon.'}
            </p>
          </div>
        )}

        {(company.representative_name || company.registration_authority) && (
          <div style={{ background: COLORS.card, borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>
            {company.representative_name && (
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: company.registration_authority ? '6px' : 0 }}>
                <Icon name="briefcase" size={13} color={COLORS.textMuted} />
                {company.representative_name}{company.representative_role ? ` · ${REP_ROLE_LABELS[company.representative_role] || company.representative_role}` : ''}
              </p>
            )}
            {isOwner && company.registration_authority && (
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="fileText" size={13} color={COLORS.textMuted} />
                {company.registration_authority}{company.registration_number ? ` · ${company.registration_number}` : ''}
              </p>
            )}
          </div>
        )}

        {isOwner ? (
          !editing && (
            <div onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, fontSize: '13px', fontWeight: 700, color: COLORS.text, cursor: 'pointer', marginBottom: '18px' }}>
              <Icon name="edit" size={14} color={COLORS.text} /> Edit Company
            </div>
          )
        ) : (
          <>
            <div
              onClick={toggleFollow}
              style={{
                textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginBottom: '10px',
                background: following ? COLORS.card : COLORS.green,
                color: following ? COLORS.textMuted : 'white',
                border: following ? `1px solid ${COLORS.border}` : 'none',
              }}>
              {following ? 'Following' : 'Follow'}
            </div>
            {(company.whatsapp || company.phone || company.website) && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                {company.whatsapp && <ContactLink href={whatsappLink(company.whatsapp)} icon="message" label="WhatsApp" external />}
                {company.phone && <ContactLink href={`tel:${cleanPhone(company.phone)}`} icon="phone" label="Call" />}
                {company.website && <ContactLink href={company.website} icon="link" label="Website" external />}
              </div>
            )}
          </>
        )}

        {isOwner && editing && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>Edit company</p>
            <ErrorBanner text={formError} />

            <p style={labelStyle}>Logo</p>
            <div style={{ marginBottom: '12px' }}><ImageUploader value={logo} onChange={setLogo} folder="avatars" max={1} onBusyChange={setUploading} /></div>

            <p style={labelStyle}>Cover photo</p>
            <div style={{ marginBottom: '12px' }}><ImageUploader value={cover} onChange={setCover} folder="covers" max={1} onBusyChange={setUploading} /></div>

            <p style={labelStyle}>Photos of your business (up to {galleryCap})</p>
            <div style={{ marginBottom: '12px' }}><ImageUploader value={gallery} onChange={setGallery} folder="gallery" max={galleryCap} onBusyChange={setUploading} /></div>

            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="About your company" rows={4} maxLength={1000} style={{ ...inputStyle, resize: 'none' }} />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" maxLength={80} style={inputStyle} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone, e.g. +2348012345678" inputMode="tel" style={inputStyle} />
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp, e.g. +2348012345678" inputMode="tel" style={inputStyle} />
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website (optional)" inputMode="url" style={inputStyle} />

            <p style={labelStyle}>Products (comma separated)</p>
            <input value={productsText} onChange={(e) => setProductsText(e.target.value)} placeholder="e.g. Maize, Seeds, Fertilizer" style={inputStyle} />

            <p style={labelStyle}>Services (comma separated)</p>
            <input value={servicesText} onChange={(e) => setServicesText(e.target.value)} placeholder="e.g. Farm Services, Agricultural Supply" style={inputStyle} />

            <p style={labelStyle}>Representative</p>
            <input value={repName} onChange={(e) => setRepName(e.target.value)} placeholder="Full name" maxLength={80} style={inputStyle} />
            <select value={repRole} onChange={(e) => setRepRole(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }}>
              {Object.entries(REP_ROLE_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div onClick={() => { setEditing(false); setFormError(''); fillForm(company) }} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>Cancel</div>
              <div onClick={saving || uploading ? undefined : handleSave} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', background: COLORS.green, fontSize: '12.5px', fontWeight: 700, color: 'white', cursor: 'pointer', opacity: saving || uploading ? 0.6 : 1 }}>
                <Icon name="check" size={14} color="white" /> {saving ? 'Saving...' : uploading ? 'Uploading...' : 'Save'}
              </div>
            </div>
          </div>
        )}

        {company.description && (
          <>
            <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, marginBottom: '6px' }}>About</p>
            <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.6, marginBottom: '20px' }}>{company.description}</p>
          </>
        )}

        {products.length > 0 && (
          <>
            <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Products</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
              {products.map((p) => <Chip key={p} text={p} />)}
            </div>
          </>
        )}

        {services.length > 0 && (
          <>
            <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Services</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
              {services.map((s) => <Chip key={s} text={s} />)}
            </div>
          </>
        )}

        {photos.length > 0 && (
          <>
            <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Photos</p>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '20px' }}>
              {photos.map((url) => (
                <img key={url} src={url} alt="" loading="lazy" onClick={() => setViewer(url)} style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '12px', flexShrink: 0, cursor: 'pointer' }} />
              ))}
            </div>
          </>
        )}

        <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Listings</p>
        {listings.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '28px 16px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <Icon name="package" size={24} color={COLORS.textMuted} />
            </div>
            No listings from this company yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {listings.map((l) => (
              <div key={l.id} onClick={() => navigate(`/marketplace?listing=${l.id}`)} style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
                <div style={{ width: '100%', height: '80px', background: '#E5EFE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {l.images?.[0] ? <img src={l.images[0]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={22} color={COLORS.green} />}
                </div>
                <div style={{ padding: '9px' }}>
                  <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
                  <p style={{ fontSize: '12px', fontWeight: 800, color: COLORS.green, marginTop: '3px' }}>{formatMoney(Number(l.price), l.currency)}{l.unit ? `/${l.unit}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewer && (
        <div onClick={() => setViewer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={viewer} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          <div style={{ position: 'absolute', top: '16px', right: '16px', width: '34px', height: '34px', borderRadius: '17px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={18} color="white" />
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ text }: { text: string }) {
  return (
    <span style={{ padding: '6px 12px', borderRadius: '999px', background: '#DCFCE7', color: COLORS.greenDark, fontSize: '11.5px', fontWeight: 700 }}>
      {text}
    </span>
  )
}

function ContactLink({ href, icon, label, external }: { href: string; icon: string; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px', background: '#DCFCE7', color: COLORS.greenDark, fontSize: '12.5px', fontWeight: 700, textDecoration: 'none' }}>
      <Icon name={icon} size={14} color={COLORS.greenDark} /> {label}
    </a>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ flex: 1, background: COLORS.card, borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '2px' }}>{label}</p>
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Company</p>
    </div>
  )
}
