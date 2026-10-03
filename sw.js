/*
 * Controllo Fonti - service worker: dopo la prima visita la pagina funziona anche senza rete (utile in aula).
 * Prima la rete, poi la copia salvata: gli aggiornamenti arrivano subito, e senza rete si usa l'ultima copia.
 * Gestisce solo i file di questo stesso sito: non contatta nessun altro indirizzo e non vede i testi inseriti.
 */
'use strict';
const VERSIONE = 'controllo-fonti-2.1';
const FILE = ['./', 'index.html', 'guida.html', 'style.css', 'manifest.webmanifest', 'docs/icon-192.png', 'docs/icon-512.png',
  'src/check.js', 'src/examples.js', 'src/esercizio.js', 'src/condividi.js', 'src/file.js', 'src/prompt.js',
  'src/ui-comune.js', 'src/ui-strumento.js', 'src/ui-esercizio.js', 'src/ui-formazione.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(chiavi => Promise.all(chiavi.filter(k => k !== VERSIONE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(risposta => {
    if (risposta.ok) { const copia = risposta.clone(); caches.open(VERSIONE).then(c => c.put(r, copia)); }
    return risposta;
  }).catch(() => caches.match(r).then(trovata => trovata || caches.match('index.html'))));
});
