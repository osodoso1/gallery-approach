/* Transitions — the classic PowerPoint set (Blinds, Checkerboard, Dissolve, Newsflash,
   Wheel, Wedge, Strips, Comb, Random Bars, Box, Cover, Uncover, Split…) plus the
   modern "Exciting" ones (Cube, Fold, Curtains, Airplane, Vortex, Shred, Honeycomb…).

   Every transition receives two flat canvases, A (outgoing) and B (incoming),
   and must paint A on its first synchronous frame so the swap never flickers. */
(function () {
  'use strict';
  const U = SS.u, E = U.ease;
  const FX = (SS.fx = { list: [], byId: {}, running: null, freeze: null });
  const def = (id, name, group, base, run, variants) => { const t = { id, name, group, base, run, variants: variants || null }; FX.list.push(t); FX.byId[id] = t; };
  FX.groups = { subtle: 'Subtle', classic: 'Classic (2003)', exciting: 'Exciting' };
  const SPEED = { slow: 1.55, medium: 1, fast: 0.62 };

  class Ctx {
    constructor(layer, A, B, st, dur, variant) {
      Object.assign(this, { layer, A, B, st, dur, variant, w: st.w, h: st.h, pw: st.pw, ph: st.ph, k: st.pw / st.w });
      this.anims = []; this.tweens = []; this.done = false;
    }
    face(canvas, cls, parent) {
      const d = document.createElement('div');
      d.className = 'fx-face' + (cls ? ' ' + cls : '');
      canvas.className = 'fx-canvas';
      d.appendChild(canvas);
      (parent || this.layer).appendChild(d);
      return d;
    }
    div(cls, parent, style) {
      const d = document.createElement('div'); d.className = cls;
      if (style) Object.assign(d.style, style);
      (parent || this.layer).appendChild(d);
      return d;
    }
    shade(el, kf, opt) { const s = this.div('fx-shade', el); this.anim(s, kf, opt); return s; }
    anim(el, kf, opt = {}) {
      const a = el.animate(kf, { duration: this.dur, easing: 'linear', fill: 'both', ...opt });
      this.anims.push(a);
      if (FX.freeze != null) { a.pause(); a.currentTime = FX.freeze * this.dur; return new Promise(() => {}); }
      return a.finished.then(() => {}, () => {});
    }
    tween(fn, opt = {}) {
      const dur = opt.dur || this.dur, ease = opt.ease || E.linear, delay = opt.delay || 0;
      return new Promise(res => {
        const tw = { done: false, finish: () => { if (tw.done) return; tw.done = true; fn(1, 1); res(); } };
        this.tweens.push(tw);
        if (FX.freeze != null) { const raw = U.clamp((FX.freeze * this.dur - delay) / dur, 0, 1); fn(ease(0), 0); fn(ease(raw), raw); return; }
        const t0 = performance.now() + delay;
        fn(0, 0);
        const frame = now => {
          if (tw.done) return;
          const raw = U.clamp((now - t0) / dur, 0, 1);
          fn(ease(raw), raw);
          if (raw >= 1) { tw.done = true; res(); } else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    }
    // Full-stage 2D canvas painted every frame: draw(g, easedT, rawT)
    paint(draw, opt) {
      const c = U.mk(this.pw, this.ph), g = c.getContext('2d', { alpha: false });
      g.imageSmoothingEnabled = true;
      this.face(c);
      return this.tween((t, raw) => draw(g, t, raw), opt);
    }
    tiles(src, cols, rows, opt = {}) {
      const out = [], { pw, ph } = this;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x0 = Math.round(c * pw / cols), x1 = Math.round((c + 1) * pw / cols);
        const y0 = Math.round(r * ph / rows), y1 = Math.round((r + 1) * ph / rows);
        const cv = U.mk(x1 - x0, y1 - y0);
        cv.getContext('2d').drawImage(src, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
        cv.className = 'fx-canvas';
        const el = document.createElement('div');
        el.className = 'fx-tile' + (opt.cls ? ' ' + opt.cls : '');
        Object.assign(el.style, { left: (c * 100 / cols) + '%', top: (r * 100 / rows) + '%', width: `calc(${100 / cols}% + 0.6px)`, height: `calc(${100 / rows}% + 0.6px)` });
        el.appendChild(cv);
        (opt.parent || this.layer).appendChild(el);
        out.push({ el, c, r, cx: (c + 0.5) / cols, cy: (r + 0.5) / rows, x0, y0, x1, y1 });
      }
      return out;
    }
    region(src, x0, y0, x1, y1) {
      const cv = U.mk(x1 - x0, y1 - y0);
      cv.getContext('2d').drawImage(src, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
      cv.className = 'fx-canvas';
      return cv;
    }
    finish() {
      this.done = true;
      this.anims.forEach(a => { try { a.finish(); } catch (e) { /* ignore */ } });
      this.tweens.forEach(t => t.finish());
    }
  }

  FX.play = function (id, A, B, st, opts = {}) {
    const t = FX.byId[id] || FX.byId.fade;
    const layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.style.perspective = Math.round(st.w * 1.6) + 'px';
    opts.host.appendChild(layer);
    const variant = t.variants ? (opts.variant && t.variants.includes(opts.variant) ? opts.variant : U.pick(t.variants)) : null;
    const speed = opts.speed || SPEED[SS.settings.speed] || 1;
    const ctx = new Ctx(layer, A, B, st, Math.round(t.base * speed), variant);
    FX.running = ctx;
    let p;
    try { p = Promise.resolve(t.run(ctx)); } catch (e) { console.warn('[fx]', id, e); p = Promise.resolve(); }
    return p.catch(e => console.warn('[fx]', id, e)).then(() => { if (FX.running === ctx) FX.running = null; return { layer, id: t.id, name: t.name, variant }; });
  };
  FX.skip = () => { if (FX.running) FX.running.finish(); };
  FX.label = (id, variant) => { const t = FX.byId[id]; return t ? t.name + (variant ? ' · ' + variant.replace(/-/g, ' ') : '') : id; };

  /* helpers */
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], 'up-left': [-1, -1], 'up-right': [1, -1], 'down-left': [-1, 1], 'down-right': [1, 1] };
  const D4 = ['left', 'right', 'up', 'down'], D8 = Object.keys(DIRS);
  function band(g, img, x, y, w, h, alpha, pw, ph) {
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    w = Math.min(w, pw - x); h = Math.min(h, ph - y);
    if (w <= 0 || h <= 0) return;
    g.globalAlpha = alpha; g.drawImage(img, x, y, w, h, x, y, w, h); g.globalAlpha = 1;
  }
  function clipDraw(g, x, buildPath) { g.save(); g.beginPath(); buildPath(); g.clip(); g.drawImage(x.B, 0, 0); g.restore(); }

  /* ═══════════ SUBTLE ═══════════ */
  def('fade', 'Fade', 'subtle', 1500, x => {
    x.face(x.A); const b = x.face(x.B);
    return x.anim(b, [{ opacity: 0 }, { opacity: 1 }], { easing: 'ease-in-out' });
  });

  def('push', 'Push', 'subtle', 1300, x => {
    const [dx, dy] = DIRS[x.variant], e = 'cubic-bezier(.77,0,.18,1)';
    const a = x.face(x.A), b = x.face(x.B);
    return Promise.all([
      x.anim(a, [{ transform: 'translate(0,0)' }, { transform: `translate(${dx * 100}%, ${dy * 100}%)` }], { easing: e }),
      x.anim(b, [{ transform: `translate(${-dx * 100}%, ${-dy * 100}%)` }, { transform: 'translate(0,0)' }], { easing: e }),
    ]);
  }, D4);

  def('wipe', 'Wipe', 'subtle', 1350, x => {
    const v = x.variant, horiz = v === 'left' || v === 'right';
    return x.paint((g, t) => {
      const { pw, ph } = x, L = horiz ? pw : ph, f = L * 0.16, e = -f + t * (L + f), n = 12;
      g.drawImage(x.A, 0, 0);
      const fwd = v === 'right' || v === 'down';
      const at = p => (fwd ? p : L - p);
      // solid part
      if (e > 0) { if (horiz) band(g, x.B, fwd ? 0 : L - e, 0, e, ph, 1, pw, ph); else band(g, x.B, 0, fwd ? 0 : L - e, pw, e, 1, pw, ph); }
      // feathered edge
      for (let i = 0; i < n; i++) {
        const p0 = e + i * f / n, a = 1 - (i + 0.5) / n;
        const s = fwd ? at(p0) : at(p0 + f / n);
        if (horiz) band(g, x.B, s, 0, f / n + 0.5, ph, a, pw, ph); else band(g, x.B, 0, s, pw, f / n + 0.5, a, pw, ph);
      }
    }, { ease: E.inOutQuad });
  }, ['right', 'left', 'down', 'up']);

  def('split', 'Split', 'subtle', 1300, x => x.paint((g, t) => {
    const { pw, ph } = x, v = x.variant;
    g.drawImage(x.A, 0, 0);
    clipDraw(g, x, () => {
      if (v === 'vertical-out') g.rect(pw / 2 * (1 - t), 0, pw * t, ph);
      else if (v === 'horizontal-out') g.rect(0, ph / 2 * (1 - t), pw, ph * t);
      else if (v === 'vertical-in') { g.rect(0, 0, pw / 2 * t, ph); g.rect(pw - pw / 2 * t, 0, pw / 2 * t, ph); }
      else { g.rect(0, 0, pw, ph / 2 * t); g.rect(0, ph - ph / 2 * t, pw, ph / 2 * t); }
    });
  }, { ease: E.inOutCubic }), ['vertical-out', 'horizontal-out', 'vertical-in', 'horizontal-in']);

  def('reveal', 'Reveal', 'subtle', 1800, x => {
    const b = x.face(x.B), a = x.face(x.A);
    return Promise.all([
      x.anim(a, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-9%)', opacity: 0, offset: 0.55 }, { transform: 'translateX(-9%)', opacity: 0 }], { easing: 'ease-in' }),
      x.anim(b, [{ transform: 'translateX(7%)', opacity: 0 }, { transform: 'translateX(7%)', opacity: 0, offset: 0.42 }, { transform: 'translateX(0)', opacity: 1 }], { easing: 'cubic-bezier(.2,.7,.2,1)' }),
    ]);
  });

  def('flash', 'Flash', 'subtle', 1300, x => x.paint((g, t) => {
    const k = 0.34;
    if (t < k) { g.drawImage(x.A, 0, 0); g.fillStyle = `rgba(255,250,240,${E.inQuad(t / k)})`; }
    else { g.drawImage(x.B, 0, 0); g.fillStyle = `rgba(255,250,240,${1 - E.outCubic((t - k) / (1 - k))})`; }
    g.fillRect(0, 0, x.pw, x.ph);
  }));

  def('shape', 'Shape', 'subtle', 1400, x => {
    const [shape, dir] = x.variant.split('-'), out = dir === 'out';
    return x.paint((g, t) => {
      const { pw, ph } = x, cx = pw / 2, cy = ph / 2, p = out ? t : 1 - t;
      g.drawImage(out ? x.A : x.B, 0, 0);
      g.save(); g.beginPath();
      if (shape === 'circle') g.arc(cx, cy, Math.hypot(cx, cy) * p + 0.01, 0, Math.PI * 2);
      else if (shape === 'diamond') { const r = (cx + cy) * p; g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); }
      else { const a = Math.max(pw, ph) * p; g.rect(cx - a, cy - ph * p / 2, 2 * a, ph * p); g.rect(cx - pw * p / 2, cy - a, pw * p, 2 * a); }
      g.clip(); g.drawImage(out ? x.B : x.A, 0, 0); g.restore();
    }, { ease: E.inOutQuad });
  }, ['circle-out', 'circle-in', 'diamond-out', 'diamond-in', 'plus-out', 'plus-in']);

  /* ═══════════ CLASSIC (2003) ═══════════ */
  def('fadeblack', 'Fade Through Black', 'classic', 1900, x => x.paint((g, t) => {
    if (t < 0.5) { g.drawImage(x.A, 0, 0); g.fillStyle = `rgba(0,0,0,${t * 2})`; }
    else { g.drawImage(x.B, 0, 0); g.fillStyle = `rgba(0,0,0,${(1 - t) * 2})`; }
    g.fillRect(0, 0, x.pw, x.ph);
  }, { ease: E.inOutSine }));

  def('cutblack', 'Cut Through Black', 'classic', 1000, x => x.paint((g, t) => {
    if (t < 0.36) g.drawImage(x.A, 0, 0);
    else if (t < 0.64) { g.fillStyle = '#000'; g.fillRect(0, 0, x.pw, x.ph); }
    else g.drawImage(x.B, 0, 0);
  }));

  def('cover', 'Cover', 'classic', 1300, x => {
    const [dx, dy] = DIRS[x.variant];
    x.face(x.A); const b = x.face(x.B, 'shadow');
    return x.anim(b, [{ transform: `translate(${-dx * 100}%, ${-dy * 100}%)` }, { transform: 'translate(0,0)' }], { easing: 'cubic-bezier(.22,.8,.2,1)' });
  }, D8);

  def('uncover', 'Uncover', 'classic', 1300, x => {
    const [dx, dy] = DIRS[x.variant];
    x.face(x.B); const a = x.face(x.A, 'shadow');
    return x.anim(a, [{ transform: 'translate(0,0)' }, { transform: `translate(${dx * 102}%, ${dy * 102}%)` }], { easing: 'cubic-bezier(.6,0,.4,1)' });
  }, D8);

  def('box', 'Box', 'classic', 1250, x => x.paint((g, t) => {
    const { pw, ph } = x;
    if (x.variant === 'out') { g.drawImage(x.A, 0, 0); clipDraw(g, x, () => g.rect(pw / 2 * (1 - t), ph / 2 * (1 - t), pw * t, ph * t)); }
    else {
      g.drawImage(x.B, 0, 0); const s = 1 - t;
      g.save(); g.beginPath(); g.rect(pw / 2 * (1 - s), ph / 2 * (1 - s), pw * s, ph * s); g.clip(); g.drawImage(x.A, 0, 0); g.restore();
    }
  }, { ease: E.inOutQuad }), ['out', 'in']);

  def('wheel', 'Wheel', 'classic', 1600, x => {
    const n = +x.variant;
    return x.paint((g, t) => {
      const { pw, ph } = x, cx = pw / 2, cy = ph / 2, R = Math.hypot(cx, cy) + 2;
      g.drawImage(x.A, 0, 0);
      clipDraw(g, x, () => {
        for (let i = 0; i < n; i++) { const a0 = -Math.PI / 2 + i * 2 * Math.PI / n; g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a0 + t * 2 * Math.PI / n + 0.0001); g.closePath(); }
      });
    }, { ease: E.inOutSine });
  }, ['1', '2', '3', '4', '8']);

  def('wedge', 'Wedge', 'classic', 1450, x => x.paint((g, t) => {
    const { pw, ph } = x, cx = pw / 2, cy = ph / 2, R = Math.hypot(cx, cy) + 2;
    g.drawImage(x.A, 0, 0);
    clipDraw(g, x, () => { g.moveTo(cx, cy); g.arc(cx, cy, R, -Math.PI / 2 - t * Math.PI - 0.0001, -Math.PI / 2 + t * Math.PI + 0.0001); g.closePath(); });
  }, { ease: E.inOutSine }));

  def('checker', 'Checkerboard', 'classic', 1600, x => {
    const across = x.variant === 'across';
    return x.paint((g, t) => {
      const { pw, ph } = x, cols = 10, s = pw / cols, rows = Math.ceil(ph / s);
      g.drawImage(x.A, 0, 0);
      clipDraw(g, x, () => {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const p = U.clamp((t - ((r + c) % 2 ? 0.5 : 0)) / 0.5, 0, 1);
          if (p <= 0) continue;
          if (across) g.rect(c * s, r * s, s * p + 0.6, s + 0.6); else g.rect(c * s, r * s, s + 0.6, s * p + 0.6);
        }
      });
    });
  }, ['across', 'down']);

  function incremental(x, cells, drawCell) {
    const order = U.shuffle(cells.map((_, i) => i));
    let drawn = 0, init = false;
    return x.paint((g, t) => {
      if (!init) { g.drawImage(x.A, 0, 0); init = true; }
      const target = t >= 1 ? cells.length : Math.floor(t * cells.length);
      for (; drawn < target; drawn++) drawCell(g, cells[order[drawn]]);
    });
  }
  def('randombars', 'Random Bars', 'classic', 1500, x => {
    const vert = x.variant === 'vertical', L = vert ? x.pw : x.ph, n = Math.max(40, Math.round(L / (5 * x.k))), sz = L / n;
    const cells = Array.from({ length: n }, (_, i) => i);
    return incremental(x, cells, (g, i) => {
      const a = Math.floor(i * sz), b = Math.ceil((i + 1) * sz);
      if (vert) g.drawImage(x.B, a, 0, b - a, x.ph, a, 0, b - a, x.ph); else g.drawImage(x.B, 0, a, x.pw, b - a, 0, a, x.pw, b - a);
    });
  }, ['horizontal', 'vertical']);

  def('dissolve', 'Dissolve', 'classic', 1600, x => {
    const s = Math.max(6, Math.round(x.pw / 64)), cols = Math.ceil(x.pw / s), rows = Math.ceil(x.ph / s);
    const cells = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c * s, r * s]);
    return incremental(x, cells, (g, [cx, cy]) => {
      const w = Math.min(s, x.pw - cx), h = Math.min(s, x.ph - cy);
      if (w > 0 && h > 0) g.drawImage(x.B, cx, cy, w, h, cx, cy, w, h);
    });
  });

  def('strips', 'Strips', 'classic', 1350, x => x.paint((g, t) => {
    const { pw, ph } = x, v = x.variant, fx = v.includes('left') ? -1 : 1, fy = v.includes('up') ? -1 : 1;
    g.drawImage(x.A, 0, 0);
    g.save();
    g.setTransform(fx, 0, 0, fy, fx < 0 ? pw : 0, fy < 0 ? ph : 0);
    g.beginPath();
    const d = t * (pw + ph) * 1.02;
    g.moveTo(0, 0); g.lineTo(d, 0); g.lineTo(0, d); g.closePath();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clip(); g.drawImage(x.B, 0, 0); g.restore();
  }, { ease: E.inOutQuad }), ['down-right', 'down-left', 'up-right', 'up-left']);

  def('comb', 'Comb', 'classic', 1300, x => {
    const vert = x.variant === 'vertical', n = 12;
    return x.paint((g, t) => {
      const { pw, ph } = x;
      g.drawImage(x.A, 0, 0);
      for (let i = 0; i < n; i++) {
        const dir = i % 2 ? 1 : -1;
        if (!vert) { const y0 = Math.round(i * ph / n), y1 = Math.round((i + 1) * ph / n); g.drawImage(x.B, 0, y0, pw, y1 - y0, dir * pw * (1 - t), y0, pw, y1 - y0); }
        else { const x0 = Math.round(i * pw / n), x1 = Math.round((i + 1) * pw / n); g.drawImage(x.B, x0, 0, x1 - x0, ph, x0, dir * ph * (1 - t), x1 - x0, ph); }
      }
    }, { ease: E.inOutCubic });
  }, ['horizontal', 'vertical']);

  def('blinds', 'Blinds', 'classic', 1350, x => {
    const vert = x.variant === 'vertical', n = 10;
    return x.paint((g, t) => {
      const { pw, ph } = x, L = vert ? pw : ph, bs = L / n;
      g.drawImage(x.A, 0, 0);
      for (let i = 0; i < n; i++) {
        const a = Math.floor(i * bs), len = Math.ceil(bs * t);
        if (len <= 0) continue;
        if (vert) g.drawImage(x.B, a, 0, len, ph, a, 0, len, ph); else g.drawImage(x.B, 0, a, pw, len, 0, a, pw, len);
      }
    }, { ease: E.inOutQuad });
  }, ['horizontal', 'vertical']);

  def('newsflash', 'Newsflash', 'classic', 1600, x => {
    x.face(x.A); const b = x.face(x.B, 'shadow');
    return x.anim(b, [{ transform: 'rotate(-720deg) scale(0.02)', opacity: 0.5 }, { transform: 'rotate(0deg) scale(1)', opacity: 1 }], { easing: 'cubic-bezier(.2,.7,.25,1)' });
  });

  def('zoom', 'Zoom', 'classic', 1450, x => {
    const v = x.variant;
    if (v === 'in') {
      const a = x.face(x.A), b = x.face(x.B);
      return Promise.all([
        x.anim(a, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.3)', opacity: 0 }], { easing: 'ease-in' }),
        x.anim(b, [{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { easing: 'cubic-bezier(.2,.8,.2,1)' }),
      ]);
    }
    if (v === 'out') {
      const b = x.face(x.B), a = x.face(x.A, 'shadow');
      return Promise.all([
        x.anim(b, [{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { easing: 'ease-out' }),
        x.anim(a, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.15)', opacity: 0 }], { easing: 'cubic-bezier(.5,0,.75,0)' }),
      ]);
    }
    const b = x.face(x.B), a = x.face(x.A);
    return Promise.all([
      x.anim(a, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(2.8)', opacity: 0, offset: 0.6 }, { transform: 'scale(2.8)', opacity: 0 }], { easing: 'ease-in' }),
      x.anim(b, [{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(0.4)', opacity: 0, offset: 0.3 }, { transform: 'scale(1)', opacity: 1 }], { easing: 'ease-out' }),
    ]);
  }, ['in', 'out', 'through']);

  /* ═══════════ EXCITING ═══════════ */
  def('ripple', 'Ripple', 'exciting', 1900, x => {
    const ox = U.rand(0.25, 0.75), oy = U.rand(0.3, 0.7);
    return x.paint((g, t) => {
      const { pw, ph } = x, cx = pw * ox, cy = ph * oy;
      const R = Math.max(Math.hypot(cx, cy), Math.hypot(pw - cx, cy), Math.hypot(cx, ph - cy), Math.hypot(pw - cx, ph - cy)) * 1.06;
      const r = t * R, wob = R * 0.014 * (1 - t);
      g.drawImage(x.A, 0, 0);
      clipDraw(g, x, () => {
        const N = 120;
        for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, rr = Math.max(0, r + Math.sin(a * 9 + t * 18) * wob); i ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + rr, cy); }
        g.closePath();
      });
      for (let k = 1; k <= 3; k++) {
        g.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.22 / k})`; g.lineWidth = 3 * x.k;
        g.beginPath(); g.arc(cx, cy, r + k * R * 0.055, 0, Math.PI * 2); g.stroke();
      }
    }, { ease: E.outCubic });
  });

  def('honeycomb', 'Honeycomb', 'exciting', 2300, x => {
    const { pw, ph } = x, size = pw / 13, hw = Math.sqrt(3) * size, vs = 1.5 * size;
    const cells = [];
    for (let r = -1; r * vs < ph + size; r++) for (let c = -1; c * hw < pw + hw; c++) {
      const cx = c * hw + (r % 2 ? hw / 2 : 0), cy = r * vs;
      const d = Math.hypot(cx / pw - 0.5, cy / ph - 0.5);
      cells.push({ cx, cy, d: U.clamp(d * 0.45 + U.rand(0, 0.3), 0, 0.55) });
    }
    const hex = (g, cx, cy, s) => { for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; i ? g.lineTo(cx + s * Math.cos(a), cy + s * Math.sin(a)) : g.moveTo(cx + s * Math.cos(a), cy + s * Math.sin(a)); } g.closePath(); };
    return x.paint((g, t) => {
      g.drawImage(x.A, 0, 0);
      g.save(); g.beginPath();
      for (const c of cells) { const p = U.clamp((t - c.d) / 0.42, 0, 1); if (p > 0) hex(g, c.cx, c.cy, size * 1.02 * E.outBack(p)); }
      g.clip(); g.drawImage(x.B, 0, 0); g.restore();
      g.lineWidth = 2 * x.k;
      for (const c of cells) {
        const p = U.clamp((t - c.d) / 0.42, 0, 1);
        if (p > 0 && p < 1) { g.strokeStyle = `rgba(255,214,150,${0.55 * (1 - p)})`; g.beginPath(); hex(g, c.cx, c.cy, size * E.outBack(p)); g.stroke(); }
      }
    });
  });

  def('vortex', 'Vortex', 'exciting', 2500, x => {
    const b = x.face(x.B);
    x.anim(b, [{ transform: 'scale(1.12) rotate(-5deg)' }, { transform: 'scale(1) rotate(0deg)' }], { easing: 'ease-out' });
    x.shade(b, [{ opacity: 0.6 }, { opacity: 0 }], { easing: 'ease-out' });
    const tiles = x.tiles(x.A, 10, 6), th = U.pick([1, -1]) * 1.9;
    return Promise.all(tiles.map(tl => {
      const dx = (tl.cx - 0.5) * x.w, dy = (tl.cy - 0.5) * x.h, dist = Math.hypot(tl.cx - 0.5, tl.cy - 0.5);
      const rot = (a, s) => [Math.cos(a) * dx * s - Math.sin(a) * dy * s - dx, Math.sin(a) * dx * s + Math.cos(a) * dy * s - dy];
      const [mx, my] = rot(th / 2, 1.35), [ex, ey] = rot(th, 2.4);
      return x.anim(tl.el, [
        { transform: 'translate(0px,0px) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${mx}px,${my}px) rotate(${th * 40}deg) scale(.75)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${ex}px,${ey}px) rotate(${th * 90}deg) scale(.25)`, opacity: 0 },
      ], { duration: x.dur * 0.62, delay: (0.72 - dist) * 0.5 * x.dur, easing: 'cubic-bezier(.5,0,.85,.45)' });
    }));
  });

  def('shred', 'Shred', 'exciting', 2000, x => {
    x.face(x.B);
    const strips = x.tiles(x.A, 18, 1);
    return Promise.all(strips.map((s, i) => x.anim(s.el, [
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: `translateY(${i % 2 ? 112 : -112}%) rotate(${U.rand(-5, 5)}deg)` },
    ], { duration: x.dur * 0.62, delay: U.rand(0, 0.36) * x.dur, easing: 'cubic-bezier(.55,0,.8,.3)' })));
  });

  def('shatter', 'Shatter', 'exciting', 2300, x => {
    const b = x.face(x.B);
    x.anim(b, [{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { easing: 'ease-out' });
    const tiles = x.tiles(x.A, 9, 5);
    return Promise.all(tiles.map(tl => {
      const dx = tl.cx - 0.5, dy = tl.cy - 0.5;
      return x.anim(tl.el, [
        { transform: 'translate3d(0,0,0) rotateX(0deg) rotateY(0deg) rotateZ(0deg)', opacity: 1 },
        { transform: `translate3d(${dx * U.rand(80, 180)}%, ${dy * U.rand(80, 180) + U.rand(60, 140)}%, ${U.rand(120, 420)}px) rotateX(${U.rand(-140, 140)}deg) rotateY(${U.rand(-140, 140)}deg) rotateZ(${U.rand(-70, 70)}deg)`, opacity: 0 },
      ], { duration: x.dur * 0.68, delay: (Math.hypot(dx, dy) * 0.32 + U.rand(0, 0.08)) * x.dur, easing: 'cubic-bezier(.4,0,.9,.6)' });
    }));
  });

  def('wind', 'Wind', 'exciting', 2300, x => {
    x.face(x.B);
    const tiles = x.tiles(x.A, 12, 7);
    return Promise.all(tiles.map(tl => x.anim(tl.el, [
      { transform: 'translate(0%,0%) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${U.rand(-50, -15)}%, ${U.rand(-70, -20)}%) rotate(${U.rand(-35, 35)}deg) scale(1)`, opacity: 1, offset: 0.22 },
      { transform: `translate(${U.rand(-1100, -700)}%, ${U.rand(-320, 60)}%) rotate(${U.rand(-240, 240)}deg) scale(.55)`, opacity: 0 },
    ], { duration: x.dur * 0.5, delay: ((1 - tl.cx) * 0.46 + U.rand(0, 0.06)) * x.dur, easing: 'cubic-bezier(.5,0,.9,.5)' })));
  });

  def('flip', 'Flip', 'exciting', 1550, x => {
    const ax = x.variant === 'up' || x.variant === 'down' ? 'X' : 'Y';
    const sg = x.variant === 'left' || x.variant === 'down' ? -1 : 1;
    const card = x.div('fx-card');
    const fa = x.face(x.A, 'bf', card), fb = x.face(x.B, 'bf', card);
    fb.style.transform = `rotate${ax}(180deg)`;
    x.shade(fa, [{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0.55 }]);
    x.shade(fb, [{ opacity: 0.55 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }]);
    return x.anim(card, [
      { transform: `translateZ(0px) rotate${ax}(0deg)` },
      { transform: `translateZ(${-x.w * 0.38}px) rotate${ax}(${sg * 90}deg)`, offset: 0.5 },
      { transform: `translateZ(0px) rotate${ax}(${sg * 180}deg)` },
    ], { easing: 'cubic-bezier(.45,.05,.55,.95)' });
  }, D4);

  def('cube', 'Cube', 'exciting', 1750, x => {
    const v = x.variant, horiz = v === 'left' || v === 'right', sg = v === 'left' || v === 'up' ? 1 : -1;
    const D = (horiz ? x.w : x.h) / 2, rot = horiz ? 'rotateY' : 'rotateX';
    x.layer.classList.add('fx-wall');
    const box = x.div('fx-card');
    const fa = x.face(x.A, 'bf', box), fb = x.face(x.B, 'bf', box);
    fa.style.transform = `translateZ(${D}px)`;
    fb.style.transform = horiz ? `rotateY(${90 * sg}deg) translateZ(${D}px)` : `rotateX(${-90 * sg}deg) translateZ(${D}px)`;
    x.shade(fa, [{ opacity: 0 }, { opacity: 0.7 }], { easing: 'ease-in' });
    x.shade(fb, [{ opacity: 0.7 }, { opacity: 0 }], { easing: 'ease-out' });
    const end = horiz ? -90 * sg : 90 * sg;
    return x.anim(box, [
      { transform: `translateZ(${-D}px) ${rot}(0deg)` },
      { transform: `translateZ(${-D * 1.45}px) ${rot}(${end / 2}deg)`, offset: 0.5 },
      { transform: `translateZ(${-D}px) ${rot}(${end}deg)` },
    ], { easing: 'cubic-bezier(.5,0,.5,1)' });
  }, D4);

  def('doors', 'Doors', 'exciting', 1850, x => {
    const vert = x.variant === 'vertical';
    const b = x.face(x.B);
    x.anim(b, [{ transform: 'scale(.82)' }, { transform: 'scale(1)' }], { easing: 'cubic-bezier(.3,0,.2,1)' });
    x.shade(b, [{ opacity: 0.75 }, { opacity: 0 }]);
    const [h1, h2] = vert ? x.tiles(x.A, 2, 1, { cls: 'bf' }) : x.tiles(x.A, 1, 2, { cls: 'bf' });
    h1.el.style.transformOrigin = vert ? 'left center' : 'center top';
    h2.el.style.transformOrigin = vert ? 'right center' : 'center bottom';
    [h1, h2].forEach(h => x.shade(h.el, [{ opacity: 0 }, { opacity: 0.6 }]));
    const r = vert ? 'rotateY' : 'rotateX', e = 'cubic-bezier(.55,0,.35,1)';
    return Promise.all([
      x.anim(h1.el, [{ transform: `${r}(0deg)`, opacity: 1 }, { transform: `${r}(${vert ? -96 : 96}deg)`, opacity: 0.2 }], { easing: e }),
      x.anim(h2.el, [{ transform: `${r}(0deg)`, opacity: 1 }, { transform: `${r}(${vert ? 96 : -96}deg)`, opacity: 0.2 }], { easing: e }),
    ]);
  }, ['vertical', 'horizontal']);

  def('gallery', 'Gallery', 'exciting', 2100, x => {
    const d = x.variant === 'left' ? 1 : -1, Z = Math.round(x.w * 0.55), e = 'cubic-bezier(.6,0,.35,1)';
    x.layer.classList.add('fx-wall');
    const room = x.div('fx-card');
    const a = x.face(x.A, 'shadow', room), b = x.face(x.B, 'shadow', room);
    return Promise.all([
      x.anim(a, [
        { transform: 'translateX(0%) translateZ(0px) rotateY(0deg)' },
        { transform: `translateX(${-d * 6}%) translateZ(${-Z}px) rotateY(${d * 22}deg)`, offset: 0.33 },
        { transform: `translateX(${-d * 120}%) translateZ(${-Z}px) rotateY(${d * 22}deg)` },
      ], { easing: e }),
      x.anim(b, [
        { transform: `translateX(${d * 120}%) translateZ(${-Z}px) rotateY(${-d * 22}deg)` },
        { transform: `translateX(${d * 6}%) translateZ(${-Z}px) rotateY(${-d * 22}deg)`, offset: 0.67 },
        { transform: 'translateX(0%) translateZ(0px) rotateY(0deg)' },
      ], { easing: e }),
    ]);
  }, ['left', 'right']);

  def('ferris', 'Ferris Wheel', 'exciting', 1900, x => {
    const s = x.variant === 'left' ? 1 : -1, e = 'cubic-bezier(.62,0,.3,1)';
    const a = x.face(x.A, 'shadow'), b = x.face(x.B, 'shadow');
    a.style.transformOrigin = b.style.transformOrigin = '50% 240%';
    return Promise.all([
      x.anim(a, [{ transform: 'rotate(0deg)', opacity: 1 }, { transform: `rotate(${-s * 58}deg)`, opacity: 0.4 }], { easing: e }),
      x.anim(b, [{ transform: `rotate(${s * 58}deg)`, opacity: 0.4 }, { transform: 'rotate(0deg)', opacity: 1 }], { easing: e }),
    ]);
  }, ['left', 'right']);

  def('switch', 'Switch', 'exciting', 1850, x => {
    const s = x.variant === 'left' ? 1 : -1, Z = Math.round(x.w * 0.5), e = 'cubic-bezier(.45,0,.55,1)';
    x.layer.classList.add('fx-wall');
    const room = x.div('fx-card');
    const a = x.face(x.A, 'shadow', room), b = x.face(x.B, 'shadow', room);
    return Promise.all([
      x.anim(a, [
        { transform: 'translateX(0%) translateZ(0px) rotateY(0deg)', opacity: 1 },
        { transform: `translateX(${-s * 58}%) translateZ(${-Z}px) rotateY(${s * 32}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translateX(0%) translateZ(${-Z * 2.2}px) rotateY(0deg)`, opacity: 0 },
      ], { easing: e }),
      x.anim(b, [
        { transform: `translateX(0%) translateZ(${-Z * 2.2}px) rotateY(0deg)`, opacity: 0 },
        { transform: `translateX(${s * 58}%) translateZ(${-Z}px) rotateY(${-s * 32}deg)`, opacity: 1, offset: 0.5 },
        { transform: 'translateX(0%) translateZ(0px) rotateY(0deg)', opacity: 1 },
      ], { easing: e }),
    ]);
  }, ['left', 'right']);

  // Accordion fold: strips hinge alternately and collapse toward one edge.
  def('fold', 'Fold', 'exciting', 2100, x => {
    const n = 6, left = x.variant === 'left', sw = x.w / n;
    const b = x.face(x.B);
    x.anim(b, [{ transform: 'scale(.93)' }, { transform: 'scale(1)' }], { easing: 'ease-out' });
    x.shade(b, [{ opacity: 0.6 }, { opacity: 0 }]);
    const strips = x.tiles(x.A, n, 1);
    strips.forEach(s => {
      s.el.style.left = '0px'; s.el.style.width = (sw + 0.8) + 'px';
      s.el.style.transformOrigin = left ? '0 50%' : '100% 50%';
      s.sh = x.div('fx-shade', s.el);
    });
    return x.tween(t => {
      const th = t * 89 * Math.PI / 180, cw = sw * Math.cos(th), depth = sw * Math.sin(th);
      const fade = 1 - U.clamp((t - 0.82) / 0.18, 0, 1);
      strips.forEach((s, i) => {
        const idx = left ? i : n - 1 - i, even = idx % 2 === 0;
        const z = even ? 0 : -depth;
        const tx = left ? idx * cw : x.w - idx * cw - sw;
        const ang = (left ? 1 : -1) * (even ? th : -th) * 180 / Math.PI;
        s.el.style.transform = `translateX(${tx}px) translateZ(${z}px) rotateY(${ang}deg)`;
        s.el.style.opacity = fade;
        s.sh.style.opacity = (even ? 0.12 : 0.55) * Math.sin(th);
      });
    }, { ease: E.inOutCubic });
  }, ['left', 'right']);

  // The slide folds into a paper airplane and takes off. (Fitting, near SFO.)
  def('airplane', 'Airplane', 'exciting', 2700, x => {
    const b = x.face(x.B);
    x.shade(b, [{ opacity: 0.6 }, { opacity: 0.6, offset: 0.35 }, { opacity: 0 }]);
    const plane = x.div('fx-card');
    const [l, r] = x.tiles(x.A, 2, 1, { parent: plane, cls: 'shadow' });
    l.el.style.transformOrigin = 'right center'; r.el.style.transformOrigin = 'left center';
    [l, r].forEach(h => x.shade(h.el, [{ opacity: 0 }, { opacity: 0.45, offset: 0.34 }, { opacity: 0.45 }]));
    x.anim(l.el, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-72deg)', offset: 0.34 }, { transform: 'rotateY(-72deg)' }], { easing: 'ease-in-out' });
    x.anim(r.el, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(72deg)', offset: 0.34 }, { transform: 'rotateY(72deg)' }], { easing: 'ease-in-out' });
    return x.anim(plane, [
      { transform: 'translate(0%,0%) scale(1) rotateX(0deg) rotateZ(0deg)', opacity: 1 },
      { transform: 'translate(0%,2%) scale(.5) rotateX(14deg) rotateZ(0deg)', opacity: 1, offset: 0.32 },
      { transform: 'translate(-4%,5%) scale(.46) rotateX(14deg) rotateZ(-10deg)', opacity: 1, offset: 0.42, easing: 'cubic-bezier(.5,0,.75,.35)' },
      { transform: 'translate(90%,-110%) scale(.06) rotateX(14deg) rotateZ(-34deg)', opacity: 0 },
    ]);
  });

  let curtainCache = null;
  function velvet(w, h) {
    if (curtainCache && curtainCache.width === w && curtainCache.height === h) return curtainCache;
    const c = U.mk(w, h), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, w, 0), folds = 7;
    for (let i = 0; i <= 64; i++) {
      const t = i / 64, s = 0.5 + 0.5 * Math.sin(t * folds * Math.PI * 2) * 0.85 + 0.5 * Math.sin(t * folds * 6.1) * 0.15;
      gr.addColorStop(t, `rgb(${Math.round(60 + 120 * s)},${Math.round(6 + 18 * s)},${Math.round(14 + 20 * s)})`);
    }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const vg = g.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, 'rgba(0,0,0,.35)'); vg.addColorStop(0.18, 'rgba(0,0,0,0)'); vg.addColorStop(0.85, 'rgba(0,0,0,.1)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c79a3b'; g.fillRect(w - Math.max(2, w / 160), 0, Math.max(2, w / 160), h);
    SS.gen.grain(g, w, h, 0.08);
    curtainCache = c;
    return c;
  }
  def('curtains', 'Curtains', 'exciting', 3400, x => {
    x.face(x.B); const a = x.face(x.A);
    x.anim(a, [{ opacity: 1 }, { opacity: 1, offset: 0.49 }, { opacity: 0, offset: 0.51 }, { opacity: 0 }]);
    const tex = velvet(Math.round(x.pw / 2) + 2, x.ph);
    const mk = side => {
      const d = x.div('fx-curtain', null, { [side]: '0px' });
      const c = U.mk(tex.width, tex.height); c.getContext('2d').drawImage(tex, 0, 0);
      if (side === 'right') c.style.transform = 'scaleX(-1)';
      d.appendChild(c); d.style.transformOrigin = side + ' center';
      return d;
    };
    const L = mk('left'), R = mk('right');
    const kf = s => [
      { transform: `translateX(${s * 101}%) scaleX(1)`, opacity: 1, easing: 'cubic-bezier(.45,0,.3,1)' },
      { transform: 'translateX(0%) scaleX(1)', opacity: 1, offset: 0.42 },
      { transform: 'translateX(0%) scaleX(1)', opacity: 1, offset: 0.58, easing: 'cubic-bezier(.6,0,.3,1)' },
      { transform: 'translateX(0%) scaleX(.07)', opacity: 1, offset: 0.93 },
      { transform: `translateX(${s * 30}%) scaleX(.07)`, opacity: 0 },
    ];
    return Promise.all([x.anim(L, kf(-1)), x.anim(R, kf(1))]);
  });

  def('pageturn', 'Page Turn', 'exciting', 2000, x => {
    x.face(x.B);
    const page = x.div('fx-card');
    page.style.transformOrigin = '0% 50%';
    const front = x.face(x.A, 'bf', page);
    const back = x.div('fx-face bf fx-paper', page, { transform: 'rotateY(180deg)' });
    const ghost = x.region(x.A, 0, 0, x.pw, x.ph); ghost.style.opacity = '0.12'; ghost.style.transform = 'scaleX(-1)'; back.appendChild(ghost);
    x.shade(front, [{ opacity: 0 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0.5 }]);
    return x.anim(page, [{ transform: 'translateZ(0px) rotateY(0deg)' }, { transform: `translateZ(${-x.w * 0.25}px) rotateY(-90deg)`, offset: 0.5 }, { transform: 'translateZ(0px) rotateY(-180deg)' }], { easing: 'cubic-bezier(.55,.05,.45,.95)' });
  });

  def('venetian', 'Blinds 3D', 'exciting', 1950, x => {
    const vert = x.variant === 'vertical', n = 9, ax = vert ? 'Y' : 'X';
    const ps = [];
    for (let i = 0; i < n; i++) {
      const a0 = Math.round(i * (vert ? x.pw : x.ph) / n), a1 = Math.round((i + 1) * (vert ? x.pw : x.ph) / n);
      const pos = vert ? { left: (i * 100 / n) + '%', top: '0', width: `calc(${100 / n}% + 0.6px)`, height: '100%' } : { left: '0', top: (i * 100 / n) + '%', width: '100%', height: `calc(${100 / n}% + 0.6px)` };
      const slat = x.div('fx-slat', null, pos);
      const f = x.div('bf', slat), bk = x.div('bf', slat, { transform: `rotate${ax}(180deg)` });
      f.appendChild(vert ? x.region(x.A, a0, 0, a1, x.ph) : x.region(x.A, 0, a0, x.pw, a1));
      bk.appendChild(vert ? x.region(x.B, a0, 0, a1, x.ph) : x.region(x.B, 0, a0, x.pw, a1));
      x.shade(f, [{ opacity: 0 }, { opacity: 0.6 }], { duration: x.dur * 0.55, delay: i * x.dur * 0.045 });
      x.shade(bk, [{ opacity: 0.6 }, { opacity: 0 }], { duration: x.dur * 0.55, delay: i * x.dur * 0.045 + x.dur * 0.2 });
      ps.push(x.anim(slat, [
        { transform: `translateZ(0px) rotate${ax}(0deg)` },
        { transform: `translateZ(${x.w * 0.03}px) rotate${ax}(90deg)`, offset: 0.5 },
        { transform: `translateZ(0px) rotate${ax}(180deg)` },
      ], { duration: x.dur * 0.6, delay: i * x.dur * 0.045, easing: 'cubic-bezier(.5,0,.5,1)' }));
    }
    return Promise.all(ps);
  }, ['horizontal', 'vertical']);

  def('fallover', 'Fall Over', 'exciting', 1650, x => {
    const b = x.face(x.B);
    x.shade(b, [{ opacity: 0.4 }, { opacity: 0 }]);
    const a = x.face(x.A, 'shadow');
    a.style.transformOrigin = '50% 100%';
    x.shade(a, [{ opacity: 0 }, { opacity: 0.75 }], { easing: 'ease-in' });
    return x.anim(a, [{ transform: 'rotateX(0deg)', opacity: 1 }, { transform: 'rotateX(86deg)', opacity: 1, offset: 0.94 }, { transform: 'rotateX(90deg)', opacity: 0 }], { easing: 'cubic-bezier(.6,0,.9,.45)' });
  });

  def('peel', 'Peel Off', 'exciting', 1700, x => {
    x.face(x.B);
    const a = x.face(x.A, 'shadow');
    a.style.transformOrigin = '0% 0%';
    return x.anim(a, [
      { transform: 'rotate(0deg) translate(0%,0%)' },
      { transform: 'rotate(-7deg) translate(-1%,3%)', offset: 0.28 },
      { transform: 'rotate(-24deg) translate(-115%,32%)' },
    ], { easing: 'cubic-bezier(.5,0,.8,.4)' });
  });

  // reorder list into the three groups for menus
  const order = { subtle: 0, classic: 1, exciting: 2 };
  FX.list.sort((a, b) => order[a.group] - order[b.group]);
})();
