const CACHE_NAME = 'gateradio-v2';

const PRECACHE_URLS = [
  '/login.html',
  '/index.html',
  '/eventi.html',
  '/calendario.html',
  '/attivita-personale.html',
  '/obiettivi.html',
  '/finanze.html',
  '/pulizie.html',
  '/documenti.html',
  '/archivio.html',
  '/admin.html',
  '/logogate.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// --- PUSH NOTIFICATIONS ---
self.addEventListener('push', (e) => {
  const data = e.data?.json() || {};
  const title = data.title || 'Gateradio';
  const options = {
    body: data.body || '',
    icon: '/logogate.png',
    badge: '/logogate.png',
    data: { url: data.url || '/index.html' },
    vibrate: [200, 100, 200]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/index.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Lascia passare le richieste Firebase e CDN senza intercettarle
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
