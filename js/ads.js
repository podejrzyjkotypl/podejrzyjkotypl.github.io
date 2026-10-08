/*
 * podejrzyjkota: REKLAMY (konfiguracja + renderowanie)
 * ------------------------------------------------------------
 * Wszystkie miejsca reklamowe konfigurujesz TUTAJ. Kolejność wyboru treści dla każdego miejsca:
 *   1. sponsorHtml   jeśli niepusty, wstawiamy ten HTML (np. baner sklepu zoologicznego)
 *   2. AdSense       jeśli adsense.enabled = true i slot ma adsenseSlot
 *   3. placeholder   jeśli showPlaceholders = true, pusta ramka „Reklama” z rozmiarem (tryb demo)
 *   4. nic           miejsce się chowa
 *
 * UWAGA: AdSense wymaga własnego konta i akceptacji strony przez Google, polityki prywatności
 * oraz zgody na cookies (CMP) dla użytkowników z UE. Szczegóły: README.md, sekcja „Reklamy”.
 *
 * ZGODA: skrypt AdSense ładuje się WYŁĄCZNIE po zgodzie na cookies „Marketing” (js/consent.js).
 * Bez zgody miejsce pokazuje sponsora (jeśli jest), ramkę demo albo znika.
 */
window.PODEJRZYJKOTA_ADS = {
  // Pokazuj puste ramki „Reklama” tam, gdzie nie ma jeszcze reklamy (do podglądu). Na produkcji: false.
  showPlaceholders: true,

  adsense: {
    enabled: false,                       // włącz po akceptacji konta AdSense
    client: "ca-pub-XXXXXXXXXXXXXXXX"     // DO PODMIANY: Twój identyfikator wydawcy
  },

  // Rozmiary: [szerokość, wysokość] w px. "mobile" do 759 px szerokości ekranu, "desktop" od 760 px.
  slots: {
    top: {                                // baner pod hero, nad grą
      label: "Baner górny",
      desktop: [728, 90], mobile: [320, 100],
      adsenseSlot: "1111111111",          // DO PODMIANY: ID jednostki reklamowej z AdSense
      sponsorHtml: ""                     // np. '<a href="https://..." rel="sponsored noopener" target="_blank"><img src="img/sponsor-728x90.png" alt="Sklep zoologiczny XYZ" width="728" height="90"></a>'
    },
    grid: {                               // karta natywna w siatce kotów (rozmiar jak karta kota)
      label: "Karta natywna",
      native: true,
      every: 5,                           // po ilu kartach kotów wstawić kartę reklamową
      max: 1,                             // maksymalna liczba kart reklamowych w siatce
      adsenseSlot: "2222222222",          // DO PODMIANY (najlepiej jednostka „In-feed”/„natywna”)
      adsenseLayoutKey: "",               // opcjonalnie: data-ad-layout-key z AdSense (In-feed)
      sponsorHtml: ""
    },
    sidebar: {                            // prostokąt w panelu bocznym pod rankingiem
      label: "Panel boczny",
      desktop: [300, 250], mobile: [300, 250],
      adsenseSlot: "3333333333",          // DO PODMIANY
      sponsorHtml: ""
    },
    footer: {                             // baner nad stopką
      label: "Baner w stopce",
      desktop: [728, 90], mobile: [320, 50],
      adsenseSlot: "4444444444",          // DO PODMIANY
      sponsorHtml: ""
    },
    result: {                             // mały baner w oknie wyniku zakładu
      label: "Okno wyniku",
      desktop: [320, 50], mobile: [320, 50],
      adsenseSlot: "5555555555",          // DO PODMIANY
      sponsorHtml: ""
    }
  }
};

/* ---------- silnik (zwykle nie trzeba tu nic zmieniać) ---------- */
(function () {
  "use strict";
  const CFG = window.PODEJRZYJKOTA_ADS;
  const mq = window.matchMedia("(min-width: 760px)");
  let scriptAdded = false;

  // zgoda na cookies marketingowe (js/consent.js); bez API zgody = brak zgody
  const marketingOk = () => !!(window.PodejrzyjkotaConsent && window.PodejrzyjkotaConsent.has("marketing"));
  const useAdsense = (slot) =>
    CFG.adsense && CFG.adsense.enabled && slot.adsenseSlot && !/X{6,}/.test(CFG.adsense.client || "X".repeat(16)) && marketingOk();

  function hasContent(name) {
    const slot = CFG.slots[name];
    if (!slot) return false;
    return Boolean((slot.sponsorHtml && slot.sponsorHtml.trim()) || useAdsense(slot) || CFG.showPlaceholders);
  }

  function sizeOf(slot) {
    return (mq.matches ? slot.desktop : slot.mobile) || slot.desktop || slot.mobile || null;
  }

  function loadAdsense() {
    if (scriptAdded || !marketingOk()) return;
    scriptAdded = true;
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(CFG.adsense.client);
    document.head.appendChild(s);
  }

  function placeholderHtml(name, slot, size) {
    const dims = slot.native ? `<span class="ad-ph__size" data-ad-measure>natywna</span>` : `<span class="ad-ph__size">${size[0]} × ${size[1]}</span>`;
    return `<div class="ad-ph">
      <span class="ad-ph__icon" aria-hidden="true">📣</span>
      ${dims}
      <span class="ad-ph__txt">${slot.native ? "Miejsce na reklamę natywną<br>(rozmiar karty kota)" : "Miejsce na reklamę"}</span>
    </div>`;
  }

  // Wypełnia element `.ad-box` w zależności od konfiguracji. Zwraca false, gdy miejsce ma zniknąć.
  function render(box, name) {
    const slot = CFG.slots[name];
    const wrap = box.closest("[data-ad]") || box;
    if (!slot || !hasContent(name)) { wrap.hidden = true; return false; }
    wrap.hidden = false;
    const size = slot.native ? null : sizeOf(slot);
    if (size) { box.style.setProperty("--ad-w", size[0] + "px"); box.style.setProperty("--ad-h", size[1] + "px"); }
    box.dataset.mode = "";

    if (slot.sponsorHtml && slot.sponsorHtml.trim()) {
      box.dataset.mode = "sponsor";
      box.innerHTML = slot.sponsorHtml;
    } else if (useAdsense(slot)) {
      box.dataset.mode = "adsense";
      loadAdsense();
      const style = slot.native ? "display:block;width:100%;height:100%" : `display:inline-block;width:${size[0]}px;height:${size[1]}px`;
      const fmt = slot.native ? ` data-ad-format="fluid"${slot.adsenseLayoutKey ? ` data-ad-layout-key="${slot.adsenseLayoutKey}"` : ""}` : "";
      box.innerHTML = `<ins class="adsbygoogle" style="${style}" data-ad-client="${CFG.adsense.client}" data-ad-slot="${slot.adsenseSlot}"${fmt}></ins>`;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* bloker reklam itp. */ }
    } else {
      box.dataset.mode = "placeholder";
      box.innerHTML = placeholderHtml(name, slot, size);
      if (slot.native) measure(box);
    }
    return true;
  }

  // dla karty natywnej: pokaż rzeczywisty rozmiar ramki
  const ro = "ResizeObserver" in window ? new ResizeObserver((entries) => {
    entries.forEach((en) => {
      const t = en.target.querySelector("[data-ad-measure]");
      if (t) t.textContent = `${Math.round(en.contentRect.width)} × ${Math.round(en.contentRect.height)}`;
    });
  }) : null;
  function measure(box) { if (ro) ro.observe(box); }

  // force=false: pomija miejsca już wyrenderowane (żeby nie ładować AdSense dwa razy)
  function renderAll(root, force) {
    (root || document).querySelectorAll("[data-ad]").forEach((wrap) => {
      const box = wrap.querySelector(".ad-box");
      if (box && (force || !box.dataset.mode)) render(box, wrap.dataset.ad);
    });
  }

  // przy zmianie szerokości (desktop <-> mobile) przerysuj placeholdery i sponsorów (AdSense zostawiamy)
  mq.addEventListener("change", () => {
    document.querySelectorAll("[data-ad]").forEach((wrap) => {
      const box = wrap.querySelector(".ad-box");
      if (box && box.dataset.mode !== "adsense") render(box, wrap.dataset.ad);
    });
  });

  // HTML wrappera miejsca reklamowego (używane też przez app.js dla siatki i okna wyniku)
  function slotHtml(name, extraClass) {
    return `<div class="ad ad--${name} ${extraClass || ""}" data-ad="${name}" role="complementary" aria-label="Reklama">
      <span class="ad__label">Reklama</span>
      <div class="ad-box"></div>
    </div>`;
  }

  // zmiana zgody: po udzieleniu przerysuj miejsca (wtedy dopiero załaduje się AdSense),
  // po cofnięciu przeładuj stronę, żeby usunąć już wczytany skrypt reklam
  document.addEventListener("podejrzyjkota:consent", (e) => {
    const d = e.detail || {};
    if (!d.marketing && scriptAdded) { location.reload(); return; }
    document.querySelectorAll("[data-ad]").forEach((wrap) => {
      const box = wrap.querySelector(".ad-box");
      if (box && box.dataset.mode !== "adsense") render(box, wrap.dataset.ad);
    });
  });

  window.PodejrzyjkotaAds = { config: CFG, render, renderAll, hasContent, slotHtml };
  document.addEventListener("DOMContentLoaded", () => renderAll());
})();
