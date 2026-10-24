import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import { PAGE_SIZE, LoadMoreButton } from '../shared'
import PremiumTick from '../PremiumTick'
import { isPremiumActive } from '../premiumShared'
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
  premium_until: string | null
  is_featured: boolean | null
  products: string[] | null
  services: string[] | null
}

const CATEGORIES = [
  'Crop Production', 'Livestock', 'Fisheries', 'Farm Equipment', 'Agro-Chemicals', 'Seeds & Inputs',
  'Agricultural Trading', 'Agricultural Services', 'Processing', 'Agricultural Supply', 'Agricultural Technology', 'Other',
]
const FEATURED_MAX = 60 // how many featured companies are fetched in total
const FEATURED_PREVIEW = 3 // how many show before the person taps View all

// Featured companies take turns: the list is shuffled on each visit, so no company is always first.
function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const COMPANY_COLUMNS =
  'id, owner_id, name, category, description, location, logo_url, is_premium, trusted_partner, status, rating, followers_count, premium_until, is_featured, products, services'

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
  const [showAllFeatured, setShowAllFeatured] = useState(false)

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
      // Featured = a verified Premium company that chose to be featured (Company dashboard -> Featured Visibility).
      // Fetched in a wide window and shuffled so each one gets a fair turn.
      (() => {
        let q = supabase.from('companies').select(COMPANY_COLUMNS).eq('status', 'verified').eq('is_premium', true).eq('is_featured', true)
        if (category) q = q.eq('category', category)
        return q.limit(FEATURED_MAX)
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
    setFeatured(shuffle(((featuredRes.data || []) as any as Company[]).filter((c) => isPremiumActive(c.is_premium, c.premium_until))).slice(0, FEATURED_MAX))
    setShowAllFeatured(false)
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

  const filtering = !!category || !!search.trim()
  const shownFeatured = showAllFeatured ? featured : featured.slice(0, FEATURED_PREVIEW)

  return (
    <div className="fx-companies" style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      {/* Browsers give every <p> a big default margin; here each text sets its own spacing, so it is switched off */}
      <style>{'.fx-companies p { margin: 0; }'}</style>
      <Header onBack={() => navigate('/')} onAdd={() => navigate('/companies/new')} />

      <div style={{ padding: '14px' }}>
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <div style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
            <Icon name="search" size={18} color={COLORS.textMuted} />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            style={{ width: '100%', padding: '11px 14px 11px 40px', borderRadius: '14px', border: `1px solid ${COLORS.border}`, fontSize: '13px', boxSizing: 'border-box', background: COLORS.card, color: COLORS.text, outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '2px' }}>
          {['', ...CATEGORIES].map((c) => {
            const on = category === c
            return (
              <div key={c || 'all'} onClick={() => setCategory(c)} style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                background: on ? COLORS.green : 'var(--fx-tint-green)', color: on ? 'white' : COLORS.text,
              }}>{c || 'All'}</div>
            )
          })}
        </div>

        {!loading && !search.trim() && featured.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <SectionTitle
              title="Featured companies"
              action={featured.length > FEATURED_PREVIEW ? (showAllFeatured ? 'Show less' : 'View all') : undefined}
              onAction={() => setShowAllFeatured((v) => !v)}
              expanded={showAllFeatured}
            />
            {shownFeatured.map((c) => (
              <CompanyCard key={c.id} company={c} featured onOpen={() => navigate(`/companies/${c.id}`)} />
            ))}
          </div>
        )}

        {!loading && companies.length > 0 && (
          <SectionTitle
            title="All companies"
            action={filtering ? 'View all' : undefined}
            onAction={() => { setSearch(''); setCategory('') }}
          />
        )}

        {loading ? (
          <ListCardSkeleton count={4} />
        ) : companies.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <Icon name="building" size={28} color={COLORS.textMuted} />
            </div>
            {filtering ? 'No companies match your search.' : 'No companies registered yet. Tap + to register the first one.'}
          </div>
        ) : (
          companies.map((c, idx) => (
            <Fragment key={c.id}>
              {(idx === 1 || idx === 6) && ads[idx === 1 ? 0 : 1] && (
                <div style={{ marginBottom: '12px' }}><SponsoredCard ad={ads[idx === 1 ? 0 : 1]} layout="wide" placement="companies" /></div>
              )}
              <CompanyCard company={c} own={c.status !== 'verified' && c.owner_id === user?.id} onOpen={() => navigate(`/companies/${c.id}`)} />
            </Fragment>
          ))
        )}

        <LoadMoreButton onClick={loadMore} loading={loadingMore} hasMore={hasMore && !loading} />
      </div>
    </div>
  )
}

// One card for both lists. Every card has the same height, whatever the company has filled in.
function CompanyCard({ company: c, featured, own, onOpen }: { company: Company; featured?: boolean; own?: boolean; onOpen: () => void }) {
  const premium = isPremiumActive(c.is_premium, c.premium_until)
  const trending = !!featured && premium
  return (
    <div
      onClick={onOpen}
      style={{
        minHeight: '128px', boxSizing: 'border-box', background: COLORS.card, borderRadius: '16px', padding: '12px', marginBottom: '10px',
        display: 'flex', gap: '12px', cursor: 'pointer', overflow: 'hidden',
        border: `1px solid ${trending ? 'var(--fx-bd-green)' : COLORS.border}`,
        boxShadow: trending ? '0 4px 14px rgba(22,163,74,0.10)' : '0 2px 8px rgba(0,0,0,0.04)',
      }}>
      <Logo company={c} size={60} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{c.name}</p>
          {premium && <PremiumTick size={16} />}
          {trending && <TrendingBadge />}
        </div>
        <p style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.green, marginTop: '1px', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.category}</p>
        {own ? (
          <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.orange, marginTop: '5px', flexShrink: 0 }}>
            {c.status === 'pending' && 'Verification pending'}
            {c.status === 'needs_review' && 'Needs more information'}
            {c.status === 'rejected' && 'Rejected'}
            {c.status === 'suspended' && 'Suspended'}
          </p>
        ) : (
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '4px', lineHeight: '16px', minHeight: '32px', flexShrink: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description || ''}</p>
        )}
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <p style={{ fontSize: '11px', color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.location && <><Icon name="mapPin" size={12} color={COLORS.green} /> {c.location}</>}
          </p>
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 11px', borderRadius: '10px', background: COLORS.green, color: 'white', fontSize: '11.5px', fontWeight: 700 }}>
            View Company <Icon name="arrowRight" size={12} color="white" />
          </span>
        </div>
      </div>
    </div>
  )
}

// Small flame pill: this company is featured (and Premium), so it is shown first.
function TrendingBadge() {
  return (
    <span title="Trending" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 7px 2px 5px', borderRadius: '10px', background: 'rgba(245,158,11,0.15)', color: '#D97706', fontSize: '10px', fontWeight: 800 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2c.6 3.2-1.2 4.8-2.8 6.6C7.6 10.4 6 12.2 6 15a6 6 0 0 0 12 0c0-2.6-1.3-4.3-2.6-5.6-.4 1.3-1 2.1-1.9 2.6.5-3.3-.2-7.3-1.5-10Z" fill="#F59E0B" />
        <path d="M12 21a3 3 0 0 1-3-3c0-1.7 1.3-2.6 2-3.8.3.9 1 1.3 1.6 1.9.8.7 1.4 1.1 1.4 1.9a3 3 0 0 1-2 2.9Z" fill="#FDE68A" />
      </svg>
      Trending
    </span>
  )
}

function SectionTitle({ title, action, onAction, expanded }: { title: string; action?: string; onAction?: () => void; expanded?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{title}</p>
      {action && (
        <div onClick={onAction} style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer', color: COLORS.green, fontSize: '12.5px', fontWeight: 700 }}>
          {action}
          <span style={{ display: 'flex', transform: expanded ? 'rotate(-90deg)' : 'none' }}><Icon name="chevronRight" size={16} color={COLORS.green} /></span>
        </div>
      )}
    </div>
  )
}

function Logo({ company, size }: { company: Company; size: number }) {
  return (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '16px', flexShrink: 0, background: 'var(--fx-tint-green)', border: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {company.logo_url ? <img src={company.logo_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="building" size={Math.round(size * 0.42)} color={COLORS.green} />}
    </div>
  )
}

function Header({ onBack, onAdd }: { onBack: () => void; onAdd: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, margin: 0 }}>Company Pages</p>
      </div>
      <div onClick={onAdd} style={{ width: '38px', height: '38px', borderRadius: '12px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 3px 10px rgba(22,163,74,0.35)' }}>
        <Icon name="plus" size={19} color="white" />
      </div>
    </div>
  )
}
