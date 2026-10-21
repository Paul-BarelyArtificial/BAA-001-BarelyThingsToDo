// Caches the static app shell so the page itself can load offline.
// Firestore's own persistent local cache (see firebase/firestore.js)
// handles task data - this only covers HTML/CSS/JS/images/manifest.
//
// Bump CACHE_NAME on every release, same as the ?v= cache-busting
// elsewhere (see docs/HOSTING.md's Cache-busting section) - otherwise
// offline users keep the old app shell indefinitely.
const CACHE_NAME = "barely-things-to-do-v1.10.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./images/favicon-32.png",
  "./images/apple-touch-icon.png",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/ba-logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only handle same-origin static assets. Firebase/auth/gstatic calls
  // pass straight through untouched - Firestore has its own offline
  // handling, and this worker has no business near it.
  if (url.origin !== self.location.origin) return;

  const isVersionedAsset = url.search.includes("v=");

  if (isVersionedAsset) {
    // Cache-first: the ?v= query string makes each version's asset
    // immutable, so once cached it never needs re-fetching.
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Network-first for everything else (the HTML shell, images, manifest):
  // online users always get the freshest copy; offline users get
  // whatever was last cached.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
