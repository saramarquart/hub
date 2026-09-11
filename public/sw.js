// PAF Hub service worker — NETWORK-FIRST.
// Always fetch fresh from the network so users never get stuck on a stale
// build; the cache is only a last-resort offline fallback.
//
// v2: the hub signs people in now, so the PAGE is no longer cached — only its
// assets. A cached document is a copy of one person's signed-in grid sitting on
// disk: offline it would be handed to whoever opens the app next on a shared
// lab machine, and after a sign-out it would be handed back to a browser that
// no longer has a session. Neither is a breach — the tiles are links, and every
// app behind them gates itself — but neither is something to keep.
//
// The cache NAME is bumped so the activate handler below deletes v1, taking the
// documents it already cached with it.
const CACHE = 'paf-hub-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Drop any caches from older versions, then take control immediately.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Only handle same-origin GETs; let the browser deal with everything else.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Navigations go straight to the network, uncached, so a document is never
  // served to a browser whose session has since gone away.
  if (req.mode === 'navigate') return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        // Cache a copy of successful responses for offline fallback. A redirect
        // (e.g. an asset request that got bounced to /signin) is not one.
        if (res.ok && !res.redirected) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
