package main

/* E-mail texts: customer e-mails in HU/EN/DE/SV, admin notification in HU. */

import (
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

var salon = struct{ Name, Owner, Address, Phone string }{
	Name:    "Esszencia Szépségműhely · Beauty & Relax",
	Owner:   "Oroszné Puska Marianna",
	Address: "8788 Sénye, Haladás u. 2.",
	Phone:   "+36 70 622 1208",
}

var T = map[string]map[string]string{
	"hu": {
		"greet":           "Kedves {name}!",
		"confirm_subject": "Időpontod visszaigazolva – {date}, {time}",
		"confirm_intro":   "Örömmel visszaigazolom az időpontodat:",
		"confirm_outro":   "Ha mégsem tudsz jönni, kérlek, jelezd minél előbb telefonon.",
		"confirm_sign":    "Szeretettel várlak,",
		"decline_subject": "Időpontkérésed – {date}, {time}",
		"decline_intro":   "Köszönöm, hogy időpontot kértél! Sajnos a kért időpont nem megfelelő:",
		"decline_outro":   "Kérlek, válassz egy másik időpontot a weboldalon, vagy hívj bizalommal.",
		"cancel_subject":  "Időpontod lemondva – {date}, {time}",
		"cancel_intro":    "Sajnos az alábbi időpontodat le kell mondanom:",
		"cancel_outro":    "Kérlek, válassz egy új időpontot a weboldalon, vagy hívj bizalommal. Elnézést kérek a kellemetlenségért.",
		"sign":            "Üdvözlettel,",
		"l_service":       "Kezelés", "l_when": "Időpont", "l_dur": "Időtartam", "l_addr": "Cím", "l_phone": "Telefon", "l_msg": "Üzenet",
		"minutes": "kb. {n} perc", "web": "Weboldal", "ics": "idopont.ics", "cal_hint": "A csatolt fájllal egy érintéssel felveheted a naptáradba.",
	},
	"en": {
		"greet":           "Dear {name},",
		"confirm_subject": "Your appointment is confirmed – {date}, {time}",
		"confirm_intro":   "I’m happy to confirm your appointment:",
		"confirm_outro":   "If you can’t make it, please let me know by phone as soon as possible.",
		"confirm_sign":    "Looking forward to seeing you,",
		"decline_subject": "Your booking request – {date}, {time}",
		"decline_intro":   "Thank you for your booking request. Unfortunately the requested time isn’t available:",
		"decline_outro":   "Please choose another time on the website or give me a call.",
		"cancel_subject":  "Your appointment is cancelled – {date}, {time}",
		"cancel_intro":    "Unfortunately I have to cancel the following appointment:",
		"cancel_outro":    "Please choose a new time on the website or give me a call. I’m sorry for the inconvenience.",
		"sign":            "Kind regards,",
		"l_service":       "Treatment", "l_when": "Date & time", "l_dur": "Duration", "l_addr": "Address", "l_phone": "Phone", "l_msg": "Message",
		"minutes": "approx. {n} min", "web": "Website", "ics": "appointment.ics", "cal_hint": "Open the attached file to add the appointment to your calendar.",
	},
	"de": {
		"greet":           "Hallo {name},",
		"confirm_subject": "Ihr Termin ist bestätigt – {date}, {time}",
		"confirm_intro":   "Gerne bestätige ich Ihren Termin:",
		"confirm_outro":   "Falls Sie nicht kommen können, geben Sie mir bitte so früh wie möglich telefonisch Bescheid.",
		"confirm_sign":    "Ich freue mich auf Sie,",
		"decline_subject": "Ihre Terminanfrage – {date}, {time}",
		"decline_intro":   "Vielen Dank für Ihre Terminanfrage. Leider ist der gewünschte Termin nicht verfügbar:",
		"decline_outro":   "Bitte wählen Sie auf der Website einen anderen Termin oder rufen Sie mich an.",
		"cancel_subject":  "Ihr Termin wurde abgesagt – {date}, {time}",
		"cancel_intro":    "Leider muss ich den folgenden Termin absagen:",
		"cancel_outro":    "Bitte wählen Sie auf der Website einen neuen Termin oder rufen Sie mich an. Entschuldigen Sie die Unannehmlichkeiten.",
		"sign":            "Herzliche Grüße,",
		"l_service":       "Behandlung", "l_when": "Termin", "l_dur": "Dauer", "l_addr": "Adresse", "l_phone": "Telefon", "l_msg": "Nachricht",
		"minutes": "ca. {n} Min.", "web": "Website", "ics": "termin.ics", "cal_hint": "Mit der angehängten Datei können Sie den Termin in Ihren Kalender übernehmen.",
	},
	"sv": {
		"greet":           "Hej {name}!",
		"confirm_subject": "Din tid är bekräftad – {date}, {time}",
		"confirm_intro":   "Jag bekräftar gärna din tid:",
		"confirm_outro":   "Om du inte kan komma, meddela mig gärna per telefon så snart som möjligt.",
		"confirm_sign":    "Varmt välkommen,",
		"decline_subject": "Din bokningsförfrågan – {date}, {time}",
		"decline_intro":   "Tack för din bokningsförfrågan. Tyvärr är den önskade tiden inte tillgänglig:",
		"decline_outro":   "Välj gärna en annan tid på webbplatsen eller ring mig.",
		"cancel_subject":  "Din tid är inställd – {date}, {time}",
		"cancel_intro":    "Tyvärr måste jag ställa in följande tid:",
		"cancel_outro":    "Välj gärna en ny tid på webbplatsen eller ring mig. Jag ber om ursäkt för besväret.",
		"sign":            "Vänliga hälsningar,",
		"l_service":       "Behandling", "l_when": "Tid", "l_dur": "Längd", "l_addr": "Adress", "l_phone": "Telefon", "l_msg": "Meddelande",
		"minutes": "ca {n} min", "web": "Webbplats", "ics": "bokning.ics", "cal_hint": "Öppna den bifogade filen för att lägga till tiden i din kalender.",
	},
}

var reFill = regexp.MustCompile(`\{(\w+)\}`)

func fill(s string, v map[string]string) string {
	return reFill.ReplaceAllStringFunc(s, func(m string) string { return v[m[1:len(m)-1]] })
}

var escRepl = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&#39;")

func esc(s string) string { return escRepl.Replace(s) }

/* Long dates exactly as Intl.DateTimeFormat (weekday long, month long) printed them. */
var (
	months = map[string][]string{
		"hu": {"január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"},
		"en": {"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"},
		"de": {"Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"},
		"sv": {"januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"},
	}
	weekdays = map[string][]string{ // Sunday first
		"hu": {"vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"},
		"en": {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"},
		"de": {"Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"},
		"sv": {"söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"},
	}
)

func dateLong(date, lang string) string {
	if months[lang] == nil {
		lang = "hu"
	}
	y, m, d := parseYMD(date)
	t := time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC)
	mon := months[lang][t.Month()-1]
	wd := weekdays[lang][t.Weekday()]
	ys, ds := strconv.Itoa(t.Year()), strconv.Itoa(t.Day())
	var s string
	switch lang {
	case "hu":
		s = ys + ". " + mon + " " + ds + "., " + wd
	case "en":
		s = wd + ", " + ds + " " + mon + " " + ys
	case "de":
		s = wd + ", " + ds + ". " + mon + " " + ys
	default:
		s = wd + " " + ds + " " + mon + " " + ys
	}
	r, n := utf8.DecodeRuneInString(s)
	return string(unicode.ToUpper(r)) + s[n:]
}

func endTime(b *Booking) string { return fromMin(toMin(b.Time) + b.Minutes) }

// localToUtc: Budapest wall clock → instant.
func localToUtc(date string, minutes int) time.Time {
	y, m, d := parseYMD(date)
	return time.Date(y, time.Month(m), d, 0, minutes, 0, 0, budapest)
}

func icsStamp(t time.Time) string { return t.UTC().Format("20060102T150405Z") }

var icsRepl = strings.NewReplacer(`\`, `\\`, ";", `\;`, ",", `\,`, "\r\n", `\n`, "\n", `\n`)

func icsEsc(s string) string { return icsRepl.Replace(s) }

func icsFold(line string) string {
	var out []string
	cur := ""
	for _, ch := range line {
		if len(cur)+len(string(ch)) > 73 {
			out = append(out, cur)
			cur = " "
		}
		cur += string(ch)
	}
	out = append(out, cur)
	return strings.Join(out, "\r\n")
}

func ics(b *Booking, serviceName string) string {
	start := localToUtc(b.Date, toMin(b.Time))
	end := start.Add(time.Duration(b.Minutes) * time.Minute)
	lines := []string{
		"BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Esszencia Szepsegmuhely//Foglalas//HU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
		"BEGIN:VEVENT",
		"UID:" + b.ID + "@esszencia",
		"DTSTAMP:" + icsStamp(time.Now()),
		"DTSTART:" + icsStamp(start),
		"DTEND:" + icsStamp(end),
		"SUMMARY:" + icsEsc("Esszencia – "+serviceName),
		"LOCATION:" + icsEsc("Esszencia Szépségműhely, "+salon.Address),
		"DESCRIPTION:" + icsEsc(salon.Owner+" · "+salon.Phone),
		"BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc("Esszencia – "+serviceName), "TRIGGER:-PT2H", "END:VALARM",
		"END:VEVENT", "END:VCALENDAR", "",
	}
	for i, l := range lines {
		lines[i] = icsFold(l)
	}
	return strings.Join(lines, "\r\n")
}

func htmlShell(inner string) string {
	return `<!doctype html><html><body style="margin:0;padding:0;background:#F0EDDD;">` +
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0EDDD;padding:24px 12px;"><tr><td align="center">` +
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F7F5EA;border:1px solid #D6DCCF;border-radius:8px;">` +
		`<tr><td style="padding:26px 28px 6px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#3F5C55;">` +
		`<div style="font-size:22px;letter-spacing:6px;">ESSZENCIA</div>` +
		`<div style="font-size:10px;letter-spacing:3px;color:#4D635C;margin-top:4px;">SZÉPSÉGMŰHELY · BEAUTY &amp; RELAX</div></td></tr>` +
		`<tr><td style="padding:18px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#22322E;">` + inner + `</td></tr>` +
		`</table>` +
		`<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4D635C;margin-top:14px;">` + esc(salon.Address) + ` · ` + esc(salon.Phone) + `</div>` +
		`</td></tr></table></body></html>`
}

func rowsHTML(rows [][2]string) string {
	var b strings.Builder
	b.WriteString(`<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0 18px;border-top:1px solid #D6DCCF;">`)
	for _, r := range rows {
		b.WriteString(`<tr><td style="padding:9px 12px 9px 0;border-bottom:1px solid #D6DCCF;color:#4D635C;font-size:14px;white-space:nowrap;vertical-align:top;">` + esc(r[0]) +
			`</td><td style="padding:9px 0;border-bottom:1px solid #D6DCCF;font-weight:bold;color:#2B423C;">` + strings.ReplaceAll(esc(r[1]), "\n", "<br>") + `</td></tr>`)
	}
	b.WriteString(`</table>`)
	return b.String()
}

// customerEmail — kind: "confirm" | "decline" | "cancel".
func customerEmail(kind string, b *Booking, message, site string) Mail {
	lang := b.Lang
	if T[lang] == nil {
		lang = "hu"
	}
	t := T[lang]
	service := b.Service.Local
	if service == "" {
		service = b.Service.Hu
	}
	date := dateLong(b.Date, lang)
	when := date + ", " + b.Time + "–" + endTime(b)
	v := map[string]string{"name": b.Name, "date": date, "time": b.Time}
	rows := [][2]string{{t["l_service"], service}, {t["l_when"], when}}
	if kind == "confirm" {
		rows = append(rows, [2]string{t["l_dur"], fill(t["minutes"], map[string]string{"n": strconv.Itoa(b.Minutes)})}, [2]string{t["l_addr"], salon.Address})
	}
	message = jsTrim(message)
	intro := t[kind+"_intro"]
	outro := t[kind+"_outro"]
	sign := t["sign"]
	if kind == "confirm" {
		sign = t["confirm_sign"]
	}

	text := []string{fill(t["greet"], v), "", intro, ""}
	for _, r := range rows {
		text = append(text, r[0]+": "+r[1])
	}
	if message != "" {
		text = append(text, "", t["l_msg"]+": "+message)
	}
	text = append(text, "", outro)
	if kind == "confirm" {
		text = append(text, t["cal_hint"])
	}
	text = append(text, "", t["l_phone"]+": "+salon.Phone)
	if site != "" && kind != "confirm" {
		text = append(text, t["web"]+": "+site)
	}
	text = append(text, "", sign, salon.Owner, salon.Name)

	inner := `<p style="margin:0 0 12px;">` + esc(fill(t["greet"], v)) + `</p>` +
		`<p style="margin:0;">` + esc(intro) + `</p>` + rowsHTML(rows)
	if message != "" {
		inner += `<p style="margin:0 0 14px;padding:12px 14px;background:#E2E6DA;border-radius:6px;"><b>` + esc(t["l_msg"]) + `:</b> ` + strings.ReplaceAll(esc(message), "\n", "<br>") + `</p>`
	}
	inner += `<p style="margin:0 0 10px;">` + esc(outro) + `</p>`
	if kind == "confirm" {
		inner += `<p style="margin:0 0 10px;font-size:13px;color:#4D635C;">` + esc(t["cal_hint"]) + `</p>`
	}
	inner += `<p style="margin:0 0 18px;">` + esc(t["l_phone"]) + `: <a href="tel:+36706221208" style="color:#3F5C55;font-weight:bold;">` + esc(salon.Phone) + `</a>`
	if site != "" && kind != "confirm" {
		inner += `<br><a href="` + esc(site) + `" style="color:#3F5C55;">` + esc(reScheme.ReplaceAllString(site, "")) + `</a>`
	}
	inner += `</p>` +
		`<p style="margin:0;">` + esc(sign) + `<br><b>` + esc(salon.Owner) + `</b><br><span style="color:#4D635C;font-size:14px;">` + esc(salon.Name) + `</span></p>`

	out := Mail{Subject: fill(t[kind+"_subject"], v), Text: strings.Join(text, "\n"), HTML: htmlShell(inner)}
	if kind == "confirm" {
		out.Attachments = append(out.Attachments, Attachment{Filename: t["ics"], ContentType: "text/calendar; charset=UTF-8; method=PUBLISH", Content: ics(b, service)})
	}
	return out
}

var reScheme = regexp.MustCompile(`^https?://`)

var langName = map[string]string{"hu": "magyar", "en": "angol", "de": "német", "sv": "svéd"}

func adminNotification(b *Booking, adminURL string) Mail {
	date := dateLong(b.Date, "hu")
	service := b.Service.Hu
	if b.Service.Category != "" {
		service += " (" + b.Service.Category + ")"
	}
	ln := langName[b.Lang]
	if ln == "" {
		ln = b.Lang
	}
	rows := [][2]string{
		{"Kezelés", service},
		{"Időpont", date + ", " + b.Time + "–" + endTime(b) + " (" + strconv.Itoa(b.Minutes) + " perc)"},
		{"Név", b.Name}, {"Telefon", b.Phone}, {"E-mail", b.Email},
		{"Nyelv", ln},
	}
	if b.Note != "" {
		rows = append(rows, [2]string{"Megjegyzés", b.Note})
	}
	subject := "Új időpontkérés: " + b.Name + " – " + strings.ReplaceAll(b.Date, "-", ".") + ". " + b.Time
	text := []string{"Új időpontkérés érkezett a weboldalról:", ""}
	for _, r := range rows {
		text = append(text, r[0]+": "+r[1])
	}
	text = append(text, "", "Visszaigazolás vagy elutasítás az Esszencia Foglalások alkalmazásban:", adminURL)
	inner := `<p style="margin:0;font-size:18px;color:#2B423C;"><b>Új időpontkérés érkezett</b></p>` + rowsHTML(rows)
	if adminURL != "" {
		inner += `<p style="margin:0;text-align:center;"><a href="` + esc(adminURL) + `" style="display:inline-block;padding:13px 24px;background:#3F5C55;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Megnyitás a Foglalások appban</a></p>`
	}
	inner += `<p style="margin:16px 0 0;font-size:13px;color:#4D635C;">Az ügyfél csak akkor kap e-mailt, amikor visszaigazolod vagy elutasítod a kérést. Erre a levélre válaszolva közvetlenül neki írsz.</p>`
	return Mail{Subject: subject, Text: strings.Join(text, "\n"), HTML: htmlShell(inner)}
}

func testEmail() Mail {
	return Mail{
		Subject: "Esszencia Foglalások – teszt e-mail",
		Text:    "Ez egy teszt e-mail. Ha megkaptad, az e-mail küldés működik.",
		HTML:    htmlShell(`<p style="margin:0 0 10px;"><b>Teszt e-mail</b></p><p style="margin:0;">Ha megkaptad, az e-mail küldés működik. ✓</p>`),
	}
}
