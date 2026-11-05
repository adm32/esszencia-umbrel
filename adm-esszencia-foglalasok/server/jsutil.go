package main

/* Small helpers that reproduce how the original JavaScript server read the
   loosely typed JSON it received (String(v), +v, parseInt, truthiness, trim),
   so every request is validated exactly as before. */

import (
	"bytes"
	"encoding/json"
	"math"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf16"
)

// obj is a decoded JSON object from a request body.
type obj = map[string]any

// JavaScript's \s (whitespace + line terminators).
const jsSpace = `\t\n\v\f\r \x{00a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}`

var (
	reCtrl   = regexp.MustCompile(`[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]`)
	reSpaces = regexp.MustCompile(`[` + jsSpace + `]+`)
	reEmail  = regexp.MustCompile(`(?i)^[^` + jsSpace + `@<>()",;:]+@[^` + jsSpace + `@<>()",;:]+\.[a-z]{2,}$`)
	rePhone  = regexp.MustCompile(`^[0-9+()/.\-` + jsSpace + `]{6,30}$`)
	reDigit  = regexp.MustCompile(`\d`)
	reDate   = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	reTime   = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)
)

func isJsSpace(r rune) bool {
	switch r {
	case '\t', '\n', '\v', '\f', '\r', ' ', 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff:
		return true
	}
	return r >= 0x2000 && r <= 0x200a
}

func jsTrim(s string) string { return strings.TrimFunc(s, isJsSpace) }

// jsLen is String.prototype.length (UTF-16 code units).
func jsLen(s string) int {
	n := 0
	for _, r := range s {
		if r >= 0x10000 {
			n += 2
		} else {
			n++
		}
	}
	return n
}

// jsSlice is s.slice(0, max) counted in UTF-16 code units.
func jsSlice(s string, max int) string {
	if jsLen(s) <= max {
		return s
	}
	u := utf16.Encode([]rune(s))
	return string(utf16.Decode(u[:max]))
}

func jsNumStr(f float64) string {
	if math.IsNaN(f) {
		return "NaN"
	}
	if math.IsInf(f, 1) {
		return "Infinity"
	}
	if math.IsInf(f, -1) {
		return "-Infinity"
	}
	if f == 0 {
		return "0"
	}
	if a := math.Abs(f); a >= 1e21 || a < 1e-6 {
		s := strconv.FormatFloat(f, 'e', -1, 64)
		return strings.Replace(strings.Replace(s, "e+0", "e+", 1), "e-0", "e-", 1)
	}
	return strconv.FormatFloat(f, 'f', -1, 64)
}

// jsString is String(v).
func jsString(v any) string {
	switch x := v.(type) {
	case nil:
		return "null"
	case string:
		return x
	case float64:
		return jsNumStr(x)
	case int:
		return strconv.Itoa(x)
	case bool:
		if x {
			return "true"
		}
		return "false"
	case []any:
		parts := make([]string, len(x))
		for i, e := range x {
			if e != nil {
				parts[i] = jsString(e)
			}
		}
		return strings.Join(parts, ",")
	default:
		return "[object Object]"
	}
}

// jsNumber is unary +v.
func jsNumber(v any) float64 {
	switch x := v.(type) {
	case nil:
		return 0
	case float64:
		return x
	case int:
		return float64(x)
	case bool:
		if x {
			return 1
		}
		return 0
	case string:
		s := jsTrim(x)
		if s == "" {
			return 0
		}
		switch s {
		case "Infinity", "+Infinity":
			return math.Inf(1)
		case "-Infinity":
			return math.Inf(-1)
		}
		ls := strings.ToLower(s)
		if len(ls) > 2 && (strings.HasPrefix(ls, "0x") || strings.HasPrefix(ls, "0o") || strings.HasPrefix(ls, "0b")) {
			base := map[byte]int{'x': 16, 'o': 8, 'b': 2}[ls[1]]
			if n, err := strconv.ParseUint(ls[2:], base, 64); err == nil {
				return float64(n)
			}
			return math.NaN()
		}
		for _, c := range s {
			if !(c >= '0' && c <= '9' || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') {
				return math.NaN()
			}
		}
		f, err := strconv.ParseFloat(s, 64)
		if err != nil {
			if ne, ok := err.(*strconv.NumError); ok && ne.Err == strconv.ErrRange {
				return f
			}
			return math.NaN()
		}
		return f
	case []any:
		if len(x) == 0 {
			return 0
		}
		if len(x) == 1 {
			return jsNumber(jsString(x[0]))
		}
		return math.NaN()
	default:
		return math.NaN()
	}
}

// jsParseInt is parseInt(v, 10); ok=false means NaN.
func jsParseInt(v any) (int, bool) {
	s := strings.TrimLeftFunc(jsString(v), isJsSpace)
	neg := false
	if s != "" && (s[0] == '+' || s[0] == '-') {
		neg = s[0] == '-'
		s = s[1:]
	}
	i := 0
	for i < len(s) && s[i] >= '0' && s[i] <= '9' {
		i++
	}
	if i == 0 {
		return 0, false
	}
	f, _ := strconv.ParseFloat(s[:i], 64)
	if f > math.MaxInt32*1000 {
		f = math.MaxInt32 * 1000
	}
	if neg {
		f = -f
	}
	return int(f), true
}

func truthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case float64:
		return x != 0 && !math.IsNaN(x)
	case int:
		return x != 0
	case string:
		return x != ""
	}
	return true
}

// or is `a || b`.
func or(vs ...any) any {
	for _, v := range vs[:len(vs)-1] {
		if truthy(v) {
			return v
		}
	}
	return vs[len(vs)-1]
}

func jsRound(f float64) float64 { return math.Floor(f + 0.5) }

func isStr(v any, s string) bool { x, ok := v.(string); return ok && x == s }

func asObj(v any) obj {
	if m, ok := v.(map[string]any); ok {
		return m
	}
	return obj{}
}

/* -------------------------------------------------------------- validation */
func str(v any, max int) string {
	s := ""
	if v != nil {
		s = jsString(v)
	}
	return jsSlice(jsTrim(reCtrl.ReplaceAllString(s, "")), max)
}
func oneLine(v any, max int) string { return reSpaces.ReplaceAllString(str(v, max), " ") }
func isEmail(s string) bool         { return reEmail.MatchString(s) && jsLen(s) <= 120 }
func isPhone(s string) bool {
	return rePhone.MatchString(s) && len(reDigit.FindAllString(s, -1)) >= 6
}
func isTime(v any) bool { s, ok := v.(string); return ok && reTime.MatchString(s) }

/* ---------------------------------------------------------------- JSON out */
// toJSON is JSON.stringify: no HTML escaping, optional 1-space indent.
func toJSON(v any, indent bool) []byte {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if indent {
		enc.SetIndent("", " ")
	}
	if err := enc.Encode(v); err != nil {
		panic(err)
	}
	return bytes.TrimRight(buf.Bytes(), "\n")
}
