// Service worker: guarda la app para usarla sin conexión.
// __BUILD__ se sustituye en cada despliegue (ver .github/workflows/pages.yml),
// así cada versión nueva se instala de forma atómica.
const VERSION = 'hogar-__BUILD__';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/main.js',
  './js/app.js',
  './js/store.js',
  './js/sync.js',
  './js/domain.js',
  './js/util.js',
  './js/ui.js',
  './js/icons.js',
  './js/overlays.js',
  './js/views/home.js',
  './js/views/shopping.js',
  './js/views/tasks.js',
  './js/views/money.js',
  './js/views/settings.js',
  './js/views/onboarding.js',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hogar-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // la API de GitHub va siempre por red
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true }) ||
      (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return new Response('Sin conexión', { status: 503 });
    }
  })());
});
