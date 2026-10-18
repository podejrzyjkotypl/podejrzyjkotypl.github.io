/* podejrzyjkota: dodatkowe animacje (iskierki i łapki przy odkryciu karty, wejście hero,
 * kaskadowe pojawianie się kart, mikro-interakcje przycisków, liczniki).
 * Czysty JS, bez bibliotek. Przy „ogranicz ruch” w systemie efekty są wyłączone. */
(function () {
  var mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduced = !!(mq && mq.matches);
  var root = document.documentElement;
  if (!reduced) root.classList.add("fx");

  /* 1. Iskierki + łapki przy odkryciu karty, krótka wibracja na telefonie */
  function burst(x, y) {
    var box = document.createElement("div");
    box.className = "fx-burst";
    box.setAttribute("aria-hidden", "true");
    box.style.left = x + "px"; box.style.top = y + "px";
    var n = 14;
    for (var i = 0; i < n; i++) {
      var p = document.createElement("span");
      var paw = i % 3 === 0;
      p.className = paw ? "fx-paw" : "fx-spark";
      if (paw) p.textContent = "🐾";
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      var d = 60 + Math.random() * 70;
      p.style.setProperty("--dx", Math.cos(a) * d + "px");
      p.style.setProperty("--dy", Math.sin(a) * d + "px");
      p.style.setProperty("--rot", (Math.random() * 120 - 60) + "deg");
      p.style.animationDelay = (Math.random() * 90) + "ms";
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 1300);
  }
  document.addEventListener("click", function (e) {
    var back = e.target.closest && e.target.closest(".card__back");
    if (!back) return;
    var card = back.closest(".card");
    if (!card || card.classList.contains("is-flipped")) return;
    try { if (navigator.vibrate && !reduced) navigator.vibrate(18); } catch (_) {}
    if (reduced) return;
    var r = card.getBoundingClientRect();
    setTimeout(function () {
      burst(r.left + r.width / 2, r.top + r.height / 2);
      card.classList.add("fx-glow");
      setTimeout(function () { card.classList.remove("fx-glow"); }, 1100);
    }, 380);
  }, true);

  if (reduced) return;

  /* 2. Przyciski: „fala” w miejscu kliknięcia */
  document.addEventListener("pointerdown", function (e) {
    var b = e.target.closest && e.target.closest(".btn");
    if (!b) return;
    var r = b.getBoundingClientRect();
    var s = document.createElement("span");
    s.className = "fx-ripple";
    s.setAttribute("aria-hidden", "true");
    var size = Math.max(r.width, r.height) * 1.6;
    s.style.width = s.style.height = size + "px";
    s.style.left = (e.clientX - r.left - size / 2) + "px";
    s.style.top = (e.clientY - r.top - size / 2) + "px";
    b.appendChild(s);
    setTimeout(function () { s.remove(); }, 650);
  });

  /* 3. Karty na planszy pojawiają się kaskadowo, gdy wjeżdżają w ekran */
  function watchCards() {
    var board = document.querySelector("[data-board]");
    if (!board || !("IntersectionObserver" in window)) return;
    var vh = window.innerHeight;
    var io = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        en.target.style.setProperty("--cd", String(k++));
        en.target.classList.add("fx-in");
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    function scan() {
      Array.prototype.forEach.call(board.querySelectorAll(".card:not([data-fx])"), function (c) {
        c.setAttribute("data-fx", "");
        if (c.getBoundingClientRect().top > vh * 0.95) { c.classList.add("fx-wait"); io.observe(c); }
      });
    }
    scan();
    new MutationObserver(scan).observe(board, { childList: true });
  }

  /* 4. Liczniki punktów i odkrytych kart „podskakują” i odliczają przy zmianie */
  function watchCounters() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-points], [data-revealed]"), function (el) {
      var last = parseInt(el.textContent, 10) || 0, raf = 0, mo;
      function write(v) { el.textContent = String(v); mo.takeRecords(); }
      mo = new MutationObserver(function () {
        var to = parseInt(el.textContent, 10);
        if (isNaN(to) || to === last) return;
        var from = last; last = to;
        cancelAnimationFrame(raf);
        el.classList.remove("fx-pop"); void el.offsetWidth; el.classList.add("fx-pop");
        var t0 = performance.now(), dur = 500;
        write(from);
        raf = requestAnimationFrame(function step(t) {
          var k = Math.min(1, (t - t0) / dur);
          write(k < 1 ? Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))) : to);
          if (k < 1) raf = requestAnimationFrame(step);
        });
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  function init() { watchCards(); watchCounters(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
