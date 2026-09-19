import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  orange: '#F59E0B',
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

type Listing = {
  id: string
  title: string
  price: number
  currency: string
  unit: string | null
  images: string[] | null
}

export default function CompanyDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { formatPrice } = useLocale()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [company, setCompany] = useState<Company | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [following, setFollowing] = useState(false)

  const load = async () => {
    if (!id || !user) return
    setNetError(false)
    setLoading(true)

    const [companyRes, listingsRes, followRes] = await Promise.all([
      supabase.from('companies').select('id, owner_id, name, category, description, location, logo_url, is_verified, status, rating, followers_count').eq('id', id).maybeSingle(),
      supabase.from('marketplace_listings').select('id, title, price, currency, unit, images').eq('company_id', id).eq('status', 'available'),
      supabase.from('company_followers').select('company_id').eq('user_id', user.id).eq('company_id', id).maybeSingle(),
    ])

    if (companyRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setCompany(companyRes.data as any)
    setListings((listingsRes.data || []) as any)
    setFollowing(!!followRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id, user])

  const toggleFollow = async () => {
    if (!user || !company) return
    if (following) {
      await supabase.from('company_followers').delete().eq('user_id', user.id).eq('company_id', company.id)
      setFollowing(false)
      setCompany((prev) => prev ? { ...prev, followers_count: Math.max(prev.followers_count - 1, 0) } : prev)
    } else {
      await supabase.from('company_followers').insert({ user_id: user.id, company_id: company.id })
      setFollowing(true)
      setCompany((prev) => prev ? { ...prev, followers_count: prev.followers_count + 1 } : prev)
    }
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate(-1)} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: '16px' }}><ListCardSkeleton count={4} /></div>
      </div>
    )
  }

  if (!company) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate(-1)} />
        <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORS.textMuted, fontSize: '13px' }}>Company not found.</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate(-1)} />

      <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, padding: '24px 16px', color: 'white' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {company.logo_url ? <img src={company.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="building" size={28} color="white" />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <p style={{ fontSize: '17px', fontWeight: 800 }}>{company.name}</p>
              {company.is_verified && <Icon name="checkCircle" size={15} color="white" />}
            </div>
            <p style={{ fontSize: '12px', color: '#DCFCE7', marginTop: '2px' }}>{company.category}</p>
            {company.location && (
              <p style={{ fontSize: '11.5px', color: '#DCFCE7', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="mapPin" size={11} color="#DCFCE7" /> {company.location}
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <Stat label="Followers" value={company.followers_count} />
          <Stat label="Rating" value={company.rating > 0 ? Number(company.rating).toFixed(1) : '—'} />
          <Stat label="Listings" value={listings.length} />
        </div>

        {company.owner_id !== user?.id && (
          <div
            onClick={toggleFollow}
            style={{
              textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginBottom: '18px',
              background: following ? COLORS.card : COLORS.green,
              color: following ? COLORS.textMuted : 'white',
              border: following ? `1px solid ${COLORS.border}` : 'none',
            }}>
            {following ? 'Following' : 'Follow'}
          </div>
        )}

        {company.description && (
          <>
            <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, marginBottom: '6px' }}>About</p>
            <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.6, marginBottom: '20px' }}>{company.description}</p>
          </>
        )}

        <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Listings</p>
        {listings.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '28px 16px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '12.5px' }}>
            No listings from this company yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {listings.map((l) => (
              <div key={l.id} onClick={() => navigate('/marketplace')} style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
                <div style={{ width: '100%', height: '80px', background: '#E5EFE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {l.images?.[0] ? <img src={l.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={22} color={COLORS.green} />}
                </div>
                <div style={{ padding: '9px' }}>
                  <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
                  <p style={{ fontSize: '12px', fontWeight: 800, color: COLORS.green, marginTop: '3px' }}>{formatPrice(Number(l.price))}{l.unit ? `/${l.unit}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ flex: 1, background: COLORS.card, borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '2px' }}>{label}</p>
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Company</p>
    </div>
  )
}
