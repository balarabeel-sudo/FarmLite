import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import ImageUploader from '../ImageUploader'
import { validatePhone, cleanPhone } from '../phoneUtils'
import { PAGE_SIZE, LoadMoreButton } from '../shared'

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
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState<string[]>([])
  const [cover, setCover] = useState<string[]>([])
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [website, setWebsite] = useState('')
  const [uploading, setUploading] = useState(false)

  const COMPANY_COLUMNS = 'id, owner_id, name, category, description, location, logo_url, is_verified, status, rating, followers_count'

  const companiesQuery = (from: number, to: number) => {
    let q = supabase.from('companies').select(COMPANY_COLUMNS)
    q = user ? q.or(`status.eq.approved,owner_id.eq.${user.id}`) : q.eq('status', 'approved')
    const term = search.trim().replace(/[%,()*\\]/g, ' ').trim()
    if (term) q = q.ilike('name', `%${term}%`)
    return q.order('followers_count', { ascending: false }).range(from, to)
  }

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const [companiesRes, followedRes] = await Promise.all([
      companiesQuery(0, PAGE_SIZE - 1),
      supabase.from('company_followers').select('company_id').eq('user_id', user.id),
    ])

    if (companiesRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    const page = (companiesRes.data || []) as any as Company[]
    setCompanies(page)
    setHasMore(page.length === PAGE_SIZE)
    setFollowedIds(new Set((followedRes.data || []).map((r: any) => r.company_id)))
    setLoading(false)
  }

  const loadMore = async () => {
    if (!user || loadingMore) return
    setLoadingMore(true)
    const { data, error } = await companiesQuery(companies.length, companies.length + PAGE_SIZE - 1)
    if (!error) {
      const more = (data || []) as any as Company[]
      setCompanies((prev) => [...prev, ...more])
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
    setCategory('')
    setLocation('')
    setDescription('')
    setLogo([])
    setCover([])
    setPhone('')
    setWhatsapp('')
    setWebsite('')
    setFormError('')
  }

  const handleAdd = async () => {
    if (!user || uploading) return
    setFormError('')
    if (!name.trim() || !category.trim()) return setFormError('Enter the company name and category.')
    const phoneErr = validatePhone(phone) || validatePhone(whatsapp)
    if (phoneErr) return setFormError(phoneErr)
    let site = website.trim()
    if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`
    setSaving(true)

    const { error } = await supabase.from('companies').insert({
      owner_id: user.id,
      name: name.trim(),
      category: category.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      logo_url: logo[0] || null,
      cover_url: cover[0] || null,
      phone: cleanPhone(phone) || null,
      whatsapp: cleanPhone(whatsapp) || null,
      website: site || null,
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

  const filtered = companies

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

            <p style={labelStyle}>Company logo</p>
            <div style={{ marginBottom: '12px' }}><ImageUploader value={logo} onChange={setLogo} folder="companies" max={1} onBusyChange={setUploading} /></div>
            <p style={labelStyle}>Cover photo</p>
            <div style={{ marginBottom: '12px' }}><ImageUploader value={cover} onChange={setCover} folder="companies" max={1} onBusyChange={setUploading} /></div>

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" maxLength={100} style={inputStyle} />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category, e.g. Seeds, Fertilizer, Equipment" style={inputStyle} />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" style={inputStyle} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone, e.g. +2348012345678" inputMode="tel" style={inputStyle} />
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp, e.g. +2348012345678" inputMode="tel" style={inputStyle} />
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website (optional)" inputMode="url" style={inputStyle} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} maxLength={1000} style={{ ...inputStyle, resize: 'none', marginBottom: '8px' }} />
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '12px' }}>New companies are reviewed before they appear publicly.</p>

            <div onClick={saving || uploading ? undefined : handleAdd} style={{ background: COLORS.green, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving || uploading ? 0.6 : 1 }}>
              {saving ? 'Submitting...' : uploading ? 'Uploading photo...' : 'Submit for Review'}
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
                {c.logo_url ? <img src={c.logo_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="building" size={22} color={COLORS.green} />}
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
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Companies</p>
      </div>
      <div onClick={onAdd} style={{ width: '36px', height: '36px', borderRadius: '10px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon name="plus" size={18} color="white" />
      </div>
    </div>
  )
}

const labelStyle: CSSProperties = { fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }

const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`,
  marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg,
}
