/* Service worker: faz o Exile Compass funcionar offline.
   - Arquivos do app e a biblioteca kb/: pré-cache na instalação.
   - Imagens (img/: árvore, ascendências, ícones das gemas): guardadas na 1ª vez que aparecem.
   - Outra origem (Firebase, pobb.in, jsDelivr do leitor de fotos) NUNCA passa por aqui.
   Ao mudar QUALQUER arquivo do app ou da kb/, subir a versão do CACHE. */
var CACHE = "poe2-builds-v6";
var IMG = "poe2-builds-img-v2";
var ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./motor.js",
  "./caminho.js",
  "./diagnostico.js",
  "./arvore.js",
  "./foto.js",
  "./pob.js",
  "./buildplanner.js",
  "./kb/jogo.js",
  "./kb/arvore.js",
  "./kb/unicos.js",
  "./kb/conceitos.js",
  "./kb/meta.js",
  "./kb/gemas.js",
  "./kb/tree.js",
  "./kb/ref.js",
  "./kb/runas.js",
  "./kb/combos.js",
  "./kb/nos.js",
  "./img/tree/skills.webp",
  "./img/tree/skills-off.webp",
  "./img/tree/frame.webp",
  "./img/tree/start.webp",
  "./img/tree/start-on.webp",
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
      return Promise.all(keys.map(function (k) { if (k !== CACHE && k !== IMG) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  var ehImg = /\/img\/(asc|gem)\//.test(url.pathname);
  var nome = ehImg ? IMG : CACHE;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copia = res.clone();
          caches.open(nome).then(function (c) { try { c.put(e.request, copia); } catch (err) { /* ok */ } });
        }
        return res;
      }).catch(function () { return ehImg ? Response.error() : caches.match("./index.html"); });
    })
  );
});
