/* podejrzyjkota: konta graczy (Supabase Auth + Postgres)
 * Działa tylko, gdy js/config.js ma supabaseUrl i supabaseAnonKey. Bez tego: tryb gościa (nic się nie zmienia).
 * Wszystkie zmiany punktów idą przez funkcje RPC w bazie (supabase/migrations), klient ich nie liczy.
 */
(function () {
  "use strict";

  const CFG = window.PODEJRZYJKOTA_CONFIG || {};
  const AUTH = Object.assign({ google: true, magicLink: true, password: true }, CFG.auth || {});
  const url = String(CFG.supabaseUrl || "").trim().replace(/\/+$/, "");
  const key = String(CFG.supabaseAnonKey || "").trim();
  const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  const API = (window.PodejrzyjkotaAccount = { configured: false, client: null, user: null, snap: null });

  function jwtRole(k) {
    try { return JSON.parse(atob(k.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role; } catch (e) { return null; }
  }
  const placeholder = /TWOJ-PROJEKT|WKLEJ-TU/i.test(url + key);
  if (!url || !key || placeholder) return;                       // tryb gościa
  if (/^sb_secret_/.test(key) || jwtRole(key) === "service_role") {
    console.error("[podejrzyjkota] W js/config.js jest klucz service_role/secret. To niebezpieczne: logowanie wyłączone. Użyj klucza anon/public.");
    return;
  }
  // Aplikacja Android (Capacitor): logowanie wymaga deep linków i przebudowy, na razie tryb gościa
  if (isNative && !CFG.allowInNativeApp) return;

  API.configured = true;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const Game = () => window.PodejrzyjkotaGame || null;
  const AVATARS = ["pierniczek", "smuga", "frak", "latka", "mgielka", "wegielek", "iskra", "karmel", "pianka"];
  const isAdminPage = !!document.querySelector("[data-admin-root]");
  const redirectTo = location.origin + location.pathname;
  let sb = null;

  /* ---------- pomocnicze ---------- */
  function toast(html) {
    if (Game()) return Game().toast(html);
    let box = $("[data-toasts]");
    if (!box) { box = document.createElement("div"); box.className = "toasts"; box.dataset.toasts = ""; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    const host = document.querySelector("dialog[open]") || document.body;
    if (box.parentNode !== host) host.appendChild(box);
    const t = document.createElement("div"); t.className = "toast"; t.innerHTML = html; box.appendChild(t);
    setTimeout(() => t.classList.add("is-out"), 3600); setTimeout(() => t.remove(), 4100);
  }
  function plMsg(e) {
    const m = String((e && (e.message || e.error_description || e.msg)) || e || "");
    const map = [
      [/Invalid login credentials/i, "Zły e-mail lub hasło."],
      [/Email not confirmed/i, "Najpierw potwierdź adres e-mail (kliknij link w wiadomości)."],
      [/User already registered/i, "Konto z tym adresem już istnieje. Zaloguj się."],
      [/only request this after (\d+) seconds?/i, (x) => `Ze względów bezpieczeństwa poczekaj ${x[1]} s i spróbuj ponownie.`],
      [/rate limit|too many/i, "Za dużo prób. Spróbuj za kilka minut."],
      [/Password should be at least (\d+)/i, (x) => `Hasło musi mieć co najmniej ${x[1]} znaków.`],
      [/weak.?password|pwned/i, "To hasło jest zbyt słabe albo wyciekło w sieci. Wybierz inne."],
      [/invalid format|valid email|Unable to validate email/i, "Niepoprawny adres e-mail."],
      [/Signups not allowed/i, "Rejestracja jest wyłączona."],
      [/provider is not enabled/i, "To logowanie nie jest jeszcze włączone w Supabase."],
      [/Failed to fetch|NetworkError|Load failed/i, "Brak połączenia z serwerem. Spróbuj za chwilę."]
    ];
    for (const [re, out] of map) { const x = m.match(re); if (x) return typeof out === "function" ? out(x) : out; }
    return m || "Coś poszło nie tak. Spróbuj ponownie.";
  }
  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args || {});
    if (error) throw error;
    return data;
  }
  function avatarHtml(id, cls) {
    const g = Game();
    const svg = g ? g.avatarSvg(id) : (window.PODEJRZYJKOTA_DATA && window.CatArt ? (() => {
      const c = window.PODEJRZYJKOTA_DATA.cats.find((x) => x.id === id); return c ? window.CatArt.catSvg(c, { title: false }) : "";
    })() : "");
    const bg = g ? g.avatarBg(id) : "#F3E9DC";
    return `<span class="mini ${cls || ""}" style="--bg:${esc(bg)}">${svg}</span>`;
  }
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Nie udało się wczytać " + src)); document.head.appendChild(s); });
  }
  const base = (document.currentScript && document.currentScript.src.replace(/account\.js(\?.*)?$/, "")) || "js/";
  function dialog(cls, html) {
    const d = document.createElement("dialog");
    d.className = "sheet sheet--auth " + (cls || "");
    d.innerHTML = `<div class="sheet__in">${html}</div>`;
    document.body.appendChild(d);
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
    d.addEventListener("close", () => { const box = $("[data-toasts]"); if (box && box.parentNode === d) document.body.appendChild(box); setTimeout(() => d.remove(), 0); });
    d.showModal();
    return d;
  }

  /* ---------- mapowanie kotów z bazy na format gry ---------- */
  function mapCat(r) {
    return {
      id: r.id, name: r.name, nameAcc: r.name_acc || r.name, age: r.age || "", sex: r.sex, traits: r.traits || [],
      shelter: r.shelter_id, story: r.story || "", status: r.status, adoptedNote: r.adopted_note || "",
      adoptedAt: r.adopted_at, popularity: r.popularity || 3, look: r.look || {}, photo: r.photo_url || null,
      listingUrl: r.listing_url || "", contactName: r.contact_name || "", contactPhone: r.contact_phone || "", contactEmail: r.contact_email || ""
    };
  }
  API.mapCat = mapCat;
  let catsSig = "";
  async function loadCats() {
    const [c, s] = await Promise.all([
      sb.from("cats").select("*").order("sort_order").order("name"),
      sb.from("shelters").select("*")
    ]);
    if (c.error || !c.data || !c.data.length) return;
    const sig = JSON.stringify(c.data.map((x) => [x.id, x.status, x.updated_at])) + (s.data || []).length;
    if (sig === catsSig) return;
    catsSig = sig;
    if (Game()) Game().setCats(c.data.map(mapCat), s.data || []);
  }

  /* ---------- nagłówek: przycisk logowania / menu konta ---------- */
  const slot = $("[data-account]");
  function renderHeader() {
    if (!slot) return;
    slot.hidden = false;
    const u = API.user, p = API.snap && API.snap.profile;
    if (!u || !p) {
      slot.innerHTML = `<button class="btn btn--ghost btn--sm account__login" type="button" data-action="login"><span aria-hidden="true">👤</span><span class="account__login-txt">Zaloguj się</span></button>`;
      return;
    }
    slot.innerHTML = `
      <button class="account__btn" type="button" aria-haspopup="menu" aria-expanded="false" data-account-toggle title="Twoje konto">
        ${avatarHtml(p.avatar, "mini--sm")}<span class="account__nick">${esc(p.nickname)}</span><span class="account__caret" aria-hidden="true">▾</span>
      </button>
      <div class="account__menu" role="menu" data-account-menu hidden>
        <div class="account__head">${avatarHtml(p.avatar)}<div><strong>${esc(p.nickname)}</strong><span>${esc(u.email || "")}</span></div></div>
        <button role="menuitem" type="button" data-acc="profile">✏️ Nick i awatar</button>
        ${Game() ? `<button role="menuitem" type="button" data-acc="leaderboard">🏆 Ranking globalny</button>` : `<a role="menuitem" href="index.html#gra">🐾 Wróć do gry</a>`}
        ${API.snap.is_admin && !isAdminPage ? `<a role="menuitem" href="admin.html">🛠️ Panel administratora</a>` : ""}
        <button role="menuitem" type="button" data-acc="export">⬇️ Pobierz moje dane (JSON)</button>
        <button role="menuitem" type="button" data-acc="logout">🚪 Wyloguj</button>
        <hr>
        <button role="menuitem" type="button" class="is-danger" data-acc="delete">🗑️ Usuń konto</button>
      </div>`;
  }
  function closeMenu() {
    const m = $("[data-account-menu]"), t = $("[data-account-toggle]");
    if (m) m.hidden = true; if (t) t.setAttribute("aria-expanded", "false");
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-account-toggle]");
    if (t) {
      const m = $("[data-account-menu]"); const open = m.hidden;
      m.hidden = !open; t.setAttribute("aria-expanded", String(open));
      if (open) { const f = m.querySelector("[role=menuitem]"); if (f) f.focus(); }
      return;
    }
    if (!e.target.closest("[data-account-menu]")) closeMenu();
    const a = e.target.closest("[data-acc]");
    if (a) {
      closeMenu();
      ({ profile: openProfile, export: exportData, logout, delete: openDelete,
         leaderboard: () => Game().openLeaderboard() })[a.dataset.acc]();
    }
    if (e.target.closest('[data-action="login"]')) { e.preventDefault(); openLogin(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  /* ---------- okno logowania ---------- */
  function openLogin(view) {
    const d = dialog("sheet--login", `
      <button class="sheet__close" type="button" data-close aria-label="Zamknij">×</button>
      <div class="auth" data-auth>
        <div class="auth__cats" aria-hidden="true">${["latka", "pierniczek", "mgielka"].map((id) => avatarHtml(id)).join("")}</div>
        <h2 id="auth-title">Zaloguj się</h2>
        <p class="auth__lead">Zapisz punkty, odznaki i zakłady na koncie, graj na kilku urządzeniach i powalcz w <strong>rankingu globalnym</strong>. Konto jest opcjonalne: bez niego gra działa jak dotąd.</p>
        <div class="auth__view" data-view="main">
          ${AUTH.google ? `<button class="btn btn--google btn--block" type="button" data-google>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
              Kontynuuj z Google</button>
            <p class="auth__or"><span>albo e-mailem</span></p>` : ""}
          <form class="auth__form" data-form="magic" novalidate>
            <label class="field"><span>Adres e-mail</span>
              <input type="email" name="email" autocomplete="email" inputmode="email" required placeholder="np. ala@poczta.pl"></label>
            ${AUTH.magicLink ? `<button class="btn btn--primary btn--block" type="submit" data-submit="magic">✉️ Wyślij link logowania</button>
            <p class="auth__hint">Bez hasła: klikasz link w e-mailu i jesteś zalogowany(-a). Pierwsze logowanie zakłada konto.</p>` : ""}
            ${AUTH.password ? `<div class="auth__pw" data-pw ${AUTH.magicLink ? "hidden" : ""}>
                <label class="field"><span>Hasło</span>
                  <input type="password" name="password" autocomplete="current-password" minlength="8" placeholder="min. 8 znaków"></label>
                <div class="auth__row">
                  <button class="btn btn--primary" type="button" data-submit="signin">Zaloguj</button>
                  <button class="btn btn--soft" type="button" data-submit="signup">Załóż konto</button>
                </div>
                <button class="link-btn" type="button" data-submit="reset">Nie pamiętam hasła</button>
              </div>
              ${AUTH.magicLink ? `<button class="link-btn" type="button" data-toggle-pw>Wolę zalogować się hasłem</button>` : ""}` : ""}
            <p class="auth__err" data-err role="alert" hidden></p>
          </form>
        </div>
        <div class="auth__view auth__sent" data-view="sent" hidden>
          <div class="auth__big" aria-hidden="true">📬</div>
          <h3>Sprawdź skrzynkę</h3>
          <p data-sent-msg></p>
          <p class="auth__hint">Nie widzisz wiadomości? Zajrzyj do spamu albo „Oferty”. Link działa przez godzinę.</p>
          <button class="btn btn--soft btn--block" type="button" data-back>← Zmień adres</button>
        </div>
        <div class="auth__view" data-view="newpw" hidden>
          <form class="auth__form" data-form="newpw">
            <label class="field"><span>Nowe hasło</span><input type="password" name="newpw" autocomplete="new-password" minlength="8" required placeholder="min. 8 znaków"></label>
            <button class="btn btn--primary btn--block" type="submit">Zapisz nowe hasło</button>
            <p class="auth__err" data-err2 role="alert" hidden></p>
          </form>
        </div>
        <p class="auth__fine">Logując się, akceptujesz <a href="regulamin.html#konta">regulamin</a> i potwierdzasz, że znasz <a href="polityka-prywatnosci.html#konta">politykę prywatności</a>. Twój nick i wynik są widoczne w rankingu. Konto możesz w każdej chwili usunąć.</p>
        <button class="btn btn--ghost btn--block" type="button" data-close>Graj dalej jako gość</button>
      </div>`);
    const form = $("[data-form=magic]", d), err = $("[data-err]", d);
    const show = (v) => $$("[data-view]", d).forEach((x) => (x.hidden = x.dataset.view !== v));
    const fail = (e) => { err.textContent = plMsg(e); err.hidden = false; };
    const busy = (on) => $$("button[data-submit], [data-google]", d).forEach((b) => (b.disabled = on));
    const email = () => form.elements.email.value.trim();
    const okEmail = () => { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email())) { fail("Niepoprawny adres e-mail."); form.elements.email.focus(); return false; } err.hidden = true; return true; };
    const sent = (msg) => { $("[data-sent-msg]", d).innerHTML = msg; show("sent"); };
    if (view === "newpw") { show("newpw"); $("#auth-title", d).textContent = "Ustaw nowe hasło"; }

    const g = $("[data-google]", d);
    if (g) g.addEventListener("click", async () => {
      busy(true);
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (error) { busy(false); fail(error); }
    });
    const tp = $("[data-toggle-pw]", d);
    if (tp) tp.addEventListener("click", () => {
      const pw = $("[data-pw]", d); pw.hidden = !pw.hidden;
      tp.textContent = pw.hidden ? "Wolę zalogować się hasłem" : "Wolę link e-mailem (bez hasła)";
      const mb = $("[data-submit=magic]", d); if (mb) mb.hidden = !pw.hidden;
      $$(".auth__hint", form).forEach((h) => (h.hidden = !pw.hidden));
      if (!pw.hidden) form.elements.password.focus();
    });
    $("[data-back]", d).addEventListener("click", () => show("main"));
    async function act(kind) {
      if (!okEmail()) return;
      const password = form.elements.password ? form.elements.password.value : "";
      if ((kind === "signin" || kind === "signup") && password.length < 8) { fail("Hasło musi mieć co najmniej 8 znaków."); return; }
      busy(true);
      try {
        if (kind === "magic") {
          const { error } = await sb.auth.signInWithOtp({ email: email(), options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
          if (error) throw error;
          sent(`Wysłaliśmy link logowania na <strong>${esc(email())}</strong>. Kliknij go w tej przeglądarce lub na tym samym urządzeniu.`);
        } else if (kind === "signin") {
          const { error } = await sb.auth.signInWithPassword({ email: email(), password });
          if (error) throw error;
          d.close();
        } else if (kind === "signup") {
          const { data, error } = await sb.auth.signUp({ email: email(), password, options: { emailRedirectTo: redirectTo } });
          if (error) throw error;
          if (data.session) d.close();
          else sent(`Prawie gotowe! Wysłaliśmy wiadomość na <strong>${esc(email())}</strong>. Kliknij link, żeby potwierdzić adres, a potem zaloguj się hasłem.`);
        } else if (kind === "reset") {
          const { error } = await sb.auth.resetPasswordForEmail(email(), { redirectTo });
          if (error) throw error;
          sent(`Jeśli konto <strong>${esc(email())}</strong> istnieje, wysłaliśmy link do ustawienia nowego hasła.`);
        }
      } catch (e) { fail(e); } finally { busy(false); }
    }
    form.addEventListener("submit", (e) => { e.preventDefault(); act($("[data-pw]", d) && !$("[data-pw]", d).hidden ? "signin" : "magic"); });
    $$("[data-submit]", d).forEach((b) => b.addEventListener("click", (e) => { if (b.type !== "submit") { e.preventDefault(); act(b.dataset.submit); } }));
    $("[data-form=newpw]", d).addEventListener("submit", async (e) => {
      e.preventDefault();
      const pw = e.target.elements.newpw.value, er = $("[data-err2]", d);
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) { er.textContent = plMsg(error); er.hidden = false; return; }
      d.close(); toast("🔑 Nowe hasło zapisane.");
    });
    setTimeout(() => { if (!view) form.elements.email.focus(); }, 50);
    return d;
  }
  API.openLogin = openLogin;

  /* ---------- profil: nick + awatar ---------- */
  function openProfile(first) {
    const p = API.snap.profile;
    const d = dialog("sheet--profile", `
      <button class="sheet__close" type="button" data-close aria-label="Zamknij">×</button>
      <form class="profile" data-profile>
        <h2 id="profile-title">${first ? "Witaj w grze! 🎉" : "Nick i awatar"}</h2>
        <p class="auth__lead">${first ? "Wybierz nick, pod którym zobaczą Cię inni w rankingu, i swojego kota-awatara." : "Nick jest publiczny (ranking). Nie używaj imienia i nazwiska ani adresu e-mail."}</p>
        <label class="field"><span>Nick (3–20 znaków)</span>
          <input name="nickname" required minlength="3" maxlength="20" pattern="[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_.\\-]{3,20}" value="${esc(p.nickname)}" autocomplete="nickname" spellcheck="false"></label>
        <p class="field__hint" data-nick-hint>Litery, cyfry, kropka, myślnik, podkreślnik.</p>
        <fieldset class="avatars"><legend>Awatar</legend>
          ${AVATARS.map((id) => `<label class="avatar-opt"><input type="radio" name="avatar" value="${id}" ${id === p.avatar ? "checked" : ""}>${avatarHtml(id, "mini--lg")}<span>${esc(id === "latka" ? "Łatka" : id === "mgielka" ? "Mgiełka" : id === "wegielek" ? "Węgielek" : id.charAt(0).toUpperCase() + id.slice(1))}</span></label>`).join("")}
        </fieldset>
        <p class="auth__err" data-err role="alert" hidden></p>
        <div class="auth__row"><button class="btn btn--primary" type="submit">Zapisz</button><button class="btn btn--ghost" type="button" data-close>${first ? "Później" : "Anuluj"}</button></div>
      </form>`);
    const f = $("[data-profile]", d), hint = $("[data-nick-hint]", d), err = $("[data-err]", d);
    let tmr = null;
    f.elements.nickname.addEventListener("input", () => {
      clearTimeout(tmr);
      const v = f.elements.nickname.value.trim();
      if (!f.elements.nickname.checkValidity()) { hint.textContent = "3–20 znaków: litery, cyfry, kropka, myślnik, podkreślnik."; hint.className = "field__hint is-bad"; return; }
      tmr = setTimeout(async () => {
        try { const ok = await rpc("nickname_available", { p_nickname: v }); hint.textContent = ok ? "✓ Nick wolny" : "✗ Ten nick jest zajęty"; hint.className = "field__hint " + (ok ? "is-ok" : "is-bad"); } catch (e) { /* ignore */ }
      }, 350);
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const r = await rpc("update_profile", { p_nickname: f.elements.nickname.value.trim(), p_avatar: f.elements.avatar.value });
        Object.assign(API.snap.profile, r);
        renderHeader(); d.close(); toast(`😺 Zapisano: <strong>${esc(r.nickname)}</strong>`);
        if (Game()) Game().refreshLeaderboard();
      } catch (er) { err.textContent = plMsg(er); err.hidden = false; }
    });
  }

  /* ---------- RODO: eksport i usunięcie ---------- */
  async function exportData() {
    try {
      const data = await rpc("export_my_data");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `podejrzyjkota-moje-dane-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast("⬇️ Pobrano plik z Twoimi danymi (JSON).");
    } catch (e) { toast(esc(plMsg(e))); }
  }
  function openDelete() {
    const d = dialog("sheet--delete", `
      <button class="sheet__close" type="button" data-close aria-label="Zamknij">×</button>
      <form class="profile" data-del>
        <h2>Usunąć konto?</h2>
        <p>Usuniemy <strong>na zawsze</strong>: konto logowania (e-mail), profil (nick, awatar), punkty, zakłady, odznaki, odkryte karty i historię punktów. Znikniesz z rankingu. Tego nie da się cofnąć.</p>
        <p class="auth__hint">Chcesz zachować kopię? <button class="link-btn link-btn--inline" type="button" data-export>Pobierz najpierw swoje dane (JSON)</button>.</p>
        <label class="field"><span>Wpisz <strong>USUŃ</strong>, żeby potwierdzić</span><input name="confirm" autocomplete="off" spellcheck="false"></label>
        <p class="auth__err" data-err role="alert" hidden></p>
        <div class="auth__row"><button class="btn btn--danger" type="submit" disabled>Usuń konto na zawsze</button><button class="btn btn--ghost" type="button" data-close>Anuluj</button></div>
      </form>`);
    const f = $("[data-del]", d), btn = $("button[type=submit]", f);
    f.elements.confirm.addEventListener("input", () => { btn.disabled = f.elements.confirm.value.trim().toUpperCase() !== "USUŃ"; });
    $("[data-export]", d).addEventListener("click", exportData);
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); btn.disabled = true;
      try {
        await rpc("delete_my_account");
        try { localStorage.removeItem("podejrzyjkota:acct-seen:" + API.user.id); } catch (x) { /* ignore */ }
        await sb.auth.signOut({ scope: "local" });
        d.close();
        toast("🗑️ Konto i wszystkie dane zostały usunięte. Grasz dalej jako gość.");
      } catch (er) { $("[data-err]", d).textContent = plMsg(er); $("[data-err]", d).hidden = false; btn.disabled = false; }
    });
  }
  async function logout() {
    await sb.auth.signOut({ scope: "local" });
    toast("👋 Wylogowano. Grasz dalej jako gość.");
  }

  /* ---------- sesja ---------- */
  let currentUid = null, refreshTimer = null;
  async function onSignedIn(session) {
    if (currentUid === session.user.id) { API.user = session.user; return; }
    currentUid = session.user.id;
    API.user = session.user;
    try {
      let snap = await rpc("get_my_state");
      if (!snap.profile.migrated_at && Game()) {
        const gp = Game().getGuestProgress();
        const r = await rpc("import_guest_progress", gp
          ? { p_points: gp.points, p_badges: gp.badges, p_seen: gp.seen, p_best_streak: gp.bestStreak }
          : { p_points: 0, p_badges: [], p_seen: [], p_best_streak: 0 });
        if (gp && r.imported) {
          toast(`📦 Przenieśliśmy postęp z tej przeglądarki${r.points_added ? `: <strong>+${r.points_added} pkt</strong>` : ""}, odznaki i odkryte karty.${gp.bets ? " Zakłady demo zostają w trybie gościa." : ""}`);
        }
        snap = await rpc("get_my_state");
      }
      API.snap = snap;
      renderHeader();
      if (Game()) Game().enterAccount({ rpc }, snap);
      document.dispatchEvent(new CustomEvent("podejrzyjkota:auth", { detail: { user: session.user, snap } }));
      const k = "podejrzyjkota:welcomed:" + session.user.id;
      if (Game() && /^Kot_[0-9a-f]{6}$/.test(snap.profile.nickname) && !localStorage.getItem(k)) {
        try { localStorage.setItem(k, "1"); } catch (e) { /* ignore */ }
        setTimeout(() => openProfile(true), 400);
      } else if (!Game() || !snap.profile.migrated_at) {
        /* nic */
      }
      clearInterval(refreshTimer);
      refreshTimer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 60000);
    } catch (e) {
      console.error(e);
      toast("Nie udało się wczytać konta: " + esc(plMsg(e)));
    }
  }
  function onSignedOut() {
    const was = currentUid;
    currentUid = null; API.user = null; API.snap = null;
    clearInterval(refreshTimer);
    renderHeader();
    if (was && Game()) Game().leaveAccount();
    document.dispatchEvent(new CustomEvent("podejrzyjkota:auth", { detail: { user: null, snap: null } }));
  }
  async function refresh() {
    if (!API.user) return;
    try {
      await loadCats();
      const snap = await rpc("get_my_state");
      API.snap = snap; renderHeader();
      if (Game()) Game().applySnapshot(snap);
    } catch (e) { /* offline: spróbujemy później */ }
  }
  API.refresh = refresh;
  API.rpc = (n, a) => rpc(n, a);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });

  /* ---------- start ---------- */
  (async function init() {
    try {
      if (!window.supabase || !window.supabase.createClient) await loadScript(base + "vendor/supabase.js");
      sb = window.supabase.createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "podejrzyjkota-auth" }
      });
      API.client = sb;
    } catch (e) { console.error(e); return; }
    $$("[data-accounts-only]").forEach((n) => (n.hidden = false));
    if (Game()) Game().setAccountsAvailable(true);
    renderHeader();
    // błąd z linku (np. wygasły magic link): #error=...&error_description=...
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get("error_description")) {
      toast("Logowanie nie powiodło się: " + esc(/expired|invalid/i.test(h.get("error_description")) ? "link wygasł lub był już użyty. Poproś o nowy." : h.get("error_description")));
      history.replaceState(null, "", location.pathname + location.search);
    }
    loadCats().catch(() => {});
    sb.auth.onAuthStateChange((event, session) => {
      // bez await w callbacku (zalecenie supabase-js), właściwa praca w kolejnym ticku
      setTimeout(() => {
        if (event === "PASSWORD_RECOVERY") openLogin("newpw");
        if (session && session.user) onSignedIn(session);
        else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") onSignedOut();
        if (/access_token|refresh_token|type=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
      }, 0);
    });
  })();
})();
