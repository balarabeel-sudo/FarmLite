import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import Icon from '../Icons'
import { ProfileHeaderSkeleton, FeedPostSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import PostCard, { POST_SELECT } from '../PostCard'
import type { PostCardData } from '../PostCard'
import { isPremiumActive } from '../premiumShared'
import { cleanPhone, whatsappLink } from '../phoneUtils'
import {
  PCOLORS as COLORS, ProfileShell, ProfileHeader, ProfileCover, ProfileTop, RoundIconButton, PillButton, DotsMenu, NameRow,
  BioText, CalendarIcon, MetaRow, MetaItem, CountsRow, ProfileTabs, ProfileSearchBar, SectionLabel, EmptyCard, AboutRow, PhotoGrid, ListingGrid,
  softLink, useCopyLink, useDebounced, likePattern, compact,
} from '../ProfileLayout'
import type { ListingCardData } from '../ProfileLayout'

const ROLE_LABELS: Record<string, string> = { farmer: 'Farmer', buyer: 'Buyer', agribusiness: 'Agribusiness' }

type Profile = {
  user_id: string
  full_name: string | null
  username: string | null
  profile_image: string | null
  cover_image: string | null
  bio: string | null
  location: string | null
  role: string
  farm_type: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  is_verified: boolean
  is_premium: boolean
  premium_until: string | null
  followers_count: number
  following_count: number
  posts_count: number
  created_at: string
}

type Listing = ListingCardData

type Tab = 'posts' | 'media' | 'about'

// Route: /u/:username  (public profile; also shows your own profile with Edit profile)
// X-style layout: cover, full photo circle, action buttons, name + ticks, bio, meta row, counts, tabs.
// Profile = public identity + social presence. Account, My Farm and Marketplace management live elsewhere.
export default function UserProfilePage() {
  const navigate = useNavigate()
  const { username } = useParams<{ username: string }>()
  const { user } = useAuth()
  const { formatPrice } = useLocale()
  const { copy, toast } = useCopyLink()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<PostCardData[]>([])
  const [mediaPosts, setMediaPosts] = useState<{ id: string; images: string[] }[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [listingsCount, setListingsCount] = useState(0)
  const [likesReceived, setLikesReceived] = useState(0)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [isFollowing, setIsFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('posts')

  // Search inside this profile (posts + listings)
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 300)
  const [sPosts, setSPosts] = useState<PostCardData[]>([])
  const [sListings, setSListings] = useState<Listing[]>([])
  const [sBusy, setSBusy] = useState(false)

  const load = async () => {
    if (!user || !username) return
    setNetError(false)
    setNotFound(false)
    setLoading(true)

    const profileRes = await supabase
      .from('profiles')
      .select('user_id, full_name, username, profile_image, cover_image, bio, location, role, farm_type, phone, whatsapp, website, is_verified, is_premium, premium_until, followers_count, following_count, posts_count, created_at')
      .eq('username', username)
      .maybeSingle()

    if (profileRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }
    const p = profileRes.data as Profile | null
    if (!p) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const [postsRes, mediaRes, listingsRes, followRes, likesRes, likedRes, savedRes] = await Promise.all([
      supabase.from('posts').select(POST_SELECT).eq('user_id', p.user_id).is('company_id', null).eq('visibility', 'public').order('created_at', { ascending: false }).limit(30),
      supabase.from('posts').select('id, images').eq('user_id', p.user_id).is('company_id', null).eq('visibility', 'public').not('images', 'is', null).order('created_at', { ascending: false }).limit(60),
      supabase.from('marketplace_listings').select('id, title, price, unit, images', { count: 'exact' }).eq('seller_id', p.user_id).eq('status', 'available').order('created_at', { ascending: false }).limit(6),
      supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', p.user_id).maybeSingle(),
      supabase.rpc('profile_likes_received', { p_user: p.user_id }),
      supabase.from('post_likes').select('post_id').eq('user_id', user.id),
      supabase.from('saved_items').select('post_id').eq('user_id', user.id).not('post_id', 'is', null),
    ])

    if (postsRes.error || listingsRes.error || followRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setProfile(p)
    setPosts((postsRes.data || []) as any)
    setMediaPosts(((mediaRes.data || []) as any[]).filter((m) => Array.isArray(m.images) && m.images.length > 0))
    setListings((listingsRes.data || []) as any)
    setListingsCount(listingsRes.count || 0)
    setIsFollowing(!!followRes.data)
    setLikesReceived(Number(likesRes.data) || 0)
    setLikedIds(new Set((likedRes.data || []).map((r: any) => r.post_id)))
    setSavedIds(new Set((savedRes.data || []).map((r: any) => r.post_id)))
    setLoading(false)

    // Count the visit for Profile Views analytics. The database ignores your own visits and repeat visits within an hour.
    if (p.user_id !== user.id) {
      supabase.rpc('track_view', { p_kind: 'profile', p_target: p.user_id }).then(() => {}, () => {})
    }
  }

  useEffect(() => { load() }, [user, username])

  // Search this user's public posts and listings
  const profileUserId = profile?.user_id
  useEffect(() => {
    if (!searching || !profileUserId) return
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
      supabase.from('posts').select(POST_SELECT).eq('user_id', profileUserId).is('company_id', null).eq('visibility', 'public').ilike('content', pat).order('created_at', { ascending: false }).limit(30),
      supabase.from('marketplace_listings').select('id, title, price, unit, location, images').eq('seller_id', profileUserId).is('company_id', null).eq('status', 'available').ilike('title', pat).order('created_at', { ascending: false }).limit(20),
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
  }, [dq, searching, profileUserId])

  const toggleFollow = async () => {
    if (!user || !profile || followBusy) return
    setFollowBusy(true)
    const next = !isFollowing
    // Optimistic update; the database trigger keeps the real counts in sync.
    setIsFollowing(next)
    setProfile((prev) => (prev ? { ...prev, followers_count: Math.max(0, prev.followers_count + (next ? 1 : -1)) } : prev))

    const { error } = next
      ? await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.user_id })
      : await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profile.user_id)

    if (error) {
      setIsFollowing(!next)
      setProfile((prev) => (prev ? { ...prev, followers_count: Math.max(0, prev.followers_count + (next ? -1 : 1)) } : prev))
    }
    setFollowBusy(false)
  }

  if (netError) {
    return (
      <ProfileShell>
        <ProfileHeader onBack={() => navigate(-1)} title="Profile" />
        <NetworkError onRetry={load} />
      </ProfileShell>
    )
  }

  if (notFound) {
    return (
      <ProfileShell>
        <ProfileHeader onBack={() => navigate(-1)} title="Profile" />
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <Icon name="user" size={30} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>User not found</p>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px' }}>@{username} does not exist or was removed.</p>
        </div>
      </ProfileShell>
    )
  }

  if (loading || !profile) {
    return (
      <ProfileShell>
        <ProfileHeader onBack={() => navigate(-1)} title="Profile" />
        <div style={{ padding: '16px' }}>
          <ProfileHeaderSkeleton />
          <div style={{ marginTop: '24px' }}><FeedPostSkeleton count={2} /></div>
        </div>
      </ProfileShell>
    )
  }

  const isSelf = !!user && profile.user_id === user.id
  const premium = isPremiumActive(profile.is_premium, profile.premium_until)
  const displayName = profile.full_name || profile.username || 'Farmxie user'
  const roleLabel = ROLE_LABELS[profile.role]
  const websiteHref = profile.website ? (profile.website.startsWith('http') ? profile.website : `https://${profile.website}`) : null
  const websiteLabel = profile.website ? profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : ''
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const mediaImages = mediaPosts.flatMap((m) => m.images)
  const postsLabel = `${compact(profile.posts_count || 0)} ${profile.posts_count === 1 ? 'post' : 'posts'}`
  const menuItems = [{ label: 'Copy profile link', onClick: () => copy(`${window.location.origin}/u/${username}`) }]

  // Search view: sits under the header, results are this user's posts and listings.
  if (searching) {
    const noResults = dq.length >= 2 && !sBusy && sPosts.length === 0 && sListings.length === 0
    return (
      <ProfileShell>
        <ProfileHeader onBack={() => navigate(-1)} title={displayName} subtitle={postsLabel} />
        <ProfileSearchBar value={q} onChange={setQ} onClose={() => { setSearching(false); setQ('') }} placeholder={`Search ${isSelf ? 'your' : `${profile.full_name?.split(' ')[0] || 'their'}'s`} posts`} />
        <div style={{ padding: '14px 16px' }}>
          {dq.length < 2 && <EmptyCard icon="search" text="Type at least 2 letters to search posts and listings." />}
          {dq.length >= 2 && sBusy && <FeedPostSkeleton count={2} />}
          {noResults && <EmptyCard icon="search" text={`No posts or listings match “${dq}”.`} />}
          {!sBusy && sPosts.length > 0 && (
            <>
              <SectionLabel>Posts</SectionLabel>
              {sPosts.map((p) => <PostCard key={p.id} post={p} initialLiked={likedIds.has(p.id)} initialSaved={savedIds.has(p.id)} />)}
            </>
          )}
          {!sBusy && sListings.length > 0 && (
            <>
              <SectionLabel>Listings</SectionLabel>
              <ListingGrid listings={sListings} formatPrice={formatPrice} onOpen={(id) => navigate(`/marketplace?listing=${id}`)} />
            </>
          )}
        </div>
      </ProfileShell>
    )
  }

  // Own profile only: which of the public fields are still empty.
  const checks: [string, boolean][] = [
    ['Profile photo', !!profile.profile_image],
    ['Cover photo', !!profile.cover_image],
    ['Bio', !!profile.bio?.trim()],
    ['Location', !!profile.location],
    ['Website', !!profile.website],
  ]
  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label)
  const completeness = Math.round(((checks.length - missing.length) / checks.length) * 100)

  return (
    <ProfileShell>
      <ProfileHeader onBack={() => navigate(-1)} title={displayName} subtitle={postsLabel} />

      <ProfileCover src={profile.cover_image} />

      <ProfileTop
        image={profile.profile_image}
        alt={displayName}
        fallbackIcon="user"
        actions={
          <>
            <DotsMenu items={menuItems} />
            <RoundIconButton label="Search this profile" onClick={() => setSearching(true)}>
              <Icon name="search" size={17} color={COLORS.text} />
            </RoundIconButton>
            {isSelf ? (
              <PillButton onClick={() => navigate('/profile/edit')} filled={false}>Edit profile</PillButton>
            ) : (
              <>
                <RoundIconButton label="Message" onClick={() => navigate(`/messages?to=${profile.user_id}`)}>
                  <Icon name="message" size={17} color={COLORS.text} />
                </RoundIconButton>
                <PillButton onClick={toggleFollow} filled={!isFollowing} disabled={followBusy}>
                  {isFollowing ? 'Following' : 'Follow'}
                </PillButton>
              </>
            )}
          </>
        }
      />

      <div style={{ padding: '8px 16px 0' }}>
        <NameRow
          name={displayName}
          verified={profile.is_verified}
          verifiedLabel="Verified"
          premium={premium}
          premiumLabel="Premium member"
          onUpgrade={isSelf ? () => navigate('/premium') : undefined}
        />
        <p style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '1px' }}>@{profile.username}</p>

        {profile.bio ? (
          <BioText text={profile.bio} />
        ) : isSelf ? (
          <p onClick={() => navigate('/profile/edit')} style={{ fontSize: '12.5px', color: COLORS.green, fontWeight: 700, marginTop: '8px', cursor: 'pointer' }}>+ Add a bio</p>
        ) : null}

        <MetaRow>
          {roleLabel && <MetaItem icon={<Icon name="briefcase" size={14} color={COLORS.textMuted} />}>{roleLabel}</MetaItem>}
          {profile.location && <MetaItem icon={<Icon name="mapPin" size={14} color={COLORS.textMuted} />}>{profile.location}</MetaItem>}
          {websiteHref && (
            <MetaItem icon={<Icon name="link" size={14} color={COLORS.textMuted} />}>
              <a href={websiteHref} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.green, fontWeight: 600, textDecoration: 'none' }}>{websiteLabel}</a>
            </MetaItem>
          )}
          <MetaItem icon={<CalendarIcon />}>Joined {joined}</MetaItem>
        </MetaRow>

        <CountsRow items={[
          { value: compact(profile.following_count || 0), label: 'Following' },
          { value: compact(profile.followers_count || 0), label: 'Followers' },
          { value: compact(likesReceived), label: 'Likes' },
        ]} />

        {!isSelf && (profile.whatsapp || profile.phone) && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            {profile.whatsapp && (
              <a href={whatsappLink(profile.whatsapp)} target="_blank" rel="noopener noreferrer" style={{ ...softLink, flex: 1 }}>
                <Icon name="message" size={14} color={COLORS.greenDark} /> WhatsApp
              </a>
            )}
            {profile.phone && (
              <a href={`tel:${cleanPhone(profile.phone)}`} style={{ ...softLink, flex: 1 }}>
                <Icon name="phone" size={14} color={COLORS.greenDark} /> Call
              </a>
            )}
          </div>
        )}

        {isSelf && missing.length > 0 && (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px', marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text }}>Profile {completeness}% complete</p>
              <p onClick={() => navigate('/profile/edit')} style={{ fontSize: '12px', fontWeight: 700, color: COLORS.green, cursor: 'pointer' }}>Complete</p>
            </div>
            <div style={{ height: '6px', borderRadius: '3px', background: COLORS.greenSoft, marginTop: '8px', overflow: 'hidden' }}>
              <div style={{ width: `${completeness}%`, height: '100%', background: COLORS.green }} />
            </div>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '8px' }}>Missing: {missing.join(', ')}</p>
          </div>
        )}

        <ProfileTabs<Tab>
          tabs={[{ key: 'posts', label: 'Posts' }, { key: 'media', label: 'Media' }, { key: 'about', label: 'About' }]}
          active={tab}
          onChange={setTab}
        />

        <div style={{ paddingTop: '16px' }}>
          {tab === 'posts' && (
            posts.length === 0
              ? <EmptyCard icon="comment" text="No posts yet." />
              : posts.map((p) => <PostCard key={p.id} post={p} initialLiked={likedIds.has(p.id)} initialSaved={savedIds.has(p.id)} />)
          )}

          {tab === 'media' && <PhotoGrid images={mediaImages} empty="No photos shared yet." />}

          {tab === 'about' && (
            <>
              <div style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', marginBottom: '14px' }}>
                <AboutRow label="About" value={profile.bio} />
                <AboutRow label="Professional role" value={roleLabel} />
                <AboutRow label="Agricultural focus" value={profile.farm_type} />
                <AboutRow label="Location" value={profile.location} />
                <AboutRow label="Website" value={websiteLabel || null} href={websiteHref || undefined} />
                <AboutRow label="Joined Farmxie" value={joined} />
              </div>

              {listingsCount > 0 && (
                <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>Marketplace</p>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>{listingsCount} active listing{listingsCount === 1 ? '' : 's'}</p>
                  <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginTop: '10px', paddingBottom: '2px' }}>
                    {listings.map((l) => (
                      <div key={l.id} onClick={() => navigate(`/marketplace?listing=${l.id}`)} style={{ minWidth: '120px', width: '120px', border: `1px solid ${COLORS.border}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}>
                        <div style={{ height: '72px', background: '#E5EFE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {l.images?.[0] ? <img src={l.images[0]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={20} color={COLORS.green} />}
                        </div>
                        <div style={{ padding: '8px' }}>
                          <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
                          <p style={{ fontSize: '11.5px', fontWeight: 800, color: COLORS.green, marginTop: '2px' }}>{formatPrice(Number(l.price))}{l.unit ? `/${l.unit}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {toast}
    </ProfileShell>
  )
}
