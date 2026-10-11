self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.delete('eco-track-pwa')
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('eco-track')) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'unregister') {
    event.waitUntil(self.registration.unregister());
  }
});