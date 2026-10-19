import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Icon from './Icons'
import PostImages from './PostImages'
import CommentsSheet from './CommentsSheet'
import ReportSheet from './ReportSheet'
import PremiumTick from './PremiumTick'
import { isPremiumActive } from './premiumShared'
import { followTarget, unfollowTarget, useFollowing } from './followShared'
import ShareSheet from './ShareSheet'

const COLORS = {
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  orange: '#F59E0B',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

// Same size for everyone: person, company and group posts line up the same way.
const AVATAR = 40

// Select string every page should use so PostCard gets everything it needs.
export const POST_SELECT =
  'id, user_id, company_id, community_id, content, images, likes_count, comments_count, shares_count, is_share, created_at, ' +
  'profiles!posts_user_id_fkey(full_name, username, profile_image, is_premium, premium_until), ' +
  'companies!posts_company_id_fkey(id, name, logo_url, is_premium, premium_until), ' +
  'communities!posts_community_id_fkey(id, name, cover_url), ' +
  'shared:shared_post'

// The original post inside a share.
export type SharedPostData = {
  id: string
  user_id: string
  company_id: string | null
  content: string
  images: string[] | null
  created_at: string
  profiles: { full_name: string | null; username: string | null; profile_image: string | null; is_premium: boolean; premium_until: string | null } | null
  companies: { id: string; name: string; logo_url: string | null; is_premium: boolean; premium_until: string | null } | null
}

export type PostCardData = {
  id: string
  user_id: string
  company_id: string | null
  community_id?: string | null
  content: string
  images: string[] | null
  likes_count: number
  comments_count: number
  shares_count?: number
  is_share?: boolean
  shared?: SharedPostData | null
  created_at: string
  profiles: { full_name: string | null; username: string | null; profile_image: string | null; is_premium: boolean; premium_until: string | null } | null
  companies: { id: string; name: string; logo_url: string | null; is_premium: boolean; premium_until: string | null } | null
  communities?: { id: string; name: string; cover_url: string | null } | null
}

type MenuItem = { label: string; danger?: boolean; onClick: () => void }

// One post card used by Home, company pages, user profiles, groups and the post page.
// It owns its like / save state; the parent only passes the initial values.
export default function PostCard({
  post, initialLiked, initialSaved, onCommentCountChange, pinned, menuActions, emphasize, children, hideFollow, onDeleted, defaultCommentsOpen, inGroup, showFullText,
}: {
  post: PostCardData
  initialLiked: boolean
  initialSaved: boolean
  onCommentCountChange?: (delta: number) => void
  // Optional extras used by group pages (pin badge, edit/delete/pin menu entries, poll widget under the text)
  pinned?: boolean
  menuActions?: MenuItem[]
  emphasize?: boolean
  children?: ReactNode
  // Profile pages already have their own Follow button, so they hide the one in the header.
  hideFollow?: boolean
  onDeleted?: (postId: string) => void
  defaultCommentsOpen?: boolean
  // The card is shown inside a group page: posts of a group cannot be re-shared, only linked.
  inGroup?: boolean
  // The single-post page shows the whole text; everywhere else long text is cut with a "See more" link.
  showFullText?: boolean
}) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const cardRef = useRef<HTMLDivElement>(null)
  const [liked, setLiked] = useState(initialLiked)
  const [saved, setSaved] = useState(initialSaved)
  const [likes, setLikes] = useState(post.likes_count)
  const [comments, setComments] = useState(post.comments_count)
  const [shares, setShares] = useState(post.shares_count || 0)
  const [shareOpen, setShareOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(!!defaultCommentsOpen)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [followBusy, setFollowBusy] = useState(false)
  const [justFollowed, setJustFollowed] = useState(false)

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

  // A post made inside a group shows the group first and the person who posted underneath (Facebook style).
  const group = !company && post.community_id ? post.communities || null : null
  const authorName = author?.full_name || author?.username || 'Farmxie user'
  const authorTarget = author?.username ? `/u/${author.username}` : null

  // Follow: the company for company posts, otherwise the person who wrote it.
  const followKind = company ? 'company' : 'user'
  const followId = company ? company.id : post.user_id
  const following = useFollowing(isOwn ? undefined : user?.id, followKind, followId)
  const showFollow = !hideFollow && !isOwn && !group && !inGroup && !!user && (following === false || justFollowed)
  const followName = (company ? company.name : author?.username ? `@${author.username}` : authorName).slice(0, 24)

  const postUrl = `${window.location.origin}/post/${post.id}`

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1700)
  }

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
      flash('Removed from saved')
    } else {
      await supabase.from('saved_items').insert({ user_id: user.id, post_id: post.id })
      setSaved(true)
      flash('Post saved')
    }
  }

  const canRepost = !inGroup && !group
  const snippet = post.content.length > 140 ? `${post.content.slice(0, 140)}…` : post.content

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl)
      flash('Link copied')
    } catch { /* clipboard blocked */ }
  }

  const follow = async () => {
    if (!user || followBusy) return
    setFollowBusy(true)
    const ok = await followTarget(user.id, followKind, followId)
    setFollowBusy(false)
    if (!ok) { flash('Could not follow. Try again.'); return }
    // Show "Following" for a moment, then the button leaves the header.
    setJustFollowed(true)
    setTimeout(() => setJustFollowed(false), 1500)
  }

  const unfollow = async () => {
    if (!user) return
    const ok = await unfollowTarget(user.id, followKind, followId)
    if (!ok) flash('Could not unfollow. Try again.')
  }

  const deletePost = async () => {
    if (!user || deleting) return
    setDeleting(true)
    const { error } = await supabase.from('posts').delete().eq('id', post.id).eq('user_id', user.id)
    setDeleting(false)
    setConfirmDelete(false)
    if (error) { flash('Could not delete the post. Try again.'); return }
    setDeleted(true)
    onDeleted?.(post.id)
  }

  const changeComments = (delta: number) => {
    setComments((n) => Math.max(0, n + delta))
    onCommentCountChange?.(delta)
  }

  if (deleted) return null

  // Three-dots menu. Group admin actions (pin / edit / delete) passed by group pages come first.
  const items: MenuItem[] = [...(menuActions || [])]
  const hasOwnDelete = items.some((a) => /delete|remove/i.test(a.label))
  if (!isOwn) {
    items.push({ label: saved ? 'Remove from saved' : 'Save post', onClick: toggleSave })
    items.push({ label: 'Copy link', onClick: copyLink })
    if (following !== null) {
      items.push(following
        ? { label: `Unfollow ${followName}`, onClick: unfollow }
        : { label: `Follow ${followName}`, onClick: follow })
    }
    items.push({ label: 'Report post', danger: true, onClick: () => setReportOpen(true) })
  } else {
    items.push({ label: 'Copy link', onClick: copyLink })
    if (!hasOwnDelete) items.push({ label: 'Delete post', danger: true, onClick: () => setConfirmDelete(true) })
  }

  const time = postTime(post.created_at)
  const fullTime = new Date(post.created_at).toLocaleString()
  const sub = company ? 'Company' : author?.username ? `@${author.username}` : ''

  return (
    <div ref={cardRef} style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', scrollMarginTop: '72px' }}>
      {pinned && <p style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.green, marginBottom: '8px' }}>📌 Pinned post</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', position: 'relative' }}>
        {group ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <div onClick={() => navigate(`/communities/${group.id}`)} style={{ position: 'relative', width: `${AVATAR}px`, height: `${AVATAR}px`, flexShrink: 0, cursor: 'pointer' }}>
              <div style={{ width: `${AVATAR}px`, height: `${AVATAR}px`, borderRadius: '12px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {group.cover_url
                  ? <img src={group.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Icon name="users" size={18} color={COLORS.green} />}
              </div>
              <div style={{ position: 'absolute', right: '-5px', bottom: '-5px', width: '20px', height: '20px', borderRadius: '10px', background: '#DCFCE7', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {author?.profile_image
                  ? <img src={author.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Icon name="user" size={10} color={COLORS.green} />}
              </div>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p onClick={() => navigate(`/communities/${group.id}`)} style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, lineHeight: 1.25, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>{group.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, marginTop: '1px' }}>
                <p onClick={() => authorTarget && navigate(authorTarget)} title={fullTime} style={{ margin: 0, fontSize: '11.5px', fontWeight: 600, lineHeight: 1.3, color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, cursor: authorTarget ? 'pointer' : 'default' }}>{authorName}</p>
                {!!author && isPremiumActive(author.is_premium, author.premium_until) && <PremiumTick size={12} />}
                <p title={fullTime} style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.3, color: COLORS.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>· {time}</p>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <div onClick={() => target && navigate(target)} style={{ width: `${AVATAR}px`, height: `${AVATAR}px`, borderRadius: company ? '12px' : '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: target ? 'pointer' : 'default' }}>
              {image
                ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Icon name={company ? 'building' : 'user'} size={18} color={COLORS.green} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                <p onClick={() => target && navigate(target)} style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, lineHeight: 1.25, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, cursor: target ? 'pointer' : 'default' }}>{name}</p>
                {premium && <PremiumTick size={14} />}
                {showFollow && (
                  <>
                    <span style={{ fontSize: '12px', color: COLORS.textMuted, flexShrink: 0 }}>·</span>
                    {justFollowed && following ? (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, flexShrink: 0 }}>Following</span>
                    ) : (
                      <span role="button" onClick={follow} style={{ fontSize: '12px', fontWeight: 800, color: COLORS.green, cursor: 'pointer', flexShrink: 0, opacity: followBusy ? 0.5 : 1 }}>Follow</span>
                    )}
                  </>
                )}
              </div>
              <p title={fullTime} style={{ margin: '1px 0 0', fontSize: '11.5px', lineHeight: 1.3, color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sub ? `${sub} · ${time}` : time}
              </p>
            </div>
          </div>
        )}

        <div style={{ flexShrink: 0 }}>
          <div role="button" aria-label="More options" onClick={() => setMenuOpen((o) => !o)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: '-6px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={COLORS.textMuted} aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </div>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
              <div style={{ position: 'absolute', right: 0, top: '36px', zIndex: 21, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', minWidth: '180px', maxWidth: '260px', overflow: 'hidden' }}>
                {items.map((a, i) => (
                  <div key={a.label} onClick={() => { setMenuOpen(false); a.onClick() }} style={{ padding: '12px 14px', fontSize: '12.5px', fontWeight: 600, color: a.danger ? '#DC2626' : COLORS.text, cursor: 'pointer', borderBottom: i < items.length - 1 ? `1px solid ${COLORS.border}` : 'none', wordBreak: 'break-word' }}>{a.label}</div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {post.content.trim() !== '' && (
        <ExpandableText
          text={post.content}
          cardRef={cardRef}
          fullText={!!showFullText}
          style={{ fontSize: emphasize ? '14px' : '13px', fontWeight: emphasize ? 700 : 400, color: COLORS.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        />
      )}

      {post.is_share ? (
        <SharedPostCard shared={post.shared || null} onOpen={(id) => navigate(`/post/${id}`)} />
      ) : (
        <div style={{ marginBottom: '12px' }}><PostImages images={post.images} /></div>
      )}
      {children}

      <div style={{ display: 'flex', alignItems: 'center', gap: '22px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
        <span onClick={toggleLike} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: liked ? '#DC2626' : COLORS.textMuted, cursor: 'pointer' }}>
          <Icon name="heart" size={16} color={liked ? '#DC2626' : COLORS.textMuted} /> {likes}
        </span>
        <span onClick={() => setCommentsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: COLORS.textMuted, cursor: 'pointer' }}>
          <Icon name="comment" size={16} color={COLORS.textMuted} /> {comments}
        </span>
        <span onClick={() => setShareOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: COLORS.textMuted, cursor: 'pointer' }}>
          <ShareIcon size={16} color={COLORS.textMuted} /> {shares > 0 ? shares : ''}
        </span>
        <span onClick={toggleSave} style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', cursor: 'pointer' }}>
          <Icon name="bookmark" size={16} color={saved ? COLORS.orange : COLORS.textMuted} />
        </span>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        postId={post.id}
        postUrl={postUrl}
        snippet={snippet}
        canRepost={canRepost}
        onShared={() => setShares((n) => n + 1)}
      />
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} type="post" contentId={post.id} targetLabel={post.content.slice(0, 80)} />
      <CommentsSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} onCountChange={changeComments} />

      {confirmDelete && (
        <div onClick={() => !deleting && setConfirmDelete(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '340px' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Delete this post?</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5, marginTop: '6px' }}>This cannot be undone. Its likes and comments will be deleted too.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <div role="button" onClick={() => !deleting && setConfirmDelete(false)} style={{ flex: 1, textAlign: 'center', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>Cancel</div>
              <div role="button" onClick={deletePost} style={{ flex: 1, textAlign: 'center', padding: '11px', borderRadius: '10px', background: '#DC2626', fontSize: '13px', fontWeight: 700, color: 'white', cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>{deleting ? 'Deleting…' : 'Delete'}</div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', background: COLORS.text, color: 'white', fontSize: '12px', fontWeight: 600, padding: '9px 16px', borderRadius: '999px', zIndex: 70, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// The original post shown inside a share (or a note when the original was deleted).
// Long post text is cut after a few lines with a "See more" link (like other social apps).
// "See less" folds it back and, if the top of the post has scrolled out of view, brings the post back into view.
const COLLAPSED_LINES = 6
const HEADER_ROOM = 72

function ExpandableText({ text, style, cardRef, fullText }: { text: string; style: CSSProperties; cardRef: RefObject<HTMLDivElement>; fullText: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  // Is the text longer than the cut-off? Measured while it is collapsed, and again when the width changes.
  useLayoutEffect(() => {
    if (fullText) return
    const el = ref.current
    if (!el) return
    const measure = () => {
      if (expanded) return
      setOverflowing(el.scrollHeight > el.clientHeight + 1)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, expanded, fullText])

  const collapse = () => {
    const card = cardRef.current
    const topHidden = !!card && card.getBoundingClientRect().top < HEADER_ROOM
    setExpanded(false)
    if (card && topHidden) {
      requestAnimationFrame(() => card.scrollIntoView({ block: 'start', behavior: 'smooth' }))
    }
  }

  const clamp = !fullText && !expanded
  const clampStyle: CSSProperties = clamp
    ? { display: '-webkit-box', WebkitLineClamp: COLLAPSED_LINES, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
    : {}
  const linkStyle: CSSProperties = {
    display: 'block', marginTop: '4px', padding: '2px 0', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '12.5px', fontWeight: 700, color: COLORS.green, fontFamily: 'inherit',
  }

  return (
    <div style={{ marginBottom: '10px' }}>
      <p ref={ref} style={{ ...style, margin: 0, ...clampStyle }}>{text}</p>
      {!fullText && overflowing && !expanded && (
        <button type="button" aria-expanded={false} onClick={() => setExpanded(true)} style={linkStyle}>See more</button>
      )}
      {!fullText && expanded && (
        <button type="button" aria-expanded={true} onClick={collapse} style={linkStyle}>See less</button>
      )}
    </div>
  )
}

function SharedPostCard({ shared, onOpen }: { shared: SharedPostData | null; onOpen: (id: string) => void }) {
  if (!shared) {
    return (
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '14px', marginBottom: '12px', background: '#F8FAF6' }}>
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.45 }}>This post is no longer available.</p>
      </div>
    )
  }
  const company = shared.company_id ? shared.companies : null
  const author = shared.profiles
  const name = company ? company.name : author?.full_name || author?.username || 'Farmxie user'
  const image = company ? company.logo_url : author?.profile_image || null
  const premium = company
    ? isPremiumActive(company.is_premium, company.premium_until)
    : !!author && isPremiumActive(author.is_premium, author.premium_until)
  const pics = (shared.images || []).filter(Boolean)
  return (
    <div role="button" onClick={() => onOpen(shared.id)} style={{ border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px', marginBottom: '12px', cursor: 'pointer', background: '#FCFDFB' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: company ? '8px' : '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {image ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={company ? 'building' : 'user'} size={14} color={COLORS.green} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
            {premium && <PremiumTick size={13} />}
          </div>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{postTime(shared.created_at)}</p>
        </div>
      </div>
      {shared.content.trim() !== '' && (
        <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: pics.length ? '8px' : 0 }}>{shared.content}</p>
      )}
      {pics.length > 0 && <PostImages images={pics} />}
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

// Post time like X: "now", "5m", "3h", "2d", then the date ("12 Oct", and the year once it is from an earlier year).
export function postTime(iso: string) {
  const then = new Date(iso)
  const mins = Math.floor((Date.now() - then.getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const sameYear = then.getFullYear() === new Date().getFullYear()
  return then.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
}
