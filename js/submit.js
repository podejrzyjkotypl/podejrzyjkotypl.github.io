/* podejrzyjkota: formularz „Dodaj kota do adopcji” i „Moje zgłoszenia” (dodaj-kota.html)
 * Zgłoszenia trafiają do public.cat_submissions przez funkcję submit_cat_listing (walidacja, limity, honeypot).
 * Zdjęcia: prywatny bucket 'submissions', folder <user_id>/. Nikt poza autorem i adminem ich nie widzi.
 * Na stronę kot trafia dopiero po akceptacji w panelu administratora.
 */
(function () {
  "use strict";
  const ACC = window.PodejrzyjkotaAccount || { configured: false };
  const root = document.querySelector("[data-submit-root]");
  if (!root) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());

  const CONSENT_VERSION = "zgloszenie-2026-10-08";
  // Ta sama treść jest zapisana w bazie (public.consent_texts) i to ona jest dowodem zgody.
  const CONSENT_FALLBACK = [
    "Oświadczam, że mam prawo opublikować informacje o tym kocie oraz przesłane zdjęcia (jestem ich autorem albo mam zgodę autora) i że kot jest oddawany do adopcji bez opłat.",
    "Wyrażam zgodę na pokazanie kota oraz podanych danych kontaktowych (imię lub nazwa, telefon, e-mail, link do ogłoszenia) na stronie podejrzyjkota.pl (art. 6 ust. 1 lit. a RODO). Wiem, że mogę wycofać zgodę w każdej chwili w zakładce „Moje zgłoszenia”, a wycofanie zgody nie wpływa na zgodność z prawem publikacji przed jej wycofaniem.",
    "Akceptuję regulamin serwisu podejrzyjkota.pl."
  ];
  const VOIVODESHIPS = ["dolnośląskie", "kujawsko-pomorskie", "lubelskie", "lubuskie", "łódzkie", "małopolskie", "mazowieckie", "opolskie", "podkarpackie", "podlaskie", "pomorskie", "śląskie", "świętokrzyskie", "warmińsko-mazurskie", "wielkopolskie", "zachodniopomorskie"];
  const SUBMITTERS = [["osoba prywatna", "Osoba prywatna"], ["dom tymczasowy", "Dom tymczasowy"], ["fundacja", "Fundacja lub stowarzyszenie"], ["schronisko", "Schronisko"]];
  const PATTERNS = [["", "nie wiem / dobierzcie sami"], ["solid", "jednolity"], ["tabby", "pręgowany"], ["tuxedo", "frak (czarno-biały)"], ["bicolor", "dwukolorowy"], ["pointed", "syjamski (pointy)"], ["calico", "szylkretowy z białym (calico)"], ["tortie", "szylkretowy"]];
  const EXTRAS = [["none", "bez dodatków"], ["collar", "obroża"], ["bow", "kokardka"]];
  const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const MAX = 3 * 1024 * 1024;
  const URL_RE = /^https?:\/\/\S+$/i;
  const PHONE_RE = /^\+?[0-9][0-9 ()-]{5,22}[0-9]$/;
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  let sb = null, uid = null, consentTexts = CONSENT_FALLBACK, photos = [], busy = false;

  function toast(html) {
    let box = $("[data-toasts]");
    if (!box) { box = document.createElement("div"); box.className = "toasts"; box.dataset.toasts = ""; document.body.appendChild(box); }
    const t = document.createElement("div"); t.className = "toast"; t.innerHTML = html; box.appendChild(t);
    setTimeout(() => t.classList.add("is-out"), 5200); setTimeout(() => t.remove(), 5700);
  }
  function msg(e) {
    const m = String((e && (e.message || e.error_description)) || e || "");
    const map = [
      [/contact_phone_check/, "Telefon może mieć tylko cyfry, spacje, myślniki, nawiasy i + na początku (np. 500 100 200)."],
      [/contact_email_check/, "Niepoprawny e-mail kontaktowy."],
      [/listing_url_check/, "Link do ogłoszenia musi zaczynać się od http:// albo https:// (max 500 znaków)."],
      [/contact_name_check/, "Podaj imię lub nazwę do kontaktu (2–80 znaków)."],
      [/city_check/, "Podaj miejscowość (2–80 znaków)."],
      [/story_check/, "Opis kota musi mieć od 30 do 1000 znaków."],
      [/traits_check/, "Najwyżej 6 cech, każda krótka."],
      [/name_check/, "Podaj imię kota (do 40 znaków)."],
      [/rate.?limit|za dużo|too many/i, "Za dużo zgłoszeń w krótkim czasie. Spróbuj jutro."],
      [/row-level security|permission denied|42501/i, "Brak uprawnień. Zaloguj się ponownie."],
      [/Payload too large|exceeded the maximum/i, "Zdjęcie jest za duże (max 3 MB)."],
      [/mime type|invalid_mime/i, "Dozwolone formaty zdjęć: JPG, PNG, WebP."],
      [/Failed to fetch|NetworkError|Load failed/i, "Brak połączenia z serwerem. Spróbuj za chwilę."]
    ];
    for (const [re, out] of map) if (re.test(m)) return out;
    return m || "Coś poszło nie tak. Spróbuj ponownie.";
  }
  function rid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const fmtDate = (d) => d ? new Date(d).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" }) : "";

  /* ---------- zdjęcia: każde przerysowujemy w przeglądarce (max 1800 px, JPEG) ----------
   * Dzięki temu znikają metadane (np. lokalizacja GPS z telefonu), a plik mieści się w 3 MB. */
  function encode(img, maxSide, q) {
    return new Promise((resolve) => {
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b), "image/jpeg", q);
    });
  }
  function shrink(file) {
    return new Promise((resolve) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = async () => {
        let b = null;
        for (const [side, q] of [[1800, 0.86], [1400, 0.8], [1100, 0.72]]) {
          b = await encode(img, side, q);
          if (b && b.size <= MAX) break;
        }
        URL.revokeObjectURL(url);
        resolve(b && b.size <= MAX ? new File([b], "zdjecie.jpg", { type: "image/jpeg" }) : null);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  /* ---------- stany strony ---------- */
  function card(html) { root.innerHTML = `<div class="admin-card submit__card">${html}</div>`; }
  function render(detail) {
    if (isNative) return card(`<h2>Dodawanie kotów działa na stronie</h2><p>W aplikacji nie ma jeszcze kont. Otwórz <a href="https://podejrzyjkota.pl/dodaj-kota.html" target="_blank" rel="noopener">podejrzyjkota.pl/dodaj-kota.html</a> w przeglądarce albo napisz do nas według <a href="dla-ogloszeniodawcow.html">tej instrukcji</a>.</p>`);
    if (!ACC.configured) return card(`<h2>Formularz chwilowo nie działa</h2><p>Możesz zgłosić kota e-mailem według <a href="dla-ogloszeniodawcow.html">tej instrukcji</a>.</p>`);
    if (!detail || !detail.user) {
      uid = null;
      return card(`<h2>Zaloguj się, żeby dodać kota</h2>
        <p>Zgłoszenia przyjmujemy tylko od zalogowanych osób. Dzięki temu możesz później sprawdzić status zgłoszenia i w każdej chwili zdjąć kota ze strony. Konto jest darmowe i zakładasz je w minutę.</p>
        <div class="auth__row"><button class="btn btn--primary" type="button" data-action="login">👤 Zaloguj się albo załóż konto</button></div>
        <p class="auth__hint">Wolisz bez konta? <a href="dla-ogloszeniodawcow.html#wzor-zgloszenie">Zgłoś kota e-mailem</a>.</p>`);
    }
    sb = ACC.client;
    if (uid === detail.user.id && $("[data-sub-form]", root)) return;
    uid = detail.user.id;
    renderForm();
    loadConsents();
    loadMine();
  }

  function opt(list, sel) { return list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join(""); }
  function renderForm() {
    photos = [];
    root.innerHTML = `
      <form class="admin-card submit__card submit-form" data-sub-form novalidate>
        <h2>Zgłoś kota</h2>
        <p class="auth__hint">Pola oznaczone * są wymagane. Zgłoszenie sprawdzimy, zanim cokolwiek pojawi się na stronie.</p>
        <fieldset class="submit__set"><legend>Kot</legend>
          <div class="submit__grid">
            <label class="field"><span>Imię kota *</span><input name="name" required maxlength="40" autocomplete="off"></label>
            <label class="field"><span>Wiek</span><input name="age" maxlength="30" placeholder="np. 2 lata, ok. 6 miesięcy"></label>
            <label class="field"><span>Płeć *</span><select name="sex" required><option value="">wybierz</option><option value="kotka">kotka</option><option value="kocur">kocur</option></select></label>
            <label class="field"><span>Miejscowość *</span><input name="city" required maxlength="80" autocomplete="address-level2" placeholder="np. Łomża"></label>
            <label class="field"><span>Województwo *</span><select name="voivodeship" required><option value="">wybierz</option>${VOIVODESHIPS.map((v) => `<option>${v}</option>`).join("")}</select></label>
            <label class="field"><span>Kto zgłasza? *</span><select name="submitter_type" required><option value="">wybierz</option>${opt(SUBMITTERS, "")}</select></label>
          </div>
          <label class="field"><span>Cechy charakteru (po przecinku, max 6)</span><input name="traits" maxlength="200" placeholder="np. przytulas, gaduła, lubi dzieci"></label>
          <label class="field"><span>Historia i opis * <small data-count>0 / 1000</small></span><textarea name="story" required minlength="30" maxlength="1000" rows="6" placeholder="Skąd jest kot, jaki ma charakter, czego szuka. Zdrowie: szczepienia, kastracja lub sterylizacja, czip, choroby. Z kim może mieszkać: koty, psy, dzieci."></textarea></label>
          <div class="submit__grid">
            <label class="field"><span>Umaszczenie (do ilustracji, opcjonalnie)</span><select name="pattern">${opt(PATTERNS, "")}</select></label>
            <label class="field"><span>Dodatek na ilustracji</span><select name="extra">${opt(EXTRAS, "none")}</select></label>
          </div>
        </fieldset>
        <fieldset class="submit__set"><legend>Zdjęcia * (1–3)</legend>
          <label class="field"><span>Wybierz zdjęcia (JPG, PNG lub WebP). Zmniejszymy je automatycznie i usuniemy z nich ukryte dane, np. lokalizację GPS.</span>
            <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple data-photos></label>
          <div class="submit__thumbs" data-thumbs></div>
          <p class="auth__hint">Najlepiej jasne zdjęcia zrobione w dzień, z pyszczkiem na wysokości oczu. Bez ludzi i bez numerów rejestracyjnych w kadrze.</p>
        </fieldset>
        <fieldset class="submit__set"><legend>Kontakt do adopcji (będzie widoczny na stronie)</legend>
          <div class="submit__grid">
            <label class="field"><span>Imię lub nazwa *</span><input name="contact_name" required maxlength="80" autocomplete="name" placeholder="np. Pani Ania, Fundacja Kocia Łapka"></label>
            <label class="field"><span>Telefon</span><input type="tel" name="contact_phone" maxlength="24" inputmode="tel" autocomplete="tel" placeholder="np. 500 100 200"></label>
            <label class="field"><span>E-mail</span><input type="email" name="contact_email" maxlength="120" autocomplete="email" placeholder="np. ania@poczta.pl"></label>
          </div>
          <p class="auth__hint">Podaj telefon, e-mail albo oba. Pokażemy tylko to, co wpiszesz.</p>
          <label class="field"><span>Link do ogłoszenia w innym serwisie (opcjonalnie)</span><input type="url" name="listing_url" maxlength="500" inputmode="url" placeholder="https://www.olx.pl/d/oferta/…"></label>
        </fieldset>
        <div class="submit__hp" aria-hidden="true"><label>Strona internetowa <input name="website" tabindex="-1" autocomplete="off"></label></div>
        <fieldset class="submit__set submit__consents" data-consents><legend>Zgody *</legend>${consentHtml()}</fieldset>
        <p class="auth__err" data-err role="alert" hidden></p>
        <div class="auth__row"><button class="btn btn--primary" type="submit">🐾 Wyślij do sprawdzenia</button></div>
        <p class="auth__hint">Wysłane zgłoszenie zobaczysz niżej, w „Moich zgłoszeniach”. Informacje o przetwarzaniu danych: <a href="polityka-prywatnosci.html#zgloszenia">polityka prywatności</a>.</p>
      </form>
      <section class="admin-card submit__card" id="moje">
        <div class="admin-bar"><h2>📋 Moje zgłoszenia</h2><button class="btn btn--ghost btn--sm" type="button" data-reload>Odśwież</button></div>
        <div data-mine><p class="auth__hint">Ładuję…</p></div>
      </section>`;
    const f = $("[data-sub-form]", root);
    f.elements.story.addEventListener("input", () => { $("[data-count]", f).textContent = `${f.elements.story.value.length} / 1000`; });
    $("[data-photos]", f).addEventListener("change", onPhotos);
    $("[data-thumbs]", f).addEventListener("click", (e) => {
      const b = e.target.closest("[data-rm]"); if (!b) return;
      photos.splice(Number(b.dataset.rm), 1); drawThumbs();
    });
    f.addEventListener("submit", onSubmit);
    $("[data-reload]", root).addEventListener("click", loadMine);
    $("[data-mine]", root).addEventListener("click", onMineClick);
    if (location.hash === "#moje") setTimeout(() => $("#moje").scrollIntoView({ behavior: "smooth" }), 300);
  }
  function consentHtml() {
    const names = ["consent_rights", "consent_publish", "consent_terms"];
    return consentTexts.map((t, i) => `<label class="check submit__check"><input type="checkbox" name="${names[i]}" required> <span>${esc(t)}${i === 2 ? ` <a href="regulamin.html#r8" target="_blank" rel="noopener">Przeczytaj regulamin</a>.` : ""}</span></label>`).join("");
  }
  async function loadConsents() {
    try {
      const { data, error } = await sb.from("consent_texts").select("body").eq("version", CONSENT_VERSION).maybeSingle();
      if (error || !data) return;
      const parts = data.body.split(/\n(?=\d+\.\s)/).map((s) => s.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
      if (parts.length !== 3) return;
      consentTexts = parts;
      const box = $("[data-consents]", root);
      if (box) { const checked = $$("input", box).map((x) => x.checked); box.innerHTML = `<legend>Zgody *</legend>${consentHtml()}`; $$("input", box).forEach((x, i) => (x.checked = checked[i])); }
    } catch (e) { /* zostaje treść wbudowana, identyczna z bazą */ }
  }

  async function onPhotos(e) {
    const err = $("[data-err]", root); err.hidden = true;
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    for (const file of files) {
      if (photos.length >= 3) { err.textContent = "Możesz dodać najwyżej 3 zdjęcia."; err.hidden = false; break; }
      if (!/^image\//.test(file.type)) { err.textContent = `„${file.name}” nie jest zdjęciem.`; err.hidden = false; continue; }
      const ok = await shrink(file);
      if (!ok) { err.textContent = `Nie udało się odczytać zdjęcia „${file.name}”. Wybierz plik JPG, PNG albo WebP.`; err.hidden = false; continue; }
      photos.push({ file: ok, url: URL.createObjectURL(ok) });
    }
    drawThumbs();
  }
  function drawThumbs() {
    const box = $("[data-thumbs]", root);
    box.innerHTML = photos.map((p, i) => `<figure class="submit__thumb"><img src="${esc(p.url)}" alt="Zdjęcie ${i + 1}"><button type="button" class="submit__rm" data-rm="${i}" aria-label="Usuń zdjęcie ${i + 1}">×</button>${i === 0 ? `<figcaption>główne</figcaption>` : ""}</figure>`).join("");
  }

  /* ---------- wysyłka ---------- */
  function collect(f) {
    const v = (n) => f.elements[n].value.trim();
    const p = {
      name: v("name"), age: v("age"), sex: v("sex"), city: v("city"), voivodeship: v("voivodeship"),
      traits: v("traits").split(",").map((t) => t.trim()).filter(Boolean),
      story: v("story"), pattern: v("pattern") || null, extra: v("extra") || "none",
      listing_url: v("listing_url") || null, contact_name: v("contact_name"),
      contact_phone: v("contact_phone").replace(/\s+/g, " ") || null, contact_email: v("contact_email") || null,
      submitter_type: v("submitter_type"), website: f.elements.website.value,
      consent_version: CONSENT_VERSION,
      consent_rights: f.elements.consent_rights.checked, consent_publish: f.elements.consent_publish.checked, consent_terms: f.elements.consent_terms.checked
    };
    const bad = (name, text) => { const el = f.elements[name]; if (el && el.focus) el.focus(); throw new Error(text); };
    if (!p.name) bad("name", "Podaj imię kota.");
    if (!p.sex) bad("sex", "Wybierz płeć kota.");
    if (p.city.length < 2) bad("city", "Podaj miejscowość.");
    if (!p.voivodeship) bad("voivodeship", "Wybierz województwo.");
    if (!p.submitter_type) bad("submitter_type", "Wybierz, kto zgłasza kota.");
    if (p.traits.length > 6) bad("traits", "Najwyżej 6 cech.");
    if (p.traits.some((t) => t.length > 30)) bad("traits", "Każda cecha może mieć najwyżej 30 znaków.");
    if (p.story.length < 30) bad("story", "Opis kota musi mieć co najmniej 30 znaków.");
    if (!photos.length) bad("photos", "Dodaj co najmniej jedno zdjęcie kota.");
    if (p.contact_name.length < 2) bad("contact_name", "Podaj imię lub nazwę do kontaktu.");
    if (!p.contact_phone && !p.contact_email) bad("contact_phone", "Podaj telefon albo e-mail do kontaktu w sprawie adopcji.");
    if (p.contact_phone && !PHONE_RE.test(p.contact_phone)) bad("contact_phone", "Telefon może mieć tylko cyfry, spacje, myślniki, nawiasy i + na początku (np. 500 100 200).");
    if (p.contact_email && !EMAIL_RE.test(p.contact_email)) bad("contact_email", "Niepoprawny e-mail kontaktowy.");
    if (p.listing_url && (!URL_RE.test(p.listing_url) || p.listing_url.length > 500)) bad("listing_url", "Link do ogłoszenia musi zaczynać się od http:// albo https://.");
    if (!p.consent_rights || !p.consent_publish || !p.consent_terms) bad("consent_rights", "Zaznacz wszystkie trzy wymagane zgody.");
    return p;
  }
  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const f = e.target, err = $("[data-err]", f), btn = $("button[type=submit]", f);
    err.hidden = true;
    let p;
    try { p = collect(f); } catch (x) { err.textContent = x.message; err.hidden = false; return; }
    busy = true; btn.disabled = true; btn.textContent = "Wysyłam…";
    const uploaded = [];
    try {
      for (const ph of photos) {
        const path = `${uid}/${rid()}.${TYPES[ph.file.type]}`;
        const up = await sb.storage.from("submissions").upload(path, ph.file, { contentType: ph.file.type, upsert: false });
        if (up.error) throw up.error;
        uploaded.push(path);
      }
      p.photos = uploaded;
      const { error } = await sb.rpc("submit_cat_listing", { p });
      if (error) throw error;
      toast(`🐾 Dziękujemy! Zgłoszenie <strong>${esc(p.name)}</strong> czeka na sprawdzenie.`);
      photos.forEach((x) => URL.revokeObjectURL(x.url));
      renderForm(); loadConsents(); await loadMine();
      $("#moje").scrollIntoView({ behavior: "smooth" });
    } catch (x) {
      if (uploaded.length) sb.storage.from("submissions").remove(uploaded).catch(() => {});
      err.textContent = msg(x); err.hidden = false;
    } finally { busy = false; btn.disabled = false; btn.textContent = "🐾 Wyślij do sprawdzenia"; }
  }

  /* ---------- moje zgłoszenia ---------- */
  let mine = [];
  async function loadMine() {
    const box = $("[data-mine]", root); if (!box || !uid) return;
    try {
      const { data, error } = await sb.from("cat_submissions")
        .select("id,status,name,age,sex,city,voivodeship,photos,reject_reason,created_at,reviewed_at,withdrawn_at,cat_id")
        .eq("user_id", uid).order("created_at", { ascending: false });
      if (error) throw error;
      mine = data || [];
      const paths = mine.flatMap((s) => s.photos.slice(0, 1));
      const urls = {};
      if (paths.length) {
        const r = await sb.storage.from("submissions").createSignedUrls(paths, 3600);
        (r.data || []).forEach((x) => { if (x.signedUrl) urls[x.path] = x.signedUrl; });
      }
      const catIds = mine.map((s) => s.cat_id).filter(Boolean);
      const catMap = {};
      if (catIds.length) {
        const r = await sb.from("cats").select("id,photo_url,status,hidden").in("id", catIds);
        (r.data || []).forEach((c) => (catMap[c.id] = c));
      }
      box.innerHTML = mine.length ? `<div class="sub-list">${mine.map((s) => mineRow(s, urls, catMap)).join("")}</div>
        <p class="auth__hint">Możesz mieć najwyżej 5 zgłoszeń czekających na sprawdzenie. Nie wysyłamy jeszcze powiadomień e-mail, więc status sprawdzaj tutaj.</p>`
        : `<p class="auth__hint">Nie masz jeszcze zgłoszeń. Po wysłaniu formularza zobaczysz tu ich status.</p>`;
    } catch (e) { box.innerHTML = `<p class="auth__err">${esc(msg(e))}</p>`; }
  }
  function mineRow(s, urls, catMap) {
    const cat = s.cat_id ? catMap[s.cat_id] : null;
    const img = s.photos[0] && urls[s.photos[0]] ? urls[s.photos[0]] : (cat && cat.photo_url) || "";
    let chip = "", info = "", act = "";
    if (s.status === "pending") {
      chip = `<span class="chip chip--wait">⏳ czeka na sprawdzenie</span>`;
      info = `Wysłane ${fmtDate(s.created_at)}.`;
      act = `<button class="btn btn--ghost btn--sm" type="button" data-withdraw="${s.id}">🗑️ Usuń zgłoszenie</button>`;
    } else if (s.status === "approved") {
      const gone = cat && cat.hidden;
      chip = gone ? `<span class="chip chip--hidden">🙈 zdjęty ze strony</span>` : `<span class="chip chip--ok">✅ na stronie</span>`;
      info = `Zaakceptowane ${fmtDate(s.reviewed_at)}.${cat && cat.status === "adopted" ? " 🏠 Kot ma już dom!" : ""}${gone ? "" : ` <a href="index.html#gra">Zobacz w grze</a>.`}`;
      act = `<button class="btn btn--ghost btn--sm" type="button" data-withdraw="${s.id}">Wycofaj zgodę i zdejmij kota</button>`;
    } else if (s.status === "rejected") {
      chip = `<span class="chip chip--rej">✗ odrzucone</span>`;
      info = `${s.reject_reason ? `Powód: ${esc(s.reject_reason.replace(/[\s.]+$/, ""))}. ` : ""}Zgłoszenie usuniemy automatycznie po 30 dniach. Możesz wysłać poprawione zgłoszenie jeszcze raz.`;
      act = `<button class="btn btn--ghost btn--sm" type="button" data-withdraw="${s.id}">🗑️ Usuń teraz</button>`;
    } else {
      chip = `<span class="chip chip--hidden">zgoda wycofana</span>`;
      info = `Wycofane ${fmtDate(s.withdrawn_at)}. Kot i Twoje dane kontaktowe zniknęły ze strony.`;
    }
    return `<article class="sub-item">
      <span class="sub-item__img">${img ? `<img src="${esc(img)}" alt="">` : "🐱"}</span>
      <div class="sub-item__info"><h3>${esc(s.name)} ${chip}</h3>
        <p>${esc([s.age, s.sex, s.city && `${s.city} (${s.voivodeship})`].filter(Boolean).join(" · "))}</p>
        <p>${info}</p></div>
      ${act ? `<div class="sub-item__act">${act}</div>` : ""}
    </article>`;
  }
  async function onMineClick(e) {
    const b = e.target.closest("[data-withdraw]"); if (!b) return;
    const s = mine.find((x) => String(x.id) === b.dataset.withdraw); if (!s) return;
    const q = s.status === "approved"
      ? `Wycofać zgodę dla ${s.name}? Kot od razu zniknie ze strony i z gry, a Twoje dane kontaktowe zostaną usunięte. Gracze dostaną zwrot postawionych punktów. Tego nie da się cofnąć.`
      : `Usunąć zgłoszenie ${s.name} razem ze zdjęciami? Tego nie da się cofnąć.`;
    if (!confirm(q)) return;
    b.disabled = true;
    try {
      const { data, error } = await sb.rpc("withdraw_my_submission", { p_id: s.id });
      if (error) throw error;
      if (data && data.photos && data.photos.length) await sb.storage.from("submissions").remove(data.photos).catch(() => {});
      toast(data.result === "withdrawn" ? `🙈 Zgoda wycofana. ${esc(s.name)} nie jest już widoczny na stronie.` : `🗑️ Usunięto zgłoszenie ${esc(s.name)}.`);
      loadMine();
    } catch (x) { b.disabled = false; toast(esc(msg(x))); }
  }

  document.addEventListener("podejrzyjkota:auth", (e) => render(e.detail));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && uid && !busy) loadMine(); });
  window.addEventListener("hashchange", () => { if (location.hash === "#moje" && $("#moje")) { loadMine(); $("#moje").scrollIntoView({ behavior: "smooth" }); } });
  if (isNative || !ACC.configured) render(null);
  else if (ACC.user && ACC.snap) render({ user: ACC.user, snap: ACC.snap });
  else setTimeout(() => { if (root.textContent.includes("Ładuję")) render(null); }, 5000);
})();
