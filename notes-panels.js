/* Cahiers : barres d'outils, sélection lasso, texte, images, panneau des pages, modèles, export,
   fenêtre de zoom, présentation + laser, signets, liens, éléments, onglets, audio, recherche. */
(() => {
'use strict';
const N = window.Q1Notes = window.Q1Notes || {};
const X = N.ed, S = () => N.store, R = () => N.R, U = () => N.ui;
const E = () => X.state();
const live = (o) => o && !o.gone;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const h = (...a) => U().h(...a), ico = (...a) => U().ico(...a);
const ib = (k, label, onclick, extra = {}) => U().ibtn(k, label, onclick, extra);
const tb = (k, label, onclick, extra = {}) => h('button', Object.assign({ class: 'ne-tb', type: 'button', 'aria-label': label, title: label, onclick }, extra), ico(k), h('span', { class: 'ne-tb-l' }, label));
const narrow = () => innerWidth < 640;

/* ================= Barre du haut ================= */
X.renderTop = () => {
  const e = E(); if (!e) return; const top = X.root().querySelector('.ne-top');
  const nb = e.nb, cur = e.pages.find((p) => p.id === e.cur);
  const tabs = h('div', { class: 'ne-tabs', role: 'tablist', 'aria-label': 'Documents ouverts' }, X.openTabs.filter((id) => { const n = N.index().nbs[id]; return n && !n.gone; }).map((id) => {
    const n = N.index().nbs[id], on = id === e.id;
    return h('div', { class: 'ne-tab' + (on ? ' on' : '') }, h('button', { class: 'ne-tab-go', type: 'button', role: 'tab', 'aria-selected': String(on), onclick: () => { if (!on) N.openNb(id); } }, n.title),
      X.openTabs.length > 1 ? h('button', { class: 'ne-tab-x', type: 'button', 'aria-label': `Fermer l’onglet ${n.title}`, onclick: () => { N.editor.closeTab(id); if (on) { const next = X.openTabs[X.openTabs.length - 1]; if (next) N.openNb(next); else X.close(); } else X.renderTop(); } }, ico('close')) : null);
  }));
  top.replaceChildren(
    ib('back', 'Retour à la bibliothèque', () => X.close()),
    X.openTabs.length > 1 && !narrow() ? tabs : h('button', { class: 'ne-title', type: 'button', onclick: renameNb, 'aria-label': `Renommer ${nb.title}` }, nb.title),
    h('span', { class: 'ne-status-slot' }),
    h('div', { class: 'ne-acts' },
      ib('undo', 'Annuler', () => X.undo(), { class: 'nb-ib ne-undo' }), ib('redo', 'Rétablir', () => X.redo(), { class: 'nb-ib ne-redo' }),
      ib('pages', 'Pages', () => toggleSide(), { 'aria-pressed': String(!X.root().querySelector('.ne-side').hidden) }),
      ib(e.dir === 'h' ? 'horiz' : 'vert', e.dir === 'h' ? 'Page par page (toucher pour défiler en continu)' : 'Défilement continu (toucher pour passer page par page)', toggleDir, { class: 'nb-ib ne-dirbtn' + (e.dir === 'h' ? ' on' : '') }),
      !narrow() ? ib('bookmark', cur && cur.bm ? 'Retirer le signet' : 'Ajouter un signet', toggleBookmark, { class: 'nb-ib' + (cur && cur.bm ? ' on' : '') }) : null,
      X.canEdit() ? ib('plus', 'Ajouter une page', (ev) => addPageMenu(ev.currentTarget)) : null,
      !narrow() ? ib('share', 'Exporter ou partager', () => N.exportPdf(e.id)) : null,
      ib('more', 'Plus d’options', (ev) => moreMenu(ev.currentTarget))));
  X.renderStatus(); X.updateUndo();
};
X.renderStatus = () => {
  const slot = X.root() && X.root().querySelector('.ne-status-slot'); if (!slot) return;
  const s = S().status(); slot.replaceChildren(h('span', { class: 'ne-status st-' + s, title: S().statusText(s) + (S().statusMsg() ? ' : ' + S().statusMsg() : ''), role: 'status' }, h('i'), h('span', {}, S().statusText(s))));
};
X.updateUndo = () => { const e = E(); if (!e) return; const r = X.root(); const u = r.querySelector('.ne-undo'), d = r.querySelector('.ne-redo'); if (u) u.disabled = !e.undo.length; if (d) d.disabled = !e.redo.length; };
async function renameNb() { const e = E(); const t = await U().prompt('Renommer le cahier', e.nb.title, { label: 'Titre' }); if (t) { N.setIdx('nbs', Object.assign({}, N.index().nbs[e.id], { title: t })); e.nb = N.index().nbs[e.id]; X.renderTop(); } }
X.onPageChange = () => { const e = E(); if (!e) return; const b = X.root().querySelector('.ne-acts [aria-label$="signet"]'); const cur = e.pages.find((p) => p.id === e.cur); if (b) { b.classList.toggle('on', !!(cur && cur.bm)); b.setAttribute('aria-label', cur && cur.bm ? 'Retirer le signet' : 'Ajouter un signet'); } markThumbCur(); };
X.onOpen = () => { const side = X.root().querySelector('.ne-side'); if (!side.hidden) renderSide(); closeZw(); };

/* ================= Barre d'outils ================= */
const TOOLS = [['pen', 'Stylo', 'pen'], ['hl', 'Surligneur', 'hl'], ['eraser', 'Gomme', 'eraser'], ['lasso', 'Lasso', 'lasso'], ['shape', 'Formes', 'shape'], ['text', 'Texte', 'text'], ['tape', 'Ruban', 'tape'], ['laser', 'Pointeur laser', 'laser']];
const SIZE_LABEL = ['Fin', 'Moyen', 'Épais'];
X.renderTools = () => {
  const e = E(); if (!e) return; const bar = X.root().querySelector('.ne-tools');
  if (e.readonly) {
    bar.replaceChildren(h('div', { class: 'ne-ro' }, ico('readonly'), h('span', {}, 'Lecture seule'), h('button', { class: 'btn', type: 'button', onclick: () => { N.setIdx('nbs', Object.assign({}, N.index().nbs[e.id], { readonly: false })); e.readonly = false; e.nb = N.index().nbs[e.id]; X.renderTop(); X.renderTools(); } }, 'Modifier'),
      tool('laser', 'Pointeur laser', 'laser')));
    return;
  }
  const t = X.TP.tool, cfg = X.toolCfg(t);
  // 1re ligne : les outils (pastille = couleur actuelle de l'outil)
  const insertMenu = (ev) => U().menu(ev.currentTarget, [
    { label: 'Image ou photo', icon: 'image', onclick: () => X.insertImageMenu(X.root().querySelector('.ne-addbtn')) },
    { label: 'Éléments', icon: 'sticker', onclick: () => elementsPanel() },
    { label: e.zw ? 'Fermer la fenêtre de zoom' : 'Fenêtre de zoom', icon: 'zoomwin', onclick: () => toggleZw() },
    '-',
    { label: 'Remettre la barre en haut', icon: 'fit', onclick: () => { X.TP.bar = { fx: .5, fy: 0, vert: false }; X.saveTP(); X.renderTools(); } }
  ]);
  const quick = [];
  if (cfg.sizes) quick.push(h('span', { class: 'ne-sep', 'aria-hidden': 'true' }), h('div', { class: 'ne-qsizes' }));
  if (cfg.color) quick.push(h('div', { class: 'ne-qcolors' }));
  const row = h('div', { class: 'ne-trow', role: 'group', 'aria-label': 'Outils' },
    h('button', { class: 'ne-grip', type: 'button', 'aria-label': 'Déplacer la barre d’outils (glisser), toucher deux fois pour la remettre en haut', title: 'Glisser pour déplacer' }, ico('grip')),
    TOOLS.map(([k, l, ic]) => tool(k, l, ic)),
    ib('plus', 'Insérer : image, élément, fenêtre de zoom', insertMenu, { class: 'nb-ib ne-addbtn' + (e.zw ? ' on' : '') }),
    quick,
    ib(X.TP.inspOpen ? 'chevdown' : 'more', X.TP.inspOpen ? 'Masquer les réglages de l’outil' : 'Afficher tous les réglages de l’outil', () => { X.TP.inspOpen = !X.TP.inspOpen; X.saveTP(); X.renderTools(); }, { class: 'nb-ib ne-qmore' + (X.TP.inspOpen ? ' on' : ''), 'aria-expanded': String(!!X.TP.inspOpen) }));
  // 2e ligne : l'inspecteur de l'outil actif (maquette Claude Design « Barre d'outils »)
  const insp = h('div', { class: 'ne-insp', role: 'group', 'aria-label': 'Réglages de l’outil' });
  const sep = () => h('span', { class: 'ne-isep', 'aria-hidden': 'true' });
  const seg = (key, list, lbl, onSet) => h('div', { class: 'seg ne-iseg', role: 'group', 'aria-label': lbl }, list.map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(cfg[key] === k), onclick: () => { cfg[key] = k; X.saveTP(); onSet && onSet(k); X.renderTools(); } }, l)));
  const chip = (on, label, onclick, extra = {}) => h('button', Object.assign({ class: 'ne-ichip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on == null ? null : String(!!on), onclick }, extra), label);
  const sizes = () => h('div', { class: 'ne-sizes', role: 'group', 'aria-label': 'Épaisseur' }, cfg.sizes.map((sz, i) => {
    let mark;
    if (t === 'eraser') { const d = clamp(sz * .55 + 5, 7, 24); mark = h('i', { class: 'ring', style: `width:${d}px;height:${d}px` }); }
    else { const th = t === 'hl' ? clamp(sz * .45, 4, 14) : t === 'tape' ? clamp(sz * .4, 4, 12) : clamp(sz * 1.7, 2, 11); mark = h('i', { class: 'bar' + (t === 'hl' ? ' hl' : ''), style: `height:${th}px;--c:${cfg.color || 'currentColor'}` }); }
    return h('button', { class: 'ne-size' + (cfg.si === i ? ' on' : ''), type: 'button', 'aria-label': `Épaisseur ${SIZE_LABEL[i].toLowerCase()} (${sz} pt)`, 'aria-pressed': String(cfg.si === i), title: `${SIZE_LABEL[i]} · ${sz} pt (touche à nouveau pour régler)`, onclick: () => { if (cfg.si === i) toolOptions(); else { cfg.si = i; X.saveTP(); X.renderTools(); } } }, mark);
  }));
  const colors = () => {
    const pal = t === 'hl' ? X.HLC : t === 'tape' ? X.TAPEC : X.PENC;
    const sw = (c, fav) => h('button', { class: 'ne-color' + (cfg.color.toLowerCase() === c.toLowerCase() ? ' on' : ''), type: 'button', style: `--c:${c}`, 'aria-label': `Couleur ${c}${fav ? ' (favorite, clic droit pour retirer)' : ''}`, 'aria-pressed': String(cfg.color.toLowerCase() === c.toLowerCase()), title: c, onclick: () => { cfg.color = c; X.saveTP(); X.renderTools(); }, oncontextmenu: fav ? (ev) => { ev.preventDefault(); X.TP.favColors = X.TP.favColors.filter((x) => x !== c); X.saveTP(); X.renderTools(); } : null });
    const custom = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cfg.color) ? cfg.color : '#000000', 'aria-label': 'Couleur personnalisée', class: 'ne-colorinp', onchange: (ev) => { cfg.color = ev.target.value; X.saveTP(); X.renderTools(); } });
    const isCustom = !pal.concat(X.TP.favColors).some((c) => c.toLowerCase() === cfg.color.toLowerCase());
    return h('div', { class: 'ne-colors', role: 'group', 'aria-label': 'Couleur' }, pal.map((c) => sw(c)), X.TP.favColors.filter((c) => !pal.includes(c)).map((c) => sw(c, true)),
      h('label', { class: 'ne-color custom' + (isCustom ? ' on' : ''), title: 'Couleur personnalisée', style: isCustom ? `--c:${cfg.color}` : '' }, custom));
  };
  const hint = (txt) => h('span', { class: 'ne-hint' }, txt);
  if (t === 'pen') insp.append(seg('pen', [['fountain', 'Plume'], ['ball', 'Bille'], ['brush', 'Pinceau']], 'Type de stylo'), sep(), sizes(), sep(), colors());
  else if (t === 'hl') insp.append(chip(cfg.straight, 'Trait droit', () => { cfg.straight = !cfg.straight; X.saveTP(); X.renderTools(); }), sep(), sizes(), sep(), colors());
  else if (t === 'eraser') insp.append(seg('mode', [['stroke', 'Trait entier'], ['partial', 'Partielle'], ['hl', 'Surligneur']], 'Type de gomme'), sep(), sizes(), sep(), chip(null, 'Effacer la page', () => clearPage(), { class: 'ne-ichip danger' }));
  else if (t === 'shape') insp.append(seg('kind', [['auto', 'Auto'], ['line', 'Ligne'], ['arrow', 'Flèche'], ['rect', 'Rect.'], ['ellipse', 'Ellipse'], ['tri', 'Tri.']], 'Forme'), sep(), chip(cfg.fill, 'Remplir', () => { cfg.fill = !cfg.fill; X.saveTP(); X.renderTools(); }), sep(), sizes(), sep(), colors());
  else if (t === 'text') insp.append(seg('font', [['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Machine']], 'Police'), sep(),
    h('button', { class: 'ne-ichip', type: 'button', 'aria-label': 'Texte plus petit', onclick: () => { cfg.fs = Math.max(6, cfg.fs - 2); X.saveTP(); X.renderTools(); } }, 'A−'), h('span', { class: 'ne-hint num' }, cfg.fs + ' pt'),
    h('button', { class: 'ne-ichip', type: 'button', 'aria-label': 'Texte plus grand', onclick: () => { cfg.fs = Math.min(96, cfg.fs + 2); X.saveTP(); X.renderTools(); } }, 'A+'),
    chip(cfg.bold, h('b', {}, 'G'), () => { cfg.bold = !cfg.bold; X.saveTP(); X.renderTools(); }, { 'aria-label': 'Gras' }),
    chip(cfg.italic, h('i', { style: 'font-family:Georgia,serif;font-weight:700' }, 'I'), () => { cfg.italic = !cfg.italic; X.saveTP(); X.renderTools(); }, { 'aria-label': 'Italique' }), sep(), colors());
  else if (t === 'tape') insp.append(sizes(), sep(), colors(), sep(), chip(null, 'Tout révéler', () => setAllTapes(true)), chip(null, 'Tout masquer', () => setAllTapes(false)));
  else if (t === 'lasso') insp.append(hint(e.sel ? `${e.sel.ids.length} élément${e.sel.ids.length > 1 ? 's' : ''} sélectionné${e.sel.ids.length > 1 ? 's' : ''}` : 'Entoure ce que tu veux déplacer, modifier ou copier'),
    sep(), chip(null, 'Tout sélectionner', () => X.selectItems(e.cur, X.itemsOf(e.cur).map((i) => i.id))), X.hasClip() ? chip(null, 'Coller', () => X.paste()) : null);
  else if (t === 'laser') insp.append(hint('Le trait rouge s’efface tout seul'), sep(), chip(null, 'Présentation', () => enterPresent()));
  const presets = X.TP.presets || [];
  if (presets.length && ['pen', 'hl', 'shape'].includes(t)) insp.append(sep(), h('div', { class: 'ne-presets', role: 'group', 'aria-label': 'Outils favoris' }, presets.map((p, i) => h('button', { class: 'ne-preset', type: 'button', style: `--c:${p.color}`, 'aria-label': `Outil favori : ${p.label}`, title: p.label + ' (clic droit pour retirer)', onclick: () => applyPreset(p), oncontextmenu: (ev) => { ev.preventDefault(); X.TP.presets.splice(i, 1); X.saveTP(); X.renderTools(); } }, ico(p.tool === 'hl' ? 'hl' : p.tool === 'shape' ? 'shape' : 'pen'), h('i')))));
  insp.append(ib('more', 'Plus de réglages pour cet outil', () => toolOptions(), { class: 'nb-ib ne-optbtn' }));
  // réglages rapides dans la barre compacte : 3 épaisseurs + 3 couleurs
  const qs = row.querySelector('.ne-qsizes'); if (qs) qs.replaceWith(Object.assign(sizes(), { className: 'ne-sizes ne-qsizes' }));
  const qc = row.querySelector('.ne-qcolors');
  if (qc) {
    const pal = (t === 'hl' ? X.HLC : t === 'tape' ? X.TAPEC : X.PENC).slice(0, 3);
    if (!pal.some((c) => c.toLowerCase() === cfg.color.toLowerCase())) pal[2] = cfg.color;
    qc.replaceChildren(...pal.map((c) => h('button', { class: 'ne-color' + (cfg.color.toLowerCase() === c.toLowerCase() ? ' on' : ''), type: 'button', style: `--c:${c}`, 'aria-label': `Couleur ${c}`, 'aria-pressed': String(cfg.color.toLowerCase() === c.toLowerCase()), onclick: () => { cfg.color = c; X.saveTP(); X.renderTools(); } })));
  }
  const pos = X.TP.bar || { fx: .5, fy: 0, vert: false };
  const card = h('div', { class: 'ne-tcard' + (pos.vert ? ' vert' : '') + (pos.fx > .5 ? ' right' : '') + (X.TP.inspOpen ? ' open' : '') }, row, X.TP.inspOpen ? insp : null);
  bar.replaceChildren(card);
  placeBar(card);
  dragBar(card);
};
function tool(k, l, ic) {
  const on = X.TP.tool === k, c = X.TP[k] && X.TP[k].color;
  return h('button', { class: 'ne-tool' + (on ? ' on' : ''), type: 'button', 'aria-label': l, title: l, 'aria-pressed': String(on), onclick: () => { if (on && k !== 'laser') { X.TP.inspOpen = !X.TP.inspOpen; X.saveTP(); X.renderTools(); } else X.setTool(k); } },
    ico(ic), h('span', { class: 'ne-pill', style: c && k !== 'laser' ? `--c:${c}` : '', 'aria-hidden': 'true' }));
}
// Barre flottante : position en fraction de la zone de travail, déplaçable au doigt / stylet / souris
function placeBar(card) {
  const rootR = X.root().getBoundingClientRect(), b = X.root().querySelector('.ne-scroll').getBoundingClientRect();
  const pos = X.TP.bar || { fx: .5, fy: 0, vert: false };
  const cw = card.offsetWidth, ch = card.offsetHeight, m = 8;
  const left = b.left - rootR.left + m + clamp(pos.fx, 0, 1) * Math.max(0, b.width - cw - 2 * m);
  const top = b.top - rootR.top + m + clamp(pos.fy, 0, 1) * Math.max(0, b.height - ch - 2 * m);
  card.style.left = left + 'px'; card.style.top = top + 'px';
}
X.placeBar = () => { const c = X.root() && X.root().querySelector('.ne-tcard'); if (c) placeBar(c); };
function dragBar(card) {
  const grip = card.querySelector('.ne-grip'); let lastTap = 0;
  const start = (ev) => {
    if (ev.target.closest('button:not(.ne-grip), input, label, .ne-insp')) return;
    ev.preventDefault(); try { card.setPointerCapture(ev.pointerId); } catch (_) {}
    const rootR = X.root().getBoundingClientRect(), b = X.root().querySelector('.ne-scroll').getBoundingClientRect();
    const sx = ev.clientX, sy = ev.clientY, l0 = parseFloat(card.style.left) || 0, t0 = parseFloat(card.style.top) || 0; let moved = false;
    card.classList.add('dragging');
    const mv = (m) => {
      const dx = m.clientX - sx, dy = m.clientY - sy; if (Math.hypot(dx, dy) > 4) moved = true;
      card.style.left = clamp(l0 + dx, b.left - rootR.left, b.right - rootR.left - card.offsetWidth) + 'px';
      card.style.top = clamp(t0 + dy, b.top - rootR.top, b.bottom - rootR.top - card.offsetHeight) + 'px';
    };
    const up = (u) => {
      card.removeEventListener('pointermove', mv); card.removeEventListener('pointerup', up); card.removeEventListener('pointercancel', up); card.classList.remove('dragging');
      if (!moved) { const t = performance.now(); if (t - lastTap < 350) { X.TP.bar = { fx: .5, fy: 0, vert: false }; X.saveTP(); X.renderTools(); } lastTap = t; return; }
      const m = 8, cw = card.offsetWidth, chh = card.offsetHeight;
      const left = parseFloat(card.style.left) - (b.left - rootR.left) - m, top = parseFloat(card.style.top) - (b.top - rootR.top) - m;
      // posé contre un bord gauche/droit : barre verticale ; sinon horizontale
      const nearSide = u.clientX < b.left + 70 ? 0 : u.clientX > b.right - 70 ? 1 : null;
      const vert = innerWidth >= 700 && nearSide !== null;
      const fx = vert ? nearSide : clamp(left / Math.max(1, b.width - cw - 2 * m), 0, 1);
      const fy = clamp(top / Math.max(1, b.height - chh - 2 * m), 0, 1);
      X.TP.bar = { fx, fy, vert }; X.saveTP(); X.renderTools();
    };
    card.addEventListener('pointermove', mv); card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
  };
  card.addEventListener('pointerdown', start);
  void grip;
}
function applyPreset(p) { const c = X.TP[p.tool]; Object.assign(c, { color: p.color }); if (p.pen) c.pen = p.pen; if (c.sizes) { c.sizes[c.si] = p.size; } X.TP.tool = p.tool; X.saveTP(); X.setTool(p.tool); }
function toolOptions() {
  const t = X.TP.tool, cfg = X.toolCfg(t);
  const body = h('div', { class: 'nb-form' });
  const draw = () => {
    body.replaceChildren();
    const seg = (key, list, lbl) => h('div', { class: 'nb-field' }, h('span', {}, lbl), h('div', { class: 'seg', role: 'group', 'aria-label': lbl, style: `grid-template-columns:repeat(${list.length},minmax(0,1fr))` }, list.map(([k, tx]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(cfg[key] === k), onclick: () => { cfg[key] = k; X.saveTP(); draw(); X.renderTools(); } }, tx))));
    const tog = (key, lbl) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: cfg[key] ? true : null, onchange: (ev) => { cfg[key] = ev.target.checked; X.saveTP(); X.renderTools(); } }), lbl);
    if (t === 'lasso') body.append(h('p', { class: 'muted' }, 'Entoure ce que tu veux modifier. Touche une image ou un texte pour le sélectionner directement. Ensuite : glisse pour déplacer, poignées pour agrandir ou pivoter. Au clavier : Ctrl/Cmd + A, C, X, V, D, Suppr.'));
    if (t === 'laser') body.append(h('p', { class: 'muted' }, 'Le trait rouge s’efface tout seul : idéal en présentation.'));
    if (t === 'pen') body.append(seg('pen', [['fountain', 'Plume'], ['ball', 'Bille'], ['brush', 'Pinceau']], 'Type de stylo'));
    if (t === 'pen') body.append(h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: X.TP.scribble !== false ? true : null, onchange: (ev) => { X.TP.scribble = ev.target.checked; X.saveTP(); } }), 'Hachurer pour effacer (gribouille sur une écriture pour la supprimer)'));
    if (t === 'hl') body.append(tog('straight', 'Trait droit (tu peux aussi maintenir à la fin du trait)'));
    if (t === 'eraser') body.append(seg('mode', [['stroke', 'Trait entier'], ['partial', 'Partielle'], ['hl', 'Surligneur seulement']], 'Gomme'),
      h('button', { class: 'btn danger', type: 'button', onclick: () => { d.close(); clearPage(); } }, 'Effacer toute la page'));
    if (t === 'shape') body.append(seg('kind', [['auto', 'Auto'], ['line', 'Ligne'], ['arrow', 'Flèche'], ['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['tri', 'Triangle']], 'Forme'), tog('fill', 'Remplissage'),
      h('p', { class: 'muted small' }, 'Astuce : avec le stylo, maintiens la pointe à la fin du trait pour obtenir une forme propre.'));
    if (t === 'text') body.append(seg('font', [['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Machine']], 'Police'),
      h('label', { class: 'nb-field' }, h('span', {}, `Taille : ${cfg.fs} pt`), h('input', { type: 'range', min: 8, max: 72, step: 1, value: cfg.fs, 'aria-label': 'Taille du texte', oninput: (ev) => { cfg.fs = +ev.target.value; X.saveTP(); ev.target.previousSibling.textContent = `Taille : ${cfg.fs} pt`; } })),
      tog('bold', 'Gras'), tog('italic', 'Italique'));
    if (t === 'tape') body.append(h('div', { class: 'nb-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => { setAllTapes(true); d.close(); } }, ico('revealall'), 'Tout révéler'), h('button', { class: 'btn', type: 'button', onclick: () => { setAllTapes(false); d.close(); } }, 'Tout masquer')),
      h('p', { class: 'muted small' }, 'Pose un ruban sur une réponse pour la cacher. Touche-le pour révéler ou cacher.'));
    if (cfg.sizes) body.append(h('div', { class: 'nb-field' }, h('span', {}, 'Épaisseurs'), ...cfg.sizes.map((s, i) => h('label', { class: 'ne-slider' }, h('span', {}, `${SIZE_LABEL[i]} : ${s} pt`),
      h('input', { type: 'range', min: t === 'hl' || t === 'tape' || t === 'eraser' ? 3 : .4, max: t === 'hl' || t === 'tape' ? 40 : t === 'eraser' ? 60 : 12, step: t === 'hl' || t === 'tape' || t === 'eraser' ? 1 : .1, value: s, 'aria-label': `Épaisseur ${SIZE_LABEL[i]}`, oninput: (ev) => { cfg.sizes[i] = +ev.target.value; X.saveTP(); ev.target.previousSibling.textContent = `${SIZE_LABEL[i]} : ${cfg.sizes[i]} pt`; X.renderTools(); } })))));
    if (cfg.color) body.append(h('div', { class: 'nb-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => { if (!X.TP.favColors.includes(cfg.color)) X.TP.favColors.push(cfg.color); X.saveTP(); X.renderTools(); U().toast('Couleur ajoutée aux favoris'); } }, ico('star'), 'Couleur en favori'),
      ['pen', 'hl', 'shape'].includes(t) ? h('button', { class: 'btn', type: 'button', onclick: () => { X.TP.presets = X.TP.presets || []; X.TP.presets.push({ tool: t, color: cfg.color, size: X.curSize(t), pen: cfg.pen, label: `${t === 'pen' ? { fountain: 'Plume', ball: 'Bille', brush: 'Pinceau' }[cfg.pen] : t === 'hl' ? 'Surligneur' : 'Forme'} ${X.curSize(t)} pt` }); X.saveTP(); X.renderTools(); U().toast('Ajouté aux outils favoris'); } }, ico('plus'), 'Outil favori') : null));
    body.append(h('div', { class: 'nb-field' }, h('span', {}, 'Double-tap (deux touches rapides du doigt sur la page)'),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Double-tap', style: 'grid-template-columns:repeat(3,minmax(0,1fr))' }, [['eraser', 'Gomme ↔ outil'], ['prev', 'Outil précédent'], ['off', 'Désactivé']].map(([k, tx]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String((X.TP.dblTap || 'eraser') === k), onclick: () => { X.TP.dblTap = k; X.saveTP(); draw(); } }, tx))),
      h('span', { class: 'muted small', style: 'font-weight:400' }, 'Le double-tap du Pencil lui-même n’est pas transmis aux sites web par Safari : fais-le avec le doigt sur la page. Stylet avec bout gomme ou bouton (PC) : il gomme directement. Clavier : touche G.')));
    body.append(h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: X.TP.fingerDraw ? true : null, onchange: (ev) => { X.TP.fingerDraw = ev.target.checked; X.saveTP(); } }), 'Dessiner au doigt (sinon le doigt fait défiler et zoomer)'));
  };
  draw();
  const d = U().dialog({ title: { pen: 'Stylo', hl: 'Surligneur', eraser: 'Gomme', lasso: 'Lasso', shape: 'Formes', text: 'Texte', tape: 'Ruban', laser: 'Pointeur laser' }[t] || 'Outil', body });
}
function clearPage() {
  const e = E(); const pid = e.cur; const items = X.itemsOf(pid); if (!items.length) return;
  X.commit(items.map((it) => ({ pid, coll: 'items', id: it.id, before: it, after: null }))); U().toast('Page effacée (Annuler pour revenir)');
}
function setAllTapes(open) {
  const e = E(); const ch = [];
  for (const pg of e.pages) for (const it of X.itemsOf(pg.id)) if (it.type === 'tp' && !!it.open !== open) { const a = Object.assign({}, it, { open }); delete a.t; delete a.d; ch.push({ pid: pg.id, coll: 'items', id: it.id, before: it, after: a }); }
  if (ch.length) X.commit(ch);
}

/* ================= Sélection (lasso) ================= */
let clip = null;
X.hasClip = () => !!clip;
function selBox(pid, ids) {
  const items = X.itemsOf(pid).filter((it) => ids.includes(it.id)); if (!items.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  items.forEach((it) => { const b = R().bbox(it); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
  const p = 3; return { x: x0 - p, y: y0 - p, w: x1 - x0 + 2 * p, h: y1 - y0 + 2 * p };
}
X.selectItems = (pid, ids) => {
  const e = E(); X.clearSel(true);
  ids = ids.filter((id) => X.itemsOf(pid).some((it) => it.id === id)); if (!ids.length) { X.renderTools(); return; }
  e.sel = { pid, ids, box: selBox(pid, ids) };
  drawSel(); X.renderTools();
};
X.clearSel = (quiet) => {
  const e = E(); if (!e) return;
  document.querySelectorAll('.ne-sel, .ne-selbar, .ne-crop').forEach((x) => x.remove());
  if (e.sel) { e.sel = null; if (!quiet) X.renderTools(); }
};
X.selContains = (p) => { const b = E().sel.box, m = 6 / E().scale; return p.x >= b.x - m && p.y >= b.y - m && p.x <= b.x + b.w + m && p.y <= b.y + b.h + m; };
function drawSel() {
  const e = E(); document.querySelectorAll('.ne-sel, .ne-selbar').forEach((x) => x.remove()); if (!e.sel) return;
  const pv = e.pvs.get(e.sel.pid), pg = pv.pg, b = e.sel.box;
  const handle = (mode, cls, label) => h('button', { class: 'ne-ovl ne-h ' + cls, type: 'button', 'aria-label': label, onpointerdown: (ev) => startHandle(ev, mode, cls) });
  const box = h('div', { class: 'ne-sel', style: `left:${b.x / pg.w * 100}%;top:${b.y / pg.h * 100}%;width:${b.w / pg.w * 100}%;height:${b.h / pg.h * 100}%` },
    handle('scale', 'tl', 'Redimensionner'), handle('scale', 'tr', 'Redimensionner'), handle('scale', 'bl', 'Redimensionner'), handle('scale', 'br', 'Redimensionner'), handle('rotate', 'rot', 'Pivoter'));
  pv.el.append(box);
  const items = X.itemsOf(e.sel.pid).filter((it) => e.sel.ids.includes(it.id));
  const one = items.length === 1 ? items[0] : null;
  const bar = h('div', { class: 'ne-selbar ne-ovl', role: 'toolbar', 'aria-label': 'Actions sur la sélection' },
    tb('palette', 'Couleur', (ev) => colorMenu(ev.currentTarget)),
    tb('copy', 'Copier', () => { X.selCopy(); U().toast('Copié'); }),
    tb('cut', 'Couper', () => { X.selCopy(); X.selDelete(); }),
    tb('dup', 'Dupliquer', () => X.selDuplicate()),
    one && one.type === 'tx' ? tb('text', 'Modifier', () => { const it = one; X.clearSel(); X.openText(pv, it); }) : null,
    one && one.type === 'im' ? tb('crop', 'Rogner', () => cropImage(pv, one)) : null,
    one && (one.type === 'im' || one.type === 'tx') ? tb('rotate', 'Pivoter 90°', () => rotate90()) : null,
    tb('sticker', 'Élément', () => saveElement()),
    tb('cards', 'Carte', () => selToCard()),
    tb('link', 'Lien', () => makeLink()),
    tb('trash', 'Supprimer', () => X.selDelete(), { class: 'ne-tb danger' }));
  X.root().querySelector('.ne-body').append(bar);
}
function startHandle(ev, mode, cls) {
  ev.preventDefault(); ev.stopPropagation();
  const e = E(), b = e.sel.box;
  const anchor = { tl: { x: b.x + b.w, y: b.y + b.h }, tr: { x: b.x, y: b.y + b.h }, bl: { x: b.x + b.w, y: b.y }, br: { x: b.x, y: b.y } }[cls];
  X.beginGesture(ev, { kind: 'xform', mode, anchor, center: { x: b.x + b.w / 2, y: b.y + b.h / 2 } });
}
X.xformStart = (g) => {
  const e = E(); const doc = X.itemsOf(e.sel.pid);
  g.items = doc.filter((it) => e.sel.ids.includes(it.id)); g.m = [1, 0, 0, 1, 0, 0]; g.box = e.sel.box;
  if (!g.anchor) g.anchor = { x: g.box.x, y: g.box.y }; if (!g.center) g.center = { x: g.box.x + g.box.w / 2, y: g.box.y + g.box.h / 2 };
  g.sorted = R().sortItems(g.items.slice());
  e.sel.ids.forEach((id) => e.hide.add(id)); X.rerender(e.sel.pid);
  document.querySelectorAll('.ne-sel').forEach((x) => x.classList.add('drag'));
};
X.xformMove = (g, p) => {
  if (g.mode === 'move') g.m = [1, 0, 0, 1, p.x - g.sx, p.y - g.sy];
  else if (g.mode === 'scale') { const a = g.anchor, d0 = Math.hypot(g.sx - a.x, g.sy - a.y) || 1, s = clamp(Math.hypot(p.x - a.x, p.y - a.y) / d0, .05, 30); g.m = [s, 0, 0, s, a.x - s * a.x, a.y - s * a.y]; }
  else if (g.mode === 'rotate') {
    const c = g.center; let th = Math.atan2(p.y - c.y, p.x - c.x) - Math.atan2(g.sy - c.y, g.sx - c.x);
    const deg = th * 180 / Math.PI, snap = Math.round(deg / 45) * 45; if (Math.abs(deg - snap) < 4) th = snap * Math.PI / 180;
    const co = Math.cos(th), si = Math.sin(th); g.m = [co, si, -si, co, c.x - co * c.x + si * c.y, c.y - si * c.x - co * c.y];
  }
};
X.xformDraw = (g, ctx) => {
  ctx.save(); ctx.transform(...g.m); R().drawItems(ctx, g.sorted, g.pv.pg, { forceTape: true });
  ctx.strokeStyle = '#2c5bb8'; ctx.lineWidth = 1.2 / E().scale / Math.sqrt(Math.abs(g.m[0] * g.m[3] - g.m[1] * g.m[2])); ctx.setLineDash([4 / E().scale, 3 / E().scale]); ctx.strokeRect(g.box.x, g.box.y, g.box.w, g.box.h); ctx.restore();
};
X.xformEnd = (g) => {
  const e = E(); e.hide.clear();
  const ident = Math.abs(g.m[0] - 1) < 1e-6 && Math.abs(g.m[1]) < 1e-6 && Math.abs(g.m[4]) < .05 && Math.abs(g.m[5]) < .05;
  if (!ident) X.commit(g.items.map((it) => ({ pid: g.pv.id, coll: 'items', id: it.id, before: it, after: R().transformItem(it, g.m) })));
  else X.rerender(g.pv.id);
  X.selectItems(g.pv.id, g.items.map((i) => i.id));
};
X.xformAbort = (g) => { E().hide.clear(); X.rerender(g.pv.id); drawSel(); };
X.finishLasso = (g) => {
  const pv = g.pv, poly = g.poly; let ids;
  let w = 0; for (let i = 2; i < poly.length; i += 2) w += Math.hypot(poly[i] - poly[i - 2], poly[i + 1] - poly[i - 1]);
  if (w * E().scale < 10) { const hit = X.itemsOf(pv.id).slice().reverse().find((it) => R().hit(it, g.sx, g.sy, 6 / E().scale)); ids = hit ? [hit.id] : []; }
  else ids = X.itemsOf(pv.id).filter((it) => R().inLasso(it, poly)).map((it) => it.id);
  if (ids.length) X.selectItems(pv.id, ids); else X.renderTools();
};
const selItems = () => { const e = E(); return X.itemsOf(e.sel.pid).filter((it) => e.sel.ids.includes(it.id)); };
X.selCopy = () => { const e = E(); if (!e.sel) return; clip = { items: JSON.parse(JSON.stringify(selItems())), box: Object.assign({}, e.sel.box), pid: e.sel.pid, n: 0 }; };
X.selDelete = () => { const e = E(); if (!e.sel) return; const pid = e.sel.pid; const ch = selItems().map((it) => ({ pid, coll: 'items', id: it.id, before: it, after: null })); X.clearSel(); X.commit(ch); };
X.selDuplicate = () => { const e = E(); if (!e.sel) return; const items = JSON.parse(JSON.stringify(selItems())); insertItems(e.sel.pid, items, 16, 16); };
X.paste = () => {
  const e = E(); if (!clip || !X.canEdit()) return; clip.n++;
  const pid = e.cur, pg = X.pgOf(pid); let dx = 0, dy = 0;
  if (pid === clip.pid) { dx = dy = 16 * clip.n; }
  else { const vc = viewCenter(pid); dx = vc.x - (clip.box.x + clip.box.w / 2); dy = vc.y - (clip.box.y + clip.box.h / 2); }
  dx = clamp(dx, -clip.box.x, pg.w - clip.box.x - clip.box.w); dy = clamp(dy, -clip.box.y, pg.h - clip.box.y - clip.box.h);
  insertItems(pid, JSON.parse(JSON.stringify(clip.items)), dx, dy);
};
function insertItems(pid, items, dx, dy) {
  const m = [1, 0, 0, 1, dx, dy], z0 = Date.now();
  const out = items.map((it, i) => { const n = R().transformItem(it, m); n.id = S().uid('i'); n.z = z0 + i; n.c = Date.now(); delete n.t; delete n.d; return n; });
  X.commit(out.map((it) => ({ pid, coll: 'items', id: it.id, before: null, after: it })));
  X.setTool('lasso'); X.selectItems(pid, out.map((i) => i.id));
}
X.insertItems = insertItems;
function viewCenter(pid) {
  const e = E(), pv = e.pvs.get(pid), sc = e.sc;
  return { x: clamp((sc.scrollLeft + sc.clientWidth / 2 - pv.ox) / e.scale, 20, pv.pg.w - 20), y: clamp((sc.scrollTop + sc.clientHeight / 2 - pv.oy) / e.scale, 20, pv.pg.h - 20) };
}
X.viewCenter = viewCenter;
function colorMenu(anchor) {
  const cols = X.PENC.concat(X.HLC.slice(0, 3)).concat(X.TP.favColors || []);
  const set = (c) => { const e = E(); const pid = e.sel.pid; const ch = selItems().filter((it) => it.color).map((it) => { const a = Object.assign({}, it, { color: c }); delete a.t; delete a.d; return { pid, coll: 'items', id: it.id, before: it, after: a }; }); if (ch.length) X.commit(ch); X.selectItems(pid, e.sel.ids); };
  const m = U().menu(anchor, [{ label: 'Couleur personnalisée…', icon: 'palette', onclick: () => { const inp = h('input', { type: 'color', style: 'position:fixed;left:-99px' }); document.body.append(inp); inp.addEventListener('change', () => { set(inp.value); inp.remove(); }); inp.click(); } }]);
  m.prepend(h('div', { class: 'ne-menucolors' }, cols.map((c) => h('button', { class: 'ne-color', type: 'button', style: `--c:${c}`, 'aria-label': `Couleur ${c}`, onclick: () => { U().closeMenus(); set(c); } }))));
}
function rotate90() {
  const e = E(); const pid = e.sel.pid, b = e.sel.box, c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const m = [0, 1, -1, 0, c.x + c.y, c.y - c.x];
  X.commit(selItems().map((it) => ({ pid, coll: 'items', id: it.id, before: it, after: R().transformItem(it, m) }))); X.selectItems(pid, e.sel.ids);
}
async function selToCard() {
  const e = E(); const pv = e.pvs.get(e.sel.pid), b = e.sel.box;
  const c = await R().renderPageImage(pv.pg, selItems(), Math.min(1200, Math.max(300, b.w * 3)), { x: b.x - 6, y: b.y - 6, w: b.w + 12, h: b.h + 12, forceTape: true });
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const sha = await S().blobPut(new Uint8Array(await blob.arrayBuffer()), 'image/png');
  N.cards.newCard({ img: sha, url: URL.createObjectURL(blob) }, e.id);
}
async function saveElement() {
  const e = E(); const name = await U().prompt('Enregistrer comme élément', 'Élément', { label: 'Nom de l’élément' }); if (name == null) return;
  const b = e.sel.box, m = [1, 0, 0, 1, -b.x, -b.y];
  const items = selItems().map((it) => { const n = R().transformItem(it, m); delete n.id; return n; });
  N.setIdx('elements', { id: S().uid('e'), name: name || 'Élément', items, w: b.w, h: b.h, created: Date.now() });
  U().toast('Élément enregistré : retrouve-le dans Éléments');
}
async function makeLink() {
  const e = E(); const pid = e.sel.pid, b = e.sel.box;
  const body = h('div', { class: 'nb-form' });
  const pageInp = h('input', { class: 'search', type: 'number', min: 1, max: e.pages.length, placeholder: `1 à ${e.pages.length}`, 'aria-label': 'Numéro de page' });
  const urlInp = h('input', { class: 'search', type: 'url', placeholder: 'https://…', 'aria-label': 'Adresse web' });
  body.append(h('label', { class: 'nb-field' }, h('span', {}, 'Vers la page'), pageInp), h('label', { class: 'nb-field' }, h('span', {}, 'Ou vers une adresse web'), urlInp),
    h('p', { class: 'muted small' }, 'Pour suivre un lien : touche-le avec le doigt, ou clique avec le lasso.'));
  U().dialog({ title: 'Créer un lien', body, actions: [{ label: 'Annuler', value: null }, { label: 'Créer', primary: true, onclick: (api) => {
    const n = parseInt(pageInp.value, 10), u = urlInp.value.trim();
    const it = { type: 'ln', x: b.x, y: b.y, w: b.w, h: b.h, rot: 0 };
    if (n >= 1 && n <= e.pages.length) it.page = e.pages[n - 1].id; else if (/^https?:\/\/\S+$/i.test(u)) it.href = u; else { pageInp.focus(); return; }
    const item = X.newItem(it); X.commit([{ pid, coll: 'items', id: item.id, before: null, after: item }]); api.close(); X.clearSel(); U().toast('Lien créé');
  } }] });
}
function cropImage(pv, it0) {
  const e = E(); X.clearSel();
  if (it0.rot) { U().toast('Remets l’image droite (Pivoter) avant de la rogner'); return; }
  const bmp = R().getImg(it0.blob); if (!bmp) { U().toast('Image pas encore chargée'); return; }
  let cur = Object.assign({}, it0, { crop: (it0.crop || [0, 0, 1, 1]).slice() });
  const pg = pv.pg;
  e.override = { [it0.id]: cur };
  const box = h('div', { class: 'ne-crop ne-ovl' });
  const place = () => { box.style.cssText = `left:${cur.x / pg.w * 100}%;top:${cur.y / pg.h * 100}%;width:${cur.w / pg.w * 100}%;height:${cur.h / pg.h * 100}%`; };
  const kx = () => cur.w / ((cur.crop[2] - cur.crop[0]) * bmp.width), ky = () => cur.h / ((cur.crop[3] - cur.crop[1]) * bmp.height);
  const edge = (side) => {
    const el = h('button', { class: 'ne-ovl ne-ch ' + side, type: 'button', 'aria-label': 'Rogner ' + { l: 'à gauche', r: 'à droite', t: 'en haut', b: 'en bas' }[side] });
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); ev.stopPropagation(); try { el.setPointerCapture(ev.pointerId); } catch (_) {}
      const sx = ev.clientX, sy = ev.clientY, start = JSON.parse(JSON.stringify(cur));
      const mv = (m) => {
        const dx = (m.clientX - sx) / e.scale, dy = (m.clientY - sy) / e.scale, n = JSON.parse(JSON.stringify(start)), fx = start.w / ((start.crop[2] - start.crop[0]) * bmp.width), fy = start.h / ((start.crop[3] - start.crop[1]) * bmp.height);
        if (side === 'l') { const c0 = clamp(start.crop[0] + dx / fx / bmp.width, 0, start.crop[2] - .05); const d = (c0 - start.crop[0]) * bmp.width * fx; n.crop[0] = c0; n.x = start.x + d; n.w = start.w - d; }
        if (side === 'r') { const c2 = clamp(start.crop[2] + dx / fx / bmp.width, start.crop[0] + .05, 1); n.crop[2] = c2; n.w = (c2 - start.crop[0]) * bmp.width * fx; }
        if (side === 't') { const c1 = clamp(start.crop[1] + dy / fy / bmp.height, 0, start.crop[3] - .05); const d = (c1 - start.crop[1]) * bmp.height * fy; n.crop[1] = c1; n.y = start.y + d; n.h = start.h - d; }
        if (side === 'b') { const c3 = clamp(start.crop[3] + dy / fy / bmp.height, start.crop[1] + .05, 1); n.crop[3] = c3; n.h = (c3 - start.crop[1]) * bmp.height * fy; }
        cur = n; e.override = { [it0.id]: cur }; place(); X.rerender(pv.id);
      };
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    return el;
  };
  void kx; void ky;
  box.append(edge('l'), edge('r'), edge('t'), edge('b')); place(); pv.el.append(box);
  const done = (ok) => { box.remove(); bar.remove(); e.override = null; if (ok && JSON.stringify(cur.crop) !== JSON.stringify(it0.crop || [0, 0, 1, 1])) { const a = Object.assign({}, cur); delete a.t; delete a.d; X.commit([{ pid: pv.id, coll: 'items', id: it0.id, before: it0, after: a }]); } else X.rerender(pv.id); };
  const bar = h('div', { class: 'ne-selbar ne-ovl', role: 'toolbar', 'aria-label': 'Rogner l’image' }, h('span', { class: 'ne-hint' }, 'Tire les bords pour rogner'),
    tb('undo', 'Réinitialiser', () => { cur = Object.assign({}, cur); const fx = cur.w / ((cur.crop[2] - cur.crop[0]) * bmp.width); cur.x -= cur.crop[0] * bmp.width * fx; cur.y -= cur.crop[1] * bmp.height * fx; cur.crop = [0, 0, 1, 1]; cur.w = bmp.width * fx; cur.h = bmp.height * fx; e.override = { [it0.id]: cur }; place(); X.rerender(pv.id); }),
    tb('close', 'Annuler', () => done(false)), tb('check', 'Terminé', () => done(true), { class: 'ne-tb solid' }));
  X.root().querySelector('.ne-body').append(bar);
  X.rerender(pv.id);
}

/* ================= Zone de texte ================= */
X.openText = (pv, item, x, y) => {
  const e = E(); if (!X.canEdit()) return;
  X.commitText();
  const cfg = X.TP.text, pg = pv.pg;
  const cur = item ? Object.assign({}, item) : { type: 'tx', x: clamp(x, 4, pg.w - 40), y: clamp(y - cfg.fs * .9, 4, pg.h - 20), w: Math.max(60, Math.min(280, pg.w - x - 16)), text: '', font: cfg.font, fs: cfg.fs, bold: cfg.bold, italic: cfg.italic, color: cfg.color, rot: 0 };
  if (cur.rot) cur.rot = 0;
  const ta = h('textarea', { class: 'ne-ovl ne-ta', 'aria-label': 'Texte', spellcheck: 'true', rows: 1 });
  ta.value = cur.text || '';
  const wh = h('button', { class: 'ne-ovl ne-ta-w', type: 'button', 'aria-label': 'Largeur de la zone de texte' });
  const mv = h('button', { class: 'ne-ovl ne-ta-mv', type: 'button', 'aria-label': 'Déplacer la zone de texte' }, ico('move'));
  const wrap = h('div', { class: 'ne-ovl ne-tawrap' }, ta, wh, mv);
  pv.el.append(wrap);
  e.textEd = { pv, item, cur, ta, wrap };
  if (item) { e.hide.add(item.id); X.rerender(pv.id); }
  const fit = () => { const s = e.scale; wrap.style.left = (cur.x / pg.w * 100) + '%'; wrap.style.top = (cur.y / pg.h * 100) + '%'; wrap.style.width = (cur.w / pg.w * 100) + '%'; ta.style.font = R().fontCss(Object.assign({}, cur, { fs: cur.fs * s })); ta.style.lineHeight = (cur.fs * 1.3 * s) + 'px'; ta.style.color = cur.color; ta.style.height = 'auto'; ta.style.height = Math.max(cur.fs * 1.3 * s, ta.scrollHeight) + 'px'; };
  e.textEd.fit = fit;
  ta.addEventListener('input', fit);
  ta.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); X.commitText(); } });
  const drag = (el, fn) => el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); try { el.setPointerCapture(ev.pointerId); } catch (_) {} const sx = ev.clientX, sy = ev.clientY, s0 = Object.assign({}, cur); const m = (q) => { fn(s0, (q.clientX - sx) / e.scale, (q.clientY - sy) / e.scale); fit(); }; const u = () => { el.removeEventListener('pointermove', m); el.removeEventListener('pointerup', u); ta.focus(); }; el.addEventListener('pointermove', m); el.addEventListener('pointerup', u); });
  drag(wh, (s0, dx) => { cur.w = clamp(s0.w + dx, 30, pg.w - cur.x); });
  drag(mv, (s0, dx, dy) => { cur.x = clamp(s0.x + dx, 0, pg.w - 20); cur.y = clamp(s0.y + dy, 0, pg.h - 10); });
  const setF = (k, v) => { cur[k] = v; Object.assign(X.TP.text, { [k]: v }); X.saveTP(); fit(); drawBar(); ta.focus(); };
  const bar = h('div', { class: 'ne-selbar ne-ovl ne-textbar', role: 'toolbar', 'aria-label': 'Mise en forme du texte' });
  const drawBar = () => bar.replaceChildren(
    h('div', { class: 'seg ne-seg' }, [['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Machine']].map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(cur.font === k), onclick: () => setF('font', k) }, l))),
    h('button', { class: 'ne-tb', type: 'button', 'aria-label': 'Plus petit', onclick: () => setF('fs', Math.max(6, cur.fs - 2)) }, h('b', {}, 'A−')),
    h('span', { class: 'ne-hint num' }, cur.fs + ' pt'),
    h('button', { class: 'ne-tb', type: 'button', 'aria-label': 'Plus grand', onclick: () => setF('fs', Math.min(96, cur.fs + 2)) }, h('b', {}, 'A+')),
    h('button', { class: 'ne-tb' + (cur.bold ? ' on' : ''), type: 'button', 'aria-label': 'Gras', 'aria-pressed': String(!!cur.bold), onclick: () => setF('bold', !cur.bold) }, h('b', {}, 'G')),
    h('button', { class: 'ne-tb' + (cur.italic ? ' on' : ''), type: 'button', 'aria-label': 'Italique', 'aria-pressed': String(!!cur.italic), onclick: () => setF('italic', !cur.italic) }, h('i', { style: 'font-family:Georgia,serif;font-weight:700' }, 'I')),
    h('div', { class: 'ne-colors' }, X.PENC.map((c) => h('button', { class: 'ne-color' + (cur.color === c ? ' on' : ''), type: 'button', style: `--c:${c}`, 'aria-label': `Couleur ${c}`, onclick: () => setF('color', c) }))),
    tb('trash', 'Supprimer', () => { ta.value = ''; X.commitText(); }, { class: 'ne-tb danger' }),
    tb('check', 'Terminé', () => X.commitText(), { class: 'ne-tb solid' }));
  drawBar(); e.textEd.bar = bar;
  bar.addEventListener('pointerdown', (ev) => { if (ev.target.closest('button')) ev.preventDefault(); });
  X.root().querySelector('.ne-body').append(bar);
  fit(); try { ta.focus({ preventScroll: true }); } catch (_) {} // synchrone : nécessaire pour le clavier sur iPad
  setTimeout(() => { if (document.activeElement !== ta && ta.isConnected) ta.focus({ preventScroll: true }); fit(); }, 20);
};
X.commitText = () => {
  const e = E(); if (!e || !e.textEd) return;
  const { pv, item, cur, ta, wrap, bar } = e.textEd; e.textEd = null;
  wrap.remove(); bar && bar.remove();
  if (item) e.hide.delete(item.id);
  cur.text = ta.value.replace(/\s+$/, '');
  const pid = pv.id;
  if (!cur.text) { if (item) X.commit([{ pid, coll: 'items', id: item.id, before: item, after: null }]); else X.rerender(pid); return; }
  const l = R().textLayout(Object.assign({}, cur)); cur.h = Math.round(l.h * 100) / 100;
  if (!item) { const it = X.newItem(cur); X.commit([{ pid, coll: 'items', id: it.id, before: null, after: it }]); }
  else { const a = Object.assign({}, cur); delete a.t; delete a.d; if (JSON.stringify([a.text, a.x, a.y, a.w, a.fs, a.font, a.bold, a.italic, a.color]) !== JSON.stringify([item.text, item.x, item.y, item.w, item.fs, item.font, item.bold, item.italic, item.color])) X.commit([{ pid, coll: 'items', id: item.id, before: item, after: a }]); else X.rerender(pid); }
};
X.positionOverlays = () => { const e = E(); if (e && e.textEd) e.textEd.fit(); };

/* ================= Images ================= */
X.insertImageMenu = (anchor) => {
  if (!X.canEdit()) return;
  const go = async (opts) => { const files = await N.pickFile('image/*', opts); if (files[0]) X.insertImageFile(files[0]); };
  const a = anchor || X.root().querySelector('[aria-label="Insérer une image"]');
  U().menu(a, [
    { label: 'Photothèque ou fichiers', icon: 'image', onclick: () => go({}) },
    { label: 'Appareil photo', icon: 'camera', onclick: () => go({ capture: 'environment' }) },
    { label: 'Importer des pages (PDF ou images)', icon: 'upload', onclick: () => importPages() }
  ]);
};
X.insertImageFile = async (file) => {
  const e = E(); if (!e) return;
  try {
    const im = await N.imageToJpeg(file, 2000); const sha = await S().blobPut(im.bytes, im.mime);
    const pid = e.cur, pg = X.pgOf(pid), c = viewCenter(pid);
    let w = Math.min(pg.w * .6, im.w * .5), hh = w * im.h / im.w; if (hh > pg.h * .6) { hh = pg.h * .6; w = hh * im.w / im.h; }
    const it = X.newItem({ type: 'im', blob: sha, x: Math.round(clamp(c.x - w / 2, 0, pg.w - w)), y: Math.round(clamp(c.y - hh / 2, 0, pg.h - hh)), w: Math.round(w * 100) / 100, h: Math.round(hh * 100) / 100, rot: 0 });
    X.commit([{ pid, coll: 'items', id: it.id, before: null, after: it }]);
    X.setTool('lasso'); X.selectItems(pid, [it.id]);
  } catch (err) { console.warn(err); U().toast('Image illisible'); }
};

/* ================= Pages ================= */
function toggleSide(force) {
  const side = X.root().querySelector('.ne-side'); side.hidden = force != null ? !force : !side.hidden;
  X.root().classList.toggle('side-open', !side.hidden);
  const b = X.root().querySelector('[aria-label="Pages"]'); if (b) b.setAttribute('aria-pressed', String(!side.hidden));
  if (!side.hidden) renderSide();
  setTimeout(() => { X.layout(); X.placeBar(); }, 0);
}
X.toggleSide = toggleSide;
X.closePanels = () => { const side = X.root().querySelector('.ne-side'); if (!side.hidden) { toggleSide(false); return true; } if (E().zw) { closeZw(); return true; } return false; };
const thumbs = new Map(); // pid -> { ver, url }
let thumbObs = null, sideFilter = 'all';
function renderSide() {
  const e = E(); const side = X.root().querySelector('.ne-side'); if (side.hidden) return;
  if (thumbObs) thumbObs.disconnect();
  thumbObs = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) drawThumb(en.target); }), { root: side, rootMargin: '300px 0px' });
  const go = h('input', { class: 'search ne-goto', type: 'number', min: 1, max: e.pages.length, placeholder: 'Aller à la page', 'aria-label': 'Aller à la page', onkeydown: (ev) => { if (ev.key === 'Enter') { const n = parseInt(ev.target.value, 10); if (n >= 1 && n <= e.pages.length) { X.goPage(e.pages[n - 1].id); if (narrow()) toggleSide(false); } } } });
  const list = h('div', { class: 'ne-thumbs', role: 'list' });
  e.pages.forEach((pg, i) => {
    if (sideFilter === 'bm' && !pg.bm) return;
    const t = h('div', { class: 'ne-thumb' + (pg.id === e.cur ? ' cur' : ''), role: 'listitem', 'data-id': pg.id },
      h('button', { class: 'ne-thumb-go', type: 'button', 'aria-label': `Aller à la page ${i + 1}${pg.bm ? ' : ' + pg.bm : ''}`, onclick: () => { X.goPage(pg.id); markThumbCur(); if (narrow()) toggleSide(false); } }, h('span', { class: 'ne-thumb-img', style: `aspect-ratio:${pg.w}/${pg.h}` }), pg.bm ? h('span', { class: 'ne-thumb-bm' }, ico('bookmark')) : null),
      h('div', { class: 'ne-thumb-meta' },
        h('button', { class: 'ne-grip', type: 'button', 'aria-label': `Déplacer la page ${i + 1}`, title: 'Glisser pour déplacer', onpointerdown: (ev) => dragThumb(ev, pg.id) }, ico('grip')),
        h('span', { class: 'num' }, String(i + 1)),
        X.canEdit() ? h('button', { class: 'nb-ib', type: 'button', 'aria-label': `Options de la page ${i + 1}`, onclick: (ev) => pageMenu(pg, ev.currentTarget) }, ico('more')) : h('span')));
    list.append(t); thumbObs.observe(t);
  });
  side.replaceChildren(
    h('div', { class: 'ne-side-head' }, h('b', {}, 'Pages'), ib('close', 'Fermer le panneau des pages', () => toggleSide(false))),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Afficher' }, [['all', 'Toutes'], ['bm', 'Signets']].map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(sideFilter === k), onclick: () => { sideFilter = k; renderSide(); } }, l))),
    go, list,
    X.canEdit() ? h('div', { class: 'ne-side-foot' }, h('button', { class: 'btn', type: 'button', onclick: () => addPage('after') }, ico('plus'), 'Page'), h('button', { class: 'btn', type: 'button', onclick: () => tocDialog() }, ico('toc'), 'Table des matières')) : null);
  const cur = list.querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'nearest' });
}
X.renderSide = () => renderSide();
function markThumbCur() { const e = E(); X.root().querySelectorAll('.ne-thumb').forEach((t) => t.classList.toggle('cur', t.dataset.id === e.cur)); }
async function drawThumb(el) {
  const e = E(); if (!e) return; const pid = el.dataset.id, pg = X.pgOf(pid); if (!pg) return;
  const ver = JSON.stringify([pg.t, (e.thumbVer || {})[pid] || 0]);
  const holder = el.querySelector('.ne-thumb-img');
  const th = thumbs.get(e.id + pid);
  if (th && th.ver === ver) { if (!holder.firstChild) holder.append(h('img', { src: th.url, alt: '' })); return; }
  if (el._busy) return; el._busy = true;
  try {
    const c = await R().renderPageImage(pg, X.itemsOf(pid), 150 * Math.min(2, devicePixelRatio || 1));
    const url = c.toDataURL('image/jpeg', .8); thumbs.set(e.id + pid, { ver, url });
    holder.replaceChildren(h('img', { src: url, alt: '' }));
  } catch (_) {} finally { el._busy = false; }
}
X.onEdit = (pids) => {
  const e = E(); if (!e) return; e.thumbVer = e.thumbVer || {};
  pids.forEach((pid) => { e.thumbVer[pid] = (e.thumbVer[pid] || 0) + 1; });
  clearTimeout(e.thumbT); e.thumbT = setTimeout(() => { if (!E()) return; pids.forEach((pid) => { const el = X.root().querySelector(`.ne-thumb[data-id="${pid}"]`); if (el) drawThumb(el); }); }, 600);
};
function dragThumb(ev, pid) {
  if (!X.canEdit()) return;
  ev.preventDefault(); const e = E(); const el = ev.currentTarget; try { el.setPointerCapture(ev.pointerId); } catch (_) {}
  const row = el.closest('.ne-thumb'); row.classList.add('dragging');
  const list = row.parentNode; let target = null;
  const mv = (m) => {
    const rows = [...list.children].filter((r) => r !== row);
    target = null; for (const r of rows) { const rc = r.getBoundingClientRect(); if (m.clientY < rc.top + rc.height / 2) { target = r; break; } }
    rows.forEach((r) => r.classList.toggle('drop-before', r === target)); list.classList.toggle('drop-end', !target);
    const lr = list.parentNode.getBoundingClientRect(); if (m.clientY < lr.top + 40) list.parentNode.scrollTop -= 12; if (m.clientY > lr.bottom - 40) list.parentNode.scrollTop += 12;
  };
  const up = () => {
    el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    row.classList.remove('dragging'); list.classList.remove('drop-end'); [...list.children].forEach((r) => r.classList.remove('drop-before'));
    const order = e.pages.filter((p) => p.id !== pid); const idx = target ? order.findIndex((p) => p.id === target.dataset.id) : order.length;
    const prev = order[idx - 1], next = order[idx]; const pg = X.pgOf(pid);
    const ord = prev && next ? (prev.ord + next.ord) / 2 : prev ? prev.ord + 1 : next ? next.ord - 1 : 1;
    if ((e.pages.indexOf(pg) === idx) || (prev && prev.id === pid)) return;
    const a = Object.assign({}, pg, { ord }); delete a.t; delete a.d;
    X.commit([{ coll: 'pages', id: pid, before: pg, after: a }]);
  };
  el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
function pageMenu(pg, anchor) {
  const e = E(); const n = e.pages.indexOf(pg) + 1;
  U().menu(anchor, [
    { label: 'Insérer une page après', icon: 'plus', onclick: () => addPage('after', pg.id) },
    { label: 'Dupliquer', icon: 'dup', onclick: () => duplicatePage(pg) },
    { label: pg.bm ? 'Retirer le signet' : 'Ajouter un signet', icon: 'bookmark', onclick: () => setBookmark(pg, pg.bm ? '' : `Page ${n}`) },
    { label: 'Modèle de la page…', icon: 'template', onclick: () => templateDialog([pg.id]) },
    { label: 'Copier vers un autre cahier…', icon: 'copy', onclick: () => copyToNotebook([pg.id]) },
    { label: 'Exporter cette page', icon: 'share', onclick: () => N.exportPdf(e.id, [pg.id]) },
    '-',
    { label: 'Supprimer la page', icon: 'trash', danger: true, disabled: e.pages.length <= 1, onclick: () => { X.commit([{ coll: 'pages', id: pg.id, before: pg, after: null }]); U().toast('Page supprimée (Annuler pour revenir)'); } }
  ], { align: 'right' });
}
function addPageMenu(anchor) {
  U().menu(anchor, [
    { label: 'Page après celle-ci', icon: 'plus', onclick: () => addPage('after') },
    { label: 'Page avant celle-ci', icon: 'plus', onclick: () => addPage('before') },
    { label: 'Page à la fin', icon: 'plus', onclick: () => addPage('end') },
    { label: 'Choisir un modèle…', icon: 'template', onclick: () => templateDialog(null, true) },
    { label: 'Importer PDF ou images…', icon: 'upload', onclick: () => importPages() }
  ], { align: 'right' });
}
function ordAt(where, refId) {
  const e = E(); const pages = e.pages; const i = pages.findIndex((p) => p.id === (refId || e.cur));
  if (where === 'end' || i < 0) return (pages.length ? pages[pages.length - 1].ord : 0) + 1;
  if (where === 'before') { const a = pages[i - 1], b = pages[i]; return a ? (a.ord + b.ord) / 2 : b.ord - 1; }
  const a = pages[i], b = pages[i + 1]; return b ? (a.ord + b.ord) / 2 : a.ord + 1;
}
async function newPageObj(ord, tplFrom) {
  const e = E(); const ref = tplFrom || X.pgOf(e.cur) || e.pages[0];
  const def = (N.index().nbs[e.id] || {}).def || {};
  const pid = S().uid('p');
  let pg;
  if (ref && !ref.bg) pg = { id: pid, ord, w: ref.w, h: ref.h, tpl: ref.tpl || 'blank', color: ref.color || 'white' };
  else if (ref && ref.bg && ref.bg.kind === 'pdf' && ref.bg.src.startsWith('blob:') && def.custom) pg = Object.assign({ id: pid, ord, color: 'white' }, N.customBg(def.custom));
  else { const [w, hh] = def.size ? N.pageSize(def.size, def.orient) : [ref ? ref.w : 595.3, ref ? ref.h : 841.9]; pg = { id: pid, ord, w, h: hh, tpl: def.tpl || 'blank', color: def.color || 'white' }; }
  e.docs.set(pid, await S().ensure(N.paths.pgPath(e.id, pid), { items: {} }));
  return pg;
}
async function addPage(where, refId) {
  const e = E(); if (!X.canEdit()) return;
  const pg = await newPageObj(ordAt(where, refId), refId ? X.pgOf(refId) : null);
  X.commit([{ coll: 'pages', id: pg.id, before: null, after: pg }]);
  await waitLayout(); X.goPage(pg.id); X.flashMsg('Page ajoutée');
  void e;
}
const waitLayout = () => new Promise((r) => setTimeout(r, 60));
async function duplicatePage(pg) {
  const e = E(); const pid = S().uid('p'); const copy = Object.assign({}, pg, { id: pid, ord: ordAt('after', pg.id) }); delete copy.t; delete copy.d;
  e.docs.set(pid, await S().ensure(N.paths.pgPath(e.id, pid), { items: {} }));
  const items = X.itemsOf(pg.id).map((it) => { const c = Object.assign({}, it, { id: S().uid('i') }); delete c.t; delete c.d; return c; });
  X.commit([{ coll: 'pages', id: pid, before: null, after: copy }, ...items.map((it) => ({ pid, coll: 'items', id: it.id, before: null, after: it }))]);
  await waitLayout(); X.goPage(pid); U().toast('Page dupliquée');
}
async function importPages() {
  const e = E(); const files = await N.pickFile('application/pdf,image/*', { multiple: true }); if (!files.length) return;
  U().toast('Import…', 6000);
  try {
    const cur = X.pgOf(e.cur); const pids = await N.importPagesInto(e.id, files, cur ? cur.ord : null);
    await X.relayoutPages(); if (pids[0]) X.goPage(pids[0]); U().toast(`${pids.length} page${pids.length > 1 ? 's' : ''} ajoutée${pids.length > 1 ? 's' : ''}`);
  } catch (err) { console.warn(err); U().toast('Import impossible'); }
}
function templateDialog(pids, asNew) {
  const e = E(); const ref = X.pgOf((pids && pids[0]) || e.cur);
  const st = { tpl: ref.bg ? 'blank' : (ref.tpl || 'blank'), color: ref.color || 'white', size: Math.abs(ref.w - 612) < 2 || Math.abs(ref.h - 612) < 2 ? 'Letter' : 'A4', orient: ref.w > ref.h ? 'land' : 'port', custom: null, scope: 'page' };
  const body = h('div', { class: 'nb-form' });
  const draw = () => {
    const seg = (key, list, lbl) => h('div', { class: 'nb-field' }, h('span', {}, lbl), h('div', { class: 'seg', role: 'group', 'aria-label': lbl, style: `grid-template-columns:repeat(${list.length},minmax(0,1fr))` }, list.map(([k, t]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(st[key] === k), onclick: () => { st[key] = k; draw(); } }, t))));
    body.replaceChildren(
      h('div', { class: 'nb-tpls' }, N.TPLS.map(([k, t]) => h('button', { class: 'nb-tpl' + (!st.custom && st.tpl === k ? ' on' : ''), type: 'button', 'aria-pressed': String(!st.custom && st.tpl === k), onclick: () => { st.tpl = k; st.custom = null; draw(); } }, N.tplPreview(k, st.color), h('span', {}, t))),
        Object.values(N.index().tpls).filter(live).map((t) => h('button', { class: 'nb-tpl' + (st.custom === t.id ? ' on' : ''), type: 'button', onclick: () => { st.custom = t.id; draw(); } }, h('span', { class: 'nb-tplprev custom' }, ico('pdf')), h('span', {}, t.name))),
        h('button', { class: 'nb-tpl', type: 'button', onclick: async () => { const id = await N.importTemplate(); if (id) { st.custom = id; draw(); } } }, h('span', { class: 'nb-tplprev custom' }, ico('plus')), h('span', {}, 'Depuis un PDF…'))),
      seg('color', N.PCOLORS, 'Couleur du papier'), seg('size', [['A4', 'A4'], ['Letter', 'Letter']], 'Format'), seg('orient', [['port', 'Portrait'], ['land', 'Paysage']], 'Orientation'),
      asNew ? null : seg('scope', [['page', 'Cette page'], ['all', 'Toutes les pages']], 'Appliquer à'));
  };
  draw();
  U().dialog({ title: asNew ? 'Nouvelle page' : 'Modèle de page', wide: true, body, actions: [{ label: 'Annuler', value: null }, { label: asNew ? 'Ajouter' : 'Appliquer', primary: true, onclick: async (api) => {
    api.close();
    const [w, hh] = N.pageSize(st.size, st.orient);
    const props = st.custom ? Object.assign({ color: 'white' }, N.customBg(st.custom)) : { tpl: st.tpl, color: st.color, w, h: hh, bg: undefined };
    if (asNew) { const pg = Object.assign(await newPageObj(ordAt('after')), props); if (!st.custom) delete pg.bg; X.commit([{ coll: 'pages', id: pg.id, before: null, after: pg }]); await waitLayout(); X.goPage(pg.id); return; }
    const targets = st.scope === 'all' ? e.pages.slice() : (pids || [e.cur]).map((id) => X.pgOf(id));
    X.commit(targets.filter((pg) => !pg.bg || st.custom || st.scope === 'page').map((pg) => { const a = Object.assign({}, pg, props); if (!st.custom) delete a.bg; delete a.t; delete a.d; return { coll: 'pages', id: pg.id, before: pg, after: a }; }));
    N.setIdx('nbs', Object.assign({}, N.index().nbs[e.id], { def: { tpl: st.tpl, color: st.color, size: st.size, orient: st.orient, custom: st.custom } }));
  } }] });
}
async function copyToNotebook(pids) {
  const e = E(); const list = Object.values(N.index().nbs).filter((n) => live(n) && !n.trashed && n.id !== e.id).sort((a, b) => (b.upd || 0) - (a.upd || 0));
  if (!list.length) { U().toast('Crée d’abord un autre cahier'); return; }
  const d = U().dialog({ title: 'Copier vers…', body: h('div', { class: 'nb-list' }, list.map((n) => h('button', { class: 'nb-row', type: 'button', onclick: async () => {
    d.close(); const nd = await S().ensure(N.paths.nbPath(n.id), { pages: {}, audio: {} });
    let ord = Math.max(0, ...Object.values(nd.pages).filter(live).map((p) => p.ord));
    for (const pid of pids) {
      const pg = X.pgOf(pid); const npid = S().uid('p'); const c = Object.assign({}, pg, { id: npid, ord: ++ord }); delete c.t; delete c.d;
      S().setObj(N.paths.nbPath(n.id), 'pages', c);
      await S().ensure(N.paths.pgPath(n.id, npid), { items: {} });
      for (const it of X.itemsOf(pid)) { const ci = Object.assign({}, it, { id: S().uid('i') }); delete ci.t; delete ci.d; S().setObj(N.paths.pgPath(n.id, npid), 'items', ci); }
    }
    N.setIdx('nbs', Object.assign({}, n, { upd: Date.now(), np: (n.np || 0) + pids.length }));
    U().toast(`Copié dans « ${n.title} »`);
  } }, N.coverEl(n), h('span', {}, n.title)))) });
}

/* ================= Signets, table des matières ================= */
function setBookmark(pg, title) { const a = Object.assign({}, pg, { bm: title }); delete a.t; delete a.d; X.commit([{ coll: 'pages', id: pg.id, before: pg, after: a }]); setTimeout(() => { X.onPageChange(); X.renderTop(); }, 80); }
function toggleBookmark() { const e = E(); const pg = X.pgOf(e.cur); if (!pg || !X.canEdit()) return; setBookmark(pg, pg.bm ? '' : `Page ${e.pages.indexOf(pg) + 1}`); U().toast(pg.bm ? 'Signet retiré' : 'Signet ajouté'); }
function tocDialog() {
  const e = E(); const body = h('div', { class: 'nb-form' });
  const draw = () => {
    const bms = e.pages.filter((p) => p.bm);
    body.replaceChildren(
      bms.length ? h('div', { class: 'nb-list ne-toc' }, bms.map((pg) => {
        const n = e.pages.indexOf(pg) + 1;
        const inp = h('input', { class: 'search', type: 'text', value: pg.bm, 'aria-label': `Titre du signet de la page ${n}`, readonly: X.canEdit() ? null : true, onchange: (ev) => { const v = ev.target.value.trim(); if (v && v !== pg.bm) setBookmark(X.pgOf(pg.id), v); } });
        return h('div', { class: 'nb-row' }, h('button', { class: 'btn', type: 'button', onclick: () => { d.close(); X.goPage(pg.id); }, 'aria-label': `Aller à la page ${n}` }, `p. ${n}`), inp,
          X.canEdit() ? ib('trash', 'Retirer ce signet', () => { setBookmark(X.pgOf(pg.id), ''); setTimeout(draw, 100); }) : null);
      })) : h('p', { class: 'muted' }, 'Aucun signet. Ajoute la page actuelle pour construire ta table des matières.'),
      X.canEdit() ? h('button', { class: 'btn', type: 'button', onclick: async () => { const pg = X.pgOf(e.cur); const t = await U().prompt('Titre du signet', pg.bm || `Page ${e.pages.indexOf(pg) + 1}`, { label: 'Titre' }); if (t) { setBookmark(pg, t); setTimeout(draw, 100); } } }, ico('bookmark'), 'Ajouter la page actuelle') : null);
  };
  draw();
  const d = U().dialog({ title: 'Table des matières', body, wide: true });
}

/* ================= Menu « Plus » ================= */
function moreMenu(anchor) {
  const e = E(); const cur = X.pgOf(e.cur); const due = N.dueCards().length;
  U().menu(anchor, [
    narrow() ? { label: 'Exporter ou partager', icon: 'share', onclick: () => N.exportPdf(e.id) } : null,
    narrow() && X.canEdit() ? { label: cur && cur.bm ? 'Retirer le signet' : 'Ajouter un signet', icon: 'bookmark', onclick: toggleBookmark } : null,
    { label: 'Rechercher dans le cahier', icon: 'search', onclick: searchDialog },
    { label: 'Table des matières', icon: 'toc', onclick: tocDialog },
    narrow() && X.openTabs.length > 1 ? { label: 'Documents ouverts', icon: 'pages', onclick: tabsDialog } : null,
    X.hasClip() && X.canEdit() ? { label: 'Coller', icon: 'paste', onclick: () => X.paste() } : null,
    '-',
    X.canEdit() ? { label: e.rec ? 'Arrêter l’enregistrement' : 'Enregistrer l’audio', icon: 'mic', onclick: () => (e.rec ? stopRec() : startRec()) } : null,
    Object.values(e.nd.audio || {}).some(live) ? { label: 'Enregistrements audio', icon: 'play', onclick: audioList } : null,
    { label: due ? `Réviser les cartes (${due})` : 'Cartes de révision', icon: 'cards', onclick: () => N.cards.review() },
    X.canEdit() ? { label: 'Nouvelle carte', icon: 'plus', onclick: () => N.cards.newCard(null, e.id) } : null,
    '-',
    { label: 'Mode présentation', icon: 'present', onclick: enterPresent },
    { label: e.dir === 'h' ? 'Défilement vertical (continu)' : 'Page par page (comme la présentation)', icon: e.dir === 'h' ? 'vert' : 'horiz', onclick: toggleDir },
    { label: 'Ajuster à la largeur', icon: 'fit', onclick: () => { const a = e.cur; e.zoom = 1; X.layout(); X.goPage(a, false); } },
    { label: 'Dessiner au doigt', icon: 'finger', on: X.TP.fingerDraw, onclick: () => { X.TP.fingerDraw = !X.TP.fingerDraw; X.saveTP(); U().toast(X.TP.fingerDraw ? 'Le doigt dessine (2 doigts pour défiler)' : 'Le doigt fait défiler et zoomer'); } },
    { label: 'Lecture seule', icon: 'readonly', on: e.readonly, onclick: () => { N.setIdx('nbs', Object.assign({}, N.index().nbs[e.id], { readonly: !e.readonly })); e.readonly = !e.readonly; e.nb = N.index().nbs[e.id]; X.clearSel(); X.commitText(); X.renderTop(); X.renderTools(); } },
    { label: 'Renommer le cahier', icon: 'text', onclick: renameNb }
  ], { align: 'right' });
}
function toggleDir() {
  const e = E(); const a = e.cur; e.dir = e.dir === 'h' ? 'v' : 'h'; X.TP.dir = e.dir; X.saveTP();
  N.uiPrefsSave({ dirs: Object.assign({}, N.uiPrefs().dirs || {}, { [e.id]: e.dir }) });
  e.zoom = 1; X.layout(); X.goPage(a, false); X.renderTop();
  U().toast(e.dir === 'h' ? 'Page par page : glisse avec le doigt pour tourner les pages' : 'Défilement vertical');
}
X.toggleDir = toggleDir;
function tabsDialog() {
  const d = U().dialog({ title: 'Documents ouverts', body: h('div', { class: 'nb-list' }, X.openTabs.map((id) => { const n = N.index().nbs[id]; if (!n || n.gone) return null; return h('div', { class: 'nb-row' }, h('button', { class: 'btn', type: 'button', onclick: () => { d.close(); N.openNb(id); } }, n.title), ib('close', `Fermer ${n.title}`, () => { N.editor.closeTab(id); d.close(); if (id === E().id) { const nx = X.openTabs[X.openTabs.length - 1]; if (nx) N.openNb(nx); else X.close(); } })); })) });
}

/* ================= Export PDF ================= */
N.exportPdf = async (nbId, onlyPids) => {
  const nd = await S().get(N.paths.nbPath(nbId)); if (!nd) return;
  const pages = Object.values(nd.pages).filter(live).sort((a, b) => (a.ord - b.ord) || (a.id < b.id ? -1 : 1));
  const nb = N.index().nbs[nbId]; const e = E(); const curIdx = e && e.id === nbId ? pages.findIndex((p) => p.id === e.cur) : 0;
  let mode = onlyPids ? 'some' : 'all';
  const range = h('input', { class: 'search', type: 'text', placeholder: 'ex. 1-3, 5', 'aria-label': 'Pages à exporter', value: onlyPids ? onlyPids.map((id) => pages.findIndex((p) => p.id === id) + 1).join(', ') : '' });
  const prog = h('p', { class: 'nb-msg', role: 'status' });
  const radios = h('div', { class: 'nb-list' });
  const drawR = () => radios.replaceChildren(...[['all', `Tout le cahier (${pages.length} page${pages.length > 1 ? 's' : ''})`], ['cur', `Page actuelle (${curIdx + 1})`], ['some', 'Pages choisies']].map(([k, l]) => h('label', { class: 'nb-row radio' }, h('input', { type: 'radio', name: 'nbexp', value: k, checked: mode === k ? true : null, onchange: () => { mode = k; drawR(); } }), h('span', {}, l))), mode === 'some' ? range : '');
  drawR();
  const parse = () => {
    if (mode === 'all') return pages.map((p) => p.id);
    if (mode === 'cur') return [pages[Math.max(0, curIdx)].id];
    const out = []; for (const part of range.value.split(/[,;\s]+/)) { const m = part.match(/^(\d+)(?:-(\d+))?$/); if (!m) continue; const a = +m[1], b = +(m[2] || m[1]); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (pages[i - 1] && !out.includes(pages[i - 1].id)) out.push(pages[i - 1].id); }
    return out;
  };
  U().dialog({ title: 'Exporter en PDF', body: h('div', { class: 'nb-form' }, radios, h('p', { class: 'muted small' }, 'Export vectoriel net : ton encre reste nette au zoom. Sur iPad et iPhone, tu peux ensuite le partager (Fichiers, Mail, AirDrop…).'), prog),
    actions: [{ label: 'Annuler', value: null }, { label: 'Exporter', primary: true, onclick: async (api) => {
      const ids = parse(); if (!ids.length) { prog.className = 'nb-msg bad'; prog.textContent = 'Choisis au moins une page.'; return; }
      prog.className = 'nb-msg'; prog.textContent = 'Préparation…';
      try {
        const bytes = await R().exportPdf(nbId, ids, (i, n) => { prog.textContent = `Page ${Math.min(i + 1, n)} sur ${n}…`; });
        const name = ((nb && nb.title) || 'Cahier').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) + '.pdf';
        const r = await U().shareOrDownload(new Blob([bytes], { type: 'application/pdf' }), name);
        api.close(); if (r === 'download') U().toast('PDF téléchargé');
      } catch (err) { console.warn(err); prog.className = 'nb-msg bad'; prog.textContent = 'Export impossible : ' + (err.message || 'erreur') + '. Un fond PDF n’est peut-être pas encore synchronisé.'; }
    } }] });
};

/* ================= Pointeur laser ================= */
let trail = [], laserRaf = 0;
X.laserPoint = (cx, cy, start) => {
  const c = X.root().querySelector('.ne-laser');
  if (cx == null) { trail.push(null); return; }
  if (start) trail.push(null);
  const r = c.getBoundingClientRect();
  trail.push({ x: cx - r.left, y: cy - r.top, t: performance.now() });
  if (!laserRaf) laserRaf = requestAnimationFrame(drawLaser);
};
function drawLaser() {
  laserRaf = 0; const c = X.root().querySelector('.ne-laser'); const dpr = devicePixelRatio || 1;
  const w = c.clientWidth, hh = c.clientHeight; if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
  const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, hh);
  const t = performance.now(), life = 900; trail = trail.filter((p) => p === null || t - p.t < life);
  while (trail.length && trail[0] === null) trail.shift();
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i]; if (!a || !b) continue;
    const k = 1 - (t - b.t) / life;
    x.strokeStyle = `rgba(255,59,48,${.25 * k})`; x.lineWidth = 12; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
    x.strokeStyle = `rgba(255,80,70,${k})`; x.lineWidth = 4; x.stroke();
  }
  const last = trail[trail.length - 1]; if (last) { x.fillStyle = 'rgba(255,59,48,.95)'; x.beginPath(); x.arc(last.x, last.y, 5, 0, 6.283); x.fill(); }
  if (trail.length) laserRaf = requestAnimationFrame(drawLaser);
}

/* ================= Présentation ================= */
function enterPresent() {
  const e = E(); X.clearSel(); X.commitText(); closeZw();
  e.present = true; e.zoomBefore = e.zoom; e.zoom = 1; X.root().classList.add('present');
  const ctl = h('div', { class: 'ne-pres ne-ovl' },
    ib('back', 'Page précédente', () => X.presentStep(-1)), h('span', { class: 'ne-pres-n num' }), ib('pen', 'Page suivante', () => X.presentStep(1), { class: 'nb-ib ne-next' }), ib('close', 'Quitter la présentation', () => X.exitPresent()));
  ctl.querySelector('.ne-next').replaceChildren(ico('back')); ctl.querySelector('.ne-next svg').style.transform = 'scaleX(-1)';
  X.root().querySelector('.ne-body').append(ctl);
  try { if (X.root().requestFullscreen) X.root().requestFullscreen().catch(() => {}); } catch (_) {}
  const a = e.cur; setTimeout(() => { X.layout(); X.goPage(a, false); presN(); }, 80);
  U().toast('Présentation : glisse ou touche les bords pour changer de page. Le stylet devient un laser.');
}
function presN() { const e = E(); const el = X.root().querySelector('.ne-pres-n'); if (el) el.textContent = `${e.pages.findIndex((p) => p.id === e.cur) + 1} / ${e.pages.length}`; }
X.presentStep = (d) => { const e = E(); const i = e.pages.findIndex((p) => p.id === e.cur); const n = e.pages[clamp(i + d, 0, e.pages.length - 1)]; if (n) { X.goPage(n.id); e.cur = n.id; presN(); } };
X.presentSnap = (vx) => { const e = E(); const i = e.pages.findIndex((p) => p.id === e.cur); setTimeout(() => { if (Math.abs(vx) > .3) X.presentStep(vx > 0 ? 1 : -1); else X.presentStep(0); }, 10); void i; };
X.presentTap = (cx) => { const w = innerWidth; if (cx > w * .66) X.presentStep(1); else if (cx < w * .33) X.presentStep(-1); };
X.exitPresent = (silent) => {
  const e = E(); if (!e || !e.present) return;
  e.present = false; e.zoom = e.zoomBefore || 1; X.root().classList.remove('present');
  X.root().querySelectorAll('.ne-pres').forEach((x) => x.remove());
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (_) {}
  if (!silent) { const a = e.cur; setTimeout(() => { X.layout(); X.goPage(a, false); }, 80); }
};
document.addEventListener('fullscreenchange', () => { const e = E(); if (e && e.present && !document.fullscreenElement) X.exitPresent(); });

/* ================= Fenêtre de zoom ================= */
function toggleZw() { const e = E(); if (e.zw) closeZw(); else openZw(); X.renderTools(); }
function openZw() {
  const e = E(); if (!X.canEdit()) return; const pid = e.cur, pg = X.pgOf(pid); if (!pg) return;
  const c = X.viewCenter(pid);
  e.zw = { pid, x: 36, y: clamp(c.y - 30, 20, pg.h - 80), w: Math.min(pg.w * .42, 240) };
  const panel = h('div', { class: 'ne-zw ne-ovl', role: 'region', 'aria-label': 'Fenêtre de zoom' },
    h('div', { class: 'ne-zw-bar' },
      ib('back', 'Reculer', () => zwMove(-1)), ib('back', 'Avancer', () => zwMove(1), { class: 'nb-ib ne-flip' }), h('button', { class: 'ne-tb', type: 'button', 'aria-label': 'Ligne suivante', onclick: () => zwNewline() }, h('b', {}, '↵')),
      h('label', { class: 'ne-zw-z' }, h('span', { class: 'sr' }, 'Grossissement'), h('input', { type: 'range', min: 80, max: 400, step: 10, value: Math.round(e.zw.w), 'aria-label': 'Largeur de la zone (zoom)', oninput: (ev) => { e.zw.w = clamp(+ev.target.value, 60, pg.w); zwPlace(); X.zwRedraw(); } })),
      ib('close', 'Fermer la fenêtre de zoom', () => { closeZw(); X.renderTools(); })),
    h('div', { class: 'ne-zw-area' }, h('canvas', { class: 'zw-bg' }), h('canvas', { class: 'zw-ink' }), h('canvas', { class: 'zw-live' })));
  X.root().querySelector('.ne-body').append(panel); X.root().classList.add('zw-open');
  const area = panel.querySelector('.ne-zw-area');
  area.addEventListener('pointerdown', zwDown); area.addEventListener('pointermove', zwMoveEv); area.addEventListener('pointerup', zwUp); area.addEventListener('pointercancel', zwUp);
  area.addEventListener('touchmove', (ev) => ev.preventDefault(), { passive: false });
  zwPlace(); setTimeout(() => X.zwRedraw(true), 30);
}
function closeZw() { const e = E(); if (!e) return; e.zw = null; X.root().querySelectorAll('.ne-zw, .ne-zwbox').forEach((x) => x.remove()); X.root().classList.remove('zw-open'); }
function zwDims() { const e = E(); const area = X.root().querySelector('.ne-zw-area'); const W = area.clientWidth, H = area.clientHeight; const m = W / e.zw.w; return { W, H, m, rh: H / m }; }
function zwPlace() {
  const e = E(); if (!e.zw) return; const pv = e.pvs.get(e.zw.pid), pg = pv.pg; const { rh } = zwDims();
  let box = X.root().querySelector('.ne-zwbox');
  if (!box || box.parentNode !== pv.el) {
    if (box) box.remove();
    box = h('div', { class: 'ne-zwbox ne-ovl', 'aria-hidden': 'true' }); pv.el.append(box);
    box.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); try { box.setPointerCapture(ev.pointerId); } catch (_) {} const sx = ev.clientX, sy = ev.clientY, z0 = Object.assign({}, e.zw); const mv = (m) => { e.zw.x = clamp(z0.x + (m.clientX - sx) / e.scale, 0, pg.w - e.zw.w); e.zw.y = clamp(z0.y + (m.clientY - sy) / e.scale, 0, pg.h - 10); zwPlace(); X.zwRedraw(true); }; const up = () => { box.removeEventListener('pointermove', mv); box.removeEventListener('pointerup', up); }; box.addEventListener('pointermove', mv); box.addEventListener('pointerup', up); });
  }
  box.style.cssText = `left:${e.zw.x / pg.w * 100}%;top:${e.zw.y / pg.h * 100}%;width:${e.zw.w / pg.w * 100}%;height:${rh / pg.h * 100}%`;
}
let zwBgKey = '';
X.zwRedraw = (bgToo) => {
  const e = E(); if (!e || !e.zw) return; const pv = e.pvs.get(e.zw.pid); if (!pv) { closeZw(); return; }
  const pg = pv.pg, area = X.root().querySelector('.ne-zw-area'); if (!area) return;
  const { W, H, rh } = zwDims(); const dpr = Math.min(devicePixelRatio || 1, 2); const rect = { x: e.zw.x, y: e.zw.y, w: e.zw.w, h: rh };
  for (const c of area.querySelectorAll('canvas')) { if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); zwBgKey = ''; } }
  const key = JSON.stringify([rect, pg.tpl, pg.color, pg.bg, W, H]);
  if (bgToo || key !== zwBgKey) {
    zwBgKey = key; const bg = area.querySelector('.zw-bg'); const ctx = X.ctxFor(bg, rect); R().drawTemplate(ctx, pg);
    if (pg.bg) { const k = bg.width / rect.w; R().drawBg(ctx, pg, k, rect, bg).catch(() => {}); }
    zwPlace();
  }
  const ink = area.querySelector('.zw-ink'); const ctx = X.ctxFor(ink, rect);
  R().drawItems(ctx, X.visibleItems(pv), pg, { view: rect });
};
let ZG = null;
function zwDown(ev) {
  const e = E(); if (ev.pointerType === 'touch' && !X.TP.fingerDraw) return; if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  ev.preventDefault(); const area = ev.currentTarget; try { area.setPointerCapture(ev.pointerId); } catch (_) {}
  const tool = ['pen', 'hl'].includes(X.TP.tool) ? X.TP.tool : 'pen';
  const cfg = X.toolCfg(tool);
  ZG = { id: ev.pointerId, area, rc: area.getBoundingClientRect(), tool, pts: [], color: cfg.color, size: X.curSize(tool), pen: tool === 'pen' ? cfg.pen : 'ball', sim: ev.pointerType !== 'pen', ptype: ev.pointerType };
  if (X.TP.tool !== tool) X.setTool(tool);
  zwAdd(ev);
}
function zwAdd(ev) { const e = E(); const { m } = zwDims(); const evs = (ev.getCoalescedEvents && ev.getCoalescedEvents()) || []; for (const q of (evs.length ? evs : [ev])) { const x = e.zw.x + (q.clientX - ZG.rc.left) / m, y = e.zw.y + (q.clientY - ZG.rc.top) / m; const p = q.pointerType === 'pen' ? clamp(q.pressure || .35, .05, 1) : .5; ZG.pts.push(Math.round(x * 100) / 100, Math.round(y * 100) / 100, p); } }
function zwMoveEv(ev) {
  if (!ZG || ev.pointerId !== ZG.id) return; zwAdd(ev);
  const e = E(); const live = ZG.area.querySelector('.zw-live'); const { rh } = zwDims(); const rect = { x: e.zw.x, y: e.zw.y, w: e.zw.w, h: rh };
  const ctx = X.ctxFor(live, rect); const it = { type: 's', tool: ZG.tool === 'hl' ? 'hl' : 'pen', pen: ZG.pen, color: ZG.color, size: ZG.size, pts: ZG.pts, sim: ZG.sim };
  ctx.fillStyle = it.color; ctx.globalAlpha = it.tool === 'hl' ? .5 : 1; ctx.fill(R().livePath(ZG.pts, it)); ctx.globalAlpha = 1;
}
function zwUp(ev) {
  if (!ZG || ev.pointerId !== ZG.id) return; const g = ZG; ZG = null; const e = E();
  const live = g.area.querySelector('.zw-live'); live.getContext('2d').setTransform(1, 0, 0, 1, 0, 0); live.getContext('2d').clearRect(0, 0, live.width, live.height);
  if (g.pts.length < 3) return;
  const item = X.newItem({ type: 's', tool: g.tool === 'hl' ? 'hl' : 'pen', pen: g.pen, color: g.color, size: g.size, pts: g.pts, sim: g.sim });
  X.commit([{ pid: e.zw.pid, coll: 'items', id: item.id, before: null, after: item }]);
  X.zwAfterStroke(item, e.zw.pid);
}
X.zwAfterStroke = (item, pid) => {
  const e = E(); if (!e || !e.zw || pid !== e.zw.pid || item.type !== 's') return;
  let maxx = -Infinity; for (let i = 0; i < item.pts.length; i += 3) maxx = Math.max(maxx, item.pts[i]);
  if (maxx > e.zw.x + e.zw.w * .8) zwMove(1);
};
function zwMove(d) { const e = E(); const pg = X.pgOf(e.zw.pid); const nx = e.zw.x + d * e.zw.w * .55; if (d > 0 && nx + e.zw.w > pg.w - 10) { zwNewline(); return; } e.zw.x = clamp(nx, 0, pg.w - e.zw.w); zwPlace(); X.zwRedraw(true); }
function zwNewline() { const e = E(); const pg = X.pgOf(e.zw.pid); const { rh } = zwDims(); e.zw.x = 36; e.zw.y = clamp(e.zw.y + rh * .85, 0, pg.h - rh); zwPlace(); X.zwRedraw(true); }

/* ================= Éléments (autocollants) ================= */
function elementsPanel() {
  const els = Object.values(N.index().elements).filter(live).sort((a, b) => (b.created || 0) - (a.created || 0));
  const body = h('div', {});
  const draw = () => {
    const list = Object.values(N.index().elements).filter(live).sort((a, b) => (b.created || 0) - (a.created || 0));
    if (!list.length) { body.replaceChildren(h('p', { class: 'muted' }, 'Aucun élément. Sélectionne un dessin au lasso puis touche « Élément » pour l’enregistrer et le réutiliser ici.')); return; }
    body.replaceChildren(h('div', { class: 'ne-els' }, list.map((el) => {
      const prev = h('span', { class: 'ne-el-prev' });
      R().renderPageImage({ w: el.w, h: el.h, tpl: 'blank', color: 'white' }, el.items.map((it, i) => Object.assign({ id: 'x' + i }, it)), 160, { x: 0, y: 0, w: el.w, h: el.h, transparent: true, forceTape: true }).then((c) => prev.append(c)).catch(() => {});
      return h('div', { class: 'ne-el' }, h('button', { class: 'ne-el-go', type: 'button', 'aria-label': `Insérer ${el.name}`, onclick: () => { d.close(); insertElement(el); } }, prev, h('span', {}, el.name)),
        ib('trash', `Supprimer ${el.name}`, async () => { if (await U().confirm('Supprimer cet élément ?', el.name, 'Supprimer', true)) { N.setIdx('elements', S().tomb(el.id)); draw(); } }));
    })));
  };
  draw(); void els;
  const d = U().dialog({ title: 'Éléments', body, wide: true });
}
function insertElement(el) {
  const e = E(); if (!X.canEdit()) return; const pid = e.cur, c = X.viewCenter(pid);
  X.insertItems(pid, JSON.parse(JSON.stringify(el.items)), c.x - el.w / 2, c.y - el.h / 2);
}

/* ================= Audio synchronisé ================= */
async function startRec() {
  const e = E(); if (!navigator.mediaDevices || !window.MediaRecorder) { U().toast('Enregistrement audio non disponible sur ce navigateur'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); const chunks = [];
    mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    const rec = { mr, chunks, stream, start: Date.now(), nb: e.id };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' });
      if (!blob.size) return;
      const sha = await S().blobPut(new Uint8Array(await blob.arrayBuffer()), blob.type);
      const path = N.paths.nbPath(rec.nb); await S().get(path);
      S().setObj(path, 'audio', { id: S().uid('a'), blob: sha, mime: blob.type, start: rec.start, dur: Date.now() - rec.start });
      U().toast('Enregistrement sauvegardé');
    };
    mr.start(1000); e.rec = rec;
    const bar = h('div', { class: 'ne-audiobar ne-ovl rec', role: 'status' }, h('i', { class: 'ne-recdot' }), h('span', { class: 'num ne-rect' }, '00:00'), h('span', { class: 'muted small' }, 'Enregistrement : tes traits sont synchronisés avec l’audio'), h('button', { class: 'btn solid', type: 'button', onclick: stopRec }, ico('stop'), 'Arrêter'));
    X.root().querySelector('.ne-body').append(bar);
    rec.timer = setInterval(() => { const s = Math.floor((Date.now() - rec.start) / 1000); bar.querySelector('.ne-rect').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 500);
  } catch (err) { U().toast('Micro refusé ou indisponible'); }
}
function stopRec() { const e = E(); const rec = e && e.rec; if (!rec) return; clearInterval(rec.timer); try { rec.mr.stop(); } catch (_) {} e.rec = null; X.root().querySelectorAll('.ne-audiobar.rec').forEach((x) => x.remove()); }
X.stopAudio = () => { stopRec(); stopPlay(); };
function audioList() {
  const e = E(); const list = Object.values(e.nd.audio || {}).filter(live).sort((a, b) => b.start - a.start);
  const fmt = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`; };
  const d = U().dialog({ title: 'Enregistrements', body: h('div', { class: 'nb-list' }, list.map((a) => h('div', { class: 'nb-row' },
    h('button', { class: 'btn solid', type: 'button', onclick: () => { d.close(); play(a); } }, ico('play'), 'Écouter'),
    h('span', { class: 'tx' }, new Date(a.start).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), h('span', { class: 'muted small' }, ' · ' + fmt(a.dur))),
    X.canEdit() ? ib('trash', 'Supprimer cet enregistrement', async () => { if (await U().confirm('Supprimer l’enregistrement ?', 'L’audio sera effacé (les traits restent).', 'Supprimer', true)) { S().setObj(N.paths.nbPath(e.id), 'audio', S().tomb(a.id)); d.close(); } }) : null))),
    actions: [] });
}
let player = null;
async function play(a) {
  const e = E(); stopPlay();
  const b = await S().blobGet(a.blob); if (!b) { U().toast('Audio pas encore synchronisé'); return; }
  const url = URL.createObjectURL(new Blob([b.data], { type: b.mime || a.mime })); const au = new Audio(url);
  const seek = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Position dans l’enregistrement', class: 'ne-seek' });
  const tm = h('span', { class: 'num ne-rect' }, '0:00');
  const pp = ib('pause', 'Pause', () => { if (au.paused) au.play(); else au.pause(); });
  const bar = h('div', { class: 'ne-audiobar ne-ovl', role: 'region', 'aria-label': 'Lecture audio' }, pp, tm, seek, ib('close', 'Arrêter la lecture', stopPlay));
  X.root().querySelector('.ne-body').append(bar);
  const end = a.start + a.dur;
  const pagesWith = () => e.pages.filter((pg) => X.itemsOf(pg.id).some((it) => it.c >= a.start && it.c <= end)).map((pg) => pg.id);
  const affected = pagesWith();
  e.playFilter = (it) => !(it.c >= a.start && it.c <= end && it.c > a.start + au.currentTime * 1000);
  let lastT = -1;
  const tick = () => {
    if (!player || player.au !== au) return;
    const t = au.currentTime; if (Math.abs(t - lastT) > .12) { lastT = t; affected.forEach((pid) => X.rerender(pid)); const s = Math.floor(t); tm.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (au.duration && isFinite(au.duration)) seek.value = String(Math.round(t / au.duration * 1000)); else seek.value = String(Math.round(t * 1000 / (a.dur / 1000) )); }
    player.raf = requestAnimationFrame(tick);
  };
  seek.addEventListener('input', () => { const D = au.duration && isFinite(au.duration) ? au.duration : a.dur / 1000; au.currentTime = seek.value / 1000 * D; });
  au.addEventListener('play', () => pp.replaceChildren(ico('pause'))); au.addEventListener('pause', () => pp.replaceChildren(ico('play')));
  au.addEventListener('ended', () => { pp.replaceChildren(ico('play')); });
  player = { au, url, bar, raf: 0, affected };
  if (affected[0]) X.goPage(affected[0]);
  try { await au.play(); } catch (_) { pp.replaceChildren(ico('play')); }
  tick();
}
function stopPlay() {
  const e = E(); if (!player) return; cancelAnimationFrame(player.raf); try { player.au.pause(); } catch (_) {} URL.revokeObjectURL(player.url); player.bar.remove();
  const aff = player.affected; player = null; if (e) { e.playFilter = null; aff.forEach((pid) => X.rerender(pid)); }
}

/* ================= Recherche ================= */
const textCache = new Map();
async function pdfText(src, n) {
  const k = src + '#' + n; if (textCache.has(k)) return textCache.get(k);
  const p = (async () => { const pdf = await N.pdfDoc(src); const page = await pdf.getPage(n); const vp = page.getViewport({ scale: 1 }); const tc = await page.getTextContent(); return { vp, items: tc.items.filter((i) => i.str) }; })();
  textCache.set(k, p); p.catch(() => textCache.delete(k)); return p;
}
function searchDialog() {
  const e = E(); const inp = h('input', { class: 'search', type: 'search', placeholder: 'Mot à chercher (PDF et zones de texte)', 'aria-label': 'Chercher dans le cahier' });
  const out = h('div', { class: 'nb-list ne-results', role: 'list' }); let tok = 0;
  const run = async () => {
    const q = inp.value.trim().toLowerCase(); const my = ++tok; clearHl();
    if (q.length < 2) { out.replaceChildren(); return; }
    out.replaceChildren(h('p', { class: 'muted small' }, 'Recherche…'));
    const res = [];
    for (const pg of e.pages) {
      const n = e.pages.indexOf(pg) + 1, rects = [], snippets = [];
      for (const it of X.itemsOf(pg.id)) if (it.type === 'tx' && (it.text || '').toLowerCase().includes(q)) { const b = R().bbox(it); rects.push(b); snippets.push(it.text); }
      if (pg.bg && pg.bg.kind === 'pdf') {
        try {
          const { vp, items } = await pdfText(pg.bg.src, pg.bg.n); if (my !== tok) return; const k = pg.w / vp.width;
          for (const ti of items) {
            const s = ti.str.toLowerCase(); let i = s.indexOf(q); if (i < 0) continue;
            const tx = pdfjsLib.Util.transform(vp.transform, ti.transform); const fh = Math.hypot(tx[2], tx[3]); const w = ti.width * vp.scale;
            while (i >= 0) { rects.push({ x: (tx[4] + w * i / s.length) * k, y: (tx[5] - fh) * k, w: Math.max(4, w * q.length / s.length) * k, h: fh * 1.15 * k }); i = s.indexOf(q, i + q.length); }
            snippets.push(ti.str);
          }
        } catch (_) {}
      }
      if (rects.length) res.push({ pg, n, rects, snippet: snippets[0] });
    }
    if (my !== tok) return;
    out.replaceChildren(...(res.length ? [h('p', { class: 'muted small' }, `${res.reduce((s, r) => s + r.rects.length, 0)} résultat(s) sur ${res.length} page(s)`)].concat(res.map((r) => h('button', { class: 'nb-row', type: 'button', role: 'listitem', onclick: () => { showHl(r.pg.id, r.rects); X.goPage(r.pg.id); if (narrow()) d.close(); } }, h('b', { class: 'num' }, `p. ${r.n}`), h('span', { class: 'tx' }, (r.snippet || '').slice(0, 90)), h('span', { class: 'muted small' }, String(r.rects.length)))))
      : [h('p', { class: 'muted' }, 'Aucun résultat. La recherche porte sur le texte des PDF et tes zones de texte (pas l’écriture manuscrite).')]));
  };
  let t = 0; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 250); });
  inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); run(); } });
  const d = U().dialog({ title: 'Rechercher', body: h('div', { class: 'nb-form' }, inp, out), wide: true, cls: 'ne-search-dlg' });
}
function showHl(pid, rects) {
  clearHl(); const e = E(); const pv = e.pvs.get(pid); if (!pv) return; const pg = pv.pg;
  rects.forEach((r) => pv.el.append(h('div', { class: 'ne-hl ne-ovl', style: `left:${r.x / pg.w * 100}%;top:${r.y / pg.h * 100}%;width:${r.w / pg.w * 100}%;height:${r.h / pg.h * 100}%` })));
  setTimeout(clearHl, 12000);
}
function clearHl() { document.querySelectorAll('.ne-hl').forEach((x) => x.remove()); }

/* ================= Miniatures de couverture (bibliothèque) ================= */
const covers = new Map();
N.thumbFor = (nbId) => {
  if (covers.has(nbId)) return covers.get(nbId);
  const p = (async () => {
    const nd = await S().get(N.paths.nbPath(nbId)); if (!nd) return null;
    const pg = Object.values(nd.pages || {}).filter(live).sort((a, b) => a.ord - b.ord)[0]; if (!pg) return null;
    const doc = await S().get(N.paths.pgPath(nbId, pg.id));
    const c = await R().renderPageImage(pg, Object.values((doc && doc.items) || {}).filter(live), 220);
    return c.toDataURL('image/jpeg', .75);
  })();
  covers.set(nbId, p); p.catch(() => covers.delete(nbId)); setTimeout(() => covers.delete(nbId), 120000);
  return p;
};
})();
