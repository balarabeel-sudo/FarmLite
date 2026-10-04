import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import { isPremiumActive, formatDate } from '../premiumShared'
import { NameWithTick } from '../PremiumTick'
import type { CompanyCtx } from './CompanyLayout'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
  needs_review: 'Needs review',
}

export default function CompanyHomePage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const [listings, setListings] = useState<number | null>(null)

  useEffect(() => {
    supabase
      .from('marketplace_listings')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .then(({ count }) => setListings(count || 0))
  }, [company.id])

  const premium = isPremiumActive(company.is_premium, company.premium_until)

  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Company Dashboard</p>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: COLORS.text, margin: '4px 0 10px' }}>
        <NameWithTick name={company.name} isPremium={company.is_premium} premiumUntil={company.premium_until} size={22} />
      </h1>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '22px' }}>
        <Chip label={STATUS_LABEL[company.status] || company.status} tone={company.status === 'verified' ? 'good' : 'neutral'} />
        {premium && <Chip label="Premium" tone="premium" />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '22px' }}>
        <Stat label="Followers" value={company.followers_count} />
        <Stat label="Rating" value={company.rating > 0 ? Number(company.rating).toFixed(1) : '—'} />
        <Stat label="Listings" value={listings ?? '…'} />
        <Stat label="Profile views" value={company.views_count} />
      </div>

      {/* Premium status */}
      {premium ? (
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '22px', background: COLORS.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="crown" size={22} color={COLORS.green} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14.5px', fontWeight: 800, color: COLORS.text }}>Premium Active</p>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '3px' }}>
              {company.premium_until ? `Active until ${formatDate(company.premium_until)}` : 'Your company Premium is active.'}
            </p>
          </div>
          <div onClick={() => navigate('/company/premium')} style={{ padding: '9px 14px', borderRadius: '10px', background: COLORS.green, color: 'white', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>Extend</div>
        </div>
      ) : (
        <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, borderRadius: '16px', padding: '20px', color: 'white', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '23px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="crown" size={22} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: '15.5px', fontWeight: 800 }}>FarmLite Company Premium</p>
            <p style={{ fontSize: '12.5px', color: '#DCFCE7', marginTop: '3px', lineHeight: 1.5 }}>Grow your company presence, visibility and insights on FarmLite.</p>
          </div>
          <div onClick={() => navigate('/company/premium')} style={{ padding: '11px 18px', borderRadius: '12px', background: 'white', color: COLORS.greenDark, fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
            Upgrade to Premium
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: '24px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '3px' }}>{label}</p>
    </div>
  )
}

function Chip({ label, tone }: { label: string; tone: 'good' | 'premium' | 'neutral' }) {
  const bg = tone === 'good' ? COLORS.greenSoft : tone === 'premium' ? '#FEF3C7' : '#EEF2EE'
  const color = tone === 'good' ? COLORS.greenDark : tone === 'premium' ? '#92400E' : COLORS.textMuted
  return <span style={{ fontSize: '11px', fontWeight: 800, color, background: bg, borderRadius: '10px', padding: '4px 10px' }}>{label}</span>
}
