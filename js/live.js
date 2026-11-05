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
  };
  const BAG = ['pong', 'pong', 'pong', 'seasons', 'life', 'life', 'ants', 'flock', 'flock'];

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
