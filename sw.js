// Mon Q1 Biomed : lecture hors ligne.
// Pages et données : réseau d'abord, cache si hors ligne.
// PDF chiffrés et bibliothèques : cache d'abord (mis à jour en arrière-plan).
const CACHE = 'q1biomed-v24';
const SHELL = ['./', 'index.html', 'cfg.json', 'data.enc', 'ayah/cfg.json', 'ayah/data.enc', 'manifest.webmanifest', 'icon-192.png',
  'vendor/pdf.min.js',
  'vendor/pdf.worker.min.js',
  'vendor/perfect-freehand-1.2.2.js', 'vendor/pdf-lib-1.17.1.min.js',
  'notes.css', 'theme.css', 'glass.css', 'pages.css', 'motion.js', 'notes-sync.js', 'notes.js', 'notes-render.js', 'notes-editor.js', 'notes-panels.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const networkFirst = async (req) => {
  const c = await caches.open(CACHE);
  try {
    const r = await fetch(req, { cache: 'no-cache' });
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (_) {
    return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? c.match('index.html') : Response.error());
  }
};
const cacheFirst = async (req) => {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  const fresh = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => null);
  return hit || (await fresh) || Response.error();
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname.endsWith('google.com')) return; // agenda intégré : en ligne seulement
  if (u.hostname === 'api.github.com') return; // synchro des cahiers : jamais en cache
  if (u.origin === location.origin && /\/(pdf\/[^/]+\.enc|vendor\/.+)$/.test(u.pathname)) return e.respondWith(cacheFirst(req));
  if (u.origin === location.origin) return e.respondWith(networkFirst(req));
  if (/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u.hostname)) return e.respondWith(cacheFirst(req));
});

// Après déverrouillage, la page envoie la liste des PDF à garder pour le hors-ligne.
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type !== 'cache' || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    const keep = new Set(d.urls.map((x) => new URL(x, self.registration.scope).href));
    for (const req of await c.keys()) if (/\/pdf\/[^/]+\.enc$/.test(req.url) && !keep.has(req.url)) await c.delete(req);
    for (const href of keep) if (!(await c.match(href))) await c.add(href).catch(() => null);
  }));
});

// Toucher une notification du minuteur : revenir sur le site (ou l'ouvrir).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    return c ? c.focus() : self.clients.openWindow(url);
  }));
});
