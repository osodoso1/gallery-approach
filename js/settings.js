/* Settings sheet. */
(function () {
  'use strict';
  const U = SS.u, h = U.h;
  const ST = (SS.settingsUI = { section: 'slideshow', isOpen: false });
  const get = path => path.split('.').reduce((o, k) => (o == null ? o : o[k]), SS.settings);
  const set = (path, v) => SS.setSetting(path, v);

  const row = (title, sub, ...ctl) => h('div', { class: 'row' }, h('div', { class: 'lbl' }, h('b', null, title), sub ? h('small', null, sub) : ''), h('div', { class: 'ctl' }, ctl));
  const toggle = (path, after) => {
    const i = h('input', { type: 'checkbox' }); i.checked = !!get(path);
    i.addEventListener('change', () => { set(path, i.checked); after && after(i.checked); });
    return h('label', { class: 'switch' }, i, h('span'));
  };
  const seg = (path, opts, after) => {
    const el = h('div', { class: 'seg' });
    const draw = () => { el.innerHTML = ''; opts.forEach(([v, l]) => el.append(h('button', { class: String(get(path)) === String(v) ? 'on' : '', onclick: () => { set(path, v); draw(); after && after(v); } }, l))); };
    draw(); return el;
  };
  const text = (path, ph, type = 'text', w = 200, after) => {
    const i = h('input', { type, placeholder: ph || '', style: { width: w + 'px' } }); i.value = get(path) ?? '';
    i.addEventListener('change', () => { set(path, type === 'number' ? parseFloat(i.value) : i.value.trim()); after && after(); });
    return i;
  };
  const link = (href, label) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label);

  const SECTIONS = [
    ['slideshow', 'Slideshow'], ['fx', 'Transitions'], ['sources', 'Art & photo sources'], ['photos', 'My photos'],
    ['flights', 'Flights'], ['weather', 'Weather & air'], ['calendar', 'Calendar'], ['sync', 'Sync & devices'], ['display', 'Display'], ['about', 'About'],
  ];

  ST.open = function (section) {
    if (section) ST.section = section;
    ST.isOpen = true;
    const host = U.$('#sheet');
    host.hidden = false;
    host.onclick = e => { if (e.target === host) ST.close(); };
    render();
  };
  ST.close = function () { ST.isOpen = false; U.$('#sheet').hidden = true; U.$('#sheet').innerHTML = ''; revokeThumbs(); };
  SS.on('pool', () => { if (ST.isOpen && ST.section === 'sources') renderMain(); });
  SS.on('photos', () => { if (ST.isOpen && ST.section === 'photos') renderMain(); });
  SS.on('cloud', () => { if (ST.isOpen && (ST.section === 'sync' || ST.section === 'photos')) renderMain(); });

  let main;
  function render() {
    const host = U.$('#sheet');
    host.innerHTML = '';
    const nav = h('div', { class: 'sh-nav' }, h('div', { class: 'sh-brand' }, 'Gallery ', h('em', null, 'Approach')),
      SECTIONS.map(([id, name]) => h('button', { class: ST.section === id ? 'on' : '', onclick: () => { ST.section = id; render(); } }, name)));
    main = h('div', { class: 'sh-main' });
    host.append(h('div', { class: 'sh-win', role: 'dialog', 'aria-label': 'Settings' }, nav, main));
    renderMain();
  }
  function renderMain() {
    if (!main) return;
    const top = main.scrollTop;
    main.innerHTML = '';
    main.append(h('button', { class: 'icon-btn sh-close', 'aria-label': 'Close settings', onclick: ST.close }, U.icon('x')));
    ({ slideshow, fx, sources, photos, flights, weather, calendar, sync, display, about }[ST.section] || slideshow)(main);
    main.scrollTop = top;
  }

  function slideshow(m) {
    m.append(h('h2', null, 'Slideshow'), h('p', { class: 'lead' }, 'Art is the main event. Everything else stays small and translucent.'),
      row('New picture every', 'Also in the control bar (the ⏱ button)', seg('slideSeconds', [[30, '30s'], [60, '1m'], [120, '2m'], [300, '5m'], [600, '10m'], [900, '15m'], [1800, '30m'], [3600, '1h']], () => { SS.show.schedule(); SS.ui.timerLabel(); })),
      row('Hide everything but the art after', 'Tap the art any time to hide everything (clock too), and tap again to bring it back. On its own, the weather, chips, caption and flight tab also fade after a while; the clock stays (hide it with the clock button). Each new picture shows its caption for a few seconds.', seg('calm', [[10, '10s'], [20, '20s'], [60, '1m'], [300, '5m'], [0, 'Never']])),
      row('Generative art', 'Abstract pieces this app draws itself, in code. Off means only real art and your photos; if nothing can load, recent pieces come round again.', seg('weights.generative', [[-1, 'Off'], [0, 'Only if nothing loads'], [1, 'Now and then'], [2, 'Often']], () => { SS.pool.genChanged(); renderMain(); })),
      SS.pool.genAllowed() ? row('Generative art stays at most', null, seg('genSeconds', [[60, '1m'], [120, '2m'], [300, '5m']], () => SS.show.schedule())) : '',
      row('Art focus', 'Paintings & drawings, or everything museums have (sculpture, textiles, objects…)', seg('artFocus', [['paintings', 'Paintings'], ['everything', 'Everything']], () => { SS.pool.queues = {}; SS.pool.warm(); })),
      row('Framing', 'Smart: art shown whole on a blurred wall, photos fill the screen', seg('fit', [['smart', 'Smart'], ['fill', 'Fill'], ['fit', 'Whole image']])),
      row('Slow zoom (Ken Burns)', null, toggle('kenBurns')),
      row('Caption', 'Source, title, artist and licence for every image', seg('caption', [['full', 'Full'], ['minimal', 'Minimal'], ['off', 'Off']], () => SS.ui.caption.refresh())),
      row('Your photos in the mix', `${SS.settings.personalShare}% of slides when you have photos added`, (() => {
        const r = h('input', { type: 'range', min: 0, max: 100, step: 5 }); r.value = SS.settings.personalShare;
        r.addEventListener('input', () => { r.closest('.row').querySelector('small').textContent = `${r.value}% of slides when you have photos added`; });
        r.addEventListener('change', () => set('personalShare', +r.value));
        return r;
      })()),
      row('Skip to next picture', 'Or press → / swipe', h('button', { class: 'btn', onclick: () => { ST.close(); SS.show.advance(); } }, 'Next')));
  }

  function fx(m) {
    const s = SS.settings;
    m.append(h('h2', null, 'Transitions'), h('p', { class: 'lead' }, `${SS.fx.list.length} transitions (and more variants), from the 2003-era classics to the 3D ones. Tap ▶ to preview one on the next picture.`),
      row('Which ones play', null, seg('fxMode', [['all', 'All'], ['subtle', 'Subtle'], ['classic', 'Classic 2003'], ['exciting', 'Exciting'], ['custom', 'My picks']], () => renderMain())),
      row('Speed', null, seg('speed', [['slow', 'Slow'], ['medium', 'Medium'], ['fast', 'Fast']])),
      row('Show transition name', 'In the control bar when you touch the screen', toggle('fxLabel')));
    const enabled = new Set(SS.show.enabledFx());
    for (const g of ['subtle', 'classic', 'exciting']) {
      m.append(h('div', { class: 'fx-group' }, SS.fx.groups[g]));
      const list = h('div', { class: 'fx-list' });
      SS.fx.list.filter(t => t.group === g).forEach(t => {
        const cb = h('input', { type: 'checkbox' }); cb.checked = enabled.has(t.id);
        cb.addEventListener('change', () => {
          const cur = new Set(SS.show.enabledFx());
          cb.checked ? cur.add(t.id) : cur.delete(t.id);
          s.fxCustom = Array.from(cur); set('fxMode', 'custom'); renderMain();
        });
        list.append(h('div', { class: 'fx-item' }, h('label', null, cb, h('span', null, t.name + (t.variants ? ` (${t.variants.length})` : ''))),
          h('button', { class: 'icon-btn', title: 'Preview', 'aria-label': 'Preview ' + t.name, onclick: () => { ST.close(); SS.show.preview(t.id); } }, U.icon('play'))));
      });
      m.append(list);
    }
  }

  function badge(id) {
    const p = SS.providers[id] || SS.providers.personal, st = SS.pool.status[id];
    if (p.needsServer && !SS.server.available) return h('span', { class: 'badge need' }, 'needs Pi server');
    if (p.needsKey && !SS.settings[p.needsKey]) return h('span', { class: 'badge need' }, 'needs key');
    if (!st) return h('span', { class: 'badge' }, SS.pool.weightOf(id) ? 'waiting' : 'off');
    if (st.state === 'error') return h('span', { class: 'badge err', title: st.msg }, U.truncate(st.msg, 34));
    return h('span', { class: 'badge ok' }, `ready · ${(SS.pool.queues[id] || []).length} queued`);
  }
  function sources(m) {
    m.append(h('h2', null, 'Art & photo sources'), h('p', { class: 'lead' }, 'Every picture shows where it came from and its licence. Turn a source up, down or off. Each source keeps a few pictures lined up (just their details; images download right before they show) and tops up as it goes. Searches jump to a random page anywhere in the results, so over time the whole open collection comes round, not just the top hits.'));
    if (SS.env.cspBlocked) m.append(h('p', { class: 'note' }, 'This hosted preview blocks outside connections, so the museums can\'t load here. Run it from a Pi or computer (see About) and they all switch on.'));
    const groups = [['art', 'Museums (open-access works of art)'], ['photo', 'Photography'], ['space', 'Space'], ['gen', 'Offline']];
    for (const [grp, label] of groups) {
      m.append(h('div', { class: 'fx-group' }, label));
      SS.providerOrder.filter(id => SS.providers[id].group === grp).forEach(id => {
        const p = SS.providers[id];
        m.append(h('div', { class: 'row src-row' },
          h('div', { class: 'lbl' }, h('span', { class: 'cap-dot', style: { '--c': p.color } }), h('div', null, h('b', null, p.name, p.beta ? h('span', { class: 'badge' }, 'beta') : '', badge(id)), h('small', null, p.sub, SS.pool.reach[id] && SS.pool.reach[id].n ? ` · last search: ${U.fmt.int(SS.pool.reach[id].n)} works, picked from anywhere in them` : '', ' · ', link(p.home || '#', 'about')))),
          h('div', { class: 'ctl' }, seg('weights.' + id, id === 'generative' ? [[-1, 'Off'], [0, 'Only if nothing loads'], [1, 'Now and then'], [2, 'Often']] : [[0, 'Off'], [1, 'Low'], [2, 'Normal'], [3, 'High']], () => (id === 'generative' ? SS.pool.genChanged() : SS.pool.warm())))));
        if (id === 'harvard') m.append(row('Harvard API key', 'Free from harvardartmuseums.org/collections/api', text('harvardKey', 'paste key', 'password', 220, () => { SS.pool.cooldown.harvard = 0; SS.pool.warm(); })));
      });
    }
    m.append(h('p', { class: 'note' }, 'Google Arts & Culture has no public API, so it can\'t be pulled in automatically. Windows Spotlight and Bing daily images are fetched by the Pi/computer server (the same endpoints Spotlight-Downloader and SpotlightGallery use) and archived on disk, so the pool grows over time.'));
  }

  let thumbURLs = [];
  function revokeThumbs() { thumbURLs.forEach(u => URL.revokeObjectURL(u)); thumbURLs = []; }
  function photos(m) {
    const P = SS.photos;
    revokeThumbs();
    m.append(h('h2', null, 'My photos'),
      h('p', { class: 'lead' }, `${P.count} photo${P.count === 1 ? '' : 's'} in the mix · ${P.deviceCount} on this device${SS.server.available ? ` · ${P.serverCount} in the Pi folder` : ''}. They never leave your devices.`),
      row('Show my photos', `${SS.settings.personalShare}% of slides (change under Slideshow)`, toggle('personalOn', () => SS.pool.resetPersonal())));
    const bar = h('i'), prog = h('div', { class: 'progress', hidden: true }, bar);
    const go = async files => {
      prog.hidden = false;
      const r = await P.importFiles(files, (i, n) => (bar.style.width = (i / n * 100) + '%'));
      U.toast(`Added ${r.ok} photo${r.ok === 1 ? '' : 's'}${r.bad ? ` · ${r.bad} couldn't be read` : ''}`);
      renderMain();
    };
    const fp = U.$('#filePick'), dp = U.$('#folderPick');
    fp.onchange = () => { go(fp.files); fp.value = ''; };
    dp.onchange = () => { go(dp.files); dp.value = ''; };
    const dz = h('div', { class: 'dropzone' }, 'Drop photos here, or ',
      h('button', { class: 'btn small', onclick: () => fp.click() }, 'Choose photos'), ' ',
      'webkitdirectory' in document.createElement('input') && !/iPhone|iPad|iPod/.test(navigator.userAgent) ? h('button', { class: 'btn small', onclick: () => dp.click() }, 'Choose a folder') : '',
      h('div', { class: 'note' }, 'Photos are resized to 2560 px and kept in this browser. On an iPhone or iPad, pick from your library. Live Photos and HEIC are converted automatically.'), prog);
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); go(e.dataTransfer.files); });
    m.append(dz);
    if (SS.server.available) m.append(h('p', { class: 'note' }, `Pi folder: drop photos into the `, h('span', { class: 'kbd' }, (SS.server.info && SS.server.info.photosDir) || 'photos/'), ` folder on the Pi (subfolders become album names). ${P.serverCount} found. `, h('button', { class: 'btn small', onclick: async () => { await P.refresh(); SS.pool.resetPersonal(); U.toast(`${P.serverCount} photos in the Pi folder`); } }, 'Rescan')));
    const devs = P.metas.filter(x => x.origin === 'device').sort((a, b) => (b.added || 0) - (a.added || 0)).slice(0, 36);
    if (devs.length) {
      const th = h('div', { class: 'thumbs' });
      devs.forEach(meta => {
        const box = h('div', { class: 'th', title: meta.name }, h('button', { 'aria-label': 'Remove', onclick: async () => { await P.remove(meta.id); } }, U.icon('x')));
        th.append(box);
        U.idb.get('photoBlobs', meta.id).then(rec => { if (!rec) return; const u = URL.createObjectURL(rec.blob); thumbURLs.push(u); box.prepend(h('img', { src: u, alt: '' })); }).catch(() => {});
      });
      m.append(h('div', { class: 'fx-group' }, devs.length < P.deviceCount ? `Latest ${devs.length} of ${P.deviceCount}` : 'On this device'), th,
        h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: async e => { if (e.currentTarget.dataset.arm) { await P.clearDevice(); U.toast('Removed photos from this device'); } else { e.currentTarget.dataset.arm = 1; e.currentTarget.textContent = 'Tap again to remove all'; } } }, 'Remove all from this device')));
    }
  }

  function flights(m) {
    const F = SS.flights, st = F.status, after = () => F.restart();
    m.append(h('h2', null, 'Flights'), h('p', { class: 'lead' }, 'The next arrival into SFO, which passes right over Foster City on the 28L/28R approach. It waits behind a small tab in the corner. Tap the tab for the strip, the strip for the plane, and the little radar for the big one (with a compass mode on phones).'),
      row('Flight strip', 'Behind a tab keeps the art clear until you want it', seg('flight.strip', [['tab', 'Behind a tab'], ['always', 'Always showing'], ['off', 'Off']], () => { SS.radar.tuck(); SS.emit('flights'); })),
      row('Flight data', st.mode === 'live' ? `Live · ${st.count} aircraft via ${st.source}` : st.mode === 'sim' ? `Simulated · ${st.msg}` : st.msg || '', seg('flight.mode', [['auto', 'Auto'], ['live', 'Live only'], ['sim', 'Simulated'], ['off', 'Off']], after)),
      row('Your spot', `${get('flight.place')} · ${(+get('flight.lat')).toFixed(4)}, ${(+get('flight.lon')).toFixed(4)}`,
        text('flight.place', 'Label', 'text', 150), text('flight.lat', 'lat', 'number', 96, after), text('flight.lon', 'lon', 'number', 104, after)),
      row('', null,
        h('button', { class: 'btn small', onclick: () => {
          if (!navigator.geolocation) return U.toast('Location isn\'t available in this browser');
          navigator.geolocation.getCurrentPosition(p => { set('flight.lat', +p.coords.latitude.toFixed(4)); set('flight.lon', +p.coords.longitude.toFixed(4)); set('flight.place', 'My location'); after(); renderMain(); }, () => U.toast('Couldn\'t get your location here'), { timeout: 10000 });
        } }, U.icon('pin'), 'Use my location'),
        h('button', { class: 'btn small', onclick: () => { set('flight.lat', SS.DEFAULTS.flight.lat); set('flight.lon', SS.DEFAULTS.flight.lon); set('flight.place', SS.DEFAULTS.flight.place); after(); renderMain(); } }, 'Reset to Foster City')),
      row('Airport', 'IATA code, e.g. SFO, OAK, SJC', text('flight.airport', 'SFO', 'text', 80, after)),
      row('Radar range', null, seg('flight.radius', [[12, '12 nm'], [22, '22 nm'], [35, '35 nm']], after)),
      h('p', { class: 'note' }, 'Positions come from free community ADS-B networks (', link('https://adsb.lol', 'adsb.lol'), ', ', link('https://airplanes.live', 'airplanes.live'), ', ', link('https://adsb.fi', 'adsb.fi'), '). Routes come from ', link('https://www.adsbdb.com', 'adsbdb'), ' and photos of the exact plane from ', link('https://www.planespotters.net', 'Planespotters.net'), '. When there isn\'t one (or the flight is simulated), the card shows a free-licence photo of the same airline and type from ', link('https://commons.wikimedia.org', 'Wikimedia Commons'), ', and you can flip to the app\'s drawing. Photos are always credited. Passenger counts aren\'t broadcast by aircraft, so the strip shows the typical seat range for the type. When live data can\'t be reached, the strip says SIMULATED and shows made-up flights on the real approach path.'),
      h('p', { class: 'note' }, 'Psst: there\'s a hidden tower game. Long-press the flight strip, triple-tap the flight number, or type ↑↑↓↓←→←→BA.'));
  }

  function weather(m) {
    const E = SS.env2;
    m.append(h('h2', null, 'Weather & air'), h('p', { class: 'lead' }, 'Temperature, UV index, air quality and a sneeze outlook. It sits under the clock as a drop-down (tap to open or close), and in the side panel\'s Weather tab.'),
      row('Show weather', null, toggle('env.enabled', () => E.refresh())),
      row('Under the clock', 'Collapsed shows a one-line summary you can tap to drop down', seg('env.show', [['off', 'Hide'], ['compact', 'Collapsed'], ['open', 'Expanded']])),
      row('Units', null, seg('env.units', [['F', '°F · mph'], ['C', '°C · km/h']], () => E.refresh())),
      row('Weather, UV & air quality', E.status.wx === 'ok' ? 'Loaded from Open-Meteo' : E.status.wx || 'Loading…', h('span', { class: 'badge ' + (E.status.wx === 'ok' ? 'ok' : 'err') }, E.status.wx === 'ok' ? 'ok' : 'n/a')),
      h('div', { class: 'fx-group' }, 'Location'), E.locationControls(),
      h('p', { class: 'note' }, 'The sneeze outlook is an estimate, not a pollen count. It combines the typical pollen season for the month with today\'s wind (stirs pollen up), humidity, rain (washes it out) and air quality (smoke, smog and dust irritate noses too). Weather and air quality come from ', link('https://open-meteo.com/', 'Open-Meteo'), ' (free, no key).'));
  }

  function calendar(m) {
    const PL = SS.planner;
    const input = h('input', { type: 'url', placeholder: 'https://… .ics  or  webcal://…', style: { flex: 1, minWidth: '220px' } });
    const add = () => {
      const v = input.value.trim(); if (!/^(https?|webcal):\/\//i.test(v)) return U.toast('Paste the full iCal link');
      SS.settings.icsUrls = Array.from(new Set([...(SS.settings.icsUrls || []), v])); SS.saveSettings(); SS.sync.push();
      input.value = ''; PL.refreshICS().then(renderMain); renderMain();
    };
    m.append(h('h2', null, 'Calendar'), h('p', { class: 'lead' }, 'Subscribe to your calendars by link. They show in the side panel and the next event appears under the clock.'),
      row('Show next event under the clock', null, toggle('agendaChip')),
      h('form', { class: 'url-row', onsubmit: e => { e.preventDefault(); add(); } }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Add')));
    (SS.settings.icsUrls || []).forEach(u => {
      const s = PL.icsStatus[u];
      m.append(h('div', { class: 'url-row' }, h('span', null, u.replace(/(private-|\/)[a-z0-9]{12,}/i, '$1•••')),
        s ? h('span', { class: 'badge ' + (s.ok ? 'ok' : 'err'), style: { flex: 'none' }, title: s.msg || '' }, s.ok ? `${s.n} events` : 'failed') : h('span', { class: 'badge', style: { flex: 'none' } }, 'loading'),
        h('button', { class: 'icon-btn', 'aria-label': 'Remove', onclick: () => { SS.settings.icsUrls = SS.settings.icsUrls.filter(x => x !== u); SS.saveSettings(); SS.sync.push(); PL.refreshICS(); renderMain(); } }, U.icon('trash'))));
    });
    m.append(h('ul', { class: 'list-plain' },
      h('li', null, h('b', null, 'Google Calendar: '), 'Settings → your calendar → Integrate calendar → "Secret address in iCal format".'),
      h('li', null, h('b', null, 'iCloud: '), 'Calendar app → share the calendar → Public Calendar → copy link (webcal://…).'),
      h('li', null, h('b', null, 'Outlook / work: '), 'Settings → Calendar → Shared calendars → Publish a calendar → ICS link (if your IT allows it).')),
      h('p', { class: 'note' }, SS.server.available ? 'Calendars are fetched through your Pi server, so any iCal link works.' : 'Most calendar providers block browsers from reading iCal links directly. Running the Pi/computer server fixes that. Events you add by hand in the panel always work.'));
  }

  function sync(m) {
    const C = SS.cloud, srv = SS.server;
    const where = window.claude ? 'the claude.ai page' : srv.available && !srv.base ? 'your Pi / computer' : /github\.io$/.test(location.hostname) ? 'your GitHub Pages website' : location.hostname || 'this file';
    m.append(h('h2', null, 'Sync & devices'), h('p', { class: 'lead' }, `You're on ${where}. Your to-do board, events and settings can follow you across devices. Here's how each version syncs:`),
      h('ul', { class: 'list-plain' },
        h('li', null, h('b', null, 'claude.ai page: '), 'syncs automatically through your claude.ai account, including your photos. It can\'t reach outside sites, so you get generative art and simulated flights.'),
        h('li', null, h('b', null, 'Raspberry Pi: '), 'everything works, and every screen that opens the Pi\'s address shares the same board, events, calendars and photo folder.'),
        h('li', null, h('b', null, 'Website (GitHub Pages): '), 'everything that browsers can reach works. Add the free Cloudflare Worker below to unlock the rest and sync between devices.')));
    if (window.claude) {
      m.append(row('claude.ai sync', C.describe(), h('span', { class: 'badge ' + (C.status === 'on' ? 'ok' : 'need') }, C.status === 'on' ? 'on' : C.status)),
        row('Sync my photos too', C.assets ? `Uploads your photos to this page's storage in your claude.ai account so your other devices show them${C.usage ? ` · ${(C.usage.bytes / 1e6).toFixed(0)} of ${(C.usage.maxBytes / 1e6).toFixed(0)} MB used` : ''}` : 'Not available for this viewer', toggle('photoSync', on => { if (on) C.uploadPending(); })));
    }
    const status = srv.available ? `Connected${srv.base ? ' to ' + srv.base : ' (this page\'s own server)'} · ${Object.entries(srv.features || {}).filter(([, v]) => v).map(([k]) => k).join(', ')}` : (SS.settings.serverUrl ? 'Not reachable right now' : 'None. Running as a plain website or preview.');
    m.append(h('div', { class: 'fx-group' }, 'Server or proxy'),
      row('Status', status, h('span', { class: 'badge ' + (srv.available ? 'ok' : 'need') }, srv.available ? 'connected' : 'off')),
      row('Server or proxy URL', 'Leave empty on the Pi. On the website, paste your Cloudflare Worker address (https://…workers.dev).', text('serverUrl', 'https://gallery-approach-proxy.you.workers.dev', 'url', 280)),
      row('Sync key', 'The passphrase you set on the worker (SYNC_KEY). Same on every device.', text('syncKey', 'passphrase', 'password', 180)),
      row('', null, h('button', { class: 'btn', onclick: async () => {
        const ok = await SS.server.detect();
        U.toast(ok ? 'Connected' : 'Couldn\'t reach that address');
        if (ok) { SS.sync.pull(); SS.photos.refresh(); SS.pool.cooldown = {}; SS.pool.fails = {}; SS.pool.warm(); SS.planner.refreshICS(); SS.flights.restart(); }
        renderMain();
      } }, 'Connect')),
      h('p', { class: 'note' }, 'Settings like API keys, calendar links and the sync key stay on each device. Your photos always stay on your devices, your Pi, or (if you turn it on above) your claude.ai account.'));
  }

  function display(m) {
    m.append(h('h2', null, 'Display'),
      row('Clock', 'Also the clock button in the control bar, or press K', toggle('clock', () => SS.ui.tickClock())), row('24-hour time', null, toggle('clock24', () => SS.ui.tickClock())),
      row('Night dimming', `Dims the screen between ${SS.settings.night.from} and ${SS.settings.night.to}`, toggle('night.enabled', () => SS.ui.night())),
      row('', null, text('night.from', '22:00', 'time', 110, () => SS.ui.night()), text('night.to', '06:30', 'time', 110, () => SS.ui.night()),
        (() => { const r = h('input', { type: 'range', min: 0.3, max: 0.95, step: 0.05 }); r.value = SS.settings.night.level; r.addEventListener('change', () => { set('night.level', +r.value); SS.ui.night(); }); return r; })()),
      row('Burn-in protection', 'Nudges the clock and captions a few pixels every few minutes (good for OLED and TVs)', toggle('burnIn')),
      row('Sound effects', 'Only used by the hidden game', toggle('sound')),
      row('Full screen', 'Or press F', h('button', { class: 'btn', onclick: () => SS.ui.fullscreen() }, 'Toggle full screen')),
      row('Keep screen awake', SS.ui.wakeState(), h('button', { class: 'btn', onclick: async () => { await SS.ui.wake(); renderMain(); } }, 'Request')));
  }

  function about(m) {
    const srv = SS.server.available;
    m.append(h('h2', null, 'About'),
      h('p', { class: 'lead' }, 'Gallery Approach is a personal screensaver: open-access art and your photos with old-school slide transitions, a whisper of the SFO arrivals overhead, the weather, your calendar, and a to-do board. Just for fun.'),
      row('Running on', srv ? 'Companion server detected: Spotlight, Bing, the Pi photo folder, calendars and sync are on.' : 'Browser only. Museums and NASA work directly; Spotlight, Bing, the Pi photo folder and most calendar links need the server.', h('span', { class: 'badge ' + (srv ? 'ok' : 'need') }, srv ? 'server' : 'static')),
      h('div', { class: 'fx-group' }, 'Shortcuts'),
      h('ul', { class: 'list-plain' }, h('li', null, h('span', { class: 'kbd' }, '←'), ' ', h('span', { class: 'kbd' }, '→'), ' previous / next · ', h('span', { class: 'kbd' }, 'space'), ' pause · ', h('span', { class: 'kbd' }, 'T'), ' transitions · ', h('span', { class: 'kbd' }, 'P'), ' photos · ', h('span', { class: 'kbd' }, 'C'), ' calendar · ', h('span', { class: 'kbd' }, 'K'), ' clock · ', h('span', { class: 'kbd' }, 'H'), ' art only / show all · ', h('span', { class: 'kbd' }, 'R'), ' radar · ', h('span', { class: 'kbd' }, 'S'), ' settings · ', h('span', { class: 'kbd' }, 'F'), ' full screen'), h('li', null, 'Touch: tap the art to hide everything but the art, tap again to bring it all back, swipe left/right to change pictures, tap a caption to see where the picture came from.')),
      h('div', { class: 'fx-group' }, 'Sources & credits'),
      h('ul', { class: 'list-plain' },
        h('li', null, link('https://metmuseum.github.io/', 'The Met Collection API'), ', ', link('https://api.artic.edu/docs/', 'Art Institute of Chicago API'), ', ', link('https://openaccess-api.clevelandart.org/', 'Cleveland Museum of Art Open Access'), ', ', link('https://open.smk.dk/', 'SMK Open'), ', ', link('https://data.rijksmuseum.nl/', 'Rijksmuseum Data Services'), ', ', link('https://developers.vam.ac.uk/', 'V&A Collections API'), ', ', link('https://harvardartmuseums.org/collections/api', 'Harvard Art Museums API')),
        h('li', null, link('https://commons.wikimedia.org/wiki/Commons:Featured_pictures', 'Wikimedia Commons featured pictures'), ' (licence shown per image) · ', link('https://images.nasa.gov/', 'NASA Image and Video Library')),
        h('li', null, 'Windows Spotlight & Bing images via the approach used by ', link('https://github.com/ORelio/Spotlight-Downloader', 'Spotlight-Downloader'), ' and ', link('https://github.com/Qzincs/SpotlightGallery', 'SpotlightGallery'), ' (© the credited photographers)'),
        h('li', null, 'Flights: adsb.lol, airplanes.live, adsb.fi, adsbdb, Planespotters.net · plane photos also from Wikimedia Commons (credited per photo) · Weather & air quality: Open-Meteo (CAMS)'),
        h('li', null, 'Type: Fraunces, Inter, JetBrains Mono (SIL Open Font License)')),
      h('p', { class: 'note' }, 'Personal, non-commercial use. Museum works marked CC0 / public domain are free to use; V&A and Wikimedia images keep the licence shown in their caption.'));
  }
})();
