/* podejrzyjkota: PWA (service worker + przycisk instalacji) i wykrywanie aplikacji Android */
(function () {
  "use strict";
  // Aplikacja Android (Capacitor) wstrzykuje window.Capacitor; tam nie rejestrujemy service workera.
  const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  document.documentElement.classList.toggle("is-native-app", isNativeApp);
  document.documentElement.classList.toggle("is-standalone", isStandalone && !isNativeApp);

  if (!isNativeApp && "serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => { /* np. brak HTTPS */ });
    });
  }

  let deferred = null;
  const buttons = () => Array.from(document.querySelectorAll("[data-pwa-install]"));
  const status = () => document.querySelector("[data-pwa-status]");

  function setStatus(txt) { const s = status(); if (s) s.textContent = txt; }
  function refresh() {
    buttons().forEach((b) => { b.disabled = false; b.dataset.ready = deferred ? "1" : "0"; });
    if (isNativeApp) setStatus("Korzystasz już z aplikacji podejrzyjkota. 🎉");
    else if (isStandalone) setStatus("Strona działa już jako zainstalowana aplikacja. 🎉");
    else if (deferred) setStatus("Twoja przeglądarka pozwala zainstalować podejrzyjkota jednym kliknięciem.");
    else setStatus("Jeśli przycisk nie otworzy okna instalacji, skorzystaj z instrukcji poniżej (menu ⋮ w Chrome).");
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    refresh();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    setStatus("Zainstalowano! Ikona podejrzyjkota jest na ekranie głównym. 🐾");
  });

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-pwa-install]");
    if (!b) return;
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice.catch(() => null);
      deferred = null;
      if (choice && choice.outcome === "accepted") setStatus("Instaluję… ikona pojawi się na ekranie głównym. 🐾");
      else setStatus("Instalacja anulowana. Możesz spróbować później.");
    } else {
      const guide = document.getElementById("instrukcja-pwa");
      if (guide) { guide.open = true; guide.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }
  });

  document.addEventListener("DOMContentLoaded", refresh);
})();
