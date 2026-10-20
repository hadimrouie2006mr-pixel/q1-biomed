/* Cahiers : bibliothèque, dialogues, réglages de synchronisation, cartes de révision, sauvegarde. */
(() => {
'use strict';
const N = window.Q1Notes = window.Q1Notes || {};
const S = () => N.store;
const IDX = 'notes/index.enc';
const nbPath = (id) => `notes/${id}.enc`;
const pgPath = (id, pid) => `notes/${id}/${pid}.enc`;
N.paths = { IDX, nbPath, pgPath };
const DAY = 864e5;
// append/replaceChildren ignorent null/false (sinon « null » s'affiche en texte)
['append', 'replaceChildren', 'prepend'].forEach((m) => {
  const orig = Element.prototype[m]; if (orig._q1) return;
  const f = function (...a) { return orig.apply(this, a.filter((x) => x != null && x !== false)); }; f._q1 = true; Element.prototype[m] = f;
});

/* ---------- DOM ---------- */
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(3)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const I = {
  pen: '<path d="M4 20l1.2-4.6L15.5 5.1a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="M13.5 7l3.5 3.5"/>',
  hl: '<path d="M9 15l-4 4h5l2-2"/><path d="M9 15l7.5-9.5a2 2 0 0 1 2.9-.2l.3.3a2 2 0 0 1-.2 2.9L10 16z"/><path d="M4 21h16" opacity=".5"/>',
  eraser: '<path d="M8 20h12"/><path d="M5.6 15.6l8.5-8.5a2 2 0 0 1 2.8 0l2 2a2 2 0 0 1 0 2.8L12.4 18.4a2 2 0 0 1-1.4.6H8.5a2 2 0 0 1-1.4-.6l-1.5-1.5a2 2 0 0 1 0-2.8z"/><path d="M9.5 11.5l5 5"/>',
  lasso: '<path d="M7 17c-3-1.5-4-4-3-6.5C5.5 6.5 10 4 14.5 4.5 19 5 21 8 20 11s-5 5-9 5c-1.4 0-2.7-.2-4-.6"/><path d="M7 17c.5 1.6-.3 3-2 3.5"/>',
  shape: '<circle cx="8" cy="8" r="4"/><rect x="12" y="12" width="8" height="8" rx="1"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20 16l-4.5-4.5L7 20"/>',
  tape: '<rect x="3" y="8" width="18" height="8" rx="1.5" transform="rotate(-12 12 12)"/><path d="M7 9.5l1 5M11 8.7l1 5M15 7.9l1 5" opacity=".6"/>',
  laser: '<circle cx="7" cy="17" r="2.2"/><path d="M9 15l10-10M14 5h5v5"/>',
  sticker: '<path d="M14 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8l7-7V6a3 3 0 0 0-3-3z" /><path d="M14 21v-4a3 3 0 0 1 3-3h4"/>',
  zoomwin: '<rect x="3" y="13" width="18" height="8" rx="2"/><rect x="7" y="4" width="6" height="5" rx="1"/><path d="M10 9v4"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  pages: '<rect x="4" y="3" width="7" height="9" rx="1.5"/><rect x="13" y="3" width="7" height="9" rx="1.5"/><rect x="4" y="14" width="7" height="7" rx="1.5"/><rect x="13" y="14" width="7" height="7" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  folder: '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  folderFill: '<path d="M2.5 7A2.5 2.5 0 0 1 5 4.5h4.2l2.1 2.3H19A2.5 2.5 0 0 1 21.5 9.3V17.5A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5z" fill="currentColor" stroke="none"/><path d="M2.5 9.6h19" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  chevdown: '<path d="M7 10l5 5 5-5"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  bookmark: '<path d="M7 3.5h10v17l-5-4-5 4z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6-1.2A4.6 4.6 0 0 0 7 18.5z"/>',
  sync: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M14 11v6M11 14h6M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  cut: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M7.8 16.2L18 4M16.2 16.2L6 4"/>',
  paste: '<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V3h6v1.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7.5" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  present: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/>',
  toc: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  finger: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 15.5a1.5 1.5 0 0 1 2.3-2L9 16V11"/>',
  vert: '<rect x="7" y="2.5" width="10" height="8" rx="1"/><rect x="7" y="13.5" width="10" height="8" rx="1"/>',
  horiz: '<rect x="2.5" y="7" width="8" height="10" rx="1"/><rect x="13.5" y="7" width="8" height="10" rx="1"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 15V4M7 9l5-5 5 5"/><path d="M5 20h14"/>',
  template: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  pdf: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  camera: '<path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  revealall: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><path d="M9.5 12l1.8 1.8L15 10"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  readonly: '<path d="M4 20l1.2-4.6L15.5 5.1a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="M3 3l18 18"/>',
  grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>'
};
const ico = (k, cls) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls);
  s.innerHTML = I[k] || ''; return s;
};
const ibtn = (k, label, onclick, extra = {}) => h('button', Object.assign({ class: 'nb-ib', type: 'button', 'aria-label': label, title: label, onclick }, extra), ico(k));

/* ---------- Dialogues ---------- */
let dlgStack = [];
function dialog({ title, body, actions = [], wide = false, full = false, onclose, cls = '' }) {
  const prevFocus = document.activeElement;
  const box = h('div', { class: 'nb-dlg ' + (wide ? 'wide ' : '') + (full ? 'full ' : '') + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const back = h('div', { class: 'nb-backdrop' }, box);
  const close = (v) => {
    if (!back.isConnected) return; back.remove(); dlgStack = dlgStack.filter((x) => x !== api);
    if (onclose) onclose(v); if (prevFocus && prevFocus.focus) try { prevFocus.focus({ preventScroll: true }); } catch (_) {}
  };
  const api = { close, box };
  box.append(h('div', { class: 'nb-dlg-head' }, h('h2', {}, title), ibtn('close', 'Fermer', () => close(null))),
    h('div', { class: 'nb-dlg-body' }, body),
    actions.length ? h('div', { class: 'nb-dlg-actions' }, actions.map((a) => h('button', { class: 'btn' + (a.primary ? ' solid' : '') + (a.danger ? ' danger' : ''), type: 'button', onclick: () => a.onclick ? a.onclick(api) : close(a.value) }, a.label))) : null);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(null); });
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } });
  document.body.append(back); dlgStack.push(api);
  setTimeout(() => { const f = box.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea') || box.querySelector('.nb-dlg-body button, .nb-dlg-actions .solid') ; if (f) try { f.focus({ preventScroll: true }); } catch (_) {} }, 30);
  return api;
}
function prompt(title, value = '', { label = 'Nom', placeholder = '', ok = 'Valider', type = 'text' } = {}) {
  return new Promise((res) => {
    const inp = h('input', { class: 'search', type, value, placeholder, 'aria-label': label, autocomplete: 'off' });
    const d = dialog({ title, body: h('label', { class: 'nb-field' }, h('span', {}, label), inp), onclose: (v) => res(v == null ? null : v),
      actions: [{ label: 'Annuler', value: null }, { label: ok, primary: true, onclick: (api) => api.close(inp.value.trim()) }] });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); d.close(inp.value.trim()); } });
    setTimeout(() => { inp.focus(); inp.select(); }, 40);
  });
}
function confirmDlg(title, text, ok = 'Confirmer', danger = false) {
  return new Promise((res) => dialog({ title, body: h('p', { class: 'muted' }, text), onclose: (v) => res(!!v), actions: [{ label: 'Annuler', value: false }, { label: ok, primary: !danger, danger, value: true }] }));
}
function menu(anchor, items, { align = 'left' } = {}) {
  closeMenus();
  const m = h('div', { class: 'nb-menu', role: 'menu' });
  items.filter(Boolean).forEach((it) => {
    if (it === '-') { m.append(h('div', { class: 'nb-menu-sep', role: 'separator' })); return; }
    m.append(h('button', { class: 'nb-menu-item' + (it.danger ? ' danger' : '') + (it.on ? ' on' : ''), type: 'button', role: 'menuitem', disabled: it.disabled || null,
      onclick: (e) => { e.stopPropagation(); closeMenus(); it.onclick && it.onclick(); } }, it.icon ? ico(it.icon) : h('span', { class: 'nb-menu-sp' }), h('span', {}, it.label), it.on ? ico('check', 'nb-menu-check') : null));
  });
  const back = h('div', { class: 'nb-menu-back', onpointerdown: (e) => { if (e.target === back) { e.preventDefault(); closeMenus(); } } }, m);
  document.body.append(back);
  const r = anchor.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let x = align === 'right' ? r.right - mw : r.left, y = r.bottom + 6;
  if (y + mh > vh - 8) y = Math.max(8, r.top - mh - 6);
  x = Math.max(8, Math.min(vw - mw - 8, x));
  m.style.left = x + 'px'; m.style.top = y + 'px';
  m.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenus(); anchor.focus(); } });
  const first = m.querySelector('button:not([disabled])'); if (first) first.focus({ preventScroll: true });
  return m;
}
function closeMenus() { document.querySelectorAll('.nb-menu-back').forEach((x) => x.remove()); }
function toast(msg, ms = 2600) {
  let t = document.querySelector('.nb-toast'); if (!t) { t = h('div', { class: 'nb-toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms);
}
function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
async function shareOrDownload(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare && navigator.share) {
    try { if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'share'; } } catch (e) { if (e && e.name === 'AbortError') return 'abort'; }
  }
  download(blob, name); return 'download';
}
N.ui = { h, ico, ibtn, dialog, prompt, confirm: confirmDlg, menu, closeMenus, toast, download, shareOrDownload, I };

/* ---------- Index (liste des cahiers) ---------- */
let idx = null;
async function loadIndex() { idx = await S().ensure(IDX, { nbs: {}, folders: {}, elements: {}, cards: {}, tpls: {} }); ['nbs', 'folders', 'elements', 'cards', 'tpls'].forEach((k) => { idx[k] = idx[k] || {}; }); return idx; }
N.index = () => idx;
N.setIdx = (coll, obj) => S().setObj(IDX, coll, obj);
const live = (o) => o && !o.gone;
const nbList = () => Object.values(idx.nbs).filter(live);
const folderList = () => Object.values(idx.folders).filter(live);
const COVERS = [['bio', 'Bio'], ['chimie', 'Chimie'], ['maths', 'Maths'], ['physique', 'Physique'], ['anat', 'Anatomie'], ['other', 'Gris'], ['ink', 'Encre']];
N.COVERS = COVERS;
const MATCOVER = { Bio: 'bio', Chimie: 'chimie', Maths: 'maths', Physique: 'physique', Anatomie: 'anat' };
const fmtDate = (t) => { if (!t) return ''; const d = new Date(t), n = new Date(); const same = d.toDateString() === n.toDateString(); return same ? 'Aujourd’hui ' + d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric' }); };

// Purge de la corbeille (> 30 jours)
function purgeTrash() {
  const lim = Date.now() - 30 * DAY;
  for (const nb of nbList()) if (nb.trashed && nb.trashed < lim) N.setIdx('nbs', S().tomb(nb.id));
  for (const f of folderList()) if (f.trashed && f.trashed < lim) N.setIdx('folders', S().tomb(f.id));
}

/* ---------- Création de cahiers ---------- */
const PAPER = { A4: [595.3, 841.9], Letter: [612, 792] };
N.PAPER = PAPER;
const TPLS = [['blank', 'Blanc'], ['lined', 'Ligné étroit'], ['lined-wide', 'Ligné large'], ['grid5', 'Carreaux 5 mm'], ['grid7', 'Carreaux 7 mm'], ['dots', 'Points'], ['cornell', 'Cornell'], ['todo', 'To-do'], ['week', 'Planning semaine'], ['music', 'Papier musique']];
const PCOLORS = [['white', 'Blanc'], ['cream', 'Crème'], ['dark', 'Sombre']];
N.TPLS = TPLS; N.PCOLORS = PCOLORS;
function pageSize(size, orient) { const [w, hh] = PAPER[size] || PAPER.A4; return orient === 'land' ? [hh, w] : [w, hh]; }
N.pageSize = pageSize;
async function createNotebook({ title, cover = 'bio', tpl = 'lined', color = 'white', size = 'A4', orient = 'port', folder = '', custom = null, pages = 1 }) {
  const id = S().uid('n');
  const [w, hh] = pageSize(size, orient);
  N.setIdx('nbs', { id, title: title || 'Sans titre', cover, kind: 'notebook', folder, fav: false, created: Date.now(), upd: Date.now(), trashed: 0, np: pages, def: { tpl, color, size, orient, custom } });
  await S().ensure(nbPath(id), { pages: {}, audio: {} });
  for (let i = 0; i < pages; i++) {
    const pid = S().uid('p');
    const pg = { id: pid, ord: i + 1, w, h: hh, tpl, color };
    if (custom) Object.assign(pg, customBg(custom));
    S().setObj(nbPath(id), 'pages', pg);
    await S().ensure(pgPath(id, pid), { items: {} });
  }
  return id;
}
function customBg(cid) { const t = idx.tpls[cid]; if (!t || t.gone) return {}; return { tpl: 'blank', bg: { kind: 'pdf', src: 'blob:' + t.blob, n: t.n || 1 }, w: t.w, h: t.h }; }
N.customBg = customBg;
N.createNotebook = createNotebook;

// PDF du site → document annotable (id déterministe : identique sur tous les appareils)
async function openSitePdf(p) {
  if (!idx) await loadIndex();
  const id = 'pdf-' + String(p.id).replace(/[^\w-]/g, '_');
  let nb = idx.nbs[id];
  if (!nb || nb.gone || nb.trashed) {
    N.setIdx('nbs', Object.assign({}, nb && !nb.gone ? nb : {}, { id, title: p.titre, cover: MATCOVER[p.matiere] || 'other', kind: 'pdf', site: p.id, folder: (nb && !nb.gone && nb.folder) || '', fav: !!(nb && nb.fav), created: (nb && nb.created) || Date.now(), upd: Date.now(), trashed: 0 }));
  }
  const nd = await S().ensure(nbPath(id), { pages: {}, audio: {} });
  const livePages = Object.values(nd.pages || {}).filter(live);
  if (!livePages.length) {
    try {
      const pdf = await N.pdfDoc('site:' + p.id);
      for (let n = 1; n <= pdf.numPages; n++) {
        const pg = await pdf.getPage(n); const vp = pg.getViewport({ scale: 1 });
        const pid = 'p' + n;
        if (!nd.pages[pid]) S().setObj(nbPath(id), 'pages', { id: pid, ord: n, w: vp.width, h: vp.height, tpl: 'blank', color: 'white', bg: { kind: 'pdf', src: 'site:' + p.id, n } });
        await S().ensure(pgPath(id, pid), { items: {} });
      }
      N.setIdx('nbs', Object.assign({}, idx.nbs[id], { np: pdf.numPages }));
    } catch (e) { toast('Impossible d’ouvrir ce PDF pour l’annoter.'); return; }
  }
  N.editor.open(id);
}
N.openSitePdf = openSitePdf;

/* ---------- PDF : chargement (site ou fichier importé) ---------- */
const pdfDocs = new Map();
N.pdfBytes = async (src) => {
  if (src.startsWith('site:')) {
    const id = src.slice(5); const p = (N.app.pdfs() || []).find((x) => String(x.id) === id);
    if (!p || !p.enc) throw new Error('PDF du site introuvable');
    return new Uint8Array(await N.app.decrypt(await N.app.fetchBuf(p.enc)));
  }
  if (src.startsWith('blob:')) { const b = await S().blobGet(src.slice(5)); if (!b) throw new Error('Fichier pas encore synchronisé'); return new Uint8Array(b.data); }
  throw new Error('source inconnue');
};
N.pdfDoc = (src) => {
  if (!pdfDocs.has(src)) {
    const p = N.pdfBytes(src).then((bytes) => pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise);
    p.catch(() => pdfDocs.delete(src)); pdfDocs.set(src, p);
  }
  return pdfDocs.get(src);
};

/* ---------- Import de fichiers ---------- */
function pickFile(accept, { multiple = false, capture = null } = {}) {
  return new Promise((res) => {
    const inp = h('input', { type: 'file', accept, multiple: multiple || null, capture: capture || null, style: 'position:fixed;left:-9999px' });
    inp.addEventListener('change', () => { res([...inp.files]); inp.remove(); });
    inp.addEventListener('cancel', () => { res([]); inp.remove(); });
    document.body.append(inp); inp.click();
  });
}
N.pickFile = pickFile;
async function imageToJpeg(file, max = 2000) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const type = file.type === 'image/png' && k === 1 && file.size < 1.5e6 ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((r) => c.toBlob(r, type, .86));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: type, w: c.width, h: c.height };
}
N.imageToJpeg = imageToJpeg;
// Ajoute des pages (PDF ou images) à un cahier ; renvoie les ids créés
async function importPagesInto(nbId, files, afterOrd) {
  const nd = await S().get(nbPath(nbId)); const created = [];
  let ord = afterOrd != null ? afterOrd : Math.max(0, ...Object.values(nd.pages).filter(live).map((p) => p.ord)) ;
  const next = Object.values(nd.pages).filter(live).map((p) => p.ord).filter((o) => o > ord).sort((a, b) => a - b)[0];
  const files2 = [...files]; let total = 0;
  const plan = [];
  for (const f of files2) {
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const sha = await S().blobPut(bytes, 'application/pdf');
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
      pdfDocs.set('blob:' + sha, Promise.resolve(pdf));
      for (let n = 1; n <= pdf.numPages; n++) { const vp = (await pdf.getPage(n)).getViewport({ scale: 1 }); plan.push({ w: vp.width, h: vp.height, bg: { kind: 'pdf', src: 'blob:' + sha, n } }); }
    } else if (/^image\//.test(f.type)) {
      const im = await imageToJpeg(f, 2400); const sha = await S().blobPut(im.bytes, im.mime);
      const w = 595.3, hh = Math.round(w * im.h / im.w * 10) / 10;
      plan.push({ w, h: hh, bg: { kind: 'img', blob: sha } });
    }
  }
  total = plan.length;
  plan.forEach((pl, i) => {
    const pid = S().uid('p');
    const o = next != null ? ord + (next - ord) * (i + 1) / (total + 1) : ord + i + 1;
    S().setObj(nbPath(nbId), 'pages', { id: pid, ord: o, w: pl.w, h: pl.h, tpl: 'blank', color: 'white', bg: pl.bg });
    created.push(pid);
  });
  for (const pid of created) await S().ensure(pgPath(nbId, pid), { items: {} });
  return created;
}
N.importPagesInto = importPagesInto;
// Lecture d'un .zip (sans bibliothèque) : renvoie [{ path, file }] pour les PDF et images
async function unzip(file) {
  const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer);
  let eocd = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip illisible');
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const out = [];
  const utf8 = new TextDecoder(), cp = new TextDecoder('ibm866');
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nameB = buf.subarray(p + 46, p + 46 + nl); const name = (flags & 0x800 ? utf8 : (/[\x80-\xff]/.test(String.fromCharCode(...nameB)) && !/\uFFFD/.test(utf8.decode(nameB)) ? utf8 : cp)).decode(nameB);
    p += 46 + nl + xl + cl;
    if (/\/$/.test(name) || /(^|\/)(__MACOSX|\.)/.test(name)) continue;
    const isPdf = /\.pdf$/i.test(name), isImg = /\.(png|jpe?g|heic|webp)$/i.test(name);
    if (!isPdf && !isImg) continue;
    const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), start = off + 30 + lnl + lxl;
    let data = buf.subarray(start, start + csize);
    if (method === 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else if (method !== 0) continue;
    const base = name.split('/').pop();
    out.push({ path: name, file: new File([data], base, { type: isPdf ? 'application/pdf' : 'image/' + (/png$/i.test(base) ? 'png' : 'jpeg') }) });
  }
  return out;
}
function folderFor(path, root) {
  // « Physique/Cinématique/cours.pdf » → dossiers Physique › Cinématique (créés si besoin)
  let parent = root; const parts = path.split('/').slice(0, -1).filter(Boolean);
  for (const name of parts) {
    let f = folderList().find((x) => !x.trashed && (x.parent || '') === parent && x.name === name);
    if (!f) { f = { id: S().uid('f'), name, parent, trashed: 0 }; N.setIdx('folders', f); }
    parent = f.id;
  }
  return parent;
}
async function newNbFrom(files, title, folder) {
  const isPdf = files.some((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  const id = S().uid('n');
  N.setIdx('nbs', { id, title, cover: 'other', kind: isPdf ? 'pdf' : 'notebook', folder, fav: false, created: Date.now(), upd: Date.now(), trashed: 0, def: { tpl: 'blank', color: 'white', size: 'A4', orient: 'port' } });
  await S().ensure(nbPath(id), { pages: {}, audio: {} });
  const pids = await importPagesInto(id, files, 0);
  N.setIdx('nbs', Object.assign({}, idx.nbs[id], { np: pids.length }));
  return { id, n: pids.length };
}
async function importAsNotebook(files, target = curFolder) {
  if (!files || !files.length) return;
  toast('Import en cours…', 60000);
  try {
    // 1) déplier les .zip (export Goodnotes de plusieurs documents ou d'un dossier)
    const entries = [];
    for (const f of files) {
      if (/\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') { const root = files.length > 1 ? f.name.replace(/\.zip$/i, '') + '/' : ''; for (const e of await unzip(f)) entries.push({ path: root + e.path, file: e.file }); }
      else entries.push({ path: f.name, file: f });
    }
    const pdfs = entries.filter((e) => /\.pdf$/i.test(e.path)), imgs = entries.filter((e) => !/\.pdf$/i.test(e.path));
    if (!pdfs.length && !imgs.length) { toast('Aucun PDF ni image dans ce fichier'); return; }
    // 2) un cahier par PDF (dans des dossiers si le zip en contient), les images ensemble
    const made = []; let done = 0;
    for (const e of pdfs) {
      toast(`Import ${++done} / ${pdfs.length + (imgs.length ? 1 : 0)} : ${e.file.name}`, 60000);
      made.push(await newNbFrom([e.file], e.file.name.replace(/\.pdf$/i, '') || 'Import', folderFor(e.path, target)));
    }
    if (imgs.length) made.push(await newNbFrom(imgs.map((e) => e.file), imgs.length === 1 ? imgs[0].file.name.replace(/\.[^.]+$/, '') : 'Images importées', target));
    const pages = made.reduce((a, m) => a + m.n, 0);
    if (made.length === 1 && !target) { toast(`${pages} page${pages > 1 ? 's' : ''} importée${pages > 1 ? 's' : ''}`); N.editor.open(made[0].id); }
    else if (target && target !== curFolder) { curFolder = target; filter = 'all'; query = ''; toast(`${made.length} fichier${made.length > 1 ? 's' : ''} ajouté${made.length > 1 ? 's' : ''} au dossier`, 4000); renderLib(); }
    else if (made.length === 1) { toast('1 fichier ajouté au dossier'); renderLib(); }
    else { toast(`${made.length} cahiers importés (${pages} pages)`, 4000); renderLib(); }
  } catch (e) { console.warn(e); toast('Import impossible : fichier illisible ?'); }
}
N.importAsNotebook = importAsNotebook;

function goodnotesHelp() {
  const d = dialog({ title: 'Transférer depuis Goodnotes', wide: true, body: h('div', { class: 'nb-form' },
    h('ol', { class: 'nb-steps' },
      h('li', {}, 'Dans Goodnotes, onglet ', h('b', {}, 'Documents'), ' : touche ', h('b', {}, 'Sélectionner'), ' et coche tous tes cahiers (ou un dossier entier).'),
      h('li', {}, 'Touche ', h('b', {}, 'Partager / Exporter'), ', choisis le format ', h('b', {}, 'PDF'), ' (pas « Goodnotes »), avec les pages et les annotations.'),
      h('li', {}, h('b', {}, 'Enregistrer dans Fichiers'), ' (un dossier « Goodnotes » par exemple). Si tu obtiens un fichier .zip, garde-le tel quel.'),
      h('li', {}, 'Reviens ici, touche le bouton ci-dessous et sélectionne tous les PDF (ou le .zip) d’un coup.')),
    h('p', { class: 'muted small' }, 'Chaque PDF devient un cahier, les dossiers du .zip deviennent des dossiers. Ton écriture Goodnotes est « imprimée » dans le PDF : tu peux écrire, surligner et annoter par-dessus, mais plus effacer les anciens traits un par un. Le format .goodnotes n’est pas lisible en dehors de Goodnotes.')),
    actions: [{ label: 'Fermer', value: null }, { label: 'Choisir les fichiers', primary: true, onclick: async (api) => { api.close(); importAsNotebook(await pickFile('application/pdf,image/*,.zip,application/zip', { multiple: true })); } }] });
  void d;
}

/* ---------- Bibliothèque ---------- */
let curFolder = '', filter = 'all', sortBy = 'date', query = '', libRoot = null, selecting = false;
const selSet = new Set(); // ids « n:… » ou « f:… »
const lp = () => { try { return JSON.parse(localStorage.getItem('q1biomed.notesui')) || {}; } catch (_) { return {}; } };
const lpSave = (o) => { try { localStorage.setItem('q1biomed.notesui', JSON.stringify(Object.assign(lp(), o))); } catch (_) {} };
N.uiPrefs = lp; N.uiPrefsSave = lpSave;
(() => { const p = lp(); sortBy = p.sort || 'date'; })();

function coverEl(nb, small) {
  const c = nb.cover || 'other';
  const el = h('span', { class: 'nb-cover c-' + c + (nb.kind === 'pdf' ? ' is-pdf' : ''), 'aria-hidden': 'true' });
  if (nb.kind === 'pdf') {
    el.append(h('span', { class: 'nb-cover-thumb' }));
    N.thumbFor && N.thumbFor(nb.id).then((url) => { if (url) { const t = el.querySelector('.nb-cover-thumb'); t.style.backgroundImage = `url(${url})`; t.classList.add('on'); } }).catch(() => {});
    el.append(h('span', { class: 'nb-cover-tag' }, 'PDF'));
  } else {
    el.append(h('span', { class: 'nb-cover-spine' }), h('span', { class: 'nb-cover-label' }, h('span', {}, nb.title)), h('span', { class: 'nb-cover-band' }));
  }
  if (nb.lock) el.append(h('span', { class: 'nb-cover-lock' }, ico('lock')));
  return el;
}
N.coverEl = coverEl;

function statusPill(still) {
  const s = S().status(), icon = ico(s === 'synced' ? 'cloud' : s === 'error' ? 'close' : s === 'syncing' ? 'sync' : s === 'offline' || s === 'pending' ? 'cloud' : 'check');
  const label = !S().hasToken() && s === 'local' ? 'Sur cet appareil' : S().statusText(s);
  const el = still ? h('span', { class: 'nb-status st-' + s, role: 'status' }, icon, h('span', {}, label))
    : h('button', { class: 'nb-status st-' + s, type: 'button', onclick: syncSettings, 'aria-label': `Synchronisation : ${label}. Ouvrir les réglages` }, icon, h('span', {}, label));
  if (s === 'error') el.title = S().statusMsg();
  return el;
}
N.statusPill = statusPill;

function page() {
  selecting = false; selSet.clear(); document.querySelectorAll('body > .nb-selbar').forEach((x) => x.remove());
  libRoot = h('div', { class: 'page nb-lib' }, h('p', { class: 'muted' }, 'Ouverture des cahiers…'));
  (async () => { await N.ready; await loadIndex(); purgeTrash(); renderLib(); })().catch((e) => { console.warn(e); libRoot.replaceChildren(h('p', { class: 'muted' }, 'Impossible d’ouvrir le stockage des cahiers sur cet appareil (navigation privée ?).')); });
  return libRoot;
}
function dueCards() { const today = new Date(); today.setHours(23, 59, 59, 999); return Object.values(idx.cards).filter((c) => live(c) && !c.trashed && (c.due || 0) <= today.getTime()); }
N.dueCards = () => (idx ? dueCards() : []);

function renderLib() {
  if (!libRoot || !libRoot.isConnected && libRoot.parentNode == null && document.querySelector('.nb-lib') !== libRoot) { /* page remplacée */ }
  const focusSel = document.activeElement && document.activeElement.id === 'nbsearch' ? document.activeElement.selectionStart : null;
  const trashN = nbList().filter((n) => n.trashed).length + folderList().filter((f) => f.trashed).length;
  const search = h('input', { class: 'search', type: 'search', id: 'nbsearch', placeholder: 'Chercher un cahier par titre', 'aria-label': 'Chercher un cahier par titre', value: query, oninput: (e) => { query = e.target.value; renderGrid(); } });
  const grid = h('div', { class: 'nb-grid' });
  const crumbs = h('div', { class: 'nb-crumbs' });
  const filters = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrer' },
    [['all', 'Tous'], ['fav', 'Favoris'], ['pdf', 'PDF annotés'], ['trash', 'Corbeille' + (trashN ? ` (${trashN})` : '')]].map(([k, t]) =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(filter === k), onclick: () => { filter = k; renderLib(); } }, t)));
  const sortSeg = h('div', { class: 'seg nb-sort', role: 'group', 'aria-label': 'Trier' },
    [['date', 'Date'], ['name', 'Nom']].map(([k, t]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(sortBy === k), onclick: () => { sortBy = k; lpSave({ sort: k }); renderLib(); } }, t)));
  const due = dueCards().length, totalCards = Object.values(idx.cards).filter((c) => live(c)).length;
  const bannerHidden = lp().hideBanner;
  function renderGrid() {
    grid.replaceChildren(); crumbs.replaceChildren();
    const q = query.trim().toLowerCase();
    let folders = [], nbs = [];
    if (filter === 'trash') {
      folders = folderList().filter((f) => f.trashed); nbs = nbList().filter((n) => n.trashed);
    } else {
      const inTrashFolder = (n) => { let f = n.folder; let guard = 0; while (f && guard++ < 20) { const fo = idx.folders[f]; if (!fo || fo.gone) return false; if (fo.trashed) return true; f = fo.parent; } return false; };
      nbs = nbList().filter((n) => !n.trashed && !inTrashFolder(n));
      if (q || filter !== 'all') { nbs = nbs.filter((n) => (!q || n.title.toLowerCase().includes(q)) && (filter !== 'fav' || n.fav) && (filter !== 'pdf' || n.kind === 'pdf')); }
      else { const eff = (n) => (n.folder && idx.folders[n.folder] && !idx.folders[n.folder].gone ? n.folder : ''); folders = folderList().filter((f) => !f.trashed && (f.parent || '') === curFolder); nbs = nbs.filter((n) => eff(n) === curFolder); }
    }
    const cmp = sortBy === 'name' ? (a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || '', 'fr', { numeric: true }) : (a, b) => (b.upd || b.created || 0) - (a.upd || a.created || 0);
    folders.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr')); nbs.sort(cmp);
    if (curFolder && filter === 'all' && !q) {
      const path = []; let f = curFolder, guard = 0; while (f && guard++ < 20) { const fo = idx.folders[f]; if (!fo) break; path.unshift(fo); f = fo.parent; }
      crumbs.append(h('button', { class: 'nb-crumb', type: 'button', onclick: () => { curFolder = ''; renderLib(); } }, ico('back'), 'Cahiers'));
      path.forEach((fo, i) => crumbs.append(h('span', { class: 'nb-crumb-sep', 'aria-hidden': 'true' }, '/'), i === path.length - 1 ? h('b', {}, fo.name) : h('button', { class: 'nb-crumb', type: 'button', onclick: () => { curFolder = fo.id; renderLib(); } }, fo.name)));
    }
    if (filter === 'all' && !q) grid.append(h('div', { class: 'nb-tile nb-newtile' }, h('button', { class: 'nb-tile-open', type: 'button', 'aria-label': 'Créer un nouveau cahier', onclick: newNotebookDlg }, h('span', { class: 'nb-newcover', 'aria-hidden': 'true' }, ico('plus'))), h('div', { class: 'nb-tile-meta' }, h('div', { class: 'nb-tile-tx' }, h('b', {}, 'Nouveau'), h('span', {}, 'Cahier ou PDF')))));
    folders.forEach((f) => grid.append(folderTile(f)));
    nbs.forEach((n) => grid.append(nbTile(n)));
    if (!folders.length && !nbs.length) grid.append(h('div', { class: 'nb-empty' }, filter === 'trash' ? 'La corbeille est vide. Les éléments supprimés y restent 30 jours.' : q ? `Aucun cahier ne correspond à « ${query} ».` : filter === 'fav' ? 'Aucun favori. Touche ⋯ sur un cahier › Favori.' : filter === 'pdf' ? 'Aucun PDF annoté. Ouvre un PDF dans l’onglet PDF puis touche « Annoter ».' : curFolder ? 'Ce dossier est vide.' : 'Aucun cahier pour l’instant. Crée ton premier cahier.'));
  }
  renderGrid();
  const nN = nbList().filter((n) => !n.trashed).length, fN = folderList().filter((f) => !f.trashed).length;
  const addMenu = (e) => menu(e.currentTarget, [
    { label: 'Nouveau cahier', icon: 'plus', onclick: newNotebookDlg },
    { label: 'Nouveau dossier', icon: 'folder', onclick: () => newFolder() },
    { label: curFolder ? 'Ajouter des PDF ici' : 'Importer PDF, images ou .zip', icon: 'upload', onclick: () => { const p = pickFile(PDF_ACCEPT, { multiple: true }); p.then((files) => importAsNotebook(files, curFolder)); } },
    { label: 'Transférer depuis Goodnotes', icon: 'download', onclick: goodnotesHelp },
    '-',
    { label: 'Nouvelle carte de révision', icon: 'cards', onclick: () => N.cards.newCard() }
  ], { align: 'right' });
  const row = (icon, tint, title, sub, onclick) => h('button', { class: 'nb-grow', type: 'button', onclick }, h('span', { class: 'nb-grow-ic', style: `--t:${tint}` }, ico(icon)), h('span', { class: 'nb-grow-tx' }, h('b', {}, title), sub ? h('span', {}, sub) : null), ico('chev', 'nb-grow-chev'));
  libRoot.replaceChildren(
    h('header', { class: 'nb-hero' },
      h('div', { class: 'nb-hero-row' },
        h('div', { class: 'nb-hero-tx' }, h('h1', {}, 'Cahiers'), h('p', { class: 'nb-sub' }, nN ? `${nN} cahier${nN > 1 ? 's' : ''}${fN ? ` · ${fN} dossier${fN > 1 ? 's' : ''}` : ''}` : 'Écris, annote tes PDF et révise.')),
        h('div', { class: 'nb-hero-actions' }, statusPill(),
          h('button', { class: 'nb-pbtn', type: 'button', onclick: addMenu, 'aria-label': 'Créer ou importer', 'aria-haspopup': 'menu' }, ico('plus'), h('span', {}, 'Nouveau'))))),
    !S().hasToken() && !bannerHidden ? h('div', { class: 'nb-card nb-banner' }, h('span', { class: 'nb-grow-ic', style: '--t:#0a84ff' }, ico('cloud')), h('div', { class: 'tx' }, h('b', {}, 'Synchronise tes appareils'), h('span', {}, 'Retrouve tes cahiers sur l’iPad, le téléphone et le PC.')),
      h('button', { class: 'btn solid', type: 'button', onclick: syncSettings }, 'Activer'), ibtn('close', 'Masquer ce message', () => { lpSave({ hideBanner: true }); renderLib(); })) : null,
    totalCards ? h('div', { class: 'nb-card nb-due' }, h('span', { class: 'nb-grow-ic', style: '--t:#30b45f' }, ico('cards')), h('div', { class: 'tx' }, h('b', {}, due ? `${due} carte${due > 1 ? 's' : ''} à revoir aujourd’hui` : 'Aucune carte à revoir aujourd’hui'), h('span', {}, `${totalCards} carte${totalCards > 1 ? 's' : ''} de révision`)),
      h('button', { class: 'btn' + (due ? ' solid' : ''), type: 'button', onclick: () => N.cards.review() }, due ? 'Réviser' : 'Voir')) : null,
    h('div', { class: 'nb-toolbar' }, h('label', { class: 'nb-searchwrap' }, ico('search'), search), sortSeg,
      filter !== 'trash' ? h('button', { class: 'btn nb-selbtn' + (selecting ? ' solid' : ''), type: 'button', 'aria-pressed': String(selecting), onclick: () => { selecting = !selecting; selSet.clear(); renderLib(); } }, selecting ? 'Terminé' : 'Sélectionner') : null),
    h('div', { class: 'nb-filters' }, filters),
    crumbs,
    curFolder && filter === 'all' && !query.trim() ? folderBar() : null,
    filter === 'trash' && (nbList().some((n) => n.trashed) || folderList().some((f) => f.trashed)) ? h('div', {}, h('button', { class: 'btn danger', type: 'button', onclick: emptyTrash }, ico('trash'), 'Vider la corbeille')) : null,
    grid,
    h('section', { class: 'nb-group' }, h('h2', {}, 'Plus'),
      h('div', { class: 'nb-glist' },
        row('folder', '#0a84ff', 'Nouveau dossier', 'Mets-y plusieurs PDF d’un coup', () => newFolder()),
        row('download', '#ff9f0a', 'Transférer depuis Goodnotes', 'Tous tes cahiers en PDF, dossiers compris', goodnotesHelp),
        row('cards', '#30b45f', 'Nouvelle carte de révision', 'Recto / verso, répétition espacée', () => N.cards.newCard()),
        row('share', '#5e5ce6', 'Exporter tous mes cahiers', 'Sauvegarde de secours (.json)', exportBackup),
        row('upload', '#8e8e93', 'Importer une sauvegarde', '', importBackup))));
  document.querySelectorAll('body > .nb-selbar').forEach((x) => x.remove());
  if (selecting) document.body.append(selectionBar()); // hors de .page (transformée) pour rester fixée en bas
  if (focusSel != null) { const s = libRoot.querySelector('#nbsearch'); if (s) { s.focus(); try { s.setSelectionRange(focusSel, focusSel); } catch (_) {} } }
}
window.addEventListener('hashchange', () => { if (location.hash !== '#cahiers') { selecting = false; selSet.clear(); document.querySelectorAll('body > .nb-selbar').forEach((x) => x.remove()); } });
N.renderLib = () => { if (libRoot && libRoot.isConnected && idx) renderLib(); };

function selToggle(key) { if (selSet.has(key)) selSet.delete(key); else selSet.add(key); renderLib(); }
const selMark = (key) => (selecting ? h('span', { class: 'nb-check' + (selSet.has(key) ? ' on' : ''), 'aria-hidden': 'true' }, ico('check')) : null);
function nbTile(nb) {
  const key = 'n:' + nb.id;
  const open = () => selecting ? selToggle(key) : nb.trashed ? null : openNb(nb.id);
  const opts = (e) => { e.stopPropagation(); nbMenu(nb, e.currentTarget); };
  return h('div', { class: 'nb-tile' + (nb.trashed ? ' trashed' : '') + (selecting && selSet.has(key) ? ' picked' : '') },
    h('button', { class: 'nb-tile-open', type: 'button', onclick: open, 'aria-label': selecting ? `Sélectionner ${nb.title}` : `Ouvrir ${nb.title}`, 'aria-pressed': selecting ? String(selSet.has(key)) : null, disabled: nb.trashed && !selecting ? true : null }, coverEl(nb), selMark(key)),
    h('div', { class: 'nb-tile-meta' },
      h('div', { class: 'nb-tile-tx' }, h('b', {}, nb.fav ? ico('star', 'nb-fav') : null, nb.title), h('span', {}, nb.trashed ? `Supprimé · ${Math.max(0, 30 - Math.floor((Date.now() - nb.trashed) / DAY))} j restants` : fmtDate(nb.upd || nb.created))),
      h('button', { class: 'nb-ib nb-more', type: 'button', 'aria-label': `Options de ${nb.title}`, title: 'Options', onclick: opts }, ico('chevdown'))));
}
function folderTile(f) {
  const n = nbList().filter((x) => x.folder === f.id && !x.trashed).length + folderList().filter((x) => x.parent === f.id && !x.trashed).length;
  const key = 'f:' + f.id;
  return h('div', { class: 'nb-tile folder' + (f.trashed ? ' trashed' : '') + (selecting && selSet.has(key) ? ' picked' : '') },
    h('button', { class: 'nb-tile-open', type: 'button', 'aria-label': selecting ? `Sélectionner le dossier ${f.name}` : `Ouvrir le dossier ${f.name}`, 'aria-pressed': selecting ? String(selSet.has(key)) : null, disabled: f.trashed && !selecting ? true : null, onclick: () => { if (selecting) { selToggle(key); return; } curFolder = f.id; filter = 'all'; query = ''; renderLib(); } }, folderArt(f, n), selMark(key)),
    h('div', { class: 'nb-tile-meta' }, h('div', { class: 'nb-tile-tx' }, h('b', {}, f.name), h('span', {}, f.trashed ? 'Dossier supprimé' : n ? 'Modifié ' + fmtDate(Math.max(0, ...nbList().filter((x) => x.folder === f.id && !x.trashed).map((x) => x.upd || x.created || 0))).toLowerCase() : 'Dossier vide')),
      h('button', { class: 'nb-ib nb-more', type: 'button', 'aria-label': `Options du dossier ${f.name}`, title: 'Options', onclick: (e) => { e.stopPropagation(); folderMenu(f, e.currentTarget); } }, ico('chevdown'))));
}
const upd = (coll, obj, patch) => N.setIdx(coll, Object.assign({}, obj, patch));
function nbMenu(nb, anchor) {
  if (nb.trashed) return menu(anchor, [{ label: 'Restaurer', icon: 'undo', onclick: () => { upd('nbs', nb, { trashed: 0 }); renderLib(); toast('Cahier restauré'); } },
    { label: 'Supprimer définitivement', icon: 'trash', danger: true, onclick: async () => { if (await confirmDlg('Supprimer définitivement ?', `« ${nb.title} » sera effacé sur tous tes appareils.`, 'Supprimer', true)) { N.setIdx('nbs', S().tomb(nb.id)); renderLib(); } } }]);
  menu(anchor, [
    { label: 'Ouvrir', icon: 'eye', onclick: () => openNb(nb.id) },
    { label: nb.fav ? 'Retirer des favoris' : 'Favori', icon: 'star', onclick: () => { upd('nbs', nb, { fav: !nb.fav }); renderLib(); } },
    { label: 'Renommer', icon: 'text', onclick: async () => { const t = await prompt('Renommer', nb.title, { label: 'Titre' }); if (t) { upd('nbs', nb, { title: t }); renderLib(); } } },
    { label: 'Couverture', icon: 'palette', onclick: () => coverDlg(nb) },
    { label: 'Dupliquer', icon: 'dup', onclick: () => duplicateNb(nb) },
    { label: 'Déplacer', icon: 'folder', onclick: () => moveDlg(nb) },
    { label: 'Exporter en PDF', icon: 'share', onclick: () => N.exportPdf && N.exportPdf(nb.id) },
    '-',
    { label: nb.readonly ? 'Autoriser la modification' : 'Lecture seule', icon: 'readonly', onclick: () => { upd('nbs', nb, { readonly: !nb.readonly }); renderLib(); } },
    { label: nb.lock ? 'Retirer le verrou' : 'Verrouiller par code', icon: 'lock', onclick: () => lockDlg(nb) },
    '-',
    { label: 'Mettre à la corbeille', icon: 'trash', danger: true, onclick: () => { upd('nbs', nb, { trashed: Date.now() }); renderLib(); toast('Mis à la corbeille (30 jours)'); } }
  ], { align: 'right' });
}
function folderMenu(f, anchor) {
  if (f.trashed) return menu(anchor, [{ label: 'Restaurer', icon: 'undo', onclick: () => { upd('folders', f, { trashed: 0 }); renderLib(); } },
    { label: 'Supprimer définitivement', icon: 'trash', danger: true, onclick: async () => { if (await confirmDlg('Supprimer le dossier ?', 'Les cahiers qu’il contient retournent à la racine.', 'Supprimer', true)) { nbList().filter((n) => n.folder === f.id).forEach((n) => upd('nbs', n, { folder: '' })); N.setIdx('folders', S().tomb(f.id)); renderLib(); } } }]);
  menu(anchor, [
    { label: 'Ajouter des PDF', icon: 'upload', onclick: () => addPdfsTo(f.id) },
    { label: 'Renommer', icon: 'text', onclick: async () => { const t = await prompt('Renommer le dossier', f.name); if (t) { upd('folders', f, { name: t }); renderLib(); } } },
    { label: 'Couleur', icon: 'palette', onclick: () => { const d = dialog({ title: 'Couleur du dossier', body: h('div', { class: 'nb-swatches' }, COVERS.map(([k, t]) => h('button', { class: 'nb-swatch c-' + k + ((f.color || 'bio') === k ? ' on' : ''), type: 'button', 'aria-label': t, title: t, onclick: () => { upd('folders', f, { color: k }); d.close(); renderLib(); } }))) }); } },
    { label: 'Déplacer', icon: 'folder', onclick: () => moveDlg(f, true) },
    { label: 'Mettre à la corbeille', icon: 'trash', danger: true, onclick: () => { upd('folders', f, { trashed: Date.now() }); renderLib(); toast('Dossier mis à la corbeille'); } }
  ], { align: 'right' });
}
const PDF_ACCEPT = 'application/pdf,.pdf,image/*,.zip,application/zip';
// Choisir des fichiers tout de suite (dans le geste : obligatoire sur iPad), puis importer dans le dossier
function addPdfsTo(folderId) { const p = pickFile(PDF_ACCEPT, { multiple: true }); p.then((files) => { if (files.length) importAsNotebook(files, folderId); }); }
function newFolder(moveKeys) {
  const inp = h('input', { class: 'search', type: 'text', placeholder: 'ex. Physique, Chimie TP…', 'aria-label': 'Nom du dossier', autocomplete: 'off' });
  let color = 'bio';
  const sw = h('div', { class: 'nb-swatches', role: 'group', 'aria-label': 'Couleur du dossier' });
  const drawSw = () => sw.replaceChildren(...COVERS.map(([k, t]) => h('button', { class: 'nb-swatch c-' + k + (color === k ? ' on' : ''), type: 'button', 'aria-label': 'Couleur ' + t, 'aria-pressed': String(color === k), onclick: () => { color = k; drawSw(); } })));
  drawSw();
  const create = () => { const name = inp.value.trim() || 'Nouveau dossier'; const id = S().uid('f'); N.setIdx('folders', { id, name, color, parent: curFolder, trashed: 0 }); return id; };
  const moving = moveKeys && moveKeys.length;
  const d = dialog({ title: 'Nouveau dossier', body: h('div', { class: 'nb-form' }, h('label', { class: 'nb-field' }, h('span', {}, 'Nom'), inp), h('div', { class: 'nb-field' }, h('span', {}, 'Couleur'), sw),
      h('p', { class: 'muted small' }, moving ? `Les ${moveKeys.length} élément${moveKeys.length > 1 ? 's' : ''} sélectionné${moveKeys.length > 1 ? 's' : ''} seront rangés dedans.` : 'Tu peux y mettre plusieurs PDF d’un coup : chaque PDF devient un document annotable.')),
    actions: moving ? [{ label: 'Annuler', value: null }, { label: 'Créer et ranger', primary: true, onclick: (api) => { const id = create(); moveKeysTo(moveKeys, id); api.close(); } }]
      : [{ label: 'Créer vide', value: null, onclick: (api) => { const id = create(); api.close(); curFolder = id; filter = 'all'; query = ''; renderLib(); } },
        { label: 'Créer et ajouter des PDF', primary: true, onclick: (api) => { const id = create(); addPdfsTo(id); api.close(); curFolder = id; filter = 'all'; query = ''; renderLib(); } }] });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); d.box.querySelector('.nb-dlg-actions .solid').click(); } });
}
function moveKeysTo(keys, folderId) {
  let n = 0;
  for (const k of keys) {
    const [t, id] = [k.slice(0, 1), k.slice(2)];
    if (t === 'n' && idx.nbs[id] && !idx.nbs[id].gone) { upd('nbs', idx.nbs[id], { folder: folderId, trashed: 0 }); n++; }
    if (t === 'f' && idx.folders[id] && !idx.folders[id].gone && id !== folderId) { let p = folderId, bad = false, g = 0; while (p && g++ < 30) { if (p === id) { bad = true; break; } p = (idx.folders[p] || {}).parent; } if (!bad) { upd('folders', idx.folders[id], { parent: folderId, trashed: 0 }); n++; } }
  }
  selecting = false; selSet.clear(); renderLib();
  const fo = idx.folders[folderId]; toast(`${n} élément${n > 1 ? 's' : ''} rangé${n > 1 ? 's' : ''} dans « ${fo ? fo.name : 'Cahiers'} »`);
}
function moveManyDlg(keys) {
  const opts = [{ id: '', name: 'Cahiers (racine)' }].concat(folderList().filter((f) => !f.trashed && !keys.includes('f:' + f.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr')));
  const d = dialog({ title: `Ranger ${keys.length} élément${keys.length > 1 ? 's' : ''}`, body: h('div', { class: 'nb-list' },
    h('button', { class: 'nb-row', type: 'button', onclick: () => { d.close(); newFolder(keys); } }, ico('plus'), h('span', {}, h('b', {}, 'Nouveau dossier…'))),
    opts.map((f) => h('button', { class: 'nb-row', type: 'button', onclick: () => { d.close(); moveKeysTo(keys, f.id); } }, ico(f.id ? 'folder' : 'pages'), h('span', {}, f.name)))) });
}
function selectionBar() {
  const keys = [...selSet], n = keys.length;
  const trash = () => { for (const k of keys) { const id = k.slice(2); if (k[0] === 'n' && idx.nbs[id]) upd('nbs', idx.nbs[id], { trashed: Date.now() }); if (k[0] === 'f' && idx.folders[id]) upd('folders', idx.folders[id], { trashed: Date.now() }); } selecting = false; selSet.clear(); renderLib(); toast(`${n} élément${n > 1 ? 's' : ''} mis à la corbeille`); };
  return h('div', { class: 'nb-selbar', role: 'toolbar', 'aria-label': 'Actions sur la sélection' },
    h('span', { class: 'nb-selbar-n' }, n ? `${n} sélectionné${n > 1 ? 's' : ''}` : 'Touche des cahiers ou des PDF'),
    h('button', { class: 'btn solid', type: 'button', disabled: n ? null : true, onclick: () => moveManyDlg(keys) }, ico('folder'), 'Ranger dans un dossier'),
    h('button', { class: 'btn danger', type: 'button', disabled: n ? null : true, onclick: trash, 'aria-label': 'Mettre la sélection à la corbeille' }, ico('trash')));
}
// Dossier « classeur » (maquette Claude Design) : fond + onglet, vraies pages qui dépassent, poche colorée
function folderArt(f, n) {
  const kids = nbList().filter((x) => x.folder === f.id && !x.trashed).sort((a, b) => (b.upd || 0) - (a.upd || 0)).slice(0, 2);
  const sheet = (k, i) => {
    const el = h('span', { class: 'nb-fold-sheet s' + (i + 1) });
    if (k.kind !== 'pdf' && k.cover) el.classList.add('cv', 'c-' + k.cover);
    N.thumbFor && N.thumbFor(k.id).then((url) => { if (url) { el.style.backgroundImage = `url(${url})`; el.classList.add('img'); } }).catch(() => {});
    return el;
  };
  return h('span', { class: 'nb-fold c-' + (f.color || 'bio'), 'aria-hidden': 'true' },
    h('span', { class: 'nb-fold-back' }), h('span', { class: 'nb-fold-tab' }),
    kids.map(sheet).reverse(),
    h('span', { class: 'nb-fold-front' }, h('span', { class: 'nb-fold-count' }, n ? `${n} document${n > 1 ? 's' : ''}` : 'Vide')));
}
function folderBar() {
  const f = idx.folders[curFolder]; if (!f || f.gone) return null;
  const n = nbList().filter((x) => x.folder === f.id && !x.trashed).length;
  return h('div', { class: 'nb-card nb-folderbar' }, h('span', { class: 'nb-grow-ic nb-fold-ic c-' + (f.color || 'bio') }, ico('folderFill')),
    h('div', { class: 'tx' }, h('b', {}, f.name), h('span', {}, n ? `${n} document${n > 1 ? 's' : ''}` : 'Dossier vide : ajoute tes PDF')),
    h('button', { class: 'btn solid', type: 'button', onclick: () => addPdfsTo(f.id) }, ico('upload'), 'Ajouter des PDF'),
    h('button', { class: 'nb-ib', type: 'button', 'aria-label': `Options du dossier ${f.name}`, onclick: (e) => folderMenu(f, e.currentTarget) }, ico('more')));
}
function moveDlg(obj, isFolder) {
  const desc = (fid) => { const out = new Set([fid]); let grow = true; while (grow) { grow = false; for (const f of folderList()) if (!out.has(f.id) && out.has(f.parent)) { out.add(f.id); grow = true; } } return out; };
  const banned = isFolder ? desc(obj.id) : new Set();
  const opts = [{ id: '', name: 'Cahiers (racine)' }].concat(folderList().filter((f) => !f.trashed && !banned.has(f.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr')));
  const cur = isFolder ? (obj.parent || '') : (obj.folder || '');
  const d = dialog({ title: `Déplacer « ${obj.title || obj.name} »`, body: h('div', { class: 'nb-list' }, opts.map((f) => h('button', { class: 'nb-row' + (f.id === cur ? ' on' : ''), type: 'button', onclick: () => { upd(isFolder ? 'folders' : 'nbs', obj, isFolder ? { parent: f.id } : { folder: f.id }); d.close(); renderLib(); toast('Déplacé'); } }, ico(f.id ? 'folder' : 'pages'), h('span', {}, f.name), f.id === cur ? ico('check') : null))) });
}
function coverDlg(nb) {
  const d = dialog({ title: 'Couverture', body: h('div', { class: 'nb-swatches big' }, COVERS.map(([k, t]) => h('button', { class: 'nb-swatch c-' + k + (nb.cover === k ? ' on' : ''), type: 'button', 'aria-label': t, title: t, onclick: () => { upd('nbs', nb, { cover: k }); d.close(); renderLib(); } }))) });
}
async function duplicateNb(nb) {
  toast('Duplication…');
  const id = S().uid('n'); const src = await S().get(nbPath(nb.id)); if (!src) return;
  N.setIdx('nbs', Object.assign({}, nb, { id, title: nb.title + ' (copie)', kind: nb.kind === 'pdf' ? 'pdf' : nb.kind, site: undefined, created: Date.now(), upd: Date.now(), fav: false, lock: undefined }));
  await S().ensure(nbPath(id), { pages: {}, audio: {} });
  for (const pg of Object.values(src.pages).filter(live)) {
    const pid = S().uid('p'); const copy = JSON.parse(JSON.stringify(pg)); copy.id = pid; delete copy.t; delete copy.d;
    S().setObj(nbPath(id), 'pages', copy);
    const items = (await S().get(pgPath(nb.id, pg.id)) || { items: {} }).items;
    const d = await S().ensure(pgPath(id, pid), { items: {} });
    for (const it of Object.values(items).filter(live)) { const c = JSON.parse(JSON.stringify(it)); c.id = S().uid('i'); S().setObj(pgPath(id, pid), 'items', c); }
    void d;
  }
  renderLib(); toast('Cahier dupliqué');
}
async function lockDlg(nb) {
  if (nb.lock) {
    const code = await prompt('Retirer le verrou', '', { label: 'Code actuel', type: 'password', ok: 'Retirer' });
    if (code == null) return;
    if (await hashCode(nb.id, code) !== nb.lock) { toast('Code incorrect'); return; }
    upd('nbs', nb, { lock: '' }); renderLib(); toast('Verrou retiré'); return;
  }
  const code = await prompt('Verrouiller ce cahier', '', { label: 'Choisis un code (4 chiffres ou plus)', type: 'password', ok: 'Verrouiller' });
  if (!code) return; if (code.length < 4) { toast('Code trop court'); return; }
  upd('nbs', nb, { lock: await hashCode(nb.id, code) }); renderLib(); toast('Cahier verrouillé');
}
const hashCode = async (id, code) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('q1lock:' + id + ':' + code)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const unlocked = new Set();
async function openNb(id) {
  const nb = idx.nbs[id]; if (!nb || nb.gone) return;
  if (nb.lock && !unlocked.has(id)) {
    const code = await prompt('Cahier verrouillé', '', { label: 'Code', type: 'password', ok: 'Ouvrir' });
    if (code == null) return;
    if (await hashCode(id, code) !== nb.lock) { toast('Code incorrect'); return; }
    unlocked.add(id);
  }
  N.editor.open(id);
}
N.openNb = openNb;
N.openFromHash = async (id) => { await N.ready; if (!idx) await loadIndex(); if (N.editor.currentId() === id) return; if (idx.nbs[id] && !idx.nbs[id].gone) openNb(id); };
async function emptyTrash() {
  if (!(await confirmDlg('Vider la corbeille ?', 'Les cahiers et dossiers de la corbeille seront effacés sur tous tes appareils.', 'Vider', true))) return;
  nbList().filter((n) => n.trashed).forEach((n) => N.setIdx('nbs', S().tomb(n.id)));
  folderList().filter((f) => f.trashed).forEach((f) => N.setIdx('folders', S().tomb(f.id)));
  renderLib();
}

/* ---------- Nouveau cahier ---------- */
function tplPreview(kind, color) {
  const c = document.createElement('canvas'); c.width = 84; c.height = 112; c.className = 'nb-tplprev';
  const x = c.getContext('2d'); x.scale(84 / 595.3, 112 / 841.9);
  N.drawTemplate && N.drawTemplate(x, { w: 595.3, h: 841.9, tpl: kind, color }, 5);
  return c;
}
N.tplPreview = tplPreview;
function newNotebookDlg() {
  const st = Object.assign({ cover: 'bio', tpl: 'lined', color: 'white', size: 'A4', orient: 'port', custom: null }, lp().lastNew || {});
  if (st.custom && (!idx.tpls[st.custom] || idx.tpls[st.custom].gone)) st.custom = null;
  const title = h('input', { class: 'search', type: 'text', placeholder: 'ex. Physique : cinématique', 'aria-label': 'Titre du cahier' });
  const covers = h('div', { class: 'nb-swatches', role: 'group', 'aria-label': 'Couverture' });
  const tpls = h('div', { class: 'nb-tpls', role: 'group', 'aria-label': 'Modèle de papier' });
  const opts = h('div', { class: 'nb-optrow' });
  const draw = () => {
    covers.replaceChildren(...COVERS.map(([k, t]) => h('button', { class: 'nb-swatch c-' + k + (st.cover === k ? ' on' : ''), type: 'button', 'aria-label': 'Couverture ' + t, 'aria-pressed': String(st.cover === k), title: t, onclick: () => { st.cover = k; draw(); } })));
    tpls.replaceChildren(...TPLS.map(([k, t]) => h('button', { class: 'nb-tpl' + (!st.custom && st.tpl === k ? ' on' : ''), type: 'button', 'aria-pressed': String(!st.custom && st.tpl === k), onclick: () => { st.tpl = k; st.custom = null; draw(); } }, tplPreview(k, st.color), h('span', {}, t))),
      ...Object.values(idx.tpls).filter(live).map((t) => h('button', { class: 'nb-tpl' + (st.custom === t.id ? ' on' : ''), type: 'button', 'aria-pressed': String(st.custom === t.id), onclick: () => { st.custom = t.id; draw(); } }, h('span', { class: 'nb-tplprev custom' }, ico('pdf')), h('span', {}, t.name))),
      h('button', { class: 'nb-tpl', type: 'button', onclick: async () => { const id = await importTemplate(); if (id) { st.custom = id; draw(); } } }, h('span', { class: 'nb-tplprev custom' }, ico('plus')), h('span', {}, 'Depuis un PDF…')));
    const seg = (key, list, lbl) => h('div', { class: 'seg', role: 'group', 'aria-label': lbl, style: `grid-template-columns:repeat(${list.length},minmax(0,1fr))` }, list.map(([k, t]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(st[key] === k), onclick: () => { st[key] = k; draw(); } }, t)));
    opts.replaceChildren(h('label', { class: 'nb-field' }, h('span', {}, 'Couleur du papier'), seg('color', PCOLORS, 'Couleur du papier')),
      h('label', { class: 'nb-field' }, h('span', {}, 'Format'), seg('size', [['A4', 'A4'], ['Letter', 'Letter']], 'Format')),
      h('label', { class: 'nb-field' }, h('span', {}, 'Orientation'), seg('orient', [['port', 'Portrait'], ['land', 'Paysage']], 'Orientation')));
  };
  draw();
  const go = async (api) => {
    lpSave({ lastNew: st }); api.close();
    const id = await createNotebook({ title: title.value.trim() || 'Sans titre', cover: st.cover, tpl: st.tpl, color: st.color, size: st.size, orient: st.orient, folder: curFolder, custom: st.custom });
    renderLib(); N.editor.open(id);
  };
  const d = dialog({ title: 'Nouveau cahier', wide: true, body: h('div', { class: 'nb-form' }, h('label', { class: 'nb-field' }, h('span', {}, 'Titre'), title), h('div', { class: 'nb-field' }, h('span', {}, 'Couverture'), covers), h('div', { class: 'nb-field' }, h('span', {}, 'Papier'), tpls), opts),
    actions: [{ label: 'Annuler', value: null }, { label: 'Créer', primary: true, onclick: go }] });
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(d); } });
}
async function importTemplate() {
  const [f] = await pickFile('application/pdf'); if (!f) return null;
  try {
    const bytes = new Uint8Array(await f.arrayBuffer()); const sha = await S().blobPut(bytes, 'application/pdf');
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise; pdfDocs.set('blob:' + sha, Promise.resolve(pdf));
    const vp = (await pdf.getPage(1)).getViewport({ scale: 1 });
    const id = S().uid('t'); N.setIdx('tpls', { id, name: f.name.replace(/\.pdf$/i, '').slice(0, 30), blob: sha, n: 1, w: vp.width, h: vp.height });
    toast('Modèle ajouté'); return id;
  } catch (e) { toast('PDF illisible'); return null; }
}
N.importTemplate = importTemplate;

/* ---------- Réglages de synchronisation ---------- */
function syncSettings() {
  const body = h('div', { class: 'nb-sync' });
  let d = null;
  const draw = () => {
    body.replaceChildren();
    if (S().hasToken()) {
      const ls = S().lastSync();
      body.append(
        h('div', { class: 'nb-sync-ok' }, ico('cloud'), h('div', {}, h('b', {}, 'Cet appareil est synchronisé'), h('span', { class: 'muted small' }, ls ? 'Dernière synchro : ' + new Date(ls).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Première synchro en cours…'))),
        h('div', {}, statusPill(true)),
        S().status() === 'error' ? h('p', { class: 'nb-err' }, S().statusMsg()) : null,
        h('p', { class: 'muted small' }, `Tes cahiers sont envoyés chiffrés dans la branche « ${S().branch} » du dépôt ${S().repo()}. Sans ton mot de passe, personne ne peut les lire.`),
        h('div', { class: 'nb-actions' },
          h('button', { class: 'btn solid', type: 'button', onclick: async () => { await S().syncNow(); draw(); toast(S().status() === 'synced' ? 'Synchronisé' : S().statusText()); } }, ico('sync'), 'Synchroniser maintenant'),
          h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await confirmDlg('Déconnecter cet appareil ?', 'Tes cahiers restent sur cet appareil, mais ne se synchronisent plus. Le jeton est effacé de cet appareil.', 'Déconnecter', true)) { S().disconnect(); draw(); N.renderLib(); } } }, 'Déconnecter cet appareil')));
      return;
    }
    const tok = h('input', { class: 'search', type: 'password', id: 'nbtoken', placeholder: 'github_pat_…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Jeton GitHub' });
    const msg = h('p', { class: 'nb-msg', role: 'status' });
    const test = async () => {
      const t = tok.value.trim(); if (!t) { tok.focus(); return null; }
      msg.className = 'nb-msg'; msg.textContent = 'Test en cours…';
      const r = await S().testToken(t); msg.className = 'nb-msg ' + (r.ok ? 'ok' : 'bad'); msg.textContent = r.msg; return r.ok ? t : null;
    };
    body.append(
      h('p', {}, 'Une seule fois par appareil (iPad, téléphone, PC) : crée un jeton GitHub et colle-le ici. Tu peux utiliser le même jeton sur tous tes appareils.'),
      h('ol', { class: 'nb-steps' },
        h('li', {}, 'Ouvre ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'github.com › nouveau jeton (fine-grained)'), ' et connecte-toi.'),
        h('li', {}, h('b', {}, 'Token name'), ' : « Cahiers Q1 ». ', h('b', {}, 'Expiration'), ' : la plus longue possible (366 jours ou « No expiration »).'),
        h('li', {}, h('b', {}, 'Repository access'), ' : « Only select repositories » › ', h('code', {}, S().repo()), '.'),
        h('li', {}, h('b', {}, 'Permissions'), ' › Repository permissions › ', h('b', {}, 'Contents'), ' : « Read and write ». Ne coche rien d’autre (Metadata se met tout seul).'),
        h('li', {}, 'Touche ', h('b', {}, 'Generate token'), ', puis copie le jeton (il commence par ', h('code', {}, 'github_pat_'), ').'),
        h('li', {}, 'Colle-le ici, touche ', h('b', {}, 'Tester'), ' puis ', h('b', {}, 'Enregistrer'), '.')),
      h('label', { class: 'nb-field' }, h('span', {}, 'Jeton GitHub'), tok), msg,
      h('div', { class: 'nb-actions' },
        h('button', { class: 'btn', type: 'button', onclick: test }, 'Tester'),
        h('button', { class: 'btn solid', type: 'button', onclick: async () => { const t = await test(); if (t) { await S().setToken(t); tok.value = ''; draw(); N.renderLib(); toast('Synchronisation activée'); } } }, 'Enregistrer')),
      h('p', { class: 'muted small' }, 'Le jeton est enregistré chiffré sur cet appareil, jamais affiché, et envoyé uniquement à api.github.com.'));
  };
  draw();
  const off = S().on('status', () => { if (d && d.box.isConnected && !d.box.contains(document.activeElement)) draw(); });
  d = dialog({ title: 'Synchronisation', body, wide: true, onclose: off });
}
N.syncSettings = syncSettings;

/* ---------- Sauvegarde ---------- */
async function exportBackup() {
  toast('Préparation de la sauvegarde…');
  const data = await S().exportAll();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const d = new Date().toISOString().slice(0, 10);
  await shareOrDownload(blob, `cahiers-q1biomed-${d}.json`);
}
async function importBackup() {
  const [f] = await pickFile('application/json,.json'); if (!f) return;
  try { const n = await S().importAll(JSON.parse(await f.text())); await loadIndex(); renderLib(); toast(`Sauvegarde importée (${n} fichiers fusionnés)`); }
  catch (e) { toast('Fichier de sauvegarde illisible'); }
}

/* ---------- Cartes de révision (répétition espacée) ---------- */
const cards = {
  async newCard(front, nbId) {
    const ftext = h('textarea', { class: 'search nb-ta', rows: 3, placeholder: 'Question', 'aria-label': 'Recto' });
    const btext = h('textarea', { class: 'search nb-ta', rows: 3, placeholder: 'Réponse', 'aria-label': 'Verso' });
    let backImg = null;
    const backPrev = h('div', { class: 'nb-cardprev' });
    const frontEl = front && front.img ? h('div', { class: 'nb-cardprev' }, h('img', { alt: 'Recto (sélection)', src: front.url })) : ftext;
    const d = dialog({ title: 'Nouvelle carte', body: h('div', { class: 'nb-form' }, h('label', { class: 'nb-field' }, h('span', {}, 'Recto'), frontEl), h('label', { class: 'nb-field' }, h('span', {}, 'Verso'), btext), backPrev,
      N.editor && N.editor.isOpen() ? h('p', { class: 'muted small' }, 'Astuce : sélectionne au lasso › Carte pour mettre une partie de ta page en image.') : null),
      actions: [{ label: 'Annuler', value: null }, { label: 'Créer la carte', primary: true, onclick: (api) => {
        const fr = front && front.img ? { img: front.img } : { text: ftext.value.trim() };
        const bk = backImg ? { img: backImg } : { text: btext.value.trim() };
        if (!fr.img && !fr.text) { ftext.focus(); return; }
        N.setIdx('cards', { id: S().uid('c'), nb: nbId || '', front: fr, back: bk, due: Date.now(), ivl: 0, ease: 2.5, reps: 0, created: Date.now() });
        api.close(); toast('Carte créée'); N.renderLib();
      } }] });
    void d;
  },
  grade(c, g) {
    const n = Object.assign({}, c); let ivl = c.ivl || 0, ease = c.ease || 2.5;
    if (g === 'hard') { ivl = 1; ease = Math.max(1.3, ease - .2); }
    else if (g === 'mid') { ivl = ivl < 1 ? 1 : ivl < 3 ? 3 : Math.round(ivl * ease); }
    else { ivl = ivl < 1 ? 3 : Math.round(Math.max(ivl * ease * 1.3, ivl + 2)); ease = Math.min(3, ease + .15); }
    const due = new Date(); due.setHours(4, 0, 0, 0); due.setDate(due.getDate() + ivl);
    Object.assign(n, { ivl, ease, reps: (c.reps || 0) + 1, due: due.getTime(), last: Date.now() });
    N.setIdx('cards', n); return n;
  },
  async review() {
    let queue = dueCards().sort((a, b) => (a.due || 0) - (b.due || 0));
    let all = Object.values(idx.cards).filter(live);
    const body = h('div', { class: 'nb-review' });
    let i = 0, shown = false, done = 0;
    const side = (s) => {
      if (!s) return h('span', { class: 'muted' }, '—');
      if (s.img) { const im = h('img', { alt: 'Image de la carte' }); S().blobGet(s.img).then((b) => { if (b) im.src = URL.createObjectURL(new Blob([b.data], { type: b.mime })); }); return im; }
      return h('div', { class: 'nb-cardtext' }, s.text || '');
    };
    const draw = () => {
      body.replaceChildren();
      if (i >= queue.length) {
        all = Object.values(idx.cards).filter(live);
        body.append(h('div', { class: 'nb-review-done' }, ico('check'), h('b', {}, done ? `Bravo, ${done} carte${done > 1 ? 's' : ''} révisée${done > 1 ? 's' : ''} !` : 'Rien à revoir aujourd’hui.'), h('span', { class: 'muted' }, 'Reviens demain pour la suite.')),
          h('h3', {}, `Toutes les cartes (${all.length})`), h('div', { class: 'nb-list' }, all.sort((a, b) => (a.due || 0) - (b.due || 0)).map((c) => h('div', { class: 'nb-row' }, h('span', { class: 'tx' }, c.front && c.front.text ? c.front.text.slice(0, 60) : 'Carte image'), h('span', { class: 'muted small' }, (c.due || 0) <= Date.now() ? 'à revoir' : 'le ' + new Date(c.due).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })),
            ibtn('trash', 'Supprimer la carte', async () => { if (await confirmDlg('Supprimer la carte ?', 'Elle disparaîtra sur tous tes appareils.', 'Supprimer', true)) { N.setIdx('cards', S().tomb(c.id)); all.splice(all.indexOf(c), 1); draw(); N.renderLib(); } })))));
        return;
      }
      const c = queue[i];
      body.append(h('div', { class: 'nb-review-count muted small' }, `${i + 1} / ${queue.length}`),
        h('div', { class: 'nb-flash' }, h('div', { class: 'nb-flash-side' }, h('span', { class: 'k' }, 'Recto'), side(c.front)),
          shown ? h('div', { class: 'nb-flash-side back' }, h('span', { class: 'k' }, 'Verso'), side(c.back)) : null),
        shown ? h('div', { class: 'nb-grades' }, [['hard', 'Difficile'], ['mid', 'Moyen'], ['easy', 'Facile']].map(([g, t]) => h('button', { class: 'btn g-' + g, type: 'button', onclick: () => {
          cards.grade(c, g); done++; if (g === 'hard') queue.push(Object.assign({}, c, { again: true })); i++; shown = false; draw(); N.renderLib();
        } }, t)))
          : h('button', { class: 'btn solid nb-reveal', type: 'button', onclick: () => { shown = true; draw(); } }, 'Montrer la réponse'));
      const f = body.querySelector('.nb-reveal, .g-mid'); if (f) f.focus({ preventScroll: true });
    };
    draw();
    dialog({ title: 'Réviser', body, wide: true, cls: 'nb-review-dlg' });
  }
};
N.cards = cards;

/* ---------- Démarrage ---------- */
let bootResolve; N.ready = new Promise((r) => { bootResolve = r; });
N.boot = async (app) => {
  N.app = app;
  try { await S().init(app.key); await loadIndex(); } catch (e) { console.warn('Cahiers indisponibles', e); }
  bootResolve();
  S().on('status', () => { document.querySelectorAll('.nb-lib .nb-hero .nb-status').forEach((el) => el.replaceWith(statusPill())); N.editor && N.editor.onStatus && N.editor.onStatus(); });
  S().on('change', async (paths) => {
    if (paths.includes(IDX)) { idx = await S().get(IDX); ['nbs', 'folders', 'elements', 'cards', 'tpls'].forEach((k) => { idx[k] = idx[k] || {}; }); N.renderLib(); }
    N.editor && N.editor.onRemote && N.editor.onRemote(paths);
  });
};
N.page = page;
})();
