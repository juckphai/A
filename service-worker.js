// กำหนดชื่อ Cache สองชุด: หนึ่งสำหรับไฟล์หลักของแอป, อีกหนึ่งสำหรับไฟล์ที่โหลดทีหลัง
const staticCacheName = 'site-static-v3'; // เปลี่ยน v2 เป็น v3 เพื่อบังคับอัปเดต
const dynamicCacheName = 'site-dynamic-v2'; // Cache สำหรับไฟล์ที่เปลี่ยนแปลงบ่อย หรือมาจากข้างนอก

// --- จุดที่แก้ไข 1 ---
// นำ URL ของ Google Fonts ออกจากรายการนี้ เหลือไว้แค่ไฟล์ในโปรเจกต์ของเรา
const assets = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './pages/fallback.html' // หน้า fallback ควรอยู่ในนี้
];

// install service worker
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(staticCacheName).then(cache => {
      console.log('caching shell assets');
      cache.addAll(assets);
    })
  );
});

// activate event
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        // ลบ cache ทั้ง static และ dynamic เวอร์ชันเก่าออกไป
        .filter(key => key !== staticCacheName && key !== dynamicCacheName)
        .map(key => caches.delete(key))
      );
    })
  );
});

// --- จุดที่แก้ไข 2 ---
// ปรับปรุง fetch event ให้ฉลาดขึ้น
self.addEventListener('fetch', evt => {
  evt.respondWith(
    // 1. ตรวจสอบใน Cache ก่อน (ทั้ง static และ dynamic)
    caches.match(evt.request).then(cacheRes => {
      // ถ้าเจอไฟล์ใน Cache ให้ส่งไฟล์นั้นกลับไปเลย (ทำงานเร็ว + offline)
      return cacheRes || fetch(evt.request).then(fetchRes => {
        // 2. ถ้าไม่เจอใน Cache ให้ไปโหลดจาก Network
        // และนำไฟล์ที่โหลดได้ มาเก็บใน dynamic cache สำหรับใช้ครั้งต่อไป
        return caches.open(dynamicCacheName).then(cache => {
          // ใช้ put เพื่อเก็บ request-response คู่กัน, clone() เพราะ response ใช้ได้ครั้งเดียว
          cache.put(evt.request.url, fetchRes.clone()); 
          return fetchRes; // ส่ง response ที่โหลดมาใหม่กลับไปให้เบราว์เซอร์
        });
      });
    }).catch(() => {
      // 3. ถ้าทั้ง Cache และ Network ล้มเหลว (เช่น offline และไม่เคยเข้าเว็บนี้มาก่อน)
      // ให้แสดงหน้า fallback ที่เราเตรียมไว้
      if (evt.request.url.indexOf('.html') > -1) {
        return caches.match('./pages/fallback.html');
      }
    })
  );
});
