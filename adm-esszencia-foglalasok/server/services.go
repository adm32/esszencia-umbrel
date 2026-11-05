package main

/* Treatment list for the admin app ("Új foglalás" picker).
   Read from the website's own price list (assets/js/services.js) so the two
   never drift apart. The file is parsed as DATA (a tolerant JSON5-style
   reader) – it is never executed. Last good copy is cached on disk; a copy
   bundled with the app is the final fallback. */

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const servicesTTL = 10 * time.Minute

type svcItem struct {
	Name     string  `json:"name"`
	Price    string  `json:"price"`
	Duration string  `json:"duration"`
	Minutes  float64 `json:"minutes"`
}
type svcCat struct {
	Name  string    `json:"name"`
	Items []svcItem `json:"items"`
}
type svcData struct {
	Categories []svcCat `json:"categories"`
}
type svcResult struct {
	at     time.Time
	source string
	data   svcData
}

var (
	svcMu  sync.Mutex
	svcMem *svcResult
)

func isWordStart(c byte) bool {
	return c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' || c == '_' || c == '$'
}
func isWord(c byte) bool { return isWordStart(c) || c >= '0' && c <= '9' }

/* ---- JS object literal → JSON (strings, comments, bare keys, trailing commas) ---- */
func literalToJSON(src string) (any, error) {
	start := strings.Index(src, "ESSZENCIA_SERVICES")
	if start < 0 {
		return nil, errors.New("no ESSZENCIA_SERVICES")
	}
	i := strings.Index(src[start:], "{")
	if i < 0 {
		return nil, errors.New("no object")
	}
	i += start
	var out strings.Builder
	depth := 0
	n := len(src)
	trimComma := func() {
		s := strings.TrimRight(out.String(), " \t\n\r\v\f")
		if strings.HasSuffix(s, ",") {
			s = s[:len(s)-1]
			out.Reset()
			out.WriteString(s)
		}
	}
loop:
	for ; i < n; i++ {
		c := src[i]
		switch {
		case c == '/' && i+1 < n && src[i+1] == '/':
			for i < n && src[i] != '\n' {
				i++
			}
		case c == '/' && i+1 < n && src[i+1] == '*':
			e := strings.Index(src[i+2:], "*/")
			if e < 0 {
				return nil, errors.New("comment")
			}
			i = i + 2 + e + 1
		case c == '"' || c == '\'':
			var s strings.Builder
			for i++; i < n && src[i] != c; i++ {
				if src[i] == '\\' {
					s.WriteByte(src[i])
					if i+1 < n {
						s.WriteByte(src[i+1])
					}
					i++
				} else if src[i] == '\n' {
					return nil, errors.New("newline in string")
				} else {
					s.WriteByte(src[i])
				}
			}
			v := s.String()
			if c == '\'' {
				v = strings.ReplaceAll(strings.ReplaceAll(v, `\'`, "'"), `"`, `\"`)
			}
			out.WriteString(`"` + v + `"`)
		case isWordStart(c):
			j := i
			for i < n && isWord(src[i]) {
				i++
			}
			w := src[j:i]
			i--
			if w == "true" || w == "false" || w == "null" {
				out.WriteString(w)
			} else {
				out.WriteString(`"` + w + `"`)
			}
		case c == '{' || c == '[':
			depth++
			out.WriteByte(c)
		case c == '}' || c == ']':
			trimComma()
			depth--
			out.WriteByte(c)
			if depth == 0 {
				break loop
			}
		case strings.IndexByte(" \t\n\r\v\f,:-.0123456789+", c) >= 0:
			out.WriteByte(c)
		default:
			return nil, fmt.Errorf("unexpected %q at %d", c, i)
		}
	}
	var v any
	if err := json.Unmarshal([]byte(out.String()), &v); err != nil {
		return nil, err
	}
	return v, nil
}

func hu(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	if m, ok := v.(map[string]any); ok {
		if truthy(m["hu"]) {
			return jsString(m["hu"])
		}
	}
	return ""
}

var (
	reNum = regexp.MustCompile(`\d+(?:[.,]\d+)?`)
	reOra = regexp.MustCompile(`óra`)
)

func minutesOf(item, cat obj) float64 {
	if truthy(item["minutes"]) {
		return jsNumber(item["minutes"])
	}
	d := hu(item["duration"])
	if nums := reNum.FindAllString(d, -1); len(nums) > 0 {
		m := math.Inf(-1)
		for _, x := range nums {
			f, _ := strconv.ParseFloat(strings.Replace(x, ",", ".", 1), 64)
			m = math.Max(m, f)
		}
		if reOra.MatchString(d) {
			m *= 60
		}
		return jsRound(m)
	}
	if truthy(cat["minutes"]) {
		return jsNumber(cat["minutes"])
	}
	return 60
}

func normalize(raw any) (svcData, error) {
	cats := []svcCat{}
	r, _ := raw.(map[string]any)
	list, _ := r["categories"].([]any)
	for _, cv := range list {
		c, ok := cv.(map[string]any)
		if !ok {
			continue
		}
		items, ok := c["items"].([]any)
		if !ok || len(items) == 0 {
			continue
		}
		cat := svcCat{Name: hu(c["name"]), Items: []svcItem{}}
		for _, iv := range items {
			it, ok := iv.(map[string]any)
			if !ok || hu(it["name"]) == "" {
				continue
			}
			cat.Items = append(cat.Items, svcItem{Name: hu(it["name"]), Price: hu(it["price"]), Duration: hu(it["duration"]), Minutes: minutesOf(it, c)})
		}
		cats = append(cats, cat)
	}
	if len(cats) == 0 {
		return svcData{}, errors.New("empty list")
	}
	return svcData{Categories: cats}, nil
}

var svcClient = &http.Client{
	Timeout:       4 * time.Second,
	Transport:     &http.Transport{Proxy: nil},
	CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
}

func fetchText(url string) (string, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Esszencia-Foglalasok")
	res, err := svcClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return "", fmt.Errorf("HTTP %d", res.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, 512*1024+1))
	if err != nil {
		return "", err
	}
	if len(body) > 512*1024 {
		return "", errors.New("too large")
	}
	return string(body), nil
}

func loadServices(dataDir, siteURL string, force bool) svcResult {
	svcMu.Lock()
	if !force && svcMem != nil && time.Since(svcMem.at) < servicesTTL {
		r := *svcMem
		svcMu.Unlock()
		return r
	}
	svcMu.Unlock()

	set := func(r svcResult) svcResult { svcMu.Lock(); svcMem = &r; svcMu.Unlock(); return r }
	urls := []string{os.Getenv("SITE_SERVICES_URL")}
	if urls[0] == "" {
		urls[0] = "http://host.docker.internal:4751/assets/js/services.js"
	}
	if siteURL != "" {
		urls = append(urls, strings.TrimRight(siteURL, "/")+"/assets/js/services.js")
	}
	for _, u := range urls {
		text, err := fetchText(u)
		if err != nil {
			continue
		}
		raw, err := literalToJSON(text)
		if err != nil {
			continue
		}
		data, err := normalize(raw)
		if err != nil {
			continue
		}
		_ = os.WriteFile(filepath.Join(dataDir, "services-cache.json"), toJSON(data, false), 0o644) // cache is optional
		return set(svcResult{at: time.Now(), source: "site", data: data})
	}
	for _, f := range [][2]string{{filepath.Join(dataDir, "services-cache.json"), "cache"}, {bundledServices, "bundled"}} {
		b, err := os.ReadFile(f[0])
		if err != nil {
			continue
		}
		var raw any
		if json.Unmarshal(b, &raw) != nil {
			continue
		}
		data, err := normalize(raw)
		if err != nil {
			continue
		}
		return set(svcResult{at: time.Now().Add(-servicesTTL + time.Minute), source: f[1], data: data}) // retry the site in a minute
	}
	return svcResult{at: time.Now(), source: "none", data: svcData{Categories: []svcCat{}}}
}
