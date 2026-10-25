import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icons'
import { COLORS } from './shared'

export { COLORS }

export type UserAdRow = {
  id: string
  ref: string
  target_type: 'listing' | 'post' | 'video' | 'profile'
  listing_id: string | null
  post_id: string | null
  video_id: string | null
  headline: string
  body: string | null
  image_url: string | null
  days: number
  amount: number
  currency: string
  status: 'pending_review' | 'approved' | 'rejected' | 'active' | 'paused' | 'completed' | 'cancelled'
  review_note: string | null
  starts_at: string | null
  ends_at: string | null
  paused_at: string | null
  created_at: string
  placements: string[]
  group_ids: string[]
  audience_roles: string[]
  locations: string[]
  impressions: number
  clicks: number
}

export const TARGET_LABEL: Record<string, string> = {
  listing: 'Marketplace listing',
  post: 'Post',
  video: 'Video',
  profile: 'My profile',
}

// Where a user ad can appear. "Companies page" is for company ads only, so it is not offered here.
export const USER_PLACEMENTS: { key: 'home' | 'marketplace' | 'search' | 'groups'; label: string; help: string }[] = [
  { key: 'home', label: 'Home Feed', help: 'Shown between posts on the Home feed.' },
  { key: 'marketplace', label: 'Marketplace', help: 'Shown among listings in the Marketplace.' },
  { key: 'search', label: 'Search results', help: 'Shown when a search matches your ad.' },
  { key: 'groups', label: 'Groups', help: 'Shown inside the public groups you choose. Priced as an add-on.' },
]

// Only an image stored in Farmxie storage can be used in an ad (the server checks this too).
export const isStorageUrl = (u: string | null | undefined) => !!u && u.startsWith('https://') && u.includes('/storage/v1/object/public/')

export function statusInfo(a: Pick<UserAdRow, 'status' | 'ends_at'>): { label: string; bg: string; color: string } {
  switch (a.status) {
    case 'pending_review': return { label: 'In review', bg: 'var(--fx-tint-amber)', color: 'var(--fx-amber-text)' }
    case 'approved': return { label: 'Approved: pay to start', bg: 'var(--fx-tint-blue)', color: 'var(--fx-blue-text2)' }
    case 'rejected': return { label: 'Rejected', bg: 'var(--fx-tint-red)', color: 'var(--fx-red-text)' }
    case 'cancelled': return { label: 'Cancelled', bg: 'var(--fx-border3)', color: 'var(--fx-muted3)' }
    case 'paused': return { label: 'Paused', bg: 'var(--fx-tint-amber)', color: 'var(--fx-amber-text)' }
    case 'completed': return { label: 'Completed', bg: 'var(--fx-border3)', color: 'var(--fx-muted3)' }
    case 'active':
      return a.ends_at && new Date(a.ends_at).getTime() <= Date.now()
        ? { label: 'Completed', bg: 'var(--fx-border3)', color: 'var(--fx-muted3)' }
        : { label: 'Running', bg: 'var(--fx-tint-green)', color: 'var(--fx-green-dark)' }
  }
}

export function MyAdsHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div onClick={onBack ?? (() => navigate(-1))} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, margin: 0 }}>{title}</p>
    </div>
  )
}

export function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>{children}</div>
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '12px', border: `1px solid ${COLORS.border}` }}>
      {title && <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, margin: '0 0 12px' }}>{title}</p>}
      {children}
    </div>
  )
}

export function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '8px 0', borderTop: '1px solid var(--fx-grey1)', fontSize: strong ? '14px' : '12.5px' }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ color: COLORS.text, fontWeight: strong ? 800 : 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export function Banner({ tone, children }: { tone: 'blue' | 'amber' | 'red' | 'green'; children: ReactNode }) {
  const map = { blue: ['var(--fx-tint-blue)', 'var(--fx-bd-blue)'], amber: ['var(--fx-tint-amber)', 'var(--fx-bd-amber)'], red: ['var(--fx-tint-red)', 'var(--fx-bd-red)'], green: ['var(--fx-tint-green3)', 'var(--fx-bd-green)'] }[tone]
  return <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: map[0], border: `1px solid ${map[1]}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>{children}</div>
}

export const primaryBtn = (disabled = false): CSSProperties => ({
  padding: '11px 20px', borderRadius: '10px', background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '13px',
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, textAlign: 'center',
})
