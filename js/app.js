/* podejrzyjkota: logika gry (vanilla JS, bez zależności) */
(function () {
  "use strict";

  const DATA = window.PODEJRZYJKOTA_DATA;
  const CATS = DATA.cats;
  const STORE_KEY = "podejrzyjkota:v1";
  const START_POINTS = 100;
  const MIN_STAKE = 5;
  const REVEAL_BONUS = 2;
  const ALL_CARDS_BONUS = 20;
  const REFILL = 30;
  const DAY_OPTIONS = [
    { days: 3, base: 4 },
    { days: 7, base: 2.5 },
    { days: 14, base: 1.6 }
  ];
  const RIVALS = [
    { name: "KociaMama", points: 240 },
    { name: "Pan Filemon", points: 185 },
    { name: "Ola_Mruczanka", points: 150 },
    { name: "Wąsaty Kibic", points: 120 },
    { name: "Sierściuch92", points: 80 }
  ];
  const BADGES = [
    { id: "peek", icon: "👀", name: "Podglądacz", desc: "Odkryj pierwszą kartę" },
    { id: "allcards", icon: "🃏", name: "Kocie oko", desc: "Odkryj wszystkie karty (+20 pkt)" },
    { id: "firstbet", icon: "🎲", name: "Pierwszy zakład", desc: "Postaw pierwsze punkty" },
    { id: "firstwin", icon: "🍀", name: "Szczęśliwa łapa", desc: "Wygraj zakład" },
    { id: "streak3", icon: "🔥", name: "Seria ×3", desc: "Wygraj 3 zakłady z rzędu" },
    { id: "ambassador", icon: "💌", name: "Ambasador adopcji", desc: "Kliknij „Chcę adoptować”" }
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byId = Object.fromEntries(CATS.map((c) => [c.id, c]));
  // awatary graczy = 9 ilustracji kotów z js/cats.js (niezależnie od kotów w bazie)
  const AVATAR_CATS = Object.fromEntries(CATS.map((c) => [c.id, { ...c }]));
  function reindex() {
    Object.keys(byId).forEach((k) => delete byId[k]);
    CATS.forEach((c) => { byId[c.id] = c; });
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- pomocnicze ---------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round1 = (v) => Math.round(v * 10) / 10;
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const fmtOdds = (o) => "×" + o.toFixed(1).replace(".", ",");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function plural(n, one, few, many) {
    const n10 = n % 10, n100 = n % 100;
    if (n === 1) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }
  const pts = (n) => `${n} pkt`;
  const daysTxt = (n) => `${n} ${plural(n, "dzień", "dni", "dni")}`;
  const isFemale = (cat) => cat.sex === "kotka";
  const g = (cat, m, f) => (isFemale(cat) ? f : m); // odmiana przez rodzaj

  /* ---------- stan ---------- */
  function freshState() {
    return {
      v: 1,
      points: START_POINTS,
      revealed: [],
      seen: [],
      bets: [],
      day: 1,
      round: 1,
      adoptions: {},
      streak: 0,
      bestStreak: 0,
      badges: [],
      rivals: RIVALS.map((r) => ({ ...r })),
      order: shuffle(CATS.map((c) => c.id)),
      nextBetId: 1
    };
  }
  function loadState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { s = null; }
    if (!s || s.v !== 1) return freshState();
    const base = freshState();
    s = Object.assign(base, s);
    // dopasuj kolejność do aktualnych danych (gdy ktoś podmieni koty)
    s.order = s.order.filter((id) => byId[id]);
    CATS.forEach((c) => { if (!s.order.includes(c.id)) s.order.push(c.id); });
    s.revealed = s.revealed.filter((id) => byId[id]);
    s.seen = s.seen.filter((id) => byId[id]);
    s.bets = s.bets.filter((b) => byId[b.catId]);
    return s;
  }
  let state = loadState();
  // Tryb konta (Supabase): obiekt z js/account.js; null = tryb gościa (localStorage)
  let remote = null;
  let leaderboard = null;
  let accountsAvailable = false;
  function save() {
    if (remote) return; // w trybie konta stan żyje na serwerze; localStorage gościa zostaje nietknięty
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* tryb prywatny itp. */ }
  }

  /* ---------- logika gry ---------- */
  const weight = (cat) => clamp(cat.popularity || 3, 1, 5);
  const isAdopted = (cat) => cat.status === "adopted" || (!remote && state.adoptions[cat.id] != null);
  const available = () => CATS.filter((c) => !isAdopted(c));
  const activeBets = () => state.bets.filter((b) => b.status === "active");
  const shelterOf = (cat) => DATA.shelters[cat.shelter] || { name: "Schronisko", city: "", email: DATA.contactEmail };
  const shortShelter = (sh) => { const m = sh.name.match(/„(.+?)”/); return m ? m[1] : sh.name; };

  function oddsFirst(cat) {
    const av = available();
    const sum = av.reduce((s, c) => s + weight(c), 0) || 1;
    return clamp(round1(0.9 * sum / weight(cat)), 1.2, 12);
  }
  function oddsDays(cat, days) {
    const opt = DAY_OPTIONS.find((o) => o.days === days) || DAY_OPTIONS[1];
    return Math.max(1.1, round1(opt.base * (1.3 - weight(cat) * 0.1)));
  }
  function betLabel(bet) {
    const cat = byId[bet.catId];
    if (bet.type === "first") return `${g(cat, "pierwszy", "pierwsza")} w domu (runda ${bet.round})`;
    return `dom w ciągu ${daysTxt(bet.days)}`;
  }

  function adoptMailto(cat) {
    const sh = shelterOf(cat);
    const email = sh.email || DATA.contactEmail;
    const subject = isAdopted(cat)
      ? `Pytanie o koty do adopcji (po ${cat.name}) – podejrzyjkota`
      : `Adopcja: ${cat.name} (podejrzyjkota)`;
    const body = isAdopted(cat)
      ? `Dzień dobry,\n\nwidzę, że ${cat.name} ma już dom. Czy macie podobne koty do adopcji?\n\nPozdrawiam`
      : `Dzień dobry,\n\nchciał(a)bym poznać ${g(cat, "kota", "kotkę")} ${cat.nameAcc || cat.name} i zapytać o adopcję.\n\nPozdrawiam`;
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function award(id) {
    if (state.badges.includes(id)) return false;
    state.badges.push(id);
    const b = BADGES.find((x) => x.id === id);
    if (b) toast(`${b.icon} Nowa odznaka: <strong>${b.name}</strong>`);
    return true;
  }

  function reveal(catId) {
    if (remote) return remoteReveal(catId);
    if (state.revealed.includes(catId)) return;
    state.revealed.push(catId);
    if (!state.seen.includes(catId)) {
      state.seen.push(catId);
      addPoints(REVEAL_BONUS);
      award("peek");
      if (state.seen.length === CATS.length && award("allcards")) {
        addPoints(ALL_CARDS_BONUS);
        confetti(90);
      }
    }
    save();
    renderAll();
  }

  function addPoints(n) {
    state.points = Math.max(0, state.points + n);
    bumpPoints(n);
  }

  function placeBet(catId, type, days, stake) {
    if (remote) return remotePlaceBet(catId, type, days, stake);
    const cat = byId[catId];
    stake = Math.floor(stake);
    if (!cat || isAdopted(cat)) return toast("Ten kot ma już dom, nie da się na niego obstawić. 🎉");
    if (!(stake >= MIN_STAKE)) return toast(`Minimalna stawka to ${pts(MIN_STAKE)}.`);
    if (stake > state.points) return toast("Masz za mało punktów na taką stawkę.");
    const odds = type === "first" ? oddsFirst(cat) : oddsDays(cat, days);
    state.points -= stake;
    bumpPoints(-stake);
    state.bets.push({
      id: state.nextBetId++, catId, type, days: type === "first" ? null : days,
      stake, odds, placedDay: state.day, round: state.round, status: "active"
    });
    award("firstbet");
    save();
    renderAll();
    toast(`🎲 Postawione: <strong>${pts(stake)}</strong> na ${esc(cat.nameAcc || cat.name)} (${betLabel(state.bets[state.bets.length - 1])}).`);
  }

  /* ---------- tryb konta: wywołania RPC (walidacja i punkty po stronie serwera) ---------- */
  function errMsg(e) {
    const m = (e && (e.message || e.error_description)) || "";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Brak połączenia z serwerem. Spróbuj za chwilę.";
    if (/JWT|not authenticated|zalogowany/i.test(m)) return "Sesja wygasła. Zaloguj się ponownie.";
    return esc(m || "Coś poszło nie tak. Spróbuj ponownie.");
  }
  function newBadges(list) { (list || []).forEach((id) => award(id)); }
  function fromServerBet(b) {
    return {
      id: b.id, catId: b.cat_id, type: b.kind, days: b.days, stake: b.stake, odds: Number(b.odds),
      round: b.round, status: b.status, payout: b.payout || 0,
      placedAt: b.placed_at, deadline: b.deadline, resolvedAt: b.resolved_at
    };
  }
  async function remoteReveal(catId) {
    if (state.revealed.includes(catId)) return;
    state.revealed.push(catId);
    syncCards(); renderStats();
    if (state.seen.includes(catId)) return;
    state.seen.push(catId);
    try {
      const r = await remote.rpc("reveal_card", { p_cat_id: catId });
      if (r.gained) { state.points = r.points; bumpPoints(r.gained); }
      newBadges(r.new_badges);
      if ((r.new_badges || []).includes("allcards")) confetti(90);
      renderAll();
    } catch (e) { toast(errMsg(e)); }
  }
  async function remotePlaceBet(catId, type, days, stake) {
    const cat = byId[catId];
    try {
      const r = await remote.rpc("place_bet", { p_cat_id: catId, p_kind: type, p_days: type === "first" ? null : days, p_stake: Math.floor(stake) });
      const bet = fromServerBet(r.bet);
      state.points = r.points; bumpPoints(-bet.stake);
      state.bets.push(bet);
      state.canRefill = false;
      newBadges(r.new_badges);
      renderAll();
      toast(`🎲 Postawione: <strong>${pts(bet.stake)}</strong> na ${esc(cat.nameAcc || cat.name)} (${betLabel(bet)}, kurs ${fmtOdds(bet.odds)}).`);
      refreshLeaderboard();
    } catch (e) { toast(errMsg(e)); }
  }
  async function remoteRefill() {
    try {
      const r = await remote.rpc("claim_refill", {});
      state.points = r.points; state.canRefill = false; bumpPoints(REFILL); renderAll();
      toast(`🐾 +${REFILL} pkt kociej zapomogi. Powodzenia!`);
    } catch (e) { toast(errMsg(e)); }
  }
  function ambassador() {
    award("ambassador"); save(); renderBadges();
    if (remote) remote.rpc("claim_badge", { p_badge: "ambassador" }).catch(() => {});
  }
  function refreshLeaderboard() {
    if (!remote) return Promise.resolve();
    return remote.rpc("get_leaderboard", { p_limit: 50 })
      .then((d) => { leaderboard = d; renderRanking(); })
      .catch(() => {});
  }
  const fmtDate = (d) => new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });

  function settle(bet, won, results) {
    bet.status = won ? "won" : "lost";
    bet.resolvedDay = state.day;
    if (won) {
      bet.payout = Math.round(bet.stake * bet.odds);
      state.points += bet.payout;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      award("firstwin");
      if (state.streak >= 3) award("streak3");
    } else {
      bet.payout = 0;
      state.streak = 0;
    }
    results.push(bet);
  }

  function expireBets(results) {
    activeBets().forEach((b) => {
      if (b.type === "days" && state.day > b.placedDay + b.days) settle(b, false, results);
    });
  }

  function driftRivals() {
    state.rivals.forEach((r) => { r.points = Math.max(0, r.points + randInt(-12, 22)); });
  }

  function simulateAdoption() {
    const av = available();
    if (!av.length) return toast("Wszystkie koty mają już dom! 🎉 Zresetuj grę, żeby zagrać od nowa.");
    const before = state.points;
    state.day += randInt(1, 2);
    // losowanie ważone popularnością
    const total = av.reduce((s, c) => s + weight(c), 0);
    let r = Math.random() * total, chosen = av[0];
    for (const c of av) { r -= weight(c); if (r <= 0) { chosen = c; break; } }
    state.adoptions[chosen.id] = state.day;

    const results = [];
    activeBets().forEach((b) => {
      if (b.type === "first") settle(b, b.catId === chosen.id, results);
      else if (b.catId === chosen.id) settle(b, state.day <= b.placedDay + b.days, results);
    });
    expireBets(results);
    state.round += 1;
    if (!state.revealed.includes(chosen.id)) state.revealed.push(chosen.id);
    driftRivals();
    save();
    renderAll();
    highlightCard(chosen.id);
    showResult(chosen, results, state.points - before);
  }

  function nextDay() {
    const before = state.points;
    state.day += 1;
    const results = [];
    expireBets(results);
    driftRivals();
    save();
    renderAll();
    if (results.length) showResult(null, results, state.points - before);
    else toast(`📅 Dzień ${state.day}. Żaden kot nie został dziś zaadoptowany.`);
  }

  /* ---------- render: karty ---------- */
  const board = $("[data-board]");

  function buildBoard() {
    board.innerHTML = "";
    state.order.forEach((id, i) => {
      const cat = byId[id];
      const el = document.createElement("div");
      el.className = "card";
      el.dataset.id = id;
      el.style.setProperty("--i", i);
      el.innerHTML = `
        <div class="card__inner">
          <button class="card__back" type="button" aria-label="Odkryj kartę numer ${i + 1}">
            <span class="card__num">№ ${String(i + 1).padStart(2, "0")}</span>
            <span class="card__peek">${CatArt.peekEyesSvg()}</span>
            <span class="card__cta">Podejrzyj</span>
            <span class="card__hint">kliknij, żeby odkryć</span>
            <span class="card__stamp" hidden>🏠 ma już dom</span>
          </button>
          <article class="card__front" aria-label="${esc(cat.name)}"></article>
        </div>`;
      board.appendChild(el);
      fillFront(el, cat);
      maybeAdCard(i, state.order.length);
    });
    if (window.PodejrzyjkotaAds) window.PodejrzyjkotaAds.renderAll(board);
    syncCards();
  }

  // Karta reklamowa w siatce: nie da się jej odkryć ani obstawić (konfiguracja: js/ads.js -> slots.grid)
  function maybeAdCard(i, total) {
    const Ads = window.PodejrzyjkotaAds;
    if (!Ads || !Ads.hasContent("grid")) return;
    const gs = Ads.config.slots.grid;
    const every = Math.max(2, gs.every || 5), max = gs.max == null ? 1 : gs.max;
    const n = i + 1;
    if (n % every !== 0 || n >= total || n / every > max) return;
    const ad = document.createElement("div");
    ad.className = "card card--ad";
    ad.style.setProperty("--i", i + 0.5);
    ad.innerHTML = Ads.slotHtml("grid", "ad--card");
    board.appendChild(ad);
  }

  function fillFront(el, cat) {
    const sh = shelterOf(cat);
    const adopted = isAdopted(cat);
    const myBet = activeBets().filter((b) => b.catId === cat.id).reduce((s, b) => s + b.stake, 0);
    const art = cat.photo
      ? `<img class="cat-photo" src="${esc(cat.photo)}" alt="Zdjęcie: ${esc(cat.name)}" loading="lazy">`
      : CatArt.catSvg(cat);
    const front = $(".card__front", el);
    front.innerHTML = `
      <div class="card__art" style="--bg:${esc((cat.look && cat.look.bg) || "#F3E9DC")}">
        ${art}
        <span class="chip chip--demo">przykład</span>
        ${myBet ? `<span class="chip chip--bet" title="Twoja stawka na tego kota">🎲 ${myBet}</span>` : ""}
        ${adopted ? `<span class="ribbon">🎉 Zaadoptowan${g(cat, "y", "a")}!</span>` : ""}
      </div>
      <div class="card__body">
        <h3 class="card__name">${esc(cat.name)} <span class="sex sex--${isFemale(cat) ? "f" : "m"}" title="${esc(cat.sex)}">${isFemale(cat) ? "♀" : "♂"}</span></h3>
        <p class="card__meta">${esc(cat.age)} · ${esc(cat.sex)}</p>
        <ul class="traits">${cat.traits.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <p class="card__shelter" title="${esc(sh.name)}, ${esc(sh.city)}"><span aria-hidden="true">📍</span> ${esc(shortShelter(sh))}, ${esc(sh.city)}</p>
        <div class="card__actions">
          <a class="btn btn--primary btn--sm btn--block" href="${adoptMailto(cat)}" data-adopt>${adopted ? "Adoptuj kumpla" : "Chcę adoptować"}</a>
          <div class="card__row">
            ${adopted ? "" : `<button class="btn btn--soft btn--sm" type="button" data-open="bet">🎲 Obstaw</button>`}
            <button class="btn btn--soft btn--sm" type="button" data-open="info">Więcej</button>
          </div>
        </div>
      </div>`;
    el.classList.toggle("is-adopted", adopted);
    $(".card__stamp", el).hidden = !adopted;
  }

  function syncCards() {
    $$(".card[data-id]", board).forEach((el) => {
      const flipped = state.revealed.includes(el.dataset.id);
      el.classList.toggle("is-flipped", flipped);
      $(".card__back", el).inert = flipped;
      $(".card__front", el).inert = !flipped;
    });
  }

  function refreshFronts() {
    $$(".card[data-id]", board).forEach((el) => fillFront(el, byId[el.dataset.id]));
    syncCards();
  }

  function highlightCard(id) {
    const el = board.querySelector(`.card[data-id="${id}"]`);
    if (!el) return;
    el.classList.remove("is-celebrating");
    void el.offsetWidth;
    el.classList.add("is-celebrating");
  }

  board.addEventListener("click", (e) => {
    const card = e.target.closest(".card[data-id]");
    if (!card) return; // karty reklamowe nie reagują na kliknięcia gry
    const id = card.dataset.id;
    if (e.target.closest(".card__back")) { reveal(id); return; }
    const open = e.target.closest("[data-open]");
    if (open) { openSheet(id, open.dataset.open === "bet"); return; }
    if (e.target.closest("[data-adopt]")) ambassador();
  });

  /* ---------- render: panel ---------- */
  function renderStats() {
    $$("[data-points]").forEach((n) => (n.textContent = state.points));
    $$("[data-streak]").forEach((n) => (n.textContent = state.streak));
    $$("[data-revealed]").forEach((n) => (n.textContent = state.revealed.length));
    $$("[data-total]").forEach((n) => (n.textContent = CATS.length));
    const ds = $("[data-stat-day]");
    if (ds) {
      const mode = remote ? "remote" : "guest";
      if (ds.dataset.mode !== mode) {
        ds.dataset.mode = mode;
        ds.innerHTML = remote
          ? `<span class="stat__label">Runda gry</span><span class="stat__value"><span data-round></span><small>wspólna</small></span>`
          : `<span class="stat__label">Dzień symulacji</span><span class="stat__value"><span data-day></span><small>runda <span data-round></span></small></span>`;
      }
    }
    $$("[data-day]").forEach((n) => (n.textContent = state.day));
    $$("[data-round]").forEach((n) => (n.textContent = state.round));
    $("[data-refill]").hidden = remote ? !state.canRefill : !(state.points < MIN_STAKE && activeBets().length === 0);
    const demo = $(".panel--demo"), live = $("[data-live-panel]");
    if (demo) demo.hidden = !!remote;
    if (live) live.hidden = !remote;
    document.documentElement.classList.toggle("is-account", !!remote);
  }

  function miniAvatar(cat) {
    return `<span class="mini" style="--bg:${esc((cat.look && cat.look.bg) || "#eee")}">${cat.photo ? `<img src="${esc(cat.photo)}" alt="">` : CatArt.catSvg(cat, { title: false })}</span>`;
  }

  function renderBets() {
    const list = $("[data-bets]");
    const act = activeBets();
    if (!act.length) {
      list.innerHTML = `<li class="empty">Brak aktywnych zakładów. Odkryj kartę i kliknij <strong>„Obstaw”</strong>.</li>`;
    } else {
      list.innerHTML = act.slice().reverse().map((b) => {
        const cat = byId[b.catId];
        const extra = b.type === "days"
          ? (() => {
              const left = b.deadline ? Math.ceil((Date.parse(b.deadline) - Date.now()) / 864e5) : b.placedDay + b.days - state.day;
              return left > 0 ? `zostało ${daysTxt(left)}` : "ostatni dzień!";
            })()
          : "";
        return `<li class="bet">
          ${miniAvatar(cat)}
          <div class="bet__txt"><strong>${esc(cat.name)}</strong><span>${esc(betLabel(b))}${extra ? " · " + extra : ""}</span></div>
          <div class="bet__num"><span>${pts(b.stake)} ${fmtOdds(b.odds)}</span><strong>→ ${pts(Math.round(b.stake * b.odds))}</strong></div>
        </li>`;
      }).join("");
    }
    const hist = state.bets.filter((b) => b.status !== "active").slice(-6).reverse();
    $("[data-history-panel]").hidden = !hist.length;
    $("[data-history]").innerHTML = hist.map((b) => {
      const cat = byId[b.catId];
      return `<li class="bet bet--${b.status}">
        ${miniAvatar(cat)}
        <div class="bet__txt"><strong>${esc(cat.name)}</strong><span>${esc(betLabel(b))}</span></div>
        <div class="bet__num"><strong>${b.status === "won" ? "+" + pts(b.payout) : "−" + pts(b.stake)}</strong><span>${b.status === "won" ? "wygrana" : "przegrana"}</span></div>
      </li>`;
    }).join("");
  }

  function avatarMini(id) {
    const cat = AVATAR_CATS[id] || AVATAR_CATS[Object.keys(AVATAR_CATS)[0]];
    return `<span class="mini mini--sm" style="--bg:${esc((cat.look && cat.look.bg) || "#eee")}">${CatArt.catSvg(cat, { title: false })}</span>`;
  }
  const medals = ["🥇", "🥈", "🥉"];
  function lbRow(r) {
    return `<li class="${r.is_me ? "is-me" : ""}">
        <span class="rank">${medals[r.rank - 1] || r.rank}</span>
        <span class="who who--av">${avatarMini(r.avatar)}<span class="who__n">${esc(r.nickname)}${r.is_me ? " <em>(Ty)</em>" : ""}</span></span>
        <span class="score">${r.score}</span>
      </li>`;
  }
  function renderGlobalRanking() {
    const el = $("[data-ranking]"), note = $("[data-ranking-note]");
    if (!leaderboard) { el.innerHTML = `<li class="empty">Ładuję ranking…</li>`; return; }
    const top = leaderboard.top.slice(0, 10);
    let html = top.map(lbRow).join("");
    if (leaderboard.me && !top.some((r) => r.is_me)) html += `<li class="ranking__gap" aria-hidden="true">⋯</li>` + lbRow({ ...leaderboard.me, is_me: true });
    el.innerHTML = html || `<li class="empty">Jeszcze nikt nie gra. Bądź pierwszy!</li>`;
    if (note) note.innerHTML = `Ranking globalny: ${leaderboard.players} ${plural(leaderboard.players, "gracz", "graczy", "graczy")}. Wynik = punkty + stawki w grze. <button class="link-btn link-btn--inline" type="button" data-action="leaderboard">Pokaż top 50</button>`;
  }
  function openLeaderboard() {
    if (!leaderboard) return;
    const meIn = leaderboard.top.some((r) => r.is_me);
    sheetBody.innerHTML = `
      <button class="sheet__close" type="button" data-close aria-label="Zamknij">×</button>
      <div class="lb">
        <p class="eyebrow">Ranking globalny</p>
        <h2 id="sheet-title">Top ${leaderboard.top.length} graczy</h2>
        <p class="lb__sub">${leaderboard.players} ${plural(leaderboard.players, "gracz", "graczy", "graczy")} · wynik = punkty + stawki w aktywnych zakładach</p>
        <ol class="ranking ranking--full">${leaderboard.top.map(lbRow).join("")}
          ${leaderboard.me && !meIn ? `<li class="ranking__gap" aria-hidden="true">⋯</li>${lbRow({ ...leaderboard.me, is_me: true })}` : ""}</ol>
        <p class="panel__note">Publicznie widać tylko nick, awatar i wynik. Nick zmienisz w menu konta.</p>
      </div>`;
    if (!sheet.open) sheet.showModal();
    sheetBody.scrollTop = 0;
  }

  function renderRanking() {
    if (remote) return renderGlobalRanking();
    const note = $("[data-ranking-note]");
    if (note) note.innerHTML = "Rywale są przykładowi. Ranking jest lokalny, liczony tylko w Twojej przeglądarce." +
      (accountsAvailable ? ` <button class="link-btn link-btn--inline" type="button" data-action="login">Zaloguj się</button>, żeby grać w rankingu globalnym.` : "");
    const rows = state.rivals.map((r) => ({ name: r.name, points: r.points, me: false }))
      .concat([{ name: "Ty", points: state.points + activeBets().reduce((s, b) => s + b.stake, 0), me: true }])
      .sort((a, b) => b.points - a.points);
    $("[data-ranking]").innerHTML = rows.map((r, i) => `
      <li class="${r.me ? "is-me" : ""}">
        <span class="rank">${medals[i] || i + 1}</span>
        <span class="who">${esc(r.name)}${r.me ? " <em>(punkty + stawki w grze)</em>" : ""}</span>
        <span class="score">${r.points}</span>
      </li>`).join("");
  }

  function renderBadges() {
    $("[data-badges]").innerHTML = BADGES.map((b) => {
      const has = state.badges.includes(b.id);
      return `<li class="badge ${has ? "is-on" : ""}" title="${esc(b.desc)}">
        <span class="badge__icon" aria-hidden="true">${b.icon}</span>
        <span class="badge__name">${esc(b.name)}</span>
        <span class="badge__desc">${has ? "zdobyta!" : esc(b.desc)}</span>
      </li>`;
    }).join("");
  }

  function renderAll() {
    renderStats();
    refreshFronts();
    renderBets();
    renderRanking();
    renderBadges();
  }

  /* ---------- arkusz kota + formularz zakładu ---------- */
  const sheet = $("[data-sheet]");
  const sheetBody = $("[data-sheet-body]");

  function openSheet(catId, focusBet) {
    const cat = byId[catId];
    const sh = shelterOf(cat);
    const adopted = isAdopted(cat);
    const defStake = Math.min(state.points, 20);
    sheetBody.innerHTML = `
      <button class="sheet__close" type="button" data-close aria-label="Zamknij">×</button>
      <div class="sheet__grid">
        <div class="sheet__art" style="--bg:${esc((cat.look && cat.look.bg) || "#F3E9DC")}">
          ${cat.photo ? `<img class="cat-photo" src="${esc(cat.photo)}" alt="Zdjęcie: ${esc(cat.name)}">` : CatArt.catSvg(cat)}
          <span class="chip chip--demo">przykład</span>
          ${adopted ? `<span class="ribbon">🎉 Zaadoptowan${g(cat, "y", "a")}!</span>` : ""}
        </div>
        <div class="sheet__info">
          <h2 id="sheet-title">${esc(cat.name)} <span class="sex sex--${isFemale(cat) ? "f" : "m"}">${isFemale(cat) ? "♀" : "♂"}</span></h2>
          <p class="card__meta">${esc(cat.age)} · ${esc(cat.sex)} · ${esc(sh.name)}, ${esc(sh.city)}</p>
          <ul class="traits traits--big">${cat.traits.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          <p class="sheet__story">${esc(cat.story)}</p>
          ${adopted && cat.adoptedNote ? `<p class="sheet__adopted">🏠 ${esc(cat.adoptedNote)}</p>` : ""}
          ${adopted && !cat.adoptedNote ? `<p class="sheet__adopted">🏠 Znalazł${g(cat, "", "a")} dom${state.adoptions[cat.id] ? ` w ${state.adoptions[cat.id]}. dniu symulacji` : cat.adoptedAt ? " " + fmtDate(cat.adoptedAt) : ""}</p>` : ""}
          <a class="btn btn--primary btn--block" href="${adoptMailto(cat)}" data-adopt>${adopted ? "Zapytaj o podobne koty" : (cat.nameAcc ? `Chcę adoptować ${esc(cat.nameAcc)}` : "Chcę adoptować")}</a>
          <p class="placeholder-note">Adres e-mail jest przykładowy (${esc(sh.email || DATA.contactEmail)}), do podmiany na prawdziwy kontakt schroniska.</p>
        </div>
      </div>
      ${adopted ? `<div class="betbox betbox--closed"><p>Ten kot ma już dom, więc zakłady są zamknięte. Najlepsza możliwa wygrana! 🎉</p></div>` : `
      <form class="betbox" data-betform>
        <h3>Obstaw za punkty <span class="betbox__nomoney">bez pieniędzy</span></h3>
        <fieldset class="bet-types">
          <legend class="sr-only">Rodzaj zakładu</legend>
          <label class="bt"><input type="radio" name="kind" value="first" checked>
            <span><strong>${g(cat, "Pierwszy", "Pierwsza")} w domu</strong><small>z ${available().length} czekających kotów</small><em>${fmtOdds(oddsFirst(cat))}</em></span></label>
          ${DAY_OPTIONS.map((o) => `
          <label class="bt"><input type="radio" name="kind" value="d${o.days}">
            <span><strong>W ciągu ${daysTxt(o.days)}</strong><small>${remote ? "do " + fmtDate(Date.now() + o.days * 864e5) : "do dnia " + (state.day + o.days)}</small><em>${fmtOdds(oddsDays(cat, o.days))}</em></span></label>`).join("")}
        </fieldset>
        <div class="stake">
          <label for="stake">Stawka</label>
          <div class="stake__row">
            <input type="range" id="stake-range" min="${MIN_STAKE}" max="${Math.max(MIN_STAKE, state.points)}" step="1" value="${Math.max(MIN_STAKE, defStake)}" ${state.points < MIN_STAKE ? "disabled" : ""} aria-label="Stawka (suwak)">
            <input type="number" id="stake" min="${MIN_STAKE}" max="${state.points}" value="${Math.max(MIN_STAKE, defStake)}" inputmode="numeric" ${state.points < MIN_STAKE ? "disabled" : ""}>
          </div>
          <div class="stake__quick">
            ${[10, 25, 50].map((v) => `<button type="button" class="qs" data-stake="${v}" ${v > state.points ? "disabled" : ""}>${v}</button>`).join("")}
            <button type="button" class="qs" data-stake="all" ${state.points < MIN_STAKE ? "disabled" : ""}>Wszystko</button>
          </div>
        </div>
        <div class="betbox__foot">
          <p class="betbox__win">Możliwa wygrana: <strong data-win>0 pkt</strong><br><small>Masz ${pts(state.points)} · min. stawka ${pts(MIN_STAKE)}</small></p>
          <button class="btn btn--primary" type="submit" ${state.points < MIN_STAKE ? "disabled" : ""}>Postaw punkty</button>
        </div>
      </form>`}`;
    if (!sheet.open) sheet.showModal();
    sheetBody.scrollTop = 0;
    const form = $("[data-betform]", sheetBody);
    if (form) {
      wireBetForm(form, cat);
      if (focusBet) setTimeout(() => form.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" }), 60);
    }
  }

  function wireBetForm(form, cat) {
    const num = $("#stake", form), range = $("#stake-range", form), win = $("[data-win]", form);
    const getKind = () => form.elements.kind.value;
    function update(src) {
      let v = Math.floor(Number(src ? src.value : num.value) || 0);
      if (src === range) num.value = v; else range.value = v;
      const k = getKind();
      const odds = k === "first" ? oddsFirst(cat) : oddsDays(cat, Number(k.slice(1)));
      win.textContent = pts(Math.round(clamp(v, 0, state.points) * odds));
    }
    num.addEventListener("input", () => update(num));
    range.addEventListener("input", () => update(range));
    form.addEventListener("change", (e) => { if (e.target.name === "kind") update(); });
    $$("[data-stake]", form).forEach((b) => b.addEventListener("click", () => {
      num.value = b.dataset.stake === "all" ? state.points : b.dataset.stake; update(num);
    }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const k = getKind();
      const stake = Math.floor(Number(num.value));
      if (stake > state.points || stake < MIN_STAKE) { toast(stake < MIN_STAKE ? `Minimalna stawka to ${pts(MIN_STAKE)}.` : "Masz za mało punktów."); return; }
      placeBet(cat.id, k === "first" ? "first" : "days", k === "first" ? null : Number(k.slice(1)), stake);
      sheet.close();
    });
    update();
  }

  /* ---------- wynik symulacji ---------- */
  const resultDlg = $("[data-result]");
  function showResult(cat, results, delta, sub) {
    const wins = results.filter((b) => b.status === "won");
    const head = cat
      ? `<div class="result__art" style="--bg:${esc((cat.look && cat.look.bg) || "#eee")}">${CatArt.catSvg(cat, { title: false })}<span class="ribbon">🎉 Ma dom!</span></div>
         <h2 id="result-title">${esc(cat.name)} ${g(cat, "znalazł", "znalazła")} dom!</h2>
         <p class="result__sub">${sub ? esc(sub) : `Dzień ${state.day} symulacji`} · ${esc(shelterOf(cat).city)}</p>`
      : remote
        ? `<h2 id="result-title">Rozliczenie zakładów</h2><p class="result__sub">${esc(sub || "Od Twojej ostatniej wizyty")}</p>`
        : `<h2 id="result-title">Dzień ${state.day}</h2><p class="result__sub">Minął termin niektórych zakładów.</p>`;
    const list = results.length
      ? `<ul class="bets bets--history">${results.map((b) => {
          const c = byId[b.catId];
          return `<li class="bet bet--${b.status}">${miniAvatar(c)}
            <div class="bet__txt"><strong>${esc(c.name)}</strong><span>${esc(betLabel(b))}</span></div>
            <div class="bet__num"><strong>${b.status === "won" ? "+" + pts(b.payout) : "−" + pts(b.stake)}</strong><span>${b.status === "won" ? "wygrana" : "przegrana"}</span></div></li>`;
        }).join("")}</ul>`
      : `<p class="result__none">Żaden z Twoich zakładów nie rozliczył się w tej turze.</p>`;
    const summary = wins.length
      ? `<p class="result__sum is-win">Wygrywasz ${wins.length > 1 ? wins.length + " " + plural(wins.length, "zakład", "zakłady", "zakładów") : "zakład"}! Saldo: <strong>${state.points} pkt</strong>${state.streak >= 2 ? ` · seria 🔥 ${state.streak}` : ""}</p>`
      : results.length ? `<p class="result__sum">Tym razem bez wygranej. Saldo: <strong>${state.points} pkt</strong></p>` : "";
    $("[data-result-body]").innerHTML = `
      <button class="sheet__close" type="button" data-close aria-label="Zamknij">×</button>
      <div class="result">${head}${list}${summary}
        ${cat && available().length ? `<p class="result__nudge">Kibicuj dalej: ${available().length} ${plural(available().length, "kot wciąż czeka", "koty wciąż czekają", "kotów wciąż czeka")} na dom.</p>` : ""}
        ${!available().length ? `<p class="result__nudge">Wszystkie koty mają dom! 🎉${remote ? "" : " Zresetuj grę, żeby zagrać od nowa."}</p>` : ""}
        <button class="btn btn--primary btn--block" type="button" data-close>Super, gram dalej</button>
        ${window.PodejrzyjkotaAds && window.PodejrzyjkotaAds.hasContent("result") ? window.PodejrzyjkotaAds.slotHtml("result") : ""}
      </div>`;
    if (window.PodejrzyjkotaAds) window.PodejrzyjkotaAds.renderAll($("[data-result-body]"), true);
    if (!resultDlg.open) resultDlg.showModal();
    resultDlg.appendChild(toasts); // toasty (np. nowa odznaka) nad tłem okna
    if (wins.length) confetti(140);
    void delta;
  }

  // zamykanie dialogów: przycisk i kliknięcie w tło
  [sheet, resultDlg].forEach((d) => {
    d.addEventListener("close", () => { if (toasts.parentNode === d) document.body.appendChild(toasts); });
    d.addEventListener("click", (e) => {
      if (e.target === d || e.target.closest("[data-close]")) d.close();
      if (e.target.closest("[data-adopt]")) ambassador();
    });
  });

  /* ---------- akcje globalne ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (!a) return;
    if (remote && ["simulate", "nextday", "reset"].includes(a.dataset.action)) return;
    switch (a.dataset.action) {
      case "simulate": simulateAdoption(); break;
      case "nextday": nextDay(); break;
      case "leaderboard": openLeaderboard(); break;
      case "shuffle":
        state.revealed = [];
        state.order = shuffle(state.order);
        save(); buildBoard(); renderAll();
        board.classList.remove("is-dealing"); void board.offsetWidth; board.classList.add("is-dealing");
        toast("🔀 Karty potasowane. Kto się teraz schował?");
        break;
      case "refill":
        if (remote) { remoteRefill(); break; }
        if (state.points < MIN_STAKE && !activeBets().length) { addPoints(REFILL); save(); renderAll(); toast(`🐾 +${REFILL} pkt kociej zapomogi. Powodzenia!`); }
        break;
      case "reset":
        if (confirm("Zresetować grę? Punkty, zakłady, odznaki i odkryte karty wrócą do stanu początkowego.")) {
          state = freshState(); save(); buildBoard(); renderAll(); toast("Gra zresetowana. Masz 100 pkt na start.");
        }
        break;
    }
  });

  /* ---------- toasty, punkty, konfetti ---------- */
  const toasts = $("[data-toasts]");
  function toast(html) {
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = html;
    // gdy otwarte jest okno dialogowe, toasty muszą być w nim (inaczej chowają się pod tłem)
    const host = document.querySelector("dialog[open]") || document.body;
    if (toasts.parentNode !== host) host.appendChild(toasts);
    toasts.appendChild(t);
    setTimeout(() => t.classList.add("is-out"), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  function bumpPoints(delta) {
    $$(".points-pill, .stat--points").forEach((el) => {
      el.classList.remove("bump-up", "bump-down"); void el.offsetWidth;
      el.classList.add(delta >= 0 ? "bump-up" : "bump-down");
    });
  }

  const canvas = $("[data-confetti]");
  const ctx = canvas.getContext("2d");
  let parts = [], raf = null;
  function confetti(n) {
    if (reducedMotion) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ["#E8613C", "#F4B942", "#8FB996", "#F7A8B8", "#7C5CBF", "#FFFFFF"];
    for (let i = 0; i < n; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.4, y: innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4,
        s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
        c: colors[i % colors.length], shape: Math.random() > 0.6 ? "c" : "r", life: 0
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.shape === "c") { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    });
    parts = parts.filter((p) => p.y < innerHeight + 40 && p.life < 400);
    if (parts.length) raf = requestAnimationFrame(tick);
    else { raf = null; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------- hero ---------- */
  const heroCat = $("[data-hero-cat]");
  if (heroCat) {
    const c = CATS.find((x) => x.status !== "adopted") || CATS[0];
    heroCat.innerHTML = `<div class="fan__art" style="--bg:${esc(c.look.bg)}">${CatArt.catSvg(c, { title: false })}</div>
      <div class="fan__label"><strong>${esc(c.name)}</strong><span>${esc(c.age)} · ${esc(c.sex)}</span></div>`;
  }

  /* ---------- API dla js/account.js (konta Supabase) ---------- */
  function normalizeOrder(order) {
    const o = (order || []).filter((id) => byId[id]);
    shuffle(CATS.map((c) => c.id)).forEach((id) => { if (!o.includes(id)) o.push(id); });
    return o;
  }
  function stateFromSnapshot(snap, prev) {
    const p = snap.profile;
    const seen = (snap.reveals || []).filter((id) => byId[id]);
    return {
      v: 1, points: p.points, seen,
      revealed: prev ? prev.revealed.filter((id) => byId[id]) : seen.slice(),
      bets: (snap.bets || []).map(fromServerBet).filter((b) => byId[b.catId]),
      day: 0, round: snap.round, adoptions: {}, streak: p.streak, bestStreak: p.best_streak,
      badges: (snap.badges || []).slice(), rivals: [], nextBetId: 0,
      order: normalizeOrder(prev ? prev.order : state.order),
      canRefill: !!p.can_refill, userId: p.id
    };
  }
  // nowe rozliczenia od ostatniej wizyty (znacznik czasu per konto w localStorage)
  function showFreshSettlements() {
    const key = "podejrzyjkota:acct-seen:" + state.userId;
    let marker = Number(localStorage.getItem(key) || 0);
    const resolved = state.bets.filter((b) => b.status !== "active" && b.resolvedAt);
    const latest = resolved.reduce((m, b) => Math.max(m, Date.parse(b.resolvedAt)), marker || Date.now());
    if (marker) {
      const fresh = resolved.filter((b) => Date.parse(b.resolvedAt) > marker);
      if (fresh.length) {
        const adopted = CATS.filter((c) => c.status === "adopted" && c.adoptedAt && Date.parse(c.adoptedAt) > marker - 60000);
        const cat = adopted.length === 1 ? adopted[0] : null;
        const before = state.points - fresh.reduce((s, b) => s + (b.payout || 0), 0);
        showResult(cat, fresh.map((b) => ({ ...b })), state.points - before, cat ? "Rozliczenie zakładów" : "");
        if (cat) highlightCard(cat.id);
      }
    }
    try { localStorage.setItem(key, String(latest)); } catch (e) { /* ignore */ }
  }
  const Game = {
    avatarIds: Object.keys(AVATAR_CATS),
    avatarSvg(id) { const c = AVATAR_CATS[id]; return c ? CatArt.catSvg(c, { title: false }) : ""; },
    avatarBg(id) { const c = AVATAR_CATS[id]; return (c && c.look && c.look.bg) || "#eee"; },
    toast,
    errMsg,
    setAccountsAvailable(v) { accountsAvailable = !!v; renderRanking(); },
    // koty z bazy (Supabase) zamiast przykładowych z js/cats.js
    setCats(cats, shelters) {
      if (!cats || !cats.length) return;
      if (shelters && shelters.length) {
        Object.keys(DATA.shelters).forEach((k) => delete DATA.shelters[k]);
        shelters.forEach((s) => { DATA.shelters[s.id] = { name: s.name, city: s.city, email: s.email }; });
      }
      CATS.splice(0, CATS.length, ...cats);
      reindex();
      if (remote) { state.order = normalizeOrder(state.order); state.bets = state.bets.filter((b) => byId[b.catId]); }
      else state = loadState();
      buildBoard(); renderAll();
    },
    enterAccount(api, snap) {
      remote = api; leaderboard = null;
      state = stateFromSnapshot(snap, null);
      buildBoard(); renderAll();
      showFreshSettlements();
      refreshLeaderboard();
    },
    applySnapshot(snap) {
      if (!remote) return;
      state = stateFromSnapshot(snap, state);
      renderAll();
      showFreshSettlements();
      refreshLeaderboard();
    },
    leaveAccount() {
      remote = null; leaderboard = null;
      state = loadState();
      buildBoard(); renderAll();
    },
    isRemote: () => !!remote,
    getState: () => state,
    // postęp gościa z localStorage (do przeniesienia na konto przy pierwszym logowaniu)
    getGuestProgress() {
      let s = null;
      try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { s = null; }
      if (!s || s.v !== 1) return null;
      const has = (s.seen || []).length || (s.bets || []).length || (s.badges || []).length || s.points !== START_POINTS;
      return has ? { points: s.points, badges: s.badges || [], seen: s.seen || [], bestStreak: s.bestStreak || 0, bets: (s.bets || []).length } : null;
    },
    refreshLeaderboard,
    openLeaderboard() { return refreshLeaderboard().then(openLeaderboard); }
  };
  window.PodejrzyjkotaGame = Game;

  /* ---------- start ---------- */
  buildBoard();
  renderAll();
  board.classList.add("is-dealing");
})();
