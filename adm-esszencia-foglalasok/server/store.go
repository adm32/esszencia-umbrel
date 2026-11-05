package main

/* Storage (db.json, settings.json, stats*.json in DATA_DIR) and Budapest
   wall-clock time helpers. The JSON files keep the exact format the earlier
   Node.js version wrote, so existing data keeps working. */

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata" // Europe/Budapest even in images without zoneinfo
)

/* ------------------------------------------------------------------ types */
type Service struct {
	Hu       string `json:"hu"`
	Local    string `json:"local"`
	Category string `json:"category"`
}

type MailRec struct {
	Kind  string `json:"kind"`
	At    string `json:"at"`
	Ok    bool   `json:"ok"`
	Error string `json:"error"`
}

type Booking struct {
	ID        string   `json:"id"`
	Status    string   `json:"status"`
	Source    string   `json:"source"`
	Date      string   `json:"date"`
	Time      string   `json:"time"`
	Minutes   int      `json:"minutes"`
	Service   Service  `json:"service"`
	Note      string   `json:"note"`
	Name      string   `json:"name"`
	Phone     string   `json:"phone"`
	Email     string   `json:"email"`
	Lang      string   `json:"lang"`
	CreatedAt string   `json:"createdAt"`
	Message   *string  `json:"message,omitempty"`
	UpdatedAt string   `json:"updatedAt,omitempty"`
	Mail      *MailRec `json:"mail,omitempty"`
}

type Block struct {
	ID        string `json:"id"`
	Date      string `json:"date"`
	DateTo    string `json:"dateTo"`
	AllDay    bool   `json:"allDay"`
	From      string `json:"from"`
	To        string `json:"to"`
	Note      string `json:"note"`
	CreatedAt string `json:"createdAt"`
}

type DB struct {
	Bookings []*Booking `json:"bookings"`
	Blocks   []*Block   `json:"blocks"`
}

type SMTP struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Secure   bool   `json:"secure"`
	User     string `json:"user"`
	Pass     string `json:"pass"`
	FromName string `json:"fromName"`
}

type Remote struct {
	Hash  string `json:"hash,omitempty"`
	Salt  string `json:"salt,omitempty"`
	Ver   int    `json:"ver"`
	SetAt string `json:"setAt,omitempty"`
}

type Settings struct {
	// JS weekday keys: "0" = vasárnap … "6" = szombat. null = zárva.
	Hours           map[string][]string `json:"hours"`
	StepMinutes     int                 `json:"stepMinutes"`     // a kezdési időpontok lépésköze
	BufferMinutes   int                 `json:"bufferMinutes"`   // szünet két vendég között
	MinNoticeHours  int                 `json:"minNoticeHours"`  // ennyi órával előre lehet legkorábban foglalni
	HorizonDays     int                 `json:"horizonDays"`     // legfeljebb ennyi nappal előre
	OfferPerHalfDay int                 `json:"offerPerHalfDay"` // adatvédelem: naponta legfeljebb ennyi időpont délelőtt és délután
	SMTP            SMTP                `json:"smtp"`
	NotifyEmail     string              `json:"notifyEmail"`
	AdminURL        string              `json:"adminUrl"`
	SiteURL         string              `json:"siteUrl"`
	Secret          string              `json:"secret,omitempty"`
	Remote          *Remote             `json:"remote,omitempty"`
}

func defaultSettings() *Settings {
	wd := []string{"09:00", "18:00"}
	return &Settings{
		Hours:           map[string][]string{"0": nil, "1": wd, "2": wd, "3": wd, "4": wd, "5": wd, "6": {"08:00", "12:00"}},
		StepMinutes:     30,
		BufferMinutes:   0,
		MinNoticeHours:  3,
		HorizonDays:     60,
		OfferPerHalfDay: 3,
		SMTP:            SMTP{Host: "smtp.gmail.com", Port: 465, Secure: true, User: "marianna.kosmetik@gmail.com", Pass: "", FromName: "Esszencia Szépségműhely"},
		NotifyEmail:     "marianna.kosmetik@gmail.com",
		AdminURL:        "http://100.82.237.74:4752",
		SiteURL:         "https://esszenciakozmetika.hu",
	}
}

// clone is JSON.parse(JSON.stringify(settings)).
func (s *Settings) clone() *Settings {
	n := *s
	n.Hours = map[string][]string{}
	for k, v := range s.Hours {
		if v != nil {
			v = append([]string(nil), v...)
		}
		n.Hours[k] = v
	}
	if s.Remote != nil {
		r := *s.Remote
		n.Remote = &r
	}
	return &n
}

type DayRec struct {
	Views    int            `json:"views"`
	Visitors int            `json:"visitors"`
	Dev      map[string]int `json:"dev"`
	Lang     map[string]int `json:"lang"`
	Ref      map[string]int `json:"ref"`
	Ev       map[string]int `json:"ev"`
}

func newDayRec() *DayRec {
	return &DayRec{Dev: map[string]int{}, Lang: map[string]int{}, Ref: map[string]int{}, Ev: map[string]int{}}
}
func (r *DayRec) fill() {
	for _, m := range []*map[string]int{&r.Dev, &r.Lang, &r.Ref, &r.Ev} {
		if *m == nil {
			*m = map[string]int{}
		}
	}
}

type Stats struct {
	Days map[string]*DayRec `json:"days"`
}

type TodayVis struct {
	Date string   `json:"date"`
	Salt string   `json:"salt"`
	Seen []string `json:"seen"`
}

/* ---------------------------------------------------------------- file io */
func readJSON(file string, into any) bool {
	data, err := os.ReadFile(file)
	if err != nil {
		return false
	}
	if !json.Valid(data) {
		return false
	}
	_ = json.Unmarshal(data, into) // type mismatches skip that field, like a lenient JS read
	return true
}

func writeJSON(file string, v any) {
	tmp := file + ".tmp"
	if err := os.WriteFile(tmp, toJSON(v, true), 0o600); err != nil {
		panic(err)
	}
	if err := os.Rename(tmp, file); err != nil {
		panic(err)
	}
}

func randHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

/* ------------------------------------------------------------------- time */
var budapest = mustLoc("Europe/Budapest")

func mustLoc(name string) *time.Location {
	l, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return l
}

func nowISO() string { return isoString(time.Now()) }

// isoString is Date.prototype.toISOString.
func isoString(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

func toMin(t string) int {
	h, m, _ := strings.Cut(t, ":")
	hh, _ := strconv.Atoi(h)
	mm, _ := strconv.Atoi(m)
	return hh*60 + mm
}
func fromMin(n int) string { return fmt.Sprintf("%02d:%02d", n/60, n%60) }

func parseYMD(date string) (int, int, int) {
	p := strings.SplitN(date, "-", 3)
	if len(p) != 3 {
		return 0, 0, 0
	}
	y, _ := strconv.Atoi(p[0])
	m, _ := strconv.Atoi(p[1])
	d, _ := strconv.Atoi(p[2])
	return y, m, d
}

// dayNum: days since 1970-01-01 (UTC calendar).
func dayNum(date string) int {
	y, m, d := parseYMD(date)
	return int(time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC).Unix() / 86400)
}
func weekday(date string) int { return (dayNum(date) + 4) % 7 } // 1970-01-01 was a Thursday
func addDays(date string, n int) string {
	return time.Unix(int64(dayNum(date)+n)*86400, 0).UTC().Format("2006-01-02")
}
func isDate(v any) bool {
	s, ok := v.(string)
	if !ok || !reDate.MatchString(s) {
		return false
	}
	y, _, _ := parseYMD(s)
	return y >= 100 && addDays(s, 0) == s
}

type nowT struct {
	Date string
	Min  int
	Abs  int
}

func now() nowT {
	t := time.Now().In(budapest)
	date := t.Format("2006-01-02")
	min := t.Hour()*60 + t.Minute()
	return nowT{date, min, dayNum(date)*1440 + min}
}

func budapestDate(iso string) (string, bool) {
	t, err := time.Parse(time.RFC3339Nano, iso)
	if err != nil {
		return "", false
	}
	return t.In(budapest).Format("2006-01-02"), true
}
