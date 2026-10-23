import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import { PAGE_SIZE, LoadMoreButton, CompanyBadges } from '../shared'
import SponsoredCard from '../SponsoredCard'
import type { AdData } from '../SponsoredCard'

const COLORS = {
  bg: 'var(--fx-bg)',
  card: 'var(--fx-card)',
  border: 'var(--fx-border)',
  green: '#16A34A',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
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
  products: string[] | null
  services: string[] | null
}

const CATEGORIES = [
  'Crop Production', 'Livestock', 'Fisheries', 'Farm Equipment', 'Agro-Chemicals', 'Seeds & Inputs',
  'Agricultural Trading', 'Agricultural Services', 'Processing', 'Agricultural Supply', 'Agricultural Technology', 'Other',
]
const FEATURED_COUNT = 10

// Every premium company gets its turn: the list is shuffled on each visit, so no company is always first.
function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const tagsOf = (c: Company) => [...(c.products || []), ...(c.services || [])].filter(Boolean).slice(0, 4)

const COMPANY_COLUMNS =
  'id, owner_id, name, category, description, location, logo_url, is_premium, trusted_partner, status, rating, followers_count, products, services'

export default function CompaniesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [featured, setFeatured] = useState<Company[]>([])
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [ads, setAds] = useState<AdData[]>([])

  const companiesQuery = (from: number, to: number) => {
    let q = supabase.from('companies').select(COMPANY_COLUMNS)
    q = user ? q.or(`status.eq.verified,owner_id.eq.${user.id}`) : q.eq('status', 'verified')
    const term = search.trim().replace(/[%,()*\\]/g, ' ').trim()
    if (term) q = q.ilike('name', `%${term}%`)
    if (category) q = q.eq('category', category)
    return q.order('is_premium', { ascending: false }).order('followers_count', { ascending: false }).range(from, to)
  }

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const [companiesRes, featuredRes, adsRes] = await Promise.all([
      companiesQuery(0, PAGE_SIZE - 1),
      // Premium companies shown at the top; fetched in a wide window and shuffled so each one gets a fair turn.
      (() => {
        let q = supabase.from('companies').select(COMPANY_COLUMNS).eq('status', 'verified').eq('is_premium', true)
        if (category) q = q.eq('category', category)
        return q.limit(60)
      })(),
      // Company ads for this page (labelled "Sponsored"); they follow the search text.
      supabase.rpc('ads_for_slot', { p_slot: 'companies', p_limit: 2, p_query: search.trim() || null, p_category: null }),
    ])

    if (companiesRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    const page = (companiesRes.data || []) as any as Company[]
    setCompanies(page)
    setHasMore(page.length === PAGE_SIZE)
    setFeatured(shuffle((featuredRes.data || []) as any as Company[]).slice(0, FEATURED_COUNT))
    setAds((adsRes.data || []) as any as AdData[])
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

  useEffect(() => { load() }, [user, category])

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => load(), 300)
    return () => clearTimeout(timer)
  }, [search])

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
          style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.card }}
        />

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '2px' }}>
          {['', ...CATEGORIES].map((c) => {
            const on = category === c
            return (
              <div key={c || 'all'} onClick={() => setCategory(c)} style={{
                flexShrink: 0, padding: '8px 16px', borderRadius: '20px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                background: on ? COLORS.green : 'var(--fx-tint-green)', color: on ? 'white' : COLORS.text,
              }}>{c || 'All'}</div>
            )
          })}
        </div>

        {!loading && !search.trim() && featured.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Featured companies</p>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
              {featured.map((c) => (
                <div key={c.id} onClick={() => navigate(`/companies/${c.id}`)} style={{ flexShrink: 0, width: '150px', height: '150px', boxSizing: 'border-box', background: COLORS.card, borderRadius: '14px', padding: '14px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <Logo company={c} size={56} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '10px', maxWidth: '100%' }}>
                    <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                    <CompanyBadges verified={c.status === 'verified'} premium={c.is_premium} trustedPartner={c.trusted_partner} size={12} />
                  </div>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{c.category}</p>
                  {c.location && <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{c.location}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <ListCardSkeleton count={4} />
        ) : companies.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <Icon name="building" size={28} color={COLORS.textMuted} />
            </div>
            {search.trim() || category ? 'No companies match your search.' : 'No companies registered yet. Tap + to register the first one.'}
          </div>
        ) : (
          companies.map((c, idx) => {
            const tags = tagsOf(c)
            const own = c.status !== 'verified' && c.owner_id === user?.id
            return (
              <Fragment key={c.id}>
                {(idx === 1 || idx === 6) && ads[idx === 1 ? 0 : 1] && (
                  <div style={{ marginBottom: '10px' }}><SponsoredCard ad={ads[idx === 1 ? 0 : 1]} layout="wide" placement="companies" /></div>
                )}
                {/* Every card has the same height, whatever the company has filled in */}
                <div onClick={() => navigate(`/companies/${c.id}`)} style={{ height: '148px', boxSizing: 'border-box', background: COLORS.card, borderRadius: '14px', padding: '12px', marginBottom: '10px', display: 'flex', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', overflow: 'hidden' }}>
                  <Logo company={c} size={64} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                      <CompanyBadges verified={c.status === 'verified'} premium={c.is_premium} trustedPartner={c.trusted_partner} size={14} />
                    </div>
                    <p style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.green, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.category}</p>
                    {own ? (
                      <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.orange, marginTop: '4px' }}>
                        {c.status === 'pending' && 'Verification pending'}
                        {c.status === 'needs_review' && 'Needs more information'}
                        {c.status === 'rejected' && 'Rejected'}
                        {c.status === 'suspended' && 'Suspended'}
                      </p>
                    ) : (
                      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '4px', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description || ''}</p>
                    )}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', overflow: 'hidden', height: '20px', flexShrink: 0 }}>
                      {tags.map((t) => (
                        <span key={t} style={{ flexShrink: 0, maxWidth: '110px', padding: '3px 9px', borderRadius: '10px', fontSize: '10.5px', background: 'var(--fx-tint-green)', color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <p style={{ fontSize: '10.5px', color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: '3px', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.location && <><Icon name="mapPin" size={10} color={COLORS.green} /> {c.location}</>}
                      </p>
                      <span style={{ flexShrink: 0, padding: '6px 18px', borderRadius: '10px', background: COLORS.green, color: 'white', fontSize: '12px', fontWeight: 700 }}>View</span>
                    </div>
                  </div>
                </div>
              </Fragment>
            )
          })
        )}

        <LoadMoreButton onClick={loadMore} loading={loadingMore} hasMore={hasMore && !loading} />
      </div>
    </div>
  )
}

function Logo({ company, size }: { company: Company; size: number }) {
  return (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', flexShrink: 0, background: 'var(--fx-tint-green)', border: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {company.logo_url ? <img src={company.logo_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="building" size={Math.round(size * 0.42)} color={COLORS.green} />}
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
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Company Pages</p>
      </div>
      <div onClick={onAdd} style={{ width: '36px', height: '36px', borderRadius: '10px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon name="plus" size={18} color="white" />
      </div>
    </div>
  )
}
