/* Service Worker (PWA): cache-first para recursos de mismo origen, con
 * actualización en segundo plano y fallback offline. La API del agente es
 * externa y nunca se cachea. Sube VERSION al cambiar la app para invalidar cachés. */
const VERSION = 'v3.9.8';
const CACHE = `gastosdiarios-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/main.css',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './icons/icon-192.png',
  './icons/icon-maskable-192.png',
  './icons/apple-touch-icon.png',
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
  './src/agent/bridge.js',
  './src/agent/tools.js',
  './src/agent/systemPrompt.js',
  // Vistas modulares (parciales HTML cargados en runtime por app.js → loadPartials)
  './views/inicio.html',
  './views/cuentas.html',
  './views/movimientos.html',
  './views/presupuestos.html',
  './views/reportes.html',
  './views/metas.html',
  './views/deudas.html',
  './views/patrimonio.html',
  './views/calendario.html',
  './views/recurrentes.html',
  './views/categorias.html',
  './views/asistente.html',
  './views/config.html',
  // Librerías vendorizadas (antes CDN): ahora offline de verdad.
  './vendor/tailwind.js',
  './vendor/lucide.min.js',
  './vendor/chart.umd.min.js',
  './vendor/alpine.esm.js',
  './vendor/inter.css',
  './vendor/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2',
  './vendor/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7SUc.woff2',
  // engine.js (el bundle del agente) NO se precarga: es grande y solo se usa
  // al abrir el Asistente. Se cachea bajo demanda la primera vez (fetch handler).
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

  // Solo cachear recursos de mismo origen; lo externo (API del agente) va a red.
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;

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
