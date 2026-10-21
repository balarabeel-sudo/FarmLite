import { Fragment, useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import { formatMoney } from '../moneyUtils'
import Icon from '../Icons'
import FarmLiteLogo from '../FarmLiteLogo'
import { QuickActionsSkeleton, GridCardSkeleton, FeedPostSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import PostCard, { POST_SELECT } from '../PostCard'
import type { PostCardData } from '../PostCard'
import VideoCard from '../VideoCard'
import { VIDEO_SELECT } from '../videoShared'
import type { VideoRow } from '../videoShared'
import SponsoredCard from '../SponsoredCard'
import type { AdData } from '../SponsoredCard'

const COLORS = {
  bg: 'var(--fx-bg)',
  card: 'var(--fx-card)',
  border: 'var(--fx-border)',
  green: '#16A34A',
  greenDark: 'var(--fx-green-dark)',
  orange: '#F59E0B',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
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

type FeedPost = PostCardData

// Feed filter chips. "Update" is where short videos will live; until that feature exists it shows a coming-soon card.
type FeedTab = 'all' | 'products' | 'companies' | 'groups' | 'update' | 'equipment'
const FEED_TABS: { key: FeedTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'companies', label: 'Companies' },
  { key: 'products', label: 'Products' },
  { key: 'groups', label: 'Groups' },
  { key: 'update', label: 'Update' },
  { key: 'equipment', label: 'Equipment' },
]

type TabItem = {
  id: string
  title: string
  price: number | null
  currency: string
  unit: string | null
  location: string | null
  images: string[] | null
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
  const { user } = useAuth()
  const { t } = useLocale()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [listings, setListings] = useState<Listing[]>([])
  const [feed, setFeed] = useState<FeedPost[]>([])
  const [homeAds, setHomeAds] = useState<AdData[]>([])
  const [homeEvery, setHomeEvery] = useState(4)
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set())
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set())

  // Feed chips: each chip loads its own data the first time it is opened
  const [feedTab, setFeedTab] = useState<FeedTab>(() => (searchParams.get('tab') === 'update' ? 'update' : 'all'))
  const [tabPosts, setTabPosts] = useState<{ companies?: FeedPost[]; groups?: FeedPost[] }>({})
  const [tabItems, setTabItems] = useState<{ products?: TabItem[]; equipment?: TabItem[] }>({})
  const [tabLoading, setTabLoading] = useState(false)
  const [tabError, setTabError] = useState(false)
  // Update tab: short videos (loaded the first time the tab opens)
  const [videos, setVideos] = useState<VideoRow[] | null>(null)
  const [likedVideoIds, setLikedVideoIds] = useState<Set<string>>(new Set())
  const [isPremium, setIsPremium] = useState(false)

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    try {
      const [profileRes, notifRes, listingsRes, feedRes, savedPostsRes, likedPostsRes] = await Promise.all([
        supabase.from('profiles').select('full_name, username, profile_image').eq('user_id', user.id).maybeSingle(),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
        supabase.from('marketplace_listings').select('id, title, price, currency, unit, location, images').eq('status', 'available').order('created_at', { ascending: false }).limit(6),
        supabase.from('posts').select(POST_SELECT).eq('visibility', 'public').order('created_at', { ascending: false }).limit(10),
        supabase.from('saved_items').select('post_id').eq('user_id', user.id).not('post_id', 'is', null),
        supabase.from('post_likes').select('post_id').eq('user_id', user.id),
      ])

      if (profileRes.error || listingsRes.error || feedRes.error) {
        setNetError(true)
        setLoading(false)
        return
      }

      setProfile(profileRes.data as any)
      setUnreadNotifications(notifRes.count || 0)
      setListings((listingsRes.data || []) as any)
      setFeed((feedRes.data || []) as any)
      setSavedPostIds(new Set((savedPostsRes.data || []).map((r: any) => r.post_id)))
      setLikedPostIds(new Set((likedPostsRes.data || []).map((r: any) => r.post_id)))
    } catch {
      setNetError(true)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [user])
  useEffect(() => { if (user && feedTab === 'update') loadTab('update') }, [user])

  const tabLoaded = (tab: FeedTab) =>
    tab === 'companies' ? !!tabPosts.companies
    : tab === 'groups' ? !!tabPosts.groups
    : tab === 'products' ? !!tabItems.products
    : tab === 'equipment' ? !!tabItems.equipment
    : tab === 'update' ? videos !== null
    : true

  const loadTab = async (tab: FeedTab) => {
    if (tabLoaded(tab)) return
    setTabLoading(true)
    setTabError(false)
    try {
      if (tab === 'update') {
        const [vRes, likesRes, meRes] = await Promise.all([
          supabase.from('short_videos').select(VIDEO_SELECT).eq('status', 'active').eq('is_hidden_by_admin', false).order('created_at', { ascending: false }).limit(10),
          user ? supabase.from('video_likes').select('video_id').eq('user_id', user.id) : Promise.resolve({ data: [], error: null } as any),
          user ? supabase.from('profiles').select('is_premium, premium_until').eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
        ])
        if (vRes.error) throw vRes.error
        setVideos((vRes.data || []) as any)
        setLikedVideoIds(new Set(((likesRes as any).data || []).map((r: any) => r.video_id)))
        const me: any = (meRes as any).data
        setIsPremium(!!me && !!me.is_premium && (!me.premium_until || new Date(me.premium_until).getTime() > Date.now()))
      } else if (tab === 'companies' || tab === 'groups') {
        let q = supabase.from('posts').select(POST_SELECT).eq('visibility', 'public')
        q = tab === 'companies' ? q.not('company_id', 'is', null) : q.not('community_id', 'is', null)
        const { data, error } = await q.order('created_at', { ascending: false }).limit(10)
        if (error) throw error
        setTabPosts((prev) => ({ ...prev, [tab]: (data || []) as any }))
      } else if (tab === 'products' || tab === 'equipment') {
        const isProducts = tab === 'products'
        const { data, error } = await supabase
          .from(isProducts ? 'marketplace_listings' : 'equipment')
          .select(`id, ${isProducts ? 'title' : 'name'}, price, currency, unit, location, images`)
          .eq('status', 'available')
          .not('is_hidden_by_admin', 'is', true)
          .order('created_at', { ascending: false })
          .limit(12)
        if (error) throw error
        const items: TabItem[] = ((data || []) as any[]).map((r) => ({
          id: r.id, title: isProducts ? r.title : r.name, price: r.price, currency: r.currency,
          unit: r.unit, location: r.location, images: r.images,
        }))
        setTabItems((prev) => ({ ...prev, [tab]: items }))
      }
    } catch {
      setTabError(true)
    }
    setTabLoading(false)
  }

  const selectTab = (tab: FeedTab) => {
    setFeedTab(tab)
    loadTab(tab)
  }

  // Paid ads (labelled "Sponsored") appear in the feed after every N posts; N is set by Farmxie in admin limits.
  useEffect(() => {
    if (!user) return
    supabase.rpc('ads_config').then(
      ({ data }: { data: any }) => { const n = Number(data?.home_every); if (n >= 2) setHomeEvery(n) },
      () => {},
    )
    supabase.rpc('ads_for_slot', { p_slot: 'home', p_limit: 4 }).then(
      ({ data }: { data: any }) => setHomeAds((data || []) as AdData[]),
      () => setHomeAds([]),
    )
  }, [user])

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header unreadNotifications={0} profileImage={null} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>
      <Header unreadNotifications={unreadNotifications} profileImage={profile?.profile_image || null} />

      <div style={{ padding: '14px 16px 16px' }}>
        <SectionTitle title={t('quickActions')} />
        {loading ? (
          <QuickActionsSkeleton />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
            {QUICK_ACTIONS.map((a) => (
              <div
                key={a.labelKey}
                onClick={() => navigate(a.path)}
                style={{ background: COLORS.card, borderRadius: '14px', padding: '14px 8px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--fx-tint-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  <Icon name={a.icon} size={20} color={COLORS.green} />
                </div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.text, marginTop: '8px', whiteSpace: 'nowrap' }}>{t(a.labelKey)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Farm Desk entry point */}
        {!loading && (
          <div
            onClick={() => navigate('/farm-desk')}
            style={{ background: COLORS.card, borderRadius: '14px', padding: '14px 16px', marginBottom: '22px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--fx-tint-green)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="leaf" size={19} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>Farm Desk</p>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>Tell Farmxie what you need. We'll help you find it.</p>
            </div>
            <Icon name="chevronRight" size={18} color={COLORS.textMuted} />
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
                <div style={{ width: '100%', height: '90px', background: 'var(--fx-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {l.images?.[0] ? <img src={l.images[0]} alt={l.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={26} color={COLORS.green} />}
                </div>
                <div style={{ padding: '10px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
                  <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.green, marginTop: '4px' }}>{formatMoney(Number(l.price), l.currency)}{l.unit ? `/${l.unit}` : ''}</p>
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

        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginTop: '10px', paddingBottom: '4px' }}>
          {FEED_TABS.map((c) => {
            const active = feedTab === c.key
            return (
              <div
                key={c.key}
                onClick={() => selectTab(c.key)}
                style={{
                  flex: '1 1 auto', minWidth: 0, textAlign: 'center', whiteSpace: 'nowrap', padding: '8px 4px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer',
                  background: active ? COLORS.greenDark : '#EAEFEA', color: active ? 'white' : COLORS.textMuted,
                }}>
                {c.label}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '12px' }}>
          {feedTab === 'update' ? (
            <>
              <div
                onClick={() => navigate('/videos/new')}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, borderRadius: '14px', padding: '12px 14px', marginBottom: '10px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--fx-tint-green)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PlayIcon size={20} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>Post a short video</p>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>Share a short video with the Farmxie community.</p>
                </div>
                <Icon name="chevronRight" size={18} color={COLORS.textMuted} />
              </div>

              {tabError ? (
                <NetworkError onRetry={() => loadTab('update')} />
              ) : tabLoading || videos === null ? (
                <FeedPostSkeleton count={2} />
              ) : videos.length === 0 ? (
                <EmptyState icon="camera" text="No videos yet. Be the first to post one!" />
              ) : (
                videos.map((v) => (
                  <VideoCard
                    key={v.id}
                    video={v}
                    initialLiked={likedVideoIds.has(v.id)}
                    onDeleted={(id) => setVideos((prev) => (prev || []).filter((x) => x.id !== id))}
                  />
                ))
              )}
            </>
          ) : feedTab === 'all' ? (
            loading ? (
              <FeedPostSkeleton count={3} />
            ) : feed.length === 0 ? (
              <EmptyState icon="message" text="No posts yet. Be the first to share something!" />
            ) : (
              <>
                {feed.map((post, i) => (
                  <Fragment key={post.id}>
                    {i > 0 && i % homeEvery === 0 && homeAds[i / homeEvery - 1] && (
                      <SponsoredCard ad={homeAds[i / homeEvery - 1]} layout="wide" placement="home" />
                    )}
                    <PostCard
                      post={post}
                      initialLiked={likedPostIds.has(post.id)}
                      initialSaved={savedPostIds.has(post.id)}
                    />
                  </Fragment>
                ))}
                {/* With only a few posts the first ad still shows, at the end of the feed. */}
                {feed.length <= homeEvery && homeAds[0] && (
                  <SponsoredCard ad={homeAds[0]} layout="wide" placement="home" />
                )}
              </>
            )
          ) : tabError ? (
            <NetworkError onRetry={() => loadTab(feedTab)} />
          ) : tabLoading || !tabLoaded(feedTab) ? (
            <FeedPostSkeleton count={2} />
          ) : feedTab === 'companies' || feedTab === 'groups' ? (
            (tabPosts[feedTab] || []).length === 0 ? (
              <EmptyState icon="message" text={feedTab === 'companies' ? 'No company posts yet.' : 'No group posts yet.'} />
            ) : (
              (tabPosts[feedTab] || []).map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  initialLiked={likedPostIds.has(post.id)}
                  initialSaved={savedPostIds.has(post.id)}
                />
              ))
            )
          ) : (
            (tabItems[feedTab] || []).length === 0 ? (
              <EmptyState icon={feedTab === 'products' ? 'cart' : 'tractor'} text={feedTab === 'products' ? 'No products yet.' : 'No equipment yet.'} />
            ) : (
              <>
                {(tabItems[feedTab] || []).map((it) => (
                  <div
                    key={it.id}
                    onClick={() => navigate(feedTab === 'products' ? `/marketplace?listing=${it.id}` : `/equipment/${it.id}`)}
                    style={{ display: 'flex', gap: '12px', background: COLORS.card, borderRadius: '14px', padding: '10px', marginBottom: '10px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '10px', background: 'var(--fx-border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {it.images?.[0] ? <img src={it.images[0]} alt={it.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={feedTab === 'products' ? 'leaf' : 'tractor'} size={26} color={COLORS.green} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</p>
                      {it.price != null && (
                        <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.green, marginTop: '4px' }}>{formatMoney(Number(it.price), it.currency)}{it.unit ? `/${it.unit}` : ''}</p>
                      )}
                      {it.location && (
                        <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Icon name="mapPin" size={10} color={COLORS.textMuted} /> {it.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <Link to={feedTab === 'products' ? '/marketplace' : '/equipment'} style={{ display: 'block', textAlign: 'center', fontSize: '12.5px', fontWeight: 700, color: COLORS.green, textDecoration: 'none', padding: '6px 0 2px' }}>
                  {feedTab === 'products' ? 'See all products' : 'See all equipment'}
                </Link>
              </>
            )
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

function Header({ unreadNotifications, profileImage }: { unreadNotifications: number; profileImage: string | null }) {
  const navigate = useNavigate()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FarmLiteLogo size={32} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <IconBadge icon="search" onClick={() => navigate('/search')} />
        <IconBadge icon="bell" count={unreadNotifications} onClick={() => navigate('/notifications')} />
        <div onClick={() => navigate('/profile')} style={{ width: '26px', height: '26px', borderRadius: '13px', background: 'var(--fx-tint-green)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          {profileImage ? <img src={profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={14} color={COLORS.green} />}
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

function PlayIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10.5 9.5v5l4-2.5-4-2.5Z" fill={color} />
    </svg>
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

function BottomNav() {
  const navigate = useNavigate()
  const items = [
    { icon: 'home', label: 'Home', path: '/', primary: false },
    { icon: 'cart', label: 'Market', path: '/marketplace', primary: false },
    { icon: 'plus', label: '', path: '/create', primary: true },
    { icon: 'message', label: 'Messages', path: '/messages', primary: false },
    { icon: 'user', label: 'Account', path: '/profile', primary: false },
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
