/* Image sources + the weighted mixer.
   Every item carries its own attribution: source, title, creator, date, licence, link. */
(function () {
  'use strict';
  const U = SS.u;
  const P = (SS.providers = {});
  const ORDER = [];
  const def = p => { P[p.id] = p; ORDER.push(p.id); };
  SS.providerOrder = ORDER;

  const big = () => Math.max(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2) > 1700;
  const paintings = () => SS.settings.artFocus === 'paintings';
  const TERMS = ['landscape', 'sea', 'river', 'garden', 'flowers', 'night', 'winter', 'harbor', 'mountain', 'city', 'sunset', 'forest', 'still life', 'boats', 'moon', 'bridge', 'snow', 'evening', 'clouds', 'birds', 'lake', 'coast', 'trees', 'street'];
  const cleanMaker = s => (s || '').replace(/\s*\((?:[^()]|\([^()]*\))*\)\s*$/, '').trim();

  /* ── Museums ─────────────────────────────────────────── */
  def({
    id: 'met', name: 'The Met', sub: 'Open Access · CC0', color: '#e5484d', group: 'art', home: 'https://www.metmuseum.org/about-the-met/policies-and-documents/open-access',
    async fetchBatch() {
      const q = U.pick(TERMS);
      const dept = paintings() ? `&departmentId=${U.pick([11, 11, 11, 6, 9])}` : '&isHighlight=true';
      const s = await U.fetchJSON(`https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true${dept}&q=${encodeURIComponent(q)}`);
      const ids = U.shuffle(s.objectIDs || []).slice(0, 10);
      const objs = await Promise.allSettled(ids.map(id => U.fetchJSON(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)));
      return objs.filter(r => r.status === 'fulfilled').map(r => r.value)
        .filter(o => o && o.isPublicDomain && (o.primaryImage || o.primaryImageSmall))
        .map(o => ({
          key: 'met:' + o.objectID, src: 'met', kind: 'art',
          urls: big() ? [o.primaryImage, o.primaryImageSmall] : [o.primaryImageSmall, o.primaryImage],
          title: o.title, creator: o.artistDisplayName || o.culture || o.department, date: o.objectDate, detail: o.medium,
          credit: o.creditLine, license: 'Public domain · CC0',
          link: o.objectURL || `https://www.metmuseum.org/art/collection/search/${o.objectID}`,
        }));
    },
  });

  def({
    id: 'aic', name: 'Art Institute of Chicago', short: 'AIC', sub: 'Public domain · CC0', color: '#c2362b', group: 'art', home: 'https://api.artic.edu/docs/',
    async fetchBatch() {
      const q = U.pick(TERMS);
      const d = await U.fetchJSON(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&query[term][is_public_domain]=true&fields=id,title,artist_title,artist_display,date_display,image_id,thumbnail,credit_line,medium_display,artwork_type_title&limit=40&page=${U.randInt(1, 4)}`);
      const base = (d.config && d.config.iiif_url) || 'https://www.artic.edu/iiif/2';
      return (d.data || []).filter(a => a.image_id && (!paintings() || /paint|print|drawing|watercolor/i.test(a.artwork_type_title || '')))
        .map(a => ({
          key: 'aic:' + a.id, src: 'aic', kind: 'art',
          urls: [`${base}/${a.image_id}/full/1686,/0/default.jpg`, `${base}/${a.image_id}/full/843,/0/default.jpg`],
          title: a.title, creator: a.artist_title || cleanMaker((a.artist_display || '').split('\n')[0]), date: a.date_display,
          detail: a.medium_display, credit: a.credit_line, license: 'Public domain · CC0', link: `https://www.artic.edu/artworks/${a.id}`,
        }));
    },
  });

  def({
    id: 'cleveland', name: 'Cleveland Museum of Art', short: 'CMA', sub: 'Open Access · CC0', color: '#3d7be0', group: 'art', home: 'https://openaccess-api.clevelandart.org/',
    async fetchBatch() {
      const p = paintings();
      const d = await U.fetchJSON(`https://openaccess-api.clevelandart.org/api/artworks/?cc0=1&has_image=1&limit=30&skip=${U.randInt(0, p ? 3000 : 28000)}${p ? '&type=Painting' : ''}`);
      return (d.data || []).filter(a => a.images && (a.images.web || a.images.print)).map(a => ({
        key: 'cma:' + a.id, src: 'cleveland', kind: 'art',
        urls: big() ? [a.images.print && a.images.print.url, a.images.web && a.images.web.url] : [a.images.web && a.images.web.url, a.images.print && a.images.print.url],
        title: a.title, creator: cleanMaker(a.creators && a.creators[0] && a.creators[0].description) || a.culture && a.culture[0], date: a.creation_date,
        detail: a.technique, credit: a.creditline, license: 'Public domain · CC0', link: a.url,
      }));
    },
  });

  def({
    id: 'smk', name: 'SMK — National Gallery of Denmark', short: 'SMK', sub: 'Public domain', color: '#2fb59a', group: 'art', home: 'https://open.smk.dk/',
    async fetchBatch() {
      const p = paintings();
      const f = v => 'filters=' + encodeURIComponent(v);
      const url = `https://api.smk.dk/api/v1/art/search/?keys=${encodeURIComponent(p ? '*' : U.pick(TERMS))}&${f('[has_image:true]')}&${f('[public_domain:true]')}${p ? '&' + f('[object_names:maleri]') : ''}&offset=${U.randInt(0, p ? 1400 : 600)}&rows=30&lang=en`;
      const d = await U.fetchJSON(url);
      return (d.items || []).filter(a => a.image_thumbnail || a.image_native).map(a => {
        const iiif = a.image_iiif_id ? `${a.image_iiif_id}/full/!2048,2048/0/default.jpg` : null;
        const bigger = a.image_thumbnail ? a.image_thumbnail.replace(/\/full\/[^/]+\//, '/full/!2048,2048/') : null;
        const title = (a.titles && a.titles[0] && a.titles[0].title) || 'Untitled';
        const pr = a.production && a.production[0];
        return {
          key: 'smk:' + a.object_number, src: 'smk', kind: 'art',
          urls: [iiif, bigger, a.image_native, a.image_thumbnail],
          title, creator: pr ? (pr.creator || [pr.creator_forename, pr.creator_surname].filter(Boolean).join(' ')) : '',
          date: a.production_date && a.production_date[0] && a.production_date[0].period,
          license: 'Public domain', link: `https://open.smk.dk/artwork/image/${encodeURIComponent(a.object_number)}`,
        };
      });
    },
  });

  // Rijksmuseum's key-free Linked Art API: search → object → visual item → digital object → IIIF.
  const RIJKS_MASTERS = ['Rembrandt van Rijn', 'Johannes Vermeer', 'Frans Hals', 'Jan Steen', 'Jacob Isaacksz. van Ruisdael', 'Vincent van Gogh', 'Hendrick Avercamp', 'Aelbert Cuyp', 'Willem van de Velde (II)', 'Pieter Claesz', 'Rachel Ruysch', 'Judith Leyster', 'George Hendrik Breitner', 'Jan Davidsz. de Heem', 'Meindert Hobbema', 'Isaac Israëls', 'Jan van Huysum', 'Paulus Potter'];
  const toData = id => String(id).replace('https://id.rijksmuseum.nl/', 'https://data.rijksmuseum.nl/');
  function findIIIF(o, depth = 0) {
    if (!o || depth > 7) return null;
    if (typeof o === 'string') return /^https?:\/\/[^ ]*iiif[^ ]*\.(jpg|jpeg)$/i.test(o) || /iiif\.micr\.io\/[^/]+\/full\//.test(o) ? o : null;
    if (Array.isArray(o)) { for (const v of o) { const r = findIIIF(v, depth + 1); if (r) return r; } return null; }
    if (typeof o === 'object') { for (const k in o) { const r = findIIIF(o[k], depth + 1); if (r) return r; } }
    return null;
  }
  const ldGet = url => U.fetchJSON(toData(url), { headers: { Accept: 'application/ld+json' } });
  async function rijksResolve(id, creator) {
    const obj = await ldGet(id);
    let img = null;
    const vis = obj.shows && obj.shows[0];
    if (vis) {
      const visual = vis.digitally_shown_by ? vis : await ldGet(vis.id);
      img = findIIIF(visual.digitally_shown_by);
      const dob = !img && visual.digitally_shown_by && visual.digitally_shown_by[0];
      if (dob && dob.id) img = findIIIF(dob.access_point) || findIIIF(await ldGet(dob.id));
    }
    if (!img) return null;
    const names = (obj.identified_by || []).filter(x => x.type === 'Name' && x.content);
    const en = names.find(n => JSON.stringify(n.language || '').match(/English|300388277/)) || names[0];
    const prod = obj.produced_by || {};
    const ts = prod.timespan || {};
    const dateTxt = (ts.identified_by && ts.identified_by[0] && ts.identified_by[0].content) || (ts.begin_of_the_begin || '').slice(0, 4);
    return {
      key: 'rijks:' + id.split('/').pop(), src: 'rijks', kind: 'art',
      urls: [img.replace(/\/full\/[^/]+\/0\/default\.jpg$/, '/full/2000,/0/default.jpg'), img],
      title: (en && en.content) || obj._label || 'Untitled', creator, date: dateTxt, license: 'Public domain', link: id,
    };
  }
  def({
    id: 'rijks', name: 'Rijksmuseum', sub: 'Public domain · Linked Art', color: '#f08a24', group: 'art', beta: true, home: 'https://data.rijksmuseum.nl/docs/',
    async fetchBatch() {
      const creator = U.pick(RIJKS_MASTERS);
      const s = await U.fetchJSON(`https://data.rijksmuseum.nl/search/collection?type=painting&imageAvailable=true&creator=${encodeURIComponent(creator)}`);
      const ids = U.shuffle((s.orderedItems || []).map(o => o.id).filter(Boolean)).slice(0, 5);
      const out = await Promise.allSettled(ids.map(id => rijksResolve(id, creator)));
      return out.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    },
  });

  def({
    id: 'vam', name: 'V&A Museum', sub: '© V&A · personal, non-commercial', color: '#b18cf0', group: 'art', home: 'https://developers.vam.ac.uk/',
    async fetchBatch() {
      const q = paintings() ? U.pick(['painting', 'watercolour', 'oil painting', 'print', 'drawing']) + ' ' + U.pick(TERMS) : U.pick(TERMS);
      const d = await U.fetchJSON(`https://api.vam.ac.uk/v2/objects/search?q=${encodeURIComponent(q)}&images_exist=true&page_size=40&page=${U.randInt(1, 3)}`);
      return (d.records || []).filter(r => r._primaryImageId).map(r => {
        const base = (r._images && r._images._iiif_image_base_url) || `https://framemark.vam.ac.uk/collections/${r._primaryImageId}/`;
        return {
          key: 'vam:' + r.systemNumber, src: 'vam', kind: 'art',
          urls: [`${base}full/!2000,2000/0/default.jpg`, `${base}full/!1200,1200/0/default.jpg`],
          title: r._primaryTitle || r.objectType || 'Untitled', creator: r._primaryMaker && r._primaryMaker.name, date: r._primaryDate,
          detail: r.objectType, license: '© Victoria and Albert Museum, London', link: `https://collections.vam.ac.uk/item/${r.systemNumber}/`,
        };
      });
    },
  });

  def({
    id: 'harvard', name: 'Harvard Art Museums', sub: 'Needs a free API key', color: '#a8324a', group: 'art', needsKey: 'harvardKey', home: 'https://harvardartmuseums.org/collections/api',
    async fetchBatch() {
      const key = SS.settings.harvardKey;
      if (!key) throw new Error('add a free API key in Settings');
      const d = await U.fetchJSON(`https://api.harvardartmuseums.org/object?apikey=${encodeURIComponent(key)}&hasimage=1&q=imagepermissionlevel:0${paintings() ? '&classification=Paintings' : ''}&sort=random&size=20&fields=id,title,people,dated,primaryimageurl,url,creditline,medium`);
      return (d.records || []).filter(r => r.primaryimageurl).map(r => ({
        key: 'ham:' + r.id, src: 'harvard', kind: 'art',
        urls: [r.primaryimageurl + '?width=2048', r.primaryimageurl],
        title: r.title, creator: r.people && r.people[0] && r.people[0].name, date: r.dated, detail: r.medium, credit: r.creditline,
        license: 'Harvard Art Museums · open image', link: r.url,
      }));
    },
  });

  /* ── Photography & space ─────────────────────────────── */
  def({
    id: 'wikimedia', name: 'Wikimedia Commons', sub: 'Featured pictures · CC licences', color: '#3fb6c7', group: 'photo', home: 'https://commons.wikimedia.org/wiki/Commons:Featured_pictures',
    async fetchBatch() {
      const start = new Date(U.rand(Date.parse('2009-01-01'), Date.now() - 7 * 864e5)).toISOString().slice(0, 19) + 'Z';
      const w = big() ? 2560 : 1920;
      const d = await U.fetchJSON('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=categorymembers'
        + '&gcmtitle=' + encodeURIComponent('Category:Featured pictures on Wikimedia Commons')
        + `&gcmtype=file&gcmsort=timestamp&gcmstart=${start}&gcmlimit=24&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=${w}`
        + '&iiextmetadatafilter=ObjectName|Artist|LicenseShortName|DateTimeOriginal');
      return Object.values((d.query && d.query.pages) || {}).map(p => {
        const ii = p.imageinfo && p.imageinfo[0]; if (!ii) return null;
        if (!/image\/(jpeg|png|webp)/.test(ii.mime || '') || (ii.width || 0) < 1500) return null;
        const em = ii.extmetadata || {};
        const v = k => U.text(em[k] && em[k].value);
        return {
          key: 'wm:' + p.pageid, src: 'wikimedia', kind: 'photo',
          urls: [ii.thumburl, ii.size < 12e6 ? ii.url : null],
          title: v('ObjectName') || p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' '),
          creator: U.truncate(v('Artist'), 80), date: (v('DateTimeOriginal') || '').slice(0, 10),
          license: v('LicenseShortName') || 'See file page', link: ii.descriptionurl,
        };
      }).filter(Boolean);
    },
  });

  const NASA_TERMS = ['nebula', 'galaxy', 'aurora', 'earth from space', 'hubble', 'webb telescope', 'saturn', 'jupiter', 'milky way', 'sunrise from orbit', 'mars surface', 'lunar surface', 'solar eclipse', 'launch at night', 'star cluster', 'earth at night'];
  def({
    id: 'nasa', name: 'NASA Image Library', sub: 'NASA media · generally not copyrighted', color: '#4f7cff', group: 'space', home: 'https://images.nasa.gov/',
    async fetchBatch() {
      const q = U.pick(NASA_TERMS);
      const d = await U.fetchJSON(`https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page_size=60&page=${U.randInt(1, 3)}`);
      return ((d.collection && d.collection.items) || []).filter(it => it.data && it.data[0] && !/chart|graph|diagram|infographic|logo|patch/i.test(it.data[0].title || '')).map(it => {
        const m = it.data[0], id = m.nasa_id, enc = encodeURIComponent(id);
        const base = `https://images-assets.nasa.gov/image/${enc}/${enc}`;
        return {
          key: 'nasa:' + id, src: 'nasa', kind: 'space',
          urls: [`${base}~large.jpg`, `${base}~orig.jpg`, it.links && it.links[0] && it.links[0].href],
          title: m.title, creator: m.photographer || m.secondary_creator || (m.center ? 'NASA ' + m.center : 'NASA'), date: (m.date_created || '').slice(0, 4),
          license: 'NASA · generally not copyrighted', link: `https://images.nasa.gov/details/${enc}`,
        };
      });
    },
  });

  // Windows Spotlight + Bing daily — fetched and archived by the companion server
  // (their endpoints don't allow browser cross-origin requests).
  def({
    id: 'spotlight', name: 'Windows Spotlight', sub: 'Via the Pi server · © as credited', color: '#8f7bff', group: 'photo', needsServer: true, home: 'https://github.com/ORelio/Spotlight-Downloader',
    async fetchBatch() {
      if (!SS.server.available) throw new Error('needs the Pi/computer server');
      const d = await U.fetchJSON(SS.server.url('api/spotlight'), { proxy: false, timeout: 30000 });
      return U.shuffle(d.items || []).slice(0, 12).map(it => ({ ...it, urls: (it.urls || []).map(u => (/^https?:/.test(u) ? u : SS.server.url(u))) }));
    },
  });
  def({
    id: 'bing', name: 'Bing daily image', sub: 'Via the Pi server · © as credited', color: '#25a4e8', group: 'photo', needsServer: true, home: 'https://github.com/Qzincs/SpotlightGallery',
    async fetchBatch() {
      if (!SS.server.available) throw new Error('needs the Pi/computer server');
      const d = await U.fetchJSON(SS.server.url('api/bing'), { proxy: false, timeout: 30000 });
      return U.shuffle(d.items || []).slice(0, 12).map(it => ({ ...it, urls: (it.urls || []).map(u => (/^https?:/.test(u) ? u : SS.server.url(u))) }));
    },
  });

  def({
    id: 'generative', name: 'Generative studies', sub: 'Made on this device · offline fallback', color: '#f4f1ea', group: 'gen',
    async fetchBatch() { return Array.from({ length: 6 }, () => SS.gen.make()); },
  });

  P.personal = {
    id: 'personal', name: 'Your photos', sub: 'This device + Pi folder', color: '#ffb547', group: 'personal',
    async fetchBatch() { return SS.photos.nextBatch(10).map(SS.photos.toItem); },
  };

  /* ── Mixer ─────────────────────────────────────────── */
  const pool = (SS.pool = { queues: {}, fetching: {}, fails: {}, cooldown: {}, status: {}, queuedKeys: new Set(), history: new Set(U.store.get('history', [])) });
  const saveHistory = U.debounce(() => U.store.set('history', Array.from(pool.history).slice(-900)), 2000);

  pool.weightOf = id => {
    const p = P[id]; if (!p) return 0;
    const w = SS.settings.weights[id] ?? 0;
    if (!w) return 0;
    if (p.needsServer && !SS.server.available) return 0;
    if (p.needsKey && !SS.settings[p.needsKey]) return 0;
    return [0, 0.5, 1, 2][w] || 0;
  };
  pool.setStatus = (id, state, msg) => { pool.status[id] = { state, msg, at: Date.now(), queued: (pool.queues[id] || []).length }; SS.emit('pool'); };

  pool.refill = async function (id) {
    const prov = id === 'personal' ? P.personal : P[id];
    if (!prov || pool.fetching[id] || Date.now() < (pool.cooldown[id] || 0)) return;
    pool.fetching[id] = true;
    try {
      let items = await prov.fetchBatch();
      items = (items || []).filter(it => it && (it.load || it.gen || (it.urls && it.urls.some(Boolean))) && (id === 'personal' || (!pool.history.has(it.key) && !pool.queuedKeys.has(it.key))));
      if (id !== 'personal') items.forEach(it => pool.queuedKeys.add(it.key));
      (pool.queues[id] = pool.queues[id] || []).push(...(id === 'personal' ? items : U.shuffle(items)));
      pool.fails[id] = 0;
      if (!items.length) pool.cooldown[id] = Date.now() + 45e3;
      pool.setStatus(id, 'ok', items.length ? '' : 'no new images this round');
    } catch (e) {
      pool.fails[id] = (pool.fails[id] || 0) + 1;
      pool.cooldown[id] = Date.now() + Math.min(15 * 60e3, 20e3 * 2 ** pool.fails[id]);
      pool.setStatus(id, 'error', SS.env.cspBlocked ? 'blocked in this preview' : (e.message || 'unreachable'));
    } finally { pool.fetching[id] = false; }
  };

  pool.warm = function () {
    for (const id of ORDER) if (id !== 'generative' && pool.weightOf(id) > 0 && (pool.queues[id] || []).length < 3) pool.refill(id);
    if (SS.settings.personalOn && SS.photos.count && (pool.queues.personal || []).length < 3) pool.refill('personal');
  };
  pool.resetPersonal = () => { pool.queues.personal = []; pool.warm(); };

  pool.take = function () {
    const s = SS.settings;
    const personal = s.personalOn && SS.photos.count > 0 && (pool.queues.personal || []).length > 0;
    const cands = ORDER.filter(id => id !== 'generative' && pool.weightOf(id) > 0 && (pool.queues[id] || []).length);
    if (pool.weightOf('generative') > 0) cands.push('generative');
    let id = null;
    if (personal && (Math.random() * 100 < s.personalShare || !cands.length)) id = 'personal';
    else if (cands.length) {
      const total = cands.reduce((a, c) => a + (c === 'generative' ? pool.weightOf(c) * 0.5 : pool.weightOf(c)), 0);
      let r = Math.random() * total;
      for (const c of cands) { r -= c === 'generative' ? pool.weightOf(c) * 0.5 : pool.weightOf(c); if (r <= 0) { id = c; break; } }
      id = id || cands[cands.length - 1];
    }
    if (!id) return null;
    if (id === 'generative') { pool.warm(); return SS.gen.make(); }
    const item = pool.queues[id].shift();
    pool.status[id] && (pool.status[id].queued = pool.queues[id].length);
    pool.warm();
    return item;
  };

  pool.takeWait = async function (ms) {
    const until = Date.now() + ms;
    pool.warm();
    while (Date.now() < until) {
      const it = pool.take();
      if (it) return it;
      // nothing can arrive (all sources failed or are blocked) → don't keep the screen waiting
      const live = ORDER.filter(id => id !== 'generative' && pool.weightOf(id) > 0);
      const hopeless = live.every(id => !pool.fetching[id] && (pool.fails[id] || 0) > 0) && !(SS.settings.personalOn && SS.photos.count);
      if (hopeless || (SS.env.cspBlocked && !(SS.settings.personalOn && SS.photos.count))) return SS.gen.make();
      await U.sleep(250);
    }
    return null;
  };
  pool.markShown = item => { if (item && item.key && item.src !== 'personal' && item.src !== 'generative') { pool.history.add(item.key); saveHistory(); } };
  pool.markBad = item => pool.markShown(item);
})();
