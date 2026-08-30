const CACHE_PREFIX = 'gasto-libre-';
const CACHE = `${CACHE_PREFIX}v5`;
const APP_SHELL = './';
const ASSETS = [APP_SHELL, './gasto-libre-manifest.json', './gasto-libre-icon.svg'];

function withoutRedirectMetadata(response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

async function fetchClean(request) {
  const response = await fetch(request, { redirect: 'follow' });
  if (!response.ok) throw new Error(`No se pudo cargar ${response.url}`);
  return response.redirected ? withoutRedirectMetadata(response) : response;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async asset => {
      const response = await fetchClean(asset);
      await cache.put(asset, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetchClean(event.request);
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
        return response;
      } catch (error) {
        const saved = await caches.match(event.request) || await caches.match(APP_SHELL);
        if (saved) return withoutRedirectMetadata(saved);
        throw error;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const saved = await caches.match(event.request);
    if (saved) return saved;

    const response = await fetchClean(event.request);
    const cache = await caches.open(CACHE);
    await cache.put(event.request, response.clone());
    return response;
  })());
});
