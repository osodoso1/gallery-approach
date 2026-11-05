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
  const TERMS = ['landscape', 'sea', 'river', 'garden', 'flowers', 'night', 'winter', 'harbor', 'mountain', 'city', 'sunset', 'forest', 'still life', 'boats', 'moon', 'bridge', 'snow', 'evening', 'clouds', 'birds', 'lake', 'coast', 'trees', 'street',
    'portrait', 'woman', 'man', 'child', 'mother', 'horse', 'dog', 'cat', 'deer', 'tiger', 'fish', 'butterfly', 'fruit', 'music', 'dance', 'reading', 'letter', 'interior', 'window',
    'church', 'castle', 'village', 'farm', 'fields', 'harvest', 'shepherd', 'storm', 'ship', 'waterfall', 'valley', 'rain', 'morning', 'autumn', 'spring', 'summer', 'sun', 'stars',
    'waves', 'beach', 'cliff', 'road', 'canal', 'market', 'festival', 'picnic', 'angel', 'mythology', 'hunt', 'travelers', 'ruins', 'temple', 'pagoda', 'bamboo', 'blossom',
    'Venice', 'Paris', 'Rome', 'London', 'Japan', 'Holland', 'tea', 'kimono', 'skaters', 'fisherman', 'lighthouse', 'mill', 'cottage', 'roses', 'lilies', 'peonies', 'orchard', 'meadow'];

  /* Reach the whole collection, not just the top results: remember how many results each search has
     (from the first page we read), then jump to a random page anywhere in them next time.
     Public search APIs stop paging at about 10,000 results, so pages are kept inside that. */
  const TOT = U.store.get('srcTotals', {});
  const saveTot = U.debounce(() => { const k = Object.keys(TOT); k.slice(0, Math.max(0, k.length - 500)).forEach(x => delete TOT[x]); U.store.set('srcTotals', TOT); }, 3000);
  const fresh = t => t && Date.now() - t.at < 7 * 864e5;
  async function deepFetch(key, size, url, total, items) {
    let t = TOT[key];
    if (!fresh(t)) {   // first time for this search: ask for one result just to learn how many there are
      try { const n = total(await U.fetchJSON(url(1, 1))); if (typeof n === 'number' && isFinite(n)) { t = TOT[key] = Object.assign({}, t, { n, at: Date.now() }); saveTot(); } }
      catch (e) { /* fall back to the first page */ }
    }
    const pages = fresh(t) ? Math.max(1, Math.floor(Math.min(t.n, t.cap || 10000) / size)) : 1;
    const pg = U.randInt(1, pages);
    let d;
    try { d = await U.fetchJSON(url(pg, size)); }
    catch (e) {
      if (pg === 1 || !(e.status >= 400 && e.status < 500)) throw e;
      TOT[key] = Object.assign({}, t, { cap: (pg - 1) * size }); saveTot();   // went past what the API allows: stay below it
      d = await U.fetchJSON(url(1, size));
    }
    const n = total(d);
    if (typeof n === 'number' && isFinite(n)) { TOT[key] = Object.assign({}, TOT[key], { n, at: Date.now() }); saveTot(); }
    if (pg > 1 && !(items(d) || []).length) { delete TOT[key]; saveTot(); }       // collection shrank: re-count next time
    SS.pool.reach[key.split('|')[0]] = { pages, n: TOT[key] && TOT[key].n };
    return d;
  }
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
      // Half the time a broad search (every oil painting, every watercolour…) so the whole collection comes up.
      const q = paintings() && Math.random() < 0.5 ? U.pick(['oil on canvas', 'oil on panel', 'watercolor', 'gouache', 'pastel', 'tempera', 'ink and color']) : U.pick(TERMS);
      const d = await deepFetch(`aic|${q}`, 40, (pg, n) => `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&query[term][is_public_domain]=true&fields=id,title,artist_title,artist_display,date_display,image_id,thumbnail,credit_line,medium_display,artwork_type_title&limit=${n}&page=${pg}`,
        j => j.pagination && j.pagination.total, j => j.data);
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
      const d = await deepFetch(`cleveland|${p}`, 30, (pg, n) => `https://openaccess-api.clevelandart.org/api/artworks/?cc0=1&has_image=1&limit=${n}&skip=${(pg - 1) * n}${p ? '&type=Painting' : ''}`,
        j => j.info && j.info.total, j => j.data);
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
      const keys = p ? '*' : U.pick(TERMS);
      const d = await deepFetch(`smk|${keys}|${p}`, 30, (pg, n) => `https://api.smk.dk/api/v1/art/search/?keys=${encodeURIComponent(keys)}&${f('[has_image:true]')}&${f('[public_domain:true]')}${p ? '&' + f('[object_names:maleri]') : ''}&offset=${(pg - 1) * n}&rows=${n}&lang=en`,
        j => j.found, j => j.items);
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
    if (!creator) {   // found by year: read the maker from the record itself
      const makers = (prod.carried_out_by || []).concat(...(prod.part || []).map(x => x.carried_out_by || []));
      const m = makers[0];
      creator = (m && (m._label || (m.identified_by && m.identified_by[0] && m.identified_by[0].content))) || '';
    }
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
      // Half the time a famous name, half the time every painting from a random year (1500–1920),
      // which reaches the whole painting collection rather than the same 18 artists.
      const byYear = Math.random() < 0.5;
      const creator = byYear ? '' : U.pick(RIJKS_MASTERS);
      const year = U.randInt(1500, 1920);
      const s = await U.fetchJSON(`https://data.rijksmuseum.nl/search/collection?type=painting&imageAvailable=true&${byYear ? 'creationDate=' + year : 'creator=' + encodeURIComponent(creator)}`);
      const ids = U.shuffle((s.orderedItems || []).map(o => o.id).filter(Boolean)).slice(0, 5);
      const out = await Promise.allSettled(ids.map(id => rijksResolve(id, creator)));
      return out.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    },
  });

  def({
    id: 'vam', name: 'V&A Museum', sub: '© V&A · personal, non-commercial', color: '#b18cf0', group: 'art', home: 'https://developers.vam.ac.uk/',
    async fetchBatch() {
      const q = paintings() ? U.pick(['painting', 'watercolour', 'oil painting', 'print', 'drawing']) + ' ' + U.pick(TERMS) : U.pick(TERMS);
      const d = await deepFetch(`vam|${q}`, 40, (pg, n) => `https://api.vam.ac.uk/v2/objects/search?q=${encodeURIComponent(q)}&images_exist=true&page_size=${n}&page=${pg}`,
        j => j.info && j.info.record_count, j => j.records);
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

  const NASA_TERMS = ['nebula', 'galaxy', 'aurora', 'earth from space', 'hubble', 'webb telescope', 'saturn', 'jupiter', 'milky way', 'sunrise from orbit', 'mars surface', 'lunar surface', 'solar eclipse', 'launch at night', 'star cluster', 'earth at night',
    'hurricane from space', 'iss earth', 'astronaut spacewalk', 'comet', 'supernova', 'chandra', 'moon apollo', 'earthrise', 'volcano from space', 'glacier', 'coral reef from space', 'city lights', 'sunset over earth', 'pillars of creation', 'andromeda', 'rocket launch'];
  def({
    id: 'nasa', name: 'NASA Image Library', sub: 'NASA media · generally not copyrighted', color: '#4f7cff', group: 'space', home: 'https://images.nasa.gov/',
    async fetchBatch() {
      const q = U.pick(NASA_TERMS);
      const d = await deepFetch(`nasa|${q}`, 60, (pg, n) => `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page_size=${n}&page=${pg}`,
        j => j.collection && j.collection.metadata && j.collection.metadata.total_hits, j => j.collection && j.collection.items);
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

  /* ── Wikimedia Commons image search, reaching the whole result set (not just the top hits) ── */
  const COMMONS = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*';
  const fileTitle = t => String(t || '').replace(/^File:/, '').replace(/\.(jpe?g|png|tiff?|webp|gif)$/i, '').replace(/_/g, ' ');
  async function commonsImages(key, q, size, pick, map) {
    const d = await deepFetch(key, size, (pg, n) => `${COMMONS}&list=search&srnamespace=6&srsearch=${encodeURIComponent(q)}&srlimit=${n}&sroffset=${(pg - 1) * n}&srinfo=totalhits&srprop=`,
      j => j.query && j.query.searchinfo && j.query.searchinfo.totalhits, j => j.query && j.query.search);
    const titles = U.shuffle(((d.query && d.query.search) || []).map(r => r.title)).slice(0, pick);
    if (!titles.length) return [];
    const w = big() ? 2560 : 1920;
    const ii = await U.fetchJSON(`${COMMONS}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=${w}&iiextmetadatafilter=ObjectName|Artist|LicenseShortName|DateTimeOriginal&titles=${encodeURIComponent(titles.join('|'))}`);
    return Object.values((ii.query && ii.query.pages) || {}).map(p => {
      const im = p.imageinfo && p.imageinfo[0]; if (!im || !im.thumburl) return null;
      if (!/image\/(jpeg|png|webp|tiff)/.test(im.mime || '')) return null;
      const em = im.extmetadata || {}, v = k => U.text(em[k] && em[k].value);
      return map(p, im, v);
    }).filter(Boolean);
  }
  const commonsUrls = im => [im.thumburl, im.size < 12e6 && /jpeg|png|webp/.test(im.mime) ? im.url : null];

  /* ── Movie posters: classic film posters that are in the public domain ─────────────────────── */
  // Wikimedia Commons only keeps free files, and most US posters from before 1964 are public domain
  // (no copyright notice, or the copyright was never renewed). One year at a time, picked at random.
  const posterYear = () => (Math.random() < 0.85 ? U.randInt(1910, 1965) : U.randInt(1966, 1977));
  const cleanPoster = t => {
    const c = fileTitle(t).replace(/\((?:[^()]*\b(?:poster|one[- ]sheet|half[- ]sheet|lobby card|style [a-z])\b[^()]*)\)/ig, '')
      .replace(/\s*[-–,]\s*(?:theatrical |film |movie |re-?release |original |us )*(?:poster|one[- ]sheet|half[- ]sheet|window card)\b.*$/i, '')
      .replace(/\b(?:theatrical|film|movie)\s+poster\b/ig, '').replace(/\bposter\b/ig, '').replace(/\s{2,}/g, ' ').replace(/^[\s\-–,]+|[\s\-–,(]+$/g, '').trim();
    return c || fileTitle(t);
  };
  def({
    id: 'posters', name: 'Movie posters', sub: 'Classic film posters in the public domain · Wikimedia Commons', color: '#f2c14e', group: 'posters', home: 'https://commons.wikimedia.org/wiki/Category:Film_posters_of_the_United_States',
    async fetchBatch() {
      for (let tries = 0; tries < 3; tries++) {      // some years only have a handful, so try another year if one comes up empty
        const year = posterYear();
        const items = await commonsImages(`posters|${year}`, `incategory:"${year} film posters of the United States"`, 30, 10, (p, im, v) => {
          if ((im.width || 0) < 600 || (im.height || 0) < 700) return null;                        // too small to hang
          const title = cleanPoster(v('ObjectName') || p.title).replace(new RegExp(`[\\s,(]+${year}\\)?$`), '') || cleanPoster(p.title);
          return { key: 'wm:' + p.pageid, src: 'posters', kind: 'art', urls: commonsUrls(im), title,
            creator: U.truncate(v('Artist'), 80), date: String(year), detail: 'Film poster', license: v('LicenseShortName') || 'Public domain', link: im.descriptionurl };
        });
        if (items.length) return items;
      }
      return [];
    },
  });

  /* ── Science: microscopy, crystals, specimens and the great scientific illustrators ─────────── */
  const SCI_SKIP = /cancer|tumou?r|wound|lesion|corpse|cadaver|autops|dissect|surg(?:ery|ical)|f(?:o)?etus|disease|syphilis|lepros|plague|smallpox|ulcer|gangrene|tapeworm|deform|injur|patient|execution|torture|war\b|weapon|gun\b|nude|naked|genital|sex/i;
  const SCI_FEATURED = ['micrograph', 'microscope', 'crystal', 'mineral', 'geode', 'fossil', 'skeleton', 'diatom', 'snowflake', 'jellyfish', 'radiolaria', 'butterfly wing', 'shell', 'coral', 'lichen', 'fungus', 'pollen',
    'feather', 'leaf', 'seed', 'insect', 'beetle', 'moth', 'dragonfly', 'spider web', 'lightning', 'aurora', 'nebula', 'soap bubble', 'interference', 'polarized light', 'chemistry', 'botanical illustration', 'scientific illustration', 'anatomy'];
  const SCI_CLASSIC = ['Kunstformen der Natur', 'Haeckel radiolaria', 'Haeckel plate', 'Micrographia Hooke', 'Trouvelot astronomical drawings', 'Blaschka glass', 'Audubon Birds of America plate', 'Maria Sibylla Merian',
    'Albertus Seba Thesaurus', 'Wilson Bentley snowflake', 'Redouté Les Liliacées', 'Besler Hortus Eystettensis', 'Köhler Medizinal-Pflanzen', 'Sowerby mineralogy', 'Brehms Tierleben plate', 'Haeckel Kunstformen Diatomea', 'Gould birds plate', 'Seba shells', 'Ramón y Cajal drawing', 'Chladni figures'];
  def({
    id: 'sciart', name: 'Science pictures', sub: 'Micrographs, crystals, specimens and classic plates (Haeckel, Hooke, Trouvelot, Audubon) · Wikimedia Commons', color: '#5ad1b0', group: 'science', home: 'https://commons.wikimedia.org/wiki/Commons:Featured_pictures/Non-photographic_media/Science',
    async fetchBatch() {
      const r = Math.random();
      const classic = r < 0.45, micro = r >= 0.45 && r < 0.6;
      const term = classic ? U.pick(SCI_CLASSIC) : micro ? '' : U.pick(SCI_FEATURED);
      const q = (classic ? term : micro ? 'incategory:"Featured pictures taken through a microscope"' : `${term} incategory:"Featured pictures on Wikimedia Commons"`) + ' filetype:bitmap';
      return commonsImages(`sciart|${q}`, q, 40, 10, (p, im, v) => {
        const title = v('ObjectName') || fileTitle(p.title);
        if ((im.width || 0) < 1000 || SCI_SKIP.test(title + ' ' + p.title)) return null;
        const ratio = im.width / im.height; if (ratio > 3.2 || ratio < 0.3) return null;           // skip long strips and scanned pages
        return { key: 'wm:' + p.pageid, src: 'sciart', kind: classic ? 'art' : 'photo', urls: commonsUrls(im), title,
          creator: U.truncate(v('Artist'), 80), date: (v('DateTimeOriginal') || '').slice(0, 10), detail: classic ? term.replace(/ plate$/, '') : '', license: v('LicenseShortName') || 'See file page', link: im.descriptionurl };
      });
    },
  });

  const WELLCOME_TERMS = ['scanning electron micrograph', 'light micrograph', 'crystals', 'pollen', 'diatoms', 'neurons', 'brain', 'DNA', 'virus', 'protein', 'molecule', 'cells', 'bacteria colony', 'botanical illustration', 'herbal',
    'anatomical illustration', 'skeleton', 'heart', 'eye', 'butterfly', 'moth', 'beetle', 'shells', 'seaweed', 'fungi', 'chemistry', 'alchemy', 'astronomy', 'zodiac', 'planets', 'microscope', 'MRI', 'bone', 'feather', 'flower', 'seeds', 'fossil', 'minerals', 'coral', 'plankton'];
  const WC_LIC = { 'cc-by': 'CC BY 4.0', 'cc-by-nc': 'CC BY-NC 4.0 · personal use', pdm: 'Public domain', 'cc-0': 'CC0' };
  def({
    id: 'wellcome', name: 'Wellcome Collection', sub: 'Science and medicine images: micrographs, molecules, botany, astronomy · CC BY / public domain', color: '#7bd389', group: 'science', home: 'https://wellcomecollection.org/search/images',
    async fetchBatch() {
      const q = U.pick(WELLCOME_TERMS);
      const d = await deepFetch(`wellcome|${q}`, 30, (pg, n) => `https://api.wellcomecollection.org/catalogue/v2/images?query=${encodeURIComponent(q)}&locations.license=${Object.keys(WC_LIC).join(',')}&pageSize=${n}&page=${pg}`,
        j => j.totalResults, j => j.results);
      return (d.results || []).map(im => {
        const loc = (im.locations || []).find(l => l && l.url && /iiif/.test(l.url)) || im.thumbnail;
        if (!loc || !loc.url) return null;
        const lic = loc.license || {};
        if (lic.id && !WC_LIC[lic.id]) return null;
        const title = U.text(im.source && im.source.title) || 'Untitled';
        if (SCI_SKIP.test(title)) return null;
        const base = loc.url.replace(/\/info\.json$/, '');
        return { key: 'wc:' + im.id, src: 'wellcome', kind: 'art', urls: [`${base}/full/!2048,2048/0/default.jpg`, `${base}/full/1024,/0/default.jpg`, `${base}/full/640,/0/default.jpg`],
          title, creator: U.text(loc.credit) || 'Wellcome Collection', license: WC_LIC[lic.id] || U.text(lic.label) || 'See source',
          link: im.source && im.source.id ? `https://wellcomecollection.org/works/${im.source.id}/images?id=${im.id}` : 'https://wellcomecollection.org/search/images' };
      }).filter(Boolean);
    },
  });

  /* ── Motion: open video (played muted, on a loop) ───────────────────── */
  const phone = () => Math.min(innerWidth, innerHeight) < 700;
  const canPlay = type => { try { return !!document.createElement('video').canPlayType((type || '').split(';')[0] ? type : 'video/mp4'); } catch (e) { return false; } };
  const NOT_SCENIC = /interview|briefing|conference|news|remarks|update|live|talk|lecture|webinar|chat|town hall|panel|press|q ?& ?a|this week|tour|ceremony|award|explain|meet |how to|podcast|trailer|teaser|reel|sizzle|recap|status|minute|crew|preview|speech|hearing|announce|forum|event|testimony|ask an/i;

  const NASA_VIDEO_TERMS = ['earth from space timelapse', 'aurora from space', 'solar dynamics observatory sun', 'earth at night', 'hubble zoom', 'webb telescope zoom', 'rocket launch slow motion', 'space station flyover', 'earthrise', 'moon phase', 'hurricane from space', 'galaxy visualization', 'nebula flythrough', 'black hole visualization', 'sun timelapse', 'clouds from space'];
  def({
    id: 'nasavideo', name: 'NASA video', sub: 'Time-lapses and visualizations · generally not copyrighted', color: '#4f9cff', group: 'motion', home: 'https://images.nasa.gov/',
    async fetchBatch() {
      const q = U.pick(NASA_VIDEO_TERMS);
      const d = await deepFetch(`nasavideo|${q}`, 40, (pg, n) => `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=video&page_size=${n}&page=${pg}`,
        j => j.collection && j.collection.metadata && j.collection.metadata.total_hits, j => j.collection && j.collection.items);
      const picks = U.shuffle(((d.collection && d.collection.items) || []).filter(it => it.data && it.data[0] && !NOT_SCENIC.test(it.data[0].title || ''))).slice(0, 4);
      const pref = phone() ? ['~mobile', '~small', '~medium', '~preview', '~large', '~orig'] : ['~medium', '~large', '~small', '~mobile', '~orig'];
      const out = await Promise.allSettled(picks.map(async it => {
        const m = it.data[0];
        const a = await U.fetchJSON(`https://images-api.nasa.gov/asset/${encodeURIComponent(m.nasa_id)}`);
        const mp4 = ((a.collection && a.collection.items) || []).map(x => String(x.href || '').replace(/^http:/, 'https:').replace(/ /g, '%20')).filter(h => /\.mp4$/i.test(h));
        const rank = h => { const i = pref.findIndex(p => h.includes(p + '.')); return i < 0 ? 99 : i; };
        const urls = mp4.sort((x, y) => rank(x) - rank(y)).slice(0, 3);
        if (!urls.length) return null;
        return { key: 'nasav:' + m.nasa_id, src: 'nasavideo', kind: 'motion', video: { urls }, title: m.title, creator: m.photographer || m.secondary_creator || (m.center ? 'NASA ' + m.center : 'NASA'), date: (m.date_created || '').slice(0, 4), license: 'NASA · generally not copyrighted', link: `https://images.nasa.gov/details/${encodeURIComponent(m.nasa_id)}` };
      }));
      return out.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    },
  });

  // Wikimedia Commons: openly licensed video, including clips uploaded by museums and archives.
  const COMMONS_VIDEO_TERMS = ['timelapse', 'time-lapse clouds', 'aurora', 'jellyfish', 'kaleidoscope', 'abstract animation', 'animated film 1910s', 'Winsor McCay', 'Emile Cohl', 'zoetrope', 'Muybridge animation', 'ferrofluid', 'slow motion', 'bioluminescence', 'ocean waves', 'fireworks', 'starry sky timelapse', 'sunset timelapse', 'museum', 'paint mixing', 'ink in water', 'flowers blooming timelapse', 'murmuration', 'lava flow', 'northern lights', 'snowflake', 'clockwork automaton', 'stop motion'];
  def({
    id: 'commonsvideo', name: 'Wikimedia Commons video', sub: 'Open-licence clips, including from museums and archives', color: '#3fb6c7', group: 'motion', home: 'https://commons.wikimedia.org/wiki/Commons:Featured_videos',
    async fetchBatch() {
      const q = U.pick(COMMONS_VIDEO_TERMS) + (Math.random() < 0.3 ? ' incategory:"Featured videos"' : '');
      const d = await U.fetchJSON('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=20'
        + `&gsroffset=${U.randInt(0, 3) * 20}&gsrsearch=${encodeURIComponent(q + ' filetype:video')}`
        + '&prop=videoinfo&viprop=url|size|mime|extmetadata|derivatives&viextmetadatafilter=Artist|LicenseShortName|ObjectName|DateTimeOriginal');
      const target = phone() ? 480 : 720;
      return Object.values((d.query && d.query.pages) || {}).map(p => {
        const vi = p.videoinfo && p.videoinfo[0]; if (!vi) return null;
        if (vi.duration != null && (vi.duration < 6 || vi.duration > 4 * 3600)) return null;
        if (NOT_SCENIC.test(p.title)) return null;
        const ders = (vi.derivatives || []).filter(x => x.src && /video/.test(x.type || '') && canPlay(x.type) && (x.height || x.width));
        ders.sort((a, b) => Math.abs((a.height || 0) - target) - Math.abs((b.height || 0) - target));
        const urls = ders.map(x => x.src).slice(0, 3);
        if (canPlay(vi.mime) && vi.size < 80e6) urls.push(vi.url);
        if (!urls.length) return null;
        const em = vi.extmetadata || {}, v = k => U.text(em[k] && em[k].value);
        return { key: 'wmv:' + p.pageid, src: 'commonsvideo', kind: 'motion', video: { urls }, title: v('ObjectName') || p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '), creator: U.truncate(v('Artist'), 80), date: (v('DateTimeOriginal') || '').slice(0, 10), license: v('LicenseShortName') || 'See file page', link: vi.descriptionurl };
      }).filter(Boolean);
    },
  });

  // The Internet Archive: animated films from 1900–1930, which are in the public domain in the US.
  const ARCHIVE_Q = ['collection:(animationandcartoons OR classic_cartoons) AND mediatype:movies AND year:[1900 TO 1930]', 'mediatype:movies AND subject:(animation) AND year:[1900 TO 1930]'];
  def({
    id: 'archivefilm', name: 'Early animation', sub: 'Internet Archive · cartoons and animated films from 1900–1930, public domain in the US', color: '#d9a35b', group: 'motion', home: 'https://archive.org/details/animationandcartoons',
    async fetchBatch() {
      const q = U.pick(ARCHIVE_Q);
      const d = await deepFetch(`archivefilm|${q}`, 50, (pg, n) => `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=year&fl[]=creator&rows=${n}&page=${pg}&output=json`,
        j => j.response && j.response.numFound, j => j.response && j.response.docs);
      const docs = U.shuffle((d.response && d.response.docs) || []).slice(0, 3);
      const out = await Promise.allSettled(docs.map(async doc => {
        const m = await U.fetchJSON(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`);
        const files = (m.files || []).filter(f => /\.mp4$/i.test(f.name || '') && /h\.264|mpeg4/i.test(f.format || ''));
        files.sort((a, b) => (/512kb/i.test(a.format) ? 1 : 0) - (/512kb/i.test(b.format) ? 1 : 0));   // prefer the better encode
        if (!files.length) return null;
        const md = m.metadata || {}, year = Number(String(md.year || md.date || doc.year || '').slice(0, 4));
        if (year && year > 1930) return null;
        const urls = files.slice(0, 2).map(f => `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${f.name.split('/').map(encodeURIComponent).join('/')}`);
        const one = v => (Array.isArray(v) ? v[0] : v) || '';
        return { key: 'ia:' + doc.identifier, src: 'archivefilm', kind: 'motion', video: { urls }, title: U.text(one(md.title) || doc.title || doc.identifier), creator: U.text(one(md.creator) || one(doc.creator)), date: year ? String(year) : '', license: 'Public domain in the US (made before 1931)', link: `https://archive.org/details/${encodeURIComponent(doc.identifier)}` };
      }));
      return out.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    },
  });

  // Classic cartoons: only titles released in 1930 or earlier, which are public domain in the US.
  // A hand-checked list (title, year, studio, series) so nothing later sneaks in.
  const C_DISNEY = 'Walt Disney Studio';
  const CLASSICS = [
    ...[['Plane Crazy', 1928], ['The Gallopin\' Gaucho', 1928], ['Steamboat Willie', 1928], ['The Barn Dance', 1929], ['The Opry House', 1929], ['When the Cat\'s Away', 1929], ['The Barnyard Battle', 1929], ['The Plow Boy', 1929],
      ['The Karnival Kid', 1929], ['Mickey\'s Follies', 1929], ['Mickey\'s Choo-Choo', 1929], ['The Jazz Fool', 1929], ['Jungle Rhythm', 1929], ['The Haunted House', 1929], ['Wild Waves', 1929],
      ['Just Mickey', 1930], ['The Barnyard Concert', 1930], ['The Cactus Kid', 1930], ['The Fire Fighters', 1930], ['The Shindig', 1930], ['The Chain Gang', 1930], ['The Gorilla Mystery', 1930], ['The Picnic', 1930], ['Pioneer Days', 1930]]
      .map(([t, y]) => ({ t, y, by: C_DISNEY, series: 'Mickey Mouse', tags: ['mickey', 'disney'] })),
    ...[['The Skeleton Dance', 1929], ['El Terrible Toreador', 1929], ['Springtime', 1929], ['Hell\'s Bells', 1929], ['The Merry Dwarfs', 1929],
      ['Summer', 1930], ['Autumn', 1930], ['Cannibal Capers', 1930], ['Night', 1930], ['Frolicking Fish', 1930], ['Arctic Antics', 1930], ['Midnight in a Toy Shop', 1930], ['Monkey Melodies', 1930], ['Winter', 1930], ['Playful Pan', 1930]]
      .map(([t, y]) => ({ t, y, by: C_DISNEY, series: 'Silly Symphony', tags: ['silly symphon', 'disney'] })),
    ...[['Trolley Troubles', 1927], ['Oh Teacher', 1927], ['The Mechanical Cow', 1927], ['Great Guns', 1927], ['All Wet', 1927], ['The Ocean Hop', 1927], ['Bright Lights', 1928], ['Oh What a Knight', 1928],
      ['Sky Scrappers', 1928], ['Hungry Hoboes', 1928], ['Rival Romeos', 1928], ['Sleigh Bells', 1928], ['Tall Timber', 1928], ['Poor Papa', 1928]]
      .map(([t, y]) => ({ t, y, by: C_DISNEY, series: 'Oswald the Lucky Rabbit', tags: ['oswald'] })),
    ...[['Alice\'s Day at Sea', 1924], ['Alice\'s Spooky Adventure', 1924], ['Alice\'s Wild West Show', 1924], ['Alice Gets in Dutch', 1924], ['Alice and the Dog Catcher', 1924], ['Alice the Peacemaker', 1924], ['Alice Hunting in Africa', 1924], ['Alice\'s Egg Plant', 1925], ['Alice Solves the Puzzle', 1925]]
      .map(([t, y]) => ({ t, y, by: C_DISNEY, series: 'Alice Comedy', tags: ['alice', 'disney'] })),
    ...[['Dizzy Dishes', 1930], ['Barnacle Bill', 1930], ['Accordion Joe', 1930], ['Mysterious Mose', 1930]]
      .map(([t, y]) => ({ t, y, by: 'Fleischer Studios', series: 'Betty Boop (Talkartoon)', tags: ['fleischer', 'talkartoon', 'betty boop'] })),
    ...[['Fiddlesticks', 1930], ['Flying Fists', 1930], ['The Village Barber', 1930], ['Little Orphan Willie', 1930], ['The Cuckoo Murder Case', 1930], ['Puddle Pranks', 1930]]
      .map(([t, y]) => ({ t, y, by: 'Ub Iwerks', series: 'Flip the Frog', tags: ['flip', 'iwerks', 'frog'] })),
    { t: 'Felix the Cat', y: 1930, by: 'Pat Sullivan Studio (Otto Messmer)', series: 'Felix the Cat', tags: ['felix'], whole: true },
  ];
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const yearOf = v => { const m = /(18|19|20)\d\d/.exec(String(Array.isArray(v) ? v[0] : v || '')); return m ? +m[0] : 0; };
  // Is this the cartoon on our list (and not a later remake or a different film with the same name)?
  const isClassic = (c, title, extra, year) => {
    const T = norm(title), hay = norm(title + ' ' + extra);
    if (!T.includes(norm(c.t))) return false;
    if (/coloriz|colouriz|remake|remaster|redub|re ?release|reissue|redrawn|reanimat|parody|tribute|upscal|ai generat/.test(hay)) return false;
    if (year && year > 1930) return false;                       // nothing after 1930
    const rest = hay.split(norm(c.t)).join(' ');                 // evidence beyond the cartoon's own name (the item id often repeats it)
    const tagged = c.tags.some(tg => rest.includes(tg));
    if (!year) return tagged && !c.whole;                        // undated: only when the studio or series says it's the original
    if (c.whole && year > c.y) return false;
    return tagged || norm(c.t).split(' ').length >= 2 && !/^(the )?(night|summer|winter|autumn|springtime|picnic)$/.test(norm(c.t));
  };
  def({
    id: 'classics', list: CLASSICS, matches: isClassic, name: 'Classic cartoons', sub: 'Early Disney (Steamboat Willie, Silly Symphonies, Oswald, Alice), Betty Boop, Flip the Frog and Felix · 1930 or earlier, public domain in the US', color: '#e8574a', group: 'motion', home: 'https://web.law.duke.edu/cspd/publicdomainday/2026/',
    async fetchBatch() {
      const picks = U.shuffle(CLASSICS.slice()).slice(0, 3);
      const out = await Promise.allSettled(picks.map(async c => {
        const q = `title:("${c.t.replace(/["!]/g, '')}") AND mediatype:(movies)`;
        const s = await U.fetchJSON(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=year&fl[]=date&fl[]=creator&fl[]=subject&rows=12&output=json`);
        const docs = ((s.response && s.response.docs) || []).filter(d => isClassic(c, d.title, [d.creator, d.subject, d.identifier].flat().join(' '), yearOf(d.year) || yearOf(d.date)));
        for (const doc of U.shuffle(docs).slice(0, 3)) {
          const m = await U.fetchJSON(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`).catch(() => null);
          const files = ((m && m.files) || []).filter(f => /\.mp4$/i.test(f.name || '') && /h\.264|mpeg4/i.test(f.format || ''));
          files.sort((a, b) => (/512kb/i.test(a.format) ? 1 : 0) - (/512kb/i.test(b.format) ? 1 : 0));
          if (!files.length) continue;
          const year = c.whole ? (yearOf(doc.year) || yearOf(doc.date)) : c.y;   // our checked release year, not the upload date
          return { key: 'ia:' + doc.identifier, src: 'classics', kind: 'motion', video: { urls: files.slice(0, 2).map(f => `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${f.name.split('/').map(encodeURIComponent).join('/')}`) },
            title: c.whole ? U.text(doc.title) : c.t, creator: c.by, detail: c.series, date: String(year), license: 'Public domain (US · 1930 or earlier)', link: `https://archive.org/details/${encodeURIComponent(doc.identifier)}` };
        }
        // not on the Internet Archive? try Wikimedia Commons
        if (c.whole) return null;
        const d = await U.fetchJSON('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=10'
          + `&gsrsearch=${encodeURIComponent(`"${c.t}" filetype:video`)}&prop=videoinfo&viprop=url|size|mime|derivatives`);
        const target = phone() ? 480 : 720;
        for (const p of Object.values((d.query && d.query.pages) || {})) {
          const vi = p.videoinfo && p.videoinfo[0]; if (!vi || !isClassic(c, p.title, '', yearOf(p.title))) continue;
          const ders = (vi.derivatives || []).filter(x => x.src && /video/.test(x.type || '') && canPlay(x.type)).sort((a, b) => Math.abs((a.height || 0) - target) - Math.abs((b.height || 0) - target));
          const urls = ders.map(x => x.src).slice(0, 3); if (canPlay(vi.mime) && vi.size < 80e6) urls.push(vi.url);
          if (urls.length) return { key: 'wmv:' + p.pageid, src: 'classics', kind: 'motion', video: { urls }, title: c.t, creator: c.by, detail: c.series, date: String(c.y), license: 'Public domain (US · 1930 or earlier)', link: vi.descriptionurl };
        }
        return null;
      }));
      return out.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    },
  });

  // Europeana: video from Europe's museums and archives with open licences (needs a free key).
  const EUROPEANA_TERMS = ['animation', 'dance', 'art', 'painting', 'sculpture', 'museum', 'nature', 'sea', 'city', 'puppet', 'ballet', 'flowers', 'birds', 'film 1920', 'abstract', 'light'];
  const rightsLabel = r => (/publicdomain\/zero/.test(r) ? 'CC0' : /publicdomain\/mark/.test(r) ? 'Public domain' : /by-sa/.test(r) ? 'CC BY-SA' : /\/by\//.test(r) ? 'CC BY' : 'Open licence');
  def({
    id: 'europeana', name: 'Europeana video', sub: 'Open video from Europe\'s museums and archives · needs a free key', color: '#b48cff', group: 'motion', needsKey: 'europeanaKey', home: 'https://pro.europeana.eu/page/get-api',
    async fetchBatch() {
      const key = SS.settings.europeanaKey; if (!key) throw new Error('add a free Europeana key in Settings');
      const q = U.pick(EUROPEANA_TERMS);
      const d = await deepFetch(`europeana|${q}`, 50, (pg, n) => `https://api.europeana.eu/record/v2/search.json?wskey=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&qf=TYPE:VIDEO&reusability=open&media=true&profile=rich&rows=${n}&start=${(pg - 1) * n + 1}`,
        j => j.totalResults, j => j.items);
      return ((d.items || [])).map(it => {
        const src = (it.edmIsShownBy || [])[0] || '';
        if (!/\.(mp4|m4v|webm|mov)(\?|$)/i.test(src)) return null;
        if (/\.webm/i.test(src) && !canPlay('video/webm')) return null;
        const title = U.text((it.title || [])[0] || (it.dcTitleLangAware && Object.values(it.dcTitleLangAware)[0][0]) || 'Untitled');
        if (NOT_SCENIC.test(title)) return null;
        return { key: 'eu:' + it.id, src: 'europeana', kind: 'motion', video: { urls: [src.replace(/^http:/, 'https:')] }, title, creator: U.text((it.dataProvider || [])[0] || (it.dcCreator || [])[0] || ''), date: String((it.year || [])[0] || ''), license: rightsLabel((it.rights || [])[0] || ''), link: it.guid || `https://www.europeana.eu/item${it.id}` };
      }).filter(Boolean).slice(0, 6);
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

  def({
    id: 'living', name: 'Living art', sub: 'Animated pieces drawn live: Pong Wars, Life, Langton\'s ants, a murmuration', color: '#e4b95c', group: 'living', home: 'https://github.com/vnglst/pong-wars',
    async fetchBatch() { return Array.from({ length: 4 }, () => SS.live.make()); },
  });

  P.personal = {
    id: 'personal', name: 'Your photos', sub: 'This device + Pi folder', color: '#ffb547', group: 'personal',
    async fetchBatch() { return SS.photos.nextBatch(10).map(SS.photos.toItem); },
  };

  /* ── Genres: what kind of picture it is. Tick the ones you want on screen. ── */
  // living, generative and "my photos" use the switch they already had, so there's only ever one switch for each.
  const GENRES = (SS.genres = [
    { id: 'paintings', name: 'Paintings & museum art', sub: 'The Met, Art Institute of Chicago, Cleveland, SMK, Rijksmuseum, V&A', color: '#e5484d', srcs: ['met', 'aic', 'cleveland', 'smk', 'rijks', 'vam', 'harvard'] },
    { id: 'photography', name: 'Photography', sub: 'Wikimedia Commons featured pictures, Spotlight, Bing', color: '#3fb6c7', srcs: ['wikimedia', 'spotlight', 'bing'] },
    { id: 'posters', name: 'Movie posters', sub: 'Classic film posters in the public domain', color: '#f2c14e', srcs: ['posters'] },
    { id: 'science', name: 'Science', sub: 'Micrographs, crystals, Haeckel, Wellcome Collection', color: '#5ad1b0', srcs: ['sciart', 'wellcome'] },
    { id: 'space', name: 'Space', sub: 'NASA photos and video', color: '#4f7cff', srcs: ['nasa', 'nasavideo'] },
    { id: 'cartoons', name: 'Cartoons & early film', sub: 'Steamboat Willie, Silly Symphonies, early animation', color: '#e8574a', srcs: ['classics', 'archivefilm'] },
    { id: 'video', name: 'Nature & museum video', sub: 'Open clips from Wikimedia Commons and Europeana', color: '#2fb59a', srcs: ['commonsvideo', 'europeana'] },
    { id: 'living', name: 'Living art', sub: 'Pong Wars, Life, rocket launches, a double helix', color: '#e4b95c', srcs: ['living'],
      get: () => (SS.settings.weights.living || 0) > 0, set: v => SS.setSetting('weights.living', v ? (SS.settings.livingWas || 2) : (SS.settings.livingWas = SS.settings.weights.living || 2, 0)) },
    { id: 'generative', name: 'Generative art', sub: 'Abstract pieces this app draws in code', color: '#f4f1ea', srcs: ['generative'],
      get: () => (SS.settings.weights.generative ?? 1) >= 1, set: v => SS.setSetting('weights.generative', v ? 1 : -1) },
    { id: 'mine', name: 'My photos', sub: 'From this device or the Pi folder', color: '#ffb547', srcs: ['personal'],
      get: () => !!SS.settings.personalOn, set: v => SS.setSetting('personalOn', v) },
  ]);
  const GBY = {}; GENRES.forEach(g => { GBY[g.id] = g; g.srcs.forEach(id => { if (P[id]) P[id].genre = g.id; }); });
  SS.genreById = GBY;

  /* ── Mixer ─────────────────────────────────────────── */
  const pool = (SS.pool = { reach: {}, queues: {}, fetching: {}, fails: {}, cooldown: {}, status: {}, queuedKeys: new Set(), history: new Set(U.store.get('history', [])), recent: U.store.get('recentArt', []) });
  const saveHistory = U.debounce(() => { U.store.set('history', Array.from(pool.history).slice(-900)); U.store.set('recentArt', pool.recent.slice(-40)); }, 2000);
  // Generative art: -1 never · 0 only when nothing else can load · 1 now and then · 2 often
  pool.genAllowed = () => (SS.settings.weights.generative ?? 1) >= 0;
  // With generative art off and nothing new loading, show a recent piece again instead.
  pool.rerun = function () {
    const cur = SS.show.cur && SS.show.cur.item && SS.show.cur.item.key;
    const list = pool.recent.filter(it => it.key !== cur);
    return list.length ? Object.assign({}, U.pick(list), { rerun: true }) : null;
  };
  // Turning generative art off takes effect now: drop a prepared generative slide and skip one that's showing.
  pool.genChanged = function (genres) {
    pool.warm();
    if (genres) {   // a genre was ticked or unticked: the picture lined up next may not belong any more
      SS.show.nextP = null;
      const cur = SS.show.cur && SS.show.cur.item;
      if (cur && !pool.allowed(cur)) SS.show.advance();
      return;
    }
    if (pool.genAllowed()) return;
    SS.show.nextP = null;
    if (SS.show.cur && SS.show.cur.item.src === 'generative') SS.show.advance();
  };
  pool.genreOfItem = it => (it.src === 'personal' ? 'mine' : P[it.src] && P[it.src].genre);
  pool.allowed = it => { const g = pool.genreOfItem(it); return !g || pool.genreOn(g); };
  pool.fallback = () => (pool.genAllowed() ? SS.gen.make() : pool.rerun());

  pool.genreOn = g => { g = typeof g === 'string' ? GBY[g] : g; return !!g && (g.get ? g.get() : (SS.settings.genres || {})[g.id] !== false); };
  pool.setGenre = (id, on) => {
    const g = GBY[id]; if (!g) return;
    if (g.set) g.set(on); else SS.setSetting('genres.' + id, on);
    if (id === 'mine') pool.resetPersonal();
    if (pool.run && pool.run.genre === id && !on) pool.run = null;
    pool.genChanged(true);
  };
  pool.weightOf = id => {
    const p = P[id]; if (!p) return 0;
    if (p.genre && GBY[p.genre] && !GBY[p.genre].get && !pool.genreOn(p.genre)) return 0;   // genre unticked
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
      items = (items || []).filter(it => it && (it.load || it.gen || it.live || it.video || (it.urls && it.urls.some(Boolean))) && (id === 'personal' || (!pool.history.has(it.key) && !pool.queuedKeys.has(it.key))));
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

  /* Shuffle: one genre at a time, picked at random, a few pictures each (a run of posters, then science, then…).
     Every ticked genre gets an equal chance, however many sources it has. "Shuffle now" starts a new run straight away. */
  const LONG = new Set(['living', 'video', 'cartoons', 'generative']);       // these stay up for minutes, so their runs are short
  pool.run = null;
  pool.genreReady = id => {
    if (id === 'mine') return SS.settings.personalOn && SS.photos.count > 0;
    if (id === 'generative') return GBY.generative.get();
    return GBY[id].srcs.some(sid => P[sid] && pool.weightOf(sid) > 0 && ((pool.queues[sid] || []).length || pool.fetching[sid] || (pool.fails[sid] || 0) < 3));
  };
  // Why a ticked genre can't show anything right now (empty when it can).
  pool.genreWhy = id => {
    if (pool.genreReady(id)) return '';
    if (id === 'mine') return 'No photos added yet';
    const srcs = GBY[id].srcs.map(sid => P[sid]).filter(Boolean);
    const usable = srcs.filter(p => (SS.settings.weights[p.id] || 0) > 0);
    if (!usable.length) return 'Its sources are off (Fine-tune sources)';
    if (usable.every(p => (p.needsServer && !SS.server.available) || (p.needsKey && !SS.settings[p.needsKey]))) return usable.some(p => p.needsKey) ? 'Needs a free API key (Fine-tune sources)' : 'Needs the Pi or computer server';
    return SS.env.cspBlocked ? 'Can\'t reach outside sites from this preview' : 'Nothing can load right now';
  };
  pool.choices = () => GENRES.filter(g => pool.genreOn(g) && pool.genreReady(g.id));
  // Something ready to show right now? (living, generative and photos on this device always are)
  pool.hasQueued = id => (id === 'mine' ? (pool.queues.personal || []).length > 0 : id === 'generative' || id === 'living' || GBY[id].srcs.some(sid => P[sid] && pool.weightOf(sid) > 0 && (pool.queues[sid] || []).length));
  pool.newRun = function (avoid, now) {
    const all = pool.choices(), fresh = all.filter(g => g.id !== avoid);
    let list = fresh.length ? fresh : all;
    if (now) { const ready = list.filter(g => pool.hasQueued(g.id)); if (ready.length) list = ready; }
    const g = U.pick(list);
    pool.run = g ? { genre: g.id, left: LONG.has(g.id) ? U.randInt(1, 2) : U.randInt(3, 6), fresh: true, since: Date.now() } : null;
    pool.warm();
    return pool.run;
  };
  pool.shuffleNow = function () {
    const r = pool.newRun(pool.run ? pool.run.genre : SS.show.cur && pool.genreOfItem(SS.show.cur.item), true);
    if (!r) return null;
    r.announced = true;
    SS.show.nextP = null;
    let n = 0;
    const go = () => (SS.show.busy && n++ < 40 ? setTimeout(go, 150) : SS.show.advance());   // let a transition that's playing finish first
    go();
    return GBY[r.genre];
  };
  function takeFrom(id) {
    const item = pool.queues[id].shift();
    pool.status[id] && (pool.status[id].queued = pool.queues[id].length);
    return item;
  }
  function takeRun() {
    let r = pool.run;
    if (!r || r.left <= 0 || !pool.genreOn(r.genre) || !pool.genreReady(r.genre)) {
      const had = !!r;
      if (!SS.settings.shuffle && had) { pool.run = null; return undefined; }   // a one-off "Shuffle now" run has ended
      r = pool.newRun(r && r.genre);
      if (!r) return undefined;
    }
    let item = null;
    if (r.genre === 'mine') item = (pool.queues.personal || []).length ? takeFrom('personal') : null;
    else if (r.genre === 'generative') item = SS.gen.make();
    else {
      const cands = GBY[r.genre].srcs.filter(id => P[id] && pool.weightOf(id) > 0 && (pool.queues[id] || []).length);
      if (cands.length) {
        let x = Math.random() * cands.reduce((a, c) => a + pool.weightOf(c), 0), id = cands[cands.length - 1];
        for (const c of cands) { x -= pool.weightOf(c); if (x <= 0) { id = c; break; } }
        item = takeFrom(id);
      }
    }
    if (!item) {   // nothing ready in this genre yet: wait a moment, then move on to another one
      pool.warm();
      if (Date.now() - r.since > 4500) pool.newRun(r.genre);
      return null;
    }
    if (r.fresh) { r.fresh = false; item.runStart = r.announced ? null : r.genre; }
    r.left--;
    pool.warm();
    return item;
  }

  pool.take = function () {
    const s = SS.settings;
    if (s.shuffle || pool.run) {
      const it = takeRun();
      if (it !== undefined) return it;
    }
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
      if (hopeless || (SS.env.cspBlocked && !(SS.settings.personalOn && SS.photos.count))) { const fb = pool.fallback(); if (fb) return fb; }
      await U.sleep(250);
    }
    return null;
  };
  pool.markShown = item => {
    if (!item || !item.key || item.src === 'personal' || item.src === 'generative' || item.src === 'living') return;
    pool.history.add(item.key);
    if (!item.rerun && item.urls) {
      const { key, src, kind, urls, title, creator, date, detail, credit, license, link } = item;
      pool.recent = pool.recent.filter(x => x.key !== key).concat([{ key, src, kind, urls: urls.filter(u => typeof u === 'string' && /^https?:/.test(u)), title, creator, date, detail, credit, license, link }]).filter(x => x.urls.length).slice(-40);
    }
    saveHistory();
  };
  pool.markBad = item => { if (!item) return; pool.recent = pool.recent.filter(x => x.key !== item.key); if (item.key && item.src !== 'personal' && item.src !== 'generative') { pool.history.add(item.key); saveHistory(); } };
})();
