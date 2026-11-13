// Bump VERSION whenever any file changes so phones pick up the new copy.
const VERSION = 'puzzle-santai-v2';
const GAMES = ['balok', 'angka', 'ubin', 'warna', 'solitaire'];
const KART = ['main', 'logic', 'track', 'textures', 'racers', 'physics', 'items', 'ai', 'input', 'audio', 'hud'];
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'icon.svg',
  ...GAMES.map((g) => `games/${g}.html`),
  ...GAMES.map((g) => `logic/${g}.js`),
  'games/kart.html',
  ...KART.map((m) => `kart/${m}.js`),
  'vendor/three.module.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)),
  );
});
