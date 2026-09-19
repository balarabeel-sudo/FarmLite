import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useLocale } from '../LocaleContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

type ProfileResult = { user_id: string; full_name: string | null; username: string | null; profile_image: string | null }
type CompanyResult = { id: string; name: string; category: string; logo_url: string | null }
type ListingResult = { id: string; title: string; price: number; currency: string; unit: string | null }

export default function SearchPage() {
  const navigate = useNavigate()
  const { formatPrice } = useLocale()

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [profiles, setProfiles] = useState<ProfileResult[]>([])
  const [companies, setCompanies] = useState<CompanyResult[]>([])
  const [listings, setListings] = useState<ListingResult[]>([])

  const runSearch = async (q: string) => {
    const term = q.trim()
    if (!term) {
      setProfiles([])
      setCompanies([])
      setListings([])
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)

    const [profilesRes, companiesRes, listingsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, username, profile_image').or(`full_name.ilike.%${term}%,username.ilike.%${term}%`).limit(8),
      supabase.from('companies').select('id, name, category, logo_url').eq('status', 'approved').ilike('name', `%${term}%`).limit(8),
      supabase.from('marketplace_listings').select('id, title, price, currency, unit').eq('status', 'available').ilike('title', `%${term}%`).limit(8),
    ])

    setProfiles((profilesRes.data || []) as any)
    setCompanies((companiesRes.data || []) as any)
    setListings((listingsRes.data || []) as any)
    setLoading(false)
  }

  const handleChange = (value: string) => {
    setQuery(value)
    runSearch(value)
  }

  const noResults = searched && !loading && profiles.length === 0 && companies.length === 0 && listings.length === 0

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
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search people, companies, products..."
            style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg }}
          />
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {loading && <ListCardSkeleton count={3} />}

        {noResults && (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            No results for "{query}".
          </div>
        )}

        {!loading && profiles.length > 0 && (
          <>
            <SectionLabel text="People" />
            {profiles.map((p) => (
              <div key={p.user_id} style={rowStyle}>
                <Avatar url={p.profile_image} icon="user" />
                <p style={rowTitle}>{p.full_name || p.username || 'FarmLite user'}</p>
              </div>
            ))}
          </>
        )}

        {!loading && companies.length > 0 && (
          <>
            <SectionLabel text="Companies" />
            {companies.map((c) => (
              <div key={c.id} onClick={() => navigate(`/companies/${c.id}`)} style={{ ...rowStyle, cursor: 'pointer' }}>
                <Avatar url={c.logo_url} icon="building" />
                <div>
                  <p style={rowTitle}>{c.name}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{c.category}</p>
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && listings.length > 0 && (
          <>
            <SectionLabel text="Products" />
            {listings.map((l) => (
              <div key={l.id} onClick={() => navigate('/marketplace')} style={{ ...rowStyle, cursor: 'pointer' }}>
                <Avatar url={null} icon="leaf" />
                <div>
                  <p style={rowTitle}>{l.title}</p>
                  <p style={{ fontSize: '11px', color: COLORS.green, fontWeight: 700 }}>{formatPrice(Number(l.price))}{l.unit ? `/${l.unit}` : ''}</p>
                </div>
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

function Avatar({ url, icon }: { url: string | null; icon: string }) {
  return (
    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={icon} size={17} color={COLORS.green} />}
    </div>
  )
}

const rowStyle: React.CSSProperties = {
  background: COLORS.card, borderRadius: '12px', padding: '10px 12px', marginBottom: '8px',
  display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
}

const rowTitle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: COLORS.text }
