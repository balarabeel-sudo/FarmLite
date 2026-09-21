import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import ImageUploader from '../ImageUploader'
import { COLORS, inputStyle, labelStyle, ErrorBanner } from '../shared'

type Community = {
  id: string
  owner_id: string
  name: string
  description: string | null
  cover_url: string | null
  icon_url: string | null
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
  const [viewer, setViewer] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<string[]>([])
  const [cover, setCover] = useState<string[]>([])

  const fillForm = (c: Community) => {
    setName(c.name)
    setDescription(c.description || '')
    setIcon(c.icon_url ? [c.icon_url] : [])
    setCover(c.cover_url ? [c.cover_url] : [])
  }

  const load = async () => {
    if (!id || !user) return
    setNetError(false)
    setLoading(true)

    const [communityRes, postsRes, memberRes] = await Promise.all([
      supabase.from('communities').select('id, owner_id, name, description, cover_url, icon_url, members_count').eq('id', id).maybeSingle(),
      supabase.from('posts').select('id, content, images, likes_count, comments_count, created_at, profiles!posts_user_id_fkey(full_name, username, profile_image)').eq('community_id', id).order('created_at', { ascending: false }),
      supabase.from('community_members').select('community_id').eq('user_id', user.id).eq('community_id', id).maybeSingle(),
    ])

    if (communityRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    const c = communityRes.data as Community | null
    setCommunity(c)
    if (c) fillForm(c)
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

  const handleSave = async () => {
    if (!user || !community || uploading) return
    if (!name.trim()) {
      setFormError('Enter a group name.')
      return
    }
    setFormError('')
    setSaving(true)
    const { error } = await supabase.from('communities').update({
      name: name.trim(),
      description: description.trim() || null,
      icon_url: icon[0] || null,
      cover_url: cover[0] || null,
    }).eq('id', community.id).eq('owner_id', user.id)
    setSaving(false)

    if (error) {
      setFormError('Could not save your changes. Try again.')
      return
    }
    setEditing(false)
    load()
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

  const isOwner = community.owner_id === user?.id
  const canPost = joined || isOwner
  const avatar = community.icon_url || community.cover_url

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate(-1)} />

      <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, height: '120px', overflow: 'hidden' }}>
        {community.cover_url && <img src={community.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-end', marginTop: '-28px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#DCFCE7', border: `3px solid ${COLORS.bg}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="users" size={26} color={COLORS.green} />}
          </div>
          <div style={{ paddingBottom: '2px', minWidth: 0 }}>
            <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{community.name}</p>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>{community.members_count} members</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          {!isOwner && (
            <div
              onClick={toggleJoin}
              style={{
                flex: 1, textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                background: joined ? COLORS.card : COLORS.green,
                color: joined ? COLORS.textMuted : 'white',
                border: joined ? `1px solid ${COLORS.border}` : 'none',
              }}>
              {joined ? 'Joined' : 'Join Group'}
            </div>
          )}
          {canPost && (
            <div onClick={() => navigate(`/create?community=${community.id}`)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px', background: COLORS.green, color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              <Icon name="plus" size={14} color="white" /> Post in group
            </div>
          )}
          {isOwner && !editing && (
            <div onClick={() => setEditing(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              <Icon name="edit" size={14} color={COLORS.text} /> Edit
            </div>
          )}
        </div>

        {isOwner && editing && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginTop: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>Edit group</p>
            <ErrorBanner text={formError} />

            <p style={labelStyle}>Group photo</p>
            <div style={{ marginBottom: '12px' }}><ImageUploader value={icon} onChange={setIcon} folder="avatars" max={1} onBusyChange={setUploading} /></div>

            <p style={labelStyle}>Cover photo</p>
            <div style={{ marginBottom: '12px' }}><ImageUploader value={cover} onChange={setCover} folder="covers" max={1} onBusyChange={setUploading} /></div>

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" maxLength={80} style={inputStyle} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this group about?" rows={3} maxLength={500} style={{ ...inputStyle, resize: 'none', marginBottom: '12px' }} />

            <div style={{ display: 'flex', gap: '10px' }}>
              <div onClick={() => { setEditing(false); setFormError(''); fillForm(community) }} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>Cancel</div>
              <div onClick={saving || uploading ? undefined : handleSave} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', background: COLORS.green, fontSize: '12.5px', fontWeight: 700, color: 'white', cursor: 'pointer', opacity: saving || uploading ? 0.6 : 1 }}>
                <Icon name="check" size={14} color="white" /> {saving ? 'Saving...' : uploading ? 'Uploading...' : 'Save'}
              </div>
            </div>
          </div>
        )}

        {community.description && (
          <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.6, margin: '18px 0 20px' }}>{community.description}</p>
        )}

        <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, margin: community.description ? '0 0 10px' : '20px 0 10px' }}>Posts</p>
        {posts.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '28px 16px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <Icon name="comment" size={24} color={COLORS.textMuted} />
            </div>
            No posts in this group yet.
          </div>
        ) : (
          posts.map((post) => {
            const author = post.profiles
            const imgs = post.images || []
            return (
              <div key={post.id} style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div
                  onClick={() => author?.username && navigate(`/u/${author.username}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: author?.username ? 'pointer' : 'default' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {author?.profile_image ? <img src={author.profile_image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={14} color={COLORS.green} />}
                  </div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{author?.full_name || author?.username || 'FarmLite user'}</p>
                </div>
                <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5 }}>{post.content}</p>
                {imgs.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: imgs.length === 1 ? '1fr' : '1fr 1fr', gap: '6px', marginTop: '10px' }}>
                    {imgs.map((url) => (
                      <img key={url} src={url} alt="" loading="lazy" onClick={() => setViewer(url)} style={{ width: '100%', height: imgs.length === 1 ? 'auto' : '110px', maxHeight: '240px', objectFit: 'cover', borderRadius: '10px', cursor: 'pointer' }} />
                    ))}
                  </div>
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

      {viewer && (
        <div onClick={() => setViewer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={viewer} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          <div style={{ position: 'absolute', top: '16px', right: '16px', width: '34px', height: '34px', borderRadius: '17px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={18} color="white" />
          </div>
        </div>
      )}
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
