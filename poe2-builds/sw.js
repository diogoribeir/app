/* Service worker: faz o Exile Forge funcionar offline.
   Guarda os arquivos do app (inclusive a biblioteca kb/) no cache e serve de lá.
   As requisições ao Firebase/pobb.in (outra origem) NUNCA passam pelo cache.
   Ao mudar QUALQUER arquivo (app ou kb/), subir a versão do CACHE. */
var CACHE = "poe2-builds-v3";
var ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./motor.js",
  "./pob.js",
  "./buildplanner.js",
  "./kb/nos.js",
  "./kb/jogo.js",
  "./kb/arvore.js",
  "./kb/unicos.js",
  "./kb/conceitos.js",
  "./kb/meta.js",
  "./manifest.webmanifest",
  "./fonts/cinzel-latin-600-normal.woff2",
  "./fonts/cinzel-latin-700-normal.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        return caches.open(CACHE).then(function (c) {
          try { c.put(e.request, res.clone()); } catch (err) {}
          return res;
        });
      }).catch(function () { return caches.match("./index.html"); });
    })
  );
});
