/* Offline shell for Gallery Approach. Network first, so updates show up straight away. */
const CACHE = 'gallery-approach-v5';
const SHELL = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/core.js', 'js/gen.js', 'js/live.js', 'js/photos.js', 'js/sources.js', 'js/compose.js', 'js/fx.js', 'js/show.js', 'js/flights.js', 'js/radar.js', 'js/game.js', 'js/planner.js', 'js/env.js', 'js/settings.js', 'js/ui.js', 'js/cloud.js', 'js/main.js',
  'assets/fonts/fraunces-latin-opsz-normal.woff2', 'assets/fonts/fraunces-latin-opsz-italic.woff2', 'assets/fonts/inter-latin-opsz-normal.woff2', 'assets/fonts/jetbrains-mono-latin-wght-normal.woff2',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/') || u.pathname.includes('/photos/') || u.pathname.includes('/cache/')) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
