/* podejrzyjkota: panel administratora (admin.html)
 * Dostęp chronią polityki RLS w bazie (tabela public.admins + funkcja is_admin()).
 * Ten plik tylko wyświetla formularze: nawet zmodyfikowany w przeglądarce nie da uprawnień.
 */
(function () {
  "use strict";
  const ACC = window.PodejrzyjkotaAccount || { configured: false };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const body = $("[data-admin-body]");
  const PATTERNS = [["solid", "jednolity"], ["tabby", "pręgowany"], ["tuxedo", "frak (czarno-biały)"], ["bicolor", "dwukolorowy"], ["pointed", "syjamski (pointy)"], ["calico", "szylkretowy z białym (calico)"], ["tortie", "szylkretowy"]];
  const EXTRAS = [["none", "brak"], ["collar", "obroża"], ["bow", "kokardka"]];
  let sb = null, cats = [], shelters = [], stats = null;

  function toast(html) {
    const box = $("[data-toasts]");
    const host = document.querySelector("dialog[open]") || document.body;
    if (box.parentNode !== host) host.appendChild(box);
    const t = document.createElement("div"); t.className = "toast"; t.innerHTML = html; box.appendChild(t);
    setTimeout(() => t.classList.add("is-out"), 4200); setTimeout(() => t.remove(), 4700);
  }
  function msg(e) {
    const m = String((e && e.message) || e || "");
    if (/violates foreign key constraint.*(bets|user_reveals)/i.test(m)) return "Nie można usunąć kota, który ma zakłady albo odkryte karty graczy. Zamiast usuwać, użyj „Ukryj kota”.";
    if (/cats_listing_url_check/.test(m)) return "Link do ogłoszenia musi zaczynać się od http:// albo https:// (max 500 znaków).";
    if (/cats_contact_phone_check/.test(m)) return "Telefon może mieć tylko cyfry, spacje, myślniki, nawiasy i + na początku (np. 500 100 200).";
    if (/cats_contact_email_check/.test(m)) return "Niepoprawny e-mail kontaktowy.";
    if (/cats_contact_name_check/.test(m)) return "Nazwa kontaktu może mieć maksymalnie 80 znaków.";
    if (/duplicate key.*cats_pkey/i.test(m)) return "Kot o takim identyfikatorze już istnieje.";
    if (/row-level security|permission denied|42501/i.test(m)) return "Brak uprawnień (RLS). Czy na pewno jesteś adminem?";
    if (/check constraint/i.test(m)) return "Niepoprawne dane w formularzu (" + m.replace(/.*constraint "([^"]+)".*/, "$1") + ").";
    return m || "Coś poszło nie tak.";
  }
  const URL_RE = /^https?:\/\/\S+$/i;
  const PHONE_RE = /^\+?[0-9][0-9 ()-]{5,22}[0-9]$/;
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  function art(c, cls) {
    const look = c.look || {};
    const inner = c.photo_url ? `<img src="${esc(c.photo_url)}" alt="">` : window.CatArt.catSvg({ id: c.id, name: c.name, look }, { title: false });
    return `<span class="mini ${cls || ""}" style="--bg:${esc(look.bg || "#F3E9DC")}">${inner}</span>`;
  }
  function dialog(html, cls) {
    const d = document.createElement("dialog");
    d.className = "sheet sheet--auth " + (cls || "");
    d.innerHTML = `<div class="sheet__in">${html}</div>`;
    document.body.appendChild(d);
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
    d.addEventListener("close", () => { const b = $("[data-toasts]"); if (b.parentNode === d) document.body.appendChild(b); setTimeout(() => d.remove(), 0); });
    d.showModal();
    return d;
  }

  /* ---------- stany strony ---------- */
  function card(html) { body.innerHTML = `<div class="admin-card">${html}</div>`; }
  function render(detail) {
    if (!ACC.configured) {
      return card(`<h2>Backend nie jest skonfigurowany</h2><p>Panel działa tylko z Supabase. Uzupełnij <code>js/config.js</code> (adres projektu i klucz anon) według README, sekcja „Konta i logowanie (Supabase)”.</p>`);
    }
    if (!detail || !detail.user) {
      return card(`<h2>Zaloguj się</h2><p>Panel jest dostępny tylko dla administratorów. Zaloguj się kontem, które ma uprawnienia admina.</p><button class="btn btn--primary" type="button" data-action="login">Zaloguj się</button>`);
    }
    if (!detail.snap || !detail.snap.is_admin) {
      const sql = `insert into public.admins (user_id) values ('${detail.user.id}');`;
      return card(`<h2>Brak uprawnień administratora</h2>
        <p>Jesteś zalogowany(-a) jako <strong>${esc(detail.user.email || detail.user.id)}</strong>, ale to konto nie jest adminem.</p>
        <p>Żeby nadać sobie uprawnienia, wklej w Supabase (SQL Editor) i uruchom:</p>
        <pre class="admin-sql"><code>${esc(sql)}</code></pre>
        <button class="btn btn--soft btn--sm" type="button" data-copy="${esc(sql)}">Kopiuj SQL</button>
        <p class="auth__hint">Potem odśwież tę stronę. Uprawnień nie da się nadać z przeglądarki, bo blokują to polityki RLS.</p>`);
    }
    sb = ACC.client;
    loadAll();
  }

  async function loadAll() {
    try {
      const [c, s, st] = await Promise.all([
        sb.from("cats").select("*").order("sort_order").order("name"),
        sb.from("shelters").select("*").order("name"),
        sb.rpc("admin_stats")
      ]);
      if (c.error) throw c.error; if (s.error) throw s.error; if (st.error) throw st.error;
      cats = c.data; shelters = s.data; stats = st.data;
      renderDashboard();
    } catch (e) { card(`<h2>Błąd</h2><p>${esc(msg(e))}</p>`); }
  }

  function renderDashboard() {
    const visible = cats.filter((c) => !c.hidden), hidden = cats.filter((c) => c.hidden);
    const av = visible.filter((c) => c.status === "available").length;
    body.innerHTML = `
      <div class="admin-stats">
        <div class="stat"><span class="stat__label">Gracze</span><span class="stat__value">${stats.players}</span></div>
        <div class="stat"><span class="stat__label">Aktywne zakłady</span><span class="stat__value">${stats.active_bets}</span></div>
        <div class="stat"><span class="stat__label">Koty czekające</span><span class="stat__value">${av}<small>/ ${visible.length}</small></span></div>
        <div class="stat"><span class="stat__label">Runda gry</span><span class="stat__value">${stats.round}</span></div>
      </div>
      <div class="admin-bar"><h2>Koty</h2><button class="btn btn--primary btn--sm" type="button" data-new>＋ Dodaj kota</button></div>
      <div class="admin-cats">${visible.map(catRow).join("") || `<p class="auth__hint">Brak widocznych kotów.</p>`}</div>
      ${hidden.length ? `<div class="admin-bar admin-bar--hidden"><h2>Ukryte koty <span class="chip chip--hidden">${hidden.length}</span></h2></div>
      <p class="auth__hint">Tych kotów nie widać na stronie ani w grze. Zostają w bazie, możesz je w każdej chwili pokazać z powrotem.</p>
      <div class="admin-cats">${hidden.map(catRow).join("")}</div>` : ""}
      <div class="admin-grid">
        <section class="admin-card">
          <h2>Ostatnie rozliczenia</h2>
          ${stats.settlements.length ? `<table class="admin-table"><thead><tr><th>Kot</th><th>Runda</th><th>Zakłady</th><th>Wygrane</th><th>Wypłata</th><th>Kiedy</th></tr></thead><tbody>
            ${stats.settlements.map((s) => `<tr><td>${esc((cats.find((c) => c.id === s.cat_id) || { name: s.cat_id }).name)}</td><td>${s.round}</td><td>${s.bets_settled}</td><td>${s.winners}</td><td>${s.payout_total} pkt</td><td>${new Date(s.created_at).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}</td></tr>`).join("")}
          </tbody></table>` : `<p class="auth__hint">Jeszcze żadnej adopcji w trybie online.</p>`}
        </section>
        <section class="admin-card">
          <div class="admin-bar"><h2>Schroniska</h2><button class="btn btn--soft btn--sm" type="button" data-new-shelter>＋ Dodaj</button></div>
          <ul class="admin-list">${shelters.map((s) => `<li><div><strong>${esc(s.name)}</strong><span>${esc(s.city)} · ${esc(s.email || "brak e-maila")}</span></div><button class="link-btn link-btn--inline" type="button" data-edit-shelter="${esc(s.id)}">Edytuj</button></li>`).join("")}</ul>
        </section>
      </div>`;
  }

  function catRow(c) {
    const shName = (id) => { const s = shelters.find((x) => x.id === id); return s ? s.name : "brak schroniska"; };
    const pc = stats.per_cat[c.id];
    const rf = (stats.refunds || {})[c.id];
    const status = c.hidden ? `<span class="chip chip--hidden">🙈 ukryty</span>` : "";
    const adoptChip = `<span class="chip ${c.status === "adopted" ? "chip--ok" : "chip--wait"}">${c.status === "adopted" ? "🏠 ma dom" : "czeka"}</span>`;
    const extras = [c.photo_url ? "📷 zdjęcie" : "", c.listing_url ? "🔗 ogłoszenie" : "", (c.contact_phone || c.contact_email) ? "📞 własny kontakt" : ""].filter(Boolean).join(" · ");
    const actions = c.hidden
      ? `<button class="btn btn--primary btn--sm" type="button" data-unhide="${esc(c.id)}">👁 Pokaż kota</button>`
      : `${c.status === "available"
          ? `<button class="btn btn--primary btn--sm" type="button" data-adopt="${esc(c.id)}">🏠 Oznacz adopcję</button>`
          : `<button class="btn btn--ghost btn--sm" type="button" data-unadopt="${esc(c.id)}">↩ Przywróć</button>`}
         <button class="btn btn--ghost btn--sm" type="button" data-hide="${esc(c.id)}">🙈 Ukryj kota</button>`;
    return `<article class="acat ${c.status === "adopted" ? "is-adopted" : ""} ${c.hidden ? "is-hidden" : ""}">
      ${art(c, "acat__art")}
      <div class="acat__info">
        <h3>${esc(c.name)} ${adoptChip} ${status}</h3>
        <p>${esc(c.age)} · ${esc(c.sex)} · ${esc(shName(c.shelter_id))}</p>
        <p class="acat__bets">${pc ? `🎲 ${pc.bets} ${pc.bets === 1 ? "aktywny zakład" : "aktywne zakłady"} · ${pc.stake} pkt` : "brak aktywnych zakładów"}${extras ? " · " + extras : ""}</p>
        ${c.hidden ? `<p class="acat__bets">Ukryty ${c.hidden_at ? new Date(c.hidden_at).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) : ""}${c.hidden_note ? `: ${esc(c.hidden_note)}` : ""}${rf ? ` · zwrócono ${rf.bets} ${rf.bets === 1 ? "stawkę" : "stawki"} (${rf.points} pkt)` : ""}</p>` : ""}
      </div>
      <div class="acat__act">
        <button class="btn btn--soft btn--sm" type="button" data-edit="${esc(c.id)}">Edytuj</button>
        ${actions}
      </div>
    </article>`;
  }

  /* ---------- formularz kota ---------- */
  function catForm(c) {
    const isNew = !c;
    c = c || { id: "", name: "", name_acc: "", age: "", sex: "kotka", traits: [], shelter_id: shelters[0] && shelters[0].id, story: "", popularity: 3, look: { pattern: "tabby", base: "#E98A3C", accent: "#B85A1F", white: "#FFF3E2", eyes: "#7BB04A", bg: "#FFE2C2", extra: "none" }, photo_url: null, sort_order: (cats.length + 1) * 10 };
    const L = Object.assign({ pattern: "solid", base: "#999999", accent: "#666666", white: "#FFFFFF", eyes: "#E3B23C", bg: "#F3E9DC", extra: "none" }, c.look || {});
    const d = dialog(`
      <button class="sheet__close" type="button" data-close aria-label="Zamknij">×</button>
      <form class="profile admin-form" data-cat-form>
        <h2>${isNew ? "Nowy kot" : "Edytuj: " + esc(c.name)}</h2>
        <div class="admin-form__grid">
          <div class="admin-form__preview"><div class="admin-preview" data-preview></div>
            <label class="field"><span>Zdjęcie (JPG/PNG/WebP, max 3 MB)</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>
            ${c.photo_url ? `<label class="check"><input type="checkbox" name="rmphoto"> usuń zdjęcie (wróć do ilustracji)</label>` : ""}
            <p class="auth__hint">Bez zdjęcia pokazujemy ilustrację z kolorów poniżej.</p>
          </div>
          <div class="admin-form__fields">
            <label class="field"><span>Imię</span><input name="name" required maxlength="40" value="${esc(c.name)}"></label>
            <label class="field"><span>Imię w bierniku („Chcę adoptować …”)</span><input name="name_acc" maxlength="40" value="${esc(c.name_acc || "")}" placeholder="np. Łatkę"></label>
            <label class="field"><span>Identyfikator (adres, bez polskich znaków)</span><input name="id" required pattern="[a-z0-9\\-]{2,40}" value="${esc(c.id)}" ${isNew ? "" : "readonly"}></label>
            <div class="admin-form__row">
              <label class="field"><span>Wiek</span><input name="age" maxlength="30" value="${esc(c.age)}" placeholder="np. 2 lata"></label>
              <label class="field"><span>Płeć</span><select name="sex"><option value="kotka" ${c.sex === "kotka" ? "selected" : ""}>kotka</option><option value="kocur" ${c.sex === "kocur" ? "selected" : ""}>kocur</option></select></label>
            </div>
            <label class="field"><span>Schronisko</span><select name="shelter_id">${shelters.map((s) => `<option value="${esc(s.id)}" ${s.id === c.shelter_id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
            <label class="field"><span>Cechy (po przecinku, max 6)</span><input name="traits" value="${esc((c.traits || []).join(", "))}" placeholder="przytulas, gaduła"></label>
            <label class="field"><span>Historia</span><textarea name="story" maxlength="1000">${esc(c.story)}</textarea></label>
            <label class="field"><span>Popularność 1–5 (niższa = wyższe kursy)</span><input type="number" name="popularity" min="1" max="5" value="${c.popularity}"></label>
          </div>
        </div>
        <fieldset class="admin-look admin-contact"><legend>Ogłoszenie i kontakt do adopcji</legend>
          <label class="field field--wide"><span>Link do oryginalnego ogłoszenia (OLX, Facebook…)</span><input type="url" name="listing_url" maxlength="500" inputmode="url" placeholder="https://www.olx.pl/d/oferta/…" value="${esc(c.listing_url || "")}"></label>
          <label class="field"><span>Kontakt: imię lub nazwa</span><input name="contact_name" maxlength="80" placeholder="np. Pani Ania, Fundacja Kocia Łapka" value="${esc(c.contact_name || "")}"></label>
          <label class="field"><span>Telefon (opcjonalnie)</span><input type="tel" name="contact_phone" maxlength="24" inputmode="tel" placeholder="np. 500 100 200" value="${esc(c.contact_phone || "")}"></label>
          <label class="field"><span>E-mail (opcjonalnie)</span><input type="email" name="contact_email" maxlength="120" placeholder="np. ania@poczta.pl" value="${esc(c.contact_email || "")}"></label>
          <p class="auth__hint field--wide">Gdy wpiszesz telefon albo e-mail, przycisk „Chcę adoptować” połączy z tym kontaktem zamiast ze schroniskiem. Pokazujemy tylko wypełnione pola. Publikuj kontakt wyłącznie za zgodą ogłoszeniodawcy.</p>
        </fieldset>
        <fieldset class="admin-look"><legend>Ilustracja</legend>
          <label class="field"><span>Umaszczenie</span><select name="pattern">${PATTERNS.map(([v, l]) => `<option value="${v}" ${L.pattern === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="field"><span>Dodatek</span><select name="extra">${EXTRAS.map(([v, l]) => `<option value="${v}" ${L.extra === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          ${[["base", "Futro"], ["accent", "Pręgi/łaty"], ["white", "Białe"], ["eyes", "Oczy"], ["bg", "Tło"]].map(([k, l]) => `<label class="field field--color"><span>${l}</span><input type="color" name="${k}" value="${esc(L[k])}"></label>`).join("")}
        </fieldset>
        <p class="auth__err" data-err role="alert" hidden></p>
        <div class="auth__row">
          <button class="btn btn--primary" type="submit">${isNew ? "Dodaj kota" : "Zapisz zmiany"}</button>
          <button class="btn btn--ghost" type="button" data-close>Anuluj</button>
          ${isNew ? "" : `<button class="btn btn--soft admin-del" type="button" data-delete>Usuń</button>`}
        </div>
      </form>`, "sheet--admin");
    const f = $("[data-cat-form]", d), err = $("[data-err]", d);
    let fileUrl = null;
    const look = () => ({ pattern: f.elements.pattern.value, extra: f.elements.extra.value, base: f.elements.base.value, accent: f.elements.accent.value, white: f.elements.white.value, eyes: f.elements.eyes.value, bg: f.elements.bg.value });
    function preview() {
      const rm = f.elements.rmphoto && f.elements.rmphoto.checked;
      const photo = fileUrl || (!rm && c.photo_url);
      $("[data-preview]", d).style.setProperty("--bg", look().bg);
      $("[data-preview]", d).innerHTML = photo ? `<img src="${esc(photo)}" alt="Podgląd zdjęcia">` : window.CatArt.catSvg({ id: f.elements.id.value || "nowy", name: f.elements.name.value, look: look() }, { title: false });
    }
    f.addEventListener("input", (e) => {
      if (isNew && e.target.name === "name") f.elements.id.value = slug(f.elements.name.value);
      if (e.target.name === "photo") { const file = e.target.files[0]; fileUrl = file ? URL.createObjectURL(file) : null; }
      preview();
    });
    preview();
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); err.hidden = true;
      const btn = $("button[type=submit]", f); btn.disabled = true;
      try {
        const id = f.elements.id.value.trim();
        let photo_url = c.photo_url || null;
        if (f.elements.rmphoto && f.elements.rmphoto.checked) photo_url = null;
        const file = f.elements.photo.files[0];
        if (file) {
          if (file.size > 3 * 1024 * 1024) throw new Error("Zdjęcie jest za duże (max 3 MB).");
          const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type];
          if (!ext) throw new Error("Dozwolone formaty: JPG, PNG, WebP.");
          const path = `cats/${id}-${Date.now()}.${ext}`;
          const up = await sb.storage.from("cat-photos").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
          if (up.error) throw up.error;
          photo_url = sb.storage.from("cat-photos").getPublicUrl(path).data.publicUrl;
        }
        const listing_url = f.elements.listing_url.value.trim() || null;
        const contact_name = f.elements.contact_name.value.trim() || null;
        const contact_phone = f.elements.contact_phone.value.trim().replace(/\s+/g, " ") || null;
        const contact_email = f.elements.contact_email.value.trim() || null;
        if (listing_url && (!URL_RE.test(listing_url) || listing_url.length > 500)) throw new Error("Link do ogłoszenia musi zaczynać się od http:// albo https://.");
        if (contact_phone && !PHONE_RE.test(contact_phone)) throw new Error("Telefon może mieć tylko cyfry, spacje, myślniki, nawiasy i + na początku (np. 500 100 200).");
        if (contact_email && !EMAIL_RE.test(contact_email)) throw new Error("Niepoprawny e-mail kontaktowy.");
        const row = {
          id, name: f.elements.name.value.trim(), name_acc: f.elements.name_acc.value.trim() || null, age: f.elements.age.value.trim(),
          sex: f.elements.sex.value, shelter_id: f.elements.shelter_id.value || null,
          traits: f.elements.traits.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6),
          story: f.elements.story.value.trim(), popularity: Math.min(5, Math.max(1, Number(f.elements.popularity.value) || 3)),
          look: look(), photo_url, listing_url, contact_name, contact_phone, contact_email
        };
        const q = isNew ? sb.from("cats").insert({ ...row, sort_order: c.sort_order }).select() : sb.from("cats").update(row).eq("id", c.id).select();
        const { data, error } = await q;
        if (error) throw error;
        if (!data || !data.length) throw new Error("Brak uprawnień (RLS): nic nie zapisano.");
        d.close(); toast(`✅ Zapisano: <strong>${esc(row.name)}</strong>`); loadAll();
      } catch (er) { err.textContent = msg(er); err.hidden = false; btn.disabled = false; }
    });
    const del = $("[data-delete]", d);
    if (del) del.addEventListener("click", async () => {
      if (!confirm(`Usunąć kota ${c.name}? Tego nie da się cofnąć.`)) return;
      const { data, error } = await sb.from("cats").delete().eq("id", c.id).select();
      if (error || !data.length) { err.textContent = msg(error || "Nie usunięto (brak uprawnień?)"); err.hidden = false; return; }
      d.close(); toast(`🗑️ Usunięto: ${esc(c.name)}`); loadAll();
    });
  }

  /* ---------- adopcja (rozlicza zakłady) ---------- */
  function adoptDialog(c) {
    const pc = stats.per_cat[c.id];
    const fem = c.sex === "kotka";
    const d = dialog(`
      <button class="sheet__close" type="button" data-close aria-label="Zamknij">×</button>
      <form class="profile" data-adopt-form>
        <div class="admin-adopt__art">${art(c, "mini--lg")}</div>
        <h2>${esc(c.name)} ${fem ? "znalazła" : "znalazł"} dom? 🎉</h2>
        <p>Oznaczenie adopcji <strong>od razu rozliczy zakłady</strong>: wszystkie aktywne „pierwszy w domu” (wygrywają ci, którzy obstawili ${esc(c.name_acc || c.name)}) oraz „w ciągu N dni” na tego kota. Przywrócenie statusu później <strong>nie cofa</strong> rozliczeń.</p>
        <p class="auth__hint">${pc ? `Na tego kota: ${pc.bets} aktywnych zakładów (${pc.stake} pkt). ` : ""}Wszystkich aktywnych zakładów: ${stats.active_bets}.</p>
        <label class="field"><span>Notka widoczna w grze (opcjonalnie)</span><input name="note" maxlength="120" value="${fem ? "Znalazła" : "Znalazł"} dom ${new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}"></label>
        <p class="auth__err" data-err role="alert" hidden></p>
        <div class="auth__row"><button class="btn btn--primary" type="submit">🏠 Tak, oznacz adopcję</button><button class="btn btn--ghost" type="button" data-close>Anuluj</button></div>
      </form>`, "sheet--admin-sm");
    $("[data-adopt-form]", d).addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button[type=submit]", e.target); btn.disabled = true;
      const { data, error } = await sb.rpc("admin_set_cat_status", { p_cat_id: c.id, p_status: "adopted", p_note: e.target.elements.note.value });
      if (error) { $("[data-err]", d).textContent = msg(error); $("[data-err]", d).hidden = false; btn.disabled = false; return; }
      d.close();
      const s = data.settlement;
      toast(s ? `🏠 ${esc(c.name)}: rozliczono <strong>${s.bets_settled}</strong> zakładów, wygranych ${s.winners}, wypłacono ${s.payout_total} pkt.` : `🏠 ${esc(c.name)} oznaczony jako zaadoptowany.`);
      loadAll();
    });
  }
  async function unadopt(c) {
    if (!confirm(`Przywrócić ${c.name} do adopcji? Rozliczone zakłady zostaną bez zmian.`)) return;
    const { error } = await sb.rpc("admin_set_cat_status", { p_cat_id: c.id, p_status: "available", p_note: null });
    if (error) return toast(esc(msg(error)));
    toast(`↩ ${esc(c.name)} znowu czeka na dom.`); loadAll();
  }

  /* ---------- ukrywanie kota (zwraca stawki) ---------- */
  function hideDialog(c) {
    const pc = stats.per_cat[c.id];
    const d = dialog(`
      <button class="sheet__close" type="button" data-close aria-label="Zamknij">×</button>
      <form class="profile" data-hide-form>
        <div class="admin-adopt__art">${art(c, "mini--lg")}</div>
        <h2>Ukryć ${esc(c.name_acc || c.name)}?</h2>
        <p>Kot <strong>zniknie ze strony i z gry</strong> (lista kotów, karty, zakłady), ale <strong>nie zostanie usunięty</strong>. Możesz go później pokazać z powrotem.</p>
        <p>${pc ? `Na tego kota jest <strong>${pc.bets} ${pc.bets === 1 ? "aktywny zakład" : "aktywnych zakładów"} (${pc.stake} pkt)</strong>. Zakłady zostaną anulowane, a gracze <strong>dostaną zwrot stawek</strong>. Zwrotu nie da się cofnąć, także po ponownym pokazaniu kota.` : "Na tego kota nie ma aktywnych zakładów."}</p>
        <p class="auth__hint">Jeśli ogłoszeniodawca wycofał zgodę, usuń też jego kontakt i link do ogłoszenia (Edytuj, wyczyść pola, Zapisz).</p>
        <label class="field"><span>Powód (widoczny tylko w panelu, opcjonalnie)</span><input name="note" maxlength="200" placeholder="np. prośba ogłoszeniodawcy o usunięcie"></label>
        <p class="auth__err" data-err role="alert" hidden></p>
        <div class="auth__row"><button class="btn btn--primary" type="submit">🙈 Tak, ukryj kota</button><button class="btn btn--ghost" type="button" data-close>Anuluj</button></div>
      </form>`, "sheet--admin-sm");
    $("[data-hide-form]", d).addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button[type=submit]", e.target); btn.disabled = true;
      const { data, error } = await sb.rpc("admin_set_cat_hidden", { p_cat_id: c.id, p_hidden: true, p_note: e.target.elements.note.value });
      if (error) { $("[data-err]", d).textContent = msg(error); $("[data-err]", d).hidden = false; btn.disabled = false; return; }
      d.close();
      toast(data.bets_refunded ? `🙈 Ukryto: <strong>${esc(c.name)}</strong>. Zwrócono ${data.bets_refunded} ${data.bets_refunded === 1 ? "stawkę" : "stawki"} (${data.points_refunded} pkt).` : `🙈 Ukryto: <strong>${esc(c.name)}</strong>.`);
      loadAll();
    });
  }
  async function unhide(c) {
    if (!confirm(`Pokazać ${c.name_acc || c.name} z powrotem na stronie? Kot wróci do gry. Zwrócone wcześniej stawki zostają u graczy.`)) return;
    const { error } = await sb.rpc("admin_set_cat_hidden", { p_cat_id: c.id, p_hidden: false, p_note: null });
    if (error) return toast(esc(msg(error)));
    toast(`👁 ${esc(c.name)} znowu jest widoczny na stronie.`); loadAll();
  }

  /* ---------- schroniska ---------- */
  function shelterForm(s) {
    const isNew = !s; s = s || { id: "", name: "", city: "", email: "" };
    const d = dialog(`
      <button class="sheet__close" type="button" data-close aria-label="Zamknij">×</button>
      <form class="profile" data-sh-form>
        <h2>${isNew ? "Nowe schronisko" : "Edytuj schronisko"}</h2>
        <label class="field"><span>Nazwa</span><input name="name" required maxlength="120" value="${esc(s.name)}"></label>
        <label class="field"><span>Identyfikator</span><input name="id" required pattern="[a-z0-9\\-]{2,40}" value="${esc(s.id)}" ${isNew ? "" : "readonly"}></label>
        <label class="field"><span>Miasto</span><input name="city" maxlength="80" value="${esc(s.city)}"></label>
        <label class="field"><span>E-mail do adopcji (przycisk „Chcę adoptować”)</span><input type="email" name="email" value="${esc(s.email || "")}"></label>
        <p class="auth__err" data-err role="alert" hidden></p>
        <div class="auth__row"><button class="btn btn--primary" type="submit">Zapisz</button><button class="btn btn--ghost" type="button" data-close>Anuluj</button></div>
      </form>`, "sheet--admin-sm");
    const f = $("[data-sh-form]", d);
    f.addEventListener("input", (e) => { if (isNew && e.target.name === "name") f.elements.id.value = slug(f.elements.name.value); });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const row = { id: f.elements.id.value.trim(), name: f.elements.name.value.trim(), city: f.elements.city.value.trim(), email: f.elements.email.value.trim() || null };
      const { data, error } = isNew ? await sb.from("shelters").insert(row).select() : await sb.from("shelters").update(row).eq("id", s.id).select();
      if (error || !data.length) { $("[data-err]", d).textContent = msg(error || "Nie zapisano (brak uprawnień?)"); $("[data-err]", d).hidden = false; return; }
      d.close(); toast("✅ Zapisano schronisko."); loadAll();
    });
  }

  /* ---------- zdarzenia ---------- */
  body.addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    const find = (id) => cats.find((c) => c.id === id);
    if (t.dataset.new != null) catForm(null);
    else if (t.dataset.edit) catForm(find(t.dataset.edit));
    else if (t.dataset.adopt) adoptDialog(find(t.dataset.adopt));
    else if (t.dataset.unadopt) unadopt(find(t.dataset.unadopt));
    else if (t.dataset.hide) hideDialog(find(t.dataset.hide));
    else if (t.dataset.unhide) unhide(find(t.dataset.unhide));
    else if (t.dataset.newShelter != null) shelterForm(null);
    else if (t.dataset.editShelter) shelterForm(shelters.find((s) => s.id === t.dataset.editShelter));
    else if (t.dataset.copy) navigator.clipboard.writeText(t.dataset.copy).then(() => toast("Skopiowano."), () => {});
  });
  document.addEventListener("podejrzyjkota:auth", (e) => render(e.detail));
  if (!ACC.configured) render(null);
  else setTimeout(() => { if (body.textContent.includes("Ładuję")) render(null); }, 4000);
})();
