import type { CSSProperties } from 'react'

export const COLORS = {
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

export const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`,
  marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg,
}

export const labelStyle: CSSProperties = { fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }

export function ErrorBanner({ text }: { text: string }) {
  if (!text) return null
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
      <p style={{ fontSize: '11.5px', color: COLORS.red }}>{text}</p>
    </div>
  )
}

import Icon from './Icons'

// The three company badges, kept visually distinct and never combined into one icon:
// ✓ verified (business info checked), 🔵 premium (blue tick, paid), ⭐ trusted partner (FarmLite-granted).
export function CompanyBadges({ verified, premium, trustedPartner, size = 14 }: { verified?: boolean; premium?: boolean; trustedPartner?: boolean; size?: number }) {
  if (!verified && !premium && !trustedPartner) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {verified && <Icon name="checkCircle" size={size} color="#16A34A" />}
      {premium && <Icon name="checkCircle" size={size} color="#2563EB" />}
      {trustedPartner && <Icon name="star" size={size} color="#F59E0B" />}
    </span>
  )
}

// Small "PRO" badge for a premium user or company. size 'sm' for inline next to a name, 'md' for a profile header.
export function PremiumBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? '15px' : '20px'
  const fs = size === 'sm' ? '9px' : '10.5px'
  const iconSize = size === 'sm' ? 9 : 11
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px', height: h, padding: '0 6px',
        borderRadius: '999px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'white',
        fontSize: fs, fontWeight: 800, letterSpacing: '0.3px', flexShrink: 0,
      }}>
      <Icon name="crown" size={iconSize} color="white" /> PRO
    </span>
  )
}

export const PAGE_SIZE = 12

// "Load more" control for paged lists. Shows nothing once there is nothing left to load.
export function LoadMoreButton({ onClick, loading, hasMore }: { onClick: () => void; loading: boolean; hasMore: boolean }) {
  if (!hasMore) return null
  return (
    <div
      onClick={loading ? undefined : onClick}
      style={{
        textAlign: 'center', padding: '12px', marginTop: '6px', borderRadius: '10px',
        border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.green,
        fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1,
      }}>
      {loading ? 'Loading...' : 'Load more'}
    </div>
  )
}

