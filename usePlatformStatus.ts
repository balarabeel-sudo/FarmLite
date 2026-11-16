import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// What Admin > Settings currently allows. Read from get_platform_status().
export type PlatformStatus = {
  maintenance?: boolean
  farm_desk?: boolean
  farmbot?: boolean
}

const TTL_MS = 30000
let cache: { at: number; data: PlatformStatus | null } = { at: 0, data: null }
let inflight: Promise<PlatformStatus | null> | null = null

// One shared request at a time, remembered for 30 seconds. If it cannot be read, nothing is hidden.
function loadStatus(): Promise<PlatformStatus | null> {
  if (cache.data && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.data)
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_platform_status')
      if (!error && data) cache = { at: Date.now(), data: data as PlatformStatus }
    } catch {
      /* keep whatever we had */
    }
    inflight = null
    return cache.data
  })()
  return inflight
}

export function usePlatformStatus(): PlatformStatus | null {
  const [status, setStatus] = useState<PlatformStatus | null>(cache.data)
  useEffect(() => {
    let alive = true
    loadStatus().then((s) => { if (alive && s) setStatus(s) })
    return () => { alive = false }
  }, [])
  return status
}

// true unless an admin switched Farm Desk off (unknown status counts as on)
export function useFarmDeskEnabled(): boolean {
  return usePlatformStatus()?.farm_desk !== false
}
