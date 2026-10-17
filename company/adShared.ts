// Shared helpers for the company Ads pages.

export type AdStatus = 'pending_review' | 'approved' | 'rejected' | 'active' | 'paused' | 'completed' | 'cancelled'
export type Placement = 'home' | 'marketplace' | 'companies' | 'search' | 'groups'

export type AdRow = {
  id: string
  ref?: string
  target_type: 'listing' | 'company'
  listing_id: string | null
  headline: string
  body: string | null
  image_url: string | null
  days: number
  amount: number
  currency: string
  status: AdStatus
  review_note: string | null
  starts_at: string | null
  ends_at: string | null
  paused_at?: string | null
  created_at: string
  placements: Placement[]
  group_ids?: string[]
  audience_roles?: string[]
  locations?: string[]
  impressions?: number
  clicks?: number
}

export type DisplayStatus = { key: string; label: string; bg: string; color: string }

// "active" in the database becomes "Running" or "Ended" depending on the end date.
export function displayStatus(a: Pick<AdRow, 'status' | 'ends_at'>): DisplayStatus {
  switch (a.status) {
    case 'pending_review': return { key: 'review', label: 'In review', bg: '#FEF3C7', color: '#92400E' }
    case 'approved': return { key: 'approved', label: 'Approved: pay to start', bg: '#DBEAFE', color: '#1D4ED8' }
    case 'rejected': return { key: 'rejected', label: 'Rejected', bg: '#FEE2E2', color: '#B91C1C' }
    case 'cancelled': return { key: 'cancelled', label: 'Cancelled', bg: '#E5E7EB', color: '#4B5563' }
    case 'paused': return { key: 'paused', label: 'Paused', bg: '#FFEDD5', color: '#9A3412' }
    case 'completed': return { key: 'completed', label: 'Completed', bg: '#E5E7EB', color: '#4B5563' }
    case 'active':
      return a.ends_at && new Date(a.ends_at).getTime() <= Date.now()
        ? { key: 'ended', label: 'Completed', bg: '#E5E7EB', color: '#4B5563' }
        : { key: 'running', label: 'Running', bg: '#DCFCE7', color: '#166534' }
  }
}

export const PLACEMENTS: { key: Placement; label: string; help: string; companyOnly?: boolean; needsQuery?: boolean }[] = [
  { key: 'home', label: 'Home Feed', help: 'Shown between posts on the Home feed.' },
  { key: 'marketplace', label: 'Marketplace', help: 'Shown among listings in the Marketplace.' },
  { key: 'companies', label: 'Companies page', help: 'Shown on the Companies page. Company ads only.', companyOnly: true },
  { key: 'search', label: 'Search results', help: 'Shown when a search matches your ad.' },
  { key: 'groups', label: 'Groups', help: 'Shown inside the groups you choose, after every 10 posts. Priced as an add-on.' },
]

export const placementLabel = (p: string) => PLACEMENTS.find((x) => x.key === p)?.label ?? (p === 'other' ? 'Other' : p)

export const ctr = (impressions: number, clicks: number) => (impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : '0%')

export const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

// Human wording for each audit-history action.
export const HISTORY_LABELS: Record<string, string> = {
  submitted: 'Submitted for review',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Payment received',
  activated: 'Ad started running',
  paused: 'Paused',
  resumed: 'Resumed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  stopped: 'Stopped by Farmxie',
  payment_failed: 'Payment failed',
  payment_cancelled: 'Payment cancelled',
  payment_mismatch: 'Payment amount did not match',
  duplicate_payment: 'Duplicate payment detected',
  payment_unmatched: 'Payment received but the ad could not start',
}

export const AD_ERRORS: Record<string, string> = {
  company_not_verified: 'Your company must be verified before you can advertise.',
  listing_not_available: 'That listing is not available.',
  listing_unavailable: 'The listing for this ad is no longer available.',
  invalid_headline: 'The headline must be 3 to 60 characters.',
  invalid_body: 'The text can be up to 140 characters.',
  invalid_image: 'The image could not be used. Please upload it again.',
  invalid_duration: 'Choose a duration.',
  invalid_placement: 'Choose at least one valid placement.',
  invalid_groups: 'Choose between 1 and 10 public groups.',
  groups_not_available: 'Group ads are not available for your country yet.',
  invalid_target: 'Choose what you want to promote.',
  too_many_open: 'You already have 5 ads waiting for review or payment. Finish or cancel one first.',
  no_price: 'Ads are not available for your country yet.',
  not_found: 'Not found.',
  cannot_cancel: 'This ad can no longer be cancelled.',
  cannot_pause: 'This ad cannot be paused right now.',
  cannot_resume: 'This ad cannot be resumed right now.',
  not_pending: 'This ad has already been reviewed.',
  not_active: 'This ad is not running.',
  note_required: 'Please write a reason.',
  not_allowed: 'You do not have permission to do that.',
}

export const adError = (e: { message?: string } | null | undefined) => {
  const key = Object.keys(AD_ERRORS).find((k) => e?.message?.includes(k))
  return key ? AD_ERRORS[key] : 'Something went wrong. Please try again.'
}
