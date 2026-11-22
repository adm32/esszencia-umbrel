# Notes for Claude

Read `README.md` first. Its "Editing content" and "Structure" sections say where everything is.

- **Website** (`adm-esszencia`, port 4751, esszenciakozmetika.hu): static files in
  `adm-esszencia/www/`, served by nginx (`nginx.conf`: gzip, caching, strict CSP). There's no build step.
  - The price list and services are in `www/assets/js/services.js`. The booking assistant is `booking.js`,
    page behaviour is `main.js`, translations are `i18n.js`, anonymous stats are `stats.js`, and
    `early.js` runs before the first paint.
- **Foglalások** (`adm-esszencia-foglalasok`, ports 4752 admin / 4753 public API / 4754 remote
  admin): Node.js, no npm dependencies. `server/server.js` is the whole server. `server/lib/`
  holds e-mail, templates and services. `server/admin/` is the back office.
- **Release:** raise `version` in the app's `umbrel-app.yml`, then commit and push. Check JS with
  `node --check` on every changed file before you push.
- The strict CSP in `nginx.conf` blocks inline scripts and outside sources. Keep everything local.
- Never commit anything from `data/`. Don't add external fonts, scripts or trackers.
- UI work follows the 20 UX & animation principles (snappy, eased, big tap targets, few choices).
