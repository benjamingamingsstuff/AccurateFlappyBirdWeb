const CACHE_NAME = 'flappy-bird-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './js/game.js',
    './js/atlas.js',
    './assets/atlas.png',
    './assets/splash.png',
    './assets/icon.png',
    './assets/sounds/sfx_wing.ogg',
    './assets/sounds/sfx_hit.ogg',
    './assets/sounds/sfx_die.ogg',
    './assets/sounds/sfx_point.ogg',
    './assets/sounds/sfx_swooshing.ogg'
];

self.addEventListener('install', (evt) => {
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (evt) => {
    evt.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

self.addEventListener('fetch', (evt) => {
    evt.respondWith(
        caches.match(evt.request).then((cacheRes) => {
            return cacheRes || fetch(evt.request);
        })
    );
});
