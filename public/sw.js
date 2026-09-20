// Tallix Offline-First Service Worker (v1.3.0)
const CACHE_NAME = 'tallix-app-shell-v1.3.0';

// Critical core assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
  '/manifest.json',
  '/src/assets/images/tallix_brand_app_logo_1785406274692.jpg',
  '/src/assets/images/tallix_app_logo_1785402472265.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Add each asset safely so failure of one optional file doesn't break installation
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[ServiceWorker] Could not precache:', asset, err);
        }
      }
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[ServiceWorker] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Exclude non-GET requests and browser extensions
  if (request.method !== 'GET') {
    return;
  }

  // Never cache API routes in app-shell cache to avoid exposing sensitive data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ offline: true, error: 'Network unavailable. Changes will sync when online.' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // Navigation requests (HTML pages / SPAs)
  // Serve network-first, fallback to cached /index.html when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cachedIndex = await cache.match('/index.html') || await cache.match('/');
          if (cachedIndex) {
            return cachedIndex;
          }
          return new Response(
            '<!DOCTYPE html><html><body><h1>Tallix is offline</h1><p>Please refresh once connected or use your cached session.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Static Assets (Vite scripts, CSS, images, icons, modules)
  // Cache-first with background network revalidation
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Asynchronously update cache in background if online
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {
            // Silently ignore network failures while serving cached version
          });
        return cachedResponse;
      }

      // If not in cache, fetch from network and store in cache
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and requesting an image or asset
          return new Response('', { status: 404 });
        });
    })
  );
});
