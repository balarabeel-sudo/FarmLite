import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import Icon from '../Icons'
import LanguageCurrencyBar from '../LanguageCurrencyBar'
import { QuickActionsSkeleton, GridCardSkeleton, FeedPostSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  orange: '#F59E0B',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

type Profile = {
  full_name: string | null
  username: string | null
  profile_image: string | null
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

type FeedPost = {
  id: string
  content: string
  images: string[] | null
  likes_count: number
  comments_count: number
  created_at: string
  profiles: { full_name: string | null; username: string | null; profile_image: string | null } | null
}

const QUICK_ACTIONS: { icon: string; labelKey: 'marketplace' | 'companies' | 'farmbot' | 'groups' | 'equipment' | 'saved'; path: string }[] = [
  { icon: 'cart', labelKey: 'marketplace', path: '/marketplace' },
  { icon: 'building', labelKey: 'companies', path: '/companies' },
  { icon: 'robot', labelKey: 'farmbot', path: '/farmbot' },
  { icon: 'users', labelKey: 'groups', path: '/communities' },
  { icon: 'tractor', labelKey: 'equipment', path: '/equipment' },
  { icon: 'bookmark', labelKey: 'saved', path: '/saved' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { t, formatPrice } = useLocale()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [listings, setListings] = useState<Listing[]>([])
  const [feed, setFeed] = useState<FeedPost[]>([])

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    try {
      const [profileRes, notifRes, msgRes, listingsRes, feedRes] = await Promise.all([
        supabase.from('profiles').select('full_name, username, profile_image').eq('user_id', user.id).maybeSingle(),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('is_read', false),
        supabase.from('marketplace_listings').select('id, title, price, currency, unit, location, images').eq('status', 'available').order('created_at', { ascending: false }).limit(6),
        supabase.from('posts').select('id, content, images, likes_count, comments_count, created_at, profiles!posts_user_id_fkey(full_name, username, profile_image)').eq('visibility', 'public').order('created_at', { ascending: false }).limit(10),
      ])

      if (profileRes.error || listingsRes.error || feedRes.error) {
        setNetError(true)
        setLoading(false)
        return
      }

      setProfile(profileRes.data as any)
      setUnreadNotifications(notifRes.count || 0)
      setUnreadMessages(msgRes.count || 0)
      setListings((listingsRes.data || []) as any)
      setFeed((feedRes.data || []) as any)
    } catch {
      setNetError(true)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const firstName = (profile?.full_name || 'Farmer').split(' ')[0]

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header unreadNotifications={0} unreadMessages={0} profileImage={null} onSignOut={signOut} />
        <LanguageCurrencyBar />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>
      <Header unreadNotifications={unreadNotifications} unreadMessages={unreadMessages} profileImage={profile?.profile_image || null} onSignOut={signOut} />
      <LanguageCurrencyBar />

      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, borderRadius: '18px',
          padding: '22px', marginBottom: '20px', color: 'white',
        }}>
          <p style={{ fontSize: '13px', color: '#DCFCE7' }}>{t('welcomeBack')}</p>
          <p style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>{firstName}</p>
          <p style={{ fontSize: '12.5px', color: '#DCFCE7', marginTop: '6px' }}>{t('welcomeSubtitle')}</p>
        </div>

        <SectionTitle title={t('quickActions')} />
        {loading ? (
          <QuickActionsSkeleton />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '22px' }}>
            {QUICK_ACTIONS.map((a) => (
              <div
                key={a.labelKey}
                onClick={() => navigate(a.path)}
                style={{ background: COLORS.card, borderRadius: '14px', padding: '14px 6px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  <Icon name={a.icon} size={19} color={COLORS.green} />
                </div>
                <p style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.text, marginTop: '8px' }}>{t(a.labelKey)}</p>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <SectionTitle title={t('featuredToday')} />
          <Link to="/marketplace" style={{ fontSize: '12px', fontWeight: 700, color: COLORS.green, textDecoration: 'none' }}>{t('viewAll')}</Link>
        </div>

        {loading ? (
          <div style={{ marginBottom: '22px' }}><GridCardSkeleton count={4} /></div>
        ) : listings.length === 0 ? (
          <EmptyState icon="cart" text="No listings yet." />
        ) : (
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '22px', paddingBottom: '4px' }}>
            {listings.map((l) => (
              <div key={l.id} onClick={() => navigate(`/marketplace?listing=${l.id}`)} style={{ minWidth: '140px', background: COLORS.card, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
                <div style={{ width: '100%', height: '90px', background: '#E5EFE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {l.images?.[0] ? <img src={l.images[0]} alt={l.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={26} color={COLORS.green} />}
                </div>
                <div style={{ padding: '10px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
                  <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.green, marginTop: '4px' }}>{formatPrice(Number(l.price))}{l.unit ? `/${l.unit}` : ''}</p>
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

        <SectionTitle title={t('feed')} />
        <div style={{ marginTop: '10px' }}>
          {loading ? (
            <FeedPostSkeleton count={3} />
          ) : feed.length === 0 ? (
            <EmptyState icon="message" text="No posts yet. Be the first to share something!" />
          ) : (
            feed.map((post) => <FeedCard key={post.id} post={post} />)
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

function Header({ unreadNotifications, unreadMessages, profileImage, onSignOut }: { unreadNotifications: number; unreadMessages: number; profileImage: string | null; onSignOut: () => void }) {
  const navigate = useNavigate()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon name="leaf" size={22} color={COLORS.green} />
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.green }}>FarmLite</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <IconBadge icon="search" onClick={() => navigate('/search')} />
        <IconBadge icon="bell" count={unreadNotifications} onClick={() => navigate('/notifications')} />
        <IconBadge icon="message" count={unreadMessages} onClick={() => navigate('/messages')} />
        <div onClick={() => navigate('/profile')} style={{ width: '26px', height: '26px', borderRadius: '13px', background: '#DCFCE7', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          {profileImage ? <img src={profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={14} color={COLORS.green} />}
        </div>
        <div onClick={onSignOut} style={{ cursor: 'pointer' }} title="Sign out">
          <Icon name="logout" size={18} color={COLORS.textMuted} />
        </div>
      </div>
    </div>
  )
}

function IconBadge({ icon, count, onClick }: { icon: string; count?: number; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ position: 'relative', cursor: 'pointer' }}>
      <Icon name={icon} size={20} color={COLORS.text} />
      {!!count && (
        <div style={{
          position: 'absolute', top: '-6px', right: '-8px', background: COLORS.orange, color: 'white',
          fontSize: '9px', fontWeight: 800, borderRadius: '999px', minWidth: '15px', height: '15px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
        }}>
          {count > 9 ? '9+' : count}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{title}</p>
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '28px 16px', textAlign: 'center', marginBottom: '18px' }}>
      <Icon name={icon} size={26} color={COLORS.textMuted} />
      <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '10px' }}>{text}</p>
    </div>
  )
}

function FeedCard({ post }: { post: FeedPost }) {
  const author = post.profiles
  return (
    <div style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '18px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {author?.profile_image ? <img src={author.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={16} color={COLORS.green} />}
        </div>
        <div>
          <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{author?.full_name || author?.username || 'FarmLite user'}</p>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{timeAgo(post.created_at)}</p>
        </div>
      </div>

      <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5, marginBottom: '10px' }}>{post.content}</p>

      {post.images?.[0] && (
        <img src={post.images[0]} alt="" loading="lazy" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '12px', marginBottom: '10px' }} />
      )}

      <div style={{ display: 'flex', gap: '18px', paddingTop: '8px', borderTop: `1px solid ${COLORS.border}` }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: COLORS.textMuted }}>
          <Icon name="heart" size={15} color={COLORS.textMuted} /> {post.likes_count}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: COLORS.textMuted }}>
          <Icon name="comment" size={15} color={COLORS.textMuted} /> {post.comments_count}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: COLORS.textMuted, marginLeft: 'auto' }}>
          <Icon name="share" size={15} color={COLORS.textMuted} />
        </span>
      </div>
    </div>
  )
}

function BottomNav() {
  const navigate = useNavigate()
  const items = [
    { icon: 'home', label: 'Home', path: '/', primary: false },
    { icon: 'cart', label: 'Market', path: '/marketplace', primary: false },
    { icon: 'plus', label: '', path: '/create', primary: true },
    { icon: 'message', label: 'Messages', path: '/messages', primary: false },
    { icon: 'user', label: 'Profile', path: '/profile', primary: false },
  ]
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px',
      background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-around',
      alignItems: 'center', padding: '10px 0', boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
    }}>
      {items.map((it) =>
        it.primary ? (
          <div key={it.path} onClick={() => navigate(it.path)} style={{
            width: '46px', height: '46px', borderRadius: '23px', background: COLORS.green,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: '-24px',
            boxShadow: '0 4px 10px rgba(22,163,74,0.4)',
          }}>
            <Icon name="plus" size={22} color="white" />
          </div>
        ) : (
          <div key={it.path} onClick={() => navigate(it.path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
            <Icon name={it.icon} size={20} color={COLORS.textMuted} />
            <p style={{ fontSize: '9.5px', color: COLORS.textMuted, fontWeight: 600 }}>{it.label}</p>
          </div>
        )
      )}
    </div>
  )
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
