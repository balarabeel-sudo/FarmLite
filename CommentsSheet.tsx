import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Icon from './Icons'
import { COLORS } from './shared'

const PAGE_SIZE = 20
const MAX_LENGTH = 500

type CommentRow = {
  id: string
  user_id: string
  comment: string
  created_at: string
  profiles: {
    full_name: string | null
    username: string | null
    profile_image: string | null
    is_verified: boolean
  } | null
}

type Props = {
  postId: string
  open: boolean
  onClose: () => void
  // Called with +1 / -1 so the feed card can update its comment count instantly.
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

const SELECT = 'id, user_id, comment, created_at, profiles!comments_user_id_fkey(full_name, username, profile_image, is_verified)'

export default function CommentsSheet({ postId, open, onClose, onCountChange }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [comments, setComments] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase
      .from('comments')
      .select(SELECT)
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
    if (err) {
      setError(true)
      setLoading(false)
      return
    }
    setComments((data as any) || [])
    setHasMore((data?.length || 0) === PAGE_SIZE)
    setLoading(false)
  }

  const loadMore = async () => {
    setLoadingMore(true)
    const from = comments.length
    const { data, error: err } = await supabase
      .from('comments')
      .select(SELECT)
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (!err && data) {
      setComments((prev) => [...prev, ...(data as any)])
      setHasMore(data.length === PAGE_SIZE)
    }
    setLoadingMore(false)
  }

  useEffect(() => {
    if (open) {
      setComments([])
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

  const send = async () => {
    const value = text.trim()
    if (!value || !user || sending) return
    setSending(true)
    const { data, error: err } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, comment: value })
      .select(SELECT)
      .single()
    setSending(false)
    if (err || !data) {
      alert('Could not post your comment. Please try again.')
      return
    }
    setComments((prev) => [data as any, ...prev])
    setText('')
    onCountChange?.(1)
  }

  const remove = async (id: string) => {
    if (!window.confirm('Delete this comment?')) return
    const { error: err } = await supabase.from('comments').delete().eq('id', id)
    if (err) {
      alert('Could not delete the comment.')
      return
    }
    setComments((prev) => prev.filter((c) => c.id !== id))
    onCountChange?.(-1)
  }

  if (!open) return null

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

          {!loading && comments.map((c) => {
            const p = c.profiles
            const name = p?.full_name || p?.username || 'FarmLite user'
            const goProfile = () => { if (p?.username) { onClose(); navigate(`/u/${p.username}`) } }
            return (
              <div key={c.id} style={{ display: 'flex', gap: '10px', padding: '10px 0' }}>
                <div onClick={goProfile} style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
                  {p?.profile_image ? <img src={p.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={15} color={COLORS.green} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <p onClick={goProfile} style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
                    {p?.is_verified && <Icon name="checkCircle" size={12} color={COLORS.green} />}
                    <span style={{ fontSize: '10.5px', color: COLORS.textMuted, flexShrink: 0 }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: COLORS.text, marginTop: '2px', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.comment}</p>
                </div>
                {user?.id === c.user_id && (
                  <div onClick={() => remove(c.id)} style={{ cursor: 'pointer', alignSelf: 'flex-start', padding: '2px', display: 'flex' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                  </div>
                )}
              </div>
            )
          })}

          {!loading && hasMore && (
            <div style={{ textAlign: 'center', padding: '8px 0 14px' }}>
              <div onClick={loadingMore ? undefined : loadMore} style={{ display: 'inline-block', padding: '8px 18px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>
                {loadingMore ? 'Loading...' : 'Load more'}
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', borderTop: `1px solid ${COLORS.bg}` }}>
          <input
            ref={inputRef}
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Write a comment..."
            style={{ flex: 1, border: `1px solid ${COLORS.border}`, background: COLORS.bg, borderRadius: '20px', padding: '10px 14px', fontSize: '13px', color: COLORS.text, outline: 'none' }}
          />
          <div
            onClick={send}
            style={{ width: '38px', height: '38px', borderRadius: '19px', background: text.trim() && !sending ? COLORS.green : COLORS.border, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: text.trim() && !sending ? 'pointer' : 'default', flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </div>
        </div>
      </div>
    </div>
  )
}
