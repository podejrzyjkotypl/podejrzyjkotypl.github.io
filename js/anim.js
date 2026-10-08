/* podejrzyjkota: subtelne pojawianie się sekcji przy przewijaniu.
 * Ukrywamy tylko to, co jest poniżej ekranu w chwili wczytania (bez migania i bez przesuwania układu).
 * Przy „ogranicz ruch” w systemie nic nie robimy. */
(function () {
  var mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  if ((mq && mq.matches) || !("IntersectionObserver" in window)) return;
  var SEL = [
    ".section__head", ".stats", ".step", ".rules__box", ".shelters__in > *", ".app__top > *", ".dl-card", ".guide",
    ".game__layout .panel", ".info-card", ".qa", ".faq-cats", ".toc", ".tbl-wrap", ".tpl", ".form",
    ".admin-card", ".submit__card", ".legal section", ".page h2", ".nf__card"
  ].join(",");
  function init() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var els = Array.prototype.slice.call(document.querySelectorAll(SEL)).filter(function (el) {
      if (el.closest("dialog, .sheet, .cc, .hero")) return false;
      var r = el.getBoundingClientRect();
      return r.height > 0 && r.top > vh * 0.92;
    });
    if (!els.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        el.classList.add("is-in");
        var done = function (e) {
          if (e && e.target !== el) return;
          el.classList.remove("reveal", "is-in");
          el.style.removeProperty("--rd");
          el.removeEventListener("transitionend", done);
        };
        el.addEventListener("transitionend", done);
        setTimeout(done, 1400);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
    els.forEach(function (el) {
      var sibs = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.setProperty("--rd", String(Math.min(sibs, 4)));
      el.classList.add("reveal");
      io.observe(el);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
