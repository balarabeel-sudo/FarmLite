// Helpers for "Active now" / "Last seen" in chat.
// The app sends a heartbeat every 45 seconds while it is open and visible, so someone seen in the last 2 minutes is active.

export const HEARTBEAT_MS = 45_000
const ACTIVE_WINDOW_MS = 120_000

export function isActiveNow(lastSeenAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!lastSeenAt) return false
  return now - new Date(lastSeenAt).getTime() < ACTIVE_WINDOW_MS
}

const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

export function lastSeenLabel(lastSeenAt: string | null | undefined, now: number = Date.now()): string {
  if (!lastSeenAt) return ''
  if (isActiveNow(lastSeenAt, now)) return 'Active now'
  const d = new Date(lastSeenAt)
  const today = new Date(now)
  const yesterday = new Date(now - 86_400_000)
  if (d.toDateString() === today.toDateString()) return `Last seen today at ${time(d)}`
  if (d.toDateString() === yesterday.toDateString()) return `Last seen yesterday at ${time(d)}`
  return `Last seen ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
}

export const messageTime = (iso: string) => time(new Date(iso))
