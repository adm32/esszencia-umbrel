/* Runs before first paint.
   1) enables reveal animations only when JS works
   2) picks the language: ?lang=xx  →  saved choice  →  browser language  →  Hungarian
   3) briefly hides the page while it is being translated (no flash of Hungarian) */
(function () {
  var d = document.documentElement, langs = ["hu", "en", "de", "sv"], lang = null;
  d.classList.add("js");
  try {
    var m = /[?&]lang=([a-z]{2})/i.exec(location.search);
    var q = m ? m[1].toLowerCase() : null;
    if (q === "se") q = "sv"; // the button says SE; the language code for Swedish is "sv"
    if (q && langs.indexOf(q) >= 0) {
      lang = q;
      try { localStorage.setItem("esszencia-lang", lang); } catch (e) {}
    }
    if (!lang) { try { lang = localStorage.getItem("esszencia-lang"); } catch (e) {} }
    if (!lang || langs.indexOf(lang) < 0) {
      lang = "hu";
      var prefs = navigator.languages || [navigator.language || "hu"];
      for (var i = 0; i < prefs.length; i++) {
        var p = String(prefs[i]).slice(0, 2).toLowerCase();
        if (p === "nb" || p === "nn" || p === "no" || p === "da") p = "sv"; // Scandinavian neighbours read Swedish best
        if (langs.indexOf(p) >= 0) { lang = p; break; }
      }
    }
  } catch (e) { lang = "hu"; }
  window.ESSZ_LANG = lang;
  if (lang !== "hu") {
    d.setAttribute("lang", lang);
    d.classList.add("i18n-pending");
    setTimeout(function () { d.classList.remove("i18n-pending"); }, 2500); // safety net
  }
})();
