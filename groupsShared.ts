import { timeAgo } from './PostCard'

export const GROUP_CATEGORIES: { key: string; label: string }[] = [
  { key: 'crop_farming', label: 'Crop Farming' },
  { key: 'livestock', label: 'Livestock' },
  { key: 'poultry', label: 'Poultry' },
  { key: 'fish_farming', label: 'Fish Farming' },
  { key: 'machinery', label: 'Agricultural Machinery' },
  { key: 'agri_tech', label: 'Agricultural Technology' },
  { key: 'agribusiness', label: 'Agribusiness' },
  { key: 'markets', label: 'Agricultural Markets' },
  { key: 'organic', label: 'Organic Farming' },
  { key: 'education', label: 'Agricultural Education' },
]

export const categoryLabel = (key: string | null | undefined) =>
  GROUP_CATEGORIES.find((c) => c.key === key)?.label || null

export type Group = {
  id: string
  owner_id: string
  name: string
  description: string | null
  cover_url: string | null
  icon_url: string | null
  members_count: number
  category: string | null
  privacy: 'public' | 'private'
  country: string | null
  purpose: string | null
  rules: string[]
  posts_count: number
  last_activity_at: string | null
  created_at: string
}

export const GROUP_COLUMNS =
  'id, owner_id, name, description, cover_url, icon_url, members_count, category, privacy, country, purpose, rules, posts_count, last_activity_at, created_at'

export type MyRole = 'owner' | 'admin' | 'moderator' | 'member' | null

export const roleLabel = (r: string | null | undefined) =>
  r === 'owner' ? 'Owner' : r === 'admin' ? 'Admin' : r === 'moderator' ? 'Moderator' : null

// Real activity only: nothing is shown for groups that have never had a post.
export const activityLabel = (iso: string | null | undefined) => (iso ? `Active ${timeAgo(iso)}` : null)

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

// Words in a search box that name a category (e.g. "poultry") also match groups of that category.
export function categoryKeysForTerm(term: string): string[] {
  const t = term.trim().toLowerCase()
  if (!t) return []
  return GROUP_CATEGORIES.filter((c) => c.label.toLowerCase().includes(t) || c.key.replace(/_/g, ' ').includes(t)).map((c) => c.key)
}

export function cleanSearch(term: string) {
  return term.trim().replace(/[%,()*\\]/g, ' ').trim()
}

const REASONS: Record<string, string> = {
  spam: 'Spam', scam: 'Scam/Fraud', harassment: 'Harassment', hate: 'Hate or abusive content', fake_account: 'Fake account',
  inappropriate: 'Inappropriate content', dangerous: 'Dangerous activity', false_info: 'False information', other: 'Other',
}
export const reasonText = (k: string) => REASONS[k] || k
