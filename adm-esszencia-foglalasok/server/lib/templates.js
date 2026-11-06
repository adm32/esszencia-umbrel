'use strict';
/* E-mail texts: customer e-mails in HU/EN/DE/SV, admin notification in HU. */

const SALON = {
  name: 'Esszencia Szépségműhely · Beauty & Relax',
  owner: 'Oroszné Puska Marianna',
  address: '8788 Sénye, Haladás u. 2.',
  phone: '+36 70 622 1208',
  tz: 'Europe/Budapest'
};

const LOCALE = { hu: 'hu-HU', en: 'en-GB', de: 'de-DE', sv: 'sv-SE' };

const T = {
  hu: {
    greet: 'Kedves {name}!',
    confirm_subject: 'Időpontod visszaigazolva – {date}, {time}',
    confirm_intro: 'Örömmel visszaigazolom az időpontodat:',
    confirm_outro: 'Ha mégsem tudsz jönni, kérlek, jelezd minél előbb telefonon.',
    confirm_sign: 'Szeretettel várlak,',
    decline_subject: 'Időpontkérésed – {date}, {time}',
    decline_intro: 'Köszönöm, hogy időpontot kértél! Sajnos a kért időpont nem megfelelő:',
    decline_outro: 'Kérlek, válassz egy másik időpontot a weboldalon, vagy hívj bizalommal.',
    cancel_subject: 'Időpontod lemondva – {date}, {time}',
    cancel_intro: 'Sajnos az alábbi időpontodat le kell mondanom:',
    cancel_outro: 'Kérlek, válassz egy új időpontot a weboldalon, vagy hívj bizalommal. Elnézést kérek a kellemetlenségért.',
    sign: 'Üdvözlettel,',
    l_service: 'Kezelés', l_when: 'Időpont', l_dur: 'Időtartam', l_addr: 'Cím', l_phone: 'Telefon', l_msg: 'Üzenet',
    minutes: 'kb. {n} perc', web: 'Weboldal', ics: 'idopont.ics', cal_hint: 'A csatolt fájllal egy érintéssel felveheted a naptáradba.'
  },
  en: {
    greet: 'Dear {name},',
    confirm_subject: 'Your appointment is confirmed – {date}, {time}',
    confirm_intro: 'I’m happy to confirm your appointment:',
    confirm_outro: 'If you can’t make it, please let me know by phone as soon as possible.',
    confirm_sign: 'Looking forward to seeing you,',
    decline_subject: 'Your booking request – {date}, {time}',
    decline_intro: 'Thank you for your booking request. Unfortunately the requested time isn’t available:',
    decline_outro: 'Please choose another time on the website or give me a call.',
    cancel_subject: 'Your appointment is cancelled – {date}, {time}',
    cancel_intro: 'Unfortunately I have to cancel the following appointment:',
    cancel_outro: 'Please choose a new time on the website or give me a call. I’m sorry for the inconvenience.',
    sign: 'Kind regards,',
    l_service: 'Treatment', l_when: 'Date & time', l_dur: 'Duration', l_addr: 'Address', l_phone: 'Phone', l_msg: 'Message',
    minutes: 'approx. {n} min', web: 'Website', ics: 'appointment.ics', cal_hint: 'Open the attached file to add the appointment to your calendar.'
  },
  de: {
    greet: 'Hallo {name},',
    confirm_subject: 'Ihr Termin ist bestätigt – {date}, {time}',
    confirm_intro: 'Gerne bestätige ich Ihren Termin:',
    confirm_outro: 'Falls Sie nicht kommen können, geben Sie mir bitte so früh wie möglich telefonisch Bescheid.',
    confirm_sign: 'Ich freue mich auf Sie,',
    decline_subject: 'Ihre Terminanfrage – {date}, {time}',
    decline_intro: 'Vielen Dank für Ihre Terminanfrage. Leider ist der gewünschte Termin nicht verfügbar:',
    decline_outro: 'Bitte wählen Sie auf der Website einen anderen Termin oder rufen Sie mich an.',
    cancel_subject: 'Ihr Termin wurde abgesagt – {date}, {time}',
    cancel_intro: 'Leider muss ich den folgenden Termin absagen:',
    cancel_outro: 'Bitte wählen Sie auf der Website einen neuen Termin oder rufen Sie mich an. Entschuldigen Sie die Unannehmlichkeiten.',
    sign: 'Herzliche Grüße,',
    l_service: 'Behandlung', l_when: 'Termin', l_dur: 'Dauer', l_addr: 'Adresse', l_phone: 'Telefon', l_msg: 'Nachricht',
    minutes: 'ca. {n} Min.', web: 'Website', ics: 'termin.ics', cal_hint: 'Mit der angehängten Datei können Sie den Termin in Ihren Kalender übernehmen.'
  },
  sv: {
    greet: 'Hej {name}!',
    confirm_subject: 'Din tid är bekräftad – {date}, {time}',
    confirm_intro: 'Jag bekräftar gärna din tid:',
    confirm_outro: 'Om du inte kan komma, meddela mig gärna per telefon så snart som möjligt.',
    confirm_sign: 'Varmt välkommen,',
    decline_subject: 'Din bokningsförfrågan – {date}, {time}',
    decline_intro: 'Tack för din bokningsförfrågan. Tyvärr är den önskade tiden inte tillgänglig:',
    decline_outro: 'Välj gärna en annan tid på webbplatsen eller ring mig.',
    cancel_subject: 'Din tid är inställd – {date}, {time}',
    cancel_intro: 'Tyvärr måste jag ställa in följande tid:',
    cancel_outro: 'Välj gärna en ny tid på webbplatsen eller ring mig. Jag ber om ursäkt för besväret.',
    sign: 'Vänliga hälsningar,',
    l_service: 'Behandling', l_when: 'Tid', l_dur: 'Längd', l_addr: 'Adress', l_phone: 'Telefon', l_msg: 'Meddelande',
    minutes: 'ca {n} min', web: 'Webbplats', ics: 'bokning.ics', cal_hint: 'Öppna den bifogade filen för att lägga till tiden i din kalender.'
  }
};

const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ''));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function dateLong(date, lang) {
  const [y, m, d] = date.split('-').map(Number);
  const s = new Intl.DateTimeFormat(LOCALE[lang] || 'hu-HU', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    .format(new Date(Date.UTC(y, m - 1, d)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMin = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
const endTime = (b) => fromMin(toMin(b.time) + b.minutes);

/** Offset (minutes) of Europe/Budapest from UTC at a given instant. */
function tzOffset(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: SALON.tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms) / 60000;
}
/** Local Budapest wall-clock → UTC timestamp. */
function localToUtc(date, minutes) {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d) + minutes * 60000;
  let utc = guess - tzOffset(guess) * 60000;
  utc = guess - tzOffset(utc) * 60000;
  return utc;
}
const icsStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function icsFold(line) {
  const out = [];
  let cur = '';
  for (const ch of Array.from(line)) {
    if (Buffer.byteLength(cur + ch, 'utf8') > 73) { out.push(cur); cur = ' '; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
}
function ics(b, serviceName) {
  const start = localToUtc(b.date, toMin(b.time));
  const end = start + b.minutes * 60000;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Esszencia Szepsegmuhely//Foglalas//HU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + b.id + '@esszencia',
    'DTSTAMP:' + icsStamp(Date.now()),
    'DTSTART:' + icsStamp(start),
    'DTEND:' + icsStamp(end),
    'SUMMARY:' + icsEsc('Esszencia – ' + serviceName),
    'LOCATION:' + icsEsc('Esszencia Szépségműhely, ' + SALON.address),
    'DESCRIPTION:' + icsEsc(SALON.owner + ' · ' + SALON.phone),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc('Esszencia – ' + serviceName), 'TRIGGER:-PT2H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', ''
  ].map(icsFold).join('\r\n');
}

function htmlShell(inner) {
  return '<!doctype html><html><body style="margin:0;padding:0;background:#F0EDDD;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0EDDD;padding:24px 12px;"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F7F5EA;border:1px solid #D6DCCF;border-radius:8px;">' +
    '<tr><td style="padding:26px 28px 6px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#3F5C55;">' +
    '<div style="font-size:22px;letter-spacing:6px;">ESSZENCIA</div>' +
    '<div style="font-size:10px;letter-spacing:3px;color:#4D635C;margin-top:4px;">SZÉPSÉGMŰHELY · BEAUTY &amp; RELAX</div></td></tr>' +
    '<tr><td style="padding:18px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#22322E;">' + inner + '</td></tr>' +
    '</table>' +
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4D635C;margin-top:14px;">' + esc(SALON.address) + ' · ' + esc(SALON.phone) + '</div>' +
    '</td></tr></table></body></html>';
}
function rowsHtml(rows) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0 18px;border-top:1px solid #D6DCCF;">' +
    rows.map(([k, v]) => '<tr><td style="padding:9px 12px 9px 0;border-bottom:1px solid #D6DCCF;color:#4D635C;font-size:14px;white-space:nowrap;vertical-align:top;">' + esc(k) +
      '</td><td style="padding:9px 0;border-bottom:1px solid #D6DCCF;font-weight:bold;color:#2B423C;">' + esc(v).replace(/\n/g, '<br>') + '</td></tr>').join('') +
    '</table>';
}

/** kind: 'confirm' | 'decline' | 'cancel' */
function customerEmail(kind, b, opts) {
  const lang = T[b.lang] ? b.lang : 'hu';
  const t = T[lang];
  const service = (b.service && (b.service.local || b.service.hu)) || '';
  const date = dateLong(b.date, lang);
  const when = date + ', ' + b.time + '–' + endTime(b);
  const v = { name: b.name, date, time: b.time };
  const rows = [[t.l_service, service], [t.l_when, when]];
  if (kind === 'confirm') rows.push([t.l_dur, fill(t.minutes, { n: b.minutes })], [t.l_addr, SALON.address]);
  const message = (opts && opts.message || '').trim();
  const intro = t[kind + '_intro'];
  const outro = t[kind + '_outro'];
  const sign = kind === 'confirm' ? t.confirm_sign : t.sign;
  const site = (opts && opts.siteUrl) || '';

  const text = [
    fill(t.greet, v), '', intro, '',
    ...rows.map(([k, val]) => k + ': ' + val),
    ...(message ? ['', t.l_msg + ': ' + message] : []),
    '', outro,
    ...(kind === 'confirm' ? [t.cal_hint] : []),
    '', t.l_phone + ': ' + SALON.phone,
    ...(site && kind !== 'confirm' ? [t.web + ': ' + site] : []),
    '', sign, SALON.owner, SALON.name
  ].join('\n');

  const html = htmlShell(
    '<p style="margin:0 0 12px;">' + esc(fill(t.greet, v)) + '</p>' +
    '<p style="margin:0;">' + esc(intro) + '</p>' + rowsHtml(rows) +
    (message ? '<p style="margin:0 0 14px;padding:12px 14px;background:#E2E6DA;border-radius:6px;"><b>' + esc(t.l_msg) + ':</b> ' + esc(message).replace(/\n/g, '<br>') + '</p>' : '') +
    '<p style="margin:0 0 10px;">' + esc(outro) + '</p>' +
    (kind === 'confirm' ? '<p style="margin:0 0 10px;font-size:13px;color:#4D635C;">' + esc(t.cal_hint) + '</p>' : '') +
    '<p style="margin:0 0 18px;">' + esc(t.l_phone) + ': <a href="tel:+36706221208" style="color:#3F5C55;font-weight:bold;">' + esc(SALON.phone) + '</a>' +
    (site && kind !== 'confirm' ? '<br><a href="' + esc(site) + '" style="color:#3F5C55;">' + esc(site.replace(/^https?:\/\//, '')) + '</a>' : '') + '</p>' +
    '<p style="margin:0;">' + esc(sign) + '<br><b>' + esc(SALON.owner) + '</b><br><span style="color:#4D635C;font-size:14px;">' + esc(SALON.name) + '</span></p>'
  );

  const out = { subject: fill(t[kind + '_subject'], v), text, html, attachments: [] };
  if (kind === 'confirm') out.attachments.push({ filename: t.ics, contentType: 'text/calendar; charset=UTF-8; method=PUBLISH', content: ics(b, service) });
  return out;
}

const LANG_NAME = { hu: 'magyar', en: 'angol', de: 'német', sv: 'svéd' };

function adminNotification(b, adminUrl) {
  const date = dateLong(b.date, 'hu');
  const service = (b.service && b.service.hu) || '';
  const rows = [
    ['Kezelés', service + (b.service && b.service.category ? ' (' + b.service.category + ')' : '')],
    ['Időpont', date + ', ' + b.time + '–' + endTime(b) + ' (' + b.minutes + ' perc)'],
    ['Név', b.name], ['Telefon', b.phone], ['E-mail', b.email],
    ['Nyelv', LANG_NAME[b.lang] || b.lang]
  ];
  if (b.note) rows.push(['Megjegyzés', b.note]);
  const subject = 'Új időpontkérés: ' + b.name + ' – ' + b.date.replace(/-/g, '.') + '. ' + b.time;
  const text = ['Új időpontkérés érkezett a weboldalról:', '', ...rows.map(([k, v]) => k + ': ' + v), '',
    'Visszaigazolás vagy elutasítás az Esszencia Foglalások alkalmazásban:', adminUrl || ''].join('\n');
  const html = htmlShell(
    '<p style="margin:0;font-size:18px;color:#2B423C;"><b>Új időpontkérés érkezett</b></p>' + rowsHtml(rows) +
    (adminUrl ? '<p style="margin:0;text-align:center;"><a href="' + esc(adminUrl) + '" style="display:inline-block;padding:13px 24px;background:#3F5C55;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Megnyitás a Foglalások appban</a></p>' : '') +
    '<p style="margin:16px 0 0;font-size:13px;color:#4D635C;">Az ügyfél csak akkor kap e-mailt, amikor visszaigazolod vagy elutasítod a kérést. Erre a levélre válaszolva közvetlenül neki írsz.</p>'
  );
  return { subject, text, html };
}

function testEmail() {
  return {
    subject: 'Esszencia Foglalások – teszt e-mail',
    text: 'Ez egy teszt e-mail. Ha megkaptad, az e-mail küldés működik.',
    html: htmlShell('<p style="margin:0 0 10px;"><b>Teszt e-mail</b></p><p style="margin:0;">Ha megkaptad, az e-mail küldés működik. ✓</p>')
  };
}

module.exports = { customerEmail, adminNotification, testEmail, dateLong, localToUtc, SALON };
