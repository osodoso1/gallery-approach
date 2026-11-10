/* The Weather screen: landmark photos with the live weather at each one, front and centre.
   Also decides which weather effects play over whatever picture is showing (landmarks, and the art if you like). */
(function () {
  'use strict';
  const U = SS.u, h = U.h;
  const WS = (SS.wxscreen = { sampleN: 0, sample: null });
  const LM = () => SS.landmarks, FX = () => SS.wxfx, EN = () => SS.env2, W = () => SS.settings.wx || {};
  const B = document.body;
  let host;

  const isF = () => (SS.settings.env.units || 'F') === 'F';
  const deg = c => (c == null ? '—' : Math.round(isF() ? c * 9 / 5 + 32 : c) + '°');
  const speed = kmh => (kmh == null ? '—' : isF() ? Math.round(kmh / 1.609) + ' mph' : Math.round(kmh) + ' km/h');
  const compass = d => (d == null ? '' : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8]);
  const dist = m => { if (m == null) return ''; const v = isF() ? m / 1609.34 : m / 1000, u = isF() ? ' mi' : ' km'; return (v >= 10 ? Math.round(Math.min(v, isF() ? 15 : 24)) + (v >= (isF() ? 15 : 24) ? '+' : '') : v.toFixed(1)) + u; };
  const iconFor = (code, day) => { const ic = ((EN().WMO[code] || ['', 'cloud'])[1]); return day === 0 && (ic === 'sun' || ic === 'partly') ? 'moon' : ic; };
  const hourLbl = t => { const hh = +t.slice(11, 13); return SS.settings.clock24 ? String(hh).padStart(2, '0') : `${hh % 12 || 12}${hh < 12 ? 'a' : 'p'}`; };
  function timeThere(w) {
    if (w.off == null || w.off === -new Date().getTimezoneOffset() * 60) return '';
    const d = new Date(Date.now() + w.off * 1000), hh = d.getUTCHours(), mm = String(d.getUTCMinutes()).padStart(2, '0');
    return (SS.settings.clock24 ? `${String(hh).padStart(2, '0')}:${mm}` : `${hh % 12 || 12}:${mm} ${hh < 12 ? 'AM' : 'PM'}`) + ' there';
  }
  // One line of plain words for what the effects are showing, e.g. "Thick fog" or "Light rain, breezy".
  function words(w) {
    const s = LM().scene(w); if (!s) return '';
    const base = (EN().WMO[w.code] || ['—'])[0];
    const extra = [];
    if (s.fog >= 0.75 && !/fog/i.test(base)) extra.push('thick fog'); else if (s.fog >= 0.4 && !/fog/i.test(base)) extra.push('foggy'); else if (s.fog >= 0.2 && !/fog/i.test(base)) extra.push('hazy');
    if (s.wind >= 25) extra.push('windy'); else if (s.wind >= 15) extra.push('breezy');
    return [base].concat(extra).join(', ');
  }

  WS.isOn = () => !!W().screen;
  const curItem = () => SS.show.cur && SS.show.cur.item;
  function go() { let n = 0; const f = () => (SS.show.busy && n++ < 40 ? setTimeout(f, 150) : SS.show.advance()); f(); }

  /* ── Which weather effects play right now ── */
  let localAt = 0;
  WS.applyFx = function () {
    const it = curItem(), w = W();
    if (!it) return;
    if (it.globe) { if (it.lm) LM().weather(it.lm); FX().set(null); return; }   // a snow globe keeps its weather inside the glass
    if (it.lm) {
      const data = LM().wxNow(it.lm);
      LM().weather(it.lm);
      const sc = w.fxLm !== false && data ? LM().scene(data) : null;
      FX().set(sc && w.dayNight === false ? Object.assign({}, sc, { night: 0 }) : sc);
      return;
    }
    if (WS.isOn() && WS.sample) { FX().set(w.fxLm !== false ? WS.sample : null); return; }   // sample weather (nothing live can load)
    if (w.fxArt === false || !SS.settings.env.enabled) { FX().set(null); return; }
    const loc = EN().loc(), data = LM().wxNow(loc);
    if (!data || Date.now() - localAt > 10 * 60e3) { localAt = Date.now(); LM().weather(loc); }
    FX().set(data ? LM().scene(data) : null, { art: true });
  };

  /* ── The screen ── */
  WS.look = () => (WS.isOn() ? (W().look === 'globe' ? 'globe' : 'photo') : 'gallery');
  // look: 'photo' (full-screen landmark photos) or 'globe' (the snow globe). Left out: whichever you used last.
  WS.open = function (look) {
    const was = WS.look();
    if (look && W().look !== look) SS.setSetting('wx.look', look);
    if (!WS.isOn()) SS.setSetting('wx.screen', true);
    B.classList.add('wx-screen'); B.classList.toggle('wx-globe', W().look === 'globe');
    LM().resolve();
    SS.show.nextP = null;
    const it = curItem();
    if (!(it && it.lm) || was !== WS.look() || !!it.globe !== (W().look === 'globe')) go();
    SS.ui.wakeUp(); render();
  };
  WS.close = function () {
    if (WS.isOn()) SS.setSetting('wx.screen', false);
    B.classList.remove('wx-screen', 'wx-globe');
    WS.sample = null; LM().jump = null;
    SS.show.nextP = null; go();
    SS.ui.caption.refresh(); SS.ui.wakeUp();
  };
  WS.toggle = () => (WS.isOn() ? WS.close() : WS.open());
  WS.jump = function (lm) { LM().jump = lm; LM().weather(lm); SS.show.nextP = null; go(); };

  function ctlRow(it) {
    const w = W(), lm = it && it.lm, scope = w.scope || 'city';
    const seg = h('div', { class: 'seg ws-scope', role: 'group', 'aria-label': 'Show landmarks from' });
    [['city', 'City'], ['state', 'State'], ['country', 'Country'], ['world', 'World']].forEach(([v, l]) => seg.append(h('button', { class: scope === v ? 'on' : '', onclick: e => { e.stopPropagation(); SS.setSetting('wx.scope', v); SS.show.nextP = null; } }, l)));
    return h('div', { class: 'ws-ctl' }, seg,
      lm ? h('button', { class: 'btn small' + (w.pin === lm.id ? ' amber' : ''), title: 'Keep showing only this landmark', onclick: e => { e.stopPropagation(); SS.setSetting('wx.pin', w.pin === lm.id ? '' : lm.id); SS.show.nextP = null; U.toast(W().pin ? `Staying at ${lm.name}` : 'Back to all the landmarks'); render(); } }, U.icon('pin'), w.pin === lm.id ? 'Staying here' : 'Stay here') : '',
      lm && LM().fav() !== lm ? h('button', { class: 'btn small ghost', title: 'Show this one most often', onclick: e => { e.stopPropagation(); SS.setSetting('wx.fav', lm.id); U.toast(`${lm.name} will come round most often`); render(); } }, '★ Favourite') : '',
      h('button', { class: 'btn small ghost', title: 'Switch between full-screen photos and the snow globe', onclick: e => { e.stopPropagation(); WS.open(W().look === 'globe' ? 'photo' : 'globe'); render(); } }, W().look === 'globe' ? 'Photo look' : 'Snow globe'),
      h('button', { class: 'btn small ghost', onclick: e => { e.stopPropagation(); SS.settingsUI.open('weather'); } }, 'Change place'),
      h('button', { class: 'btn small ghost', onclick: e => { e.stopPropagation(); WS.close(); } }, 'Back to the gallery'));
  }
  function chips(it) {
    const L = LM(), cur = it && it.lm, fav = L.fav();
    let list = L.list.slice(0, 14);
    if (cur && !list.includes(cur) && L.list.includes(cur)) list = [cur].concat(list.slice(0, 13));
    if (list.length < 2) return '';
    const box = h('div', { class: 'ws-chips' });
    list.forEach(m => {
      const wx = L.wxNow(m);
      box.append(h('button', { class: 'ws-chip' + (m === cur ? ' on' : ''), onclick: e => { e.stopPropagation(); if (m !== cur) WS.jump(m); } },
        m === fav ? h('i', null, '★') : '', h('span', null, m.name), wx ? h('b', null, deg(wx.t)) : ''));
    });
    return box;
  }
  function render() {
    if (!host) return;
    host.hidden = !WS.isOn();
    if (host.hidden) return;
    const it = curItem(), L = LM(), keep = host.querySelector('.ws-chips'), sl = keep ? keep.scrollLeft : 0;
    host.innerHTML = '';
    const where = h('div', { class: 'ws-where' }, U.icon('pin'), h('span', null, L.status || L.scopeLabel()), L.widened ? h('em', null, ` · nothing built in for your ${W().scope || 'city'} yet`) : '');
    const main = h('div', { class: 'ws-main' }, where);
    if (it && it.lm) {
      const lm = it.lm, w = L.wxNow(lm);
      main.append(h('h1', { class: 'ws-name' }, lm.name), h('div', { class: 'ws-sub' }, L.placeLine(lm)));
      if (w) {
        const there = timeThere(w);
        main.append(
          h('div', { class: 'ws-now' }, h('span', { class: 'ws-temp' }, deg(w.t)), h('span', { class: 'ws-ic' }, U.svg(EN().ICON[iconFor(w.code, w.day)])),
            h('div', { class: 'ws-cond' }, h('b', null, words(w)), h('small', null, `Feels like ${deg(w.feels)} · High ${deg(w.hi)} · Low ${deg(w.lo)}`))),
          h('div', { class: 'ws-stats' },
            h('span', null, h('em', null, 'Wind'), `${speed(w.wind)} ${compass(w.dir)}`), h('span', null, h('em', null, 'Humidity'), w.rh != null ? Math.round(w.rh) + '%' : '—'),
            w.vis != null ? h('span', null, h('em', null, 'Visibility'), dist(w.vis)) : '', w.cloud != null ? h('span', null, h('em', null, 'Cloud'), Math.round(w.cloud) + '%') : '', there ? h('span', null, h('em', null, 'Local time'), there.replace(' there', '')) : ''));
        if (w.hours && w.hours.length) {
          const hrs = h('div', { class: 'ws-hours' });
          w.hours.slice(0, 8).forEach(x => hrs.append(h('div', null, h('span', null, hourLbl(x.t)), U.svg(EN().ICON[iconFor(x.code, x.day)]), h('b', null, deg(x.temp)), h('i', null, x.pop >= 20 ? x.pop + '%' : ''))));
          main.append(hrs);
        }
      } else if (it.globe && WS.sample) main.append(h('div', { class: 'ws-now' }, h('div', { class: 'ws-cond' }, h('b', null, WS.sample.label), h('small', null, 'Sample sky'))),
        h('div', { class: 'ws-wait' }, SS.env.cspBlocked ? 'This preview can\'t reach the weather service, so the globe shows each kind of sky in turn. On the website it follows the real weather at the bridge.' : 'Live weather isn\'t loading right now, so the globe is showing each kind of sky in turn.'));
      else main.append(h('div', { class: 'ws-wait' }, 'Getting the weather there…'));
      main.append(h('button', { class: 'ws-credit', onclick: e => { e.stopPropagation(); SS.ui.info.open(it); } }, it.model ? 'Bridge drawn in code by this app' : `Photo: ${[U.truncate(it.creator || '', 40), it.license, 'Wikimedia Commons'].filter(Boolean).join(' · ')}`, h('span', null, ' ⓘ')));
    } else if (WS.sample) {
      main.append(h('h1', { class: 'ws-name' }, WS.sample.label), h('div', { class: 'ws-sub' }, 'Sample weather'),
        h('div', { class: 'ws-wait' }, SS.env.cspBlocked ? 'This preview can\'t reach the weather service or the landmark photos, so it shows each effect in turn over the art. On the website or Pi version this screen fills with landmarks near you and their live weather.' : 'Landmark photos aren\'t loading right now, so here\'s each weather effect in turn. It will switch to live landmarks as soon as they load.'));
    } else {
      main.append(h('h1', { class: 'ws-name' }, 'Weather'), h('div', { class: 'ws-wait' }, L.status || 'Finding landmarks near you…'));
    }
    host.append(main, WS.sample && !(it && it.lm) ? '' : chips(it), ctlRow(it));
    const nc = host.querySelector('.ws-chips'); if (nc) { nc.scrollLeft = sl; const on = nc.querySelector('.on'); if (on && !sl && on.scrollIntoView) nc.scrollLeft = Math.max(0, on.offsetLeft - 16); }
  }
  WS.render = render;

  const SAMPLE_ORDER = ['fog', 'rain', 'snow', 'storm', 'clear', 'cloudy', 'night'];
  WS.init = function () {
    host = h('section', { id: 'wxScreen', hidden: true, 'aria-label': 'Weather at landmarks' });
    U.$('#overlay').appendChild(host);
    SS.on('slide', ({ item }) => {
      if (WS.isOn()) {
        if (item.lm && !(item.globe && (SS.env.cspBlocked || !SS.landmarks.list.length))) { WS.sample = null; SS.landmarks.weather(item.lm); }
        else if (item.globe) { WS.sample = SS.landmarks.SAMPLES[SAMPLE_ORDER[WS.sampleN++ % SAMPLE_ORDER.length]]; }
        else WS.sample = SS.landmarks.SAMPLES[SAMPLE_ORDER[WS.sampleN++ % SAMPLE_ORDER.length]];
      } else WS.sample = null;
      WS.applyFx(); render();
    });
    SS.on('lmweather', () => { WS.applyFx(); if (WS.isOn()) render(); });
    SS.on('landmarks', () => { if (WS.isOn()) { render(); const it = curItem(); if (it && !it.lm && !SS.show.busy && SS.landmarks.list.length && !SS.env.cspBlocked) { SS.show.nextP = null; } } });
    SS.on('wxfx-idle', () => WS.applyFx());
    SS.on('settings', p => {
      if (p === 'cloud') { const on = WS.isOn(); if (on !== B.classList.contains('wx-screen')) (on ? WS.open() : WS.close()); }
      if (/^wx\.(look|models)/.test(p || '') && WS.isOn()) { B.classList.toggle('wx-globe', W().look === 'globe'); SS.show.nextP = null; go(); }
      if (p === 'cloud' || /^wx\.|^env\.(units|enabled)|^clock24/.test(p || '')) { WS.applyFx(); render(); }
    });
    setInterval(() => { WS.applyFx(); if (WS.isOn()) render(); }, 5 * 60e3);
    if (WS.isOn()) { B.classList.add('wx-screen'); B.classList.toggle('wx-globe', W().look === 'globe'); SS.landmarks.resolve(); render(); }
  };
})();
