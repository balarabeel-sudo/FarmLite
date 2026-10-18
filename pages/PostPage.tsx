import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import NetworkError from '../NetworkError'
import { FeedPostSkeleton } from '../LoadingSkeleton'
import PostCard, { POST_SELECT } from '../PostCard'
import type { PostCardData } from '../PostCard'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  green: '#16A34A',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// Route: /post/:id
// One post on its own page. Shared links, and comment / like notifications, open here.
// ?comments=1 opens the comments straight away.
export default function PostPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [post, setPost] = useState<PostCardData | null>(null)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [gone, setGone] = useState(false)

  const openComments = new URLSearchParams(window.location.search).get('comments') === '1'

  const load = async () => {
    if (!id || !user) return
    if (!UUID.test(id)) {
      setPost(null)
      setLoading(false)
      return
    }
    setNetError(false)
    setLoading(true)

    const [postRes, likedRes, savedRes] = await Promise.all([
      supabase.from('posts').select(POST_SELECT).eq('id', id).maybeSingle(),
      supabase.from('post_likes').select('post_id').eq('user_id', user.id).eq('post_id', id).maybeSingle(),
      supabase.from('saved_items').select('post_id').eq('user_id', user.id).eq('post_id', id).maybeSingle(),
    ])

    if (postRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    // Not found = deleted, or a private group / hidden post the database does not let this person see.
    setPost((postRes.data as any) || null)
    setLiked(!!likedRes.data)
    setSaved(!!savedRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id, user])

  const goBack = () => {
    // Opened from a link or notification with nothing to go back to: go Home.
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '0 16px', height: '56px', boxSizing: 'border-box', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div role="button" aria-label="Back" onClick={goBack} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Post</p>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {netError && <NetworkError onRetry={load} />}

        {!netError && loading && <FeedPostSkeleton count={1} />}

        {!netError && !loading && !post && !gone && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <Icon name="comment" size={28} color={COLORS.textMuted} />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>This post is not available</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.5 }}>It may have been deleted, or it belongs to a private group you are not a member of.</p>
            <div role="button" onClick={() => navigate('/')} style={{ display: 'inline-block', marginTop: '16px', padding: '10px 22px', borderRadius: '999px', background: COLORS.green, color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Go to Home</div>
          </div>
        )}

        {!netError && !loading && gone && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '36px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>Post deleted</p>
            <div role="button" onClick={goBack} style={{ display: 'inline-block', marginTop: '16px', padding: '10px 22px', borderRadius: '999px', background: COLORS.green, color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Go back</div>
          </div>
        )}

        {!netError && !loading && post && !gone && (
          <PostCard post={post} initialLiked={liked} initialSaved={saved} onDeleted={() => setGone(true)} defaultCommentsOpen={openComments} />
        )}
      </div>
    </div>
  )
}
