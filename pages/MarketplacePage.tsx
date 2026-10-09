import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { GridCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import MarketplaceInbox from '../MarketplaceInbox'
import { CATEGORIES as CATEGORY_LIST, priceText } from '../listingConfig'
import { PAGE_SIZE, LoadMoreButton } from '../shared'
import PremiumTick from '../PremiumTick'
import SponsoredCard from '../SponsoredCard'
import type { AdData } from '../SponsoredCard'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  orange: '#F59E0B',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

type Category = 'crop' | 'livestock' | 'seed' | 'equipment' | 'products' | 'services' | 'other'
type Status = 'available' | 'sold' | 'inactive'

type Listing = {
  id: string
  seller_id: string
  category: Category
  title: string
  description: string | null
  price: number
  currency: string
  unit: string | null
  quantity: number | null
  location: string | null
  negotiable: boolean
  contact_for_price: boolean
  images: string[] | null
  status: Status
  is_hidden_by_admin: boolean
}

type CategoryFilter = 'all' | Category

type FeaturedCompany = {
  id: string
  name: string
  logo_url: string | null
  category: string | null
}

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...CATEGORY_LIST.map((c) => ({ value: c.key as CategoryFilter, label: c.short })),
]

const LISTING_COLUMNS =
  'id, seller_id, category, title, description, price, currency, unit, quantity, location, negotiable, contact_for_price, images, status, is_hidden_by_admin'

export default function MarketplacePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [listings, setListings] = useState<Listing[]>([])
  const [featured, setFeatured] = useState<Listing[]>([])
  const [ads, setAds] = useState<AdData[]>([])
  const [featuredCompanies, setFeaturedCompanies] = useState<FeaturedCompany[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [unread, setUnread] = useState(0)
  const [inbox, setInbox] = useState<{ listing?: string | null; buyer?: string | null } | null>(null)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CategoryFilter>((searchParams.get('category') as CategoryFilter) || 'all')
  const [mineOnly, setMineOnly] = useState(searchParams.get('mine') === '1')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Builds the listings query for the current search/category filters.
  const listingsQuery = (from: number, to: number) => {
    let q = supabase.from('marketplace_listings').select(LISTING_COLUMNS)
    if (mineOnly) {
      q = q.eq('seller_id', user!.id)
    } else {
      q = user ? q.or(`status.eq.available,seller_id.eq.${user.id}`) : q.eq('status', 'available')
      q = q.eq('is_hidden_by_admin', false)
    }
    if (filter !== 'all') q = q.eq('category', filter)
    const term = search.trim().replace(/[%,()*\\]/g, ' ').trim()
    if (term) q = q.ilike('title', `%${term}%`)
    return q.order('created_at', { ascending: false }).range(from, to)
  }

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    // Featured (Company Premium) shows only on the normal browse view, not while searching or viewing "my listings".
    const showFeatured = !mineOnly && !search.trim()
    const [listingsRes, savedRes, featuredRes, featuredCompaniesRes, adsRes] = await Promise.all([
      listingsQuery(0, PAGE_SIZE - 1),
      supabase.from('saved_items').select('listing_id').eq('user_id', user.id).not('listing_id', 'is', null),
      showFeatured
        ? supabase.rpc('featured_listings', { p_category: filter === 'all' ? null : filter, p_limit: 6 })
        : Promise.resolve({ data: [] as any[] }),
      showFeatured && filter === 'all'
        ? supabase.rpc('featured_companies', { p_limit: 8 })
        : Promise.resolve({ data: [] as any[] }),
      showFeatured
        ? supabase.rpc('ads_for_slot', { p_slot: 'marketplace', p_limit: 2 })
        : Promise.resolve({ data: [] as any[] }),
    ])

    if (listingsRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    const page = (listingsRes.data || []) as any as Listing[]
    setListings(page)
    setHasMore(page.length === PAGE_SIZE)
    setSavedIds(new Set((savedRes.data || []).map((r: any) => r.listing_id)))
    setFeatured((featuredRes.data || []) as any as Listing[])
    setFeaturedCompanies((featuredCompaniesRes.data || []) as any as FeaturedCompany[])
    setAds((adsRes.data || []) as any as AdData[])
    setLoading(false)
  }

  const loadMore = async () => {
    if (!user || loadingMore) return
    setLoadingMore(true)
    const { data, error } = await listingsQuery(listings.length, listings.length + PAGE_SIZE - 1)
    if (!error) {
      const more = (data || []) as any as Listing[]
      setListings((prev) => [...prev, ...more])
      setHasMore(more.length === PAGE_SIZE)
    }
    setLoadingMore(false)
  }

  useEffect(() => { load() }, [user, filter, mineOnly])

  // Waits until the user pauses typing before searching again.
  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => load(), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Opens a listing directly when arriving from the Home page (/marketplace?listing=<id>)
  useEffect(() => {
    const id = searchParams.get('listing')
    if (!id) return
    navigate(`/listing/${id}`, { replace: true })
  }, [])

  // Marketplace messages: unread marker + opening a conversation from a notification
  // (/marketplace?inbox=<listing>&buyer=<id>)
  const loadUnread = async () => {
    const { data } = await supabase.rpc('marketplace_unread')
    if (typeof data === 'number') setUnread(data)
  }
  useEffect(() => {
    if (!user) return
    loadUnread()
    const t = setInterval(loadUnread, 30000)
    return () => clearInterval(t)
  }, [user])
  useEffect(() => {
    const ib = searchParams.get('inbox')
    if (!ib) return
    setInbox({ listing: ib === '1' ? null : ib, buyer: searchParams.get('buyer') })
    setSearchParams({}, { replace: true })
  }, [])

  const toggleSave = async (listingId: string) => {
    if (!user) return
    if (savedIds.has(listingId)) {
      await supabase.from('saved_items').delete().eq('user_id', user.id).eq('listing_id', listingId)
      setSavedIds((prev) => { const next = new Set(prev); next.delete(listingId); return next })
    } else {
      await supabase.from('saved_items').insert({ user_id: user.id, listing_id: listingId })
      setSavedIds((prev) => new Set(prev).add(listingId))
    }
  }

  const filtered = listings

  const onHeaderAdd = () => navigate('/sell')

  const featuredIds = new Set(featured.map((f) => f.id))

  const card = (l: Listing) => (
              <div key={l.id} onClick={() => navigate(`/listing/${l.id}`)} style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
                <div style={{ width: '100%', height: '100px', background: '#E5EFE5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {l.images?.[0] ? <img src={l.images[0]} alt={l.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={26} color={COLORS.green} />}

                  <div
                    onClick={(e) => { e.stopPropagation(); toggleSave(l.id) }}
                    style={{ position: 'absolute', top: '6px', right: '6px', width: '26px', height: '26px', borderRadius: '13px', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Icon name="bookmark" size={13} color={savedIds.has(l.id) ? COLORS.orange : COLORS.textMuted} />
                  </div>

                  {(l.images?.length || 0) > 1 && (
                    <div style={{ position: 'absolute', left: '6px', bottom: '6px', display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px' }}>
                      <Icon name="image" size={10} color="white" /> {l.images?.length}
                    </div>
                  )}

                  {featuredIds.has(l.id) && l.status === 'available' && (
                    <div style={{ position: 'absolute', left: '6px', top: '6px', background: COLORS.orange, color: 'white', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px' }}>
                      ★ Featured
                    </div>
                  )}

                  {l.status !== 'available' && (
                    <div style={{ position: 'absolute', left: '6px', top: '6px', background: l.status === 'sold' ? COLORS.red : COLORS.textMuted, color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>
                      {l.status === 'sold' ? 'Sold' : 'Hidden'}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
                  <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.green, marginTop: '4px' }}>{priceText(l)}</p>
                  {l.location && (
                    <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Icon name="mapPin" size={10} color={COLORS.textMuted} /> {l.location}
                    </p>
                  )}
                  {l.seller_id === user?.id && (
                    <p style={{ fontSize: '10px', color: COLORS.orange, marginTop: '4px', fontWeight: 700 }}>Your listing{l.is_hidden_by_admin ? ' · Hidden by Farmxie' : ''}</p>
                  )}
                </div>
              </div>
  )

  // Paid ads (always labelled "Sponsored") sit inside the grid after the 3rd and 9th listing.
  const withAds = (items: Listing[]) => {
    const out: any[] = []
    items.forEach((l, i) => {
      out.push(card(l))
      if (i === 2 && ads[0]) out.push(<SponsoredCard key={`ad-${ads[0].id}`} ad={ads[0]} layout="grid" />)
      if (i === 8 && ads[1]) out.push(<SponsoredCard key={`ad-${ads[1].id}`} ad={ads[1]} layout="grid" />)
    })
    return out
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/')} onAdd={onHeaderAdd} unread={unread} onInbox={() => setInbox({})} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate('/')} onAdd={onHeaderAdd} unread={unread} onInbox={() => setInbox({})} />

      <div style={{ padding: '16px' }}>
        {mineOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#DCFCE7', borderRadius: '10px', padding: '9px 12px', marginBottom: '12px' }}>
            <p style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: COLORS.greenDark }}>Showing your listings</p>
            <span onClick={() => setMineOnly(false)} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.greenDark, cursor: 'pointer' }}>Show all</span>
          </div>
        )}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            <Icon name="search" size={16} color={COLORS.textMuted} />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search crops, livestock, seeds..."
            style={{ width: '100%', padding: '11px 14px 11px 36px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, fontSize: '13px', boxSizing: 'border-box', background: COLORS.card }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' }}>
          {CATEGORIES.map((c) => (
            <div
              key={c.value}
              onClick={() => setFilter(c.value)}
              style={{
                whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                background: filter === c.value ? COLORS.green : COLORS.card,
                color: filter === c.value ? 'white' : COLORS.textMuted,
                border: `1px solid ${filter === c.value ? COLORS.green : COLORS.border}`,
              }}>
              {c.label}
            </div>
          ))}
        </div>

        {!loading && (featuredCompanies.length > 0 || featured.length > 0) && (
          <div style={{ marginBottom: '16px' }}>
            {featuredCompanies.length > 0 && (
              <>
                <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, marginBottom: '8px' }}>Featured companies</p>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
                  {featuredCompanies.map((c) => (
                    <div key={c.id} onClick={() => navigate(`/companies/${c.id}`)} style={{ minWidth: '132px', width: '132px', flexShrink: 0, background: COLORS.card, borderRadius: '14px', padding: '12px 10px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#DCFCE7', margin: '0 auto', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {c.logo_url ? <img src={c.logo_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="building" size={20} color={COLORS.green} />}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '8px' }}>
                        <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                        <PremiumTick size={13} />
                      </div>
                      {c.category && <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.category}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
            {featured.length > 0 && (
              <>
                <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, marginBottom: '8px' }}>Featured listings</p>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {featured.map((l) => (
                    <div key={`f-${l.id}`} style={{ width: '158px', flexShrink: 0 }}>{card(l)}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {loading ? (
          <GridCardSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <Icon name="package" size={28} color={COLORS.textMuted} />
            </div>
            {listings.length === 0 ? 'No listings yet. Tap + to add the first one.' : 'No listings match your search or filter.'}
            {!mineOnly && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${COLORS.bg}` }}>
                <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>Can't find what you need?</p>
                <p style={{ fontSize: '12px', marginTop: '4px', lineHeight: 1.5 }}>Let Farmxie find it for you through Farm Desk.</p>
                <div
                  onClick={() => navigate(`/farm-desk/new${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`)}
                  style={{ display: 'inline-block', marginTop: '12px', background: COLORS.green, color: 'white', borderRadius: '12px', padding: '11px 20px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
                  Ask Farmxie to Find It
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {withAds(filtered)}
          </div>
        )}

        <LoadMoreButton onClick={loadMore} loading={loadingMore} hasMore={hasMore && !loading} />

        {/* Farm Desk entry point under the results */}
        {!mineOnly && !loading && !netError && filtered.length > 0 && (
          <div
            onClick={() => navigate(`/farm-desk/new${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`)}
            style={{ marginTop: '14px', background: COLORS.card, borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>Can't find what you're looking for?</p>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '3px' }}>Request it through Farm Desk.</p>
            </div>
            <Icon name="chevronRight" size={18} color={COLORS.green} />
          </div>
        )}
      </div>

      {inbox && (
        <MarketplaceInbox
          onClose={() => { setInbox(null); loadUnread() }}
          openListing={inbox.listing}
          openBuyer={inbox.buyer}
          onChanged={loadUnread}
        />
      )}
    </div>
  )
}

function Header({ onBack, onAdd, unread, onInbox }: { onBack: () => void; onAdd: () => void; unread: number; onInbox: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Marketplace</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Marketplace messages: the unread marker lives here, not in the DM inbox */}
        <div onClick={onInbox} style={{ position: 'relative', width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="message" size={18} color={COLORS.greenDark} />
          {unread > 0 && (
            <span style={{ position: 'absolute', top: '-5px', right: '-5px', minWidth: '17px', height: '17px', borderRadius: '9px', background: COLORS.red, color: 'white', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unread > 9 ? '9+' : unread}</span>
          )}
        </div>
        <div onClick={onAdd} style={{ width: '36px', height: '36px', borderRadius: '10px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="plus" size={18} color="white" />
        </div>
      </div>
    </div>
  )
}
