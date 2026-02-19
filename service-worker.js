// --- Cache Setup ---
const CACHE_NAME = 'fittrack-pro-v2';
const urlsToCache = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache).catch(err => console.log('Optional caching failed', err)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// --- Background Push Notifications ---
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'FitTrack Update';
  const body = data.body || 'You have a new update.';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png',
      badge: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png',
      vibrate: [200, 100, 200],
      tag: 'fittrack-update'
    })
  );
});

// --- Notification Click Handler ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});