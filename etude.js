/* Étude guidée : lire une page de fiche, puis QCM sur cette page (page cachée), correction immédiate, bilan.
   Données : D.etude[<id du PDF>] = { titre, pages: { "<n° de page>": [ { q, c: [bonne, fausse, fausse, fausse], e } ] } }
   (la 1re proposition est la bonne ; l'ordre est mélangé à l'affichage).
   Progrès gardé sur l'appareil (localStorage « q1biomed.etude »). Styles : etude.css. */
(() => {
  'use strict';
  const STORE = 'q1biomed.etude';
  const LET = ['A', 'B', 'C', 'D', 'E'];
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // petit constructeur DOM local (indépendant du reste du site)
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  };
  const ico = (inner, cls) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2.2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls); s.innerHTML = inner; return s; };
  const I = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>', back: '<path d="M15 18l-6-6 6-6"/>', next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    ok: '<path d="M5 12l5 5 9-10"/>', ko: '<path d="M6 6l12 12M18 6L6 18"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', redo: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'
  };

  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (_) { return {}; } };
  const save = (all) => { try { localStorage.setItem(STORE, JSON.stringify(all)); } catch (_) {} };
  const shuffle = (n) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mins = (ms) => Math.max(1, Math.round(ms / 60000));

  let S = null; // état de la session en cours
  let root = null;

  const key = (it) => it.page + ':' + it.qi;
  const allItems = (data) => Object.keys(data.pages).map(Number).sort((a, b) => a - b)
    .flatMap((pg) => data.pages[pg].map((_, qi) => ({ page: pg, qi })));
  const qOf = (it) => S.data.pages[it.page][it.qi];
  const mine = () => { const all = load(); return all[S.p.id] || (all[S.p.id] = { res: {}, pos: 0, t: 0 }); };
  const persist = (fn) => { const all = load(); const m = all[S.p.id] || { res: {}, pos: 0, t: 0 }; fn(m); all[S.p.id] = m; save(all); };
  const tick = () => { const now = Date.now(); const dt = Math.min(now - S.since, 5 * 60000); S.since = now; persist((m) => { m.t = (m.t || 0) + dt; }); };

  /* ---------- Ouverture / fermeture ---------- */
  function open(opts) {
    // opts : { p, doc, data, page, onClose(page) }
    const items = allItems(opts.data);
    if (!items.length) return;
    S = { p: opts.p, doc: opts.doc, data: opts.data, items, onClose: opts.onClose, since: Date.now(), queue: items, mode: 'all', idx: 0, view: 'lire', picked: null, order: null, peekFrom: null, tokens: 0 };
    const m = mine();
    // reprise : là où il s'était arrêté ; tout fini → bilan ; sinon, si on ouvre depuis une page précise, on part de cette page
    if (m.pos >= items.length) S.view = 'bilan';
    else if (m.pos > 0) S.idx = m.pos;
    else if (opts.page > 1) { const i = items.findIndex((it) => it.page >= opts.page); S.idx = i > 0 ? i : 0; }
    if (!root) {
      root = el('div', { class: 'et', id: 'etude', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Étude guidée', hidden: true });
      document.body.append(root);
      document.addEventListener('keydown', onKey, true);
    }
    root.hidden = false; root.classList.remove('et-out'); document.body.classList.add('et-open');
    if (!reduce()) { root.classList.add('et-in'); setTimeout(() => root.classList.remove('et-in'), 450); }
    render();
  }
  function close() {
    if (!S) return;
    tick();
    const page = (S.queue[S.idx] || S.items[S.items.length - 1] || {}).page || 1, cb = S.onClose;
    S.tokens++; S = null;
    document.body.classList.remove('et-open');
    const done = () => { root.hidden = true; root.classList.remove('et-out'); root.replaceChildren(); };
    if (reduce()) done(); else { root.classList.add('et-out'); setTimeout(done, 260); }
    if (cb) cb(page);
  }

  /* ---------- Rendu d'une page du PDF ---------- */
  async function paint(box, n, maxW, maxH) {
    const my = S.tokens;
    try {
      const page = await S.doc.getPage(n); if (!S || my !== S.tokens) return;
      const base = page.getViewport({ scale: 1 });
      let w = Math.min(maxW, base.width * 1.8); if (maxH) w = Math.min(w, maxH * base.width / base.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2), vp = page.getViewport({ scale: (w / base.width) * dpr });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.style.width = w + 'px'; c.style.height = (w * base.height / base.width) + 'px';
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      if (!S || my !== S.tokens) return;
      box.replaceChildren(c);
    } catch (_) { box.replaceChildren(el('p', { class: 'et-msg' }, 'Impossible d’afficher cette page.')); }
  }

  /* ---------- Morceaux communs ---------- */
  const score = () => { const r = mine().res; const v = Object.values(r); return { ok: v.filter(Boolean).length, n: v.length }; };
  function topBar(label) {
    const it = S.queue[S.idx], pages = [...new Set(S.items.map((x) => x.page))], res = mine().res;
    const segs = pages.map((pg) => {
      const ks = S.items.filter((x) => x.page === pg).map(key), done = ks.filter((k) => k in res);
      const cls = it && pg === it.page && S.view !== 'bilan' ? 'cur' : done.length === ks.length ? (done.every((k) => res[k]) ? 'ok' : 'ko') : done.length ? 'part' : '';
      return el('i', { class: cls });
    });
    const sc = score(), pIdx = it ? pages.indexOf(it.page) + 1 : pages.length;
    return el('div', { class: 'et-top' },
      el('button', { class: 'et-ib', type: 'button', 'aria-label': 'Quitter l’étude guidée et revenir au PDF', onclick: close }, ico(I.back)),
      el('div', { class: 'et-tt' },
        el('span', { class: 'et-kicker' }, (S.p.matiere || 'Fiche') + ' · Étude guidée'),
        el('span', { class: 'et-name' }, S.data.titre || S.p.titre)),
      el('span', { class: 'et-pill' }, label),
      el('div', { class: 'et-prog' },
        el('div', { class: 'et-pl' }, el('span', { class: 'num' }, S.mode === 'retry' ? `À refaire : ${Math.min(S.idx + 1, S.queue.length)} / ${S.queue.length}` : `Étape ${pIdx} / ${pages.length}`), el('span', { class: 'num' }, sc.n ? `${sc.ok} juste${sc.ok > 1 ? 's' : ''} sur ${sc.n}` : 'Pas encore de réponse')),
        el('div', { class: 'et-segs', style: `grid-template-columns:repeat(${pages.length},minmax(0,1fr))`, 'aria-hidden': 'true' }, segs)));
  }
  const nOnPage = (pg) => S.data.pages[pg].length;
  const leftTime = () => { const rest = S.queue.slice(S.idx); const pgs = new Set(rest.map((x) => x.page)).size; return Math.max(1, Math.round(pgs * 1.2 + rest.length * 0.4)); };

  /* ---------- Écran 1 : lecture ---------- */
  function viewLire(peek) {
    const it = peek ? peek : S.queue[S.idx], pg = it.page;
    const pageBox = el('div', { class: 'et-canvas' }, el('p', { class: 'et-msg' }, 'Chargement de la page…'));
    const steps = el('div', { class: 'et-card et-how' },
      el('b', { class: 'et-h' }, 'Comment ça marche'),
      ...[['Tu lis la page, à ton rythme.', 1], ['La page se cache, le QCM apparaît.', 0], ['Correction immédiate + explication.', 0]].map(([t, on], i) =>
        el('div', { class: 'et-step' }, el('span', { class: 'et-n' + (on ? ' on' : '') }, String(i + 1)), el('span', {}, t))));
    const side = el('div', { class: 'et-side' },
      peek ? null : steps,
      el('div', { class: 'et-card' }, el('span', { class: 'et-k' }, 'Sur cette page'), el('span', { class: 'et-big num' }, String(nOnPage(pg)), el('small', {}, nOnPage(pg) > 1 ? ' questions' : ' question')), el('span', { class: 'et-k' }, `≈ ${nOnPage(pg) > 2 ? 2 : 1} min`)),
      peek ? null : el('div', { class: 'et-card et-dark' }, el('span', { class: 'et-k' }, S.mode === 'retry' ? 'Questions ratées' : 'Fiche'), el('span', { class: 'et-mid num' }, `≈ ${leftTime()} min restantes`), el('span', { class: 'et-k' }, 'Reprise auto là où tu t’arrêtes')));
    const prevIt = !peek && S.queue.slice(0, S.idx).reverse().find((x) => x.page !== pg);
    const foot = el('div', { class: 'et-foot' },
      peek ? el('span') : el('button', { class: 'et-btn', type: 'button', disabled: !prevIt, onclick: () => { S.idx = S.queue.indexOf(S.queue.find((x) => x.page === prevIt.page)); S.view = 'lire'; render(); } }, '← Page précédente'),
      peek ? el('button', { class: 'et-btn et-main', type: 'button', onclick: () => { S.view = S.peekFrom; S.peekFrom = null; render(); } }, S.peekFrom === 'bilan' ? 'Retour au bilan' : 'Retour à la question', ico(I.next))
        : el('button', { class: 'et-btn et-main', type: 'button', onclick: () => { S.view = 'qcm'; S.picked = null; S.order = null; render(); } }, 'J’ai lu — passer au QCM', ico(I.next)));
    const main = el('div', { class: 'et-card et-read' },
      el('div', { class: 'et-rh' }, el('span', {}, `Page ${pg} de la fiche`), el('button', { class: 'et-link et-zoom', type: 'button', 'aria-pressed': String(!!S.big), onclick: () => { S.big = !S.big; render(); } }, S.big ? 'Page entière' : 'Agrandir')),
      pageBox);
    const body = el('div', { class: 'et-body et-lire' }, main, side);
    requestAnimationFrame(() => { const r = pageBox.getBoundingClientRect(); const wide = window.innerWidth > 820; paint(pageBox, pg, Math.max(240, r.width - 4) * (S.big && !wide ? 1.7 : 1), wide && !S.big ? Math.max(320, r.height - 4) : 0); });
    pageBox.addEventListener('dblclick', () => { S.big = !S.big; render(); });
    return [topBar(peek ? 'Relecture' : 'Lecture'), body, foot];
  }

  /* ---------- Écran 2 : QCM ---------- */
  function viewQcm() {
    const it = S.queue[S.idx], q = qOf(it);
    if (!S.order) S.order = shuffle(q.c.length);
    const answered = S.picked !== null, right = answered && S.picked === 0;
    const sameP = S.queue.filter((x) => x.page === it.page), k = sameP.indexOf(it) + 1;
    const opts = S.order.map((ci, i) => {
      const isGood = ci === 0, isPick = ci === S.picked;
      const st = !answered ? '' : isGood ? ' good' : isPick ? ' bad' : ' dim';
      return el('button', { class: 'et-opt' + st, type: 'button', 'aria-pressed': String(isPick), disabled: answered && !isGood && !isPick ? true : null, onclick: () => pick(ci) },
        el('span', { class: 'et-let' }, LET[i]), el('span', { class: 'et-ot' }, q.c[ci]),
        answered && isGood ? ico(I.ok, 'et-mark') : null, answered && isPick && !isGood ? ico(I.ko, 'et-mark') : null);
    });
    const last = S.idx >= S.queue.length - 1, nextSame = !last && S.queue[S.idx + 1].page === it.page;
    const nextLabel = last ? 'Voir le bilan' : nextSame ? 'Question suivante' : 'Page suivante';
    const fb = !answered ? el('div', { class: 'et-wait' }, 'Touche une réponse : la correction s’affiche ici tout de suite.')
      : el('div', { class: 'et-fb ' + (right ? 'good' : 'bad'), role: 'status' },
        el('div', { class: 'et-fbt' }, el('b', {}, right ? 'Juste !' : 'Pas tout à fait'),
          el('span', {}, right ? q.e : `La bonne réponse : « ${q.c[0]} ». ${q.e}`)),
        el('div', { class: 'et-fba' },
          right ? null : el('button', { class: 'et-btn', type: 'button', onclick: () => { S.peekFrom = 'qcm'; S.view = 'peek'; render(); } }, ico(I.eye), 'Revoir la page'),
          el('button', { class: 'et-btn et-main', type: 'button', id: 'etNext', onclick: next }, nextLabel, ico(I.next))));
    const thumb = el('div', { class: 'et-thumb' + (answered ? '' : ' locked') });
    if (answered) requestAnimationFrame(() => paint(thumb, it.page, Math.max(160, thumb.getBoundingClientRect().width - 2), 0));
    else thumb.append(el('span', { class: 'et-lock' }, ico(I.lock), 'Réponds d’abord'));
    const side = el('div', { class: 'et-side et-qside' },
      el('div', { class: 'et-card' }, el('span', { class: 'et-k' }, `Page ${it.page} (cachée pendant le QCM)`), thumb,
        el('button', { class: 'et-link', type: 'button', onclick: () => { S.peekFrom = 'qcm'; S.view = 'peek'; render(); } }, answered ? 'Revoir la page en grand' : 'Je n’ai pas tout lu : revoir la page')),
      streak());
    const qcard = el('div', { class: 'et-card et-q' },
      el('span', { class: 'et-k' }, `Question ${k} / ${sameP.length} · page ${it.page}`),
      el('h2', { class: 'et-qt' }, q.q),
      el('div', { class: 'et-opts' + (answered ? ' done' : ''), role: 'group', 'aria-label': 'Propositions' }, opts));
    return [topBar('QCM · page ' + it.page), el('div', { class: 'et-body et-qcm' }, side, el('div', { class: 'et-qcol' }, qcard, fb))];
  }
  function streak() {
    const res = mine().res, done = S.items.filter((x) => key(x) in res);
    // série = réponses justes d'affilée, dans l'ordre de la fiche, jusqu'à la question en cours
    let n = 0; for (let i = done.length - 1; i >= 0; i--) { if (res[key(done[i])]) n++; else break; }
    const last = done.slice(-5).map((x) => el('span', { class: 'et-dot ' + (res[key(x)] ? 'ok' : 'ko') }));
    return el('div', { class: 'et-card' }, el('span', { class: 'et-k' }, 'Ta série'), el('div', { class: 'et-dots' }, last, el('span', { class: 'et-dot now' })),
      el('span', { class: 'et-k' }, n ? `${n} juste${n > 1 ? 's' : ''} d’affilée` : 'C’est parti'));
  }
  function pick(ci) {
    if (S.picked !== null || S.view !== 'qcm') return;
    S.picked = ci; const it = S.queue[S.idx], ok = ci === 0;
    persist((m) => { m.res[key(it)] = ok; });
    render();
    const b = document.getElementById('etNext'); if (b) b.focus({ preventScroll: true });
    try { if (!ok && navigator.vibrate) navigator.vibrate(60); } catch (_) {}
  }
  function next() {
    const it = S.queue[S.idx];
    S.idx++; S.picked = null; S.order = null;
    if (S.mode === 'all') persist((m) => { m.pos = S.idx; });
    tick();
    if (S.idx >= S.queue.length) { S.view = 'bilan'; render(); return; }
    S.view = S.queue[S.idx].page === it.page ? 'qcm' : 'lire';
    render();
  }

  /* ---------- Écran 3 : bilan ---------- */
  function viewBilan() {
    const m = mine(), res = m.res, total = S.items.length;
    const okN = S.items.filter((x) => res[key(x)] === true).length, koIt = S.items.filter((x) => res[key(x)] === false), seen = S.items.filter((x) => key(x) in res).length;
    const pct = seen ? Math.round(okN / seen * 100) : 0, C = 2 * Math.PI * 84;
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ring.setAttribute('viewBox', '0 0 200 200'); ring.setAttribute('class', 'et-ring'); ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', `${pct} % de bonnes réponses`);
    ring.innerHTML = `<circle cx="100" cy="100" r="84" fill="none" stroke="var(--pill)" stroke-width="18"/><circle cx="100" cy="100" r="84" fill="none" stroke="var(--ok)" stroke-width="18" stroke-linecap="round" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 100 100)"/><text x="100" y="114" text-anchor="middle" font-size="44" font-weight="800" fill="currentColor">${pct} %</text>`;
    const pagesKo = [...new Set(koIt.map((x) => x.page))];
    const list = pagesKo.length ? pagesKo.map((pg) => {
      const n = koIt.filter((x) => x.page === pg);
      return el('div', { class: 'et-ko' },
        el('span', { class: 'et-kopg num' }, 'p. ' + pg),
        el('span', { class: 'et-kot' }, n.map((x) => qOf(x).q).join(' · ')),
        el('span', { class: 'et-bad num' }, `${n.length} ratée${n.length > 1 ? 's' : ''}`),
        el('button', { class: 'et-btn et-sm', type: 'button', 'aria-label': `Revoir la page ${pg}`, onclick: () => { S.peekFrom = 'bilan'; S.view = 'peek'; S.peekPage = pg; render(); } }, ico(I.eye), 'Revoir'));
    }) : [el('p', { class: 'et-soft' }, 'Aucune erreur : tout est juste. Bravo !')];
    const retry = () => { S.mode = 'retry'; S.queue = koIt.slice(); S.idx = 0; S.view = 'lire'; S.picked = null; S.order = null; render(); };
    const restart = () => { persist((mm) => { mm.res = {}; mm.pos = 0; }); S.mode = 'all'; S.queue = S.items; S.idx = 0; S.view = 'lire'; S.picked = null; S.order = null; render(); };
    const body = el('div', { class: 'et-body et-bilan' },
      el('div', { class: 'et-card et-score' }, ring, el('b', { class: 'et-mid num' }, `${okN} / ${seen} justes`), el('span', { class: 'et-soft' }, `${new Set(S.items.map((x) => x.page)).size} pages · ${total} questions`)),
      el('div', { class: 'et-card et-wide' }, el('div', { class: 'et-rh' }, el('b', { class: 'et-h' }, pagesKo.length ? `À revoir — ${pagesKo.length} page${pagesKo.length > 1 ? 's' : ''}` : 'À revoir'), el('span', { class: 'et-soft num' }, `${koIt.length} erreur${koIt.length > 1 ? 's' : ''}`)), el('div', { class: 'et-kos' }, list)),
      el('div', { class: 'et-card et-dark' }, el('span', { class: 'et-k' }, 'Temps passé'), el('span', { class: 'et-big num' }, `${mins(m.t || 0)} min`), el('span', { class: 'et-k' }, 'Révise de nouveau dans 2 jours')),
      el('div', { class: 'et-card et-acts' }, el('b', { class: 'et-h' }, 'Et maintenant ?'),
        koIt.length ? el('button', { class: 'et-btn et-main', type: 'button', onclick: retry }, ico(I.redo), `Refaire les ${koIt.length} ratée${koIt.length > 1 ? 's' : ''} (≈ ${Math.max(1, Math.round(koIt.length * 0.7))} min)`) : null,
        el('button', { class: 'et-btn', type: 'button', onclick: restart }, 'Tout recommencer'),
        el('button', { class: 'et-btn', type: 'button', onclick: close }, 'Retour au PDF')));
    return [topBar('Bilan'), body];
  }

  /* ---------- Rendu ---------- */
  function render() {
    if (!S) return;
    S.tokens++;
    let kids;
    if (S.view === 'bilan') kids = viewBilan();
    else if (S.view === 'qcm') kids = viewQcm();
    else if (S.view === 'peek') kids = viewLire(S.peekFrom === 'bilan' ? { page: S.peekPage } : S.queue[S.idx]);
    else kids = viewLire(null);
    const wrap = el('div', { class: 'et-wrap et-v-' + S.view }, kids);
    root.replaceChildren(wrap);
    if (!reduce()) wrap.classList.add('et-fade');
    const f = root.querySelector('.et-main, .et-opt'); if (f && S.view !== 'qcm') f.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (!S || root.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (S.view === 'peek') { S.view = S.peekFrom; render(); } else close(); return; }
    if (S.view === 'qcm' && S.picked === null) {
      const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
      if (i >= 0 && S.order && i < S.order.length) { e.preventDefault(); pick(S.order[i]); }
    }
  }
  window.addEventListener('resize', () => { if (S && root && !root.hidden && (S.view === 'lire' || S.view === 'peek')) render(); });

  window.Q1Etude = {
    open,
    has: (data) => !!(data && data.pages && Object.keys(data.pages).length),
    count: (data) => data && data.pages ? Object.values(data.pages).reduce((a, l) => a + l.length, 0) : 0,
    progress: (id) => { const m = load()[id]; return m ? m : null; }
  };
})();
