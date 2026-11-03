/* Generative pieces — the offline fallback, made on the device.
   Four studies: Aurora, Composition (Bauhaus), Approach at Dusk, Nebula. */
(function () {
  'use strict';
  const U = SS.u;
  const G = (SS.gen = {});
  const STYLES = ['aurora', 'bauhaus', 'dusk', 'nebula'];
  const TITLES = { aurora: 'Aurora Study', bauhaus: 'Composition', dusk: 'Approach at Dusk', nebula: 'Nebula' };

  G.make = function (style) {
    style = style || U.pick(STYLES);
    const seed = Math.floor(Math.random() * 1e9);
    const n = (seed % 900) + 100;
    return {
      key: `gen:${style}:${seed}`, src: 'generative', kind: 'generative', gen: { style, seed },
      title: `${TITLES[style]} No. ${n}`, creator: 'Generative art, drawn by this app in code (not a photo, not AI)', date: '',
      license: 'Made on your screen', link: null,
    };
  };

  let grainCanvas = null;
  function grain(g, w, h, alpha = 0.06) {
    if (!grainCanvas) {
      grainCanvas = U.mk(160, 160);
      const gg = grainCanvas.getContext('2d');
      const id = gg.createImageData(160, 160);
      for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      gg.putImageData(id, 0, 0);
    }
    g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = 'overlay';
    g.fillStyle = g.createPattern(grainCanvas, 'repeat'); g.fillRect(0, 0, w, h);
    g.restore();
  }
  G.grain = grain;

  G.draw = function (g, w, h, spec) {
    const r = U.seeded(spec.seed);
    ({ aurora, bauhaus, dusk, nebula }[spec.style] || aurora)(g, w, h, r);
    grain(g, w, h, 0.07);
  };

  function blob(g, x, y, rad, color, alpha) {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, color.replace('A', alpha)); gr.addColorStop(1, color.replace('A', 0));
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  function stars(g, w, h, r, n, maxR = 1.4) {
    for (let i = 0; i < n; i++) {
      const s = Math.pow(r(), 3) * maxR * (w / 1400) + 0.3;
      g.globalAlpha = 0.35 + r() * 0.65; g.fillStyle = '#fff';
      g.beginPath(); g.arc(r() * w, r() * h, s, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }

  function aurora(g, w, h, r) {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#02040b'); sky.addColorStop(0.55, '#061423'); sky.addColorStop(1, '#0a1f2a');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    stars(g, w, h * 0.7, r, 260);
    g.globalCompositeOperation = 'lighter';
    const hues = [['rgba(60,255,170,A)', 'rgba(40,200,255,A)'], ['rgba(120,255,140,A)', 'rgba(170,90,255,A)'], ['rgba(80,230,255,A)', 'rgba(255,90,170,A)']][Math.floor(r() * 3)];
    for (let band = 0; band < 3; band++) {
      const baseY = h * (0.28 + band * 0.13 + r() * 0.05), amp = h * (0.06 + r() * 0.07), freq = 1.2 + r() * 2.2, ph = r() * 6.28;
      const col = hues[band % 2];
      for (let x = -20; x < w + 20; x += Math.max(2, w / 700)) {
        const t = x / w;
        const y = baseY + Math.sin(t * freq * 6.28 + ph) * amp + Math.sin(t * 17 + ph * 2) * amp * 0.18;
        const len = h * (0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 9 + ph * 3)));
        const gr = g.createLinearGradient(0, y - len, 0, y + h * 0.02);
        gr.addColorStop(0, col.replace('A', 0)); gr.addColorStop(0.75, col.replace('A', 0.05 + 0.05 * r())); gr.addColorStop(1, col.replace('A', 0.0));
        g.fillStyle = gr; g.fillRect(x, y - len, Math.max(2, w / 700) + 1, len + h * 0.02);
      }
    }
    g.globalCompositeOperation = 'source-over';
    // mountains
    for (let L = 0; L < 3; L++) {
      g.fillStyle = ['#0b1a22', '#07131a', '#040b10'][L];
      g.beginPath(); g.moveTo(0, h);
      let y = h * (0.72 + L * 0.07);
      for (let x = 0; x <= w; x += w / 60) { y += (r() - 0.5) * h * 0.035; y = U.clamp(y, h * (0.6 + L * 0.07), h * (0.86 + L * 0.04)); g.lineTo(x, y); }
      g.lineTo(w, h); g.closePath(); g.fill();
    }
  }

  function bauhaus(g, w, h, r) {
    const paper = ['#efe8da', '#ece3d0', '#f2ede3', '#1c1b1a'][Math.floor(r() * 4)];
    const dark = paper === '#1c1b1a';
    g.fillStyle = paper; g.fillRect(0, 0, w, h);
    const pal = dark ? ['#e8452c', '#f2b632', '#2457a6', '#efe8da', '#7aa69a'] : ['#d8432e', '#f2b632', '#1f4e9c', '#1b1b1b', '#5f8f86'];
    const cols = w > h ? 6 : 4, rows = w > h ? 4 : 6;
    const cw = w / cols, ch = h / rows, s = Math.min(cw, ch);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (r() < 0.22) continue;
      const x = i * cw + (cw - s) / 2, y = j * ch + (ch - s) / 2;
      const c = U.pick(pal); g.fillStyle = c;
      const kind = Math.floor(r() * 6);
      g.save(); g.translate(x + s / 2, y + s / 2); g.rotate(Math.floor(r() * 4) * Math.PI / 2); g.translate(-s / 2, -s / 2);
      g.beginPath();
      if (kind === 0) { g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2); }
      else if (kind === 1) { g.moveTo(0, s); g.arc(0, s, s, -Math.PI / 2, 0); g.closePath(); }
      else if (kind === 2) { g.moveTo(0, s / 2); g.arc(s / 2, s / 2, s / 2, Math.PI, 0); g.closePath(); }
      else if (kind === 3) { g.rect(s * 0.1, s * 0.1, s * 0.8, s * 0.8); }
      else if (kind === 4) { g.moveTo(0, s); g.lineTo(s, s); g.lineTo(0, 0); g.closePath(); }
      else { g.rect(0, s * 0.4, s, s * 0.2); }
      g.fill();
      if (r() < 0.25) { g.fillStyle = U.pick(pal); g.beginPath(); g.arc(s / 2, s / 2, s * 0.14, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    g.strokeStyle = dark ? 'rgba(239,232,218,.25)' : 'rgba(27,27,27,.18)'; g.lineWidth = Math.max(1, w / 1600);
    for (let i = 1; i < cols; i++) { g.beginPath(); g.moveTo(i * cw, 0); g.lineTo(i * cw, h); g.stroke(); }
  }

  function dusk(g, w, h, r) {
    const pals = [
      ['#1b1f3b', '#5b3a6e', '#d46a6a', '#f4b183', '#ffd9a8'],
      ['#0f2340', '#2d4a73', '#9a6f8f', '#f09c7a', '#ffd2a0'],
      ['#141029', '#3b2559', '#a1497b', '#f2766b', '#fcc490'],
    ];
    const p = pals[Math.floor(r() * pals.length)];
    const sky = g.createLinearGradient(0, 0, 0, h * 0.78);
    p.forEach((c, i) => sky.addColorStop(i / (p.length - 1), c));
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const sx = w * (0.25 + r() * 0.5), sy = h * (0.52 + r() * 0.1), sr = Math.min(w, h) * (0.08 + r() * 0.05);
    blob(g, sx, sy, sr * 4.5, 'rgba(255,220,170,A)', 0.35);
    g.fillStyle = '#fff1d9'; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    // a far-off arrival with its landing lights on
    const px = w * (0.15 + r() * 0.3), py = h * (0.22 + r() * 0.12), ang = -0.18 - r() * 0.1;
    g.save(); g.translate(px, py); g.rotate(ang);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, w / 1400);
    g.beginPath(); g.moveTo(-w * 0.18, 0); g.lineTo(-w * 0.012, 0); g.stroke();
    const k = w / 1600; g.fillStyle = '#1a1630';
    g.beginPath(); g.ellipse(0, 0, 14 * k, 2.4 * k, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-2 * k, 0); g.lineTo(-7 * k, -9 * k); g.lineTo(-4 * k, -9 * k); g.lineTo(4 * k, 0); g.fill();
    blob(g, 13 * k, 0, 12 * k, 'rgba(255,255,230,A)', 0.9);
    g.restore();
    // layered hills (the peninsula, roughly)
    const hills = ['#3a2d52', '#2b2344', '#1d1934', '#120f22'];
    hills.forEach((c, L) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
      const base = h * (0.62 + L * 0.085), amp = h * (0.05 - L * 0.008), f = 1 + r() * 2, ph = r() * 6.28;
      for (let x = 0; x <= w; x += w / 120) g.lineTo(x, base - Math.sin(x / w * f * 6.28 + ph) * amp - Math.sin(x / w * 21 + ph) * amp * 0.15);
      g.lineTo(w, h); g.closePath(); g.fill();
    });
    // water shimmer
    g.fillStyle = 'rgba(255,210,170,.08)';
    for (let i = 0; i < 40; i++) g.fillRect(sx - sr * 2 + r() * sr * 4, h * 0.92 + r() * h * 0.07, sr * (0.3 + r()), Math.max(1, h / 900));
  }

  function nebula(g, w, h, r) {
    g.fillStyle = '#02030a'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    const cols = [['rgba(255,80,140,A)', 'rgba(90,120,255,A)', 'rgba(255,170,80,A)'], ['rgba(60,200,255,A)', 'rgba(160,80,255,A)', 'rgba(255,120,90,A)']][Math.floor(r() * 2)];
    const cx = w * (0.3 + r() * 0.4), cy = h * (0.3 + r() * 0.4);
    for (let i = 0; i < 70; i++) {
      const a = r() * 6.28, d = Math.pow(r(), 0.7) * Math.min(w, h) * 0.5;
      blob(g, cx + Math.cos(a) * d * 1.4, cy + Math.sin(a) * d * 0.8, Math.min(w, h) * (0.08 + r() * 0.22), U.pick(cols), 0.05 + r() * 0.08);
    }
    g.globalCompositeOperation = 'source-over';
    stars(g, w, h, r, 520, 1.6);
    for (let i = 0; i < 6; i++) { const x = r() * w, y = r() * h; blob(g, x, y, w * 0.012, 'rgba(255,255,255,A)', 0.8); }
  }
})();
