import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Icon from './Icons'
import { COLORS } from './shared'

const PAGE_SIZE = 20
const MAX_LENGTH = 500

type VideoCommentRow = {
  id: string
  user_id: string
  comment: string
  created_at: string
  profiles: { full_name: string | null; username: string | null; profile_image: string | null } | null
}

const SELECT = 'id, user_id, comment, created_at, profiles!video_comments_user_id_fkey(full_name, username, profile_image)'

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

// Bottom sheet with the comments of one short video.
export default function VideoCommentsSheet({ videoId, videoOwnerId, open, onClose, onCountChange }: {
  videoId: string
  videoOwnerId: string
  open: boolean
  onClose: () => void
  // Called with +N / -N so the video can update its comment count instantly.
  onCountChange?: (delta: number) => void
}) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [comments, setComments] = useState<VideoCommentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [myProfile, setMyProfile] = useState<VideoCommentRow['profiles']>(null)
  const loadedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!open || loadedFor.current === videoId) return
    loadedFor.current = videoId
    let alive = true
    setLoading(true)
    setError('')
    setComments([])
    supabase
      .from('video_comments')
      .select(SELECT)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) setError('Could not load comments. Try again.')
        const rows = (data || []) as unknown as VideoCommentRow[]
        setComments(rows)
        setHasMore(rows.length === PAGE_SIZE)
        setLoading(false)
      }, () => { if (alive) { setError('Could not load comments. Try again.'); setLoading(false) } })
    return () => { alive = false }
  }, [open, videoId])

  useEffect(() => {
    if (!open || !user || myProfile) return
    supabase.from('profiles').select('full_name, username, profile_image').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setMyProfile(data as any) }, () => undefined)
  }, [open, user, myProfile])

  if (!open) return null

  const loadMore = async () => {
    if (loadingMore || comments.length === 0) return
    setLoadingMore(true)
    const last = comments[comments.length - 1]
    const { data } = await supabase
      .from('video_comments')
      .select(SELECT)
      .eq('video_id', videoId)
      .lt('created_at', last.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    const rows = (data || []) as unknown as VideoCommentRow[]
    setComments((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))])
    setHasMore(rows.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  const send = async () => {
    const value = text.trim()
    if (!user || !value || sending) return
    setSending(true)
    setError('')
    const { data, error: e } = await supabase
      .from('video_comments')
      .insert({ video_id: videoId, user_id: user.id, comment: value })
      .select('id, user_id, comment, created_at')
      .single()
    setSending(false)
    if (e || !data) {
      setError(e?.message || 'Could not post your comment. Try again.')
      return
    }
    setComments((prev) => [{ ...(data as any), profiles: myProfile }, ...prev])
    setText('')
    onCountChange?.(1)
  }

  const remove = async (c: VideoCommentRow) => {
    const { error: e } = await supabase.from('video_comments').delete().eq('id', c.id)
    if (e) { setError('Could not delete the comment.'); return }
    setComments((prev) => prev.filter((x) => x.id !== c.id))
    onCountChange?.(-1)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', height: '72vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ padding: '10px 16px 8px', flexShrink: 0 }}>
          <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: COLORS.border, margin: '0 auto 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Comments</p>
            <div role="button" aria-label="Close" onClick={onClose} style={{ cursor: 'pointer', display: 'flex', padding: '4px' }}>
              <Icon name="close" size={20} color={COLORS.textMuted} />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 8px' }}>
          {loading ? (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center', padding: '30px 0' }}>Loading...</p>
          ) : comments.length === 0 ? (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center', padding: '30px 0' }}>No comments yet. Be the first to comment.</p>
          ) : (
            <>
              {comments.map((c) => {
                const name = c.profiles?.full_name || c.profiles?.username || 'Farmxie user'
                const canDelete = c.user_id === user?.id || videoOwnerId === user?.id
                return (
                  <div key={c.id} style={{ display: 'flex', gap: '10px', padding: '9px 0' }}>
                    <div
                      onClick={() => { if (c.profiles?.username) { onClose(); navigate(`/u/${c.profiles.username}`) } }}
                      style={{ width: '34px', height: '34px', borderRadius: '17px', background: 'var(--fx-tint-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: c.profiles?.username ? 'pointer' : 'default' }}>
                      {c.profiles?.profile_image
                        ? <img src={c.profiles.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Icon name="user" size={15} color={COLORS.green} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>
                        {name} <span style={{ fontWeight: 500, color: COLORS.textMuted }}>· {timeAgo(c.created_at)}</span>
                      </p>
                      <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.45, marginTop: '2px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.comment}</p>
                    </div>
                    {canDelete && (
                      <div role="button" aria-label="Delete comment" onClick={() => remove(c)} style={{ cursor: 'pointer', padding: '4px', display: 'flex', alignSelf: 'flex-start' }}>
                        <Icon name="trash" size={15} color={COLORS.textMuted} />
                      </div>
                    )}
                  </div>
                )
              })}
              {hasMore && (
                <div role="button" onClick={loadMore} style={{ textAlign: 'center', padding: '10px', fontSize: '12.5px', fontWeight: 700, color: COLORS.green, cursor: 'pointer' }}>
                  {loadingMore ? 'Loading...' : 'Load more comments'}
                </div>
              )}
            </>
          )}
        </div>

        {error && <p style={{ fontSize: '12px', color: COLORS.red, padding: '0 16px 6px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Add a comment..."
            style={{ flex: 1, minWidth: 0, border: `1px solid ${COLORS.border}`, borderRadius: '20px', padding: '10px 14px', fontSize: '13px', outline: 'none', background: COLORS.bg, color: COLORS.text, fontFamily: 'inherit' }}
          />
          <div
            role="button"
            aria-label="Send comment"
            onClick={send}
            style={{ width: '40px', height: '40px', borderRadius: '20px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: text.trim() && !sending ? 'pointer' : 'default', opacity: text.trim() && !sending ? 1 : 0.5, flexShrink: 0 }}>
            <Icon name="send" size={17} color="white" />
          </div>
        </div>
      </div>
    </div>
  )
}
