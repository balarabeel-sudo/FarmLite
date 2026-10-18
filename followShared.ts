import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabaseClient'

// "Do I follow this person / company?" for the Follow button in post headers.
// Every post card asks for its author; the questions asked in the same moment are sent as ONE query per kind,
// answers are remembered, and every card of the same author updates together when you follow or unfollow.

export type FollowKind = 'user' | 'company'

const cache = new Map<string, boolean>()
const wanted = new Set<string>()
const listeners = new Set<() => void>()
let cacheUser: string | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let version = 0

const keyOf = (kind: FollowKind, id: string) => `${kind}:${id}`
const emit = () => { version += 1; listeners.forEach((l) => l()) }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const getVersion = () => version

// A different account signed in: forget everything remembered for the previous one.
function resetFor(userId: string) {
  if (cacheUser === userId) return
  cache.clear()
  wanted.clear()
  cacheUser = userId
}

const CHUNK = 80

async function flush() {
  timer = null
  const uid = cacheUser
  if (!uid) return
  const batch = Array.from(wanted)
  wanted.clear()
  const users = batch.filter((k) => k.startsWith('user:')).map((k) => k.slice(5))
  const companies = batch.filter((k) => k.startsWith('company:')).map((k) => k.slice(8))

  const ask = async (kind: FollowKind, ids: string[]) => {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK)
      const res = kind === 'user'
        ? await supabase.from('follows').select('following_id').eq('follower_id', uid).in('following_id', part)
        : await supabase.from('company_followers').select('company_id').eq('user_id', uid).in('company_id', part)
      // On an error the answer stays unknown: no Follow button is shown, and the next card that mounts asks again.
      if (res.error || cacheUser !== uid) continue
      const hit = new Set(((res.data || []) as any[]).map((r) => (kind === 'user' ? r.following_id : r.company_id)))
      part.forEach((id) => cache.set(keyOf(kind, id), hit.has(id)))
    }
  }

  try {
    await Promise.all([ask('user', users), ask('company', companies)])
  } catch { /* network problem: answers stay unknown */ }
  emit()
}

function request(userId: string, kind: FollowKind, id: string) {
  resetFor(userId)
  const k = keyOf(kind, id)
  if (cache.has(k) || wanted.has(k)) return
  wanted.add(k)
  if (!timer) timer = setTimeout(flush, 40)
}

// Use after any follow / unfollow done elsewhere (profile pages) so feed cards do not show stale buttons.
export function setFollowCache(userId: string, kind: FollowKind, id: string, value: boolean) {
  resetFor(userId)
  cache.set(keyOf(kind, id), value)
  emit()
}

// true = following, false = not following, null = not known yet (show nothing).
export function useFollowing(userId: string | undefined, kind: FollowKind, id: string | null | undefined): boolean | null {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  if (userId) resetFor(userId)
  useEffect(() => {
    if (userId && id) request(userId, kind, id)
  }, [userId, kind, id])
  if (!userId || !id) return null
  const v = cache.get(keyOf(kind, id))
  return v === undefined ? null : v
}

export async function followTarget(userId: string, kind: FollowKind, id: string): Promise<boolean> {
  const { error } = kind === 'user'
    ? await supabase.from('follows').insert({ follower_id: userId, following_id: id })
    : await supabase.from('company_followers').insert({ user_id: userId, company_id: id })
  // 23505 = you already follow: same result as success.
  if (error && error.code !== '23505') return false
  setFollowCache(userId, kind, id, true)
  return true
}

export async function unfollowTarget(userId: string, kind: FollowKind, id: string): Promise<boolean> {
  const { error } = kind === 'user'
    ? await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', id)
    : await supabase.from('company_followers').delete().eq('user_id', userId).eq('company_id', id)
  if (error) return false
  setFollowCache(userId, kind, id, false)
  return true
}
