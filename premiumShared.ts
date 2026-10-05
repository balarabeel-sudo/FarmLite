import { supabase } from './supabaseClient'

export type Audience = 'user' | 'company'
export type PriceRow = { months: number; amount: number }
export type PriceInfo = {
  country: string
  currency: string
  prices: PriceRow[]
  status: { is_premium?: boolean; premium_until?: string | null }
}
export type VerifyResult = {
  status?: 'active' | 'pending' | 'failed' | 'cancelled' | 'mismatch'
  audience?: Audience
  months?: number
  amount?: number
  currency?: string
  expires_at?: string
  error?: string
}

// One row of the Free vs Premium comparison.
// live = the feature really works today. Rows with live: false show a small "Soon" tag so the page
// never promises something that is not delivered yet. Flip to true when the feature ships.
export type Feature = {
  icon: string
  title: string
  sub: string
  free: string // 'No' shows a red cross
  premium: string
  live: boolean
  soonLabel?: string
  // when set, the Free/Premium values are read from app_limits so the page never shows stale numbers
  limitKey?: string
  unit?: string
}

export const USER_FEATURES: Feature[] = [
  { icon: 'bot', title: 'FarmBot Limit', sub: 'Daily questions & AI assistance', free: 'Limited', premium: 'Pro', live: true, limitKey: 'farmbot_daily_messages', unit: '/day' },
  { icon: 'box', title: 'Listing Capacity', sub: 'Active marketplace listings', free: '3', premium: '10', live: false, limitKey: 'active_listings' },
  { icon: 'play', title: 'Short Video Posting', sub: 'Post short videos (up to 20 seconds)', free: 'No', premium: 'Yes (20s)', live: false },
  { icon: 'bars', title: 'Advanced Analytics', sub: 'Track your growth and performance', free: 'No', premium: 'Yes', live: true },
  { icon: 'user', title: 'Premium Profile', sub: 'A richer profile that stands out', free: 'No', premium: 'Yes', live: false },
  { icon: 'eye', title: 'Priority Visibility', sub: 'Additional visibility opportunities', free: 'No', premium: 'Yes', live: false },
  { icon: 'cloud', title: 'More Upload Capacity', sub: 'Images and media', free: 'Standard', premium: 'Extended', live: false },
  { icon: 'bell', title: 'Advanced Notifications', sub: 'Personalized and important alerts', free: 'No', premium: 'Yes', live: false },
  { icon: 'cart', title: 'Advanced Marketplace Tools', sub: 'Better listing insights and tools', free: 'No', premium: 'Yes', live: false },
  { icon: 'crown', title: 'Premium Badge', sub: "Show you're a Premium member", free: 'No', premium: 'Yes', live: true },
]

export const COMPANY_FEATURES: Feature[] = [
  { icon: 'building', title: 'Company Page', sub: 'How your company presents itself', free: 'Basic', premium: 'Enhanced', live: false },
  { icon: 'crown', title: 'Premium Company Badge', sub: 'A Premium badge on your company', free: 'No', premium: 'Yes', live: true },
  { icon: 'bars', title: 'Company Analytics', sub: 'Views, followers, listings and orders', free: 'Basic', premium: 'Advanced', live: true },
  { icon: 'box', title: 'Marketplace Tools', sub: 'Listing insights and higher capacity', free: 'Standard', premium: 'Advanced', live: false },
  { icon: 'eye', title: 'Featured Visibility', sub: 'Additional visibility opportunities', free: 'Standard', premium: 'Featured', live: false },
  { icon: 'users', title: 'Customer Insights', sub: 'Visitors, interest and engagement', free: 'Basic', premium: 'Yes', live: false },
  { icon: 'megaphone', title: 'Advertising Tools', sub: 'Promote your company and listings', free: 'Standard', premium: 'Advanced', live: false, soonLabel: 'Coming soon' },
  { icon: 'file', title: 'Performance Reports', sub: 'Weekly and monthly summaries', free: 'No', premium: 'Yes', live: false },
  { icon: 'bot', title: 'FarmBot Business Assistance', sub: 'Agriculture and business guidance', free: 'No', premium: 'Yes', live: false },
  { icon: 'headset', title: 'Priority Support', sub: 'Faster help from the team', free: 'Standard', premium: 'Priority', live: false },
]

// "Everything included" grid
export type Included = { title: string; live: boolean }

export const USER_INCLUDED: Included[] = [
  { title: 'Advanced FarmBot', live: true },
  { title: '10 Marketplace Listings', live: false },
  { title: '20-Second Short Videos', live: false },
  { title: 'Personal Analytics', live: true },
  { title: 'Premium Profile', live: false },
  { title: 'Premium Badge', live: true },
  { title: 'Priority Visibility', live: false },
  { title: 'Advanced Marketplace Tools', live: false },
  { title: 'Advanced Notifications', live: false },
  { title: 'Extended Upload Capacity', live: false },
]

export const COMPANY_INCLUDED: Included[] = [
  { title: 'Premium Company Page', live: false },
  { title: 'Premium Badge', live: true },
  { title: 'Advanced Company Analytics', live: true },
  { title: 'Advanced Marketplace Tools', live: false },
  { title: 'Higher Listing Capacity', live: false },
  { title: 'Featured Visibility', live: false },
  { title: 'Customer Insights', live: false },
  { title: 'Advanced Advertising Tools', live: false },
  { title: 'Company Performance Reports', live: false },
  { title: 'FarmBot Business Assistance', live: false },
  { title: 'Priority Visibility', live: false },
  { title: 'Priority Support', live: false },
]

// Premium counts as active only while the real expiry date is in the future.
export function isPremiumActive(isPremium?: boolean | null, until?: string | null): boolean {
  if (!isPremium) return false
  if (!until) return true
  return new Date(until).getTime() > Date.now()
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export function formatDate(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export function planLabel(months: number): string {
  return months === 1 ? '1 Month' : `${months} Months`
}

async function fnError(error: any): Promise<string> {
  try {
    const body = await error.context.json()
    if (body?.error) return String(body.error)
  } catch {
    // fall through
  }
  return error?.message || 'Something went wrong'
}

export async function fetchPrices(audience: Audience, companyId?: string | null): Promise<{ info?: PriceInfo; error?: string }> {
  const { data, error } = await supabase.rpc('premium_get_prices', {
    p_audience: audience,
    p_company: companyId ?? null,
  })
  if (error) return { error: error.message }
  return { info: data as PriceInfo }
}

export type Limits = Record<string, { free: number; premium: number }>

// Free vs Premium limits (FarmBot messages per day, active listings...) configured in the database
export async function fetchLimits(): Promise<Limits> {
  const { data } = await supabase.from('app_limits').select('key, free_value, premium_value')
  const out: Limits = {}
  ;(data || []).forEach((r: any) => { out[r.key] = { free: r.free_value, premium: r.premium_value } })
  return out
}

export async function startCheckout(
  audience: Audience,
  months: number,
  companyId?: string | null,
): Promise<{ authorization_url?: string; reference?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('premium-checkout', {
    body: { audience, months, company_id: companyId ?? null },
  })
  if (error) return { error: await fnError(error) }
  return data
}

export async function verifyPayment(reference: string): Promise<VerifyResult> {
  const { data, error } = await supabase.functions.invoke('premium-verify', { body: { reference } })
  if (error) return { error: await fnError(error) }
  return data as VerifyResult
}

export async function cancelPayment(reference: string): Promise<void> {
  await supabase.functions.invoke('premium-verify', { body: { reference, cancel: true } })
}

// A payment started in the last 24h that was never confirmed (e.g. the user closed the tab after paying)
export async function findPendingReference(audience: Audience, companyId?: string | null): Promise<string | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let q = supabase
    .from('premium_subscriptions')
    .select('reference')
    .eq('audience', audience)
    .eq('status', 'pending')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
  if (audience === 'company' && companyId) q = q.eq('company_id', companyId)
  const { data } = await q
  return data && data.length ? (data[0] as any).reference : null
}

// Remembers who started the payment so the return page can send them to the right place
const CTX_KEY = 'fl_premium_ctx'
export function saveCheckoutContext(ctx: { audience: Audience; companyId?: string | null; reference?: string }) {
  try { sessionStorage.setItem(CTX_KEY, JSON.stringify(ctx)) } catch { /* ignore */ }
}
export function readCheckoutContext(): { audience?: Audience; companyId?: string | null; reference?: string } | null {
  try {
    const raw = sessionStorage.getItem(CTX_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
export function clearCheckoutContext() {
  try { sessionStorage.removeItem(CTX_KEY) } catch { /* ignore */ }
}
