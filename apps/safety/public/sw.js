const CACHE_NAME = "agero-safety-v1";
const OFFLINE_URL = "/offline";

// Cache offline page on install
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  self.skipWaiting();
});

// Clean up stale caches on activate
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Routes to cache dynamically on visit (for offline access)
const CACHEABLE_ROUTES = [
  /^\/projects\/[^/]+\/site-prep(\/|$)/,
  /^\/site\/[^/]+(\/|$)/,
];

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // Only intercept same-origin requests; skip Next.js internals and API
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/")) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigation: network-first, fall back to cached page, then offline page
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const shouldCache = CACHEABLE_ROUTES.some((r) => r.test(url.pathname));
          if (shouldCache && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches.match(e.request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }
});
