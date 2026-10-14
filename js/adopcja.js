/* podejrzyjkota: formularz „Adoptowałem kota z podejrzyjkota.pl” (adoptowalem.html)
 * Zgłoszenie trafia do public.adoption_reports przez submit_adoption_report i czeka na admina.
 * NIC nie oznacza kota jako adoptowanego automatycznie. Zdjęcie: prywatny bucket 'submissions', folder <user_id>/.
 */
(function () {
  "use strict";
  const ACC = window.PodejrzyjkotaAccount || { configured: false };
  const root = document.querySelector("[data-adopt-root]");
  if (!root) return;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  const MAX = 3 * 1024 * 1024, EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const preCat = new URLSearchParams(location.search).get("kot") || "";
  let sb = null, uid = null, photo = null, cats = [], busy = false;

  const rid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  function shrink(file) { // przerysowanie: usuwa metadane (GPS), max 1600 px
    return new Promise((res) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => { URL.revokeObjectURL(url); res(b && b.size <= MAX ? new File([b], "dom.jpg", { type: "image/jpeg" }) : null); }, "image/jpeg", 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }
  function msg(e) {
    const m = String((e && e.message) || e || "");
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Brak połączenia z serwerem. Spróbuj za chwilę.";
    if (/adoption_reports|submit_adoption_report|does not exist|PGRST20/i.test(m)) return "Formularz jeszcze się uruchamia. Spróbuj za kilka dni albo napisz do nas.";
    if (/rate.?limit|too many/i.test(m)) return "Za dużo zgłoszeń w krótkim czasie. Spróbuj jutro.";
    return m || "Coś poszło nie tak. Spróbuj ponownie.";
  }
  const card = (h) => { root.innerHTML = `<div class="admin-card submit__card">${h}</div>`; };

  function render(detail) {
    if (isNative) return card(`<h2>Formularz działa na stronie</h2><p>Otwórz <a href="https://podejrzyjkota.pl/adoptowalem.html" target="_blank" rel="noopener">podejrzyjkota.pl/adoptowalem.html</a> w przeglądarce.</p>`);
    if (!ACC.configured) return card(`<h2>Formularz chwilowo nie działa</h2><p>Napisz do nas przez <a href="kontakt.html">stronę Kontakt</a>, bardzo się ucieszymy!</p>`);
    if (!detail || !detail.user) {
      uid = null;
      return card(`<h2>Zaloguj się, żeby się pochwalić</h2><p>Zgłoszenia przyjmujemy od zalogowanych osób, żeby chronić je przed spamem. Konto jest darmowe i zakładasz je w minutę.</p>
        <div class="auth__row"><button class="btn btn--primary" type="button" data-action="login">👤 Zaloguj się albo załóż konto</button></div>`);
    }
    sb = ACC.client;
    if (uid === detail.user.id && $("[data-adopt-form]", root)) return;
    uid = detail.user.id;
    renderForm(); loadCats();
  }
  function renderForm() {
    photo = null;
    root.innerHTML = `
      <form class="admin-card submit__card submit-form" data-adopt-form novalidate>
        <h2>Adoptowałem kota z podejrzyjkota.pl 🎉</h2>
        <p class="auth__hint">Wymagane jest tylko wskazanie kota. Zgłoszenie sprawdzimy ręcznie. Nic nie pojawi się na stronie bez Twojej zgody.</p>
        <label class="field"><span>Który to kot? *</span><select name="cat_id" data-cats><option value="">wczytuję listę…</option></select></label>
        <label class="field"><span>Nie ma go na liście? Wpisz imię lub opis</span><input name="cat_text" maxlength="80" placeholder="np. Chodel bury 1, czarna kotka z Zawiercia"></label>
        <div class="field"><span>Zdjęcie z nowego domu (opcjonalnie)</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" data-photo>
          <div class="submit__thumbs" data-thumb></div></div>
        <label class="field"><span>Krótka historia (opcjonalnie)</span><textarea name="story" rows="4" maxlength="1000" placeholder="Jak się kot zaaklimatyzował? Co lubi?"></textarea></label>
        <label class="field"><span>E-mail do kontaktu (opcjonalnie)</span><input name="contact_email" type="email" maxlength="120" autocomplete="email"></label>
        <label class="check"><input type="checkbox" name="consent_publish"> <span>Zgadzam się na pokazanie zdjęcia i historii na podejrzyjkota.pl i w naszych mediach społecznościowych (bez nazwiska i e-maila). Zgodę mogę wycofać w każdej chwili, pisząc do nas.</span></label>
        <div class="submit__hp" aria-hidden="true"><label>Strona internetowa <input name="website" tabindex="-1" autocomplete="off"></label></div>
        <p class="adopt-bonus">🎁 <strong>Wkrótce:</strong> za potwierdzoną adopcję planujemy bonus punktów w grze. Jeszcze nie działa.</p>
        <p class="submit__err" data-err hidden role="alert"></p>
        <button class="btn btn--primary btn--block" type="submit">🎉 Wyślij zgłoszenie</button>
      </form>`;
    $("[data-adopt-form]").addEventListener("submit", onSubmit);
    $("[data-photo]").addEventListener("change", onPhoto);
  }
  async function loadCats() {
    const sel = $("[data-cats]"); if (!sel) return;
    try {
      const { data, error } = await sb.from("cats").select("id,name,status,hidden").order("name");
      if (error) throw error;
      cats = (data || []).filter((c) => !c.hidden);
    } catch (e) { cats = []; }
    sel.innerHTML = `<option value="">wybierz kota</option>` + cats.map((c) => `<option value="${esc(c.id)}"${c.id === preCat ? " selected" : ""}>${esc(c.name)}${c.status === "adopted" ? " (adoptowany)" : ""}</option>`).join("");
  }
  async function onPhoto(e) {
    const err = $("[data-err]"), f = e.target.files && e.target.files[0]; err.hidden = true;
    if (!f) return;
    const ok = /^image\//.test(f.type) ? await shrink(f) : null;
    if (!ok) { err.textContent = "Nie udało się odczytać zdjęcia. Wybierz JPG, PNG albo WebP."; err.hidden = false; e.target.value = ""; return; }
    if (photo) URL.revokeObjectURL(photo.url);
    photo = { file: ok, url: URL.createObjectURL(ok) };
    $("[data-thumb]").innerHTML = `<figure class="submit__thumb"><img src="${esc(photo.url)}" alt="Podgląd zdjęcia"></figure>`;
  }
  async function onSubmit(e) {
    e.preventDefault(); if (busy) return;
    const f = e.target, err = $("[data-err]", f), btn = $("button[type=submit]", f), v = (n) => f.elements[n].value.trim();
    const p = { cat_id: v("cat_id"), cat_text: v("cat_text"), story: v("story"), contact_email: v("contact_email"), consent_publish: f.elements.consent_publish.checked, website: v("website") };
    err.hidden = true;
    if (!p.cat_id && p.cat_text.length < 2) { err.textContent = "Wybierz kota z listy albo wpisz, o którego chodzi."; err.hidden = false; return; }
    if (p.contact_email && !EMAIL_RE.test(p.contact_email)) { err.textContent = "Niepoprawny e-mail."; err.hidden = false; return; }
    busy = true; btn.disabled = true; btn.textContent = "Wysyłam…";
    let up = null;
    try {
      if (photo) {
        up = `${uid}/${rid()}.jpg`;
        const r = await sb.storage.from("submissions").upload(up, photo.file, { contentType: "image/jpeg", upsert: false });
        if (r.error) { up = null; throw r.error; }
        p.photo = up;
      }
      const { error } = await sb.rpc("submit_adoption_report", { p });
      if (error) throw error;
      root.innerHTML = `<div class="admin-card submit__card"><h2>Dziękujemy! 🐾</h2><p>To najlepsza wiadomość, jaką mogliśmy dostać. Sprawdzimy zgłoszenie i, jeśli wszystko się zgadza, oznaczymy kota jako adoptowanego.</p><a class="btn btn--ghost" href="index.html#gra">Wróć do kotów</a></div>`;
    } catch (x) {
      if (up) sb.storage.from("submissions").remove([up]).catch(() => {});
      err.textContent = msg(x); err.hidden = false;
    } finally { busy = false; btn.disabled = false; btn.textContent = "🎉 Wyślij zgłoszenie"; }
  }

  document.addEventListener("podejrzyjkota:auth", (e) => render(e.detail));
  if (isNative || !ACC.configured) render(null);
  else if (ACC.user && ACC.snap) render({ user: ACC.user, snap: ACC.snap });
})();
