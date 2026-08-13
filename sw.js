/* GastosDiarios — Service Worker (PWA / offline).
 * Estrategia:
 *  - Precarga la "shell" de la app (app shell) en `install`.
 *  - Mismo origen: cache-first con actualización en segundo plano.
 *  - CDN (Tailwind/Lucide/Chart.js/Alpine): stale-while-revalidate.
 *  - Si la red falla, cae a la copia en caché (offline).
 * La versión de la caché se sube al cambiar la app para invalidar viejas copias.
 */
const VERSION = 'v3.2.0';
const CACHE = `gastosdiarios-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/main.css',
  './icons/icon.svg',
  './src/app.js',
  './src/storage.js',
  './src/migrations.js',
  './src/finance.js',
  './src/validation.js',
  './src/backup.js',
  './src/export.js',
  './src/categories.js',
  './src/stats.js',
  './src/db.js',
];

const CDN_PREFIXES = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/alpinejs',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isCDN(url) {
  return CDN_PREFIXES.some((p) => url.startsWith(p));
}

// Actualiza en segundo plano la copia en caché si la red lo permite.
async function putInCache(request, response) {
  if (request.method !== 'GET' || !response || response.status !== 200) return;
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  } catch {
    /* almacenamiento lleno: ignorar silenciosamente */
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Navegación: red primero, caché de index.html como respaldo (offline).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Solo cachear recursos locales y CDN conocidos; el resto va a red.
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !isCDN(url.href)) return;

  // Cache-first con refresh en segundo plano.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          putInCache(request, response);
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
