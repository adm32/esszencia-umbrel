/* Esszencia Szépségműhely – site interactions (no dependencies) */
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

  /* ---------- Year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Header border + floating book button ---------- */
  var header = $(".site-header");
  var fab = $(".action-bar");
  var contact = $("#kapcsolat");
  var contactVisible = false;
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle("is-scrolled", y > 8);
    if (fab) fab.classList.toggle("is-visible", y > window.innerHeight * 0.75 && !contactVisible && !doc.classList.contains("nav-open"));
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  if (hasIO && contact) {
    new IntersectionObserver(function (en) { contactVisible = en[0].isIntersecting; onScroll(); }, { threshold: 0.12 }).observe(contact);
  }
  onScroll();

  /* ---------- Smooth in-page links (also closes the mobile menu first) ---------- */
  var menuBtn = $(".menu-btn");
  var menuLabel = $("[data-menu-label]");
  function setNav(open) {
    doc.classList.toggle("nav-open", open);
    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", String(open));
      if (menuLabel) menuLabel.textContent = open ? "Bezár" : "Menü";
    }
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
    var wasOpen = doc.classList.contains("nav-open");
    if (wasOpen) setNav(false);
    // wait one frame so the scroll lock is released before scrolling
    requestAnimationFrame(function () {
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      if (history.replaceState) history.replaceState(null, "", id === "top" ? location.pathname + location.search : "#" + id);
    });
  });

  /* ---------- Reveal on scroll ---------- */
  var reveals = $$(".reveal");
  if (hasIO && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Pause the drifting leaves when the hero is off-screen (saves battery) ---------- */
  var leaves = $(".leaves");
  if (leaves && hasIO) {
    new IntersectionObserver(function (en) { leaves.classList.toggle("is-paused", !en[0].isIntersecting); }).observe(leaves);
  }

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
  function openBooking(serviceName) {
    var subject = "Időpontkérés" + (serviceName ? " – " + serviceName : "");
    var body = "Kedves Marianna!\n\nSzeretnék időpontot kérni" + (serviceName ? " erre a kezelésre: " + serviceName : "") +
      ".\nNekem megfelelő napok/időpontok: \n\nKöszönöm,\n";
    if (sheetMail) sheetMail.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    if (sheetService) { sheetService.hidden = !serviceName; sheetService.textContent = serviceName || ""; }
    if (doc.classList.contains("nav-open")) setNav(false);
    if (!openDialog(sheet) && contact) contact.scrollIntoView();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-book]");
    if (b) { e.preventDefault(); openBooking(b.getAttribute("data-service") || ""); }
  });
  if (sheet) {
    $("[data-sheet-close]", sheet).addEventListener("click", function () { closeDialog(sheet); });
    sheet.addEventListener("click", function (e) { if (e.target === sheet) closeDialog(sheet); });
  }

  /* ---------- Services (from services.js) ---------- */
  var root = $("[data-services-root]");
  var data = window.ESSZENCIA_SERVICES || { categories: [] };
  var cats = (data.categories || []).filter(function (c) { return c && c.items && c.items.length; });

  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function treatment(it, i) {
    return '<li class="treatment">' +
      '<span class="treatment__n">' + pad(i + 1) + '</span>' +
      '<div><h3 class="treatment__name">' + esc(it.name) + (it.tag ? '<span class="treatment__tag">' + esc(it.tag) + '</span>' : '') + '</h3>' +
      (it.desc ? '<p class="treatment__desc">' + esc(it.desc) + '</p>' : '') + '</div>' +
      '<div class="treatment__meta">' + (it.price ? '<span class="treatment__price">' + esc(it.price) + '</span>' : '') +
      (it.duration ? '<span class="treatment__dur">' + esc(it.duration) + '</span>' : '') + '</div>' +
      '<button type="button" class="treatment__book" data-book data-service="' + esc(it.name) + '">Ezt kérem</button>' +
      '</li>';
  }

  function priceRow(it) {
    return '<li class="price-row"><span class="price-row__name">' + esc(it.name) +
      (it.desc ? '<small>' + esc(it.desc) + '</small>' : '') + '</span>' +
      '<span class="price-row__price">' + esc(it.price || "") + '</span></li>';
  }

  if (root) {
    if (!cats.length) {
      root.innerHTML =
        '<div class="coming-soon">' +
          '<div class="coming-soon__art"><img src="assets/img/sprig-top.webp" width="700" height="290" alt="" loading="lazy"></div>' +
          '<div class="coming-soon__body"><p class="label"><b>—</b> Hamarosan</p>' +
          '<h3>Az árlista éppen készül</h3>' +
          '<p>Frissítem a kezelések listáját. Addig is szívesen mesélek róluk telefonon vagy üzenetben – és segítek kiválasztani, melyik illik leginkább a bőrödhöz.</p>' +
          '<div class="btn-row"><button class="btn" type="button" data-book>Érdeklődöm</button>' +
          '<a class="btn btn--line" href="tel:' + PHONE + '">+36 70 622 1208</a></div></div>' +
        '</div>';
    } else {
      var multi = cats.length > 1;
      var html = "";
      if (multi) {
        html += '<div class="cat-tabs" role="tablist" aria-label="Kategóriák">';
        cats.forEach(function (c, i) {
          html += '<button class="cat-tab" type="button" role="tab" id="tab-' + i + '" aria-controls="panel-' + i + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '">' + esc(c.name) + '</button>';
        });
        html += '</div>';
      }
      cats.forEach(function (c, i) {
        var list = c.compact
          ? '<ul class="price-list" aria-label="' + esc(c.name) + '">' + c.items.map(priceRow).join("") + '</ul>'
          : '<ul class="treatments" aria-label="' + esc(c.name) + '">' + c.items.map(treatment).join("") + '</ul>';
        html += '<div class="cat-panel" id="panel-' + i + '"' + (multi ? ' role="tabpanel" tabindex="0" aria-labelledby="tab-' + i + '"' : '') + (i === 0 ? '' : ' hidden') + '>' +
          (multi ? '' : '<p class="label">' + esc(c.name) + '</p>') +
          (c.intro ? (c.intro.length > 240
            ? '<div class="cat-intro is-long"><p id="intro-' + i + '">' + esc(c.intro) + '</p><button type="button" class="more-btn" aria-expanded="false" aria-controls="intro-' + i + '">Tovább olvasom</button></div>'
            : '<p class="cat-intro">' + esc(c.intro) + '</p>') : '') +
          list +
          ((c.note || c.compact) ? '<div class="cat-foot">' + (c.note ? '<p class="cat-note">' + esc(c.note) + '</p>' : '<span></span>') +
            (c.compact ? '<button class="btn btn--line" type="button" data-book data-service="' + esc(c.name) + '">Időpontot kérek</button>' : '') + '</div>' : '') +
          '</div>';
      });
      if (data.note) html += '<p class="services-note">' + esc(data.note) + '</p>';
      root.innerHTML = (data.intro ? '<p class="services-intro">' + esc(data.intro) + '</p>' : '') + html;

      $$(".more-btn", root).forEach(function (b) {
        b.addEventListener("click", function () {
          var box = b.parentNode, open = box.classList.toggle("is-open");
          b.setAttribute("aria-expanded", String(open));
          b.textContent = open ? "Kevesebb" : "Tovább olvasom";
        });
      });

      var tabs = $$(".cat-tab", root);
      var select = function (i, focus) {
        tabs.forEach(function (t, j) {
          var on = i === j;
          t.setAttribute("aria-selected", String(on));
          t.tabIndex = on ? 0 : -1;
          $("#panel-" + j, root).hidden = !on;
        });
        if (focus) tabs[i].focus();
      };
      tabs.forEach(function (t, i) {
        t.addEventListener("click", function () {
          select(i);
          // keep the chosen tab visible in the horizontally scrolling tab bar (mobile)
          if (t.scrollIntoView) t.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
        });
        t.addEventListener("keydown", function (e) {
          var n = tabs.length, to = null;
          if (e.key === "ArrowRight") to = (i + 1) % n;
          if (e.key === "ArrowLeft") to = (i - 1 + n) % n;
          if (e.key === "Home") to = 0;
          if (e.key === "End") to = n - 1;
          if (to !== null) { e.preventDefault(); select(to, true); }
        });
      });
    }
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
  function setText(sel, val) { var el = $(sel, herb); if (el) el.textContent = val; }
  function showSeason(key, animate) {
    var s = SEASONS[key];
    if (!herb || !s) return;
    var apply = function () {
      var img = $("[data-season-img]", herb);
      img.srcset = s.srcset; img.src = s.img; img.width = s.w; img.height = s.h; img.alt = s.alt;
      setText("[data-season-no]", "Herbárium · No. " + s.no);
      setText("[data-season-latin-cap]", s.latin);
      setText("[data-season-name]", s.name);
      setText("[data-season-latin]", s.latin);
      setText("[data-season-text]", s.text);
      setText("[data-season-label]", s.label);
      setText("[data-season-family]", s.family);
      setText("[data-season-fact]", s.fact);
      $$("[data-season-btn]", herb).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-season-btn") === key)); });
      herb.classList.remove("is-swapping");
    };
    if (animate && !reduceMotion) { herb.classList.add("is-swapping"); setTimeout(apply, 320); } else apply();
  }
  showSeason(currentSeason(), false);
  $$("[data-season-btn]").forEach(function (b) {
    b.addEventListener("click", function () { showSeason(b.getAttribute("data-season-btn"), true); });
  });

  /* ---------- Gallery filmstrip + lightbox ---------- */
  var strip = $("[data-gallery]");
  var prevBtn = $("[data-strip-prev]"), nextBtn = $("[data-strip-next]");
  function stripStep() { var f = $(".frame", strip); return f ? f.getBoundingClientRect().width + 20 : 400; }
  function updateStripBtns() {
    if (!strip || !prevBtn) return;
    prevBtn.disabled = strip.scrollLeft <= 4;
    nextBtn.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4;
  }
  if (strip && prevBtn && nextBtn) {
    prevBtn.addEventListener("click", function () { strip.scrollBy({ left: -stripStep(), behavior: reduceMotion ? "auto" : "smooth" }); });
    nextBtn.addEventListener("click", function () { strip.scrollBy({ left: stripStep(), behavior: reduceMotion ? "auto" : "smooth" }); });
    strip.addEventListener("scroll", updateStripBtns, { passive: true });
    window.addEventListener("resize", updateStripBtns);
    window.addEventListener("load", updateStripBtns);
    updateStripBtns();
  }

  var lb = $("[data-lightbox]");
  var items = $$("[data-gallery] [data-full]");
  var lbIndex = 0;
  function lbShow(i) {
    lbIndex = (i + items.length) % items.length;
    var it = items[lbIndex], thumb = $("img", it), img = $("[data-lb-img]", lb);
    img.src = it.getAttribute("data-full") || thumb.src;
    img.alt = thumb.alt;
    $("[data-lb-cap]", lb).textContent = pad(lbIndex + 1) + " / " + pad(items.length) + " — " + (it.getAttribute("data-caption") || "");
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

  /* ---------- One minute of calm (breathing) ---------- */
  var br = $("[data-breathe]");
  if (br) {
    var brBtn = $("[data-breathe-btn]", br), brLabel = $("[data-breathe-label]", br),
        brCount = $("[data-breathe-count]", br), brSr = $("[data-breathe-sr]", br);
    var PHASES = [["is-in", "Belégzés…", 4], ["is-hold", "Tartsd bent…", 4], ["is-out", "Kilégzés…", 6]];
    var CYCLES = 4, timer = null, tick = null, running = false;
    var idleText = brLabel.textContent;
    var stop = function (finished) {
      running = false; clearTimeout(timer); clearInterval(tick);
      br.classList.remove("is-in", "is-hold", "is-out");
      brLabel.textContent = finished ? "Köszönöm. Szeretettel várlak 🌿" : idleText;
      brCount.textContent = "";
      brSr.textContent = finished ? "Vége a gyakorlatnak. Köszönöm." : "";
      brBtn.textContent = finished ? "Még egyszer" : "Kezdjük";
    };
    var run = function (cycle, phase) {
      if (!running) return;
      if (cycle >= CYCLES) { stop(true); return; }
      var p = PHASES[phase], left = p[2];
      br.classList.remove("is-in", "is-hold", "is-out");
      void br.offsetWidth; // restart the transition cleanly
      br.classList.add(p[0]);
      brLabel.textContent = p[1];
      brCount.textContent = String(left);
      brSr.textContent = p[1];
      clearInterval(tick);
      tick = setInterval(function () { left -= 1; if (left > 0) brCount.textContent = String(left); }, 1000);
      timer = setTimeout(function () {
        if (phase + 1 >= PHASES.length) run(cycle + 1, 0); else run(cycle, phase + 1);
      }, p[2] * 1000);
    };
    brBtn.addEventListener("click", function () {
      if (running) { stop(false); return; }
      running = true; brBtn.textContent = "Megállítom"; run(0, 0);
    });
    document.addEventListener("visibilitychange", function () { if (document.hidden && running) stop(false); });
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
})();
