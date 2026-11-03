/* Easter egg: "SFO Tower". The first plane you work is the arrival from the flight
   strip (or the last one it saw). Draw a path to the matching runway; keep everyone apart. */
(function () {
  'use strict';
  const U = SS.u, F = SS.flights;
  const GM = (SS.game = { isOpen: false });
  let host, cv, g, hud, radioBox, W = 0, H = 0, s = 1, dpr = 1, raf = 0, st = null, rw = null, audio = null, wasPlaying = true;

  const TELE = { UAL: 'United', ASA: 'Alaska', QXE: 'Horizon', SKW: 'SkyWest', DAL: 'Delta', AAL: 'American', SWA: 'Southwest', JBU: 'JetBlue', HAL: 'Hawaiian', ACA: 'Air Canada', POE: 'Porter', AMX: 'Aeromexico', BAW: 'Speedbird', AFR: 'Air France', DLH: 'Lufthansa', UAE: 'Emirates', SIA: 'Singapore', CPA: 'Cathay', EVA: 'Eva', KAL: 'Korean Air', ANA: 'All Nippon', JAL: 'Japan Air', QFA: 'Qantas', ANZ: 'New Zealand', AIC: 'Air India', FDX: 'FedEx', UPS: 'UPS' };
  const spoken = p => { const m = /^([A-Z]{3})(\d+)/.exec(p.cs || ''); return m && TELE[m[1]] ? `${TELE[m[1]]} ${m[2].split('').join(' ')}` : p.flightNo; };
  const HEAVY = { wide: 1, jumbo: 1 };
  const COL = { R: '#ffb547', L: '#6fd3ff' };

  /* ── Layout: a stylised SFO, runways 28L/28R on their real ~298° heading ── */
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    s = Math.min(W, H) / 820;
    const th = F.RWY28.crs * Math.PI / 180;
    const dir = [Math.sin(th), -Math.cos(th)], right = [-dir[1], dir[0]];
    const mid = [W * (W > H ? 0.4 : 0.46), H * 0.46], L = Math.min(380 * s, W * 0.5), sep = 30 * s;
    const mk = (sign, name) => {
      const c = [mid[0] + right[0] * sep / 2 * sign, mid[1] + right[1] * sep / 2 * sign];
      return { name, c, thr: [c[0] - dir[0] * L / 2, c[1] - dir[1] * L / 2], end: [c[0] + dir[0] * L / 2, c[1] + dir[1] * L / 2], color: sign > 0 ? COL.R : COL.L };
    };
    const t2 = 28 * Math.PI / 180, dir2 = [Math.sin(t2), -Math.cos(t2)];
    const c2 = [mid[0] + dir[0] * L * 0.3, mid[1] + dir[1] * L * 0.3];
    rw = { dir, right, L, wid: 10 * s, a: Math.atan2(dir[1], dir[0]), R: mk(1, '28R'), Lr: mk(-1, '28L'), dir2, c2, mid };
  }

  /* ── Drawing ── */
  function poly(pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
  function strip(c0, c1, wid) {
    const dx = c1[0] - c0[0], dy = c1[1] - c0[1], l = Math.hypot(dx, dy), nx = -dy / l * wid / 2, ny = dx / l * wid / 2;
    poly([[c0[0] + nx, c0[1] + ny], [c1[0] + nx, c1[1] + ny], [c1[0] - nx, c1[1] - ny], [c0[0] - nx, c0[1] - ny]]);
  }
  function drawMap(t) {
    const water = g.createLinearGradient(0, 0, W, H);
    water.addColorStop(0, '#06202c'); water.addColorStop(1, '#0a2f3f');
    g.fillStyle = water; g.fillRect(0, 0, W, H);
    // shimmer
    g.strokeStyle = 'rgba(160,220,255,.05)'; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const y = (i * 97.3 % H), x = ((i * 211.7 + t * 8 * s) % (W + 200)) - 100;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 60 * s, y); g.stroke();
    }
    // peninsula
    g.fillStyle = '#16201d';
    g.beginPath(); g.moveTo(0, 0);
    for (let y = 0; y <= H; y += H / 24) g.lineTo(W * (0.2 + 0.035 * Math.sin(y / H * 3.3 + 0.4) + (y > H * 0.7 ? (y - H * 0.7) / H * 0.25 : 0)), y);
    g.lineTo(0, H); g.closePath(); g.fill();
    // airport platform
    const { dir, right, L } = rw, m = rw.mid;
    const ext = (k, j) => [m[0] + dir[0] * L * k + right[0] * 60 * s * j, m[1] + dir[1] * L * k + right[1] * 60 * s * j];
    g.fillStyle = '#1d2826'; poly([ext(-0.6, -1.2), ext(0.75, -1.4), ext(0.75, 1.9), ext(-0.6, 1.5)]); g.fill();
    // Foster City + the San Mateo Bridge
    g.fillStyle = '#18231f';
    g.beginPath(); g.ellipse(W * 0.36, H * 0.9, W * 0.12, H * 0.08, -0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(244,241,234,.22)'; g.lineWidth = 2 * s;
    g.beginPath(); g.moveTo(W * 0.4, H * 0.84); g.lineTo(W * 1.02, H * 0.76); g.stroke();
    g.fillStyle = 'rgba(255,220,150,.5)';
    for (let i = 0; i < 26; i++) { const f = i / 25; g.fillRect(U.lerp(W * 0.4, W * 1.02, f) - 1, U.lerp(H * 0.84, H * 0.76, f) - 1, 2, 2); }
    g.fillStyle = '#ffb547'; g.beginPath(); g.arc(W * 0.35, H * 0.875, 3.5 * s, 0, Math.PI * 2); g.fill();
    label(String((SS.settings.flight.place || 'You').split('·')[0]).trim().toUpperCase().slice(0, 18), W * 0.35 + 8 * s, H * 0.875 + 4 * s, 'left', .55, 9);
    label('FOSTER CITY', W * 0.33, H * 0.93, 'center', .35, 9);
    label('SAN MATEO BRIDGE', W * 0.72, H * 0.79 - 8 * s, 'center', .3, 8.5);
    label('SAN  FRANCISCO  BAY', W * 0.75, H * 0.3, 'center', .16, 13);
    // crossing runways 1L/1R (decorative)
    g.fillStyle = '#2c3431';
    for (const k of [-1, 1]) { const c = [rw.c2[0] + rw.dir[0] * 24 * s * k, rw.c2[1] + rw.dir[1] * 24 * s * k]; strip([c[0] - rw.dir2[0] * L * 0.36, c[1] - rw.dir2[1] * L * 0.36], [c[0] + rw.dir2[0] * L * 0.36, c[1] + rw.dir2[1] * L * 0.36], rw.wid * 0.85); g.fill(); }
    // landing runways
    for (const r of [rw.R, rw.Lr]) {
      g.fillStyle = '#353d3b'; strip(r.thr, r.end, rw.wid); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2 * s; g.setLineDash([7 * s, 7 * s]);
      g.beginPath(); g.moveTo(r.thr[0] + dir[0] * 16 * s, r.thr[1] + dir[1] * 16 * s); g.lineTo(r.end[0] - dir[0] * 10 * s, r.end[1] - dir[1] * 10 * s); g.stroke(); g.setLineDash([]);
      // approach funnel + glowing threshold
      const fl = 150 * s, ap = [r.thr[0] - dir[0] * fl, r.thr[1] - dir[1] * fl];
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      g.strokeStyle = r.color; g.globalAlpha = 0.25 + 0.15 * pulse; g.lineWidth = 1.5 * s; g.setLineDash([3 * s, 6 * s]);
      g.beginPath(); g.moveTo(ap[0], ap[1]); g.lineTo(r.thr[0], r.thr[1]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      for (let i = 1; i <= 3; i++) {
        const q = [r.thr[0] - dir[0] * i * 14 * s, r.thr[1] - dir[1] * i * 14 * s];
        g.save(); g.translate(q[0], q[1]); g.rotate(rw.a); g.strokeStyle = r.color; g.globalAlpha = (0.9 - i * 0.22) * (0.6 + 0.4 * pulse); g.lineWidth = 2 * s;
        g.beginPath(); g.moveTo(-5 * s, -6 * s); g.lineTo(1 * s, 0); g.lineTo(-5 * s, 6 * s); g.stroke(); g.restore();
      }
      g.globalAlpha = 1;
      g.fillStyle = r.color; g.beginPath(); g.arc(r.thr[0], r.thr[1], 4.2 * s, 0, Math.PI * 2); g.fill();
      const side = r === rw.R ? 1 : -1;
      const lp = [r.thr[0] + dir[0] * 4 * s + rw.right[0] * 22 * side * s, r.thr[1] + dir[1] * 4 * s + rw.right[1] * 22 * side * s];
      g.fillStyle = r.color; g.font = `700 ${11 * s}px "JetBrains Mono", monospace`; g.textAlign = 'center'; g.fillText(r.name, lp[0], lp[1] + 4 * s);
    }
    label('SFO', rw.mid[0] + rw.dir[0] * L * 0.2 - rw.right[0] * 46 * s, rw.mid[1] + rw.dir[1] * L * 0.2 - rw.right[1] * 46 * s, 'center', .5, 12);
  }
  function label(txt, x, y, align, alpha, size) {
    g.fillStyle = `rgba(244,241,234,${alpha})`; g.font = `600 ${size * s}px Inter, sans-serif`; g.textAlign = align;
    g.fillText(txt, x, y);
  }
  function planeShape(r, kind) {
    g.beginPath();
    g.moveTo(0, -r); g.quadraticCurveTo(r * 0.16, -r * 0.8, r * 0.14, -r * 0.4); g.lineTo(r * 0.12, r * 0.8); g.quadraticCurveTo(0, r * 1.02, -r * 0.12, r * 0.8); g.lineTo(-r * 0.14, -r * 0.4); g.quadraticCurveTo(-r * 0.16, -r * 0.8, 0, -r); g.closePath();
    const sw = kind === 'prop' || kind === 'light' ? 0.05 : 0.32;
    g.moveTo(r * 0.12, -r * 0.18); g.lineTo(r * 0.98, r * (0.12 + sw * 0.6)); g.lineTo(r * 0.98, r * (0.26 + sw * 0.6)); g.lineTo(r * 0.12, r * 0.16); g.closePath();
    g.moveTo(-r * 0.12, -r * 0.18); g.lineTo(-r * 0.98, r * (0.12 + sw * 0.6)); g.lineTo(-r * 0.98, r * (0.26 + sw * 0.6)); g.lineTo(-r * 0.12, r * 0.16); g.closePath();
    g.moveTo(r * 0.08, r * 0.6); g.lineTo(r * 0.4, r * 0.86); g.lineTo(r * 0.4, r * 0.96); g.lineTo(r * 0.06, r * 0.86); g.closePath();
    g.moveTo(-r * 0.08, r * 0.6); g.lineTo(-r * 0.4, r * 0.86); g.lineTo(-r * 0.4, r * 0.96); g.lineTo(-r * 0.06, r * 0.86); g.closePath();
  }
  function drawPlane(p, t) {
    const sc = p.scale || 1, r = p.r * sc;
    const sh = p.shadow != null ? p.shadow : 9 * s;
    g.save(); g.translate(p.x + sh, p.y + sh * 1.2); g.rotate(p.a + Math.PI / 2);
    g.fillStyle = 'rgba(0,0,0,.35)'; planeShape(r, p.kind); g.fill(); g.restore();
    g.save(); g.translate(p.x, p.y); g.rotate(p.a + Math.PI / 2); g.globalAlpha = p.alpha ?? 1;
    g.fillStyle = p.color; planeShape(r, p.kind); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)';
    if (HEAVY[p.kind]) { const n = p.kind === 'jumbo' ? [0.42, 0.72] : [0.5]; n.forEach(k => { g.beginPath(); g.ellipse(r * k, r * 0.02 + r * k * 0.25, r * 0.07, r * 0.14, 0, 0, Math.PI * 2); g.ellipse(-r * k, r * 0.02 + r * k * 0.25, r * 0.07, r * 0.14, 0, 0, Math.PI * 2); g.fill(); }); }
    g.restore();
    if (p.state === 'air') {
      if (p.warn) { g.strokeStyle = `rgba(255,107,94,${0.5 + 0.5 * Math.sin(t * 12)})`; g.lineWidth = 2 * s; g.beginPath(); g.arc(p.x, p.y, p.r * 2.1, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = 'rgba(244,241,234,.9)'; g.font = `600 ${10.5 * s}px "JetBrains Mono", monospace`; g.textAlign = 'left';
      g.fillText(p.flightNo, p.x + p.r + 5 * s, p.y - 3 * s);
      g.fillStyle = 'rgba(244,241,234,.5)'; g.font = `${9 * s}px "JetBrains Mono", monospace`;
      g.fillText(`${p.type || ''}${p.hero ? '  ★' : ''}`, p.x + p.r + 5 * s, p.y + 8 * s);
    }
  }
  function drawPath(p) {
    if (!p.path.length || p.state !== 'air') return;
    g.strokeStyle = p.color; g.globalAlpha = p.pathOk ? 0.95 : 0.55; g.lineWidth = (p.pathOk ? 2.4 : 1.8) * s;
    g.setLineDash(p.pathOk ? [] : [6 * s, 6 * s]);
    g.beginPath(); g.moveTo(p.x, p.y); p.path.forEach(([x, y]) => g.lineTo(x, y)); g.stroke();
    g.setLineDash([]); g.globalAlpha = 1;
  }
  function drawEdge(p) {
    const m = 16 * s;
    if (p.x > -2 && p.x < W + 2 && p.y > -2 && p.y < H + 2) return;
    const x = U.clamp(p.x, m, W - m), y = U.clamp(p.y, m, H - m);
    const a = Math.atan2(p.y - y, p.x - x) + Math.PI;
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = p.color;
    g.beginPath(); g.moveTo(9 * s, 0); g.lineTo(-5 * s, -7 * s); g.lineTo(-5 * s, 7 * s); g.closePath(); g.fill(); g.restore();
    g.fillStyle = p.color; g.font = `600 ${9.5 * s}px "JetBrains Mono", monospace`; g.textAlign = x > W / 2 ? 'right' : 'left';
    g.fillText(p.flightNo, x + (x > W / 2 ? -14 : 14) * s, y + 4 * s);
  }

  /* ── Audio (only after you turn sound on) ── */
  function beep(f, d = 0.12, type = 'sine', vol = 0.06) {
    if (!SS.settings.sound || !audio) return;
    const o = audio.createOscillator(), gn = audio.createGain();
    o.type = type; o.frequency.value = f; gn.gain.value = vol;
    gn.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d);
    o.connect(gn).connect(audio.destination); o.start(); o.stop(audio.currentTime + d);
  }
  function say(text) {
    radio(text);
    if (!SS.settings.sound || !('speechSynthesis' in window)) return;
    try { const u = new SpeechSynthesisUtterance(text.replace(/^Tower: /, '')); u.rate = 1.08; u.pitch = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* ignore */ }
  }
  function radio(text) {
    const el = U.h('div', null, text);
    radioBox.append(el);
    while (radioBox.children.length > 3) radioBox.firstChild.remove();
    setTimeout(() => el.remove(), 6500);
  }

  /* ── Game state ── */
  function newPlane(spec, hero) {
    const kind = (F.TY[spec.type] && F.TY[spec.type][1]) || 'narrow';
    const runway = HEAVY[kind] ? 'R' : 'L';
    const r = ({ jumbo: 19, wide: 17, narrow: 14, regional: 12, prop: 12, light: 9, bizjet: 10 }[kind] || 14) * s;
    const speed = ({ jumbo: 44, wide: 44, narrow: 40, regional: 35, prop: 32, light: 29, bizjet: 41 }[kind] || 40) * s;
    let x, y;
    const edge = hero ? 'right' : U.pick(['right', 'right', 'bottom', 'top', 'bottom', 'left']);
    if (edge === 'right') { x = W + 30 * s; y = U.rand(H * 0.25, H * 0.8); }
    else if (edge === 'left') { x = -30 * s; y = U.rand(H * 0.15, H * 0.5); }
    else if (edge === 'top') { x = U.rand(W * 0.35, W * 0.95); y = -30 * s; }
    else { x = U.rand(W * 0.45, W * 0.95); y = H + 30 * s; }
    const tx = U.rand(W * 0.35, W * 0.8), ty = U.rand(H * 0.25, H * 0.7);
    return { id: U.uid(), cs: spec.cs, flightNo: spec.flightNo || spec.cs, type: spec.type, origin: spec.origin, kind, runway, color: COL[runway], r, speed, x, y, a: Math.atan2(ty - y, tx - x), path: [], state: 'air', entering: true, hero, scale: 1 };
  }
  function nextSpec() {
    const pool = F.gamePool();
    const used = new Set(st.planes.map(p => p.cs).concat(st.usedCs));
    let spec = pool.find(p => !used.has(p.cs));
    if (!spec) {
      const [al, org, type] = U.pick(F.SIM), num = U.randInt(10, 2999), A = F.AL[al];
      spec = { cs: al + num, flightNo: `${A[1]} ${num}`, type, origin: { iata: org, city: F.AP[org][0] } };
    }
    st.usedCs.push(spec.cs);
    return spec;
  }
  function reset() {
    st = { planes: [], fx: [], score: 0, t: 0, next: 9999, over: false, started: false, usedCs: [], heroDone: false, warnBeep: 0, drawing: null, hero: null };
  }

  function start() {
    host.querySelector('.gm-card') && host.querySelector('.gm-card').remove();
    if (!audio && (window.AudioContext || window.webkitAudioContext)) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; } }
    st.started = true;
    const hero = newPlane(st.heroSpec, true);
    st.planes.push(hero); st.hero = hero; st.usedCs.push(hero.cs);
    st.next = 26;
    const d = hero.origin && hero.origin.city ? ` inbound from ${hero.origin.city}` : '';
    say(`Tower: ${spoken(hero)}${d}, contact. Runway 28 ${hero.runway === 'R' ? 'right' : 'left'} is yours.`);
  }

  function land(p, r) {
    p.state = 'landing'; p.path = []; p.pathOk = false;
    const along = (p.x - r.thr[0]) * rw.dir[0] + (p.y - r.thr[1]) * rw.dir[1];
    p.land = { r, d: Math.max(0, along), t: 0, v: p.speed * 1.1 };
    p.a = rw.a;
    beep(880, 0.09); setTimeout(() => beep(1320, 0.12), 110);
  }

  function update(dt) {
    if (!st.started || st.over) return;
    st.t += dt;
    // spawns
    if (st.hero && st.hero.state !== 'air' && !st.heroDone) { st.heroDone = true; st.next = Math.min(st.next, st.t + 4); }
    const maxPlanes = Math.min(10, 2 + Math.floor(st.score / 2));
    const live = st.planes.filter(p => p.state === 'air').length;
    if (st.t >= st.next && live < maxPlanes) {
      const p = newPlane(nextSpec(), false);
      st.planes.push(p);
      st.next = st.t + Math.max(3.6, 10.5 - st.score * 0.38);
      beep(520, 0.08, 'triangle', 0.04);
    }
    const diff = 1 + Math.min(0.7, st.score * 0.025);
    for (const p of st.planes) {
      if (p.state === 'air') {
        if (p.path.length) {
          const [tx, ty] = p.path[0];
          const da = Math.atan2(ty - p.y, tx - p.x);
          let d = ((da - p.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          const maxTurn = 3.2 * dt;
          p.a += U.clamp(d, -maxTurn, maxTurn);
          if (Math.hypot(tx - p.x, ty - p.y) < 7 * s + p.speed * dt) p.path.shift();
          if (!p.path.length) p.pathOk = false;
        } else if (!p.entering) {
          const m = 22 * s;
          if (p.x < m || p.x > W - m || p.y < m || p.y > H - m) {
            const da = Math.atan2(H / 2 - p.y, W / 2 - p.x);
            let d = ((da - p.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            p.a += U.clamp(d, -1.8 * dt, 1.8 * dt);
          }
        }
        p.x += Math.cos(p.a) * p.speed * diff * dt;
        p.y += Math.sin(p.a) * p.speed * diff * dt;
        if (p.entering && p.x > 10 && p.x < W - 10 && p.y > 10 && p.y < H - 10) p.entering = false;
        // capture by a runway
        for (const r of [rw.R, rw.Lr]) {
          const dist = Math.hypot(p.x - r.thr[0], p.y - r.thr[1]);
          const aligned = Math.abs(((p.a - rw.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.8;
          if (dist < 22 * s && aligned) {
            const mine = (r === rw.R ? 'R' : 'L') === p.runway;
            if (mine) { land(p, r); break; }
            else if (!p.wrongWarned) { p.wrongWarned = true; say(`Tower: ${spoken(p)}, wrong runway. Go around, you're on 28 ${p.runway === 'R' ? 'right' : 'left'}.`); beep(300, 0.25, 'square', 0.04); }
          }
        }
      } else if (p.state === 'landing') {
        const L = p.land; L.t += dt;
        L.v = Math.max(p.speed * 0.22, L.v - p.speed * 0.42 * dt);
        L.d += L.v * dt;
        p.x = L.r.thr[0] + rw.dir[0] * L.d; p.y = L.r.thr[1] + rw.dir[1] * L.d;
        const td = U.clamp(L.t / 0.7, 0, 1);
        p.scale = 1 - 0.26 * td; p.shadow = 9 * s * (1 - td);
        if (td >= 1 && !L.touched) {
          L.touched = true;
          for (let i = 0; i < 9; i++) st.fx.push({ x: p.x, y: p.y, vx: U.rand(-12, 12) * s, vy: U.rand(-12, 12) * s, r: U.rand(2, 4) * s, life: 1 });
          st.score++;
          updateHud();
          say(`Tower: ${spoken(p)}, welcome to San Francisco.`);
          if (p.hero) U.toast(`★ ${p.flightNo} is down. Nice landing!`);
        }
        if (L.t > 2.8) { p.alpha = Math.max(0, 1 - (L.t - 2.8) / 0.6); if (L.t > 3.4) p.state = 'gone'; }
      }
    }
    st.planes = st.planes.filter(p => p.state !== 'gone');
    // separation
    const air = st.planes.filter(p => p.state === 'air' && !p.entering);
    air.forEach(p => (p.warn = false));
    let anyWarn = false;
    for (let i = 0; i < air.length; i++) for (let j = i + 1; j < air.length; j++) {
      const p = air[i], q = air[j], d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < (p.r + q.r) * 0.72) return gameOver(p, q);
      if (d < (p.r + q.r) * 1.9) { p.warn = q.warn = true; anyWarn = true; }
    }
    if (anyWarn && st.t - st.warnBeep > 0.7) { st.warnBeep = st.t; beep(740, 0.08, 'square', 0.035); }
    st.fx.forEach(f => { f.x += f.vx * dt; f.y += f.vy * dt; f.r += 10 * s * dt; f.life -= dt * 0.8; });
    st.fx = st.fx.filter(f => f.life > 0);
  }

  function render(t) {
    g.clearRect(0, 0, W, H);
    drawMap(t);
    if (!st) return;
    st.planes.forEach(drawPath);
    st.fx.forEach(f => { g.fillStyle = `rgba(230,230,230,${f.life * 0.35})`; g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2); g.fill(); });
    st.planes.filter(p => p.state === 'landing').forEach(p => drawPlane(p, t));
    st.planes.filter(p => p.state === 'air').forEach(p => drawPlane(p, t));
    st.planes.forEach(drawEdge);
    if (st.drawing) {
      const p = st.drawing.p;
      g.strokeStyle = p.color; g.globalAlpha = 0.85; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(p.x, p.y);
      st.drawing.pts.forEach(([x, y]) => g.lineTo(x, y)); g.stroke(); g.globalAlpha = 1;
    }
    // hero hint
    const h = st.hero;
    if (h && h.state === 'air' && !h.path.length && st.t < 30 && !h.entering) {
      g.fillStyle = 'rgba(255,181,71,.95)'; g.font = `600 ${12 * s}px Inter, sans-serif`; g.textAlign = 'center';
      g.fillText(`Drag from ${h.flightNo} to ${h.runway === 'R' ? '28R' : '28L'}`, h.x, h.y - h.r - 14 * s);
    }
  }

  let lastT = 0;
  function frame(now) {
    const t = now / 1000, dt = Math.min(0.05, lastT ? t - lastT : 0.016);
    lastT = t;
    update(dt); render(t);
    raf = requestAnimationFrame(frame);
  }

  /* ── Input ── */
  function pt(e) { return [e.clientX, e.clientY]; }
  function onDown(e) {
    if (!st || !st.started || st.over) return;
    const [x, y] = pt(e);
    let best = null, bd = 1e9;
    for (const p of st.planes) { if (p.state !== 'air') continue; const d = Math.hypot(p.x - x, p.y - y); if (d < p.r + 30 * s && d < bd) { bd = d; best = p; } }
    if (!best) return;
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
    st.drawing = { p: best, pts: [] };
    best.path = []; best.pathOk = false;
  }
  function onMove(e) {
    if (!st || !st.drawing) return;
    const [x, y] = pt(e), pts = st.drawing.pts, last = pts[pts.length - 1] || [st.drawing.p.x, st.drawing.p.y];
    if (Math.hypot(x - last[0], y - last[1]) > 8 * s) pts.push([x, y]);
  }
  function onUp() {
    if (!st || !st.drawing) return;
    const { p, pts } = st.drawing;
    st.drawing = null;
    if (pts.length < 2 || p.state !== 'air') return;
    p.path = pts;
    const end = pts[pts.length - 1];
    const mine = p.runway === 'R' ? rw.R : rw.Lr, other = p.runway === 'R' ? rw.Lr : rw.R;
    if (Math.hypot(end[0] - mine.thr[0], end[1] - mine.thr[1]) < 26 * s) {
      p.pathOk = true;
      // extend the path a little along the centreline so the plane lines up
      p.path.push([mine.thr[0] + rw.dir[0] * 30 * s, mine.thr[1] + rw.dir[1] * 30 * s]);
      say(`Tower: ${spoken(p)}, runway 28 ${p.runway === 'R' ? 'right' : 'left'}, cleared to land.`);
    } else if (Math.hypot(end[0] - other.thr[0], end[1] - other.thr[1]) < 26 * s) {
      radio(`Tower: ${p.flightNo}, that's 28${p.runway === 'R' ? 'L' : 'R'}. ${HEAVY[p.kind] ? 'Heavies use 28R.' : 'Use 28L, please.'}`);
    }
  }

  function updateHud() {
    if (!hud) return;
    const best = Math.max(st.score, U.store.get('towerBest', 0));
    hud.querySelector('.gm-score').innerHTML = `${st.score}<small>landed · best ${best}</small>`;
  }

  function card(html, buttons) {
    host.querySelector('.gm-card') && host.querySelector('.gm-card').remove();
    const c = U.h('div', { class: 'gm-card' }, html, U.h('div', { class: 'btns' }, buttons));
    host.append(c);
  }
  function heroCard(spec) {
    const ph = U.h('div', { class: 'ph' });
    if (spec.photo && spec.photo.src) { const im = U.h('img', { src: spec.photo.src, alt: '', referrerpolicy: 'no-referrer' }); im.onerror = () => { ph.innerHTML = ''; ph.append(F.art(spec.type)); }; ph.append(im); }
    else ph.append(F.art(spec.type));
    const tn = (F.TY[spec.type] && F.TY[spec.type][0]) || spec.type || 'Aircraft';
    return U.h('div', { class: 'hero' }, ph, U.h('div', null, U.h('b', null, spec.flightNo || spec.cs), U.h('span', null, `${tn}${spec.origin && spec.origin.city ? ' · from ' + spec.origin.city : ''}${spec.sim ? ' · simulated' : ''}`)));
  }
  function gameOver(p, q) {
    st.over = true;
    beep(110, 0.5, 'sawtooth', 0.06);
    const best = Math.max(st.score, U.store.get('towerBest', 0));
    U.store.set('towerBest', best);
    say(`Tower: ${spoken(p)}, ${spoken(q)}, traffic alert. All stations, hold.`);
    card([U.h('div', { class: 'gm-title' }, 'Loss of separation'), U.h('h2', null, `${st.score} landed`), U.h('p', null, `${p.flightNo} and ${q.flightNo} got too close. Best shift so far: ${best}.`)],
      [U.h('button', { class: 'btn amber', onclick: () => { const h = st.heroSpec; reset(); st.heroSpec = h; start(); updateHud(); } }, 'Work another shift'), U.h('button', { class: 'btn', onclick: GM.close }, 'Back to the gallery')]);
  }

  GM.open = function () {
    if (GM.isOpen) return;
    GM.isOpen = true; SS.ui && (SS.ui.gameOpen = true);
    wasPlaying = SS.show.playing; SS.show.pause();
    SS.radar.closeCard();
    host = U.$('#game');
    host.innerHTML = '';
    cv = U.h('canvas'); g = cv.getContext('2d');
    hud = U.h('div', { class: 'gm-hud' },
      U.h('div', null, U.h('div', { class: 'gm-title' }, 'SFO Tower · easter egg'), U.h('div', { class: 'gm-score' }, '0')),
      U.h('div', { class: 'gm-btns' },
        U.h('button', { class: 'btn small', onclick: e => { SS.setSetting('sound', !SS.settings.sound); e.currentTarget.replaceChildren(U.icon(SS.settings.sound ? 'sound' : 'mute'), SS.settings.sound ? 'Sound on' : 'Sound off'); if (SS.settings.sound && audio && audio.state === 'suspended') audio.resume(); } }, U.icon(SS.settings.sound ? 'sound' : 'mute'), SS.settings.sound ? 'Sound on' : 'Sound off'),
        U.h('button', { class: 'btn small', onclick: GM.close }, U.icon('x'), 'Exit')));
    radioBox = U.h('div', { class: 'gm-radio' });
    host.append(cv, hud, radioBox);
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
    host.hidden = false;
    layout();
    reset();
    const pool = F.gamePool();
    st.heroSpec = pool[0] || (() => { const [al, org, type] = U.pick(F.SIM), n = U.randInt(10, 999); return { cs: al + n, flightNo: `${F.AL[al][1]} ${n}`, type, origin: { iata: org, city: F.AP[org][0] }, sim: true }; })();
    const hs = st.heroSpec, hk = (F.TY[hs.type] && F.TY[hs.type][1]) || 'narrow';
    card([U.h('div', { class: 'gm-title' }, F.featured ? 'Now on approach' : 'Last seen on the radar'), U.h('h2', null, 'You have the tower.'),
      heroCard(hs),
      U.h('p', null, `Drag a path from each plane to its runway. Amber planes are heavies and land on 28R; cyan planes land on 28L. Your first plane is ${hs.flightNo}, so ${HEAVY[hk] ? 'it goes to 28R' : 'it goes to 28L'}. More traffic follows. Keep everyone apart.`)],
      [U.h('button', { class: 'btn amber', onclick: start }, 'Clear to land'), U.h('button', { class: 'btn', onclick: GM.close }, 'Not now')]);
    updateHud();
    lastT = 0; raf = requestAnimationFrame(frame);
    addEventListener('resize', layout);
  };
  GM.close = function () {
    if (!GM.isOpen) return;
    GM.isOpen = false; SS.ui && (SS.ui.gameOpen = false);
    cancelAnimationFrame(raf);
    removeEventListener('resize', layout);
    if (st && st.score) U.store.set('towerBest', Math.max(st.score, U.store.get('towerBest', 0)));
    try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    host.hidden = true; host.innerHTML = '';
    st = null;
    if (wasPlaying) SS.show.resume();
  };
  addEventListener('keydown', e => { if (GM.isOpen && e.key === 'Escape') GM.close(); });
  GM._debug = () => ({ st, rw });
})();
