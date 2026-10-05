import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ProfileHeaderSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import { COLORS } from '../shared'
import { isPremiumActive } from '../premiumShared'
import PremiumTick from '../PremiumTick'

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

// The person's own profile hub. The Account page keeps Wallet, FarmBot, settings, Premium and the company switch.
export default function MyProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

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
            {/* Summary */}
            <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '30px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {profile.profile_image ? <img src={profile.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={26} color={COLORS.green} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {profile.full_name || profile.username || 'FarmLite user'}
                    </p>
                    {profile.is_verified && <Icon name="checkCircle" size={15} color={COLORS.green} />}
                    {isPremiumActive(profile.is_premium, profile.premium_until) && <PremiumTick size={17} />}
                  </div>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '3px', textTransform: 'capitalize' }}>
                    {profile.role}{profile.location ? ` · ${profile.location}` : ''}
                  </p>
                  {profile.farmlite_id && <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '2px' }}>{profile.farmlite_id}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <div
                  onClick={() => navigate(profile.username ? `/u/${profile.username}` : '/profile/edit')}
                  style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: COLORS.green, color: 'white', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
                  View Profile
                </div>
                <div
                  onClick={() => navigate('/profile/edit')}
                  style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: '#DCFCE7', color: '#166534', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
                  Edit Profile
                </div>
              </div>
            </div>

            {/* Activity */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <Stat label="Posts" value={profile.posts_count || 0} />
              <Stat label="Listings" value={listingsCount} />
              <Stat label="Groups" value={groupsCount} />
            </div>

            <Section title="My Marketplace">
              <Row icon="package" label="My Listings" onClick={() => navigate('/marketplace?mine=1')} />
              <Row icon="bookmark" label="Saved Products" onClick={() => navigate('/saved')} />
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

          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>{title}</p>
      <div style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

function Row({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', borderBottom: `1px solid ${COLORS.bg}`, cursor: 'pointer' }}>
      <Icon name={icon} size={17} color={COLORS.textMuted} />
      <p style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: COLORS.text }}>{label}</p>
      <Icon name="chevronRight" size={15} color={COLORS.textMuted} />
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
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>My Profile</p>
    </div>
  )
}
