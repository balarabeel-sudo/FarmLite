import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

type Community = {
  id: string
  owner_id: string
  name: string
  description: string | null
  cover_url: string | null
  members_count: number
}

type Post = {
  id: string
  content: string
  images: string[] | null
  likes_count: number
  comments_count: number
  created_at: string
  profiles: { full_name: string | null; username: string | null; profile_image: string | null } | null
}

export default function CommunityDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [community, setCommunity] = useState<Community | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [joined, setJoined] = useState(false)

  const load = async () => {
    if (!id || !user) return
    setNetError(false)
    setLoading(true)

    const [communityRes, postsRes, memberRes] = await Promise.all([
      supabase.from('communities').select('id, owner_id, name, description, cover_url, members_count').eq('id', id).maybeSingle(),
      supabase.from('posts').select('id, content, images, likes_count, comments_count, created_at, profiles!posts_user_id_fkey(full_name, username, profile_image)').eq('community_id', id).order('created_at', { ascending: false }),
      supabase.from('community_members').select('community_id').eq('user_id', user.id).eq('community_id', id).maybeSingle(),
    ])

    if (communityRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setCommunity(communityRes.data as any)
    setPosts((postsRes.data || []) as any)
    setJoined(!!memberRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id, user])

  const toggleJoin = async () => {
    if (!user || !community) return
    if (joined) {
      await supabase.from('community_members').delete().eq('user_id', user.id).eq('community_id', community.id)
      setJoined(false)
      setCommunity((prev) => prev ? { ...prev, members_count: Math.max(prev.members_count - 1, 0) } : prev)
    } else {
      await supabase.from('community_members').insert({ user_id: user.id, community_id: community.id })
      setJoined(true)
      setCommunity((prev) => prev ? { ...prev, members_count: prev.members_count + 1 } : prev)
    }
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate(-1)} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: '16px' }}><ListCardSkeleton count={3} /></div>
      </div>
    )
  }

  if (!community) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORS.textMuted, fontSize: '13px' }}>Group not found.</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate(-1)} />

      <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, padding: '24px 16px', color: 'white' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {community.cover_url ? <img src={community.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="users" size={26} color="white" />}
          </div>
          <div>
            <p style={{ fontSize: '17px', fontWeight: 800 }}>{community.name}</p>
            <p style={{ fontSize: '12px', color: '#DCFCE7', marginTop: '2px' }}>{community.members_count} members</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {community.owner_id !== user?.id && (
          <div
            onClick={toggleJoin}
            style={{
              textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginBottom: '16px',
              background: joined ? COLORS.card : COLORS.green,
              color: joined ? COLORS.textMuted : 'white',
              border: joined ? `1px solid ${COLORS.border}` : 'none',
            }}>
            {joined ? 'Joined' : 'Join Group'}
          </div>
        )}

        {community.description && (
          <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.6, marginBottom: '20px' }}>{community.description}</p>
        )}

        <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Posts</p>
        {posts.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '28px 16px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '12.5px' }}>
            No posts in this group yet.
          </div>
        ) : (
          posts.map((post) => {
            const author = post.profiles
            return (
              <div key={post.id} style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {author?.profile_image ? <img src={author.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={14} color={COLORS.green} />}
                  </div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{author?.full_name || author?.username || 'FarmLite user'}</p>
                </div>
                <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5 }}>{post.content}</p>
                {post.images?.[0] && (
                  <img src={post.images[0]} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', marginTop: '10px' }} />
                )}
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', paddingTop: '8px', borderTop: `1px solid ${COLORS.border}` }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: COLORS.textMuted }}>
                    <Icon name="heart" size={13} color={COLORS.textMuted} /> {post.likes_count}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: COLORS.textMuted }}>
                    <Icon name="comment" size={13} color={COLORS.textMuted} /> {post.comments_count}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Group</p>
    </div>
  )
}
