// เปลี่ยนชื่อ Cache ทุกครั้งที่มีการอัปเดตไฟล์ใน urlsToCache
const CACHE_NAME = 'manphai-pwa-cache-v27'; // แนะนำให้เปลี่ยนเวอร์ชันทุกครั้งที่แก้ไฟล์นี้

// รายการไฟล์ทั้งหมดที่ต้องการให้แอปทำงานแบบ Offline ได้
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './192.png',
  './512.png'  // ตรวจสอบให้แน่ใจว่าคุณมีไฟล์นี้อยู่
];

// Event: install - ติดตั้ง Service Worker และแคชไฟล์ทั้งหมดที่ระบุไว้
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching all app files');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Failed to cache files during install:', error);
      })
  );
  self.skipWaiting();
});

// Event: activate - จัดการแคชเก่าที่ไม่ต้องการแล้ว
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cache => {
          return cache.startsWith('juckim-pwa-cache-') && cache !== CACHE_NAME;
        }).map(cache => {
          console.log('Service Worker: Clearing old cache:', cache);
          return caches.delete(cache);
        })
      );
    })
  );
  return self.clients.claim();
});

// Event: fetch - จัดการ request ทั้งหมดที่เกิดขึ้นจากแอป
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
      return;
  }
  
  // กลยุทธ์: Cache First
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
