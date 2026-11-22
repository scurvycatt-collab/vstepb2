// Cache để app mở được cả khi mạng yếu. Đổi VERSION mỗi lần cập nhật nội dung.
const VERSION = 'vstep-b2-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'assets/style.css', 'assets/data.js', 'assets/plan.js', 'assets/app.js', 'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Mạng trước, cache dự phòng: luôn lấy bản mới nhất khi có mạng
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
