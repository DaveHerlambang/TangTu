/*
 * TangTu's service worker (0.6.0, docs/SPEC.md §13.9). Small on purpose; the Expo docs warn that service workers
 * cause surprises, so this one only keeps the app's own files:
 * - pages: network first, so a new deploy shows on the next open; offline, the last page kept;
 * - /_expo/static and /assets (file names carry a content hash, so they never change): cache first;
 * - anything else on this site: network, falling back to the cache.
 * Requests to other sites — Supabase, where the data lives — are never touched: the data is always online.
 */
const SHELL = 'tangtu-shell-v1';
const FILES = 'tangtu-files-v1';
const MAX_FILES = 200;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add('/')).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== FILES).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Old builds' files pile up in FILES; keep the newest MAX_FILES. */
async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_FILES)).map((key) => cache.delete(key)));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(SHELL).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/', { cacheName: SHELL }).then((cached) => cached || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request, { cacheName: FILES }).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(FILES).then((cache) => cache.put(request, copy).then(() => trim(cache)));
            }
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(FILES).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  );
});
