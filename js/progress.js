/* Kocia ścieżka: XP, poziomy, odznaki, zadania dnia, seria wizyt, udostępnianie.
   Gość: wszystko w localStorage (podejrzyjkota:postep:v1).
   Konto: wszystko liczy serwer (Supabase, funkcje SECURITY DEFINER); tu tylko wyświetlamy wynik.
   Progi, zadania i nagrody są takie same jak w migracji 20261011000011_progression.sql. */
(function () {
  "use strict";
  const KEY = "podejrzyjkota:postep:v1";
  const REF_KEY = "podejrzyjkota:ref";
  const SITE = "https://podejrzyjkota.pl/";

  const LEVELS = [
    { xp: 0, name: "Kociak", color: "#A79BB8", acc: "", reward: "Szara ramka awatara i początek przygody" },
    { xp: 60, name: "Ciekawski Nos", color: "#8FD1C4", acc: "", reward: "Miętowa ramka awatara" },
    { xp: 150, name: "Tropiciel", color: "#7FB2F0", acc: "🎀", reward: "Niebieska ramka i kokardka przy awatarze" },
    { xp: 300, name: "Mruczący Kibic", color: "#B79CF2", acc: "🎀", reward: "Lawendowa ramka awatara" },
    { xp: 500, name: "Kocia Intuicja", color: "#F7A8B8", acc: "🔔", reward: "Różowa ramka i dzwoneczek" },
    { xp: 750, name: "Opiekun Parapetu", color: "#F4C04A", acc: "🔔", reward: "Musztardowa ramka awatara" },
    { xp: 1100, name: "Strażnik Misek", color: "#FF8A5C", acc: "🐟", reward: "Pomarańczowa ramka i rybka" },
    { xp: 1550, name: "Przyjaciel Schroniska", color: "#8FD19E", acc: "💚", reward: "Zielona ramka i serduszko" },
    { xp: 2100, name: "Kocia Wyrocznia", color: "#FFD36E", acc: "🔮", reward: "Złota ramka i kryształowa kula" },
    { xp: 2800, name: "Legenda Schroniska", color: "rainbow", acc: "👑", reward: "Tęczowa ramka i korona" }
  ];
  const GROUPS = [
    ["cats", "Dla kotów"], ["game", "Gra"], ["habit", "Wytrwałość"], ["social", "Wspólnie (z kontem)"]
  ];
  const BADGES = [
    { id: "ambassador", g: "cats", icon: "💌", name: "Ambasador adopcji", desc: "Kliknij „Chcę adoptować” przy dowolnym kocie." },
    { id: "overlooked", g: "cats", icon: "🖤", name: "Serce dla pomijanych", desc: "Odkryj 3 karty czarnych kotów albo seniorów (7+ lat)." },
    { id: "reader", g: "cats", icon: "📖", name: "Czytelnik historii", desc: "Poznaj historie 5 różnych kotów (przycisk „Więcej”)." },
    { id: "sharer", g: "cats", icon: "📣", name: "Kocia poczta", desc: "Udostępnij kota znajomym przyciskiem „Udostępnij kota”." },
    { id: "witness", g: "cats", icon: "🏡", name: "Świadek happy endu", desc: "Kibicuj kotu (odkryj albo obstaw), który potem znajdzie dom." },
    { id: "senior_win", g: "cats", icon: "🧓", name: "Mądrość wąsów", desc: "Wygraj zakład na kota seniora." },
    { id: "peek", g: "game", icon: "👀", name: "Podglądacz", desc: "Odkryj pierwszą kartę." },
    { id: "allcards", g: "game", icon: "🃏", name: "Kocie oko", desc: "Odkryj wszystkie karty (+20 pkt)." },
    { id: "firstbet", g: "game", icon: "🎲", name: "Pierwszy zakład", desc: "Postaw punkty na kota." },
    { id: "firstwin", g: "game", icon: "🍀", name: "Szczęśliwa łapa", desc: "Wygraj pierwszy zakład." },
    { id: "streak3", g: "game", icon: "🔥", name: "Seria ×3", desc: "Wygraj 3 zakłady z rzędu." },
    { id: "quest1", g: "game", icon: "✅", name: "Pierwsze zadanie", desc: "Zrób dowolne zadanie dnia." },
    { id: "questall", g: "game", icon: "🏅", name: "Komplet dnia", desc: "Zrób wszystkie 3 zadania jednego dnia." },
    { id: "visit7", g: "habit", icon: "📅", name: "Tydzień z kotami", desc: "Zajrzyj 7 dni z rzędu." },
    { id: "visit30", g: "habit", icon: "🗓️", name: "Kocia rutyna", desc: "Zajrzyj 30 dni z rzędu." },
    { id: "nightowl", g: "habit", icon: "🦉", name: "Nocny Marek", desc: "Zagraj między 22:00 a 4:00." },
    { id: "earlybird", g: "habit", icon: "🐦", name: "Ranny ptaszek", desc: "Zagraj między 5:00 a 7:00." },
    { id: "level5", g: "habit", icon: "⭐", name: "Kocia Intuicja", desc: "Dojdź do poziomu 5." },
    { id: "level10", g: "habit", icon: "👑", name: "Legenda", desc: "Dojdź do poziomu 10." },
    { id: "friend", g: "social", icon: "🤝", name: "Przyprowadź kumpla", desc: "Znajomy zakłada konto z Twojego linku." },
    { id: "podium", g: "social", icon: "🏆", name: "Podium tygodnia", desc: "Zajmij miejsce w top 3 rankingu tygodnia." }
  ];
  const QUESTS = {
    flip2: { counter: "flip", target: 2, icon: "🃏", text: "Odkryj 2 karty" },
    read2: { counter: "details", target: 2, icon: "📖", text: "Poznaj historie 2 kotów (przycisk „Więcej”)" },
    flip4: { counter: "flip", target: 4, icon: "🃏", text: "Odkryj 4 karty" },
    bet1: { counter: "bet", target: 1, icon: "🎲", text: "Postaw 1 zakład" },
    betoverlooked: { counter: "bet_overlooked", target: 1, icon: "🖤", text: "Obstaw czarnego kota albo seniora" },
    betdays: { counter: "bet_days", target: 1, icon: "📆", text: "Postaw zakład „w ciągu X dni”" },
    share1: { counter: "share", target: 1, icon: "📣", text: "Udostępnij dowolnego kota" },
    flipoverlooked: { counter: "flip_overlooked", target: 1, icon: "🖤", text: "Odkryj kartę czarnego kota albo seniora" },
    readoverlooked: { counter: "details_overlooked", target: 1, icon: "🖤", text: "Poznaj historię czarnego kota albo seniora" }
  };
  const QUEST_PTS = 15, QUEST_XP = 25, ALL_QUESTS_XP = 20;

  /* ---------- pomocnicze ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" });
  const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", hourCycle: "h23" });
  const todayPL = () => dayFmt.format(new Date());
  const hourPL = () => Number(hourFmt.format(new Date())) % 24;
  const dayNum = (s) => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5);
  const addDays = (s, n) => new Date((dayNum(s) + n) * 864e5).toISOString().slice(0, 10);
  const weekStart = (s) => { const dow = (new Date(dayNum(s) * 864e5).getUTCDay() + 6) % 7; return addDays(s, -dow); };
  function plural(n, one, few, many) {
    if (n === 1) return one;
    const d = n % 10, h = n % 100;
    return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
  }
  const levelFor = (xp) => LEVELS.filter((l) => l.xp <= (xp || 0)).length;
  const levelBonus = (from, to) => { let s = 0; for (let i = from + 1; i <= to; i++) s += i * 10; return s; };
  const streakPts = (s) => 5 * Math.min(s, 7);
  const streakXp = (s) => 10 + 2 * Math.min(s, 7);
  function questsFor(d) {
    let n = dayNum(d) - dayNum("2026-01-05");
    if (n < 0) n = -n;
    return [["flip2", "read2", "flip4"][n % 3], ["bet1", "betoverlooked", "betdays"][Math.floor(n / 3) % 3],
      ["share1", "flipoverlooked", "readoverlooked"][(n + Math.floor(n / 9)) % 3]];
  }
  function isSenior(cat) {
    const m = String((cat && cat.age) || "").toLowerCase().match(/(\d+)\s*(?:lat|rok)/);
    return (m ? +m[1] >= 7 : false) || ((cat && cat.traits) || []).some((t) => String(t).toLowerCase().startsWith("senior"));
  }
  function isBlack(cat) {
    const h = String((cat && cat.look && cat.look.base) || "").toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(h)) return false;
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.25;
  }
  const isOverlooked = (cat) => isSenior(cat) || isBlack(cat);
  const ringCss = (lvl) => { const c = LEVELS[lvl - 1].color; return c === "rainbow" ? "conic-gradient(#F7A8B8,#F4C04A,#8FD19E,#7FB2F0,#B79CF2,#F7A8B8)" : c; };

  /* ---------- stan ---------- */
  let G = null;            // PodejrzyjkotaGame
  let api = null;          // { rpc } w trybie konta
  let R = null;            // ostatni wynik get_progress (konto)
  const shown = new Set(); // odznaki już ogłoszone toastem (konto)
  let queue = Promise.resolve();

  function fresh() {
    return { v: 1, xp: 0, lvl: 1, badges: [], streak: { n: 0, best: 0, last: null, freezeWeek: null },
      daily: { day: null, c: {}, done: [] }, reads: [], seenOver: [], stats: { bets: 0, wins: 0, shares: 0 } };
  }
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
    if (!s || s.v !== 1) s = fresh();
    const f = fresh();
    Object.keys(f).forEach((k) => { if (s[k] == null) s[k] = f[k]; });
    return s;
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* tryb prywatny */ } }
  function ensureDay() { const d = todayPL(); if (S.daily.day !== d) S.daily = { day: d, c: {}, done: [] }; }

  // jeden widok niezależnie od trybu
  function vm() {
    if (api && R) {
      return { remote: true, xp: R.xp, level: R.level, badges: new Set(R.badges || []), streak: R.visit_streak, best: R.best_visit_streak,
        freeze: R.freeze_available, quests: (R.quests || []).map((q) => ({ ...q })), stats: R.stats || {}, weekXp: R.week_xp || 0, refCode: R.ref_code };
    }
    ensureDay();
    const gs = G ? G.getState() : null;
    const st = S.streak;
    const alive = st.last && (dayNum(todayPL()) - dayNum(st.last) <= 1 || (dayNum(todayPL()) - dayNum(st.last) === 2 && st.freezeWeek !== weekStart(todayPL())));
    return { remote: false, xp: S.xp, level: levelFor(S.xp), badges: new Set(S.badges), streak: alive ? st.n : 0, best: st.best,
      freeze: st.freezeWeek !== weekStart(todayPL()),
      quests: questsFor(S.daily.day).map((id) => { const q = QUESTS[id]; return { id, target: q.target, progress: Math.min(q.target, S.daily.c[q.counter] || 0), done: S.daily.done.includes(id) }; }),
      stats: { reveals: gs && !G.isRemote() ? gs.seen.length : 0, bets: S.stats.bets, wins: S.stats.wins, shares: S.stats.shares, reads: S.reads.length, friends: 0 },
      weekXp: null, refCode: null };
  }

  /* ---------- efekty: toasty, +XP, awans ---------- */
  const toast = (h) => (G ? G.toast(h) : null);
  function floatXp(n) {
    if (!n) return;
    const chip = $("[data-lvl-chip]");
    if (!chip) return;
    chip.classList.remove("is-bump"); void chip.offsetWidth; chip.classList.add("is-bump");
    if (reducedMotion) return;
    const f = document.createElement("span");
    f.className = "xpfloat"; f.setAttribute("aria-hidden", "true"); f.textContent = `+${n} XP`;
    chip.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }
  function badgeToast(id) {
    const b = BADGES.find((x) => x.id === id);
    if (b) toast(`${b.icon} Nowa odznaka: <strong>${esc(b.name)}</strong>`);
  }
  function questToast(id) {
    const q = QUESTS[id];
    if (q) toast(`✅ Zadanie dnia zrobione: <strong>${esc(q.text)}</strong> · +${QUEST_PTS} pkt, +${QUEST_XP} XP`);
  }
  let lvlCur = null; // otwarte okno awansu: kolejny awans w tym czasie tylko je aktualizuje
  function lvlCard(lvl, bonus) {
    const L = LEVELS[lvl - 1];
    return `<div class="lvlup__card">
        <div class="lvlup__ring" style="--ring:${ringCss(lvl)}"><span>${lvl}</span>${L.acc ? `<i aria-hidden="true">${L.acc}</i>` : ""}</div>
        <p class="lvlup__eyebrow">Nowy poziom!</p>
        <h2 id="lvlup-title">${esc(L.name)}</h2>
        <p class="lvlup__reward">Odblokowano: ${esc(L.reward)}${bonus ? ` · <strong>+${bonus} pkt</strong>` : ""}</p>
        <p class="lvlup__small">Tytuł „${esc(L.name)}” widać przy Twoim nicku w rankingu.</p>
        <button class="btn btn--primary" type="button" data-lvlup-close>Mrrr, super!</button>
      </div>`;
  }
  function showLevelUp(lvl, bonus) {
    if (lvlCur && lvlCur.el.open) {
      lvlCur.lvl = Math.max(lvlCur.lvl, lvl); lvlCur.bonus += bonus;
      const card = $(".lvlup__card", lvlCur.el);
      card.outerHTML = lvlCard(lvlCur.lvl, lvlCur.bonus);
      $("[data-lvlup-close]", lvlCur.el).focus({ preventScroll: true });
      if (G && G.confetti) G.confetti(60);
      clearTimeout(lvlCur.timer); lvlCur.timer = setTimeout(lvlCur.close, 7000);
      return;
    }
    const el = document.createElement("dialog");
    el.className = "lvlup";
    el.setAttribute("aria-labelledby", "lvlup-title");
    el.innerHTML = lvlCard(lvl, bonus);
    // osobne okno modalne: wyświetla się nad innymi oknami (np. wyborem nicku) i samo oddaje fokus
    document.body.appendChild(el);
    try { el.showModal(); } catch (e) { el.setAttribute("open", ""); }
    const cv = $("[data-confetti]");
    if (cv) el.appendChild(cv); // konfetti nad tłem okna
    if (G && G.confetti) G.confetti(120);
    const cur = lvlCur = { el, lvl, bonus, timer: null };
    cur.close = () => { clearTimeout(cur.timer); if (el.open) el.close(); };
    el.addEventListener("close", () => {
      const t = $("[data-toasts]");
      if (t && t.parentNode === el) document.body.appendChild(t);
      if (cv && cv.parentNode === el) document.body.appendChild(cv);
      el.remove();
      if (lvlCur === cur) lvlCur = null;
    });
    el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-lvlup-close]")) cur.close(); });
    cur.timer = setTimeout(cur.close, 7000);
  }

  /* ---------- gość: zasady takie jak na serwerze ---------- */
  function gBadge(id) {
    if (S.badges.includes(id)) return false;
    S.badges.push(id); save(); badgeToast(id); return true;
  }
  function gXp(n) {
    if (!(n > 0)) return;
    S.xp += n;
    const lvl = levelFor(S.xp);
    floatXp(n);
    if (lvl > S.lvl) {
      const bonus = levelBonus(S.lvl, lvl);
      S.lvl = lvl;
      if (G && G.addPoints) G.addPoints(bonus);
      showLevelUp(lvl, bonus);
    }
    if (lvl >= 5) gBadge("level5");
    if (lvl >= 10) gBadge("level10");
    save();
  }
  function gTimeBadges() { const h = hourPL(); if (h >= 22 || h < 4) gBadge("nightowl"); if (h >= 5 && h < 7) gBadge("earlybird"); }
  function gBump(counter, max) {
    ensureDay();
    let v = S.daily.c[counter] || 0;
    if (v >= (max || 1000)) return v;
    v += 1; S.daily.c[counter] = v;
    const newly = questsFor(S.daily.day).filter((id) => QUESTS[id].counter === counter && v >= QUESTS[id].target && !S.daily.done.includes(id));
    newly.forEach((id) => {
      S.daily.done.push(id);
      if (G && G.addPoints) G.addPoints(QUEST_PTS);
      questToast(id);
      gXp(QUEST_XP);
      gBadge("quest1");
    });
    if (newly.length && S.daily.done.length >= 3) { gXp(ALL_QUESTS_XP); gBadge("questall"); }
    gTimeBadges();
    save();
    return v;
  }
  function gCheckin() {
    const d = todayPL(), st = S.streak;
    if (st.last === d) return;
    const gap = st.last ? dayNum(d) - dayNum(st.last) : 99;
    let s = 1, freezeUsed = false;
    if (gap === 1) s = st.n + 1;
    else if (gap === 2 && st.freezeWeek !== weekStart(d)) { s = st.n + 1; st.freezeWeek = weekStart(d); freezeUsed = true; }
    const prev = st.n;
    st.n = s; st.best = Math.max(st.best, s); st.last = d;
    save();
    const pts = streakPts(s);
    if (G && G.addPoints) G.addPoints(pts);
    streakToast(s, pts, freezeUsed, prev, gap);
    gXp(streakXp(s));
    if (s >= 7) gBadge("visit7");
    if (s >= 30) gBadge("visit30");
    gBump("visit");
  }
  function streakToast(s, pts, freezeUsed, prev, gap) {
    if (freezeUsed) toast(`❄️ Mroźna łapka uratowała serię! <strong>${s} ${plural(s, "dzień", "dni", "dni")} z rzędu</strong> · +${pts} pkt`);
    else if (s === 1 && prev > 1 && gap > 1) toast(`🐾 Witaj z powrotem! Nowa seria wizyt: dzień 1 · <strong>+${pts} pkt</strong>`);
    else if (s === 1) toast(`🐾 Dzienna wizyta: <strong>+${pts} pkt</strong>. Wróć jutro, bonus będzie większy!`);
    else toast(`🔥 Seria wizyt: <strong>${s} ${plural(s, "dzień", "dni", "dni")} z rzędu</strong> · +${pts} pkt`);
  }

  /* ---------- konto: wywołania serwera ---------- */
  function enqueue(fn) {
    queue = queue.then(fn).catch((e) => { if (e && !/rate|limit|Zbyt/i.test(e.message || "")) console.warn("postęp:", e.message || e); });
    return queue;
  }
  function applyRemote(r, quiet) {
    if (!r || typeof r !== "object" || r.xp == null) return;
    const prev = R;
    R = r;
    (r.badges || []).forEach((id) => { if (!shown.has(id)) { shown.add(id); if (prev && !quiet) badgeToast(id); } });
    if (prev && !quiet) {
      (r.quests || []).forEach((q) => { const o = (prev.quests || []).find((x) => x.id === q.id); if (q.done && o && !o.done) questToast(q.id); });
      if (r.xp > prev.xp) floatXp(r.xp - prev.xp);
      if (r.level > prev.level) showLevelUp(r.level, levelBonus(prev.level, r.level));
    }
    if (G && G.setPoints) G.setPoints(r.points);
    render();
  }
  const sync = (quiet) => enqueue(() => api.rpc("get_progress", {}).then((r) => applyRemote(r, quiet)));
  let syncT = null;
  function syncSoon() { if (!api) return; clearTimeout(syncT); syncT = setTimeout(() => sync(false), 700); }
  function track(kind, cat) {
    if (!api || !cat) return;
    enqueue(() => api.rpc("track_action", { p_kind: kind, p_cat_id: cat.id }).then((r) => applyRemote(r, false)));
  }
  function remoteStart() {
    R = null; shown.clear();
    enqueue(() => api.rpc("get_progress", {}).then((r) => applyRemote(r, true)));
    enqueue(() => api.rpc("daily_checkin", {}).then((c) => {
      if (c && !c.already) streakToast(c.streak, c.points, c.freeze_used, c.previous, c.previous && c.streak === 1 ? 2 : 1);
    }));
    const ref = readRef();
    if (ref) {
      enqueue(() => api.rpc("claim_referral", { p_code: ref }).then((c) => {
        try { localStorage.removeItem(REF_KEY); } catch (e) { /* ignore */ }
        if (c && c.ok) toast(`🤝 Witaj z polecenia! Ty i osoba, która Cię zaprosiła, dostajecie po <strong>+${c.points} pkt</strong> i +${c.xp} XP.`);
        else if (c && c.reason === "old_account") toast("Link polecający działa tylko przy zakładaniu nowego konta.");
        else if (c && c.reason === "limit") toast("Ten link polecający osiągnął dzisiejszy limit. Dzięki, że jesteś!");
      }));
    }
    sync(false);
  }
  let lastCheckinDay = todayPL();
  function maybeNewDay() {
    const d = todayPL();
    if (d === lastCheckinDay) return;
    lastCheckinDay = d;
    if (api) remoteStart(); else if (guestChecked) { gCheckin(); render(); }
  }

  /* ---------- polecenia (?ref=KOD) ---------- */
  function readRef() { try { return localStorage.getItem(REF_KEY) || ""; } catch (e) { return ""; } }
  (function captureRef() {
    const u = new URL(location.href);
    const ref = (u.searchParams.get("ref") || "").toUpperCase();
    if (!u.searchParams.has("ref")) return;
    if (/^[A-Z0-9]{6,10}$/.test(ref)) { try { localStorage.setItem(REF_KEY, ref); } catch (e) { /* ignore */ } }
    u.searchParams.delete("ref");
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
  })();

  /* ---------- zdarzenia z gry ---------- */
  function event(type, cat, extra) {
    if (api) {
      if (type === "flip") track("flip", cat);
      else if (type === "details") track("details", cat);
      else if (["reveal_new", "bet", "win", "witness", "badge"].includes(type)) syncSoon();
      return;
    }
    switch (type) {
      case "reveal_new":
        gXp(10);
        if (cat && isOverlooked(cat) && !S.seenOver.includes(cat.id)) { S.seenOver.push(cat.id); if (S.seenOver.length >= 3) gBadge("overlooked"); }
        break;
      case "flip":
        gBump("flip", 60);
        if (isOverlooked(cat)) gBump("flip_overlooked", 60);
        break;
      case "details":
        gBump("details", 60);
        if (isOverlooked(cat)) gBump("details_overlooked", 60);
        if (cat && !S.reads.includes(cat.id)) { S.reads.push(cat.id); gXp(3); if (S.reads.length >= 5) gBadge("reader"); }
        break;
      case "bet": {
        S.stats.bets += 1;
        const n = gBump("bet", 1000);
        if (extra && extra.days) gBump("bet_days", 1000);
        if (isOverlooked(cat)) gBump("bet_overlooked", 1000);
        if (n <= 5) gXp(5);
        break;
      }
      case "win":
        S.stats.wins += 1;
        gXp(isSenior(cat) ? 30 : 20);
        if (isSenior(cat)) gBadge("senior_win");
        gBump("win", 1000);
        break;
      case "witness": gBadge("witness"); break;
    }
    save();
    render();
  }

  /* ---------- udostępnianie ---------- */
  function shareLink(cat) {
    const u = new URL(SITE);
    u.searchParams.set("kot", cat.id);
    if (api && R && R.ref_code) u.searchParams.set("ref", R.ref_code);
    u.hash = "gra";
    return u.toString();
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) { /* fallback niżej */ }
    const ta = document.createElement("textarea");
    ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    (document.querySelector("dialog[open]") || document.body).appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  function shared(cat) {
    if (api) { track("share", cat); return; }
    ensureDay();
    S.stats.shares += 1;
    const n = gBump("share", 50);
    gBadge("sharer");
    if (n <= 3) gXp(8);
    save(); render();
  }
  async function share(cat) {
    if (!cat) return;
    const url = shareLink(cat);
    const text = `${cat.name} szuka domu. Zobacz ${cat.sex === "kotka" ? "ją" : "go"} na podejrzyjkota.pl 🐾`;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ title: `${cat.name} szuka domu`, text, url }); shared(cat); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    if (await copyText(url)) { toast("🔗 Link skopiowany. Wklej go znajomym, może ktoś szuka właśnie takiego kota!"); shared(cat); }
    else toast(`Skopiuj link: <strong>${esc(url)}</strong>`);
  }

  /* ---------- widoki ---------- */
  function avatarRing(lvl, inner, cls) {
    const L = LEVELS[lvl - 1];
    return `<span class="ring ${cls || ""}${L.color === "rainbow" ? " ring--rainbow" : ""}" style="--ring:${ringCss(lvl)}">${inner}${L.acc ? `<i class="ring__acc" aria-hidden="true">${L.acc}</i>` : ""}</span>`;
  }
  function xpBar(v, big) {
    const L = LEVELS[v.level - 1], N = LEVELS[v.level];
    const pct = N ? Math.round(((v.xp - L.xp) / (N.xp - L.xp)) * 100) : 100;
    return `<div class="xpbar${big ? " xpbar--big" : ""}" role="progressbar" aria-label="Postęp poziomu" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
        <span style="width:${pct}%"></span></div>
      <p class="xpbar__txt">${N ? `<strong>${v.xp}</strong> / ${N.xp} XP · do poziomu „${esc(N.name)}” brakuje ${N.xp - v.xp} XP` : `<strong>${v.xp} XP</strong> · najwyższy poziom, jesteś legendą!`}</p>`;
  }
  function questList(v) {
    return `<ul class="quests">${v.quests.map((q) => {
      const d = QUESTS[q.id] || { icon: "⭐", text: q.id };
      return `<li class="quest${q.done ? " is-done" : ""}">
          <span class="quest__icon" aria-hidden="true">${q.done ? "✅" : d.icon}</span>
          <span class="quest__body"><span class="quest__txt">${esc(d.text)}</span>
            <span class="quest__bar" aria-hidden="true"><span style="width:${Math.round((q.progress / q.target) * 100)}%"></span></span></span>
          <span class="quest__num">${q.done ? "+" + QUEST_PTS + " pkt" : `${q.progress}/${q.target}`}</span>
        </li>`;
    }).join("")}</ul>`;
  }
  function streakLine(v) {
    const next = streakPts(v.streak + 1);
    return `<p class="streak"><span class="streak__flame" aria-hidden="true">🔥</span>
      <span><strong>${v.streak} ${plural(v.streak, "dzień", "dni", "dni")} z rzędu</strong> · jutro +${next} pkt${v.streak >= 7 ? " (maks.)" : ""}<br>
      <small>${v.freeze ? "❄️ Mroźna łapka gotowa: jeden opuszczony dzień w tym tygodniu nie przerwie serii." : "❄️ Mroźna łapka już użyta w tym tygodniu. Wróci w poniedziałek."}</small></span></p>`;
  }
  function badgeGrid(v, compact) {
    if (compact) {
      const got = BADGES.filter((b) => v.badges.has(b.id));
      return `<ul class="badges badges--mini" aria-label="Zdobyte odznaki">${got.length ? got.slice(-8).map((b) => `<li title="${esc(b.name)}: ${esc(b.desc)}"><span aria-hidden="true">${b.icon}</span><span class="sr-only">${esc(b.name)}</span></li>`).join("") : `<li class="badges__none">Jeszcze bez odznak. Odkryj pierwszą kartę!</li>`}</ul>`;
    }
    return GROUPS.map(([g, title]) => `<h4 class="pp__h4">${title}</h4><ul class="badges badges--grid">${BADGES.filter((b) => b.g === g).map((b) => {
      const has = v.badges.has(b.id);
      return `<li class="badge ${has ? "is-on" : ""}"><span class="badge__icon" aria-hidden="true">${has ? b.icon : "🔒"}</span>
        <span class="badge__name">${esc(b.name)}</span><span class="badge__desc">${has ? "zdobyta!" : esc(b.desc)}</span></li>`;
    }).join("")}</ul>`).join("");
  }
  function avatarInner() {
    const acc = window.PodejrzyjkotaAccount;
    const p = acc && acc.snap && acc.snap.profile;
    if (api && p && G) return `<span class="mini" style="--bg:${esc(G.avatarBg(p.avatar))}">${G.avatarSvg(p.avatar)}</span>`;
    return `<span class="mini mini--guest" aria-hidden="true">🐾</span>`;
  }
  function renderChip(v) {
    let chip = $("[data-lvl-chip]");
    if (!chip) {
      const pill = $(".points-pill");
      if (!pill) return;
      chip = document.createElement("button");
      chip.type = "button"; chip.className = "lvl-chip"; chip.setAttribute("data-lvl-chip", "");
      pill.parentNode.insertBefore(chip, pill);
      chip.addEventListener("click", openProfile);
    }
    const L = LEVELS[v.level - 1], N = LEVELS[v.level];
    const pct = N ? Math.round(((v.xp - L.xp) / (N.xp - L.xp)) * 100) : 100;
    chip.title = `Poziom ${v.level}: ${L.name} (${v.xp} XP). Kliknij, żeby otworzyć profil gracza.`;
    chip.setAttribute("aria-label", chip.title);
    const keep = Array.from(chip.querySelectorAll(".xpfloat"));
    chip.innerHTML = `<span class="lvl-chip__n" style="--ring:${ringCss(v.level)};--p:${pct}">${v.level}</span><span class="lvl-chip__name">${esc(L.name)}</span>`;
    keep.forEach((k) => chip.appendChild(k));
  }
  function render() {
    const v = vm();
    renderChip(v);
    const el = $("[data-path]");
    if (el) {
      const L = LEVELS[v.level - 1];
      el.innerHTML = `
        <div class="path__head">
          ${avatarRing(v.level, avatarInner(), "ring--md")}
          <div><p class="path__lvl">Poziom ${v.level}</p><h3 class="panel__title path__name">${esc(L.name)}</h3></div>
        </div>
        ${xpBar(v)}
        ${streakLine(v)}
        <h4 class="pp__h4">Zadania dnia <small>(nowe o północy)</small></h4>
        ${questList(v)}
        ${badgeGrid(v, true)}
        <button class="btn btn--soft btn--block" type="button" data-open-profile>🐾 Profil gracza: odznaki, poziomy, statystyki</button>`;
    }
    const dlg = $("[data-profile]");
    if (dlg && dlg.open) fillProfile(dlg, v);
  }
  function fillProfile(dlg, v) {
    const body = $(".sheet__in", dlg), top = body.scrollTop;
    const L = LEVELS[v.level - 1];
    const acc = window.PodejrzyjkotaAccount;
    const nick = api && acc && acc.snap && acc.snap.profile ? acc.snap.profile.nickname : "Gość";
    const got = BADGES.filter((b) => v.badges.has(b.id)).length;
    const st = v.stats;
    body.innerHTML = `
      <button class="sheet__close" type="button" data-close aria-label="Zamknij">×</button>
      <div class="pp">
        <div class="pp__hero">
          ${avatarRing(v.level, avatarInner(), "ring--lg")}
          <div><p class="eyebrow">Profil gracza</p><h2 id="pp-title">${esc(nick)}</h2>
          <p class="pp__title">Poziom ${v.level}: <strong>${esc(L.name)}</strong></p></div>
        </div>
        ${xpBar(v, true)}
        <div class="pp__cols">
          <section class="pp__box"><h3>Seria wizyt</h3>${streakLine(v)}<p class="pp__small">Najdłuższa seria: ${v.best} ${plural(v.best, "dzień", "dni", "dni")}. Bonus rośnie codziennie, do +35 pkt od 7. dnia.</p></section>
          <section class="pp__box"><h3>Zadania dnia</h3>${questList(v)}<p class="pp__small">Za każde: +${QUEST_PTS} pkt i +${QUEST_XP} XP. Za komplet dodatkowo +${ALL_QUESTS_XP} XP.</p></section>
        </div>
        <section class="pp__sec"><h3>Odznaki <small>${got} z ${BADGES.length}</small></h3>${badgeGrid(v, false)}</section>
        <section class="pp__sec"><h3>Poziomy i nagrody</h3>
          <ol class="levels">${LEVELS.map((l, i) => `<li class="${i + 1 <= v.level ? "is-on" : ""}${i + 1 === v.level ? " is-now" : ""}">
            <span class="levels__n" style="--ring:${ringCss(i + 1)}">${i + 1}</span>
            <span class="levels__b"><strong>${esc(l.name)}</strong> <small>${l.xp} XP</small><br><span>${esc(l.reward)}${i ? ` · +${(i + 1) * 10} pkt` : ""}</span></span></li>`).join("")}</ol></section>
        <section class="pp__sec"><h3>Statystyki</h3>
          <ul class="ppstats">
            <li><strong>${st.reveals || 0}</strong><span>odkrytych kotów</span></li>
            <li><strong>${st.reads || 0}</strong><span>poznanych historii</span></li>
            <li><strong>${st.bets || 0}</strong><span>zakładów</span></li>
            <li><strong>${st.wins || 0}</strong><span>wygranych</span></li>
            <li><strong>${st.shares || 0}</strong><span>udostępnień</span></li>
            ${v.remote ? `<li><strong>${st.friends || 0}</strong><span>poleconych znajomych</span></li><li><strong>${v.weekXp}</strong><span>XP w tym tygodniu</span></li>` : ""}
          </ul></section>
        ${v.remote ? `<section class="pp__box pp__ref"><h3>Zaproś znajomych</h3>
            <p>Gdy ktoś założy konto z Twojego linku, oboje dostajecie <strong>+50 pkt i +60 XP</strong> (raz na nowe konto, do 5 osób dziennie).</p>
            <div class="pp__refrow"><input type="text" readonly value="${esc(SITE + "?ref=" + v.refCode)}" aria-label="Twój link polecający" data-ref-input>
            <button class="btn btn--primary btn--sm" type="button" data-copy-ref>Kopiuj</button></div></section>`
          : `<section class="pp__box pp__ref"><h3>Graj z kontem</h3><p>Jako gość postęp zapisuje się tylko w tej przeglądarce. Z kontem zabierzesz poziom i odznaki na każde urządzenie, trafisz do rankingu tygodnia i dostaniesz link do zapraszania znajomych.</p>
            ${window.PodejrzyjkotaAccount && window.PodejrzyjkotaAccount.client ? `<button class="btn btn--primary btn--sm" type="button" data-action="login">Zaloguj się</button>` : ""}</section>`}
        <p class="pp__note">Punkty, XP, poziomy i odznaki są tylko dla zabawy. Nie mają wartości pieniężnej, nie da się ich kupić ani wymienić na nagrody.</p>
      </div>`;
    body.scrollTop = top;
  }
  function openProfile() {
    let dlg = $("[data-profile]");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "sheet sheet--player"; dlg.setAttribute("data-profile", ""); dlg.setAttribute("aria-labelledby", "pp-title");
      dlg.innerHTML = `<div class="sheet__in"></div>`;
      document.body.appendChild(dlg);
      dlg.addEventListener("click", async (e) => {
        if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
        if (e.target.closest('[data-action="login"]')) dlg.close();
        if (e.target.closest("[data-copy-ref]")) {
          const inp = $("[data-ref-input]", dlg);
          if (await copyText(inp.value)) toast("🔗 Link polecający skopiowany."); else inp.select();
        }
      });
      dlg.addEventListener("close", () => { const t = $("[data-toasts]"); if (t && t.parentNode === dlg) document.body.appendChild(t); });
    }
    document.querySelectorAll("dialog[open]").forEach((d) => { if (d !== dlg) d.close(); });
    fillProfile(dlg, vm());
    if (!dlg.open) dlg.showModal();
    $(".sheet__in", dlg).scrollTop = 0;
    if (api) sync(true);
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-open-profile]")) { e.preventDefault(); openProfile(); } });

  /* ---------- API ---------- */
  const P = {
    LEVELS, BADGES, QUESTS, levelFor, questsFor, isSenior, isBlack, isOverlooked, todayPL,
    levelName: (l) => (LEVELS[(l || 1) - 1] || LEVELS[0]).name,
    ringCss,
    attach(game) {
      G = game;
      // odznaki z wcześniejszej wersji gry (stan gry gościa)
      const gs = G.getState();
      if (gs && !G.isRemote()) (gs.badges || []).forEach((id) => { if (!S.badges.includes(id)) S.badges.push(id); });
      if (!S.lvl || S.lvl < levelFor(S.xp)) S.lvl = levelFor(S.xp);
      save();
      render();
      // gość dostaje dzienną wizytę dopiero, gdy wiadomo, że nie jest zalogowany
      let waited = 0;
      setTimeout(function wait() {
        const acc = window.PodejrzyjkotaAccount;
        if (acc && acc.configured && !authKnown && waited < 8000) { waited += 500; setTimeout(wait, 500); return; }
        guestCheckin();
      }, 900);
    },
    event,
    // centralne nadawanie odznak (toast tylko raz)
    giveBadge(id) {
      if (api) {
        if (shown.has(id) || (R && (R.badges || []).includes(id))) return false;
        shown.add(id); badgeToast(id); syncSoon(); return true;
      }
      const r = gBadge(id); render(); return r;
    },
    hasBadge: (id) => vm().badges.has(id),
    share,
    render,
    openProfile,
    sync: () => { if (api) sync(false); },
    guestExport() {
      const s = load();
      return { xp: s.xp, badges: s.badges.slice(), bestVisit: s.streak.best };
    }
  };
  let authKnown = false, guestChecked = false;
  function guestCheckin() {
    if (api || guestChecked || !G) return;
    guestChecked = true; lastCheckinDay = todayPL();
    gCheckin(); render();
  }
  document.addEventListener("podejrzyjkota:auth", (e) => {
    const user = e.detail && e.detail.user;
    const acc = window.PodejrzyjkotaAccount;
    authKnown = true;
    if (user && acc && acc.rpc) { api = { rpc: acc.rpc }; remoteStart(); }
    else { if (api) { api = null; R = null; S = load(); render(); } setTimeout(guestCheckin, 600); }
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") maybeNewDay(); });
  setInterval(maybeNewDay, 60000);
  window.PodejrzyjkotaProgress = P;
})();
