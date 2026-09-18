import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)
    const [communitiesRes, joinedRes] = await Promise.all([
      supabase.from('communities').select('id, owner_id, name, description, cover_url, members_count').order('members_count', { ascending: false }),
      supabase.from('community_members').select('community_id').eq('user_id', user.id),
    ])

    if (communitiesRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setCommunities((communitiesRes.data || []) as any)
    setJoinedIds(new Set((joinedRes.data || []).map((r: any) => r.community_id)))
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const resetForm = () => {
    setName('')
    setDescription('')
    setFormError('')
  }

  const handleAdd = async () => {
    if (!user || !name.trim()) return
    setFormError('')
    setSaving(true)

    const { data, error } = await supabase.from('communities').insert({
      owner_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
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

  const filtered = communities.filter((c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase()))

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

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" style={inputStyle} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this group about? (optional)" rows={3} style={{ ...inputStyle, resize: 'none', marginBottom: '12px' }} />

            <div onClick={saving ? undefined : handleAdd} style={{ background: COLORS.green, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating...' : 'Create Group'}
            </div>
          </div>
        )}

        {loading ? (
          <ListCardSkeleton count={4} />
        ) : filtered.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            {communities.length === 0 ? 'No groups yet. Tap + to start one.' : 'No groups match your search.'}
          </div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {c.cover_url ? <img src={c.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="users" size={20} color={COLORS.green} />}
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
                  onClick={() => toggleJoin(c.id)}
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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`,
  marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg,
}
