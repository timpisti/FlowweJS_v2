const CACHE_NAME = 'flowwejs-cache-v1';
let activeUploads = new Map();
let currentVersion = null;
let defaultCacheStrategy = 'cache-first';
const VERSION_TIMEOUT_MS = 3000; // 3 second timeout for version retrieval

// Version helper functions
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function formatVersion(version) {
  const weekNumber = getWeekNumber(new Date()).toString().padStart(2, '0');
  if (!version) {
    return `1.0.0.${weekNumber}`;
  }
  const versionParts = version.split('.');
  if (versionParts.length >= 4) {
    versionParts[3] = weekNumber;
    return versionParts.join('.');
  }
  return `${version}.${weekNumber}`;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
  );
});

// Initialize version from storage
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(
    getStoredVersion().then(version => {
      currentVersion = version ? formatVersion(version) : formatVersion(null);
      console.log('Current version with week number:', currentVersion);
    })
  );
});

async function getStoredVersion() {
  const clients = await self.clients.matchAll();
  if (clients.length > 0) {
    const client = clients[0];
    return new Promise((resolve) => {
      // Timeout to prevent hanging if the client never responds
      const timeoutId = setTimeout(() => {
        resolve(null);
      }, VERSION_TIMEOUT_MS);
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        clearTimeout(timeoutId);
        const formattedVersion = formatVersion(event.data);
        resolve(formattedVersion);
      };
      client.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    });
  }
  return formatVersion(null);
}

async function handleVersionCheck(newVersion) {
  const formattedNewVersion = formatVersion(newVersion);

  if (currentVersion === null) {
    currentVersion = formattedNewVersion;
    console.log('Initial version set to:', currentVersion);
    return false;
  }

  if (formattedNewVersion !== currentVersion) {
    const oldVersion = currentVersion;
    console.log(`Version changed from ${oldVersion} to ${formattedNewVersion}`);
    currentVersion = formattedNewVersion;

    await caches.delete(CACHE_NAME);

    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_INVALIDATED',
        oldVersion: oldVersion,
        newVersion: formattedNewVersion
      });
    });

    return true;
  }
  return false;
}

self.addEventListener('fetch', (event) => {
  const cacheStrategy = event.request.headers.get('X-Cache-Strategy') || defaultCacheStrategy;
  const cacheExpiration = parseInt(event.request.headers.get('X-Cache-Expiration')) || 5 * 60 * 1000;
  const cacheKey = event.request.url;

  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    (async function() {
      const cache = await caches.open(CACHE_NAME);

      // Cache-first strategy
      if (cacheStrategy === 'cache-first') {
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          const cachedAt = cachedResponse.headers.get('X-Cached-At');
          const cachedVersion = cachedResponse.headers.get('X-Cache-Version');

          // For opaque responses (no custom headers), serve from cache if version matches
          const isOpaqueCached = !cachedAt && cachedResponse.type === 'opaque';
          if (isOpaqueCached) {
            return cachedResponse;
          }

          if (cachedAt &&
              Date.now() - parseInt(cachedAt) < cacheExpiration &&
              cachedVersion === currentVersion) {
            return cachedResponse;
          }
        }
      }

      // Try fetching from the network
      try {
        const networkResponse = await fetch(event.request);
        const clonedResponse = networkResponse.clone();

        if (networkResponse.ok) {
          // Standard response — cache with metadata headers
          const headers = new Headers(clonedResponse.headers);
          headers.append('X-Cached-At', Date.now().toString());
          headers.append('X-Cache-Version', currentVersion);

          const cachedResponse = new Response(await clonedResponse.blob(), {
            status: clonedResponse.status,
            statusText: clonedResponse.statusText,
            headers: headers
          });

          event.waitUntil(cache.put(cacheKey, cachedResponse));
        } else if (networkResponse.type === 'opaque') {
          // Cross-origin opaque response (e.g., images) — cache as-is
          event.waitUntil(cache.put(cacheKey, clonedResponse));
        }

        return networkResponse;
      } catch (error) {
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return cachedResponse;
        }
        throw error;
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'SET_VERSION') {
    event.waitUntil(handleVersionCheck(event.data.version));
  } else if (event.data.type === 'SET_CACHE_STRATEGY') {
    defaultCacheStrategy = event.data.strategy;
  } else if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.delete(event.data.cacheIdentifier);
      })
    );
  } else if (event.data.type === 'CLEAR_ALL_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME)
    );
  } else if (event.data.type === 'UPLOAD') {
    handleUpload(event.data);
  } else if (event.data.type === 'CANCEL_UPLOAD') {
    cancelUpload(event.data.uploadId);
  }
});

async function handleUpload({ file, uploadId, uploadUrl, thumbnail }) {
  console.log(`Starting upload for ${file.name}`);

  const upload = {
    file,
    uploadId,
    uploadUrl,
    thumbnail,
    controller: new AbortController(),
    uploaded: 0,
    total: file.size
  };

  activeUploads.set(uploadId, upload);

  try {
    await uploadWithProgress(upload);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`Upload cancelled for ${file.name}`);
      sendMessage({ type: 'UPLOAD_CANCELLED', uploadId });
    } else {
      console.error(`Upload failed for ${file.name}:`, error);
      sendMessage({ type: 'UPLOAD_FAILED', uploadId, error: error.message });
    }
  } finally {
    activeUploads.delete(uploadId);
  }
}

async function uploadWithProgress(upload) {
  const { file, uploadId, uploadUrl, thumbnail, controller } = upload;

  sendMessage({ type: 'UPLOAD_STARTED', uploadId, fileName: file.name, thumbnail });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('thumbnail', thumbnail);

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const contentLength = response.headers.get('Content-Length');
    const totalSize = contentLength ? parseInt(contentLength, 10) : file.size;

    let receivedSize = 0;
    let chunks = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
      receivedSize += value.length;

      if (totalSize && totalSize > 0 && isFinite(totalSize)) {
        const progress = Math.min(Math.round((receivedSize / totalSize) * 100), 100);
        sendMessage({ type: 'UPLOAD_PROGRESS', uploadId, progress });
      }
    }

    sendMessage({ type: 'UPLOAD_PROGRESS', uploadId, progress: 100 });

    // Concatenate chunks efficiently using Blob
    const responseBlob = new Blob(chunks);
    const responseData = await responseBlob.text();

    let result;
    try {
      result = JSON.parse(responseData);
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      result = { rawResponse: responseData };
    }

    sendMessage({ type: 'UPLOAD_COMPLETE', uploadId, result });
  } catch (error) {
    if (error.name === 'AbortError') {
      sendMessage({ type: 'UPLOAD_CANCELLED', uploadId });
    } else {
      console.error('Upload error:', error);
      sendMessage({ type: 'UPLOAD_FAILED', uploadId, error: error.message });
    }
  }
}

function cancelUpload(uploadId) {
  const upload = activeUploads.get(uploadId);
  if (upload) {
    upload.controller.abort();
    activeUploads.delete(uploadId);
  }
}

function sendMessage(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage(message));
  });
}
