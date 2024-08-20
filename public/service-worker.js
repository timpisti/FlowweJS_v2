const CACHE_NAME = 'flowwejs-cache-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
  );
});

self.addEventListener('fetch', (event) => {
  const cacheStrategy = event.request.headers.get('X-Cache-Strategy') || 'network-first';
  const cacheExpiration = parseInt(event.request.headers.get('X-Cache-Expiration')) || 5 * 60 * 1000;
  const cacheIdentifier = event.request.headers.get('X-Cache-Identifier');
  const isImage = event.request.headers.get('X-Resource-Type') === 'image';

  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    (async function() {
      const cache = await caches.open(CACHE_NAME);

      if (cacheStrategy === 'cache-first') {
        const cachedResponse = await cache.match(cacheIdentifier);
        if (cachedResponse) {
          const cachedAt = cachedResponse.headers.get('X-Cached-At');
          if (cachedAt && Date.now() - parseInt(cachedAt) < cacheExpiration) {
            return cachedResponse;
          }
        }
      }

      try {
        const networkResponse = await fetch(event.request);
        const clonedResponse = networkResponse.clone();

        if (networkResponse.ok) {
          const headers = new Headers(clonedResponse.headers);
          headers.append('X-Cached-At', Date.now().toString());
          headers.append('X-Cache-Identifier', cacheIdentifier);
          const cachedResponse = new Response(await clonedResponse.blob(), {
            status: clonedResponse.status,
            statusText: clonedResponse.statusText,
            headers: headers
          });

          event.waitUntil(cache.put(cacheIdentifier, cachedResponse));
        }

        return networkResponse;
      } catch (error) {
        const cachedResponse = await cache.match(cacheIdentifier);
        if (cachedResponse) {
          return cachedResponse;
        }
        throw error;
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.delete(event.data.cacheIdentifier);
      })
    );
  } else if (event.data.type === 'CLEAR_ALL_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME)
    );
  }
});