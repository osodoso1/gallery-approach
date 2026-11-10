/* Snow globe: the landmark sits inside a glass dome on a black table, and the live weather happens inside the glass.
   Night there → dark sky, moon, the bridge lit up. Day → blue sky and sun. Around sunrise and sunset the sky warms.
   The Golden Gate Bridge is a glowing model drawn in code; every other landmark is its photo, set inside the dome.
   (After Karen X. Cheng's weather snow globe.) */
(function () {
  'use strict';
  const U = SS.u;
  const GL = (SS.globe = {});
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const KEYS = ['fog', 'rain', 'snow', 'storm', 'cloud', 'sun', 'night', 'dusk'];

  GL.layout = function (W, H) {
    const land = W > H * 1.05;
    const R = land ? Math.min(H * 0.40, W * 0.25) : Math.min(W * 0.46, H * 0.25);
    return land ? { cx: W * 0.645, y0: H * 0.70, R } : { cx: W / 2, y0: H * 0.47, R };
  };

  // What the sky inside the globe should be doing right now.
  function want(item) {
    const FX = SS.wxfx, L = SS.landmarks, w = item.lm ? L.wxNow(item.lm) : null, set = SS.settings.wx || {};
    let s = FX.demoUntil > Date.now() && FX.demoScene ? FX.demoScene : w ? L.scene(w) : (SS.wxscreen.sample || null);
    const hr = new Date().getHours();
    const out = Object.assign({ fog: 0, rain: 0, snow: 0, storm: 0, cloud: 0.1, sun: 0, night: hr < 6 || hr >= 18 ? 1 : 0, wind: 4, dir: 270, dusk: 0 }, s || {});
    if (w && w.sunrise && w.off != null && !(FX.demoUntil > Date.now())) {
      const d = new Date(Date.now() + w.off * 1000), now = d.getUTCHours() * 60 + d.getUTCMinutes();
      const m = iso => +iso.slice(11, 13) * 60 + +iso.slice(14, 16);
      out.dusk = U.clamp(1 - Math.min(Math.abs(now - m(w.sunrise)), Math.abs(now - m(w.sunset))) / 50, 0, 1);
    }
    if (set.dayNight === false) { out.night = 0; out.dusk = 0; }
    return out;
  }

  /* The Golden Gate Bridge, drawn as a small glowing model. lit: 0 by day … 1 at night. */
  function bridge(g, cx, yh, R, lit, t, mirror) {
    const yd = yh - R * 0.13, yt = yh - R * 0.62, tx = [cx - R * 0.40, cx + R * 0.40], yc = 2 * (yd - R * 0.035) - yt;
    const col = rgb(mix([196, 62, 42], [255, 92, 58], lit));
    g.save();
    g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round';
    if (lit > 0.05 && !mirror) { g.shadowColor = `rgba(255,70,30,${0.9 * lit})`; g.shadowBlur = R * 0.07 * lit; }
    // cables: side spans and the long main span
    g.lineWidth = Math.max(1, R * 0.009);
    g.beginPath();
    g.moveTo(cx - R * 1.05, yd - R * 0.02); g.quadraticCurveTo(cx - R * 0.66, yd - R * 0.02, tx[0], yt);
    g.quadraticCurveTo(cx, yc, tx[1], yt);
    g.quadraticCurveTo(cx + R * 0.66, yd - R * 0.02, cx + R * 1.05, yd - R * 0.02);
    g.stroke();
    // suspender ropes
    g.lineWidth = Math.max(0.6, R * 0.0032); g.globalAlpha = 0.8;
    g.beginPath();
    for (let x = cx - R; x <= cx + R; x += R * 0.034) {
      let y;
      if (x > tx[0] && x < tx[1]) { const u = (x - tx[0]) / (tx[1] - tx[0]); y = (1 - u) * (1 - u) * yt + 2 * u * (1 - u) * yc + u * u * yt; }
      else { const far = x < cx ? cx - R * 1.05 : cx + R * 1.05, near = x < cx ? tx[0] : tx[1], u = (x - far) / (near - far), c1 = yd - R * 0.02; y = (1 - u) * (1 - u) * c1 + 2 * u * (1 - u) * c1 + u * u * yt; }
      if (y < yd - 1) { g.moveTo(x, y); g.lineTo(x, yd); }
    }
    g.stroke(); g.globalAlpha = 1;
    // towers: two legs, art-deco cross pieces, stepping in toward the top
    tx.forEach(x => {
      const leg = R * 0.03;
      [[yh + R * 0.02, yd, 0.02], [yd, yt + R * 0.3, 0.018], [yt + R * 0.3, yt + R * 0.13, 0.016], [yt + R * 0.13, yt - R * 0.012, 0.014]].forEach(([a, b, w]) => { g.fillRect(x - leg - R * w / 2, b, R * w, a - b); g.fillRect(x + leg - R * w / 2, b, R * w, a - b); });
      [yt, yt + R * 0.13, yt + R * 0.3, yd + R * 0.045].forEach(y => g.fillRect(x - leg, y, leg * 2, R * 0.017));
    });
    // roadway and its truss
    g.fillRect(cx - R * 1.05, yd, R * 2.1, R * 0.016);
    g.globalAlpha = 0.7; g.fillRect(cx - R * 1.05, yd + R * 0.026, R * 2.1, R * 0.006); g.globalAlpha = 1;
    g.shadowBlur = 0;
    if (lit > 0.05) {
      // road lights, and the red beacons on top of the towers
      g.fillStyle = `rgba(255,222,170,${0.95 * lit})`; g.shadowColor = 'rgba(255,200,120,.9)'; g.shadowBlur = mirror ? 0 : R * 0.03;
      for (let x = cx - R; x <= cx + R; x += R * 0.068) { g.beginPath(); g.arc(x, yd - R * 0.004, Math.max(0.8, R * 0.006), 0, 6.3); g.fill(); }
      g.fillStyle = `rgba(255,60,50,${lit * (0.55 + 0.45 * Math.sin(t * 2.2))})`; g.shadowColor = '#ff3020';
      tx.forEach(x => { g.beginPath(); g.arc(x, yt - R * 0.03, Math.max(1, R * 0.009), 0, 6.3); g.fill(); });
    }
    g.restore();
  }
  function ggScene(g, cx, y0, R, ry, rb, c, t, sky, front) {
    const yh = y0 - R * 0.07, lit = U.clamp(c.night + c.dusk * 0.5 + Math.max(c.fog, c.rain, c.cloud - 0.5) * 0.25, 0, 1);
    if (!front) {
      // headlands on both shores, and the city glittering beyond the south tower at night
      const hill = rgb(mix(mix([74, 104, 82], [150, 120, 110], c.dusk * 0.6), [5, 7, 13], c.night));
      g.fillStyle = hill;
      g.beginPath(); g.moveTo(cx - R * 1.1, yh); g.quadraticCurveTo(cx - R * 0.95, yh - R * 0.34, cx - R * 0.62, yh - R * 0.12); g.quadraticCurveTo(cx - R * 0.45, yh - R * 0.03, cx - R * 0.3, yh); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx + R * 1.1, yh); g.quadraticCurveTo(cx + R * 0.9, yh - R * 0.24, cx + R * 0.66, yh - R * 0.07); g.quadraticCurveTo(cx + R * 0.56, yh - R * 0.02, cx + R * 0.48, yh); g.closePath(); g.fill();
      if (c.night > 0.1) {
        const r = U.seeded(99); g.save(); g.shadowColor = 'rgba(255,230,190,.9)'; g.shadowBlur = R * 0.02;
        for (let i = 0; i < 46; i++) { const x = cx - R * (0.2 + r() * 0.55), y = yh - R * (0.01 + r() * r() * 0.16); g.fillStyle = `rgba(${r() < 0.2 ? '255,170,110' : '250,240,220'},${c.night * (0.45 + 0.5 * r()) * (0.8 + 0.2 * Math.sin(t * (1 + r() * 2) + i))})`; g.fillRect(x, y, Math.max(1, R * 0.008), Math.max(1, R * 0.011)); }
        g.restore();
      }
      // the water of the Golden Gate
      const wg = g.createLinearGradient(0, yh, 0, y0 + rb);
      wg.addColorStop(0, rgb(mix(mix(sky, [60, 100, 140], 0.5), [9, 13, 24], c.night))); wg.addColorStop(1, rgb(mix([24, 52, 82], [2, 3, 6], c.night)));
      g.fillStyle = wg; g.fillRect(cx - R * 1.1, yh, R * 2.2, y0 + rb - yh + 2);
      return yh;
    }
    // reflection first, then the bridge itself
    g.save(); g.beginPath(); g.rect(cx - R * 1.1, yh, R * 2.2, y0 + rb - yh + 2); g.clip();
    g.translate(0, yh); g.scale(1, -0.38); g.translate(0, -yh); g.globalAlpha = 0.1 + 0.16 * lit;
    bridge(g, cx, yh, R, lit, t, true); g.restore();
    g.save(); g.strokeStyle = `rgba(255,255,255,${0.05 + 0.05 * lit})`; g.lineWidth = Math.max(1, R * 0.004);
    for (let i = 0; i < 7; i++) { const y = yh + R * (0.015 + i * 0.012), x = cx + Math.sin(t * 0.5 + i * 1.7) * R * 0.5, w = R * (0.1 + 0.08 * Math.sin(i * 2.1)); g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + w, y); g.stroke(); }
    g.restore();
    bridge(g, cx, yh, R, lit, t, false);
    return yh;
  }

  GL.create = function (item, img, st) {
    const c = U.mk(st.pw, st.ph), g = c.getContext('2d', { alpha: false });
    let W = st.pw, H = st.ph, raf = 0, last = 0, t = Math.random() * 50, flash = 0, nextBolt = 0, bolt = null, cur = null, pic = null;
    const rnd = U.seeded(5);
    const drops = Array.from({ length: 260 }, () => ({ x: rnd(), y: rnd(), z: 0.5 + rnd() * 0.5 }));
    const flakes = Array.from({ length: 220 }, () => ({ x: rnd(), y: rnd(), z: 0.3 + rnd() * 0.7, p: rnd() * 6.3 }));
    const stars = Array.from({ length: 60 }, () => ({ x: rnd(), y: rnd() * 0.75, p: rnd() * 6.3, s: 0.5 + rnd() }));
    const model = item.model === 'gg';

    function dome(L, ry, rb) { g.beginPath(); g.ellipse(L.cx, L.y0, L.R, ry, 0, Math.PI, 2 * Math.PI); g.ellipse(L.cx, L.y0, L.R, rb, 0, 0, Math.PI); g.closePath(); }
    // the photo, cut to fill the dome (made once per size)
    function picture(L, ry, rb) {
      const bw = Math.ceil(L.R * 2), bh = Math.ceil(ry + rb);
      if (pic && pic.width === bw && pic.height === bh) return pic;
      pic = U.mk(bw, bh); const pg = pic.getContext('2d'); pg.imageSmoothingQuality = 'high';
      const iw = img.naturalWidth, ih = img.naturalHeight, s = Math.max(bw / iw, bh / ih);
      pg.drawImage(img, (bw - iw * s) / 2, (bh - ih * s) * 0.55, iw * s, ih * s);
      return pic;
    }
    function band(spr, cx, y, w, h, off, a) { if (a < 0.01) return; g.globalAlpha = Math.min(1, a); const o = ((off % w) + w) % w; for (let x = cx - w * 1.5 - o + w; x < cx + w; x += w) g.drawImage(spr, 2, 0, spr.width - 4, spr.height, x, y - h / 2, w + 0.6, h); g.globalAlpha = 1; }

    function draw(dt = 0) {
      t += dt;
      const tg = want(item);
      if (!cur) cur = Object.assign({}, tg);
      const e = 1 - Math.exp(-dt * 1.2);
      KEYS.forEach(k => (cur[k] += ((tg[k] || 0) - cur[k]) * e)); cur.wind = tg.wind || 0; cur.dir = tg.dir == null ? 270 : tg.dir;
      const s = cur, L = GL.layout(W, H), R = L.R, cx = L.cx, y0 = L.y0, ry = R * 0.98, rb = R * 0.15, k = R / 300;
      const spr = SS.wxfx.sprites(), wx = -Math.sin(s.dir * Math.PI / 180), S = ({ 1: 0.7, 2: 1, 3: 1.3 }[(SS.settings.wx || {}).strength] || 1);
      const heavy = Math.max(s.rain, s.storm, s.snow * 0.7);

      // the room: black, with the faintest pool of light on the table
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const tb = g.createRadialGradient(cx, y0 + rb, R * 0.2, cx, y0 + rb, R * 2.1);
      tb.addColorStop(0, `rgba(${s.night > 0.5 ? '40,34,44' : '54,60,72'},.5)`); tb.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = tb; g.fillRect(0, y0 - R * 0.2, W, H);

      // ── inside the glass ──
      g.save(); dome(L, ry, rb); g.clip();
      let top = mix(mix([52, 116, 198], [40, 38, 96], s.dusk), [2, 4, 12], s.night), bot = mix(mix([176, 212, 240], [246, 150, 86], s.dusk), [10, 16, 38], s.night);
      const grey = U.clamp(Math.max(s.cloud - 0.4, 0) * 1.3 + heavy * 0.4 + s.fog * 0.5, 0, 0.92), gcol = mix([150, 158, 168], [16, 19, 26], s.night);
      top = mix(top, gcol, grey); bot = mix(bot, mix(gcol, [200, 204, 210], (1 - s.night) * 0.4), grey);
      const sk = g.createLinearGradient(0, y0 - ry, 0, y0); sk.addColorStop(0, rgb(top)); sk.addColorStop(1, rgb(bot));
      g.fillStyle = sk; g.fillRect(cx - R, y0 - ry, R * 2, ry + rb + 2);
      if (!model && img) {
        const p = picture(L, ry, rb);
        g.drawImage(p, cx - R, y0 - ry);
        // light the photo for the hour: blue and dim at night, warm at dusk, flat under cloud
        g.globalCompositeOperation = 'multiply';
        if (s.night > 0.01) { g.globalAlpha = s.night * 0.86; g.fillStyle = 'rgb(34,46,104)'; g.fillRect(cx - R, y0 - ry, R * 2, ry + rb + 2); }
        if (s.dusk > 0.01) { g.globalAlpha = s.dusk * 0.55; g.fillStyle = 'rgb(255,170,120)'; g.fillRect(cx - R, y0 - ry, R * 2, ry + rb + 2); }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        if (grey > 0.02) { g.fillStyle = rgb(gcol, grey * 0.34); g.fillRect(cx - R, y0 - ry, R * 2, ry + rb + 2); }
      }
      const clearSky = (1 - U.clamp(s.cloud * 1.3, 0, 1)) * (1 - s.fog);
      if (s.night > 0.2 && clearSky > 0.05 && (model || !img)) {
        g.fillStyle = '#fff';
        stars.forEach(a => { const x = cx + (a.x * 2 - 1) * R * 0.95, y = y0 - ry + a.y * ry; g.globalAlpha = s.night * clearSky * (0.25 + 0.3 * (1 + Math.sin(t * a.s + a.p))); g.fillRect(x, y, 1.6 * k * a.s + 0.6, 1.6 * k * a.s + 0.6); });
        g.globalAlpha = 1;
      }
      // moon (night) or sun (day), dimmed behind cloud
      const orb = (x, y, r, core, halo, a) => { if (a < 0.02) return; const gr = g.createRadialGradient(x, y, r * 0.4, x, y, r * 5.5); gr.addColorStop(0, halo.replace('A', (0.5 * a).toFixed(3))); gr.addColorStop(1, halo.replace('A', '0')); g.fillStyle = gr; g.fillRect(cx - R, y0 - ry, R * 2, ry); g.fillStyle = core.replace('A', a.toFixed(3)); g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); };
      const seen = U.clamp(1 - s.cloud * 0.75 - s.fog * 0.7, 0.08, 1);
      orb(cx - R * 0.07, y0 - ry * 0.8, R * 0.062, 'rgba(240,242,250,A)', 'rgba(200,214,255,A)', s.night * seen);
      if (s.night > 0.3) { g.fillStyle = `rgba(150,158,180,${0.35 * s.night * seen})`; [[-0.3, -0.2, 0.3], [0.25, 0.15, 0.22], [-0.05, 0.4, 0.18]].forEach(([dx, dy, rr]) => { g.beginPath(); g.arc(cx - R * 0.07 + dx * R * 0.062, y0 - ry * 0.8 + dy * R * 0.062, rr * R * 0.062, 0, 6.3); g.fill(); }); }
      orb(cx + R * 0.07, y0 - ry * (0.8 - s.dusk * 0.5), R * 0.075, 'rgba(255,244,214,A)', `rgba(255,${Math.round(226 - s.dusk * 70)},${Math.round(160 - s.dusk * 80)},A)`, (1 - s.night) * seen * (0.35 + 0.65 * Math.max(s.sun, s.dusk)));
      // clouds gather under the top of the dome
      if (s.cloud > 0.05) {
        const dk = U.clamp(heavy * 1.2 + Math.max(0, s.cloud - 0.75) * 2 + s.night * 0.6, 0, 1), sp = t * (4 + s.wind * 0.5) * k * (wx >= 0 ? 1 : -1);
        band(spr.puffs[0], cx, y0 - ry * 0.86, R * 2.4, ry * 0.5, sp, s.cloud * 0.9 * (1 - dk * 0.75));
        band(spr.dark[0], cx, y0 - ry * 0.88, R * 2.8, ry * 0.56, sp * 1.4, s.cloud * 0.95 * dk);
        band(spr.puffs[1], cx, y0 - ry * 0.68, R * 3, ry * 0.36, sp * 1.9, s.cloud * 0.5 * (1 - dk * 0.6));
      }
      const fogA = s.fog * S * (1 - s.night * 0.5), fsp = t * (5 + s.wind * 0.6) * k * (wx >= 0 ? 1 : -1);
      if (model) {
        const sky = mix(top, bot, 0.8), yh = ggScene(g, cx, y0, R, ry, rb, s, t, sky, false);
        band(spr.puffs[2], cx, yh - R * 0.3, R * 2.6, R * 0.5, fsp * 0.7, fogA * 0.7);      // fog behind the towers…
        ggScene(g, cx, y0, R, ry, rb, s, t, sky, true);
      }
      // …and rolling through in front, thickest over the water
      if (s.fog > 0.01) {
        g.fillStyle = rgb(mix([226, 231, 236], [70, 78, 96], s.night), 0.2 * s.fog * S); g.fillRect(cx - R, y0 - ry, R * 2, ry + rb + 2);
        band(spr.puffs[0], cx, y0 - R * 0.42, R * 2.2, R * 0.46, -fsp, fogA * 0.6);
        band(spr.puffs[1], cx, y0 - R * 0.2, R * 2.8, R * 0.44, fsp * 1.5, fogA * 0.85 * (0.88 + 0.12 * Math.sin(t * 0.2)));
        band(spr.puffs[2], cx, y0 + R * 0.02, R * 2.4, R * 0.4, -fsp * 0.8, fogA * 0.95);
      }
      if (s.rain > 0.01) {
        const n = Math.min(drops.length, Math.round(40 + s.rain * 200 * S)), slant = U.clamp(wx * s.wind / 34, -0.6, 0.6) + 0.05;
        g.strokeStyle = `rgba(206,220,242,${0.4 + s.rain * 0.25})`; g.lineWidth = Math.max(1, 1.3 * k); g.lineCap = 'round'; g.beginPath();
        for (let i = 0; i < n; i++) {
          const d = drops[i]; d.y += dt * (1 + s.rain) * d.z * 1.2; d.x += dt * (1 + s.rain) * d.z * 1.2 * slant * 0.5;
          if (d.y > 1.05) { d.y -= 1.1; d.x = Math.random(); } if (d.x > 1.02) d.x -= 1.04; else if (d.x < -0.02) d.x += 1.04;
          const x = cx + (d.x * 2 - 1) * R, y = y0 - ry + d.y * (ry + rb), len = R * 0.06 * d.z * (0.7 + s.rain * 0.5);
          g.moveTo(x, y); g.lineTo(x - slant * len, y - len);
        }
        g.stroke();
      }
      if (s.snow > 0.01) {
        const n = Math.min(flakes.length, Math.round(30 + s.snow * 170 * S)), drift = U.clamp(wx * s.wind / 40, -0.5, 0.5);
        g.fillStyle = '#fff';
        for (let i = 0; i < n; i++) {
          const f = flakes[i]; f.y += dt * (0.06 + f.z * 0.1); f.x += dt * (drift * f.z * 0.2 + Math.sin(t * 0.9 + f.p) * 0.02);
          if (f.y > 1.03) { f.y = -0.03; f.x = Math.random(); } if (f.x > 1.02) f.x -= 1.04; else if (f.x < -0.02) f.x += 1.04;
          g.globalAlpha = 0.4 + f.z * 0.55; g.beginPath(); g.arc(cx + (f.x * 2 - 1) * R, y0 - ry + f.y * (ry + rb), (0.9 + f.z * 2.4) * k + 0.4, 0, 6.3); g.fill();
        }
        g.globalAlpha = 1;
        // snow settles on the floor of the globe
        g.fillStyle = `rgba(240,244,250,${0.5 * s.snow})`; g.beginPath(); g.ellipse(cx, y0 + rb * 0.55, R * 0.96, rb * 0.5, 0, 0, 6.3); g.fill();
      }
      if (s.storm > 0.3) {
        if (!nextBolt) nextBolt = t + 1.5 + Math.random() * 3;
        if (t > nextBolt) { nextBolt = t + 4 + Math.random() * 9; flash = 1; let x = cx + (Math.random() - 0.5) * R * 1.1, y = y0 - ry * 0.8; const pts = [[x, y]]; while (y < y0 - R * 0.15) { y += R * (0.05 + Math.random() * 0.09); x += (Math.random() - 0.5) * R * 0.16; pts.push([x, y]); } bolt = { pts, until: t + 0.2 }; }
      } else nextBolt = 0;
      if (flash > 0.01) {
        g.fillStyle = `rgba(226,234,255,${0.45 * flash * (0.55 + 0.45 * Math.sin(t * 46))})`; g.fillRect(cx - R, y0 - ry, R * 2, ry + rb + 2);
        if (bolt && t < bolt.until) { g.save(); g.strokeStyle = '#fff'; g.lineWidth = Math.max(1.5, 2.4 * k); g.shadowColor = '#cfe0ff'; g.shadowBlur = 16 * k; g.lineJoin = 'round'; g.beginPath(); bolt.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.restore(); }
        flash *= Math.exp(-dt * 4.5);
      }
      // the glass darkens what's behind its curved edge
      const vg = g.createRadialGradient(cx, y0 - ry * 0.35, R * 0.55, cx, y0 - ry * 0.3, R * 1.08);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.62)');
      g.fillStyle = vg; g.fillRect(cx - R, y0 - ry, R * 2, ry + rb + 2);
      g.restore();

      // ── the glass itself, and the scene mirrored in the tabletop ──
      g.save();
      g.globalAlpha = 0.14; g.translate(0, 2 * (y0 + rb * 1.5)); g.scale(1, -1);
      g.drawImage(c, cx - R, y0 - ry * 0.5, R * 2, ry * 0.5 + rb, cx - R, y0 - ry * 0.5, R * 2, ry * 0.5 + rb);
      g.restore();
      const fade = g.createLinearGradient(0, y0 + rb * 1.6, 0, y0 + rb * 2 + ry * 0.5); fade.addColorStop(0, 'rgba(0,0,0,.25)'); fade.addColorStop(1, '#000');
      g.fillStyle = fade; g.fillRect(cx - R * 1.2, y0 + rb * 1.6, R * 2.4, ry * 0.6 + rb);
      g.lineWidth = Math.max(1, 2 * k); g.strokeStyle = 'rgba(255,255,255,.2)';
      g.beginPath(); g.ellipse(cx, y0, R, ry, 0, Math.PI, 2 * Math.PI); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(cx, y0, R, rb, 0, 0, Math.PI); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = Math.max(1, 5 * k); g.beginPath(); g.ellipse(cx, y0 + rb * 0.25, R * 1.07, rb * 1.12, 0, 0, Math.PI); g.stroke();   // the lip of the base
      g.save(); g.lineCap = 'round'; g.shadowColor = 'rgba(255,255,255,.8)'; g.shadowBlur = 10 * k;
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = Math.max(1.5, 7 * k); g.beginPath(); g.ellipse(cx, y0, R * 0.9, ry * 0.9, 0, -0.95, -0.62); g.stroke();              // window glint, upper right
      g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = Math.max(1, 3 * k); g.beginPath(); g.ellipse(cx, y0, R * 0.94, ry * 0.94, 0, Math.PI + 0.25, Math.PI + 0.85); g.stroke(); // softer one, left
      g.restore();
    }
    const loop = now => { const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016; last = now; draw(dt); raf = requestAnimationFrame(loop); };
    draw(0);
    const api = {
      canvas: c, running: false, draw,
      start() { api.running = true; cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(loop); },
      stop() { api.running = false; cancelAnimationFrame(raf); },
      resize(s2) { W = c.width = s2.pw; H = c.height = s2.ph; pic = null; draw(0); },
      dispose() { api.stop(); pic = null; },
    };
    return api;
  };
})();
