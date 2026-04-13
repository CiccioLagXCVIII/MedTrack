/*
   AA 1: CONFIGURAZIONE E ASSET
*/

const CACHE_NAME = 'medtrack-v1.8.5';

/*
BB 1: LISTA RISORSE DA ARCHIVIARE
*/
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './login.html',
    './modals.html',
    './style.css',
    './script.js',
    './auth.js',
    './config.js',
    './pwaManager.js',
    './manifest.json',
    './icon/siteIcon.png',
    './icon/siteLogo.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js',
    'https://unpkg.com/lucide@latest'
];

/*
   AA 2: CICLO DI VITA DEL SERVICE WORKER
*/

/*
BB 1: EVENTO INSTALLAZIONE
*/
self.addEventListener('install', (event) => {
    /* 
    CC 1: SKIP WAITING PER ATTIVAZIONE IMMEDIATA
    */
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

/*
BB 2: EVENTO ATTIVAZIONE
*/
self.addEventListener('activate', (event) => {
    /* 
    CC 1: PRESA IN CARICO DEI CLIENT (PAGINE)
    */
    event.waitUntil(clients.claim());

    /* 
    CC 2: PULIZIA VECCHIE VERSIONI CACHE
    */
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
});

/*
   AA 3: GESTIONE RICHIESTE E CACHE (NETWORK)
*/

/*
BB 1: INTERCETTAZIONE FETCH
*/
self.addEventListener('fetch', (event) => {
    /* 
    CC 1: ESCLUSIONE DATABASE SUPABASE DALLA CACHE
    */
    if (event.request.url.includes('supabase.co')) return;

    /* 
    CC 2: STRATEGIA STALE-WHILE-REVALIDATE
    */
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((response) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                });
                return response || fetchPromise;
            });
        })
    );
});