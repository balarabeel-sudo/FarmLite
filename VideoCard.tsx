import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Icon from './Icons'
import ReportSheet from './ReportSheet'
import PremiumTick from './PremiumTick'
import { isPremiumActive } from './premiumShared'
import { timeAgo } from './PostCard'
import { deleteShortVideo, formatDuration } from './videoShared'
import type { VideoRow } from './videoShared'

const COLORS = {
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

// A view is counted once per video per visit to the app.
const countedViews = new Set<string>()
// Only one video plays at a time.
let playing: HTMLVideoElement | null = null

// One short-video card used by the Update tab on Home.
// It owns its like / view state; the parent only passes the initial values.
export default function VideoCard({
  video, initialLiked, onDeleted,
}: {
  video: VideoRow
  initialLiked: boolean
  onDeleted: (id: string) => void
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)

  const [liked, setLiked] = useState(initialLiked)
  const [likes, setLikes] = useState(video.likes_count)
  const [views, setViews] = useState(video.views_count)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  const isOwn = video.user_id === user?.id
  const author = video.profiles
  const name = author?.full_name || author?.username || 'Farmxie user'
  const premium = !!author && isPremiumActive(author.is_premium, author.premium_until)
  const target = author?.username ? `/u/${author.username}` : null

  const handlePlay = () => {
    const el = videoRef.current
    if (el) {
      if (playing && playing !== el) playing.pause()
      playing = el
    }
    if (!isOwn && !countedViews.has(video.id)) {
      countedViews.add(video.id)
      setViews((n) => n + 1)
      supabase.rpc('video_add_view', { p_video: video.id }).then(() => undefined, () => undefined)
    }
  }

  const toggleLike = async () => {
    if (!user) return
    const was = liked
    setLiked(!was)
    setLikes((n) => Math.max(0, n + (was ? -1 : 1)))
    if (was) await supabase.from('video_likes').delete().eq('user_id', user.id).eq('video_id', video.id)
    else await supabase.from('video_likes').insert({ user_id: user.id, video_id: video.id })
  }

  const share = async () => {
    const shareData = { title: 'Farmxie', text: video.caption || 'Watch this video on Farmxie', url: video.video_url }
    if ((navigator as any).share) {
      try { await (navigator as any).share(shareData) } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(video.video_url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } catch { /* clipboard not available */ }
    }
  }

  const remove = async () => {
    setDeleting(true)
    const ok = await deleteShortVideo(video)
    setDeleting(false)
    if (ok) onDeleted(video.id)
    else setConfirmDelete(false)
  }

  return (
    <div style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', position: 'relative' }}>
        <div onClick={() => target && navigate(target)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: target ? 'pointer' : 'default' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '18px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {author?.profile_image
              ? <img src={author.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Icon name="user" size={16} color={COLORS.green} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
              {premium && <PremiumTick size={14} />}
            </div>
            <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{timeAgo(video.created_at)}</p>
          </div>
        </div>
        <div>
          <div role="button" aria-label="More options" onClick={() => { setMenuOpen((o) => !o); setConfirmDelete(false) }} style={{ padding: '6px', cursor: 'pointer', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={COLORS.textMuted} aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </div>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
              <div style={{ position: 'absolute', right: 0, top: '32px', zIndex: 21, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', minWidth: '170px', overflow: 'hidden' }}>
                {isOwn ? (
                  confirmDelete ? (
                    <div style={{ padding: '12px 14px' }}>
                      <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Delete this video?</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div onClick={() => setConfirmDelete(false)} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>Cancel</div>
                        <div onClick={deleting ? undefined : remove} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: '8px', background: COLORS.red, fontSize: '12px', fontWeight: 700, color: 'white', cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.6 : 1 }}>{deleting ? '...' : 'Delete'}</div>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => setConfirmDelete(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', fontSize: '12.5px', fontWeight: 600, color: COLORS.red, cursor: 'pointer' }}>
                      <Icon name="trash" size={15} color={COLORS.red} />
                      Delete video
                    </div>
                  )
                ) : (
                  <div onClick={() => { setMenuOpen(false); setReportOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', fontSize: '12.5px', fontWeight: 600, color: COLORS.red, cursor: 'pointer' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
                    Report video
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {video.caption && <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5, marginBottom: '10px' }}>{video.caption}</p>}

      <div style={{ position: 'relative', background: '#000', borderRadius: '12px', overflow: 'hidden', display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        {failed ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'white', fontSize: '12.5px' }}>This video cannot be played on your device.</div>
        ) : (
          <video
            ref={videoRef}
            src={video.video_url}
            poster={video.thumbnail_url || undefined}
            controls
            playsInline
            preload={video.thumbnail_url ? 'none' : 'metadata'}
            onPlay={handlePlay}
            onError={() => setFailed(true)}
            style={{ width: '100%', maxHeight: '68vh', display: 'block', objectFit: 'contain', background: '#000' }}
          />
        )}
        <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10.5px', fontWeight: 700, borderRadius: '6px', padding: '2px 7px', pointerEvents: 'none' }}>
          {formatDuration(video.duration_seconds)}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', paddingTop: '8px', borderTop: `1px solid ${COLORS.border}` }}>
        <span onClick={toggleLike} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: liked ? COLORS.red : COLORS.textMuted, cursor: 'pointer' }}>
          <Icon name="heart" size={15} color={liked ? COLORS.red : COLORS.textMuted} /> {likes}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: COLORS.textMuted }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" /><circle cx="12" cy="12" r="3" /></svg>
          {views}
        </span>
        <span onClick={share} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: COLORS.textMuted, cursor: 'pointer', marginLeft: 'auto' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 9V5l8 7-8 7v-4c-5.5 0-9 1.5-12 5 1-6 4.5-10.5 12-11z" /></svg>
          {copied ? 'Link copied!' : ''}
        </span>
      </div>

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} type="other" userId={video.user_id} titleLabel="video" context={`Short video: ${video.video_url}`} targetLabel={`Video by ${name}`} />
    </div>
  )
}
