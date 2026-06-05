// Service Worker para Trivia War PWA
const CACHE_NAME = 'triviawar-v1';

// Archivos a cachear al instalar (recursos estáticos principales)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/tw.png',
  '/favicon.png'
];

// Instalación: precargar recursos estáticos
self.addEventListener('install', (event) => {
  console.log('📲 SW: Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activar inmediatamente sin esperar a que se cierren las pestañas
  self.skipWaiting();
});

// Activación: limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  console.log('📲 SW: Activado.');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Tomar control de todas las pestañas abiertas
  self.clients.claim();
});

// Estrategia: Network First con fallback a caché
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET
  if (event.request.method !== 'GET') return;

  // No interceptar peticiones a APIs externas
  const url = new URL(event.request.url);
  if (url.hostname !== self.location.hostname) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, cachearla
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, servir desde caché
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si no está en caché, devolver un error offline genérico
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
