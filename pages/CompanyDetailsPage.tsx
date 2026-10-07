import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import PremiumTick from '../PremiumTick'
import PostCard, { POST_SELECT } from '../PostCard'
import type { PostCardData } from '../PostCard'
import { isPremiumActive } from '../premiumShared'
import { trackView } from '../analyticsShared'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  orange: '#F59E0B',
}

// Owner buttons: /company/edit is the Edit Company page, /company/premium is Company Premium (both in App.tsx).
const COMPANY_EDIT_PATH = '/company/edit'
const COMPANY_PREMIUM_PATH = '/company/premium'

type Company = {
  id: string
  owner_id: string
  name: string
  category: string
  business_type: string | null
  description: string | null
  location: string | null
  logo_url: string | null
  cover_url: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  products: string[] | null
  services: string[] | null
  gallery: string[] | null
  social_links: Record<string, string> | null
  is_premium: boolean
  premium_until: string | null
  trusted_partner: boolean
  status: string
  followers_count: number
}

type Listing = {
  id: string
  title: string
  price: number
  unit: string | null
  location: string | null
  images: string[] | null
}

type Tab = 'overview' | 'posts' | 'listings' | 'about'

export default function CompanyDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { formatPrice } = useLocale()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [company, setCompany] = useState<Company | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [posts, setPosts] = useState<PostCardData[]>([])
  const [postsCount, setPostsCount] = useState(0)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [following, setFollowing] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')

  const load = async () => {
    if (!id || !user) return
    setNetError(false)
    setLoading(true)

    try {
      const [companyRes, listingsRes, followRes, postsRes, postsCountRes, likedRes, savedRes] = await Promise.all([
        supabase.from('companies').select('id, owner_id, name, category, business_type, description, location, logo_url, cover_url, phone, whatsapp, website, address, city, state, country, products, services, gallery, social_links, is_premium, premium_until, trusted_partner, status, followers_count').eq('id', id).maybeSingle(),
        supabase.from('marketplace_listings').select('id, title, price, unit, location, images').eq('company_id', id).eq('status', 'available').order('created_at', { ascending: false }),
        supabase.from('company_followers').select('company_id').eq('user_id', user.id).eq('company_id', id).maybeSingle(),
        supabase.from('posts').select(POST_SELECT).eq('company_id', id).eq('visibility', 'public').order('created_at', { ascending: false }).limit(20),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('company_id', id).eq('visibility', 'public'),
        supabase.from('post_likes').select('post_id').eq('user_id', user.id),
        supabase.from('saved_items').select('post_id').eq('user_id', user.id).not('post_id', 'is', null),
      ])

      if (companyRes.error) {
        setNetError(true)
        setLoading(false)
        return
      }

      setCompany(companyRes.data as any)
      if (companyRes.data) trackView('company', id)
      setListings((listingsRes.data || []) as any)
      setFollowing(!!followRes.data)
      setPosts((postsRes.data || []) as any)
      setPostsCount(postsCountRes.count || 0)
      setLikedIds(new Set((likedRes.data || []).map((r: any) => r.post_id)))
      setSavedIds(new Set((savedRes.data || []).map((r: any) => r.post_id)))
    } catch {
      setNetError(true)
    }

    setLoading(false)
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

  if (netError) {
    return (
      <Shell>
        <Header onBack={() => navigate(-1)} />
        <NetworkError onRetry={load} />
      </Shell>
    )
  }

  if (loading) {
    return (
      <Shell>
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: '16px' }}><ListCardSkeleton count={4} /></div>
      </Shell>
    )
  }

  if (!company) {
    return (
      <Shell>
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORS.textMuted, fontSize: '13px' }}>Company not found.</div>
      </Shell>
    )
  }

  const isOwner = company.owner_id === user?.id
  const premium = isPremiumActive(company.is_premium, company.premium_until)
  const verified = company.status === 'verified'
  const place = [company.city, company.state, company.country].filter(Boolean).join(', ') || company.location
  const focus = (company.products || []).filter(Boolean)
  const services = (company.services || []).filter(Boolean)
  const gallery = (company.gallery || []).filter(Boolean)
  const contactHref = company.whatsapp
    ? `https://wa.me/${company.whatsapp.replace(/[^\d]/g, '')}`
    : company.phone ? `tel:${company.phone}` : null
  const websiteHref = company.website ? (company.website.startsWith('http') ? company.website : `https://${company.website}`) : null
  const websiteLabel = company.website ? company.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : ''

  // Owner-only completeness hint: only checks fields that actually exist on the company.
  const checks: [string, boolean][] = [
    ['Logo', !!company.logo_url],
    ['Cover image', !!company.cover_url],
    ['Description', !!company.description?.trim()],
    ['Location', !!place],
    ['Website', !!company.website],
    ['Phone or WhatsApp', !!(company.phone || company.whatsapp)],
    ['Services', services.length > 0],
  ]
  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label)
  const completeness = Math.round(((checks.length - missing.length) / checks.length) * 100)

  return (
    <Shell>
      <Header onBack={() => navigate(-1)} />

      {/* Cover */}
      <div style={{
        height: '130px', background: company.cover_url ? '#E5EFE5' : 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 55%, #86EFAC 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {company.cover_url
          ? <img src={company.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', right: '-14px', bottom: '-18px', opacity: 0.35 }}><Icon name="leaf" size={110} color={COLORS.green} /></div>}
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Logo overlapping the cover */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '-38px' }}>
          <div style={{ width: '76px', height: '76px', borderRadius: '18px', background: COLORS.card, border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {company.logo_url ? <img src={company.logo_url} alt={`${company.name} logo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="building" size={32} color={COLORS.green} />}
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingBottom: '4px' }}>
            {isOwner ? (
              <Pill onClick={() => navigate(COMPANY_EDIT_PATH)} filled={false}>Edit Company</Pill>
            ) : (
              <>
                {contactHref && <Pill onClick={() => window.open(contactHref, '_blank', 'noopener')} filled={false}>Contact</Pill>}
                <Pill onClick={toggleFollow} filled={!following}>{following ? 'Following' : 'Follow'}</Pill>
              </>
            )}
          </div>
        </div>

        {/* Name + badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>{company.name}</p>
          {verified && <span title="Verified company" style={{ display: 'flex' }}><Icon name="checkCircle" size={17} color={COLORS.green} /></span>}
          {premium && <PremiumTick size={19} label="Premium company" />}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
          {company.trusted_partner && <Chip bg="#FEF3C7" color="#92400E">★ Trusted Partner</Chip>}
          {isOwner && !verified && <Chip bg="#FEF3C7" color="#92400E">{company.status === 'rejected' ? 'Verification rejected' : 'Verification pending'}</Chip>}
        </div>

        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px', textTransform: 'capitalize' }}>
          {[company.category, company.business_type].filter(Boolean).join(' · ')}
        </p>

        {company.description && (
          <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.55, marginTop: '10px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {company.description}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px' }}>
          {place && <InfoRow icon={<Icon name="mapPin" size={13} color={COLORS.textMuted} />}>{place}</InfoRow>}
          {websiteHref && (
            <InfoRow icon={<GlobeIcon />}>
              <a href={websiteHref} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.green, fontWeight: 600, textDecoration: 'none' }}>{websiteLabel}</a>
            </InfoRow>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
          <Stat label="Followers" value={compact(company.followers_count)} />
          <Stat label="Listings" value={compact(listings.length)} />
          <Stat label="Posts" value={compact(postsCount)} />
        </div>

        {/* Owner-only cards */}
        {isOwner && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {verified && (
              <div onClick={() => navigate(`/create?company=${company.id}`)} style={{ background: COLORS.green, color: 'white', borderRadius: '12px', padding: '12px', textAlign: 'center', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                + New company post
              </div>
            )}

            {missing.length > 0 && (
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text }}>Complete your Company Profile</p>
                  <p style={{ fontSize: '12px', fontWeight: 800, color: COLORS.green }}>{completeness}%</p>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: COLORS.greenSoft, marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${completeness}%`, height: '100%', background: COLORS.green }} />
                </div>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '8px' }}>Missing: {missing.join(', ')}</p>
              </div>
            )}

            {premium ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '12px' }}>
                <PremiumTick size={22} />
                <div>
                  <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text }}>Company Premium active</p>
                  {company.premium_until && (
                    <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>
                      Until {new Date(company.premium_until).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '14px' }}>
                <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>Grow Your Company with FarmLite Premium</p>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '4px' }}>Blue tick, more listings and company tools. See exactly what is included.</p>
                <div onClick={() => navigate(COMPANY_PREMIUM_PATH)} style={{ marginTop: '10px', textAlign: 'center', padding: '10px', borderRadius: '10px', background: '#1877F2', color: 'white', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
                  Upgrade to Company Premium
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, marginTop: '18px' }}>
          {(['overview', 'posts', 'listings', 'about'] as Tab[]).map((t) => (
            <div key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{
              flex: 1, textAlign: 'center', padding: '11px 0', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
              color: tab === t ? COLORS.green : COLORS.textMuted, borderBottom: `2px solid ${tab === t ? COLORS.green : 'transparent'}`,
            }}>
              {t}
            </div>
          ))}
        </div>

        <div style={{ paddingTop: '16px' }}>
          {tab === 'overview' && (
            <>
              {company.description ? (
                <Block title="Company overview"><p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.6 }}>{company.description}</p></Block>
              ) : null}
              {focus.length > 0 && <Block title="Business focus"><Tags items={focus} /></Block>}
              {services.length > 0 && <Block title="Services"><Tags items={services} /></Block>}
              {gallery.length > 0 && (
                <Block title="Photos">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {gallery.map((src, i) => (
                      <a key={`${src}-${i}`} href={src} target="_blank" rel="noopener noreferrer" style={{ display: 'block', aspectRatio: '1 / 1', borderRadius: '8px', overflow: 'hidden', background: '#E5EFE5' }}>
                        <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                </Block>
              )}
              {!company.description && focus.length === 0 && services.length === 0 && gallery.length === 0 && (
                <Empty text="This company has not added an overview yet." />
              )}
              {listings.length > 0 && (
                <div onClick={() => setTab('listings')} style={{ background: COLORS.card, borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>Company Marketplace</p>
                    <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>{listings.length} active listing{listings.length === 1 ? '' : 's'}</p>
                  </div>
                  <Icon name="chevronRight" size={16} color={COLORS.textMuted} />
                </div>
              )}
            </>
          )}

          {tab === 'posts' && (
            posts.length === 0
              ? <Empty text="No posts from this company yet." />
              : posts.map((p) => (
                <PostCard key={p.id} post={p} initialLiked={likedIds.has(p.id)} initialSaved={savedIds.has(p.id)} />
              ))
          )}

          {tab === 'listings' && (
            listings.length === 0 ? (
              <Empty text="No listings from this company yet." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {listings.map((l) => (
                  <div key={l.id} onClick={() => navigate(`/marketplace?listing=${l.id}`)} style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: '90px', background: '#E5EFE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {l.images?.[0] ? <img src={l.images[0]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={22} color={COLORS.green} />}
                    </div>
                    <div style={{ padding: '9px' }}>
                      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
                      <p style={{ fontSize: '12px', fontWeight: 800, color: COLORS.green, marginTop: '3px' }}>{formatPrice(Number(l.price))}{l.unit ? `/${l.unit}` : ''}</p>
                      {l.location && <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.location}</p>}
                      <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '3px' }}>by {company.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'about' && (
            <div style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden' }}>
              <AboutRow label="Category" value={company.category} />
              <AboutRow label="Business type" value={company.business_type} />
              <AboutRow label="Location" value={place} />
              <AboutRow label="Address" value={company.address} />
              <AboutRow label="Website" value={websiteLabel || null} href={websiteHref || undefined} />
              <AboutRow label="Phone" value={company.phone} href={company.phone ? `tel:${company.phone}` : undefined} />
              <AboutRow label="WhatsApp" value={company.whatsapp} href={contactHref && company.whatsapp ? contactHref : undefined} />
              {Object.entries(company.social_links || {}).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => (
                <AboutRow key={k} label={k} value={v.replace(/^https?:\/\//, '')} href={v.startsWith('http') ? v : `https://${v}`} />
              ))}
              <AboutRow label="Verification" value={verified ? 'Verified company' : null} />
              <AboutRow label="Partnership" value={company.trusted_partner ? 'FarmLite Trusted Partner' : null} />
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>{children}</div>
}

function Pill({ children, onClick, filled }: { children: ReactNode; onClick: () => void; filled: boolean }) {
  return (
    <div role="button" onClick={onClick} style={{
      padding: '9px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer',
      background: filled ? COLORS.green : COLORS.card, color: filled ? 'white' : COLORS.text, border: filled ? 'none' : `1px solid ${COLORS.border}`,
    }}>
      {children}
    </div>
  )
}

function Chip({ children, bg, color }: { children: ReactNode; bg: string; color: string }) {
  return <span style={{ background: bg, color, fontSize: '10.5px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px' }}>{children}</span>
}

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: COLORS.textMuted }}>
      {icon}
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
    </div>
  )
}

function GlobeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
    </svg>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '12px' }}>
      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, marginBottom: '8px' }}>{title}</p>
      {children}
    </div>
  )
}

function Tags({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {items.map((t) => (
        <span key={t} style={{ background: COLORS.greenSoft, color: COLORS.greenDark, fontSize: '11.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '999px' }}>{t}</span>
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ background: COLORS.card, padding: '28px 16px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '12.5px', marginBottom: '12px' }}>{text}</div>
}

function AboutRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderBottom: `1px solid ${COLORS.bg}` }}>
      <p style={{ fontSize: '12px', color: COLORS.textMuted, textTransform: 'capitalize', flexShrink: 0 }}>{label}</p>
      {href
        ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12.5px', fontWeight: 600, color: COLORS.green, textDecoration: 'none', textAlign: 'right', wordBreak: 'break-word' }}>{value}</a>
        : <p style={{ fontSize: '12.5px', fontWeight: 600, color: COLORS.text, textAlign: 'right', wordBreak: 'break-word' }}>{value}</p>}
    </div>
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

// 1200 -> 1.2K, 10500 -> 10.5K
function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div role="button" aria-label="Back" onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Company</p>
    </div>
  )
}
