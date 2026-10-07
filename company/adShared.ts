// Shared helpers for the company Ads pages.

export type AdRow = {
  id: string
  target_type: 'listing' | 'company'
  listing_id: string | null
  headline: string
  body: string | null
  image_url: string | null
  days: number
  amount: number
  currency: string
  status: 'pending_review' | 'approved' | 'rejected' | 'active' | 'cancelled'
  review_note: string | null
  starts_at: string | null
  ends_at: string | null
  created_at: string
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
    case 'active':
      return a.ends_at && new Date(a.ends_at).getTime() <= Date.now()
        ? { key: 'ended', label: 'Ended', bg: '#E5E7EB', color: '#4B5563' }
        : { key: 'running', label: 'Running', bg: '#DCFCE7', color: '#166534' }
  }
}

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

export const AD_ERRORS: Record<string, string> = {
  company_not_verified: 'Your company must be verified before you can advertise.',
  listing_not_available: 'That listing is not available.',
  invalid_headline: 'The headline must be 3 to 60 characters.',
  invalid_body: 'The text can be up to 140 characters.',
  invalid_duration: 'Choose a duration.',
  too_many_open: 'You already have 5 ads waiting for review or payment. Finish or cancel one first.',
  no_price: 'Ads are not available for your country yet.',
  not_found: 'Not found.',
  cannot_cancel: 'This ad can no longer be cancelled.',
}

export const adError = (e: { message?: string } | null | undefined) => {
  const key = Object.keys(AD_ERRORS).find((k) => e?.message?.includes(k))
  return key ? AD_ERRORS[key] : 'Something went wrong. Please try again.'
}
