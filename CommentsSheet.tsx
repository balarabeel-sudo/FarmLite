import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Icon from './Icons'
import { COLORS } from './shared'

const PAGE_SIZE = 20
const REPLIES_LIMIT = 50
const MAX_LENGTH = 500

type CommentRow = {
  id: string
  user_id: string
  parent_id: string | null
  comment: string
  created_at: string
  likes_count: number
  replies_count: number
  profiles: {
    full_name: string | null
    username: string | null
    profile_image: string | null
    is_verified: boolean
  } | null
}

type ReplyTarget = { topId: string; name: string; mention: string | null }

type Props = {
  postId: string
  open: boolean
  onClose: () => void
  // Called with +N / -N so the feed card can update its comment count instantly.
  onCountChange?: (delta: number) => void
}

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

const SELECT = 'id, user_id, parent_id, comment, created_at, likes_count, replies_count, profiles!comments_user_id_fkey(full_name, username, profile_image, is_verified)'

export default function CommentsSheet({ postId, open, onClose, onCountChange }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [comments, setComments] = useState<CommentRow[]>([])
  const [replies, setReplies] = useState<Record<string, CommentRow[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set())
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Which of these comments has the signed-in user already liked?
  const fetchLiked = async (ids: string[]) => {
    if (!user || ids.length === 0) return
    const { data } = await supabase.from('comment_likes').select('comment_id').eq('user_id', user.id).in('comment_id', ids)
    if (data && data.length) {
      setLikedIds((prev) => {
        const next = new Set(prev)
        data.forEach((r: any) => next.add(r.comment_id))
        return next
      })
    }
  }

  const load = async () => {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase
      .from('comments')
      .select(SELECT)
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
    if (err) {
      setError(true)
      setLoading(false)
      return
    }
    const rows = (data as any) || []
    setComments(rows)
    setHasMore(rows.length === PAGE_SIZE)
    setLoading(false)
    fetchLiked(rows.map((r: CommentRow) => r.id))
  }

  const loadMore = async () => {
    setLoadingMore(true)
    const from = comments.length
    const { data, error: err } = await supabase
      .from('comments')
      .select(SELECT)
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (!err && data) {
      setComments((prev) => [...prev, ...(data as any)])
      setHasMore(data.length === PAGE_SIZE)
      fetchLiked(data.map((r: any) => r.id))
    }
    setLoadingMore(false)
  }

  const loadReplies = async (parentId: string) => {
    setLoadingReplies((prev) => new Set(prev).add(parentId))
    const { data, error: err } = await supabase
      .from('comments')
      .select(SELECT)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true })
      .limit(REPLIES_LIMIT)
    if (!err && data) {
      setReplies((prev) => ({ ...prev, [parentId]: data as any }))
      setExpanded((prev) => new Set(prev).add(parentId))
      fetchLiked(data.map((r: any) => r.id))
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

  useEffect(() => {
    if (open) {
      setComments([])
      setReplies({})
      setExpanded(new Set())
      setLikedIds(new Set())
      setReplyTo(null)
      setText('')
      load()
    }
  }, [open, postId])

  // Lock background scroll while the sheet is open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Apply a change to a comment wherever it lives (top level or inside a replies list).
  const patchComment = (id: string, fn: (c: CommentRow) => CommentRow) => {
    setComments((prev) => prev.map((c) => (c.id === id ? fn(c) : c)))
    setReplies((prev) => {
      const next: Record<string, CommentRow[]> = {}
      for (const k of Object.keys(prev)) next[k] = prev[k].map((c) => (c.id === id ? fn(c) : c))
      return next
    })
  }

  const toggleLike = async (c: CommentRow) => {
    if (!user) return
    const already = likedIds.has(c.id)
    setLikedIds((prev) => {
      const next = new Set(prev)
      already ? next.delete(c.id) : next.add(c.id)
      return next
    })
    patchComment(c.id, (x) => ({ ...x, likes_count: Math.max(0, x.likes_count + (already ? -1 : 1)) }))
    if (already) {
      await supabase.from('comment_likes').delete().eq('comment_id', c.id).eq('user_id', user.id)
    } else {
      await supabase.from('comment_likes').insert({ comment_id: c.id, user_id: user.id })
    }
  }

  const startReply = (c: CommentRow) => {
    const isReply = !!c.parent_id
    const name = c.profiles?.full_name || c.profiles?.username || 'FarmLite user'
    const mention = isReply ? `@${c.profiles?.username || name} ` : null
    setReplyTo({ topId: c.parent_id || c.id, name, mention })
    setText(mention || '')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const cancelReply = () => {
    setReplyTo(null)
    setText('')
  }

  const send = async () => {
    const value = text.trim()
    if (!value || !user || sending) return
    setSending(true)
    const { data, error: err } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, comment: value, parent_id: replyTo?.topId || null })
      .select(SELECT)
      .single()
    setSending(false)
    if (err || !data) {
      alert('Could not post your comment. Please try again.')
      return
    }
    const row = data as any as CommentRow

    if (replyTo) {
      const topId = replyTo.topId
      patchComment(topId, (x) => ({ ...x, replies_count: x.replies_count + 1 }))
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

  const remove = async (c: CommentRow) => {
    const isReply = !!c.parent_id
    if (!window.confirm(isReply ? 'Delete this reply?' : 'Delete this comment and its replies?')) return
    const { error: err } = await supabase.from('comments').delete().eq('id', c.id)
    if (err) {
      alert('Could not delete the comment.')
      return
    }
    if (isReply) {
      const parentId = c.parent_id as string
      setReplies((prev) => ({ ...prev, [parentId]: (prev[parentId] || []).filter((r) => r.id !== c.id) }))
      patchComment(parentId, (x) => ({ ...x, replies_count: Math.max(0, x.replies_count - 1) }))
      onCountChange?.(-1)
    } else {
      setComments((prev) => prev.filter((x) => x.id !== c.id))
      setReplies((prev) => { const next = { ...prev }; delete next[c.id]; return next })
      onCountChange?.(-(1 + (c.replies_count || 0)))
      if (replyTo?.topId === c.id) cancelReply()
    }
  }

  if (!open) return null

  const renderComment = (c: CommentRow, isReply: boolean) => {
    const p = c.profiles
    const name = p?.full_name || p?.username || 'FarmLite user'
    const liked = likedIds.has(c.id)
    const avatar = isReply ? 26 : 32
    const goProfile = () => { if (p?.username) { onClose(); navigate(`/u/${p.username}`) } }

    return (
      <div key={c.id} style={{ display: 'flex', gap: '8px', padding: '7px 0' }}>
        <div onClick={goProfile} style={{ width: `${avatar}px`, height: `${avatar}px`, borderRadius: `${avatar / 2}px`, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
          {p?.profile_image ? <img src={p.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={isReply ? 13 : 15} color={COLORS.green} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Bubble: name + text */}
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', background: COLORS.bg, borderRadius: '14px', padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <p onClick={goProfile} style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
              {p?.is_verified && <Icon name="checkCircle" size={12} color={COLORS.green} />}
            </div>
            <p style={{ fontSize: '13px', color: COLORS.text, marginTop: '2px', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.comment}</p>
            {c.likes_count > 0 && (
              <div style={{ position: 'absolute', right: '-6px', bottom: '-9px', display: 'flex', alignItems: 'center', gap: '3px', background: COLORS.card, borderRadius: '10px', padding: '2px 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                <Icon name="heart" size={11} color="#DC2626" />
                <span style={{ fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 700 }}>{c.likes_count}</span>
              </div>
            )}
          </div>

          {/* Time · Like · Reply (below the text, like Facebook) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '5px 4px 0', fontSize: '11px', fontWeight: 700, color: COLORS.textMuted }}>
            <span style={{ fontWeight: 500 }}>{timeAgo(c.created_at)}</span>
            <span onClick={() => toggleLike(c)} style={{ cursor: 'pointer', color: liked ? '#DC2626' : COLORS.textMuted }}>Like</span>
            <span onClick={() => startReply(c)} style={{ cursor: 'pointer' }}>Reply</span>
            {user?.id === c.user_id && <span onClick={() => remove(c)} style={{ cursor: 'pointer', fontWeight: 500 }}>Delete</span>}
          </div>

          {/* Replies (only under top-level comments) */}
          {!isReply && c.replies_count > 0 && (
            <div style={{ marginTop: '4px' }}>
              <span onClick={() => toggleReplies(c.id)} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>
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

  const canSend = !!text.trim() && !sending

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '480px', height: '75vh', background: COLORS.card, borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '10px 16px 12px', borderBottom: `1px solid ${COLORS.bg}`, position: 'relative', textAlign: 'center' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: COLORS.border, margin: '0 auto 10px' }} />
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>Comments</p>
          <div onClick={onClose} style={{ position: 'absolute', right: '14px', top: '18px', cursor: 'pointer', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {loading && (
            <div>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 0' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '16px', background: COLORS.bg }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '10px', width: '35%', background: COLORS.bg, borderRadius: '5px' }} />
                    <div style={{ height: '10px', width: '80%', background: COLORS.bg, borderRadius: '5px', marginTop: '8px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Could not load comments.</p>
              <div onClick={load} style={{ display: 'inline-block', marginTop: '10px', padding: '8px 18px', borderRadius: '10px', background: COLORS.green, color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Retry</div>
            </div>
          )}

          {!loading && !error && comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Icon name="message" size={28} color={COLORS.textMuted} />
              <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginTop: '10px' }}>No comments yet</p>
              <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '3px' }}>Be the first to comment.</p>
            </div>
          )}

          {!loading && comments.map((c) => renderComment(c, false))}

          {!loading && hasMore && (
            <div style={{ textAlign: 'center', padding: '8px 0 14px' }}>
              <div onClick={loadingMore ? undefined : loadMore} style={{ display: 'inline-block', padding: '8px 18px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>
                {loadingMore ? 'Loading...' : 'Load more'}
              </div>
            </div>
          )}
        </div>

        {/* Replying-to bar */}
        {replyTo && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 16px', background: COLORS.bg, borderTop: `1px solid ${COLORS.border}` }}>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Replying to <b style={{ color: COLORS.text }}>{replyTo.name}</b></p>
            <div onClick={cancelReply} style={{ cursor: 'pointer', display: 'flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </div>
          </div>
        )}

        {/* Composer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', borderTop: replyTo ? 'none' : `1px solid ${COLORS.bg}` }}>
          <input
            ref={inputRef}
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={replyTo ? 'Write a reply...' : 'Write a comment...'}
            style={{ flex: 1, border: `1px solid ${COLORS.border}`, background: COLORS.bg, borderRadius: '20px', padding: '10px 14px', fontSize: '13px', color: COLORS.text, outline: 'none' }}
          />
          <div
            onClick={send}
            style={{ width: '38px', height: '38px', borderRadius: '19px', background: canSend ? COLORS.green : COLORS.border, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canSend ? 'pointer' : 'default', flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </div>
        </div>
      </div>
    </div>
  )
}
