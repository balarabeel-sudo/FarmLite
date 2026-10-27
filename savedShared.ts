import { supabase } from './supabaseClient'

// Each person can keep up to 50 saved items in total (posts, listings, equipment, companies, groups).
// The database enforces it too (saved_limit_reached), so it cannot be bypassed.
export const SAVED_LIMIT = 50
export const SAVED_LIMIT_MESSAGE = `You can save up to ${SAVED_LIMIT} items. Remove one from Saved to save more.`

export type SavedColumn = 'post_id' | 'listing_id' | 'equipment_id'

// Saves one item. 'limit' means the person is already at the maximum.
export async function addSaved(userId: string, column: SavedColumn, id: string): Promise<'ok' | 'limit' | 'error'> {
  const { error } = await supabase.from('saved_items').insert({ user_id: userId, [column]: id })
  if (!error) return 'ok'
  if (error.code === '23505') return 'ok' // already saved
  if (error.message?.includes('saved_limit_reached')) return 'limit'
  return 'error'
}
