import type { CSSProperties } from 'react'
import { isPremiumActive } from './premiumShared'

const TICK_BLUE = '#1D9BF0'

// The blue tick shown next to the name of a Premium user or company.
export default function PremiumTick({ size = 16, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Premium"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}>
      <title>Premium</title>
      <rect x="3" y="3" width="18" height="18" rx="5.5" fill={TICK_BLUE} />
      <rect x="3" y="3" width="18" height="18" rx="5.5" fill={TICK_BLUE} transform="rotate(45 12 12)" />
      <path d="M7.6 12.4l3 3 5.8-6.4" fill="none" stroke="#FFFFFF" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Use anywhere a person's or company's name is shown:
//   <NameWithTick name={p.full_name} isPremium={p.is_premium} premiumUntil={p.premium_until} />
// The tick only appears while Premium is really active (based on the expiry date).
export function NameWithTick({
  name,
  isPremium,
  premiumUntil,
  size = 15,
  style,
}: {
  name: string
  isPremium?: boolean | null
  premiumUntil?: string | null
  size?: number
  style?: CSSProperties
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0, ...style }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {isPremiumActive(isPremium, premiumUntil) && <PremiumTick size={size} />}
    </span>
  )
}
