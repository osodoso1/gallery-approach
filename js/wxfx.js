/* Weather effects: the sky at a landmark (or outside your window), drawn over the picture.
   Fog banks drift, rain and snow fall with the wind, storms flash, the sun glows, night dims.
   Everything is a 0–1 amount that eases toward the latest reading, so weather changes fade in. */
(function () {
  'use strict';
  const U = SS.u;
  const KEYS = ['fog', 'rain', 'snow', 'storm', 'sun', 'night', 'cloud'];
  const zero = () => ({ fog: 0, rain: 0, snow: 0, storm: 0, sun: 0, night: 0, cloud: 0, wind: 0, dir: 270 });
  const FX = (SS.wxfx = { cur: zero(), target: zero(), label: '', demoUntil: 0 });
  let cv, g, W = 0, H = 0, k = 1, raf = 0, last = 0, t = 0, slow = 0, wasCalm = true;
  let puffs = [], dark = [], drops = [], flakes = [], stars = [], bolt = null, flash = 0, nextBolt = 0;

  // A soft bank of cloud that tiles left-to-right, built from lots of faint blobs.
  function puff(seed, tint) {
    const w = 768, h = 320, c = U.mk(w, h), x = c.getContext('2d'), r = U.seeded(seed);
    for (let i = 0; i < 110; i++) {
      const cx = r() * w, cy = h * (0.5 + (r() + r() + r() - 1.5) * 0.3), rad = 40 + r() * 110, a = 0.05 + r() * 0.1;
      for (const dx of [-w, 0, w]) {
        const gr = x.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, rad);
        gr.addColorStop(0, `rgba(${tint},${a})`); gr.addColorStop(1, `rgba(${tint},0)`);
        x.fillStyle = gr; x.fillRect(cx + dx - rad, cy - rad, rad * 2, rad * 2);
      }
    }
    return c;
  }
  function build() {
    puffs = [11, 23, 37].map(s => puff(s, '236,240,244'));
    dark = [41, 53].map(s => puff(s, '72,80,94'));
    const r = U.seeded(7);
    drops = Array.from({ length: 900 }, () => ({ x: r(), y: r(), z: 0.45 + r() * 0.55, l: 0.6 + r() * 0.8 }));
    flakes = Array.from({ length: 520 }, () => ({ x: r(), y: r(), z: 0.3 + r() * 0.7, p: r() * 6.28, s: 0.6 + r() * 0.8 }));
    stars = Array.from({ length: 70 }, () => ({ x: r(), y: r() * 0.5, p: r() * 6.28, s: 0.5 + r() }));
  }
  function size() {
    if (!cv) return;
    const w = innerWidth, h = innerHeight;
    k = Math.min(devicePixelRatio || 1, 1.5);
    if (w * h * k * k > 2.6e6) k = Math.sqrt(2.6e6 / (w * h));
    W = cv.width = Math.round(w * k); H = cv.height = Math.round(h * k);
  }
  FX.init = function () {
    cv = U.h('canvas', { id: 'wxfx', 'aria-hidden': 'true' });
    U.$('#stage').appendChild(cv);
    g = cv.getContext('2d');
    size();
    addEventListener('resize', U.debounce(() => { size(); kick(); }, 200));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  };

  const strength = () => ({ 1: 0.65, 2: 1, 3: 1.35 }[(SS.settings.wx || {}).strength] || 1);
  // Set what the sky is doing (null = clear the effects). opts.art: gentler, weather only (no sun glow or night tint).
  FX.set = function (scene, opts = {}) {
    if (FX.demoUntil > Date.now() && !opts.demo) { FX.pending = [scene, opts]; return; }
    const tg = zero();
    if (scene) {
      KEYS.forEach(key => (tg[key] = scene[key] || 0));
      tg.wind = scene.wind || 0; tg.dir = scene.dir == null ? 270 : scene.dir;
      if (opts.art) { tg.sun = 0; tg.night = 0; tg.cloud = tg.rain || tg.snow ? tg.cloud * 0.6 : 0; KEYS.forEach(key => (tg[key] *= 0.75)); }
    }
    FX.target = tg; FX.label = (scene && scene.kind) || '';
    document.body.classList.toggle('wx-veil', tg.fog > 0.25 || tg.snow > 0.4);   // keeps captions readable through fog
    kick();
  };
  // Try an effect for a few seconds (Settings → Weather).
  FX.demo = function (scene, ms = 9000) {
    FX.demoUntil = 0; FX.demoScene = scene;
    const it = SS.show.cur && SS.show.cur.item;
    FX.set(it && it.globe ? null : scene, { demo: true }); FX.demoUntil = Date.now() + ms;   // a snow globe shows the preview inside its glass
    clearTimeout(FX.demoT);
    FX.demoT = setTimeout(() => { FX.demoUntil = 0; const p = FX.pending; FX.pending = null; if (p) FX.set(p[0], p[1]); else SS.emit('wxfx-idle'); }, ms);
  };
  FX.sprites = () => ({ puffs, dark });
  const live = o => KEYS.some(key => o[key] > 0.004);
  function kick() { if (!raf && cv && (live(FX.cur) || live(FX.target))) { last = 0; raf = requestAnimationFrame(frame); } }

  function band(img, y, h, speed, alpha, scale) {
    if (alpha <= 0.004) return;
    const tw = W * scale, th = H * h, off = (((t * speed * k) % tw) + tw) % tw;
    g.globalAlpha = Math.min(1, alpha);
    for (let x = -off; x < W; x += tw) g.drawImage(img, 2, 0, img.width - 4, img.height, x, y * H - th / 2, tw + 0.6, th);
    g.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
    if (!wasCalm) { if (last && now - last > 30) slow = Math.min(60, slow + 1); else slow = Math.max(0, slow - 1); }
    last = now; t += dt;
    const c = FX.cur, tg = FX.target, e = 1 - Math.exp(-dt * 1.1);
    KEYS.forEach(key => { c[key] += (tg[key] - c[key]) * e; if (Math.abs(tg[key] - c[key]) < 0.002) c[key] = tg[key]; });
    c.wind += (tg.wind - c.wind) * e; c.dir = tg.dir;
    g.clearRect(0, 0, W, H);
    if (!live(c) && !live(tg)) return;                          // all clear: stop drawing until the weather changes
    const S = strength(), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wx = -Math.sin(c.dir * Math.PI / 180), gust = 1 + U.clamp(c.wind / 18, 0, 2.5);   // wind blows toward +x when it comes from the west
    const wet = Math.max(c.rain, c.storm), heavy = Math.max(wet, c.snow * 0.7);

    // night first, so everything else sits in the dark
    if (c.night > 0.004) { g.fillStyle = `rgba(6,10,34,${0.3 * c.night * Math.min(S, 1.15)})`; g.fillRect(0, 0, W, H); }
    if (c.night > 0.3 && c.cloud < 0.6 && c.fog < 0.4) {
      const a = (c.night - 0.3) * (1 - c.cloud / 0.6) * 0.9;
      g.fillStyle = '#fff';
      stars.forEach(s => { g.globalAlpha = a * (0.25 + 0.3 * (1 + Math.sin(t * s.s + s.p))); g.fillRect(s.x * W, s.y * H, 1.3 * k * s.s, 1.3 * k * s.s); });
      g.globalAlpha = 1;
      const mx = W * 0.15, my = H * 0.13, mr = Math.min(W, H) * 0.035, gr = g.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 7);
      gr.addColorStop(0, `rgba(220,228,255,${0.35 * a})`); gr.addColorStop(1, 'rgba(220,228,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = `rgba(244,246,255,${0.85 * a})`; g.beginPath(); g.arc(mx, my, mr, 0, 6.3); g.fill();
    }
    // sun: a warm glow from the top corner and slow rays
    if (c.sun > 0.004) {
      const sx = W * 0.84, sy = -H * 0.04, R = Math.max(W, H) * 0.8, a = c.sun * 0.34 * Math.min(S, 1.2);
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, R);
      gr.addColorStop(0, `rgba(255,238,196,${a})`); gr.addColorStop(0.35, `rgba(255,214,150,${a * 0.4})`); gr.addColorStop(1, 'rgba(255,214,150,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = `rgba(255,236,190,${0.05 * c.sun})`;
      for (let i = 0; i < 6; i++) {
        const ang = 1.75 + i * 0.26 + Math.sin(t * 0.05 + i) * 0.05 + (still ? 0 : t * 0.004), wd = 0.035 + 0.02 * Math.sin(t * 0.2 + i * 2);
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(ang - wd) * R * 1.4, sy + Math.sin(ang - wd) * R * 1.4); g.lineTo(sx + Math.cos(ang + wd) * R * 1.4, sy + Math.sin(ang + wd) * R * 1.4); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    // an overcast or rainy sky flattens and greys the light
    const grey = U.clamp(Math.max(c.cloud - 0.45, 0) * 0.36 + heavy * 0.14, 0, 0.36) * Math.min(S, 1.2);
    if (grey > 0.004) { g.fillStyle = `rgba(84,94,108,${grey})`; g.fillRect(0, 0, W, H); }
    // clouds along the top: white when fair, slate when it's raining
    if (c.cloud > 0.05) {
      const a = c.cloud * S, dk = U.clamp(heavy * 1.2 + Math.max(0, c.cloud - 0.8) * 2, 0, 1), sp = 5 * gust * (wx >= 0 ? 1 : -1);
      band(puffs[0], 0.02, 0.42, sp, a * 0.55 * (1 - dk * 0.6), 1.5);
      band(puffs[1], 0.11, 0.36, sp * 1.6, a * 0.4 * (1 - dk * 0.6), 1.9);
      band(dark[0], 0.0, 0.5, sp * 1.2, a * 0.75 * dk, 1.7);
      band(dark[1], 0.12, 0.4, sp * 2, a * 0.5 * dk, 2.2);
    }
    // fog: a veil over everything, thicker banks drifting across the middle and low ground
    if (c.fog > 0.004) {
      const f = c.fog, nt = 1 - c.night * 0.55, col = `${Math.round(226 * nt)},${Math.round(231 * nt)},${Math.round(236 * nt + c.night * 20)}`;
      const veil = g.createLinearGradient(0, 0, 0, H);
      veil.addColorStop(0, `rgba(${col},${0.1 * f * S})`); veil.addColorStop(0.5, `rgba(${col},${Math.min(0.8, 0.3 * f * S)})`); veil.addColorStop(1, `rgba(${col},${Math.min(0.85, 0.44 * f * S)})`);
      g.fillStyle = veil; g.fillRect(0, 0, W, H);
      const b = 0.88 + 0.12 * Math.sin(t * 0.13), sp = (3 + c.wind * 0.5) * (wx >= 0 ? 1 : -1), a = f * S * nt;
      band(puffs[1], 0.22, 0.4, sp * 1.1, a * 0.26 * b, 2.1);
      band(puffs[0], 0.45, 0.55, -sp * 0.6, a * 0.5, 1.6);
      band(puffs[2], 0.64, 0.62, sp * 1.7, a * 0.62 * b, 2.4);
      band(puffs[1], 0.82, 0.6, sp * 0.8, a * 0.72, 1.8);
      band(puffs[0], 0.98, 0.5, -sp * 1.3, a * 0.8, 2.6);
    }
    // rain: two depths of streaks leaning with the wind
    if (c.rain > 0.01) {
      const n = Math.min(drops.length, Math.round(c.rain * 560 * S * (W * H) / (1.6e6)) + 40), slant = U.clamp(wx * c.wind / 34, -0.7, 0.7) + 0.06;
      const fall = (still ? 0 : 1) * (0.9 + c.rain * 0.9);
      g.lineCap = 'round';
      for (const far of [true, false]) {
        g.strokeStyle = far ? `rgba(196,210,232,${0.26 + c.rain * 0.12})` : `rgba(214,226,244,${0.34 + c.rain * 0.2})`;
        g.lineWidth = (far ? 0.9 : 1.5) * k;
        g.beginPath();
        for (let i = 0; i < n; i++) {
          const d = drops[i]; if ((d.z < 0.72) !== far) continue;
          d.y += dt * fall * d.z * 1.5; d.x += dt * fall * d.z * 1.5 * slant * (H / W);
          if (d.y > 1.05) { d.y -= 1.12; d.x = Math.random(); }
          if (d.x > 1.05) d.x -= 1.1; else if (d.x < -0.05) d.x += 1.1;
          const x = d.x * W, y = d.y * H, len = (far ? 14 : 26) * k * d.l * (0.7 + c.rain * 0.6);
          g.moveTo(x, y); g.lineTo(x - slant * len, y - len);
        }
        g.stroke();
      }
    }
    // snow: big slow flakes near, small ones far, swaying
    if (c.snow > 0.01) {
      const n = Math.min(flakes.length, Math.round(c.snow * 330 * S * (W * H) / (1.6e6)) + 30), drift = U.clamp(wx * c.wind / 40, -0.5, 0.5);
      g.fillStyle = '#fff';
      for (let i = 0; i < n; i++) {
        const f = flakes[i];
        if (!still) { f.y += dt * (0.05 + f.z * 0.11) * f.s; f.x += dt * (drift * f.z * 0.25 + Math.sin(t * 0.9 * f.s + f.p) * 0.012) * (H / W); }
        if (f.y > 1.03) { f.y = -0.03; f.x = Math.random(); }
        if (f.x > 1.03) f.x -= 1.06; else if (f.x < -0.03) f.x += 1.06;
        g.globalAlpha = 0.35 + f.z * 0.55;
        g.beginPath(); g.arc(f.x * W, f.y * H, (0.8 + f.z * 2.6) * k, 0, 6.3); g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = `rgba(236,240,246,${0.07 * c.snow * S})`; g.fillRect(0, 0, W, H);
    }
    // thunderstorm: now and then a bolt and a double flash
    if (c.storm > 0.3 && !still) {
      if (!nextBolt) nextBolt = t + 2 + Math.random() * 4;
      if (t > nextBolt) {
        nextBolt = t + 5 + Math.random() * 11; flash = 1;
        let x = W * (0.15 + Math.random() * 0.7), y = 0; const pts = [[x, y]], end = H * (0.3 + Math.random() * 0.3);
        while (y < end) { y += H * (0.02 + Math.random() * 0.05); x += (Math.random() - 0.5) * W * 0.07; pts.push([x, y]); }
        bolt = { pts, until: t + 0.22 };
      }
    } else nextBolt = 0;
    if (flash > 0.01) {
      const fl = flash * (0.55 + 0.45 * Math.sin(t * 46));
      g.fillStyle = `rgba(232,238,255,${0.5 * fl * Math.min(S, 1.1)})`; g.fillRect(0, 0, W, H);
      if (bolt && t < bolt.until) {
        g.save(); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2.2 * k; g.shadowColor = '#cfe0ff'; g.shadowBlur = 18 * k; g.lineJoin = 'round';
        g.beginPath(); bolt.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.restore();
      }
      flash *= Math.exp(-dt * 4.5);
    }
    // only fog, clouds, sun or night? those move slowly, so half the frame rate is plenty (and on a slow device, always)
    const calm = c.rain < 0.01 && c.snow < 0.01 && flash < 0.01 && tg.rain < 0.01 && tg.snow < 0.01;
    wasCalm = calm;
    if (document.hidden) return;
    // raf = -1 means "a timer is holding the next frame", so nothing starts a second loop
    if (still) { raf = -1; setTimeout(() => { raf = 0; kick(); }, 1500); return; }
    if (calm || slow > 30) { raf = -1; setTimeout(() => { raf = requestAnimationFrame(frame); }, calm ? 34 : 16); }
    else raf = requestAnimationFrame(frame);
  }
  build();
})();
