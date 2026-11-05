/* Gallery Approach — core utilities, settings, storage, networking */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});
  const U = (SS.u = {});

  /* ── DOM ── */
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.h = function (tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) sk.startsWith('--') ? el.style.setProperty(sk, v[sk]) : (el.style[sk] = v[sk]); }
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  U.svg = (path, vb = '0 0 24 24') => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', vb);
    s.innerHTML = path;
    return s;
  };
  U.icons = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    plane: '<path d="M12 2.5c.8 0 1.4.7 1.4 1.6V9l7.6 4.6v2.1l-7.6-2.3v4.8l2.2 1.7V21L12 20.1 8.4 21v-1.1l2.2-1.7v-4.8L3 15.7v-2.1L10.6 9V4.1c0-.9.6-1.6 1.4-1.6z"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
  };
  U.icon = name => U.svg(U.icons[name] || '');

  /* ── Math & misc ── */
  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  U.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  U.sleep = ms => new Promise(r => setTimeout(r, ms));
  U.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  U.seeded = seed => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  U.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Inert HTML → text (DOMParser documents never run scripts or load images)
  U.text = s => {
    if (!s) return '';
    if (!/[<&]/.test(s)) return String(s).replace(/\s+/g, ' ').trim();
    try { return (new DOMParser().parseFromString(String(s), 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); }
    catch (e) { return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  };
  U.truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s || '');

  U.ease = {
    linear: t => t,
    inQuad: t => t * t,
    outQuad: t => t * (2 - t),
    inOutQuad: t => (t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    inCubic: t => t * t * t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outQuart: t => 1 - Math.pow(1 - t, 4),
    inOutQuart: t => (t < .5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outExpo: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  };

  /* ── Events ── */
  const bus = new EventTarget();
  SS.on = (name, fn) => bus.addEventListener(name, e => fn(e.detail));
  SS.emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));

  /* ── Storage ── */
  U.store = {
    get(k, d) { try { const v = localStorage.getItem('ga:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ga:' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  U.idb = (() => {
    let dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((res, rej) => {
        try {
          if (!('indexedDB' in window)) return rej(new Error('IndexedDB unavailable'));
          const req = indexedDB.open('gallery-approach', 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('photoMeta')) db.createObjectStore('photoMeta', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('photoBlobs')) db.createObjectStore('photoBlobs', { keyPath: 'id' });
          };
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error || new Error('IndexedDB open failed'));
        } catch (e) { rej(e); }
      });
      dbp.catch(() => { dbp = null; });
      return dbp;
    }
    async function run(store, mode, fn) {
      const db = await open();
      return new Promise((res, rej) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => res(req ? req.result : undefined);
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error || new Error('aborted'));
      });
    }
    return {
      put: (s, v) => run(s, 'readwrite', o => o.put(v)),
      get: (s, k) => run(s, 'readonly', o => o.get(k)),
      del: (s, k) => run(s, 'readwrite', o => o.delete(k)),
      all: s => run(s, 'readonly', o => o.getAll()),
      clear: s => run(s, 'readwrite', o => o.clear()),
    };
  })();

  /* ── Environment ── */
  SS.env = { cspBlocked: false, offline: !navigator.onLine };
  document.addEventListener('securitypolicyviolation', e => {
    if (/connect-src|img-src|default-src/.test(e.violatedDirective || e.effectiveDirective || '')) {
      if (!SS.env.cspBlocked) { SS.env.cspBlocked = true; SS.emit('csp'); }
    }
  });
  addEventListener('online', () => { SS.env.offline = false; SS.emit('online'); });
  addEventListener('offline', () => { SS.env.offline = true; });

  /* ── Companion server (Pi / computer) ── */
  // Either the Pi/computer that serves this page (same origin), or a server/proxy URL you set
  // in Settings (e.g. the free Cloudflare Worker for the GitHub Pages website version).
  SS.server = { available: false, features: {}, info: null, base: '' };
  SS.server.url = p => (SS.server.base ? SS.server.base.replace(/\/+$/, '') + '/' : '') + p;
  SS.server.headers = (extra = {}) => (SS.settings.syncKey ? { ...extra, 'X-Sync-Key': SS.settings.syncKey } : extra);
  SS.server.detect = async () => {
    SS.server.available = false; SS.server.features = {}; SS.server.info = null; SS.server.base = '';
    const custom = (SS.settings.serverUrl || '').trim();
    const bases = custom ? [custom] : (/^https?:$/.test(location.protocol) ? [''] : []);
    for (const base of bases) {
      try {
        const r = await U.fetchWithTimeout((base ? base.replace(/\/+$/, '') + '/' : '') + 'api/health', { cache: 'no-store' }, 3500);
        if (!r.ok) continue;
        const j = await r.json();
        if (j && j.app === 'gallery-approach') { SS.server.available = true; SS.server.features = j.features || {}; SS.server.info = j; SS.server.base = base; break; }
      } catch (e) { /* static hosting, or the proxy isn't reachable */ }
    }
    SS.emit('server');
    return SS.server.available;
  };

  /* ── Networking ── */
  U.fetchWithTimeout = (url, opts = {}, ms = 12000) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    return fetch(url, { ...opts, signal: ctl.signal }).finally(() => clearTimeout(t));
  };
  const isRemote = url => /^https?:\/\//i.test(url) && !url.startsWith(location.origin);
  // Route through the companion server when present (no CORS limits, shared cache);
  // otherwise call the public API directly from the browser.
  U.fetchRaw = async (url, opts = {}) => {
    const { timeout = 12000, proxy = true } = opts;
    const init = { method: opts.method || 'GET', headers: opts.headers, body: opts.body, cache: opts.cache || 'default', referrerPolicy: 'no-referrer' };
    if (SS.server.available && proxy && isRemote(url)) {
      try {
        const r = await U.fetchWithTimeout(SS.server.url('api/proxy?url=' + encodeURIComponent(url)), init, timeout + 4000);
        if (r.ok || r.status === 404) return r;
      } catch (e) { /* fall through to direct */ }
    }
    if (SS.env.cspBlocked && isRemote(url)) throw new Error('blocked in preview');
    return U.fetchWithTimeout(url, init, timeout);
  };
  U.fetchJSON = async (url, opts) => {
    const r = await U.fetchRaw(url, opts);
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json();
  };
  U.fetchText = async (url, opts) => {
    const r = await U.fetchRaw(url, opts);
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.text();
  };

  /* ── Geo (nautical miles) ── */
  const R_NM = 3440.065, rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  U.geo = {
    dist(la1, lo1, la2, lo2) {
      const dLa = rad(la2 - la1), dLo = rad(lo2 - lo1);
      const a = Math.sin(dLa / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dLo / 2) ** 2;
      return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(a)));
    },
    bearing(la1, lo1, la2, lo2) {
      const y = Math.sin(rad(lo2 - lo1)) * Math.cos(rad(la2));
      const x = Math.cos(rad(la1)) * Math.sin(rad(la2)) - Math.sin(rad(la1)) * Math.cos(rad(la2)) * Math.cos(rad(lo2 - lo1));
      return (deg(Math.atan2(y, x)) + 360) % 360;
    },
    dest(la, lo, brg, nm) {
      const d = nm / R_NM, b = rad(brg), p1 = rad(la), l1 = rad(lo);
      const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
      const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
      return [deg(p2), ((deg(l2) + 540) % 360) - 180];
    },
    enu(la0, lo0, la, lo) { return [(lo - lo0) * 60 * Math.cos(rad(la0)), (la - la0) * 60]; },
    angDiff(a, b) { return ((b - a + 540) % 360) - 180; },
  };

  /* ── Formatting ── */
  U.fmt = {
    int: n => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US')),
    time: (d, h24) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !h24 }),
    mmss: sec => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; },
    ago: ms => { const s = Math.round(ms / 1000); if (s < 60) return 'just now'; const m = Math.round(s / 60); if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); return h < 24 ? h + ' hr ago' : Math.round(h / 24) + ' d ago'; },
    date: (t, opts) => new Date(t).toLocaleDateString([], opts || { year: 'numeric', month: 'long', day: 'numeric' }),
  };

  /* ── Toasts ── */
  U.toast = (msg, ms = 3200) => {
    const host = U.$('#toasts'); if (!host) return;
    const el = U.h('div', { class: 'toast' }, msg);
    host.append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
  };

  /* ── Settings ── */
  const DEFAULTS = {
    v: 5,
    slideSeconds: 120,          // how long each picture stays (seconds)
    genSeconds: 120,            // generative pieces never stay longer than this
    liveSeconds: 180,           // how long a living (animated) piece stays
    speed: 'medium',            // slow | medium | fast
    fxMode: 'all',              // all | subtle | classic | exciting | custom
    fxCustom: [],
    fxLabel: true,
    kenBurns: true,
    fit: 'smart',               // smart | fill | fit
    caption: 'full',            // full | minimal | off
    artFocus: 'paintings',      // paintings | everything
    personalShare: 30,          // % of slides from your photos (when you have some)
    weights: {                  // 0 off · 1 low · 2 normal · 3 high  (generative: -1 never · 0 only if nothing else loads)
      met: 2, aic: 2, cleveland: 2, smk: 2, rijks: 1, vam: 1, harvard: 2,
      wikimedia: 2, nasa: 1, spotlight: 2, bing: 2, generative: 1, living: 2, nasavideo: 1, commonsvideo: 1, archivefilm: 1, europeana: 1,
    },
    personalOn: true,
    harvardKey: '',
    europeanaKey: '',           // optional: free key from pro.europeana.eu for museum video
    clock: true,
    clock24: false,
    calm: 20,                   // seconds of no touching before everything but the art (and clock) fades · 0 = never
    agendaChip: true,
    flight: { enabled: true, mode: 'auto', lat: 37.5636, lon: -122.2730, place: 'Foster City', airport: 'SFO', radius: 22, strip: 'tab', locMode: 'device' },   // strip: tab (tucked away) | always | off
    env: { enabled: true, units: 'F', pollenKey: '', show: 'compact', view: 'day', loc: { mode: 'device', lat: null, lon: null, name: '' } },
    photoSync: true,
    serverUrl: '',              // optional: your Pi (http://pi.local:8080) or the Cloudflare Worker URL
    syncKey: '',                // optional: passphrase for syncing through the Cloudflare Worker
    night: { enabled: false, from: '22:00', to: '06:30', level: 0.78 },
    burnIn: true,
    sound: false,
    icsUrls: [],
  };
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function merge(base, over) {
    const out = Array.isArray(base) ? base.slice() : { ...base };
    if (!isObj(over)) return out;
    for (const k in over) out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
    return out;
  }
  SS.DEFAULTS = DEFAULTS;
  SS.merge = merge;
  const stored = U.store.get('settings', {});
  if (!stored.v || stored.v < 2) { if (stored.slideSeconds === 20) stored.slideSeconds = 120; }
  if (!stored.v || stored.v < 3) { if (stored.weights && stored.weights.generative === 0) stored.weights.generative = 1; stored.v = 3; }
  if (stored.v < 5) { stored.flight = Object.assign({}, stored.flight, { locMode: (stored.flight && stored.flight.locMode) || 'device' }); }
  if (stored.v < 4) { if (stored.flight && typeof stored.flight.strip === 'boolean') stored.flight.strip = stored.flight.strip ? 'tab' : 'off'; }
  stored.v = Math.max(stored.v || 0, 5);
  SS.settings = merge(DEFAULTS, stored);
  // Flight strip: 'tab' (tucked behind a small tab) | 'always' | 'off'. Older devices may sync a boolean.
  SS.stripMode = () => { const f = SS.settings.flight, v = f.strip; return !f.enabled || f.mode === 'off' || v === false || v === 'off' ? 'off' : v === 'always' ? 'always' : 'tab'; };
  SS.saveSettings = U.debounce(() => {
    SS.settings._at = Date.now();
    U.store.set('settings', SS.settings);
    SS.sync && SS.sync.push();
    SS.cloud && SS.cloud.push();
  }, 250);
  SS.setSetting = (path, value) => {
    const keys = path.split('.'); let o = SS.settings;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
    SS.saveSettings();
    SS.emit('settings', path);
  };

  /* ── Shared state (board, events) with optional server sync ── */
  SS.state = {
    board: U.store.get('board', null),
    events: U.store.get('events', []),
    updatedAt: U.store.get('stateAt', 0),
  };
  if (!SS.state.board) SS.state.board = [
    { id: U.uid(), text: 'Add a few favorite photos', col: 'todo' },
    { id: U.uid(), text: 'Pick a home for the screensaver (Pi? iPad?)', col: 'todo' },
    { id: U.uid(), text: 'Watch an arrival pass over Foster City', col: 'doing' },
  ];
  SS.saveState = () => {
    SS.state.updatedAt = Date.now();
    U.store.set('board', SS.state.board);
    U.store.set('events', SS.state.events);
    U.store.set('stateAt', SS.state.updatedAt);
    SS.sync.push();
    SS.cloud && SS.cloud.push();
    SS.emit('state');
  };
  SS.sync = {
    async pushNow() {
      if (!SS.server.available) return;
      try {
        if (!SS.server.features.state) return;
        await U.fetchWithTimeout(SS.server.url('api/state'), {
          method: 'PUT', headers: SS.server.headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ board: SS.state.board, events: SS.state.events, icsUrls: SS.settings.icsUrls, updatedAt: SS.state.updatedAt = Date.now() }),
        }, 6000);
        U.store.set('stateAt', SS.state.updatedAt);
      } catch (e) { /* offline is fine */ }
    },
    push: U.debounce(() => SS.sync.pushNow(), 800),
    async pull() {
      if (!SS.server.available || !SS.server.features.state) return;
      try {
        const r = await U.fetchWithTimeout(SS.server.url('api/state'), { cache: 'no-store', headers: SS.server.headers() }, 4000);
        if (!r.ok) return;
        const d = await r.json();
        if (d && d.updatedAt && d.updatedAt > (SS.state.updatedAt || 0)) {
          if (Array.isArray(d.board)) SS.state.board = d.board;
          if (Array.isArray(d.events)) SS.state.events = d.events;
          if (Array.isArray(d.icsUrls)) { SS.settings.icsUrls = d.icsUrls; U.store.set('settings', SS.settings); }
          SS.state.updatedAt = d.updatedAt;
          U.store.set('board', SS.state.board); U.store.set('events', SS.state.events); U.store.set('stateAt', d.updatedAt);
          SS.emit('state');
        } else if (!d || !d.updatedAt) SS.sync.push();
      } catch (e) { /* ignore */ }
    },
  };
})();
