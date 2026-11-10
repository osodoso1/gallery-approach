/* Weather · UV · Air quality (Open-Meteo, keyless) · Sneeze outlook (an estimate, no key).
   Location: your device's position, a place you search for, or your flight-radar spot. */
(function () {
  'use strict';
  const U = SS.u, h = U.h;
  const EN = (SS.env2 = { wx: null, aq: null, status: {}, locNote: '', openDay: null });

  const WMO = {
    0: ['Clear', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'partly'], 3: ['Overcast', 'cloud'], 45: ['Fog', 'fog'], 48: ['Freezing fog', 'fog'],
    51: ['Light drizzle', 'rain'], 53: ['Drizzle', 'rain'], 55: ['Heavy drizzle', 'rain'], 56: ['Freezing drizzle', 'rain'], 57: ['Freezing drizzle', 'rain'],
    61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'], 66: ['Freezing rain', 'rain'], 67: ['Freezing rain', 'rain'],
    71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'], 80: ['Showers', 'rain'], 81: ['Showers', 'rain'], 82: ['Violent showers', 'rain'],
    85: ['Snow showers', 'snow'], 86: ['Snow showers', 'snow'], 95: ['Thunderstorm', 'storm'], 96: ['Thunderstorm, hail', 'storm'], 99: ['Thunderstorm, hail', 'storm'],
  };
  const ICON = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    partly: '<path d="M8 3v1.5M3.5 8H5M4.8 4.8l1 1M12 6.5a4 4 0 0 0-6.9 2.7"/><path d="M7 19h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 19z"/>',
    cloud: '<path d="M7 19h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 19z"/>',
    fog: '<path d="M4 10h16M3 14h18M5 18h14M7 6h10"/>',
    rain: '<path d="M7 15h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
    snow: '<path d="M7 15h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M9 19h.01M13 19h.01M17 19h.01M11 21.5h.01M15 21.5h.01"/>',
    storm: '<path d="M7 15h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M12 14l-2 4h3l-2 4"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
  };
  EN.WMO = WMO; EN.ICON = ICON;
  EN.uvCat = v => (v == null ? null : v < 3 ? ['Low', '#7ee0a1'] : v < 6 ? ['Moderate', '#f5d76e'] : v < 8 ? ['High', '#ffb547'] : v < 11 ? ['Very high', '#ff6b5e'] : ['Extreme', '#c77dff']);
  EN.aqiCat = v => (v == null ? null : v <= 50 ? ['Good', '#7ee0a1'] : v <= 100 ? ['Moderate', '#f5d76e'] : v <= 150 ? ['Unhealthy for sensitive groups', '#ffb547'] : v <= 200 ? ['Unhealthy', '#ff6b5e'] : v <= 300 ? ['Very unhealthy', '#c77dff'] : ['Hazardous', '#a0303a']);
  /* Sneeze outlook: how allergy-ish today is likely to feel. No pollen counts here, just the usual
     drivers: typical pollen season for the month, wind (stirs pollen up), dry air, rain (washes it
     out), and air quality (smoke, smog and dust irritate noses too). */
  const LEVELS = [['Very low', '#7ee0a1'], ['Low', '#b9e07e'], ['Moderate', '#f5d76e'], ['High', '#ffb547'], ['Very high', '#ff6b5e']];
  const TREE = [0.3, 0.6, 0.9, 1, 0.8, 0.4, 0.1, 0, 0, 0, 0, 0.1];   // Jan…Dec, northern hemisphere
  const GRASS = [0, 0, 0.1, 0.4, 0.9, 1, 0.7, 0.4, 0.2, 0.1, 0, 0];
  const WEED = [0, 0, 0, 0, 0, 0.1, 0.3, 0.7, 1, 0.7, 0.2, 0];
  function sneezeFor(o) {   // o: { month, lat, mph, rh, raining, pop, aqi, pm10 }
    const mm = o.lat < 0 ? (o.month + 6) % 12 : o.month;
    const [kind, top] = [['tree', TREE[mm]], ['grass', GRASS[mm]], ['weed', WEED[mm]]].sort((a, b) => b[1] - a[1])[0];
    const why = [];
    let score = top * 2.2;
    why.push(top >= 0.6 ? `${kind} pollen season` : top >= 0.3 ? `some ${kind} pollen around` : 'a quiet time of year for pollen');
    if (o.mph >= 12) { score += 0.8; why.push('breezy, which stirs pollen up'); } else if (o.mph >= 7) score += 0.3;
    if (o.rh != null && o.rh < 40) { score += 0.4; why.push('dry air'); } else if (o.rh != null && o.rh > 80) score -= 0.3;
    if (o.raining) { score -= 1.2; why.push('rain washing pollen out of the air'); } else if (o.pop >= 60) { score -= 0.3; why.push('rain likely'); }
    if (o.aqi > 100) { score += 1; why.push('poor air quality (smoke or smog irritate noses too)'); } else if (o.aqi > 50) { score += 0.4; why.push('moderate air quality'); }
    if (o.pm10 > 50) { score += 0.4; why.push('dusty air'); }
    const level = U.clamp(Math.round(score), 0, 4);
    return { level, label: LEVELS[level][0], color: LEVELS[level][1], why };
  }
  const isRain = c => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;
  const toMph = v => (v == null ? 0 : isF() ? v : v / 1.609);
  EN.sneeze = function () {
    const w = EN.wx; if (!w) return null;
    return sneezeFor({ month: new Date().getMonth(), lat: EN.loc().lat, mph: toMph(w.wind), rh: w.rh, raining: isRain(w.code), pop: w.rain, aqi: EN.aq && EN.aq.aqi, pm10: EN.aq && EN.aq.pm10 });
  };
  // For a forecast day: daytime wind and humidity (9am–6pm), that day's worst air-quality hour.
  EN.sneezeDay = function (d) {
    const dayH = d.hours.filter(x => { const hh = +x.t.slice(11, 13); return hh >= 9 && hh <= 18; });
    const rhs = dayH.map(x => x.rh).filter(v => v != null), winds = dayH.map(x => x.wind).filter(v => v != null);
    const aq = EN.aq && EN.aq.byDay && EN.aq.byDay[d.date];
    return sneezeFor({
      month: +d.date.slice(5, 7) - 1, lat: EN.loc().lat, mph: toMph(winds.length ? winds.reduce((a, b) => a + b, 0) / winds.length : d.wind), rh: rhs.length ? Math.min(...rhs) : null,
      raining: isRain(d.code) && d.pop >= 50, pop: d.pop, aqi: aq && aq.aqi, pm10: aq && aq.pm10,
    });
  };
  const isF = () => (SS.settings.env.units || 'F') === 'F';
  const deg = v => (v == null ? '—' : Math.round(v) + '°');

  /* ── Location ── */
  EN.loc = function () {
    const L = SS.settings.env.loc || {}, fl = SS.settings.flight;
    if ((L.mode === 'device' || L.mode === 'place') && L.lat != null && L.lon != null) return { lat: L.lat, lon: L.lon, name: L.name || (L.mode === 'device' ? 'My location' : 'Chosen place'), mode: L.mode };
    const sp = SS.flights.spot();
    return { lat: sp.lat, lon: sp.lon, name: sp.place || 'Flight spot', mode: L.mode === 'device' ? 'device-pending' : 'spot' };
  };
  async function placeName(lat, lon) {
    try {
      const d = await U.fetchJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`, { timeout: 8000 });
      return d.city || d.locality || d.principalSubdivision || '';
    } catch (e) { return ''; }
  }
  EN.useDevice = function (fromUser) {
    return new Promise(resolve => {
      const why = !window.isSecureContext ? "this page isn't on HTTPS, so the browser won't share location" : !navigator.geolocation ? "this browser doesn't offer location" : '';
      if (why) { EN.locNote = `Can't use your location: ${why}. Search for a place instead.`; render(); return resolve(false); }
      navigator.geolocation.getCurrentPosition(async p => {
        const lat = +p.coords.latitude.toFixed(3), lon = +p.coords.longitude.toFixed(3);
        const old = SS.settings.env.loc || {};
        const moved = old.lat == null || Math.abs(old.lat - lat) > 0.02 || Math.abs(old.lon - lon) > 0.02;
        const name = moved || !old.name ? (await placeName(lat, lon)) || 'My location' : old.name;
        SS.setSetting('env.loc', { mode: 'device', lat, lon, name });
        EN.locNote = '';
        resolve(true);
      }, err => {
        EN.locNote = (SS.env.cspBlocked || window.claude) ? 'The claude.ai preview can\'t ask for your location. The website and Pi versions can.' : err && err.code === 1 ? 'Location permission was declined. You can allow it in your browser settings, or search for a place.' : 'Couldn\'t get your location right now.';
        if (fromUser) U.toast(EN.locNote, 5000);
        render(); resolve(false);
      }, { timeout: 12000, maximumAge: 30 * 60e3 });
    });
  };
  EN.placeName = placeName;
  EN.search = async function (q) {
    const d = await U.fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`, { timeout: 8000 });
    return (d.results || []).map(r => ({ name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '), short: r.name, lat: r.latitude, lon: r.longitude }));
  };

  /* ── Data ── */
  async function loadWeather() {
    const { lat, lon } = EN.loc();
    const d = await U.fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,uv_index'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,uv_index_max,sunrise,sunset,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max'
      + '&hourly=temperature_2m,precipitation_probability,weather_code,is_day,relative_humidity_2m,wind_speed_10m'
      + `&temperature_unit=${isF() ? 'fahrenheit' : 'celsius'}&wind_speed_unit=${isF() ? 'mph' : 'kmh'}&precipitation_unit=${isF() ? 'inch' : 'mm'}&timezone=auto&forecast_days=7`, { timeout: 12000 });
    const c = d.current || {}, dy = d.daily || {}, hr = d.hourly || {};
    const at = (a, i) => (a ? a[i] : null);
    const hours = (hr.time || []).map((t, i) => ({ t, temp: at(hr.temperature_2m, i), pop: at(hr.precipitation_probability, i), code: at(hr.weather_code, i), day: at(hr.is_day, i), rh: at(hr.relative_humidity_2m, i), wind: at(hr.wind_speed_10m, i) }));
    const days = (dy.time || []).map((date, i) => ({
      date, code: at(dy.weather_code, i), hi: at(dy.temperature_2m_max, i), lo: at(dy.temperature_2m_min, i), feelsHi: at(dy.apparent_temperature_max, i), feelsLo: at(dy.apparent_temperature_min, i),
      uv: at(dy.uv_index_max, i), pop: at(dy.precipitation_probability_max, i), amt: at(dy.precipitation_sum, i), wind: at(dy.wind_speed_10m_max, i), gust: at(dy.wind_gusts_10m_max, i),
      sunrise: at(dy.sunrise, i), sunset: at(dy.sunset, i), hours: hours.filter(x => x.t.slice(0, 10) === date),
    }));
    EN.wx = {
      t: c.temperature_2m, feels: c.apparent_temperature, rh: c.relative_humidity_2m, code: c.weather_code, day: c.is_day, wind: c.wind_speed_10m, uv: c.uv_index,
      hi: days[0] && days[0].hi, lo: days[0] && days[0].lo, uvMax: days[0] && days[0].uv, rain: days[0] && days[0].pop, sunrise: days[0] && days[0].sunrise, sunset: days[0] && days[0].sunset,
      now: (c.time || '').slice(0, 13), days, hours, at: Date.now(),
    };
    EN.status.wx = 'ok';
  }
  async function loadAir() {
    const { lat, lon } = EN.loc();
    const d = await U.fetchJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,ozone&hourly=us_aqi,pm10&forecast_days=5&timezone=auto`, { timeout: 12000 });
    const c = d.current || {}, hr = d.hourly || {};
    const byDay = {};   // the forecast's worst hour each day
    (hr.time || []).forEach((t, i) => {
      const k = t.slice(0, 10), a = hr.us_aqi && hr.us_aqi[i], p = hr.pm10 && hr.pm10[i], o = byDay[k] || (byDay[k] = { aqi: null, pm10: null });
      if (a != null && (o.aqi == null || a > o.aqi)) o.aqi = a;
      if (p != null && (o.pm10 == null || p > o.pm10)) o.pm10 = p;
    });
    EN.aq = { aqi: c.us_aqi, pm25: c.pm2_5, pm10: c.pm10, o3: c.ozone, byDay, at: Date.now() };
    EN.status.aq = c.us_aqi != null ? 'ok' : 'no data here';
  }
  async function refresh(which) {
    if (!SS.settings.env.enabled) { render(); return; }
    const jobs = { wx: loadWeather, aq: loadAir };
    await Promise.all((which || Object.keys(jobs)).map(k => jobs[k]().catch(e => {
      EN.status[k] = SS.env.cspBlocked ? "blocked in the claude.ai preview" : (e && e.message) || 'unavailable';
    })));
    render();
  }
  EN.refresh = refresh;

  /* ── Under-the-clock drop-down ── */
  let host;
  EN.init = function () {
    host = U.$('#wx');
    const L = SS.settings.env.loc || {};
    if (L.mode === 'device') {
      // refresh the position quietly if the browser already allows it; otherwise ask once
      const ask = () => EN.useDevice(false).then(ok => ok && refresh());
      if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: 'geolocation' }).then(p => { if (p.state !== 'denied') ask(); else { EN.locNote = 'Location permission is off for this site.'; render(); } }).catch(ask);
      else ask();
    }
    refresh();
    setInterval(() => refresh(['wx']), 15 * 60e3);
    setInterval(() => refresh(['aq']), 30 * 60e3);
    SS.on('settings', p => { if (p === 'cloud' || /^env\.(loc|units|enabled)|^flight\.(lat|lon)/.test(p || '')) refresh(); else if (/^env/.test(p || '')) rerender(); });
  };

  function chip(label, value, color) { return h('span', { class: 'wx-chip' }, h('i', { style: { background: color } }), h('em', null, label), value); }
  function summaryChips() {
    const out = [], w = EN.wx;
    if (!w) return out;
    const uv = w.uv != null ? w.uv : w.uvMax, uc = EN.uvCat(uv);
    if (uc) out.push(chip('UV', `${Math.round(uv)} ${uc[0]}`, uc[1]));
    const a = EN.aq && EN.aq.aqi, ac = EN.aqiCat(a);
    if (ac) out.push(chip('AQI', `${Math.round(a)} ${ac[0].replace('Unhealthy for sensitive groups', 'Sensitive')}`, ac[1]));
    const sn = EN.sneeze();
    if (sn) out.push(chip('Sneeze', sn.label, sn.color));
    return out;
  }
  const iconFor = (code, day) => { const ic = (WMO[code] || ['', 'cloud'])[1]; return day === 0 && (ic === 'sun' || ic === 'partly') ? 'moon' : ic; };
  const hourLbl = t => { const hh = +t.slice(11, 13); return SS.settings.clock24 ? String(hh).padStart(2, '0') : `${hh % 12 || 12}${hh < 12 ? 'a' : 'p'}`; };
  const dayName = (d, i, long) => (i === 0 ? 'Today' : i === 1 && long ? 'Tomorrow' : new Date(d.date + 'T12:00').toLocaleDateString([], { weekday: long ? 'long' : 'short' }));
  const wind = v => (v == null ? '—' : Math.round(v) + (isF() ? ' mph' : ' km/h'));
  const amount = v => (v == null ? '' : isF() ? (v < 0.01 ? '' : v.toFixed(2) + ' in') : (v < 0.1 ? '' : v.toFixed(1) + ' mm'));
  const row = (k, v) => h('div', { class: 'ec-row' }, h('span', null, k), h('b', null, v));
  const tm = s => (s ? U.fmt.time(new Date(s), SS.settings.clock24) : '—');

  // Hour-by-hour strip: the next 24 hours for today, or the whole day (every 2 hours) for a later day.
  function hourStrip(list, step) {
    const box = h('div', { class: 'wk-hours' });
    list.filter((x, i) => i % step === 0).forEach(x => box.append(h('div', { class: 'wk-hr' },
      h('span', null, hourLbl(x.t)), U.svg(ICON[iconFor(x.code, x.day)]), h('b', null, deg(x.temp)), h('i', null, x.pop >= 20 ? x.pop + '%' : ''))));
    return box;
  }
  function sneezeCard(sn, title) {
    return h('div', { class: 'wx-sneeze', style: { '--c': sn.color } },
      h('div', { class: 'wx-sneeze-h' }, h('span', null, title), h('b', null, sn.label)),
      h('div', { class: 'wx-sneeze-why' }, 'Why: ' + sn.why.join(' · ')));
  }
  function dayView() {
    const w = EN.wx, box = h('div');
    const uvc = EN.uvCat(w.uvMax), ac = EN.aq && EN.aqiCat(EN.aq.aqi);
    const next = w.hours.filter(x => x.t.slice(0, 13) >= w.now).slice(0, 24);
    if (next.length) box.append(hourStrip(next, 2));
    box.append(
      row('Feels like', deg(w.feels)), row('High / low', `${deg(w.hi)} / ${deg(w.lo)}`), row('Chance of rain', w.rain != null ? w.rain + '%' : '—'),
      row('Humidity · wind', `${w.rh != null ? Math.round(w.rh) + '%' : '—'} · ${wind(w.wind)}`),
      row('UV now · today\'s max', `${w.uv != null ? Math.round(w.uv) : '—'} · ${w.uvMax != null ? Math.round(w.uvMax) : '—'}${uvc ? ' (' + uvc[0] + ')' : ''}`),
      EN.aq && EN.aq.aqi != null ? row('Air quality (US AQI)', `${Math.round(EN.aq.aqi)}${ac ? ' · ' + ac[0] : ''}`) : row('Air quality', EN.status.aq || '—'),
      EN.aq && EN.aq.pm25 != null ? row('PM2.5 · ozone', `${EN.aq.pm25.toFixed(1)} · ${EN.aq.o3 != null ? Math.round(EN.aq.o3) : '—'} µg/m³`) : '',
      row('Sunrise · sunset', `${tm(w.sunrise)} · ${tm(w.sunset)}`));
    const sn = EN.sneeze();
    if (sn) box.append(sneezeCard(sn, 'Sneeze outlook'), h('div', { class: 'note' }, 'An estimate from the typical pollen season, wind, humidity, rain and air quality. It isn\'t a pollen count.'));
    return box;
  }
  function weekView() {
    const w = EN.wx, days = w.days || [], box = h('div', { class: 'wk' });
    const lo = Math.min(...days.map(d => d.lo).filter(v => v != null)), hi = Math.max(...days.map(d => d.hi).filter(v => v != null)), span = Math.max(1, hi - lo);
    days.forEach((d, i) => {
      const open = EN.openDay === d.date;
      const l = ((d.lo - lo) / span) * 100, r = ((d.hi - lo) / span) * 100;
      const bar = h('span', { class: 'wk-bar' }, h('i', { style: { left: l + '%', width: Math.max(4, r - l) + '%' } }));
      if (i === 0 && w.t != null) bar.append(h('b', { style: { left: U.clamp((w.t - lo) / span * 100, 0, 100) + '%' } }));
      box.append(h('button', { class: 'wk-row' + (open ? ' open' : ''), 'aria-expanded': open ? 'true' : 'false', onclick: e => { e.stopPropagation(); EN.openDay = open ? null : d.date; rerender(); } },
        h('span', { class: 'wk-day' }, dayName(d, i)), U.svg(ICON[iconFor(d.code, 1)]), h('span', { class: 'wk-pop' }, d.pop >= 20 ? d.pop + '%' : ''),
        h('span', { class: 'wk-lo' }, deg(d.lo)), bar, h('span', { class: 'wk-hi' }, deg(d.hi))));
      if (open) {
        const uvc = EN.uvCat(d.uv), aq = EN.aq && EN.aq.byDay && EN.aq.byDay[d.date], ac = aq && EN.aqiCat(aq.aqi);
        const sn = EN.sneezeDay(d);
        box.append(h('div', { class: 'wk-detail', onclick: e => e.stopPropagation() },
          h('div', { class: 'wk-title' }, `${dayName(d, i, true)}${i > 1 ? ', ' + new Date(d.date + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''} · ${(WMO[d.code] || ['—'])[0]}`),
          d.hours.length ? hourStrip(i === 0 ? d.hours.filter(x => x.t.slice(0, 13) >= w.now) : d.hours, 2) : '',
          row('High / low', `${deg(d.hi)} / ${deg(d.lo)}`), row('Feels like', `${deg(d.feelsHi)} / ${deg(d.feelsLo)}`),
          row('Chance of rain', `${d.pop != null ? d.pop + '%' : '—'}${amount(d.amt) ? ' · ' + amount(d.amt) : ''}`),
          row('Wind · gusts', `${wind(d.wind)} · ${wind(d.gust)}`), row('UV max', d.uv != null ? `${Math.round(d.uv)}${uvc ? ' · ' + uvc[0] : ''}` : '—'),
          aq && aq.aqi != null ? row('Air quality (worst hour)', `${Math.round(aq.aqi)}${ac ? ' · ' + ac[0] : ''}`) : '',
          row('Sunrise · sunset', `${tm(d.sunrise)} · ${tm(d.sunset)}`),
          sneezeCard(sn, 'Sneeze outlook')));
      }
    });
    box.append(h('div', { class: 'note' }, 'Tap a day for hour-by-hour details. Air quality is forecast about 5 days out.'));
    return box;
  }
  function details(compact) {
    const w = EN.wx, box = h('div', { class: 'wx-body' });
    if (w) {
      const view = SS.settings.env.view === 'week' ? 'week' : 'day';
      const seg = h('div', { class: 'seg wx-view' });
      [['day', 'Day'], ['week', 'Week']].forEach(([v, l]) => seg.append(h('button', { class: view === v ? 'on' : '', onclick: e => { e.stopPropagation(); SS.setSetting('env.view', v); } }, l)));
      box.append(seg, view === 'week' && (w.days || []).length ? weekView() : dayView());
    } else {
      box.append(h('p', { class: 'note' }, SS.env.cspBlocked ? "The claude.ai preview can't reach the weather service. On the website or Pi version this fills in automatically." : `Weather isn't loading (${EN.status.wx || 'connecting'}).`));
    }
    box.append(locationControls(compact));
    box.append(h('div', { class: 'fc-src' }, 'Weather & air quality: ', h('a', { href: 'https://open-meteo.com/', target: '_blank', rel: 'noopener noreferrer' }, 'Open-Meteo'), ' (model data, CC BY 4.0). Estimates, not a sensor at your spot.'));
    return box;
  }
  // Re-draw both places the weather shows, keeping your scroll position.
  function rerender() { render(); if (SS.planner && SS.planner.tab === 'weather' && U.$('#panel').classList.contains('open')) SS.planner.render(); }
  function locationControls() {
    const L = EN.loc();
    const wrap = h('div', { class: 'wx-loc' });
    const results = h('div', { class: 'wx-results' });
    const input = h('input', { type: 'text', placeholder: 'Search a city or ZIP…' });
    let tq = null;
    input.addEventListener('input', () => {
      clearTimeout(tq);
      const q = input.value.trim(); if (q.length < 2) { results.innerHTML = ''; return; }
      tq = setTimeout(async () => {
        try {
          const list = await EN.search(q);
          results.innerHTML = '';
          if (!list.length) results.append(h('div', { class: 'empty' }, 'No matches.'));
          list.forEach(r => results.append(h('button', { class: 'wx-result', onclick: () => { SS.setSetting('env.loc', { mode: 'place', lat: r.lat, lon: r.lon, name: r.short }); EN.locNote = ''; } }, r.name)));
        } catch (e) { results.innerHTML = ''; results.append(h('div', { class: 'empty' }, SS.env.cspBlocked ? 'Search is blocked in the claude.ai preview.' : 'Search isn\'t available right now.')); }
      }, 350);
    });
    wrap.append(
      h('div', { class: 'wx-loc-h' }, U.icon('pin'), h('b', null, L.name), h('span', null, L.mode === 'device' ? ' · from your device' : L.mode === 'place' ? ' · chosen place' : L.mode === 'device-pending' ? ' · waiting for your location' : ' · your flight spot')),
      EN.locNote ? h('div', { class: 'note' }, EN.locNote) : '',
      h('div', { class: 'wx-loc-btns' },
        h('button', { class: 'btn small', onclick: e => { e.stopPropagation(); EN.useDevice(true).then(ok => ok && U.toast('Using your location')); } }, U.icon('pin'), 'Use my location'),
        h('button', { class: 'btn small ghost', onclick: e => { e.stopPropagation(); SS.setSetting('env.loc', { mode: 'spot', lat: null, lon: null, name: '' }); } }, 'Use flight spot')),
      input, results);
    return wrap;
  }

  function render() {
    if (!host) return;
    const s = SS.settings.env, show = s.enabled ? (s.show || 'compact') : 'off';
    host.hidden = show === 'off';
    if (host.hidden) { document.body.classList.remove('wx-open'); return; }
    const keepFocus = host.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
    if (keepFocus) return; // don't rebuild while you're typing a place
    const oldDrop = host.querySelector('.wx-drop'), keepScroll = oldDrop ? oldDrop.scrollTop : 0;
    host.innerHTML = '';
    const w = EN.wx, open = show === 'open';
    document.body.classList.toggle('wx-open', open);
    const [desc, ic] = (w && WMO[w.code]) || ['', 'cloud'];
    const icon = w && !w.day && (ic === 'sun' || ic === 'partly') ? 'moon' : ic;
    const head = h('button', { class: 'wx-head' + (open ? ' open' : ''), 'aria-expanded': open ? 'true' : 'false', onclick: e => { e.stopPropagation(); SS.setSetting('env.show', open ? 'compact' : 'open'); } },
      U.svg(ICON[icon]), w ? h('b', null, deg(w.t)) : h('b', null, 'Weather'), w ? h('span', null, `${desc} · H ${deg(w.hi)} L ${deg(w.lo)}`) : h('span', null, SS.env.cspBlocked ? 'not available in preview' : 'loading…'),
      U.svg(ICON.chevron));
    host.append(head);
    const chips = summaryChips();
    if (chips.length) host.append(h('div', { class: 'wx-chips', onclick: e => { e.stopPropagation(); SS.setSetting('env.show', open ? 'compact' : 'open'); } }, chips));
    if (open) {
      const dd = h('div', { class: 'wx-drop', onclick: e => e.stopPropagation() }, details(true),
        h('div', { class: 'wx-loc-btns' }, h('button', { class: 'btn small', onclick: () => { SS.setSetting('env.show', 'compact'); SS.wxscreen.open(); } }, 'Weather screen'), h('button', { class: 'btn small ghost', onclick: () => SS.setSetting('env.show', 'compact') }, 'Collapse'), h('button', { class: 'btn small ghost', onclick: () => { SS.setSetting('env.show', 'off'); U.toast('Weather hidden. Turn it back on in the panel (Weather tab) or Settings.'); } }, 'Hide weather')));
      host.append(dd);
      dd.scrollTop = keepScroll;
      if (keepScroll) dd.style.animation = 'none';
    }
    if (SS.planner && SS.planner.tab === 'weather') SS.emit('agenda');
  }
  EN.render = render;
  EN.locationControls = locationControls;

  /* ── Weather tab in the side panel ── */
  EN.renderPanel = function (body) {
    const w = EN.wx, s = SS.settings.env;
    const [desc, ic] = (w && WMO[w.code]) || ['', 'cloud'];
    body.append(
      h('div', { class: 'wx-big' }, U.svg(ICON[w && !w.day && (ic === 'sun' || ic === 'partly') ? 'moon' : ic]), h('div', null, h('b', null, w ? deg(w.t) : '—'), h('span', null, desc || (SS.env.cspBlocked ? 'Not available in the claude.ai preview' : 'Loading…')))),
      h('div', { class: 'wx-chips left' }, summaryChips()),
      h('div', { class: 'row' }, h('div', { class: 'lbl' }, h('b', null, 'Show under the clock'), h('small', null, 'Collapsed shows a one-line summary; tap it to drop down the details')),
        h('div', { class: 'ctl' }, (() => { const seg = h('div', { class: 'seg' }); [['off', 'Hide'], ['compact', 'Collapsed'], ['open', 'Expanded']].forEach(([v, l]) => seg.append(h('button', { class: (s.enabled ? s.show : 'off') === v ? 'on' : '', onclick: () => { if (v !== 'off' && !s.enabled) SS.setSetting('env.enabled', true); SS.setSetting('env.show', v); SS.planner.render(); } }, l))); return seg; })())),
      details(false));
  };
})();
