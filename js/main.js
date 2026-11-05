/* Boot. */
(async function () {
  'use strict';
  const U = SS.u;
  SS.ui.init();
  SS.on('ready', () => { const b = U.$('#boot'); if (b) { b.classList.add('gone'); setTimeout(() => b.remove(), 1500); } });
  await SS.server.detect();
  SS.sync.pull();
  SS.radar.init(); SS.radar.autoCompass();   // the compass is on unless you switch it off
  SS.planner.init();
  SS.env2.init();
  SS.flights.start();
  await SS.photos.refresh();
  SS.pool.warm();
  SS.show.start();
  SS.cloud.init(); // claude.ai page: sync through your account
  setInterval(() => SS.photos.refresh(), 10 * 60e3);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* sandboxed */ }
  }
})();
