/*
 * podejrzyjkota: ZGODA NA COOKIES (baner + Google Consent Mode v2)
 * ------------------------------------------------------------
 * Ładuj ten plik W <head>, PRZED innymi skryptami (ustawia domyślne zgody "denied").
 *
 * Kategorie:
 *   necessary   zawsze włączone: stan gry (localStorage) i zapamiętanie tego wyboru
 *   statistics  analytics_storage (np. Google Analytics, obecnie strona NIE używa statystyk)
 *   marketing   ad_storage, ad_user_data, ad_personalization (Google AdSense)
 *
 * API:  PodejrzyjkotaConsent.has("marketing")  -> true/false
 *       PodejrzyjkotaConsent.open()            -> otwiera ustawienia (link „Ustawienia cookies”)
 *       PodejrzyjkotaConsent.onChange(fn)      -> fn(zgoda) po każdej zmianie
 *       zdarzenie document "podejrzyjkota:consent" (detail = zgoda)
 *
 * UWAGA: dla Google AdSense w EOG/UK/CH Google wymaga CMP certyfikowanego przez Google (TCF).
 * Ten baner to rozwiązanie tymczasowe, zobacz README.md, sekcja „Zgoda na cookies”.
 */
(function () {
  "use strict";
  var KEY = "podejrzyjkota:consent";
  var VERSION = 1;                       // podbij, gdy zmienisz kategorie lub politykę: baner pokaże się ponownie
  var MAX_AGE_DAYS = 365;                // po roku pytamy ponownie
  var POLICY_URL = "polityka-prywatnosci.html#cookies";

  /* ---------- Google Consent Mode v2: domyślnie wszystko odrzucone ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (typeof window.gtag !== "function") window.gtag = gtag;
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    personalization_storage: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500
  });
  window.gtag("set", "ads_data_redaction", true);

  function read() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY));
      var age = c && c.ts ? Date.now() - Date.parse(c.ts) : 0;
      if (c && c.v === VERSION && !(age > MAX_AGE_DAYS * 864e5)) return c;
    } catch (e) { /* brak dostępu do localStorage */ }
    return null;
  }
  function signals(c) {
    var m = c && c.marketing ? "granted" : "denied";
    var s = c && c.statistics ? "granted" : "denied";
    return { ad_storage: m, ad_user_data: m, ad_personalization: m, analytics_storage: s, personalization_storage: m };
  }

  var state = read();
  if (state) {
    window.gtag("consent", "update", signals(state));
    window.gtag("set", "ads_data_redaction", !state.marketing);
  }

  var listeners = [];
  var root = null, opener = null;
  var isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  function save(statistics, marketing) {
    var prev = state;
    state = { v: VERSION, necessary: true, statistics: !!statistics, marketing: !!marketing, ts: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* tryb prywatny: zgoda tylko do końca wizyty */ }
    window.gtag("consent", "update", signals(state));
    window.gtag("set", "ads_data_redaction", !state.marketing);
    var detail = { statistics: state.statistics, marketing: state.marketing, previous: prev ? { statistics: prev.statistics, marketing: prev.marketing } : null };
    listeners.forEach(function (fn) { try { fn(detail); } catch (e) { /* ignoruj */ } });
    document.dispatchEvent(new CustomEvent("podejrzyjkota:consent", { detail: detail }));
    close();
  }

  /* ---------- baner ---------- */
  function build() {
    if (root) return root;
    root = document.createElement("section");
    root.className = "cc";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "false");
    root.setAttribute("aria-labelledby", "cc-title");
    root.setAttribute("aria-describedby", "cc-desc");
    root.innerHTML =
      '<div class="cc__in">' +
        '<button type="button" class="cc__close" data-cc="close" aria-label="Zamknij bez zmian" hidden>×</button>' +
        '<h2 class="cc__title" id="cc-title" tabindex="-1"><span aria-hidden="true">🍪</span> Ciasteczka? Tylko za Twoją zgodą</h2>' +
        '<p class="cc__desc" id="cc-desc">Pamięć przeglądarki jest nam potrzebna, żeby działała gra (punkty, zakłady) i żeby zapamiętać ten wybór. ' +
        'Za Twoją zgodą użyjemy też plików cookies do statystyk i reklam (np. Google AdSense), dzięki którym strona może działać za darmo. ' +
        'Zdanie możesz zmienić w każdej chwili w stopce, w „Ustawieniach cookies”. <a href="' + POLICY_URL + '">Szczegóły w polityce prywatności</a>.</p>' +
        '<div class="cc__prefs" id="cc-prefs" hidden>' +
          opt("necessary", "Niezbędne", "Zapisują stan gry w Twojej przeglądarce i ten wybór. Bez nich strona nie zadziała, dlatego są zawsze włączone.", true) +
          opt("statistics", "Statystyki", "Pomagają policzyć odwiedziny i zobaczyć, co działa. Obecnie nie używamy żadnego narzędzia statystycznego. Jeśli je dodamy, włączy się tylko po Twojej zgodzie.") +
          opt("marketing", "Marketing", "Pozwalają wyświetlać reklamy Google AdSense, także dopasowane do Ciebie, i mierzyć ich skuteczność. Bez tej zgody nie ładujemy skryptu reklam Google.") +
        '</div>' +
        '<div class="cc__actions">' +
          '<button type="button" class="btn cc__btn" data-cc="reject">Odrzuć wszystkie</button>' +
          '<button type="button" class="btn btn--ghost cc__btn" data-cc="customize" aria-expanded="false" aria-controls="cc-prefs">Wybieram sam(a)</button>' +
          '<button type="button" class="btn btn--ghost cc__btn" data-cc="save" hidden>Zapisz wybór</button>' +
          '<button type="button" class="btn cc__btn" data-cc="accept">Akceptuję wszystkie</button>' +
        '</div>' +
      '</div>';
    document.body.insertBefore(root, document.body.firstChild);

    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cc]");
      if (!b) return;
      var a = b.getAttribute("data-cc");
      if (a === "accept") save(true, true);
      else if (a === "reject") save(false, false);
      else if (a === "save") save(box("statistics").checked, box("marketing").checked);
      else if (a === "customize") showPrefs(true);
      else if (a === "close") close();
    });
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state) { e.preventDefault(); close(); }
    });
    return root;
  }
  function opt(id, title, desc, locked) {
    return '<div class="cc__opt">' +
      '<div class="cc__opt-txt"><label for="cc-' + id + '"><strong>' + title + '</strong>' + (locked ? ' <span class="cc__always">zawsze aktywne</span>' : '') + '</label>' +
      '<p id="cc-' + id + '-d">' + desc + '</p></div>' +
      '<input type="checkbox" class="cc__switch" role="switch" id="cc-' + id + '" aria-describedby="cc-' + id + '-d"' + (locked ? " checked disabled" : "") + '>' +
    '</div>';
  }
  function box(id) { return root.querySelector("#cc-" + id); }

  function showPrefs(on) {
    root.querySelector("#cc-prefs").hidden = !on;
    root.querySelector('[data-cc="customize"]').hidden = on;
    root.querySelector('[data-cc="customize"]').setAttribute("aria-expanded", on ? "true" : "false");
    root.querySelector('[data-cc="save"]').hidden = !on;
    root.classList.toggle("cc--prefs", on);
    if (on) { var f = box("statistics"); if (f) f.focus(); }
  }

  function open(withPrefs) {
    build();
    box("statistics").checked = !!(state && state.statistics);
    box("marketing").checked = !!(state && state.marketing);
    root.querySelector('[data-cc="close"]').hidden = !state;
    root.hidden = false;
    document.documentElement.classList.add("cc-open");
    showPrefs(!!withPrefs);
    if (withPrefs) root.querySelector("#cc-title").focus();
  }
  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    document.documentElement.classList.remove("cc-open");
    if (opener && document.contains(opener)) opener.focus();
    opener = null;
  }

  // link / przycisk „Ustawienia cookies” (w stopce każdej strony)
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-cookie-settings]");
    if (!t) return;
    e.preventDefault();
    opener = t;
    open(true);
  });

  function init() {
    build();
    // W aplikacji Android nie ma reklam ani statystyk (brak dostępu do internetu), więc nie pytamy.
    if (!state && !isNativeApp) open(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.PodejrzyjkotaConsent = {
    get: function () { return state ? { statistics: state.statistics, marketing: state.marketing, ts: state.ts } : null; },
    has: function (cat) { return cat === "necessary" || !!(state && state[cat]); },
    open: function () { open(true); },
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} state = null; open(false); },
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
  };
})();
