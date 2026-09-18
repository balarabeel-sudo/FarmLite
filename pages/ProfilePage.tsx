import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ProfileHeaderSkeleton, FeedPostSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

type Profile = {
  full_name: string | null
  username: string | null
  profile_image: string | null
  cover_image: string | null
  bio: string | null
  location: string | null
  role: string
  is_verified: boolean
  followers_count: number
  following_count: number
  posts_count: number
}

type Post = {
  id: string
  content: string
  images: string[] | null
  likes_count: number
  comments_count: number
  created_at: string
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const [profileRes, postsRes] = await Promise.all([
      supabase.from('profiles').select('full_name, username, profile_image, cover_image, bio, location, role, is_verified, followers_count, following_count, posts_count').eq('user_id', user.id).maybeSingle(),
      supabase.from('posts').select('id, content, images, likes_count, comments_count, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])

    if (profileRes.error || postsRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    const p = profileRes.data as any
    setProfile(p)
    setFullName(p?.full_name || '')
    setBio(p?.bio || '')
    setLocation(p?.location || '')
    setPosts((postsRes.data || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(),
      bio: bio.trim() || null,
      location: location.trim() || null,
    }).eq('user_id', user.id)
    setSaving(false)

    if (!error) {
      setEditing(false)
      load()
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/')} onSignOut={handleSignOut} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate('/')} onSignOut={handleSignOut} />

      <div style={{ padding: '16px' }}>
        {loading ? (
          <ProfileHeaderSkeleton />
        ) : (
          <>
            <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, borderRadius: '16px', height: '110px', position: 'relative' }}>
              {profile?.cover_image && <img src={profile.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} />}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginTop: '-32px', paddingLeft: '4px' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '36px', border: `3px solid ${COLORS.bg}`, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {profile?.profile_image ? <img src={profile.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={30} color={COLORS.green} />}
              </div>
              <div style={{ flex: 1, paddingBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{profile?.full_name || profile?.username || 'FarmLite user'}</p>
                  {profile?.is_verified && <Icon name="checkCircle" size={14} color={COLORS.green} />}
                </div>
                {profile?.username && <p style={{ fontSize: '12px', color: COLORS.textMuted }}>@{profile.username}</p>}
              </div>
            </div>

            {profile?.location && (
              <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="mapPin" size={12} color={COLORS.textMuted} /> {profile.location}
              </p>
            )}
            {profile?.bio && <p style={{ fontSize: '13px', color: COLORS.text, marginTop: '8px', lineHeight: 1.5 }}>{profile.bio}</p>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <Stat label="Posts" value={profile?.posts_count || 0} />
              <Stat label="Followers" value={profile?.followers_count || 0} />
              <Stat label="Following" value={profile?.following_count || 0} />
            </div>

            {!editing ? (
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <div onClick={() => setEditing(true)} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.text, cursor: 'pointer', background: COLORS.card }}>
                  Edit Profile
                </div>
                <div onClick={handleSignOut} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.red, cursor: 'pointer', background: COLORS.card }}>
                  Sign Out
                </div>
              </div>
            ) : (
              <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginTop: '16px' }}>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" style={inputStyle} />
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" style={inputStyle} />
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" rows={3} style={{ ...inputStyle, resize: 'none', marginBottom: '12px' }} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div onClick={() => setEditing(false)} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>
                    Cancel
                  </div>
                  <div onClick={saving ? undefined : handleSave} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: COLORS.green, fontSize: '12.5px', fontWeight: 700, color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving...' : 'Save'}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginTop: '24px', marginBottom: '12px' }}>Your Posts</p>

        {loading ? (
          <FeedPostSkeleton count={2} />
        ) : posts.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '28px 16px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '12.5px' }}>
            You haven't posted anything yet.
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5 }}>{post.content}</p>
              {post.images?.[0] && <img src={post.images[0]} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', marginTop: '10px' }} />}
              <div style={{ display: 'flex', gap: '16px', marginTop: '10px', paddingTop: '8px', borderTop: `1px solid ${COLORS.border}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: COLORS.textMuted }}>
                  <Icon name="heart" size={13} color={COLORS.textMuted} /> {post.likes_count}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: COLORS.textMuted }}>
                  <Icon name="comment" size={13} color={COLORS.textMuted} /> {post.comments_count}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, background: COLORS.card, borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '2px' }}>{label}</p>
    </div>
  )
}

function Header({ onBack, onSignOut }: { onBack: () => void; onSignOut: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Profile</p>
      </div>
      <div onClick={onSignOut} style={{ cursor: 'pointer' }}>
        <Icon name="logout" size={19} color={COLORS.textMuted} />
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`,
  marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg,
}
