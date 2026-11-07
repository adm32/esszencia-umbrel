'use strict';
/* Treatment list for the admin app ("Új foglalás" picker).
   Read from the website's own price list (assets/js/services.js) so the two
   never drift apart. The file is parsed as DATA (a tolerant JSON5-style
   reader) – it is never executed. Last good copy is cached on disk; a copy
   bundled with the app is the final fallback. */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BUNDLED = path.join(__dirname, 'services-fallback.json');
const TTL = 10 * 60 * 1000;
let mem = null; // { at, source, data }

/* ---- JS object literal → JSON (strings, comments, bare keys, trailing commas) ---- */
function literalToJson(src) {
  const start = src.indexOf('ESSZENCIA_SERVICES');
  if (start < 0) throw new Error('no ESSZENCIA_SERVICES');
  let i = src.indexOf('{', start);
  if (i < 0) throw new Error('no object');
  let out = '';
  let depth = 0;
  const n = src.length;
  for (; i < n; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) throw new Error('comment'); i = e + 1; continue; }
    if (c === '"' || c === "'") {
      let s = '';
      for (i++; i < n && src[i] !== c; i++) {
        if (src[i] === '\\') { s += src[i] + src[i + 1]; i++; } else if (src[i] === '\n') throw new Error('newline in string'); else s += src[i];
      }
      if (c === "'") s = s.replace(/\\'/g, "'").replace(/"/g, '\\"');
      out += '"' + s + '"';
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let w = '';
      while (i < n && /[\w$]/.test(src[i])) w += src[i++];
      i--;
      out += (w === 'true' || w === 'false' || w === 'null') ? w : '"' + w + '"';
      continue;
    }
    if (c === '{' || c === '[') { depth++; out += c; continue; }
    if (c === '}' || c === ']') {
      out = out.replace(/,\s*$/, '');
      depth--;
      out += c;
      if (depth === 0) break;
      continue;
    }
    if (/[\s,:\-.0-9+]/.test(c)) { out += c; continue; }
    throw new Error('unexpected ' + JSON.stringify(c) + ' at ' + i);
  }
  return JSON.parse(out);
}

const hu = (v) => (typeof v === 'string' ? v : (v && v.hu) || '');
function minutesOf(item, cat) {
  if (item.minutes) return +item.minutes;
  const d = hu(item.duration);
  const nums = (d.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => parseFloat(x.replace(',', '.')));
  if (nums.length) { const m = Math.max.apply(null, nums); return Math.round(/óra/.test(d) ? m * 60 : m); }
  return +(cat.minutes || 60);
}
function normalize(raw) {
  const cats = (raw && raw.categories || []).filter((c) => c && Array.isArray(c.items) && c.items.length).map((c) => ({
    name: hu(c.name),
    items: c.items.filter((it) => it && hu(it.name)).map((it) => ({
      name: hu(it.name), price: hu(it.price), duration: hu(it.duration), minutes: minutesOf(it, c)
    }))
  }));
  if (!cats.length) throw new Error('empty list');
  return { categories: cats };
}

function fetchText(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(e); }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(u, { timeout: timeoutMs, headers: { 'User-Agent': 'Esszencia-Foglalasok' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let size = 0; const chunks = [];
      res.on('data', (c) => { size += c.length; if (size > 512 * 1024) { req.destroy(new Error('too large')); } else chunks.push(c); });
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function load(opts) {
  const { dataDir, siteUrl, force } = opts;
  if (!force && mem && Date.now() - mem.at < TTL) return mem;
  const urls = [process.env.SITE_SERVICES_URL || 'http://host.docker.internal:4751/assets/js/services.js'];
  if (siteUrl) urls.push(siteUrl.replace(/\/+$/, '') + '/assets/js/services.js');
  for (const url of urls) {
    try {
      const data = normalize(literalToJson(await fetchText(url, 4000)));
      mem = { at: Date.now(), source: 'site', data };
      try { fs.writeFileSync(path.join(dataDir, 'services-cache.json'), JSON.stringify(data)); } catch (e) { /* cache is optional */ }
      return mem;
    } catch (e) { /* try the next source */ }
  }
  for (const [file, source] of [[path.join(dataDir, 'services-cache.json'), 'cache'], [BUNDLED, 'bundled']]) {
    try {
      const data = normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
      mem = { at: Date.now() - TTL + 60000, source, data }; // retry the site in a minute
      return mem;
    } catch (e) { /* next */ }
  }
  return { at: Date.now(), source: 'none', data: { categories: [] } };
}

/** Last good list without waiting for the network (cache → bundled copy). */
function loadSync(dataDir) {
  if (mem && mem.data && mem.data.categories.length) return mem.data;
  for (const file of [path.join(dataDir, 'services-cache.json'), BUNDLED]) {
    try { return normalize(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (e) { /* next */ }
  }
  return { categories: [] };
}

/* ---- prices ("10 500 Ft", "7 500 / 9 000 Ft", "2 000 – 2 800 Ft", "Érdeklődj") ---- */
function parsePrices(s) {
  return (String(s || '').match(/\d{1,3}(?:[   .]\d{3})+|\d+/g) || [])
    .map((x) => parseInt(x.replace(/[^\d]/g, ''), 10)).filter((n) => n > 0);
}
const key = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Price (Ft) of a treatment from the price list, or null if it isn't listed / has no price.
    "7 500 / 9 000 Ft" with "45 / 60 perc" picks the price for the booked length,
    a range ("2 000 – 2 800 Ft") counts with its lower end. */
function priceFor(list, name, category, minutes) {
  const n = key(name);
  if (!n || !list || !list.categories) return null;
  let hit = null;
  for (const c of list.categories) {
    for (const it of c.items) {
      if (key(it.name) !== n) continue;
      if (!hit || (category && key(c.name) === key(category))) hit = it;
    }
  }
  if (!hit) return null;
  const prices = parsePrices(hit.price);
  if (!prices.length) return null;
  if (prices.length > 1 && /\//.test(hit.price)) {
    const durs = (String(hit.duration || '').match(/\d+/g) || []).map(Number);
    if (durs.length === prices.length && minutes) {
      let best = 0;
      durs.forEach((d, i) => { if (Math.abs(d - minutes) < Math.abs(durs[best] - minutes)) best = i; });
      return prices[best];
    }
  }
  return Math.min.apply(null, prices);
}

module.exports = { load, loadSync, literalToJson, normalize, parsePrices, priceFor };
