/* Esszencia Szépségműhely – site interactions & translations (no dependencies) */
(function () {
  "use strict";

  var doc = document.documentElement;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var hasIO = "IntersectionObserver" in window;
  var EMAIL = "marianna.kosmetik@gmail.com";
  var PHONE = "+36706221208";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function openDialog(d) {
    if (d && typeof d.showModal === "function") { if (!d.open) d.showModal(); return true; }
    return false;
  }
  function closeDialog(d) { if (d && d.open && typeof d.close === "function") d.close(); }
  function pad(n) { return n < 10 ? "0" + n : String(n); }

  /* ======================================================================
     TRANSLATIONS
     The HTML is Hungarian; i18n.js maps Hungarian text → [en, de, sv].
     ====================================================================== */
  var I18N = window.ESSZ_I18N || { langs: ["hu"], dict: {} };
  var DICT = I18N.dict;
  var IDX = { en: 0, de: 1, sv: 2 };
  var LANGS = I18N.langs || ["hu"];
  var STORE_KEY = "esszencia-lang";
  var lang = LANGS.indexOf(window.ESSZ_LANG) >= 0 ? window.ESSZ_LANG : "hu";

  /** Translate a Hungarian string (falls back to Hungarian). */
  function T(hu) {
    if (lang === "hu" || hu == null) return hu;
    var e = DICT[hu];
    return (e && e[IDX[lang]]) || hu;
  }
  /** Pick the current language from a {hu,en,de,sv} object, or pass a plain string through. */
  function L(v) {
    if (v == null) return "";
    if (typeof v === "string") return v;
    return v[lang] || v.hu || "";
  }

  // Elements whose text is produced by this script – the static translator leaves them alone.
  var DYN = "[data-services-root],[data-season-name],[data-season-latin],[data-season-label],[data-season-fact],[data-season-img]," +
            "[data-lb-cap],[data-lb-img],[data-sheet-service],[data-menu-label],[data-more],[data-booking],[data-hours],[data-no-i18n]";
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, svg: 1, SVG: 1 };
  var textNodes = null, attrEls = null;

  function collect() {
    textNodes = [];
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || SKIP_TAGS[p.nodeName] || (p.closest && (p.closest("svg") || p.closest(DYN)))) return NodeFilter.FILTER_REJECT;
        return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var n;
    while ((n = w.nextNode())) {
      var raw = n.nodeValue, hu = raw.replace(/\s+/g, " ").trim();
      var ctx = n.parentNode.getAttribute && n.parentNode.getAttribute("data-i18n-key");
      var key = ctx || hu;
      if (!DICT[key]) continue;
      textNodes.push({ node: n, hu: hu, key: key, lead: (raw.match(/^\s*/) || [""])[0], trail: (raw.match(/\s*$/) || [""])[0] });
    }
    attrEls = [];
    $$("[alt],[aria-label]").forEach(function (el) {
      if (el.closest(DYN)) return;
      ["alt", "aria-label"].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && DICT[v]) attrEls.push({ el: el, attr: a, hu: v });
      });
    });
    var meta = $('meta[name="description"]');
    if (meta) attrEls.push({ el: meta, attr: "content", hu: meta.getAttribute("content"), key: "meta:description" });
  }

  function applyStatic() {
    if (!textNodes) collect();
    textNodes.forEach(function (t) {
      var e = DICT[t.key];
      var val = lang === "hu" ? t.hu : ((e && e[IDX[lang]]) || t.hu);
      t.node.nodeValue = t.lead + val + t.trail;
    });
    attrEls.forEach(function (a) {
      var e = DICT[a.key || a.hu];
      a.el.setAttribute(a.attr, lang === "hu" ? a.hu : ((e && e[IDX[lang]]) || a.hu));
    });
    doc.setAttribute("lang", lang);
    $$("[data-lang]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang)); });
  }

  function setLang(next) {
    if (LANGS.indexOf(next) < 0 || next === lang) return;
    lang = next;
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* private mode – fine */ }
    // keep a shared ?lang= link in sync if there is one
    if (history.replaceState && /[?&]lang=/.test(location.search)) {
      history.replaceState(null, "", location.pathname + location.search.replace(/([?&]lang=)[a-z]+/, "$1" + lang) + location.hash);
    }
    renderAll();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-lang]");
    if (b) { e.preventDefault(); setLang(b.getAttribute("data-lang")); }
  });

  var moreLabels = [];

  /* ---------- Year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Header border + quick-action bar ---------- */
  var header = $(".site-header");
  var bar = $(".action-bar");
  var contact = $("#kapcsolat");
  var contactVisible = false;
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle("is-scrolled", y > 8);
    if (bar) bar.classList.toggle("is-visible", y > window.innerHeight * 0.75 && !contactVisible && !doc.classList.contains("nav-open"));
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  if (hasIO && contact) {
    new IntersectionObserver(function (en) { contactVisible = en[0].isIntersecting; onScroll(); }, { threshold: 0.12 }).observe(contact);
  }
  onScroll();

  /* ---------- Mobile menu + smooth in-page links ---------- */
  var menuBtn = $(".menu-btn");
  var menuLabel = $("[data-menu-label]");
  function updateMenuLabel() {
    if (menuLabel) menuLabel.textContent = T(doc.classList.contains("nav-open") ? "Bezár" : "Menü");
  }
  function setNav(open) {
    doc.classList.toggle("nav-open", open);
    if (menuBtn) menuBtn.setAttribute("aria-expanded", String(open));
    updateMenuLabel();
    onScroll();
  }
  if (menuBtn) {
    menuBtn.addEventListener("click", function () { setNav(!doc.classList.contains("nav-open")); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && doc.classList.contains("nav-open")) { setNav(false); menuBtn.focus(); }
    });
    window.addEventListener("resize", function () { if (window.innerWidth > 960 && doc.classList.contains("nav-open")) setNav(false); });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    var target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    if (doc.classList.contains("nav-open")) setNav(false);
    // wait one frame so the scroll lock is released before scrolling
    requestAnimationFrame(function () {
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      if (history.replaceState) history.replaceState(null, "", id === "top" ? location.pathname + location.search : location.search + "#" + id);
    });
  });

  /* ---------- Active nav link ---------- */
  var links = $$(".nav-link");
  if (hasIO && links.length) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = byId[en.target.id];
        if (a && en.isIntersecting) {
          links.forEach(function (l) { l.removeAttribute("aria-current"); });
          a.setAttribute("aria-current", "true");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ---------- Booking sheet ---------- */
  var sheet = $("[data-sheet]");
  var sheetService = $("[data-sheet-service]");
  var sheetMail = $("[data-sheet-mail]");
  function mailBody(serviceName) {
    if (lang === "hu") {
      return "Kedves Marianna!\n\nSzeretnék időpontot kérni" + (serviceName ? " erre a kezelésre: " + serviceName : "") +
        ".\nNekem megfelelő napok/időpontok: \n\nKöszönöm,\n";
    }
    var svc = serviceName ? T("mail:svc").replace("{name}", serviceName) : "";
    return T("mail:body").replace("{svc}", svc);
  }
  function openBooking(serviceName) {
    var subject = T("Időpontkérés") + (serviceName ? " – " + serviceName : "");
    if (sheetMail) sheetMail.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(mailBody(serviceName));
    if (sheetService) { sheetService.hidden = !serviceName; sheetService.textContent = serviceName || ""; }
    if (doc.classList.contains("nav-open")) setNav(false);
    if (!openDialog(sheet) && contact) contact.scrollIntoView();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-book]");
    if (!b) return;
    e.preventDefault();
    if (doc.classList.contains("nav-open")) setNav(false);
    // Online booking assistant (booking.js); the contact sheet is the fallback.
    if (window.EsszBooking) {
      var c = b.getAttribute("data-cat");
      window.EsszBooking.open(c === null || c === "" ? null : +c);
    } else {
      openBooking(b.getAttribute("data-service") || "");
    }
  });
  if (sheet) {
    $("[data-sheet-close]", sheet).addEventListener("click", function () { closeDialog(sheet); });
    sheet.addEventListener("click", function (e) { if (e.target === sheet) closeDialog(sheet); });
  }

  /* ---------- Treatments & prices (from services.js) – accordion ---------- */
  var root = $("[data-services-root]");
  var data = window.ESSZENCIA_SERVICES || { categories: [] };
  var cats = (data.categories || []).filter(function (c) { return c && c.items && c.items.length; });
  var openCats = { 0: true };

  function dur(v) { return L(v).replace(/perc/g, T("perc")); }
  function price(v) { return T(L(v)); }
  function group(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function minPrice(items) {
    var min = Infinity;
    items.forEach(function (it) {
      var m = /\d[\d\s]*/.exec(L(it.price) || "");
      if (m) { var n = parseInt(m[0].replace(/\s/g, ""), 10); if (n && n < min) min = n; }
    });
    return min === Infinity ? null : min;
  }
  function metaText(c) {
    var n = c.items.length, p = minPrice(c.items);
    var tpl = lang === "hu" ? (p ? "{n} kezelés · {p} Ft-tól" : "{n} kezelés") : T(p ? "acc:meta" : "acc:count");
    return tpl.replace("{n}", n).replace("{p}", p ? group(p) : "");
  }
  function row(it) {
    return '<li class="svc"><span class="svc__name">' + esc(L(it.name)) +
      (it.tag ? '<span class="svc__tag">' + esc(L(it.tag)) + '</span>' : '') +
      (it.desc ? '<small>' + esc(L(it.desc)) + '</small>' : '') + '</span>' +
      '<span class="svc__right">' + (it.price ? '<span class="svc__price">' + esc(price(it.price)) + '</span>' : '') +
      (it.duration ? '<span class="svc__dur">' + esc(dur(it.duration)) + '</span>' : '') + '</span></li>';
  }

  function renderServices() {
    if (!root) return;
    if (!cats.length) {
      root.innerHTML = '<p>' + esc(T("Az árlista éppen készül")) + ' – <a href="tel:' + PHONE + '">+36 70 622 1208</a></p>';
      return;
    }
    var html = data.intro ? '<p class="services-intro">' + esc(L(data.intro)) + '</p>' : '';
    cats.forEach(function (c, i) {
      var name = L(c.name), intro = L(c.intro), note = L(c.note);
      html += '<details class="acc" data-cat="' + i + '"' + (openCats[i] ? ' open' : '') + '>' +
        '<summary><span class="acc__row"><span class="acc__title">' + esc(name) + '</span><span class="acc__meta">' + esc(metaText(c)) + '</span>' +
        '<span class="acc__chev" aria-hidden="true"><svg><use href="#i-chevron"/></svg></span></span></summary>' +
        '<div class="acc__body">' +
        (intro ? (intro.length > 220
          ? '<div class="acc__intro is-long"><p id="intro-' + i + '">' + esc(intro) + '</p><button type="button" class="more-btn" aria-expanded="false" aria-controls="intro-' + i + '">' + esc(T("Tovább olvasom")) + '</button></div>'
          : '<p class="acc__intro">' + esc(intro) + '</p>') : '') +
        '<ul class="svc-list' + (c.compact ? ' svc-list--two' : '') + '">' + c.items.map(row).join("") + '</ul>' +
        '<div class="acc__foot">' + (note ? '<p class="acc__note">' + esc(note) + '</p>' : '<span></span>') +
        '<button class="btn btn--line" type="button" data-book data-cat="' + i + '" data-service="' + esc(name) + '">' + esc(T("Időpontot kérek")) + '</button></div>' +
        '</div></details>';
    });
    if (data.note) html += '<p class="services-note">' + esc(L(data.note)) + '</p>';
    root.innerHTML = html;

    $$(".acc", root).forEach(function (d) {
      d.addEventListener("toggle", function () { openCats[d.getAttribute("data-cat")] = d.open; });
    });
    $$(".more-btn", root).forEach(function (b) {
      b.addEventListener("click", function () {
        var open = b.parentNode.classList.toggle("is-open");
        b.setAttribute("aria-expanded", String(open));
        b.textContent = T(open ? "Kevesebb" : "Tovább olvasom");
      });
    });
  }

  /* ---------- Herbarium: plant of the season ---------- */
  var SEASONS = {
    spring: {
      no: "01", label: "Tavasz", name: "Almavirág", latin: "Malus domestica", family: "Rózsafélék (Rosaceae)",
      img: "assets/img/hero-house-720.webp", srcset: "assets/img/hero-house-720.webp 720w, assets/img/hero-house-1200.webp 1200w", w: 720, h: 964, alt: "Virágzó almafaág a szépségműhely előtt",
      text: "Tavasszal fehér-rózsaszín felhőbe borulnak a kertek. Az alma gyümölcssavai és antioxidánsai a bőrápolásban is kedveltek: frissítik és élénkítik a bőr ragyogását.",
      fact: "Az almafa virágai a méhek első nagy tavaszi lakomái közé tartoznak."
    },
    summer: {
      no: "02", label: "Nyár", name: "Orvosi zsálya", latin: "Salvia officinalis", family: "Árvacsalánfélék (Lamiaceae)",
      img: "assets/img/sage-700.webp", srcset: "assets/img/sage-700.webp 700w, assets/img/sage-1200.webp 1200w", w: 700, h: 933, alt: "Frissen szedett zsályalevelek",
      text: "A zsálya neve a latin „salvare” – gyógyítani – szóból ered. Tisztító, összehúzó hatása miatt a zsírosabb, tágult pórusú bőr régi, kedvelt segítője.",
      fact: "A zsályát érdemes napos délelőtt, virágzás előtt szedni – ilyenkor a legillatosabb."
    },
    autumn: {
      no: "03", label: "Ősz", name: "Csipkebogyó", latin: "Rosa canina", family: "Rózsafélék (Rosaceae)",
      img: "assets/img/rosehip-700.webp", srcset: "assets/img/rosehip-700.webp 700w, assets/img/rosehip-1200.webp 1200w", w: 700, h: 700, alt: "Piros csipkebogyók egy fatönkön",
      text: "Az ősz egyik legszebb ajándéka: a vadrózsa termése színes, illatos és tele van C-vitaminnal. Magjából értékes, regeneráló olaj készül, amelyet a bőrápolás régóta nagy becsben tart.",
      fact: "A csipkebogyót az első dér után érdemes szedni – addigra megpuhul és édesebb lesz."
    },
    winter: {
      no: "04", label: "Tél", name: "Kökény", latin: "Prunus spinosa", family: "Rózsafélék (Rosaceae)",
      img: "assets/img/sloe-800.webp", srcset: "assets/img/sloe-800.webp 800w, assets/img/sloe-1400.webp 1400w", w: 800, h: 597, alt: "Hamvas kék kökénybogyók őszi levelekkel",
      text: "A kökény hamvas, kék bogyói a tél elejéig kitartanak a bokrokon. Mély színüket antioxidáns növényi festékanyagoknak köszönhetik.",
      fact: "A kökény fanyar íze az első fagyok után szelídül meg – ezért sokan a téli szedésig várnak vele."
    }
  };
  function currentSeason() {
    var m = new Date().getMonth(); // 0 = január
    return m >= 2 && m <= 4 ? "spring" : m >= 5 && m <= 7 ? "summer" : m >= 8 && m <= 10 ? "autumn" : "winter";
  }
  var herb = $("[data-season]");
  var seasonKey = currentSeason();
  function setText(sel, val) { var el = herb && $(sel, herb); if (el) el.textContent = val; }
  function showSeason(key) {
    var s = SEASONS[key];
    if (!herb || !s) return;
    var img = $("[data-season-img]", herb);
    if (img.getAttribute("src") !== s.img) { img.srcset = s.srcset; img.src = s.img; img.width = s.w; img.height = s.h; }
    img.alt = T(s.alt);
    setText("[data-season-label]", T(s.label));
    setText("[data-season-name]", T(s.name));
    setText("[data-season-latin]", s.latin);
    setText("[data-season-fact]", T(s.fact));
  }

  /* ---------- "Show all products" (phones) ---------- */
  $$("[data-more]").forEach(function (btn) {
    var list = $(btn.getAttribute("data-more"));
    var label = $("span", btn);
    var setLabel = function () { label.textContent = T(list.classList.contains("is-open") ? "Kevesebb" : "Mutasd mind a 6 terméket"); };
    btn.addEventListener("click", function () {
      var open = list.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
      setLabel();
    });
    moreLabels.push(setLabel);
  });

  /* ---------- Phone gallery counter (1 / 5) ---------- */
  var galleryList = $("[data-gallery]"), gPos = $("[data-gallery-pos]"), gTotal = $("[data-gallery-total]");
  if (galleryList && gPos) {
    var slides = $$("li", galleryList);
    if (gTotal) gTotal.textContent = slides.length;
    galleryList.addEventListener("scroll", function () {
      var left = galleryList.scrollLeft, best = 0, bestD = Infinity;
      slides.forEach(function (li, i) { var d = Math.abs(li.offsetLeft - galleryList.offsetLeft - left - parseFloat(getComputedStyle(galleryList).paddingLeft || 0)); if (d < bestD) { bestD = d; best = i; } });
      gPos.textContent = best + 1;
    }, { passive: true });
  }

  /* ---------- Pause the drifting leaves when the hero is off-screen ---------- */
  var leaves = $(".leaves");
  if (leaves && hasIO) {
    new IntersectionObserver(function (en) { leaves.classList.toggle("is-paused", !en[0].isIntersecting); }).observe(leaves);
  }

  /* ---------- Gallery lightbox ---------- */
  var lb = $("[data-lightbox]");
  var items = $$("[data-gallery] [data-full]");
  var lbIndex = 0;
  function lbShow(i) {
    lbIndex = (i + items.length) % items.length;
    var it = items[lbIndex], thumb = $("img", it), img = $("[data-lb-img]", lb);
    img.src = it.getAttribute("data-full") || thumb.src;
    img.alt = thumb.alt; // already translated
    $("[data-lb-cap]", lb).textContent = pad(lbIndex + 1) + " / " + pad(items.length) + " — " + T(it.getAttribute("data-caption") || "");
  }
  if (lb && items.length) {
    items.forEach(function (it, i) {
      it.addEventListener("click", function () {
        lbShow(i);
        if (!openDialog(lb)) window.open(it.getAttribute("data-full"), "_blank", "noopener");
      });
    });
    $("[data-lb-close]", lb).addEventListener("click", function () { closeDialog(lb); });
    $("[data-lb-prev]", lb).addEventListener("click", function () { lbShow(lbIndex - 1); });
    $("[data-lb-next]", lb).addEventListener("click", function () { lbShow(lbIndex + 1); });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") lbShow(lbIndex - 1);
      if (e.key === "ArrowRight") lbShow(lbIndex + 1);
    });
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target.tagName === "FIGURE") closeDialog(lb); });
    lb.addEventListener("close", function () { if (items[lbIndex]) items[lbIndex].focus({ preventScroll: true }); });
    var sx = null;
    lb.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) lbShow(lbIndex + (dx < 0 ? 1 : -1));
    });
  }

  /* ---------- Easter egg: click the hero logo for a petal shower ---------- */
  var lastShower = 0;
  $$("[data-petals]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var now = Date.now();
      if (reduceMotion || now - lastShower < 2500) return;
      lastShower = now;
      var icons = ["#i-petal", "#i-leaf", "#i-bud"];
      for (var i = 0; i < 26; i++) {
        var p = document.createElement("span");
        p.className = "petal";
        p.setAttribute("aria-hidden", "true");
        p.style.left = (Math.random() * 100) + "vw";
        p.style.setProperty("--d", (4.5 + Math.random() * 3.5).toFixed(2) + "s");
        p.style.setProperty("--x", ((Math.random() - 0.5) * 220).toFixed(0) + "px");
        p.style.setProperty("--r", ((Math.random() - 0.5) * 720).toFixed(0) + "deg");
        p.style.setProperty("--s", (12 + Math.random() * 14).toFixed(0) + "px");
        p.style.animationDelay = (Math.random() * 1.2).toFixed(2) + "s";
        p.style.color = Math.random() > 0.5 ? "var(--sage-500)" : "var(--forest)";
        p.innerHTML = '<svg><use href="' + icons[i % icons.length] + '"/></svg>';
        p.addEventListener("animationend", function (e) { if (e.target === this) this.remove(); });
        document.body.appendChild(p);
      }
    });
  });

  /* ======================================================================
     Render everything in the current language
     ====================================================================== */
  function renderAll() {
    applyStatic();
    renderServices();
    showSeason(seasonKey);
    updateMenuLabel();
    moreLabels.forEach(function (f) { f(); });
    if (lb && lb.open) lbShow(lbIndex);
    if (sheet && sheet.open) closeDialog(sheet);
    hooks.forEach(function (f) { try { f(); } catch (e) { /* keep going */ } });
    doc.classList.remove("i18n-pending");
  }
  // Shared helpers for booking.js
  var hooks = [];
  window.ESSZ = { T: T, L: L, esc: esc, lang: function () { return lang; }, hooks: hooks, openContactSheet: openBooking };
  renderAll();
})();
