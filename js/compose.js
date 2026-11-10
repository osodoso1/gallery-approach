/* Slide composition — every picture is rendered once into a stage-sized canvas.
   Art gets a museum treatment (blurred backdrop, drop shadow, breathing room);
   photos fill the screen when the aspect ratio allows. */
(function () {
  'use strict';
  const U = SS.u;
  const C = (SS.compose = {});

  C.stage = function () {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    const max = 4.2e6;
    if (pw * ph > max) { const k = Math.sqrt(max / (pw * ph)); pw = Math.round(pw * k); ph = Math.round(ph * k); }
    return { w, h, pw, ph, k: pw / w };
  };

  function loadImg(url, timeout = 30000) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      const t = setTimeout(() => { img.onload = img.onerror = null; img.src = ''; rej(new Error('timeout')); }, timeout);
      img.onload = () => {
        clearTimeout(t);
        const done = () => res(img);
        img.decode ? img.decode().then(done, done) : done();
      };
      img.onerror = () => { clearTimeout(t); rej(new Error('image failed')); };
      img.src = url;
    });
  }
  C.loadImg = loadImg;

  C.load = async function (item) {
    if (item.gen) return { gen: true };
    if (item.live) return { live: true };
    if (item.video) { const video = await SS.live.loadVideo(item.video.urls); return { video, url: video.currentSrc || video.src }; }
    if (item.load) {
      const { url, revoke } = await item.load();
      try { const img = await loadImg(url); return { img, revoke, url: /^blob:/.test(url) ? '' : url }; }
      catch (e) { revoke && revoke(); throw e; }
    }
    let err = null;
    for (const u of (item.urls || []).filter(Boolean)) {
      try {
        const img = await loadImg(u);
        if (img.naturalWidth < 300 || img.naturalHeight < 200) throw new Error('too small');
        return { img, url: u };
      } catch (e) { err = e; }
    }
    throw err || new Error('no image url');
  };

  // Halve repeatedly for big downscales (cleaner than one giant bilinear step).
  function downscale(img, iw, ih, tw, th) {
    const s = Math.max(tw / iw, th / ih);
    if (s >= 0.5) return { src: img, w: iw, h: ih };
    let cur = img, cw = iw, ch = ih;
    while (cw * 0.5 >= iw * s * 0.98 && cw > 2) {
      cw = Math.round(cw / 2); ch = Math.round(ch / 2);
      const c = U.mk(cw, ch), g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(cur, 0, 0, cw, ch);
      cur = c;
    }
    return { src: cur, w: cw, h: ch };
  }

  // A soft "blur" that works everywhere (Safari's canvas has no filter support):
  // shrink to a few dozen pixels, then scale back up in two smooth steps.
  function backdrop(g, src, sw, sh, pw, ph) {
    const tw = 40, th = Math.max(8, Math.round(40 * ph / pw));
    const a = U.mk(tw, th), ag = a.getContext('2d');
    const s = Math.max(tw / sw, th / sh) * 1.15;
    ag.drawImage(src, (tw - sw * s) / 2, (th - sh * s) / 2, sw * s, sh * s);
    const b = U.mk(tw * 5, th * 5), bg = b.getContext('2d');
    bg.imageSmoothingQuality = 'high';
    bg.drawImage(a, 0, 0, b.width, b.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(b, 0, 0, pw, ph);
    g.fillStyle = 'rgba(9, 9, 11, 0.52)';
    g.fillRect(0, 0, pw, ph);
    const v = g.createRadialGradient(pw / 2, ph * 0.45, Math.min(pw, ph) * 0.2, pw / 2, ph / 2, Math.hypot(pw, ph) * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = v; g.fillRect(0, 0, pw, ph);
    SS.gen.grain(g, pw, ph, 0.05);
  }

  C.render = function (item, loaded, st) {
    const c = U.mk(st.pw, st.ph);
    const g = c.getContext('2d', { alpha: false });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (loaded.gen) { SS.gen.draw(g, st.pw, st.ph, item.gen); return { canvas: c, mode: 'cover' }; }
    if (loaded.live) { const live = SS.live.create(item, st); return { canvas: live.canvas, mode: 'live', live }; }
    if (loaded.video) { const live = SS.live.video(item, loaded.video, st); return { canvas: live.canvas, mode: 'live', live }; }
    const img = loaded.img, iw = img.naturalWidth, ih = img.naturalHeight;
    const { src, w: sw, h: sh } = downscale(img, iw, ih, st.pw, st.ph);
    const ir = iw / ih, sr = st.pw / st.ph, mismatch = Math.max(ir / sr, sr / ir);
    const fit = SS.settings.fit;
    // landmarks fill the screen (the weather is drawn over them), unless the shape is wildly off
    const mode = fit === 'fill' ? 'cover' : fit === 'fit' ? 'gallery' : item.fill ? (mismatch < 3.6 ? 'cover' : 'gallery') : (item.kind === 'art' ? 'gallery' : (mismatch < 1.38 ? 'cover' : 'gallery'));
    if (mode === 'cover') {
      const s = Math.max(st.pw / iw, st.ph / ih), dw = iw * s, dh = ih * s;
      const fy = item.kind === 'personal' ? 0.38 : 0.5;          // keep faces in frame
      g.drawImage(src, 0, 0, sw, sh, (st.pw - dw) / 2, (st.ph - dh) * fy, dw, dh);
      return { canvas: c, mode };
    }
    backdrop(g, src, sw, sh, st.pw, st.ph);
    const m = Math.min(st.pw, st.ph);
    const pad = Math.round(m * (item.kind === 'art' ? 0.075 : 0.035));
    const landscape = st.pw > st.ph;
    const padTop = Math.round(pad * (landscape ? 0.9 : 1.6));
    // The caption fades away after a while (calm mode), so the art gets most of the room.
    const calm = SS.settings.calm > 0;
    const capRoom = SS.settings.caption === 'off' ? 0 : st.ph * (landscape ? (calm ? 0.07 : 0.11) : (calm ? 0.1 : 0.16));
    const padBottom = Math.round(pad + capRoom + (SS.stripMode() === 'always' ? 40 * st.k : 0));
    const boxW = st.pw - pad * 2, boxH = st.ph - padTop - padBottom;
    const s = Math.min(boxW / iw, boxH / ih);
    const dw = Math.round(iw * s), dh = Math.round(ih * s);
    const dx = Math.round((st.pw - dw) / 2), dy = Math.round(padTop + (boxH - dh) / 2);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.62)'; g.shadowBlur = 56 * st.k; g.shadowOffsetY = 18 * st.k;
    g.fillStyle = '#141414'; g.fillRect(dx, dy, dw, dh);
    g.restore();
    g.drawImage(src, 0, 0, sw, sh, dx, dy, dw, dh);
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = Math.max(1, st.k);
    g.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1);
    return { canvas: c, mode };
  };

  /* Ken Burns: slow drift that never exposes an edge. */
  C.kbParams = function (mode, st) {
    if (!SS.settings.kenBurns || mode === 'live') return { s0: 1, s1: 1, x0: 0, y0: 0, x1: 0, y1: 0 };
    const amp = mode === 'gallery' ? U.rand(0.02, 0.035) : U.rand(0.05, 0.085);
    const zoomIn = Math.random() < 0.6;
    const a = Math.random() * Math.PI * 2;
    const ex = Math.cos(a) * amp * st.w / 2 * 0.85, ey = Math.sin(a) * amp * st.h / 2 * 0.85;
    return zoomIn ? { s0: 1, s1: 1 + amp, x0: 0, y0: 0, x1: ex, y1: ey } : { s0: 1 + amp, s1: 1, x0: ex, y0: ey, x1: 0, y1: 0 };
  };
  C.kbAt = (kb, p) => ({ s: U.lerp(kb.s0, kb.s1, p), x: U.lerp(kb.x0, kb.x1, p), y: U.lerp(kb.y0, kb.y1, p) });
  C.kbCSS = (kb, p) => { const t = C.kbAt(kb, p); return `translate(${t.x.toFixed(2)}px, ${t.y.toFixed(2)}px) scale(${t.s.toFixed(5)})`; };

  // Flatten a slide (with its current Ken Burns pose) into a fresh canvas for transitions.
  C.snapshot = function (slide, p, st) {
    const c = U.mk(st.pw, st.ph), g = c.getContext('2d', { alpha: false });
    if (!slide) { g.fillStyle = '#000'; g.fillRect(0, 0, st.pw, st.ph); return c; }
    const kb = slide.kb || { s0: 1, s1: 1, x0: 0, y0: 0, x1: 0, y1: 0 };
    const t = C.kbAt(kb, p), k = st.pw / st.w, cx = st.pw / 2, cy = st.ph / 2;
    g.fillStyle = '#000'; g.fillRect(0, 0, st.pw, st.ph);
    g.setTransform(t.s, 0, 0, t.s, cx - t.s * cx + t.x * k, cy - t.s * cy + t.y * k);
    g.drawImage(slide.canvas, 0, 0, st.pw, st.ph);
    return c;
  };
})();
