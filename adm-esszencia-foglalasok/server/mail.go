package main

/* Minimal SMTP client (no dependencies).
   Gmail: host smtp.gmail.com, port 465, secure (TLS), user = Gmail address,
   pass = a 16-character Google "app password". */

import (
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type Attachment struct {
	Filename    string
	ContentType string
	Content     string
}

type Message struct {
	From, FromName, To, ReplyTo string
	Subject, Text, HTML         string
	Attachments                 []Attachment
}

type Mail struct {
	Subject, Text, HTML string
	Attachments         []Attachment
}

var reNL = regexp.MustCompile(`[\r\n]+`)

func mclean(s string) string { return jsTrim(reNL.ReplaceAllString(s, " ")) }
func b64(s string) string    { return base64.StdEncoding.EncodeToString([]byte(s)) }
func wrap76(s string) string {
	var b strings.Builder
	for len(s) > 0 {
		n := min(76, len(s))
		b.WriteString(s[:n] + "\r\n")
		s = s[n:]
	}
	return b.String()
}

var rePrintable = regexp.MustCompile(`^[\x20-\x7e]*$`)

// encodeHeader: RFC 2047 encoded word(s), split so each stays short.
func encodeHeader(value string) string {
	value = mclean(value)
	if rePrintable.MatchString(value) {
		return value
	}
	var parts []string
	cur := ""
	for _, ch := range value {
		if len(cur)+len(string(ch)) > 42 {
			parts = append(parts, cur)
			cur = ""
		}
		cur += string(ch)
	}
	if cur != "" {
		parts = append(parts, cur)
	}
	for i, p := range parts {
		parts[i] = "=?UTF-8?B?" + b64(p) + "?="
	}
	return strings.Join(parts, "\r\n ")
}

func addr(email, name string) string {
	email = mclean(email)
	if name != "" {
		return encodeHeader(name) + " <" + email + ">"
	}
	return "<" + email + ">"
}

func buildMessage(m Message) string {
	id := randHex(9)
	domain := "localhost"
	if p := strings.Split(mclean(m.From), "@"); len(p) > 1 && p[1] != "" {
		domain = p[1]
	}
	alt := "alt-" + id
	mix := "mix-" + id
	head := []string{
		"From: " + addr(m.From, m.FromName),
		"To: " + addr(m.To, ""),
	}
	if m.ReplyTo != "" {
		head = append(head, "Reply-To: "+addr(m.ReplyTo, ""))
	}
	head = append(head,
		"Subject: "+encodeHeader(m.Subject),
		"Date: "+time.Now().UTC().Format("Mon, 02 Jan 2006 15:04:05")+" +0000",
		"Message-ID: <"+id+"."+strconv.FormatInt(time.Now().UnixMilli(), 10)+"@"+domain+">",
		"MIME-Version: 1.0",
	)

	altBody := "--" + alt + "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" + wrap76(b64(m.Text)) +
		"--" + alt + "\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" + wrap76(b64(m.HTML)) +
		"--" + alt + "--\r\n"

	if len(m.Attachments) == 0 {
		head = append(head, `Content-Type: multipart/alternative; boundary="`+alt+`"`)
		return strings.Join(head, "\r\n") + "\r\n\r\n" + altBody
	}
	head = append(head, `Content-Type: multipart/mixed; boundary="`+mix+`"`)
	body := "--" + mix + "\r\nContent-Type: multipart/alternative; boundary=\"" + alt + "\"\r\n\r\n" + altBody
	for _, a := range m.Attachments {
		name := strings.ReplaceAll(mclean(a.Filename), `"`, "")
		body += "--" + mix + "\r\nContent-Type: " + a.ContentType + `; name="` + name + "\"\r\n" +
			`Content-Disposition: attachment; filename="` + name + "\"\r\nContent-Transfer-Encoding: base64\r\n\r\n" +
			wrap76(b64(a.Content))
	}
	body += "--" + mix + "--\r\n"
	return strings.Join(head, "\r\n") + "\r\n\r\n" + body
}

var (
	reE535     = regexp.MustCompile(`(?i)^SMTP 535|Username and Password not accepted|BadCredentials`)
	reENotFnd  = regexp.MustCompile(`ENOTFOUND|EAI_AGAIN`)
	reERefused = regexp.MustCompile(`(?i)ECONNREFUSED|ETIMEDOUT|időtúllépés`)
	reE55x     = regexp.MustCompile(`^SMTP 55[0-4]`)
)

// mailErr carries a Node-style error code so explain() keeps working.
type mailErr struct{ msg string }

func (e mailErr) Error() string { return e.msg }

func netErr(err error) error {
	var dnsErr *net.DNSError
	switch {
	case errors.As(err, &dnsErr):
		if dnsErr.IsTemporary {
			return mailErr{"getaddrinfo EAI_AGAIN " + dnsErr.Name}
		}
		return mailErr{"getaddrinfo ENOTFOUND " + dnsErr.Name}
	case strings.Contains(err.Error(), "connection refused"):
		return mailErr{"connect ECONNREFUSED " + err.Error()}
	}
	var ne net.Error
	if errors.As(err, &ne) && ne.Timeout() {
		return mailErr{"SMTP időtúllépés"}
	}
	return err
}

// explain turns an SMTP error into a short Hungarian explanation for the admin screen.
func explain(err error) string {
	msg := err.Error()
	switch {
	case reE535.MatchString(msg):
		return "A Gmail nem fogadta el a belépést – ellenőrizd az e-mail címet és az alkalmazásjelszót."
	case reENotFnd.MatchString(msg):
		return "Nem érhető el a levelezőszerver (nincs internet vagy hibás szervernév)."
	case reERefused.MatchString(msg):
		return "A levelezőszerver nem válaszol – próbáld újra később."
	case reE55x.MatchString(msg):
		return "A címzett e-mail címe nem létezik vagy elutasította a levelet."
	}
	return jsSlice(msg, 200)
}

var (
	reReplyEnd = regexp.MustCompile(`^\d{3}(?: |$)`)
	reCRLF     = regexp.MustCompile(`\r?\n`)
	reDotLine  = regexp.MustCompile(`(?m)^\.`)
)

func sendMail(cfg SMTP, m Message) (err error) {
	if cfg.Host == "" || cfg.User == "" || cfg.Pass == "" {
		return errors.New("Az e-mail küldés nincs beállítva.")
	}
	raw := buildMessage(m)
	hostport := net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port))
	dialer := &net.Dialer{Timeout: 25 * time.Second}
	var conn net.Conn
	if !cfg.Secure {
		conn, err = dialer.Dial("tcp", hostport)
	} else {
		conn, err = tls.DialWithDialer(dialer, "tcp", hostport, &tls.Config{ServerName: cfg.Host})
	}
	if err != nil {
		return netErr(err)
	}
	defer conn.Close()

	buf := ""
	rd := make([]byte, 4096)
	read := func() (string, error) {
		for {
			lines := strings.Split(buf, "\r\n")
			for i := 0; i < len(lines)-1; i++ {
				if reReplyEnd.MatchString(lines[i]) {
					resp := strings.Join(lines[:i+1], "\n")
					buf = strings.Join(lines[i+1:], "\r\n")
					return resp, nil
				}
			}
			conn.SetReadDeadline(time.Now().Add(25 * time.Second))
			n, err := conn.Read(rd)
			if n > 0 {
				buf += string(rd[:n])
				continue
			}
			if err != nil {
				return "", netErr(err)
			}
		}
	}
	cmd := func(line *string, ok ...int) error {
		if line != nil {
			conn.SetWriteDeadline(time.Now().Add(25 * time.Second))
			if _, err := conn.Write([]byte(*line + "\r\n")); err != nil {
				return netErr(err)
			}
		}
		r, err := read()
		if err != nil {
			return err
		}
		lines := strings.Split(r, "\n")
		last := lines[len(lines)-1]
		code, _ := strconv.Atoi(last[:min(3, len(last))])
		for _, c := range ok {
			if c == code {
				return nil
			}
		}
		return fmt.Errorf("SMTP %d: %s", code, jsSlice(strings.ReplaceAll(r, "\n", " "), 300))
	}
	s := func(v string) *string { return &v }

	if err := cmd(nil, 220); err != nil {
		return err
	}
	if err := cmd(s("EHLO esszencia.local"), 250); err != nil {
		return err
	}
	if err := cmd(s("AUTH PLAIN "+b64("\x00"+cfg.User+"\x00"+cfg.Pass)), 235); err != nil {
		return err
	}
	if err := cmd(s("MAIL FROM:<"+mclean(m.From)+">"), 250); err != nil {
		return err
	}
	if err := cmd(s("RCPT TO:<"+mclean(m.To)+">"), 250, 251); err != nil {
		return err
	}
	if err := cmd(s("DATA"), 354); err != nil {
		return err
	}
	data := reDotLine.ReplaceAllString(reCRLF.ReplaceAllString(raw, "\r\n"), "..")
	if err := cmd(s(data+"\r\n."), 250); err != nil {
		return err
	}
	conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	conn.Write([]byte("QUIT\r\n"))
	return nil
}
