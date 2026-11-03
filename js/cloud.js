/* Cross-device sync when the app is opened from claude.ai (the hosted page).
   Your settings, to-do board, events and photos are kept in your own private space
   in your claude.ai account, so your iPhone, iPad and laptop all show the same thing.
   (On a Pi, the companion server does the syncing instead: see core.js SS.sync.) */
(function () {
  'use strict';
  const U = SS.u;
  const CL = (SS.cloud = { on: false, status: 'off', uid: null, db: null, assets: null, photos: [], usage: null, uploading: 0 });
  // API keys and private calendar links stay on each device.
  const DEVICE_ONLY = ['harvardKey', 'icsUrls', 'env.pollenKey', 'serverUrl', 'syncKey', '_at'];
  const getP = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const setP = (o, p, v) => { const ks = p.split('.'); let x = o; for (let i = 0; i < ks.length - 1; i++) { if (x[ks[i]] == null) x[ks[i]] = {}; x = x[ks[i]]; } x[ks[ks.length - 1]] = v; };

  CL.init = async function () {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    CL.status = 'connecting'; SS.emit('cloud');
    let db = null, user = null;
    try { [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch (e) { /* unavailable */ }
    if (!db || !user) { CL.status = 'unavailable'; SS.emit('cloud'); return; }
    let uid = null;
    try { uid = await user.id(); } catch (e) { uid = null; }
    if (!uid) { CL.status = 'signed out'; SS.emit('cloud'); return; }
    CL.db = db; CL.uid = uid;
    try { CL.assets = await window.claude.use('assets'); } catch (e) { CL.assets = null; }
    CL.stateRef = db.doc(`data/users/${uid}/state`);
    CL.on = true; CL.status = 'syncing'; SS.emit('cloud');
    const t = setTimeout(() => { if (CL.status === 'syncing') { CL.status = 'unreachable'; SS.emit('cloud'); } }, 10000);
    CL.stateRef.onSnapshot(snap => {
      if (!snap.metadata.fromCache) { clearTimeout(t); CL.status = 'on'; }
      if (!snap.metadata.hasPendingWrites) {
        if (!snap.exists) { if (!snap.metadata.fromCache) CL.push(); }
        else apply(snap.data());
      }
      SS.emit('cloud');
    }, err => { clearTimeout(t); CL.status = 'error (' + (err && err.code) + ')'; SS.emit('cloud'); });
    db.collection(`data/users/${uid}`).where('kind', '==', 'photo').onSnapshot(snap => {
      CL.photos = snap.docs.map(d => d.data()).filter(Boolean);
      SS.photos.refresh().then(uploadPending);
    }, () => {});
    refreshUsage();
  };

  function apply(d) {
    let s = false, st = false;
    if (d.settings && (d.settingsAt || 0) > (SS.settings._at || 0)) {
      const keep = {}; DEVICE_ONLY.forEach(p => (keep[p] = getP(SS.settings, p)));
      const merged = SS.merge(SS.DEFAULTS, d.settings);
      Object.keys(merged).forEach(k => (SS.settings[k] = merged[k]));
      DEVICE_ONLY.forEach(p => { if (keep[p] !== undefined) setP(SS.settings, p, keep[p]); });
      SS.settings._at = d.settingsAt;
      U.store.set('settings', SS.settings);
      s = true;
    }
    if ((d.stateAt || 0) > (SS.state.updatedAt || 0)) {
      if (Array.isArray(d.board)) SS.state.board = d.board;
      if (Array.isArray(d.events)) SS.state.events = d.events;
      SS.state.updatedAt = d.stateAt;
      U.store.set('board', SS.state.board); U.store.set('events', SS.state.events); U.store.set('stateAt', d.stateAt);
      st = true;
    }
    if (s) { SS.emit('settings', 'cloud'); SS.show && SS.show.schedule(); }
    if (st) SS.emit('state');
  }

  // One write at a time; bursts collapse into one.
  let pushing = false, again = false;
  async function doPush() {
    if (!CL.on) return;
    if (pushing) { again = true; return; }
    pushing = true;
    try {
      const settings = JSON.parse(JSON.stringify(SS.settings));
      DEVICE_ONLY.forEach(p => setP(settings, p, null));
      await CL.stateRef.set({ v: 1, settings, settingsAt: SS.settings._at || Date.now(), board: SS.state.board, events: SS.state.events, stateAt: SS.state.updatedAt || Date.now() });
    } catch (e) {
      if (e && e.code === 'unavailable') setTimeout(doPush, 1500 + Math.random() * 2000);
      else { CL.status = 'error (' + (e && e.code) + ')'; SS.emit('cloud'); }
    } finally {
      pushing = false;
      if (again) { again = false; doPush(); }
    }
  }
  CL.push = U.debounce(doPush, 1500);

  /* ── Photos ── */
  CL.canSyncPhotos = () => CL.on && !!CL.assets && SS.settings.photoSync;
  CL.uploadPhoto = async function (meta, blob) {
    if (!CL.canSyncPhotos()) return null;
    CL.uploading++; SS.emit('cloud');
    try {
      const r = await CL.assets.upload(blob, { type: blob.type && /^image\/(jpeg|png|webp|gif)$/.test(blob.type) ? blob.type : 'image/jpeg' });
      await CL.db.collection(`data/users/${CL.uid}`).doc('p_' + meta.id).set({ kind: 'photo', id: meta.id, asset: r.id, name: meta.name || '', folder: meta.folder || '', date: meta.date || null, w: meta.w || 0, h: meta.h || 0, added: meta.added || Date.now() });
      return r.id;
    } catch (e) {
      if (e && (e.code === 'quota_or_state' || e.code === 'quota_exceeded')) U.toast('Photo storage on claude.ai is full. Older photos stay on this device only.');
      return null;
    } finally { CL.uploading--; SS.emit('cloud'); refreshUsage(); }
  };
  CL.removePhoto = async function (id, asset) {
    if (!CL.on) return;
    try { await CL.db.collection(`data/users/${CL.uid}`).doc('p_' + id).delete(); } catch (e) { /* ignore */ }
    if (asset && CL.assets) { try { await CL.assets.delete(asset); } catch (e) { /* ignore */ } }
    refreshUsage();
  };
  // Photos added on this device before sync was on get uploaded quietly, one at a time.
  let draining = false;
  async function uploadPending() {
    if (draining || !CL.canSyncPhotos()) return;
    draining = true;
    try {
      const cloudIds = new Set(CL.photos.map(p => p.id));
      const pending = SS.photos.metas.filter(m => m.origin === 'device' && !m.cloud && !cloudIds.has(m.id));
      for (const m of pending) {
        const rec = await U.idb.get('photoBlobs', m.id).catch(() => null);
        if (!rec || !rec.blob) continue;
        const asset = await CL.uploadPhoto(m, rec.blob);
        if (!asset) break;
        const { origin, ...meta } = m;
        await U.idb.put('photoMeta', { ...meta, cloud: asset }).catch(() => {});
      }
    } finally { draining = false; }
  }
  CL.uploadPending = uploadPending;
  async function refreshUsage() {
    if (!CL.assets) return;
    try { const r = await CL.assets.list(); CL.usage = r.usage; SS.emit('cloud'); } catch (e) { /* ignore */ }
  }
  CL.describe = function () {
    if (!window.claude) return 'Only available when opened from claude.ai';
    if (CL.status === 'on') return `On · synced through your claude.ai account${CL.uploading ? ` · uploading ${CL.uploading} photo…` : ''}`;
    return { connecting: 'Connecting…', syncing: 'Connecting…', unavailable: 'Not available in this view', 'signed out': 'Sign in to claude.ai to sync', unreachable: "Can't reach claude.ai right now", off: 'Off' }[CL.status] || CL.status;
  };
})();
