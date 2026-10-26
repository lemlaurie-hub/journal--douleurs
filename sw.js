// Service worker V4. Incrémenter CACHE_NAME à chaque publication qui change le comportement.
const CACHE_NAME = "journal-sante-v4-2026-10-20-5";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=4.5.0",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./src/app.js?v=4.6.0",
  "./src/storage.js",
  "./src/catalog.js",
  "./src/entries.js?v=4.6.0",
  "./src/stats.js",
  "./src/ui.js",
  "./src/body-map.js",
  "./src/transfer.js",
];

// Installe une nouvelle version seulement quand toutes ses ressources sont disponibles.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

// Supprime les anciens caches après activation, puis prend le contrôle des onglets.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Sert les fichiers du cache hors ligne et mémorise les ressources GET manquantes.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque")
          return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
