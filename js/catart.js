/*
 * podejrzyjkota: generator ilustracji kotów (SVG, w całości z kodu).
 * Żadnych zdjęć ani grafik z zewnątrz: kolory i umaszczenie bierzemy z pola `look`.
 */
(function () {
  let uidCounter = 0;

  // Prosty, deterministyczny generator losowy (żeby łatki były zawsze w tym samym miejscu)
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5; let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function luminance(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  const HEAD = { cx: 100, cy: 92, rx: 58, ry: 47 };
  const BODY = "M56 200 C48 152 70 120 100 120 C130 120 152 152 144 200 Z";

  function catSvg(cat, opts) {
    opts = opts || {};
    const L = Object.assign({ pattern: "solid", base: "#999", accent: "#666", white: "#fff", eyes: "#E3B23C", bg: "#F3E9DC", extra: "none" }, cat.look || {});
    const u = "c" + (++uidCounter);
    const rnd = seeded(cat.id || cat.name || "kot");
    const dark = luminance(L.base) < 0.32;
    const line = dark ? "rgba(255,240,240,.75)" : "#2B1D2E";
    const whisker = dark ? "rgba(255,255,255,.55)" : "rgba(43,29,46,.35)";
    const nose = dark ? "#D97A8C" : "#F08A9B";
    const innerEar = L.pattern === "pointed" ? "#A9767A" : (dark ? "#B4687A" : "#F4A7B0");

    // kolory poszczególnych części
    let tail = L.base, ears = L.base, paws = L.base, headFill = L.base, bodyFill = L.base;
    if (L.pattern === "tuxedo" || L.pattern === "bicolor") paws = L.white;
    if (L.pattern === "pointed") { tail = L.accent; ears = L.accent; paws = L.accent; }
    if (L.pattern === "calico") { tail = L.accent; }

    let bodyPattern = "", headPattern = "", tailExtra = "", earsExtra = "";

    const tailPath = "M134 186 C176 190 190 150 170 118";

    switch (L.pattern) {
      case "tabby":
        headPattern += `
          <ellipse cx="100" cy="112" rx="26" ry="17" fill="${L.white}" opacity=".9"/>
          <g stroke="${L.accent}" stroke-width="4.5" stroke-linecap="round" fill="none">
            <path d="M91 49 L93 64"/><path d="M100 46 L100 65"/><path d="M109 49 L107 64"/>
            <path d="M42 90 L58 93"/><path d="M43 101 L57 100"/>
            <path d="M158 90 L142 93"/><path d="M157 101 L143 100"/>
          </g>`;
        bodyPattern += `
          <ellipse cx="100" cy="168" rx="20" ry="34" fill="${L.white}" opacity=".9"/>
          <g stroke="${L.accent}" stroke-width="6" stroke-linecap="round" fill="none" opacity=".9">
            <path d="M54 150 Q66 146 74 154"/><path d="M52 170 Q64 166 74 174"/>
            <path d="M146 150 Q134 146 126 154"/><path d="M148 170 Q136 166 126 174"/>
          </g>`;
        tailExtra = `<path d="${tailPath}" stroke="${L.accent}" stroke-width="15" stroke-linecap="butt" fill="none" stroke-dasharray="7 10"/>`;
        break;
      case "tuxedo":
      case "bicolor":
        headPattern += `<path d="M100 74 C90 88 70 100 72 116 C76 136 124 136 128 116 C130 100 110 88 100 74 Z" fill="${L.white}"/>`;
        bodyPattern += `<ellipse cx="100" cy="170" rx="${L.pattern === "bicolor" ? 30 : 24}" ry="44" fill="${L.white}"/>`;
        if (L.pattern === "bicolor") {
          bodyPattern += `<ellipse cx="62" cy="200" rx="16" ry="20" fill="${L.white}"/><ellipse cx="138" cy="200" rx="16" ry="20" fill="${L.white}"/>`;
        }
        break;
      case "calico": {
        headPattern += `
          <ellipse cx="66" cy="64" rx="32" ry="26" fill="${L.accent}"/>
          <ellipse cx="140" cy="70" rx="26" ry="22" fill="${L.white}"/>
          <ellipse cx="150" cy="104" rx="14" ry="10" fill="${L.accent}"/>`;
        bodyPattern += `
          <ellipse cx="64" cy="160" rx="22" ry="26" fill="${L.white}"/>
          <ellipse cx="136" cy="150" rx="18" ry="20" fill="${L.accent}"/>
          <ellipse cx="124" cy="178" rx="13" ry="10" fill="${L.white}"/>`;
        earsExtra = `<path d="M148 74 L142 24 L106 52 Z" fill="${L.white}" stroke="${L.white}" stroke-width="8" stroke-linejoin="round"/>`;
        break;
      }
      case "tortie": {
        let blobs = "";
        for (let i = 0; i < 22; i++) {
          const x = 40 + rnd() * 120, y = 44 + rnd() * 160, rx = 6 + rnd() * 14, ry = 5 + rnd() * 10;
          const c = rnd() > 0.35 ? L.accent : L.white;
          blobs += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${c}" opacity=".9" transform="rotate(${(rnd() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
        }
        headPattern += `<ellipse cx="128" cy="70" rx="30" ry="22" fill="${L.accent}" opacity=".85"/>` + blobs;
        bodyPattern += blobs;
        break;
      }
      case "pointed":
        headPattern += `
          <defs><radialGradient id="${u}m" cx="50%" cy="55%" r="50%">
            <stop offset="0" stop-color="${L.accent}" stop-opacity=".95"/>
            <stop offset=".6" stop-color="${L.accent}" stop-opacity=".55"/>
            <stop offset="1" stop-color="${L.accent}" stop-opacity="0"/>
          </radialGradient></defs>
          <ellipse cx="100" cy="106" rx="40" ry="32" fill="url(#${u}m)"/>`;
        bodyPattern += `<ellipse cx="100" cy="210" rx="60" ry="24" fill="${L.accent}" opacity=".18"/>`;
        break;
      default: // solid
        headPattern += `<ellipse cx="100" cy="112" rx="24" ry="15" fill="#fff" opacity=".06"/>`;
    }

    const eye = (x) => `
      <g class="cat-eye">
        <ellipse cx="${x}" cy="90" rx="11.5" ry="13" fill="${L.eyes}" stroke="${dark ? "#120c14" : "#2B1D2E"}" stroke-width="2.2"/>
        <ellipse cx="${x}" cy="91" rx="4.6" ry="9.5" fill="#1B1220"/>
        <circle cx="${x + 3.5}" cy="85" r="3.4" fill="#fff"/>
        <circle cx="${x - 3.5}" cy="95" r="1.5" fill="#fff" opacity=".85"/>
      </g>`;

    let extra = "";
    if (L.extra === "collar") {
      extra = `<path d="M68 134 Q100 152 132 134" stroke="#E8613C" stroke-width="7" fill="none" stroke-linecap="round"/>
               <circle cx="100" cy="146" r="6.5" fill="#F4B942" stroke="#C98B12" stroke-width="1.5"/>`;
    } else if (L.extra === "bow") {
      extra = `<g transform="translate(140 50) rotate(18)">
                 <path d="M0 0 L-16 -9 L-16 9 Z" fill="#E8613C" stroke="#E8613C" stroke-width="3" stroke-linejoin="round"/>
                 <path d="M0 0 L16 -9 L16 9 Z" fill="#E8613C" stroke="#E8613C" stroke-width="3" stroke-linejoin="round"/>
                 <circle r="4.5" fill="#C94B29"/></g>`;
    }

    const title = opts.title !== false ? `<title>Ilustracja: ${cat.name}</title>` : "";

    return `
<svg class="cat-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ilustracja kota ${cat.name}">
  ${title}
  <defs>
    <clipPath id="${u}b"><path d="${BODY}"/></clipPath>
    <clipPath id="${u}h"><ellipse cx="${HEAD.cx}" cy="${HEAD.cy}" rx="${HEAD.rx}" ry="${HEAD.ry}"/></clipPath>
  </defs>
  <circle cx="100" cy="112" r="86" fill="${L.bg}"/>
  <circle cx="34" cy="48" r="6" fill="${L.bg}" opacity=".8"/>
  <circle cx="172" cy="40" r="4" fill="${L.bg}" opacity=".8"/>

  <path d="${tailPath}" stroke="${tail}" stroke-width="15" stroke-linecap="round" fill="none"/>
  ${tailExtra}

  <path d="${BODY}" fill="${bodyFill}"/>
  <g clip-path="url(#${u}b)">${bodyPattern}<ellipse cx="100" cy="136" rx="44" ry="10" fill="#1B1220" opacity=".13"/></g>

  <g stroke-linejoin="round">
    <path d="M52 74 L58 24 L94 52 Z" fill="${ears}" stroke="${ears}" stroke-width="8"/>
    <path d="M148 74 L142 24 L106 52 Z" fill="${ears}" stroke="${ears}" stroke-width="8"/>
    ${earsExtra}
    <path d="M60 64 L63 36 L84 54 Z" fill="${innerEar}" stroke="${innerEar}" stroke-width="3"/>
    <path d="M140 64 L137 36 L116 54 Z" fill="${innerEar}" stroke="${innerEar}" stroke-width="3"/>
  </g>

  <ellipse cx="${HEAD.cx}" cy="${HEAD.cy}" rx="${HEAD.rx}" ry="${HEAD.ry}" fill="${headFill}"/>
  <g clip-path="url(#${u}h)">${headPattern}</g>

  <g fill="${paws}" stroke="rgba(27,18,32,.18)" stroke-width="1.5">
    <ellipse cx="80" cy="194" rx="15" ry="10"/>
    <ellipse cx="120" cy="194" rx="15" ry="10"/>
  </g>
  <g stroke="rgba(27,18,32,.25)" stroke-width="1.4" stroke-linecap="round">
    <path d="M76 190 L76 197"/><path d="M84 190 L84 197"/><path d="M116 190 L116 197"/><path d="M124 190 L124 197"/>
  </g>

  ${eye(78)}${eye(122)}
  <ellipse cx="66" cy="113" rx="9" ry="5.5" fill="#F59AA8" opacity="${dark ? 0.25 : 0.4}"/>
  <ellipse cx="134" cy="113" rx="9" ry="5.5" fill="#F59AA8" opacity="${dark ? 0.25 : 0.4}"/>
  <path d="M93.5 104 Q100 100 106.5 104 Q103.5 110.5 100 111.5 Q96.5 110.5 93.5 104 Z" fill="${nose}"/>
  <path d="M100 111.5 Q100 117 94.5 118 M100 111.5 Q100 117 105.5 118" stroke="${line}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <g stroke="${whisker}" stroke-width="1.6" stroke-linecap="round">
    <path d="M80 109 L44 103"/><path d="M80 113 L45 116"/>
    <path d="M120 109 L156 103"/><path d="M120 113 L155 116"/>
  </g>
  ${extra}
</svg>`;
  }

  // Dwoje kocich oczu w ciemności: tył karty
  function peekEyesSvg() {
    const eye = (x) => `
      <g class="peek-eye" style="transform-origin:${x}px 40px">
        <path d="M${x - 12} 40 Q${x} 29 ${x + 12} 40 Q${x} 51 ${x - 12} 40 Z" fill="#F4C84A"/>
        <ellipse class="peek-pupil" cx="${x}" cy="40" rx="2.6" ry="8" fill="#1B1220"/>
        <circle cx="${x + 4}" cy="36.5" r="1.6" fill="#fff" opacity=".9"/>
      </g>`;
    return `<svg viewBox="0 0 100 80" aria-hidden="true" class="peek-svg">
      <ellipse cx="50" cy="40" rx="46" ry="34" fill="#1B1220"/>
      ${eye(32)}${eye(68)}
    </svg>`;
  }

  window.CatArt = { catSvg, peekEyesSvg };
})();
