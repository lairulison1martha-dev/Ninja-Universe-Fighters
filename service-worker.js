/* Ninja Universe Fighters — service worker.
 *
 * Strategy:
 *   - Precache the whole app shell on install (it is small and fully static).
 *   - Navigations: network-first with a cache fallback, so a fresh deploy is
 *     picked up quickly but the game still opens with no connection.
 *   - Everything else: cache-first, with a background revalidate.
 *   - Old caches are deleted on activate, keyed by CACHE_VERSION.
 *
 * All paths are RELATIVE so this works from a GitHub Pages project subpath
 * such as /Ninja-Universe-Fighters/.
 */

const CACHE_VERSION = 'v0.11.0';
const CACHE_NAME = `nuf-${CACHE_VERSION}`;

/** Resolve relative to the worker's own scope, never to the domain root. */
const rel = (p) => new URL(p, self.registration.scope).toString();

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',

  './css/main.css',
  './css/loading.css',
  './css/menus.css',
  './css/roster.css',
  './css/combat.css',
  './css/controls.css',
  './css/settings.css',
  './css/mobile.css',

  './js/boot.js',
  './js/main.js',
  './js/constants.js',
  './js/screen-manager.js',
  './js/save-manager.js',
  './js/settings-manager.js',
  './js/audio-manager.js',
  './js/asset-loader.js',
  './js/input-manager.js',
  './js/mobile-controls.js',
  './js/roster-manager.js',
  './js/progression-manager.js',
  './js/unlock-manager.js',
  './js/achievements-manager.js',
  './js/story-manager.js',
  './js/arcade-manager.js',
  './js/survival-manager.js',
  './js/tower-manager.js',
  './js/data-validator.js',
  './js/menu-background.js',
  './js/ui/menu-screen.js',
  './js/ui/select-screen.js',
  './js/ui/stage-screen.js',
  './js/ui/list-screen.js',
  './js/ui/settings-screen.js',
  './js/ui/layout-editor.js',
  './js/ui/overlays.js',
  './js/ui/hud.js',

  './js/combat/combat-engine.js',
  './js/combat/game-loop.js',
  './js/combat/fighter.js',
  './js/combat/fighter-state.js',
  './js/combat/hitbox.js',
  './js/combat/projectile.js',
  './js/combat/effect-pool.js',
  './js/combat/camera-controller.js',
  './js/combat/combo-system.js',
  './js/combat/guard-system.js',
  './js/combat/substitution-system.js',
  './js/combat/transformation-system.js',
  './js/combat/assist-system.js',
  './js/combat/ai-controller.js',
  './js/combat/training-controller.js',
  './js/combat/stage-renderer.js',
  './js/combat/fighter-renderer.js',
  './js/combat/status-effects.js',
  './js/combat/sprite-animator.js',
  './js/asset-report.js',
  './js/data/roster-migration.js',
  './js/data/costumes.js',
  './js/ui/costume-preview.js',

  './js/data/ability-schema.js',
  './js/data/abilities.js',
  './js/data/abilities-core.js',
  './js/data/abilities-signature-a.js',
  './js/data/abilities-signature-b.js',
  './js/data/fighter-schema.js',
  './js/data/fighters.js',
  './js/data/transformations.js',
  './js/data/assists.js',
  './js/data/stages.js',
  './js/data/story.js',
  './js/data/arcade.js',
  './js/data/achievements.js',
  './js/data/unlocks.js',
  './js/data/ai-profiles.js',

  './assets/icons/icon-16.png',
  './assets/icons/icon-32.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-16.png',
  './assets/icons/favicon-32.png',
  './assets/icons/icon-source.svg',

  './assets/fighters/manifest.json',
  './assets/asset-manifest.json',
];

/**
 * Fighter sprite sets precached for offline play.
 *
 * The roster has 192 sets and they total several megabytes, so installing all
 * of them would make a first visit enormous. These twenty are installed up
 * front; every other set is cached by the runtime handler below the first time
 * a match fetches it, so any fighter you have actually played stays available
 * offline.
 */
const PRECACHE_FIGHTERS = [
  'naruto', 'sasuke', 'sakura', 'kakashi', 'lee', 'gaara', 'itachi', 'pain',
  'madara', 'boruto', 'kawaki', 'momoshiki', 'minato', 'hashirama', 'guy',
  'bee', 'obito', 'jiraiya', 'orochimaru', 'tsunade',
];

for (const id of PRECACHE_FIGHTERS) {
  PRECACHE.push(`./assets/fighters/${id}/fighter.json`);
  PRECACHE.push(`./assets/fighters/${id}/sprite-sheet.png`);
  PRECACHE.push(`./assets/fighters/${id}/portrait.png`);
}

/**
 * Costume sets installed up front.
 *
 * Only the starters' costumes: a costume set is the same size as a fighter, so
 * precaching all of them would double the install. Everything else is cached by
 * the runtime handler the first time a match fetches it.
 */
const PRECACHE_COSTUMES = [
  'naruto/kid', 'naruto/shippuden', 'naruto/hokage',
  'sasuke/kid', 'sasuke/shippuden', 'sasuke/adult',
  'sakura/genin', 'sakura/shippuden',
  'kakashi/jonin', 'kakashi/hokage',
  'gaara/genin', 'gaara/kazekage',
  'hinata/genin', 'hinata/shippuden',
  'obito/young', 'obito/masked',
  'madara/valley', 'madara/war',
];

for (const pair of PRECACHE_COSTUMES) {
  PRECACHE.push(`./assets/fighters/${pair.split('/')[0]}/costumes/${pair.split('/')[1]}/fighter.json`);
  PRECACHE.push(`./assets/fighters/${pair.split('/')[0]}/costumes/${pair.split('/')[1]}/sprite-sheet.png`);
  PRECACHE.push(`./assets/fighters/${pair.split('/')[0]}/costumes/${pair.split('/')[1]}/portrait.png`);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // addAll() rejects the whole batch if any single request 404s, which would
    // leave the app with no offline support at all. Add individually instead.
    await Promise.all(PRECACHE.map(async (path) => {
      try {
        const req = new Request(rel(path), { cache: 'reload' });
        const res = await fetch(req);
        if (res && res.ok) await cache.put(rel(path), res.clone());
      } catch (err) {
        // A missing optional asset must not break installation.
        console.warn('[sw] precache skipped', path, err && err.message);
      }
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith('nuf-') && n !== CACHE_NAME).map((n) => caches.delete(n)),
    );
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch { /* not supported */ }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil((async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('nuf-')).map((n) => caches.delete(n)));
      event.source?.postMessage({ type: 'CACHE_CLEARED' });
    })());
  }
});

async function networkFirst(event) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const preload = await event.preloadResponse;
    const res = preload || await fetch(event.request);
    if (res && res.ok) cache.put(rel('./index.html'), res.clone());
    return res;
  } catch {
    return (await cache.match(rel('./index.html')))
      || (await cache.match(rel('./')))
      || new Response('<h1>Offline</h1><p>Open the game once with a connection to install it.</p>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 503,
      });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request);
  if (hit) {
    // Revalidate quietly in the background.
    fetch(request).then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
    }).catch(() => {});
    return hit;
  }
  try {
    const res = await fetch(request);
    if (res && res.ok && request.method === 'GET') cache.put(request, res.clone());
    return res;
  } catch (err) {
    const fallback = await cache.match(request, { ignoreSearch: true });
    if (fallback) return fallback;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(event));
    return;
  }
  event.respondWith(cacheFirst(request));
});
