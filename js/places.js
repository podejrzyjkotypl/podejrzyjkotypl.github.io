/* podejrzyjkota: miejscowości i województwa (wspólne dla filtra kotów, panelu admina i formularza „Dodaj kota”).
 * Lista miejscowości z współrzędnymi: data/miejscowosci.json (GeoNames cities500, CC BY 4.0), ładowana dopiero, gdy jest potrzebna.
 * Nic stąd nie trafia na serwer: wyszukiwanie i liczenie odległości odbywa się w przeglądarce. */
(function () {
  "use strict";
  var VOIVODESHIPS = ["dolnośląskie", "kujawsko-pomorskie", "lubelskie", "lubuskie", "łódzkie", "małopolskie", "mazowieckie", "opolskie", "podkarpackie", "podlaskie", "pomorskie", "śląskie", "świętokrzyskie", "warmińsko-mazurskie", "wielkopolskie", "zachodniopomorskie"];
  var base = (document.currentScript && document.currentScript.src.replace(/js\/places\.js(\?.*)?$/, "")) || "";
  var DATA_URL = base + "data/miejscowosci.json";

  // „Łomża” → „lomza”, „Jastrzębie-Zdrój” → „jastrzebie-zdroj” (bez polskich znaków, małe litery, spacje jako „-”)
  function norm(s) {
    return String(s || "").toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function voivFromSlug(slug) {
    var n = norm(slug);
    for (var i = 0; i < VOIVODESHIPS.length; i++) if (norm(VOIVODESHIPS[i]) === n) return VOIVODESHIPS[i];
    return "";
  }
  var towns = null, byName = null, loading = null;
  function load() {
    if (towns) return Promise.resolve(towns);
    if (loading) return loading;
    loading = fetch(DATA_URL).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (d) {
      towns = d.t.map(function (t, i) { return { name: t[0], lat: t[1], lon: t[2], voiv: d.v[t[3]], rank: i, key: norm(t[0]) }; });
      byName = {};
      towns.forEach(function (t) { (byName[t.key] = byName[t.key] || []).push(t); }); // kolejność: od największej
      return towns;
    }).catch(function (e) { loading = null; throw e; });
    return loading;
  }
  // miejscowość po nazwie; przy kilku o tej samej nazwie wybiera tę z podanego województwa, a w drugiej kolejności największą
  function find(name, voiv) {
    if (!byName) return null;
    var list = byName[norm(name)];
    if (!list) return null;
    if (voiv) { for (var i = 0; i < list.length; i++) if (list[i].voiv === voiv) return list[i]; }
    return list[0];
  }
  function suggest(q, limit, voiv) {
    if (!towns) return [];
    var n = norm(q);
    if (!n) return [];
    var starts = [], inner = [];
    for (var i = 0; i < towns.length && starts.length < limit; i++) {
      var t = towns[i];
      if (voiv && t.voiv !== voiv) continue;
      if (t.key.indexOf(n) === 0) starts.push(t);
      else if (inner.length < limit && t.key.indexOf("-" + n) > 0) inner.push(t);
    }
    return starts.concat(inner).slice(0, limit);
  }
  function distanceKm(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  var escH = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ---------- podpowiedzi pod polem tekstowym (combobox ARIA, obsługa klawiaturą) ----------
   * opts.source(query) -> [{ value, label, hint }]; opts.onPick(item) */
  var acId = 0;
  function autocomplete(input, opts) {
    if (!input || input.dataset.ac) return null;
    input.dataset.ac = "1";
    var id = "ac-" + (++acId);
    var wrap = document.createElement("span");
    wrap.className = "ac";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var list = document.createElement("ul");
    list.className = "ac__list"; list.id = id; list.setAttribute("role", "listbox"); list.hidden = true;
    list.setAttribute("aria-label", opts.label || "Podpowiedzi");
    wrap.appendChild(list);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", id);
    input.setAttribute("autocomplete", "off");
    var items = [], active = -1;
    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; }
    function setActive(i) {
      active = i;
      Array.prototype.forEach.call(list.children, function (li, k) { li.setAttribute("aria-selected", k === i ? "true" : "false"); });
      if (i >= 0 && list.children[i]) { input.setAttribute("aria-activedescendant", list.children[i].id); list.children[i].scrollIntoView({ block: "nearest" }); }
      else input.removeAttribute("aria-activedescendant");
    }
    function render() {
      items = opts.source(input.value) || [];
      if (!items.length) { list.innerHTML = opts.empty && input.value.trim() ? '<li class="ac__empty" role="presentation">' + escH(opts.empty) + "</li>" : ""; list.hidden = !list.innerHTML; input.setAttribute("aria-expanded", list.hidden ? "false" : "true"); active = -1; return; }
      list.innerHTML = items.map(function (it, i) {
        return '<li role="option" id="' + id + "-" + i + '" aria-selected="false" data-i="' + i + '"><span class="ac__v">' + escH(it.label || it.value) + "</span>" + (it.hint ? '<span class="ac__h">' + escH(it.hint) + "</span>" : "") + "</li>";
      }).join("");
      list.hidden = false; input.setAttribute("aria-expanded", "true"); setActive(-1);
    }
    function pick(i) { var it = items[i]; if (!it) return; input.value = it.value; close(); if (opts.onPick) opts.onPick(it); }
    input.addEventListener("input", render);
    input.addEventListener("focus", function () { if (input.value.trim() || opts.showOnFocus) render(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) render(); if (items.length) setActive((active + 1) % items.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (items.length) setActive(active <= 0 ? items.length - 1 : active - 1); }
      else if (e.key === "Enter") {
        if (!list.hidden && active >= 0) { e.preventDefault(); pick(active); }
        else if (opts.onEnter) { e.preventDefault(); close(); opts.onEnter(input.value, items); }
      }
      else if (e.key === "Escape") { if (!list.hidden) { e.preventDefault(); e.stopPropagation(); close(); } }
      else if (e.key === "Tab") close();
    });
    list.addEventListener("mousedown", function (e) { e.preventDefault(); }); // nie zabieraj fokusu z pola
    list.addEventListener("click", function (e) { var li = e.target.closest("li[data-i]"); if (li) pick(Number(li.dataset.i)); });
    input.addEventListener("blur", function () { setTimeout(close, 120); });
    return { refresh: render, close: close };
  }

  /* ---------- pole „Miejscowość” w formularzach: podpowiedzi z listy miejscowości + automatyczne województwo ---------- */
  function cityField(input, voivSelect) {
    if (!input) return;
    load().catch(function () {});
    function fillVoiv(t, force) {
      if (!voivSelect || !t) return;
      if (force || !voivSelect.value) {
        voivSelect.value = t.voiv;
        voivSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    autocomplete(input, {
      label: "Podpowiedzi miejscowości",
      source: function (q) {
        return suggest(q, 8, "").map(function (t) { return { value: t.name, hint: t.voiv, town: t }; });
      },
      onPick: function (it) { fillVoiv(it.town, true); input.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    input.addEventListener("change", function () { load().then(function () { fillVoiv(find(input.value, voivSelect && voivSelect.value), false); }).catch(function () {}); });
  }

  window.PodejrzyjkotaPlaces = {
    VOIVODESHIPS: VOIVODESHIPS, norm: norm, voivFromSlug: voivFromSlug, load: load, find: find, suggest: suggest,
    distanceKm: distanceKm, autocomplete: autocomplete, cityField: cityField, isLoaded: function () { return !!towns; }
  };
})();
