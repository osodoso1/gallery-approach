/* X posts: accounts you follow and post links you save, shown in the slideshow with X's own embeds.
   Nothing is downloaded or copied: each slide is X's embedded post or timeline, played in X's player.
   It's one of the app's services, in the Genres menu with a checkbox for each account. */
(function () {
  'use strict';
  const U = SS.u, h = U.h;
  const XF = (SS.xfeed = {});
  const RESERVED = /^(home|i|search|explore|settings|notifications|messages|intent|hashtag|share|compose|login|signup|tos|privacy|about|jobs)$/i;
  const cfg = () => SS.settings.xfeed || { accounts: [], posts: [] };
  const save = c => SS.setSetting('xfeed', { accounts: c.accounts.slice(), posts: c.posts.slice() });

  /* ── Reading what you paste: profile links, post links, @handles ── */
  XF.parse = function (text) {
    const out = { accounts: [], posts: [] };
    const toks = String(text || '').split(/[\s,]+/).filter(Boolean);
    toks.forEach(t => {
      let m = t.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{5,25})/i);
      if (m) return out.posts.push({ id: m[2], user: m[1] });
      if (/\/status(es)?\//i.test(t)) return;             // a post link we can't read: don't mistake it for an account
      m = t.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i);
      if (m && !RESERVED.test(m[1])) return out.accounts.push(m[1]);
      // a bare name counts if it has an @, or if it's the only thing pasted
      m = t.match(/^(@)?([A-Za-z0-9_]{1,15})$/);
      if (m && (m[1] || toks.length === 1) && !/^\d+$/.test(m[2])) out.accounts.push(m[2]);
    });
    return out;
  };
  XF.add = function (text) {
    const p = XF.parse(text), c = cfg(), had = new Set(c.accounts.map(a => a.toLowerCase())), hadP = new Set(c.posts.map(x => x.id));
    const accounts = p.accounts.filter(a => !had.has(a.toLowerCase()) && had.add(a.toLowerCase()));
    const posts = p.posts.filter(x => !hadP.has(x.id) && hadP.add(x.id));
    if (!accounts.length && !posts.length) return { accounts, posts };
    c.accounts = c.accounts.concat(accounts); c.posts = c.posts.concat(posts.map(x => ({ ...x, added: Date.now() })));
    accounts.forEach(a => SS.setSetting('weights.' + srcId(a), 2));
    save(c); sync(); return { accounts, posts };
  };
  XF.removeAccount = a => { const c = cfg(); c.accounts = c.accounts.filter(x => x.toLowerCase() !== a.toLowerCase()); save(c); SS.setSetting('weights.' + srcId(a), 0); sync(); };
  XF.removePost = id => { const c = cfg(); c.posts = c.posts.filter(x => x.id !== id); save(c); sync(); };
  XF.followUrl = a => 'https://x.com/intent/follow?screen_name=' + encodeURIComponent(a);
  XF.profileUrl = a => 'https://x.com/' + encodeURIComponent(a);
  XF.postUrl = p => `https://x.com/${encodeURIComponent(p.user || 'i')}/status/${p.id}`;
  const srcId = a => 'x_' + a.toLowerCase();

  /* ── X's widget script, loaded only when there's something to show ── */
  let wp = null;
  XF.widgets = function () {
    if (window.twttr && window.twttr.widgets && window.twttr.widgets.createTweet) return Promise.resolve(window.twttr);
    if (wp) return wp;
    wp = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://platform.x.com/widgets.js'; s.async = true; s.charset = 'utf-8';
      const t = setTimeout(() => rej(new Error("X's embeds didn't load")), 15000);
      s.onload = () => { const ok = () => window.twttr && window.twttr.widgets && window.twttr.widgets.createTweet; let n = 0; const w = () => ok() ? (clearTimeout(t), res(window.twttr)) : n++ < 50 ? setTimeout(w, 100) : rej(new Error('X embeds unavailable')); w(); };
      s.onerror = () => { clearTimeout(t); rej(new Error("X's embeds are blocked here")); };
      document.head.appendChild(s);
    });
    wp.catch(() => { setTimeout(() => (wp = null), 60e3); XF.blocked = true; });
    return wp;
  };

  /* ── A slide: a card holding X's embed, laid out (hidden) while the slide is prepared, shown when it's up ── */
  function layer() { let l = U.$('#domSlides'); if (!l) { l = h('div', { id: 'domSlides' }); U.$('#stage').appendChild(l); } return l; }
  async function card(item) {
    const tw = await XF.widgets();
    const box = h('div', { class: 'xcard' + (item.x.post ? ' post' : ' feed') });
    const head = h('div', { class: 'xcard-head' },
      h('a', { href: item.x.post ? XF.postUrl(item.x.post) : XF.profileUrl(item.x.account), target: '_blank', rel: 'noopener' }, item.x.post ? `Post by @${item.x.post.user}` : `@${item.x.account} on X`),
      h('a', { class: 'xcard-follow', href: XF.followUrl(item.x.post ? item.x.post.user : item.x.account), target: '_blank', rel: 'noopener', title: 'Opens X so you can follow this account' }, 'Follow on X'));
    const body = h('div', { class: 'xcard-body' });
    box.append(head, body);
    const wrap = h('div', { class: 'slide-dom' }, box);
    layer().appendChild(wrap);
    const opts = { theme: 'dark', dnt: true, align: 'center' };
    let el;
    try {
      el = item.x.post
        ? await tw.widgets.createTweet(item.x.post.id, body, Object.assign({ conversation: 'none' }, opts))
        : await tw.widgets.createTimeline({ sourceType: 'profile', screenName: item.x.account }, body, Object.assign({ height: Math.round(innerHeight * (innerWidth > innerHeight ? 0.7 : 0.56)), chrome: 'noheader nofooter transparent' }, opts));
    } catch (e) { el = null; }
    if (!el) { wrap.remove(); throw new Error(item.x.post ? 'That post is gone or private' : "That account's posts couldn't be shown"); }
    return wrap;
  }
  // the picture behind the card: a quiet dark backdrop with the account's name
  XF.backdrop = function (g, item, W, H) {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#0b0e14'); gr.addColorStop(1, '#151a24');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = g.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.6); r.addColorStop(0, 'rgba(120,150,210,.16)'); r.addColorStop(1, 'rgba(120,150,210,0)');
    g.fillStyle = r; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.035)'; g.font = `700 ${Math.round(Math.min(W, H) * 0.16)}px Inter, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('@' + (item.x.post ? item.x.post.user : item.x.account), W / 2, H * 0.5, W * 0.92);
  };

  /* ── Sources: saved posts, and one per account you follow ── */
  let postQ = [];
  const itemFor = x => {
    const who = x.post ? x.post.user : x.account;
    return { key: 'x:' + (x.post ? x.post.id : x.account) + ':' + Date.now(), ephemeral: true, src: x.post ? 'xposts' : srcId(x.account), kind: 'embed', x,
      title: x.post ? `Post by @${who}` : `@${who}`, detail: x.post ? 'A post you saved · shown from X' : 'Their latest posts · shown from X',
      creator: '@' + who, license: 'Shown with X’s embed', link: x.post ? XF.postUrl(x.post) : XF.profileUrl(who), dom: () => card({ x }), backdrop: (g, W, H) => XF.backdrop(g, { x }, W, H) };
  };
  function sync() {
    const c = cfg();
    if (!SS.providers.xposts) SS.addSource({ id: 'xposts', name: 'Saved posts', sub: 'Post links you saved', color: '#9aa4b2', api: 'x.com embeds',
      async fetchBatch() { const l = cfg().posts; if (!l.length) return []; await XF.widgets(); if (!postQ.length) postQ = U.shuffle(l.slice()); return postQ.splice(0, 3).map(p => itemFor({ post: p })); } });
    c.accounts.forEach(a => {
      const id = srcId(a);
      if (!SS.providers[id]) SS.addSource({ id, name: '@' + a, sub: `Latest posts from @${a}`, color: '#9aa4b2', api: 'x.com embeds',
        async fetchBatch() { if (!cfg().accounts.some(x => srcId(x) === id)) return []; await XF.widgets(); return [itemFor({ account: a })]; } });
      if (SS.settings.weights[id] == null) SS.settings.weights[id] = 2;
    });
    const g = SS.genres.find(x => x.id === 'x');
    const srcs = ['xposts'].concat(c.accounts.map(srcId));
    if (g) g.srcs = srcs;
    else SS.addGenre({ id: 'x', name: 'X posts', sub: 'Accounts you follow and posts you save, shown with X’s embeds', color: '#9aa4b2', srcs }, 'video');
    srcs.forEach(id => { if (SS.providers[id]) SS.providers[id].genre = 'x'; });
    if (SS.ui && SS.ui.genreLabel) SS.ui.genreLabel();
  }
  XF.sync = sync;

  /* ── Settings → X posts ── */
  function section(m) {
    const ui = SS.settingsUI.ui, c = cfg();
    const inp = h('textarea', { class: 'xf-in', rows: 2, placeholder: 'Paste X profile links, post links or @names (several at once is fine)' });
    const add = () => {
      const r = XF.add(inp.value);
      if (!r.accounts.length && !r.posts.length) { U.toast(inp.value.trim() ? 'No new X accounts or post links in that' : 'Paste a link or @name first'); return; }
      U.toast([r.accounts.length ? `${r.accounts.length} account${r.accounts.length > 1 ? 's' : ''}` : '', r.posts.length ? `${r.posts.length} post${r.posts.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ') + ' added');
      inp.value = ''; SS.pool.refill && ['xposts'].concat(r.accounts.map(srcId)).forEach(id => SS.pool.refill(id)); SS.settingsUI.ui.render();
    };
    const accs = h('div', { class: 'xf-list' }, ...(c.accounts.length ? c.accounts.map(a => h('div', { class: 'xf-row' },
      h('a', { class: 'xf-name', href: XF.profileUrl(a), target: '_blank', rel: 'noopener' }, '@' + a),
      h('a', { class: 'btn small', href: XF.followUrl(a), target: '_blank', rel: 'noopener', title: 'Opens X so you can follow this account' }, 'Follow on X'),
      h('button', { class: 'btn small ghost', onclick: () => { XF.removeAccount(a); SS.settingsUI.ui.render(); } }, 'Remove'))) : [h('p', { class: 'note' }, 'No accounts yet.')]));
    const posts = h('div', { class: 'xf-list' }, ...(c.posts.length ? c.posts.map(p => h('div', { class: 'xf-row' },
      h('a', { class: 'xf-name', href: XF.postUrl(p), target: '_blank', rel: 'noopener' }, `@${p.user} · post ${p.id.slice(-6)}`),
      h('button', { class: 'btn small ghost', onclick: () => { XF.removePost(p.id); SS.settingsUI.ui.render(); } }, 'Remove'))) : [h('p', { class: 'note' }, 'No saved posts yet.')]));
    m.append(h('h2', null, 'X posts'),
      h('p', { class: 'lead' }, 'Accounts you follow and posts you save show up in the slideshow, using X’s own embeds: nothing is downloaded. Each account gets its own checkbox under X posts in the Genres menu.'),
      h('div', { class: 'xf-add' }, inp, h('button', { class: 'btn', onclick: add }, 'Add')),
      h('h3', null, `Accounts you follow (${c.accounts.length})`), accs,
      h('h3', null, `Saved posts (${c.posts.length})`), posts,
      h('p', { class: 'note' }, 'Good to know: videos in X embeds start when you tap them. Only public accounts can be shown. "Follow on X" opens X, where you confirm the follow on your own account. ' +
        (XF.blocked || window.claude ? 'This page can’t load X’s embeds (Claude pages block outside content), so open your GitHub site to see them.' : '')));
  }

  XF.init = function () {
    sync();
    if (SS.settingsUI && SS.settingsUI.addSection) SS.settingsUI.addSection('xfeed', 'X posts', section, 'sources');
    SS.on('settings', p => { if (p === 'cloud' || p === 'xfeed') sync(); });
    // tidy away a prepared card that never made it to the screen
    setInterval(() => { const l = U.$('#domSlides'); if (!l) return; [...l.children].forEach(c => { if (!c.classList.contains('on') && Date.now() - (c._t || (c._t = Date.now())) > 10 * 60e3) c.remove(); }); }, 60e3);
  };
})();
