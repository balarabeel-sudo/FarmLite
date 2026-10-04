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

// The private control center for the signed-in user. The public identity other users
// see lives on the Profile page (/u/username) instead - see [View Profile] below.
export default function AccountPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { language, currency, currencies, setLanguage, setCurrency } = useLocale()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listingsCount, setListingsCount] = useState(0)
  const [groupsCount, setGroupsCount] = useState(0)

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const [profileRes, listingsRes, groupsRes] = await Promise.all([
      supabase.from('profiles').select('full_name, username, profile_image, role, location, is_verified, is_premium, premium_until, posts_count, farmlite_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('seller_id', user.id),
      supabase.from('community_members').select('community_id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])

    if (profileRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setProfile(profileRes.data as any)
    setListingsCount(listingsRes.count || 0)
    setGroupsCount(groupsRes.count || 0)
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

  const showFarmSection = profile?.role === 'farmer' || profile?.role === 'agribusiness'

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate(-1)} />

      <div style={{ padding: '16px' }}>
        {loading || !profile ? (
          <ProfileHeaderSkeleton />
        ) : (
          <>
            {/* Profile: the full profile lives on its own page; it opens when this row is tapped */}
            <Section title="Profile" first>
              <div
                onClick={() => navigate(profile.username ? `/u/${profile.username}` : '/profile/edit')}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderBottom: `1px solid ${COLORS.bg}`, cursor: 'pointer' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '20px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {profile.profile_image ? <img src={profile.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={18} color={COLORS.green} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {profile.full_name || profile.username || 'FarmLite user'}
                    </p>
                    {profile.is_verified && <Icon name="checkCircle" size={13} color={COLORS.green} />}
                  </div>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>View profile</p>
                </div>
                <Icon name="chevronRight" size={15} color={COLORS.textMuted} />
              </div>
              <Row icon="user" label="Edit Profile" onClick={() => navigate('/profile/edit')} />
              {profile.farmlite_id && <Row icon="user" label="FarmLite ID" rightText={profile.farmlite_id} />}
            </Section>

            {/* Account activity */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <Stat label="Posts" value={profile.posts_count || 0} />
              <Stat label="Listings" value={listingsCount} />
              <Stat label="Groups" value={groupsCount} />
            </div>

            <Section title="My Marketplace">
              <Row icon="package" label="My Listings" onClick={() => navigate('/marketplace?mine=1')} />
              <Row icon="bookmark" label="Saved Products" onClick={() => navigate('/saved')} />
              <Row icon="wallet" label="Wallet" onClick={() => navigate('/wallet')} />
              <Row icon="fileText" label="Orders" onClick={() => navigate('/orders')} />
            </Section>

            {showFarmSection && (
              <Section title="My Farm">
                <Row icon="leaf" label="My Crops" onClick={() => navigate('/marketplace?mine=1&category=crop')} />
                <Row icon="leaf" label="Livestock" onClick={() => navigate('/marketplace?mine=1&category=livestock')} />
                <Row icon="tractor" label="Equipment" onClick={() => navigate('/equipment?mine=1')} />
              </Section>
            )}

            <Section title="Community">
              <Row icon="users" label="My Groups" onClick={() => navigate('/communities')} />
              <Row icon="bookmark" label="Saved Posts" onClick={() => navigate('/saved')} />
            </Section>

            <Section title="FarmBot">
              <Row icon="message" label="FarmBot History" onClick={() => navigate('/farmbot')} />
            </Section>

            <Section title="Settings">
              <Row icon="bell" label="Notifications" onClick={() => navigate('/notifications')} />
              <Row
                icon="crown"
                label="FarmLite Premium"
                rightText={profile.is_premium ? (profile.premium_until ? `Active · ${new Date(profile.premium_until).toLocaleDateString()}` : 'Active') : 'Not active'}
                onClick={() => {}}
              />
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, background: COLORS.card, borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '2px' }}>{label}</p>
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
