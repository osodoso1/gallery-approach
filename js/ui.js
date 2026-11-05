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
    const cardOpen = (SS.radar && SS.radar.cardOpen) || UI.info.isOpen || UI.timer.isOpen || (SS.env2 && SS.env2.openDay);
    if (busy() || (cardOpen && Date.now() - lastPoke < 60000)) { calmT = setTimeout(goCalm, 5000); return; }
    document.body.classList.add('calm');
    SS.radar && (SS.radar.closeCard(), SS.radar.tuck());
    UI.info.close(); UI.timer.close();
    SS.emit('calm', true);
  }
  UI.calmNow = () => { clearTimeout(calmT); clearTimeout(idleT); document.body.classList.remove('awake'); goCalm(); };

  /* ── Tap the art: everything goes, leaving only the art. Tap again: everything comes back. ── */
  const B = document.body;
  UI.isArtOnly = () => B.classList.contains('art-only');
  UI.artOnly = function () {
    clearTimeout(calmT); clearTimeout(idleT);
    B.classList.remove('awake', 'calm'); B.classList.add('art-only');
    SS.radar && (SS.radar.closeCard(), SS.radar.tuck());
    UI.info.close(); UI.timer.close();
  };
  UI.showAll = function () { B.classList.remove('art-only'); UI.wakeUp(); };
  // Anything hidden (art only, or the timer has faded things) → show it all; everything showing → art only.
  UI.toggleArt = () => (UI.isArtOnly() || UI.isCalm() ? UI.showAll() : UI.artOnly());

  // Double-tap anywhere that isn't a button (the art, the open weather panel, the caption…): everything goes.
  const NO_DBL = 'button, a, input, select, textarea, label, .wx-chips, .clk-next, #sheet, #panel, #radarBig, #game, #flightCard, #infoCard, #timerPop, #hud, #panelTab, #stripTab, #flightStrip';
  let lastUp = { t: 0, x: 0, y: 0 };
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
    if (UI.isArtOnly() && ev !== 'pointerdown') return; // in art-only, only a tap brings things back
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
        info: () => UI.info.toggle(), timer: () => UI.timer.toggle(), clock: () => UI.toggleClock(),
      }[b.dataset.act] || (() => {}))();
    });
    U.$('#panelTab').addEventListener('click', () => SS.planner.open());
    SS.on('slide', ({ fx }) => {
      const lab = U.$('#hudLabel');
      lab.textContent = SS.settings.fxLabel && fx ? '↻ ' + SS.fx.label(fx.id, fx.variant) : '';
    });
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
  U.$('#caption').addEventListener('click', e => { e.stopPropagation(); UI.info.open(capItem); });
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
  timer.toggle = () => (timer.isOpen ? timer.close() : timer.open());

  /* ── Clock + next event + tasks ── */
  UI.toggleClock = function () {
    SS.setSetting('clock', !SS.settings.clock);
    UI.tickClock();
    U.toast(SS.settings.clock ? 'Clock on' : 'Clock hidden. Tap the clock button to bring it back.');
  };
  UI.tickClock = function () {
    const c = U.$('#clock'), s = SS.settings, now = new Date();
    document.body.classList.toggle('no-clock', !s.clock);
    const cb = U.$('#hud [data-act=clock]'); if (cb) cb.classList.toggle('off', !s.clock);
    c.hidden = !s.clock && !s.env.enabled;
    U.$('.clk-time', c).hidden = !s.clock; U.$('#clkDate').hidden = !s.clock;
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
    let sx = 0, sy = 0, st = 0;
    const stage = U.$('#stage');
    let wasOpen = false;
    stage.addEventListener('pointerdown', e => {
      sx = e.clientX; sy = e.clientY; st = Date.now();
      // something open (panel, a card, the timer)? then this tap just closes it
      wasOpen = document.body.classList.contains('panel-open') || (SS.radar && SS.radar.cardOpen) || UI.info.isOpen || UI.timer.isOpen;
    });
    stage.addEventListener('pointerup', e => {
      const dx = e.clientX - sx, dy = e.clientY - sy, dt = Date.now() - st;
      if (dt < 600 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { dx < 0 ? SS.show.advance() : SS.show.prev(); return; }
      if (Math.hypot(dx, dy) > 14 || dt > 700) return;           // a drag or a long press, not a tap
      if (UI.dblAt && Date.now() - UI.dblAt < 60) return;          // second tap of a double-tap: already hidden
      if (wasOpen) { SS.planner.close(); UI.wakeUp(); return; }
      UI.toggleArt();
    });
    const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let seq = [];
    addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      seq.push(e.key.length === 1 ? e.key.toLowerCase() : e.key); seq = seq.slice(-KONAMI.length);
      if (seq.join() === KONAMI.join()) { seq = []; SS.settingsUI.close(); SS.game.open(); return; }
      if (SS.game.isOpen) return;
      if (e.key === 'Escape') { if (UI.info.isOpen) UI.info.close(); else if (UI.timer.isOpen) UI.timer.close(); else if (SS.settingsUI.isOpen) SS.settingsUI.close(); else if (SS.radar.bigOpen) SS.radar.closeBig(); else if (SS.radar.cardOpen) SS.radar.closeCard(); else SS.planner.close(); return; }
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
    SS.on('agenda', UI.tickClock); SS.on('state', UI.tickClock); SS.on('settings', p => { if (p === 'cloud' || /clock|agenda|env/.test(p || '')) UI.tickClock(); if (p === 'cloud' || p === 'slideSeconds') UI.timerLabel(); if (p === 'calm') UI.unCalm(); });
    UI.timerLabel();
    UI.wake();
    UI.unCalm();
  };
})();
