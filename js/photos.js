/* Your photos — stored on this device (IndexedDB) and/or in the Pi's photos/ folder.
   Nothing here is uploaded anywhere. */
(function () {
  'use strict';
  const U = SS.u;
  const P = (SS.photos = { metas: [], deck: [], count: 0, deviceCount: 0, serverCount: 0, busy: false });

  /* Tiny EXIF reader: DateTimeOriginal (or DateTime) from a JPEG. */
  function exifDate(dv) {
    try {
      if (dv.getUint16(0) !== 0xFFD8) return null;
      let off = 2;
      while (off + 4 < dv.byteLength) {
        const marker = dv.getUint16(off), len = dv.getUint16(off + 2);
        if (marker === 0xFFE1 && dv.getUint32(off + 4) === 0x45786966) return tiff(dv, off + 10);
        if ((marker & 0xFF00) !== 0xFF00) return null;
        off += 2 + len;
      }
    } catch (e) { /* malformed */ }
    return null;
  }
  function tiff(dv, t) {
    const le = dv.getUint16(t) === 0x4949;
    const u16 = o => dv.getUint16(o, le), u32 = o => dv.getUint32(o, le);
    const find = (ifd, tag) => { const n = u16(ifd); for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === tag) return e; } return 0; };
    const str = e => { const cnt = u32(e + 4), o = cnt > 4 ? t + u32(e + 8) : e + 8; let s = ''; for (let i = 0; i < cnt - 1 && o + i < dv.byteLength; i++) s += String.fromCharCode(dv.getUint8(o + i)); return s; };
    const ifd0 = t + u32(t + 4);
    let s = null;
    const ex = find(ifd0, 0x8769);
    if (ex) { const sub = t + u32(ex + 8); const d = find(sub, 0x9003) || find(sub, 0x9004); if (d) s = str(d); }
    if (!s) { const d = find(ifd0, 0x0132); if (d) s = str(d); }
    const m = s && s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m || m[1] === '0000') return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  }
  P.exifDate = async blob => {
    try { return exifDate(new DataView(await blob.slice(0, 256 * 1024).arrayBuffer())); } catch (e) { return null; }
  };

  P.refresh = async function () {
    let dev = [];
    try { dev = (await U.idb.all('photoMeta')) || []; } catch (e) { dev = []; }
    let srv = [];
    if (SS.server.available && SS.server.features.photos) {
      try {
        const d = await U.fetchJSON(SS.server.url('api/photos'), { proxy: false, cache: 'no-store' });
        srv = (d.photos || []).map(p => {
          const parts = p.path.split('/');
          return { id: 'srv:' + p.path, origin: 'server', path: p.path, name: parts[parts.length - 1], folder: parts.length > 1 ? parts[parts.length - 2] : '', date: p.date || p.mtime };
        });
      } catch (e) { /* no folder */ }
    }
    const local = new Set(dev.map(m => m.id));
    const cloud = ((SS.cloud && SS.cloud.photos) || []).filter(c => c && c.asset && !local.has(c.id)).map(c => ({ ...c, origin: 'cloud' }));
    P.metas = [...dev.map(m => ({ ...m, origin: 'device' })), ...cloud, ...srv];
    P.deviceCount = dev.length; P.serverCount = srv.length; P.cloudCount = cloud.length + dev.filter(m => m.cloud).length; P.count = P.metas.length;
    P.deck = [];
    SS.emit('photos');
  };

  // Shuffle-bag so every photo shows once before any repeats.
  P.nextBatch = function (n) {
    const out = [];
    if (!P.metas.length) return out;
    while (out.length < n) {
      if (!P.deck.length) P.deck = U.shuffle(P.metas.map((_, i) => i));
      const m = P.metas[P.deck.pop()];
      if (m) out.push(m);
      if (out.length >= P.metas.length) break;
    }
    return out;
  };

  P.urlFor = async function (m) {
    if (m.origin === 'server') return { url: SS.server.url('photos/' + m.path.split('/').map(encodeURIComponent).join('/')) };
    if (m.origin === 'cloud') return { url: '/_blob/' + m.asset };
    const rec = await U.idb.get('photoBlobs', m.id);
    if (!rec || !rec.blob) throw new Error('photo missing');
    const url = URL.createObjectURL(rec.blob);
    return { url, revoke: () => URL.revokeObjectURL(url) };
  };

  P.toItem = function (m) {
    const nice = (m.name || '').replace(/\.[a-z0-9]+$/i, '');
    return {
      key: 'me:' + m.id, src: 'personal', kind: 'personal',
      title: m.folder ? m.folder.replace(/[_-]+/g, ' ') : 'From your library',
      creator: m.date ? U.fmt.date(m.date) : '', detail: nice,
      license: m.origin === 'server' ? 'Pi photos folder' : m.origin === 'cloud' ? 'Synced from your other device' : m.cloud ? 'On this device · synced' : 'On this device',
      where: m.origin === 'server' ? `Pi photos folder: ${m.path}` : m.origin === 'cloud' ? 'Your claude.ai account (added on another device)' : m.cloud ? 'This device, also synced to your claude.ai account' : 'This device only (kept in this browser)',
      file: m.name, album: m.folder, taken: m.date,
      link: null, load: () => P.urlFor(m),
    };
  };

  function loadImage(url) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode failed')); i.src = url; });
  }
  async function shrink(file, max = 2560) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const s = Math.min(1, max / Math.max(iw, ih));
      if (s === 1 && file.size < 3.5e6 && /jpe?g|webp/i.test(file.type)) return { blob: file, w: iw, h: ih };
      const c = U.mk(iw * s, ih * s); const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error('encode failed');
      return { blob, w: c.width, h: c.height };
    } finally { URL.revokeObjectURL(url); }
  }

  P.importFiles = async function (files, onProgress) {
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif|gif|avif)$/i.test(f.name));
    let ok = 0, bad = 0;
    P.busy = true;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      try {
        const date = (await P.exifDate(f)) || f.lastModified || Date.now();
        const { blob, w, h } = await shrink(f);
        const rel = f.webkitRelativePath || '';
        const segs = rel.split('/');
        const meta = { id: U.uid(), name: f.name, folder: segs.length > 1 ? segs[segs.length - 2] : '', date, w, h, added: Date.now() };
        await U.idb.put('photoBlobs', { id: meta.id, blob });
        await U.idb.put('photoMeta', meta);
        if (SS.cloud && SS.cloud.canSyncPhotos()) {
          const asset = await SS.cloud.uploadPhoto(meta, blob);
          if (asset) await U.idb.put('photoMeta', { ...meta, cloud: asset });
        }
        ok++;
      } catch (e) { bad++; }
      onProgress && onProgress(i + 1, list.length);
    }
    P.busy = false;
    await P.refresh();
    SS.pool && SS.pool.resetPersonal();
    return { ok, bad, total: list.length };
  };

  P.remove = async function (id) {
    const m = P.metas.find(x => x.id === id);
    if (m && (m.cloud || m.origin === 'cloud') && SS.cloud) await SS.cloud.removePhoto(id, m.cloud || m.asset);
    try { await U.idb.del('photoMeta', id); await U.idb.del('photoBlobs', id); } catch (e) { /* ignore */ }
    await P.refresh();
    SS.pool && SS.pool.resetPersonal();
  };
  P.clearDevice = async function () {
    for (const m of P.metas) if ((m.cloud || m.origin === 'cloud') && SS.cloud) await SS.cloud.removePhoto(m.id, m.cloud || m.asset);
    try { await U.idb.clear('photoMeta'); await U.idb.clear('photoBlobs'); } catch (e) { /* ignore */ }
    await P.refresh();
    SS.pool && SS.pool.resetPersonal();
  };
})();
