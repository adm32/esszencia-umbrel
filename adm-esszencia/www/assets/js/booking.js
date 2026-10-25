/* Esszencia – online booking assistant (3 steps: treatment → date & time → details)
   Talks to the booking server through /api (see Esszencia Foglalások app).
   If the server can't be reached, it falls back to phone / e-mail / Messenger. */
(function () {
  "use strict";

  var E = window.ESSZ;
  var dlg = document.querySelector("[data-booking]");
  if (!E || !dlg || typeof dlg.showModal !== "function") return;

  var PHONE = "+36 70 622 1208", PHONE_HREF = "tel:+36706221208";
  var EMAIL = "marianna.kosmetik@gmail.com", MESSENGER = "https://m.me/61572319876098";
  var LOCALE = { hu: "hu-HU", en: "en-GB", de: "de-DE", sv: "sv-SE" };
  var PUBLIC_MINUTES = [30, 45, 60, 75, 90, 120, 180];

  /* ---------- texts ---------- */
  var TX = {
    title: ["Időpontfoglalás", "Book an appointment", "Termin buchen", "Boka tid"],
    s1: ["Kezelés", "Treatment", "Behandlung", "Behandling"],
    s2: ["Időpont", "Date & time", "Termin", "Tid"],
    s3: ["Adataid", "Your details", "Ihre Daten", "Dina uppgifter"],
    q1: ["Milyen kezelést szeretnél?", "Which treatment would you like?", "Welche Behandlung wünschen Sie?", "Vilken behandling vill du ha?"],
    q2: ["Mikor jönnél?", "When would you like to come?", "Wann möchten Sie kommen?", "När vill du komma?"],
    q3: ["Hogyan érlek el?", "How can I reach you?", "Wie erreiche ich Sie?", "Hur når jag dig?"],
    custom: ["Egyéb / egyedi kérés", "Something else / special request", "Etwas anderes / besonderer Wunsch", "Något annat / särskild önskan"],
    customSub: ["Írd le, mit szeretnél", "Describe what you’d like", "Beschreiben Sie Ihren Wunsch", "Beskriv vad du önskar"],
    allCats: ["Összes kezelés", "All treatments", "Alle Behandlungen", "Alla behandlingar"],
    count: ["{n} kezelés", "{n} treatments", "{n} Behandlungen", "{n} behandlingar"],
    from: ["{p} Ft-tól", "from {p} Ft", "ab {p} Ft", "från {p} Ft"],
    noteOpt: ["Megjegyzés (nem kötelező)", "Note (optional)", "Anmerkung (optional)", "Meddelande (valfritt)"],
    notePh: ["Pl. érzékeny bőr, allergia, kérdés…", "E.g. sensitive skin, allergies, a question…", "Z. B. empfindliche Haut, Allergien, eine Frage…", "T.ex. känslig hud, allergier, en fråga…"],
    customLabel: ["Mit szeretnél?", "What would you like?", "Was wünschen Sie?", "Vad önskar du?"],
    customHint: ["Kb. egy órát foglalok le, a részleteket egyeztetjük.", "I’ll reserve about an hour – we’ll agree on the details.", "Ich reserviere etwa eine Stunde – die Details besprechen wir.", "Jag reserverar ungefär en timme – detaljerna kommer vi överens om."],
    next1: ["Tovább: időpont", "Next: date & time", "Weiter: Termin", "Nästa: tid"],
    next2: ["Tovább: adataim", "Next: your details", "Weiter: Ihre Daten", "Nästa: dina uppgifter"],
    submit: ["Időpont kérése", "Request appointment", "Termin anfragen", "Skicka förfrågan"],
    sending: ["Küldés…", "Sending…", "Wird gesendet…", "Skickar…"],
    change: ["Módosítás", "Change", "Ändern", "Ändra"],
    approx: ["kb. {n} perc", "approx. {n} min", "ca. {n} Min.", "ca {n} min"],
    morning: ["Délelőtt", "Morning", "Vormittag", "Förmiddag"],
    afternoon: ["Délután", "Afternoon", "Nachmittag", "Eftermiddag"],
    pickTime: ["Válassz egy időpontot:", "Choose a time:", "Wählen Sie eine Uhrzeit:", "Välj en tid:"],
    pickDay: ["Válassz egy napot a naptárban.", "Choose a day in the calendar.", "Wählen Sie einen Tag im Kalender.", "Välj en dag i kalendern."],
    noMonth: ["Ebben a hónapban már nincs szabad időpont.", "There are no free times left this month.", "In diesem Monat gibt es keine freien Termine mehr.", "Det finns inga lediga tider kvar den här månaden."],
    nextMonth: ["Következő hónap", "Next month", "Nächster Monat", "Nästa månad"],
    prevMonth: ["Előző hónap", "Previous month", "Vorheriger Monat", "Föregående månad"],
    noDay: ["nincs szabad időpont", "no free times", "keine freien Termine", "inga lediga tider"],
    legend: ["A halvány napokon nincs szabad időpont.", "Faded days have no free times.", "An hellen Tagen gibt es keine freien Termine.", "Bleka dagar har inga lediga tider."],
    otherTime: ["Nem találsz megfelelő időpontot? Írd meg a megjegyzésben, vagy hívj:", "Can’t find a suitable time? Mention it in the note or call me:", "Kein passender Termin dabei? Schreiben Sie es in die Anmerkung oder rufen Sie mich an:", "Hittar du ingen passande tid? Skriv det i meddelandet eller ring mig:"],
    loading: ["Szabad időpontok betöltése…", "Loading free times…", "Freie Termine werden geladen…", "Lediga tider laddas…"],
    name: ["Neved", "Your name", "Ihr Name", "Ditt namn"],
    phone: ["Telefonszám", "Phone number", "Telefonnummer", "Telefonnummer"],
    email: ["E-mail cím", "E-mail address", "E-Mail-Adresse", "E-postadress"],
    emailHint: ["Erre a címre küldöm a visszaigazolást.", "I’ll send the confirmation to this address.", "An diese Adresse sende ich die Bestätigung.", "Jag skickar bekräftelsen till den här adressen."],
    consent: ["Hozzájárulok, hogy az adataimat az időpont egyeztetéséhez felhasználd.", "I agree that my details may be used to arrange the appointment.", "Ich bin einverstanden, dass meine Daten zur Terminvereinbarung verwendet werden.", "Jag godkänner att mina uppgifter används för att boka tiden."],
    privacy: ["Az adataidat csak erre használom, és egy év után törlöm.", "Your details are only used for this and are deleted after a year.", "Ihre Daten werden nur dafür verwendet und nach einem Jahr gelöscht.", "Dina uppgifter används bara till detta och raderas efter ett år."],
    req: ["Kérlek, töltsd ki.", "Please fill this in.", "Bitte ausfüllen.", "Fyll i detta."],
    badEmail: ["Kérlek, ellenőrizd az e-mail címet.", "Please check the e-mail address.", "Bitte prüfen Sie die E-Mail-Adresse.", "Kontrollera e-postadressen."],
    badPhone: ["Kérlek, ellenőrizd a telefonszámot.", "Please check the phone number.", "Bitte prüfen Sie die Telefonnummer.", "Kontrollera telefonnumret."],
    needConsent: ["Kérlek, jelöld be a hozzájárulást.", "Please tick the box to agree.", "Bitte bestätigen Sie die Einwilligung.", "Kryssa i rutan för att godkänna."],
    lService: ["Kezelés", "Treatment", "Behandlung", "Behandling"],
    lWhen: ["Időpont", "Date & time", "Termin", "Tid"],
    lDur: ["Időtartam", "Duration", "Dauer", "Längd"],
    doneTitle: ["Köszönöm, megkaptam!", "Thank you – request received!", "Vielen Dank – Anfrage erhalten!", "Tack – förfrågan mottagen!"],
    doneText: ["Hamarosan e-mailben visszaigazolom az időpontot. Addig ez még csak egy kérés.", "I’ll confirm the appointment by e-mail soon. Until then, this is only a request.", "Ich bestätige den Termin in Kürze per E-Mail. Bis dahin ist es nur eine Anfrage.", "Jag bekräftar tiden snart via e-post. Fram till dess är det bara en förfrågan."],
    doneEmail: ["A visszaigazolást ide küldöm:", "The confirmation will go to:", "Die Bestätigung geht an:", "Bekräftelsen skickas till:"],
    ok: ["Rendben", "OK", "Alles klar", "Okej"],
    taken: ["Ezt az időpontot közben valaki lefoglalta. Kérlek, válassz egy másikat.", "Someone has just booked this time. Please choose another one.", "Dieser Termin wurde gerade vergeben. Bitte wählen Sie einen anderen.", "Den här tiden blev precis bokad. Välj en annan."],
    rate: ["Túl sok próbálkozás. Kérlek, foglalj telefonon:", "Too many attempts. Please book by phone:", "Zu viele Versuche. Bitte buchen Sie telefonisch:", "För många försök. Boka gärna per telefon:"],
    error: ["Valami hiba történt. Kérlek, próbáld újra, vagy hívj:", "Something went wrong. Please try again or call:", "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut oder rufen Sie an:", "Något gick fel. Försök igen eller ring:"],
    offTitle: ["Az online foglalás most nem érhető el", "Online booking isn’t available right now", "Die Online-Buchung ist gerade nicht verfügbar", "Onlinebokningen är inte tillgänglig just nu"],
    offText: ["Kérlek, kérj időpontot telefonon, e-mailben vagy Messengeren – szívesen segítek.", "Please book by phone, e-mail or Messenger – I’m happy to help.", "Bitte vereinbaren Sie Ihren Termin telefonisch, per E-Mail oder über Messenger – ich helfe gern.", "Boka gärna per telefon, e-post eller Messenger – jag hjälper gärna till."],
    call: ["Hívás", "Call", "Anrufen", "Ring"],
    back: ["Vissza", "Back", "Zurück", "Tillbaka"],
    close: ["Bezárás", "Close", "Schließen", "Stäng"],
    customName: ["Egyedi kérés", "Special request", "Besonderer Wunsch", "Särskild önskan"],
    hoursClosed: ["zárva", "closed", "geschlossen", "stängt"],
    online: ["online foglalás", "book online", "online buchen", "boka online"]
  };
  var IDX = { hu: 0, en: 1, de: 2, sv: 3 };
  var lang = function () { return E.lang(); };
  function tx(key, vars) {
    var a = TX[key] || [key];
    var s = a[IDX[lang()]] || a[0];
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ""; });
    return s;
  }
  var esc = E.esc, L = E.L;

  /* ---------- data ---------- */
  var data = window.ESSZENCIA_SERVICES || { categories: [] };
  var cats = (data.categories || []).filter(function (c) { return c && c.items && c.items.length; });
  var group = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); };
  function priceNum(v) { var m = /\d[\d\s]*/.exec(L(v) || ""); return m ? parseInt(m[0].replace(/\s/g, ""), 10) : null; }
  function minutesOf(item, cat) {
    var nums = (L(item && item.duration) || "").match(/\d+/g);
    var n = nums ? Math.max.apply(null, nums.map(Number)) : (cat && cat.minutes) || 60;
    for (var i = 0; i < PUBLIC_MINUTES.length; i++) if (n <= PUBLIC_MINUTES[i]) return PUBLIC_MINUTES[i];
    return 180;
  }

  /* ---------- dates ---------- */
  var DAY = 86400000;
  var toUTC = function (d) { var p = d.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
  var iso = function (ms) { return new Date(ms).toISOString().slice(0, 10); };
  function fmt(d, opts) {
    var s = new Intl.DateTimeFormat(LOCALE[lang()], Object.assign({ timeZone: "UTC" }, opts)).format(new Date(toUTC(d)));
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  var fmtLong = function (d) { return fmt(d, { weekday: "long", month: "long", day: "numeric" }); };
  var monthOf = function (d) { return d.slice(0, 7) + "-01"; };
  function addMonths(m, n) { var p = m.split("-"); var dt = new Date(Date.UTC(+p[0], +p[1] - 1 + n, 1)); return iso(dt.getTime()); }
  function daysIn(m) { var p = m.split("-"); return new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate(); }
  var endTime = function (t, mins) { var p = t.split(":"); var x = +p[0] * 60 + +p[1] + mins; return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"); };

  /* ---------- API ---------- */
  function api(url, opts) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
    return fetch(url, Object.assign({ signal: ctrl && ctrl.signal, headers: { "Content-Type": "application/json" }, cache: "no-store" }, opts || {}))
      .then(function (r) {
        clearTimeout(timer);
        return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, data: d }; });
      }, function (e) { clearTimeout(timer); throw e; });
  }

  /* ---------- state ---------- */
  var st, cache = {}, lastDay = null, today = null;
  function fresh(catIndex) {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem("esszencia-contact") || "{}"); } catch (e) {}
    st = {
      step: 1, cat: catIndex != null && cats[catIndex] ? catIndex : null, item: null, custom: false,
      note: "", month: null, date: null, time: null, loading: false, error: "",
      name: saved.name || "", phone: saved.phone || "", email: saved.email || "", consent: false,
      fieldErr: {}, sending: false, done: false, offline: false, openedAt: Date.now(), autoNext: true
    };
  }
  // anonymous funnel statistics (stats.js) – each step counted once per opening
  function stat(e) { if (!st || (st.tr = st.tr || {})[e]) return; st.tr[e] = 1; try { if (window.EsszStats) window.EsszStats.track(e); } catch (x) {} }
  var minutes = function () { return st.custom || st.item == null ? 60 : minutesOf(cats[st.cat].items[st.item], cats[st.cat]); };
  function serviceNames() {
    if (st.custom || st.item == null) return { hu: "Egyedi kérés", local: tx("customName"), cat: "" };
    var c = cats[st.cat], it = c.items[st.item];
    var huOf = function (v) { return typeof v === "string" ? v : (v && v.hu) || ""; };
    return { hu: huOf(it.name), local: L(it.name), cat: huOf(c.name) };
  }

  /* ---------- elements ---------- */
  var $ = function (s) { return dlg.querySelector(s); };
  var body = $("[data-bk-body]"), next = $("[data-bk-next]"), back = $("[data-bk-back]"), bar = $("[data-bk-bar]");

  /* ---------- rendering ---------- */
  function render() {
    $("[data-bk-title]").textContent = st.done ? tx("title") : tx("title");
    back.setAttribute("aria-label", tx("back"));
    $("[data-bk-close]").setAttribute("aria-label", tx("close"));
    var labels = [tx("s1"), tx("s2"), tx("s3")];
    $("[data-bk-steplabel]").textContent = st.done || st.offline ? "" : st.step + "/3 · " + labels[st.step - 1];
    bar.style.width = st.done ? "100%" : (st.offline ? "0" : (st.step / 3 * 100) + "%");
    back.hidden = st.done || st.offline || (st.step === 1 && st.cat == null && !st.custom);
    if (st.offline) return renderOffline();
    if (st.done) return renderDone();
    if (st.step === 1) renderStep1();
    if (st.step === 2) renderStep2();
    if (st.step === 3) renderStep3();
  }

  function setNext(label, enabled) {
    next.textContent = label;
    next.disabled = !enabled;
    next.parentNode.hidden = false;
  }

  function renderStep1() {
    var h = '<h3 class="bk-q">' + esc(tx("q1")) + "</h3>";
    if (st.cat == null && !st.custom) {
      h += '<ul class="bk-cats">';
      cats.forEach(function (c, i) {
        var prices = c.items.map(function (it) { return priceNum(it.price); }).filter(Boolean);
        var min = prices.length ? Math.min.apply(null, prices) : null;
        h += '<li><button type="button" class="bk-cat" data-cat="' + i + '"><span><b>' + esc(L(c.name)) + "</b><small>" +
          esc(tx("count", { n: c.items.length })) + (min ? " · " + esc(tx("from", { p: group(min) })) : "") +
          '</small></span><svg aria-hidden="true"><use href="#i-right"/></svg></button></li>';
      });
      h += '<li><button type="button" class="bk-cat bk-cat--custom" data-custom><span><b>' + esc(tx("custom")) + "</b><small>" + esc(tx("customSub")) +
        '</small></span><svg aria-hidden="true"><use href="#i-right"/></svg></button></li></ul>';
      body.innerHTML = h;
      next.parentNode.hidden = true;
      return;
    }
    if (st.custom) {
      h += '<button type="button" class="bk-crumb" data-allcats><svg aria-hidden="true"><use href="#i-left"/></svg>' + esc(tx("allCats")) + "</button>" +
        '<label class="bk-field"><span>' + esc(tx("customLabel")) + '</span><textarea data-note rows="4" maxlength="1000" placeholder="' + esc(tx("notePh")) + '">' + esc(st.note) + "</textarea>" +
        "<small>" + esc(tx("customHint")) + "</small></label>";
      body.innerHTML = h;
      setNext(tx("next1"), st.note.trim().length >= 3);
      return;
    }
    var c = cats[st.cat];
    h += '<button type="button" class="bk-crumb" data-allcats><svg aria-hidden="true"><use href="#i-left"/></svg>' + esc(tx("allCats")) + "</button>" +
      '<h4 class="bk-catname">' + esc(L(c.name)) + '</h4><ul class="bk-items" role="radiogroup" aria-label="' + esc(L(c.name)) + '">';
    c.items.forEach(function (it, j) {
      var sel = st.item === j;
      var dur = L(it.duration) ? L(it.duration).replace(/perc/g, E.T("perc")) : "";
      h += '<li><button type="button" class="bk-item" role="radio" aria-checked="' + sel + '" data-item="' + j + '">' +
        '<span class="bk-radio" aria-hidden="true"></span><span class="bk-item__name">' + esc(L(it.name)) +
        (dur ? "<small>" + esc(dur) + "</small>" : "") + '</span><span class="bk-item__price">' + esc(E.T(L(it.price))) + "</span></button></li>";
    });
    h += "</ul>" +
      '<label class="bk-field"><span>' + esc(tx("noteOpt")) + '</span><textarea data-note rows="2" maxlength="1000" placeholder="' + esc(tx("notePh")) + '">' + esc(st.note) + "</textarea></label>";
    body.innerHTML = h;
    setNext(tx("next1"), st.item != null);
  }

  function summaryChip() {
    var s = serviceNames();
    return '<div class="bk-chip"><span><b>' + esc(s.local) + "</b><small>" + esc(tx("approx", { n: minutes() })) + '</small></span>' +
      '<button type="button" class="bk-link" data-goto="1">' + esc(tx("change")) + "</button></div>";
  }

  function load(month) {
    var key = month + "|" + minutes();
    if (cache[key]) return Promise.resolve(cache[key]);
    var from = month;
    if (today && today > month && today.slice(0, 7) === month.slice(0, 7)) from = today;
    var days = Math.round((toUTC(month) + daysIn(month) * DAY - toUTC(from)) / DAY);
    return api("/api/availability?from=" + from + "&days=" + Math.max(1, days) + "&minutes=" + minutes()).then(function (r) {
      if (r.status !== 200 || !r.data.days) throw new Error("http " + r.status);
      today = r.data.today; lastDay = r.data.lastDay;
      cache[key] = r.data.days;
      return r.data.days;
    });
  }

  function renderStep2() {
    if (!st.month) st.month = monthOf(today || iso(Date.now()));
    var key = st.month + "|" + minutes();
    var days = cache[key];
    var h = summaryChip() + (st.notice ? '<p class="bk-alert" role="alert">' + esc(tx(st.notice)) + "</p>" : "") + '<h3 class="bk-q">' + esc(tx("q2")) + "</h3>";
    if (!days) {
      body.innerHTML = h + '<p class="bk-loading" role="status"><span class="bk-spinner" aria-hidden="true"></span>' + esc(tx("loading")) + "</p>";
      setNext(tx("next2"), false);
      load(st.month).then(function () { if (st.step === 2) renderStep2(); }).catch(function () { st.offline = true; render(); });
      return;
    }
    var avail = Object.keys(days);
    // First open: jump to next month if this one has nothing left; pick the first free day.
    if (!avail.length && st.autoNext && lastDay && addMonths(st.month, 1) <= lastDay) { st.autoNext = false; st.month = addMonths(st.month, 1); return renderStep2(); }
    st.autoNext = false;
    if (!st.date || !days[st.date]) { st.date = avail[0] || null; if (st.time && (!st.date || days[st.date].indexOf(st.time) < 0)) st.time = null; }

    var canPrev = today && st.month > monthOf(today);
    var canNext = lastDay && addMonths(st.month, 1) <= lastDay;
    var title = fmt(st.month, { month: "long", year: "numeric" });
    h += '<div class="bk-cal"><div class="bk-cal__head">' +
      '<button type="button" class="bk-nav" data-month="-1" aria-label="' + esc(tx("prevMonth")) + '"' + (canPrev ? "" : " disabled") + '><svg aria-hidden="true"><use href="#i-left"/></svg></button>' +
      "<strong>" + esc(title) + "</strong>" +
      '<button type="button" class="bk-nav" data-month="1" aria-label="' + esc(tx("nextMonth")) + '"' + (canNext ? "" : " disabled") + '><svg aria-hidden="true"><use href="#i-right"/></svg></button></div>' +
      '<div class="bk-cal__grid" role="grid">';
    for (var w = 0; w < 7; w++) {
      // 2024-01-01 was a Monday
      h += '<span class="bk-wd" aria-hidden="true">' + esc(new Intl.DateTimeFormat(LOCALE[lang()], { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + w))).replace(".", "")) + "</span>";
    }
    var first = (new Date(toUTC(st.month)).getUTCDay() + 6) % 7;
    for (var b = 0; b < first; b++) h += '<span class="bk-pad"></span>';
    var n = daysIn(st.month);
    for (var d = 1; d <= n; d++) {
      var ds = st.month.slice(0, 8) + String(d).padStart(2, "0");
      var has = !!days[ds];
      var cls = "bk-day" + (ds === today ? " is-today" : "") + (ds === st.date ? " is-sel" : "");
      h += '<button type="button" class="' + cls + '" data-date="' + ds + '"' + (has ? "" : " disabled") +
        ' aria-pressed="' + (ds === st.date) + '" aria-label="' + esc(fmtLong(ds)) + (has ? "" : ", " + esc(tx("noDay"))) + '">' + d + "</button>";
    }
    h += "</div></div>";
    if (!avail.length) {
      h += '<p class="bk-empty">' + esc(tx("noMonth")) + "</p>" + (canNext ? '<button type="button" class="btn btn--line bk-wide" data-month="1">' + esc(tx("nextMonth")) + "</button>" : "");
    } else if (st.date) {
      var times = days[st.date];
      var am = times.filter(function (t) { return t < "12:00"; }), pm = times.filter(function (t) { return t >= "12:00"; });
      var chips = function (arr) {
        return '<div class="bk-times">' + arr.map(function (t) {
          return '<button type="button" class="bk-time" data-time="' + t + '" aria-pressed="' + (t === st.time) + '">' + t + "</button>";
        }).join("") + "</div>";
      };
      h += '<div class="bk-slots"><h4 class="bk-daytitle">' + esc(fmtLong(st.date)) + "</h4>" +
        (am.length ? '<p class="bk-part">' + esc(tx("morning")) + "</p>" + chips(am) : "") +
        (pm.length ? '<p class="bk-part">' + esc(tx("afternoon")) + "</p>" + chips(pm) : "") + "</div>";
    }
    h += '<p class="bk-hint">' + esc(tx("legend")) + " " + esc(tx("otherTime")) + ' <a href="' + PHONE_HREF + '">' + PHONE + "</a></p>";
    body.innerHTML = h;
    setNext(tx("next2"), !!(st.date && st.time));
  }

  function summaryCard() {
    var s = serviceNames();
    return '<dl class="bk-sum"><div><dt>' + esc(tx("lService")) + "</dt><dd>" + esc(s.local) + ' <button type="button" class="bk-link" data-goto="1">' + esc(tx("change")) + "</button></dd></div>" +
      "<div><dt>" + esc(tx("lWhen")) + "</dt><dd>" + esc(fmtLong(st.date)) + ", " + esc(st.time) + "–" + esc(endTime(st.time, minutes())) +
      ' <button type="button" class="bk-link" data-goto="2">' + esc(tx("change")) + "</button></dd></div>" +
      "<div><dt>" + esc(tx("lDur")) + "</dt><dd>" + esc(tx("approx", { n: minutes() })) + "</dd></div></dl>";
  }

  function field(name, label, type, auto, hint) {
    var err = st.fieldErr[name];
    return '<label class="bk-field' + (err ? " has-err" : "") + '"><span>' + esc(label) + "</span>" +
      '<input name="' + name + '" type="' + type + '" autocomplete="' + auto + '" value="' + esc(st[name]) + '"' +
      (type === "tel" ? ' inputmode="tel"' : "") + (type === "email" ? ' inputmode="email" autocapitalize="off" spellcheck="false"' : "") +
      ' aria-invalid="' + !!err + '">' + (err ? '<em class="bk-err">' + esc(err) + "</em>" : (hint ? "<small>" + esc(hint) + "</small>" : "")) + "</label>";
  }

  function renderStep3() {
    var h = summaryCard() + '<h3 class="bk-q">' + esc(tx("q3")) + "</h3>" +
      '<form class="bk-form" data-form novalidate>' +
      field("name", tx("name"), "text", "name") +
      field("phone", tx("phone"), "tel", "tel") +
      field("email", tx("email"), "email", "email", tx("emailHint")) +
      '<label class="bk-field"><span>' + esc(st.custom ? tx("customLabel") : tx("noteOpt")) + '</span><textarea data-note rows="2" maxlength="1000" placeholder="' + esc(tx("notePh")) + '">' + esc(st.note) + "</textarea></label>" +
      '<input class="bk-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<label class="bk-check' + (st.fieldErr.consent ? " has-err" : "") + '"><input type="checkbox" name="consent"' + (st.consent ? " checked" : "") + "><span>" + esc(tx("consent")) +
      "<small>" + esc(tx("privacy")) + "</small></span></label>" +
      (st.fieldErr.consent ? '<em class="bk-err">' + esc(tx("needConsent")) + "</em>" : "") +
      (st.error ? '<p class="bk-alert" role="alert">' + st.error + "</p>" : "") +
      "</form>";
    body.innerHTML = h;
    setNext(st.sending ? tx("sending") : tx("submit"), !st.sending);
  }

  function renderDone() {
    var s = serviceNames();
    body.innerHTML = '<div class="bk-done"><span class="bk-done__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
      "<h3>" + esc(tx("doneTitle")) + "</h3><p>" + esc(tx("doneText")) + "</p>" +
      '<dl class="bk-sum"><div><dt>' + esc(tx("lService")) + "</dt><dd>" + esc(s.local) + "</dd></div><div><dt>" + esc(tx("lWhen")) + "</dt><dd>" +
      esc(fmtLong(st.date)) + ", " + esc(st.time) + "–" + esc(endTime(st.time, minutes())) + "</dd></div></dl>" +
      '<p class="bk-small">' + esc(tx("doneEmail")) + " <b>" + esc(st.email) + "</b></p></div>";
    setNext(tx("ok"), true);
  }

  function renderOffline() {
    body.innerHTML = '<div class="bk-off"><h3 class="bk-q">' + esc(tx("offTitle")) + "</h3><p>" + esc(tx("offText")) + "</p>" +
      '<div class="bk-off__actions"><a class="btn" href="' + PHONE_HREF + '"><svg aria-hidden="true"><use href="#i-phone"/></svg>' + esc(tx("call")) + "<span>" + PHONE + "</span></a>" +
      '<a class="btn btn--line" href="mailto:' + EMAIL + "?subject=" + encodeURIComponent(E.T("Időpontkérés")) + '"><svg aria-hidden="true"><use href="#i-mail"/></svg>E-mail</a>' +
      '<a class="btn btn--line" href="' + MESSENGER + '" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-msg"/></svg>Messenger</a></div></div>';
    next.parentNode.hidden = true;
  }

  /* ---------- validation & submit ---------- */
  var reEmail = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
  function readForm() {
    var f = $("[data-form]");
    if (!f) return;
    var v = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? el : { value: "", checked: false }; };
    st.name = v("name").value.trim(); st.phone = v("phone").value.trim(); st.email = v("email").value.trim();
    st.consent = v("consent").checked;
    var note = $("[data-note]"); if (note) st.note = note.value;
  }
  function validate() {
    var e = {};
    if (st.name.length < 2) e.name = tx("req");
    var digits = (st.phone.match(/\d/g) || []).length;
    if (!st.phone) e.phone = tx("req"); else if (digits < 6 || !/^[0-9+()\/.\-\s]{6,30}$/.test(st.phone)) e.phone = tx("badPhone");
    if (!st.email) e.email = tx("req"); else if (!reEmail.test(st.email)) e.email = tx("badEmail");
    if (!st.consent) e.consent = 1;
    st.fieldErr = e;
    return !Object.keys(e).length;
  }
  function submit() {
    readForm();
    st.error = "";
    if (!validate()) {
      renderStep3();
      var firstErr = body.querySelector('[aria-invalid="true"], .bk-check.has-err input');
      if (firstErr) firstErr.focus();
      return;
    }
    st.sending = true; renderStep3();
    var s = serviceNames();
    var hp = body.querySelector("[name=website]");
    api("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        date: st.date, time: st.time, minutes: minutes(),
        serviceHu: s.hu, serviceLocal: s.local, category: s.cat,
        name: st.name, phone: st.phone, email: st.email, note: st.note.trim(),
        lang: lang(), consent: true, website: hp ? hp.value : "", elapsed: Date.now() - st.openedAt
      })
    }).then(function (r) {
      st.sending = false;
      if (r.status === 201 || r.status === 200) {
        try { localStorage.setItem("esszencia-contact", JSON.stringify({ name: st.name, phone: st.phone, email: st.email })); } catch (e) {}
        cache = {};
        st.done = true; stat("book_sent"); render(); body.scrollTop = 0;
        return;
      }
      if (r.status === 409) {
        cache = {}; st.time = null; st.step = 2; st.error = ""; st.notice = "taken";
        render(); body.scrollTop = 0;
        return;
      }
      if (r.status === 400 && r.data && r.data.fields) {
        var f = r.data.fields; if (f.email) st.fieldErr.email = tx("badEmail"); if (f.phone) st.fieldErr.phone = tx("badPhone"); if (f.name) st.fieldErr.name = tx("req");
      }
      st.error = esc(tx(r.status === 429 ? "rate" : "error")) + ' <a href="' + PHONE_HREF + '">' + PHONE + "</a>";
      renderStep3();
    }).catch(function () {
      st.sending = false;
      st.error = esc(tx("error")) + ' <a href="' + PHONE_HREF + '">' + PHONE + "</a>";
      renderStep3();
    });
  }

  /* ---------- events ---------- */
  function go(step) { readForm(); st.step = step; st.error = ""; render(); body.scrollTop = 0; }
  next.addEventListener("click", function () {
    if (st.done) return dlg.close();
    if (st.step === 1) { stat("book_service"); return go(2); }
    if (st.step === 2) { stat("book_time"); return go(3); }
    if (st.step === 3) return submit();
  });
  back.addEventListener("click", function () {
    if (st.step === 1) { st.cat = null; st.item = null; st.custom = false; render(); return; }
    go(st.step - 1);
  });
  $("[data-bk-close]").addEventListener("click", function () { dlg.close(); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  body.addEventListener("input", function (e) {
    if (e.target.matches("[data-note]")) {
      st.note = e.target.value;
      if (st.step === 1 && st.custom) next.disabled = st.note.trim().length < 3;
    }
  });
  body.addEventListener("click", function (e) {
    var t = e.target.closest("button, a");
    if (!t || !body.contains(t)) return;
    if (t.hasAttribute("data-cat")) { st.cat = +t.getAttribute("data-cat"); st.item = cats[st.cat].items.length === 1 ? 0 : null; st.custom = false; st.month = null; st.date = null; st.time = null; render(); body.scrollTop = 0; return; }
    if (t.hasAttribute("data-custom")) { st.custom = true; st.cat = null; st.item = null; st.date = null; st.time = null; render(); var ta = $("[data-note]"); if (ta) ta.focus(); return; }
    if (t.hasAttribute("data-allcats")) { readForm(); st.cat = null; st.item = null; st.custom = false; render(); return; }
    if (t.hasAttribute("data-item")) {
      var note = $("[data-note]"); if (note) st.note = note.value;
      var j = +t.getAttribute("data-item");
      if (st.item !== j) { st.date = null; st.time = null; }
      st.item = j; render();
      return;
    }
    if (t.hasAttribute("data-goto")) { go(+t.getAttribute("data-goto")); return; }
    if (t.hasAttribute("data-month")) { st.month = addMonths(st.month, +t.getAttribute("data-month")); st.date = null; st.time = null; renderStep2(); return; }
    if (t.hasAttribute("data-date")) { st.date = t.getAttribute("data-date"); st.time = null; renderStep2(); var sl = body.querySelector(".bk-slots"); if (sl && sl.scrollIntoView) sl.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
    if (t.hasAttribute("data-time")) {
      st.time = t.getAttribute("data-time");
      if (st.notice) { st.notice = ""; var al = body.querySelector(".bk-alert"); if (al) al.remove(); }
      body.querySelectorAll(".bk-time").forEach(function (x) { x.setAttribute("aria-pressed", String(x === t)); });
      next.disabled = false;
      if (window.matchMedia("(max-width: 760px)").matches) next.scrollIntoView({ block: "nearest" });
      return;
    }
  });
  body.addEventListener("change", function (e) {
    if (e.target.name === "consent") { st.consent = e.target.checked; if (st.consent && st.fieldErr.consent) { st.fieldErr.consent = 0; readForm(); renderStep3(); } }
  });
  body.addEventListener("submit", function (e) { e.preventDefault(); submit(); });
  dlg.addEventListener("close", function () { document.documentElement.classList.remove("bk-open"); });

  /* ---------- public ---------- */
  window.EsszBooking = {
    open: function (catIndex) {
      fresh(catIndex);
      stat("book_open");
      render();
      dlg.showModal();
      document.documentElement.classList.add("bk-open");
      body.scrollTop = 0;
      // warm up availability for the default length while the visitor chooses
      api("/api/info").then(function (r) { if (r.status === 200) { today = r.data.today; } else if (st.step === 1 && !st.done) { st.offline = true; render(); } })
        .catch(function () { if (st.step === 1 && !st.done) { st.offline = true; render(); } });
    }
  };
  E.hooks.push(function () { if (dlg.open) { readForm(); render(); } renderHours(); });

  /* ---------- opening hours on the page (from the server, so they stay in sync) ---------- */
  var hoursCache = null;
  function renderHours() {
    var els = document.querySelectorAll("[data-hours]");
    if (!els.length || !hoursCache) return;
    var order = [1, 2, 3, 4, 5, 6, 0];
    var dn = function (d) { return new Intl.DateTimeFormat(LOCALE[lang()], { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, d === 0 ? 7 : d))).replace(".", ""); };
    var short = function (t) { return t.replace(/^0/, "").replace(/:00$/, ""); };
    var groups = [];
    order.forEach(function (d) {
      var h = hoursCache[d], key = h ? h.join("-") : "x";
      var g = groups[groups.length - 1];
      if (g && g.key === key) g.days.push(d); else groups.push({ key: key, days: [d], h: h });
    });
    var txt = groups.map(function (g) {
      var label = g.days.length > 1 ? dn(g.days[0]) + "–" + dn(g.days[g.days.length - 1]) : dn(g.days[0]);
      return label + " " + (g.h ? short(g.h[0]) + "–" + short(g.h[1]) : tx("hoursClosed"));
    }).join(" · ");
    els.forEach(function (el) { el.textContent = txt; });
  }
  api("/api/info").then(function (r) { if (r.status === 200 && r.data.hours) { hoursCache = r.data.hours; today = r.data.today; renderHours(); } }).catch(function () {});
})();
