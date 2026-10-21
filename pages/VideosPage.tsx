import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import PremiumTick from '../PremiumTick'
import ReportSheet from '../ReportSheet'
import VideoCommentsSheet from '../VideoCommentsSheet'
import { isPremiumActive } from '../premiumShared'
import { followTarget, useFollowing } from '../followShared'
import { VIDEO_SELECT, deleteShortVideo, videoLink } from '../videoShared'
import type { VideoRow } from '../videoShared'

const G = { green: '#16A34A', text: 'var(--fx-text)', muted: 'var(--fx-muted)', border: 'var(--fx-border)', red: '#DC2626' }
const PAGE = 8
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A view is counted once per video per visit to the app.
const countedViews = new Set<string>()

const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n))

// Route: /videos and /videos/:id - full-screen vertical viewer. Swipe up for the next video.
export default function VideosPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()

  const [videos, setVideos] = useState<VideoRow[]>([])
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notice, setNotice] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 700)
  const [commentsFor, setCommentsFor] = useState<VideoRow | null>(null)
  const [reportFor, setReportFor] = useState<VideoRow | null>(null)
  const [menuFor, setMenuFor] = useState<VideoRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toast, setToast] = useState('')

  const scroller = useRef<HTMLDivElement>(null)
  const cursor = useRef<string | null>(null)
  const loadingMore = useRef(false)

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const flash = (text: string) => {
    setToast(text)
    setTimeout(() => setToast(''), 1600)
  }

  const loadLikes = useCallback(async (rows: VideoRow[]) => {
    if (!user || rows.length === 0) return
    const { data } = await supabase.from('video_likes').select('video_id').eq('user_id', user.id).in('video_id', rows.map((r) => r.id))
    const ids = ((data || []) as { video_id: string }[]).map((r) => r.video_id)
    if (ids.length) setLiked((prev) => new Set([...prev, ...ids]))
  }, [user])

  // First load: the video from the link (if any) first, then the newest videos.
  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(false)
      let first: VideoRow | null = null
      if (id && UUID.test(id)) {
        const { data } = await supabase.from('short_videos').select(VIDEO_SELECT).eq('id', id).eq('status', 'active').maybeSingle()
        first = (data as unknown as VideoRow) || null
        if (!first) setNotice('That video is not available.')
      } else if (id) {
        setNotice('That video is not available.')
      }
      let q = supabase.from('short_videos').select(VIDEO_SELECT).eq('status', 'active').eq('is_hidden_by_admin', false)
      if (first) q = q.neq('id', first.id)
      const { data: rest, error: e } = await q.order('created_at', { ascending: false }).limit(PAGE)
      if (!alive) return
      if (e && !first) { setError(true); setLoading(false); return }
      const rows = (rest || []) as unknown as VideoRow[]
      cursor.current = rows.length ? rows[rows.length - 1].created_at : null
      setHasMore(rows.length === PAGE)
      const all = first ? [first, ...rows] : rows
      setVideos(all)
      setLoading(false)
      loadLikes(all)
    })()
    return () => { alive = false }
  }, [user, id, loadLikes])

  const loadMore = useCallback(async () => {
    if (loadingMore.current || !hasMore || !cursor.current) return
    loadingMore.current = true
    const { data } = await supabase.from('short_videos').select(VIDEO_SELECT).eq('status', 'active').eq('is_hidden_by_admin', false)
      .lt('created_at', cursor.current).order('created_at', { ascending: false }).limit(PAGE)
    const rows = (data || []) as unknown as VideoRow[]
    cursor.current = rows.length ? rows[rows.length - 1].created_at : cursor.current
    setHasMore(rows.length === PAGE)
    setVideos((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))])
    loadLikes(rows)
    loadingMore.current = false
  }, [hasMore, loadLikes])

  useEffect(() => {
    if (videos.length > 0 && active >= videos.length - 3) loadMore()
  }, [active, videos.length, loadMore])

  // Which video is on screen
  useEffect(() => {
    const root = scroller.current
    if (!root || videos.length === 0) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && en.intersectionRatio >= 0.7) setActive(Number((en.target as HTMLElement).dataset.index || 0))
        })
      },
      { root, threshold: [0.7] },
    )
    root.querySelectorAll('[data-index]').forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [videos.length, vh])

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/?tab=update')
  }

  const toggleLike = async (v: VideoRow) => {
    if (!user) return
    const was = liked.has(v.id)
    setLiked((prev) => { const n = new Set(prev); if (was) n.delete(v.id); else n.add(v.id); return n })
    setVideos((prev) => prev.map((x) => (x.id === v.id ? { ...x, likes_count: Math.max(0, x.likes_count + (was ? -1 : 1)) } : x)))
    if (was) await supabase.from('video_likes').delete().eq('user_id', user.id).eq('video_id', v.id)
    else await supabase.from('video_likes').insert({ user_id: user.id, video_id: v.id })
  }

  const share = async (v: VideoRow) => {
    const url = videoLink(v.id)
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: 'Farmxie', text: v.caption || 'Watch this video on Farmxie', url }) } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(url); flash('Link copied') } catch { flash('Could not copy the link') }
    }
  }

  const copyLink = async (v: VideoRow) => {
    try { await navigator.clipboard.writeText(videoLink(v.id)); flash('Link copied') } catch { flash('Could not copy the link') }
    setMenuFor(null)
  }

  const removeVideo = async (v: VideoRow) => {
    const ok = await deleteShortVideo(v)
    setConfirmDelete(false)
    setMenuFor(null)
    if (!ok) { flash('Could not delete the video'); return }
    setVideos((prev) => prev.filter((x) => x.id !== v.id))
    flash('Video deleted')
  }

  const header = (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0))', pointerEvents: 'auto' }}>
        <div role="button" aria-label="Back" onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Icon name="arrowLeft" size={22} color="white" />
          <span style={{ color: 'white', fontSize: '16px', fontWeight: 800 }}>Videos</span>
        </div>
        <div role="button" aria-label={muted ? 'Turn sound on' : 'Turn sound off'} onClick={() => setMuted((m) => !m)} style={{ width: '36px', height: '36px', borderRadius: '18px', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H2v6h4l5 4V5Z" />
            {muted ? <path d="m23 9-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
          </svg>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 40 }}>
      {header}

      {loading ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>Loading videos...</p>
        </div>
      ) : error ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '0 24px', textAlign: 'center' }}>
          <p style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>Unable to load videos.</p>
          <div role="button" onClick={() => window.location.reload()} style={{ background: G.green, color: 'white', borderRadius: '12px', padding: '10px 22px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>Try Again</div>
        </div>
      ) : videos.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '0 24px', textAlign: 'center' }}>
          <p style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>{notice || 'No videos yet.'}</p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12.5px' }}>Be the first to post a short video.</p>
          <div role="button" onClick={() => navigate('/videos/new')} style={{ background: G.green, color: 'white', borderRadius: '12px', padding: '10px 22px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>Post a video</div>
        </div>
      ) : (
        <div ref={scroller} style={{ height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}>
          {videos.map((v, i) => (
            <Slide
              key={v.id}
              index={i}
              height={vh}
              video={v}
              active={i === active}
              near={Math.abs(i - active) <= 1}
              muted={muted}
              liked={liked.has(v.id)}
              isOwn={v.user_id === user?.id}
              userId={user?.id}
              onLike={() => toggleLike(v)}
              onComment={() => setCommentsFor(v)}
              onShare={() => share(v)}
              onMenu={() => { setConfirmDelete(false); setMenuFor(v) }}
              onProfile={() => v.profiles?.username && navigate(`/u/${v.profiles.username}`)}
            />
          ))}
        </div>
      )}

      {notice && videos.length > 0 && (
        <div style={{ position: 'fixed', top: '60px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 31, pointerEvents: 'none' }}>
          <span style={{ background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '12px', fontWeight: 700, borderRadius: '10px', padding: '6px 12px' }}>{notice}</span>
        </div>
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: '70px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 95, pointerEvents: 'none' }}>
          <span style={{ background: 'rgba(0,0,0,0.8)', color: 'white', fontSize: '12.5px', fontWeight: 700, borderRadius: '10px', padding: '8px 14px' }}>{toast}</span>
        </div>
      )}

      {commentsFor && (
        <VideoCommentsSheet
          videoId={commentsFor.id}
          videoOwnerId={commentsFor.user_id}
          open
          onClose={() => setCommentsFor(null)}
          onCountChange={(d) => {
            const vid = commentsFor.id
            setVideos((prev) => prev.map((x) => (x.id === vid ? { ...x, comments_count: Math.max(0, x.comments_count + d) } : x)))
          }}
        />
      )}

      {menuFor && (
        <div onClick={() => { setMenuFor(null); setConfirmDelete(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--fx-card)', width: '100%', maxWidth: '480px', borderRadius: '20px 20px 0 0', padding: '8px 16px calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
            <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: G.border, margin: '4px auto 10px' }} />
            <div role="button" onClick={() => copyLink(menuFor)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 4px', cursor: 'pointer' }}>
              <Icon name="link" size={18} color={G.text} />
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: G.text }}>Copy link</span>
            </div>
            {menuFor.user_id === user?.id ? (
              confirmDelete ? (
                <div style={{ padding: '10px 4px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: G.text, marginBottom: '10px' }}>Delete this video?</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div role="button" onClick={() => setConfirmDelete(false)} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', border: `1px solid ${G.border}`, fontSize: '13px', fontWeight: 700, color: G.muted, cursor: 'pointer' }}>Cancel</div>
                    <div role="button" onClick={() => removeVideo(menuFor)} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: '#DC2626', fontSize: '13px', fontWeight: 700, color: 'white', cursor: 'pointer' }}>Delete</div>
                  </div>
                </div>
              ) : (
                <div role="button" onClick={() => setConfirmDelete(true)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 4px', cursor: 'pointer' }}>
                  <Icon name="trash" size={18} color={G.red} />
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: G.red }}>Delete video</span>
                </div>
              )
            ) : (
              <div role="button" onClick={() => { setReportFor(menuFor); setMenuFor(null) }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 4px', cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: G.red }}>Report video</span>
              </div>
            )}
          </div>
        </div>
      )}

      {reportFor && (
        <ReportSheet
          open
          onClose={() => setReportFor(null)}
          type="other"
          userId={reportFor.user_id}
          titleLabel="video"
          context={`Short video: ${videoLink(reportFor.id)}`}
          targetLabel={`Video by ${reportFor.profiles?.full_name || reportFor.profiles?.username || 'a user'}`}
        />
      )}
    </div>
  )
}

function Slide({ index, height, video, active, near, muted, liked, isOwn, userId, onLike, onComment, onShare, onMenu, onProfile }: {
  index: number
  height: number
  video: VideoRow
  active: boolean
  near: boolean
  muted: boolean
  liked: boolean
  isOwn: boolean
  userId: string | undefined
  onLike: () => void
  onComment: () => void
  onShare: () => void
  onMenu: () => void
  onProfile: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [busyFollow, setBusyFollow] = useState(false)

  const author = video.profiles
  const name = author?.full_name || author?.username || 'Farmxie user'
  const premium = !!author && isPremiumActive(author.is_premium, author.premium_until)
  const following = useFollowing(isOwn ? undefined : userId, 'user', video.user_id)

  // Play the video on screen, pause the others
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (active) {
      el.currentTime = 0
      setPaused(false)
      const p = el.play()
      if (p && typeof p.catch === 'function') p.catch(() => setPaused(true))
      if (!isOwn && !countedViews.has(video.id)) {
        countedViews.add(video.id)
        supabase.rpc('video_add_view', { p_video: video.id }).then(() => undefined, () => undefined)
      }
    } else {
      el.pause()
    }
  }, [active, video.id, isOwn])

  const toggle = () => {
    const el = ref.current
    if (!el) return
    if (el.paused) { el.play().then(() => setPaused(false), () => setPaused(true)) } else { el.pause(); setPaused(true) }
  }

  const follow = async () => {
    if (!userId || busyFollow) return
    setBusyFollow(true)
    await followTarget(userId, 'user', video.user_id)
    setBusyFollow(false)
  }

  const action = (label: string, icon: ReactNode, onClick: () => void, count?: number) => (
    <div role="button" aria-label={label} onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '22px', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      {count !== undefined && <span style={{ color: 'white', fontSize: '11.5px', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{compact(count)}</span>}
    </div>
  )

  return (
    <div data-index={index} style={{ position: 'relative', height: `${height}px`, scrollSnapAlign: 'start', scrollSnapStop: 'always', background: '#000', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '480px', height: '100%' }}>
        {failed ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', padding: '0 24px', textAlign: 'center' }}>This video cannot be played on your device.</div>
        ) : (
          <>
            {video.thumbnail_url && !near && <img src={video.thumbnail_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
            {near && (
              <video
                ref={ref}
                src={video.video_url}
                poster={video.thumbnail_url || undefined}
                muted={muted}
                playsInline
                preload={active ? 'auto' : 'metadata'}
                onClick={toggle}
                onTimeUpdate={(e) => {
                  const el = e.currentTarget
                  const limit = video.duration_seconds > 0 ? video.duration_seconds : el.duration
                  if (limit > 0) setProgress(Math.min(1, el.currentTime / limit))
                  // The video is cut at its saved length, then plays again
                  if (video.duration_seconds > 0 && el.currentTime >= video.duration_seconds + 0.3) { el.currentTime = 0; el.play().catch(() => undefined) }
                }}
                onEnded={(e) => { e.currentTarget.currentTime = 0; e.currentTarget.play().catch(() => undefined) }}
                onError={() => setFailed(true)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
              />
            )}
            {paused && active && (
              <div onClick={toggle} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '32px', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M8 5v14l11-7-11-7Z" /></svg>
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%', background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.7))', pointerEvents: 'none' }} />

        <div style={{ position: 'absolute', right: '10px', bottom: '84px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          {action(liked ? 'Unlike' : 'Like', <Icon name="heart" size={24} color={liked ? '#F87171' : 'white'} />, onLike, video.likes_count)}
          {action('Comments', <Icon name="comment" size={23} color="white" />, onComment, video.comments_count)}
          {action('Share', <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 9V5l8 7-8 7v-4c-5.5 0-9 1.5-12 5 1-6 4.5-10.5 12-11z" /></svg>, onShare)}
          {action('More options', <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true"><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></svg>, onMenu)}
        </div>

        <div style={{ position: 'absolute', left: '14px', right: '72px', bottom: '22px', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div onClick={onProfile} style={{ width: '38px', height: '38px', borderRadius: '19px', background: 'var(--fx-tint-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '2px solid white', cursor: 'pointer' }}>
              {author?.profile_image
                ? <img src={author.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Icon name="user" size={16} color={G.green} />}
            </div>
            <div onClick={onProfile} style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, cursor: 'pointer' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{name}</span>
              {premium && <PremiumTick size={15} />}
            </div>
            {!isOwn && following === false && (
              <div role="button" onClick={follow} style={{ border: '1.5px solid white', borderRadius: '8px', padding: '3px 11px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', opacity: busyFollow ? 0.6 : 1, flexShrink: 0 }}>Follow</div>
            )}
          </div>
          {video.caption && (
            <p onClick={() => setExpanded((x) => !x)} style={{ fontSize: '13px', lineHeight: 1.45, marginTop: '8px', textShadow: '0 1px 3px rgba(0,0,0,0.6)', cursor: 'pointer', ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
              {video.caption}
            </p>
          )}
        </div>

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '3px', background: 'rgba(255,255,255,0.25)' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--fx-card)' }} />
        </div>
      </div>
    </div>
  )
}
