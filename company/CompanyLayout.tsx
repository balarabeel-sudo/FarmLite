import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { isPremiumActive } from '../premiumShared'
import PremiumTick from '../PremiumTick'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenDeep: '#14532D',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

export type DashCompany = {
  id: string
  name: string
  logo_url: string | null
  status: string
  is_premium: boolean
  premium_until: string | null
  country: string | null
  followers_count: number
  rating: number
  views_count: number
}

export type CompanyCtx = { company: DashCompany; reload: () => Promise<void> }

function useWidth() {
  const [w, setW] = useState(typeof window === 'undefined' ? 1200 : window.innerWidth)
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

// The company's own dashboard. It is a separate space from the personal Account:
// wide, desktop-style layout with its own menu, and a way back to the personal account.
export default function CompanyLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const width = useWidth()
  const desktop = width >= 900

  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<DashCompany | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, logo_url, status, is_premium, premium_until, country, followers_count, rating, views_count')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
    if (error) setLoadError(error.message)
    setCompany(data && data.length ? ((data[0] as any) as DashCompany) : null)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  if (loading) {
    return <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: COLORS.textMuted }}>Loading…</div>
  }

  if (!company) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '28px 22px', maxWidth: 380, textAlign: 'center' }}>
          <Icon name="building" size={30} color={COLORS.green} />
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, margin: '10px 0 6px' }}>No company found</p>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>{loadError ? `Could not load your company: ${loadError}` : 'This account does not own a company yet.'}</p>
          <div onClick={() => navigate('/profile')} style={{ marginTop: '16px', padding: '11px', borderRadius: '10px', background: COLORS.green, color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            Back to Personal Account
          </div>
        </div>
      </div>
    )
  }

  const premium = isPremiumActive(company.is_premium, company.premium_until)
  const path = location.pathname

  const items: { label: string; icon: string; to?: string; active: boolean; soon?: boolean }[] = [
    { label: 'Overview', icon: 'building', to: '/company', active: path === '/company' || path === '/company/' },
    { label: 'Analytics', icon: 'fileText', active: path.startsWith('/company/analytics'), soon: true },
    { label: 'Premium', icon: 'crown', to: '/company/premium', active: path.startsWith('/company/premium') },
    { label: 'Public page', icon: 'users', to: `/companies/${company.id}`, active: false },
  ]

  const sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: COLORS.greenDeep, color: 'white' }}>
      <div style={{ padding: '22px 18px 16px', display: 'flex', alignItems: 'center', gap: '11px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {company.logo_url ? <img src={company.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="building" size={20} color="white" />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <p style={{ fontSize: '13.5px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{company.name}</p>
            {premium && <PremiumTick size={14} />}
          </div>
          <p style={{ fontSize: '10.5px', color: '#BBF7D0', marginTop: '2px' }}>{premium ? 'Company Premium' : 'Company Dashboard'}</p>
        </div>
      </div>

      <div style={{ flex: 1, padding: '8px 10px' }}>
        {items.map((it) => (
          <div
            key={it.label}
            onClick={it.soon || !it.to ? undefined : () => navigate(it.to!)}
            style={{
              display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 12px', borderRadius: '10px', marginBottom: '3px',
              cursor: it.soon ? 'default' : 'pointer', opacity: it.soon ? 0.55 : 1,
              background: it.active ? 'rgba(255,255,255,0.16)' : 'transparent',
            }}>
            <Icon name={it.icon} size={17} color="white" />
            <p style={{ flex: 1, fontSize: '13px', fontWeight: it.active ? 800 : 600 }}>{it.label}</p>
            {it.soon && <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#BBF7D0' }}>SOON</span>}
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 10px 18px', borderTop: '1px solid rgba(255,255,255,0.14)' }}>
        <div
          onClick={() => navigate('/profile')}
          style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 12px', borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.1)' }}>
          <Icon name="user" size={17} color="white" />
          <p style={{ fontSize: '13px', fontWeight: 700 }}>Switch to Personal Account</p>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      {desktop ? (
        <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 250, zIndex: 20 }}>{sidebar}</div>
      ) : (
        <>
          <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: COLORS.greenDeep, color: 'white' }}>
            <div onClick={() => setMenuOpen(true)} style={{ fontSize: '20px', lineHeight: 1, cursor: 'pointer', padding: '2px 4px' }}>☰</div>
            <p style={{ fontSize: '14px', fontWeight: 800, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{company.name}</p>
            {premium && <PremiumTick size={16} />}
          </div>
          {menuOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 270, maxWidth: '82%' }}>{sidebar}</div>
            </div>
          )}
        </>
      )}

      <main style={{ marginLeft: desktop ? 250 : 0, padding: desktop ? '30px 36px 50px' : '16px 14px 40px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Outlet context={{ company, reload: load } as CompanyCtx} />
        </div>
      </main>
    </div>
  )
}
