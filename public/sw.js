// Farmxie service worker: web push + notification clicks + a small offline fallback.
// It deliberately caches nothing, so a new deploy is always picked up straight away.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

const OFFLINE_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Farmxie</title></head><body style="margin:0;font-family:sans-serif;background:#F8FAF6;color:#1A2E1A;display:flex;' +
  'min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px"><div><img src="/logo.png" width="72" height="72" alt="">' +
  '<h2 style="margin:16px 0 6px">You are offline</h2><p style="color:#5B6B5B;margin:0 0 18px">Check your connection and try again.</p>' +
  '<button onclick="location.reload()" style="background:#16A34A;color:#fff;border:0;border-radius:12px;padding:12px 22px;font-weight:700;font-size:14px">Retry</button>' +
  '</div></body></html>'

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    ),
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = { title: 'Farmxie', body: event.data ? event.data.text() : '' } }

  const title = data.title || 'Farmxie'
  const options = {
    body: data.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: data.id || undefined,
    data: { url: data.url || '/notifications', id: data.id || null },
  }

  const work = [self.registration.showNotification(title, options)]
  if (typeof data.unread === 'number' && self.navigator && 'setAppBadge' in self.navigator) {
    work.push(self.navigator.setAppBadge(data.unread).catch(() => {}))
  }
  event.waitUntil(Promise.all(work))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/notifications', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          await client.focus()
          if ('navigate' in client) { try { await client.navigate(target) } catch (e) { /* ignore */ } }
          return
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    }),
  )
})
