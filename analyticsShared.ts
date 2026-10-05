import { supabase } from './supabaseClient'

export type Metric = { series: number[]; total: number; prev: number }

export type TopPost = {
  id: string
  snippet: string | null
  likes_count: number
  comments_count: number
  created_at: string
  image: string | null
}

export type TopListing = {
  id: string
  title: string
  image: string | null
  views: number
  saves: number
}

export type AnalyticsData = {
  locked: boolean
  days?: number
  start?: string
  end?: string
  views?: Metric
  followers?: Metric
  likes?: Metric
  comments?: Metric
  saves?: Metric
  sales?: Metric
  listing_views?: Metric
  revenue?: Record<string, number>
  top_posts?: TopPost[]
  top_listings?: TopListing[]
  listing_categories?: { label: string; value: number }[]
  totals?: Record<string, number>
}

export type AnalyticsAudience = 'user' | 'company'

export async function fetchUserAnalytics(days: number): Promise<{ data?: AnalyticsData; error?: string }> {
  const { data, error } = await supabase.rpc('analytics_user', { p_days: days })
  if (error) return { error: error.message }
  return { data: data as AnalyticsData }
}

export async function fetchCompanyAnalytics(companyId: string, days: number): Promise<{ data?: AnalyticsData; error?: string }> {
  const { data, error } = await supabase.rpc('analytics_company', { p_company: companyId, p_days: days })
  if (error) return { error: error.message }
  return { data: data as AnalyticsData }
}

// Records a view of a profile, company page or listing. The database ignores the owner's own views
// and counts one view per person per hour. Never blocks the page if it fails.
export function trackView(kind: 'profile' | 'company' | 'listing', targetId: string | null | undefined) {
  if (!targetId) return
  supabase.rpc('track_view', { p_kind: kind, p_target: targetId }).then(
    () => {},
    () => {},
  )
}

export type Trend = { dir: 'up' | 'down' | 'flat' | 'new'; pct: number }

// Compares this period with the previous period of the same length
export function trend(total: number, prev: number): Trend {
  if (prev === 0 && total === 0) return { dir: 'flat', pct: 0 }
  if (prev === 0) return { dir: 'new', pct: 0 }
  const pct = Math.round(((total - prev) / prev) * 100)
  if (pct === 0) return { dir: 'flat', pct: 0 }
  return { dir: pct > 0 ? 'up' : 'down', pct: Math.abs(pct) }
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}K`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

// ISO dates (YYYY-MM-DD) for each point of a series
export function dayLabels(start: string | undefined, count: number): string[] {
  if (!start) return Array.from({ length: count }, (_, i) => String(i + 1))
  const base = new Date(`${start}T00:00:00Z`).getTime()
  return Array.from({ length: count }, (_, i) =>
    new Date(base + i * 86_400_000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  )
}

export function sumSeries(...list: (number[] | undefined)[]): number[] {
  const len = Math.max(0, ...list.map((l) => l?.length || 0))
  return Array.from({ length: len }, (_, i) => list.reduce((s, l) => s + (l?.[i] || 0), 0))
}

export const EMPTY_METRIC: Metric = { series: [], total: 0, prev: 0 }
