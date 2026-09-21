import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useLocale } from '../LocaleContext'
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
}

const ROLE_LABELS: Record<string, string> = { farmer: 'Farmer', buyer: 'Buyer', agribusiness: 'Agribusiness' }

type ProfileResult = { user_id: string; full_name: string | null; username: string | null; profile_image: string | null; role: string | null }
type CompanyResult = { id: string; name: string; category: string; logo_url: string | null }
type ListingResult = { id: string; title: string; price: number; currency: string; unit: string | null; images: string[] | null }

export default function SearchPage() {
  const navigate = useNavigate()
  const { formatPrice } = useLocale()

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [netError, setNetError] = useState(false)
  const [searched, setSearched] = useState(false)
  const [profiles, setProfiles] = useState<ProfileResult[]>([])
  const [companies, setCompanies] = useState<CompanyResult[]>([])
  const [listings, setListings] = useState<ListingResult[]>([])

  // Ignores results of older searches that finish after a newer one.
  const tokenRef = useRef(0)

  const clearResults = () => {
    setProfiles([])
    setCompanies([])
    setListings([])
    setSearched(false)
    setNetError(false)
    setLoading(false)
  }

  const runSearch = async (term: string) => {
    const token = ++tokenRef.current
    // Commas and brackets would break the filter syntax below.
    const safe = term.replace(/[%,()*\\]/g, ' ').trim()
    if (!safe) {
      clearResults()
      return
    }

    setLoading(true)
    setSearched(true)
    setNetError(false)

    try {
      const [profilesRes, companiesRes, listingsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, username, profile_image, role').or(`full_name.ilike.%${safe}%,username.ilike.%${safe}%`).limit(8),
        supabase.from('companies').select('id, name, category, logo_url').eq('status', 'approved').ilike('name', `%${safe}%`).limit(8),
        supabase.from('marketplace_listings').select('id, title, price, currency, unit, images').eq('status', 'available').ilike('title', `%${safe}%`).limit(8),
      ])

      if (token !== tokenRef.current) return

      if (profilesRes.error || companiesRes.error || listingsRes.error) {
        setNetError(true)
        setLoading(false)
        return
      }

      setProfiles((profilesRes.data || []) as any)
      setCompanies((companiesRes.data || []) as any)
      setListings((listingsRes.data || []) as any)
    } catch {
      if (token !== tokenRef.current) return
      setNetError(true)
    }
    setLoading(false)
  }

  // Waits until the user pauses typing before searching.
  useEffect(() => {
    const term = query.trim()
    if (!term) {
      tokenRef.current++
      clearResults()
      return
    }
    setLoading(true)
    setSearched(true)
    const timer = setTimeout(() => runSearch(term), 300)
    return () => clearTimeout(timer)
  }, [query])

  const noResults = searched && !loading && !netError && profiles.length === 0 && companies.length === 0 && listings.length === 0

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            <Icon name="search" size={15} color={COLORS.textMuted} />
          </div>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, companies, products..."
            style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg }}
          />
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {netError && <NetworkError onRetry={() => runSearch(query.trim())} title="Search failed." />}

        {loading && !netError && <ListCardSkeleton count={3} />}

        {noResults && (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <Icon name="search" size={26} color={COLORS.textMuted} />
            </div>
            No results for "{query}".
          </div>
        )}

        {!loading && !netError && profiles.length > 0 && (
          <>
            <SectionLabel text="People" />
            {profiles.map((p) => (
              <div
                key={p.user_id}
                onClick={() => p.username && navigate(`/u/${p.username}`)}
                style={{ ...rowStyle, cursor: p.username ? 'pointer' : 'default' }}>
                <Avatar url={p.profile_image} icon="user" round />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={rowTitle}>{p.full_name || p.username || 'FarmLite user'}</p>
                  {p.username && (
                    <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                      @{p.username}{p.role && ROLE_LABELS[p.role] ? ` · ${ROLE_LABELS[p.role]}` : ''}
                    </p>
                  )}
                </div>
                {p.username && <Icon name="chevronRight" size={16} color={COLORS.textMuted} />}
              </div>
            ))}
          </>
        )}

        {!loading && !netError && companies.length > 0 && (
          <>
            <SectionLabel text="Companies" />
            {companies.map((c) => (
              <div key={c.id} onClick={() => navigate(`/companies/${c.id}`)} style={{ ...rowStyle, cursor: 'pointer' }}>
                <Avatar url={c.logo_url} icon="building" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={rowTitle}>{c.name}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{c.category}</p>
                </div>
                <Icon name="chevronRight" size={16} color={COLORS.textMuted} />
              </div>
            ))}
          </>
        )}

        {!loading && !netError && listings.length > 0 && (
          <>
            <SectionLabel text="Products" />
            {listings.map((l) => (
              <div key={l.id} onClick={() => navigate(`/marketplace?listing=${l.id}`)} style={{ ...rowStyle, cursor: 'pointer' }}>
                <Avatar url={l.images?.[0] || null} icon="leaf" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={rowTitle}>{l.title}</p>
                  <p style={{ fontSize: '11px', color: COLORS.green, fontWeight: 700 }}>{formatPrice(Number(l.price))}{l.unit ? `/${l.unit}` : ''}</p>
                </div>
                <Icon name="chevronRight" size={16} color={COLORS.textMuted} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ text }: { text: string }) {
  return <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '14px 0 8px' }}>{text}</p>
}

function Avatar({ url, icon, round = false }: { url: string | null; icon: string; round?: boolean }) {
  return (
    <div style={{ width: '40px', height: '40px', borderRadius: round ? '20px' : '10px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {url ? <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={icon} size={17} color={COLORS.green} />}
    </div>
  )
}

const rowStyle: React.CSSProperties = {
  background: COLORS.card, borderRadius: '12px', padding: '10px 12px', marginBottom: '8px',
  display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
}

const rowTitle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: COLORS.text }
