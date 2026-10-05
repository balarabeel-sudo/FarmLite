import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ProfileHeaderSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import { COLORS } from '../shared'
import { useLocale } from '../LocaleContext'
import type { Language, Currency } from '../LocaleContext'
import { isPremiumActive, formatDate } from '../premiumShared'
import PremiumTick from '../PremiumTick'
import { AnalyticsIcon } from '../AnalyticsCharts'

type Profile = {
  full_name: string | null
  username: string | null
  profile_image: string | null
  role: string
  location: string | null
  is_verified: boolean
  is_premium: boolean
  premium_until: string | null
  posts_count: number
  farmlite_id: string | null
}

// The private control center for the signed-in user: settings, Premium and the company switch.
// Everything about the person's own farm, marketplace and community lives on My Profile (/my-profile).
export default function AccountPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { language, currency, currencies, setLanguage, setCurrency } = useLocale()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myCompany, setMyCompany] = useState<{ id: string; name: string } | null>(null)

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const [profileRes, companyRes] = await Promise.all([
      supabase.from('profiles').select('full_name, username, profile_image, role, location, is_verified, is_premium, premium_until, posts_count, farmlite_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('companies').select('id, name').eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1),
    ])

    if (profileRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setProfile(profileRes.data as any)
    setMyCompany(companyRes.data && companyRes.data.length ? (companyRes.data[0] as any) : null)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate(-1)} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate(-1)} />

      <div style={{ padding: '16px' }}>
        {loading || !profile ? (
          <ProfileHeaderSkeleton />
        ) : (
          <>
            {/* My Profile: its own page (/my-profile) with everything personal: farm, marketplace, community, FarmBot */}
            <Section title="Profile" first>
              <div
                onClick={() => navigate('/my-profile')}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', cursor: 'pointer' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '20px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {profile.profile_image ? <img src={profile.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={18} color={COLORS.green} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>My Profile</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <p style={{ fontSize: '11px', color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {profile.full_name || profile.username || 'FarmLite user'}
                    </p>
                    {profile.is_verified && <Icon name="checkCircle" size={12} color={COLORS.green} />}
                    {isPremiumActive(profile.is_premium, profile.premium_until) && <PremiumTick size={14} />}
                  </div>
                </div>
                <Icon name="chevronRight" size={15} color={COLORS.textMuted} />
              </div>
            </Section>

            <Section title="Wallet">
              <Row icon="wallet" label="Wallet" onClick={() => navigate('/wallet')} />
            </Section>

            <Section title="FarmBot">
              <Row icon="message" label="FarmBot History" onClick={() => navigate('/farmbot')} />
            </Section>

            <Section title="Insights">
              <div
                onClick={() => navigate('/analytics')}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', cursor: 'pointer' }}>
                <AnalyticsIcon size={17} color={COLORS.textMuted} />
                <p style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: COLORS.text }}>Analytics</p>
                {!isPremiumActive(profile.is_premium, profile.premium_until) && <PremiumTick size={14} />}
                <Icon name="chevronRight" size={15} color={COLORS.textMuted} />
              </div>
            </Section>

            <Section title="Settings">
              <Row icon="bell" label="Notifications" onClick={() => navigate('/notifications')} />
              <Row icon="shield" label="Privacy & Security" comingSoon />
              <SelectRow icon="globe" label="Language" value={language} onChange={(v) => setLanguage(v as Language)}>
                <option value="ha">Hausa</option>
                <option value="en">English</option>
              </SelectRow>
              <SelectRow icon="currency" label="Currency" value={currency} onChange={(v) => setCurrency(v as Currency)}>
                {currencies.map((c: { code: string; flag?: string }) => (
                  <option key={c.code} value={c.code}>{c.flag ? `${c.flag} ` : ''}{c.code}</option>
                ))}
              </SelectRow>
              <Row icon="helpCircle" label="Help & Support" comingSoon />
              <Row icon="logout" label="Log out" onClick={handleSignOut} danger />
            </Section>

            {/* Premium card: tapping opens the Premium flow (benefits first, then price) */}
            {(() => {
              const active = isPremiumActive(profile.is_premium, profile.premium_until)
              return (
                <div style={{ marginTop: '22px', background: 'linear-gradient(135deg, #16A34A, #166534)', borderRadius: '16px', padding: '18px', color: 'white', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: '-24px', top: '-24px', width: '110px', height: '110px', borderRadius: '55px', background: 'rgba(255,255,255,0.1)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '21px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="crown" size={21} color="white" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '15px', fontWeight: 800 }}>{active ? 'Premium Active' : 'FarmLite Premium'}</p>
                      <p style={{ fontSize: '11.5px', color: '#DCFCE7', marginTop: '3px', lineHeight: 1.45 }}>
                        {active
                          ? (profile.premium_until ? `Active until ${formatDate(profile.premium_until)}` : 'Your Premium membership is active.')
                          : 'Unlock more tools, insights and opportunities on FarmLite.'}
                      </p>
                    </div>
                  </div>
                  <div
                    onClick={() => navigate('/premium')}
                    style={{ marginTop: '14px', textAlign: 'center', padding: '11px', borderRadius: '12px', background: 'white', color: '#166534', fontWeight: 800, fontSize: '13.5px', cursor: 'pointer', position: 'relative' }}>
                    {active ? 'Extend Premium' : 'Upgrade to Premium'}
                  </div>
                </div>
              )
            })()}

            {/* Only for people who own a company: a separate dashboard with its own menu */}
            {myCompany && (
              <div
                onClick={() => navigate('/company', { replace: true })}
                style={{ marginTop: '14px', background: COLORS.card, borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: '1px solid #E5EFE5' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="building" size={19} color={COLORS.green} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text }}>Switch to Company Dashboard</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{myCompany.name}</p>
                </div>
                <Icon name="chevronRight" size={15} color={COLORS.textMuted} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children, first }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <div style={{ marginTop: first ? 0 : 20 }}>
      <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>{title}</p>
      <div style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

function Row({ icon, label, onClick, rightText, comingSoon, danger }: {
  icon: string
  label: string
  onClick?: () => void
  rightText?: string
  comingSoon?: boolean
  danger?: boolean
}) {
  const disabled = comingSoon || !onClick
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px',
        borderBottom: `1px solid ${COLORS.bg}`, cursor: disabled ? 'default' : 'pointer',
        opacity: comingSoon ? 0.55 : 1,
      }}>
      <Icon name={icon} size={17} color={danger ? '#DC2626' : COLORS.textMuted} />
      <p style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: danger ? '#DC2626' : COLORS.text }}>{label}</p>
      {comingSoon && <span style={{ fontSize: '10px', fontWeight: 700, color: COLORS.textMuted }}>Coming soon</span>}
      {!comingSoon && rightText && <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{rightText}</span>}
      {!comingSoon && !rightText && onClick && <Icon name="chevronRight" size={15} color={COLORS.textMuted} />}
    </div>
  )
}

function SelectRow({ icon, label, value, onChange, children }: {
  icon: string
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', borderBottom: `1px solid ${COLORS.bg}` }}>
      <Icon name={icon} size={17} color={COLORS.textMuted} />
      <p style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: COLORS.text }}>{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ border: 'none', background: 'transparent', fontSize: '12px', fontWeight: 700, color: COLORS.green, outline: 'none', cursor: 'pointer', textAlign: 'right' }}>
        {children}
      </select>
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Account</p>
    </div>
  )
}
