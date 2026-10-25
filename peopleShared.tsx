import { supabase } from './supabaseClient'
import { isPremiumActive } from './premiumShared'
import PremiumTick from './PremiumTick'
import { COLORS } from './shared'

// "People you may know": suggestions come from the database (suggested_people), already filtered:
// never yourself, never someone you follow, never someone you dismissed, only active accounts.
export type SuggestedPerson = {
  user_id: string
  username: string
  full_name: string | null
  profile_image: string | null
  role: string | null
  location: string | null
  is_verified: boolean
  is_premium: boolean
  premium_until: string | null
  followers_count: number
  reason_kind: 'follows_you' | 'mutual' | 'group' | 'region' | 'role' | 'popular'
  reason_text: string
}

export async function fetchSuggestedPeople(limit: number, offset: number): Promise<{ people: SuggestedPerson[]; error: boolean }> {
  const { data, error } = await supabase.rpc('suggested_people', { p_limit: limit, p_offset: offset })
  if (error) return { people: [], error: true }
  return { people: (data || []) as SuggestedPerson[], error: false }
}

export async function dismissSuggestedPerson(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('dismiss_suggestion', { p_user: userId })
  return !error
}

export const personName = (p: SuggestedPerson) => p.full_name?.trim() || p.username

export function PersonAvatar({ p, size }: { p: SuggestedPerson; size: number }) {
  const letter = personName(p).charAt(0).toUpperCase()
  return p.profile_image ? (
    <img src={p.profile_image} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: 'var(--fx-grey2)' }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: COLORS.green, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.4, flexShrink: 0 }}>{letter}</div>
  )
}

export function PersonTick({ p }: { p: SuggestedPerson }) {
  return isPremiumActive(p.is_premium, p.premium_until) ? <PremiumTick size={14} /> : null
}
