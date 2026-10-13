import { useNavigate } from 'react-router-dom'

const COLORS = { green: '#16A34A', greenDark: '#166534', border: '#E5EFE5', text: '#1A2E1A', textMuted: '#5B6B5B', card: '#FFFFFF' }

const TABS: { key: string; label: string; to: string }[] = [
  { key: 'overview', label: 'Overview', to: '/company/ads' },
  { key: 'create', label: 'Create Ad', to: '/company/ads/new' },
  { key: 'campaigns', label: 'Campaigns', to: '/company/ads/campaigns' },
  { key: 'performance', label: 'Performance', to: '/company/ads/performance' },
  { key: 'billing', label: 'Billing History', to: '/company/ads/billing' },
]

// The Ads section header + tab bar, shown at the top of every Ads page inside the company dashboard.
export default function AdsTabs({ active }: { active: 'overview' | 'create' | 'campaigns' | 'performance' | 'billing' | 'detail' }) {
  const navigate = useNavigate()
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Business tools</p>
      <h1 style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text, marginTop: 2 }}>Farmxie Ads</h1>
      <div style={{ display: 'flex', gap: 4, marginTop: 12, overflowX: 'auto', borderBottom: `1px solid ${COLORS.border}`, WebkitOverflowScrolling: 'touch' }}>
        {TABS.map((t) => {
          const on = t.key === active || (active === 'detail' && t.key === 'campaigns')
          return (
            <div
              key={t.key}
              role="button"
              onClick={() => navigate(t.to)}
              style={{
                padding: '10px 14px', fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer',
                color: on ? COLORS.greenDark : COLORS.textMuted,
                borderBottom: `3px solid ${on ? COLORS.green : 'transparent'}`, marginBottom: -1,
              }}>
              {t.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
