/* podejrzyjkota: strona główna w układzie „Kocia Gazeta” (Demo A), podpięta pod prawdziwy backend.
 * Koty: Supabase (js/account.js -> Game.setCats). Punkty: gość = localStorage (jak dotąd, +2 za odkrycie),
 * konto = RPC reveal_card na serwerze. Poziomy/XP/odznaki: js/progress.js. Ranking: get_leaderboard. Bez zakładów. */
(function () {
  "use strict";
  const DATA = window.PODEJRZYJKOTA_DATA || { cats: [], shelters: {}, avatars: [] };
  DATA.shelters = DATA.shelters || {};
  const CFG = window.PODEJRZYJKOTA_CONFIG || {};
  const STORE_KEY = "podejrzyjkota:v1", START_POINTS = 100, REVEAL_BONUS = 2, ALL_CARDS_BONUS = 20;
  const CARD_TONE = "#F3E9DC";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const app = $("#app");
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const Progress = () => window.PodejrzyjkotaProgress;
  const progress = (t, cat) => { const P = Progress(); if (P) try { P.event(t, cat); } catch (e) { /* ignore */ } };
  const AVATAR_CATS = Object.fromEntries((DATA.avatars || []).map((c) => [c.id, { ...c }]));

  let C = (DATA.cats || []).filter((c) => !c.hidden);
  let byId = {};
  const reindex = () => { byId = Object.fromEntries(C.map((c) => [c.id, c])); };
  reindex();
  let catsReady = false;

  /* ---------- stan (ten sam format co dotychczasowa gra) ---------- */
  function loadState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { s = null; }
    const base = { v: 1, points: START_POINTS, revealed: [], seen: [], bets: [], day: 1, round: 1, adoptions: {}, streak: 0, bestStreak: 0, badges: [], rivals: [], order: [], nextBetId: 1 };
    if (!s || s.v !== 1) return base;
    s = Object.assign(base, s);
    (s.bets || []).forEach((b) => { if (b.status === "active") { s.points += b.stake; b.status = "void"; b.payout = b.stake; } });
    return s;
  }
  let state = loadState(), remote = null;
  const save = () => { if (remote) return; try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };
  const seen = (id) => state.seen.includes(id);
  function stateFromSnapshot(snap, prev) {
    const p = snap.profile;
    return Object.assign({}, prev || {}, { v: 1, points: p.points, seen: (snap.reveals || []).slice(), revealed: prev ? prev.revealed : (snap.reveals || []).slice(),
      bets: [], badges: (snap.badges || []).slice(), streak: p.streak, bestStreak: p.best_streak, userId: p.id });
  }

  /* ---------- HUD ---------- */
  let level = 1;
  function hud(bump) {
    const v = Progress() && Progress().view ? Progress().view() : null;
    const l = v ? v.level : 1;
    const x = $("#xp");
    x.textContent = `⭐ ${state.points} pkt · poz. ${l}`;
    if (l > level && bump !== false && catsReady) setTimeout(confetti, 300);
    level = l;
  }
  document.addEventListener("podejrzyjkota:progress", () => hud());
  function toast(t) { const e = $("#toast"); e.innerHTML = t; e.classList.add("on"); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove("on"), 2600); }
  function gc(path, title) { try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, title, event: true }); } catch (e) { /* ignore */ } }

  /* ---------- zdjęcie / ilustracja ---------- */
  function ph(c, cls = "") {
    if (c.photo) return `<div class="ph ${cls}"><div class="bg" style="background-image:url('${esc(c.photo)}')"></div><img src="${esc(c.photo)}" alt="${esc(c.name)}" loading="lazy" onload="if(this.naturalHeight>this.naturalWidth)this.parentNode.classList.add('portrait')" onerror="this.parentNode.classList.add('err')"></div>`;
    const art = window.CatArt ? window.CatArt.catSvg(Object.assign({}, c, { look: Object.assign({}, c.look, { bg: CARD_TONE }) }), { title: false }) : "";
    return `<div class="ph art ${cls}" role="img" aria-label="${esc(c.name)}">${art}</div>`;
  }
  const isAdopted = (c) => c.status === "adopted";
  const avail = () => C.filter((c) => !isAdopted(c));
  const cityOf = (c) => c.city || (DATA.shelters[c.shelter] || {}).city || "";
  const cities = () => [...new Set(avail().map(cityOf).filter(Boolean))];

  /* ---------- kontakt (jak w dotychczasowej grze) ---------- */
  const digits = (p) => String(p || "").replace(/[^0-9+]/g, "");
  function telHref(p) { let d = digits(p); if (/^[0-9]{9}$/.test(d)) d = "+48" + d; else if (/^0048[0-9]{9}$/.test(d)) d = "+" + d.slice(2); return "tel:" + d; }
  function fmtPhone(p) { const d = digits(p), m = d.match(/^(?:\+48|0048)?([0-9]{3})([0-9]{3})([0-9]{3})$/); return m ? (/^(\+48|0048)/.test(d) ? "+48 " : "") + m.slice(1).join(" ") : String(p).trim(); }
  function contactOf(c) {
    const sh = DATA.shelters[c.shelter] || {};
    const listing = /^https?:\/\/\S+$/i.test(String(c.listingUrl || "")) ? String(c.listingUrl) : "";
    const viaListing = !c.contactPhone && !c.contactEmail && !DATA.shelters[c.shelter] && !!listing;
    const own = !!(c.contactPhone || c.contactEmail) || viaListing;
    return { own, viaListing, listing, name: own ? (c.contactName || "") : (sh.name || ""), phone: own ? (c.contactPhone || "") : "",
      email: viaListing ? "" : own ? (c.contactEmail || "") : (sh.email || DATA.contactEmail || "") };
  }
  function mailto(c, email) {
    const subj = `Adopcja: ${c.name} (podejrzyjkota)`;
    const body = `Dzień dobry,\n\nchciał(a)bym poznać ${c.sex === "kotka" ? "kotkę" : "kota"} ${c.nameAcc || c.name} i zapytać o adopcję.\n\nPozdrawiam`;
    return `mailto:${email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  }

  /* ---------- efekty ---------- */
  function fx(el, n) {
    if (RM) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 10; i++) { const h = document.createElement("span"); h.className = "burst"; h.textContent = "♥"; const a = i / 10 * 6.28; h.style.cssText = `left:${cx}px;top:${cy}px;--x:${Math.cos(a) * 120}px;--y:${Math.sin(a) * 120}px`; document.body.appendChild(h); setTimeout(() => h.remove(), 800); }
    const t = document.createElement("span"); t.className = "fly"; t.textContent = "+" + n; t.style.cssText = `left:${cx}px;top:${cy}px`; document.body.appendChild(t);
    const x = $("#xp").getBoundingClientRect();
    requestAnimationFrame(() => { t.style.transform = `translate(${x.left + x.width / 2 - cx}px,${x.top + x.height / 2 - cy}px) scale(.6)`; t.style.opacity = .2; });
    setTimeout(() => { t.remove(); const p = $("#xp"); p.classList.remove("bump"); void p.offsetWidth; p.classList.add("bump"); }, 700);
  }
  function confetti() {
    if (RM) return;
    const cs = ["#e0672b", "#f4a259", "#7c9a7e", "#2b211b", "#ffd166"];
    for (let i = 0; i < 70; i++) { const c = document.createElement("i"); c.className = "conf"; c.style.cssText = `left:${Math.random() * 100}vw;background:${cs[i % 5]};animation-delay:${Math.random() * .4}s;--r:${Math.random() * 720}deg;--d:${(Math.random() - .5) * 200}px`; document.body.appendChild(c); setTimeout(() => c.remove(), 2600); }
  }
  function award(id) {
    const had = state.badges.includes(id); if (!had) state.badges.push(id);
    const P = Progress(); if (P) return P.giveBadge(id); return !had;
  }

  /* ---------- odkrycie kota ---------- */
  function unlockInList(id) {
    const it = document.querySelector(`.list a[href="#/kot/${CSS.escape(id)}"]`);
    if (it) { it.classList.remove("locked"); const b = it.querySelector("b"); if (b && byId[id]) b.textContent = byId[id].name; }
  }
  async function reveal(id, el) {
    const cat = byId[id]; if (!cat) return;
    if (!state.revealed.includes(id)) { state.revealed.push(id); progress("flip", cat); gc("kot/" + id + "/odkryty"); }
    if (seen(id)) { save(); return; }
    state.seen.push(id);
    unlockInList(id);
    if (el) fx(el, REVEAL_BONUS);
    if (remote) {
      try {
        const r = await remote.rpc("reveal_card", { p_cat_id: id });
        if (r && typeof r.points === "number") state.points = r.points;
        if (r && r.gained && r.gained !== REVEAL_BONUS) toast(`+${r.gained} pkt za odkrycie kota 🐾`);
        else if (!el && r && r.gained) toast(`+${r.gained} pkt za odkrycie kota 🐾`);
        (r && r.new_badges || []).forEach(award);
        if ((r && r.new_badges || []).includes("allcards")) confetti();
        progress("reveal_new", cat);
      } catch (e) { toast("Nie udało się zapisać odkrycia. Spróbuj ponownie."); state.seen = state.seen.filter((x) => x !== id); }
      setTimeout(hud, el && !RM ? 700 : 0);
      return;
    }
    state.points += REVEAL_BONUS;
    award("peek");
    progress("reveal_new", cat);
    if (!el) toast(`+${REVEAL_BONUS} pkt za odkrycie kota 🐾`);
    if (C.length && C.every((c) => seen(c.id)) && award("allcards")) { state.points += ALL_CARDS_BONUS; confetti(); toast(`🃏 Wszystkie koty odkryte! +${ALL_CARDS_BONUS} pkt`); }
    save();
    setTimeout(hud, el && !RM ? 700 : 0);
  }

  /* ---------- animacje strony ---------- */
  function count() { $$("[data-count]").forEach((e) => { const n = +e.dataset.count; if (RM) return; let t0; const st = (ts) => { t0 = t0 == null ? ts : t0; const k = Math.min(1, (ts - t0) / 1100); e.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(st); }; requestAnimationFrame(st); }); }
  let io;
  function reveals() { if (io) io.disconnect(); if (RM || !("IntersectionObserver" in window)) return; io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 }); $$("main .wrap>*:not(.stackwrap),.mag>a,.cols>a,.grid2>*,.list>a").forEach((e, i) => { e.classList.add("rv"); e.style.transitionDelay = (i % 4) * 70 + "ms"; io.observe(e); }); }
  function parallax() { const c = $("#collage"); if (!c || RM) return; c.closest(".hero").onpointermove = (e) => { const r = c.getBoundingClientRect(); c.style.setProperty("--px", (e.clientX - r.left) / r.width - .5); c.style.setProperty("--py", (e.clientY - r.top) / r.height - .5); }; }
  function navInd() { $$(".bottomnav,.topnav").forEach((n) => { const a = n.querySelector("a.on"); let ind = n.querySelector(".ind"); if (!ind) { ind = document.createElement("span"); ind.className = "ind"; n.appendChild(ind); } if (!a) { ind.style.opacity = 0; return; } ind.style.opacity = 1; ind.style.width = a.offsetWidth + "px"; ind.style.transform = `translateX(${a.offsetLeft}px)`; }); }
  function skel() { $$("main .ph img").forEach((i) => { const p = i.parentNode; if (!i.complete) { p.classList.add("sk"); i.addEventListener("load", () => p.classList.remove("sk"), { once: true }); } }); }
  function peek() { if ($(".peek")) return; document.body.insertAdjacentHTML("beforeend", '<div class="peek" aria-hidden="true"><svg viewBox="0 0 80 50"><path d="M10 50V22l8-18 10 14h24l10-14 8 18v28z" fill="#e0672b"/><circle cx="28" cy="32" r="4" fill="#2b211b"/><circle cx="52" cy="32" r="4" fill="#2b211b"/><path d="M37 40l3 3 3-3" stroke="#2b211b" stroke-width="2" fill="none"/></svg></div>'); }

  const loading = '<div class="loading">Wczytujemy koty… 🐾</div>';
  const SOCIAL = (document.querySelector(".foot .social") || {}).outerHTML || "";

  /* ---------- widoki ---------- */
  const R = {
    "": () => {
      const A = avail(); if (!A.length) return catsReady ? '<div class="loading">Chwilowo brak kotów do pokazania.</div>' : loading;
      const f = A.slice(0, 5), m1 = A[3 % A.length], m2 = A[7 % A.length], cs = cities();
      return `<section class="hero"><svg class="walker" viewBox="0 0 120 70" aria-hidden="true"><g fill="#2b211b"><ellipse cx="60" cy="38" rx="32" ry="15"/><circle cx="96" cy="28" r="12"/><path d="M88 20l3-12 6 9zM100 17l5-11 3 11z"/><path class="tail" d="M28 34c-14-4-18-18-10-26" stroke="#2b211b" stroke-width="6" fill="none" stroke-linecap="round"/><rect class="lg l1" x="38" y="46" width="6" height="18" rx="3"/><rect class="lg l2" x="48" y="46" width="6" height="18" rx="3"/><rect class="lg l1" x="70" y="46" width="6" height="18" rx="3"/><rect class="lg l2" x="80" y="46" width="6" height="18" rx="3"/></g><circle cx="100" cy="27" r="2" fill="#f4a259"/></svg><div><div class="kicker">Wydanie nr 1 · jesień 2026</div><h1>Każdy kot<br>zasługuje na <i>dom.</i></h1><p class="lead">Zbieramy ogłoszenia kotów do adopcji z całej Polski w jednym, ciepłym miejscu. Przesuwaj karty, odkrywaj koty, zbieraj punkty — i znajdź swojego.</p><p><a class="btn" href="#/koty">Zacznij przeglądać →</a> <a class="btn ghost" href="#/dokumenty">Dokumenty adopcji</a></p>
<div class="stats"><div><b data-count="${A.length}">${A.length}</b>kotów czeka</div><div><b data-count="${cs.length}">${cs.length}</b>miejscowości</div><div><b>0 zł</b>zawsze za darmo</div></div></div>
<div class="collage" id="collage"><span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>
<a class="cover float f1" href="#/kot/${esc(f[0].id)}">${ph(f[0])}<div class="cap"><span class="kicker" style="color:#ffd3b0">Kot z okładki</span><b>${esc(f[0].name)}</b>${esc(cityOf(f[0]))} · ${esc(f[0].age)}</div></a>
<a class="mini float f2" href="#/kot/${esc(m1.id)}" aria-label="${esc(m1.name)}">${ph(m1)}</a><a class="mini float f3" href="#/kot/${esc(m2.id)}" aria-label="${esc(m2.name)}">${ph(m2)}</a><span class="heartfloat" aria-hidden="true">♥</span></div></section>
<hr class="rule"><section class="wrap"><div class="kicker">W tym wydaniu</div><h2>Najnowsze koty</h2><div class="mag">${f.map((c) => `<a href="#/kot/${esc(c.id)}">${ph(c)}<h3>${esc(c.name)}</h3><div class="meta">${esc(cityOf(c))} · ${esc(c.sex)} · ${esc(c.age)}</div></a>`).join("")}</div></section>
<section class="wrap"><div class="cols">
<a class="story" href="#/koty"><div class="num">01</div><h3>Odkrywaj karty</h3><p class="meta">Przesuń kartę w prawo, by odsłonić kota. Za każde odkrycie +${REVEAL_BONUS} punkty.</p></a>
<a class="story" href="#/gry"><div class="num">02</div><h3>Graj w mini-gry</h3><p class="meta">Wydaj punkty w Moim Kotku albo Kocim Wężu. Ranking i tak liczy wszystko, co zdobyłeś.</p></a>
<a class="story" href="#/dokumenty"><div class="num">03</div><h3>Adoptuj mądrze</h3><p class="meta">Darmowe wzory umowy adopcyjnej i lista kontrolna przed przyjazdem kota.</p></a></div></section>`;
    },
    koty: () => !C.length ? loading : `<section class="wrap"><div class="kicker">Przeglądaj</div><h2>Poznaj koty</h2><div class="stackwrap"><div><div class="chips" id="chips"><button class="chip on" data-c="">Wszystkie</button>${cities().map((c) => `<button class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div><div class="stack" id="stack"></div>
<div class="actions"><button class="round" id="nope" title="Pomiń" aria-label="Pomiń">✕</button><button class="round big" id="yes" title="Odkryj" aria-label="Odkryj">♥</button><button class="round" id="info" title="Szczegóły" aria-label="Szczegóły">i</button></div><p class="meta" style="text-align:center">Przesuń palcem w prawo (odkryj) lub w lewo (dalej)</p></div>
<div><h3>Wszystkie w wybranym miejscu</h3><div class="list" id="list"></div></div></div></section>`,
    kot: (id) => {
      const c = byId[id]; if (!c) return catsReady ? '<div class="wrap">Nie ma takiego kota. <a href="#/koty">Wróć do kotów</a></div>' : loading;
      setTimeout(() => { reveal(c.id); progress("details", c); }, 0);
      const ct = contactOf(c), da = `data-adopt data-cat="${esc(c.id)}"`;
      const listing = ct.listing ? `<a class="btn" href="${esc(ct.listing)}" target="_blank" rel="noopener noreferrer nofollow" ${ct.viaListing ? da : ""}>Zobacz ogłoszenie${/olx\./i.test(ct.listing) ? " na OLX" : ""} ↗</a>` : "";
      return `<section class="wrap"><a href="#/koty" class="meta">← wróć do kotów</a><div class="detail" style="margin-top:14px">${ph(c)}<div><div class="kicker">${esc(cityOf(c))}${c.voivodeship ? ", " + esc(c.voivodeship) : ""}</div>${isAdopted(c) ? '<span class="adopted-tag">🎉 Ma już dom</span>' : ""}<h1 style="font-size:clamp(38px,6vw,64px)">${esc(c.name)}</h1><p class="meta">${esc(c.sex)} · ${esc(c.age)}</p><div class="tags">${(c.traits || []).map((t) => `<span style="background:#efe3d3;color:#6b4a2f">${esc(t)}</span>`).join("")}</div>
<p style="margin-top:18px">${esc(isAdopted(c) && c.adoptedNote ? c.adoptedNote : c.story)}</p><span class="ai">✦ OPIS NAPISAŁA AI NA PODSTAWIE OGŁOSZENIA</span>
<div class="contact"><b>Kontakt do opiekuna${ct.name ? ": " + esc(ct.name) : ""}</b>${ct.phone ? `<a class="btn" href="${esc(telHref(ct.phone))}" ${da}>📞 ${esc(fmtPhone(ct.phone))}</a>` : ""}${ct.email ? `<a class="btn ghost" href="${esc(mailto(c, ct.email))}" ${da}>✉ ${esc(ct.email)}</a>` : ""}${listing}<a class="meta" href="adoptowalem.html">Adoptowałeś tego kota? Daj znać →</a></div></div></div></section>`;
    },
    gry: () => `<section class="wrap"><div class="kicker">Mini-gry</div><h2>Wydaj punkty, ranking zostaje</h2><p class="lead">Masz ${state.points} pkt. Wydawanie punktów nie obniża miejsca w rankingu — liczy się wszystko, co zdobyłeś.</p><div class="grid2">
<a class="story" href="kotek.html"><div class="num">🐱</div><h3>Mój Kotek</h3><p class="meta">Opiekuj się wirtualnym kotem, kupuj zabawki i smakołyki.</p></a><a class="story" href="waz.html"><div class="num">🐍</div><h3>Koci Wąż</h3><p class="meta">Zbieraj rybki i rośnij — klasyka w kociej wersji.</p></a></div><p class="meta" style="margin-top:14px"><a href="gry.html">Wszystkie gry →</a></p></section>`,
    dokumenty: () => `<section class="wrap"><div class="kicker">Poradnik</div><h2>Dokumenty do adopcji</h2><div class="grid2">${[["Umowa adopcyjna kota", "Wzór do wydruku dla obu stron."], ["Zobowiązanie do sterylizacji / kastracji", "Krótki dokument do podpisania przy adopcji."], ["Ankieta przedadopcyjna", "Pytania, które warto zadać przyszłemu opiekunowi."], ["Wyprawka dla kota", "Co przygotować w domu przed przyjazdem kota."]].map(([a, b]) => `<div class="panel"><h3>📄 ${a}</h3><p class="meta">${b}</p><a class="btn ghost" href="dokumenty.html">Pobierz za darmo</a></div>`).join("")}</div><p class="meta" style="margin-top:14px"><span class="ai">✦ AI</span> Wzory przygotowane z pomocą AI i sprawdzone przez nas.</p></section>`,
    ranking: () => {
      const v = Progress() && Progress().view ? Progress().view() : { level: 1, xp: 0 };
      const P = Progress(), L = P && P.LEVELS ? P.LEVELS : null, cur = L ? L[v.level - 1] : null, nx = L ? L[v.level] : null;
      const pct = cur && nx ? Math.min(100, Math.round((v.xp - cur.xp) / (nx.xp - cur.xp) * 100)) : 100;
      setTimeout(loadBoard, 0);
      return `<section class="wrap"><div class="kicker">Ranking</div><h2>Najlepsi odkrywcy</h2><div class="grid2"><div class="panel"><h3>Twój poziom: ${v.level}${cur ? " · " + esc(cur.name) : ""}</h3><div class="bar"><i style="width:${pct}%"></i></div><p class="meta">${state.points} pkt · ${v.xp} XP · odkryte koty: ${state.seen.filter((id) => byId[id]).length}/${C.length}</p>${remote ? "" : '<p class="meta">Zaloguj się, żeby trafić do rankingu i zapisywać punkty na koncie.</p><button class="btn" type="button" data-action="login">Zaloguj się</button>'}</div><ol class="panel rank" id="board" style="list-style:none;margin:0"><li><span>Wczytuję ranking…</span></li></ol></div></section>`;
    },
    wiecej: () => `<section class="wrap"><h2>Więcej</h2><div class="grid2"><div class="panel"><a class="btn" href="dodaj-kota.html">+ Dodaj kota</a> <a class="btn ghost" href="adoptowalem.html">Adoptowałem kota</a> <a class="btn ghost" href="#/ranking">Ranking</a><h3 style="margin-top:20px">Kontakt</h3><p>Sylwester Kopeć, Łomża<br><a href="mailto:podlasie.studio.mail@gmail.com">podlasie.studio.mail@gmail.com</a><br><a href="kontakt.html">Formularz i dane kontaktowe →</a></p><h3>Obserwuj nas</h3>${SOCIAL}<h3 style="margin-top:20px" id="aplikacja">Aplikacja</h3><p class="meta">Dodaj stronę do ekranu głównego telefonu. <button class="btn ghost" type="button" data-pwa-install hidden>Zainstaluj</button> <span data-pwa-status></span></p></div><div class="panel"><h3>FAQ</h3>
<details><summary>Czy strona jest płatna?</summary>Nie, przeglądanie i dodawanie kotów jest darmowe.</details><details><summary>Za co są punkty?</summary>Za odkrywanie kart kotów (+${REVEAL_BONUS} pkt) i codzienne odwiedziny. Wydajesz je w mini-grach, a ranking liczy wszystkie zdobyte punkty.</details><details><summary>Czy to hazard?</summary>Nie. Nie ma zakładów i nie można grać o pieniądze.</details><details><summary>Kto pisze opisy?</summary>AI na podstawie ogłoszeń — zawsze to oznaczamy.</details><p><a href="faq.html">Wszystkie pytania (FAQ)</a> · <a href="jak-grac.html">Jak grać</a> · <a href="dla-ogloszeniodawcow.html">Dla ogłoszeniodawców</a></p><p><a href="regulamin.html">Regulamin</a> · <a href="polityka-prywatnosci.html">Polityka prywatności</a></p></div></div></section>`
  };
  // stare podstrony z dema -> prawdziwe strony
  const EXTERNAL = { adoptowalem: "adoptowalem.html", dodaj: "dodaj-kota.html" };

  /* ---------- ranking (prawdziwe dane, bez przykładowych graczy) ---------- */
  async function fetchBoard() {
    if (remote) return remote.rpc("get_leaderboard", { p_limit: 10 });
    const url = String(CFG.supabaseUrl || "").replace(/\/+$/, ""), key = CFG.supabaseAnonKey;
    if (!url || !key) return null;
    const r = await fetch(url + "/rest/v1/rpc/get_leaderboard", { method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ p_limit: 10 }) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  const avatar = (id) => { const c = AVATAR_CATS[id]; return c && window.CatArt ? `<span class="av" style="display:inline-block;width:26px;height:26px;border-radius:50%;overflow:hidden;background:${CARD_TONE}">${window.CatArt.catSvg(c, { title: false })}</span>` : ""; };
  async function loadBoard() {
    const el = $("#board"); if (!el) return;
    try {
      const d = await fetchBoard(); if (!$("#board")) return;
      const top = (d && d.top) || [];
      let rows = top.map((r) => `<li class="${r.is_me ? "me" : ""}"><span>${r.rank}. ${avatar(r.avatar)}${esc(r.nickname)}</span><b>${r.score} pkt</b></li>`).join("");
      if (d && d.me && !top.some((r) => r.is_me)) rows += `<li class="me"><span>${d.me.rank}. Ty</span><b>${d.me.score} pkt</b></li>`;
      $("#board").innerHTML = rows || "<li><span>Ranking jest jeszcze pusty. Zaloguj się i bądź pierwszy!</span></li>";
      if (d && d.players) $("#board").insertAdjacentHTML("beforeend", `<li class="meta"><span>Graczy w rankingu: ${d.players}</span></li>`);
    } catch (e) { const b = $("#board"); if (b) b.innerHTML = "<li><span>Nie udało się wczytać rankingu. Spróbuj za chwilę.</span></li>"; }
  }

  /* ---------- talia kart ---------- */
  window.hideHint = () => { try { localStorage.setItem("pk-hint", 1); } catch (e) { /* ignore */ } const h = $("#hint"); if (h) { h.classList.add("out"); setTimeout(() => h.remove(), 300); } };
  function stack() {
    let city = "", i = 0; const st = $("#stack"), ls = $("#list"); if (!st) return;
    const pool = () => avail().filter((c) => !city || cityOf(c) === city);
    const draw = () => {
      const p = pool();
      ls.innerHTML = p.map((c) => `<a class="${seen(c.id) ? "" : "locked"}" href="#/kot/${esc(c.id)}">${ph(c)}<b>${seen(c.id) ? esc(c.name) : "Nieodkryty kot"}</b><div class="meta">${esc(cityOf(c))}</div></a>`).join("");
      st.innerHTML = [2, 1, 0].map((k) => { const c = p[(i + k) % p.length]; if (!c) return ""; return `<div class="card ${k == 1 ? "back" : k == 2 ? "back2" : "top"} ${seen(c.id) ? "open" : ""}" data-id="${esc(c.id)}">${ph(c)}<div class="info"><h3>${esc(c.name)}</h3><div>${esc(cityOf(c))} · ${esc(c.age)}</div><div class="tags">${(c.traits || []).slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join("")}</div></div><span class="stamp yes">ODKRYJ ♥</span><span class="stamp no">DALEJ ✕</span><div class="lock">🔒<span>Kto się tu ukrywa?<small>Przesuń w prawo, aby odkryć · +${REVEAL_BONUS} pkt</small></span></div></div>`; }).join("");
      drag(); skel();
    };
    const go = (d) => { const t = st.querySelector(".top"); if (!t) return; hideHint(); if (d > 0 && !t.classList.contains("open")) { t.classList.add("open", "pop"); reveal(t.dataset.id, t); t.style.transform = ""; return; } t.style.transform = `translateX(${d * 140}%) rotate(${d * 25}deg)`; t.style.opacity = 0; setTimeout(() => { i++; draw(); }, RM ? 0 : 300); };
    function drag() { const t = st.querySelector(".top"); if (!t) return; let x0 = null; t.onpointerdown = (e) => { x0 = e.clientX; t.setPointerCapture(e.pointerId); t.style.transition = "none"; }; t.onpointermove = (e) => { if (x0 == null) return; const dx = e.clientX - x0; t.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; t.dataset.dir = dx > 40 ? "r" : dx < -40 ? "l" : ""; }; t.onpointerup = (e) => { t.dataset.dir = ""; const dx = e.clientX - x0; x0 = null; t.style.transition = ""; if (Math.abs(dx) > 90) go(dx > 0 ? 1 : -1); else { t.style.transform = ""; if (Math.abs(dx) < 5 && t.classList.contains("open")) location.hash = "#/kot/" + t.dataset.id; } }; }
    let hintOff = false; try { hintOff = !!localStorage.getItem("pk-hint"); } catch (e) { /* ignore */ }
    if (!hintOff) st.insertAdjacentHTML("beforebegin", `<div class="hint" id="hint"><span class="hand">👆</span><b>Przesuń kartę w prawo</b>, żeby odkryć kota (+${REVEAL_BONUS} pkt). W lewo — następny kot.<button type="button" onclick="hideHint()">Rozumiem</button></div>`);
    $("#yes").onclick = () => go(1); $("#nope").onclick = () => go(-1); $("#info").onclick = () => { const t = st.querySelector(".top"); if (t) location.hash = "#/kot/" + t.dataset.id; };
    $("#chips").onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; $$(".chip").forEach((x) => x.classList.toggle("on", x === b)); city = b.dataset.c; i = 0; draw(); };
    draw();
  }

  /* ---------- router ---------- */
  const OLD = { top: "", gra: "koty", stolik: "koty", "jak-to-dziala": "", "jak-grac": "koty", aplikacja: "wiecej", "instrukcja-pwa": "wiecej", "dla-schronisk": "wiecej", ranking: "ranking" };
  function parse() { const [, p = "", a] = location.hash.split("/"); return [p, a && decodeURIComponent(a)]; }
  let curKey = null;
  function route(anim) {
    const [p, a] = parse();
    if (EXTERNAL[p]) { location.replace(EXTERNAL[p]); return; }
    const html = (R[p] || R[""])(a);
    curKey = location.hash;
    const swap = () => { app.innerHTML = html; };
    const post = () => { $$(".topnav a,.bottomnav a").forEach((x) => x.classList.toggle("on", x.getAttribute("href") === "#/" + p)); if (p === "koty") stack(); if (anim !== false) scrollTo(0, 0); skel(); reveals(); if (anim !== false) count(); parallax(); navInd(); peek(); };
    if (anim !== false && document.startViewTransition && !RM) document.startViewTransition(swap).updateCallbackDone.then(post); else { swap(); post(); }
  }
  // stare adresy: index.html#gra, #profil, ?kot=ID
  (function legacy() {
    const u = new URL(location.href), kot = u.searchParams.get("kot"), h = location.hash.replace(/^#/, "");
    if (kot) { u.searchParams.delete("kot"); history.replaceState(null, "", u.pathname + u.search + "#/kot/" + encodeURIComponent(kot)); return; }
    if (h === "profil") { history.replaceState(null, "", u.pathname + u.search + "#/ranking"); setTimeout(() => { const P = Progress(); if (P) P.openProfile(); }, 600); return; }
    if (h && h[0] !== "/" && h in OLD) history.replaceState(null, "", u.pathname + u.search + "#/" + OLD[h]);
  })();
  addEventListener("resize", navInd);
  addEventListener("hashchange", () => { document.querySelectorAll("dialog[open]").forEach((d) => d.close()); route(); });
  // klik w kontakt: licznik GoatCounter „kontakt-<id>” + odznaka Ambasador (jak dotąd)
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("[data-adopt][data-cat]"); if (!a) return;
    const id = a.dataset.cat, kind = /^tel:/.test(a.href) ? "telefon" : /^mailto:/.test(a.href) ? "email" : "ogloszenie";
    gc("kontakt-" + id, "Kontakt do właściciela: " + id + " (" + kind + ")");
    award("ambassador"); save();
    if (remote) remote.rpc("claim_badge", { p_badge: "ambassador" }).catch(() => {});
  }, true);

  // odśwież widok po zmianie danych, bez psucia talii
  function refresh() {
    const [p] = parse();
    hud(false);
    if (p === "koty" && $("#stack")) { C.forEach((c) => { if (seen(c.id)) unlockInList(c.id); }); return; }
    if (p === "ranking" || p === "" || p === "kot" || p === "gry" || !$("main section")) route(false);
  }

  /* ---------- API dla js/account.js i js/progress.js (ten sam kontrakt co dotychczasowa gra) ---------- */
  const Game = {
    avatarIds: Object.keys(AVATAR_CATS),
    avatarSvg(id) { const c = AVATAR_CATS[id]; return c && window.CatArt ? window.CatArt.catSvg(c, { title: false }) : ""; },
    avatarBg(id) { const c = AVATAR_CATS[id]; return (c && c.look && c.look.bg) || CARD_TONE; },
    toast, errMsg: (e) => esc((e && e.message) || "Coś poszło nie tak."),
    setAccountsAvailable() { /* ranking pokazuje się zawsze */ },
    setCats(cats, shelters) {
      if (!cats || !cats.length) return;
      if (shelters && shelters.length) { Object.keys(DATA.shelters).forEach((k) => delete DATA.shelters[k]); shelters.forEach((s) => { DATA.shelters[s.id] = { name: s.name, city: s.city, email: s.email }; }); }
      C = cats.filter((c) => !c.hidden); reindex();
      const first = !catsReady; catsReady = true;
      if (first || !$("#stack")) route(false); else refresh();
      document.dispatchEvent(new CustomEvent("podejrzyjkota:cats"));
    },
    getCats: () => C.slice(),
    locationOf: (c) => ({ city: cityOf(c), voivodeship: c.voivodeship || "" }),
    setView() {}, visibleCount: () => avail().length,
    enterAccount(api, snap) { remote = api; state = stateFromSnapshot(snap, null); refresh(); },
    applySnapshot(snap) { if (!remote) return; state = stateFromSnapshot(snap, state); refresh(); if (Progress()) Progress().sync(); },
    leaveAccount() { remote = null; state = loadState(); refresh(); },
    isRemote: () => !!remote,
    getState: () => state,
    getGuestProgress() {
      let s = null; try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { s = null; }
      if (!s || s.v !== 1) s = { v: 1, points: START_POINTS, badges: [], seen: [], bets: [] };
      const has = (s.seen || []).length || (s.bets || []).length || (s.badges || []).length || s.points !== START_POINTS;
      const P = Progress(), pe = P ? P.guestExport() : { xp: 0, badges: [], bestVisit: 0 };
      const badges = Array.from(new Set([...(s.badges || []), ...pe.badges]));
      return has || pe.xp > 0 || badges.length ? { points: s.points, badges, seen: s.seen || [], bestStreak: s.bestStreak || 0, bets: (s.bets || []).length, xp: pe.xp, bestVisit: pe.bestVisit } : null;
    },
    refreshLeaderboard() { if (parse()[0] === "ranking") loadBoard(); return Promise.resolve(); },
    openLeaderboard() { location.hash = "#/ranking"; return Promise.resolve(); },
    addPoints(n) { if (remote || !(n > 0)) return; state.points += n; save(); hud(); },
    setPoints(n) { if (!remote || typeof n !== "number" || n === state.points) return; state.points = n; hud(); },
    confetti,
    openCat(id) { location.hash = "#/kot/" + encodeURIComponent(id); }
  };
  window.PodejrzyjkotaGame = Game;
  if (Progress()) Progress().attach(Game);
  hud(false);
  route(false);
  // bez Supabase (np. podgląd lokalny bez config.js) pokaż to, co jest w js/cats.js
  setTimeout(() => { if (!catsReady && !(window.PodejrzyjkotaAccount && window.PodejrzyjkotaAccount.configured)) { catsReady = true; route(false); } }, 1500);
})();
