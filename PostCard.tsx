import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Icon from './Icons'
import PostImages from './PostImages'
import CommentsSheet from './CommentsSheet'
import ReportSheet from './ReportSheet'
import PremiumTick from './PremiumTick'
import { isPremiumActive } from './premiumShared'

const COLORS = {
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  orange: '#F59E0B',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

// Select string every page should use so PostCard gets everything it needs.
export const POST_SELECT =
  'id, user_id, company_id, content, images, likes_count, comments_count, created_at, ' +
  'profiles!posts_user_id_fkey(full_name, username, profile_image, is_premium, premium_until), ' +
  'companies!posts_company_id_fkey(id, name, logo_url, is_premium, premium_until)'

export type PostCardData = {
  id: string
  user_id: string
  company_id: string | null
  content: string
  images: string[] | null
  likes_count: number
  comments_count: number
  created_at: string
  profiles: { full_name: string | null; username: string | null; profile_image: string | null; is_premium: boolean; premium_until: string | null } | null
  companies: { id: string; name: string; logo_url: string | null; is_premium: boolean; premium_until: string | null } | null
}

// One post card used by Home, company pages and (later) user profiles.
// It owns its like / save state; the parent only passes the initial values.
export default function PostCard({
  post, initialLiked, initialSaved, onCommentCountChange,
}: {
  post: PostCardData
  initialLiked: boolean
  initialSaved: boolean
  onCommentCountChange?: (delta: number) => void
}) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [liked, setLiked] = useState(initialLiked)
  const [saved, setSaved] = useState(initialSaved)
  const [likes, setLikes] = useState(post.likes_count)
  const [comments, setComments] = useState(post.comments_count)
  const [copied, setCopied] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const isOwn = post.user_id === user?.id
  const company = post.company_id ? post.companies : null
  const author = post.profiles

  // Who the post is "from": the company when it was posted as a company, otherwise the person.
  const name = company ? company.name : author?.full_name || author?.username || 'Farmxie user'
  const image = company ? company.logo_url : author?.profile_image || null
  const premium = company
    ? isPremiumActive(company.is_premium, company.premium_until)
    : !!author && isPremiumActive(author.is_premium, author.premium_until)
  const target = company ? `/companies/${company.id}` : author?.username ? `/u/${author.username}` : null

  const toggleLike = async () => {
    if (!user) return
    const was = liked
    setLiked(!was)
    setLikes((n) => Math.max(0, n + (was ? -1 : 1)))
    if (was) await supabase.from('post_likes').delete().eq('user_id', user.id).eq('post_id', post.id)
    else await supabase.from('post_likes').insert({ user_id: user.id, post_id: post.id })
  }

  const toggleSave = async () => {
    if (!user) return
    if (saved) {
      await supabase.from('saved_items').delete().eq('user_id', user.id).eq('post_id', post.id)
      setSaved(false)
    } else {
      await supabase.from('saved_items').insert({ user_id: user.id, post_id: post.id })
      setSaved(true)
    }
  }

  const share = async () => {
    const shareData = { title: 'Farmxie', text: post.content, url: window.location.origin }
    if ((navigator as any).share) {
      try { await (navigator as any).share(shareData) } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${post.content}\n\n${window.location.origin}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const changeComments = (delta: number) => {
    setComments((n) => Math.max(0, n + delta))
    onCommentCountChange?.(delta)
  }

  return (
    <div style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', position: 'relative' }}>
        <div onClick={() => target && navigate(target)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: target ? 'pointer' : 'default' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: company ? '10px' : '18px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {image
              ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Icon name={company ? 'building' : 'user'} size={16} color={COLORS.green} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
              {premium && <PremiumTick size={14} />}
            </div>
            <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{timeAgo(post.created_at)}{company ? ' · Company' : ''}</p>
          </div>
        </div>
        {!isOwn && (
          <div>
            <div role="button" aria-label="More options" onClick={() => setMenuOpen((o) => !o)} style={{ padding: '6px', cursor: 'pointer', display: 'flex' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={COLORS.textMuted} aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
            </div>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                <div style={{ position: 'absolute', right: 0, top: '32px', zIndex: 21, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', minWidth: '150px', overflow: 'hidden' }}>
                  <div onClick={() => { setMenuOpen(false); setReportOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', fontSize: '12.5px', fontWeight: 600, color: '#DC2626', cursor: 'pointer' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
                    Report post
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5, marginBottom: '10px' }}>{post.content}</p>

      <div style={{ marginBottom: '10px' }}><PostImages images={post.images} /></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', paddingTop: '8px', borderTop: `1px solid ${COLORS.border}` }}>
        <span onClick={toggleLike} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: liked ? '#DC2626' : COLORS.textMuted, cursor: 'pointer' }}>
          <Icon name="heart" size={15} color={liked ? '#DC2626' : COLORS.textMuted} /> {likes}
        </span>
        <span onClick={() => setCommentsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: COLORS.textMuted, cursor: 'pointer' }}>
          <Icon name="comment" size={15} color={COLORS.textMuted} /> {comments}
        </span>
        <span onClick={share} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: COLORS.textMuted, cursor: 'pointer' }}>
          <ShareIcon size={16} color={COLORS.textMuted} /> {copied ? 'Copied!' : ''}
        </span>
        <span onClick={toggleSave} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: COLORS.textMuted, marginLeft: 'auto', cursor: 'pointer' }}>
          <Icon name="bookmark" size={15} color={saved ? COLORS.orange : COLORS.textMuted} />
        </span>
      </div>

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} type="post" contentId={post.id} targetLabel={post.content.slice(0, 80)} />
      <CommentsSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} onCountChange={changeComments} />
    </div>
  )
}

// Forward-arrow share icon (Facebook-style).
function ShareIcon({ size = 16, color = '#5B6B5B' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5l8 7-8 7v-4c-5.5 0-9 1.5-12 5 1-6 4.5-10.5 12-11z" />
    </svg>
  )
}

export function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
