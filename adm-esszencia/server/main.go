// Esszencia – static site server (runs inside the Umbrel app container).
//
// Does exactly what the earlier nginx.conf did: serves www/, gzip, caching
// rules, strict security headers, the nginx-style 404 page, and proxies
// /api/ to the booking API of the "Esszencia Foglalások" app (port 4753).
// If that app isn't installed/running, the website falls back to phone / e-mail.
package main

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	root     = envOr("WWW_DIR", "/www")
	listen   = envOr("LISTEN", ":80")
	upstream = envOr("API_UPSTREAM", "host.docker.internal:4753")
)

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// --- security headers ---
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"

func pageHeaders(h http.Header) {
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
	h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()")
	h.Set("Content-Security-Policy", csp)
}

// Content types as nginx's mime.types + "charset utf-8" gave them.
var mimeTypes = map[string]string{
	".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
	".css": "text/css", ".js": "application/javascript; charset=utf-8",
	".json": "application/json", ".txt": "text/plain; charset=utf-8", ".xml": "text/xml; charset=utf-8",
	".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
	".png": "image/png", ".gif": "image/gif", ".ico": "image/x-icon", ".avif": "image/avif",
	".woff": "font/woff", ".woff2": "font/woff2", ".pdf": "application/pdf", ".webmanifest": "application/octet-stream",
}

// --- compression (gzip_types + text/html, min length 512, level 6) ---
var gzipTypes = map[string]bool{"text/html": true, "text/css": true, "application/javascript": true, "text/javascript": true, "image/svg+xml": true, "application/json": true, "text/plain": true}

func compressible(ct string, size int64) bool {
	base, _, _ := strings.Cut(ct, ";")
	return gzipTypes[strings.TrimSpace(strings.ToLower(base))] && size >= 512
}
func acceptsGzip(r *http.Request) bool {
	// gzip_proxied off: requests that came through another proxy (Via) are not compressed
	if r.Header.Get("Via") != "" {
		return false
	}
	for _, part := range strings.Split(r.Header.Get("Accept-Encoding"), ",") {
		name, q, _ := strings.Cut(strings.TrimSpace(part), ";")
		if strings.EqualFold(strings.TrimSpace(name), "gzip") && strings.ReplaceAll(strings.TrimSpace(q), " ", "") != "q=0" {
			return true
		}
	}
	return false
}
func gz(b []byte) []byte {
	var buf bytes.Buffer
	w, _ := gzip.NewWriterLevel(&buf, 6)
	w.Write(b)
	w.Close()
	return buf.Bytes()
}

type gzEntry struct {
	mod  time.Time
	size int64
	data []byte
}

var (
	gzCache   = map[string]gzEntry{}
	gzCacheMu sync.Mutex
)

func gzFile(file string, fi os.FileInfo, raw []byte) []byte {
	gzCacheMu.Lock()
	defer gzCacheMu.Unlock()
	if e, ok := gzCache[file]; ok && e.mod.Equal(fi.ModTime()) && e.size == fi.Size() {
		return e.data
	}
	d := gz(raw)
	gzCache[file] = gzEntry{fi.ModTime(), fi.Size(), d}
	return d
}

// --- error pages ---
// 404 goes to /404.html (internal location → only the server-level headers);
// other errors keep the headers of the location they happened in.
func errorPage(w http.ResponseWriter, r *http.Request, code int) {
	if code == 404 {
		for k := range w.Header() {
			delete(w.Header(), k)
		}
		pageHeaders(w.Header())
		if data, fi, err := readFile(filepath.Join(root, "404.html")); err == nil {
			sendBytes(w, r, 404, "text/html; charset=utf-8", data, fi, false)
			return
		}
	}
	text := strconv.Itoa(code) + " " + http.StatusText(code)
	switch code {
	case 504:
		text = "504 Gateway Time-out"
	case 405:
		text = "405 Not Allowed"
	}
	body := []byte("<html>\r\n<head><title>" + text + "</title></head>\r\n<body>\r\n<center><h1>" + text + "</h1></center>\r\n</body>\r\n</html>\r\n")
	sendBytes(w, r, code, "text/html; charset=utf-8", body, nil, false)
}

func readFile(file string) ([]byte, os.FileInfo, error) {
	fi, err := os.Stat(file)
	if err != nil {
		return nil, nil, err
	}
	if !fi.Mode().IsRegular() {
		return nil, fi, fmt.Errorf("not a file")
	}
	data, err := os.ReadFile(file)
	return data, fi, err
}

func etagOf(fi os.FileInfo) string {
	return fmt.Sprintf(`"%x-%x"`, fi.ModTime().Unix(), fi.Size())
}

func notModified(r *http.Request, etag string, mod time.Time) bool {
	if inm := r.Header.Get("If-None-Match"); inm != "" {
		for _, t := range strings.Split(inm, ",") {
			t = strings.TrimPrefix(strings.TrimSpace(t), "W/")
			if t == "*" || t == strings.TrimPrefix(etag, "W/") {
				return true
			}
		}
		return false
	}
	if ims := r.Header.Get("If-Modified-Since"); ims != "" {
		if t, err := http.ParseTime(ims); err == nil && !mod.Truncate(time.Second).After(t) {
			return true
		}
	}
	return false
}

// sendBytes writes a static body with gzip, ETag/Last-Modified and 304 handling like nginx.
func sendBytes(w http.ResponseWriter, r *http.Request, status int, ct string, data []byte, fi os.FileInfo, cache bool) {
	h := w.Header()
	h.Set("Content-Type", ct)
	zip := compressible(ct, int64(len(data))) && (status == 200 || status == 403 || status == 404)
	if zip {
		h.Set("Vary", "Accept-Encoding")
	}
	if fi != nil && status == 200 {
		etag := etagOf(fi)
		if zip && acceptsGzip(r) {
			etag = "W/" + etag
		}
		h.Set("Last-Modified", fi.ModTime().UTC().Format(http.TimeFormat))
		h.Set("ETag", etag)
		if notModified(r, etag, fi.ModTime()) {
			h.Del("Content-Type")
			w.WriteHeader(304)
			return
		}
	}
	if zip && acceptsGzip(r) {
		if fi != nil && cache {
			data = gzFile(r.URL.Path, fi, data)
		} else {
			data = gz(data)
		}
		h.Set("Content-Encoding", "gzip")
	} else if fi != nil && status == 200 {
		h.Set("Accept-Ranges", "bytes")
		if rg := r.Header.Get("Range"); rg != "" && r.Method == "GET" {
			http.ServeContent(w, r, "", fi.ModTime(), bytes.NewReader(data))
			return
		}
	}
	h.Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(status)
	if r.Method != "HEAD" {
		w.Write(data)
	}
}

// --- static files ---
var (
	reAssets = regexp.MustCompile(`(?i)\.(?:webp|jpg|jpeg|png|svg|ico|woff|woff2)$`)
	reCode   = regexp.MustCompile(`(?i)\.(?:css|js)$`)
)

func serveStatic(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Path
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	clean := path.Clean(p)
	if strings.HasSuffix(p, "/") && clean != "/" {
		clean += "/"
	}
	r.URL.Path = clean

	if clean == "/404.html" { // location = /404.html { internal; }
		errorPage(w, r, 404)
		return
	}

	h := w.Header()
	var cacheControl string
	switch {
	case reAssets.MatchString(clean): // images & icons rarely change → cache for a week
		cacheControl = "public, max-age=604800"
		h.Set("X-Content-Type-Options", "nosniff")
	case reCode.MatchString(clean): // CSS/JS: always revalidate (cheap 304 when unchanged)
		cacheControl = "no-cache"
		h.Set("X-Content-Type-Options", "nosniff")
	default: // location /
		cacheControl = "no-cache"
		pageHeaders(h)
	}
	h.Set("Cache-Control", cacheControl)

	file := filepath.Join(root, filepath.FromSlash(clean))
	fi, err := os.Stat(file)
	if err == nil && fi.IsDir() {
		if reAssets.MatchString(clean) || reCode.MatchString(clean) { // try_files $uri =404
			errorPage(w, r, 404)
			return
		}
		// try_files $uri/ → index index.html (the index is then served by location /)
		idx := filepath.Join(file, "index.html")
		ifi, err2 := os.Stat(idx)
		if err2 != nil || !ifi.Mode().IsRegular() {
			errorPage(w, r, 403)
			return
		}
		file = idx
		h.Del("X-Content-Type-Options")
		pageHeaders(h)
		h.Set("Cache-Control", "no-cache")
	}
	data, fi, err := readFile(file)
	if err != nil {
		errorPage(w, r, 404)
		return
	}
	if r.Method != "GET" && r.Method != "HEAD" {
		errorPage(w, r, 405)
		return
	}
	ct := mimeTypes[strings.ToLower(filepath.Ext(file))]
	if ct == "" {
		ct = "application/octet-stream"
	}
	sendBytes(w, r, 200, ct, data, fi, true)
}

// --- /api/ → booking app ---
func apiProxy() http.Handler {
	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           (&net.Dialer{Timeout: 3 * time.Second}).DialContext, // proxy_connect_timeout 3s
		ResponseHeaderTimeout: 20 * time.Second,                                    // proxy_read_timeout 20s
		MaxIdleConns:          16,
		IdleConnTimeout:       60 * time.Second,
		DisableCompression:    true,
	}
	target := &url.URL{Scheme: "http", Host: upstream}
	rp := &httputil.ReverseProxy{
		Transport: transport,
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.Out.URL.Scheme = target.Scheme
			pr.Out.URL.Host = target.Host
			pr.Out.Host = hostOnly(pr.In.Host) // proxy_set_header Host $host
			ip, _, err := net.SplitHostPort(pr.In.RemoteAddr)
			if err != nil {
				ip = pr.In.RemoteAddr
			}
			if prior := pr.In.Header.Values("X-Forwarded-For"); len(prior) > 0 {
				ip = strings.Join(prior, ", ") + ", " + ip
			}
			pr.Out.Header.Set("X-Forwarded-For", ip)
			if cf := pr.In.Header.Get("Cf-Connecting-Ip"); cf != "" {
				pr.Out.Header.Set("Cf-Connecting-Ip", cf)
			}
		},
		ModifyResponse: func(res *http.Response) error {
			res.Header.Set("Cache-Control", "no-store")
			res.Header.Set("X-Content-Type-Options", "nosniff")
			st := res.StatusCode
			if res.Header.Get("Content-Encoding") == "" && (st == 200 || st == 403 || st == 404) && acceptsGzip(res.Request) {
				ct := res.Header.Get("Content-Type")
				if base, _, _ := strings.Cut(ct, ";"); gzipTypes[strings.TrimSpace(strings.ToLower(base))] {
					body, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
					res.Body.Close()
					if err != nil {
						return err
					}
					res.Header.Set("Vary", "Accept-Encoding")
					if len(body) >= 512 {
						body = gz(body)
						res.Header.Set("Content-Encoding", "gzip")
					}
					res.Body = io.NopCloser(bytes.NewReader(body))
					res.ContentLength = int64(len(body))
					res.Header.Set("Content-Length", strconv.Itoa(len(body)))
				}
			}
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			code := 502
			if ne, ok := err.(net.Error); ok && ne.Timeout() && !strings.Contains(err.Error(), "dial") {
				code = 504
			}
			log.Printf("[api] %s %s: %v", r.Method, r.URL.Path, err)
			apiErrorHeaders(w)
			errorPage(w, r, code)
		},
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ContentLength > 32*1024 { // client_max_body_size 32k
			apiErrorHeaders(w)
			errorPage(w, r, 413)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 32*1024)
		rp.ServeHTTP(w, r)
	})
}

func apiErrorHeaders(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
}

func hostOnly(h string) string {
	if host, _, err := net.SplitHostPort(h); err == nil {
		return strings.ToLower(host)
	}
	return strings.ToLower(h)
}

func main() {
	log.SetFlags(0)
	api := apiProxy()
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(path.Clean("/"+r.URL.Path), "/api/") || r.URL.Path == "/api/" {
			api.ServeHTTP(w, r)
			return
		}
		serveStatic(w, r)
	})
	srv := &http.Server{Addr: listen, Handler: handler, ReadHeaderTimeout: 60 * time.Second, IdleTimeout: 75 * time.Second}
	log.Printf("Esszencia website on %s (www: %s, api → %s)", listen, root, upstream)
	log.Fatal(srv.ListenAndServe())
}
