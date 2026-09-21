import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ProfileHeaderSkeleton, FeedPostSkeleton, GridCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import PostImages from '../PostImages'
import { cleanPhone, whatsappLink } from '../phoneUtils'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  orange: '#F59E0B',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
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
  followers_count: number
  following_count: number
  posts_count: number
}

type Post = {
  id: string
  content: string
  images: string[] | null
  likes_count: number
  comments_count: number
  created_at: string
}

type Listing = {
  id: string
  title: string
  price: number
  currency: string
  unit: string | null
  location: string | null
  images: string[] | null
}

// Route: /u/:username  (public profile of another user)
export default function UserProfilePage() {
  const navigate = useNavigate()
  const { username } = useParams<{ username: string }>()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [tab, setTab] = useState<'posts' | 'listings'>('posts')

  const load = async () => {
    if (!user || !username) return
    setNetError(false)
    setNotFound(false)
    setLoading(true)

    const profileRes = await supabase
      .from('profiles')
      .select('user_id, full_name, username, profile_image, cover_image, bio, location, role, farm_type, phone, whatsapp, website, is_verified, followers_count, following_count, posts_count')
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
    if (p.user_id === user.id) {
      navigate('/profile', { replace: true })
      return
    }

    const [postsRes, listingsRes, followRes] = await Promise.all([
      supabase.from('posts').select('id, content, images, likes_count, comments_count, created_at').eq('user_id', p.user_id).eq('visibility', 'public').order('created_at', { ascending: false }).limit(30),
      supabase.from('marketplace_listings').select('id, title, price, currency, unit, location, images').eq('seller_id', p.user_id).eq('status', 'available').order('created_at', { ascending: false }).limit(30),
      supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', p.user_id).maybeSingle(),
    ])

    if (postsRes.error || listingsRes.error || followRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setProfile(p)
    setPosts((postsRes.data || []) as any)
    setListings((listingsRes.data || []) as any)
    setIsFollowing(!!followRes.data)
    setLoading(false)
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

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header title="Profile" onBack={() => navigate(-1)} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header title="Profile" onBack={() => navigate(-1)} />
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <Icon name="user" size={30} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>User not found</p>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px' }}>@{username} does not exist or was removed.</p>
        </div>
      </div>
    )
  }

  const roleLabel = profile ? ROLE_LABELS[profile.role] : undefined

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header title={profile?.username ? `@${profile.username}` : 'Profile'} onBack={() => navigate(-1)} />

      <div style={{ padding: '16px' }}>
        {loading || !profile ? (
          <>
            <ProfileHeaderSkeleton />
            <div style={{ marginTop: '24px' }}><FeedPostSkeleton count={2} /></div>
          </>
        ) : (
          <>
            <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, borderRadius: '16px', height: '110px', overflow: 'hidden' }}>
              {profile.cover_image && <img src={profile.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginTop: '-32px', paddingLeft: '4px' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '36px', border: `3px solid ${COLORS.bg}`, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxSizing: 'border-box', flexShrink: 0 }}>
                {profile.profile_image ? <img src={profile.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={30} color={COLORS.green} />}
              </div>
              <div style={{ flex: 1, paddingBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{profile.full_name || profile.username || 'FarmLite user'}</p>
                  {profile.is_verified && <Icon name="checkCircle" size={14} color={COLORS.green} />}
                </div>
                <p style={{ fontSize: '12px', color: COLORS.textMuted }}>@{profile.username}{roleLabel ? ` · ${roleLabel}` : ''}</p>
              </div>
            </div>

            {profile.bio && <p style={{ fontSize: '13px', color: COLORS.text, marginTop: '12px', lineHeight: 1.5 }}>{profile.bio}</p>}
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {profile.location && <InfoRow icon="mapPin" text={profile.location} />}
              {profile.farm_type && <InfoRow icon="leaf" text={profile.farm_type} />}
              {profile.website && <InfoRow icon="link" text={profile.website} />}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <Stat label="Posts" value={profile.posts_count || 0} />
              <Stat label="Followers" value={profile.followers_count || 0} />
              <Stat label="Following" value={profile.following_count || 0} />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <div
                onClick={toggleFollow}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                  background: isFollowing ? COLORS.card : COLORS.green,
                  color: isFollowing ? COLORS.text : 'white',
                  border: `1px solid ${isFollowing ? COLORS.border : COLORS.green}`,
                  opacity: followBusy ? 0.6 : 1,
                }}>
                <Icon name={isFollowing ? 'check' : 'plus'} size={14} color={isFollowing ? COLORS.text : 'white'} />
                {isFollowing ? 'Following' : 'Follow'}
              </div>
              <div
                onClick={() => navigate(`/messages?to=${profile.user_id}`)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, fontSize: '12.5px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>
                <Icon name="message" size={14} color={COLORS.text} /> Message
              </div>
            </div>

            {(profile.whatsapp || profile.phone) && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                {profile.whatsapp && (
                  <a href={whatsappLink(profile.whatsapp)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px', background: '#DCFCE7', color: COLORS.greenDark, fontSize: '12.5px', fontWeight: 700, textDecoration: 'none' }}>
                    <Icon name="message" size={14} color={COLORS.greenDark} /> WhatsApp
                  </a>
                )}
                {profile.phone && (
                  <a href={`tel:${cleanPhone(profile.phone)}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px', background: '#DCFCE7', color: COLORS.greenDark, fontSize: '12.5px', fontWeight: 700, textDecoration: 'none' }}>
                    <Icon name="phone" size={14} color={COLORS.greenDark} /> Call
                  </a>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '22px', marginBottom: '14px' }}>
              {(['posts', 'listings'] as const).map((t) => (
                <div
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '8px 16px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                    background: tab === t ? COLORS.green : COLORS.card,
                    color: tab === t ? 'white' : COLORS.textMuted,
                    border: `1px solid ${tab === t ? COLORS.green : COLORS.border}`,
                  }}>
                  {t === 'posts' ? `Posts (${posts.length})` : `Listings (${listings.length})`}
                </div>
              ))}
            </div>

            {tab === 'posts' ? (
              posts.length === 0 ? (
                <EmptyState icon="comment" text="No posts yet." />
              ) : (
                posts.map((post) => (
                  <div key={post.id} style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5 }}>{post.content}</p>
                    <PostImages images={post.images} />
                    <div style={{ display: 'flex', gap: '16px', marginTop: '10px', paddingTop: '8px', borderTop: `1px solid ${COLORS.border}` }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: COLORS.textMuted }}>
                        <Icon name="heart" size={13} color={COLORS.textMuted} /> {post.likes_count}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: COLORS.textMuted }}>
                        <Icon name="comment" size={13} color={COLORS.textMuted} /> {post.comments_count}
                      </span>
                    </div>
                  </div>
                ))
              )
            ) : listings.length === 0 ? (
              <EmptyState icon="cart" text="No listings yet." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {listings.map((l) => (
                  <div key={l.id} onClick={() => navigate(`/marketplace?listing=${l.id}`)} style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: '90px', background: '#E5EFE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {l.images?.[0] ? <img src={l.images[0]} alt={l.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={26} color={COLORS.green} />}
                    </div>
                    <div style={{ padding: '10px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
                      <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.green, marginTop: '4px' }}>{l.currency} {Number(l.price).toLocaleString()}{l.unit ? `/${l.unit}` : ''}</p>
                      {l.location && (
                        <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Icon name="mapPin" size={10} color={COLORS.textMuted} /> {l.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {loading && <GridCardSkeleton count={2} />}
          </>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <p style={{ fontSize: '12px', color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: '6px', wordBreak: 'break-all' }}>
      <Icon name={icon} size={13} color={COLORS.textMuted} /> {text}
    </p>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, background: COLORS.card, borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '2px' }}>{label}</p>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '28px 16px', textAlign: 'center' }}>
      <Icon name={icon} size={26} color={COLORS.textMuted} />
      <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '10px' }}>{text}</p>
    </div>
  )
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{title}</p>
    </div>
  )
}
