// Service Worker — solo push notifications, niente cache
const CACHE_NAME = 'gateradio-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Pulisce tutte le cache vecchie
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
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

// Nessun fetch handler — i file vengono sempre scaricati dalla rete
