/* podejrzyjkota: service worker (offline). Po każdej zmianie plików podbij CACHE_VERSION. */
const CACHE_VERSION = "v1.6.1";
const CACHE = "podejrzyjkota-" + CACHE_VERSION;
const ASSETS = [
  "./",
  "./index.html",
  "./polityka-prywatnosci.html",
  "./regulamin.html",
  "./jak-grac.html",
  "./faq.html",
  "./dla-ogloszeniodawcow.html",
  "./dodaj-kota.html",
  "./kontakt.html",
  "./o-nas.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./css/style.css",
  "./js/cats.js",
  "./js/catart.js",
  "./js/consent.js",
  "./js/ads.js",
  "./js/pages.js",
  "./js/pwa.js",
  "./js/app.js",
  "./js/config.js",
  "./js/account.js",
  "./js/submit.js",
  "./js/anim.js",
  "./fonts/fraunces-latin-soft-normal.woff2",
  "./fonts/fraunces-latin-ext-soft-normal.woff2",
  "./fonts/nunito-latin-wght-normal.woff2",
  "./fonts/nunito-latin-ext-wght-normal.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  // cache: "reload" = pomiń cache HTTP przeglądarki, żeby nie zapisać starej wersji pliku
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("podejrzyjkota-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // reklamy, linki zewnętrzne: bez cache
  if (url.pathname.endsWith(".apk")) return;              // plik APK pobieramy zawsze z sieci

  // strony HTML: najpierw sieć (świeża wersja), offline z cache
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
    );
    return;
  }
  // CSS i JS: najpierw sieć (inaczej po aktualizacji nowy HTML dostaje stary CSS), offline z cache
  if (/\.(css|js|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req, { cache: "no-cache" }).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }
  // pozostałe pliki (fonty, ikony, obrazki): najpierw cache, w tle odświeżenie
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
