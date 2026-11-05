/* Living art: small animated pieces drawn live, in the flat, calm style of Pong Wars.
   - Pong Wars, after Koen van Gilst's original (MIT licence): each ball paints the squares it hits.
     Two-team palettes, a tag-team twist (balls swap sides when they meet) and Four Seasons (four teams).
   - Life: John Conway's Game of Life (1970), with fading trails.
   - Ants: Chris Langton's ant (1986), several at once.
   - Murmuration: starlings at dusk, flocking by Craig Reynolds' boids rules (1986).
   All of it is this app's own code; the ideas are classics, credited on every piece. */
(function () {
  'use strict';
  const U = SS.u;
  const L = (SS.live = {});
  const TAU = Math.PI * 2;

  const PONG = [
    { id: 'latte', names: ['Latte', 'Roast'], cells: ['#f1e4c6', '#4b2514'], balls: ['#1e140e', '#e4b95c'], bg: ['#6a4630', '#1f120b'], ink: '#f1e4c6' },
    { id: 'day', names: ['Day', 'Night'], cells: ['#d9e8e3', '#114c5a'], balls: ['#114c5a', '#d9e8e3'], bg: ['#24646f', '#09242c'], ink: '#d9e8e3' },
    { id: 'matcha', names: ['Matcha', 'Charcoal'], cells: ['#cdd8a6', '#2c2f2a'], balls: ['#2c2f2a', '#cdd8a6'], bg: ['#56643f', '#161814'], ink: '#dfe7c2' },
    { id: 'sakura', names: ['Sakura', 'Ink'], cells: ['#f3d5d3', '#2b2440'], balls: ['#2b2440', '#f3d5d3'], bg: ['#634b6d', '#16122a'], ink: '#f3d5d3' },
    { id: 'shore', names: ['Sand', 'Sea'], cells: ['#ead8a8', '#0d5c70'], balls: ['#0d5c70', '#ead8a8'], bg: ['#2f7686', '#082a35'], ink: '#ead8a8' },
    { id: 'citrus', names: ['Clementine', 'Plum'], cells: ['#f4a259', '#3d2645'], balls: ['#3d2645', '#f8d8b0'], bg: ['#7c4a5c', '#1f1028'], ink: '#f8d8b0' },
  ];
  const SEASONS = { id: 'seasons', names: ['Spring', 'Summer', 'Autumn', 'Winter'], cells: ['#b7d3a0', '#f2c45a', '#d9693e', '#a9c0dc'], balls: ['#2f4a2a', '#5b3d0a', '#3e1608', '#1c2c45'], bg: ['#3d3b45', '#121117'], ink: '#efe7d6' };
  const LIFE = [
    { id: 'paper', name: 'on Paper', board: '#f2e7d2', ink: '#33251c', trail: ['#c8553d', '#e3a85a', '#e9d9b6'], bg: ['#5c4636', '#1d1510'] },
    { id: 'midnight', name: 'at Midnight', board: '#14233a', ink: '#f1e8d4', trail: ['#5fb3b3', '#2d6f86', '#1a2f4a'], bg: ['#24344f', '#0a111d'] },
    { id: 'moss', name: 'in Moss', board: '#e6e9d3', ink: '#2e3a24', trail: ['#7f9c4b', '#b9c98a', '#dfe3c5'], bg: ['#4b5a3a', '#151a10'] },
  ];
  const ANTS = { board: '#f3ead7', colors: ['#c8553d', '#2f6f73', '#e0a43b', '#6a4c93'], bg: ['#4d3b30', '#17110d'], ink: '#f3ead7' };

  /* ── shared bits ── */
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
  // The framed board, sized for the screen, with room for the clock above and the caption below.
  function frame(W, H, cols, extra) {
    const land = W > H, calm = SS.settings.calm > 0;
    // leave room for the clock above and the caption (which shows for a few seconds on each new piece) below
    const padX = W * (land ? 0.1 : 0.07), top = H * (land ? 0.19 : 0.17), bot = H * (land ? (calm ? 0.15 : 0.18) : (calm ? 0.25 : 0.28));
    const aw = W - padX * 2, ah = H - top - bot;
    const cs = Math.max(3, Math.floor(aw / cols));
    const rows = Math.max(8, Math.floor((ah - cs * (extra || 0)) / cs));
    const w = cols * cs, h = rows * cs;
    return { cs, cols, rows, w, h, x: Math.round((W - w) / 2), y: Math.round(top + (ah - cs * (extra || 0) - h) / 2) };
  }
  function backdrop(W, H, bg, B, k) {
    const c = U.mk(W, H), g = c.getContext('2d', { alpha: false });
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const v = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.2, W / 2, H / 2, Math.hypot(W, H) * 0.65);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    SS.gen.grain(g, W, H, 0.035);
    if (B) { g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 44 * k; g.shadowOffsetY = 16 * k; g.fillStyle = '#000'; g.fillRect(B.x, B.y, B.w, B.h); g.restore(); }
    return c;
  }
  // rAF loop with a capped time step; paused when the slide isn't on screen.
  function runner(step, draw) {
    let raf = 0, last = 0, on = false;
    const loop = t => { if (!on) return; const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t; step(dt); draw(); raf = requestAnimationFrame(loop); };
    return { start() { if (on) return; on = true; last = 0; raf = requestAnimationFrame(loop); }, stop() { on = false; cancelAnimationFrame(raf); } };
  }
  function label(g, txt, x, y, size, color, align, k) {
    g.font = `700 ${size}px Inter, system-ui, sans-serif`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = `${(size * 0.16).toFixed(1)}px`;
    g.fillText(txt, x, y);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  }

  /* ── Pong Wars (after Koen van Gilst, MIT) ── */
  function pong(c, W, H, k, o) {
    const g = c.getContext('2d', { alpha: false }), P = o.pal, n = P.names.length;
    const B = frame(W, H, W > H ? 44 : 24, 2.2), cs = B.cs, r = cs / 2;
    const cells = new Uint8Array(B.cols * B.rows), counts = new Array(n).fill(0);
    const half = (v, m) => (v < m / 2 ? 0 : 1);
    const zone = (x, y) => (n === 2 ? half(x, B.cols) : (half(y, B.rows) === 0 ? half(x, B.cols) : 3 - half(x, B.cols)));
    for (let y = 0; y < B.rows; y++) for (let x = 0; x < B.cols; x++) { const t = zone(x, y); cells[y * B.cols + x] = t; counts[t]++; }
    const bc = U.mk(B.w, B.h), bg = bc.getContext('2d');
    const paint = (x, y) => { bg.fillStyle = P.cells[cells[y * B.cols + x]]; bg.fillRect(x * cs, y * cs, cs, cs); };
    for (let y = 0; y < B.rows; y++) for (let x = 0; x < B.cols; x++) paint(x, y);
    const back = backdrop(W, H, P.bg, B, k);
    const sp = cs * (o.speed || 13);
    const centre = t => { const qx = n === 2 ? t : (t === 0 || t === 3 ? 0 : 1), qy = n === 2 ? 0.5 : (t < 2 ? 0 : 1); return [B.w * (qx * 0.5 + 0.25), n === 2 ? B.h * 0.5 : B.h * (qy * 0.5 + 0.25)]; };
    const aim = () => { let a; do a = U.rand(0, TAU); while (Math.abs(Math.cos(a)) < 0.35 || Math.abs(Math.sin(a)) < 0.35); return a; };
    const balls = P.names.map((_, t) => { const [x, y] = centre(t), a = aim(); return { t, x: x + U.rand(-cs, cs), y: y + U.rand(-cs, cs), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, swap: 0 }; });
    let lastFlip = 0, clock = 0;
    function keepAngle(b) {   // a hair of randomness so the balls never settle into a loop, never too flat
      let a = Math.atan2(b.vy, b.vx) + U.rand(-0.035, 0.035);
      const c0 = Math.cos(a), s0 = Math.sin(a);
      if (Math.abs(c0) < 0.25) a = Math.atan2(s0, Math.sign(c0 || 1) * 0.25);
      if (Math.abs(s0) < 0.25) a = Math.atan2(Math.sign(s0 || 1) * 0.25, c0);
      b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
    }
    function move(b, h) {
      let hitX = 0, hitY = 0;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a);
        const cx = Math.floor((b.x + ca * r) / cs), cy = Math.floor((b.y + sa * r) / cs);
        if (cx < 0 || cy < 0 || cx >= B.cols || cy >= B.rows) continue;
        const idx = cy * B.cols + cx, was = cells[idx];
        if (was !== b.t) {
          counts[was]--; counts[b.t]++; cells[idx] = b.t; paint(cx, cy); lastFlip = clock;
          if (Math.abs(ca) > Math.abs(sa)) hitX = Math.sign(ca); else hitY = Math.sign(sa);
        }
      }
      if (hitX) b.vx = -hitX * Math.abs(b.vx);
      if (hitY) b.vy = -hitY * Math.abs(b.vy);
      if (hitX || hitY) keepAngle(b);
      b.x += b.vx * h; b.y += b.vy * h;
      if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); } else if (b.x > B.w - r) { b.x = B.w - r; b.vx = -Math.abs(b.vx); }
      if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy); } else if (b.y > B.h - r) { b.y = B.h - r; b.vy = -Math.abs(b.vy); }
    }
    function step(dt) {
      clock += dt;
      let left = dt; const sub = (cs * 0.25) / sp;
      while (left > 0) {
        const h = Math.min(left, sub); left -= h;
        balls.forEach(b => move(b, h));
        if (o.tag) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {   // tag team: they trade sides when they meet
          const a = balls[i], b = balls[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < cs && clock - a.swap > 1 && clock - b.swap > 1) { [a.t, b.t] = [b.t, a.t]; a.swap = b.swap = clock; [a.vx, b.vx] = [b.vx, a.vx]; [a.vy, b.vy] = [b.vy, a.vy]; }
        }
      }
      if (clock - lastFlip > 6) { balls.forEach(b => { const a = aim(); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; }); lastFlip = clock; }
    }
    function draw() {
      g.drawImage(back, 0, 0);
      g.drawImage(bc, B.x, B.y);
      balls.forEach(b => { g.fillStyle = P.balls[b.t]; g.beginPath(); g.arc(B.x + b.x, B.y + b.y, r * 0.86, 0, TAU); g.fill(); });
      // score bar: who holds how much
      const total = B.cols * B.rows, by = B.y + B.h + cs * 0.75, bh = Math.max(3 * k, cs * 0.22);
      let x = B.x;
      counts.forEach((cnt, t) => { const w = B.w * cnt / total; g.fillStyle = P.cells[t]; g.fillRect(x, by, w, bh); x += w; });
      const fs = Math.max(9 * k, Math.min(13 * k, cs * 0.42)), ly = by + bh + fs * 1.55, col = P.ink;
      if (n === 2) { label(g, `${P.names[0].toUpperCase()}  ${counts[0]}`, B.x, ly, fs, col, 'left', k); label(g, `${counts[1]}  ${P.names[1].toUpperCase()}`, B.x + B.w, ly, fs, col, 'right', k); }
      else P.names.forEach((nm, t) => label(g, `${nm.toUpperCase()} ${counts[t]}`, B.x + B.w * (t + 0.5) / n, ly, fs * 0.9, col, 'center', k));
    }
    for (let i = 0; i < 90; i++) step(1 / 60);   // a second and a half in, so it's already moving
    draw();
    return Object.assign(runner(step, draw), { draw });
  }

  /* ── Life (John Conway, 1970) ── */
  function life(c, W, H, k, o) {
    const g = c.getContext('2d', { alpha: false }), P = o.pal;
    const B = frame(W, H, W > H ? 96 : 54, 0), cs = B.cs, N = B.cols * B.rows;
    let cur = new Uint8Array(N), nxt = new Uint8Array(N);
    const age = new Uint8Array(N).fill(255);
    const FADE = 10, fades = Array.from({ length: FADE }, (_, i) => {
      const t = i / (FADE - 1), stops = [P.trail[0], P.trail[1], P.trail[2], P.board];
      const seg = Math.min(2, Math.floor(t * 3)), f = t * 3 - seg; return mix(stops[seg], stops[seg + 1], f);
    });
    const back = backdrop(W, H, P.bg, B, k);
    const hist = [];
    let acc = 0, fadeOut = 0, gens = 0;
    function seed() {
      cur.fill(0); age.fill(255);
      const x0 = Math.floor(B.cols * 0.12), x1 = Math.ceil(B.cols * 0.88), y0 = Math.floor(B.rows * 0.12), y1 = Math.ceil(B.rows * 0.88);
      const d = U.rand(0.22, 0.34);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (Math.random() < d) cur[y * B.cols + x] = 1;
      hist.length = 0; gens = 0;
    }
    function gen() {
      const C = B.cols, R = B.rows;
      for (let y = 0; y < R; y++) {
        const ym = ((y - 1 + R) % R) * C, y0 = y * C, yp = ((y + 1) % R) * C;
        for (let x = 0; x < C; x++) {
          const xm = (x - 1 + C) % C, xp = (x + 1) % C;
          const nb = cur[ym + xm] + cur[ym + x] + cur[ym + xp] + cur[y0 + xm] + cur[y0 + xp] + cur[yp + xm] + cur[yp + x] + cur[yp + xp];
          const i = y0 + x, alive = cur[i] ? (nb === 2 || nb === 3) : nb === 3;
          nxt[i] = alive ? 1 : 0;
          if (alive) age[i] = 0; else if (cur[i]) age[i] = 1; else if (age[i] < 255) age[i]++;
        }
      }
      [cur, nxt] = [nxt, cur];
      gens++;
      let pop = 0; for (let i = 0; i < N; i++) pop += cur[i];
      hist.push(pop); if (hist.length > 90) hist.shift();
      // settled into still lifes and blinkers, or nearly empty? start a fresh soup
      if (!fadeOut && gens > 150 && hist.length === 90 && (Math.max(...hist) - Math.min(...hist) <= Math.max(3, pop * 0.02) || pop < N * 0.01)) fadeOut = 1.6;
    }
    function step(dt) {
      if (fadeOut) { fadeOut -= dt; if (fadeOut <= 0) { fadeOut = 0; seed(); } return; }
      acc += dt;
      while (acc > 0.1) { gen(); acc -= 0.1; }
    }
    function draw() {
      g.drawImage(back, 0, 0);
      g.fillStyle = P.board; g.fillRect(B.x, B.y, B.w, B.h);
      const gap = cs > 6 ? Math.max(1, Math.round(cs * 0.12)) : 0, sz = cs - gap;
      const dim = fadeOut ? Math.max(0, fadeOut / 1.6) : 1;
      g.globalAlpha = dim;
      for (let i = 0; i < N; i++) {
        const a = age[i];
        if (a >= FADE) continue;
        g.fillStyle = a === 0 ? P.ink : fades[a];
        g.fillRect(B.x + (i % B.cols) * cs, B.y + Math.floor(i / B.cols) * cs, sz, sz);
      }
      g.globalAlpha = 1;
    }
    seed(); for (let i = 0; i < 12; i++) gen();
    draw();
    return Object.assign(runner(step, draw), { draw });
  }

  /* ── Langton's ants (Chris Langton, 1986) ── */
  function ants(c, W, H, k, o) {
    const g = c.getContext('2d', { alpha: false }), P = ANTS;
    const B = frame(W, H, W > H ? 150 : 84, 0), cs = B.cs, C = B.cols, R = B.rows;
    const cells = new Uint8Array(C * R);
    const bc = U.mk(B.w, B.h), bg = bc.getContext('2d');
    bg.fillStyle = P.board; bg.fillRect(0, 0, B.w, B.h);
    const back = backdrop(W, H, P.bg, B, k);
    const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
    const na = o.count || 3;
    const list = Array.from({ length: na }, (_, i) => ({ id: i + 1, x: Math.floor(C / 2 + U.rand(-C * 0.15, C * 0.15)), y: Math.floor(R / 2 + U.rand(-R * 0.15, R * 0.15)), d: U.randInt(0, 3) }));
    const rate = o.rate || 220;
    let acc = 0, steps = 0;
    function tick() {
      for (const a of list) {
        const i = a.y * C + a.x;
        if (cells[i] === 0) { a.d = (a.d + 1) % 4; cells[i] = a.id; bg.fillStyle = P.colors[a.id - 1]; }
        else { a.d = (a.d + 3) % 4; cells[i] = 0; bg.fillStyle = P.board; }
        bg.fillRect(a.x * cs, a.y * cs, cs, cs);
        a.x = (a.x + DX[a.d] + C) % C; a.y = (a.y + DY[a.d] + R) % R;
      }
      steps++;
    }
    function step(dt) { acc += dt * rate; while (acc >= 1) { tick(); acc--; } if (steps > 60000) { cells.fill(0); bg.fillStyle = P.board; bg.fillRect(0, 0, B.w, B.h); steps = 0; } }
    function draw() {
      g.drawImage(back, 0, 0); g.drawImage(bc, B.x, B.y);
      for (const a of list) { g.fillStyle = '#1b1410'; g.beginPath(); g.arc(B.x + (a.x + 0.5) * cs, B.y + (a.y + 0.5) * cs, Math.max(2 * k, cs * 0.9), 0, TAU); g.fill(); g.fillStyle = P.colors[a.id - 1]; g.beginPath(); g.arc(B.x + (a.x + 0.5) * cs, B.y + (a.y + 0.5) * cs, Math.max(1.2 * k, cs * 0.55), 0, TAU); g.fill(); }
      const fs = Math.max(9 * k, Math.min(12 * k, B.w / 40)), ly = B.y + B.h + fs * 2;
      label(g, `${steps.toLocaleString('en-US')} STEPS`, B.x, ly, fs, P.ink, 'left', k);
      label(g, `${na} ANTS`, B.x + B.w, ly, fs, P.ink, 'right', k);
    }
    for (let i = 0; i < 400; i++) tick();
    draw();
    return Object.assign(runner(step, draw), { draw });
  }

  /* ── Murmuration (flocking by Craig Reynolds' boids rules, 1986) ── */
  function flock(c, W, H, k) {
    const g = c.getContext('2d', { alpha: false });
    const sky = U.mk(W, H), sg = sky.getContext('2d');
    const gr = sg.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#20223f'); gr.addColorStop(0.45, '#5b3b5e'); gr.addColorStop(0.75, '#c8705a'); gr.addColorStop(1, '#f1b37c');
    sg.fillStyle = gr; sg.fillRect(0, 0, W, H);
    const sun = sg.createRadialGradient(W * 0.62, H * 0.86, 0, W * 0.62, H * 0.86, Math.min(W, H) * 0.35);
    sun.addColorStop(0, 'rgba(255,226,170,.85)'); sun.addColorStop(0.15, 'rgba(255,210,150,.35)'); sun.addColorStop(1, 'rgba(255,200,140,0)');
    sg.fillStyle = sun; sg.fillRect(0, 0, W, H);
    const hill = (y0, amp, col, seed) => { sg.fillStyle = col; sg.beginPath(); sg.moveTo(0, H); for (let x = 0; x <= W; x += W / 60) sg.lineTo(x, y0 + Math.sin(x / W * 5 + seed) * amp + Math.sin(x / W * 13 + seed * 2) * amp * 0.35); sg.lineTo(W, H); sg.closePath(); sg.fill(); };
    hill(H * 0.88, H * 0.025, '#3b2438', 1.3); hill(H * 0.93, H * 0.02, '#1c1322', 4.1);
    SS.gen.grain(sg, W, H, 0.03);
    const M = Math.min(W, H), n = Math.round(U.clamp(W * H / (k * k) / 2600, 140, 320));
    const maxV = M * 0.16, minV = M * 0.08, R = M * 0.07, SEP = M * 0.018;
    const birds = Array.from({ length: n }, () => { const a = U.rand(0, TAU); return { x: W * U.rand(0.3, 0.7), y: H * U.rand(0.25, 0.5), vx: Math.cos(a) * minV, vy: Math.sin(a) * minV }; });
    let t = 0, hawk = null, nextHawk = U.rand(10, 20);
    const grid = new Map(), key = (x, y) => (Math.floor(x / R) * 73856093) ^ (Math.floor(y / R) * 19349663);
    function step(dt) {
      t += dt;
      const ax = W * (0.5 + 0.22 * Math.sin(t * 0.13)), ay = H * (0.4 + 0.12 * Math.sin(t * 0.21 + 1));
      if (!hawk && t > nextHawk) { const fromL = Math.random() < 0.5; hawk = { x: fromL ? -40 * k : W + 40 * k, y: H * U.rand(0.2, 0.55), vx: (fromL ? 1 : -1) * M * 0.3, vy: U.rand(-1, 1) * M * 0.04 }; }
      if (hawk) { hawk.x += hawk.vx * dt; hawk.y += hawk.vy * dt; if (hawk.x < -60 * k || hawk.x > W + 60 * k) { hawk = null; nextHawk = t + U.rand(14, 26); } }
      grid.clear();
      for (const b of birds) { const kk = key(b.x, b.y); (grid.get(kk) || grid.set(kk, []).get(kk)).push(b); }
      for (const b of birds) {
        let cx = 0, cy = 0, vx = 0, vy = 0, sx = 0, sy = 0, m = 0;
        const gx = Math.floor(b.x / R), gy = Math.floor(b.y / R);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const cell = grid.get(((gx + i) * 73856093) ^ ((gy + j) * 19349663)); if (!cell) continue;
          for (const o of cell) {
            if (o === b) continue;
            const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
            if (d2 > R * R) continue;
            m++; cx += o.x; cy += o.y; vx += o.vx; vy += o.vy;
            if (d2 < SEP * SEP) { const d = Math.sqrt(d2) || 1; sx -= dx / d; sy -= dy / d; }
          }
        }
        let fx = 0, fy = 0;
        if (m) { fx += (cx / m - b.x) * 0.9 + (vx / m - b.vx) * 1.4; fy += (cy / m - b.y) * 0.9 + (vy / m - b.vy) * 1.4; }
        fx += sx * maxV * 3.2; fy += sy * maxV * 3.2;
        fx += (ax - b.x) * 0.22; fy += (ay - b.y) * 0.22;
        if (hawk) { const dx = b.x - hawk.x, dy = b.y - hawk.y, d = Math.hypot(dx, dy); if (d < M * 0.22) { fx += dx / d * maxV * 9; fy += dy / d * maxV * 9; } }
        // stay on screen and above the hills
        if (b.y > H * 0.78) fy -= (b.y - H * 0.78) * 6;
        if (b.y < H * 0.08) fy += (H * 0.08 - b.y) * 6;
        if (b.x < W * 0.06) fx += (W * 0.06 - b.x) * 6;
        if (b.x > W * 0.94) fx -= (b.x - W * 0.94) * 6;
        b.vx += fx * dt; b.vy += fy * dt;
        const sp = Math.hypot(b.vx, b.vy), lim = U.clamp(sp, minV, maxV);
        b.vx = b.vx / sp * lim; b.vy = b.vy / sp * lim;
        b.x += b.vx * dt; b.y += b.vy * dt;
      }
    }
    function draw() {
      g.drawImage(sky, 0, 0);
      g.strokeStyle = 'rgba(22,14,24,.88)'; g.lineWidth = 1.6 * k; g.lineCap = 'round';
      g.beginPath();
      const len = 3.2 * k;
      for (const b of birds) { const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp; g.moveTo(b.x - ux * len, b.y - uy * len); g.lineTo(b.x + ux * len, b.y + uy * len); }
      g.stroke();
      if (hawk) { g.fillStyle = 'rgba(18,10,20,.95)'; g.save(); g.translate(hawk.x, hawk.y); g.rotate(Math.atan2(hawk.vy, hawk.vx)); g.beginPath(); g.moveTo(9 * k, 0); g.lineTo(-6 * k, -8 * k); g.lineTo(-3 * k, 0); g.lineTo(-6 * k, 8 * k); g.closePath(); g.fill(); g.restore(); }
    }
    for (let i = 0; i < 180; i++) step(1 / 60);
    draw();
    return Object.assign(runner(step, draw), { draw });
  }

  /* ── Cartoon rocket launch: countdown, liftoff, up through the sky into space, repeat ── */
  function rocket(c, W, H, k) {
    const g = c.getContext('2d', { alpha: false }), M = Math.min(W, H);
    const LIVERY = [['#e8574a', '#f4efe6', '#2e4a7a'], ['#f2b84b', '#2e4a7a', '#f4efe6'], ['#5fb3a8', '#f4efe6', '#e8574a'], ['#8a6fd1', '#f7e3b5', '#f2b84b']];
    const stars = Array.from({ length: 220 }, () => [Math.random() * W, Math.random() * H, U.rand(0.5, 1.8) * k, Math.random() * TAU]);
    const groundY = H * 0.84, bw = M * 0.075, bh = bw * 3.3;
    let col, phase, t, alt, vel, puffs, shake;
    function reset() { col = U.pick(LIVERY); phase = 'count'; t = 0; alt = 0; vel = 0; puffs = []; shake = 0; }
    const puff = (x, y, big) => puffs.push({ x: x + U.rand(-bw * 0.3, bw * 0.3), y, vx: U.rand(-1, 1) * M * (big ? 0.12 : 0.05), vy: U.rand(0.05, 0.25) * M * (big ? 0.2 : 0.05), r: bw * U.rand(0.25, 0.45), grow: bw * (big ? 0.9 : 0.35), life: 1 });
    function step(dt) {
      t += dt;
      if (phase === 'count') { if (t > 2 && Math.random() < 0.5) puff(W / 2, 0, false); if (t > 3.6) { phase = 'lift'; t = 0; } }
      else if (phase === 'lift') {
        vel += M * (0.5 + t * 0.9) * dt; alt += vel * dt;
        if (alt < H * 1.2) for (let i = 0; i < 3; i++) puff(W / 2, alt, alt < H * 0.25);
        if (alt > H * 3.4) { phase = 'drift'; t = 0; }
      } else if (phase === 'drift' && t > 2.2) reset();
      shake = phase === 'lift' && t < 2.5 ? (2.5 - t) / 2.5 : phase === 'count' && t > 3 ? 0.4 : 0;
      for (const p of puffs) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.r += p.grow * dt; p.life -= dt * 0.28; }
      puffs = puffs.filter(p => p.life > 0);
    }
    function draw() {
      const cam = Math.max(0, alt - H * 0.42), sp = U.clamp(cam / (H * 2.2), 0, 1);   // 0 = on the pad, 1 = in space
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, mix('#7ec4ea', '#070b1f', sp)); sky.addColorStop(0.7, mix('#cfeaf6', '#14183a', sp)); sky.addColorStop(1, mix('#fde6c8', '#1e1a46', sp));
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      if (sp > 0.15) { g.fillStyle = '#fff'; for (const [x, y, r, ph] of stars) { g.globalAlpha = (sp - 0.15) * (0.6 + 0.4 * Math.sin(t * 2 + ph)); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } g.globalAlpha = 1; }
      const sx = (shake ? U.rand(-1, 1) * shake * 3 * k : 0);
      const toY = wy => groundY - (wy - cam);
      // ground, pad and tower (they slide away as the camera follows the rocket)
      const gy = toY(0);
      if (gy < H + 10) {
        g.fillStyle = '#7fb069'; g.beginPath(); g.moveTo(0, gy + bw * 0.6); g.quadraticCurveTo(W * 0.3, gy - bw * 0.2, W * 0.55, gy + bw * 0.3); g.quadraticCurveTo(W * 0.8, gy + bw * 0.8, W, gy + bw * 0.2); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
        g.fillStyle = '#5c8f4d'; g.fillRect(0, gy + bw * 1.1, W, H);
        g.fillStyle = '#9aa3ad'; g.fillRect(W / 2 - bw * 1.5, gy - bw * 0.15, bw * 3, bw * 0.35);
        const tx = W / 2 - bw * 1.6, top = gy - bh * 1.15;
        g.strokeStyle = '#c9504a'; g.lineWidth = 2.2 * k; g.beginPath(); g.moveTo(tx, gy); g.lineTo(tx, top); g.moveTo(tx - bw * 0.45, gy); g.lineTo(tx - bw * 0.45, top); g.stroke();
        g.lineWidth = 1.4 * k; g.beginPath(); for (let y = gy; y > top; y -= bw * 0.45) { g.moveTo(tx, y); g.lineTo(tx - bw * 0.45, y - bw * 0.45); g.moveTo(tx - bw * 0.45, y); g.lineTo(tx, y - bw * 0.45); } g.stroke();
        if (phase === 'count') { g.strokeStyle = '#8b939c'; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(tx, top + bh * 0.4); g.lineTo(W / 2 - bw / 2, top + bh * 0.4); g.stroke(); }
      }
      // smoke behind the rocket
      for (const p of puffs) { g.fillStyle = `rgba(245,240,232,${Math.min(0.9, p.life)})`; g.beginPath(); g.arc(p.x + sx, toY(p.y), p.r, 0, TAU); g.fill(); }
      // the rocket
      const rx = W / 2 + sx, base = toY(alt) - bw * 0.2;
      if (base > -bh * 1.5) {
        if (phase === 'lift' || (phase === 'count' && t > 3)) {
          const fl = bh * (phase === 'lift' ? 0.75 + 0.15 * Math.sin(t * 40) + Math.min(0.5, t * 0.2) : 0.25 + 0.1 * Math.sin(t * 50));
          g.fillStyle = '#ffb547'; g.beginPath(); g.moveTo(rx - bw * 0.32, base); g.quadraticCurveTo(rx, base + fl * 1.2, rx + bw * 0.32, base); g.closePath(); g.fill();
          g.fillStyle = '#fff3c4'; g.beginPath(); g.moveTo(rx - bw * 0.16, base); g.quadraticCurveTo(rx, base + fl * 0.7, rx + bw * 0.16, base); g.closePath(); g.fill();
        }
        const top = base - bh;
        g.fillStyle = col[0];
        g.beginPath(); g.moveTo(rx - bw / 2, base - bh * 0.28); g.lineTo(rx - bw * 1.05, base + bw * 0.05); g.lineTo(rx - bw / 2, base - bw * 0.05); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(rx + bw / 2, base - bh * 0.28); g.lineTo(rx + bw * 1.05, base + bw * 0.05); g.lineTo(rx + bw / 2, base - bw * 0.05); g.closePath(); g.fill();
        g.fillStyle = col[1];
        g.beginPath(); g.moveTo(rx - bw / 2, base); g.lineTo(rx - bw / 2, top + bh * 0.3); g.quadraticCurveTo(rx - bw / 2, top, rx, top - bh * 0.02); g.quadraticCurveTo(rx + bw / 2, top, rx + bw / 2, top + bh * 0.3); g.lineTo(rx + bw / 2, base); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(rx + bw * 0.12, top + bh * 0.25, bw * 0.38, bh * 0.75);
        g.fillStyle = col[0]; g.beginPath(); g.moveTo(rx - bw * 0.36, top + bh * 0.16); g.quadraticCurveTo(rx, top - bh * 0.06, rx + bw * 0.36, top + bh * 0.16); g.closePath(); g.fill();
        g.fillRect(rx - bw / 2, base - bh * 0.2, bw, bh * 0.07);
        g.fillStyle = col[2]; g.beginPath(); g.arc(rx, top + bh * 0.38, bw * 0.22, 0, TAU); g.fill();
        g.fillStyle = '#bfe6ff'; g.beginPath(); g.arc(rx, top + bh * 0.38, bw * 0.15, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(rx - bw * 0.05, top + bh * 0.35, bw * 0.05, 0, TAU); g.fill();
        g.fillStyle = '#5b6470'; g.fillRect(rx - bw * 0.3, base, bw * 0.6, bw * 0.12);
      }
      // countdown
      if (phase === 'count' && t > 0.4) {
        const n = 3 - Math.floor((t - 0.4) / 0.95), txt = n > 0 ? String(n) : 'Liftoff!', a = 1 - (((t - 0.4) / 0.95) % 1) * 0.7;
        g.globalAlpha = a; g.fillStyle = '#ffffff'; g.font = `400 ${M * 0.12}px Fraunces, Georgia, serif`; g.textAlign = 'center'; g.fillText(txt, W / 2, H * 0.3); g.globalAlpha = 1;
      }
    }
    reset();
    for (let i = 0; i < 30; i++) step(1 / 60);
    draw();
    return Object.assign(runner(step, draw), { draw });
  }

  /* ── Petri dish: rod-shaped bacteria grow, split in two, and fill the dish ── */
  function petri(c, W, H, k) {
    const g = c.getContext('2d', { alpha: false });
    const cx = W / 2, cy = H * (W > H ? 0.5 : 0.46), R = Math.min(W * 0.42, H * (W > H ? 0.36 : 0.3)), w = R * 0.034;
    const SPECIES = [['#6cc4b8', '#2f7f75'], ['#f09db0', '#b24e68'], ['#b9d86e', '#6c8b2c'], ['#f4c65c', '#a8790f'], ['#a99cf0', '#5c4fb0']];
    const back = U.mk(W, H), bg = back.getContext('2d');
    const gr = bg.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2d3a40'); gr.addColorStop(1, '#10161a'); bg.fillStyle = gr; bg.fillRect(0, 0, W, H);
    SS.gen.grain(bg, W, H, 0.03);
    bg.save(); bg.shadowColor = 'rgba(0,0,0,.55)'; bg.shadowBlur = 40 * k; bg.shadowOffsetY = 14 * k;
    bg.fillStyle = '#e8d9a8'; bg.beginPath(); bg.arc(cx, cy, R * 1.04, 0, TAU); bg.fill(); bg.restore();
    const agar = bg.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R); agar.addColorStop(0, '#f7e9bd'); agar.addColorStop(1, '#e2c98a');
    bg.fillStyle = agar; bg.beginPath(); bg.arc(cx, cy, R, 0, TAU); bg.fill();
    const fg = U.mk(W, H), fgg = fg.getContext('2d');   // glass rim and a highlight, drawn on top
    fgg.strokeStyle = 'rgba(255,255,255,.55)'; fgg.lineWidth = R * 0.035; fgg.beginPath(); fgg.arc(cx, cy, R * 1.03, 0, TAU); fgg.stroke();
    fgg.strokeStyle = 'rgba(255,255,255,.35)'; fgg.lineWidth = R * 0.02; fgg.beginPath(); fgg.arc(cx, cy, R * 0.93, Math.PI * 1.1, Math.PI * 1.45); fgg.stroke();
    const MAX = 650;
    let cells, t = 0, fade = 0, gen = 0;
    function seed() {
      cells = []; gen = 0;
      const n = U.randInt(3, 5), sp = U.shuffle(SPECIES.slice()).slice(0, n);
      sp.forEach(s => { const a = U.rand(0, TAU), d = U.rand(0.15, 0.7) * R; cells.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, a: U.rand(0, TAU), len: U.rand(1, 1.6), rate: U.rand(0.16, 0.24), s }); });
    }
    function step(dt) {
      t += dt;
      if (fade) { fade -= dt; if (fade <= 0) { fade = 0; seed(); } return; }
      const full = cells.length >= MAX;
      const born = [];
      for (const b of cells) {
        if (!full) b.len += b.rate * dt * (0.8 + Math.random() * 0.4);
        if (b.len >= 2) {   // binary fission: two daughter rods, end to end
          const ux = Math.cos(b.a) * w * 0.5, uy = Math.sin(b.a) * w * 0.5;
          b.len = 1; born.push({ x: b.x + ux, y: b.y + uy, a: b.a + U.rand(-0.25, 0.25), len: 1, rate: b.rate, s: b.s });
          b.x -= ux; b.y -= uy; b.a += U.rand(-0.25, 0.25);
          gen = Math.max(gen, (b.gen = (b.gen || 0) + 1));
        }
        b.x += U.rand(-1, 1) * w * 0.15 * dt; b.y += U.rand(-1, 1) * w * 0.15 * dt;
      }
      cells.push(...born);
      // push overlapping rods apart (each rod is three discs along its length)
      const cell = w * 2.4, grid = new Map(), keyOf = (x, y) => Math.floor(x / cell) * 4096 + Math.floor(y / cell);
      for (const b of cells) { const kk = keyOf(b.x, b.y); (grid.get(kk) || grid.set(kk, []).get(kk)).push(b); }
      const pts = b => { const h = (b.len * w) / 2, ux = Math.cos(b.a) * h, uy = Math.sin(b.a) * h; return [[b.x - ux, b.y - uy], [b.x, b.y], [b.x + ux, b.y + uy]]; };
      for (const b of cells) {
        const gx = Math.floor(b.x / cell), gy = Math.floor(b.y / cell), pb = pts(b);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const list = grid.get((gx + i) * 4096 + gy + j); if (!list) continue;
          for (const o of list) {
            if (o === b) continue;
            const po = pts(o);
            for (const p of pb) for (const q of po) {
              const dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy);
              if (d < w * 0.95 && d > 0.0001) { const push = (w * 0.95 - d) * 0.25; b.x += dx / d * push; b.y += dy / d * push; }
            }
          }
        }
        const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), lim = R - w * (b.len * 0.5 + 0.6);
        if (d > lim) { b.x = cx + dx / d * lim; b.y = cy + dy / d * lim; b.a += 0.02; }
      }
      if (full && !fade && !step.fullAt) step.fullAt = t;
      if (full && step.fullAt && t - step.fullAt > 18) { fade = 2.2; step.fullAt = 0; }   // a while after it fills up, wash the dish and start again
    }
    function draw() {
      g.drawImage(back, 0, 0);
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
      g.globalAlpha = fade ? Math.max(0, fade / 2.2) : 1;
      g.lineCap = 'round';
      for (const pass of [0, 1]) for (const b of cells) {
        const h = Math.max(0.001, (b.len * w) / 2 - w * 0.35), ux = Math.cos(b.a) * h, uy = Math.sin(b.a) * h;
        g.strokeStyle = pass ? b.s[0] : b.s[1]; g.lineWidth = pass ? w * 0.72 : w;
        g.beginPath(); g.moveTo(b.x - ux, b.y - uy); g.lineTo(b.x + ux, b.y + uy); g.stroke();
      }
      g.restore(); g.globalAlpha = 1;
      g.drawImage(fg, 0, 0);
      const fs = Math.max(9 * k, Math.min(12 * k, R * 0.05));
      label(g, `${cells.length.toLocaleString('en-US')} CELLS`, cx, cy + R * 1.15 + fs, fs, 'rgba(232,217,168,.8)', 'center', k);
    }
    seed();
    for (let i = 0; i < 120; i++) step(1 / 30);
    draw();
    return Object.assign(runner(step, draw), { draw });
  }

  /* ── A spinning DNA double helix ── */
  function helix(c, W, H, k) {
    const g = c.getContext('2d', { alpha: false });
    const back = U.mk(W, H), bg = back.getContext('2d');
    const gr = bg.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d1838'); gr.addColorStop(1, '#04070f'); bg.fillStyle = gr; bg.fillRect(0, 0, W, H);
    const glow = bg.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.55); glow.addColorStop(0, 'rgba(60,110,200,.35)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); bg.fillStyle = glow; bg.fillRect(0, 0, W, H);
    SS.gen.grain(bg, W, H, 0.03);
    const land = W > H, M = Math.min(W, H);
    const len = land ? W * 0.66 : H * 0.48, Rr = M * (land ? 0.15 : 0.19), N = land ? 84 : 72, turns = land ? 3.2 : 2.6, f = Rr * 4.5;
    const PAIRS = [['#f2c45a', '#e8676a'], ['#e8676a', '#f2c45a'], ['#7ccf8a', '#8f86f2'], ['#8f86f2', '#7ccf8a']];
    const pairs = Array.from({ length: N }, () => U.pick(PAIRS));
    const motes = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: U.rand(0.6, 2) * k, v: U.rand(4, 14) * k }));
    let t = 0;
    function step(dt) { t += dt; for (const m of motes) { m.y -= m.v * dt; if (m.y < -5) { m.y = H + 5; m.x = Math.random() * W; } } }
    function draw() {
      g.drawImage(back, 0, 0);
      g.fillStyle = 'rgba(160,200,255,.35)'; for (const m of motes) { g.beginPath(); g.arc(m.x, m.y, m.r, 0, TAU); g.fill(); }
      const spin = t * 0.7, els = [];
      const cx = W / 2, cy = H * (land ? 0.52 : 0.47) + Math.sin(t * 0.5) * M * 0.01;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1) - 0.5, along = u * len, ph = i / N * TAU * turns + spin;
        const P = s => { const a = ph + s * Math.PI * 0.82, x = Math.cos(a) * Rr, z = Math.sin(a) * Rr, sc = f / (f + z); return land ? { x: cx + along * sc, y: cy + x * sc, z, sc } : { x: cx + x * sc, y: cy + along * sc, z, sc }; };
        const a = P(0), b = P(1);
        els.push({ z: a.z, kind: 'bead', p: a, col: '#7fd3ff' }, { z: b.z, kind: 'bead', p: b, col: '#ff9a76' });
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        els.push({ z: (a.z * 2 + b.z) / 3, kind: 'rung', p: a, q: m, col: pairs[i][0] }, { z: (a.z + b.z * 2) / 3, kind: 'rung', p: m, q: b, col: pairs[i][1] });
      }
      els.sort((x, y) => y.z - x.z);   // far side first
      for (const e of els) {
        const depth = U.clamp((e.z + Rr) / (2 * Rr), 0, 1), dim = 0.25 + 0.75 * (1 - depth);
        if (e.kind === 'rung') { g.strokeStyle = e.col; g.globalAlpha = dim; g.lineWidth = Rr * 0.07 * ((e.p.sc + (e.q.sc || e.p.sc)) / 2); g.lineCap = 'round'; g.beginPath(); g.moveTo(e.p.x, e.p.y); g.lineTo(e.q.x, e.q.y); g.stroke(); }
        else {
          const r = Rr * 0.115 * e.p.sc;
          const sh = g.createRadialGradient(e.p.x - r * 0.35, e.p.y - r * 0.35, r * 0.1, e.p.x, e.p.y, r);
          sh.addColorStop(0, '#ffffff'); sh.addColorStop(0.35, e.col); sh.addColorStop(1, mix(e.col, '#0a1024', 0.55));
          g.globalAlpha = dim; g.fillStyle = sh; g.beginPath(); g.arc(e.p.x, e.p.y, r, 0, TAU); g.fill();
        }
      }
      g.globalAlpha = 1;
      const fs = Math.max(9 * k, Math.min(12 * k, M * 0.022)), ly = land ? H * 0.86 : Math.min(H * 0.775, H * 0.47 + len * 0.6 + fs * 2.4);
      const legend = [['A', '#f2c45a'], ['T', '#e8676a'], ['G', '#7ccf8a'], ['C', '#8f86f2']];
      legend.forEach(([l, cl], i) => { const x = W / 2 + (i - 1.5) * fs * 3.2; g.fillStyle = cl; g.beginPath(); g.arc(x - fs * 0.7, ly - fs * 0.35, fs * 0.32, 0, TAU); g.fill(); label(g, l, x, ly, fs, 'rgba(220,232,255,.75)', 'left', k); });
    }
    draw();
    return Object.assign(runner(step, draw), { draw });
  }

  /* ── Paper planes, flung across a pastel sky ── */
  function planes(c, W, H, k) {
    const g = c.getContext('2d', { alpha: false }), M = Math.min(W, H);
    const sky = U.mk(W, H), sg = sky.getContext('2d');
    const gr = sg.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#a9d8ef'); gr.addColorStop(0.6, '#d6eef4'); gr.addColorStop(1, '#fde5cf'); sg.fillStyle = gr; sg.fillRect(0, 0, W, H);
    const sun = sg.createRadialGradient(W * 0.8, H * 0.18, 0, W * 0.8, H * 0.18, M * 0.3); sun.addColorStop(0, 'rgba(255,248,220,.9)'); sun.addColorStop(1, 'rgba(255,248,220,0)'); sg.fillStyle = sun; sg.fillRect(0, 0, W, H);
    SS.gen.grain(sg, W, H, 0.025);
    const cloudSprite = s => { const cw = M * 0.42 * s, ch = cw * 0.45, cc = U.mk(Math.ceil(cw), Math.ceil(ch)), q = cc.getContext('2d'); q.fillStyle = '#ffffff'; [[0.3, 0.62, 0.22], [0.5, 0.45, 0.28], [0.7, 0.6, 0.2], [0.5, 0.7, 0.24]].forEach(([x, y, r]) => { q.beginPath(); q.arc(cw * x, ch * y, cw * r, 0, TAU); q.fill(); }); q.fillRect(cw * 0.3, ch * 0.62, cw * 0.4, ch * 0.3); return cc; };
    const clouds = Array.from({ length: 7 }, (_, i) => { const far = i < 4; return { img: cloudSprite(far ? U.rand(0.35, 0.6) : U.rand(0.7, 1)), x: Math.random() * W, y: H * U.rand(0.08, 0.75), v: (far ? 6 : 14) * k, a: far ? 0.55 : 0.9 }; });
    const COLS = ['#ffffff', '#fff6e0', '#e8f4ff', '#ffe9ec'];
    const gAcc = M * 0.3, vEq = M * 0.32, Lc = gAcc / (vEq * vEq), Dc = 0.25 / M;
    let list = [], t = 0, next = 0;
    function fling() {
      const fromL = Math.random() < 0.6;
      list.push({ x: fromL ? -M * 0.05 : W + M * 0.05, y: H * U.rand(0.55, 0.85), v: vEq * U.rand(1.5, 2.3), gam: U.rand(0.3, 0.75), dir: fromL ? 1 : -1, lift: U.rand(0.85, 1.35), col: U.pick(COLS), size: M * U.rand(0.035, 0.055), trail: [] });
    }
    function step(dt) {
      t += dt;
      if (t > next && list.length < 4) { fling(); next = t + U.rand(1.6, 4.5); }
      for (const p of list) {
        // a glider: gravity pulls, lift (∝ speed²) turns the path up, a little drag. Fast throws swoop and loop.
        p.v += (-gAcc * Math.sin(p.gam) - Dc * p.v * p.v) * dt;
        p.gam += ((Lc * p.lift * p.v * p.v - gAcc * Math.cos(p.gam)) / Math.max(p.v, 1)) * dt;
        p.x += p.dir * p.v * Math.cos(p.gam) * dt; p.y -= p.v * Math.sin(p.gam) * dt;
        p.trail.push([p.x, p.y]); if (p.trail.length > 70) p.trail.shift();
      }
      list = list.filter(p => p.x > -M * 0.3 && p.x < W + M * 0.3 && p.y < H + M * 0.3 && p.y > -H);
      for (const cl of clouds) { cl.x += cl.v * dt; if (cl.x > W + 10) { cl.x = -cl.img.width; cl.y = H * U.rand(0.08, 0.75); } }
    }
    function draw() {
      g.drawImage(sky, 0, 0);
      clouds.forEach((cl, i) => { if (i < 4) { g.globalAlpha = cl.a; g.drawImage(cl.img, cl.x, cl.y); } });
      g.globalAlpha = 1;
      for (const p of list) {
        g.strokeStyle = 'rgba(90,110,140,.35)'; g.lineWidth = 1.4 * k; g.setLineDash([5 * k, 6 * k]); g.beginPath();
        p.trail.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
        const s = p.size, ang = p.dir > 0 ? -p.gam : Math.PI + p.gam;
        g.save(); g.translate(p.x, p.y); g.rotate(ang); if (p.dir < 0) g.scale(1, -1);
        g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.moveTo(s * 1.0, s * 0.18); g.lineTo(-s * 0.8, -s * 0.22); g.lineTo(-s * 0.6, s * 0.48); g.closePath(); g.fill();
        g.fillStyle = p.col; g.beginPath(); g.moveTo(s, 0); g.lineTo(-s * 0.85, -s * 0.42); g.lineTo(-s * 0.55, 0); g.closePath(); g.fill();
        g.fillStyle = mix(p.col.length === 7 ? p.col : '#ffffff', '#9aa8bc', 0.35); g.beginPath(); g.moveTo(s, 0); g.lineTo(-s * 0.55, 0); g.lineTo(-s * 0.8, s * 0.28); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(80,95,120,.35)'; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(s, 0); g.lineTo(-s * 0.55, 0); g.stroke();
        g.restore();
      }
      clouds.forEach((cl, i) => { if (i >= 4) { g.globalAlpha = cl.a; g.drawImage(cl.img, cl.x, cl.y); } });
      g.globalAlpha = 1;
    }
    fling(); for (let i = 0; i < 60; i++) step(1 / 60);
    draw();
    return Object.assign(runner(step, draw), { draw });
  }

  /* ── Orrery: the planets going round the sun (sped up a lot) ── */
  function orrery(c, W, H, k) {
    const g = c.getContext('2d', { alpha: false }), M = Math.min(W, H);
    const back = U.mk(W, H), bg = back.getContext('2d');
    bg.fillStyle = '#070912'; bg.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) { bg.fillStyle = `rgba(255,255,255,${U.rand(0.1, 0.7)})`; bg.beginPath(); bg.arc(Math.random() * W, Math.random() * H, U.rand(0.4, 1.3) * k, 0, TAU); bg.fill(); }
    const cx = W / 2, cy = H * (W > H ? 0.55 : 0.47), maxR = W > H ? Math.min(W * 0.42, H * 0.75) : W * 0.4, tilt = 0.42;
    const P = [['Mercury', '#b5aaa0', 0.035, 0.22], ['Venus', '#e8c27a', 0.05, 0.31], ['Earth', '#4f9fe0', 0.052, 0.41], ['Mars', '#d9653e', 0.04, 0.51], ['Jupiter', '#d8b48c', 0.1, 0.65], ['Saturn', '#e6d08f', 0.085, 0.79], ['Uranus', '#9fe0e0', 0.065, 0.9], ['Neptune', '#5a7cf0', 0.063, 1]];
    const orbits = [0.24, 0.62, 1, 1.88, 11.9, 29.5, 84, 165];
    const ph = P.map(() => Math.random() * TAU);
    let t = 0;
    function step(dt) { t += dt; }
    function draw() {
      g.drawImage(back, 0, 0);
      const pos = P.map((p, i) => { const a = ph[i] + t * TAU / (orbits[i] ** 0.55 * 6), r = p[3] * maxR; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * tilt, behind: Math.sin(a) < 0, r: p[2] * M * 0.35, p, a, R: r }; });
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1 * k;
      P.forEach(p => { g.beginPath(); g.ellipse(cx, cy, p[3] * maxR, p[3] * maxR * tilt, 0, 0, TAU); g.stroke(); });
      const planet = q => {
        if (q.p[0] === 'Saturn') { g.strokeStyle = 'rgba(230,208,143,.75)'; g.lineWidth = q.r * 0.28; g.beginPath(); g.ellipse(q.x, q.y, q.r * 2, q.r * 0.6, -0.3, Math.PI, TAU); g.stroke(); }
        const sh = g.createRadialGradient(q.x - (q.x - cx) * 0.02 - q.r * 0.3, q.y - q.r * 0.3, q.r * 0.1, q.x, q.y, q.r);
        sh.addColorStop(0, mix(q.p[1], '#ffffff', 0.35)); sh.addColorStop(1, mix(q.p[1], '#000000', 0.45));
        g.fillStyle = sh; g.beginPath(); g.arc(q.x, q.y, q.r, 0, TAU); g.fill();
        if (q.p[0] === 'Saturn') { g.strokeStyle = 'rgba(230,208,143,.85)'; g.lineWidth = q.r * 0.28; g.beginPath(); g.ellipse(q.x, q.y, q.r * 2, q.r * 0.6, -0.3, 0, Math.PI); g.stroke(); }
        if (q.p[0] === 'Earth') { const ma = t * 3; g.fillStyle = '#d8d8d8'; g.beginPath(); g.arc(q.x + Math.cos(ma) * q.r * 2.2, q.y + Math.sin(ma) * q.r * 2.2 * tilt, q.r * 0.3, 0, TAU); g.fill(); }
        const fs = Math.max(8 * k, M * 0.017); label(g, q.p[0].toUpperCase(), q.x, q.y + q.r + fs * 1.4, fs, 'rgba(255,255,255,.45)', 'center', k);
      };
      pos.filter(q => q.behind).forEach(planet);
      const sr = M * 0.06, sun = g.createRadialGradient(cx, cy, sr * 0.2, cx, cy, sr * 3.2);
      sun.addColorStop(0, '#fff6d0'); sun.addColorStop(0.25, '#ffcf5a'); sun.addColorStop(0.32, 'rgba(255,170,60,.45)'); sun.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = sun; g.beginPath(); g.arc(cx, cy, sr * 3.2, 0, TAU); g.fill();
      pos.filter(q => !q.behind).forEach(planet);
    }
    draw();
    return Object.assign(runner(step, draw), { draw });
  }

  /* ── Fireworks over a little city ── */
  function fireworks(c, W, H, k) {
    const g = c.getContext('2d', { alpha: false }), M = Math.min(W, H);
    const trail = U.mk(W, H), tg = trail.getContext('2d');
    tg.fillStyle = '#0a0d1f'; tg.fillRect(0, 0, W, H);
    const city = U.mk(W, H), cg = city.getContext('2d');
    let x = 0; const base = H * 0.86;
    while (x < W) { const bw = U.rand(0.04, 0.1) * W, bh = U.rand(0.05, 0.2) * H; cg.fillStyle = '#05060f'; cg.fillRect(x, base - bh, bw + 1, bh + H); for (let wy = base - bh + 6 * k; wy < base - 4 * k; wy += 9 * k) for (let wx = x + 4 * k; wx < x + bw - 4 * k; wx += 8 * k) if (Math.random() < 0.28) { cg.fillStyle = `rgba(255,214,140,${U.rand(0.35, 0.9)})`; cg.fillRect(wx, wy, 3 * k, 4 * k); } x += bw; }
    cg.fillStyle = '#05060f'; cg.fillRect(0, base, W, H);
    const PAL = [['#ffd36e', '#ffefb8'], ['#ff6b6b', '#ffd1d1'], ['#5fd3c4', '#d4fff8'], ['#b48cff', '#efe3ff'], ['#7ee081', '#e2ffd8']];
    let shells = [], sparks = [], next = 0, t = 0;
    function step(dt) {
      t += dt;
      if (t > next) { shells.push({ x: W * U.rand(0.15, 0.85), y: base, vx: U.rand(-0.05, 0.05) * M, vy: -M * U.rand(0.95, 1.25), pal: U.pick(PAL), fuse: U.rand(0.9, 1.3) }); next = t + U.rand(0.35, 1.2); }
      for (const s of shells) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += M * 0.6 * dt; s.fuse -= dt; }
      for (const s of shells.filter(s => s.fuse <= 0)) {
        const n = U.randInt(60, 110), sp = M * U.rand(0.22, 0.34), ring = Math.random() < 0.3;
        for (let i = 0; i < n; i++) { const a = i / n * TAU + U.rand(-0.05, 0.05), v = ring ? sp : sp * Math.sqrt(Math.random()); sparks.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: U.rand(1.1, 1.8), col: Math.random() < 0.8 ? s.pal[0] : s.pal[1] }); }
      }
      shells = shells.filter(s => s.fuse > 0);
      for (const p of sparks) { p.vx *= 1 - 1.4 * dt; p.vy = p.vy * (1 - 1.4 * dt) + M * 0.22 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.75; }
      sparks = sparks.filter(p => p.life > 0);
    }
    function draw() {
      tg.globalCompositeOperation = 'source-over'; tg.fillStyle = 'rgba(10,13,31,.22)'; tg.fillRect(0, 0, W, H);
      tg.globalCompositeOperation = 'lighter';
      for (const s of shells) { tg.fillStyle = '#ffe9b0'; tg.beginPath(); tg.arc(s.x, s.y, 1.8 * k, 0, TAU); tg.fill(); }
      for (const p of sparks) { tg.globalAlpha = Math.min(1, p.life); tg.fillStyle = p.col; tg.beginPath(); tg.arc(p.x, p.y, 1.7 * k, 0, TAU); tg.fill(); }
      tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over';
      g.drawImage(trail, 0, 0); g.drawImage(city, 0, 0);
    }
    for (let i = 0; i < 120; i++) { step(1 / 60); draw(); }
    return Object.assign(runner(step, draw), { draw });
  }

  /* ── Aquarium: cartoon fish, swaying weed, bubbles ── */
  function aquarium(c, W, H, k) {
    const g = c.getContext('2d', { alpha: false }), M = Math.min(W, H);
    const back = U.mk(W, H), bg = back.getContext('2d');
    const gr = bg.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#5fc6d8'); gr.addColorStop(0.55, '#1f7ea6'); gr.addColorStop(1, '#0d3f66'); bg.fillStyle = gr; bg.fillRect(0, 0, W, H);
    const sandY = H * 0.86;
    bg.fillStyle = '#e8d29a'; bg.beginPath(); bg.moveTo(0, sandY); for (let x = 0; x <= W; x += W / 30) bg.lineTo(x, sandY + Math.sin(x / W * 7) * H * 0.012); bg.lineTo(W, H); bg.lineTo(0, H); bg.closePath(); bg.fill();
    for (let i = 0; i < 40; i++) { bg.fillStyle = U.pick(['#c9b07a', '#b49a68', '#d9c38c', '#a68c5e']); bg.beginPath(); bg.ellipse(Math.random() * W, sandY + U.rand(0.02, 0.12) * H, U.rand(3, 9) * k, U.rand(2, 5) * k, 0, 0, TAU); bg.fill(); }
    SS.gen.grain(bg, W, H, 0.025);
    const weeds = Array.from({ length: Math.round(W / (M * 0.09)) }, () => ({ x: Math.random() * W, h: H * U.rand(0.15, 0.4), ph: Math.random() * TAU, col: U.pick(['#2f8f5b', '#3fa66a', '#257a4c']) }));
    const COLS = [['#ff8c42', '#ffd166'], ['#ef476f', '#ffc2d1'], ['#ffd166', '#fff3c4'], ['#06d6a0', '#c8fff0'], ['#a78bfa', '#ede9fe'], ['#4cc9f0', '#e0f7ff']];
    const fish = Array.from({ length: 8 }, () => ({ x: Math.random() * W, y: H * U.rand(0.12, 0.75), dir: Math.random() < 0.5 ? -1 : 1, v: M * U.rand(0.05, 0.12), s: M * U.rand(0.035, 0.07), col: U.pick(COLS), ph: Math.random() * TAU, ty: 0 }));
    let bubbles = [], t = 0;
    function step(dt) {
      t += dt;
      for (const f of fish) {
        f.x += f.dir * f.v * dt; f.y += Math.sin(t * 1.3 + f.ph) * M * 0.012 * dt;
        if ((f.dir > 0 && f.x > W + f.s * 2) || (f.dir < 0 && f.x < -f.s * 2)) { f.dir *= -1; f.y = H * U.rand(0.12, 0.75); }
        if (Math.random() < dt * 0.25) bubbles.push({ x: f.x + f.dir * f.s, y: f.y, r: U.rand(1.5, 3.5) * k, v: U.rand(25, 45) * k });
      }
      if (Math.random() < dt * 3) bubbles.push({ x: W * U.rand(0.05, 0.95), y: sandY, r: U.rand(2, 6) * k, v: U.rand(30, 70) * k });
      for (const b of bubbles) { b.y -= b.v * dt; b.x += Math.sin(t * 3 + b.y * 0.05) * 6 * k * dt; }
      bubbles = bubbles.filter(b => b.y > -10);
    }
    function draw() {
      g.drawImage(back, 0, 0);
      g.globalAlpha = 0.1; g.fillStyle = '#ffffff';   // slow light rays from the surface
      for (let i = 0; i < 5; i++) { const x = W * (i / 4) + Math.sin(t * 0.2 + i) * W * 0.06; g.beginPath(); g.moveTo(x - W * 0.04, 0); g.lineTo(x + W * 0.04, 0); g.lineTo(x + W * 0.16, H); g.lineTo(x + W * 0.02, H); g.closePath(); g.fill(); }
      g.globalAlpha = 1;
      for (const w of weeds) { g.strokeStyle = w.col; g.lineWidth = M * 0.016; g.lineCap = 'round'; g.beginPath(); g.moveTo(w.x, sandY + 4 * k); const sw = Math.sin(t * 0.9 + w.ph) * M * 0.04; g.bezierCurveTo(w.x + sw * 0.3, sandY - w.h * 0.35, w.x - sw * 0.5, sandY - w.h * 0.7, w.x + sw, sandY - w.h); g.stroke(); }
      for (const f of fish) {
        const s = f.s, wag = Math.sin(t * 6 + f.ph) * 0.25;
        g.save(); g.translate(f.x, f.y); g.scale(f.dir, 1);
        g.fillStyle = f.col[0];
        g.save(); g.translate(-s * 0.9, 0); g.rotate(wag); g.beginPath(); g.moveTo(0, 0); g.lineTo(-s * 0.7, -s * 0.5); g.lineTo(-s * 0.7, s * 0.5); g.closePath(); g.fill(); g.restore();
        g.beginPath(); g.ellipse(0, 0, s, s * 0.6, 0, 0, TAU); g.fill();
        g.fillStyle = f.col[1]; g.beginPath(); g.ellipse(-s * 0.15, s * 0.12, s * 0.55, s * 0.3, 0, 0, TAU); g.fill();
        g.fillStyle = mix(f.col[0], '#000000', 0.2); g.beginPath(); g.moveTo(-s * 0.2, -s * 0.55); g.quadraticCurveTo(s * 0.1, -s * 0.95, s * 0.35, -s * 0.5); g.closePath(); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(s * 0.5, -s * 0.12, s * 0.17, 0, TAU); g.fill();
        g.fillStyle = '#1b1b2a'; g.beginPath(); g.arc(s * 0.55, -s * 0.12, s * 0.09, 0, TAU); g.fill();
        g.restore();
      }
      g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 1.2 * k;
      for (const b of bubbles) { g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke(); }
    }
    for (let i = 0; i < 30; i++) step(1 / 30);
    draw();
    return Object.assign(runner(step, draw), { draw });
  }

  /* ── Open video (NASA): plays muted on a loop, contained on a soft backdrop of its own first frame ── */
  L.video = function (item, vid, st) {
    const c = U.mk(st.pw, st.ph), g = c.getContext('2d', { alpha: false });
    let W = st.pw, H = st.ph, back = null;
    const fit = () => {
      const vw = vid.videoWidth || 16, vh = vid.videoHeight || 9, s = Math.min(W / vw, H / vh), cover = Math.max(W / vw, H / vh);
      const mism = Math.max((vw / vh) / (W / H), (W / H) / (vw / vh));
      const sc = mism < 1.3 ? cover : s;
      return { w: vw * sc, h: vh * sc, x: (W - vw * sc) / 2, y: (H - vh * sc) / 2, contain: mism >= 1.3 };
    };
    function makeBack() {
      back = U.mk(W, H); const bg = back.getContext('2d');
      const tw = 32, th = Math.max(8, Math.round(32 * H / W)), a = U.mk(tw, th), ag = a.getContext('2d');
      try { ag.drawImage(vid, 0, 0, tw, th); } catch (e) { /* not ready */ }
      bg.imageSmoothingQuality = 'high'; bg.drawImage(a, 0, 0, W, H);
      bg.fillStyle = 'rgba(6,7,10,.6)'; bg.fillRect(0, 0, W, H);
    }
    function draw() {
      const f = fit();
      if (f.contain) { if (!back) makeBack(); g.drawImage(back, 0, 0); } else { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
      try { g.drawImage(vid, f.x, f.y, f.w, f.h); } catch (e) { /* frame not ready */ }
    }
    let raf = 0;
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    draw();
    const api = {
      canvas: c, running: false,
      start() { api.running = true; const p = vid.play(); p && p.catch(() => {}); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); },
      stop() { api.running = false; cancelAnimationFrame(raf); try { vid.pause(); } catch (e) { /* ignore */ } },
      draw, resize(s2) { W = c.width = s2.pw; H = c.height = s2.ph; back = null; draw(); },
      dispose() { api.stop(); try { vid.removeAttribute('src'); vid.load(); } catch (e) { /* ignore */ } },
    };
    return api;
  };
  L.loadVideo = function (urls, timeout = 25000) {
    const tryOne = url => new Promise((res, rej) => {
      const v = document.createElement('video');
      v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      const done = (ok, err) => { clearTimeout(tm); v.onloadeddata = v.onerror = null; ok ? res(v) : (v.removeAttribute('src'), rej(err)); };
      const tm = setTimeout(() => done(false, new Error('video timeout')), timeout);
      v.onerror = () => done(false, new Error('video failed'));
      v.onloadeddata = async () => {
        try {
          v.pause();
          if (isFinite(v.duration) && v.duration > 40) {   // start somewhere in the middle, not on the title card
            await new Promise(r => { v.onseeked = r; v.currentTime = v.duration * U.rand(0.12, 0.55); setTimeout(r, 4000); });
          }
          done(true);
        } catch (e) { done(true); }
      };
      v.src = url;
      const p = v.play(); p && p.catch(() => {});   // iPhone only fetches data once play() is called
    });
    return (async () => { let err; for (const u of urls.filter(Boolean)) { try { return await tryOne(u); } catch (e) { err = e; } } throw err || new Error('no video'); })();
  };

  /* ── The catalogue ── */
  const PIECES = {
    pong: {
      make(seed) { const pal = U.pick(PONG), tag = Math.random() < 0.25; return { piece: 'pong', pal: pal.id, tag, title: `Pong Wars: ${pal.names[0]} vs ${pal.names[1]}${tag ? ' (tag team)' : ''}`, detail: tag ? 'When the balls meet, they trade sides' : 'Each ball paints the squares it hits' }; },
      credit: { creator: 'After Pong Wars by Koen van Gilst (2024)', license: 'MIT licence', link: 'https://github.com/vnglst/pong-wars' },
      create: (c, W, H, k, o) => pong(c, W, H, k, { pal: PONG.find(p => p.id === o.pal) || PONG[0], tag: o.tag }),
    },
    seasons: {
      make() { return { piece: 'seasons', pal: 'seasons', title: 'Pong Wars: Four Seasons', detail: 'Four balls, four seasons, one board' }; },
      credit: { creator: 'After Pong Wars by Koen van Gilst (2024)', license: 'MIT licence', link: 'https://github.com/vnglst/pong-wars' },
      create: (c, W, H, k) => pong(c, W, H, k, { pal: SEASONS, speed: 11 }),
    },
    life: {
      make() { const pal = U.pick(LIFE); return { piece: 'life', pal: pal.id, title: `Life ${pal.name}`, detail: 'Cells live with 2 or 3 neighbours, and are born with exactly 3' }; },
      credit: { creator: 'Game of Life rules by John Conway (1970)', license: 'Classic algorithm', link: 'https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life' },
      create: (c, W, H, k, o) => life(c, W, H, k, { pal: LIFE.find(p => p.id === o.pal) || LIFE[0] }),
    },
    ants: {
      make() { const count = U.pick([2, 3, 3, 4]); return { piece: 'ants', count, title: `${['', '', 'Two', 'Three', 'Four'][count]} of Langton's Ants`, detail: 'Each ant turns right on blank squares and left on painted ones, flipping them as it goes' }; },
      credit: { creator: "Langton's ant, by Chris Langton (1986)", license: 'Classic algorithm', link: 'https://en.wikipedia.org/wiki/Langton%27s_ant' },
      create: (c, W, H, k, o) => ants(c, W, H, k, { count: o.count || 3 }),
    },
    flock: {
      make() { return { piece: 'flock', title: 'Murmuration at Dusk', detail: 'Starlings follow three rules: keep apart, match your neighbours, stay with the group' }; },
      credit: { creator: 'Flocking after Craig Reynolds\' "boids" (1986)', license: 'Classic algorithm', link: 'https://www.red3d.com/cwr/boids/' },
      create: (c, W, H, k) => flock(c, W, H, k),
    },
    rocket: {
      make() { return { piece: 'rocket', title: 'Liftoff', detail: 'Countdown, ignition, up through the blue and into the dark' }; },
      credit: { creator: 'A Gallery Approach original', license: 'Made on your screen', link: null },
      create: (c, W, H, k) => rocket(c, W, H, k),
    },
    petri: {
      make() { return { piece: 'petri', title: 'Culture', detail: 'Rod-shaped bacteria grow and split in two until the dish is full' }; },
      credit: { creator: 'A Gallery Approach original (bacteria divide by binary fission)', license: 'Made on your screen', link: 'https://en.wikipedia.org/wiki/Fission_(biology)' },
      create: (c, W, H, k) => petri(c, W, H, k),
    },
    helix: {
      make() { return { piece: 'helix', title: 'Double Helix', detail: 'Two backbones twisted around their base pairs: A with T, G with C' }; },
      credit: { creator: 'A Gallery Approach original (after Watson, Crick and Franklin\'s DNA structure, 1953)', license: 'Made on your screen', link: 'https://en.wikipedia.org/wiki/Nucleic_acid_double_helix' },
      create: (c, W, H, k) => helix(c, W, H, k),
    },
    planes: {
      make() { return { piece: 'planes', title: 'Paper Planes', detail: 'Flung paper planes glide on lift and gravity; a hard throw loops the loop' }; },
      credit: { creator: 'A Gallery Approach original', license: 'Made on your screen', link: null },
      create: (c, W, H, k) => planes(c, W, H, k),
    },
    orrery: {
      make() { return { piece: 'orrery', title: 'Orrery', detail: 'The eight planets, sped up a few million times' }; },
      credit: { creator: 'A Gallery Approach original (an orrery is a clockwork model of the solar system)', license: 'Made on your screen', link: 'https://en.wikipedia.org/wiki/Orrery' },
      create: (c, W, H, k) => orrery(c, W, H, k),
    },
    fireworks: {
      make() { return { piece: 'fireworks', title: 'Fireworks over the City', detail: 'Shells rise, burst and fall with a little drag and a lot of gravity' }; },
      credit: { creator: 'A Gallery Approach original', license: 'Made on your screen', link: null },
      create: (c, W, H, k) => fireworks(c, W, H, k),
    },
    aquarium: {
      make() { return { piece: 'aquarium', title: 'Aquarium', detail: 'Cartoon fish, swaying weed, and bubbles on their way up' }; },
      credit: { creator: 'A Gallery Approach original', license: 'Made on your screen', link: null },
      create: (c, W, H, k) => aquarium(c, W, H, k),
    },
  };
  const BAG = ['pong', 'pong', 'seasons', 'life', 'ants', 'flock', 'rocket', 'rocket', 'petri', 'petri', 'helix', 'helix', 'planes', 'planes', 'orrery', 'fireworks', 'aquarium'];

  L.make = function (id) {
    const piece = PIECES[id] ? id : U.pick(BAG), seed = Math.floor(Math.random() * 1e9);
    const spec = PIECES[piece].make(seed), cr = PIECES[piece].credit;
    return {
      key: `live:${piece}:${spec.pal || ''}:${seed}`, src: 'living', kind: 'living', live: spec,
      title: spec.title, creator: cr.creator, detail: spec.detail, date: '', license: cr.license, link: cr.link,
    };
  };
  // A running piece on a stage-sized canvas: { canvas, start(), stop(), draw(), resize(st) }
  L.create = function (item, st) {
    const c = U.mk(st.pw, st.ph);
    let inst = PIECES[item.live.piece].create(c, st.pw, st.ph, st.k, item.live);
    const api = { canvas: c, running: false,
      start() { api.running = true; inst.start(); }, stop() { api.running = false; inst.stop(); }, draw() { inst.draw(); },
      resize(s2) { const was = api.running; inst.stop(); c.width = s2.pw; c.height = s2.ph; inst = PIECES[item.live.piece].create(c, s2.pw, s2.ph, s2.k, item.live); if (was) inst.start(); },
    };
    return api;
  };
  L.pieces = Object.keys(PIECES);
})();
