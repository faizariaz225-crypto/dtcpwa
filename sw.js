/* ─── DTC Service Worker ─────────────────────────────────────────────────────
   Strategy:
   · Shell assets (portal, form, index, fonts) → Cache First (offline capable)
   · API calls (/api/*) → Network First with fallback
   · Everything else → Network First
─────────────────────────────────────────────────────────────────────────── */

const CACHE_NAME    = 'dtc-v1';
const SHELL_ASSETS  = [
  '/',
  '/portal',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&display=swap',
];

const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Offline — DTC</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#080c18;color:#e8eeff;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem}
.wrap{max-width:360px}
.logo{width:64px;height:64px;background:#2563eb;border-radius:16px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.2rem;color:#fff;font-family:monospace;margin:0 auto 1.5rem}
h1{font-size:1.4rem;font-weight:600;margin-bottom:.6rem;letter-spacing:-.02em}
p{font-size:.9rem;color:#6b7a99;line-height:1.7;margin-bottom:1.5rem}
button{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:.7rem 1.6rem;font-size:.9rem;font-weight:600;cursor:pointer;font-family:inherit}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">DTC</div>
  <h1>You're offline</h1>
  <p>No internet connection. Your subscription details will load as soon as you're back online.</p>
  <button onclick="location.reload()">Try again</button>
</div>
</body>
</html>`;

// ── Install: cache shell assets ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_ASSETS.filter(u => !u.startsWith('http') || u.includes('fonts.googleapis')));
    }).catch(() => {})
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin except Google Fonts
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.hostname.includes('fonts.g')) return;

  // API calls: Network First, no cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({ error: 'Offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // Shell & pages: Cache First, then network, then offline page
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
          return new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html' } });
        }
      });
    })
  );
});

// ── Push notifications (future use) ──────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'DTC — Digital Tools Corner';
  const options = {
    body:    data.body    || 'You have a notification.',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-72.png',
    tag:     data.tag     || 'dtc-notification',
    data:    { url: data.url || '/portal' },
    actions: data.actions || [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const url = event.notification.data.url || '/portal';
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
