/* Flight strip (slim, translucent, bottom of screen), detail card, mini + big radar. */
(function () {
  'use strict';
  const U = SS.u, G = U.geo, F = SS.flights;
  const R = (SS.radar = { bigOpen: false, cardOpen: false });
  let strip, els = {}, mini, bigCanvas, bigList, bigStatus, selHex = null, lastFlightNo = '', cardPh = null;

  /* ── split-flap text, like an old departures board ── */
  const FLAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function flap(el, text) {
    el.textContent = '';
    const chars = Array.from(text);
    chars.forEach((ch, i) => {
      const s = U.h('span', { class: 'flap-ch' }, ch === ' ' ? ' ' : '·');
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
    els.photo = U.h('div', { class: 'fs-photo' });
    els.tag = U.h('span', { class: 'fs-tag' });
    els.flight = U.h('span', { class: 'fs-flight' });
    els.air = U.h('span', { class: 'fs-air' });
    els.l2 = U.h('div', { class: 'fs-l2' });
    els.stats = U.h('div', { class: 'fs-stats' });
    mini = U.h('canvas', { class: 'fs-radar', title: 'Radar' });
    strip.append(els.photo, U.h('div', { class: 'fs-main' }, U.h('div', { class: 'fs-l1' }, els.tag, els.flight, els.air), els.l2), els.stats, mini);

    // Easter egg: triple-tap the flight number, or long-press the strip.
    let taps = [];
    els.flight.addEventListener('pointerup', e => {
      const now = Date.now(); taps = taps.filter(t => now - t < 750); taps.push(now);
      if (taps.length >= 3) { taps = []; e.stopPropagation(); SS.game.open(); }
    });
    let press = null;
    strip.addEventListener('pointerdown', () => { press = setTimeout(() => { press = 'fired'; SS.game.open(); }, 1100); });
    const cancel = () => { if (press && press !== 'fired') clearTimeout(press); };
    strip.addEventListener('pointerup', cancel); strip.addEventListener('pointerleave', cancel); strip.addEventListener('pointercancel', cancel);
    strip.addEventListener('click', e => {
      if (press === 'fired') { press = null; return; }
      if (e.target === mini) { R.openBig(); return; }
      R.toggleCard();
    });

    SS.on('flights', update); SS.on('flights-tick', update); SS.on('settings', update);
    update();
    requestAnimationFrame(loop);
  };

  // Real photo when we have one (always credited); otherwise a type-accurate illustration, labelled as such.
  function setPhoto(host, photo, code, note) {
    const src = photo && photo.src;
    const key = (src || 'art:' + code) + '|' + (note ? note.text : '');
    if (host._key === key && host.firstChild) return;
    host._key = key;
    host.innerHTML = '';
    const art = () => { host.querySelector('img') && host.querySelector('img').remove(); host.prepend(F.art(code)); };
    if (src) {
      const img = U.h('img', { alt: '', referrerpolicy: 'no-referrer', decoding: 'async' });
      img.onerror = () => { art(); const c = host.querySelector('.fc-credit'); if (c) c.textContent = 'Photo couldn\'t load here. Showing an illustration.'; };
      img.src = src;
      host.append(img);
    } else host.append(F.art(code));
    if (note) host.append(note.link ? U.h('a', { class: 'fc-credit', href: note.link, target: '_blank', rel: 'noopener noreferrer' }, note.text + ' ↗') : U.h('span', { class: 'fc-credit' }, note.text));
  }

  const altTxt = p => (p.alt == null ? '—' : p.alt < 18000 ? U.fmt.int(p.alt) : 'FL' + Math.round(p.alt / 100));
  const vsArrow = vs => (vs < -300 ? '↓' : vs > 300 ? '↑' : '→');

  function update() {
    const s = SS.settings.flight;
    const show = s.enabled && s.strip && s.mode !== 'off';
    strip.hidden = !show;
    document.body.classList.toggle('no-strip', !show);
    if (!show) return;
    const f = F.featured, st = F.status;
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
        ` · ${d.typeName}`, d.seats ? ` · ~${d.seats}` : '',
        d.photo && d.photo.by ? ` · Photo © ${d.photo.by}` : ' · illustration',
      );
      setPhoto(els.photo, d.photo, f.type, null);
      const overhead = f.cpaT > 0 && f.cpaT < 600 && f.cpaD < 2.5;
      els.stats.innerHTML = '';
      els.stats.append(
        U.h('div', { class: 'fs-stat' }, U.h('b', null, altTxt(p) + ' ' + vsArrow(p.vs || 0)), U.h('i', null, 'ft')),
        U.h('div', { class: 'fs-stat' }, U.h('b', null, p.gs != null ? Math.round(p.gs) : '—'), U.h('i', null, 'knots')),
        U.h('div', { class: 'fs-stat eta' }, U.h('b', null, overhead ? U.fmt.mmss(f.cpaT) : f.eta != null ? U.fmt.mmss(f.eta) : '—'), U.h('i', null, overhead ? 'overhead' : 'to land')),
      );
    } else {
      strip.classList.add('quiet');
      els.tag.className = 'fs-tag' + (st.mode === 'sim' ? ' sim' : '');
      els.tag.textContent = st.mode === 'live' ? `${F.airport().code} arrivals` : st.mode === 'sim' ? 'Simulated' : 'Radar';
      const ls = F.lastSeen;
      if (ls && lastFlightNo !== 'last:' + ls.flightNo) { lastFlightNo = 'last:' + ls.flightNo; els.flight.textContent = ls.flightNo; }
      if (!ls) els.flight.textContent = '';
      els.air.textContent = '';
      els.l2.textContent = ls ? `Last arrival${ls.origin && ls.origin.city ? ' from ' + ls.origin.city : ''} · ${ls.typeName || ''} · ${U.fmt.ago(Date.now() - ls.at)}` : (st.mode === 'live' ? 'Quiet skies. Watching the approach…' : st.msg || 'Looking for traffic…');
      setPhoto(els.photo, ls && ls.photo, ls && ls.type, null);
      els.stats.innerHTML = '';
    }
    if (R.cardOpen) renderCard();
    if (R.bigOpen) renderList();
  }

  /* ── Detail card ── */
  R.toggleCard = () => (R.cardOpen ? R.closeCard() : R.openCard());
  R.openCard = () => { R.cardOpen = true; renderCard(); U.$('#flightCard').hidden = false; };
  R.closeCard = () => { R.cardOpen = false; U.$('#flightCard').hidden = true; };
  function renderCard() {
    const host = U.$('#flightCard');
    const f = F.featured;
    const ls = F.lastSeen;
    if (!f && !ls) { host.innerHTML = ''; host.append(U.h('div', { class: 'fc-body' }, U.h('div', { class: 'fc-flight' }, 'No arrivals yet'), U.h('p', { class: 'fc-src' }, F.status.msg || 'Watching the approach into ' + F.airport().code + '.'))); return; }
    const d = f ? F.describe(f) : { flightNo: ls.flightNo, airline: ls.airline, origin: ls.origin, typeName: ls.typeName, kind: ls.kind, photo: ls.photo, seats: '', fact: '' };
    const t = f && F.TY[f.type];
    if (!f && t) d.fact = t[4];
    const p = f ? (f.cur || F.pos(f)) : null;
    host.innerHTML = '';
    const ph = cardPh || (cardPh = U.h('div', { class: 'fc-photo' }));
    const note = f ? F.photoNote(f, d) : (d.photo && d.photo.src ? { text: `Photo © ${d.photo.by || 'photographer'} · ${d.photo.site}`, link: d.photo.link } : { text: `Illustration of a ${d.typeName || 'plane'}` });
    setPhoto(ph, d.photo, f ? f.type : ls.type, note);
    const x = U.h('button', { class: 'fc-x', 'aria-label': 'Close', onclick: e => { e.stopPropagation(); R.closeCard(); } }, U.icon('x'));
    const o = d.origin || {};
    const body = U.h('div', { class: 'fc-body' },
      U.h('div', { class: 'fc-top' }, U.h('div', null, U.h('div', { class: 'fc-flight' }, d.flightNo), U.h('div', { class: 'fc-air' }, d.airline || '')),
        U.h('span', { class: 'fs-tag' + (f && f.sim ? ' sim' : '') }, f ? (f.sim ? 'Simulated' : 'Live') : 'Last seen')),
      U.h('div', { class: 'fc-route' },
        U.h('div', { class: 'ap' }, U.h('b', null, o.iata || '—'), U.h('span', null, o.city || o.name || 'Origin unknown')),
        U.h('div', { class: 'line' }),
        U.h('div', { class: 'ap r' }, U.h('b', null, F.airport().code), U.h('span', null, F.airport().city))),
      p ? U.h('div', { class: 'fc-grid' },
        U.h('div', null, U.h('b', null, altTxt(p) + ' ' + vsArrow(p.vs || 0)), U.h('i', null, 'Altitude ft')),
        U.h('div', null, U.h('b', null, p.gs != null ? Math.round(p.gs) + ' kt' : '—'), U.h('i', null, 'Ground speed')),
        U.h('div', null, U.h('b', null, f.eta != null ? U.fmt.mmss(f.eta) : '—'), U.h('i', null, 'To touchdown'))) : '',
      U.h('div', { class: 'fc-type' }, d.typeName, d.reg ? U.h('small', null, ` · ${d.reg}`) : '', d.seats ? U.h('small', null, ` · typically ${d.seats}`) : '',
        d.distFlownMi ? U.h('small', null, ` · ${U.fmt.int(d.distFlownMi)} mi from ${o.city || o.iata}`) : ''),
      d.fact ? U.h('div', { class: 'fc-fact' }, d.fact) : '',
      U.h('div', { class: 'fc-src' },
        f && f.sim ? 'Simulated traffic: live flight feeds aren\'t reachable from here, so these are made-up flights on the real approach path. ' :
          (F.status.home ? U.h('span', null, 'Position: ', U.h('a', { href: F.status.home, target: '_blank', rel: 'noopener noreferrer' }, F.status.source), ' · ') : ''),
        !(f && f.sim) ? U.h('span', null, 'Route: ', U.h('a', { href: 'https://www.adsbdb.com', target: '_blank', rel: 'noopener noreferrer' }, 'adsbdb'), ' (crowd-sourced, can be stale) · ') : '',
        U.h('span', null, 'Picture: ', note.link ? U.h('a', { href: note.link, target: '_blank', rel: 'noopener noreferrer' }, note.text) : note.text, ' · '),
        "Passenger counts aren't broadcast, so the seat number is the typical range for this aircraft type."));
    host.append(x, ph, body);
  }
  document.addEventListener('pointerdown', e => {
    if (R.cardOpen && !e.target.closest('#flightCard') && !e.target.closest('#flightStrip')) R.closeCard();
  });

  /* ── Radar drawing ── */
  function drawScope(cv, detail, now) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d'), s = SS.settings.flight, cx = W / 2, cy = H / 2, rad = Math.min(W, H) / 2 - 1 * dpr;
    const range = s.radius, k = rad / range;
    const proj = (la, lo) => { const [e, n] = G.enu(s.lat, s.lon, la, lo); return [cx + e * k, cy - n * k]; };
    g.clearRect(0, 0, W, H);
    g.save(); g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.clip();
    const bg = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    bg.addColorStop(0, detail ? 'rgba(30,22,8,.92)' : 'rgba(30,22,8,.55)'); bg.addColorStop(1, detail ? 'rgba(6,6,8,.96)' : 'rgba(6,6,8,.35)');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // rings
    g.strokeStyle = 'rgba(255,181,71,.16)'; g.lineWidth = dpr;
    const rings = detail ? [5, 10, 20, 40].filter(r => r <= range) : [range / 3, range * 2 / 3];
    rings.forEach(r => { g.beginPath(); g.arc(cx, cy, r * k, 0, Math.PI * 2); g.stroke(); });
    if (detail) {
      g.fillStyle = 'rgba(255,181,71,.45)'; g.font = `${10 * dpr}px "JetBrains Mono", monospace`; g.textAlign = 'left';
      rings.forEach(r => g.fillText(r + ' nm', cx + 4 * dpr, cy - r * k + 12 * dpr));
      g.beginPath(); g.moveTo(cx, cy - rad); g.lineTo(cx, cy + rad); g.moveTo(cx - rad, cy); g.lineTo(cx + rad, cy); g.strokeStyle = 'rgba(255,181,71,.08)'; g.stroke();
      g.fillStyle = 'rgba(255,181,71,.55)'; g.textAlign = 'center';
      g.fillText('N', cx, cy - rad + 16 * dpr); g.fillText('S', cx, cy + rad - 8 * dpr); g.fillText('E', cx + rad - 10 * dpr, cy + 4 * dpr); g.fillText('W', cx - rad + 10 * dpr, cy + 4 * dpr);
    }
    // approach centreline + runways
    const T = F.RWY28, back = (T.crs + 180) % 360;
    const [tx, ty] = proj(T.lat, T.lon), far = G.dest(T.lat, T.lon, back, 18), [fx, fy] = proj(far[0], far[1]);
    g.setLineDash([4 * dpr, 5 * dpr]); g.strokeStyle = 'rgba(255,181,71,.32)'; g.lineWidth = dpr;
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(fx, fy); g.stroke(); g.setLineDash([]);
    const end = G.dest(T.lat, T.lon, T.crs, 2), [ex, ey] = proj(end[0], end[1]);
    g.strokeStyle = 'rgba(244,241,234,.75)'; g.lineWidth = (detail ? 3 : 2) * dpr; g.beginPath(); g.moveTo(tx, ty); g.lineTo(ex, ey); g.stroke();
    if (detail) { g.fillStyle = 'rgba(244,241,234,.8)'; g.font = `600 ${11 * dpr}px Inter, sans-serif`; g.fillText(F.airport().code, ex - 16 * dpr, ey - 8 * dpr); }
    // sweep
    const ang = ((now / 4000) % 1) * Math.PI * 2 - Math.PI / 2;
    for (let i = 0; i < 24; i++) {
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, rad, ang - (i + 1) * 0.035, ang - i * 0.035); g.closePath();
      g.fillStyle = `rgba(255,181,71,${0.16 * (1 - i / 24)})`; g.fill();
    }
    // you
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(cx, cy, (detail ? 3.5 : 2) * dpr, 0, Math.PI * 2); g.fill();
    if (detail) { g.fillStyle = 'rgba(244,241,234,.75)'; g.font = `500 ${10.5 * dpr}px Inter, sans-serif`; g.textAlign = 'center'; g.fillText(s.place || 'You', cx, cy + 16 * dpr); }
    // aircraft
    for (const a of F.list) {
      const p = F.pos(a, now);
      const [x, y] = proj(p.lat, p.lon);
      if (Math.hypot(x - cx, y - cy) > rad + 10) continue;
      const feat = F.featured && F.featured.hex === a.hex, sel = selHex === a.hex;
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
        g.save(); g.translate(x, y); g.rotate(((p.trk || 0) * Math.PI) / 180);
        g.fillStyle = col; g.beginPath(); const z = (feat ? 7 : 5.5) * dpr; g.moveTo(0, -z); g.lineTo(z * 0.7, z * 0.75); g.lineTo(0, z * 0.35); g.lineTo(-z * 0.7, z * 0.75); g.closePath(); g.fill(); g.restore();
        if (feat || sel) { g.strokeStyle = sel ? '#f4f1ea' : 'rgba(255,181,71,.9)'; g.lineWidth = 1.4 * dpr; g.beginPath(); g.arc(x, y, 12 * dpr, 0, Math.PI * 2); g.stroke(); }
        if (a.inbound || feat || sel || a.dObs < range * 0.5) {
          g.fillStyle = col; g.font = `600 ${10 * dpr}px "JetBrains Mono", monospace`; g.textAlign = 'left';
          g.fillText(a.cs || a.reg || a.hex, x + 9 * dpr, y - 4 * dpr);
          g.fillStyle = 'rgba(244,241,234,.55)'; g.font = `${9 * dpr}px "JetBrains Mono", monospace`;
          g.fillText(`${p.alt != null ? String(Math.round(p.alt / 100)).padStart(3, '0') : '---'} ${a.type || ''}`, x + 9 * dpr, y + 7 * dpr);
        }
      } else {
        g.fillStyle = col; g.beginPath(); g.arc(x, y, (feat ? 2.6 : 1.7) * dpr, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
    g.strokeStyle = 'rgba(255,181,71,.35)'; g.lineWidth = dpr; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.stroke();
  }

  let lastMini = 0;
  function loop(now) {
    const t = Date.now();
    if (strip && !strip.hidden && now - lastMini > 66) { drawScope(mini, false, t); lastMini = now; }
    if (R.bigOpen && bigCanvas) drawScope(bigCanvas, true, t);
    requestAnimationFrame(loop);
  }

  /* ── Big radar ── */
  R.openBig = function () {
    const host = U.$('#radarBig');
    host.innerHTML = '';
    bigCanvas = U.h('canvas');
    bigList = U.h('div');
    bigStatus = U.h('div', { class: 'rb-status' });
    let press = null;
    bigCanvas.addEventListener('pointerdown', () => { press = setTimeout(() => { R.closeBig(); SS.game.open(); }, 1100); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => bigCanvas.addEventListener(ev, () => clearTimeout(press)));
    const win = U.h('div', { class: 'rb-win' },
      U.h('div', { class: 'rb-scope' }, U.h('button', { class: 'icon-btn rb-close', 'aria-label': 'Close', onclick: R.closeBig }, U.icon('x')), bigCanvas),
      U.h('div', { class: 'rb-side' }, U.h('h3', null, `${F.airport().code} approach`), bigStatus, bigList));
    host.append(win);
    host.onclick = e => { if (e.target === host) R.closeBig(); };
    host.hidden = false; R.bigOpen = true;
    renderList();
  };
  R.closeBig = () => { U.$('#radarBig').hidden = true; R.bigOpen = false; selHex = null; };
  function renderList() {
    if (!bigList) return;
    const st = F.status;
    bigStatus.textContent = st.mode === 'live' ? `Live · ${st.count} aircraft via ${st.source} · updated ${U.fmt.ago(Date.now() - st.at)}` : st.mode === 'sim' ? `Simulated traffic. ${st.msg}` : st.msg || 'Starting…';
    bigList.innerHTML = '';
    const rows = F.list.slice().sort((a, b) => (b.inbound - a.inbound) || (a.inbound ? (a.eta || 1e9) - (b.eta || 1e9) : a.dObs - b.dObs)).slice(0, 30);
    if (!rows.length) bigList.append(U.h('div', { class: 'empty' }, 'No aircraft in range right now.'));
    rows.forEach(a => {
      const d = F.describe(a), p = a.cur || F.pos(a);
      bigList.append(U.h('div', { class: 'rb-row' + (selHex === a.hex ? ' sel' : ''), onclick: () => { selHex = selHex === a.hex ? null : a.hex; renderList(); } },
        U.h('b', { class: a.inbound ? 'arr' : '' }, d.flightNo), U.h('div', { class: 'r' }, altTxt(p) + (p.alt != null && p.alt < 18000 ? ' ft' : '')),
        U.h('span', null, `${a.type || '?'}${d.origin ? ' · from ' + (d.origin.city || d.origin.iata) : ''}`), U.h('div', { class: 'r' }, a.inbound && a.eta ? U.fmt.mmss(a.eta) : (a.dObs != null ? a.dObs.toFixed(1) + ' nm' : ''))));
    });
  }
})();
