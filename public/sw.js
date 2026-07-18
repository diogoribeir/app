// Service worker mínimo do Lingo (PWA).
// Estratégia stale-while-revalidate: serve do cache na hora e atualiza em
// segundo plano. Permite instalar no celular e abrir mesmo offline.

const CACHE = "lingo-v5"; // v5: A Viagem (carrossel sem rolagem) + Cenas ao vivo (roleplay com voz)

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      // limpa caches antigos de versões anteriores
      const chaves = await caches.keys();
      await Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (!req.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cacheado = await cache.match(req);
      const rede = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cacheado);
      return cacheado || rede;
    })
  );
});
