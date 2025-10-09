// service-worker.js
const CACHE_NAME = 'activities-pwa-cache-v4';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js'
];

// Event: install
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: All files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Cache installation failed:', error);
      })
  );
});

// Event: activate
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: Activated successfully');
      return self.clients.claim();
    })
  );
});

// Event: fetch
self.addEventListener('fetch', event => {
  // ตรวจสอบว่าเป็น request ชนิด GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // ถ้าพบใน cache ให้ส่งคืน
        if (response) {
          return response;
        }

        // ถ้าไม่พบใน cache ให้ทำการ fetch จาก network
        return fetch(event.request)
          .then(networkResponse => {
            // ตรวจสอบว่าการตอบสนองถูกต้อง
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // คัดลอกการตอบสนองและเพิ่มลงใน cache
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch(error => {
            console.error('Service Worker: Fetch failed:', error);
            // สำหรับ HTML requests ถ้า offline ให้แสดงหน้า index.html
            if (event.request.destination === 'document' || 
                (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
              return caches.match('./index.html');
            }
            // สำหรับ CSS, JS requests
            if (event.request.destination === 'style' || event.request.destination === 'script') {
              return caches.match(event.request.url);
            }
            return new Response('Network error happened', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Event: message
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});