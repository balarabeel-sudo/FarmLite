import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Icon from './Icons'
import { COLORS } from './shared'
import { followTarget, useFollowing } from './followShared'

const PAGE_SIZE = 20
const MAX_LENGTH = 500

type VideoCommentRow = {
  id: string
  user_id: string
  comment: string
  created_at: string
  parent_id: string | null
  replies_count: number
  profiles: { full_name: string | null; username: string | null; profile_image: string | null } | null
}

type ReplyTarget = { topId: string; name: string }

const REPLIES_LIMIT = 50
const SELECT = 'id, user_id, comment, created_at, parent_id, replies_count, profiles!video_comments_user_id_fkey(full_name, username, profile_image)'

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

// Small "Follow" next to a commenter's name; disappears once you follow (or if you already do / it is you).
function FollowChip({ targetId }: { targetId: string }) {
  const { user } = useAuth()
  const isOwn = !user || user.id === targetId
  const following = useFollowing(isOwn ? undefined : user?.id, 'user', targetId)
  const [busy, setBusy] = useState(false)
  const [justFollowed, setJustFollowed] = useState(false)
  if (isOwn || !user) return null
  if (justFollowed) return <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, flexShrink: 0 }}>Following</span>
  if (following !== false) return null
  const go = async () => {
    if (busy) return
    setBusy(true)
    const ok = await followTarget(user.id, 'user', targetId)
    setBusy(false)
    if (!ok) return
    setJustFollowed(true)
    setTimeout(() => setJustFollowed(false), 1500)
  }
  return <span role="button" onClick={go} style={{ fontSize: '11.5px', fontWeight: 800, color: COLORS.green, cursor: 'pointer', flexShrink: 0, opacity: busy ? 0.5 : 1 }}>Follow</span>
}

// Bottom sheet with the comments of one short video: replies under each comment, Follow next to the name,
// and a tap on the name or photo opens that person's profile.
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
  const [replies, setReplies] = useState<Record<string, VideoCommentRow[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set())
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!open || loadedFor.current === videoId) return
    loadedFor.current = videoId
    let alive = true
    setLoading(true)
    setError('')
    setComments([])
    setReplies({})
    setExpanded(new Set())
    setReplyTo(null)
    setText('')
    supabase
      .from('video_comments')
      .select(SELECT)
      .eq('video_id', videoId)
      .is('parent_id', null)
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

  if (!open) return null

  const loadMore = async () => {
    if (loadingMore || comments.length === 0) return
    setLoadingMore(true)
    const last = comments[comments.length - 1]
    const { data } = await supabase
      .from('video_comments')
      .select(SELECT)
      .eq('video_id', videoId)
      .is('parent_id', null)
      .lt('created_at', last.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    const rows = (data || []) as unknown as VideoCommentRow[]
    setComments((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))])
    setHasMore(rows.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  const loadReplies = async (parentId: string) => {
    setLoadingReplies((prev) => new Set(prev).add(parentId))
    const { data, error: e } = await supabase
      .from('video_comments')
      .select(SELECT)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true })
      .limit(REPLIES_LIMIT)
    if (!e && data) {
      setReplies((prev) => ({ ...prev, [parentId]: data as unknown as VideoCommentRow[] }))
      setExpanded((prev) => new Set(prev).add(parentId))
    }
    setLoadingReplies((prev) => { const next = new Set(prev); next.delete(parentId); return next })
  }

  const toggleReplies = (parentId: string) => {
    if (expanded.has(parentId)) {
      setExpanded((prev) => { const next = new Set(prev); next.delete(parentId); return next })
    } else if (replies[parentId]) {
      setExpanded((prev) => new Set(prev).add(parentId))
    } else {
      loadReplies(parentId)
    }
  }

  const patchTop = (id: string, fn: (c: VideoCommentRow) => VideoCommentRow) => {
    setComments((prev) => prev.map((c) => (c.id === id ? fn(c) : c)))
  }

  const startReply = (c: VideoCommentRow) => {
    const name = c.profiles?.full_name || c.profiles?.username || 'Farmxie user'
    // Replying to a reply stays in the same thread, with an @mention in front.
    setReplyTo({ topId: c.parent_id || c.id, name })
    setText(c.parent_id ? `@${c.profiles?.username || name} ` : '')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const cancelReply = () => { setReplyTo(null); setText('') }

  const send = async () => {
    const value = text.trim()
    if (!user || !value || sending) return
    setSending(true)
    setError('')
    const { data, error: e } = await supabase
      .from('video_comments')
      .insert({ video_id: videoId, user_id: user.id, comment: value, parent_id: replyTo?.topId || null })
      .select(SELECT)
      .single()
    setSending(false)
    if (e || !data) {
      setError(e?.message || 'Could not post your comment. Try again.')
      return
    }
    const row = data as unknown as VideoCommentRow
    if (replyTo) {
      const topId = replyTo.topId
      patchTop(topId, (x) => ({ ...x, replies_count: x.replies_count + 1 }))
      if (replies[topId]) {
        setReplies((prev) => ({ ...prev, [topId]: [...(prev[topId] || []), row] }))
        setExpanded((prev) => new Set(prev).add(topId))
      } else {
        await loadReplies(topId)
      }
      setReplyTo(null)
    } else {
      setComments((prev) => [row, ...prev])
    }
    setText('')
    onCountChange?.(1)
  }

  const remove = async (c: VideoCommentRow) => {
    const { error: e } = await supabase.from('video_comments').delete().eq('id', c.id)
    if (e) { setError('Could not delete the comment.'); return }
    if (c.parent_id) {
      const parentId = c.parent_id
      setReplies((prev) => ({ ...prev, [parentId]: (prev[parentId] || []).filter((r) => r.id !== c.id) }))
      patchTop(parentId, (x) => ({ ...x, replies_count: Math.max(0, x.replies_count - 1) }))
      onCountChange?.(-1)
    } else {
      setComments((prev) => prev.filter((x) => x.id !== c.id))
      setReplies((prev) => { const next = { ...prev }; delete next[c.id]; return next })
      if (replyTo?.topId === c.id) cancelReply()
      onCountChange?.(-(1 + (c.replies_count || 0)))
    }
  }

  const renderComment = (c: VideoCommentRow, isReply: boolean) => {
    const p = c.profiles
    const name = p?.full_name || p?.username || 'Farmxie user'
    const canDelete = c.user_id === user?.id || videoOwnerId === user?.id
    const avatar = isReply ? 26 : 34
    const goProfile = () => { if (p?.username) { onClose(); navigate(`/u/${p.username}`) } }
    return (
      <div key={c.id} style={{ display: 'flex', gap: '10px', padding: isReply ? '6px 0' : '9px 0' }}>
        <div
          onClick={goProfile}
          style={{ width: `${avatar}px`, height: `${avatar}px`, borderRadius: `${avatar / 2}px`, background: 'var(--fx-tint-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: p?.username ? 'pointer' : 'default' }}>
          {p?.profile_image
            ? <img src={p.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="user" size={isReply ? 13 : 15} color={COLORS.green} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <p onClick={goProfile} style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: COLORS.text, cursor: p?.username ? 'pointer' : 'default', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name}</p>
            <FollowChip targetId={c.user_id} />
          </div>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: COLORS.text, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.comment}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '4px', fontSize: '11px', fontWeight: 700, color: COLORS.textMuted }}>
            <span style={{ fontWeight: 500 }}>{timeAgo(c.created_at)}</span>
            {user && <span role="button" onClick={() => startReply(c)} style={{ cursor: 'pointer' }}>Reply</span>}
            {canDelete && <span role="button" aria-label="Delete comment" onClick={() => remove(c)} style={{ cursor: 'pointer', fontWeight: 500 }}>Delete</span>}
          </div>

          {!isReply && c.replies_count > 0 && (
            <div style={{ marginTop: '4px' }}>
              <span role="button" onClick={() => toggleReplies(c.id)} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>
                {loadingReplies.has(c.id)
                  ? 'Loading...'
                  : expanded.has(c.id)
                    ? 'Hide replies'
                    : `View ${c.replies_count} ${c.replies_count === 1 ? 'reply' : 'replies'}`}
              </span>
            </div>
          )}
          {!isReply && expanded.has(c.id) && (replies[c.id] || []).map((r) => renderComment(r, true))}
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', height: '72vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ padding: '10px 16px 8px', flexShrink: 0 }}>
          <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: COLORS.border, margin: '0 auto 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Comments</p>
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
              {comments.map((c) => renderComment(c, false))}
              {hasMore && (
                <div role="button" onClick={loadMore} style={{ textAlign: 'center', padding: '10px', fontSize: '12.5px', fontWeight: 700, color: COLORS.green, cursor: 'pointer' }}>
                  {loadingMore ? 'Loading...' : 'Load more comments'}
                </div>
              )}
            </>
          )}
        </div>

        {error && <p style={{ fontSize: '12px', color: COLORS.red, padding: '0 16px 6px' }}>{error}</p>}

        {replyTo && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 16px', background: COLORS.bg, borderTop: `1px solid ${COLORS.border}` }}>
            <p style={{ margin: 0, fontSize: '11.5px', color: COLORS.textMuted }}>Replying to <b style={{ color: COLORS.text }}>{replyTo.name}</b></p>
            <div role="button" aria-label="Cancel reply" onClick={cancelReply} style={{ cursor: 'pointer', display: 'flex' }}>
              <Icon name="close" size={14} color={COLORS.textMuted} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: replyTo ? 'none' : `1px solid ${COLORS.border}`, flexShrink: 0 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'}
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
