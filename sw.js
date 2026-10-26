const CACHE = 'plan-lekcji-v1';
const ASSETS = [
    './', 'index.html', 'style.css', 'script.js', 'plan.json', 'manifest.json',
    'images/icon-192.png', 'images/icon-512.png',
    'images/bugs-bunny.gif', 'images/pope.gif', 'images/favicon.ico'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => Promise.allSettled(ASSETS.map(a => cache.add(a))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Najpierw sieć (żeby zmiany w plan.json było widać od razu), cache jako zapas offline.
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

    event.respondWith(
        fetch(req)
            .then(res => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then(cache => cache.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if ('focus' in client) return client.focus();
            }
            return self.clients.openWindow('./');
        })
    );
});
