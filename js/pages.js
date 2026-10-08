/* podejrzyjkota: drobne skrypty podstron (kopiowanie wzorów, formularz kontaktowy) */
(function () {
  "use strict";
  // adres, na który formularz kontaktowy otwiera wiadomość (ten sam co na stronie Kontakt)
  var CONTACT_EMAIL = "podlasie.studio.mail@gmail.com";

  function copyText(txt) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt);
    return new Promise(function (res, rej) {
      var ta = document.createElement("textarea");
      ta.value = txt; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? res() : rej(); } catch (e) { rej(e); }
      ta.remove();
    });
  }

  // przyciski „Kopiuj” przy wzorach wiadomości: data-copy="#id-elementu"
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy]");
    if (!b) return;
    var el = document.querySelector(b.getAttribute("data-copy"));
    if (!el) return;
    var label = b.textContent;
    copyText(el.innerText.trim()).then(function () {
      b.textContent = "✓ Skopiowano";
    }, function () {
      b.textContent = "Zaznacz i skopiuj ręcznie";
      var r = document.createRange(); r.selectNodeContents(el);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    });
    setTimeout(function () { b.textContent = label; }, 2500);
  });

  // formularz kontaktowy: nic nie wysyłamy na serwer, otwieramy program pocztowy (mailto)
  var form = document.querySelector("[data-contact-form]");
  if (form) {
    var topic = form.querySelector("#k-temat");
    var params = new URLSearchParams(location.search);
    if (params.get("temat") && topic) {
      Array.prototype.forEach.call(topic.options, function (o) { if (o.value === params.get("temat")) topic.value = o.value; });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var name = form.querySelector("#k-imie").value.trim();
      var mail = form.querySelector("#k-email").value.trim();
      var msg = form.querySelector("#k-wiadomosc").value.trim();
      var subject = (topic ? topic.value : "Wiadomość") + " | podejrzyjkota";
      var body = msg + "\n\n--\n" + (name ? name + "\n" : "") + (mail ? "Odpowiedź na: " + mail + "\n" : "");
      var href = "mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      var status = form.querySelector("[data-form-status]");
      if (status) status.textContent = "Otwieram program pocztowy… Jeśli nic się nie stało, napisz bezpośrednio na " + CONTACT_EMAIL + ".";
      window.location.href = href;
    });
  }
})();
