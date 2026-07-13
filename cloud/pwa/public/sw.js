// Service worker mínimo: cachea el cascarón de la app (App Shell) para que la
// PWA abra aunque no haya red; la API (/api) siempre va a la red — los datos
// viven en D1, no se cachean respuestas para evitar mostrar información vieja.
const CACHE = 'ams-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api')) return

  // Estáticos: red primero (para estrenar versiones al instante), caché de respaldo.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(event.request, copy))
        return res
      })
      .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match('/')))
  )
})
