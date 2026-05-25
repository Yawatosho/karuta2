const CACHE_NAME = 'karuta-audio-v1';
const AUDIO_ASSETS = [
  './0.mp3',
  './1.mp3',
  './2.mp3',
  './3.mp3',
  './4.mp3',
  './5.mp3',
  './6.mp3',
  './7.mp3',
  './8.mp3',
  './9.mp3',
  './correct.mp3',
  './ng.mp3',
  './start.mp3',
  './result.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(AUDIO_ASSETS.map(asset => cache.add(asset))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE_NAME && key.startsWith('karuta-audio-'))
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin || !url.pathname.endsWith('.mp3')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
