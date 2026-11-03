/* Side panel: Agenda (iCal subscriptions + local events) and a small to-do board. */
(function () {
  'use strict';
  const U = SS.u;
  const PL = (SS.planner = { tab: U.store.get('panelTab', 'agenda'), sel: dayKey(new Date()), month: null, ics: [], icsStatus: {} });

  function dayKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  /* ── iCalendar parsing (VEVENT, TZID, all-day, RRULE, EXDATE, overrides) ── */
  const WIN_TZ = { 'Pacific Standard Time': 'America/Los_Angeles', 'Mountain Standard Time': 'America/Denver', 'Central Standard Time': 'America/Chicago', 'Eastern Standard Time': 'America/New_York', 'GMT Standard Time': 'Europe/London', 'UTC': 'UTC', 'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris', 'India Standard Time': 'Asia/Kolkata', 'Tokyo Standard Time': 'Asia/Tokyo', 'China Standard Time': 'Asia/Shanghai', 'Hawaiian Standard Time': 'Pacific/Honolulu', 'Alaskan Standard Time': 'America/Anchorage' };
  const dtfCache = {};
  function tzOffset(ms, tz) {
    let f = dtfCache[tz];
    if (!f) f = dtfCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = {}; f.formatToParts(new Date(ms)).forEach(x => (p[x.type] = x.value));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
  }
  function zoned(y, mo, d, h, mi, s, tz) {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s);
    try {
      let t = guess - tzOffset(guess, tz);
      const o2 = tzOffset(t, tz); t = guess - o2;
      return new Date(t);
    } catch (e) { return new Date(y, mo - 1, d, h, mi, s); }
  }
  function icsDate(val, params) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(val || '');
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    if (!h || (params && params.VALUE === 'DATE')) return { date: new Date(+y, +mo - 1, +d), allDay: true };
    if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false };
    let tz = params && params.TZID ? params.TZID.replace(/^"|"$/g, '') : null;
    if (tz && WIN_TZ[tz]) tz = WIN_TZ[tz];
    if (tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return { date: zoned(+y, +mo, +d, +h, +mi, +s, tz), allDay: false }; } catch (e) { /* unknown tz → local */ } }
    return { date: new Date(+y, +mo - 1, +d, +h, +mi, +s), allDay: false };
  }
  function unescape(v) { return (v || '').replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim(); }

  PL.parseICS = function (text, calName, color) {
    const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
    const evs = []; let cur = null, name = calName;
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; continue; }
      if (line === 'END:VEVENT') { if (cur && cur.start) evs.push(cur); cur = null; continue; }
      const ci = line.indexOf(':'); if (ci < 0) continue;
      const head = line.slice(0, ci), val = line.slice(ci + 1);
      const [prop, ...ps] = head.split(';');
      const params = {}; ps.forEach(p => { const [k, v] = p.split('='); params[k.toUpperCase()] = v; });
      if (!cur) { if (prop === 'X-WR-CALNAME' && !calName) name = unescape(val); continue; }
      if (prop === 'SUMMARY') cur.title = unescape(val);
      else if (prop === 'LOCATION') cur.location = unescape(val);
      else if (prop === 'UID') cur.uid = val;
      else if (prop === 'STATUS') cur.status = val;
      else if (prop === 'DTSTART') { const r = icsDate(val, params); if (r) { cur.start = r.date; cur.allDay = r.allDay; } }
      else if (prop === 'DTEND') { const r = icsDate(val, params); if (r) cur.end = r.date; }
      else if (prop === 'DURATION') cur.duration = val;
      else if (prop === 'RRULE') cur.rrule = val;
      else if (prop === 'EXDATE') val.split(',').forEach(v => { const r = icsDate(v, params); if (r) cur.exdates.push(r.date.getTime()); });
      else if (prop === 'RECURRENCE-ID') { const r = icsDate(val, params); if (r) cur.recurId = r.date.getTime(); }
    }
    evs.forEach(e => {
      if (!e.end) {
        const m = e.duration && /P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(e.duration);
        e.end = new Date(e.start.getTime() + (m ? ((+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 60000 : (e.allDay ? 864e5 : 36e5)));
      }
      e.cal = name || 'Calendar'; e.color = color;
    });
    return evs;
  };

  const DAYS = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
  function expand(ev, from, to) {
    const dur = ev.end - ev.start;
    if (!ev.rrule) return ev.end >= from && ev.start <= to ? [{ ...ev }] : [];
    const r = {}; ev.rrule.split(';').forEach(p => { const [k, v] = p.split('='); r[k] = v; });
    const freq = r.FREQ, interval = +r.INTERVAL || 1, count = r.COUNT ? +r.COUNT : Infinity;
    const until = r.UNTIL ? icsDate(r.UNTIL).date.getTime() : Infinity;
    const byday = r.BYDAY ? r.BYDAY.split(',').map(x => { const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x); return m ? { n: m[1] ? +m[1] : 0, d: DAYS[m[2]] } : null; }).filter(Boolean) : null;
    const bymd = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null;
    const s0 = ev.start, H = s0.getHours(), Mi = s0.getMinutes();
    const out = []; let n = 0;
    const emit = d => {
      const t = d.getTime();
      if (t < s0.getTime()) return true;
      if (t > until || n >= count) return false;
      n++;
      if (ev.exdates.includes(t)) return true;
      if (t + dur >= from.getTime() && t <= to.getTime()) out.push({ ...ev, start: new Date(t), end: new Date(t + dur), occ: t });
      return t <= to.getTime();
    };
    const at = (y, m, d) => new Date(y, m, d, H, Mi, s0.getSeconds());
    let guard = 0;
    if (freq === 'DAILY') { for (let d = new Date(s0); guard++ < 4000; d = at(d.getFullYear(), d.getMonth(), d.getDate() + interval)) if (!emit(d)) break; }
    else if (freq === 'WEEKLY') {
      const days = byday ? byday.map(b => b.d) : [s0.getDay()];
      const ws = at(s0.getFullYear(), s0.getMonth(), s0.getDate() - ((s0.getDay() + 6) % 7));
      outer: for (let w = 0; guard++ < 3000; w += interval) {
        const sorted = days.map(d => (d + 6) % 7).sort((a, b) => a - b);
        for (const off of sorted) { const d = at(ws.getFullYear(), ws.getMonth(), ws.getDate() + w * 7 + off); if (!emit(d)) break outer; }
      }
    } else if (freq === 'MONTHLY') {
      outer2: for (let k = 0; guard++ < 1200; k += interval) {
        const y = s0.getFullYear(), m = s0.getMonth() + k;
        const first = new Date(y, m, 1), Y = first.getFullYear(), M = first.getMonth(), last = new Date(Y, M + 1, 0).getDate();
        let dates = [];
        if (byday) byday.forEach(b => {
          const all = []; for (let d = 1; d <= last; d++) if (new Date(Y, M, d).getDay() === b.d) all.push(d);
          if (b.n > 0 && all[b.n - 1]) dates.push(all[b.n - 1]); else if (b.n < 0 && all[all.length + b.n]) dates.push(all[all.length + b.n]); else if (!b.n) dates.push(...all);
        });
        else dates = (bymd || [s0.getDate()]).map(d => (d < 0 ? last + d + 1 : d)).filter(d => d <= last);
        for (const d of dates.sort((a, b) => a - b)) if (!emit(at(Y, M, d))) break outer2;
      }
    } else if (freq === 'YEARLY') { for (let k = 0; guard++ < 200; k += interval) if (!emit(at(s0.getFullYear() + k, s0.getMonth(), s0.getDate()))) break; }
    else return ev.end >= from && ev.start <= to ? [{ ...ev }] : [];
    return out;
  }

  PL.refreshICS = async function () {
    const urls = SS.settings.icsUrls || [];
    const colors = ['#ffb547', '#6fd3ff', '#7ee0a1', '#ff8fb1', '#b18cf0'];
    const all = [];
    if (urls.length && SS.server.available) await SS.sync.pushNow(); // the server only proxies calendar links it knows about
    await Promise.all(urls.map(async (u, i) => {
      const url = u.replace(/^webcal:\/\//i, 'https://');
      try {
        const txt = await U.fetchText(url, { timeout: 20000 });
        if (!/BEGIN:VCALENDAR/.test(txt)) throw new Error('not an iCal feed');
        const evs = PL.parseICS(txt, null, colors[i % colors.length]);
        all.push(...evs);
        PL.icsStatus[u] = { ok: true, n: evs.length, at: Date.now() };
      } catch (e) {
        PL.icsStatus[u] = { ok: false, msg: SS.server.available ? (e.message || 'failed') : 'blocked by the browser (CORS). Run the Pi server to load it.' };
      }
    }));
    PL.ics = all;
    SS.emit('agenda');
  };

  PL.eventsBetween = function (from, to) {
    const out = [];
    const masters = [], overrides = new Map();
    for (const e of PL.ics) {
      if (e.status === 'CANCELLED' && !e.recurId) continue;
      if (e.recurId) overrides.set((e.uid || '') + '|' + e.recurId, e); else masters.push(e);
    }
    for (const e of masters) for (const o of expand(e, from, to)) {
      const ov = overrides.get((e.uid || '') + '|' + (o.occ || o.start.getTime()));
      if (ov) { if (ov.status !== 'CANCELLED' && ov.end >= from && ov.start <= to) out.push({ ...ov, cal: e.cal, color: e.color }); }
      else out.push(o);
    }
    for (const ov of overrides.values()) if (!masters.some(m => m.uid === ov.uid) && ov.end >= from && ov.start <= to) out.push(ov);
    for (const e of SS.state.events) {
      const s = new Date(e.start), en = new Date(e.end || e.start);
      if (en >= from && s <= to) out.push({ ...e, start: s, end: en, local: true, cal: 'This screen', color: '#f4f1ea' });
    }
    return out.sort((a, b) => a.start - b.start);
  };
  PL.next = function () {
    const now = new Date(), until = new Date(now.getTime() + 14 * 3600e3);
    return PL.eventsBetween(now, until).find(e => !e.allDay && e.end > now) || null;
  };

  /* ── Panel UI ── */
  let panel;
  PL.init = function () {
    panel = U.$('#panel');
    SS.on('agenda', render); SS.on('state', render);
    render();
    PL.refreshICS();
    setInterval(PL.refreshICS, 15 * 60e3);
    setInterval(() => { if (panel.classList.contains('open')) render(); }, 60e3);
  };
  PL.open = (tab) => { if (tab) PL.tab = tab; render(); panel.classList.add('open'); document.body.classList.add('panel-open'); };
  PL.close = () => { panel.classList.remove('open'); document.body.classList.remove('panel-open'); };
  PL.toggle = () => (panel.classList.contains('open') ? PL.close() : PL.open());
  PL.render = () => render();

  function render() {
    if (!panel) return;
    if (panel.classList.contains('open') && document.activeElement && document.activeElement.closest && document.activeElement.closest('#panel .wx-loc')) return; // typing a place
    const keepScroll = panel.querySelector('.pn-body') ? panel.querySelector('.pn-body').scrollTop : 0;
    const now = new Date();
    panel.innerHTML = '';
    const tabs = U.h('div', { class: 'seg pn-tabs' },
      U.h('button', { class: PL.tab === 'agenda' ? 'on' : '', onclick: () => { PL.tab = 'agenda'; U.store.set('panelTab', 'agenda'); render(); } }, 'Agenda'),
      U.h('button', { class: PL.tab === 'board' ? 'on' : '', onclick: () => { PL.tab = 'board'; U.store.set('panelTab', 'board'); render(); } }, `To-do · ${SS.state.board.filter(c => c.col !== 'done').length}`),
      U.h('button', { class: PL.tab === 'weather' ? 'on' : '', onclick: () => { PL.tab = 'weather'; U.store.set('panelTab', 'weather'); render(); } }, 'Weather'));
    panel.append(
      U.h('div', { class: 'pn-head' },
        U.h('div', { class: 'pn-date' }, U.h('small', null, now.toLocaleDateString([], { weekday: 'long' })), now.toLocaleDateString([], { month: 'long', day: 'numeric' })),
        U.h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: PL.close }, U.icon('x'))),
      tabs);
    const body = U.h('div', { class: 'pn-body' });
    panel.append(body);
    if (PL.tab === 'board') renderBoard(body); else if (PL.tab === 'weather') SS.env2.renderPanel(body); else renderAgenda(body);
    body.scrollTop = keepScroll;
  }

  function fmtTime(d) { return U.fmt.time(d, SS.settings.clock24).replace(' ', ' '); }

  function renderAgenda(body) {
    const today = startOfDay(new Date());
    const m = PL.month || new Date(today.getFullYear(), today.getMonth(), 1);
    PL.month = m;
    const first = new Date(m.getFullYear(), m.getMonth(), 1), gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    const gridEnd = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 42);
    const evs = PL.eventsBetween(gridStart, gridEnd);
    const perDay = {};
    evs.forEach(e => {
      const s0 = startOfDay(e.start) < gridStart ? gridStart : startOfDay(e.start);
      for (let d = s0, i = 0; (d < e.end || dayKey(d) === dayKey(e.start)) && d < gridEnd && i < 43; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), i++) (perDay[dayKey(d)] = perDay[dayKey(d)] || []).push(e);
    });
    const grid = U.h('div', { class: 'cal-grid' }, ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => U.h('div', { class: 'dow' }, d)));
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i), k = dayKey(d);
      const n = (perDay[k] || []).length;
      grid.append(U.h('button', {
        class: 'cal-day' + (d.getMonth() !== m.getMonth() ? ' other' : '') + (k === dayKey(today) ? ' today' : '') + (k === PL.sel ? ' sel' : ''),
        onclick: () => { PL.sel = k; render(); },
      }, String(d.getDate()), n ? U.h('span', { class: 'dots' }, Array.from({ length: Math.min(3, n) }, () => U.h('i'))) : ''));
    }
    body.append(
      U.h('div', { class: 'cal-month' },
        U.h('button', { class: 'icon-btn', 'aria-label': 'Previous month', onclick: () => { PL.month = new Date(m.getFullYear(), m.getMonth() - 1, 1); render(); } }, U.icon('left')),
        m.toLocaleDateString([], { month: 'long', year: 'numeric' }),
        U.h('button', { class: 'icon-btn', 'aria-label': 'Next month', onclick: () => { PL.month = new Date(m.getFullYear(), m.getMonth() + 1, 1); render(); } }, U.icon('right'))),
      grid);

    const [y, mo, dd] = PL.sel.split('-').map(Number), selDate = new Date(y, mo - 1, dd);
    const dayEvs = PL.eventsBetween(selDate, new Date(y, mo - 1, dd, 23, 59, 59));
    const now = new Date();
    const sec = U.h('div', { class: 'pn-section' }, U.h('div', { class: 'pn-h' }, selDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }),
      U.h('button', { class: 'btn small ghost', onclick: () => showForm(sec, selDate) }, U.icon('plus'), 'Event')));
    if (!dayEvs.length) sec.append(U.h('div', { class: 'empty' }, SS.settings.icsUrls.length ? 'Nothing scheduled.' : 'Nothing scheduled. Add your Google, iCloud or Outlook calendar link in Settings → Calendar.'));
    dayEvs.forEach(e => sec.append(evRow(e, now)));
    body.append(sec);

    const upFrom = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate() + 1), upTo = new Date(upFrom.getTime() + 6 * 864e5);
    const up = PL.eventsBetween(upFrom, upTo).slice(0, 12);
    if (up.length) {
      const s2 = U.h('div', { class: 'pn-section' }, U.h('div', { class: 'pn-h' }, 'Coming up'));
      up.forEach(e => s2.append(evRow(e, now, true)));
      body.append(s2);
    }
  }
  function evRow(e, now, withDay) {
    const live = e.start <= now && e.end > now;
    const time = e.allDay ? 'All day' : fmtTime(e.start);
    return U.h('div', { class: 'ev' + (live ? ' now' : ''), style: { '--c': e.color } },
      U.h('div', { class: 'ev-time' }, withDay ? U.h('div', null, e.start.toLocaleDateString([], { weekday: 'short' })) : '', time),
      U.h('div', null, U.h('div', { class: 'ev-title' }, e.title || '(untitled)'), U.h('div', { class: 'ev-sub' }, [e.location, e.cal].filter(Boolean).join(' · '))),
      e.local ? U.h('button', { class: 'icon-btn', 'aria-label': 'Delete event', onclick: () => { SS.state.events = SS.state.events.filter(x => x.id !== e.id); SS.saveState(); } }, U.icon('trash')) : '');
  }
  function showForm(sec, date) {
    if (sec.querySelector('.form-card')) return;
    const title = U.h('input', { type: 'text', placeholder: 'What’s happening?' });
    const dt = U.h('input', { type: 'date', value: dayKey(date) });
    const t1 = U.h('input', { type: 'time', value: '09:00' }), t2 = U.h('input', { type: 'time', value: '10:00' });
    const f = U.h('form', { class: 'form-card', onsubmit: e => {
      e.preventDefault();
      if (!title.value.trim()) return title.focus();
      const [Y, M, D] = dt.value.split('-').map(Number), [h1, m1] = t1.value.split(':').map(Number), [h2, m2] = t2.value.split(':').map(Number);
      const s = new Date(Y, M - 1, D, h1, m1), en = new Date(Y, M - 1, D, h2, m2);
      SS.state.events.push({ id: U.uid(), title: title.value.trim(), start: s.getTime(), end: Math.max(en.getTime(), s.getTime() + 15 * 60e3) });
      SS.saveState();
    } }, title, U.h('div', { class: 'r' }, dt), U.h('div', { class: 'r' }, t1, t2), U.h('div', { class: 'r' }, U.h('button', { class: 'btn primary', type: 'submit' }, 'Add to this screen'), U.h('button', { class: 'btn', type: 'button', onclick: () => f.remove() }, 'Cancel')));
    sec.insertBefore(f, sec.children[1] || null);
    title.focus();
  }

  /* ── Board ── */
  const COLS = [['todo', 'To do'], ['doing', 'Doing'], ['done', 'Done']];
  function renderBoard(body) {
    const input = U.h('input', { type: 'text', placeholder: 'Add a task and press Enter' });
    const add = () => { const t = input.value.trim(); if (!t) return; SS.state.board.unshift({ id: U.uid(), text: t, col: 'todo' }); SS.saveState(); };
    body.append(U.h('form', { class: 'board-add', onsubmit: e => { e.preventDefault(); add(); } }, input, U.h('button', { class: 'btn primary', type: 'submit' }, U.icon('plus'), 'Add')));
    for (const [col, name] of COLS) {
      const cards = SS.state.board.filter(c => c.col === col);
      const lane = U.h('div', { class: 'lane', dataset: { col } },
        U.h('div', { class: 'lane-h' }, name, U.h('span', { class: 'n' }, String(cards.length)),
          col === 'done' && cards.length ? U.h('button', { class: 'btn small ghost', onclick: () => { SS.state.board = SS.state.board.filter(c => c.col !== 'done'); SS.saveState(); } }, 'Clear') : ''));
      if (!cards.length) lane.append(U.h('div', { class: 'empty' }, col === 'todo' ? 'All clear.' : 'Drag a card here.'));
      cards.forEach(c => lane.append(cardEl(c)));
      body.append(lane);
    }
  }
  function move(id, col, beforeId) {
    const b = SS.state.board, i = b.findIndex(c => c.id === id);
    if (i < 0) return;
    const [c] = b.splice(i, 1); c.col = col;
    const j = beforeId ? b.findIndex(x => x.id === beforeId) : -1;
    if (j >= 0) b.splice(j, 0, c); else { let k = -1; b.forEach((x, idx) => { if (x.col === col) k = idx; }); b.splice(k + 1, 0, c); }
    SS.saveState();
  }
  function cardEl(c) {
    const idx = COLS.findIndex(x => x[0] === c.col);
    const el = U.h('div', { class: 'card', dataset: { id: c.id } },
      U.h('span', { class: 't' }, c.text),
      idx > 0 ? U.h('button', { class: 'icon-btn', 'aria-label': 'Move back', onclick: e => { e.stopPropagation(); move(c.id, COLS[idx - 1][0]); } }, U.icon('left')) : '',
      idx < 2 ? U.h('button', { class: 'icon-btn', 'aria-label': 'Move forward', onclick: e => { e.stopPropagation(); move(c.id, COLS[idx + 1][0]); } }, U.icon('right')) : '',
      U.h('button', { class: 'icon-btn', 'aria-label': 'Delete', onclick: e => { e.stopPropagation(); SS.state.board = SS.state.board.filter(x => x.id !== c.id); SS.saveState(); } }, U.icon('trash')));
    // drag between lanes (mouse + touch)
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const sx = e.clientX, sy = e.clientY; let ghost = null, over = null;
      const mv = ev => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        if (!ghost) { const r = el.getBoundingClientRect(); ghost = el.cloneNode(true); ghost.classList.add('ghost'); ghost.style.width = r.width + 'px'; document.body.append(ghost); el.classList.add('placeholder'); }
        ghost.style.left = (ev.clientX - 30) + 'px'; ghost.style.top = (ev.clientY - 18) + 'px';
        const t = document.elementFromPoint(ev.clientX, ev.clientY), lane = t && t.closest('.lane');
        U.$$('.lane', panel).forEach(l => l.classList.toggle('drop', l === lane));
        over = { lane, before: t && t.closest('.card:not(.placeholder)') };
      };
      const up = () => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        if (ghost) { ghost.remove(); el.classList.remove('placeholder'); if (over && over.lane) move(c.id, over.lane.dataset.col, over.before && over.before.dataset.id !== c.id ? over.before.dataset.id : null); else render(); }
      };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
    return el;
  }
})();
