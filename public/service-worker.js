const CACHE_NAME = 'flowwejs-cache-v1';
let activeUploads = new Map();

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
  const cacheIdentifier = event.request.headers.get('X-Cache-Identifier');

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
    let chunks = [];  // Initialize the chunks array

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);  // Collect chunks of data
      receivedSize += value.length;
      console.log('Received size:', receivedSize);

      if (totalSize && totalSize > 0 && isFinite(totalSize)) {
        const progress = Math.min(Math.round((receivedSize / totalSize) * 100), 100);
        console.log('Calculated progress:', progress);
        sendMessage({ type: 'UPLOAD_PROGRESS', uploadId, progress });
      }
    }

    // Ensure we send a 100% progress update at the end
    sendMessage({ type: 'UPLOAD_PROGRESS', uploadId, progress: 100 });

    // Convert the Uint8Array chunks directly into a string and parse as JSON
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

// Helper function to handle upload resumption (not fully implemented)
async function resumeUpload(uploadId, uploadUrl, startByte) {
  const upload = activeUploads.get(uploadId);
  if (!upload) {
    throw new Error('Upload not found');
  }

  const { file, controller } = upload;
  const blob = file.slice(startByte);

  const formData = new FormData();
  formData.append('file', blob, file.name);

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Range': `bytes ${startByte}-${file.size - 1}/${file.size}`,
    },
    body: formData,
    signal: controller.signal,
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Continue with progress tracking and completion as in uploadWithProgress
  // This part would need to be implemented similarly to uploadWithProgress
}
