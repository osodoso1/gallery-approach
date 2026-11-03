#!/usr/bin/env node
/* Gallery Approach companion server — zero dependencies, Node 18+.
 *
 *  • serves the app
 *  • serves your photos folder (and reads EXIF dates)
 *  • fetches + archives Windows Spotlight and Bing daily images
 *  • proxies the public APIs the app uses (no browser CORS limits), allowlisted
 *  • stores the to-do board / events / calendar links so every screen shares them
 *
 *  Run:  node server/server.js           (then open http://localhost:8080)
 *  Env:  PORT=8080 HOST=0.0.0.0 PHOTOS_DIR=/path/to/photos DATA_DIR=/path/to/data MARKET=en-US
 */
'use strict';
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const PHOTOS = path.resolve(process.env.PHOTOS_DIR || path.join(ROOT, 'photos'));
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const CACHE = path.join(DATA, 'cache');
const MARKET = process.env.MARKET || 'en-US';
const VERSION = '1.0.0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

// Hosts the proxy will fetch for the app. Calendar links you add in the app are allowed too.
const ALLOW = new Set([
  'collectionapi.metmuseum.org', 'images.metmuseum.org', 'api.artic.edu', 'www.artic.edu', 'openaccess-api.clevelandart.org', 'api.smk.dk',
  'data.rijksmuseum.nl', 'id.rijksmuseum.nl', 'api.vam.ac.uk', 'api.harvardartmuseums.org', 'commons.wikimedia.org', 'images-api.nasa.gov',
  'api.adsb.lol', 'api.airplanes.live', 'opendata.adsb.fi', 'api.adsbdb.com', 'api.planespotters.net',
  'api.open-meteo.com', 'air-quality-api.open-meteo.com', 'geocoding-api.open-meteo.com', 'api.bigdatacloud.net', 'pollen.googleapis.com',
  'calendar.google.com', 'outlook.office365.com', 'outlook.live.com',
]);
const ALLOW_SUFFIX = ['.icloud.com'];
const TTL = host => (/adsb|airplanes/.test(host) ? 5e3 : /open-meteo|pollen/.test(host) ? 10 * 60e3 : /adsbdb|planespotters/.test(host) ? 6 * 3600e3 : /calendar|outlook|icloud/.test(host) ? 5 * 60e3 : 10 * 60e3);

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
fs.mkdirSync(path.join(CACHE, 'spotlight'), { recursive: true });
fs.mkdirSync(path.join(CACHE, 'bing'), { recursive: true });
try { fs.mkdirSync(PHOTOS, { recursive: true }); } catch (e) { /* read-only is fine */ }

/* ── helpers ── */
function send(res, code, body, type = 'application/json', extra = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(code, { 'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'no-store', ...extra });
  res.end(buf);
}
function inside(base, p) { const r = path.resolve(base, p); return r === base || r.startsWith(base + path.sep) ? r : null; }
async function serveFile(req, res, file, cache = 'no-cache') {
  try {
    const st = await fsp.stat(file);
    if (!st.isFile()) return send(res, 404, { error: 'not found' });
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const etag = `"${st.size}-${Math.floor(st.mtimeMs)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304); return res.end(); }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': cache, ETag: etag });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch (e) { send(res, 404, { error: 'not found' }); }
}
async function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function get(url, opts = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeout || 15000);
  try { return await fetch(url, { headers: { 'User-Agent': UA, ...(opts.headers || {}) }, method: opts.method || 'GET', body: opts.body, signal: ctl.signal, redirect: 'follow' }); }
  finally { clearTimeout(t); }
}
async function readJSON(file, def) { try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch (e) { return def; } }
async function writeJSON(file, obj) { const tmp = file + '.tmp'; await fsp.writeFile(tmp, JSON.stringify(obj, null, 1)); await fsp.rename(tmp, file); }

/* ── EXIF date (same tiny reader the app uses) ── */
function exifDate(buf) {
  try {
    if (buf.readUInt16BE(0) !== 0xFFD8) return null;
    let off = 2;
    while (off + 4 < buf.length) {
      const marker = buf.readUInt16BE(off), len = buf.readUInt16BE(off + 2);
      if (marker === 0xFFE1 && buf.readUInt32BE(off + 4) === 0x45786966) {
        const t = off + 10, le = buf.readUInt16BE(t) === 0x4949;
        const u16 = o => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o)), u32 = o => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
        const find = (ifd, tag) => { const n = u16(ifd); for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === tag) return e; } return 0; };
        const str = e => { const cnt = u32(e + 4), o = cnt > 4 ? t + u32(e + 8) : e + 8; return buf.slice(o, o + cnt - 1).toString('latin1'); };
        const ifd0 = t + u32(t + 4);
        let s = null; const ex = find(ifd0, 0x8769);
        if (ex) { const sub = t + u32(ex + 8); const d = find(sub, 0x9003) || find(sub, 0x9004); if (d) s = str(d); }
        if (!s) { const d = find(ifd0, 0x0132); if (d) s = str(d); }
        const m = s && s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/);
        return m && m[1] !== '0000' ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : null;
      }
      if ((marker & 0xFF00) !== 0xFF00) return null;
      off += 2 + len;
    }
  } catch (e) { /* malformed */ }
  return null;
}

/* ── Photos ── */
let photoIndex = null, photoAt = 0;
const exifCache = new Map();
async function scanPhotos() {
  if (photoIndex && Date.now() - photoAt < 60e3) return photoIndex;
  const out = [];
  async function walk(dir, rel, depth) {
    if (depth > 8 || out.length > 20000) return;
    let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) await walk(full, r, depth + 1);
      else if (PHOTO_EXT.has(path.extname(e.name).toLowerCase())) {
        const st = await fsp.stat(full).catch(() => null); if (!st || st.size < 2048) continue;
        const key = r + '|' + st.mtimeMs;
        let date = exifCache.get(key);
        if (date === undefined) {
          date = null;
          if (/\.jpe?g$/i.test(e.name)) { try { const fh = await fsp.open(full, 'r'); const b = Buffer.alloc(Math.min(st.size, 256 * 1024)); await fh.read(b, 0, b.length, 0); await fh.close(); date = exifDate(b); } catch (err) { /* ignore */ } }
          exifCache.set(key, date);
        }
        out.push({ path: r, size: st.size, mtime: Math.floor(st.mtimeMs), date: date || Math.floor(st.mtimeMs) });
      }
    }
  }
  await walk(PHOTOS, '', 0);
  photoIndex = out; photoAt = Date.now();
  return out;
}

/* ── Windows Spotlight (API v4, as documented by Spotlight-Downloader) ── */
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
async function download(url, dest) {
  if (fs.existsSync(dest)) return true;
  const r = await get(url, { timeout: 40000 });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 20000) throw new Error('image too small');
  await fsp.writeFile(dest, buf);
  return true;
}
const archives = { spotlight: { at: 0, busy: null }, bing: { at: 0, busy: null } };
async function refreshSpotlight() {
  const dir = path.join(CACHE, 'spotlight'), mf = path.join(dir, 'manifest.json');
  const list = await readJSON(mf, []);
  const country = (MARKET.split('-')[1] || 'US').toUpperCase();
  for (let round = 0; round < 2; round++) {
    const r = await get(`https://fd.api.iris.microsoft.com/v4/api/selection?&placement=88000820&bcnt=4&country=${country}&locale=${MARKET}&fmt=json`);
    if (!r.ok) throw new Error('Spotlight HTTP ' + r.status);
    const j = await r.json();
    const items = (j.batchrsp && j.batchrsp.items) || [];
    for (const w of items) {
      try {
        const it = typeof w.item === 'string' ? JSON.parse(w.item) : w.item;
        const ad = it && it.ad; if (!ad) continue;
        const url = ad.landscapeImage && ad.landscapeImage.asset;
        if (!url || !/^https:\/\//.test(url) || list.some(x => x.url === url)) continue;
        const file = sha(url) + '.jpg';
        await download(url, path.join(dir, file));
        const title = String(ad.iconHoverText || ad.title || '').split(/\r?\n/)[0].trim() || ad.title || 'Windows Spotlight';
        list.unshift({ file, url, title, copyright: ad.copyright || '', added: Date.now() });
      } catch (e) { log('spotlight item failed:', e.message); }
    }
  }
  await writeJSON(mf, list.slice(0, 600));
  return list;
}
async function refreshBing() {
  const dir = path.join(CACHE, 'bing'), mf = path.join(dir, 'manifest.json');
  const list = await readJSON(mf, []);
  for (const idx of [0, 7]) {
    const r = await get(`https://www.bing.com/HPImageArchive.aspx?format=js&idx=${idx}&n=8&mkt=${MARKET}`);
    if (!r.ok) throw new Error('Bing HTTP ' + r.status);
    const j = await r.json();
    for (const im of j.images || []) {
      const base = im.urlbase && 'https://www.bing.com' + im.urlbase;
      if (!base || list.some(x => x.base === base)) continue;
      const file = sha(base) + '.jpg';
      try { await download(base + '_UHD.jpg', path.join(dir, file)); }
      catch (e) { try { await download(base + '_1920x1080.jpg', path.join(dir, file)); } catch (e2) { continue; } }
      const cr = im.copyright || '';
      const m = cr.match(/^(.*?)\s*\((©.*)\)\s*$/);
      list.unshift({ file, base, title: im.title || (m ? m[1] : cr), desc: m ? m[1] : '', copyright: m ? m[2] : cr, link: im.copyrightlink, date: im.startdate, added: Date.now() });
    }
  }
  await writeJSON(mf, list.slice(0, 600));
  return list;
}
async function archive(kind) {
  const a = archives[kind], dir = path.join(CACHE, kind);
  if (Date.now() - a.at > 3 * 3600e3 && !a.busy) {
    a.busy = (kind === 'spotlight' ? refreshSpotlight() : refreshBing()).then(() => { a.at = Date.now(); }).catch(e => { log(kind, 'refresh failed:', e.message); a.at = Date.now() - 2.5 * 3600e3; }).finally(() => { a.busy = null; });
  }
  let list = await readJSON(path.join(dir, 'manifest.json'), []);
  if (!list.length && a.busy) { await a.busy; list = await readJSON(path.join(dir, 'manifest.json'), []); }
  return list.map(x => kind === 'spotlight'
    ? { key: 'spot:' + x.file, src: 'spotlight', kind: 'photo', urls: ['cache/spotlight/' + x.file], title: x.title, creator: (x.copyright || '').replace(/^©\s*/, '© '), license: 'Windows Spotlight · © as credited', link: 'https://www.bing.com/search?q=' + encodeURIComponent(x.title) }
    : { key: 'bing:' + x.file, src: 'bing', kind: 'photo', urls: ['cache/bing/' + x.file], title: x.title, creator: x.copyright, detail: x.desc && x.desc !== x.title ? x.desc : '', date: x.date ? `${x.date.slice(0, 4)}-${x.date.slice(4, 6)}-${x.date.slice(6, 8)}` : '', license: 'Bing daily image · © as credited', link: x.link || 'https://www.bing.com' });
}

/* ── Proxy ── */
const pcache = new Map();
async function allowed(u) {
  if (!/^https:$/.test(u.protocol)) return false;
  if (ALLOW.has(u.hostname) || ALLOW_SUFFIX.some(s => u.hostname.endsWith(s))) return true;
  const st = await readJSON(path.join(DATA, 'state.json'), {});
  return (st.icsUrls || []).some(x => x.replace(/^webcal:\/\//i, 'https://') === u.href);
}
async function proxy(req, res, target) {
  let u; try { u = new URL(target); } catch (e) { return send(res, 400, { error: 'bad url' }); }
  if (!(await allowed(u))) return send(res, 403, { error: 'host not allowed: ' + u.hostname });
  const method = req.method === 'POST' ? 'POST' : 'GET';
  const body = method === 'POST' ? await readBody(req, 64e3) : undefined;
  const ck = method + ' ' + u.href + (body ? ' ' + body.toString() : '');
  const hit = pcache.get(ck);
  if (hit && Date.now() - hit.at < TTL(u.hostname)) return send(res, hit.status, hit.buf, hit.type, { 'X-Proxy-Cache': 'hit' });
  try {
    const headers = {};
    if (req.headers.accept && /ld\+json|json|calendar/.test(req.headers.accept)) headers.Accept = req.headers.accept;
    if (body) headers['Content-Type'] = req.headers['content-type'] || 'application/json';
    const r = await get(u.href, { method, body, headers, timeout: 20000 });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8e6) return send(res, 502, { error: 'response too large' });
    const type = r.headers.get('content-type') || 'application/octet-stream';
    if (r.ok || r.status === 404) { pcache.set(ck, { at: Date.now(), status: r.status, buf, type }); if (pcache.size > 600) pcache.delete(pcache.keys().next().value); }
    send(res, r.status, buf, type);
  } catch (e) { send(res, 502, { error: e.name === 'AbortError' ? 'upstream timeout' : e.message }); }
}

/* ── Router ── */
const BLOCK = /^\/(server|data|node_modules|scripts)(\/|$)|\/\./;
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Key, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const u = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(u.pathname);
  try {
    if (p === '/api/health') return send(res, 200, { app: 'gallery-approach', version: VERSION, photosDir: PHOTOS, features: { photos: true, spotlight: true, bing: true, proxy: true, state: true } });
    if (p === '/api/photos') return send(res, 200, { dir: PHOTOS, photos: await scanPhotos() });
    if (p === '/api/spotlight') return send(res, 200, { items: await archive('spotlight') });
    if (p === '/api/bing') return send(res, 200, { items: await archive('bing') });
    if (p === '/api/proxy') return proxy(req, res, u.searchParams.get('url') || '');
    if (p === '/api/state') {
      const file = path.join(DATA, 'state.json');
      if (req.method === 'PUT' || req.method === 'POST') {
        const body = JSON.parse((await readBody(req, 2e6)).toString() || '{}');
        const cur = await readJSON(file, {});
        if (!cur.updatedAt || (body.updatedAt || 0) >= cur.updatedAt) await writeJSON(file, { board: body.board || [], events: body.events || [], icsUrls: body.icsUrls || [], updatedAt: body.updatedAt || Date.now() });
        return send(res, 200, { ok: true });
      }
      return send(res, 200, await readJSON(file, {}));
    }
    if (p.startsWith('/photos/')) { const f = inside(PHOTOS, p.slice(8)); return f ? serveFile(req, res, f, 'max-age=86400') : send(res, 403, { error: 'forbidden' }); }
    if (p.startsWith('/cache/')) { const f = inside(CACHE, p.slice(7)); return f ? serveFile(req, res, f, 'max-age=604800') : send(res, 403, { error: 'forbidden' }); }
    if (BLOCK.test(p)) return send(res, 404, { error: 'not found' });
    const f = inside(ROOT, p === '/' ? 'index.html' : p.slice(1));
    return f ? serveFile(req, res, f) : send(res, 403, { error: 'forbidden' });
  } catch (e) { log('error', p, e.message); send(res, 500, { error: 'server error' }); }
});

server.listen(PORT, HOST, () => {
  const nets = require('os').networkInterfaces();
  const ips = Object.values(nets).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
  log(`Gallery Approach ${VERSION} is running`);
  log(`  this machine:   http://localhost:${PORT}`);
  ips.forEach(ip => log(`  other screens:  http://${ip}:${PORT}`));
  log(`  photos folder:  ${PHOTOS}`);
  // warm the Spotlight / Bing archives in the background
  archive('spotlight').catch(() => {}); archive('bing').catch(() => {});
});
