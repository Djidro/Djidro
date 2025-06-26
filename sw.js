const CACHE_NAME = 'bakery-pos-v3'; // Increment version on updates
const RUNTIME_CACHE = 'runtime-cache';

// Precached resources
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './firebase.js',
  './manifest.json',
  './icons/icon-144.png',
  './icons/icon-192.png', 
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css' // Updated to v6
];

// INSTALL: Pre-cache critical resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching core assets');
        return cache.addAll(PRECACHE_URLS);
      })
      .catch(err => console.error('Pre-cache failed:', err))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// ACTIVATE: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== RUNTIME_CACHE) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => self.clients.claim()) // Control all open pages
  );
});

// FETCH: Advanced caching strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Handle API/data requests differently
  if (event.request.url.includes('/firestore/')) {
    event.respondWith(
      networkFirstThenCache(event.request)
    );
    return;
  }

  // For all other requests: Cache-first with network fallback
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) return cachedResponse;
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Cache dynamic responses
            if (isCacheable(event.request)) {
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE)
                .then(cache => cache.put(event.request, responseClone));
            }
            return response;
          })
          .catch(() => offlineFallback(event.request));
      })
  );
});

// --- Helper Functions ---
function networkFirstThenCache(request) {
  return fetch(request)
    .then(networkResponse => {
      const clone = networkResponse.clone();
      caches.open(RUNTIME_CACHE)
        .then(cache => cache.put(request, clone));
      return networkResponse;
    })
    .catch(() => caches.match(request));
}

function offlineFallback(request) {
  // Show custom offline page for HTML requests
  if (request.headers.get('accept').includes('text/html')) {
    return caches.match('./offline.html'); // Create this file
  }
  return new Response('Offline - Royal Bakes POS', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}

function isCacheable(request) {
  // Don't cache large files or non-GET requests
  return (
    request.method === 'GET' &&
    !request.url.includes('sockjs-node') &&
    !request.url.includes('hot-update')
  );
}