const CACHE = 'clientes-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS).catch(function() {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  var req = e.request;

  // Só lidamos com GET. POST (ex.: chamada da API do Claude) passa direto.
  if (req.method !== 'GET') return;

  // Nunca mexer na API do Claude nem em outros domínios de API.
  var url = new URL(req.url);
  if (url.hostname.indexOf('anthropic.com') >= 0) return;

  var isHTML = req.mode === 'navigate' ||
               (req.headers.get('accept') || '').indexOf('text/html') >= 0;

  if (isHTML) {
    // HTML: rede primeiro, para o app SEMPRE atualizar quando você publica.
    // Se estiver offline, usa o cache.
    e.respondWith(
      fetch(req).then(function(res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE).then(function(cache) { cache.put(req, clone); });
        }
        return res;
      }).catch(function() {
        return caches.match(req).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Demais arquivos estáticos (ícones, PDF libs): cache primeiro, com atualização em segundo plano.
  e.respondWith(
    caches.match(req).then(function(cached) {
      var network = fetch(req).then(function(res) {
        if (res && res.status === 200 && (url.origin === self.location.origin || res.type === 'cors')) {
          var clone = res.clone();
          caches.open(CACHE).then(function(cache) { cache.put(req, clone); });
        }
        return res;
      }).catch(function() { return cached; });
      return cached || network;
    })
  );
});
