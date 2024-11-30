const CACHE_NAME = 'flowwejs-cache-v1';
const VERSION_KEY = 'flowwejs-version';
let activeUploads = new Map();
let currentVersion = null;

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

// Initialize version from storage
self.addEventListener('activate', async (event) => {
  console.log('Service Worker activated');
  currentVersion = await getStoredVersion();
  if (currentVersion) {
    currentVersion = formatVersion(currentVersion);
    console.log('Current version with week number:', currentVersion);
  }
});

async function getStoredVersion() {
  const clients = await self.clients.matchAll();
  if (clients.length > 0) {
    const client = clients[0];
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
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
    console.log(`Version changed from ${currentVersion} to ${formattedNewVersion}`);
    currentVersion = formattedNewVersion;
    
    await caches.delete(CACHE_NAME);
    
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ 
          type: 'CACHE_INVALIDATED', 
          oldVersion: currentVersion, 
          newVersion: formattedNewVersion 
        });
      });
    });
    
    return true;
  }
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
});

self.addEventListener('fetch', (event) => {
  const cacheStrategy = event.request.headers.get('X-Cache-Strategy') || 'network-first';
  const cacheExpiration = parseInt(event.request.headers.get('X-Cache-Expiration')) || 5 * 60 * 1000;
  const cacheIdentifier = simpleHash(event.request.url);

  if (event.request.method !== 'GET') {
    return;
  }

  console.log('Service Worker Fetch:', cacheIdentifier);
  event.respondWith(
    (async function() {
      const cache = await caches.open(CACHE_NAME);

      // Cache-first strategy
      if (cacheStrategy === 'cache-first') {
        const cachedResponse = await cache.match(cacheIdentifier);
        if (cachedResponse) {
          const cachedAt = cachedResponse.headers.get('X-Cached-At');
          const cachedVersion = cachedResponse.headers.get('X-Cache-Version');
          
          if (cachedAt && 
              Date.now() - parseInt(cachedAt) < cacheExpiration &&
              cachedVersion === currentVersion) {
            return cachedResponse;
          }
          console.log('Cache expired or version mismatch for:', cacheIdentifier);
        }
      }

      // Try fetching from the network
      try {
        const networkResponse = await fetch(event.request);
        const clonedResponse = networkResponse.clone();

        if (networkResponse.ok) {
          const headers = new Headers(clonedResponse.headers);		
          headers.append('X-Cached-At', Date.now().toString());
          headers.append('X-Cache-Identifier', cacheIdentifier);
          headers.append('X-Cache-Version', currentVersion);
          
          const cachedResponse = new Response(await clonedResponse.blob(), {
            status: clonedResponse.status,
            statusText: clonedResponse.statusText,
            headers: headers
          });

          event.waitUntil(cache.put(cacheIdentifier, cachedResponse));
        }

        return networkResponse;
      } catch (error) {
        console.log('Network error occurred, falling back to cache:', error);
        const cachedResponse = await cache.match(cacheIdentifier);
        if (cachedResponse) {
          console.log('Fallback to cached response for:', cacheIdentifier);
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

    console.log('Total size:', totalSize);
    console.log('File size:', file.size);

    let receivedSize = 0;
    let chunks = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
      receivedSize += value.length;
      console.log('Received size:', receivedSize);

      if (totalSize && totalSize > 0 && isFinite(totalSize)) {
        const progress = Math.min(Math.round((receivedSize / totalSize) * 100), 100);
        console.log('Calculated progress:', progress);
        sendMessage({ type: 'UPLOAD_PROGRESS', uploadId, progress });
      }
    }

    sendMessage({ type: 'UPLOAD_PROGRESS', uploadId, progress: 100 });

    const responseData = new TextDecoder("utf-8").decode(
      new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []))
    );
    
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

// Helper function to generate a simple hash from a string
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36); // Convert to base 36 for shorter string
}