/* Slideshow controller: preload → transition → Ken Burns → repeat. */
(function () {
  'use strict';
  const U = SS.u, C = SS.compose;
  const S = (SS.show = { cur: null, nextP: null, playing: true, busy: false, timer: null, hist: [], recentFx: [], lastFx: null, count: 0 });

  async function prepare(item) {
    const st = C.stage();
    const loaded = await C.load(item);
    try {
      const r = C.render(item, loaded, st);
      if (loaded.img) item.shown = { url: loaded.url || '', w: loaded.img.naturalWidth, h: loaded.img.naturalHeight };
      if (loaded.video) item.shown = { url: loaded.url || '', w: loaded.video.videoWidth, h: loaded.video.videoHeight };
      return { item, canvas: r.canvas, mode: r.mode, loaded, st, live: r.live };
    } finally { if (loaded.revoke) setTimeout(loaded.revoke, 2000); }
  }

  async function prepareNext() {
    for (let i = 0; i < 6; i++) {
      const item = (await SS.pool.takeWait(i === 0 && !S.cur ? 9000 : 6000)) || SS.pool.fallback();
      if (!item) break;
      try { return await prepare(item); }
      catch (e) { console.info('[show] skipped', item.key, e.message); SS.pool.markBad(item); }
    }
    const fb = SS.pool.fallback();
    return fb ? prepare(fb) : null; // generative art is off and nothing has loaded yet: keep waiting
  }
  S.prepare = prepare;

  function rerender(sl) {
    const st = C.stage();
    if (sl.canvas.width === st.pw && sl.canvas.height === st.ph) return;
    if (sl.live) { sl.live.resize(st); sl.st = st; return; }
    if (!sl.loaded || (!sl.loaded.img && !sl.loaded.gen)) return;
    const r = C.render(sl.item, sl.loaded, st);
    sl.canvas = r.canvas; sl.mode = r.mode; sl.st = st;
  }

  function mount(sl) {
    const st = C.stage();
    const wrap = U.h('div', { class: 'slide' });
    sl.canvas.className = 'kb';
    wrap.appendChild(sl.canvas);
    U.$('#slides').appendChild(wrap);
    sl.el = wrap;
    sl.kbDur = Math.min(SS.settings.slideSeconds, sl.item.src === 'generative' ? SS.settings.genSeconds || 120 : 1e9) * 1000 + 8000;
    sl.kbAnim = sl.canvas.animate([{ transform: C.kbCSS(sl.kb, 0) }, { transform: C.kbCSS(sl.kb, 1) }], { duration: sl.kbDur, easing: 'linear', fill: 'forwards' });
    if (!S.playing) sl.kbAnim.pause();
    if (sl.live && S.playing) sl.live.start();   // living art keeps drawing while it's on screen
    sl.st = st;
  }
  const kbP = sl => (sl && sl.kbAnim ? U.clamp((sl.kbAnim.currentTime || 0) / sl.kbDur, 0, 1) : 0);

  function enabledFx() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return ['fade'];
    const s = SS.settings, all = SS.fx.list;
    if (s.fxMode === 'custom') { const c = (s.fxCustom || []).filter(id => SS.fx.byId[id]); if (c.length) return c; }
    if (FX_GROUPS[s.fxMode]) return all.filter(t => t.group === s.fxMode).map(t => t.id);
    return all.map(t => t.id);
  }
  const FX_GROUPS = { subtle: 1, classic: 1, exciting: 1 };
  S.enabledFx = enabledFx;
  function pickFx() {
    const ids = enabledFx();
    const fresh = ids.filter(id => !S.recentFx.includes(id));
    const id = U.pick(fresh.length ? fresh : ids);
    S.recentFx.push(id);
    while (S.recentFx.length > Math.min(6, Math.max(0, ids.length - 1))) S.recentFx.shift();
    return id;
  }

  S.advance = async function (opts = {}) {
    if (S.busy) { SS.fx.skip(); return; }
    if (SS.ui && SS.ui.gameOpen) return;
    S.busy = true;
    clearTimeout(S.timer);
    let ok = false;
    try {
      let nx = opts.slide;
      if (!nx) { nx = await (S.nextP || prepareNext()).catch(() => null); S.nextP = null; }
      if (!nx) { S.busy = false; if (!S.cur && !S.waitToast) { S.waitToast = true; U.toast('Waiting for art to load…'); } schedule(8000); return; }
      rerender(nx);
      const st = C.stage();
      nx.kb = C.kbParams(nx.mode, st);
      const fxId = opts.fx || (S.cur ? pickFx() : 'fade');
      const A = C.snapshot(S.cur, kbP(S.cur), st);
      const B = C.snapshot(nx, 0, st);
      SS.ui && SS.ui.caption.hide();
      const from = typeof opts.from === 'function' ? opts.from() : opts.from;
      if (S.cur && S.cur.el) S.cur.el.style.transform = '';      // the transition layer takes over from a dragged picture
      const playing = SS.fx.play(fxId, A, B, st, { host: U.$('#fx'), variant: opts.variant, speed: S.cur ? null : 1.4, from });
      // The transition layer now covers the stage, so the old slide can go.
      const old = S.cur;
      if (old) { old.kbAnim && old.kbAnim.cancel(); old.el && old.el.remove(); old.live && (old.live.stop(), old.live.dispose && old.live.dispose()); }
      const res = await playing;
      mount(nx);
      res.layer.remove();
      if (old && !S.hist.includes(old)) { /* free memory */ old.canvas = null; }
      S.cur = nx; S.count++;
      S.lastFx = res;
      if (!opts.fromHistory) { S.hist.push(nx.item); if (S.hist.length > 30) S.hist.shift(); S.histIdx = S.hist.length - 1; }
      SS.pool.markShown(nx.item);
      SS.ui && SS.ui.caption.show(nx.item);
      SS.emit('slide', { item: nx.item, fx: res });
      ok = true;
    } catch (e) {
      console.warn('[show] advance failed', e);
    } finally {
      S.busy = false;
    }
    if (!S.nextP) S.nextP = prepareNext();
    schedule(ok ? null : 3000);
  };

  S.canGoBack = () => S.hist.length >= 2 && (S.histIdx ?? S.hist.length - 1) > 0;
  S.prev = async function (opts = {}) {
    if (S.busy) return false;
    if (!S.canGoBack()) { U.toast('That\'s the first picture so far'); return false; }
    const idx = (S.histIdx ?? S.hist.length - 1) - 1;
    S.histIdx = idx;
    try {
      const sl = await prepare(S.hist[idx]);
      await S.advance({ slide: sl, fx: opts.fx || 'push', variant: 'right', fromHistory: true, from: opts.from });
      return true;
    } catch (e) { U.toast("Couldn't reload that one"); return false; }
  };

  /* ── Swipe: drag the picture; let go past the line (or flick) and it goes. Left = next, right = back. ── */
  const easeBack = (el, f) => { if (!el) return; el.style.transform = ''; if (f) el.animate([{ transform: `translateX(${f * 100}%)` }, { transform: 'translateX(0)' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' }); };
  S.drag = f => { const el = S.cur && S.cur.el; if (el && !S.busy) el.style.transform = `translateX(${f * 100}%)`; };
  S.snapBack = f => easeBack(S.cur && S.cur.el, f);
  S.swipe = async function (dir, f) {
    const el = S.cur && S.cur.el;
    if (S.busy) { SS.fx.skip(); for (let i = 0; i < 20 && S.busy; i++) await U.sleep(50); }
    if (dir === 'prev' && !S.canGoBack()) { easeBack(el, f); U.toast('That\'s the first picture so far'); return; }
    // if the next picture isn't ready yet, slide this one back rather than leave it hanging
    let held = f;
    const t = setTimeout(() => { held = 0; easeBack(el, f); }, 450);
    try {
      if (dir === 'next') await S.advance({ fx: 'swipe', variant: 'left', from: () => held });
      else await S.prev({ fx: 'swipe', from: () => held });
    } finally { clearTimeout(t); if (S.cur && S.cur.el === el) easeBack(el, held); }
  };

  // How long the current picture stays. Generative pieces are a treat, so they're capped (2 min by default).
  S.dwell = () => {
    const sec = SS.settings.slideSeconds;
    const it = S.cur && S.cur.item;
    if (it && it.src === 'living') return (SS.settings.liveSeconds || 180) * 1000;
    if (it && it.kind === 'motion') return Math.min(SS.settings.liveSeconds || 180, 120) * 1000;   // videos: up to 2 minutes
    return (it && it.src === 'generative' ? Math.min(sec, SS.settings.genSeconds || 120) : sec) * 1000;
  };
  function schedule(ms) {
    clearTimeout(S.timer);
    if (!S.playing || (SS.ui && SS.ui.gameOpen)) return;
    S.nextAt = Date.now() + (ms || S.dwell());
    S.timer = setTimeout(() => S.advance(), ms || S.dwell());
    SS.emit('schedule');
  }
  S.schedule = schedule;

  S.pause = function () {
    S.playing = false; clearTimeout(S.timer);
    S.cur && S.cur.kbAnim && S.cur.kbAnim.pause();
    S.cur && S.cur.live && S.cur.live.stop();
    document.body.classList.add('paused');
    SS.emit('play', false);
  };
  S.resume = function () {
    S.playing = true;
    S.cur && S.cur.kbAnim && S.cur.kbAnim.play();
    S.cur && S.cur.live && S.cur.live.start();
    document.body.classList.remove('paused');
    schedule();
    SS.emit('play', true);
  };
  S.toggle = () => (S.playing ? S.pause() : S.resume());

  S.preview = function (fxId, variant) {
    if (S.busy) SS.fx.skip();
    setTimeout(() => S.advance({ fx: fxId, variant }), S.busy ? 60 : 0);
  };

  // Re-render for a new size/orientation (iPad rotation, window resize).
  const onResize = U.debounce(() => {
    if (!S.cur || S.busy) return;
    const st = C.stage();
    if (S.cur.canvas && S.cur.canvas.width === st.pw && S.cur.canvas.height === st.ph) return;
    const p = kbP(S.cur);
    rerender(S.cur);
    S.cur.kb = C.kbParams(S.cur.mode, st);
    S.cur.el.innerHTML = ''; S.cur.canvas.className = 'kb'; S.cur.el.appendChild(S.cur.canvas);
    S.cur.kbAnim = S.cur.canvas.animate([{ transform: C.kbCSS(S.cur.kb, p) }, { transform: C.kbCSS(S.cur.kb, 1) }], { duration: S.cur.kbDur * (1 - p) + 1, easing: 'linear', fill: 'forwards' });
    S.cur.kbDur = S.cur.kbDur * (1 - p) + 1;
    S.nextP = null; // next one will be re-prepared at the new size
  }, 400);
  addEventListener('resize', onResize);

  S.start = async function () {
    S.nextP = prepareNext();
    try { await S.nextP; } catch (e) { S.nextP = null; }
    SS.emit('ready');
    await S.advance();
  };

  /* Debug hook used for visual tests: freeze a transition at time t. */
  SS.debug = {
    async frame(fxId, variant, t) {
      SS.debug.clear();
      SS.fx.freeze = t;
      const st = C.stage();
      const A = C.snapshot(S.cur, 0, st);
      const B = C.snapshot({ canvas: (await prepare(SS.gen.make(U.pick(['bauhaus', 'dusk'])))).canvas, kb: null }, 0, st);
      SS.debug.res = SS.fx.play(fxId, A, B, st, { host: U.$('#fx'), variant, speed: 1 });
      return SS.fx.label(fxId, variant);
    },
    clear() {
      SS.fx.freeze = null;
      if (SS.fx.running) { SS.fx.running.finish(); SS.fx.running = null; }
      U.$$('#fx .fx-layer').forEach(el => el.remove());
    },
  };
})();
