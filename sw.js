/*!
 * e-RPH AI — Sistem Rancangan Pengajaran Harian Berbantukan AI
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 * SK Belukar, Machang, Kelantan.
 * Penggunaan, pengedaran atau pengubahsuaian tanpa kebenaran bertulis adalah dilarang.
 */
/* e-RPH AI — Service Worker */
const CACHE = 'erph-v66';
const FAIL = [
  './','./index.html','./styles.css','./manifest.json',
  './firebase-config.js','./js/core.js','./js/data.js','./js/ai.js',
  './js/rph.js','./js/drive.js','./js/rujukan.js','./js/admin.js','./js/sampah.js','./js/ingat.js','./js/pembantu.js','./js/boot.js',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-192.png','./icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FAIL)));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => /^erph-v\d+$/.test(k) && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  const root = new URL('./', self.location.href);
  if(e.request.method !== 'GET' || u.origin !== root.origin) return;
  // Hanya aset aplikasi dalam senarai dibenarkan; tiada API atau dokumen peribadi.
  if(!FAIL.some(f => new URL(f, root).pathname === u.pathname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = new Request(u.origin + u.pathname);
    try {
      const response = await fetch(e.request);
      if(response.ok && response.type !== 'opaque') {
        const copy = response.clone();
        e.waitUntil(cache.put(key, copy).catch(()=>{}));
      }
      return response;
    } catch {
      const saved = await cache.match(key);
      if(saved) return saved;
      if(e.request.mode === 'navigate') {
        const page = await cache.match(new URL('./index.html', root).href);
        if(page) return page;
      }
      return new Response('Aset tidak tersedia di luar talian.', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});

/* Ketik pemberitahuan — bawa pengguna ke app, jangan buka tab baharu */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const senarai = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for(const c of senarai){ if('focus' in c) return c.focus(); }
    if(self.clients.openWindow) return self.clients.openWindow('./');
  })());
});
