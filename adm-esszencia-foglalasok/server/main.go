package main

/* ==========================================================================
   Esszencia Foglalások – booking server (Go, standard library only)

   Listeners:
   • PUBLIC_PORT (published on the Umbrel as 4753) – only what the website
     needs: free times + creating a booking request. Nothing private.
   • ADMIN_PORT – the admin app (behind Umbrel's login via app_proxy):
     requests, confirm / decline / cancel, closures, settings.
   • REMOTE_PORT (published as 4754) – the same admin app for use through a
     Cloudflare Tunnel hostname, protected by its own password instead of the
     Umbrel login (which only works on the Umbrel's own address). The password
     can only be set from the Umbrel-protected address.
   Data lives in DATA_DIR as JSON (db.json, settings.json).
   All dates/times are Budapest wall-clock strings ("2026-11-03", "09:30").
   ========================================================================== */

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

var (
	dataDir         = envOr("DATA_DIR", filepath.Join("..", "data"))
	adminPort       = envPort("ADMIN_PORT", 8080)
	publicPort      = envPort("PUBLIC_PORT", 3001)
	remotePort      = envPort("REMOTE_PORT", 0)
	dbFile          = filepath.Join(dataDir, "db.json")
	settingsFile    = filepath.Join(dataDir, "settings.json")
	statsFile       = filepath.Join(dataDir, "stats.json")
	todayFile       = filepath.Join(dataDir, "stats-today.json")
	adminDir        = mustAbs(envOr("ADMIN_DIR", "admin"))
	bundledServices = envOr("SERVICES_FALLBACK", filepath.Join("lib", "services-fallback.json"))
	langs           = []string{"hu", "en", "de", "sv"}
)

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
func envPort(k string, def int) int {
	if n, err := strconv.Atoi(os.Getenv(k)); err == nil && n != 0 {
		return n
	}
	return def
}
func mustAbs(p string) string { a, _ := filepath.Abs(p); return a }
func isLang(v any) bool {
	s, ok := v.(string)
	if !ok {
		return false
	}
	for _, l := range langs {
		if l == s {
			return true
		}
	}
	return false
}

/*
---------------------------------------------------------------- state

	One lock guards db, settings, stats and the rate limiters (the Node.js
	version was single-threaded; this keeps the same "one step at a time"
	guarantees, e.g. two people can never book the same time).
*/
var (
	mu         sync.Mutex
	db         = &DB{}
	settings   = defaultSettings()
	stats      = &Stats{}
	todayVis   *TodayVis
	seen       = map[string]bool{}
	statsDirty bool
)

func saveDb()       { writeJSON(dbFile, db) }
func saveSettings() { writeJSON(settingsFile, settings) }

func loadState() {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatal(err)
	}
	readJSON(dbFile, db)
	if db.Bookings == nil {
		db.Bookings = []*Booking{}
	}
	if db.Blocks == nil {
		db.Blocks = []*Block{}
	}
	clean := db.Bookings[:0]
	for _, b := range db.Bookings {
		if b != nil {
			clean = append(clean, b)
		}
	}
	db.Bookings = clean
	readJSON(settingsFile, settings)
	if settings.Hours == nil {
		settings.Hours = defaultSettings().Hours
	}
	if settings.Secret == "" {
		settings.Secret = randHex(24)
		saveSettings()
	}
	readJSON(statsFile, stats)
	if stats.Days == nil {
		stats.Days = map[string]*DayRec{}
	}
	for k, r := range stats.Days {
		if r == nil {
			delete(stats.Days, k)
		} else {
			r.fill()
		}
	}
	tv := &TodayVis{}
	if readJSON(todayFile, tv) {
		if tv.Seen == nil {
			tv.Seen = []string{}
		}
		todayVis = tv
		for _, id := range tv.Seen {
			seen[id] = true
		}
	}
}

/* ------------------------------------------------------------ availability */
func active(status string) bool { return status == "pending" || status == "confirmed" }

func busy(date, excludeID string) [][2]int {
	buf := settings.BufferMinutes
	var out [][2]int
	for _, b := range db.Bookings {
		if b.Date == date && active(b.Status) && b.ID != excludeID {
			out = append(out, [2]int{toMin(b.Time) - buf, toMin(b.Time) + b.Minutes + buf})
		}
	}
	for _, k := range db.Blocks {
		to := k.DateTo
		if to == "" {
			to = k.Date
		}
		if date >= k.Date && date <= to {
			if k.AllDay {
				out = append(out, [2]int{0, 1440})
			} else {
				out = append(out, [2]int{toMin(k.From), toMin(k.To)})
			}
		}
	}
	return out
}

func hoursOf(date string) []string {
	h := settings.Hours[strconv.Itoa(weekday(date))]
	if len(h) < 2 {
		return nil
	}
	return h
}

// freeStarts: start times a client may book on date for a treatment of minutes.
func freeStarts(date string, minutes int, admin bool, excludeID string) []string {
	h := hoursOf(date)
	if h == nil {
		return []string{}
	}
	t := now()
	if !admin && (date < t.Date || date > addDays(t.Date, settings.HorizonDays)) {
		return []string{}
	}
	open, closing := toMin(h[0]), toMin(h[1])
	earliest := math.Inf(-1)
	if !admin {
		earliest = float64(t.Abs + settings.MinNoticeHours*60)
	}
	b := busy(date, excludeID)
	step := settings.StepMinutes
	if step <= 0 {
		step = 30
	}
	res := []string{}
	day := dayNum(date) * 1440
	// The closing time is the last possible START: a treatment may run past closing.
	for s := open; s <= closing; s += step {
		if float64(day+s) < earliest {
			continue
		}
		e := s + minutes
		clash := false
		for _, r := range b {
			if s < r[1] && e > r[0] {
				clash = true
				break
			}
		}
		if !clash {
			res = append(res, fromMin(s))
		}
	}
	return res
}

func overlaps(date, tm string, minutes int, excludeID string) bool {
	s := toMin(tm)
	e := s + minutes
	for _, r := range busy(date, excludeID) {
		if s < r[1] && e > r[0] {
			return true
		}
	}
	return false
}

/*
------------------------------------------------------- privacy: offers

	Visitors never see the real list of free times. For each day the server
	offers at most `offerPerHalfDay` times in the morning and in the afternoon,
	picked from the free ones in a secret order. A time that is not shown may be
	booked – or simply not offered – so the calendar does not reveal when the
	salon is busy. Fully booked days look like closed days.
	The secret order
	• is different for every treatment length, so comparing what a short and a
	  long treatment are offered tells nothing about where bookings are, and
	• reshuffles every few hours, so offered times come and go all the time and
	  a time disappearing is no sign that someone booked it.
	A booking is accepted for a time offered in the current or the previous
	window, so nobody is caught out by a reshuffle while filling in the form.
*/
const offerWindowMin = 240

func offerWindow() int { return int(math.Floor(float64(now().Abs) / offerWindowMin)) }

func offered(date string, minutes, win int) []string {
	free := freeStarts(date, minutes, false, "")
	k := settings.OfferPerHalfDay
	if k == 0 {
		k = 3
	}
	k = max(1, k)
	if len(free) == 0 {
		return []string{}
	}
	key := []byte(settings.Secret + "|" + strconv.Itoa(win) + "|" + date + "|" + strconv.Itoa(minutes))
	rank := func(t string) uint32 {
		m := hmac.New(sha256.New, key)
		m.Write([]byte(t))
		return binary.BigEndian.Uint32(m.Sum(nil))
	}
	pick := func(arr []string) []string {
		ranks := map[string]uint32{}
		for _, t := range arr {
			ranks[t] = rank(t)
		}
		s := append([]string(nil), arr...)
		sort.SliceStable(s, func(i, j int) bool { return ranks[s[i]] < ranks[s[j]] })
		return s[:min(k, len(s))]
	}
	var am, pm []string
	for _, t := range free {
		if toMin(t) < 720 {
			am = append(am, t)
		} else {
			pm = append(pm, t)
		}
	}
	out := append(append([]string{}, pick(am)...), pick(pm)...)
	sort.Strings(out)
	return out
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

/* ------------------------------------------------------------- validation */
func clampMinutes(v any) int {
	n := jsNumber(v)
	if n == 0 || math.IsNaN(n) {
		n = 60
	}
	n = jsRound(n)
	return int(math.Min(240, math.Max(15, n)))
}

// Public requests can only use real treatment lengths (stops fine-grained probing of the calendar).
var publicMinutes = []int{30, 45, 60, 75, 90, 120, 180}

func snapMinutes(v any) int {
	n := clampMinutes(v)
	for _, m := range publicMinutes {
		if n <= m {
			return m
		}
	}
	return 180
}

/* -------------------------------------------------------------- rate limit */
var hits = map[string][]int64{}

func limited(key string, max int, windowMs int64, checkOnly bool) bool {
	t := time.Now().UnixMilli()
	var arr []int64
	for _, x := range hits[key] {
		if t-x < windowMs {
			arr = append(arr, x)
		}
	}
	hits[key] = arr
	if len(arr) >= max {
		return true
	}
	if !checkOnly {
		hits[key] = append(arr, t)
	}
	return false
}

func pruneHits() {
	t := time.Now().UnixMilli()
	for k, v := range hits {
		keep := false
		for _, x := range v {
			if t-x < 3600000 {
				keep = true
				break
			}
		}
		if !keep {
			delete(hits, k)
		}
	}
}

/* ------------------------------------------------------------------ e-mail */
func smtpConfigured() bool {
	return settings.SMTP.Host != "" && settings.SMTP.User != "" && settings.SMTP.Pass != ""
}

func replyTo() string {
	if settings.NotifyEmail != "" {
		return settings.NotifyEmail
	}
	return settings.SMTP.User
}

// sendCustomer is called with the lock held; it is released while the mail goes out.
func sendCustomer(g *guard, b *Booking, kind, message string) *MailRec {
	m := customerEmail(kind, b, message, settings.SiteURL)
	cfg := settings.SMTP
	msg := Message{From: cfg.User, FromName: cfg.FromName, To: b.Email, ReplyTo: replyTo(), Subject: m.Subject, Text: m.Text, HTML: m.HTML, Attachments: m.Attachments}
	rec := &MailRec{Kind: kind, At: nowISO()}
	g.unlock()
	err := sendMail(cfg, msg)
	g.lock()
	if err != nil {
		rec.Error = explain(err)
		log.Printf("[mail] %s → %s failed: %s", kind, b.Email, err)
	} else {
		rec.Ok = true
	}
	b.Mail = rec
	return rec
}

// notifyAdmin runs in the background after the request was answered.
func notifyAdmin(b Booking) {
	mu.Lock()
	ok := smtpConfigured() && settings.NotifyEmail != ""
	cfg, to, url := settings.SMTP, settings.NotifyEmail, settings.AdminURL
	mu.Unlock()
	if !ok {
		return
	}
	m := adminNotification(&b, url)
	if err := sendMail(cfg, Message{From: cfg.User, FromName: "Esszencia · Foglalás", To: to, ReplyTo: b.Email, Subject: m.Subject, Text: m.Text, HTML: m.HTML}); err != nil {
		log.Printf("[mail] notification failed: %s", err)
	}
}

/* -------------------------------------------------------------- http utils */
type guard struct{ held bool }

func (g *guard) lock() {
	if !g.held {
		mu.Lock()
		g.held = true
	}
}
func (g *guard) unlock() {
	if g.held {
		mu.Unlock()
		g.held = false
	}
}

type resp struct {
	http.ResponseWriter
	sent bool
}

func (r *resp) WriteHeader(code int) { r.sent = true; r.ResponseWriter.WriteHeader(code) }
func (r *resp) Write(b []byte) (int, error) {
	r.sent = true
	return r.ResponseWriter.Write(b)
}

func send(w http.ResponseWriter, status int, v any, headers ...string) {
	body := toJSON(v, false)
	h := w.Header()
	h.Set("Content-Type", "application/json; charset=utf-8")
	h.Set("Cache-Control", "no-store")
	h.Set("X-Content-Type-Options", "nosniff")
	for i := 0; i+1 < len(headers); i += 2 {
		h.Set(headers[i], headers[i+1])
	}
	h.Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(status)
	w.Write(body)
}

type httpErr struct{ status int }

func readBody(r *http.Request, limit int64) (obj, *httpErr) {
	data, err := io.ReadAll(io.LimitReader(r.Body, limit+1))
	if int64(len(data)) > limit {
		return nil, &httpErr{413}
	}
	if err != nil {
		return nil, &httpErr{400}
	}
	if len(data) == 0 {
		return obj{}, nil
	}
	var v any
	if json.Unmarshal(data, &v) != nil {
		return nil, &httpErr{400}
	}
	return asObj(v), nil
}

func clientIP(r *http.Request) string {
	ip := r.Header.Get("Cf-Connecting-Ip")
	if ip == "" {
		ip, _, _ = strings.Cut(r.Header.Get("X-Forwarded-For"), ",")
	}
	if ip == "" {
		ip = r.RemoteAddr
		if i := strings.LastIndex(ip, ":"); i >= 0 {
			ip = strings.Trim(ip[:i], "[]")
		}
	}
	return jsTrim(ip)
}

// urlPath: the request path as WHATWG URL parsing gives it (percent-encoding kept, dot segments resolved).
func urlPath(r *http.Request) string {
	p := r.URL.EscapedPath()
	if p == "" {
		p = "/"
	}
	segs := strings.Split(p[1:], "/")
	var out []string
	for i, s := range segs {
		last := i == len(segs)-1
		switch strings.ToLower(s) {
		case ".", "%2e":
			if last {
				out = append(out, "")
			}
		case "..", ".%2e", "%2e.", "%2e%2e":
			if len(out) > 0 {
				out = out[:len(out)-1]
			}
			if last {
				out = append(out, "")
			}
		default:
			out = append(out, s)
		}
	}
	return "/" + strings.Join(out, "/")
}

var reTrailSlash = regexp.MustCompile(`/+$`)

func query(r *http.Request, k string) any {
	v, ok := r.URL.Query()[k]
	if !ok || len(v) == 0 {
		return nil
	}
	return v[0]
}

func publicBooking(b *Booking) obj {
	return obj{"id": b.ID, "date": b.Date, "time": b.Time, "minutes": b.Minutes}
}

/* ============================================================ PUBLIC API */
func publicAPI(w http.ResponseWriter, r *http.Request, g *guard) {
	p := reTrailSlash.ReplaceAllString(urlPath(r), "")
	g.lock()

	if r.Method == "GET" && p == "/api/health" {
		send(w, 200, obj{"ok": true})
		return
	}

	if r.Method == "GET" && p == "/api/info" {
		send(w, 200, obj{"hours": settings.Hours, "stepMinutes": settings.StepMinutes, "horizonDays": settings.HorizonDays, "today": now().Date})
		return
	}

	if r.Method == "GET" && p == "/api/availability" {
		if limited("av:"+clientIP(r), 120, 600000, false) {
			send(w, 429, obj{"error": "rate"})
			return
		}
		t := now()
		from := query(r, "from")
		fromS := t.Date
		if isDate(from) {
			fromS = from.(string)
		}
		days, ok := jsParseInt(query(r, "days"))
		if !ok || days == 0 {
			days = 42
		}
		days = min(62, max(1, days))
		minutes := snapMinutes(query(r, "minutes"))
		out := map[string][]string{}
		win := offerWindow()
		for i := 0; i < days; i++ {
			d := addDays(fromS, i)
			if s := offered(d, minutes, win); len(s) > 0 {
				out[d] = s
			}
		}
		send(w, 200, obj{"today": t.Date, "lastDay": addDays(t.Date, settings.HorizonDays), "hours": settings.Hours, "days": out})
		return
	}

	if r.Method == "POST" && p == "/api/hit" {
		if limited("hit:"+clientIP(r), 300, 3600000, false) {
			w.WriteHeader(204)
			return
		}
		g.unlock()
		body, err := readBody(r, 2048)
		if err != nil {
			body = obj{}
		}
		g.lock()
		func() {
			defer func() { recover() }() // never break the site for stats
			recordHit(r, body)
		}()
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(204)
		return
	}

	if r.Method == "POST" && p == "/api/bookings" {
		ip := clientIP(r)
		g.unlock()
		body, herr := readBody(r, 16384)
		g.lock()
		if herr != nil {
			send(w, herr.status, obj{"error": "invalid"})
			return
		}

		// Spam traps: hidden field must be empty, and a human needs a few seconds to fill the form.
		if el := jsNumber(body["elapsed"]); str(body["website"], 200) != "" || (el > 0 && el < 2500) {
			send(w, 200, obj{"ok": true, "id": "x"})
			return
		}
		if limited("ip:"+ip, 12, 3600000, false) {
			send(w, 429, obj{"error": "rate"})
			return
		}
		if limited("ok:"+ip, 5, 3600000, true) || limited("all", 40, 3600000, true) {
			send(w, 429, obj{"error": "rate"})
			return
		}

		b := &Booking{
			ID:      randHex(6),
			Status:  "pending",
			Source:  "web",
			Date:    str(body["date"], 10),
			Time:    str(body["time"], 5),
			Minutes: snapMinutes(body["minutes"]),
			Service: Service{
				Hu:       oneLine(or(body["serviceHu"], body["service"]), 160),
				Local:    oneLine(or(body["serviceLocal"], body["serviceHu"], body["service"]), 160),
				Category: oneLine(body["category"], 80),
			},
			Note:      str(body["note"], 1000),
			Name:      oneLine(body["name"], 80),
			Phone:     oneLine(body["phone"], 30),
			Email:     strings.ToLower(oneLine(body["email"], 120)),
			Lang:      "hu",
			CreatedAt: nowISO(),
		}
		if isLang(body["lang"]) {
			b.Lang = body["lang"].(string)
		}
		errs := obj{}
		if !isDate(b.Date) {
			errs["date"] = 1
		}
		if !isTime(b.Time) {
			errs["time"] = 1
		}
		if jsLen(b.Name) < 2 {
			errs["name"] = 1
		}
		if !isPhone(b.Phone) {
			errs["phone"] = 1
		}
		if !isEmail(b.Email) {
			errs["email"] = 1
		}
		if b.Service.Hu == "" && b.Note == "" {
			errs["service"] = 1
		}
		if body["consent"] != true {
			errs["consent"] = 1
		}
		if len(errs) > 0 {
			send(w, 400, obj{"error": "invalid", "fields": errs})
			return
		}
		if b.Service.Hu == "" {
			b.Service.Hu = "Egyedi kérés"
			if b.Service.Local == "" {
				b.Service.Local = b.Service.Hu
			}
		}

		// Final check happens here, under the lock – two people can never get the same time.
		win := offerWindow()
		if !contains(offered(b.Date, b.Minutes, win), b.Time) && !contains(offered(b.Date, b.Minutes, win-1), b.Time) {
			send(w, 409, obj{"error": "taken"})
			return
		}
		db.Bookings = append(db.Bookings, b)
		saveDb()
		limited("ok:"+ip, 5, 3600000, false) // count successful requests only
		limited("all", 40, 3600000, false)
		send(w, 201, obj{"ok": true, "booking": publicBooking(b)})
		go notifyAdmin(*b)
		return
	}

	send(w, 404, obj{"error": "not found"})
}

/*
============================================================ STATISTICS

	Anonymous, cookie-free website statistics. Only daily counters are kept.
	Unique visitors are counted with a hash of (IP + browser) and a random salt
	that is thrown away every day, so nobody can be recognised or followed.
*/
var (
	events = []string{"book_open", "book_service", "book_time", "book_sent", "call", "messenger", "email", "map", "lang", "gallery", "prices"}
	botUA  = regexp.MustCompile(`(?i)bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|pingdom|uptime|monitor|curl|wget|python|java/|go-http|node-fetch|axios|headless`)
)

func visitorDay() *TodayVis {
	d := now().Date
	if todayVis == nil || todayVis.Date != d {
		todayVis = &TodayVis{Date: d, Salt: randHex(16), Seen: []string{}}
		seen = map[string]bool{}
		statsDirty = true
	}
	return todayVis
}

func dayRec(d string) *DayRec {
	if stats.Days[d] == nil {
		stats.Days[d] = newDayRec()
	}
	return stats.Days[d]
}

var (
	reWWW       = regexp.MustCompile(`^www\.`)
	reFacebook  = regexp.MustCompile(`(^|\.)facebook\.com$|(^|\.)fb\.(com|me)$|messenger\.com$`)
	reInstagram = regexp.MustCompile(`instagram\.com$`)
	reGoogle    = regexp.MustCompile(`(^|\.)google\.[a-z.]+$`)
	reSearch    = regexp.MustCompile(`bing\.com$|duckduckgo\.com$|yahoo\.|ecosia\.org$`)
	reMaps      = regexp.MustCompile(`maps\.apple\.com$|waze\.com$`)
)

func refSource(host string) string {
	host = jsSlice(reWWW.ReplaceAllString(strings.ToLower(host), ""), 80)
	switch {
	case host == "":
		return "Közvetlen"
	case reFacebook.MatchString(host):
		return "Facebook"
	case reInstagram.MatchString(host):
		return "Instagram"
	case reGoogle.MatchString(host):
		return "Google"
	case reSearch.MatchString(host):
		return "Más keresők"
	case reMaps.MatchString(host):
		return "Térkép"
	}
	return host
}

func isEvent(v any) bool { s, ok := v.(string); return ok && contains(events, s) }

func recordHit(r *http.Request, body obj) {
	ua := r.Header.Get("User-Agent")
	if ua == "" || botUA.MatchString(ua) {
		return
	}
	isView := isStr(body["t"], "view")
	isEv := isStr(body["t"], "event") && isEvent(body["e"])
	if !isView && !isEv {
		return
	}
	v := visitorDay()
	rec := dayRec(v.Date)
	if isView {
		m := hmac.New(sha256.New, []byte(v.Salt))
		m.Write([]byte(clientIP(r) + "|" + ua))
		id := fmt.Sprintf("%x", m.Sum(nil))[:16]
		if !seen[id] {
			seen[id] = true
			v.Seen = append(v.Seen, id)
			rec.Visitors++
		}
		rec.Views++
		w := jsNumber(body["w"])
		if math.IsNaN(w) {
			w = 0
		}
		dev := "desktop"
		if w != 0 && w < 760 {
			dev = "mobile"
		} else if w != 0 && w < 1100 {
			dev = "tablet"
		}
		rec.Dev[dev]++
		if isLang(body["lang"]) {
			rec.Lang[body["lang"].(string)]++
		}
		host := oneLine(body["ref"], 120)
		if !truthy(body["internal"]) {
			src := refSource(host)
			if rec.Ref[src] == 0 && len(rec.Ref) >= 25 {
				src = "Egyéb"
			}
			rec.Ref[src]++
		}
	} else {
		e := body["e"].(string)
		rec.Ev[e]++
		if e == "lang" && isLang(body["lang"]) {
			rec.Lang[body["lang"].(string)]++
		}
	}
	statsDirty = true
}

func flushStats() {
	if !statsDirty {
		return
	}
	statsDirty = false
	cutoff := addDays(now().Date, -400)
	for d := range stats.Days {
		if d < cutoff {
			delete(stats.Days, d)
		}
	}
	writeJSON(statsFile, stats)
	if todayVis != nil {
		writeJSON(todayFile, todayVis)
	} else {
		writeJSON(todayFile, obj{})
	}
}

func statsReport(days int) obj {
	t := now().Date
	from := addDays(t, -(days - 1))
	prevFrom := addDays(from, -days)
	type point struct {
		D        string `json:"d"`
		Visitors int    `json:"visitors"`
		Views    int    `json:"views"`
	}
	series := []point{}
	sum := newDayRec()
	prev := struct {
		Views    int `json:"views"`
		Visitors int `json:"visitors"`
	}{}
	empty := newDayRec()
	for i := 0; i < days; i++ {
		d := addDays(from, i)
		r := stats.Days[d]
		if r == nil {
			r = empty
		}
		series = append(series, point{d, r.Visitors, r.Views})
		sum.Views += r.Views
		sum.Visitors += r.Visitors
		for _, pair := range [][2]map[string]int{{sum.Dev, r.Dev}, {sum.Lang, r.Lang}, {sum.Ref, r.Ref}, {sum.Ev, r.Ev}} {
			for a, n := range pair[1] {
				pair[0][a] += n
			}
		}
		if pr := stats.Days[addDays(prevFrom, i)]; pr != nil {
			prev.Views += pr.Views
			prev.Visitors += pr.Visitors
		}
	}
	created := func(b *Booking, a, z string) bool {
		if b.CreatedAt == "" {
			return false
		}
		d, ok := budapestDate(b.CreatedAt)
		return ok && d >= a && d <= z
	}
	requests, prevRequests := 0, 0
	status := map[string]int{}
	for _, b := range db.Bookings {
		if b.Source == "manual" {
			continue
		}
		if created(b, from, t) {
			requests++
			status[b.Status]++
		}
		if created(b, prevFrom, addDays(from, -1)) {
			prevRequests++
		}
	}
	services := map[string]int{}
	weekdays := []int{0, 0, 0, 0, 0, 0, 0}
	hours := map[string]int{}
	for _, b := range db.Bookings {
		if (b.Status == "confirmed" || b.Status == "pending") && created(b, from, t) {
			name := b.Service.Hu
			if name == "" {
				name = "Kezelés"
			}
			services[name]++
			if wd := weekday(b.Date); wd >= 0 && wd < 7 {
				weekdays[wd]++
			}
			hours[jsSlice(b.Time, 2)]++
		}
	}
	upcoming := 0
	for _, b := range db.Bookings {
		if b.Status == "confirmed" && b.Date >= t && b.Date <= addDays(t, 6) {
			upcoming++
		}
	}
	return obj{
		"today": t, "from": from, "days": days, "series": series, "totals": sum, "prev": prev, "upcoming": upcoming,
		"bookings": obj{"requests": requests, "prevRequests": prevRequests, "status": status, "services": services, "weekdays": weekdays, "hours": hours},
	}
}

/* ============================================================= ADMIN API */
var mimeTypes = map[string]string{".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon"}

func serveStatic(w http.ResponseWriter, p string) {
	rel := strings.TrimLeft(p, "/")
	if p == "/" {
		rel = "index.html"
	}
	file := filepath.Join(adminDir, rel)
	if file != adminDir && !strings.HasPrefix(file, adminDir+string(filepath.Separator)) {
		w.WriteHeader(403)
		return
	}
	fi, err := os.Stat(file)
	var data []byte
	if err == nil && fi.Mode().IsRegular() {
		data, err = os.ReadFile(file)
	} else if err == nil {
		err = fmt.Errorf("not a file")
	}
	if err != nil {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(404)
		w.Write([]byte("Not found"))
		return
	}
	ct := mimeTypes[filepath.Ext(file)]
	if ct == "" {
		ct = "application/octet-stream"
	}
	h := w.Header()
	h.Set("Content-Type", ct)
	h.Set("Cache-Control", "no-cache")
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("X-Frame-Options", "SAMEORIGIN")
	h.Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'")
	h.Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(200)
	w.Write(data)
}

func settingsForClient() obj {
	var s obj
	json.Unmarshal(toJSON(settings, false), &s)
	smtp := asObj(s["smtp"])
	smtp["hasPass"] = settings.SMTP.Pass != ""
	delete(smtp, "pass")
	delete(s, "secret")
	var setAt any
	if settings.Remote != nil && settings.Remote.SetAt != "" {
		setAt = settings.Remote.SetAt
	}
	s["remote"] = obj{"enabled": remoteEnabled(), "setAt": setAt}
	return s
}

func state() obj {
	t := now()
	bookings := append([]*Booking{}, db.Bookings...)
	sort.SliceStable(bookings, func(i, j int) bool { return bookings[i].Date+bookings[i].Time < bookings[j].Date+bookings[j].Time })
	blocks := append([]*Block{}, db.Blocks...)
	sort.SliceStable(blocks, func(i, j int) bool { return blocks[i].Date < blocks[j].Date })
	return obj{"today": t.Date, "nowMin": t.Min, "bookings": bookings, "blocks": blocks, "mailConfigured": smtpConfigured(), "settings": settingsForClient()}
}

var (
	reBookingAction = regexp.MustCompile(`^/api/admin/bookings/([a-f0-9]+)/(confirm|decline|cancel|resend)$`)
	reBookingID     = regexp.MustCompile(`^/api/admin/bookings/([a-f0-9]+)$`)
	reBlockID       = regexp.MustCompile(`^/api/admin/blocks/([a-f0-9]+)$`)
	reWS            = regexp.MustCompile(`[` + jsSpace + `]+`)
)

const clashMsg = "Ez az időpont ütközik egy másik foglalással vagy zárással."
const noMailMsg = "Az e-mail küldés még nincs beállítva (Beállítások)."

func findBooking(id string) (int, *Booking) {
	for i, b := range db.Bookings {
		if b.ID == id {
			return i, b
		}
	}
	return -1, nil
}

func adminAPI(w http.ResponseWriter, r *http.Request, g *guard, remote bool) {
	p := reTrailSlash.ReplaceAllString(urlPath(r), "")
	if p == "" {
		p = "/"
	}

	if !strings.HasPrefix(p, "/api/") {
		if r.Method != "GET" && r.Method != "HEAD" {
			send(w, 405, obj{"error": "method"})
			return
		}
		serveStatic(w, p)
		return
	}

	// Simple CSRF guard: browsers can't add custom headers on cross-site form posts.
	if r.Method != "GET" && r.Header.Get("X-Esszencia") != "1" {
		send(w, 403, obj{"error": "forbidden"})
		return
	}

	body := obj{}
	if r.Method == "POST" || r.Method == "PUT" {
		var herr *httpErr
		if body, herr = readBody(r, 65536); herr != nil {
			send(w, herr.status, obj{"error": "invalid"})
			return
		}
	}
	g.lock()

	if r.Method == "GET" && p == "/api/admin/state" {
		s := state()
		s["remoteSession"] = remote
		send(w, 200, s)
		return
	}

	// Remote-access password: only from the Umbrel-protected address, never through the tunnel.
	if p == "/api/admin/remote" && r.Method == "POST" {
		if remote {
			send(w, 403, obj{"error": "A távoli jelszót csak az Umbrelen keresztül lehet módosítani."})
			return
		}
		if truthy(body["disable"]) {
			ver := 0
			if settings.Remote != nil {
				ver = settings.Remote.Ver
			}
			settings.Remote = &Remote{Ver: ver + 1}
			saveSettings()
		} else if truthy(body["logoutAll"]) {
			if remoteEnabled() {
				settings.Remote.Ver++
				saveSettings()
			}
		} else {
			pw := ""
			if truthy(body["password"]) {
				pw = jsString(body["password"])
			}
			if jsLen(pw) < 10 {
				send(w, 400, obj{"error": "A jelszó legyen legalább 10 karakter."})
				return
			}
			if jsLen(pw) > 200 {
				send(w, 400, obj{"error": "Túl hosszú jelszó."})
				return
			}
			setRemotePassword(pw)
		}
		send(w, 200, obj{"ok": true, "settings": settingsForClient()})
		return
	}

	if r.Method == "GET" && p == "/api/admin/services" {
		site := settings.SiteURL
		g.unlock()
		res := loadServices(dataDir, site, isStr(query(r, "refresh"), "1"))
		send(w, 200, obj{"source": res.source, "categories": res.data.Categories})
		return
	}

	if r.Method == "GET" && p == "/api/admin/stats" {
		days, ok := jsParseInt(query(r, "days"))
		if !ok || days == 0 {
			days = 30
		}
		send(w, 200, statsReport(min(365, max(7, days))))
		return
	}

	if r.Method == "GET" && p == "/api/admin/slots" {
		date := query(r, "date")
		if !isDate(date) {
			send(w, 400, obj{"error": "date"})
			return
		}
		ex, _ := query(r, "exclude").(string)
		send(w, 200, obj{"times": freeStarts(date.(string), clampMinutes(query(r, "minutes")), true, ex)})
		return
	}

	if m := reBookingAction.FindStringSubmatch(p); m != nil && r.Method == "POST" {
		_, b := findBooking(m[1])
		if b == nil {
			send(w, 404, obj{"error": "Nincs ilyen foglalás."})
			return
		}
		action := m[2]
		message := str(body["message"], 1000)
		notify := body["sendEmail"] != false && b.Email != ""
		switch action {
		case "confirm":
			if b.Status != "confirmed" && overlaps(b.Date, b.Time, b.Minutes, b.ID) && !truthy(body["force"]) {
				send(w, 409, obj{"error": clashMsg})
				return
			}
			b.Status = "confirmed"
		case "decline":
			b.Status = "declined"
		case "cancel":
			b.Status = "cancelled"
		}
		if action != "resend" {
			msg := message
			b.Message = &msg
			b.UpdatedAt = nowISO()
		}
		saveDb()
		var mailRec *MailRec
		if notify {
			kind := action
			if action == "resend" {
				kind = map[string]string{"confirmed": "confirm", "declined": "decline", "cancelled": "cancel"}[b.Status]
			}
			if kind != "" {
				if !smtpConfigured() {
					mailRec = &MailRec{Kind: kind, At: nowISO(), Ok: false, Error: noMailMsg}
					b.Mail = mailRec
				} else {
					text := message
					if action == "resend" {
						text = ""
						if b.Message != nil {
							text = *b.Message
						}
					}
					mailRec = sendCustomer(g, b, kind, text)
				}
				saveDb()
			}
		}
		send(w, 200, obj{"ok": true, "booking": b, "mail": mailRec})
		return
	}

	if m := reBookingID.FindStringSubmatch(p); m != nil && r.Method == "DELETE" {
		i, _ := findBooking(m[1])
		if i < 0 {
			send(w, 404, obj{"error": "Nincs ilyen foglalás."})
			return
		}
		db.Bookings = append(db.Bookings[:i:i], db.Bookings[i+1:]...)
		saveDb()
		send(w, 200, obj{"ok": true})
		return
	} else if m != nil && r.Method == "PUT" {
		// Move / edit a booking (date, time, minutes, service, note, contact).
		_, b := findBooking(m[1])
		if b == nil {
			send(w, 404, obj{"error": "Nincs ilyen foglalás."})
			return
		}
		date, tm, minutes := b.Date, b.Time, b.Minutes
		if body["date"] != nil {
			date = str(body["date"], 10)
		}
		if body["time"] != nil {
			tm = str(body["time"], 5)
		}
		if body["minutes"] != nil {
			minutes = clampMinutes(body["minutes"])
		}
		if !isDate(date) || !isTime(tm) {
			send(w, 400, obj{"error": "Hibás dátum vagy idő."})
			return
		}
		if active(b.Status) && overlaps(date, tm, minutes, b.ID) && !truthy(body["force"]) {
			send(w, 409, obj{"error": clashMsg})
			return
		}
		b.Date, b.Time, b.Minutes, b.UpdatedAt = date, tm, minutes, nowISO()
		if body["serviceHu"] != nil {
			b.Service.Hu = oneLine(body["serviceHu"], 160)
			b.Service.Local = b.Service.Hu
		}
		if body["note"] != nil {
			b.Note = str(body["note"], 1000)
		}
		if body["name"] != nil {
			if n := oneLine(body["name"], 80); n != "" {
				b.Name = n
			}
		}
		if body["phone"] != nil {
			b.Phone = oneLine(body["phone"], 30)
		}
		if body["email"] != nil {
			b.Email = strings.ToLower(oneLine(body["email"], 120))
		}
		saveDb()
		send(w, 200, obj{"ok": true, "booking": b})
		return
	}

	if p == "/api/admin/bookings" && r.Method == "POST" {
		// Manual booking (e.g. taken over the phone) – confirmed straight away.
		svc := oneLine(body["serviceHu"], 160)
		if svc == "" {
			svc = "Kezelés"
		}
		b := &Booking{
			ID: randHex(6), Status: "confirmed", Source: "manual",
			Date: str(body["date"], 10), Time: str(body["time"], 5), Minutes: clampMinutes(body["minutes"]),
			Service: Service{Hu: svc, Local: svc, Category: ""},
			Note:    str(body["note"], 1000), Name: oneLine(body["name"], 80), Phone: oneLine(body["phone"], 30),
			Email: strings.ToLower(oneLine(body["email"], 120)), Lang: "hu",
			CreatedAt: nowISO(),
		}
		if isLang(body["lang"]) {
			b.Lang = body["lang"].(string)
		}
		if !isDate(b.Date) || !isTime(b.Time) {
			send(w, 400, obj{"error": "Hibás dátum vagy idő."})
			return
		}
		if jsLen(b.Name) < 2 {
			send(w, 400, obj{"error": "Add meg a vendég nevét."})
			return
		}
		if b.Email != "" && !isEmail(b.Email) {
			send(w, 400, obj{"error": "Hibás e-mail cím."})
			return
		}
		if overlaps(b.Date, b.Time, b.Minutes, "") && !truthy(body["force"]) {
			send(w, 409, obj{"error": clashMsg})
			return
		}
		db.Bookings = append(db.Bookings, b)
		saveDb()
		var mailRec *MailRec
		if truthy(body["sendEmail"]) && b.Email != "" {
			if smtpConfigured() {
				mailRec = sendCustomer(g, b, "confirm", "")
			} else {
				mailRec = &MailRec{Kind: "confirm", At: nowISO(), Ok: false, Error: noMailMsg}
				b.Mail = mailRec
			}
			saveDb()
		}
		send(w, 201, obj{"ok": true, "booking": b, "mail": mailRec})
		return
	}

	if p == "/api/admin/blocks" && r.Method == "POST" {
		k := &Block{
			ID:   randHex(6),
			Date: str(body["date"], 10), DateTo: str(or(body["dateTo"], body["date"]), 10),
			AllDay: body["allDay"] != false, From: str(body["from"], 5), To: str(body["to"], 5),
			Note: oneLine(body["note"], 120), CreatedAt: nowISO(),
		}
		if !isDate(k.Date) || !isDate(k.DateTo) || k.DateTo < k.Date {
			send(w, 400, obj{"error": "Hibás dátum."})
			return
		}
		if !k.AllDay && (!isTime(k.From) || !isTime(k.To) || toMin(k.To) <= toMin(k.From)) {
			send(w, 400, obj{"error": "Hibás időtartam."})
			return
		}
		if k.AllDay {
			k.From, k.To = "", ""
		}
		db.Blocks = append(db.Blocks, k)
		saveDb()
		send(w, 201, obj{"ok": true, "block": k})
		return
	}
	if m := reBlockID.FindStringSubmatch(p); m != nil && r.Method == "DELETE" {
		for i, k := range db.Blocks {
			if k.ID == m[1] {
				db.Blocks = append(db.Blocks[:i:i], db.Blocks[i+1:]...)
				saveDb()
				send(w, 200, obj{"ok": true})
				return
			}
		}
		send(w, 404, obj{"error": "Nincs ilyen zárás."})
		return
	}

	if p == "/api/admin/settings" && r.Method == "PUT" {
		s := body
		next := settings.clone()
		if truthy(s["hours"]) {
			dayNames := []string{"vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"}
			for d := 0; d < 7; d++ {
				v, present := elem(s["hours"], d)
				if !present {
					continue
				}
				if v == nil || v == false {
					next.Hours[strconv.Itoa(d)] = nil
					continue
				}
				if a, ok := v.([]any); ok {
					var a0, a1 any
					if len(a) > 0 {
						a0 = a[0]
					}
					if len(a) > 1 {
						a1 = a[1]
					}
					if isTime(a0) && isTime(a1) && toMin(a1.(string)) > toMin(a0.(string)) {
						next.Hours[strconv.Itoa(d)] = []string{a0.(string), a1.(string)}
						continue
					}
				}
				send(w, 400, obj{"error": "Hibás nyitvatartás (" + dayNames[d] + ")."})
				return
			}
		}
		num := func(v any, lo, hi, def int) int {
			n, ok := jsParseInt(v)
			if !ok {
				return def
			}
			return min(hi, max(lo, n))
		}
		if s["stepMinutes"] != nil {
			switch jsNumber(s["stepMinutes"]) {
			case 15, 30, 60:
				next.StepMinutes = int(jsNumber(s["stepMinutes"]))
			default:
				next.StepMinutes = 30
			}
		}
		if s["bufferMinutes"] != nil {
			next.BufferMinutes = num(s["bufferMinutes"], 0, 120, 0)
		}
		if s["minNoticeHours"] != nil {
			next.MinNoticeHours = num(s["minNoticeHours"], 0, 168, 3)
		}
		if s["horizonDays"] != nil {
			next.HorizonDays = num(s["horizonDays"], 7, 365, 60)
		}
		if s["offerPerHalfDay"] != nil {
			next.OfferPerHalfDay = num(s["offerPerHalfDay"], 1, 20, 3)
		}
		if s["notifyEmail"] != nil {
			e := oneLine(s["notifyEmail"], 120)
			if e != "" && !isEmail(e) {
				send(w, 400, obj{"error": "Hibás értesítési e-mail cím."})
				return
			}
			next.NotifyEmail = e
		}
		if s["adminUrl"] != nil {
			next.AdminURL = oneLine(s["adminUrl"], 200)
		}
		if s["siteUrl"] != nil {
			next.SiteURL = oneLine(s["siteUrl"], 200)
		}
		if truthy(s["smtp"]) {
			sm := asObj(s["smtp"])
			if sm["user"] != nil {
				u := oneLine(sm["user"], 120)
				if u != "" && !isEmail(u) {
					send(w, 400, obj{"error": "Hibás Gmail cím."})
					return
				}
				next.SMTP.User = u
			}
			if truthy(sm["pass"]) {
				next.SMTP.Pass = jsSlice(reWS.ReplaceAllString(jsString(sm["pass"]), ""), 200) // Google shows app passwords with spaces
			}
			if truthy(sm["clearPass"]) {
				next.SMTP.Pass = ""
			}
			if sm["fromName"] != nil {
				next.SMTP.FromName = oneLine(sm["fromName"], 80)
			}
			if sm["host"] != nil {
				next.SMTP.Host = oneLine(sm["host"], 120)
				if next.SMTP.Host == "" {
					next.SMTP.Host = "smtp.gmail.com"
				}
			}
			if sm["port"] != nil {
				next.SMTP.Port = num(sm["port"], 1, 65535, 465)
			}
			if sm["secure"] != nil {
				next.SMTP.Secure = truthy(sm["secure"])
			}
		}
		settings = next
		saveSettings()
		send(w, 200, obj{"ok": true, "settings": settingsForClient(), "mailConfigured": smtpConfigured()})
		return
	}

	if p == "/api/admin/test-email" && r.Method == "POST" {
		if !smtpConfigured() {
			send(w, 400, obj{"error": "Előbb add meg a Gmail címet és az alkalmazásjelszót, és mentsd el."})
			return
		}
		to := oneLine(body["to"], 120)
		if to == "" {
			to = settings.NotifyEmail
		}
		if to == "" {
			to = settings.SMTP.User
		}
		cfg := settings.SMTP
		m := testEmail()
		g.unlock()
		if err := sendMail(cfg, Message{From: cfg.User, FromName: cfg.FromName, To: to, Subject: m.Subject, Text: m.Text, HTML: m.HTML}); err != nil {
			send(w, 502, obj{"error": explain(err)})
			return
		}
		send(w, 200, obj{"ok": true, "to": to})
		return
	}

	send(w, 404, obj{"error": "not found"})
}

// elem is v[d] for a JSON array or object (as hours[d] in JavaScript).
func elem(v any, d int) (any, bool) {
	switch x := v.(type) {
	case []any:
		if d < len(x) {
			return x[d], true
		}
	case map[string]any:
		e, ok := x[strconv.Itoa(d)]
		return e, ok
	case string:
		u := []rune(x)
		if d < len(u) {
			return string(u[d]), true
		}
	}
	return nil, false
}

/*
========================================================== REMOTE LOGIN

	Password: scrypt hash in settings.remote. Session: signed cookie
	"<version>.<expiry>.<hmac>"; bumping the version logs out every device.
*/
const (
	cookieName  = "essz_remote"
	sessionDays = 60
)

func remoteEnabled() bool { return settings.Remote != nil && settings.Remote.Hash != "" }

func hashPassword(pw, salt string) string {
	return fmt.Sprintf("%x", scryptKey([]byte(pw), []byte(salt), 16384, 8, 1, 64))
}

func setRemotePassword(pw string) {
	salt := randHex(16)
	ver := 1
	if settings.Remote != nil {
		ver = settings.Remote.Ver + 1
	}
	settings.Remote = &Remote{Hash: hashPassword(pw, salt), Salt: salt, Ver: ver, SetAt: nowISO()}
	saveSettings()
}

func checkPassword(v any, hash, salt string) bool {
	pw, ok := v.(string)
	if !ok || pw == "" || jsLen(pw) > 200 {
		return false
	}
	return hmac.Equal([]byte(hashPassword(pw, salt)), []byte(hash))
}

func sign(v string) string {
	m := hmac.New(sha256.New, []byte(settings.Secret+"|remote"))
	m.Write([]byte(v))
	return fmt.Sprintf("%x", m.Sum(nil))
}

func makeSession() string {
	v := strconv.Itoa(settings.Remote.Ver) + "." + strconv.FormatInt(time.Now().UnixMilli()+sessionDays*86400000, 10)
	return v + "." + sign(v)
}

func cookieValue(r *http.Request, name string) string {
	out := map[string]string{}
	for _, c := range strings.Split(strings.Join(r.Header.Values("Cookie"), "; "), ";") {
		if i := strings.Index(c, "="); i > 0 {
			out[jsTrim(c[:i])] = jsTrim(c[i+1:])
		}
	}
	return out[name]
}

func validSession(r *http.Request) bool {
	if !remoteEnabled() {
		return false
	}
	t := cookieValue(r, cookieName)
	if t == "" {
		return false
	}
	parts := strings.Split(t, ".")
	if len(parts) != 3 {
		return false
	}
	if !hmac.Equal([]byte(parts[2]), []byte(sign(parts[0]+"."+parts[1]))) {
		return false
	}
	return jsNumber(parts[0]) == float64(settings.Remote.Ver) && jsNumber(parts[1]) > float64(time.Now().UnixMilli())
}

var reHTTPS = regexp.MustCompile(`"scheme":"https"`)

func isHTTPS(r *http.Request) bool {
	return r.Header.Get("X-Forwarded-Proto") == "https" || reHTTPS.MatchString(r.Header.Get("Cf-Visitor"))
}

func sessionCookie(r *http.Request, value string, maxAge int) string {
	// Lax (not Strict): the session must survive opening the app from the link in a notification e-mail.
	// Cross-site writes are still blocked by the X-Esszencia header check.
	c := cookieName + "=" + value + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + strconv.Itoa(maxAge)
	if isHTTPS(r) {
		c += "; Secure"
	}
	return c
}

var loginFails = map[string][]int64{}

func tooManyFails(key string, max int, windowMs int64) bool {
	t := time.Now().UnixMilli()
	var arr []int64
	for _, x := range loginFails[key] {
		if t-x < windowMs {
			arr = append(arr, x)
		}
	}
	loginFails[key] = arr
	return len(arr) >= max
}
func addFail(key string) { loginFails[key] = append(loginFails[key], time.Now().UnixMilli()) }

var loginFiles = map[string]string{"/login": "login.html", "/login.js": "login.js", "/admin.css": "admin.css", "/icon.svg": "icon.svg", "/icon-192.png": "icon-192.png", "/icon-512.png": "icon-512.png", "/manifest.webmanifest": "manifest.webmanifest"}

func remoteAPI(w http.ResponseWriter, r *http.Request, g *guard) {
	w.Header().Set("Strict-Transport-Security", "max-age=15552000")
	p := reTrailSlash.ReplaceAllString(urlPath(r), "")
	if p == "" {
		p = "/"
	}
	g.lock()

	if p == "/api/login-info" && r.Method == "GET" {
		send(w, 200, obj{"enabled": remoteEnabled()})
		return
	}
	if p == "/api/login" && r.Method == "POST" {
		if r.Header.Get("X-Esszencia") != "1" {
			send(w, 403, obj{"error": "forbidden"})
			return
		}
		ip := clientIP(r)
		if !remoteEnabled() {
			send(w, 403, obj{"error": "A távoli belépés nincs bekapcsolva. Az Umbrelen, a Beállításoknál lehet bekapcsolni."})
			return
		}
		if tooManyFails("ip:"+ip, 8, 15*60000) || tooManyFails("all", 40, 3600000) {
			send(w, 429, obj{"error": "Túl sok sikertelen próbálkozás. Próbáld újra 15 perc múlva."})
			return
		}
		g.unlock()
		body, herr := readBody(r, 4096)
		if herr != nil {
			send(w, 400, obj{"error": "invalid"})
			return
		}
		g.lock()
		hash, salt := settings.Remote.Hash, settings.Remote.Salt
		g.unlock()
		ok := checkPassword(body["password"], hash, salt) // scrypt runs without holding the lock
		g.lock()
		if !ok || !remoteEnabled() {
			addFail("ip:" + ip)
			addFail("all")
			g.unlock()
			time.Sleep(600 * time.Millisecond)
			send(w, 401, obj{"error": "Hibás jelszó."})
			return
		}
		delete(loginFails, "ip:"+ip)
		send(w, 200, obj{"ok": true}, "Set-Cookie", sessionCookie(r, makeSession(), sessionDays*86400))
		return
	}
	if p == "/api/logout" && r.Method == "POST" {
		if r.Header.Get("X-Esszencia") != "1" {
			send(w, 403, obj{"error": "forbidden"})
			return
		}
		send(w, 200, obj{"ok": true}, "Set-Cookie", sessionCookie(r, "", 0))
		return
	}
	if f, ok := loginFiles[p]; ok && (r.Method == "GET" || r.Method == "HEAD") && (p != "/login" || !validSession(r)) {
		serveStatic(w, "/"+f)
		return
	}
	if !validSession(r) {
		if strings.HasPrefix(p, "/api/") {
			send(w, 401, obj{"error": "Jelentkezz be újra.", "login": true})
			return
		}
		w.Header().Set("Location", "/login")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(302)
		return
	}
	if p == "/login" {
		w.Header().Set("Location", "/")
		w.WriteHeader(302)
		return
	}
	g.unlock()
	adminAPI(w, r, g, true)
}

/* ------------------------------------------------------------ housekeeping */
func purge() {
	// Personal data is not kept forever: bookings older than a year are removed.
	cutoff := addDays(now().Date, -365)
	before := len(db.Bookings) + len(db.Blocks)
	bs := []*Booking{}
	for _, b := range db.Bookings {
		if b.Date >= cutoff {
			bs = append(bs, b)
		}
	}
	ks := []*Block{}
	for _, k := range db.Blocks {
		to := k.DateTo
		if to == "" {
			to = k.Date
		}
		if to >= cutoff {
			ks = append(ks, k)
		}
	}
	db.Bookings, db.Blocks = bs, ks
	if len(bs)+len(ks) != before {
		saveDb()
	}
}

func every(d time.Duration, f func()) {
	go func() {
		for range time.Tick(d) {
			func() {
				mu.Lock()
				defer mu.Unlock()
				defer func() {
					if e := recover(); e != nil {
						log.Println("[timer]", e)
					}
				}()
				f()
			}()
		}
	}()
}

/* ------------------------------------------------------------------ start */
func wrap(name string, h func(http.ResponseWriter, *http.Request, *guard)) http.Handler {
	return http.HandlerFunc(func(w0 http.ResponseWriter, r *http.Request) {
		w := &resp{ResponseWriter: w0}
		g := &guard{}
		defer func() {
			e := recover()
			g.unlock()
			if e != nil {
				log.Printf("[%s] %v\n%s", name, e, debug.Stack())
				if !w.sent {
					send(w, 500, obj{"error": "Szerverhiba."})
				}
			}
		}()
		h(w, r, g)
	})
}

func server(port int, h http.Handler) *http.Server {
	return &http.Server{Addr: ":" + strconv.Itoa(port), Handler: h, ReadTimeout: 30 * time.Second, ReadHeaderTimeout: 30 * time.Second}
}

func main() {
	log.SetFlags(0)
	loadState()
	mu.Lock()
	purge()
	mu.Unlock()
	every(12*time.Hour, purge)
	every(10*time.Minute, pruneHits)
	every(30*time.Second, flushStats)

	servers := []*http.Server{
		server(publicPort, wrap("public", publicAPI)),
		server(adminPort, wrap("admin", func(w http.ResponseWriter, r *http.Request, g *guard) { adminAPI(w, r, g, false) })),
	}
	names := []string{"Public booking API", "Admin app"}
	if remotePort != 0 {
		servers = append(servers, server(remotePort, wrap("remote", remoteAPI)))
		names = append(names, "Remote admin (own password)")
	}
	for i, s := range servers {
		s, name := s, names[i]
		go func() {
			log.Printf("%s on %s", name, s.Addr)
			if err := s.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Fatal(err)
			}
		}()
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGTERM, syscall.SIGINT)
	<-sig
	mu.Lock()
	func() { defer func() { recover() }(); flushStats() }()
	mu.Unlock()
	os.Exit(0)
}
