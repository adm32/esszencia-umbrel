/* Esszencia – anonymous visitor statistics.
   No cookies, no personal data: only "a page was opened" and a few button
   clicks are counted (as daily totals) by the salon's own booking app. */
(function () {
  "use strict";
  var URL_HIT = "/api/hit";
  function post(o) {
    try {
      var s = JSON.stringify(o);
      if (navigator.sendBeacon && navigator.sendBeacon(URL_HIT, new Blob([s], { type: "text/plain" }))) return;
      fetch(URL_HIT, { method: "POST", body: s, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(function () {});
    } catch (e) { /* statistics must never disturb the visitor */ }
  }
  var lang = function () { return document.documentElement.getAttribute("lang") || "hu"; };
  var once = {};
  function track(e, onlyOnce) {
    if (onlyOnce) { if (once[e]) return; once[e] = 1; }
    post({ t: "event", e: e, lang: lang() });
  }
  window.EsszStats = { track: track };

  // page view (after main.js has picked the language)
  function view() {
    var ref = "", internal = false;
    try {
      if (document.referrer) {
        var u = new URL(document.referrer);
        if (u.host === location.host) internal = true; else ref = u.hostname;
      }
    } catch (e) { /* ignore */ }
    var q = location.search;
    if (!ref && /[?&](fbclid|utm_source=facebook)/i.test(q)) ref = "facebook.com";
    post({ t: "view", lang: lang(), ref: ref, internal: internal, w: Math.round(window.innerWidth || 0) });
  }
  if (document.readyState === "complete") view(); else window.addEventListener("load", view);

  // what people click on
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a, button, [data-full]");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/^tel:/.test(href)) return track("call");
    if (/^mailto:/.test(href)) return track("email");
    if (/m\.me\/|messenger\.com/.test(href)) return track("messenger");
    if (/maps\.(google|apple)|google\.[a-z.]+\/maps/.test(href)) return track("map");
    if (a.hasAttribute("data-lang")) return post({ t: "event", e: "lang", lang: a.getAttribute("data-lang") });
    if (a.hasAttribute("data-full")) return track("gallery", true);
  }, true);
  // opening the price list (only real clicks, not the page restoring an open section)
  document.addEventListener("click", function (ev) {
    var s = ev.target.closest && ev.target.closest("details.acc > summary");
    if (s && !s.parentNode.open) track("prices", true);
  }, true);
})();
