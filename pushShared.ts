import { supabase } from './supabaseClient'

// 'ios-install': iPhone/iPad Safari only allows push for apps added to the Home Screen.
export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'

export const NOTIFICATION_CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: 'message', label: 'Messages', hint: 'Direct messages from other members' },
  { key: 'comment', label: 'Comments and replies', hint: 'Someone comments on your post or replies to you' },
  { key: 'like', label: 'Likes', hint: 'Someone likes your post' },
  { key: 'follow', label: 'New followers', hint: 'Someone starts following you' },
  { key: 'activity', label: 'Shares and followed accounts', hint: 'Someone shares your post, or someone you follow posts or lists something' },
  { key: 'marketplace', label: 'Marketplace and orders', hint: 'Questions about your listings, orders, payments' },
  { key: 'farm_desk', label: 'Farm Desk', hint: 'Updates on your Farm Desk requests' },
  { key: 'general', label: 'Announcements', hint: 'Updates and announcements from Farmxie' },
]

function isIos() {
  const ua = navigator.userAgent || ''
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) throw new Error('Incomplete push subscription')
  const { error } = await supabase.rpc('push_subscribe', {
    p_endpoint: json.endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw error
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

/** Asks for permission, subscribes this device and saves it to the signed-in account. */
export async function enablePush(): Promise<{ state: PushState; error?: string }> {
  if (!pushSupported()) return { state: await getPushState(), error: 'Push notifications are not supported on this device or browser.' }
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { state: permission === 'denied' ? 'denied' : 'off' }

    await navigator.serviceWorker.register('/sw.js')
    const reg = await navigator.serviceWorker.ready

    const { data: key, error: keyError } = await supabase.rpc('push_public_key')
    if (keyError || !key) throw new Error('Push is not ready yet. Please try again in a moment.')

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key as string) })
    }
    await saveSubscription(sub)
    return { state: 'on' }
  } catch (e: any) {
    return { state: await getPushState(), error: e?.message || 'Could not turn on notifications.' }
  }
}

/** Turns push off for this device (browser subscription and server record). */
export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (!sub) return
    await supabase.rpc('push_unsubscribe', { p_endpoint: sub.endpoint })
    await sub.unsubscribe()
  } catch { /* ignore */ }
}

/** On sign-in: if this device is already subscribed, (re)attach it to the signed-in account. Silent. */
export async function syncPushSubscription(): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub) await saveSubscription(sub)
  } catch { /* ignore */ }
}

/** On sign-out: stop this account receiving pushes on this device. The browser subscription stays, so the next sign-in re-attaches it. */
export async function detachPushFromAccount(): Promise<void> {
  try {
    if (!pushSupported()) return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub) await supabase.rpc('push_unsubscribe', { p_endpoint: sub.endpoint })
  } catch { /* ignore */ }
}

export async function getMutedCategories(userId: string): Promise<string[]> {
  const { data } = await supabase.from('notification_prefs').select('muted').eq('user_id', userId).maybeSingle()
  return (data?.muted as string[] | undefined) || []
}

export async function saveMutedCategories(userId: string, muted: string[]): Promise<boolean> {
  const { error } = await supabase
    .from('notification_prefs')
    .upsert({ user_id: userId, muted, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return !error
}
