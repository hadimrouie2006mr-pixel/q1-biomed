/* Animations du style « Verre ».
   - Changement d'onglet : l'ancienne page s'efface (View Transitions) pendant que la nouvelle arrive en cascade,
     du côté de l'onglet choisi ; le fond coloré glisse doucement vers une autre position.
   - Indicateurs qui glissent avec un ressort : onglets (rail + barre du bas) et boutons segmentés.
   - Listes qui se redessinent (jour, filtre, tri) : fondu court, dans le bon sens pour les jours.
   - Sorties animées (lecteur, minuteur, éditeur, dialogues, menus) : Q1Motion.hide(el).
   - Chiffres qui défilent, barres qui se remplissent.
   N'anime que transform et opacity (pas de flou) : fluide même avec le verre dépoli sur iPad.
   Respecte « réduire les animations ». */
(() => {
  'use strict';
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ORDER = ['aujourdhui', 'plan', 'semaine', 'quiz', 'pdf', 'cours', 'cahiers'];
  let lastTab = null;
  const fresh = new WeakMap(); // page -> instant d'arrivée (les redessins pendant l'entrée ne sont pas ré-animés)
  const curTab = () => { const a = document.querySelector('#bottomTabs [aria-current="page"], #railTabs [aria-current="page"]'); return a ? a.dataset.tab : null; };
  const once = (el, cb, ms) => {
    let done = false; const fin = (e) => { if (e && e.target !== el) return; if (done) return; done = true; el.removeEventListener('animationend', fin); clearTimeout(t); cb(); };
    el.addEventListener('animationend', fin); const t = setTimeout(fin, ms);
  };
  const play = (el, cls, ms = 900) => { el.classList.remove(...cls); void el.offsetWidth; el.classList.add(...cls); once(el, () => el.classList.remove(...cls), ms); };

  /* ---------- Sorties animées ---------- */
  // hide(el) : joue l'animation de sortie (.mo-close) puis met hidden. show(el) annule une sortie en cours.
  function hide(el, done) {
    if (!el || el.hidden) { if (done) done(); return; }
    if (reduce()) { el.hidden = true; if (done) done(); return; }
    el.classList.remove('mo-open'); el.classList.add('mo-close');
    once(el, () => { if (el.classList.contains('mo-close')) { el.classList.remove('mo-close'); el.hidden = true; } if (done) done(); }, 420);
  }
  function show(el) { if (!el) return; el.classList.remove('mo-close'); el.hidden = false; }
  const closing = (el) => !!el && el.classList.contains('mo-close');

  /* ---------- Indicateur qui glisse (onglets et boutons segmentés) ---------- */
  function placeInd(nav, sel, immediate) {
    if (!nav || !nav.isConnected) return;
    let ind = nav.querySelector(':scope > .tab-ind');
    const cur = nav.querySelector(sel);
    if (!cur || !cur.offsetWidth) { if (ind) ind.style.opacity = '0'; return; }
    if (!ind) { ind = document.createElement('span'); ind.className = 'tab-ind'; ind.setAttribute('aria-hidden', 'true'); nav.prepend(ind); immediate = true; }
    if (getComputedStyle(nav).position === 'static') nav.style.position = 'relative';
    if (immediate) ind.style.transition = 'none';
    ind.style.opacity = '1';
    ind.style.width = cur.offsetWidth + 'px'; ind.style.height = cur.offsetHeight + 'px';
    ind.style.transform = `translate(${cur.offsetLeft}px, ${cur.offsetTop}px)`;
    if (immediate) { void ind.offsetWidth; ind.style.transition = ''; }
  }
  const placeTabs = () => { placeInd(document.getElementById('railTabs'), '[aria-current="page"]'); placeInd(document.getElementById('bottomTabs'), '[aria-current="page"]'); };
  // Boutons segmentés : recréés à chaque clic, on garde la dernière position par groupe pour repartir de là
  const segPos = new Map();
  function placeSeg(seg) {
    if (!seg.isConnected) return;
    const key = seg.getAttribute('aria-label') || '';
    let ind = seg.querySelector(':scope > .tab-ind');
    const cur = seg.querySelector(':scope > [aria-pressed="true"]');
    seg.classList.add('has-ind');
    if (!cur || !cur.offsetWidth) return;
    const pg = seg.closest('.page'), young = pg && fresh.has(pg) && performance.now() - fresh.get(pg) < 500;
    if (!ind) {
      ind = document.createElement('span'); ind.className = 'tab-ind seg-ind'; ind.setAttribute('aria-hidden', 'true'); seg.prepend(ind);
      const p = segPos.get(key);
      ind.style.transition = 'none';
      if (p && !young && !reduce()) { ind.style.width = p.w + 'px'; ind.style.height = p.h + 'px'; ind.style.transform = `translate(${p.x}px, ${p.y}px)`; void ind.offsetWidth; ind.style.transition = ''; }
      else { placeInd(seg, ':scope > [aria-pressed="true"]', true); segPos.set(key, { x: cur.offsetLeft, y: cur.offsetTop, w: cur.offsetWidth, h: cur.offsetHeight }); return; }
    }
    placeInd(seg, ':scope > [aria-pressed="true"]');
    segPos.set(key, { x: cur.offsetLeft, y: cur.offsetTop, w: cur.offsetWidth, h: cur.offsetHeight });
  }
  const placeSegs = (root) => (root || document).querySelectorAll('.seg').forEach(placeSeg);

  /* ---------- Chiffres qui défilent ---------- */
  function countUp(el) {
    const tn = [...el.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue));
    if (!tn) return;
    const raw = tn.nodeValue.trim(), m = raw.match(/^(\d+)(?:[,.](\d+))?$/); if (!m) return;
    const target = parseFloat(raw.replace(',', '.')), dec = m[2] ? m[2].length : 0, dur = 800;
    if (!target) return;
    let t0 = null;
    const step = (t) => {
      if (t0 === null) t0 = t;
      const k = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 4);
      tn.nodeValue = (target * e).toFixed(dec).replace('.', ',');
      if (k < 1) requestAnimationFrame(step); else tn.nodeValue = raw;
    };
    tn.nodeValue = (0).toFixed(dec).replace('.', ','); requestAnimationFrame(step);
  }

  /* ---------- Entrée d'une page ---------- */
  function animatePage(page) {
    fresh.set(page, performance.now());
    const tab = curTab(); let dir = '';
    if (lastTab && tab && lastTab !== tab) dir = ORDER.indexOf(tab) > ORDER.indexOf(lastTab) ? 'from-r' : 'from-l';
    if (tab) lastTab = tab;
    requestAnimationFrame(() => placeSegs(page));
    if (reduce()) return;
    const kids = [...page.children].filter((el) => el.nodeType === 1 && !el.hidden);
    kids.forEach((el, i) => { el.style.setProperty('--i', String(Math.min(i, 7))); play(el, ['mo-in', ...(dir ? [dir] : [])], 1400); });
    page.querySelectorAll('.stat .v, .kpi b, .nb-hero h1 + .nb-sub b').forEach(countUp);
    page.querySelectorAll('.nowcard .prog i, .bar i, .plan-prog .prog i').forEach((b) => play(b, ['mo-fill'], 1600));
  }

  /* ---------- Redessin d'une partie de page (jour, filtre, tri, onglet interne) ---------- */
  const NO_SWAP = '.chips, .seg, .days, .plan, .nb-lib, .gcal, .tab-ind';
  function swapIn(container, nodes) {
    if (reduce() || !nodes.length) return;
    // pas pendant la frappe dans une recherche, ni derrière le lecteur ou l'éditeur
    const ae = document.activeElement; if (ae && ae.type === 'search' && container.contains && !container.contains(ae)) return;
    if (!document.getElementById('reader').hidden || document.querySelector('#ne:not([hidden])')) return;
    const holder = container.closest('[data-mo-dir]');
    const dir = holder ? holder.dataset.moDir : '';
    if (holder) delete holder.dataset.moDir;
    nodes.slice(0, 12).forEach((el, i) => { el.style.setProperty('--i', String(Math.min(i, 6))); play(el, ['mo-swap', ...(dir ? ['from-' + dir] : [])], 900); });
  }
  function onViewMutations(ms) {
    let segs = false;
    const groups = new Map();
    for (const m of ms) {
      if (m.type === 'attributes') {
        const el = m.target;
        if (el.closest('.seg')) { segs = true; continue; }
        if (m.attributeName === 'hidden' && !el.hidden && !el.closest(NO_SWAP)) { const pg = el.closest('.page'); if (pg && fresh.has(pg) && performance.now() - fresh.get(pg) > 450) swapIn(el, [el]); }
        continue;
      }
      if (m.target.id === 'view') {
        for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('page')) {
          animatePage(n);
          // la bibliothèque des Cahiers se remplit après coup : on anime aussi son contenu
          if (n.classList.contains('nb-lib')) { const ob = new MutationObserver(() => { ob.disconnect(); animatePage(n); }); ob.observe(n, { childList: true }); }
        }
        requestAnimationFrame(placeTabs);
        continue;
      }
      const t = m.target;
      if (t.closest('.seg') || (t.classList && t.classList.contains('seg'))) { segs = true; continue; }
      if (t.closest(NO_SWAP)) continue;
      const pg = t.closest('.page'); if (!pg || !fresh.has(pg) || performance.now() - fresh.get(pg) < 450) continue;
      const added = [...m.addedNodes].filter((n) => n.nodeType === 1);
      for (const n of added) if (n.matches('.seg') || n.querySelector('.seg')) segs = true;
      // les contrôles (boutons segmentés, puces) restent en place : seul le contenu s'anime
      const moving = added.filter((n) => !n.matches('.seg, .chips, .days, .tab-ind'));
      if (moving.length) groups.set(t, (groups.get(t) || []).concat(moving));
    }
    groups.forEach((nodes, t) => swapIn(t, nodes));
    if (segs) requestAnimationFrame(() => placeSegs(document.getElementById('view')));
  }

  /* ---------- Changement d'onglet : transition de vue ---------- */
  // Utilisée par show() dans index.html : Q1Motion.swapPage(() => remplace le contenu)
  function swapPage(fn, tab) {
    const prev = lastTab;
    document.documentElement.dataset.tab = tab || '';
    const overlay = !document.getElementById('reader').hidden || document.querySelector('#ne:not([hidden])');
    if (reduce() || !document.startViewTransition || !prev || prev === tab || overlay || document.hidden) { fn(); return; }
    const html = document.documentElement;
    html.classList.add('vt-tab');
    html.dataset.vtDir = ORDER.indexOf(tab) > ORDER.indexOf(prev) ? 'r' : 'l';
    try {
      const vt = document.startViewTransition(fn);
      vt.finished.finally(() => html.classList.remove('vt-tab'));
    } catch (_) { html.classList.remove('vt-tab'); fn(); }
  }
  // Thème : fondu enchaîné entre clair et sombre
  function themeSwap(fn) {
    if (reduce() || !document.startViewTransition) { fn(); return; }
    const html = document.documentElement; html.classList.add('vt-theme');
    try { document.startViewTransition(fn).finished.finally(() => html.classList.remove('vt-theme')); } catch (_) { html.classList.remove('vt-theme'); fn(); }
  }

  /* ---------- Petites aides ---------- */
  const shake = (el) => { if (el && !reduce()) play(el, ['mo-shake'], 700); };
  const pop = (el) => { if (el && !reduce()) play(el, ['mo-pop'], 700); };

  window.Q1Motion = { hide, show, closing, swapPage, themeSwap, shake, pop, placeSegs, reduce };

  function boot() {
    const view = document.getElementById('view'); if (!view) return;
    new MutationObserver(onViewMutations).observe(view, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-pressed'] });
    const navObs = new MutationObserver(() => requestAnimationFrame(placeTabs));
    ['railTabs', 'bottomTabs'].forEach((id) => { const el = document.getElementById(id); if (el) navObs.observe(el, { attributes: true, subtree: true, attributeFilter: ['aria-current'], childList: true }); });
    let rz = 0; addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { placeTabs(); placeSegs(view); }); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { placeTabs(); placeSegs(view); });
    const app = document.getElementById('app');
    if (app) new MutationObserver(() => { if (!app.hidden) setTimeout(placeTabs, 30); }).observe(app, { attributes: true, attributeFilter: ['hidden'] });
    // lecteur PDF, minuteur et éditeur : ouverture animée
    const opener = (el) => el && new MutationObserver(() => { if (!el.hidden && !reduce()) { el.classList.remove('mo-close'); play(el, ['mo-open'], 900); } }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
    opener(document.getElementById('reader')); opener(document.getElementById('pomo'));
    if (!document.documentElement.dataset.tab) document.documentElement.dataset.tab = curTab() || '';
    placeTabs(); placeSegs(view);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
