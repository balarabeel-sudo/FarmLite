import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import Icon from '../Icons'
import { ProfileHeaderSkeleton, FeedPostSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import PostCard, { POST_SELECT } from '../PostCard'
import type { PostCardData } from '../PostCard'
import PremiumTick from '../PremiumTick'
import { isPremiumActive } from '../premiumShared'
import { cleanPhone, whatsappLink } from '../phoneUtils'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  orange: '#F59E0B',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

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

type Listing = {
  id: string
  title: string
  price: number
  unit: string | null
  images: string[] | null
}

type Tab = 'posts' | 'media' | 'about'

// Route: /u/:username  (public profile; also shows your own profile with Edit Profile)
// Profile = public identity + social presence. Account, My Farm and Marketplace management live elsewhere.
export default function UserProfilePage() {
  const navigate = useNavigate()
  const { username } = useParams<{ username: string }>()
  const { user } = useAuth()
  const { formatPrice } = useLocale()

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const copyLink = async () => {
    setMenuOpen(false)
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${username}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked */ }
  }

  if (netError) {
    return (
      <Shell>
        <Header onBack={() => navigate(-1)} />
        <NetworkError onRetry={load} />
      </Shell>
    )
  }

  if (notFound) {
    return (
      <Shell>
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <Icon name="user" size={30} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>User not found</p>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px' }}>@{username} does not exist or was removed.</p>
        </div>
      </Shell>
    )
  }

  if (loading || !profile) {
    return (
      <Shell>
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: '16px' }}>
          <ProfileHeaderSkeleton />
          <div style={{ marginTop: '24px' }}><FeedPostSkeleton count={2} /></div>
        </div>
      </Shell>
    )
  }

  const isSelf = !!user && profile.user_id === user.id
  const premium = isPremiumActive(profile.is_premium, profile.premium_until)
  const roleLabel = ROLE_LABELS[profile.role]
  const websiteHref = profile.website ? (profile.website.startsWith('http') ? profile.website : `https://${profile.website}`) : null
  const websiteLabel = profile.website ? profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : ''
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const mediaImages = mediaPosts.flatMap((m) => m.images)

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
    <Shell>
      <Header onBack={() => navigate(-1)} right={
        <div style={{ position: 'relative' }}>
          <div role="button" aria-label="More options" onClick={() => setMenuOpen((o) => !o)} style={{ padding: '6px', cursor: 'pointer', display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={COLORS.text} aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
          </div>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
              <div style={{ position: 'absolute', right: 0, top: '34px', zIndex: 21, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', minWidth: '160px', overflow: 'hidden' }}>
                <div onClick={copyLink} style={{ padding: '11px 14px', fontSize: '12.5px', fontWeight: 600, color: COLORS.text, cursor: 'pointer' }}>Copy profile link</div>
              </div>
            </>
          )}
        </div>
      } />

      {/* Cover */}
      <div style={{ height: '128px', background: profile.cover_image ? '#E5EFE5' : 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 55%, #86EFAC 100%)', position: 'relative', overflow: 'hidden' }}>
        {profile.cover_image
          ? <img src={profile.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', right: '-12px', bottom: '-18px', opacity: 0.35 }}><Icon name="leaf" size={110} color={COLORS.green} /></div>}
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Photo overlapping the cover */}
        <div style={{ marginTop: '-42px' }}>
          <div style={{ width: '84px', height: '84px', borderRadius: '42px', border: `4px solid ${COLORS.bg}`, background: COLORS.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxSizing: 'border-box' }}>
            {profile.profile_image ? <img src={profile.profile_image} alt={profile.full_name || 'Profile photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={34} color={COLORS.green} />}
          </div>
        </div>

        {/* Name + badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text }}>{profile.full_name || profile.username || 'FarmLite user'}</p>
          {profile.is_verified && <span title="Verified" style={{ display: 'flex' }}><Icon name="checkCircle" size={16} color={COLORS.green} /></span>}
          {premium && <PremiumTick size={19} label="Premium member" />}
        </div>
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '2px' }}>@{profile.username}</p>
        {roleLabel && <p style={{ fontSize: '12.5px', fontWeight: 600, color: COLORS.greenDark, marginTop: '6px' }}>{roleLabel}</p>}

        {isSelf && !premium && (
          <div onClick={() => navigate('/premium')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', padding: '6px 12px', borderRadius: '999px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            <PremiumTick size={14} /> Upgrade to Premium
          </div>
        )}

        {profile.bio ? (
          <p style={{ fontSize: '13px', color: COLORS.text, marginTop: '10px', lineHeight: 1.55 }}>{profile.bio}</p>
        ) : isSelf ? (
          <p onClick={() => navigate('/profile/edit')} style={{ fontSize: '12.5px', color: COLORS.green, fontWeight: 700, marginTop: '10px', cursor: 'pointer' }}>+ Add a bio</p>
        ) : null}

        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {profile.location && <InfoRow icon="mapPin">{profile.location}</InfoRow>}
          {websiteHref && (
            <InfoRow icon="link">
              <a href={websiteHref} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.green, fontWeight: 600, textDecoration: 'none' }}>{websiteLabel}</a>
            </InfoRow>
          )}
          <InfoRow icon={<CalendarIcon />}>Joined FarmLite {joined}</InfoRow>
        </div>

        {/* Actions */}
        {isSelf ? (
          <div onClick={() => navigate('/profile/edit')} style={{ ...btn(false), marginTop: '16px' }}>
            <Icon name="edit" size={14} color={COLORS.text} /> Edit Profile
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <div onClick={toggleFollow} style={{ ...btn(!isFollowing), flex: 1, opacity: followBusy ? 0.6 : 1 }}>
              <Icon name={isFollowing ? 'check' : 'plus'} size={14} color={isFollowing ? COLORS.text : 'white'} />
              {isFollowing ? 'Following' : 'Follow'}
            </div>
            <div onClick={() => navigate(`/messages?to=${profile.user_id}`)} style={{ ...btn(false), flex: 1 }}>
              <Icon name="message" size={14} color={COLORS.text} /> Message
            </div>
          </div>
        )}

        {!isSelf && (profile.whatsapp || profile.phone) && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            {profile.whatsapp && (
              <a href={whatsappLink(profile.whatsapp)} target="_blank" rel="noopener noreferrer" style={{ ...soft, flex: 1 }}>
                <Icon name="message" size={14} color={COLORS.greenDark} /> WhatsApp
              </a>
            )}
            {profile.phone && (
              <a href={`tel:${cleanPhone(profile.phone)}`} style={{ ...soft, flex: 1 }}>
                <Icon name="phone" size={14} color={COLORS.greenDark} /> Call
              </a>
            )}
          </div>
        )}

        {/* Stats: real values from the database */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <Stat label="Posts" value={compact(profile.posts_count || 0)} />
          <Stat label="Followers" value={compact(profile.followers_count || 0)} />
          <Stat label="Following" value={compact(profile.following_count || 0)} />
          <Stat label="Likes" value={compact(likesReceived)} />
        </div>

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

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, marginTop: '18px' }}>
          {(['posts', 'media', 'about'] as Tab[]).map((t) => (
            <div key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{
              flex: 1, textAlign: 'center', padding: '11px 0', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
              color: tab === t ? COLORS.green : COLORS.textMuted, borderBottom: `2px solid ${tab === t ? COLORS.green : 'transparent'}`,
            }}>
              {t}
            </div>
          ))}
        </div>

        <div style={{ paddingTop: '16px' }}>
          {tab === 'posts' && (
            posts.length === 0
              ? <Empty icon="comment" text="No posts yet." />
              : posts.map((p) => <PostCard key={p.id} post={p} initialLiked={likedIds.has(p.id)} initialSaved={savedIds.has(p.id)} />)
          )}

          {tab === 'media' && (
            mediaImages.length === 0 ? (
              <Empty icon="leaf" text="No photos shared yet." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                {mediaImages.map((src, i) => (
                  <a key={`${src}-${i}`} href={src} target="_blank" rel="noopener noreferrer" style={{ display: 'block', aspectRatio: '1 / 1', background: '#E5EFE5', borderRadius: '8px', overflow: 'hidden' }}>
                    <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </a>
                ))}
              </div>
            )
          )}

          {tab === 'about' && (
            <>
              <div style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', marginBottom: '14px' }}>
                <AboutRow label="About" value={profile.bio} />
                <AboutRow label="Professional role" value={roleLabel} />
                <AboutRow label="Agricultural focus" value={profile.farm_type} />
                <AboutRow label="Location" value={profile.location} />
                <AboutRow label="Website" value={websiteLabel || null} href={websiteHref || undefined} />
                <AboutRow label="Joined FarmLite" value={joined} />
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

      {copied && (
        <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', background: COLORS.text, color: 'white', fontSize: '12px', fontWeight: 600, padding: '9px 16px', borderRadius: '999px', zIndex: 30 }}>
          Link copied
        </div>
      )}
    </Shell>
  )
}

const btn = (filled: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px',
  fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
  background: filled ? COLORS.green : COLORS.card, color: filled ? 'white' : COLORS.text,
  border: `1px solid ${filled ? COLORS.green : COLORS.border}`,
})

const soft: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px',
  background: COLORS.greenSoft, color: COLORS.greenDark, fontSize: '12.5px', fontWeight: 700, textDecoration: 'none',
}

function Shell({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>{children}</div>
}

function InfoRow({ icon, children }: { icon: string | ReactNode; children: ReactNode }) {
  return (
    <div style={{ fontSize: '12.5px', color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: '7px' }}>
      {typeof icon === 'string' ? <Icon name={icon} size={13} color={COLORS.textMuted} /> : icon}
      <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{children}</span>
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

function AboutRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  if (!value) return null
  return (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${COLORS.bg}` }}>
      <p style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</p>
      {href
        ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: COLORS.green, textDecoration: 'none', marginTop: '3px', display: 'block', wordBreak: 'break-word' }}>{value}</a>
        : <p style={{ fontSize: '13px', color: COLORS.text, marginTop: '3px', lineHeight: 1.5, wordBreak: 'break-word' }}>{value}</p>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: COLORS.card, borderRadius: '12px', padding: '10px 4px', textAlign: 'center' }}>
      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '2px' }}>{label}</p>
    </div>
  )
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '28px 16px', textAlign: 'center' }}>
      <Icon name={icon} size={26} color={COLORS.textMuted} />
      <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '10px' }}>{text}</p>
    </div>
  )
}

// 1200 -> 1.2K, 10500 -> 10.5K
function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function Header({ onBack, right }: { onBack: () => void; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div role="button" aria-label="Back" onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, flex: 1 }}>Profile</p>
      {right}
    </div>
  )
}
