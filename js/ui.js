/* UI glue: HUD, captions, clock, gestures, keyboard, wake lock, night dim, burn-in. */
(function () {
  'use strict';
  const U = SS.u, h = U.h;
  const UI = (SS.ui = { gameOpen: false });

  /* ── Awake (controls showing) and calm (only the art and the clock) ──
     Any touch, click, key or mouse move wakes things up. After a few seconds the control
     bar slides away; after SS.settings.calm seconds the weather, chips, caption and flight tab
     fade too, so the art has the screen to itself. */
  let idleT = null, calmT = null, lastPtr = 'mouse', lastPoke = Date.now();
  const hudHeld = () => lastPtr === 'mouse' && U.$('#hud:hover'); // iOS keeps :hover stuck after a tap, so only trust it for a mouse
  UI.wakeUp = function () {
    document.body.classList.add('awake');
    clearTimeout(idleT);
    const hide = () => { if (hudHeld()) idleT = setTimeout(hide, 2000); else document.body.classList.remove('awake'); };
    idleT = setTimeout(hide, 3800);
    UI.unCalm();
  };
  const busy = () => SS.settingsUI.isOpen || (SS.radar && SS.radar.bigOpen) || UI.gameOpen || document.body.classList.contains('panel-open')
    || (document.activeElement && document.activeElement.matches && document.activeElement.matches('input, textarea, select'));
  UI.isCalm = () => document.body.classList.contains('calm');
  UI.unCalm = function () {
    lastPoke = Date.now();
    document.body.classList.remove('calm');
    clearTimeout(calmT);
    if (SS.settings.calm > 0) calmT = setTimeout(goCalm, SS.settings.calm * 1000);
  };
  function goCalm() {
    const cardOpen = (SS.radar && SS.radar.cardOpen) || UI.info.isOpen || UI.timer.isOpen || UI.genres.isOpen || UI.view.isOpen || (SS.env2 && SS.env2.openDay);
    if (busy() || (cardOpen && Date.now() - lastPoke < 60000)) { calmT = setTimeout(goCalm, 5000); return; }
    document.body.classList.add('calm');
    SS.radar && (SS.radar.closeCard(), SS.radar.tuck());
    UI.info.close(); UI.timer.close(); UI.genres.close(); UI.view.close();
    SS.emit('calm', true);
  }
  UI.calmNow = () => { clearTimeout(calmT); clearTimeout(idleT); document.body.classList.remove('awake'); goCalm(); };

  /* ── Tap the art: everything goes, leaving only the art. Tap again: everything comes back. ── */
  const B = document.body;
  UI.isArtOnly = () => B.classList.contains('art-only');
  UI.isClockOnly = () => B.classList.contains('clock-only');
  const hideRest = () => {
    clearTimeout(calmT); clearTimeout(idleT);
    B.classList.remove('awake', 'calm', 'art-only', 'clock-only');
    SS.radar && (SS.radar.closeCard(), SS.radar.tuck());
    UI.info.close(); UI.timer.close(); UI.genres.close(); UI.view.close();
  };
  UI.artOnly = function () { hideRest(); B.classList.add('art-only'); };
  // Just the time and date over the art: everything else (weather, chips, caption, flight tab, controls) goes.
  UI.clockOnly = function () { hideRest(); B.classList.add('clock-only'); UI.tickClock(); };
  UI.showAll = function () { const was = UI.isClockOnly(); B.classList.remove('art-only', 'clock-only'); if (was) UI.tickClock(); UI.wakeUp(); };
  // A tap on the art: anything hidden → show it all; everything showing → art only, or the clock and date
  // (⚙ → Display → Tapping the art). "Both in turn" goes everything → clock & date → art only → everything.
  UI.toggleArt = () => {
    const m = SS.settings.tapView || 'art';
    if (UI.isClockOnly()) return m === 'cycle' ? UI.artOnly() : UI.showAll();
    if (UI.isArtOnly() || UI.isCalm()) return UI.showAll();
    return m === 'art' ? UI.artOnly() : UI.clockOnly();
  };

  // Double-tap anywhere that isn't a button (the art, the open weather panel, the caption…): everything goes.
  const NO_DBL = 'button, a, input, select, textarea, label, .wx-chips, .clk-next, #sheet, #panel, #radarBig, #game, #flightCard, #infoCard, #timerPop, #genrePop, #viewPop, #hud, #panelTab, #stripTab, #flightStrip';
  let lastUp = { t: 0, x: 0, y: 0 };
  UI.resetDbl = () => { lastUp.t = 0; };
  addEventListener('pointerup', e => {
    if (!e.isPrimary || UI.gameOpen) return;
    if (e.target.closest && e.target.closest(NO_DBL)) { lastUp.t = 0; return; }
    const now = Date.now();
    if (now - lastUp.t < 380 && Math.hypot(e.clientX - lastUp.x, e.clientY - lastUp.y) < 45) { lastUp.t = 0; UI.dblAt = now; UI.artOnly(); return; }
    lastUp = { t: now, x: e.clientX, y: e.clientY };
  }, true);

  ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(ev => addEventListener(ev, e => {
    if (e.pointerType) lastPtr = e.pointerType;
    if (ev === 'pointermove' && e.pointerType !== 'mouse') return;
    if (ev === 'pointerdown' && e.target.closest && e.target.closest('#stage')) return; // a tap on the art is handled below
    if ((UI.isArtOnly() || UI.isClockOnly()) && ev !== 'pointerdown') return; // in art-only or clock-only, only a tap brings things back
    UI.wakeUp();
  }, { passive: true }));

  /* ── HUD ── */
  function initHud() {
    U.$('#hud').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      ({
        prev: () => SS.show.prev(), next: () => SS.show.advance(), play: () => SS.show.toggle(),
        fx: () => SS.settingsUI.open('fx'), photos: () => SS.settingsUI.open('photos'), panel: () => SS.planner.toggle(),
        radar: () => SS.radar.openBig(), settings: () => SS.settingsUI.open(), full: () => UI.fullscreen(),
        info: () => UI.info.toggle(), timer: () => UI.timer.toggle(), clock: () => UI.view.toggle(), genres: () => UI.genres.toggle(), weather: () => SS.wxscreen.toggle(),
      }[b.dataset.act] || (() => {}))();
    });
    U.$('#panelTab').addEventListener('click', () => SS.planner.open());
    SS.on('slide', ({ fx }) => {
      const lab = U.$('#hudLabel');
      lab.textContent = SS.settings.fxLabel && fx ? '↻ ' + SS.fx.label(fx.id, fx.variant) : '';
    });
    // Shuffle moved on to a new genre: say which, briefly.
    SS.on('slide', ({ item }) => { if (item && item.runStart && SS.genreById[item.runStart]) U.toast(h('span', { class: 'toast-shuf' }, U.icon('shuffle'), 'Shuffle · ' + SS.genreById[item.runStart].name), 2600); if (UI.genres.isOpen) UI.genres.refresh(); });
  }

  /* ── Caption ── */
  const cap = (UI.caption = {});
  let capItem = null, peekT = null;
  // A new picture always says where it came from for a few seconds, even when everything else has faded.
  const peek = () => {
    const el = U.$('#caption'); el.classList.add('peek'); document.body.classList.add('cap-peek');
    clearTimeout(peekT);
    peekT = setTimeout(() => { el.classList.remove('peek'); document.body.classList.remove('cap-peek'); }, Math.max(8, Math.min(SS.settings.calm || 15, 15)) * 1000);
  };
  cap.hide = () => U.$('#caption').classList.remove('on');
  cap.refresh = () => capItem && cap.show(capItem);
  cap.show = function (item) {
    capItem = item;
    const el = U.$('#caption'), mode = SS.settings.caption;
    if (UI.info.isOpen) UI.info.open(item);
    if (mode === 'off' || !item) { el.classList.remove('on'); el.innerHTML = ''; return; }
    const p = item.src === 'personal' ? SS.providers.personal : SS.providers[item.src] || {};
    el.className = mode === 'minimal' ? 'minimal' : '';
    el.innerHTML = '';
    const meta = [item.creator, item.date].filter(Boolean).map(String).filter((v, i, a) => a.indexOf(v) === i).join(' · ');
    el.append(
      h('div', { class: 'cap-src' }, h('span', { class: 'cap-dot', style: { '--c': p.color || '#fff' } }), h('span', { class: 'cap-name' }, p.name || item.src), item.license ? h('span', { class: 'cap-lic' }, '· ' + U.truncate(item.license, 48)) : ''),
      h('div', { class: 'cap-title' + (item.kind === 'art' ? '' : ' upright') }, U.truncate(U.text(item.title) || 'Untitled', 140), h('span', { class: 'cap-open' }, 'ⓘ')),
      meta ? h('div', { class: 'cap-meta' }, U.truncate(U.text(meta), 120)) : '',
      item.credit || item.detail ? h('div', { class: 'cap-credit' }, U.truncate(U.text([item.detail, item.credit].filter(Boolean).join(' · ')), 160)) : '');
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('on'); peek(); }));
  };
  U.$('#caption').addEventListener('click', e => { e.stopPropagation(); if (UI.swipedAt && Date.now() - UI.swipedAt < 500) return; UI.info.open(capItem); });
  U.$('#caption').addEventListener('keydown', e => { if (e.key === 'Enter') UI.info.open(capItem); });

  /* ── About this picture: where it came from, in full ── */
  const info = (UI.info = { isOpen: false });
  const hostName = u => { try { return new URL(u, location.href).hostname; } catch (e) { return ''; } };
  info.open = function (item) {
    item = item || capItem; if (!item) return;
    const card = U.$('#infoCard'), p = item.src === 'personal' ? SS.providers.personal : SS.providers[item.src] || {};
    const row = (k, v) => (v ? h('div', { class: 'ec-row' }, h('span', null, k), h('b', null, v)) : '');
    const link = (href, label) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label);
    card.innerHTML = '';
    const thumb = h('div', { class: 'ic-thumb' });
    const cur = SS.show.cur;
    if (cur && cur.item === item && cur.canvas) { const c = U.mk(320, Math.round(320 * cur.canvas.height / cur.canvas.width)); c.getContext('2d').drawImage(cur.canvas, 0, 0, c.width, c.height); thumb.append(c); }
    const gen = item.src === 'generative', mine = item.src === 'personal', living = item.src === 'living';
    const shown = item.shown && item.shown.url && /^https?:|^\//.test(item.shown.url) ? item.shown : null;
    card.append(
      h('button', { class: 'fc-x', 'aria-label': 'Close', onclick: e => { e.stopPropagation(); info.close(); } }, U.icon('x')), thumb,
      h('div', { class: 'fc-body' },
        h('div', { class: 'cap-src' }, h('span', { class: 'cap-dot', style: { '--c': p.color || '#fff' } }), 'About this picture'),
        h('div', { class: 'ic-title' }, U.text(item.title) || 'Untitled'),
        gen ? h('p', { class: 'ic-note' }, `Generative art: this app drew it itself, with code, right on this screen. It isn't a photo of anything and it isn't AI-made. It stays at most ${Math.round((SS.settings.genSeconds || 120) / 60)} min.`) : '',
        gen ? h('div', { style: { margin: '0 0 10px' } }, h('button', { class: 'btn small', onclick: e => { e.stopPropagation(); SS.setSetting('weights.generative', -1); info.close(); SS.pool.genChanged(); U.toast('Generative art is off. Turn it back on in Settings → Slideshow.'); } }, 'Don\'t show generative art')) : '',
        item.kind === 'motion' ? h('p', { class: 'ic-note' }, 'A video, playing muted on a loop. It stays up to 2 minutes.') : '',
        living ? h('p', { class: 'ic-note' }, 'Living art: an animation this app draws live, right now, so every run plays out differently. The idea and its creator are credited below.') : '',
        row('Source', p.name || item.src),
        row('Genre', SS.genreById[SS.pool.genreOfItem(item)] ? SS.genreById[SS.pool.genreOfItem(item)].name : ''),
        !mine && !gen ? row('By', U.text(item.creator)) : '',
        row(mine ? 'Taken' : 'Date', mine ? (item.taken ? U.fmt.date(item.taken) : '') : U.text(item.date)),
        row('Medium', !mine ? U.text(item.detail) : ''),
        row('Credit line', U.text(item.credit)),
        row('Licence', U.text(item.license)),
        mine ? row('Stored', item.where) : '', mine ? row('Album', item.album) : '', mine ? row('File', item.file) : '',
        gen ? row('Style', item.gen && item.gen.style) : '', gen ? row('Seed', item.gen && String(item.gen.seed)) : '',
        shown ? row('Image file', `${hostName(shown.url) || 'this server'} · ${shown.w}×${shown.h}`) : '',
        h('div', { class: 'ic-links' },
          item.link ? link(item.link, living ? 'About the original idea ↗' : `Open the original at ${p.name || 'the source'} ↗`) : '',
          p.home ? link(p.home, `About ${p.name}'s open collection ↗`) : '')));
    card.hidden = false; info.isOpen = true;
  };
  info.close = () => { U.$('#infoCard').hidden = true; info.isOpen = false; };
  info.toggle = () => (info.isOpen ? info.close() : info.open());
  document.addEventListener('pointerdown', e => {
    if (info.isOpen && !e.target.closest('#infoCard') && !e.target.closest('#caption') && !e.target.closest('#hud')) info.close();
    if (timer.isOpen && !e.target.closest('#timerPop') && !e.target.closest('#hud')) timer.close();
    if (UI.genres.isOpen && !e.target.closest('#genrePop') && !e.target.closest('#hud')) UI.genres.close();
    if (UI.view.isOpen && !e.target.closest('#viewPop') && !e.target.closest('#hud')) UI.view.close();
  });

  /* ── Picture timer ── */
  const timer = (UI.timer = { isOpen: false });
  const fmtSec = s => (s < 60 ? s + 's' : s < 3600 ? Math.round(s / 60) + 'm' : Math.round(s / 3600) + 'h');
  UI.timerLabel = () => { const el = U.$('#hudTimer'); if (el) el.textContent = fmtSec(SS.settings.slideSeconds); };
  timer.open = function () {
    const pop = U.$('#timerPop'); pop.innerHTML = '';
    const opts = [30, 60, 120, 300, 600, 900, 1800, 3600];
    const left = SS.show.nextAt ? Math.max(0, Math.round((SS.show.nextAt - Date.now()) / 1000)) : null;
    pop.append(h('div', { class: 'tp-h' }, 'New picture every'),
      h('div', { class: 'tp-grid' }, opts.map(v => h('button', { class: SS.settings.slideSeconds === v ? 'on' : '', onclick: () => { SS.setSetting('slideSeconds', v); UI.timerLabel(); SS.show.schedule(); timer.open(); } }, fmtSec(v).replace('m', ' min').replace('h', ' hr').replace('s', ' sec')))),
      h('div', { class: 'note' }, `${left != null && SS.show.playing ? `Next picture in ${U.fmt.mmss(left)}. ` : ''}Generative pieces stay at most ${fmtSec(SS.settings.genSeconds || 120)}. Swipe or press → to skip anytime.`));
    pop.hidden = false; timer.isOpen = true;
  };
  timer.close = () => { U.$('#timerPop').hidden = true; timer.isOpen = false; };
  timer.toggle = () => (timer.isOpen ? timer.close() : (UI.genres.close(), UI.view.close(), timer.open()));

  /* ── What's on screen: everything, just the clock and date, or just the art (the 🕒 button) ── */
  const view = (UI.view = { isOpen: false });
  view.open = function () {
    const pop = U.$('#viewPop'); pop.innerHTML = '';
    const s = SS.settings, cur = UI.isArtOnly() ? 'art' : UI.isClockOnly() ? 'clock' : 'all';
    const pick = (id, label, icon, fn) => h('button', { class: 'vp-btn' + (cur === id ? ' on' : ''), onclick: e => { e.stopPropagation(); view.close(); fn(); } }, h('span', { class: 'vp-ic', html: icon }), label);
    const sw = h('input', { type: 'checkbox', 'aria-label': 'Clock' }); sw.checked = !!s.clock;
    sw.addEventListener('change', () => { SS.setSetting('clock', sw.checked); UI.tickClock(); });
    const tap = h('div', { class: 'seg vp-seg' });
    [['art', 'Art only'], ['clock', 'Clock & date'], ['cycle', 'Both in turn']].forEach(([v, l]) => tap.append(h('button', { class: (s.tapView || 'art') === v ? 'on' : '', onclick: e => { e.stopPropagation(); SS.setSetting('tapView', v); view.open(); } }, l)));
    const scr = h('div', { class: 'seg vp-seg' }), look = SS.wxscreen.look();
    [['gallery', 'Gallery'], ['photo', 'Weather'], ['globe', 'Snow globe']].forEach(([v, l]) => scr.append(h('button', { class: look === v ? 'on' : '', onclick: e => { e.stopPropagation(); view.close(); if (v === look) return; v === 'gallery' ? SS.wxscreen.close() : SS.wxscreen.open(v); } }, l)));
    pop.append(
      h('div', { class: 'tp-h' }, 'Screen'), scr, h('div', { class: 'vp-gap' }),
      h('div', { class: 'tp-h' }, 'On screen'),
      h('div', { class: 'vp-grid' },
        pick('all', 'Everything', '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M6 8h5M6 11h3M6 16h12"/></svg>', () => UI.showAll()),
        pick('clock', 'Clock & date', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>', () => UI.clockOnly()),
        pick('art', 'Art only', '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>', () => UI.artOnly())),
      h('label', { class: 'gp-sw vp-row' }, h('span', { class: 'switch' }, sw, h('span')), h('span', null, h('b', null, 'Clock'), h('small', null, 'Time and date when everything is showing (K)'))),
      h('div', { class: 'vp-row2' }, h('small', null, 'A tap on the art leaves'), tap),
      h('div', { class: 'note' }, 'Tap the art again to bring everything back. Double-tap always leaves just the art. Keys: H art only · D clock & date · K clock.'));
    pop.hidden = false; view.isOpen = true;
  };
  view.close = () => { U.$('#viewPop').hidden = true; view.isOpen = false; };
  view.toggle = () => (view.isOpen ? view.close() : (UI.timer.close(), UI.genres.close(), UI.info.close(), view.open()));

  /* ── Genres drop-down: tick what's in the mix, and shuffle ── */
  const gp = (UI.genres = { isOpen: false });
  UI.genreLabel = function () {
    const b = U.$('#hud [data-act=genres]'); if (!b) return;
    const G = SS.genres, on = G.filter(g => SS.pool.genreOn(g)).length, shuf = !!SS.settings.shuffle;
    b.innerHTML = '';
    b.classList.toggle('shuf', shuf);
    b.append(U.icon(shuf ? 'shuffle' : 'genres'), h('span', { class: 'gl-n' }, on === G.length ? 'All' : String(on)), h('span', { class: 'gl-long' }, (on === 1 ? ' genre' : ' genres') + (shuf ? ' · shuffle' : '')), U.icon('down'));
  };
  const OPEN = new Set(U.store.get('gpOpen', []));            // which genres are expanded to show their sources
  const srcLine = id => {
    const p = SS.providers[id], P = SS.pool, st = P.status[id] || {}, api = p.api || '';
    const q = (P.queues[id] || []).length;
    const state = !P.sourceOn(id) ? 'off'
      : p.needsServer && !SS.server.available ? 'needs the Pi or computer server'
      : p.needsKey && !SS.settings[p.needsKey] ? 'needs a free API key (Fine-tune sources)'
      : st.state === 'error' ? 'couldn\'t reach it right now'
      : q ? `${q} lined up` + (P.reach[id] && P.reach[id].n ? ` · from ${U.fmt.int(P.reach[id].n)} works` : '')
      : P.fetching[id] ? 'loading…' : 'waiting';
    return { text: [api, state].filter(Boolean).join(' · '), bad: /needs|couldn/.test(state) && P.sourceOn(id) };
  };
  gp.open = function () {
    const pop = U.$('#genrePop'), P = SS.pool, G = SS.genres;
    const keep = pop.querySelector('.gp-list'), top = keep ? keep.scrollTop : 0;
    pop.innerHTML = '';
    const on = G.filter(g => P.genreOn(g)).length, run = P.run;
    const list = h('div', { class: 'gp-list' });
    G.forEach(g => {
      const isOn = P.genreOn(g), ready = P.genreReady(g.id);
      const cb = h('input', { type: 'checkbox', 'aria-label': g.name }); cb.checked = isOn;
      cb.addEventListener('change', () => {
        if (!cb.checked && on <= 1) { cb.checked = true; U.toast('Keep at least one genre ticked'); return; }
        P.setGenre(g.id, cb.checked); UI.genreLabel(); gp.open();
      });
      const why = (isOn && P.genreWhy(g.id)) || g.sub;
      const srcs = g.srcs.filter(id => SS.providers[id] && SS.providers[id].api);   // living, generative and my photos have no outside source
      const open = srcs.length && OPEN.has(g.id);
      const item = h('div', { class: 'gp-item' + (open ? ' open' : '') },
        h('label', { class: 'gp-row' + (isOn ? ' on' : '') + (isOn && !ready ? ' idle' : '') },
          cb, h('span', { class: 'gp-box' }, U.icon('check')), h('span', { class: 'cap-dot', style: { '--c': g.color } }),
          h('span', { class: 'gp-txt' }, h('b', null, g.name, run && run.genre === g.id && SS.show.cur && P.genreOfItem(SS.show.cur.item) === g.id ? h('span', { class: 'gp-now' }, 'now') : ''), h('small', null, why))),
        srcs.length ? h('button', { class: 'gp-exp', 'aria-expanded': open ? 'true' : 'false', 'aria-label': `${open ? 'Hide' : 'Show'} the sources for ${g.name}`, title: open ? 'Hide sources' : 'Show sources',
          onclick: e => { e.stopPropagation(); OPEN.has(g.id) ? OPEN.delete(g.id) : OPEN.add(g.id); U.store.set('gpOpen', Array.from(OPEN)); gp.open(); } },
          h('span', { class: 'gp-k' }, `${srcs.filter(id => P.sourceOn(id)).length}/${srcs.length}`), U.icon('down')) : '');
      list.append(item);
      if (open) {
        const sub = h('div', { class: 'gp-subs' + (isOn ? '' : ' dim') });
        srcs.forEach(id => {
          const p = SS.providers[id], sOn = P.sourceOn(id), line = srcLine(id);
          const scb = h('input', { type: 'checkbox', 'aria-label': p.name }); scb.checked = sOn;
          scb.addEventListener('change', () => { P.setSource(id, scb.checked); UI.genreLabel(); gp.open(); });
          sub.append(h('label', { class: 'gp-src' + (sOn ? ' on' : '') + (line.bad ? ' bad' : ''), title: p.sub },
            scb, h('span', { class: 'gp-box' }, U.icon('check')), h('span', { class: 'cap-dot', style: { '--c': p.color } }),
            h('span', { class: 'gp-txt' }, h('b', null, p.name), h('small', null, line.text))));
        });
        list.append(sub);
      }
    });
    const shuf = !!SS.settings.shuffle;
    const sw = h('input', { type: 'checkbox', 'aria-label': 'Shuffle' }); sw.checked = shuf;
    sw.addEventListener('change', () => { SS.setSetting('shuffle', sw.checked); if (!sw.checked) P.run = null; UI.genreLabel(); gp.open(); });
    const cur = run && SS.genreById[run.genre];
    pop.append(
      h('div', { class: 'tp-h gp-h' }, h('span', null, 'Genres'), h('span', { class: 'gp-count' }, `${on} of ${G.length} in the mix · ▾ for sources`)),
      list,
      h('div', { class: 'gp-shuffle' },
        h('label', { class: 'gp-sw' }, h('span', { class: 'switch' }, sw, h('span')), h('span', null, h('b', null, 'Shuffle'), h('small', null, shuf && cur ? `Now: ${cur.name} · ${Math.max(0, run.left)} more, then a new genre` : 'One genre at a time, picked at random'))),
        h('button', { class: 'btn small gp-go', onclick: e => { e.stopPropagation(); const g = P.shuffleNow(); if (!g) return U.toast('Tick a genre that can load first'); U.toast(h('span', { class: 'toast-shuf' }, U.icon('shuffle'), 'Shuffle · ' + g.name), 2600); UI.genreLabel(); gp.open(); } }, U.icon('shuffle'), 'Shuffle now')),
      h('div', { class: 'gp-foot' },
        h('button', { class: 'linkish', onclick: () => { G.forEach(g => { if (!P.genreOn(g) && (g.id !== 'mine' || SS.photos.count)) (g.set ? g.set(true) : SS.setSetting('genres.' + g.id, true)); }); P.genChanged(true); UI.genreLabel(); gp.open(); } }, 'Tick all'),
        h('button', { class: 'linkish', onclick: () => { gp.close(); SS.settingsUI.open('sources'); } }, 'Fine-tune sources →')));
    pop.hidden = false; gp.isOpen = true;
    const nl = pop.querySelector('.gp-list'); if (nl) nl.scrollTop = top;
  };
  // Sources report in often; redraw the open drop-down calmly, and never in the middle of a tap.
  let pressing = false;
  U.$('#genrePop').addEventListener('pointerdown', () => { pressing = true; });
  addEventListener('pointerup', () => setTimeout(() => { pressing = false; }, 250), true);
  addEventListener('pointercancel', () => { pressing = false; }, true);
  gp.refresh = U.debounce(() => { if (!gp.isOpen) return; if (pressing) return gp.refresh(); gp.open(); }, 600);
  gp.close = () => { U.$('#genrePop').hidden = true; gp.isOpen = false; };
  gp.toggle = () => (gp.isOpen ? gp.close() : (UI.timer.close(), UI.info.close(), UI.view.close(), gp.open()));

  /* ── Clock + next event + tasks ── */
  UI.toggleClock = function () {
    SS.setSetting('clock', !SS.settings.clock);
    UI.tickClock();
    U.toast(SS.settings.clock ? 'Clock on' : 'Clock hidden. Tap the clock button to bring it back.');
  };
  UI.tickClock = function () {
    const c = U.$('#clock'), s = SS.settings, now = new Date();
    const show = s.clock || UI.isClockOnly();       // "Clock & date only" shows them even if the clock is normally hidden
    document.body.classList.toggle('no-clock', !show);
    const cb = U.$('#hud [data-act=clock]'); if (cb) cb.classList.toggle('off', !s.clock);
    c.hidden = !show && !s.env.enabled;
    U.$('.clk-time', c).hidden = !show; U.$('#clkDate').hidden = !show;
    let hh = now.getHours(); const mm = String(now.getMinutes()).padStart(2, '0');
    let ap = '';
    if (!s.clock24) { ap = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12; }
    U.$('#clkHM').textContent = `${s.clock24 ? String(hh).padStart(2, '0') : hh}:${mm}`;
    U.$('#clkAP').textContent = ap;
    U.$('#clkDate').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    const nx = U.$('#clkNext');
    nx.innerHTML = '';
    if (s.agendaChip) {
      const ev = SS.planner.next();
      if (ev) {
        const mins = Math.round((ev.start - now) / 60000);
        const when = ev.start <= now ? 'now' : mins < 60 ? `in ${mins} min` : U.fmt.time(ev.start, s.clock24);
        nx.append(h('span', { class: 'chip' }, h('i', { class: 'dot' }), h('span', null, h('span', { class: 'muted' }, when + ' · '), ev.title || 'Event')));
      }
      const todo = SS.state.board.filter(c2 => c2.col !== 'done');
      if (todo.length) nx.append(h('span', { class: 'chip' }, h('span', { class: 'muted' }, `☐ ${todo.length} to do · `), h('span', null, U.truncate(todo[0].text, 34))));
    }
    nx.hidden = !nx.childNodes.length;
  };
  U.$('#clkNext').addEventListener('click', () => SS.planner.open(U.$('#clkNext').textContent.includes('to do') && !SS.planner.next() ? 'board' : 'agenda'));

  /* ── Gestures & keys ── */
  function initInput() {
    // Swipes work anywhere over the picture (the art, the caption, the clock), not on buttons or panels.
    // Left = next, right = back. The picture follows your finger; let go past the line, or flick, and it goes.
    const NO_SWIPE = 'button, a, input, select, textarea, label, .seg, #sheet, #panel, #radarBig, #game, #flightCard, #infoCard, #timerPop, #genrePop, #viewPop, #hud, #panelTab, #stripTab, #flightStrip, #wx, .clk-next, #banner, #toasts, .ws-chips, .ws-ctl';
    let g = null;
    addEventListener('pointerdown', e => {
      if (!e.isPrimary || UI.gameOpen || SS.settingsUI.isOpen || (SS.radar && SS.radar.bigOpen) || (e.pointerType === 'mouse' && e.button !== 0)) { g = null; return; }
      if (e.target.closest && e.target.closest(NO_SWIPE)) { g = null; return; }
      g = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId, drag: false, stage: !!e.target.closest('#stage'),
        // something open (panel, a card, a pop-up)? then a tap just closes it
        wasOpen: document.body.classList.contains('panel-open') || (SS.radar && SS.radar.cardOpen) || UI.info.isOpen || UI.timer.isOpen || UI.genres.isOpen || UI.view.isOpen };
    }, true);
    addEventListener('pointermove', e => {
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.drag && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3 && SS.show.cur) g.drag = true;
      if (g.drag) SS.show.drag(dx / innerWidth);
    }, true);
    addEventListener('pointerup', e => {
      if (!g || e.pointerId !== g.id) return;
      const was = g; g = null;
      const dx = e.clientX - was.x, dy = e.clientY - was.y, dt = Math.max(1, Date.now() - was.t);
      if (was.drag) {
        UI.swipedAt = Date.now(); UI.resetDbl();
        const f = dx / innerWidth, flick = Math.abs(dx) / dt > 0.45 && Math.abs(dx) > 30;
        if (Math.abs(dx) > Math.min(90, innerWidth * 0.18) || flick) SS.show.swipe(dx < 0 ? 'next' : 'prev', f);
        else SS.show.snapBack(f);
        return;
      }
      if (!was.stage && !UI.isClockOnly()) return;                   // taps only count on the art itself
      if (Math.hypot(dx, dy) > 14 || dt > 700) return;              // a drag or a long press, not a tap
      if (UI.dblAt && Date.now() - UI.dblAt < 60) return;           // second tap of a double-tap: already hidden
      if (was.wasOpen) { SS.planner.close(); UI.wakeUp(); return; }
      UI.toggleArt();
    }, true);
    addEventListener('pointercancel', e => { if (g && g.drag) SS.show.snapBack(0); g = null; }, true);
    const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let seq = [];
    addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      seq.push(e.key.length === 1 ? e.key.toLowerCase() : e.key); seq = seq.slice(-KONAMI.length);
      if (seq.join() === KONAMI.join()) { seq = []; SS.settingsUI.close(); SS.game.open(); return; }
      if (SS.game.isOpen) return;
      if (e.key === 'Escape') { if (UI.info.isOpen) UI.info.close(); else if (UI.timer.isOpen) UI.timer.close(); else if (UI.genres.isOpen) UI.genres.close(); else if (UI.view.isOpen) UI.view.close(); else if (UI.isClockOnly() || UI.isArtOnly()) UI.showAll(); else if (SS.settingsUI.isOpen) SS.settingsUI.close(); else if (SS.radar.bigOpen) SS.radar.closeBig(); else if (SS.radar.cardOpen) SS.radar.closeCard(); else SS.planner.close(); return; }
      if (SS.settingsUI.isOpen) return;
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowRight') SS.show.advance();
      else if (e.key === 'ArrowLeft') SS.show.prev();
      else if (k === ' ') { e.preventDefault(); SS.show.toggle(); }
      else if (k === 'f') UI.fullscreen();
      else if (k === 's') SS.settingsUI.open();
      else if (k === 't') SS.settingsUI.open('fx');
      else if (k === 'p') SS.settingsUI.open('photos');
      else if (k === 'c') SS.planner.toggle();
      else if (k === 'r') SS.radar.openBig();
      else if (k === 'i') UI.info.toggle();
      else if (k === 'k') UI.toggleClock();
      else if (k === 'h') UI.toggleArt();
      else if (k === 'g') UI.genres.toggle();
      else if (k === 'w') SS.wxscreen.toggle();
      else if (k === 'o') (SS.wxscreen.look() === 'globe' ? SS.wxscreen.close() : SS.wxscreen.open('globe'));
      else if (k === 'd') (UI.isClockOnly() ? UI.showAll() : UI.clockOnly());
      else if (k === 'x') { const g = SS.pool.shuffleNow(); if (g) U.toast(h('span', { class: 'toast-shuf' }, U.icon('shuffle'), 'Shuffle · ' + g.name), 2600); }
    });
  }

  /* ── Full screen & wake lock ── */
  UI.fullscreen = function () {
    const d = document, el = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el).catch?.(() => U.toast('Full screen isn\'t available here. On iPhone, use Add to Home Screen.'));
    } catch (e) { U.toast('Full screen isn\'t available here. On iPhone, use Add to Home Screen.'); }
  };
  let lock = null, lockState = 'not requested';
  UI.wake = async function () {
    if (!('wakeLock' in navigator)) { lockState = 'not supported by this browser'; return; }
    try { lock = await navigator.wakeLock.request('screen'); lockState = 'on'; lock.addEventListener('release', () => { lockState = 'released'; }); }
    catch (e) { lockState = 'blocked (' + (e.name || 'error') + ')'; }
  };
  UI.wakeState = () => `Screen wake lock: ${lockState}`;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') UI.wake(); });
  addEventListener('pointerdown', () => { if (lockState !== 'on') UI.wake(); }, { once: true });

  /* ── Night dim + burn-in shift ── */
  UI.night = function () {
    const n = SS.settings.night, el = U.$('#night');
    if (!n.enabled) { el.style.opacity = 0; return; }
    const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
    const p = s => { const [a, b] = String(s).split(':').map(Number); return a * 60 + (b || 0); };
    const f = p(n.from), t = p(n.to);
    const on = f < t ? mins >= f && mins < t : mins >= f || mins < t;
    el.style.opacity = on ? n.level : 0;
  };
  function shift() {
    const o = U.$('#overlay');
    if (!SS.settings.burnIn) { o.style.setProperty('--sx', '0px'); o.style.setProperty('--sy', '0px'); return; }
    o.style.setProperty('--sx', U.randInt(-7, 7) + 'px'); o.style.setProperty('--sy', U.randInt(-5, 5) + 'px');
  }

  /* ── Preview-mode banner ── */
  function banner() {
    const b = U.$('#banner');
    if (!SS.env.cspBlocked || U.store.get('bannerDismissed', false)) return;
    b.innerHTML = '';
    b.append(h('b', null, 'Preview mode. '), 'This hosted copy can\'t reach the museum, flight or weather APIs, so you\'re seeing generative art and simulated flights. Add your own photos here, or run the full version from your Pi or computer to get the art.',
      h('div', null, h('button', { class: 'btn small', onclick: () => SS.settingsUI.open('photos') }, 'Add photos'), ' ', h('button', { class: 'btn small ghost', onclick: () => { b.hidden = true; U.store.set('bannerDismissed', true); } }, 'Got it')));
    b.hidden = false;
  }

  UI.init = function () {
    initHud(); initInput();
    UI.tickClock(); setInterval(UI.tickClock, 15000);
    UI.night(); setInterval(UI.night, 60000);
    setInterval(shift, 4 * 60000);
    SS.on('csp', banner); banner();
    SS.on('agenda', UI.tickClock); SS.on('state', UI.tickClock); SS.on('settings', p => { if (p === 'cloud' || /clock|agenda|env/.test(p || '')) UI.tickClock(); if (p === 'cloud' || p === 'slideSeconds') UI.timerLabel(); if (p === 'cloud' || /^(genres|shuffle|personalOn|weights\.(living|generative))/.test(p || '')) UI.genreLabel(); if (p === 'calm') UI.unCalm(); });
    UI.timerLabel(); UI.genreLabel();
    UI.wake();
    UI.unCalm();
  };
})();
