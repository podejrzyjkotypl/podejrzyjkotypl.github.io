/* podejrzyjkota: filtr kotów po lokalizacji (województwo, miejscowość, „Blisko mnie”).
 * Zmienia tylko to, które karty widać i w jakiej kolejności; gra (punkty, zakłady, kursy, ranking) działa jak dotąd.
 * Filtr zapisuje się w adresie strony (?woj=podlaskie&miasto=lomza) i w localStorage.
 * Lokalizacja z „Blisko mnie” zostaje w przeglądarce: nie zapisujemy jej i nie wysyłamy na serwer. */
(function () {
  "use strict";
  var Game = window.PodejrzyjkotaGame, P = window.PodejrzyjkotaPlaces;
  var host = document.querySelector("[data-filters]");
  if (!Game || !P || !host) return;
  var STORE = "podejrzyjkota:filtry";
  var V = P.VOIVODESHIPS, norm = P.norm;
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var catsWord = function (n) { return n === 1 ? "kota" : "kotów"; };
  function plural(n, one, few, many) { var a = n % 10, b = n % 100; if (n === 1) return one; if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few; return many; }
  var mq = window.matchMedia("(max-width: 639px)");

  /* ---------- stan filtra ---------- */
  var f = { woj: "", miasto: "" }; // woj: pełna nazwa województwa; miasto: nazwa w formie „lomza”
  var near = null;                 // { lat, lon } tylko w pamięci, po kliknięciu „Blisko mnie”
  (function restore() {
    var q = new URLSearchParams(location.search);
    if (q.has("woj") || q.has("miasto")) { f.woj = P.voivFromSlug(q.get("woj") || ""); f.miasto = norm(q.get("miasto") || ""); return; }
    try { var s = JSON.parse(localStorage.getItem(STORE) || "null"); if (s) { f.woj = V.indexOf(s.woj) >= 0 ? s.woj : ""; f.miasto = norm(s.miasto || ""); } } catch (e) { /* ignoruj */ }
  })();
  function persist() {
    try { if (f.woj || f.miasto) localStorage.setItem(STORE, JSON.stringify(f)); else localStorage.removeItem(STORE); } catch (e) { /* tryb prywatny */ }
    var q = new URLSearchParams(location.search);
    q.delete("woj"); q.delete("miasto");
    if (f.woj) q.set("woj", norm(f.woj));
    if (f.miasto) q.set("miasto", f.miasto);
    var qs = q.toString();
    history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }

  /* ---------- lokalizacja kotów ---------- */
  function locOf(cat) {
    var l = Game.locationOf(cat), voiv = l.voivodeship;
    if (!voiv && l.city && P.isLoaded()) { var t = P.find(l.city); if (t) voiv = t.voiv; }
    return { city: l.city, key: norm(l.city), voiv: voiv || "" };
  }
  function cats() { return Game.getCats(); }
  function matches(cat) {
    var l = locOf(cat);
    if (f.woj && l.voiv !== f.woj) return false;
    if (f.miasto && l.key !== f.miasto) return false;
    return true;
  }
  // miejscowości, w których są koty: [{ key, name, voiv, n }], od najliczniejszej
  function cityList(voiv) {
    var m = {};
    cats().forEach(function (c) {
      var l = locOf(c);
      if (!l.key || (voiv && l.voiv !== voiv)) return;
      (m[l.key] = m[l.key] || { key: l.key, name: l.city, voiv: l.voiv, n: 0 }).n++;
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name, "pl"); });
  }
  function cityName(key) {
    var c = cityList("").filter(function (x) { return x.key === key; })[0];
    if (c) return c.name;
    var t = P.isLoaded() && P.find(key);
    return t ? t.name : key.replace(/-/g, " ").replace(/^./, function (x) { return x.toUpperCase(); });
  }

  /* ---------- widok ---------- */
  host.innerHTML =
    '<div class="filters__top">' +
      '<p class="filters__count" data-f-count aria-live="polite"></p>' +
      '<button class="btn btn--soft btn--sm filters__toggle" type="button" data-f-toggle aria-expanded="false" aria-controls="filtry-panel"><span aria-hidden="true">⚙️</span> Filtry<span class="filters__badge" data-f-badge hidden></span></button>' +
    "</div>" +
    '<div class="filters__body" id="filtry-panel" data-f-body>' +
      '<div class="filters__row">' +
        '<label class="filters__field"><span>Województwo</span><select data-f-woj></select></label>' +
        '<label class="filters__field filters__field--city"><span>Miejscowość</span><input type="search" data-f-city placeholder="np. Łomża" enterkeyhint="search" spellcheck="false"></label>' +
        '<div class="filters__btns">' +
          '<button class="btn btn--ghost btn--sm filters__near" type="button" data-f-near aria-pressed="false"><span aria-hidden="true">📍</span> <span data-f-near-txt>Blisko mnie</span></button>' +
          '<button class="btn btn--soft btn--sm" type="button" data-filters-clear hidden>Wyczyść</button>' +
        "</div>" +
      "</div>" +
      '<div class="filters__chips" data-f-chips role="group" aria-label="Najczęstsze miejscowości"></div>' +
      '<p class="filters__msg" data-f-msg role="status" hidden></p>' +
    "</div>";
  var $ = function (s) { return host.querySelector(s); };
  var sel = $("[data-f-woj]"), input = $("[data-f-city]"), chips = $("[data-f-chips]"), msg = $("[data-f-msg]");
  var nearBtn = $("[data-f-near]"), clearBtn = $("[data-filters-clear]"), toggle = $("[data-f-toggle]"), body = $("[data-f-body]");

  var open = false;
  function syncCollapse() {
    var collapsed = mq.matches && !open;
    host.classList.toggle("is-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    body.hidden = collapsed;
  }
  toggle.addEventListener("click", function () { open = !open; syncCollapse(); if (open) sel.focus(); });
  if (mq.addEventListener) mq.addEventListener("change", syncCollapse);

  function setMsg(t) { msg.textContent = t || ""; msg.hidden = !t; }

  function renderControls() {
    var all = cats(), counts = {};
    all.forEach(function (c) { var v = locOf(c).voiv; if (v) counts[v] = (counts[v] || 0) + 1; });
    sel.innerHTML = '<option value="">Cała Polska (' + all.length + ")</option>" + V.map(function (v) {
      var n = counts[v] || 0;
      return '<option value="' + esc(v) + '"' + (v === f.woj ? " selected" : "") + (n || v === f.woj ? "" : " disabled") + ">" + esc(v) + " (" + n + ")</option>";
    }).join("");
    if (document.activeElement !== input) input.value = f.miasto ? cityName(f.miasto) : "";
    var top = cityList(f.woj).slice(0, 6);
    chips.innerHTML = top.length > 1 || f.miasto ? top.map(function (c) {
      return '<button type="button" class="fchip" data-city="' + esc(c.key) + '" aria-pressed="' + (c.key === f.miasto) + '">' + esc(c.name) + ' <span class="fchip__n">' + c.n + "</span></button>";
    }).join("") : "";
    chips.hidden = !chips.innerHTML;
    var active = (f.woj ? 1 : 0) + (f.miasto ? 1 : 0) + (near ? 1 : 0);
    clearBtn.hidden = !active;
    var badge = $("[data-f-badge]"); badge.hidden = !active; badge.textContent = active ? String(active) : "";
    nearBtn.setAttribute("aria-pressed", near ? "true" : "false");
    nearBtn.classList.toggle("is-on", !!near);
  }

  function distances() {
    if (!near || !P.isLoaded()) return null;
    var d = {};
    cats().forEach(function (c) {
      var l = Game.locationOf(c); if (!l.city) return;
      var t = P.find(l.city, l.voivodeship); if (t) d[c.id] = P.distanceKm(near, t);
    });
    return d;
  }
  var emptyHtml = '<p class="board__empty-t">Nie ma tu jeszcze kotów z tej okolicy.</p>' +
    '<p>Spróbuj innej miejscowości albo <button type="button" class="link-btn link-btn--inline" data-filters-clear>wyczyść filtry</button>.</p>' +
    '<p>Znasz kota z tej okolicy, który szuka domu? <a href="dodaj-kota.html">Dodaj kota</a>.</p>';

  var first = true;
  function apply(opts) {
    renderControls();
    Game.setView({ match: f.woj || f.miasto ? matches : null, dist: distances(), empty: f.woj && !P.isLoaded() ? "" : emptyHtml });
    var shown = Game.visibleCount(), total = cats().length;
    var where = [f.miasto ? cityName(f.miasto) : "", f.woj && !f.miasto ? "woj. " + f.woj : ""].filter(Boolean).join("");
    $("[data-f-count]").innerHTML = "Pokazuję <strong>" + shown + "</strong> z " + total + " " + catsWord(total) +
      (where ? ' <span class="filters__where">· ' + esc(where) + "</span>" : "") + (near ? ' <span class="filters__where">· od najbliższych</span>' : "");
    if (!first && !(opts && opts.quiet)) {
      var board = document.querySelector("[data-board]");
      if (board && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) { board.classList.remove("is-filtered"); void board.offsetWidth; board.classList.add("is-filtered"); }
    }
    first = false;
  }
  function change() { persist(); apply(); }

  /* ---------- zdarzenia ---------- */
  sel.addEventListener("change", function () {
    f.woj = sel.value;
    if (f.miasto && f.woj) { var c = cityList(f.woj).some(function (x) { return x.key === f.miasto; }); if (!c) f.miasto = ""; }
    change();
  });
  function pickCity(key) {
    f.miasto = key;
    if (key) { var c = cityList("").filter(function (x) { return x.key === key; })[0]; if (c && c.voiv) f.woj = c.voiv; }
    input.value = key ? cityName(key) : "";
    change();
  }
  P.autocomplete(input, {
    label: "Miejscowości z kotami",
    showOnFocus: false,
    empty: "Brak kotów w tej miejscowości",
    source: function (q) {
      var n = norm(q); if (!n) return [];
      return cityList(f.woj).filter(function (c) { return c.key.indexOf(n) === 0 || c.key.indexOf("-" + n) > 0; }).slice(0, 8)
        .map(function (c) { return { value: c.name, key: c.key, hint: c.n + " " + plural(c.n, "kot", "koty", "kotów") + (c.voiv ? " · " + c.voiv : "") }; });
    },
    onPick: function (it) { pickCity(it.key); },
    onEnter: function (val, items) { if (!norm(val)) return pickCity(""); pickCity(items.length ? items[0].key : norm(val)); }
  });
  input.addEventListener("input", function () { if (!input.value.trim() && f.miasto) { f.miasto = ""; change(); } });
  chips.addEventListener("click", function (e) {
    var b = e.target.closest("[data-city]"); if (!b) return;
    pickCity(b.dataset.city === f.miasto ? "" : b.dataset.city);
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-filters-clear]")) return;
    f.woj = ""; f.miasto = ""; near = null; setMsg(""); input.value = "";
    change();
    if (e.target.closest(".board__empty")) sel.focus();
  });

  nearBtn.addEventListener("click", function () {
    if (near) { near = null; setMsg(""); apply(); return; }
    if (!navigator.geolocation) { setMsg("Twoja przeglądarka nie udostępnia lokalizacji. Wybierz miejscowość z listy."); return; }
    var txt = $("[data-f-near-txt]");
    nearBtn.disabled = true; nearBtn.setAttribute("aria-busy", "true"); txt.textContent = "Szukam…";
    var done = function () { nearBtn.disabled = false; nearBtn.removeAttribute("aria-busy"); txt.textContent = "Blisko mnie"; };
    navigator.geolocation.getCurrentPosition(function (pos) {
      P.load().then(function () {
        done();
        near = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        var d = distances(), known = Object.keys(d || {}).length;
        setMsg("Koty są ułożone od najbliższych." + (known < cats().length ? " Koty bez znanej miejscowości są na końcu." : "") + " Twoja lokalizacja zostaje w tej przeglądarce.");
        apply();
      }).catch(function () { done(); setMsg("Nie udało się wczytać listy miejscowości. Sprawdź internet i spróbuj ponownie."); });
    }, function (err) {
      done();
      setMsg(err && err.code === 1 ? "Brak zgody na lokalizację. Możesz ją włączyć w ustawieniach przeglądarki albo wybrać miejscowość z listy." : "Nie udało się ustalić lokalizacji. Spróbuj ponownie albo wybierz miejscowość z listy.");
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  });

  document.addEventListener("podejrzyjkota:cats", function () { apply({ quiet: true }); });

  /* ---------- start ---------- */
  syncCollapse();
  if (f.woj || f.miasto) persist(); // link z filtrem zapamiętujemy, a zapamiętany filtr pokazujemy w adresie
  apply({ quiet: true });
  // lista miejscowości (województwa kotów bez wpisanego województwa, odległości): od razu przy aktywnym filtrze, inaczej w wolnej chwili
  var later = window.requestIdleCallback || function (fn) { setTimeout(fn, 1500); };
  var loadPlaces = function () { P.load().then(function () { apply({ quiet: true }); }).catch(function () { /* filtr działa dalej na samych danych kotów */ }); };
  if (f.woj || f.miasto) loadPlaces(); else later(loadPlaces);
})();
