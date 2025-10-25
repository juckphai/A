// sw.js - Service Worker Loader
try {
  importScripts('./service-worker.js');
} catch (e) {
  console.error('Error importing service worker script:', e);
}