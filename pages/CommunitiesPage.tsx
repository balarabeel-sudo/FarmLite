import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import { PAGE_SIZE, LoadMoreButton, CompanyBadges } from '../shared'

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
  is_premium: boolean
  trusted_partner: boolean
  status: string
  rating: number
  followers_count: number
}

const COMPANY_COLUMNS =
  'id, owner_id, name, category, description, location, logo_url, is_premium, trusted_partner, status, rating, followers_count'

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

  const companiesQuery = (from: number, to: number) => {
    let q = supabase.from('companies').select(COMPANY_COLUMNS)
    q = user ? q.or(`status.eq.verified,owner_id.eq.${user.id}`) : q.eq('status', 'verified')
    const term = search.trim().replace(/[%,()*\\]/g, ' ').trim()
    if (term) q = q.ilike('name', `%${term}%`)
    return q.order('is_premium', { ascending: false }).order('followers_count', { ascending: false }).range(from, to)
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

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/')} onAdd={() => navigate('/companies/new')} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate('/')} onAdd={() => navigate('/companies/new')} />

      <div style={{ padding: '16px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies..."
          style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, marginBottom: '16px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.card }}
        />

        {loading ? (
          <ListCardSkeleton count={4} />
        ) : companies.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <Icon name="building" size={28} color={COLORS.textMuted} />
            </div>
            {search.trim() ? 'No companies match your search.' : 'No companies registered yet. Tap + to register the first one.'}
          </div>
        ) : (
          companies.map((c) => (
            <div key={c.id} onClick={() => navigate(`/companies/${c.id}`)} style={{ background: COLORS.card, borderRadius: '14px', padding: '12px', marginBottom: '10px', display: 'flex', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '12px', flexShrink: 0, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {c.logo_url ? <img src={c.logo_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="building" size={24} color={COLORS.green} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                  <CompanyBadges verified={c.status === 'verified'} premium={c.is_premium} trustedPartner={c.trusted_partner} size={13} />
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>{c.category}</p>
                {c.location && (
                  <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Icon name="mapPin" size={10} color={COLORS.textMuted} /> {c.location}
                  </p>
                )}
                {c.status !== 'verified' && c.owner_id === user?.id && (
                  <p style={{ fontSize: '10px', fontWeight: 700, color: COLORS.orange, marginTop: '3px' }}>
                    {c.status === 'pending' && 'Verification pending'}
                    {c.status === 'needs_review' && 'Needs more information'}
                    {c.status === 'rejected' && 'Rejected'}
                  </p>
                )}
              </div>
              <div onClick={(e) => { e.stopPropagation(); toggleFollow(c.id) }} style={{ cursor: 'pointer', display: 'flex', alignSelf: 'flex-start' }}>
                <Icon name="bookmark" size={16} color={followedIds.has(c.id) ? COLORS.orange : COLORS.textMuted} />
              </div>
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
