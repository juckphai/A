// service-worker.js
const staticCacheName = 'activity-tracker-static-v4';
const dynamicCacheName = 'activity-tracker-dynamic-v3';

// ไฟล์ที่ต้องการ cache
const assets = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './script.js',
  './192.png',
  './512.png',
  './service-worker.js'
];

// Install event
self.addEventListener('install', evt => {
  console.log('Service Worker: Installing');
  evt.waitUntil(
    caches.open(staticCacheName)
      .then(cache => {
        console.log('Caching shell assets');
        return cache.addAll(assets);
      })
      .catch(err => {
        console.log('Cache addAll error:', err);
      })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', evt => {
  console.log('Service Worker: Activated');
  evt.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== staticCacheName && key !== dynamicCacheName)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', evt => {
  // ข้ามการ cache สำหรับ external resources และ API calls
  if (evt.request.url.includes('cdnjs.cloudflare.com') || 
      evt.request.url.includes('cdn.jsdelivr.net')) {
    return fetch(evt.request);
  }

  // ข้ามการ cache สำหรับ non-GET requests
  if (evt.request.method !== 'GET') {
    return fetch(evt.request);
  }

  evt.respondWith(
    caches.match(evt.request)
      .then(cacheRes => {
        // ถ้าเจอใน cache ให้ส่งกลับ
        if (cacheRes) {
          return cacheRes;
        }
        
        // ถ้าไม่เจอ ให้โหลดจาก network
        return fetch(evt.request)
          .then(fetchRes => {
            // ตรวจสอบว่า response ถูกต้อง
            if (!fetchRes || fetchRes.status !== 200 || fetchRes.type !== 'basic') {
              return fetchRes;
            }

            // เก็บใน dynamic cache สำหรับครั้งต่อไป
            return caches.open(dynamicCacheName)
              .then(cache => {
                cache.put(evt.request.url, fetchRes.clone());
                return fetchRes;
              });
          })
          .catch(() => {
            // Fallback สำหรับหน้า HTML
            if (evt.request.destination === 'document') {
              return caches.match('./index.html');
            }
            // Fallback สำหรับรูปภาพ
            if (evt.request.destination === 'image') {
              return caches.match('./192.png');
            }
          });
      })
  );
});