/* A second Golden Gate Bridge for the snow globe: a real 3D model seen in perspective.
   Towers (three stepped tiers and portal struts), both main cables, the suspender ropes, the roadway and its truss,
   all projected through a camera that slowly swings, so it reads as a solid object inside the glass.
   By day: lit by the sun, softened by haze with distance. At night: floodlit towers, road lights, red beacons,
   the city on the far shore, and their reflections on the water. */
(function () {
  'use strict';
  const U = SS.u;
  const G3 = (SS.gg3d = {});
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const css = (c, a) => `rgba(${Math.min(255, c[0]) | 0},${Math.min(255, c[1]) | 0},${Math.min(255, c[2]) | 0},${a == null ? 1 : a})`;

  /* ── The model. x runs along the bridge (towers at ±1), y is up (water at 0), z is across.
       Real proportions: 1,280 m main span, 227 m towers, roadway 67 m up. Heights are stretched a little on screen. ── */
  const TOP = 0.355, DECK = 0.105, W = 0.034, LEGZ = W + 0.013, END = 1.6, SADDLE = 0.343, LOW = DECK + 0.012;
  const boxes = [], lines = [], lamps = [], beacons = [];
  const box = (x, y0, y1, z, bx, bz, tx, tz, kind, tag) => boxes.push({ x, y0, y1, z, bx, bz, tx: tx == null ? bx : tx, tz: tz == null ? bz : tz, kind, tag });
  [-1, 1].forEach(x => {
    box(x, -0.02, 0.014, 0, 0.06, LEGZ + 0.032, 0.055, LEGZ + 0.028, 'pier');
    [-1, 1].forEach(sz => {
      box(x, 0.014, DECK + 0.03, sz * LEGZ, 0.027, 0.017, 0.024, 0.0155, 'steel', 'leg');
      box(x, DECK + 0.03, 0.255, sz * LEGZ, 0.022, 0.0145, 0.019, 0.013, 'steel', 'leg');
      box(x, 0.255, TOP, sz * LEGZ, 0.018, 0.012, 0.0155, 0.0105, 'steel', 'leg');
      beacons.push([x, TOP + 0.008, sz * LEGZ]);
    });
    // the portal struts that tie the two legs together (the tower's art-deco "doorways")
    [[TOP - 0.013, TOP], [0.283, 0.294], [0.223, 0.233], [0.165, 0.174], [DECK - 0.032, DECK - 0.021], [0.046, 0.055]].forEach(([a, b]) =>
      box(x, a, b, 0, 0.016, LEGZ - 0.011, null, null, 'steel', 'strut'));
  });
  for (let x = -END; x < END - 1e-6; x += 0.1) { const x1 = Math.min(END, x + 0.1); box((x + x1) / 2, DECK - 0.014, DECK, 0, (x1 - x) / 2, W, null, null, 'deck'); }
  const cableY = x => {
    const ax = Math.abs(x);
    if (ax <= 1) return LOW + (SADDLE - LOW) * x * x;
    const u = Math.min(1, (ax - 1) / 0.6), yA = DECK + 0.012;
    return SADDLE * (1 - u) + yA * u - 0.055 * 4 * u * (1 - u);
  };
  [-1, 1].forEach(sz => {
    const z = sz * W;
    for (let x = -END; x < END - 1e-6; x += 0.1) { const pts = []; for (let k = 0; k <= 5; k++) { const xx = Math.min(END, x + 0.02 * k); pts.push([xx, cableY(xx), z]); } lines.push({ pts, kind: 'cable' }); }
    for (let x0 = -END + 0.0125; x0 < END; x0 += 0.15) {
      const segs = [];
      for (let x = x0; x < Math.min(END, x0 + 0.15) - 1e-6; x += 0.025) { if (Math.abs(Math.abs(x) - 1) < 0.03) continue; const y = cableY(x); if (y > DECK + 0.004) segs.push([[x, y, z], [x, DECK, z]]); }
      if (segs.length) lines.push({ segs, kind: 'hanger' });
    }
    for (let x0 = -END; x0 < END - 1e-6; x0 += 0.1) {
      const segs = [], zz = sz * (W + 0.0008);
      for (let x = x0; x < x0 + 0.1 - 1e-6; x += 0.02) { segs.push([[x, DECK - 0.014, zz], [x + 0.01, DECK - 0.001, zz]]); segs.push([[x + 0.01, DECK - 0.001, zz], [x + 0.02, DECK - 0.014, zz]]); }
      lines.push({ segs, kind: 'truss' });
    }
    for (let x = -END + 0.03; x < END; x += 0.06) lamps.push([x, DECK + 0.014, sz * (W - 0.004)]);
  });
  // faces of a box, wound the same way from outside: top, −z, +z, +x, −x
  const FACES = [[[4, 7, 6, 5], [0, 1, 0]], [[0, 4, 5, 1], [0, 0, -1]], [[3, 2, 6, 7], [0, 0, 1]], [[1, 5, 6, 2], [1, 0, 0]], [[0, 3, 7, 4], [-1, 0, 0]]];

  let glow = null, streak = null;
  const streakSprite = () => {
    if (streak) return streak;
    streak = U.mk(16, 96); const x = streak.getContext('2d');
    const v = x.createLinearGradient(0, 0, 0, 96); v.addColorStop(0, 'rgba(255,206,150,.95)'); v.addColorStop(0.35, 'rgba(255,190,130,.45)'); v.addColorStop(1, 'rgba(255,180,120,0)');
    x.fillStyle = v; x.fillRect(0, 0, 16, 96);
    x.globalCompositeOperation = 'destination-in';
    const hz = x.createLinearGradient(0, 0, 16, 0); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(0.5, 'rgba(0,0,0,1)'); hz.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = hz; x.fillRect(0, 0, 16, 96); return streak;
  };
  const glowSprite = () => {
    if (glow) return glow;
    glow = U.mk(64, 64); const x = glow.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(0.18, 'rgba(255,200,130,.55)'); gr.addColorStop(0.5, 'rgba(255,150,80,.14)'); gr.addColorStop(1, 'rgba(255,140,70,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return glow;
  };

  /* Draw the bridge and its bay into the dome.
     o: { cx, yh (water line), R, t, s (sky: night, dusk, fog, rain, cloud, sun…), sky (horizon colour), fogMid(y, a) } */
  G3.draw = function (g, o) {
    const { R, t, s } = o;
    const T = G3.tune || {};
    const yaw = (T.yaw ?? -0.68) + (T.swing ?? 0.18) * Math.sin(t * 0.035), ca = Math.cos(yaw), sa = Math.sin(yaw);
    const Y = T.Y ?? 1.85, D = T.D ?? 2.05, camY = T.camY ?? 0.5, pitch = Math.atan2(camY - 0.24, D), cp = Math.cos(pitch), sp = Math.sin(pitch), f = R * (T.f ?? 1.55);
    const P = (x, y, z) => { const xr = x * ca - z * sa, zr = x * sa + z * ca, yy = y * Y - camY, zz = zr + D, y2 = yy * cp + zz * sp, z2 = -yy * sp + zz * cp; return [xr * f / z2, -y2 * f / z2, z2]; };
    const o0 = P(0, 0, 0), ox = o.cx - (P(-1, 0, 0)[0] + P(1, 0, 0)[0]) / 2 - R * (T.shift ?? 0.12), oy = o.yh - o0[1];
    const S = (x, y, z) => { const p = P(x, y, z); p[0] += ox; p[1] += oy; return p; };
    const horizon = oy - f * Math.tan(pitch);
    const night = s.night, dusk = s.dusk || 0, lit = U.clamp(night + dusk * 0.45 + Math.max(s.fog, s.rain, s.cloud - 0.55) * 0.2, 0, 1);
    const haze = 0.18 + s.fog * 0.65 + s.rain * 0.2 + Math.max(0, s.cloud - 0.6) * 0.2;
    const hazeCol = mix(o.sky, [8, 12, 22], night * 0.6);
    const L = [-0.45, 0.72, -0.52], LL = Math.hypot(...L);
    const day = 1 - night;

    /* the bay: far shores on the horizon, the city glittering on the left, water down to the base of the glass */
    const par = (yaw + 0.68) * R * 0.9;
    const shore = css(mix(mix(mix([92, 118, 104], [160, 132, 120], dusk * 0.6), hazeCol, 0.35 + s.fog * 0.5), [6, 8, 14], night));
    g.fillStyle = shore;
    g.beginPath(); g.moveTo(o.cx + R * 0.15 + par, horizon + 1); g.quadraticCurveTo(o.cx + R * 0.45 + par, horizon - R * 0.16, o.cx + R * 0.8 + par, horizon - R * 0.1); g.quadraticCurveTo(o.cx + R * 1.0 + par, horizon - R * 0.07, o.cx + R * 1.2, horizon - R * 0.12); g.lineTo(o.cx + R * 1.2, horizon + 1); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(o.cx - R * 1.2, horizon + 1); g.lineTo(o.cx - R * 1.2, horizon - R * 0.05); g.quadraticCurveTo(o.cx - R * 0.7 + par, horizon - R * 0.09, o.cx - R * 0.35 + par, horizon - R * 0.035); g.lineTo(o.cx - R * 0.2 + par, horizon + 1); g.closePath(); g.fill();
    if (night > 0.08) {
      const r = U.seeded(41);
      for (let i = 0; i < 90; i++) {
        const x = o.cx - R * (0.25 + r() * 0.95) + par, y = horizon - R * (r() * r() * 0.075), w = Math.max(1, R * 0.006);
        g.fillStyle = `rgba(${r() < 0.25 ? '255,176,120' : '246,236,214'},${night * (0.35 + 0.55 * r()) * (0.85 + 0.15 * Math.sin(t * (1 + r() * 2) + i))})`;
        g.fillRect(x, y, w, w * 1.3);
      }
    }
    const wg = g.createLinearGradient(0, horizon, 0, o.yh + R * 0.35);
    wg.addColorStop(0, css(mix(mix(o.sky, [72, 108, 140], 0.45), [10, 14, 26], night)));
    wg.addColorStop(1, css(mix([22, 48, 76], [2, 3, 7], night)));
    g.fillStyle = wg; g.fillRect(o.cx - R * 1.2, horizon, R * 2.4, R * 0.8);

    /* build every visible face and line, with its depth */
    const prims = [];
    let sign = 0;
    for (const b of boxes) {
      const C = [[b.x - b.bx, b.y0, b.z - b.bz], [b.x + b.bx, b.y0, b.z - b.bz], [b.x + b.bx, b.y0, b.z + b.bz], [b.x - b.bx, b.y0, b.z + b.bz],
        [b.x - b.tx, b.y1, b.z - b.tz], [b.x + b.tx, b.y1, b.z - b.tz], [b.x + b.tx, b.y1, b.z + b.tz], [b.x - b.tx, b.y1, b.z + b.tz]].map(p => S(p[0], p[1], p[2]));
      for (const [idx, n] of FACES) {
        const q = idx.map(i => C[i]);
        let area = 0; for (let i = 0; i < 4; i++) { const a = q[i], c = q[(i + 1) % 4]; area += a[0] * c[1] - c[0] * a[1]; }
        if (!sign && b.kind === 'deck' && n[1] === 1) sign = Math.sign(area) || -1;
        prims.push({ type: 'face', q, n, b, area, z: (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4 });
      }
    }
    for (const l of lines) {
      if (l.pts) { const pts = l.pts.map(p => S(p[0], p[1], p[2])); prims.push({ type: 'line', kind: l.kind, pts, z: pts.reduce((a, p) => a + p[2], 0) / pts.length }); }
      else { const segs = l.segs.map(([a, c]) => [S(a[0], a[1], a[2]), S(c[0], c[1], c[2])]); prims.push({ type: 'segs', kind: l.kind, segs, z: segs.reduce((a, sg) => a + sg[0][2], 0) / segs.length }); }
    }
    const faces = prims.filter(p => p.type !== 'face' || p.area * sign > 0);
    faces.sort((a, b) => b.z - a.z);
    const zMid = D + 0.05;

    /* reflections of the towers and lights, rippling on the water */
    g.save(); g.beginPath(); g.rect(o.cx - R * 1.2, horizon, R * 2.4, R); g.clip();
    g.globalAlpha = 0.12 + 0.2 * lit;
    for (const b of boxes) {
      if (b.tag !== 'leg' && b.kind !== 'pier') continue;
      // mirrored in the water line, a little squashed, starting below the concrete pier
      const m = y => (y < 0.02 ? -y : -(y - 0.014) * 0.75 - 0.014);
      const q = [[b.x - b.tx, m(b.y1), b.z - b.tz], [b.x + b.tx, m(b.y1), b.z - b.tz], [b.x + b.bx, m(Math.max(0, b.y0)), b.z - b.bz], [b.x - b.bx, m(Math.max(0, b.y0)), b.z - b.bz]].map(p => S(p[0], p[1], p[2]));
      g.fillStyle = css(b.kind === 'pier' ? mix([110, 108, 106], [30, 28, 32], night) : night > 0.3 ? [255, 110, 60] : mix([176, 64, 50], hazeCol, 0.3));
      g.beginPath(); q.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    if (lit > 0.05) {
      // soft streaks of light on the water under the near side's lamps, swaying with the ripples
      const sk = streakSprite();
      g.globalCompositeOperation = 'lighter';
      lamps.forEach((l, i) => {
        if (i % 2 || (l[2] > 0) === (sa > 0)) return;
        const r1 = ((i * 7919) % 97) / 97, r2 = ((i * 104729) % 89) / 89;     // each streak its own length and strength
        const a = S(l[0], 0, l[2]), b = S(l[0], -l[1] * (0.9 + 1.1 * r1), l[2]), len = b[1] - a[1], w = Math.max(2, R * (0.012 + 0.01 * r2) * 2.2 / a[2]);
        g.globalAlpha = 0.24 * lit * (0.35 + 0.65 * r2) * (0.7 + 0.3 * Math.sin(t * 1.1 + i * 2.3));
        g.drawImage(sk, a[0] - w / 2 + Math.sin(t * 0.8 + i * 0.9) * w * 0.3 + (r1 - 0.5) * w, a[1] + 1, w, len);
      });
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    g.strokeStyle = css(mix([255, 255, 255], [120, 140, 170], night), 0.05 + 0.04 * day); g.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const y = horizon + (o.yh + R * 0.3 - horizon) * ((i + 1) / 15) ** 1.4, x = o.cx + Math.sin(t * 0.4 + i * 2.3) * R * 0.6, w = R * (0.08 + 0.1 * ((i * 37) % 10) / 10); g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + w, y); g.stroke(); }
    g.restore();

    /* the bridge, far to near, with fog passing between the towers */
    const steel = [196, 56, 44];
    let fogged = false;
    for (const p of faces) {
      if (!fogged && p.z < zMid) { fogged = true; o.fogMid && o.fogMid(horizon); }
      const hz = U.clamp((p.z - 1.75) / 1.3, 0, 1) * haze;
      if (p.type === 'face') {
        const b = p.b, n = p.n;
        const sun = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / LL);
        let col;
        if (b.kind === 'deck' && n[1] === 1) col = mix(mul([64, 64, 70], 0.7 + 0.4 * sun), [40, 34, 36], night * 0.6);        // the roadway itself
        else if (b.kind === 'pier') col = mix(mul([150, 146, 140], 0.6 + 0.45 * sun), [40, 36, 40], night * 0.7);
        else {
          const dayC = mul(steel, 0.52 + 0.6 * sun);
          // at night the towers are floodlit from below: brightest low down, fading toward the top
          const hf = U.clamp(((b.y0 + b.y1) / 2) / TOP, 0, 1), flood = b.kind === 'deck' ? 0.55 : (1.08 - hf * 0.5) * (n[1] ? 0.7 : 1);
          col = mix(dayC, mul([255, 96, 50], flood), lit);
        }
        col = mix(col, hazeCol, hz);
        const q = p.q;
        g.fillStyle = css(col);
        g.beginPath(); g.moveTo(q[0][0], q[0][1]); g.lineTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.lineTo(q[3][0], q[3][1]); g.closePath(); g.fill();
        // the recessed panels on the towers' broad faces
        if (b.tag === 'leg' && n[2] !== 0 && (q[0][2] < 2.6)) {
          g.strokeStyle = css(mul(col, 0.72)); g.lineWidth = Math.max(0.6, R * 0.0016 * 2.3 / p.z);
          g.beginPath();
          for (const u of [0.35, 0.65]) { const a = [q[0][0] + (q[3][0] - q[0][0]) * u, q[0][1] + (q[3][1] - q[0][1]) * u], c = [q[1][0] + (q[2][0] - q[1][0]) * u, q[1][1] + (q[2][1] - q[1][1]) * u]; g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); }
          g.stroke();
        }
      } else {
        const wBase = p.kind === 'cable' ? 0.0062 : p.kind === 'truss' ? 0.0024 : 0.0016;
        const col = mix(mix(mul(steel, p.kind === 'hanger' ? 0.85 : 0.75), [255, 110, 64], lit * 0.9), hazeCol, hz);
        g.strokeStyle = css(col, p.kind === 'hanger' ? 0.8 : 1); g.lineWidth = Math.max(p.kind === 'cable' ? 1 : 0.5, R * wBase * 2.3 / p.z); g.lineCap = 'round';
        g.beginPath();
        if (p.type === 'line') p.pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
        else p.segs.forEach(([a, c]) => { g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); });
        g.stroke();
      }
    }
    if (!fogged && o.fogMid) o.fogMid(horizon);

    /* lights: road lamps, a warm bloom at each tower, and the red aircraft beacons on top */
    if (lit > 0.05) {
      const gs = glowSprite();
      g.save(); g.globalCompositeOperation = 'lighter';
      [-1, 1].forEach(x => {
        const a = S(x, DECK * 0.9, 0), r = R * 0.22 * 2.3 / a[2];
        g.globalAlpha = 0.22 * lit; g.drawImage(gs, a[0] - r, a[1] - r * 1.4, r * 2, r * 2.8);
      });
      lamps.forEach(l => {
        const a = S(l[0], l[1], l[2]), r = R * 0.028 * 2.3 / a[2];
        g.globalAlpha = 0.85 * lit; g.drawImage(gs, a[0] - r, a[1] - r, r * 2, r * 2);
      });
      g.restore();
    }
    const blink = night > 0.05 || s.fog > 0.4 ? Math.max(night, s.fog) * (0.55 + 0.45 * Math.sin(t * 2.2)) : 0;
    if (blink > 0.02) beacons.forEach(bk => { const a = S(bk[0], bk[1], bk[2]), r = Math.max(1.2, R * 0.006 * 2.3 / a[2]); g.fillStyle = `rgba(255,50,40,${blink})`; g.beginPath(); g.arc(a[0], a[1], r, 0, 6.3); g.fill(); g.fillStyle = `rgba(255,60,40,${0.25 * blink})`; g.beginPath(); g.arc(a[0], a[1], r * 3.5, 0, 6.3); g.fill(); });
    return { horizon };
  };
})();
