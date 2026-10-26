/* Animations du style « Verre » : entrées de page en cascade (direction selon l'onglet),
   indicateur d'onglet qui glisse avec un ressort, chiffres qui défilent, barres qui se remplissent,
   lecteur et minuteur qui s'ouvrent en douceur. Respecte « réduire les animations ». */
(() => {
  'use strict';
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ORDER = ['aujourdhui', 'plan', 'semaine', 'quiz', 'pdf', 'cours', 'cahiers'];
  let lastTab = null;
  const curTab = () => { const a = document.querySelector('#bottomTabs [aria-current="page"], #railTabs [aria-current="page"]'); return a ? a.dataset.tab : null; };

  /* ---------- Indicateur d'onglet (rail + barre du bas) ---------- */
  function placeInd(nav) {
    if (!nav || !nav.isConnected) return;
    let ind = nav.querySelector(':scope > .tab-ind');
    const cur = nav.querySelector('[aria-current="page"]');
    if (!cur || !cur.offsetWidth) { if (ind) ind.style.opacity = '0'; return; }
    if (!ind) { ind = document.createElement('span'); ind.className = 'tab-ind'; ind.setAttribute('aria-hidden', 'true'); nav.prepend(ind); ind.style.transition = 'none'; }
    if (getComputedStyle(nav).position === 'static') nav.style.position = 'relative';
    ind.style.opacity = '1';
    ind.style.width = cur.offsetWidth + 'px'; ind.style.height = cur.offsetHeight + 'px';
    ind.style.transform = `translate(${cur.offsetLeft}px, ${cur.offsetTop}px)`;
    if (ind.style.transition === 'none') requestAnimationFrame(() => requestAnimationFrame(() => { ind.style.transition = ''; }));
  }
  const placeAll = () => { placeInd(document.getElementById('railTabs')); placeInd(document.getElementById('bottomTabs')); };

  /* ---------- Chiffres qui défilent ---------- */
  function countUp(el) {
    const tn = [...el.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue));
    if (!tn) return;
    const raw = tn.nodeValue.trim(), m = raw.match(/^(\d+)(?:[,.](\d+))?$/); if (!m) return;
    const target = parseFloat(raw.replace(',', '.')), dec = m[2] ? m[2].length : 0, t0 = performance.now(), dur = 900;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      tn.nodeValue = (target * e).toFixed(dec).replace('.', ',');
      if (k < 1) requestAnimationFrame(step); else tn.nodeValue = raw;
    };
    tn.nodeValue = (0).toFixed(dec).replace('.', ','); requestAnimationFrame(step);
  }

  /* ---------- Entrée d'une page ---------- */
  function animatePage(page) {
    if (!page || reduce()) return;
    const tab = curTab(); let dir = '';
    if (lastTab && tab && lastTab !== tab) dir = ORDER.indexOf(tab) > ORDER.indexOf(lastTab) ? 'from-r' : 'from-l';
    lastTab = tab;
    const kids = [...page.children].filter((el) => el.nodeType === 1);
    kids.forEach((el, i) => {
      el.classList.remove('mo-in', 'from-r', 'from-l'); void el.offsetWidth;
      el.style.setProperty('--i', String(Math.min(i, 10)));
      el.classList.add('mo-in'); if (dir) el.classList.add(dir);
      el.addEventListener('animationend', () => el.classList.remove('mo-in', 'from-r', 'from-l'), { once: true });
    });
    page.querySelectorAll('.stat .v, .kpi b, .nb-hero h1 + .nb-sub b').forEach(countUp);
    page.querySelectorAll('.nowcard .prog i, .bar i, .plan-prog .prog i').forEach((b) => { b.classList.add('mo-fill'); b.addEventListener('animationend', () => b.classList.remove('mo-fill'), { once: true }); });
  }

  function boot() {
    const view = document.getElementById('view'); if (!view) return;
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('page')) {
        animatePage(n);
        // la bibliothèque des Cahiers se remplit après coup : on anime aussi son contenu
        if (n.classList.contains('nb-lib')) { const once = new MutationObserver(() => { once.disconnect(); animatePage(n); }); once.observe(n, { childList: true }); }
      }
      requestAnimationFrame(placeAll);
    }).observe(view, { childList: true });
    const navObs = new MutationObserver(() => requestAnimationFrame(placeAll));
    ['railTabs', 'bottomTabs'].forEach((id) => { const el = document.getElementById(id); if (el) navObs.observe(el, { attributes: true, subtree: true, attributeFilter: ['aria-current'], childList: true }); });
    addEventListener('resize', () => requestAnimationFrame(placeAll));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeAll);
    const app = document.getElementById('app');
    if (app) new MutationObserver(() => { if (!app.hidden) setTimeout(placeAll, 30); }).observe(app, { attributes: true, attributeFilter: ['hidden'] });
    // lecteur PDF et minuteur : ouverture animée
    const opener = (el) => el && new MutationObserver(() => { if (!el.hidden && !reduce()) { el.classList.remove('mo-open'); void el.offsetWidth; el.classList.add('mo-open'); } }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
    opener(document.getElementById('reader')); opener(document.getElementById('pomo'));
    placeAll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
