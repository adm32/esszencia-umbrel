/* Esszencia · Foglalások – admin app */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var S = null;            // server state
  var tab = 'requests';
  var DAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
  var DUR = [30, 45, 60, 75, 90, 120, 180];
  var LANG = { hu: 'magyar', en: 'angol', de: 'német', sv: 'svéd' };

  /* ---------------- helpers ---------------- */
  function api(path, opts) {
    opts = opts || {};
    return fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Esszencia': '1' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && d.login) { location.href = '/login'; }
        if (!r.ok) { var e = new Error(d.error || ('Hiba (' + r.status + ')')); e.status = r.status; e.data = d; throw e; }
        return d;
      });
    });
  }
  var toMin = function (t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; };
  var fromMin = function (n) { return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); };
  var endOf = function (b) { return fromMin(toMin(b.time) + b.minutes); };
  function dateObj(d) { var p = d.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function fmtDay(d, opts) {
    var s = new Intl.DateTimeFormat('hu-HU', Object.assign({ timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }, opts || {})).format(dateObj(d));
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function relDay(d) {
    var diff = Math.round((dateObj(d) - dateObj(S.today)) / 86400000);
    if (diff === 0) return 'ma';
    if (diff === 1) return 'holnap';
    if (diff === -1) return 'tegnap';
    if (diff > 1 && diff < 7) return diff + ' nap múlva';
    return '';
  }
  function fmtStamp(iso) {
    try { return new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch (e) { return iso; }
  }
  function addDays(d, n) { return new Date(dateObj(d).getTime() + n * 86400000).toISOString().slice(0, 10); }
  function isPast(b) { return b.date < S.today || (b.date === S.today && toMin(b.time) + b.minutes <= S.nowMin); }

  var toastTimer;
  function toast(msg, bad) {
    var t = $('[data-toast]');
    t.textContent = msg;
    t.className = 'toast' + (bad ? ' toast--bad' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, bad ? 6000 : 3200);
  }

  /* ---------------- load & render ---------------- */
  function load(spin) {
    var b = $('[data-refresh]');
    if (spin) { b.classList.remove('is-spinning'); void b.offsetWidth; b.classList.add('is-spinning'); }
    return api('/api/admin/state').then(function (d) {
      S = d;
      $('[data-load-error]').hidden = true;
      render();
    }).catch(function () { $('[data-load-error]').hidden = false; });
  }

  function render() {
    if (window.EsszDash && window.EsszDash.active()) return;
    if (!S) return;
    var pending = S.bookings.filter(function (b) { return b.status === 'pending' && !isPast(b); });
    var badge = $('[data-badge]');
    badge.textContent = pending.length;
    badge.hidden = !pending.length;
    document.title = (pending.length ? '(' + pending.length + ') ' : '') + 'Esszencia · Foglalások';
    $('[data-mail-banner]').hidden = S.mailConfigured;
    $$('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab)); });
    $$('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== tab; });
    $('[data-fab]').hidden = tab === 'settings';
    if (tab === 'requests') renderRequests(pending);
    if (tab === 'calendar') renderCalendar();
    if (tab === 'past') renderPast();
    if (tab === 'settings' && !$('[data-view="settings"] form')) renderSettings();
  }

  function card(b) {
    var past = isPast(b);
    var st = b.status;
    var label = { pending: 'Új kérés', confirmed: 'Visszaigazolva', declined: 'Elutasítva', cancelled: 'Lemondva' }[st];
    if (past && st === 'confirmed') label = 'Lezajlott';
    if (past && st === 'pending') label = 'Lejárt kérés';
    var rel = relDay(b.date);
    var h = '<article class="card card--' + st + '" data-id="' + esc(b.id) + '">' +
      '<div class="card__top"><div class="card__when">' + esc(b.time) + '–' + esc(endOf(b)) +
      '<small>' + esc(fmtDay(b.date)) + (rel ? ' · ' + rel : '') + '</small></div>' +
      '<span class="status status--' + (past && (st === 'confirmed' || st === 'pending') ? 'past' : st) + '">' + label + '</span></div>' +
      '<p class="card__service">' + esc(b.service && b.service.hu || 'Kezelés') + ' <small>(' + b.minutes + ' perc' + (b.service && b.service.category ? ' · ' + esc(b.service.category) : '') + ')</small></p>' +
      '<div class="card__who"><strong>' + esc(b.name) + '</strong>' +
      (b.phone ? '<a href="tel:' + esc(b.phone.replace(/[^\d+]/g, '')) + '">' + esc(b.phone) + '</a>' : '') +
      (b.email ? '<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>' : '') + '</div>' +
      (b.note ? '<p class="card__note">' + esc(b.note) + '</p>' : '') +
      (b.message ? '<p class="card__msg">Üzeneted: ' + esc(b.message) + '</p>' : '') +
      '<div class="card__meta">' + (b.source === 'manual' ? 'Kézi foglalás' : 'Weboldalról') + ' · ' + esc(fmtStamp(b.createdAt)) +
      (b.lang && b.lang !== 'hu' ? ' · nyelv: ' + LANG[b.lang] : '') + '</div>';
    if (b.mail) {
      h += b.mail.ok
        ? '<div class="mailstate mailstate--ok">✓ E-mail elküldve a vendégnek (' + esc(fmtStamp(b.mail.at)) + ')</div>'
        : '<div class="mailstate mailstate--bad">⚠ Az e-mail nem ment el: ' + esc(b.mail.error) + '</div>';
    }
    h += '<div class="card__actions">';
    if (st === 'pending' && !past) {
      h += '<button class="btn" type="button" data-act="confirm">✓ Elfogadom</button>' +
           '<button class="btn btn--line" type="button" data-act="decline">Elutasítom</button>' +
           '<button class="btn btn--line btn--small" type="button" data-act="move">Áthelyezés</button>';
    } else if (st === 'confirmed' && !past) {
      h += '<button class="btn btn--line" type="button" data-act="move">Áthelyezés</button>' +
           '<button class="btn btn--bad" type="button" data-act="cancel">Lemondás</button>';
    } else {
      h += '<button class="btn btn--bad btn--small" type="button" data-act="delete">Törlés</button>';
    }
    if (b.mail && !b.mail.ok && b.email && st !== 'pending') h += '<button class="btn btn--line btn--small" type="button" data-act="resend">E-mail újraküldése</button>';
    h += '</div></article>';
    return h;
  }

  function blockCard(k) {
    var range = k.dateTo && k.dateTo !== k.date ? fmtDay(k.date) + ' – ' + fmtDay(k.dateTo) : fmtDay(k.date);
    return '<article class="card card--block" data-block="' + esc(k.id) + '"><div class="card__top"><div class="card__when">' +
      (k.allDay ? 'Zárva egész nap' : 'Zárva ' + esc(k.from) + '–' + esc(k.to)) + '<small>' + esc(range) + '</small></div></div>' +
      (k.note ? '<p class="card__service">' + esc(k.note) + '</p>' : '') +
      '<div class="card__actions"><button class="btn btn--line btn--small" type="button" data-act="unblock">Zárás törlése</button></div></article>';
  }

  function renderRequests(pending) {
    var el = $('[data-view="requests"]');
    if (!pending.length) {
      el.innerHTML = '<div class="empty"><b>Nincs új időpontkérés 🌿</b>Ha valaki foglal a weboldalon, itt jelenik meg, és e-mailt is kapsz róla.</div>';
      return;
    }
    el.innerHTML = '<p style="color:var(--soft)">' + pending.length + ' kérés vár visszaigazolásra. A vendég csak az elfogadás vagy elutasítás után kap e-mailt.</p>' + pending.map(card).join('');
  }

  function groupByDay(items) {
    var map = {};
    items.forEach(function (it) { (map[it._day] = map[it._day] || []).push(it); });
    return Object.keys(map).sort().map(function (d) { return { day: d, items: map[d] }; });
  }

  /* ---------------- calendar (month grid + day timeline) ---------------- */
  var cal = { sel: null, month: null };
  var HOUR = 56;
  var cap = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
  function monthOf(d) { return d.slice(0, 7) + '-01'; }
  function addMonthsTo(m, n) { var d = dateObj(m); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }
  function calItems() {
    var byDay = {};
    var push = function (d, it) { (byDay[d] = byDay[d] || []).push(it); };
    S.bookings.forEach(function (b) { if (b.status === 'confirmed' || b.status === 'pending') push(b.date, { kind: 'b', b: b }); });
    S.blocks.forEach(function (k) {
      var d = k.date, to = k.dateTo || k.date, guard = 0;
      while (d <= to && guard++ < 400) { push(d, { kind: 'k', k: k }); d = addDays(d, 1); }
    });
    return byDay;
  }
  function lanes(evs) {
    // side-by-side columns for overlapping events (like a calendar day view)
    evs.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
    var groups = [], cur = null;
    evs.forEach(function (ev) {
      if (!cur || ev.s >= cur.end) { cur = { end: ev.e, cols: [], items: [] }; groups.push(cur); }
      cur.end = Math.max(cur.end, ev.e);
      var c = 0; while (cur.cols[c] > ev.s) c++;
      cur.cols[c] = ev.e; ev.col = c; cur.items.push(ev);
    });
    groups.forEach(function (g) { g.items.forEach(function (ev) { ev.cols = g.cols.length; }); });
    return evs;
  }
  function renderCalendar() {
    var el = $('[data-view="calendar"]');
    if (!cal.sel) { cal.sel = S.today; cal.month = monthOf(S.today); }
    var byDay = calItems();
    var m = cal.month;
    var first = dateObj(m);
    var offset = (first.getUTCDay() + 6) % 7;
    var dim = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    var rows = Math.ceil((offset + dim) / 7);
    var startDay = addDays(m, -offset);
    var title = cap(new Intl.DateTimeFormat('hu-HU', { month: 'long', timeZone: 'UTC' }).format(first));

    var grid = '';
    for (var r = 0; r < rows; r++) {
      grid += '<div class="acal__week">';
      for (var c = 0; c < 7; c++) {
        var d = addDays(startDay, r * 7 + c);
        var its = byDay[d] || [];
        var dots = its.slice(0, 3).map(function (it) {
          return '<i class="dot dot--' + (it.kind === 'k' ? 'block' : it.b.status) + '"></i>';
        }).join('');
        var cls = 'acal__day' + (d.slice(0, 7) !== m.slice(0, 7) ? ' is-out' : '') + (d === S.today ? ' is-today' : '') + (d === cal.sel ? ' is-sel' : '') + (c >= 5 ? ' is-weekend' : '');
        grid += '<button type="button" class="' + cls + '" data-cal-day="' + d + '" aria-label="' + esc(fmtDay(d)) + (its.length ? ', ' + its.length + ' bejegyzés' : '') + '" aria-pressed="' + (d === cal.sel) + '">' +
          '<span class="acal__n">' + dateObj(d).getUTCDate() + '</span><span class="acal__dots">' + dots + '</span></button>';
      }
      grid += '</div>';
    }

    // ----- day timeline -----
    var sel = cal.sel;
    var items = byDay[sel] || [];
    var allDay = items.filter(function (it) { return it.kind === 'k' && (it.k.allDay || !it.k.from); });
    var evs = items.filter(function (it) { return !(it.kind === 'k' && (it.k.allDay || !it.k.from)); }).map(function (it) {
      if (it.kind === 'k') return { it: it, s: toMin(it.k.from), e: toMin(it.k.to) };
      return { it: it, s: toMin(it.b.time), e: toMin(it.b.time) + it.b.minutes };
    });
    var hours = S.settings.hours[dateObj(sel).getUTCDay()];
    if (allDay.length) hours = null; // closed all day (holiday, training…)
    var h0 = Math.min(hours ? Math.floor(toMin(hours[0]) / 60) : 8, 8);
    var h1 = Math.max(hours ? Math.ceil(toMin(hours[1]) / 60) + 2 : 19, 19);
    evs.forEach(function (ev) { h0 = Math.min(h0, Math.floor(ev.s / 60)); h1 = Math.max(h1, Math.ceil(ev.e / 60)); });
    h1 = Math.min(24, h1);
    lanes(evs);
    var y = function (min) { return (min - h0 * 60) / 60 * HOUR; };
    var tl = '';
    for (var h = h0; h <= h1; h++) {
      tl += '<div class="tl__hour" style="top:' + y(h * 60) + 'px"><span>' + h + ':00</span></div>';
    }
    if (hours) {
      tl += '<div class="tl__closed" style="top:0;height:' + Math.max(0, y(toMin(hours[0]))) + 'px"></div>' +
        '<div class="tl__closed" style="top:' + y(toMin(hours[1])) + 'px;bottom:0" title="Zárás után (kezelés még tarthat)"></div>';
    } else {
      tl += '<div class="tl__closed" style="top:0;bottom:0"></div>';
    }
    evs.forEach(function (ev) {
      var top = y(ev.s), ht = Math.max(22, y(ev.e) - y(ev.s) - 2);
      var left = 'calc(' + (ev.col / ev.cols * 100) + '% + 2px)', width = 'calc(' + (100 / ev.cols) + '% - 4px)';
      var style = 'top:' + top + 'px;height:' + ht + 'px;left:' + left + ';width:' + width;
      if (ev.it.kind === 'k') {
        var k = ev.it.k;
        tl += '<button type="button" class="ev ev--block" style="' + style + '" data-cal-block="' + esc(k.id) + '"><b>Zárva</b> ' + esc(k.from) + '–' + esc(k.to) + (k.note ? ' · ' + esc(k.note) : '') + '</button>';
        return;
      }
      var b = ev.it.b, past = isPast(b);
      var short = ht < 44;
      tl += '<button type="button" class="ev ev--' + b.status + (past ? ' is-past' : '') + (short ? ' is-short' : '') + '" style="' + style + '" data-cal-ev="' + esc(b.id) + '">' +
        (b.status === 'pending' ? '<em>Új kérés</em>' : '') +
        '<b>' + esc(b.service && b.service.hu || 'Kezelés') + '</b>' +
        '<span>' + esc(b.time) + '–' + esc(endOf(b)) + ' · ' + esc(b.name) + '</span></button>';
    });
    if (sel === S.today && S.nowMin >= h0 * 60 && S.nowMin <= h1 * 60) {
      tl += '<div class="tl__now" style="top:' + y(S.nowMin) + 'px"><span>' + fromMin(S.nowMin) + '</span></div>';
    }
    var guests = items.filter(function (it) { return it.kind === 'b'; }).length;
    var dayTitle = cap(new Intl.DateTimeFormat('hu-HU', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(dateObj(sel)));
    var rel = relDay(sel);

    el.innerHTML = '<div class="acal">' +
      '<div class="acal__head"><h2 class="acal__title">' + esc(title) + ' <span>' + first.getUTCFullYear() + '</span></h2>' +
        '<div class="acal__nav"><button type="button" class="acal__today" data-cal-today>Ma</button>' +
        '<button type="button" class="acal__arrow" data-cal-month="-1" aria-label="Előző hónap"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>' +
        '<button type="button" class="acal__arrow" data-cal-month="1" aria-label="Következő hónap"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div></div>' +
      '<div class="acal__wd">' + ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map(function (w, i) { return '<span' + (i >= 5 ? ' class="is-weekend"' : '') + '>' + w + '</span>'; }).join('') + '</div>' +
      '<div class="acal__grid" data-cal-grid>' + grid + '</div>' +
      '<div class="acal__dayhead"><strong>' + esc(dayTitle) + '</strong><span>' + (rel ? esc(rel) + ' · ' : '') + (hours ? 'nyitva ' + hours[0] + '–' + hours[1] : 'zárva') + (guests ? ' · ' + guests + ' vendég' : '') + '</span></div>' +
      (allDay.length ? '<div class="acal__allday">' + allDay.map(function (it) {
        return '<button type="button" class="ev ev--block ev--allday" data-cal-block="' + esc(it.k.id) + '"><b>Zárva egész nap</b>' + (it.k.note ? ' · ' + esc(it.k.note) : '') + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="tl" data-tl style="height:' + (y(h1 * 60) + 12) + 'px" data-h0="' + h0 + '"><div class="tl__lane">' + tl + '</div></div>' +
      '</div>';

    // swipe the month grid left/right
    var g = $('[data-cal-grid]', el), sx = null, sy = null;
    g.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    g.addEventListener('touchend', function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) calMove(dx < 0 ? 1 : -1);
    });
  }
  function calMove(n) {
    cal.month = addMonthsTo(cal.month, n);
    cal.sel = cal.month.slice(0, 7) === S.today.slice(0, 7) ? S.today : cal.month;
    renderCalendar();
  }
  // event details as a sheet with the usual actions
  var evDlg = $('[data-event]');
  function openEvent(html) {
    $('[data-event-body]').innerHTML = html;
    evDlg.showModal();
    $('[data-event-close]').focus();
  }
  document.addEventListener('click', function (e) {
    if (tab !== 'calendar' || !S) return;
    var t;
    if ((t = e.target.closest('[data-cal-day]'))) { cal.sel = t.getAttribute('data-cal-day'); if (monthOf(cal.sel) !== cal.month) cal.month = monthOf(cal.sel); renderCalendar(); return; }
    if ((t = e.target.closest('[data-cal-month]'))) { calMove(+t.getAttribute('data-cal-month')); return; }
    if (e.target.closest('[data-cal-today]')) { cal.sel = S.today; cal.month = monthOf(S.today); renderCalendar(); return; }
    if ((t = e.target.closest('[data-cal-ev]'))) { var b = find(t.getAttribute('data-cal-ev')); if (b) openEvent(card(b)); return; }
    if ((t = e.target.closest('[data-cal-block]'))) {
      var id = t.getAttribute('data-cal-block');
      var k = S.blocks.filter(function (x) { return x.id === id; })[0];
      if (k) openEvent(blockCard(k));
      return;
    }
    var lane = e.target.closest('.tl__lane');
    if (lane && e.target === lane || e.target.classList && (e.target.classList.contains('tl__hour') || e.target.classList.contains('tl__closed'))) {
      // tap on an empty spot → new booking at that time
      var tlEl = $('[data-tl]');
      var rect = tlEl.getBoundingClientRect();
      var min = parseInt(tlEl.getAttribute('data-h0'), 10) * 60 + Math.floor((e.clientY - rect.top) / HOUR * 2) * 30;
      newBooking(cal.sel, fromMin(Math.max(0, Math.min(23 * 60 + 30, min))));
    }
  });
  evDlg.addEventListener('click', function (e) {
    if (e.target === evDlg || e.target.closest('[data-event-close]')) { evDlg.close(); return; }
    if (e.target.closest('[data-act]')) setTimeout(function () { if (evDlg.open) evDlg.close(); }, 0);
  });

  function renderPast() {
    var el = $('[data-view="past"]');
    var items = S.bookings.filter(function (b) { return isPast(b) || b.status === 'declined' || b.status === 'cancelled'; })
      .sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
    if (!items.length) { el.innerHTML = '<div class="empty"><b>Még nincs korábbi foglalás</b>Az elmúlt, elutasított és lemondott időpontok itt lesznek. Egy év után automatikusan törlődnek.</div>'; return; }
    el.innerHTML = '<p style="color:var(--soft)">Az adatok egy év után automatikusan törlődnek.</p>' + items.map(card).join('');
  }

  /* ---------------- dialog ---------------- */
  var dlg = $('[data-dialog]');
  var dlgSubmit = null;
  function openDialog(title, bodyHtml, okLabel, onSubmit, okClass) {
    $('[data-dialog-title]').textContent = title;
    $('[data-dialog-body]').innerHTML = bodyHtml;
    var ok = $('[data-dialog-ok]');
    ok.textContent = okLabel || 'Rendben';
    ok.className = 'btn' + (okClass ? ' ' + okClass : '');
    ok.disabled = false;
    $('[data-dialog-error]').hidden = true;
    dlgSubmit = onSubmit;
    dlg.showModal();
    var first = $('[data-dialog-body] input:not([type=checkbox]), [data-dialog-body] textarea');
    if (first && window.matchMedia('(min-width: 700px)').matches) first.focus();
    else $('[data-dialog-title]').focus(); // phones: no keyboard popping up straight away
  }
  function dialogError(msg) { var e = $('[data-dialog-error]'); e.textContent = msg; e.hidden = false; }
  $('[data-dialog-cancel]').addEventListener('click', function () { dlg.close(); });
  $('[data-dialog-form]').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!dlgSubmit) return dlg.close();
    var ok = $('[data-dialog-ok]');
    ok.disabled = true;
    Promise.resolve(dlgSubmit(new FormData(ev.target))).then(function (keepOpen) {
      ok.disabled = false;
      if (!keepOpen) dlg.close();
    }).catch(function (e) { ok.disabled = false; dialogError(e.message); });
  });

  function find(id) { return S.bookings.filter(function (b) { return b.id === id; })[0]; }
  function summary(b) { return '<div class="summary"><strong>' + esc(b.name) + '</strong><br>' + esc(fmtDay(b.date)) + ', ' + esc(b.time) + '–' + esc(endOf(b)) + '<br>' + esc(b.service && b.service.hu || '') + '</div>'; }
  function afterMail(res, okText) {
    if (res.mail && !res.mail.ok) toast('Mentve, de az e-mail nem ment el: ' + res.mail.error, true);
    else toast(okText + (res.mail && res.mail.ok ? ' E-mail elküldve.' : ''));
    return load();
  }

  function act(id, kind) {
    var b = find(id);
    if (!b) return;
    var mailBox = b.email ? '<label class="check"><input type="checkbox" name="send" checked><span>E-mail küldése a vendégnek (' + esc(b.email) + ')</span></label>' : '<p style="color:var(--moss)">A vendégnek nincs e-mail címe, ezért e-mailt nem kap.</p>';
    if (kind === 'confirm') {
      openDialog('Időpont elfogadása', summary(b) + mailBox +
        '<p style="color:var(--soft);font-size:.93rem">A visszaigazoló e-mail tartalmazza az időpontot, a címet és egy naptárfájlt.</p>', '✓ Elfogadom', function (fd) {
        return api('/api/admin/bookings/' + id + '/confirm', { method: 'POST', body: { sendEmail: !!fd.get('send') } })
          .then(function (r) { return afterMail(r, 'Elfogadva.'); })
          .catch(function (e) {
            if (e.status === 409 && confirm(e.message + '\n\nMégis elfogadod?')) {
              return api('/api/admin/bookings/' + id + '/confirm', { method: 'POST', body: { sendEmail: !!fd.get('send'), force: true } }).then(function (r) { return afterMail(r, 'Elfogadva.'); });
            }
            throw e;
          });
      });
    } else if (kind === 'decline' || kind === 'cancel') {
      var isDecline = kind === 'decline';
      openDialog(isDecline ? 'Kérés elutasítása' : 'Időpont lemondása', summary(b) +
        '<label class="field"><span>Üzenet a vendégnek (nem kötelező)</span><textarea name="message" maxlength="1000" placeholder="Pl. Aznap sajnos nem tudok, de csütörtökön 10-kor szívesen várlak."></textarea>' +
        '<small>Ez bekerül az e-mailbe. A levél automatikusan felajánlja, hogy válasszon másik időpontot.</small></label>' + mailBox,
        isDecline ? 'Elutasítom' : 'Lemondom', function (fd) {
          return api('/api/admin/bookings/' + id + '/' + kind, { method: 'POST', body: { message: fd.get('message') || '', sendEmail: !!fd.get('send') } })
            .then(function (r) { return afterMail(r, isDecline ? 'Elutasítva.' : 'Lemondva.'); });
        }, 'btn--bad');
    } else if (kind === 'delete') {
      openDialog('Foglalás törlése', summary(b) + '<p>Véglegesen törlöd ezt a bejegyzést? A vendég nem kap értesítést.</p>', 'Törlés', function () {
        return api('/api/admin/bookings/' + id, { method: 'DELETE' }).then(function () { toast('Törölve.'); return load(); });
      }, 'btn--bad');
    } else if (kind === 'resend') {
      api('/api/admin/bookings/' + id + '/resend', { method: 'POST', body: {} }).then(function (r) { return afterMail(r, 'Újraküldve.'); }).catch(function (e) { toast(e.message, true); });
    } else if (kind === 'move') {
      moveDialog(b);
    }
  }

  /* time picker used by "move" and "new booking" */
  function timePicker(container, getDate, getMinutes, exclude, selected) {
    var date = getDate();
    var box = $('[data-times]', container);
    var input = $('input[name=time]', container);
    if (!date) { box.innerHTML = '<span class="times-empty">Előbb válassz napot.</span>'; return; }
    box.innerHTML = '<span class="times-empty">Betöltés…</span>';
    api('/api/admin/slots?date=' + date + '&minutes=' + getMinutes() + (exclude ? '&exclude=' + exclude : '')).then(function (d) {
      var hours = S.settings.hours[dateObj(date).getUTCDay()];
      if (!d.times.length) {
        box.innerHTML = '<span class="times-empty">' + (hours ? 'Ezen a napon nincs szabad hely ekkora időre.' : 'Ezen a napon zárva vagy.') + ' Pontos időt alább kézzel is megadhatsz.</span>';
        return;
      }
      box.innerHTML = d.times.map(function (t) { return '<button type="button" data-t="' + t + '" aria-pressed="' + (t === input.value) + '">' + t + '</button>'; }).join('');
      $$('button', box).forEach(function (btn) {
        btn.addEventListener('click', function () {
          input.value = btn.getAttribute('data-t');
          $$('button', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
        });
      });
    });
  }

  function durSelect(name, val) {
    return '<select name="' + name + '">' + DUR.map(function (m) { return '<option value="' + m + '"' + (m === val ? ' selected' : '') + '>' + m + ' perc</option>'; }).join('') + '</select>';
  }

  function moveDialog(b) {
    openDialog('Áthelyezés', summary(b) +
      '<div class="row2"><label class="field"><span>Nap</span><input type="date" name="date" value="' + esc(b.date) + '" min="' + S.today + '" required></label>' +
      '<label class="field"><span>Időtartam</span>' + durSelect('minutes', DUR.indexOf(b.minutes) >= 0 ? b.minutes : 60) + '</label></div>' +
      '<div class="field"><span>Szabad kezdési időpontok</span><div class="times" data-times></div></div>' +
      '<label class="field"><span>Kezdés (kézzel is megadható)</span><input type="time" name="time" value="' + esc(b.time) + '" step="300" required></label>' +
      (b.status === 'confirmed' && b.email ? '<label class="check"><input type="checkbox" name="send" checked><span>Új visszaigazoló e-mail küldése az új időponttal</span></label>' : ''),
      'Mentés', function (fd) {
        var body = { date: fd.get('date'), time: fd.get('time'), minutes: +fd.get('minutes') };
        var go = function (force) {
          return api('/api/admin/bookings/' + b.id, { method: 'PUT', body: Object.assign({ force: force }, body) }).then(function () {
            if (fd.get('send')) return api('/api/admin/bookings/' + b.id + '/resend', { method: 'POST', body: {} }).then(function (r) { return afterMail(r, 'Áthelyezve.'); });
            toast('Áthelyezve.'); return load();
          });
        };
        return go(false).catch(function (e) { if (e.status === 409 && confirm(e.message + '\n\nMégis mented?')) return go(true); throw e; });
      });
    var body = $('[data-dialog-body]');
    var refresh = function () { timePicker(body, function () { return $('input[name=date]', body).value; }, function () { return $('select[name=minutes]', body).value; }, b.id); };
    $('input[name=date]', body).addEventListener('change', refresh);
    $('select[name=minutes]', body).addEventListener('change', refresh);
    refresh();
  }

  function newBooking(presetDate, presetTime) {
    openDialog('Új foglalás (pl. telefonon egyeztetve)',
      '<label class="field"><span>Vendég neve *</span><input name="name" required autocomplete="off"></label>' +
      '<div class="row2"><label class="field"><span>Telefon</span><input name="phone" type="tel" autocomplete="off"></label>' +
      '<label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="off"></label></div>' +
      '<label class="field"><span>Kezelés</span><input name="serviceHu" placeholder="Pl. Alap kiskezelés – arc"></label>' +
      '<div class="row2"><label class="field"><span>Nap *</span><input type="date" name="date" value="' + (presetDate || S.today) + '" required></label>' +
      '<label class="field"><span>Időtartam</span>' + durSelect('minutes', 60) + '</label></div>' +
      '<div class="field"><span>Szabad kezdési időpontok</span><div class="times" data-times></div></div>' +
      '<label class="field"><span>Kezdés *</span><input type="time" name="time" step="300" required value="' + (presetTime || '') + '"></label>' +
      '<label class="field"><span>Megjegyzés</span><textarea name="note"></textarea></label>' +
      '<label class="check"><input type="checkbox" name="send"><span>Visszaigazoló e-mail küldése (ha van e-mail cím)</span></label>',
      'Foglalás mentése', function (fd) {
        var body = { name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'), serviceHu: fd.get('serviceHu'), date: fd.get('date'), time: fd.get('time'), minutes: +fd.get('minutes'), note: fd.get('note'), sendEmail: !!fd.get('send') };
        if (!body.name || body.name.trim().length < 2) return Promise.reject(new Error('Add meg a vendég nevét.'));
        if (!body.time) return Promise.reject(new Error('Válassz kezdési időpontot.'));
        var go = function (force) { return api('/api/admin/bookings', { method: 'POST', body: Object.assign({ force: force }, body) }).then(function (r) { tab = 'calendar'; return afterMail(r, 'Foglalás mentve.'); }); };
        return go(false).catch(function (e) { if (e.status === 409 && confirm(e.message + '\n\nMégis mented?')) return go(true); throw e; });
      });
    var body = $('[data-dialog-body]');
    var refresh = function () { timePicker(body, function () { return $('input[name=date]', body).value; }, function () { return $('select[name=minutes]', body).value; }); };
    $('input[name=date]', body).addEventListener('change', refresh);
    $('select[name=minutes]', body).addEventListener('change', refresh);
    refresh();
  }

  function newBlock(presetDate) {
    openDialog('Zárás / szabadság',
      '<p style="color:var(--soft);font-size:.93rem">Ezekre a napokra (vagy órákra) a weboldalon nem lehet foglalni. A meglévő foglalások megmaradnak.</p>' +
      '<div class="row2"><label class="field"><span>Első nap *</span><input type="date" name="date" value="' + (presetDate || S.today) + '" required></label>' +
      '<label class="field"><span>Utolsó nap</span><input type="date" name="dateTo" value="' + (presetDate || S.today) + '"></label></div>' +
      '<label class="check"><input type="checkbox" name="allDay" checked data-allday><span>Egész nap</span></label>' +
      '<div class="row2" data-hours-only hidden><label class="field"><span>Ettől</span><input type="time" name="from" value="12:00" step="900"></label>' +
      '<label class="field"><span>Eddig</span><input type="time" name="to" value="14:00" step="900"></label></div>' +
      '<label class="field"><span>Megjegyzés (csak te látod)</span><input name="note" placeholder="Pl. Szabadság, továbbképzés"></label>',
      'Zárás mentése', function (fd) {
        var to = fd.get('dateTo') || fd.get('date');
        return api('/api/admin/blocks', { method: 'POST', body: { date: fd.get('date'), dateTo: to < fd.get('date') ? fd.get('date') : to, allDay: !!fd.get('allDay'), from: fd.get('from'), to: fd.get('to'), note: fd.get('note') } })
          .then(function () { toast('Zárás mentve.'); tab = 'calendar'; return load(); });
      });
    var body = $('[data-dialog-body]');
    $('[data-allday]', body).addEventListener('change', function (e) { $('[data-hours-only]', body).hidden = e.target.checked; });
    $('input[name=date]', body).addEventListener('change', function (e) { var t = $('input[name=dateTo]', body); if (!t.value || t.value < e.target.value) t.value = e.target.value; });
  }

  /* ---------------- remote access (own password, for a tunnel hostname) ---------------- */
  function remotePanel() {
    var r = S.settings.remote || {};
    if (S.remoteSession) {
      return '<div class="panel"><h3>Távoli elérés</h3><p>Ezen a címen jelszóval vagy belépve. A jelszót csak az Umbrelen keresztül lehet megváltoztatni.</p>' +
        '<button type="button" class="btn btn--line" data-logout>Kijelentkezés erről az eszközről</button></div>';
    }
    return '<div class="panel"><h3>Távoli elérés</h3>' +
      '<p>' + (r.enabled
        ? '<strong>Bekapcsolva</strong>' + (r.setAt ? ' (jelszó beállítva: ' + esc(fmtStamp(r.setAt)) + ')' : '') + '. Az app saját jelszóval elérhető a 4754-es porton, pl. egy Cloudflare-címen (kezelo.esszenciakozmetika.hu).'
        : 'Ha az appot Umbrel nélkül, egy saját címen is el szeretnéd érni (pl. kezelo.esszenciakozmetika.hu), adj meg egy jelszót. A Cloudflare-útvonal a 4754-es portra mutasson.') + '</p>' +
      '<form data-remote novalidate>' +
      '<input type="text" name="username" value="esszencia" autocomplete="username" hidden>' +
      '<label class="field"><span>' + (r.enabled ? 'Új jelszó' : 'Jelszó') + '</span><input name="pw1" type="password" autocomplete="new-password" minlength="10"><small>Legalább 10 karakter. Egy hosszabb mondat is jó, pl. „csipkebogyó tea reggel 7-kor”.</small></label>' +
      '<label class="field"><span>Jelszó még egyszer</span><input name="pw2" type="password" autocomplete="new-password"></label>' +
      '<button type="submit" class="btn">' + (r.enabled ? 'Jelszó cseréje' : 'Bekapcsolás') + '</button>' +
      (r.enabled ? '<div class="card__actions"><button type="button" class="btn btn--line btn--small" data-remote-logoutall>Kijelentkeztetés minden eszközről</button><button type="button" class="btn btn--bad btn--small" data-remote-off>Kikapcsolás</button></div>' : '') +
      '</form></div>';
  }
  function bindRemotePanel(el) {
    var lo = $('[data-logout]', el);
    if (lo) lo.addEventListener('click', function () {
      api('/api/logout', { method: 'POST', body: {} }).then(function () { location.href = '/login'; }).catch(function (e) { toast(e.message, true); });
    });
    var f = $('[data-remote]', el);
    if (!f) return;
    function post(body, okText) {
      return api('/api/admin/remote', { method: 'POST', body: body }).then(function (r) {
        S.settings = r.settings; toast(okText); renderSettings();
      }).catch(function (e) { toast(e.message, true); });
    }
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (f.pw1.value.length < 10) return toast('A jelszó legyen legalább 10 karakter.', true);
      if (f.pw1.value !== f.pw2.value) return toast('A két jelszó nem egyezik.', true);
      post({ password: f.pw1.value }, 'Jelszó elmentve. A többi eszközön újra be kell lépni.');
    });
    var all = $('[data-remote-logoutall]', el);
    if (all) all.addEventListener('click', function () { post({ logoutAll: true }, 'Minden eszköz kijelentkeztetve.'); });
    var off = $('[data-remote-off]', el);
    if (off) off.addEventListener('click', function () {
      if (confirm('Kikapcsolod a távoli elérést? Utána csak az Umbrelen keresztül lehet belépni.')) post({ disable: true }, 'Távoli elérés kikapcsolva.');
    });
  }

  /* ---------------- settings ---------------- */
  function renderSettings() {
    var s = S.settings;
    var order = [1, 2, 3, 4, 5, 6, 0];
    var el = $('[data-view="settings"]');
    el.innerHTML = remotePanel() + '<form data-settings novalidate>' +
      '<div class="panel"><h3>E-mail küldés (Gmail)</h3>' +
      '<p>Erről a címről mennek a visszaigazolások a vendégeknek, és ide érkeznek az új kérések.</p>' +
      '<label class="field"><span>Gmail cím</span><input name="user" type="email" value="' + esc(s.smtp.user) + '" autocomplete="off"></label>' +
      '<label class="field"><span>Google alkalmazásjelszó</span><input name="pass" type="password" autocomplete="new-password" placeholder="' + (s.smtp.hasPass ? '•••• •••• •••• •••• (elmentve)' : '16 karakter, pl. abcd efgh ijkl mnop') + '">' +
      '<small>' + (s.smtp.hasPass ? 'Csak akkor írd be, ha cserélni szeretnéd.' : 'Ez nem a Gmail jelszavad – egy külön, erre a célra készített jelszó.') + '</small></label>' +
      '<details class="help"><summary>Hogyan kapok alkalmazásjelszót?</summary><ol>' +
      '<li>Jelentkezz be a Gmail fiókba a böngészőben, és nyisd meg: <b>myaccount.google.com/security</b></li>' +
      '<li>Kapcsold be a <b>Kétlépcsős azonosítást</b> (ha még nincs bekapcsolva).</li>' +
      '<li>Nyisd meg: <b>myaccount.google.com/apppasswords</b></li>' +
      '<li>Név: <b>Esszencia</b> → <b>Létrehozás</b>. A megjelenő 16 betűs kódot másold ide, és mentsd el.</li></ol></details>' +
      '<label class="field"><span>Feladó neve</span><input name="fromName" value="' + esc(s.smtp.fromName) + '"></label>' +
      '<label class="field"><span>Új kérések értesítése erre a címre</span><input name="notifyEmail" type="email" value="' + esc(s.notifyEmail) + '"></label>' +
      '<button type="button" class="btn btn--line" data-test-mail>Teszt e-mail küldése</button></div>' +

      '<div class="panel"><h3>Nyitvatartás</h3><p>Ezekben az időkben lehet kezdeni a kezelést. A zárás az utolsó kezdési időpont – a kezelés tovább is tarthat (pl. 18:00-kor kezdődő 2 órás kezelés).</p>' +
      order.map(function (d) {
        var h = s.hours[d];
        return '<div class="hours-row" data-day="' + d + '"><strong>' + DAYS[d].charAt(0).toUpperCase() + DAYS[d].slice(1) + '</strong>' +
          '<input type="checkbox" aria-label="Nyitva" ' + (h ? 'checked' : '') + ' data-open>' +
          '<input type="time" step="900" value="' + (h ? h[0] : '09:00') + '" data-from aria-label="Nyitás"' + (h ? '' : ' hidden') + '>' +
          '<input type="time" step="900" value="' + (h ? h[1] : '18:00') + '" data-to aria-label="Zárás"' + (h ? '' : ' hidden') + '>' +
          '<span class="closed"' + (h ? ' hidden' : '') + '>Zárva</span></div>';
      }).join('') + '</div>' +

      '<div class="panel"><h3>Foglalási szabályok</h3>' +
      '<div class="row2"><label class="field"><span>Legkorábban ennyi órával előre</span><input name="minNoticeHours" type="number" min="0" max="168" value="' + s.minNoticeHours + '"></label>' +
      '<label class="field"><span>Legfeljebb ennyi nappal előre</span><input name="horizonDays" type="number" min="7" max="365" value="' + s.horizonDays + '"></label></div>' +
      '<div class="row2"><label class="field"><span>Kezdési időpontok lépése</span><select name="stepMinutes">' + [15, 30, 60].map(function (m) { return '<option value="' + m + '"' + (m === s.stepMinutes ? ' selected' : '') + '>' + m + ' perc</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Szünet két vendég között</span><select name="bufferMinutes">' + [0, 10, 15, 20, 30].map(function (m) { return '<option value="' + m + '"' + (m === s.bufferMinutes ? ' selected' : '') + '>' + (m ? m + ' perc' : 'nincs') + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="field"><span>Adatvédelem: naponta felajánlott időpontok (délelőtt és délután külön)</span><select name="offerPerHalfDay">' + [2, 3, 4, 5, 6, 10, 20].map(function (m) { return '<option value="' + m + '"' + (m === s.offerPerHalfDay ? ' selected' : '') + '>legfeljebb ' + m + ' + ' + m + '</option>'; }).join('') + '</select>' +
      '<small>A weboldal sosem mutatja a teljes beosztásodat: a szabad időpontokból csak néhányat ajánl fel, titkos sorrendben, ami hetente változik. A teljesen foglalt nap úgy néz ki, mint egy zárt nap.</small></label></div>' +

      '<div class="panel"><h3>Linkek</h3>' +
      '<label class="field"><span>Ennek az alkalmazásnak a címe (a gombhoz az értesítő e-mailben)</span><input name="adminUrl" value="' + esc(s.adminUrl) + '"></label>' +
      '<label class="field"><span>A weboldal címe</span><input name="siteUrl" value="' + esc(s.siteUrl) + '"></label></div>' +

      '<div class="save-bar"><button type="submit" class="btn">Beállítások mentése</button></div></form>';

    bindRemotePanel(el);
    $$('.hours-row', el).forEach(function (row) {
      $('[data-open]', row).addEventListener('change', function (e) {
        var on = e.target.checked;
        $('[data-from]', row).hidden = !on; $('[data-to]', row).hidden = !on; $('.closed', row).hidden = on;
      });
    });
    $('[data-test-mail]', el).addEventListener('click', function (e) {
      var b = e.target; b.disabled = true; b.textContent = 'Küldés…';
      api('/api/admin/test-email', { method: 'POST', body: {} })
        .then(function (r) { toast('Teszt e-mail elküldve ide: ' + r.to); })
        .catch(function (err) { toast(err.message, true); })
        .then(function () { b.disabled = false; b.textContent = 'Teszt e-mail küldése'; });
    });
    $('[data-settings]', el).addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var hours = {};
      $$('.hours-row', f).forEach(function (row) {
        var d = row.getAttribute('data-day');
        hours[d] = $('[data-open]', row).checked ? [$('[data-from]', row).value, $('[data-to]', row).value] : null;
      });
      var body = {
        hours: hours,
        minNoticeHours: f.minNoticeHours.value, horizonDays: f.horizonDays.value,
        stepMinutes: f.stepMinutes.value, bufferMinutes: f.bufferMinutes.value, offerPerHalfDay: f.offerPerHalfDay.value,
        notifyEmail: f.notifyEmail.value, adminUrl: f.adminUrl.value, siteUrl: f.siteUrl.value,
        smtp: { user: f.user.value, fromName: f.fromName.value }
      };
      if (f.pass.value.trim()) body.smtp.pass = f.pass.value;
      var btn = $('button[type=submit]', f); btn.disabled = true;
      api('/api/admin/settings', { method: 'PUT', body: body }).then(function (r) {
        S.settings = r.settings; S.mailConfigured = r.mailConfigured;
        toast('Beállítások elmentve.');
        renderSettings(); render();
      }).catch(function (e) { toast(e.message, true); }).then(function () { btn.disabled = false; });
    });
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]');
    if (t) { tab = t.getAttribute('data-tab'); if (tab === 'settings') { var v = $('[data-view="settings"]'); v.innerHTML = ''; } render(); window.scrollTo(0, 0); return; }
    var g = e.target.closest('[data-goto]');
    if (g) { tab = g.getAttribute('data-goto'); $('[data-view="settings"]').innerHTML = ''; render(); return; }
    var a = e.target.closest('[data-act]');
    if (a) {
      var kind = a.getAttribute('data-act');
      if (kind === 'unblock') {
        var id = a.closest('[data-block]').getAttribute('data-block');
        if (confirm('Törlöd ezt a zárást? Utána újra lehet foglalni ezekre az időkre.')) api('/api/admin/blocks/' + id, { method: 'DELETE' }).then(function () { toast('Zárás törölve.'); load(); }).catch(function (err) { toast(err.message, true); });
        return;
      }
      act(a.closest('[data-id]').getAttribute('data-id'), kind);
      return;
    }
    var preset = tab === 'calendar' && cal.sel && cal.sel >= S.today ? cal.sel : null;
    if (e.target.closest('[data-new-booking]')) return newBooking(preset);
    if (e.target.closest('[data-new-block]')) return newBlock(preset);
    if (e.target.closest('[data-refresh]')) { if (window.EsszDash && window.EsszDash.active()) return window.EsszDash.reload(true); return load(true); }
  });

  load();
  setInterval(function () { if (!document.hidden && !dlg.open && tab !== 'settings' && !(window.EsszDash && window.EsszDash.active())) load(); }, 30000);
  window.EsszAdmin = { api: api, esc: esc, toast: toast, render: render, load: load };
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
})();
