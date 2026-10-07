import { useId } from 'react'
import type { CSSProperties } from 'react'
import { isPremiumActive } from './premiumShared'

// Facebook-style blue verification tick: a scalloped blue seal with a white check.
// Same API as before (size), so every existing <PremiumTick size={17} /> keeps working.
// Only render it when isPremiumActive(...) is true - the backend premium_until date is the source of truth.
const SEAL_PATH =
  'M12.00 1.40 L12.55 1.48 L13.08 1.70 L13.58 2.04 L14.03 2.43 L14.46 2.83 L14.86 3.19 L15.27 3.47 L15.72 3.65 L16.20 3.75 L16.75 3.78 L17.33 3.80 L17.93 3.84 L18.52 3.95 L19.05 4.17 L19.50 4.50 L19.83 4.95 L20.05 5.48 L20.16 6.07 L20.20 6.67 L20.22 7.25 L20.25 7.80 L20.35 8.28 L20.53 8.73 L20.81 9.14 L21.17 9.54 L21.57 9.97 L21.96 10.42 L22.30 10.92 L22.52 11.45 L22.60 12.00 L22.52 12.55 L22.30 13.08 L21.96 13.58 L21.57 14.03 L21.17 14.46 L20.81 14.86 L20.53 15.27 L20.35 15.72 L20.25 16.20 L20.22 16.75 L20.20 17.33 L20.16 17.93 L20.05 18.52 L19.83 19.05 L19.50 19.50 L19.05 19.83 L18.52 20.05 L17.93 20.16 L17.33 20.20 L16.75 20.22 L16.20 20.25 L15.72 20.35 L15.27 20.53 L14.86 20.81 L14.46 21.17 L14.03 21.57 L13.58 21.96 L13.08 22.30 L12.55 22.52 L12.00 22.60 L11.45 22.52 L10.92 22.30 L10.42 21.96 L9.97 21.57 L9.54 21.17 L9.14 20.81 L8.73 20.53 L8.28 20.35 L7.80 20.25 L7.25 20.22 L6.67 20.20 L6.07 20.16 L5.48 20.05 L4.95 19.83 L4.50 19.50 L4.17 19.05 L3.95 18.52 L3.84 17.93 L3.80 17.33 L3.78 16.75 L3.75 16.20 L3.65 15.72 L3.47 15.27 L3.19 14.86 L2.83 14.46 L2.43 14.03 L2.04 13.58 L1.70 13.08 L1.48 12.55 L1.40 12.00 L1.48 11.45 L1.70 10.92 L2.04 10.42 L2.43 9.97 L2.83 9.54 L3.19 9.14 L3.47 8.73 L3.65 8.28 L3.75 7.80 L3.78 7.25 L3.80 6.67 L3.84 6.07 L3.95 5.48 L4.17 4.95 L4.50 4.50 L4.95 4.17 L5.48 3.95 L6.07 3.84 L6.67 3.80 L7.25 3.78 L7.80 3.75 L8.28 3.65 L8.73 3.47 L9.14 3.19 L9.54 2.83 L9.97 2.43 L10.42 2.04 L10.92 1.70 L11.45 1.48Z'

// The blue tick shown next to the name of a Premium user or company.
export default function PremiumTick({ size = 16, label = 'Premium', style }: { size?: number; label?: string; style?: CSSProperties }) {
  const gradId = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}>
      <title>{label}</title>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38A3FF" />
          <stop offset="1" stopColor="#1877F2" />
        </linearGradient>
      </defs>
      <path d={SEAL_PATH} fill={`url(#${gradId})`} />
      <path d="M7.4 12.4l3.1 3.1 6.1-6.5" fill="none" stroke="#FFFFFF" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
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
