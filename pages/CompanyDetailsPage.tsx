import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import Icon from '../Icons'
import { ListCardSkeleton, FeedPostSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import PremiumTick from '../PremiumTick'
import PostCard, { POST_SELECT } from '../PostCard'
import type { PostCardData } from '../PostCard'
import { isPremiumActive } from '../premiumShared'
import { trackView } from '../analyticsShared'
import { setFollowCache } from '../followShared'
import FollowNotifySheet from '../FollowNotifySheet'
import {
  PCOLORS as COLORS, ProfileShell, ProfileHeader, ProfileCover, ProfileTop, RoundIconButton, PillButton, DotsMenu, NameRow,
  BioText, CalendarIcon, MetaRow, MetaItem, CountsRow, ProfileTabs, ProfileSearchBar, SectionLabel, EmptyCard, AboutRow, Block, Tags, PhotoGrid, ListingGrid,
  useCopyLink, useDebounced, likePattern, compact,
} from '../ProfileLayout'
import type { ListingCardData } from '../ProfileLayout'

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
  created_at: string | null
}

type Listing = ListingCardData

type Tab = 'posts' | 'listings' | 'media' | 'about'

// Route: /companies/:id (public company page). Same X-style layout as the user profile.
export default function CompanyDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { formatPrice } = useLocale()
  const { copy, toast } = useCopyLink()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [company, setCompany] = useState<Company | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [posts, setPosts] = useState<PostCardData[]>([])
  const [postsCount, setPostsCount] = useState(0)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [following, setFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('posts')

  // Search inside this company (posts + listings)
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 300)
  const [sPosts, setSPosts] = useState<PostCardData[]>([])
  const [sListings, setSListings] = useState<Listing[]>([])
  const [sBusy, setSBusy] = useState(false)

  const load = async () => {
    if (!id || !user) return
    setNetError(false)
    setLoading(true)

    try {
      const [companyRes, listingsRes, followRes, postsRes, postsCountRes, likedRes, savedRes] = await Promise.all([
        supabase.from('companies').select('id, owner_id, name, category, business_type, description, location, logo_url, cover_url, phone, whatsapp, website, address, city, state, country, products, services, gallery, social_links, is_premium, premium_until, trusted_partner, status, followers_count, created_at').eq('id', id).maybeSingle(),
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

  // Search this company's public posts and listings
  const companyId = company?.id
  useEffect(() => {
    if (!searching || !companyId) return
    if (dq.length < 2) {
      setSPosts([])
      setSListings([])
      setSBusy(false)
      return
    }
    let cancelled = false
    setSBusy(true)
    const pat = likePattern(dq)
    Promise.all([
      supabase.from('posts').select(POST_SELECT).eq('company_id', companyId).eq('visibility', 'public').ilike('content', pat).order('created_at', { ascending: false }).limit(30),
      supabase.from('marketplace_listings').select('id, title, price, unit, location, images').eq('company_id', companyId).eq('status', 'available').ilike('title', pat).order('created_at', { ascending: false }).limit(20),
    ]).then(([pr, lr]) => {
      if (cancelled) return
      setSPosts((pr.data || []) as any)
      setSListings((lr.data || []) as any)
      setSBusy(false)
    }, () => {
      if (cancelled) return
      setSBusy(false)
    })
    return () => { cancelled = true }
  }, [dq, searching, companyId])

  const toggleFollow = async () => {
    if (!user || !company || followBusy) return
    setFollowBusy(true)
    if (following) {
      const { error } = await supabase.from('company_followers').delete().eq('user_id', user.id).eq('company_id', company.id)
      if (!error) {
        setFollowing(false)
        setFollowCache(user.id, 'company', company.id, false)
        setCompany((prev) => prev ? { ...prev, followers_count: Math.max(prev.followers_count - 1, 0) } : prev)
      }
    } else {
      const { error } = await supabase.from('company_followers').insert({ user_id: user.id, company_id: company.id })
      if (!error) {
        setFollowing(true)
        setFollowCache(user.id, 'company', company.id, true)
        setCompany((prev) => prev ? { ...prev, followers_count: prev.followers_count + 1 } : prev)
      }
    }
    setFollowBusy(false)
  }

  if (netError) {
    return (
      <ProfileShell>
        <ProfileHeader onBack={() => navigate(-1)} title="Company" />
        <NetworkError onRetry={load} />
      </ProfileShell>
    )
  }

  if (loading) {
    return (
      <ProfileShell>
        <ProfileHeader onBack={() => navigate(-1)} title="Company" />
        <div style={{ padding: '16px' }}><ListCardSkeleton count={4} /></div>
      </ProfileShell>
    )
  }

  if (!company) {
    return (
      <ProfileShell>
        <ProfileHeader onBack={() => navigate(-1)} title="Company" />
        <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORS.textMuted, fontSize: '13px' }}>Company not found.</div>
      </ProfileShell>
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
  const joined = company.created_at ? new Date(company.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null
  const postsLabel = `${compact(postsCount)} ${postsCount === 1 ? 'post' : 'posts'}`
  const typeLine = [company.category, company.business_type].filter(Boolean).join(' · ')
  const menuItems = [
    ...(!isOwner && following ? [{ label: 'Notifications', onClick: () => setNotifyOpen(true) }] : []),
    { label: 'Copy company link', onClick: () => copy(`${window.location.origin}/companies/${company.id}`) },
  ]

  // Search view: sits under the header, results are this company's posts and listings.
  if (searching) {
    const noResults = dq.length >= 2 && !sBusy && sPosts.length === 0 && sListings.length === 0
    return (
      <ProfileShell>
        <ProfileHeader onBack={() => navigate(-1)} title={company.name} subtitle={postsLabel} />
        <ProfileSearchBar value={q} onChange={setQ} onClose={() => { setSearching(false); setQ('') }} placeholder={`Search ${company.name}`} />
        <div style={{ padding: '14px 16px' }}>
          {dq.length < 2 && <EmptyCard icon="search" text="Type at least 2 letters to search posts and listings." />}
          {dq.length >= 2 && sBusy && <FeedPostSkeleton count={2} />}
          {noResults && <EmptyCard icon="search" text={`No posts or listings match “${dq}”.`} />}
          {!sBusy && sPosts.length > 0 && (
            <>
              <SectionLabel>Posts</SectionLabel>
              {sPosts.map((p) => <PostCard key={p.id} post={p} initialLiked={likedIds.has(p.id)} initialSaved={savedIds.has(p.id)} hideFollow />)}
            </>
          )}
          {!sBusy && sListings.length > 0 && (
            <>
              <SectionLabel>Listings</SectionLabel>
              <ListingGrid listings={sListings} formatPrice={formatPrice} onOpen={(lid) => navigate(`/marketplace?listing=${lid}`)} by={company.name} />
            </>
          )}
        </div>
      </ProfileShell>
    )
  }

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
    <ProfileShell>
      <ProfileHeader onBack={() => navigate(-1)} title={company.name} subtitle={postsLabel} />

      <ProfileCover src={company.cover_url} />

      <ProfileTop
        image={company.logo_url}
        alt={`${company.name} logo`}
        fallbackIcon="building"
        actions={
          <>
            <DotsMenu items={menuItems} />
            <RoundIconButton label="Search this company" onClick={() => setSearching(true)}>
              <Icon name="search" size={17} color={COLORS.text} />
            </RoundIconButton>
            {isOwner ? (
              <PillButton onClick={() => navigate(COMPANY_EDIT_PATH)} filled={false}>Edit company</PillButton>
            ) : (
              <>
                {contactHref && (
                  <RoundIconButton label="Contact" onClick={() => window.open(contactHref, '_blank', 'noopener')}>
                    <Icon name="message" size={17} color={COLORS.text} />
                  </RoundIconButton>
                )}
                <PillButton onClick={toggleFollow} filled={!following} disabled={followBusy}>
                  {following ? 'Following' : 'Follow'}
                </PillButton>
              </>
            )}
          </>
        }
      />

      <div style={{ padding: '8px 16px 0' }}>
        <NameRow
          name={company.name}
          verified={verified}
          verifiedLabel="Verified company"
          premium={premium}
          premiumLabel="Premium company"
          onUpgrade={isOwner ? () => navigate(COMPANY_PREMIUM_PATH) : undefined}
        />
        {typeLine && <p style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '1px', textTransform: 'capitalize' }}>{typeLine}</p>}

        {(company.trusted_partner || (isOwner && !verified)) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {company.trusted_partner && <Chip bg="#FEF3C7" color="#92400E">★ Trusted Partner</Chip>}
            {isOwner && !verified && <Chip bg="#FEF3C7" color="#92400E">{company.status === 'rejected' ? 'Verification rejected' : 'Verification pending'}</Chip>}
          </div>
        )}

        {company.description && <BioText text={company.description} />}

        <MetaRow>
          {place && <MetaItem icon={<Icon name="mapPin" size={14} color={COLORS.textMuted} />}>{place}</MetaItem>}
          {websiteHref && (
            <MetaItem icon={<Icon name="link" size={14} color={COLORS.textMuted} />}>
              <a href={websiteHref} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.green, fontWeight: 600, textDecoration: 'none' }}>{websiteLabel}</a>
            </MetaItem>
          )}
          {joined && <MetaItem icon={<CalendarIcon />}>Joined {joined}</MetaItem>}
        </MetaRow>

        <CountsRow items={[
          { value: compact(company.followers_count), label: 'Followers' },
          { value: compact(listings.length), label: listings.length === 1 ? 'Listing' : 'Listings' },
        ]} />

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
                <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>Grow Your Company with Farmxie Premium</p>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '4px' }}>Blue tick, more listings and company tools. See exactly what is included.</p>
                <div onClick={() => navigate(COMPANY_PREMIUM_PATH)} style={{ marginTop: '10px', textAlign: 'center', padding: '10px', borderRadius: '10px', background: '#1877F2', color: 'white', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
                  Upgrade to Company Premium
                </div>
              </div>
            )}
          </div>
        )}

        <ProfileTabs<Tab>
          tabs={[{ key: 'posts', label: 'Posts' }, { key: 'listings', label: 'Listings' }, { key: 'media', label: 'Media' }, { key: 'about', label: 'About' }]}
          active={tab}
          onChange={setTab}
        />

        <div style={{ paddingTop: '16px' }}>
          {tab === 'posts' && (
            posts.length === 0
              ? <EmptyCard icon="comment" text="No posts from this company yet." />
              : posts.map((p) => (
                <PostCard key={p.id} post={p} initialLiked={likedIds.has(p.id)} initialSaved={savedIds.has(p.id)} hideFollow />
              ))
          )}

          {tab === 'listings' && (
            listings.length === 0
              ? <EmptyCard icon="tag" text="No listings from this company yet." />
              : <ListingGrid listings={listings} formatPrice={formatPrice} onOpen={(lid) => navigate(`/marketplace?listing=${lid}`)} by={company.name} />
          )}

          {tab === 'media' && <PhotoGrid images={gallery} empty="No photos added yet." />}

          {tab === 'about' && (
            <>
              {company.description ? (
                <Block title="Company overview"><p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{company.description}</p></Block>
              ) : null}
              {focus.length > 0 && <Block title="Business focus"><Tags items={focus} /></Block>}
              {services.length > 0 && <Block title="Services"><Tags items={services} /></Block>}

              <div style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden' }}>
                <AboutRow label="Category" value={company.category} />
                <AboutRow label="Business type" value={company.business_type} />
                <AboutRow label="Location" value={place} />
                <AboutRow label="Address" value={company.address} />
                <AboutRow label="Website" value={websiteLabel || null} href={websiteHref || undefined} />
                <AboutRow label="Phone" value={company.phone} href={company.phone ? `tel:${company.phone}` : undefined} />
                <AboutRow label="WhatsApp" value={company.whatsapp} href={contactHref && company.whatsapp ? contactHref : undefined} />
                {Object.entries((company.social_links || {}) as Record<string, string>).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => (
                  <AboutRow key={k} label={k} value={v.replace(/^https?:\/\//, '')} href={v.startsWith('http') ? v : `https://${v}`} />
                ))}
                <AboutRow label="Verification" value={verified ? 'Verified company' : null} />
                <AboutRow label="Partnership" value={company.trusted_partner ? 'Farmxie Trusted Partner' : null} />
                <AboutRow label="Joined Farmxie" value={joined} />
              </div>
            </>
          )}
        </div>
      </div>

      {!isOwner && (
        <FollowNotifySheet open={notifyOpen} onClose={() => setNotifyOpen(false)} kind="company" targetId={company.id} name={company.name} />
      )}
      {toast}
    </ProfileShell>
  )
}

function Chip({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return <span style={{ background: bg, color, fontSize: '10.5px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px' }}>{children}</span>
}
