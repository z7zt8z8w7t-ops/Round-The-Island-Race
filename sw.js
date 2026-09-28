const CACHE = "rti-regatta-v1";
const ASSETS = ["./","index.html","styles.css","app.js","manifest.json","icons/icon-192.svg","icons/icon-512.svg"];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
