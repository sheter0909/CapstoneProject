// EcoTrack Household PWA service worker: offline-first for same-origin app
// shell/assets only. API traffic and auth responses are NEVER cached.
const CACHE = 'ecotrack-household-v1';
const API_HOST = 'capstoneproject-oksk.onrender.com';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // Never touch backend traffic: absolute API host, or any api/auth path.
  if (url.host === API_HOST) return;
  if (url.pathname.includes('/api/') || url.pathname.includes('/auth/')) return;
  // Only same-origin app assets; third-party (fonts, QR images) stays network-only.
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }),
      ),
    ),
  );
});
