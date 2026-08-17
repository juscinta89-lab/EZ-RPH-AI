/*!
 * e-RPH AI — Sistem Rancangan Pengajaran Harian Berbantukan AI
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 * SK Belukar, Machang, Kelantan.
 * Penggunaan, pengedaran atau pengubahsuaian tanpa kebenaran bertulis adalah dilarang.
 */
/* e-RPH AI — Service Worker */
const CACHE = 'erph-v52';
const FAIL = [
  './','./index.html','./styles.css','./manifest.json',
  './firebase-config.js','./js/core.js','./js/data.js','./js/ai.js',
  './js/rph.js','./js/drive.js','./js/rujukan.js','./js/admin.js','./js/ingat.js','./js/boot.js',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-192.png','./icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FAIL).catch(()=>{})));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if(e.request.method !== 'GET') return;
  // Jangan cache Firebase / API AI
  if(/googleapis|firebase|gstatic|anthropic|openai/.test(u.hostname)) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const salin = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, salin)).catch(()=>{});
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
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
