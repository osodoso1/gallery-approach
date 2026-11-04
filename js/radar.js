/* Flight strip (tucked behind a small tab by default), detail card, mini + big radar,
   compass mode ("which plane am I looking at?") and tappable radar blips. */
(function () {
  'use strict';
  const U = SS.u, G = U.geo, F = SS.flights;
  const R = (SS.radar = { bigOpen: false, cardOpen: false, stripOpen: false });
  let strip, tab, els = {}, mini, bigCanvas, bigList, bigStatus, bigFacing, compassBtn, lastFlightNo = '', cardPh = null, cardHex = null, cardView = 'auto', hits = [];

  /* ── split-flap text, like an old departures board ── */
  const FLAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function flap(el, text) {
    el.textContent = '';
    Array.from(text).forEach((ch, i) => {
      const s = U.h('span', { class: 'flap-ch' }, ch === ' ' ? ' ' : '·');
      el.append(s);
      if (ch === ' ') return;
      let n = 4 + i * 2 + U.randInt(0, 3);
      const step = () => {
        s.classList.remove('flip'); void s.offsetWidth; s.classList.add('flip');
        s.textContent = n-- > 0 ? FLAP[U.randInt(0, FLAP.length - 1)] : ch;
        if (n >= 0) setTimeout(step, 55);
      };
      setTimeout(step, 40 + i * 30);
    });
  }

  R.init = function () {
    strip = U.$('#flightStrip');
    tab = U.$('#stripTab');
    els.photo = U.h('div', { class: 'fs-photo' });
    els.tag = U.h('span', { class: 'fs-tag' });
    els.flight = U.h('span', { class: 'fs-flight' });
    els.air = U.h('span', { class: 'fs-air' });
    els.l2 = U.h('div', { class: 'fs-l2' });
    els.stats = U.h('div', { class: 'fs-stats' });
    els.hide = U.h('button', { class: 'fs-hide', 'aria-label': 'Tuck the flight strip away', title: 'Tuck away' }, U.icon('down'));
    mini = U.h('canvas', { class: 'fs-radar', title: 'Radar' });
    strip.append(els.photo, U.h('div', { class: 'fs-main' }, U.h('div', { class: 'fs-l1' }, els.tag, els.flight, els.air), els.l2), els.stats, mini, els.hide);
    tab.addEventListener('click', e => { e.stopPropagation(); R.stripOpen = true; update(); });

    // Easter egg: triple-tap the flight number, or long-press the strip.
    let taps = [];
    els.flight.addEventListener('pointerup', e => {
      const now = Date.now(); taps = taps.filter(t => now - t < 750); taps.push(now);
      if (taps.length >= 3) { taps = []; e.stopPropagation(); SS.game.open(); }
    });
    let press = null;
    strip.addEventListener('pointerdown', e => { if (e.target.closest('.fs-hide')) return; press = setTimeout(() => { press = 'fired'; SS.game.open(); }, 1100); });
    const cancel = () => { if (press && press !== 'fired') clearTimeout(press); };
    strip.addEventListener('pointerup', cancel); strip.addEventListener('pointerleave', cancel); strip.addEventListener('pointercancel', cancel);
    strip.addEventListener('click', e => {
      if (press === 'fired') { press = null; return; }
      if (e.target.closest('.fs-hide')) { R.tuck(); return; }
      if (e.target === mini) { R.openBig(); return; }
      R.toggleCard();
    });

    SS.on('flights', update); SS.on('flights-tick', update); SS.on('settings', update);
    update();
    requestAnimationFrame(loop);
  };
  R.tuck = () => { if (!R.stripOpen) return; R.stripOpen = false; update(); };

  // Real photo when we have one (always credited); otherwise a type-accurate drawing, labelled as such.
  function setPhoto(host, photo, code, note) {
    const src = photo && photo.src;
    const key = (src || 'art:' + code) + '|' + (note ? note.text : '');
    if (host._key === key && host.firstChild) return;
    host._key = key;
    host.innerHTML = '';
    const art = () => { host.querySelector('img') && host.querySelector('img').remove(); host.prepend(F.art(code)); };
    if (src) {
      const img = U.h('img', { alt: '', referrerpolicy: 'no-referrer', decoding: 'async' });
      img.onerror = () => { art(); const c = host.querySelector('.fc-credit'); if (c) c.textContent = 'The photo couldn\'t load here. Showing a drawing instead.'; };
      img.src = src;
      host.append(img);
    } else host.append(F.art(code));
    if (note) host.append(note.link ? U.h('a', { class: 'fc-credit', href: note.link, target: '_blank', rel: 'noopener noreferrer' }, note.text + ' ↗') : U.h('span', { class: 'fc-credit' }, note.text));
  }

  const altTxt = p => (p.alt == null ? '—' : p.alt < 18000 ? U.fmt.int(p.alt) : 'FL' + Math.round(p.alt / 100));
  const vsArrow = vs => (vs < -300 ? '↓' : vs > 300 ? '↑' : '→');
  const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const point = b => POINTS[Math.round(((b % 360) + 360) % 360 / 22.5) % 16];

  function update() {
    const mode = SS.stripMode();
    const showStrip = mode === 'always' || (mode === 'tab' && R.stripOpen);
    if (strip.hidden === showStrip) strip.hidden = !showStrip;
    tab.hidden = mode !== 'tab' || R.stripOpen;
    els.hide.hidden = mode !== 'tab';
    document.body.classList.toggle('no-strip', !showStrip);
    document.body.classList.toggle('strip-tab', mode === 'tab');
    if (mode === 'off') { if (R.cardOpen) R.closeCard(); return; }
    const f = F.featured, st = F.status;
    // the little tab: just the flight and its countdown
    if (!tab.hidden) {
      const d = f && F.describe(f);
      const overhead = f && f.cpaT > 0 && f.cpaT < 600 && f.cpaD < 2.5;
      const t = f ? (overhead ? U.fmt.mmss(f.cpaT) : f.eta != null ? U.fmt.mmss(f.eta) : '') : '';
      const sig = (f ? d.flightNo + t + f.sim : 'none' + st.mode);
      if (tab._sig !== sig) {
        tab._sig = sig; tab.innerHTML = '';
        tab.classList.toggle('sim', !!(f ? f.sim : st.mode === 'sim'));
        tab.append(U.icon('plane'), U.h('span', { class: 'st-f' }, f ? d.flightNo : 'Radar'), t ? U.h('span', { class: 'st-t' }, t) : '');
      }
    }
    if (!strip.hidden) {
      if (f) {
        const d = F.describe(f), p = f.cur || F.pos(f);
        strip.classList.remove('quiet');
        els.tag.className = 'fs-tag' + (f.sim ? ' sim' : '');
        const narrow = innerWidth < 760;
        els.tag.textContent = f.sim ? (narrow ? 'Sim' : `Simulated · ${F.airport().code}`) : (narrow ? 'Arr' : `Arriving ${F.airport().code}`);
        if (d.flightNo !== lastFlightNo) { lastFlightNo = d.flightNo; flap(els.flight, d.flightNo); }
        els.air.textContent = d.airline;
        const o = d.origin;
        els.l2.innerHTML = '';
        els.l2.append(
          o ? U.h('b', null, o.iata || '???') : '', o ? ` ${o.city || o.name || ''} → ` : 'From ? → ', U.h('b', null, F.airport().code),
          ` · ${d.typeName}`, d.seats ? ` · ~${d.seats}` : '');
        setPhoto(els.photo, d.photo, f.type, null);
        const overhead = f.cpaT > 0 && f.cpaT < 600 && f.cpaD < 2.5;
        els.stats.innerHTML = '';
        els.stats.append(
          U.h('div', { class: 'fs-stat' }, U.h('b', null, altTxt(p) + ' ' + vsArrow(p.vs || 0)), U.h('i', null, 'ft')),
          U.h('div', { class: 'fs-stat' }, U.h('b', null, p.gs != null ? Math.round(p.gs) : '—'), U.h('i', null, 'knots')),
          U.h('div', { class: 'fs-stat eta' }, U.h('b', null, overhead ? U.fmt.mmss(f.cpaT) : f.eta != null ? U.fmt.mmss(f.eta) : '—'), U.h('i', null, overhead ? 'overhead' : 'to land')));
      } else {
        strip.classList.add('quiet');
        els.tag.className = 'fs-tag' + (st.mode === 'sim' ? ' sim' : '');
        els.tag.textContent = st.mode === 'live' ? `${F.airport().code} arrivals` : st.mode === 'sim' ? 'Simulated' : 'Radar';
        const ls = F.lastSeen;
        if (ls && lastFlightNo !== 'last:' + ls.flightNo) { lastFlightNo = 'last:' + ls.flightNo; els.flight.textContent = ls.flightNo; }
        if (!ls) els.flight.textContent = '';
        els.air.textContent = '';
        els.l2.textContent = ls ? `Last arrival${ls.origin && ls.origin.city ? ' from ' + ls.origin.city : ''} · ${ls.typeName || ''} · ${U.fmt.ago(Date.now() - ls.at)}` : (st.mode === 'live' ? 'Quiet skies. Watching the approach…' : 'Looking for traffic…');
        setPhoto(els.photo, ls && ls.photo, ls && ls.type, null);
        els.stats.innerHTML = '';
      }
    }
    if (R.cardOpen) renderCard();
    if (R.bigOpen) renderList();
  }

  /* ── Where a plane is from where you stand ── */
  R.observer = () => (CP.on && CP.obs) || F.spot();
  R.look = function (a, now = Date.now()) {
    const o = R.observer(), p = F.pos(a, now);
    const dist = G.dist(o.lat, o.lon, p.lat, p.lon), brg = G.bearing(o.lat, o.lon, p.lat, p.lon);
    const elev = p.alt != null ? Math.atan2(p.alt * 0.3048, Math.max(30, dist * 1852)) * 180 / Math.PI : null;
    const rel = CP.on && CP.heading != null ? G.angDiff(CP.heading, brg) : null;
    return { dist, brg, elev, rel, p };
  };
  const lookTxt = L => `${L.dist < 10 ? L.dist.toFixed(1) : Math.round(L.dist)} nm ${point(L.brg)}${L.elev != null ? ` · look up ${Math.max(0, Math.round(L.elev))}°` : ''}`;
  const relTxt = rel => (rel == null ? '' : Math.abs(rel) <= 8 ? 'straight ahead' : `${Math.round(Math.abs(rel))}° to your ${rel < 0 ? 'left' : 'right'}`);

  /* ── Detail card (for the featured arrival, or any plane tapped on the radar) ── */
  R.toggleCard = () => (R.cardOpen && !cardHex ? R.closeCard() : R.openCard());
  R.openCard = hex => {
    const nh = hex || null;
    if (nh !== cardHex) cardView = 'auto';
    cardHex = nh; R.cardOpen = true;
    const a = cardHex && F.list.find(x => x.hex === cardHex);
    if (a) F.enrich(a);
    U.$('#flightCard').classList.toggle('top', R.bigOpen);
    renderCard(); U.$('#flightCard').hidden = false;
  };
  R.closeCard = () => { R.cardOpen = false; cardHex = null; U.$('#flightCard').hidden = true; if (R.bigOpen) renderList(); };
  function renderCard() {
    const host = U.$('#flightCard');
    let f = cardHex ? F.list.find(a => a.hex === cardHex) : F.featured;
    if (cardHex && !f) { cardHex = null; f = F.featured; }
    const ls = F.lastSeen;
    if (!f && !ls) { host.innerHTML = ''; host.append(U.h('button', { class: 'fc-x', 'aria-label': 'Close', onclick: e => { e.stopPropagation(); R.closeCard(); } }, U.icon('x')), U.h('div', { class: 'fc-body' }, U.h('div', { class: 'fc-flight' }, 'No arrivals yet'), U.h('p', { class: 'fc-src' }, F.status.msg || 'Watching the approach into ' + F.airport().code + '.'))); return; }
    const d = f ? F.describe(f) : { flightNo: ls.flightNo, airline: ls.airline, origin: ls.origin, typeName: ls.typeName, kind: ls.kind, photo: ls.photo, seats: '', fact: '' };
    const code = f ? f.type : ls.type;
    if (!f && F.TY[code]) d.fact = F.TY[code][4];
    const p = f ? (f.cur || F.pos(f)) : null;
    const hasPhoto = !!(d.photo && d.photo.src);
    const view = cardView === 'drawing' || !hasPhoto ? 'drawing' : 'photo';
    host.innerHTML = '';
    const ph = cardPh || (cardPh = U.h('div', { class: 'fc-photo' }));
    const note = F.photoNote(f, d, view);
    setPhoto(ph, view === 'photo' ? d.photo : null, code, note);
    const x = U.h('button', { class: 'fc-x', 'aria-label': 'Close', onclick: e => { e.stopPropagation(); R.closeCard(); } }, U.icon('x'));
    const toggle = hasPhoto ? U.h('div', { class: 'seg fc-view' },
      U.h('button', { class: view === 'photo' ? 'on' : '', onclick: e => { e.stopPropagation(); cardView = 'photo'; renderCard(); } }, 'Photo'),
      U.h('button', { class: view === 'drawing' ? 'on' : '', onclick: e => { e.stopPropagation(); cardView = 'drawing'; renderCard(); } }, 'Drawing')) : '';
    const o = d.origin || {};
    const L = f ? R.look(f) : null;
    const tagTxt = f ? (f.sim ? 'Simulated' : f.inbound ? 'Live · arriving' : 'Live') : 'Last seen';
    const body = U.h('div', { class: 'fc-body' },
      U.h('div', { class: 'fc-top' }, U.h('div', null, U.h('div', { class: 'fc-flight' }, d.flightNo), U.h('div', { class: 'fc-air' }, d.airline || '')),
        U.h('span', { class: 'fs-tag' + (f && f.sim ? ' sim' : '') }, tagTxt)),
      U.h('div', { class: 'fc-route' },
        U.h('div', { class: 'ap' }, U.h('b', null, o.iata || '—'), U.h('span', null, o.city || o.name || 'Origin unknown')),
        U.h('div', { class: 'line' }),
        f && !f.inbound && d.dest && d.dest.iata !== F.airport().code
          ? U.h('div', { class: 'ap r' }, U.h('b', null, d.dest.iata || '—'), U.h('span', null, d.dest.city || d.dest.name || ''))
          : U.h('div', { class: 'ap r' }, U.h('b', null, f && !f.inbound && f.over ? '—' : F.airport().code), U.h('span', null, f && !f.inbound && f.over ? 'Passing over' : F.airport().city))),
      p ? U.h('div', { class: 'fc-grid' },
        U.h('div', null, U.h('b', null, altTxt(p) + ' ' + vsArrow(p.vs || 0)), U.h('i', null, 'Altitude ft')),
        U.h('div', null, U.h('b', null, p.gs != null ? Math.round(p.gs) + ' kt' : '—'), U.h('i', null, 'Ground speed')),
        f.inbound ? U.h('div', null, U.h('b', null, f.eta != null ? U.fmt.mmss(f.eta) : '—'), U.h('i', null, 'To touchdown'))
          : U.h('div', null, U.h('b', null, L.dist.toFixed(1) + ' nm'), U.h('i', null, 'From you'))) : '',
      L ? U.h('div', { class: 'fc-look' }, U.icon('compass'), U.h('span', null, 'From you: ', U.h('b', null, lookTxt(L)), L.rel != null ? ` · ${relTxt(L.rel)}` : '')) : '',
      U.h('div', { class: 'fc-type' }, d.typeName, d.reg ? U.h('small', null, ` · ${d.reg}`) : '', d.seats ? U.h('small', null, ` · typically ${d.seats}`) : '',
        d.distFlownMi ? U.h('small', null, ` · ${U.fmt.int(d.distFlownMi)} mi from ${o.city || o.iata}`) : ''),
      d.fact ? U.h('div', { class: 'fc-fact' }, d.fact) : '',
      U.h('div', { class: 'fc-src' },
        f && f.sim ? 'Simulated flight: this browser can\'t reach the live feeds, so these are made-up flights on the real approach path. ' :
          (F.status.home ? U.h('span', null, 'Position: ', U.h('a', { href: F.status.home, target: '_blank', rel: 'noopener noreferrer' }, F.status.source), ' · ') : ''),
        !(f && f.sim) ? U.h('span', null, 'Route: ', U.h('a', { href: 'https://www.adsbdb.com', target: '_blank', rel: 'noopener noreferrer' }, 'adsbdb'), ' (crowd-sourced, can be stale) · ') : '',
        "Passenger counts aren't broadcast, so the seat number is the typical range for this aircraft type."));
    host.append(x, ph, toggle, body);
  }
  document.addEventListener('pointerdown', e => {
    if (R.cardOpen && !e.target.closest('#flightCard') && !e.target.closest('#flightStrip') && !e.target.closest('#radarBig')) R.closeCard();
  });

  /* ── Compass: turn the radar so the top is the way you're facing ── */
  const CP = (R.compass = { on: false, heading: null, sx: 0, sy: 1, at: 0, obs: null, src: '', decl: 0 });
  let trim = +U.store.get('compassTrim', 0) || 0;
  // Magnetic declination (true north = magnetic + decl). Bay Area ≈ 13°E; elsewhere a tilted-dipole estimate,
  // which can be several degrees off, so the ‹ › buttons let you line it up with a plane you can see.
  function declination(lat, lon) {
    if (G.dist(lat, lon, 37.62, -122.38) < 200) return 13;
    return G.angDiff(0, G.bearing(lat, lon, 80.8, -72.7));
  }
  const screenAngle = () => (screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : typeof window.orientation === 'number' ? window.orientation : 0);
  // Direction the back camera points (phone held up like a viewfinder). W3C DeviceOrientation, worked example.
  function camHeading(al, be, ga) {
    const d = Math.PI / 180, x = be * d, y = ga * d, z = al * d;
    const vx = -Math.cos(z) * Math.sin(y) - Math.sin(z) * Math.sin(x) * Math.cos(y);
    const vy = -Math.sin(z) * Math.sin(y) + Math.cos(z) * Math.sin(x) * Math.cos(y);
    return (Math.atan2(vx, vy) * 180 / Math.PI + 360) % 360;
  }
  function onOrient(e) {
    let hd = null;
    const upright = Math.abs(e.beta || 0) > 55;
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading) && e.webkitCompassHeading >= 0) { hd = e.webkitCompassHeading; CP.src = 'ios'; }
    else if ((e.absolute || e.type === 'deviceorientationabsolute') && e.alpha != null) { hd = upright ? camHeading(e.alpha, e.beta, e.gamma || 0) : 360 - e.alpha; CP.src = 'abs'; }
    if (hd == null) return;
    if (!upright) hd += screenAngle();
    hd += CP.decl + trim;
    const r = hd * Math.PI / 180;
    if (!CP.at) { CP.sx = Math.sin(r); CP.sy = Math.cos(r); }
    else { CP.sx = CP.sx * 0.78 + Math.sin(r) * 0.22; CP.sy = CP.sy * 0.78 + Math.cos(r) * 0.22; }
    CP.heading = (Math.atan2(CP.sx, CP.sy) * 180 / Math.PI + 360) % 360;
    CP.at = Date.now();
  }
  R.compassOn = async function () {
    if (!window.isSecureContext) { U.toast('The compass needs the https:// version of the page'); return; }
    if (typeof DeviceOrientationEvent === 'undefined') { U.toast('This device has no compass'); return; }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') { U.toast(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? 'Compass access was turned down. Close and reopen the page to be asked again, or check Settings → Apps → Safari → Motion & Orientation Access.' : 'Compass access was turned down. Allow motion sensors for this site in the browser\'s site settings.'); return; } }
      catch (err) { U.toast('Couldn\'t ask for compass access here'); return; }
    }
    const sp = F.spot();
    CP.on = true; CP.at = 0; CP.heading = null; CP.decl = declination(sp.lat, sp.lon);
    U.store.set('compassPref', true);
    addEventListener('deviceorientationabsolute', onOrient, true);
    addEventListener('deviceorientation', onOrient, true);
    compassBtn && compassBtn.classList.add('on');
    setTimeout(() => { if (CP.on && !CP.at) { U.toast('No compass reading. Phones and tablets have one; most laptops and Pis don\'t.'); R.compassOff(); } }, 3500);
    // a fixed spot? then work out directions from where you actually are, if you're nearby
    if (!sp.device && navigator.geolocation) navigator.geolocation.getCurrentPosition(pos => {
      const la = pos.coords.latitude, lo = pos.coords.longitude, away = G.dist(la, lo, sp.lat, sp.lon);
      if (away < 40) { CP.obs = { lat: la, lon: lo, place: 'You', device: true }; CP.decl = declination(la, lo); }
      else U.toast(`You're ${Math.round(away)} nm from ${sp.place}, so directions are worked out from there`);
    }, () => {}, { timeout: 8000, maximumAge: 120000 });
  };
  R.compassOff = function () {
    CP.on = false; CP.heading = null; CP.obs = null;
    U.store.set('compassPref', false);
    removeEventListener('deviceorientationabsolute', onOrient, true);
    removeEventListener('deviceorientation', onOrient, true);
    compassBtn && compassBtn.classList.remove('on');
    if (bigFacing) bigFacing.hidden = true;
  };
  const nudge = deg => { trim = ((trim + deg + 540) % 360) - 180; U.store.set('compassTrim', trim); if (CP.heading != null) { const r = (CP.heading + deg) * Math.PI / 180; CP.sx = Math.sin(r); CP.sy = Math.cos(r); CP.heading = (CP.heading + deg + 360) % 360; } };

  /* ── Radar drawing ── */
  let facing = null;
  function drawScope(cv, detail, now) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d'), s = SS.settings.flight, cx = W / 2, cy = H / 2, rad = Math.min(W, H) / 2 - 1 * dpr;
    const range = s.radius, k = rad / range;
    const compassView = CP.on && CP.heading != null;   // the little radar on the strip turns with you too
    const turn = compassView ? CP.heading : 0, tr = turn * Math.PI / 180, ct = Math.cos(tr), stt = Math.sin(tr);
    const o = R.observer();
    const proj = (la, lo) => { const [e, n] = G.enu(o.lat, o.lon, la, lo); return [cx + (e * ct - n * stt) * k, cy - (e * stt + n * ct) * k]; };
    const atBrg = (b, r) => { const a = (b - turn) * Math.PI / 180; return [cx + Math.sin(a) * r, cy - Math.cos(a) * r]; };
    g.clearRect(0, 0, W, H);
    g.save(); g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.clip();
    const bg = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    bg.addColorStop(0, detail ? 'rgba(30,22,8,.92)' : 'rgba(30,22,8,.55)'); bg.addColorStop(1, detail ? 'rgba(6,6,8,.96)' : 'rgba(6,6,8,.35)');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // view cone: where the phone is pointing
    if (compassView) {
      const cone = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      cone.addColorStop(0, 'rgba(244,241,234,.20)'); cone.addColorStop(1, 'rgba(244,241,234,.02)');
      g.fillStyle = cone; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, rad, -Math.PI / 2 - 0.33, -Math.PI / 2 + 0.33); g.closePath(); g.fill();
    }
    // rings
    g.strokeStyle = 'rgba(255,181,71,.16)'; g.lineWidth = dpr;
    const rings = detail ? [5, 10, 20, 40].filter(r => r <= range) : [range / 3, range * 2 / 3];
    rings.forEach(r => { g.beginPath(); g.arc(cx, cy, r * k, 0, Math.PI * 2); g.stroke(); });
    if (detail) {
      g.fillStyle = 'rgba(255,181,71,.45)'; g.font = `${10 * dpr}px "JetBrains Mono", monospace`; g.textAlign = 'left';
      rings.forEach(r => g.fillText(r + ' nm', cx + 4 * dpr, cy - r * k + 12 * dpr));
      g.strokeStyle = 'rgba(255,181,71,.08)'; g.beginPath();
      [0, 90].forEach(b => { const [x1, y1] = atBrg(b, rad), [x2, y2] = atBrg(b + 180, rad); g.moveTo(x1, y1); g.lineTo(x2, y2); });
      g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([l, b]) => { const [x, y] = atBrg(b, rad - 13 * dpr); g.fillStyle = l === 'N' && compassView ? 'rgba(255,107,94,.9)' : 'rgba(255,181,71,.55)'; g.font = `${l === 'N' ? 600 : 400} ${10.5 * dpr}px "JetBrains Mono", monospace`; g.fillText(l, x, y); });
      g.textBaseline = 'alphabetic';
    }
    // approach centreline + runways
    const T = F.RWY28, back = (T.crs + 180) % 360;
    const [tx, ty] = proj(T.lat, T.lon), far = G.dest(T.lat, T.lon, back, 18), [fx, fy] = proj(far[0], far[1]);
    g.setLineDash([4 * dpr, 5 * dpr]); g.strokeStyle = 'rgba(255,181,71,.32)'; g.lineWidth = dpr;
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(fx, fy); g.stroke(); g.setLineDash([]);
    const end = G.dest(T.lat, T.lon, T.crs, 2), [ex, ey] = proj(end[0], end[1]);
    g.strokeStyle = 'rgba(244,241,234,.75)'; g.lineWidth = (detail ? 3 : 2) * dpr; g.beginPath(); g.moveTo(tx, ty); g.lineTo(ex, ey); g.stroke();
    if (detail) { g.fillStyle = 'rgba(244,241,234,.8)'; g.font = `600 ${11 * dpr}px Inter, sans-serif`; g.textAlign = 'center'; g.fillText(F.airport().code, ex, ey - 9 * dpr); }
    // sweep
    const ang = ((now / 4000) % 1) * Math.PI * 2 - Math.PI / 2;
    for (let i = 0; i < 24; i++) {
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, rad, ang - (i + 1) * 0.035, ang - i * 0.035); g.closePath();
      g.fillStyle = `rgba(255,181,71,${0.16 * (1 - i / 24)})`; g.fill();
    }
    // you
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(cx, cy, (detail ? 3.5 : 2) * dpr, 0, Math.PI * 2); g.fill();
    if (detail) { g.fillStyle = 'rgba(244,241,234,.75)'; g.font = `500 ${10.5 * dpr}px Inter, sans-serif`; g.textAlign = 'center'; g.fillText(o.device ? 'You' : (o.place || 'You'), cx, cy + 17 * dpr); }
    // what's in the view cone?
    if (detail) {
      facing = null;
      if (CP.on && CP.heading != null) {
        let best = null;
        for (const a of F.list) { const L = R.look(a, now); if (L.dist > range || Math.abs(L.rel) > 19) continue; const sc = Math.abs(L.rel) + L.dist * 0.6; if (!best || sc < best.sc) best = { a, L, sc }; }
        facing = best;
      }
      hits = [];
    }
    // aircraft
    const placed = [];
    for (const a of F.list) {
      const p = F.pos(a, now);
      const [x, y] = proj(p.lat, p.lon);
      if (Math.hypot(x - cx, y - cy) > rad + 10) continue;
      const feat = F.featured && F.featured.hex === a.hex, sel = R.cardOpen && cardHex === a.hex, look = facing && facing.a === a;
      const brg = Math.atan2(y - cy, x - cx);
      const since = ((ang - brg) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const glow = 1 - since / (Math.PI * 2) * 0.55;
      const col = a.inbound ? `rgba(255,181,71,${glow})` : `rgba(244,241,234,${0.55 * glow})`;
      if (detail && a.trail && a.trail.length > 1) {
        g.strokeStyle = a.inbound ? 'rgba(255,181,71,.25)' : 'rgba(244,241,234,.14)'; g.lineWidth = 1.2 * dpr; g.beginPath();
        a.trail.forEach(([la, lo], i) => { const [px, py] = proj(la, lo); i ? g.lineTo(px, py) : g.moveTo(px, py); });
        g.lineTo(x, y); g.stroke();
      }
      if (detail) {
        hits.push({ hex: a.hex, x: x / dpr, y: y / dpr });
        g.save(); g.translate(x, y); g.rotate((((p.trk || 0) - turn) * Math.PI) / 180);
        g.fillStyle = col; g.beginPath(); const z = (feat ? 7 : 5.5) * dpr; g.moveTo(0, -z); g.lineTo(z * 0.7, z * 0.75); g.lineTo(0, z * 0.35); g.lineTo(-z * 0.7, z * 0.75); g.closePath(); g.fill(); g.restore();
        if (feat || sel || look) {
          g.strokeStyle = sel || look ? '#f4f1ea' : 'rgba(255,181,71,.9)'; g.lineWidth = 1.4 * dpr; g.beginPath();
          g.arc(x, y, (look ? 13 + Math.sin(now / 180) * 2 : 12) * dpr, 0, Math.PI * 2); g.stroke();
        }
        if (a.inbound || feat || sel || look || a.dObs < range * 0.5) {
          // labels: try a few spots so neighbours don't print over each other
          const lw = 74 * dpr, lh = 22 * dpr;
          const spots = [[9, -14], [9, 10], [-9 - 74, -14], [-9 - 74, 10], [9, -38], [9, 34]];
          let sx = spots[0][0] * dpr, sy = spots[0][1] * dpr;
          for (const [ox, oy] of spots) {
            const r = { x: x + ox * dpr, y: y + oy * dpr };
            if (!placed.some(q => r.x < q.x + lw && r.x + lw > q.x && r.y < q.y + lh && r.y + lh > q.y)) { sx = ox * dpr; sy = oy * dpr; break; }
          }
          placed.push({ x: x + sx, y: y + sy });
          g.textAlign = 'left';
          g.fillStyle = col; g.font = `600 ${10 * dpr}px "JetBrains Mono", monospace`;
          g.fillText(a.cs || a.reg || a.hex, x + sx, y + sy + 10 * dpr);
          g.fillStyle = 'rgba(244,241,234,.55)'; g.font = `${9 * dpr}px "JetBrains Mono", monospace`;
          g.fillText(`${p.alt != null ? String(Math.round(p.alt / 100)).padStart(3, '0') : '---'} ${a.type || ''}`, x + sx, y + sy + 21 * dpr);
        }
      } else {
        g.fillStyle = col; g.beginPath(); g.arc(x, y, (feat ? 2.6 : 1.7) * dpr, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
    g.strokeStyle = 'rgba(255,181,71,.35)'; g.lineWidth = dpr; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.stroke();
    if (compassView && !detail) { // little radar: a red tick where north is
      const [nx, ny] = atBrg(0, rad - 3 * dpr); g.fillStyle = '#ff6b5e'; g.beginPath(); g.arc(nx, ny, 2.2 * dpr, 0, Math.PI * 2); g.fill();
    }
    if (compassView && detail) { // heading pointer at the top
      g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(cx, 3 * dpr); g.lineTo(cx - 6 * dpr, 13 * dpr); g.lineTo(cx + 6 * dpr, 13 * dpr); g.closePath(); g.fill();
    }
  }

  let lastMini = 0, lastFacing = 0;
  function loop(now) {
    const t = Date.now();
    if (strip && !strip.hidden && now - lastMini > 66) { drawScope(mini, false, t); lastMini = now; }
    if (R.bigOpen && bigCanvas) {
      drawScope(bigCanvas, true, t);
      if (now - lastFacing > 300) { lastFacing = now; renderFacing(); }
    }
    requestAnimationFrame(loop);
  }

  function renderFacing() {
    if (!bigFacing) return;
    if (!CP.on) { bigFacing.hidden = true; return; }
    bigFacing.hidden = false;
    if (CP.heading == null) { bigFacing.textContent = 'Waiting for the compass… hold the phone flat, or up like a camera.'; return; }
    const hd = `${Math.round(CP.heading)}° ${point(CP.heading)}`;
    let sig, kids;
    if (facing) {
      const d = F.describe(facing.a);
      sig = facing.a.hex + Math.round(facing.L.dist * 10) + Math.round(facing.L.elev || 0) + hd;
      kids = [U.h('span', { class: 'rf-h' }, `Facing ${hd}`), U.h('b', null, d.flightNo), U.h('span', null, `${d.typeName} · ${lookTxt(facing.L)}`), U.h('button', { class: 'btn small amber', onclick: () => R.openCard(facing.a.hex) }, 'See the plane')];
    } else {
      const arr = F.list.filter(a => a.inbound).map(a => ({ a, L: R.look(a) })).sort((x, y) => x.L.dist - y.L.dist)[0];
      sig = 'none' + hd + (arr ? arr.a.hex + Math.round(arr.L.rel / 5) : '');
      kids = [U.h('span', { class: 'rf-h' }, `Facing ${hd}`), U.h('span', null, 'No planes that way.'), arr ? U.h('span', null, ` Nearest arrival ${F.describe(arr.a).flightNo} is ${relTxt(arr.L.rel)}.`) : ''];
    }
    if (bigFacing._sig === sig) return;
    bigFacing._sig = sig; bigFacing.innerHTML = '';
    bigFacing.append(U.h('div', { class: 'rf-main' }, kids),
      U.h('div', { class: 'rf-trim' }, U.h('button', { class: 'icon-btn', title: 'Turn the radar 2° left (if the compass is a bit off)', onclick: () => nudge(-2) }, U.icon('left')), U.h('button', { class: 'icon-btn', title: 'Turn the radar 2° right', onclick: () => nudge(2) }, U.icon('right'))));
  }

  /* ── Big radar ── */
  R.openBig = function () {
    const host = U.$('#radarBig');
    host.innerHTML = '';
    bigCanvas = U.h('canvas');
    bigList = U.h('div');
    bigStatus = U.h('div', { class: 'rb-status' });
    bigFacing = U.h('div', { class: 'rb-facing', hidden: true });
    compassBtn = U.h('button', { class: 'btn small rb-compass' + (CP.on ? ' on' : ''), title: 'Turn the radar to match the way you\'re facing', onclick: () => (CP.on ? R.compassOff() : R.compassOn()) }, U.icon('compass'), 'Compass');
    let press = null, fired = false;
    bigCanvas.addEventListener('pointerdown', () => { fired = false; press = setTimeout(() => { fired = true; R.closeBig(); SS.game.open(); }, 1100); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => bigCanvas.addEventListener(ev, () => clearTimeout(press)));
    // tap a blip to see that plane
    bigCanvas.addEventListener('click', e => {
      if (fired) return;
      const r = bigCanvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      let best = null, bd = 30;
      hits.forEach(hh => { const dd = Math.hypot(hh.x - px, hh.y - py); if (dd < bd) { bd = dd; best = hh; } });
      if (best) R.openCard(best.hex);
    });
    const win = U.h('div', { class: 'rb-win' },
      U.h('div', { class: 'rb-scope' }, U.h('button', { class: 'icon-btn rb-close', 'aria-label': 'Close', onclick: R.closeBig }, U.icon('x')), compassBtn, bigCanvas),
      U.h('div', { class: 'rb-side' }, bigFacing, U.h('h3', null, `${F.airport().code} approach`), bigStatus, bigList));
    host.append(win);
    host.onclick = e => { if (e.target === host) R.closeBig(); };
    host.hidden = false; R.bigOpen = true;
    if (U.store.get('compassPref', false) && !CP.on) R.compassOn();
    renderList();
  };
  R.closeBig = () => { U.$('#radarBig').hidden = true; R.bigOpen = false; if (R.cardOpen && U.$('#flightCard').classList.contains('top')) R.closeCard(); };
  function renderList() {
    if (!bigList) return;
    const st = F.status;
    const sp = R.observer();
    const sig = [sp.device, sp.place, sp.waiting, F.here && F.here.name, F.locNote, st.mode, st.count, st.source, st.msg, st.mode === 'live' ? U.fmt.ago(Date.now() - st.at) : ''].join('|');
    if (bigStatus._sig !== sig) {   // only rebuild when something changed, so the Change button stays tappable
    bigStatus._sig = sig;
    bigStatus.innerHTML = '';
    bigStatus.append(
      U.h('div', { class: 'rb-where' }, U.icon('pin'), U.h('span', null, sp.device ? `Centred on you · ${(F.here && F.here.name) || 'your location'}` : `Centred on ${sp.place}${sp.waiting ? ' until your location comes in' : ''}`),
        U.h('button', { class: 'btn small ghost', onclick: () => { R.closeBig(); SS.settingsUI.open('flights'); } }, 'Change')),
      F.locNote ? U.h('div', null, F.locNote) : '',
      st.mode === 'live' ? `Live · ${st.count} aircraft via ${st.source} · updated ${U.fmt.ago(Date.now() - st.at)} · tap a plane to see it` : st.mode === 'sim' ? `Simulated traffic. ${st.msg} Tap a plane to see it.` : st.msg || 'Starting…');
    }
    bigList.innerHTML = '';
    const rows = F.list.slice().sort((a, b) => (b.inbound - a.inbound) || (a.inbound ? (a.eta || 1e9) - (b.eta || 1e9) : a.dObs - b.dObs)).slice(0, 30);
    if (!rows.length) bigList.append(U.h('div', { class: 'empty' }, 'No aircraft in range right now.'));
    rows.forEach(a => {
      const d = F.describe(a), p = a.cur || F.pos(a);
      bigList.append(U.h('div', { class: 'rb-row' + (R.cardOpen && cardHex === a.hex ? ' sel' : ''), onclick: () => R.openCard(a.hex) },
        U.h('b', { class: a.inbound ? 'arr' : '' }, d.flightNo), U.h('div', { class: 'r' }, altTxt(p) + (p.alt != null && p.alt < 18000 ? ' ft' : '')),
        U.h('span', null, `${a.type || '?'}${d.origin ? ' · from ' + (d.origin.city || d.origin.iata) : ''}`), U.h('div', { class: 'r' }, a.inbound && a.eta ? U.fmt.mmss(a.eta) : (a.dObs != null ? a.dObs.toFixed(1) + ' nm' : ''))));
    });
  }
})();
