import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// Seule l'interface est disponible hors ligne. Les horaires restent toujours réseau.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api(?:\/|$)/],
}))

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    // Un push invalide ne doit pas empêcher l'affichage exigé par userVisibleOnly.
  }
  event.waitUntil(self.registration.showNotification(
    typeof payload.title === 'string' ? payload.title : 'Ginku',
    {
      body: typeof payload.body === 'string' ? payload.body : 'Consultez les prochains passages de vos favoris.',
      icon: '/icon-192.png',
      tag: typeof payload.tag === 'string' ? payload.tag : 'ginku-arrival',
      data: { url: typeof payload.url === 'string' && payload.url.startsWith('/arret/') ? payload.url : '/' },
    },
  ))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const url = new URL(event.notification.data?.url || '/', self.location.origin)
    if (url.origin !== self.location.origin) return
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('navigate' in client) {
        await client.navigate(url.href)
        return client.focus()
      }
    }
    return self.clients.openWindow(url.href)
  })())
})
