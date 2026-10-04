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

export type Benefit = { icon: string; title: string; text: string }

export const USER_BENEFITS: Benefit[] = [
  { icon: 'message', title: 'Advanced FarmBot', text: 'Deeper answers and smarter farming guidance.' },
  { icon: 'fileText', title: 'FarmBot history', text: 'Keep and revisit your past FarmBot chats.' },
  { icon: 'fileText', title: 'Advanced analytics', text: 'See how your posts and profile perform.' },
  { icon: 'user', title: 'Premium profile features', text: 'Stand out with a richer profile.' },
  { icon: 'crown', title: 'Premium badge', text: 'A Premium badge beside your name.' },
  { icon: 'users', title: 'Priority visibility', text: 'Be seen earlier in search and results.' },
  { icon: 'package', title: 'More upload capacity', text: 'Upload more photos and files.' },
  { icon: 'leaf', title: 'Advanced insights', text: 'Extra insights to grow your farm business.' },
  { icon: 'bell', title: 'Advanced notifications', text: 'Smarter alerts about what matters.' },
  { icon: 'checkCircle', title: 'Short Video posting', text: 'Post short videos up to 20 seconds.' },
]

export const COMPANY_BENEFITS: Benefit[] = [
  { icon: 'building', title: 'Verified Company Page', text: 'A trusted, verified company presence.' },
  { icon: 'crown', title: 'Premium Company Badge', text: 'A Premium badge on your company.' },
  { icon: 'fileText', title: 'Advanced Company Analytics', text: 'Charts and trends for your company.' },
  { icon: 'package', title: 'Advanced Marketplace tools', text: 'Better tools to manage your listings.' },
  { icon: 'package', title: 'More listing capacity', text: 'List more products and services.' },
  { icon: 'users', title: 'Featured visibility', text: 'Get featured in front of more buyers.' },
  { icon: 'users', title: 'Customer insights', text: 'Understand who is looking at you.' },
  { icon: 'leaf', title: 'Company insights', text: 'Insights to guide your business decisions.' },
  { icon: 'bell', title: 'Advertising tools', text: 'Promote your company on FarmLite.' },
  { icon: 'fileText', title: 'Advanced reports', text: 'Detailed reports you can act on.' },
  { icon: 'shield', title: 'Priority visibility', text: 'Show up earlier in search and results.' },
  { icon: 'message', title: 'Premium support', text: 'Faster help from the FarmLite team.' },
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
