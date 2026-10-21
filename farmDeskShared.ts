// Shared constants + helpers for the Farm Desk customer pages.

export const FD = {
  bg: 'var(--fx-tint-green3)',
  card: 'var(--fx-card)',
  border: 'var(--fx-tint-green)',
  green: '#16A34A',
  greenDark: 'var(--fx-green-deep)',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
}

export type FarmDeskStatus =
  | 'new' | 'reviewing' | 'sourcing' | 'options_found' | 'quotation_ready'
  | 'customer_review' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'unable_to_source'

export const STATUS_META: Record<string, { label: string; bg: string; fg: string; hint: string }> = {
  new: { label: 'New', bg: 'var(--fx-tint-blue)', fg: 'var(--fx-blue-text2)', hint: 'Request submitted.' },
  reviewing: { label: 'Reviewing', bg: 'var(--fx-tint-amber)', fg: 'var(--fx-amber-text2)', hint: 'Farmxie is reviewing your request.' },
  sourcing: { label: 'Sourcing', bg: 'var(--fx-tint-amber)', fg: 'var(--fx-amber-text2)', hint: 'Farmxie is actively looking for suppliers.' },
  options_found: { label: 'Options Found', bg: 'var(--fx-tint-green)', fg: 'var(--fx-green-mid)', hint: 'Potential sources have been found.' },
  quotation_ready: { label: 'Quotation Ready', bg: 'var(--fx-tint-green)', fg: 'var(--fx-green-mid)', hint: 'Farmxie has prepared an option for you.' },
  customer_review: { label: 'Your Review', bg: '#EDE9FE', fg: '#6D28D9', hint: 'Waiting for your decision.' },
  confirmed: { label: 'Confirmed', bg: 'var(--fx-tint-green)', fg: 'var(--fx-green-mid)', hint: 'You accepted the proposed option.' },
  in_progress: { label: 'In Progress', bg: 'var(--fx-tint-blue)', fg: 'var(--fx-blue-text2)', hint: 'Farmxie is coordinating the next steps.' },
  completed: { label: 'Completed', bg: 'var(--fx-border3)', fg: 'var(--fx-muted4)', hint: 'Request completed.' },
  cancelled: { label: 'Cancelled', bg: 'var(--fx-tint-red)', fg: 'var(--fx-red-text)', hint: 'Request cancelled.' },
  unable_to_source: { label: 'Unable to Source', bg: 'var(--fx-tint-red)', fg: 'var(--fx-red-text)', hint: 'Farmxie could not find a suitable source.' },
}

export const PAYMENT_LABELS: Record<string, string> = {
  not_required: 'Not required',
  pending: 'Pending',
  paid: 'Paid',
  partially_paid: 'Partially paid',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
}

export const CATEGORIES = [
  'Maize', 'Rice', 'Beans', 'Livestock', 'Fish', 'Seeds',
  'Fertilizer', 'Farm Equipment', 'Agro-Chemicals', 'Agricultural Services', 'Other',
]

export const UNITS = ['bags', 'tons', 'kg', 'crates', 'pieces', 'litres', 'heads', 'units', 'other']

export const CURRENCIES = ['NGN', 'USD', 'GHS', 'KES']

export const SOURCE_SCOPES = [
  { key: 'anywhere', label: 'Any available location', placeholder: '' },
  { key: 'city', label: 'A specific city', placeholder: 'e.g. Kaduna' },
  { key: 'state', label: 'A state / region', placeholder: 'e.g. Kano State' },
  { key: 'country', label: 'A specific country', placeholder: 'e.g. Nigeria' },
  { key: 'countries', label: 'Several countries', placeholder: 'e.g. Nigeria, Ghana' },
]

export const DEADLINES = [
  { key: 'asap', label: 'As soon as possible' },
  { key: '7_days', label: 'Within 7 days' },
  { key: '30_days', label: 'Within 30 days' },
  { key: 'date', label: 'A specific date' },
  { key: 'none', label: 'No deadline' },
]

export type FarmDeskRequest = {
  id: string
  request_code: string
  title: string
  category: string
  description: string | null
  quantity: number | null
  unit: string | null
  source_scope: string
  source_location: string | null
  dest_country: string | null
  dest_state: string | null
  dest_city: string | null
  delivery_note: string | null
  no_fixed_budget: boolean
  budget_min: number | null
  budget_max: number | null
  currency: string
  deadline_type: string
  deadline_date: string | null
  requirements: string | null
  status: string
  payment_status: string
  created_at: string
  updated_at: string
}

export function money(amount: number | null | undefined, currency = 'NGN') {
  if (amount === null || amount === undefined) return '-'
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount))
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`
  }
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return fmtDate(iso)
}

export function destinationText(r: Pick<FarmDeskRequest, 'dest_city' | 'dest_state' | 'dest_country'>) {
  return [r.dest_city, r.dest_state, r.dest_country].filter(Boolean).join(', ') || '-'
}

export function sourceText(r: Pick<FarmDeskRequest, 'source_scope' | 'source_location'>) {
  if (r.source_scope === 'anywhere' || !r.source_location) return 'Any available location'
  return r.source_location
}

export function quantityText(r: Pick<FarmDeskRequest, 'quantity' | 'unit'>) {
  if (r.quantity === null || r.quantity === undefined) return '-'
  return `${Number(r.quantity).toLocaleString()} ${r.unit || ''}`.trim()
}
