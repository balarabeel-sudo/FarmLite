import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import ImageUploader from '../ImageUploader'
import { PAGE_SIZE, LoadMoreButton } from '../shared'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

type Community = {
  id: string
  owner_id: string
  name: string
  description: string | null
  cover_url: string | null
  icon_url: string | null
  members_count: number
}

export default function CommunitiesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [communities, setCommunities] = useState<Community[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<string[]>([])
  const [cover, setCover] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const COMMUNITY_COLUMNS = 'id, owner_id, name, description, cover_url, icon_url, members_count'

  const communitiesQuery = (from: number, to: number) => {
    let q = supabase.from('communities').select(COMMUNITY_COLUMNS)
    const term = search.trim().replace(/[%,()*\\]/g, ' ').trim()
    if (term) q = q.ilike('name', `%${term}%`)
    return q.order('members_count', { ascending: false }).range(from, to)
  }

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const [communitiesRes, joinedRes] = await Promise.all([
      communitiesQuery(0, PAGE_SIZE - 1),
      supabase.from('community_members').select('community_id').eq('user_id', user.id),
    ])

    if (communitiesRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    const page = (communitiesRes.data || []) as any as Community[]
    setCommunities(page)
    setHasMore(page.length === PAGE_SIZE)
    setJoinedIds(new Set((joinedRes.data || []).map((r: any) => r.community_id)))
    setLoading(false)
  }

  const loadMore = async () => {
    if (!user || loadingMore) return
    setLoadingMore(true)
    const { data, error } = await communitiesQuery(communities.length, communities.length + PAGE_SIZE - 1)
    if (!error) {
      const more = (data || []) as any as Community[]
      setCommunities((prev) => [...prev, ...more])
      setHasMore(more.length === PAGE_SIZE)
    }
    setLoadingMore(false)
  }

  useEffect(() => { load() }, [user])

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => load(), 300)
    return () => clearTimeout(timer)
  }, [search])

  const resetForm = () => {
    setName('')
    setDescription('')
    setIcon([])
    setCover([])
    setFormError('')
  }

  const handleAdd = async () => {
    if (!user || !name.trim() || uploading) return
    setFormError('')
    setSaving(true)

    const { data, error } = await supabase.from('communities').insert({
      owner_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      icon_url: icon[0] || null,
      cover_url: cover[0] || null,
    }).select('id').single()

    if (error || !data) {
      setSaving(false)
      setFormError(error?.message || 'Could not create the group.')
      return
    }

    // Creator automatically joins their own group, as its admin
    await supabase.from('community_members').insert({ community_id: data.id, user_id: user.id, role: 'admin' })

    setSaving(false)
    resetForm()
    setShowForm(false)
    load()
  }

  const toggleJoin = async (communityId: string) => {
    if (!user) return
    if (joinedIds.has(communityId)) {
      await supabase.from('community_members').delete().eq('user_id', user.id).eq('community_id', communityId)
      setJoinedIds((prev) => { const next = new Set(prev); next.delete(communityId); return next })
      setCommunities((prev) => prev.map((c) => c.id === communityId ? { ...c, members_count: Math.max(c.members_count - 1, 0) } : c))
    } else {
      await supabase.from('community_members').insert({ user_id: user.id, community_id: communityId })
      setJoinedIds((prev) => new Set(prev).add(communityId))
      setCommunities((prev) => prev.map((c) => c.id === communityId ? { ...c, members_count: c.members_count + 1 } : c))
    }
  }

  const filtered = communities

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/')} onAdd={() => setShowForm(!showForm)} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate('/')} onAdd={() => { setShowForm(!showForm); if (showForm) resetForm() }} />

      <div style={{ padding: '16px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups..."
          style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, marginBottom: '16px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.card }}
        />

        {showForm && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>Create a group</p>

            {formError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
                <p style={{ fontSize: '11.5px', color: COLORS.red }}>{formError}</p>
              </div>
            )}

            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Group photo</p>
            <div style={{ marginBottom: '12px' }}>
              <ImageUploader value={icon} onChange={setIcon} folder="avatars" max={1} onBusyChange={setUploading} />
            </div>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Cover photo (optional)</p>
            <div style={{ marginBottom: '12px' }}>
              <ImageUploader value={cover} onChange={setCover} folder="covers" max={1} onBusyChange={setUploading} />
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" maxLength={80} style={inputStyle} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this group about? (optional)" rows={3} style={{ ...inputStyle, resize: 'none', marginBottom: '12px' }} />

            <div onClick={saving ? undefined : handleAdd} style={{ background: COLORS.green, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating...' : uploading ? 'Uploading photo...' : 'Create Group'}
            </div>
          </div>
        )}

        {loading ? (
          <ListCardSkeleton count={4} />
        ) : filtered.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <Icon name="users" size={28} color={COLORS.textMuted} />
            </div>
            {communities.length === 0 ? 'No groups yet. Tap + to start one.' : 'No groups match your search.'}
          </div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} onClick={() => navigate(`/communities/${c.id}`)} style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', gap: '12px', cursor: 'pointer' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {c.icon_url || c.cover_url ? <img src={c.icon_url || c.cover_url || ''} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="users" size={20} color={COLORS.green} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{c.name}</p>
                {c.description && (
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.description}</p>
                )}
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '5px' }}>{c.members_count} members</p>
              </div>
              {c.owner_id !== user?.id && (
                <div
                  onClick={(e) => { e.stopPropagation(); toggleJoin(c.id) }}
                  style={{
                    alignSelf: 'center', padding: '7px 14px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    background: joinedIds.has(c.id) ? COLORS.bg : COLORS.green,
                    color: joinedIds.has(c.id) ? COLORS.textMuted : 'white',
                    border: joinedIds.has(c.id) ? `1px solid ${COLORS.border}` : 'none',
                  }}>
                  {joinedIds.has(c.id) ? 'Joined' : 'Join'}
                </div>
              )}
            </div>
          ))
        )}

        <LoadMoreButton onClick={loadMore} loading={loadingMore} hasMore={hasMore && !loading} />
      </div>
    </div>
  )
}

function Header({ onBack, onAdd }: { onBack: () => void; onAdd: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Groups</p>
      </div>
      <div onClick={onAdd} style={{ width: '36px', height: '36px', borderRadius: '10px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon name="plus" size={18} color="white" />
      </div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`,
  marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg,
}
