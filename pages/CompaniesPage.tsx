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
  orange: '#F59E0B',
  red: '#DC2626',
}

type Company = {
  id: string
  owner_id: string
  name: string
  category: string
  description: string | null
  location: string | null
  logo_url: string | null
  is_verified: boolean
  status: string
  rating: number
  followers_count: number
}

export default function CompaniesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const [companiesRes, followedRes] = await Promise.all([
      supabase.from('companies').select('id, owner_id, name, category, description, location, logo_url, is_verified, status, rating, followers_count').order('followers_count', { ascending: false }),
      supabase.from('company_followers').select('company_id').eq('user_id', user.id),
    ])

    if (companiesRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setCompanies((companiesRes.data || []) as any)
    setFollowedIds(new Set((followedRes.data || []).map((r: any) => r.company_id)))
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const resetForm = () => {
    setName('')
    setCategory('')
    setLocation('')
    setDescription('')
    setFormError('')
  }

  const handleAdd = async () => {
    if (!user || !name.trim() || !category.trim()) return
    setFormError('')
    setSaving(true)

    const { error } = await supabase.from('companies').insert({
      owner_id: user.id,
      name: name.trim(),
      category: category.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      status: 'pending',
    })

    setSaving(false)

    if (error) {
      setFormError(error.message || 'Could not register your company.')
      return
    }

    resetForm()
    setShowForm(false)
    load()
  }

  const toggleFollow = async (companyId: string) => {
    if (!user) return
    if (followedIds.has(companyId)) {
      await supabase.from('company_followers').delete().eq('user_id', user.id).eq('company_id', companyId)
      setFollowedIds((prev) => { const next = new Set(prev); next.delete(companyId); return next })
      setCompanies((prev) => prev.map((c) => c.id === companyId ? { ...c, followers_count: Math.max(c.followers_count - 1, 0) } : c))
    } else {
      await supabase.from('company_followers').insert({ user_id: user.id, company_id: companyId })
      setFollowedIds((prev) => new Set(prev).add(companyId))
      setCompanies((prev) => prev.map((c) => c.id === companyId ? { ...c, followers_count: c.followers_count + 1 } : c))
    }
  }

  const filtered = companies.filter((c) => {
    if (c.status !== 'approved' && c.owner_id !== user?.id) return false
    if (search.trim() && !c.name.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

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
          placeholder="Search companies..."
          style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, marginBottom: '16px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.card }}
        />

        {showForm && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>Register a company</p>

            {formError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
                <p style={{ fontSize: '11.5px', color: COLORS.red }}>{formError}</p>
              </div>
            )}

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" style={inputStyle} />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category, e.g. Seeds, Fertilizer, Equipment" style={inputStyle} />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" style={inputStyle} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} style={{ ...inputStyle, resize: 'none', marginBottom: '8px' }} />
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '12px' }}>New companies are reviewed before they appear publicly.</p>

            <div onClick={saving ? undefined : handleAdd} style={{ background: COLORS.green, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Submitting...' : 'Submit for Review'}
            </div>
          </div>
        )}

        {loading ? (
          <ListCardSkeleton count={4} />
        ) : filtered.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            {companies.length === 0 ? 'No companies registered yet.' : 'No companies match your search.'}
          </div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} onClick={() => navigate(`/companies/${c.id}`)} style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', gap: '12px', cursor: 'pointer' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {c.logo_url ? <img src={c.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="building" size={22} color={COLORS.green} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{c.name}</p>
                  {c.is_verified && <Icon name="checkCircle" size={13} color={COLORS.green} />}
                </div>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>{c.category}{c.location ? ` · ${c.location}` : ''}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                  {c.rating > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: COLORS.orange, fontWeight: 700 }}>
                      <Icon name="star" size={11} color={COLORS.orange} /> {Number(c.rating).toFixed(1)}
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{c.followers_count} followers</span>
                  {c.status === 'pending' && c.owner_id === user?.id && (
                    <span style={{ fontSize: '10px', color: COLORS.orange, fontWeight: 700 }}>Pending review</span>
                  )}
                </div>
              </div>
              {c.owner_id !== user?.id && (
                <div
                  onClick={(e) => { e.stopPropagation(); toggleFollow(c.id) }}
                  style={{
                    alignSelf: 'center', padding: '7px 14px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    background: followedIds.has(c.id) ? COLORS.bg : COLORS.green,
                    color: followedIds.has(c.id) ? COLORS.textMuted : 'white',
                    border: followedIds.has(c.id) ? `1px solid ${COLORS.border}` : 'none',
                  }}>
                  {followedIds.has(c.id) ? 'Following' : 'Follow'}
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
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Companies</p>
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
