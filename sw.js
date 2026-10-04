// Service worker V4. Incrémenter CACHE_NAME à chaque publication qui change le comportement.
const CACHE_NAME = 'journal-sante-v4-2026-10-04-2';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=4.0.0-2',
  './manifest.webmanifest',
  './icons/icon.svg',
  './src/app.js?v=4.0.0-2',
  './src/storage.js',
  './src/catalog.js',
  './src/entries.js',
  './src/import-export.js',
  './src/stats.js',
  './src/ui.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
