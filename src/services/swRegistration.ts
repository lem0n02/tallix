// Service Worker registration helper
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // In development mode, do not register service worker to avoid caching Vite dev modules
  // and unregister any previously registered service worker & clean caches
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});

    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key).catch(() => {});
        }
      }).catch(() => {});
    }
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[Tallix PWA] ServiceWorker registered with scope:', registration.scope);

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[Tallix PWA] New app version available; will activate automatically.');
                } else {
                  console.log('[Tallix PWA] App content is cached for offline use.');
                }
              }
            };
          }
        };
      })
      .catch((error) => {
        console.warn('[Tallix PWA] ServiceWorker registration failed:', error);
      });
  });
}
