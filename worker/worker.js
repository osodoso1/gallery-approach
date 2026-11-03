/* Gallery Approach · Cloudflare Worker (free plan)
 * For the website version (e.g. GitHub Pages). It does what the Pi server does, minus the photo folder:
 *   /api/health     lets the app find it
 *   /api/proxy      fetches the public APIs that don't allow browser requests (allowlisted)
 *   /api/state      syncs your to-do board, events and calendar links between devices (KV + your sync key)
 *   /api/spotlight  Windows Spotlight images     /api/bing   Bing daily images
 * Deploy: see worker/README.md
 */
const VERSION = '1.1.0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ALLOW = new Set([
  'collectionapi.metmuseum.org', 'api.artic.edu', 'openaccess-api.clevelandart.org', 'api.smk.dk', 'data.rijksmuseum.nl', 'id.rijksmuseum.nl',
  'api.vam.ac.uk', 'api.harvardartmuseums.org', 'commons.wikimedia.org', 'images-api.nasa.gov',
  'api.adsb.lol', 'api.airplanes.live', 'opendata.adsb.fi', 'api.adsbdb.com', 'api.planespotters.net',
  'api.open-meteo.com', 'air-quality-api.open-meteo.com', 'geocoding-api.open-meteo.com', 'api.bigdatacloud.net', 'pollen.googleapis.com',
  'calendar.google.com', 'outlook.office365.com', 'outlook.live.com',
]);
const ALLOW_SUFFIX = ['.icloud.com'];
const ttl = host => (/adsb|airplanes/.test(host) ? 5 : /open-meteo|pollen|bigdatacloud/.test(host) ? 600 : /adsbdb|planespotters/.test(host) ? 21600 : /calendar|outlook|icloud/.test(host) ? 300 : 600);

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = env.ALLOW_ORIGIN || '*';
    const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key, Accept', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
    const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      switch (url.pathname) {
        case '/api/health':
          return json({ app: 'gallery-approach', version: VERSION, kind: 'worker', features: { proxy: true, state: !!env.STATE, spotlight: true, bing: true, photos: false } });
        case '/api/proxy': return proxy(req, url, env, ctx, cors);
        case '/api/state': return state(req, env, json);
        case '/api/spotlight': return json({ items: await cached(ctx, 'https://cache.local/spotlight', 3 * 3600, spotlight) });
        case '/api/bing': return json({ items: await cached(ctx, 'https://cache.local/bing', 3 * 3600, bing) });
        default: return json({ error: 'not found' }, 404);
      }
    } catch (e) { return json({ error: String((e && e.message) || e) }, 502); }
  },
};

function allowed(u, env) {
  if (u.protocol !== 'https:') return false;
  if (ALLOW.has(u.hostname) || ALLOW_SUFFIX.some(s => u.hostname.endsWith(s))) return true;
  return (env.EXTRA_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean).includes(u.hostname);
}

async function proxy(req, url, env, ctx, cors) {
  let target;
  try { target = new URL((url.searchParams.get('url') || '').replace(/^webcal:\/\//i, 'https://')); } catch (e) { return new Response('{"error":"bad url"}', { status: 400, headers: cors }); }
  if (!allowed(target, env)) return new Response(JSON.stringify({ error: 'host not allowed: ' + target.hostname }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
  const isGet = req.method !== 'POST';
  const cacheKey = new Request('https://proxy.local/' + encodeURIComponent(target.href));
  if (isGet) { const hit = await caches.default.match(cacheKey); if (hit) { const r = new Response(hit.body, hit); Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v)); return r; } }
  const headers = { 'User-Agent': UA };
  const accept = req.headers.get('Accept'); if (accept && /json|calendar/.test(accept)) headers.Accept = accept;
  if (!isGet) headers['Content-Type'] = req.headers.get('Content-Type') || 'application/json';
  const up = await fetch(target.href, { method: isGet ? 'GET' : 'POST', headers, body: isGet ? undefined : await req.text(), redirect: 'follow' });
  const body = await up.arrayBuffer();
  const out = new Response(body, { status: up.status, headers: { ...cors, 'Content-Type': up.headers.get('Content-Type') || 'application/octet-stream', 'Cache-Control': `public, max-age=${ttl(target.hostname)}` } });
  if (isGet && (up.ok || up.status === 404)) ctx.waitUntil(caches.default.put(cacheKey, out.clone()));
  return out;
}

async function state(req, env, json) {
  if (!env.STATE) return json({ error: 'sync storage not set up (add the STATE KV namespace)' }, 501);
  if (!env.SYNC_KEY || req.headers.get('X-Sync-Key') !== env.SYNC_KEY) return json({ error: 'sync key missing or wrong' }, 401);
  if (req.method === 'PUT' || req.method === 'POST') {
    const body = await req.json();
    const cur = JSON.parse((await env.STATE.get('state')) || '{}');
    if (!cur.updatedAt || (body.updatedAt || 0) >= cur.updatedAt) {
      await env.STATE.put('state', JSON.stringify({ board: body.board || [], events: body.events || [], icsUrls: body.icsUrls || [], updatedAt: body.updatedAt || Date.now() }));
    }
    return json({ ok: true });
  }
  return json(JSON.parse((await env.STATE.get('state')) || '{}'));
}

async function cached(ctx, key, seconds, make) {
  const k = new Request(key);
  const hit = await caches.default.match(k);
  if (hit) return hit.json();
  const items = await make();
  ctx.waitUntil(caches.default.put(k, new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${seconds}` } })));
  return items;
}

async function spotlight() {
  const out = [], seen = new Set();
  for (let round = 0; round < 2; round++) {
    const r = await fetch('https://fd.api.iris.microsoft.com/v4/api/selection?&placement=88000820&bcnt=4&country=US&locale=en-US&fmt=json', { headers: { 'User-Agent': UA } });
    if (!r.ok) break;
    const j = await r.json();
    for (const w of (j.batchrsp && j.batchrsp.items) || []) {
      try {
        const it = typeof w.item === 'string' ? JSON.parse(w.item) : w.item, ad = it && it.ad;
        const u = ad && ad.landscapeImage && ad.landscapeImage.asset;
        if (!u || seen.has(u)) continue; seen.add(u);
        const title = String(ad.iconHoverText || ad.title || '').split(/\r?\n/)[0].trim() || 'Windows Spotlight';
        out.push({ key: 'spot:' + u.split('/').pop().split('?')[0], src: 'spotlight', kind: 'photo', urls: [u], title, creator: ad.copyright || '', license: 'Windows Spotlight · © as credited', link: 'https://www.bing.com/search?q=' + encodeURIComponent(title) });
      } catch (e) { /* skip */ }
    }
  }
  return out;
}

async function bing() {
  const out = [];
  for (const idx of [0, 7]) {
    const r = await fetch(`https://www.bing.com/HPImageArchive.aspx?format=js&idx=${idx}&n=8&mkt=en-US`, { headers: { 'User-Agent': UA } });
    if (!r.ok) continue;
    const j = await r.json();
    for (const im of j.images || []) {
      if (!im.urlbase || out.some(x => x.base === im.urlbase)) continue;
      const cr = im.copyright || '', m = cr.match(/^(.*?)\s*\((©.*)\)\s*$/);
      out.push({ base: im.urlbase, key: 'bing:' + im.urlbase.split('=').pop(), src: 'bing', kind: 'photo', urls: [`https://www.bing.com${im.urlbase}_UHD.jpg`, `https://www.bing.com${im.urlbase}_1920x1080.jpg`], title: im.title || (m ? m[1] : cr), creator: m ? m[2] : cr, detail: m && im.title && m[1] !== im.title ? m[1] : '', date: im.startdate ? `${im.startdate.slice(0, 4)}-${im.startdate.slice(4, 6)}-${im.startdate.slice(6, 8)}` : '', license: 'Bing daily image · © as credited', link: im.copyrightlink || 'https://www.bing.com' });
    }
  }
  return out;
}
