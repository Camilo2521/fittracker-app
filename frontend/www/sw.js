/**
 * FitTracker Service Worker v8 — Network-first, sin cache de app shell
 * JS/CSS de la app siempre de red. Solo assets externos (fonts CDN) en caché.
 */

const SW_VERSION  = 'fittracker-v8';
const FONT_CACHE  = SW_VERSION + '-fonts';

// Archivos que NUNCA se cachean (app shell — siempre frescos de red)
const NO_CACHE = new Set(['/', '/index.html', '/sw.js', '/api.js', '/db.js',
  '/manifest.json', '/streaks.js', '/personalization.js', '/notifications.js',
  '/assets/app-init.js', '/assets/page-transitions.js', '/assets/chart-loader.js',
  '/assets/onboarding.js', '/assets/streak-celebration.js',
  '/assets/service-container.js', '/assets/cached-database.js',
  '/assets/styles-optimized.css', '/assets/styles-components.css',
  '/assets/fonts.css']);

self.addEventListener('install', e => {
  console.log('[SW] ' + SW_VERSION + ' instalando');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] ' + SW_VERSION + ' activando — limpiando cachés antiguos');
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => !k.startsWith(SW_VERSION))
        .map(k => { console.log('[SW] Eliminando caché:', k); return caches.delete(k); })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Solo GET/HEAD
  if (request.method !== 'GET' && request.method !== 'HEAD') return;

  // Peticiones al backend (localhost:3000) — siempre red, sin SW
  if (url.hostname === 'localhost' && url.port === '3000') return;

  // App shell y scripts locales — SIEMPRE red, NUNCA caché
  if (url.hostname === 'localhost' &&
      (NO_CACHE.has(url.pathname) || url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    e.respondWith(
      fetch(request).catch(() =>
        new Response(
          '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FitTracker</title><style>body{font-family:sans-serif;background:#0a1209;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;gap:16px}h2{color:#4DEB6E}button{padding:12px 28px;background:#4DEB6E;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer}</style></head><body><h2>FitTracker</h2><p>Servidor no disponible. Inicia los servicios e intenta de nuevo.</p><button onclick="location.reload()">Reintentar</button></body></html>',
          { headers: { 'Content-Type': 'text/html;charset=utf-8' } }
        )
      )
    );
    return;
  }

  // Fonts y recursos de CDN externos — caché para velocidad
  if (url.hostname !== 'localhost' && (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.jsdelivr.net')
  )) {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Imágenes locales (iconos) — caché con fallback
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/.test(url.pathname)) {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Default: red directa
});

async function cacheFirst(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

console.log('[SW] ' + SW_VERSION + ' cargado');
