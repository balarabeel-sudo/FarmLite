import { useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { HEARTBEAT_MS } from './presenceShared'

// Renders nothing. While the app is open and visible for a signed-in person it:
//  1. sends a heartbeat so others can see "Active now" / "Last seen",
//  2. marks messages addressed to this person as delivered (even when they are not on the Messages page).
export default function PresenceTracker() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    let stopped = false

    const beat = () => {
      if (stopped || document.visibilityState !== 'visible') return
      supabase.rpc('touch_last_seen').then(() => {}, () => {})
    }
    const delivered = () => {
      if (stopped) return
      supabase.rpc('mark_messages_delivered').then(() => {}, () => {})
    }

    beat()
    delivered()
    const timer = setInterval(beat, HEARTBEAT_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') { beat(); delivered() } }
    document.addEventListener('visibilitychange', onVisible)

    const channel = supabase
      .channel(`delivery:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, delivered)
      .subscribe()

    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [user])

  return null
}
