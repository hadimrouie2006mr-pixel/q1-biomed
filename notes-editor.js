/* Cahiers : éditeur plein écran (pages, rendu, gestes, outils, lasso, annuler/refaire, barre d'outils). */
(() => {
'use strict';
const N = window.Q1Notes = window.Q1Notes || {};
const S = () => N.store, R = () => N.R, U = () => N.ui;
const live = (o) => o && !o.gone;
const X = N.ed = {}; // fonctions partagées avec notes-panels.js
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();

/* ---------- Préférences de l'appareil (outils) ---------- */
const PENC = ['#1c1f23', '#2f62d0', '#d2443b', '#23905f', '#8a5cc2', '#e07a2e'];
const HLC = ['#ffd84d', '#8ee08a', '#8cc8ff', '#ff9ad5', '#ffb86b', '#c6a4ff'];
const TAPEC = ['#7fa6f0', '#f0915f', '#5fcf9d', '#e3c05c', '#c49af2', '#9aa5b1'];
X.PENC = PENC; X.HLC = HLC; X.TAPEC = TAPEC;
const DEF = {
  tool: 'pen',
  pen: { pen: 'fountain', color: PENC[0], sizes: [1.2, 2.2, 3.8], si: 1 },
  hl: { color: HLC[0], sizes: [8, 14, 22], si: 1, straight: false },
  eraser: { mode: 'stroke', sizes: [5, 12, 26], si: 1 },
  shape: { color: PENC[1], sizes: [1.2, 2.2, 3.8], si: 1, kind: 'auto', fill: false },
  text: { color: PENC[0], font: 'sans', fs: 16, bold: false, italic: false },
  tape: { color: TAPEC[0], sizes: [10, 18, 28], si: 1 },
  laser: { color: '#ff3b30' },
  favColors: [], presets: [], fingerDraw: false, dir: 'v'
};
const TP = (() => { const p = (N.uiPrefs && N.uiPrefs().tools) || {}; const o = JSON.parse(JSON.stringify(DEF)); for (const k of Object.keys(p)) o[k] = typeof DEF[k] === 'object' && !Array.isArray(DEF[k]) ? Object.assign(o[k], p[k]) : p[k]; return o; })();
const saveTP = () => N.uiPrefsSave && N.uiPrefsSave({ tools: TP });
X.TP = TP; X.saveTP = saveTP;
const toolCfg = (t = TP.tool) => TP[t] || {};
const curSize = (t = TP.tool) => { const c = toolCfg(t); return c.sizes ? c.sizes[c.si] : 2; };
const curColor = (t = TP.tool) => toolCfg(t).color || '#000';

/* ---------- État ---------- */
let E = null, root = null;
const openTabs = [];
X.state = () => E;
const DPR = () => Math.min(window.devicePixelRatio || 1, 3);
const MAXPX = 5.2e6, PAD = 16, GAP = 16;

function pagesSorted() { return Object.values(E.nd.pages || {}).filter(live).sort((a, b) => (a.ord - b.ord) || (a.id < b.id ? -1 : 1)); }
const itemsOf = (pid) => { const d = E.docs.get(pid); return d ? Object.values(d.items || {}).filter(live) : []; };
X.itemsOf = itemsOf;
const pgOf = (pid) => E.nd.pages[pid];
X.pgOf = pgOf;
const pvOf = (pid) => E.pvs.get(pid);

/* ---------- Ouverture / fermeture ---------- */
async function open(id, { page } = {}) {
  await N.ready;
  const idx = N.index(); const nb = idx && idx.nbs[id];
  if (!nb || nb.gone) { U().toast('Cahier introuvable'); return; }
  if (E && E.id === id) return;
  if (E) await close({ keepHash: true, switching: true });
  if (!openTabs.includes(id)) { openTabs.push(id); if (openTabs.length > 6) openTabs.shift(); }
  const nd = await S().ensure(N.paths.nbPath(id), { pages: {}, audio: {} });
  nd.pages = nd.pages || {}; nd.audio = nd.audio || {};
  E = { id, nb, nd, docs: new Map(), pvs: new Map(), zoom: 1, fit: 1, scale: 1, dir: (N.uiPrefs().dirs || {})[id] || TP.dir || 'v', undo: [], redo: [], sel: null, hide: new Set(), cur: null, penSeen: false, lastPen: -1e9, lastUpd: 0, readonly: !!nb.readonly, hl: null };
  buildRoot();
  document.body.classList.add('ne-open');
  root.hidden = false;
  try { const want = '#cahier-' + id; if (location.hash !== want) { if (location.hash.startsWith('#cahier-') || location.hash.startsWith('#pdf-')) history.replaceState(null, '', want); else history.pushState(null, '', want); } } catch (_) {}
  await loadPages();
  layout();
  const last = page || (N.uiPrefs().lastPage || {})[id];
  if (last && pvOf(last)) goPage(last, false); else E.sc.scrollTop = 0;
  updateVisible();
  S().setActive(true);
  if (!E.pages.length) { E.pagesEl.replaceChildren(U().h('p', { class: 'ne-msg' }, 'Ce cahier se télécharge depuis tes autres appareils…')); S().syncNow(); }
  X.renderTop(); X.renderTools();
  X.onOpen && X.onOpen();
}
async function loadPages() {
  E.pages = pagesSorted();
  await Promise.all(E.pages.map(async (pg) => { if (!E.docs.has(pg.id)) E.docs.set(pg.id, await S().ensure(N.paths.pgPath(E.id, pg.id), { items: {} })); }));
  const keep = new Set(E.pages.map((p) => p.id));
  for (const [pid, pv] of E.pvs) if (!keep.has(pid)) { pv.el.remove(); E.pvs.delete(pid); }
  E.pages.forEach((pg) => {
    let pv = E.pvs.get(pg.id);
    if (!pv) {
      const el = document.createElement('div'); el.className = 'ne-pg'; el.dataset.id = pg.id;
      const bg = document.createElement('canvas'); bg.className = 'ne-bg';
      const ink = document.createElement('canvas'); ink.className = 'ne-ink';
      el.append(bg, ink); E.pagesEl.append(el);
      pv = { id: pg.id, el, bg, ink, r: null, dirty: true, sorted: null };
      E.pvs.set(pg.id, pv);
    }
    pv.pg = pg;
  });
}
async function close({ keepHash = false, switching = false } = {}) {
  if (!E) return;
  X.commitText && X.commitText();
  X.stopAudio && X.stopAudio();
  X.exitPresent && X.exitPresent(true);
  X.clearSel && X.clearSel(true);
  root.querySelectorAll('.ne-selbar, .ne-sel, .ne-crop, .ne-audiobar, .ne-hl, .ne-tawrap, .ne-zw, .ne-zwbox').forEach((x) => x.remove()); root.classList.remove('zw-open');
  const lastPage = E.cur; const id = E.id;
  if (lastPage) N.uiPrefsSave({ lastPage: Object.assign({}, N.uiPrefs().lastPage || {}, { [id]: lastPage }) });
  touchNb(true);
  await S().flush();
  for (const pv of E.pvs.values()) { pv.bg.width = pv.bg.height = 0; pv.ink.width = pv.ink.height = 0; }
  E = null;
  if (!switching) {
    root.hidden = true; document.body.classList.remove('ne-open'); S().setActive(false);
    if (!keepHash && location.hash.startsWith('#cahier-')) { try { history.back(); } catch (_) {} }
    N.renderLib && N.renderLib();
    S().syncNow();
  }
}
X.close = close;
function touchNb(force) {
  if (!E) return; const t = Date.now();
  if (!force && t - E.lastUpd < 60000) return;
  if (force && !E.changed) return;
  E.lastUpd = t; E.changed = false;
  const nb = N.index().nbs[E.id]; if (!nb || nb.gone) return;
  N.setIdx('nbs', Object.assign({}, nb, { upd: t, np: E.pages.length }));
}

/* ---------- Construction de l'interface ---------- */
function buildRoot() {
  if (root) { E.sc = root.querySelector('.ne-scroll'); E.pagesEl = root.querySelector('.ne-pages'); E.pagesEl.replaceChildren(); E.body = root.querySelector('.ne-body'); return; }
  const { h } = U();
  root = h('div', { class: 'ne', id: 'ne', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cahier', hidden: true },
    h('div', { class: 'ne-top' }), h('div', { class: 'ne-tools', role: 'toolbar', 'aria-label': 'Outils' }),
    h('div', { class: 'ne-body' }, h('aside', { class: 'ne-side', hidden: true, 'aria-label': 'Pages' }), h('div', { class: 'ne-scroll' }, h('div', { class: 'ne-pages' })),
      h('div', { class: 'ne-pageind num', 'aria-live': 'polite' }), h('canvas', { class: 'ne-laser', 'aria-hidden': 'true' })));
  document.body.append(root);
  E.sc = root.querySelector('.ne-scroll'); E.pagesEl = root.querySelector('.ne-pages'); E.body = root.querySelector('.ne-body');
  const sc = E.sc;
  sc.addEventListener('scroll', () => requestVisible(), { passive: true });
  sc.addEventListener('pointerdown', onDown);
  sc.addEventListener('pointermove', onMove);
  if ('onpointerrawupdate' in window) sc.addEventListener('pointerrawupdate', onRaw);
  sc.addEventListener('pointerup', onUp);
  sc.addEventListener('pointercancel', onCancel);
  sc.addEventListener('lostpointercapture', (e) => { if (G && G.pid === e.pointerId && G.kind !== 'done') onUp(e); });
  sc.addEventListener('wheel', onWheel, { passive: false });
  sc.addEventListener('contextmenu', (e) => e.preventDefault());
  // empêcher le défilement/zoom natif d'iOS pendant l'écriture
  sc.addEventListener('touchstart', (e) => { if (e.touches.length > 1 || G) e.preventDefault(); }, { passive: false });
  sc.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  sc.addEventListener('gesturestart', (e) => e.preventDefault());
  window.addEventListener('resize', () => { if (E) { const a = anchorNow(); layout(); restoreAnchor(a); } });
  document.addEventListener('keydown', onKey);
  document.addEventListener('paste', onPaste);
  window.addEventListener('hashchange', () => { if (E && !location.hash.startsWith('#cahier-')) close({ keepHash: true }); });
  R().onImage(() => { if (!E) return; for (const pv of E.pvs.values()) { if (itemsOf(pv.id).some((it) => it.type === 'im') || (pv.pg.bg && pv.pg.bg.kind === 'img')) { pv.dirty = true; pv.bgKey = null; } } requestVisible(); });
}

/* ---------- Mise en page ---------- */
function layout() {
  if (!E) return;
  const sc = E.sc, W = sc.clientWidth || innerWidth, H = sc.clientHeight || innerHeight;
  if (!E.pages.length) return;
  const maxW = Math.max(...E.pages.map((p) => p.w)), maxH = Math.max(...E.pages.map((p) => p.h));
  if (E.present) E.fit = Math.min((W - 24) / maxW, (H - 24) / maxH);
  else if (E.dir === 'h') E.fit = Math.min((H - PAD * 2) / maxH, (W - PAD * 2) / maxW); // une page entière à l'écran, page par page
  else E.fit = Math.min(W - PAD * 2, 980) / maxW;
  E.fit = Math.max(.05, E.fit);
  layoutSizes();
}
function layoutSizes() {
  const sc = E.sc, W = sc.clientWidth, H = sc.clientHeight, s = E.scale = E.fit * E.zoom;
  const gap = E.present ? 24 : GAP;
  if (E.dir === 'h' || E.present) {
    const maxH = Math.max(...E.pages.map((p) => p.h)) * s, ch = Math.max(H, maxH + PAD * 2);
    // pages côte à côte, chacune centrée sur un écran (on tourne les pages)
    let x = Math.max(PAD, (W - E.pages[0].w * s) / 2);
    for (const pg of E.pages) { const pv = pvOf(pg.id), w = pg.w * s, hh = pg.h * s; Object.assign(pv, { ox: x, oy: (ch - hh) / 2, cw: w, ch: hh }); x += w + Math.max(gap, W - w); }
    E.cw = Math.max(W, x - gap + PAD + Math.max(0, (W - E.pages[E.pages.length - 1].w * s) / 2 - PAD)); E.ch = ch;
  } else {
    const maxW = Math.max(...E.pages.map((p) => p.w)) * s, cw = Math.max(W, maxW + PAD * 2);
    let y = PAD;
    for (const pg of E.pages) { const pv = pvOf(pg.id), w = pg.w * s, hh = pg.h * s; Object.assign(pv, { ox: (cw - w) / 2, oy: y, cw: w, ch: hh }); y += hh + gap; }
    E.cw = cw; E.ch = y - gap + PAD + Math.max(0, H * .35);
  }
  E.pagesEl.style.width = E.cw + 'px'; E.pagesEl.style.height = E.ch + 'px';
  for (const pv of E.pvs.values()) { const st = pv.el.style; st.left = pv.ox + 'px'; st.top = pv.oy + 'px'; st.width = pv.cw + 'px'; st.height = pv.ch + 'px'; }
  X.positionOverlays && X.positionOverlays();
}
function anchorNow() { if (!E || !E.cur) return null; const pv = pvOf(E.cur); if (!pv) return null; return { pid: E.cur, fy: (E.sc.scrollTop - pv.oy) / pv.ch, fx: (E.sc.scrollLeft - pv.ox) / pv.cw }; }
function restoreAnchor(a) { if (!a) return; const pv = pvOf(a.pid); if (!pv) return; if (E.dir === 'h' || E.present) E.sc.scrollLeft = pv.ox + a.fx * pv.cw; else E.sc.scrollTop = pv.oy + a.fy * pv.ch; updateVisible(); }
X.layout = () => { if (!E) return; const a = anchorNow(); layout(); restoreAnchor(a); };
X.relayoutPages = async () => { if (!E) return; const a = anchorNow(); await loadPages(); layout(); restoreAnchor(a); for (const pv of E.pvs.values()) { pv.dirty = true; } updateVisible(); X.renderSide && X.renderSide(); };

function zoomAt(z, cx, cy, live = true) {
  if (!E || E.present) return;
  z = clamp(z, .5, 6); if (Math.abs(z - E.zoom) < 1e-4) return;
  const sc = E.sc, px = sc.scrollLeft + cx, py = sc.scrollTop + cy;
  const pv = pvAtContent(px, py) || pvOf(E.cur) || pvOf(E.pages[0].id);
  const u = (px - pv.ox) / E.scale, v = (py - pv.oy) / E.scale;
  E.zoom = z; layoutSizes();
  sc.scrollLeft = pv.ox + u * E.scale - cx; sc.scrollTop = pv.oy + v * E.scale - cy;
  if (live) { clearTimeout(E.zt); E.zt = setTimeout(() => requestVisible(), 160); } else requestVisible();
  X.zwRedraw && X.zwRedraw();
}
X.zoomAt = zoomAt;
function pvAtContent(x, y) { for (const pv of E.pvs.values()) if (x >= pv.ox && x <= pv.ox + pv.cw && y >= pv.oy && y <= pv.oy + pv.ch) return pv; return null; }
function pvAtClient(cx, cy) { const r = E.sc.getBoundingClientRect(); return pvAtContent(cx - r.left + E.sc.scrollLeft, cy - r.top + E.sc.scrollTop); }
X.pvAtClient = pvAtClient;
function toPage(pv, cx, cy) { const r = E.sc.getBoundingClientRect(); return { x: (cx - r.left + E.sc.scrollLeft - pv.ox) / E.scale, y: (cy - r.top + E.sc.scrollTop - pv.oy) / E.scale }; }
X.toPage = toPage;

function goPage(pid, smooth = true) {
  const pv = pvOf(pid); if (!pv) return;
  if (E.dir === 'h' || E.present) E.sc.scrollTo({ left: pv.ox - Math.max(PAD, (E.sc.clientWidth - pv.cw) / 2), behavior: smooth ? 'smooth' : 'auto' });
  else E.sc.scrollTo({ top: pv.oy - PAD / 2, behavior: smooth ? 'smooth' : 'auto' });
  E.cur = pid; requestVisible();
}
X.goPage = goPage;

/* ---------- Rendu ---------- */
let visRaf = 0;
function requestVisible() { if (!visRaf) visRaf = requestAnimationFrame(() => { visRaf = 0; updateVisible(); }); }
X.requestVisible = requestVisible;
function updateVisible() {
  if (!E || !E.pages.length) return;
  const sc = E.sc, sl = sc.scrollLeft, st = sc.scrollTop, vw = sc.clientWidth, vh = sc.clientHeight;
  let best = null, bestA = -1;
  for (const pg of E.pages) {
    const pv = pvOf(pg.id); if (!pv) continue;
    const x0 = pv.ox - sl, y0 = pv.oy - st;
    const ix = Math.max(0, Math.min(vw, x0 + pv.cw) - Math.max(0, x0)), iy = Math.max(0, Math.min(vh, y0 + pv.ch) - Math.max(0, y0));
    const a = ix * iy; if (a > bestA) { bestA = a; best = pg.id; }
    const mx = vw * .6, my = vh * .6;
    const near = x0 < vw + mx && x0 + pv.cw > -mx && y0 < vh + my && y0 + pv.ch > -my;
    const far = !(x0 < vw + vw * 2.5 && x0 + pv.cw > -vw * 2.5 && y0 < vh + vh * 2.5 && y0 + pv.ch > -vh * 2.5);
    if (near) ensureRendered(pv, { x: -x0 / E.scale, y: -y0 / E.scale, w: vw / E.scale, h: vh / E.scale });
    else if (far && pv.r) release(pv);
  }
  if (best && best !== E.cur) { E.cur = best; X.onPageChange && X.onPageChange(); }
  const ind = root.querySelector('.ne-pageind'); const i = E.pages.findIndex((p) => p.id === E.cur);
  ind.textContent = `${i + 1} / ${E.pages.length}`;
}
function release(pv) { pv.bg.width = pv.bg.height = 0; pv.ink.width = pv.ink.height = 0; pv.r = null; pv.bgKey = null; }
function ensureRendered(pv, view) {
  const pg = pv.pg, s = E.scale, dpr = DPR();
  let rect;
  if (pg.w * pg.h * s * s * dpr * dpr <= MAXPX) rect = { x: 0, y: 0, w: pg.w, h: pg.h, full: true };
  else {
    const mx = view.w * .1, my = view.h * .1;
    const x0 = clamp(view.x - mx, 0, pg.w), y0 = clamp(view.y - my, 0, pg.h), x1 = clamp(view.x + view.w + mx, 0, pg.w), y1 = clamp(view.y + view.h + my, 0, pg.h);
    if (pv.r && pv.r.s === s && !pv.r.rect.full) { const r = pv.r.rect; const vx0 = clamp(view.x, 0, pg.w), vy0 = clamp(view.y, 0, pg.h), vx1 = clamp(view.x + view.w, 0, pg.w), vy1 = clamp(view.y + view.h, 0, pg.h); if (vx0 >= r.x - .5 && vy0 >= r.y - .5 && vx1 <= r.x + r.w + .5 && vy1 <= r.y + r.h + .5) { if (pv.dirty) renderInk(pv); return; } }
    rect = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0), full: false };
  }
  const same = pv.r && pv.r.s === s && pv.r.dpr === dpr && (rect.full ? pv.r.rect.full : false);
  if (same) { if (pv.dirty) renderInk(pv); if (pv.bgKey !== bgKeyOf(pv)) renderBg(pv); return; }
  pv.r = { s, dpr, rect };
  place(pv.ink, rect, pg, s, dpr); renderInk(pv);
  renderBg(pv);
}
function place(c, rect, pg, s, dpr) {
  c.width = Math.max(1, Math.round(rect.w * s * dpr)); c.height = Math.max(1, Math.round(rect.h * s * dpr));
  const st = c.style; st.left = (rect.x / pg.w * 100) + '%'; st.top = (rect.y / pg.h * 100) + '%'; st.width = (rect.w / pg.w * 100) + '%'; st.height = (rect.h / pg.h * 100) + '%';
}
const ctxFor = (c, rect) => { const x = c.getContext('2d'); const kx = c.width / rect.w, ky = c.height / rect.h; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); x.setTransform(kx, 0, 0, ky, -rect.x * kx, -rect.y * ky); return x; };
X.ctxFor = ctxFor;
function visibleItems(pv) {
  if (!pv.sorted || pv.dirty) pv.sorted = R().sortItems(itemsOf(pv.id));
  let list = pv.sorted;
  if (E.hide.size) list = list.filter((it) => !E.hide.has(it.id));
  if (E.playFilter) list = list.filter(E.playFilter);
  if (E.override) list = list.map((it) => E.override[it.id] || it);
  return list;
}
X.visibleItems = visibleItems;
function renderInk(pv) {
  if (!pv.r) return;
  pv.dirty = false; pv.sorted = R().sortItems(itemsOf(pv.id));
  const ctx = ctxFor(pv.ink, pv.r.rect);
  R().drawItems(ctx, visibleItems(pv), pv.pg, { view: pv.r.rect });
}
X.renderInk = renderInk;
function markDirty(pid) { const pv = pvOf(pid); if (pv) { pv.dirty = true; pv.sorted = null; } }
X.markDirty = markDirty;
function rerender(pid) { const pv = pvOf(pid); if (!pv) return; pv.dirty = true; if (pv.r) renderInk(pv); }
X.rerender = rerender;
const bgKeyOf = (pv) => { const pg = pv.pg, r = pv.r; return r ? [pg.tpl, pg.color, pg.w, pg.h, JSON.stringify(pg.bg || null), r.s, r.dpr, r.rect.x, r.rect.y, r.rect.w, r.rect.h].join('|') : ''; };
function renderBg(pv) {
  const key = bgKeyOf(pv); if (pv.bgKey === key) return; pv.bgKey = key;
  const pg = pv.pg, rect = pv.r.rect, s = pv.r.s, dpr = pv.r.dpr;
  if (!pg.bg) { place(pv.bg, rect, pg, s, dpr); R().drawTemplate(ctxFor(pv.bg, rect), pg); return; }
  // fond PDF ou image : rendu hors écran puis échange (pas de flash blanc)
  const tok = (pv.bgTok = (pv.bgTok || 0) + 1);
  const c = document.createElement('canvas'); c.className = 'ne-bg'; place(c, rect, pg, s, dpr);
  const ctx = ctxFor(c, rect); R().drawTemplate(ctx, pg);
  if (!pv.bg.width) { pv.bg.replaceWith(c); pv.bg = c; }
  const k = c.width / rect.w;
  R().drawBg(ctx, pg, k, rect, c).then(() => {
    if (!E || pv.bgTok !== tok) return;
    if (pv.bg !== c) { pv.bg.replaceWith(c); pv.bg.width = 0; pv.bg = c; }
  }).catch((e) => { if (pv.bgTok === tok) { pv.bgKey = null; if (pv.bg !== c) { pv.bg.replaceWith(c); pv.bg = c; } const x = c.getContext('2d'); x.setTransform(k, 0, 0, k, -rect.x * k, -rect.y * k); x.fillStyle = '#6b737c'; x.font = '12px system-ui'; x.fillText('Fond en cours de synchronisation…', 24, 40); } });
}

/* ---------- Modifications + annuler/refaire ---------- */
// change = { pid, coll: 'items' | 'pages', id, before, after }
function applyRaw(changes) {
  let pagesChanged = false; const touched = new Set();
  for (const c of changes) {
    if (c.coll === 'pages') { S().setObj(N.paths.nbPath(E.id), 'pages', c.after ? Object.assign({}, c.after) : S().tomb(c.id)); pagesChanged = true; }
    else { const path = N.paths.pgPath(E.id, c.pid); if (!E.docs.has(c.pid)) continue; S().setObj(path, 'items', c.after ? Object.assign({}, c.after) : S().tomb(c.id)); touched.add(c.pid); }
  }
  E.changed = true; touchNb();
  touched.forEach((pid) => rerender(pid));
  if (pagesChanged) X.relayoutPages();
  X.updateUndo && X.updateUndo();
  X.zwRedraw && X.zwRedraw();
  X.onEdit && X.onEdit([...touched]);
}
function commit(changes) {
  if (!changes.length) return;
  applyRaw(changes); E.undo.push(changes); if (E.undo.length > 200) E.undo.shift(); E.redo = [];
  X.updateUndo && X.updateUndo();
}
X.commit = commit;
function undo() { if (!E || !E.undo.length) return; X.clearSel(); const ch = E.undo.pop(); applyRaw(ch.map((c) => ({ pid: c.pid, coll: c.coll, id: c.id, after: c.before }))); E.redo.push(ch); X.updateUndo(); flashMsg('Annulé'); }
function redo() { if (!E || !E.redo.length) return; X.clearSel(); const ch = E.redo.pop(); applyRaw(ch.map((c) => ({ pid: c.pid, coll: c.coll, id: c.id, after: c.after }))); E.undo.push(ch); X.updateUndo(); flashMsg('Rétabli'); }
X.undo = undo; X.redo = redo;
function flashMsg(t) { const el = root.querySelector('.ne-pageind'); if (!el) return; el.dataset.msg = t; el.classList.add('msg'); clearTimeout(el._t); el._t = setTimeout(() => { el.classList.remove('msg'); }, 700); }
X.flashMsg = flashMsg;
const newItem = (o) => Object.assign({ id: S().uid('i'), z: Date.now(), c: Date.now() }, o);
X.newItem = newItem;

/* ---------- Gestes ---------- */
let G = null;          // geste de dessin en cours
const nav = { ptrs: new Map(), pinch: null, moved: false, t0: 0, max: 0, vx: 0, vy: 0, lastT: 0, inertia: 0 };
const canEdit = () => E && !E.readonly && !E.present;
X.canEdit = canEdit;
function onDown(e) {
  if (!E) return;
  if (e.target.closest && e.target.closest('.ne-ovl')) return; // interface posée sur la page (sélection, texte…)
  const t = now();
  if (e.pointerType === 'pen') { E.penSeen = true; E.lastPen = t; if (nav.ptrs.size) { nav.ptrs.clear(); nav.pinch = null; } }
  if (e.pointerType === 'touch') {
    if (G && G.ptype === 'pen') return;                 // paume pendant l'écriture
    if (t - E.lastPen < 500) return;                     // paume juste après le stylet
    if (G && G.ptype === 'touch') {                      // 2e doigt pendant un trait au doigt
      if (t - G.t0 < 260 && G.kind !== 'xform') { const first = G; abortGesture(); navDown({ pointerId: first.pid, clientX: first.cx, clientY: first.cy, pointerType: 'touch' }, true); navDown(e); }
      return;
    }
    const fingerTool = TP.fingerDraw && !E.penSeen && canEdit() || (TP.tool === 'laser' && TP.fingerDraw);
    if (!fingerTool || nav.ptrs.size) { navDown(e); return; }
  }
  if (e.pointerType === 'mouse' && e.button !== 0) { if (e.button === 1) navDown(e); return; }
  if (G) return;
  startGesture(e);
}
function navDown(e, synthetic) {
  stopInertia();
  if (!synthetic) try { E.sc.setPointerCapture(e.pointerId); } catch (_) {}
  if (!nav.ptrs.size) { nav.t0 = now(); nav.moved = false; nav.max = 0; nav.startZoom = E.zoom; nav.startCur = E.cur; }
  nav.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, type: e.pointerType });
  nav.max = Math.max(nav.max, nav.ptrs.size);
  if (nav.ptrs.size === 2) {
    const [a, b] = [...nav.ptrs.values()]; const r = E.sc.getBoundingClientRect();
    nav.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: E.zoom, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
  }
}
function onRaw(e) { if (G && e.pointerId === G.pid) { G.raw = true; moveGesture(e); } }
function onMove(e) {
  if (!E) return;
  if (G && e.pointerId === G.pid) { if (!G.raw) moveGesture(e); return; }
  const p = nav.ptrs.get(e.pointerId); if (!p) { hoverCursor(e); return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y, dt = Math.max(1, e.timeStamp - (nav.lastT || e.timeStamp - 16));
  p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(p.x - p.x0, p.y - p.y0) > 8) nav.moved = true;
  if (nav.ptrs.size === 1) {
    E.sc.scrollLeft -= dx; E.sc.scrollTop -= dy;
    nav.vx = .8 * (-dx / dt) + .2 * nav.vx; nav.vy = .8 * (-dy / dt) + .2 * nav.vy; nav.lastT = e.timeStamp;
  } else if (nav.ptrs.size >= 2 && nav.pinch) {
    const [a, b] = [...nav.ptrs.values()]; const r = E.sc.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
    E.sc.scrollLeft -= cx - nav.pinch.cx; E.sc.scrollTop -= cy - nav.pinch.cy;
    nav.pinch.cx = cx; nav.pinch.cy = cy;
    zoomAt(nav.pinch.z0 * d / nav.pinch.d0, cx, cy);
    nav.vx = nav.vy = 0;
  }
}
function navUp(e) {
  const p = nav.ptrs.get(e.pointerId); if (!p) return false;
  nav.ptrs.delete(e.pointerId);
  if (nav.ptrs.size === 1 && nav.pinch) { nav.pinch = null; const q = [...nav.ptrs.values()][0]; q.x0 = q.x; q.y0 = q.y; }
  if (!nav.ptrs.size) {
    const dur = now() - nav.t0, zoomed = Math.abs(E.zoom - nav.startZoom) > .02;
    if (!nav.moved && !zoomed && dur < 320) {
      if (nav.max === 2) undo(); else if (nav.max >= 3) redo();
      else if (nav.max === 1 && e.type === 'pointerup') { if (!tapAt(e.clientX, e.clientY, e.pointerType)) quickTap(e.clientX, e.clientY); }
    } else if (nav.max === 1 && nav.moved && !E.present && E.dir === 'h' && E.zoom <= 1.02) snapPage(nav.vx);
    else if (nav.max === 1 && nav.moved && e.type === 'pointerup') startInertia();
    if (E.present && nav.moved) X.presentSnap && X.presentSnap(nav.vx);
    nav.pinch = null; requestVisible();
  }
  return true;
}
function startInertia() {
  let vx = nav.vx, vy = nav.vy, last = now();
  if (Math.hypot(vx, vy) < .15 || E.present) return;
  const step = () => {
    const t = now(), dt = t - last; last = t;
    E.sc.scrollLeft += vx * dt; E.sc.scrollTop += vy * dt;
    const k = Math.pow(.94, dt / 16); vx *= k; vy *= k;
    if (Math.hypot(vx, vy) > .03) nav.inertia = requestAnimationFrame(step); else nav.inertia = 0;
  };
  nav.inertia = requestAnimationFrame(step);
}
// Mode page par page : après un glissé, on se cale sur la page (suivante si le geste est franc)
function snapPage(vx) {
  const sc = E.sc, mid = sc.scrollLeft + sc.clientWidth / 2;
  let i = 0, best = Infinity; E.pages.forEach((pg, k) => { const pv = pvOf(pg.id), d = Math.abs(pv.ox + pv.cw / 2 - mid); if (d < best) { best = d; i = k; } });
  const i0 = E.pages.findIndex((p) => p.id === nav.startCur);
  if (Math.abs(vx) > .25 && i0 >= 0) i = clamp(i0 + (vx > 0 ? 1 : -1), 0, E.pages.length - 1);
  goPage(E.pages[i].id);
}
X.snapPage = snapPage;
function stopInertia() { if (nav.inertia) cancelAnimationFrame(nav.inertia); nav.inertia = 0; }
function tapAt(cx, cy, ptype) {
  const pv = pvAtClient(cx, cy); if (!pv) return;
  const p = toPage(pv, cx, cy), r = 6 / E.scale;
  const items = itemsOf(pv.id);
  const ln = items.slice().reverse().find((it) => it.type === 'ln' && R().inBox(it, p.x, p.y, r));
  if (ln) { followLink(ln); return true; }
  const tp = items.slice().reverse().find((it) => it.type === 'tp' && R().hit(it, p.x, p.y, r));
  if (tp) { toggleTape(pv.id, tp); return true; }
  if (E.present) { X.presentTap && X.presentTap(cx); return true; }
  return false;
}
// Double-tap au doigt = raccourci façon Apple Pencil (gomme ↔ outil, ou outil précédent).
// Safari ne transmet pas le double-tap ni le « squeeze » du Pencil aux sites web : on le reproduit au doigt.
let lastTap = null;
function quickTap(cx, cy) {
  const t = now();
  if (lastTap && t - lastTap.t < 380 && Math.hypot(cx - lastTap.x, cy - lastTap.y) < 45) { lastTap = null; quickSwitch(); return; }
  lastTap = { t, x: cx, y: cy };
}
function quickSwitch(mode = TP.dblTap || 'eraser') {
  if (!E || mode === 'off' || !canEdit()) return;
  const NAMES = { pen: 'Stylo', hl: 'Surligneur', eraser: 'Gomme', lasso: 'Lasso', shape: 'Formes', text: 'Texte', tape: 'Ruban', laser: 'Laser' };
  let next;
  if (mode === 'prev') next = TP.lastTool && TP.lastTool !== TP.tool ? TP.lastTool : (TP.tool === 'pen' ? 'eraser' : 'pen');
  else next = TP.tool === 'eraser' ? (TP.backTool && TP.backTool !== 'eraser' ? TP.backTool : 'pen') : 'eraser';
  if (next === 'eraser' && TP.tool !== 'eraser') TP.backTool = TP.tool;
  setTool(next); flashMsg(NAMES[next] || next);
  try { navigator.vibrate && navigator.vibrate(10); } catch (_) {}
}
X.quickSwitch = quickSwitch;
function followLink(ln) {
  if (ln.page) { const pg = E.pages.find((p) => p.id === ln.page); if (pg) goPage(pg.id); else U().toast('Page introuvable'); }
  else if (ln.href) window.open(ln.href, '_blank', 'noopener');
}
X.followLink = followLink;
function toggleTape(pid, tp) {
  const after = Object.assign({}, tp, { open: !tp.open }); delete after.t; delete after.d;
  applyRaw([{ pid, coll: 'items', id: tp.id, before: tp, after }]);
}
X.toggleTape = toggleTape;
function hoverCursor(e) {
  if (e.pointerType !== 'mouse' || !E.sel || TP.tool !== 'lasso') return;
}
function onWheel(e) {
  if (!E) return;
  if (e.ctrlKey || e.metaKey) { e.preventDefault(); const r = E.sc.getBoundingClientRect(); zoomAt(E.zoom * Math.exp(-e.deltaY * .01), e.clientX - r.left, e.clientY - r.top, true); }
}

function startGesture(e) {
  // bout « gomme » d'un stylet (bouton 5) ou bouton latéral (bouton 2) : gomme le temps du geste
  const penEraser = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) || ((e.button === 2 || (e.buttons & 2)) && (TP.barrel || 'eraser') === 'eraser'));
  const tool = E.present ? 'laser' : (E.readonly && TP.tool !== 'laser') ? null : penEraser ? 'eraser' : TP.tool;
  if (!tool) { if (e.pointerType !== 'mouse') navDown(e); return; }
  if (tool === 'laser') { G = { kind: 'laser', pid: e.pointerId, ptype: e.pointerType, t0: now(), cx: e.clientX, cy: e.clientY }; X.laserPoint(e.clientX, e.clientY, true); capture(e); return; }
  const pv = pvAtClient(e.clientX, e.clientY);
  if (!pv) { if (e.pointerType === 'touch') navDown(e); else if (E.sel) X.clearSel(); return; }
  const p = toPage(pv, e.clientX, e.clientY);
  const base = { pid: e.pointerId, ptype: e.pointerType, t0: now(), pv, sx: p.x, sy: p.y, cx: e.clientX, cy: e.clientY, scRect: E.sc.getBoundingClientRect(), sl: E.sc.scrollLeft, st: E.sc.scrollTop };
  X.commitText && tool !== 'text' && X.commitText();
  if (tool === 'pen' || tool === 'hl' || tool === 'shape') {
    if (E.sel) X.clearSel();
    const cfg = toolCfg(tool);
    G = Object.assign(base, { kind: 'ink', tool, pts: [], pred: [], lastMoveT: now(), color: cfg.color, size: curSize(tool), pen: tool === 'pen' ? cfg.pen : 'ball', sim: e.pointerType !== 'pen', straight: tool === 'hl' && cfg.straight });
    addPoint(e);
  } else if (tool === 'eraser') {
    if (E.sel) X.clearSel();
    G = Object.assign(base, { kind: 'erase', changes: new Map(), last: p });
    eraseAt(p.x, p.y);
  } else if (tool === 'lasso') {
    if (E.sel && E.sel.pid === pv.id && X.selContains(p)) { G = Object.assign(base, { kind: 'xform', mode: 'move' }); X.xformStart(G); }
    else { X.clearSel(); G = Object.assign(base, { kind: 'lasso', poly: [p.x, p.y] }); }
  } else if (tool === 'text') {
    G = Object.assign(base, { kind: 'textTap' });
    const hitTx = itemsOf(pv.id).slice().reverse().find((it) => it.type === 'tx' && R().inBox(it, p.x, p.y, 4 / E.scale));
    G.target = hitTx || null;
  } else if (tool === 'tape') {
    if (E.sel) X.clearSel();
    G = Object.assign(base, { kind: 'tape', x2: p.x, y2: p.y });
  } else return;
  capture(e);
  ensureLive(pv);
  scheduleLive();
}
X.beginGesture = (e, props) => {
  if (G || !E) return;
  const pv = props.pv || (E.sel && E.pvs.get(E.sel.pid)); if (!pv) return;
  const p = toPage(pv, e.clientX, e.clientY);
  G = Object.assign({ pid: e.pointerId, ptype: e.pointerType, t0: now(), pv, sx: p.x, sy: p.y, cx: e.clientX, cy: e.clientY, scRect: E.sc.getBoundingClientRect(), sl: E.sc.scrollLeft, st: E.sc.scrollTop }, props);
  capture(e); ensureLive(pv); if (G.kind === 'xform') X.xformStart(G); scheduleLive();
};
function capture(e) { try { E.sc.setPointerCapture(e.pointerId); } catch (_) {} }
const pageXY = (ev) => ({ x: (ev.clientX - G.scRect.left + G.sl - G.pv.ox) / E.scale, y: (ev.clientY - G.scRect.top + G.st - G.pv.oy) / E.scale });
X.pageXY = (ev) => pageXY(ev);
function pressureOf(ev) {
  if (ev.pointerType !== 'pen') return .5;
  let p = ev.pressure || 0; if (p <= 0) p = .35;
  if (G.pen === 'brush') {
    let alt = ev.altitudeAngle;
    if (alt == null && (ev.tiltX || ev.tiltY)) { const tx = Math.tan(ev.tiltX * Math.PI / 180), ty = Math.tan(ev.tiltY * Math.PI / 180); alt = Math.atan(1 / Math.max(1e-3, Math.hypot(tx, ty))); }
    if (alt != null) p = Math.min(1, p * (1 + (1 - alt / (Math.PI / 2)) * 1.3));
  }
  return clamp(p, .05, 1);
}
function addPoint(ev) {
  const q = pageXY(ev), pts = G.pts, n = pts.length;
  if (n) { const dx = q.x - pts[n - 3], dy = q.y - pts[n - 2], d = Math.hypot(dx, dy); if (d < .25 / Math.max(.5, E.scale)) return; if (d * E.scale > 2.5) G.lastMoveT = now(); }
  pts.push(Math.round(q.x * 100) / 100, Math.round(q.y * 100) / 100, Math.round(pressureOf(ev) * 1000) / 1000);
}
function moveGesture(e) {
  const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || []; const list = evs.length ? evs : [e];
  if (G.kind === 'ink') {
    if (G.shape) { return; }
    for (const ev of list) addPoint(ev);
    G.pred = [];
    if (e.getPredictedEvents && G.ptype === 'pen' && !G.straight) { const pr = e.getPredictedEvents(); for (const ev of pr.slice(-1)) { const q = pageXY(ev); G.pred.push(q.x, q.y, pressureOf(ev)); } }
  } else if (G.kind === 'erase') {
    for (const ev of list) { const q = pageXY(ev); const d = Math.hypot(q.x - G.last.x, q.y - G.last.y), step = Math.max(1, curSize('eraser') / 2); const n = Math.ceil(d / step); for (let i = 1; i <= n; i++) eraseAt(G.last.x + (q.x - G.last.x) * i / n, G.last.y + (q.y - G.last.y) * i / n); G.last = q; }
    G.ex = G.last.x; G.ey = G.last.y;
  } else if (G.kind === 'lasso') {
    for (const ev of list) { const q = pageXY(ev); const n = G.poly.length; if (Math.hypot(q.x - G.poly[n - 2], q.y - G.poly[n - 1]) > 1.5 / E.scale) G.poly.push(q.x, q.y); }
  } else if (G.kind === 'xform') { X.xformMove(G, pageXY(e)); }
  else if (G.kind === 'tape') { const q = pageXY(e); G.x2 = q.x; G.y2 = q.y; }
  else if (G.kind === 'textTap') { const q = pageXY(e); if (Math.hypot(q.x - G.sx, q.y - G.sy) * E.scale > 6 && G.target) { G.kind = 'xform'; G.mode = 'move'; X.selectItems(G.pv.id, [G.target.id]); X.xformStart(G); } }
  else if (G.kind === 'laser') { X.laserPoint(e.clientX, e.clientY); return; }
  G.cx = e.clientX; G.cy = e.clientY;
  scheduleLive();
}
function onUp(e) {
  if (!E) return;
  if (nav.ptrs.has(e.pointerId)) { navUp(e); return; }
  if (!G || e.pointerId !== G.pid) return;
  const g = G; G = null; g.kindDone = g.kind;
  cancelAnimationFrame(liveRaf); liveRaf = 0;
  if (e.type === 'pointerup' && g.kind === 'ink' && !g.shape) { const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || []; G = g; evs.forEach(addPoint); G = null; }
  if (g.kind === 'ink') finishInk(g);
  else if (g.kind === 'erase') finishErase(g);
  else if (g.kind === 'lasso') { clearLive(); X.finishLasso(g); }
  else if (g.kind === 'xform') { X.xformEnd(g); clearLive(); }
  else if (g.kind === 'tape') finishTape(g);
  else if (g.kind === 'textTap') { clearLive(); X.openText(g.pv, g.target, g.sx, g.sy); }
  else if (g.kind === 'laser') { X.laserPoint(null); }
  X.updateUndo && X.updateUndo();
}
function onCancel(e) {
  if (nav.ptrs.has(e.pointerId)) { navUp(e); return; }
  if (G && e.pointerId === G.pid) {
    // iOS envoie parfois pointercancel en fin de trait : on garde le trait
    if (G.kind === 'ink' && G.pts.length > 6) onUp(e); else abortGesture();
  }
}
function abortGesture() { if (!G) return; const g = G; G = null; if (g.kind === 'xform') X.xformAbort(g); if (g.kind === 'erase' && g.changes.size) finishErase(g); clearLive(); }

/* ---------- Calque de dessin en direct ---------- */
let liveC = null, liveRaf = 0, livePv = null;
function ensureLive(pv) {
  if (!liveC) { liveC = document.createElement('canvas'); liveC.className = 'ne-live'; }
  if (!pv.r) ensureRendered(pv, { x: 0, y: 0, w: pv.pg.w, h: pv.pg.h });
  const r = pv.r.rect;
  if (liveC.parentNode !== pv.el || liveC.width !== pv.ink.width || liveC.height !== pv.ink.height || liveC._rk !== JSON.stringify(r)) {
    liveC._rk = JSON.stringify(r);
    liveC.width = pv.ink.width; liveC.height = pv.ink.height; liveC.style.cssText = pv.ink.style.cssText;
    pv.el.append(liveC);
  }
  livePv = pv;
  const x = liveC.getContext('2d', { desynchronized: true }) || liveC.getContext('2d');
  return x;
}
X.ensureLive = ensureLive;
function clearLive() { if (liveC && livePv && livePv.r) { const x = liveC.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, liveC.width, liveC.height); } }
X.clearLive = clearLive;
function scheduleLive() { if (!liveRaf) liveRaf = requestAnimationFrame(drawLive); }
X.scheduleLive = scheduleLive;
function drawLive() {
  liveRaf = 0; if (!G || !G.pv) return;
  const pv = G.pv; if (!pv.r) return;
  const ctx = ctxFor(liveC, pv.r.rect);
  if (G.kind === 'ink') {
    // maintien en fin de trait → forme propre (ou trait droit au surligneur)
    if (!G.shape && G.tool !== 'shape' && G.pts.length >= 12 && now() - G.lastMoveT > 560) {
      if (G.tool === 'hl') G.straight = true;
      else { const sh = R().recognize(G.pts); if (sh) { G.shape = sh; try { navigator.vibrate && navigator.vibrate(8); } catch (_) {} } }
      G.lastMoveT = now() + 1e9;
    }
    const it = liveItem(G);
    if (it.type === 'sh') R().drawItem(ctx, it, pv.pg);
    else { ctx.fillStyle = it.color; ctx.globalAlpha = it.tool === 'hl' ? .5 : 1; ctx.fill(R().livePath(it.pts.concat(G.straight ? [] : G.pred), it)); ctx.globalAlpha = 1; }
    liveRaf = requestAnimationFrame(drawLive);
  } else if (G.kind === 'erase') {
    const r = curSize('eraser') / 2; ctx.strokeStyle = 'rgba(100,110,120,.8)'; ctx.lineWidth = 1 / E.scale; ctx.beginPath(); ctx.arc(G.ex ?? G.sx, G.ey ?? G.sy, r, 0, 6.283); ctx.stroke();
  } else if (G.kind === 'lasso') {
    ctx.strokeStyle = '#2c5bb8'; ctx.lineWidth = 1.4 / E.scale; ctx.setLineDash([5 / E.scale, 4 / E.scale]);
    ctx.beginPath(); const p = G.poly; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = 'rgba(44,91,184,.06)'; ctx.fill(); ctx.setLineDash([]);
  } else if (G.kind === 'xform') { X.xformDraw(G, ctx); }
  else if (G.kind === 'tape') { R().drawItem(ctx, tapeItem(G), pv.pg); }
}
function liveItem(g) {
  if (g.shape) return Object.assign({ type: 'sh', color: g.color, size: Math.max(.8, g.size * (g.tool === 'pen' && g.pen === 'fountain' ? .8 : 1)), fill: g.tool === 'shape' && toolCfg('shape').fill }, g.shape, { arrow: g.shape.arrow || false });
  if (g.tool === 'shape') {
    const k = toolCfg('shape').kind;
    if (k !== 'auto' && g.pts.length >= 3) { const n = g.pts.length; const sh = R().shapeFrom(k, g.pts[0], g.pts[1], g.pts[n - 3], g.pts[n - 2]); return Object.assign({ type: 'sh', color: g.color, size: g.size, fill: toolCfg('shape').fill }, sh); }
  }
  let pts = g.pts;
  if (g.straight && pts.length >= 6) { const n = pts.length, x0 = pts[0], y0 = pts[1], x1 = pts[n - 3], y1 = pts[n - 2]; pts = []; for (let i = 0; i <= 8; i++) pts.push(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8, .5); }
  return { type: 's', tool: g.tool === 'hl' ? 'hl' : 'pen', pen: g.pen, color: g.color, size: g.size, pts, sim: g.sim || g.straight };
}
// Détecte un gribouillis (va-et-vient serrés) posé sur de l'encre existante ; renvoie les éléments à effacer.
function scribbleTargets(pts, pv) {
  const n = pts.length / 3; if (n < 12) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, L = 0;
  for (let i = 0; i < pts.length; i += 3) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); if (i) L += Math.hypot(pts[i] - pts[i - 3], pts[i + 1] - pts[i - 2]); }
  const w = x1 - x0, hh = y1 - y0, ext = Math.max(w, hh);
  if (ext < 6 || L < 2 * ext) return [];
  // demi-tours francs sur un axe (amplitude ≥ 35 % de l'étendue sur cet axe)
  const turns = (k, span) => { if (span < 4) return 0; let dir = 0, ext0 = pts[k], c = 0; for (let i = k + 3; i < pts.length; i += 3) { const v = pts[i]; if (dir >= 0) { if (v > ext0) { ext0 = v; dir = 1; } else if (ext0 - v > span * .35) { if (dir === 1) c++; dir = -1; ext0 = v; } } else { if (v < ext0) ext0 = v; else if (v - ext0 > span * .35) { c++; dir = 1; ext0 = v; } } } return c; };
  if (Math.max(turns(0, w), turns(1, hh)) < 4) return [];
  const box = { x: x0 - ext * .12, y: y0 - ext * .12, w: w + ext * .24, h: hh + ext * .24 };
  const out = [];
  for (const it of itemsOf(pv.id)) {
    if (!((it.type === 's' && it.tool !== 'hl') || it.type === 'sh')) continue;
    const b = R().bbox(it);
    const ix = Math.max(0, Math.min(b.x + b.w, box.x + box.w) - Math.max(b.x, box.x)), iy = Math.max(0, Math.min(b.y + b.h, box.y + box.h) - Math.max(b.y, box.y));
    if (ix * iy < .5 * Math.max(1, b.w * b.h)) continue; // l'élément doit être surtout sous le gribouillis
    let touched = false; const r = Math.max(2, it.size);
    for (let i = 0; i < pts.length && !touched; i += 6) if (R().hit(it, pts[i], pts[i + 1], r)) touched = true;
    if (touched) out.push(it.id);
  }
  return out;
}
function finishInk(g) {
  const pv = g.pv; const pts = g.pts;
  if (!pts.length) { clearLive(); return; }
  // toucher bref sur un ruban → le révéler / le cacher
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity; for (let i = 0; i < pts.length; i += 3) { minx = Math.min(minx, pts[i]); maxx = Math.max(maxx, pts[i]); miny = Math.min(miny, pts[i + 1]); maxy = Math.max(maxy, pts[i + 1]); }
  const tiny = (maxx - minx) * E.scale < 4 && (maxy - miny) * E.scale < 4 && now() - g.t0 < 300;
  if (tiny) {
    const tp = itemsOf(pv.id).slice().reverse().find((it) => it.type === 'tp' && R().hit(it, pts[0], pts[1], 4 / E.scale));
    if (tp) { clearLive(); toggleTape(pv.id, tp); return; }
    const ln = itemsOf(pv.id).slice().reverse().find((it) => it.type === 'ln' && R().inBox(it, pts[0], pts[1], 2));
    if (ln) { clearLive(); followLink(ln); return; }
  }
  // hachurer une écriture = l'effacer (comme Goodnotes)
  if (g.tool === 'pen' && !g.shape && TP.scribble !== false) {
    const ids = scribbleTargets(pts, pv);
    if (ids.length) {
      clearLive();
      commit(ids.map((id) => ({ pid: pv.id, coll: 'items', id, before: E.docs.get(pv.id).items[id], after: null })));
      flashMsg('Effacé'); try { navigator.vibrate && navigator.vibrate(12); } catch (_) {}
      return;
    }
  }
  let it = liveItem(g);
  if (g.tool === 'shape' && it.type === 's') { const sh = R().recognize(pts, true); if (sh) it = Object.assign({ type: 'sh', color: g.color, size: g.size, fill: toolCfg('shape').fill }, sh); }
  if (it.type === 'sh' && toolCfg('shape').kind === 'arrow' && g.tool === 'shape' && it.kind === 'line') it.arrow = true;
  const item = newItem(it);
  const doc = E.docs.get(pv.id);
  // dessin incrémental si rien ne doit passer au-dessus
  const simple = item.type === 's' && item.tool !== 'hl' && !Object.values(doc.items).some((o) => live(o) && (o.type === 'tx' || o.type === 'tp' || o.type === 'ln')) && !E.hide.size && !E.playFilter;
  commitQuiet([{ pid: pv.id, coll: 'items', id: item.id, before: null, after: item }], simple ? () => { const ctx = pv.ink.getContext('2d'); const r = pv.r.rect, kx = pv.ink.width / r.w, ky = pv.ink.height / r.h; ctx.setTransform(kx, 0, 0, ky, -r.x * kx, -r.y * ky); R().drawItem(ctx, doc.items[item.id], pv.pg); } : null);
  clearLive();
  X.zwAfterStroke && X.zwAfterStroke(item, pv.id);
}
// commit sans redessin complet quand on peut dessiner juste le nouveau trait
function commitQuiet(changes, fastDraw) {
  if (!fastDraw) { commit(changes); return; }
  const c = changes[0];
  S().setObj(N.paths.pgPath(E.id, c.pid), 'items', Object.assign({}, c.after));
  const pv = pvOf(c.pid); pv.sorted = null; fastDraw();
  E.changed = true; touchNb();
  E.undo.push(changes); if (E.undo.length > 200) E.undo.shift(); E.redo = [];
  X.updateUndo && X.updateUndo(); X.zwRedraw && X.zwRedraw(); X.onEdit && X.onEdit([c.pid]);
}
function finishTape(g) {
  clearLive();
  const len = Math.hypot(g.x2 - g.sx, g.y2 - g.sy);
  if (len * E.scale < 8) { const tp = itemsOf(g.pv.id).slice().reverse().find((it) => it.type === 'tp' && R().hit(it, g.sx, g.sy, 4 / E.scale)); if (tp) toggleTape(g.pv.id, tp); return; }
  const item = newItem(tapeItem(g)); commit([{ pid: g.pv.id, coll: 'items', id: item.id, before: null, after: item }]);
}
function tapeItem(g) { const r = (v) => Math.round(v * 100) / 100; return { type: 'tp', x1: r(g.sx), y1: r(g.sy), x2: r(g.x2), y2: r(g.y2), size: curSize('tape'), color: curColor('tape'), open: false }; }

/* ---------- Gomme ---------- */
function eraseAt(x, y) {
  const pv = G.pv, r = curSize('eraser') / 2, mode = toolCfg('eraser').mode;
  let changed = false;
  for (const it of itemsOf(pv.id)) {
    if (E.hide.has(it.id)) continue;
    if (mode === 'hl' && !(it.type === 's' && it.tool === 'hl')) continue;
    if (!(it.type === 's' || it.type === 'sh' || it.type === 'tp')) continue;
    if (!R().hit(it, x, y, r)) continue;
    const orig = G.changes.has(it.id) ? G.changes.get(it.id).before : it;
    if (mode === 'partial' && it.type === 's') {
      const parts = R().splitStroke(it, x, y, r); if (!parts) continue;
      if (!G.changes.has(it.id)) G.changes.set(it.id, { pid: pv.id, coll: 'items', id: it.id, before: orig, after: null });
      else G.changes.get(it.id).after = null;
      S().setObj(N.paths.pgPath(E.id, pv.id), 'items', S().tomb(it.id));
      for (const pts of parts) { const n = newItem(Object.assign({}, it, { pts, id: undefined, t: undefined, d: undefined })); n.id = S().uid('i'); n.z = it.z; n.c = it.c; delete n.t; delete n.d; S().setObj(N.paths.pgPath(E.id, pv.id), 'items', n); G.changes.set(n.id, { pid: pv.id, coll: 'items', id: n.id, before: null, after: n }); }
    } else {
      if (!G.changes.has(it.id)) G.changes.set(it.id, { pid: pv.id, coll: 'items', id: it.id, before: orig, after: null });
      else G.changes.get(it.id).after = null;
      S().setObj(N.paths.pgPath(E.id, pv.id), 'items', S().tomb(it.id));
    }
    changed = true;
  }
  if (changed) { pv.dirty = true; pv.sorted = null; if (!G.rr) G.rr = requestAnimationFrame(() => { if (G) G.rr = 0; renderInk(pv); }); }
}
function finishErase(g) {
  clearLive(); if (g.rr) cancelAnimationFrame(g.rr);
  // les morceaux créés puis effacés dans le même geste s'annulent
  const list = [...g.changes.values()].filter((c) => !(c.before === null && c.after === null)).map((c) => c.after ? Object.assign({}, c, { after: g.pv && E.docs.get(c.pid).items[c.id] }) : c);
  if (list.length) { E.undo.push(list); E.redo = []; E.changed = true; touchNb(); }
  renderInk(g.pv); X.updateUndo(); X.zwRedraw && X.zwRedraw(); X.onEdit && X.onEdit([g.pv.id]);
}

/* ---------- Clavier ---------- */
const KEYS = { p: 'pen', h: 'hl', e: 'eraser', l: 'lasso', s: 'shape', t: 'text', k: 'tape', x: 'laser' };
function onKey(e) {
  if (!E || root.hidden) return;
  if (document.querySelector('.nb-backdrop')) return;
  const tag = (e.target && e.target.tagName) || '';
  const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
  if (typing) { if (e.key === 'Escape') e.target.blur(); return; }
  if (E.present) { if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); X.presentStep(1); } else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); X.presentStep(-1); } else if (e.key === 'Escape') X.exitPresent(); return; }
  if (mod && e.key.toLowerCase() === 'c' && E.sel) { e.preventDefault(); X.selCopy(); return; }
  if (mod && e.key.toLowerCase() === 'x' && E.sel) { e.preventDefault(); X.selCopy(); X.selDelete(); return; }
  if (mod && e.key.toLowerCase() === 'd' && E.sel) { e.preventDefault(); X.selDuplicate(); return; }
  if (mod && e.key.toLowerCase() === 'v') { if (X.hasClip()) { e.preventDefault(); X.paste(); } return; }
  if (mod && e.key.toLowerCase() === 'a' && canEdit()) { e.preventDefault(); setTool('lasso'); X.selectItems(E.cur, itemsOf(E.cur).map((i) => i.id)); return; }
  if (mod || e.altKey) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && E.sel) { e.preventDefault(); X.selDelete(); return; }
  if (e.key === 'Escape') { if (E.sel) X.clearSel(); else if (X.closePanels && X.closePanels()) {} else close(); return; }
  const k = e.key.toLowerCase();
  if (KEYS[k] && (canEdit() || KEYS[k] === 'laser')) { setTool(KEYS[k]); return; }
  if (k === 'g' && canEdit()) { quickSwitch(); return; }
  if (k === 'i' && canEdit()) { X.insertImageMenu && X.insertImageMenu(); return; }
  if (['1', '2', '3'].includes(k) && toolCfg().sizes) { toolCfg().si = +k - 1; saveTP(); X.renderTools(); return; }
  if (k === '=' || k === '+') { zoomAt(E.zoom * 1.25, E.sc.clientWidth / 2, E.sc.clientHeight / 2, false); return; }
  if (k === '-') { zoomAt(E.zoom / 1.25, E.sc.clientWidth / 2, E.sc.clientHeight / 2, false); return; }
  if (k === '0') { zoomAt(1, E.sc.clientWidth / 2, E.sc.clientHeight / 2, false); return; }
  if (e.key === 'PageDown' || e.key === 'ArrowRight' && E.dir === 'h') { const i = E.pages.findIndex((p) => p.id === E.cur); if (E.pages[i + 1]) goPage(E.pages[i + 1].id); return; }
  if (e.key === 'PageUp' || e.key === 'ArrowLeft' && E.dir === 'h') { const i = E.pages.findIndex((p) => p.id === E.cur); if (E.pages[i - 1]) goPage(E.pages[i - 1].id); return; }
}
async function onPaste(e) {
  if (!E || root.hidden || !canEdit()) return;
  const tag = (e.target && e.target.tagName) || ''; if (/INPUT|TEXTAREA/.test(tag)) return;
  const f = [...(e.clipboardData && e.clipboardData.files || [])].find((x) => /^image\//.test(x.type));
  if (f) { e.preventDefault(); X.insertImageFile(f); }
}
function setTool(t) {
  if (!E) return;
  if (t !== 'lasso' && E.sel) X.clearSel();
  X.commitText && X.commitText();
  if (t !== TP.tool) TP.lastTool = TP.tool;
  TP.tool = t; saveTP(); X.renderTools();
}
X.setTool = setTool;
X.toolCfg = toolCfg; X.curSize = curSize; X.curColor = curColor;

/* ---------- Mises à jour venant d'un autre appareil ---------- */
async function onRemote(paths) {
  if (!E) return;
  const nbp = N.paths.nbPath(E.id);
  if (paths.includes(N.paths.IDX)) { const nb = N.index().nbs[E.id]; if (!nb || nb.gone || nb.trashed) { U().toast('Ce cahier a été supprimé sur un autre appareil'); close(); return; } E.nb = nb; E.readonly = !!nb.readonly; X.renderTop(); X.renderTools(); }
  if (paths.includes(nbp)) { E.nd = await S().get(nbp); await X.relayoutPages(); }
  for (const p of paths) {
    const m = p.match(/^notes\/([^/]+)\/([^/]+)\.enc$/);
    if (m && m[1] === E.id) { E.docs.set(m[2], await S().get(p)); if (E.sel && E.sel.pid === m[2]) X.clearSel(); markDirty(m[2]); }
  }
  for (const pv of E.pvs.values()) pv.bgKey = pv.r ? pv.bgKey : null;
  requestVisible(); X.renderSide && X.renderSide(); X.zwRedraw && X.zwRedraw();
}

N.editor = { open, close: () => close(), isOpen: () => !!E, onRemote, onStatus: () => X.renderStatus && X.renderStatus(), currentId: () => E && E.id, tabs: () => openTabs.slice(), closeTab: (id) => { const i = openTabs.indexOf(id); if (i >= 0) openTabs.splice(i, 1); } };
X.open = open; X.openTabs = openTabs; X.root = () => root;
})();
