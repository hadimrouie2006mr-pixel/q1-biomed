/* Cahiers : modèles de papier, géométrie des traits (perfect-freehand), rendu canvas, formes, tests de contact, export PDF. */
(() => {
'use strict';
const N = window.Q1Notes = window.Q1Notes || {};
const PF = window.PerfectFreehand;
const MM = 72 / 25.4;

/* ---------- Papier ---------- */
const PAPERC = { white: '#ffffff', cream: '#fbf6e8', dark: '#23272c' };
const paperColor = (pg) => PAPERC[pg.color] || '#ffffff';
const isDark = (pg) => pg.color === 'dark';
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
// Liste de primitives (communes au canvas et à l'export PDF)
function tplOps(pg) {
  const W = pg.w, H = pg.h, ops = [], kind = pg.tpl || 'blank';
  const L = (x1, y1, x2, y2, c = 'line', w = .6) => ops.push({ l: [x1, y1, x2, y2], c, w });
  const T = (x, y, s, size = 10, c = 'label') => ops.push({ t: [x, y, s, size], c });
  const lines = (sp, top = 72, left = 0, right = W, bottom = H - 36) => { for (let y = top; y <= bottom; y += sp) L(left, y, right, y); };
  if (kind === 'lined') lines(7.1 * MM);
  else if (kind === 'lined-wide') lines(8.7 * MM);
  else if (kind === 'grid5' || kind === 'grid7') {
    const sp = (kind === 'grid5' ? 5 : 7) * MM;
    for (let x = sp; x < W; x += sp) L(x, 0, x, H, 'faint', .45);
    for (let y = sp; y < H; y += sp) L(0, y, W, y, 'faint', .45);
  } else if (kind === 'dots') {
    const sp = 5 * MM; for (let y = sp; y < H; y += sp) for (let x = sp; x < W; x += sp) ops.push({ dot: [x, y, .85], c: 'dot' });
  } else if (kind === 'cornell') {
    const cue = Math.round(W * .3), sum = H - 2 * 72, top = 64;
    L(0, top, W, top, 'strong', 1); L(cue, top, cue, sum, 'margin', 1); L(0, sum, W, sum, 'strong', 1);
    for (let y = top + 7.1 * MM; y < sum - 4; y += 7.1 * MM) L(cue + 8, y, W - 18, y);
    T(18, top - 22, 'Titre / date', 9); T(18, top + 18, 'Questions, mots-clés', 9); T(18, sum + 20, 'Résumé', 9);
  } else if (kind === 'todo') {
    T(40, 58, 'À faire', 16, 'title'); L(40, 70, W - 40, 70, 'strong', 1);
    for (let y = 100; y < H - 40; y += 30) { ops.push({ r: [40, y - 13, 13, 13], c: 'strong', w: .9 }); L(64, y, W - 40, y); }
  } else if (kind === 'week') {
    T(36, 52, 'Semaine du ……………………', 14, 'title');
    const land = W > H, cols = land ? 4 : 2, rows = land ? 2 : 4, x0 = 36, y0 = 70, cw = (W - 72) / cols, ch = (H - y0 - 36) / rows;
    for (let i = 0; i < 8; i++) {
      const cx = x0 + (i % cols) * cw, cy = y0 + Math.floor(i / cols) * ch;
      ops.push({ r: [cx, cy, cw, ch], c: 'strong', w: .8 }); T(cx + 8, cy + 18, i < 7 ? DAYS[i] : 'Notes', 10, 'title');
      for (let y = cy + 30 + 6 * MM; y < cy + ch - 6; y += 6 * MM) L(cx + 8, y, cx + cw - 8, y, 'faint', .45);
    }
  } else if (kind === 'music') {
    const gap = 7, staffH = gap * 4, between = 34;
    for (let y = 60; y + staffH < H - 30; y += staffH + between) for (let k = 0; k < 5; k++) L(36, y + k * gap, W - 36, y + k * gap, 'strong', .6);
  }
  return ops;
}
function tplColor(pg, c) {
  if (isDark(pg)) return { line: 'rgba(255,255,255,.16)', faint: 'rgba(255,255,255,.10)', dot: 'rgba(255,255,255,.35)', strong: 'rgba(255,255,255,.28)', margin: 'rgba(255,120,110,.45)', label: 'rgba(255,255,255,.45)', title: 'rgba(255,255,255,.7)' }[c];
  return { line: 'rgba(70,110,170,.30)', faint: 'rgba(70,110,170,.20)', dot: 'rgba(60,70,90,.42)', strong: 'rgba(60,70,90,.40)', margin: 'rgba(210,70,60,.45)', label: 'rgba(60,70,90,.55)', title: 'rgba(40,45,55,.8)' }[c];
}
function drawTemplate(ctx, pg, minW = 0) {
  ctx.fillStyle = paperColor(pg); ctx.fillRect(0, 0, pg.w, pg.h);
  for (const o of tplOps(pg)) {
    const col = tplColor(pg, o.c);
    if (o.l) { ctx.strokeStyle = col; ctx.lineWidth = Math.max(o.w, minW); ctx.beginPath(); ctx.moveTo(o.l[0], o.l[1]); ctx.lineTo(o.l[2], o.l[3]); ctx.stroke(); }
    else if (o.r) { ctx.strokeStyle = col; ctx.lineWidth = Math.max(o.w, minW); ctx.strokeRect(o.r[0], o.r[1], o.r[2], o.r[3]); }
    else if (o.dot) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(o.dot[0], o.dot[1], Math.max(o.dot[2], minW * .7), 0, 6.283); ctx.fill(); }
    else if (o.t) { ctx.fillStyle = col; ctx.font = `${o.c === 'title' ? 700 : 400} ${o.t[3]}px "Atkinson Hyperlegible", system-ui, sans-serif`; ctx.fillText(o.t[2], o.t[0], o.t[1]); }
  }
}

/* ---------- Traits ---------- */
const PENS = {
  fountain: { thinning: .62, smoothing: .62, streamline: .42, start: { cap: true }, end: { cap: true } },
  ball: { thinning: .08, smoothing: .55, streamline: .45, start: { cap: true }, end: { cap: true } },
  brush: { thinning: .82, smoothing: .7, streamline: .35, start: { cap: true, taper: 6 }, end: { cap: true, taper: 10 } },
  hl: { thinning: 0, smoothing: .5, streamline: .5, start: { cap: false }, end: { cap: false } }
};
const ptsOf = (flat) => { const a = []; for (let i = 0; i < flat.length; i += 3) a.push([flat[i], flat[i + 1], flat[i + 2]]); return a; };
function outline(flat, it, last = true) {
  const o = PENS[it.tool === 'hl' ? 'hl' : (it.pen || 'fountain')];
  return PF.getStroke(ptsOf(flat), Object.assign({ size: it.size, simulatePressure: !!it.sim && it.tool !== 'hl', last }, o));
}
const r2 = (n) => Math.round(n * 100) / 100;
function svgD(pts) {
  const n = pts.length; if (!n) return '';
  if (n < 3) { const [x, y] = pts[0]; return `M ${r2(x)} ${r2(y)} Z`; }
  let d = `M ${r2(pts[0][0])} ${r2(pts[0][1])} Q`;
  for (let i = 0; i < n; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]; d += ` ${r2(x0)} ${r2(y0)} ${r2((x0 + x1) / 2)} ${r2((y0 + y1) / 2)}`; }
  return d + ' Z';
}
const pathCache = new WeakMap(), dCache = new WeakMap(), bbCache = new WeakMap();
function strokeD(it) { let d = dCache.get(it); if (d == null) { d = svgD(outline(it.pts, it)); dCache.set(it, d); } return d; }
function strokePath(it) { let p = pathCache.get(it); if (!p) { p = new Path2D(strokeD(it)); pathCache.set(it, p); } return p; }
function livePath(flat, it) { return new Path2D(svgD(outline(flat, it, false))); }

/* ---------- Formes ---------- */
function shapeD(it) {
  const p = it.pts; if (p.length < 4) return '';
  let d = `M ${r2(p[0])} ${r2(p[1])}`; for (let i = 2; i < p.length; i += 2) d += ` L ${r2(p[i])} ${r2(p[i + 1])}`;
  if (it.closed) d += ' Z';
  if (it.arrow && !it.closed && p.length >= 4) {
    const n = p.length, x2 = p[n - 2], y2 = p[n - 1], x1 = p[n - 4], y1 = p[n - 3], a = Math.atan2(y2 - y1, x2 - x1), L = Math.max(8, it.size * 4.5);
    d += ` M ${r2(x2 - L * Math.cos(a - .45))} ${r2(y2 - L * Math.sin(a - .45))} L ${r2(x2)} ${r2(y2)} L ${r2(x2 - L * Math.cos(a + .45))} ${r2(y2 - L * Math.sin(a + .45))}`;
  }
  return d;
}
function shapePath(it) { let p = pathCache.get(it); if (!p) { p = new Path2D(shapeD(it)); pathCache.set(it, p); } return p; }

/* ---------- Texte ---------- */
const FONTS = { sans: '"Atkinson Hyperlegible", system-ui, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, Menlo, Consolas, monospace' };
const fontCss = (it) => `${it.italic ? 'italic ' : ''}${it.bold ? '700 ' : '400 '}${it.fs}px ${FONTS[it.font] || FONTS.sans}`;
let mctx = null;
const measure = () => mctx || (mctx = document.createElement('canvas').getContext('2d'));
const layoutCache = new WeakMap();
function textLines(it, widthOf) {
  const out = [];
  for (const para of String(it.text || '').split('\n')) {
    const words = para.split(/(\s+)/); let line = '';
    for (const w of words) {
      const cand = line + w;
      if (line && widthOf(cand.trimEnd()) > it.w) {
        out.push(line.trimEnd()); line = w.trimStart();
        while (line && widthOf(line) > it.w && line.length > 1) { let k = line.length - 1; while (k > 1 && widthOf(line.slice(0, k)) > it.w) k--; out.push(line.slice(0, k)); line = line.slice(k); }
      } else line = cand;
    }
    out.push(line);
  }
  return out;
}
function textLayout(it) {
  let l = layoutCache.get(it); if (l) return l;
  const c = measure(); c.font = fontCss(it);
  const lines = textLines(it, (s) => c.measureText(s).width);
  l = { lines, lh: it.fs * 1.3, h: Math.max(it.fs * 1.3, lines.length * it.fs * 1.3) };
  layoutCache.set(it, l); return l;
}

/* ---------- Boîtes englobantes ---------- */
function boxCorners(it) {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2, c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [cx + u * it.w / 2 * c - v * it.h / 2 * s, cy + u * it.w / 2 * s + v * it.h / 2 * c]);
}
function itemH(it) { return it.type === 'tx' ? textLayout(it).h : it.h; }
function bbox(it) {
  let b = bbCache.get(it); if (b) return b;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
  if (it.type === 's') { for (let i = 0; i < it.pts.length; i += 3) add(it.pts[i], it.pts[i + 1]); const m = it.size; x0 -= m; y0 -= m; x1 += m; y1 += m; }
  else if (it.type === 'sh') { for (let i = 0; i < it.pts.length; i += 2) add(it.pts[i], it.pts[i + 1]); const m = it.size * (it.arrow ? 5 : 1); x0 -= m; y0 -= m; x1 += m; y1 += m; }
  else if (it.type === 'tp') { add(it.x1, it.y1); add(it.x2, it.y2); const m = it.size / 2 + 2; x0 -= m; y0 -= m; x1 += m; y1 += m; }
  else { boxCorners(Object.assign({}, it, { h: itemH(it) })).forEach(([x, y]) => add(x, y)); }
  b = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; bbCache.set(it, b); return b;
}

/* ---------- Images ---------- */
const imgs = new Map(); // sha -> ImageBitmap | 'loading' | 'missing'
const imgWaiters = new Set();
function getImg(sha) {
  const v = imgs.get(sha);
  if (v && v !== 'loading' && v !== 'missing') return v;
  if (!v) {
    imgs.set(sha, 'loading');
    N.store.blobGet(sha).then(async (b) => {
      if (!b) { imgs.set(sha, 'missing'); setTimeout(() => imgs.delete(sha), 20000); return; }
      const bmp = await createImageBitmap(new Blob([b.data], { type: b.mime }));
      imgs.set(sha, bmp); imgWaiters.forEach((cb) => cb(sha));
    }).catch(() => { imgs.set(sha, 'missing'); setTimeout(() => imgs.delete(sha), 20000); });
  }
  return null;
}
const onImage = (cb) => { imgWaiters.add(cb); return () => imgWaiters.delete(cb); };

/* ---------- Dessin des éléments ---------- */
const LAYER = { im: 0, s: 2, sh: 2, tx: 3, ln: 4, tp: 5 };
const layerOf = (it) => (it.type === 's' && it.tool === 'hl' ? 1 : LAYER[it.type] ?? 2);
function sortItems(list) { return list.sort((a, b) => (layerOf(a) - layerOf(b)) || ((a.z || 0) - (b.z || 0)) || (a.id < b.id ? -1 : 1)); }
function inkColor(c, pg) { return c; }
function drawBoxed(ctx, it, hgt, fn) {
  ctx.save(); const cx = it.x + it.w / 2, cy = it.y + hgt / 2;
  ctx.translate(cx, cy); if (it.rot) ctx.rotate(it.rot); ctx.translate(-it.w / 2, -hgt / 2); fn(); ctx.restore();
}
let tapePat = null;
function drawItem(ctx, it, pg, opts = {}) {
  if (it.type === 's') {
    ctx.fillStyle = inkColor(it.color, pg); ctx.globalAlpha = it.tool === 'hl' ? .5 : 1;
    ctx.fill(strokePath(it)); ctx.globalAlpha = 1;
  } else if (it.type === 'sh') {
    const p = shapePath(it);
    if (it.fill && it.closed) { ctx.fillStyle = it.color; ctx.globalAlpha = .22; ctx.fill(p); ctx.globalAlpha = 1; }
    ctx.strokeStyle = it.color; ctx.lineWidth = it.size; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(p);
  } else if (it.type === 'tx') {
    const L = textLayout(it);
    drawBoxed(ctx, it, L.h, () => {
      ctx.font = fontCss(it); ctx.fillStyle = it.color; ctx.textBaseline = 'alphabetic';
      L.lines.forEach((ln, i) => ctx.fillText(ln, 0, i * L.lh + it.fs * 1.02));
    });
  } else if (it.type === 'im') {
    const bmp = getImg(it.blob);
    drawBoxed(ctx, it, it.h, () => {
      if (!bmp) { ctx.fillStyle = 'rgba(120,130,140,.15)'; ctx.fillRect(0, 0, it.w, it.h); ctx.strokeStyle = 'rgba(120,130,140,.5)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.strokeRect(0, 0, it.w, it.h); ctx.setLineDash([]); return; }
      const cr = it.crop || [0, 0, 1, 1];
      ctx.drawImage(bmp, cr[0] * bmp.width, cr[1] * bmp.height, (cr[2] - cr[0]) * bmp.width, (cr[3] - cr[1]) * bmp.height, 0, 0, it.w, it.h);
    });
  } else if (it.type === 'tp') {
    ctx.save(); ctx.lineCap = 'butt';
    if (it.open && !opts.forceTape) {
      ctx.strokeStyle = it.color; ctx.globalAlpha = .55; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
      const a = Math.atan2(it.y2 - it.y1, it.x2 - it.x1), nx = -Math.sin(a) * it.size / 2, ny = Math.cos(a) * it.size / 2;
      ctx.beginPath(); ctx.moveTo(it.x1 + nx, it.y1 + ny); ctx.lineTo(it.x2 + nx, it.y2 + ny); ctx.moveTo(it.x1 - nx, it.y1 - ny); ctx.lineTo(it.x2 - nx, it.y2 - ny); ctx.stroke();
    } else {
      ctx.strokeStyle = it.color; ctx.lineWidth = it.size; ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke();
      if (!tapePat) { const c = document.createElement('canvas'); c.width = c.height = 12; const x = c.getContext('2d'); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; x.beginPath(); x.moveTo(-2, 14); x.lineTo(14, -2); x.stroke(); tapePat = ctx.createPattern(c, 'repeat'); }
      ctx.strokeStyle = tapePat; ctx.stroke();
    }
    ctx.restore();
  } else if (it.type === 'ln') {
    drawBoxed(ctx, it, it.h, () => { ctx.fillStyle = 'rgba(58,111,216,.08)'; ctx.fillRect(0, 0, it.w, it.h); ctx.strokeStyle = 'rgba(58,111,216,.65)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(0, 0, it.w, it.h); ctx.setLineDash([]); });
  }
}
function drawItems(ctx, items, pg, opts = {}) {
  const view = opts.view; // {x,y,w,h} en unités page : on saute ce qui est hors champ
  for (const it of items) {
    if (view) { const b = bbox(it); if (b.x > view.x + view.w || b.y > view.y + view.h || b.x + b.w < view.x || b.y + b.h < view.y) continue; }
    drawItem(ctx, it, pg, opts);
  }
}

/* ---------- Tests de contact ---------- */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx - px, y = ay + t * dy - py; return Math.sqrt(x * x + y * y);
}
function inBox(it, x, y, pad = 0) {
  const hgt = itemH(it), cx = it.x + it.w / 2, cy = it.y + hgt / 2, c = Math.cos(-(it.rot || 0)), s = Math.sin(-(it.rot || 0));
  const u = (x - cx) * c - (y - cy) * s, v = (x - cx) * s + (y - cy) * c;
  return Math.abs(u) <= it.w / 2 + pad && Math.abs(v) <= hgt / 2 + pad;
}
function pointInPoly(x, y, poly) { let inside = false; for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) { const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
function hit(it, x, y, r) {
  const b = bbox(it); if (x < b.x - r || y < b.y - r || x > b.x + b.w + r || y > b.y + b.h + r) return false;
  if (it.type === 's') { const p = it.pts, m = r + it.size / 2; if (p.length === 3) return Math.hypot(p[0] - x, p[1] - y) <= m; for (let i = 3; i < p.length; i += 3) if (segDist(x, y, p[i - 3], p[i - 2], p[i], p[i + 1]) <= m) return true; return false; }
  if (it.type === 'sh') { const p = it.pts, m = r + it.size / 2; for (let i = 2; i < p.length; i += 2) if (segDist(x, y, p[i - 2], p[i - 1], p[i], p[i + 1]) <= m) return true; if (it.closed && segDist(x, y, p[p.length - 2], p[p.length - 1], p[0], p[1]) <= m) return true; return !!(it.fill && it.closed && pointInPoly(x, y, p)); }
  if (it.type === 'tp') return segDist(x, y, it.x1, it.y1, it.x2, it.y2) <= it.size / 2 + r;
  return inBox(it, x, y, r);
}
function inLasso(it, poly) {
  if (it.type === 's' || it.type === 'sh') {
    const p = it.pts, st = it.type === 's' ? 3 : 2; let n = 0, k = 0; const step = Math.max(1, Math.floor(p.length / st / 40));
    for (let i = 0; i < p.length; i += st * step) { n++; if (pointInPoly(p[i], p[i + 1], poly)) k++; }
    return n > 0 && k / n >= .5;
  }
  if (it.type === 'tp') return pointInPoly((it.x1 + it.x2) / 2, (it.y1 + it.y2) / 2, poly);
  const hgt = itemH(it); return pointInPoly(it.x + it.w / 2, it.y + hgt / 2, poly);
}

/* ---------- Transformations (lasso) ---------- */
// m = [a, b, c, d, e, f] : x' = a x + c y + e ; y' = b x + d y + f
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function transformItem(it, m) {
  const n = Object.assign({}, it); delete n.t; delete n.d;
  const s = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])), ang = Math.atan2(m[1], m[0]);
  const r = (v) => Math.round(v * 100) / 100;
  if (it.type === 's') { const p = it.pts.slice(); for (let i = 0; i < p.length; i += 3) { const [x, y] = ap(m, p[i], p[i + 1]); p[i] = r(x); p[i + 1] = r(y); } n.pts = p; n.size = r(it.size * s); }
  else if (it.type === 'sh') { const p = it.pts.slice(); for (let i = 0; i < p.length; i += 2) { const [x, y] = ap(m, p[i], p[i + 1]); p[i] = r(x); p[i + 1] = r(y); } n.pts = p; n.size = r(it.size * s); }
  else if (it.type === 'tp') { [n.x1, n.y1] = ap(m, it.x1, it.y1); [n.x2, n.y2] = ap(m, it.x2, it.y2); n.size = r(it.size * s); }
  else {
    const hgt = itemH(it); const [cx, cy] = ap(m, it.x + it.w / 2, it.y + hgt / 2);
    n.w = r(it.w * s); const nh = hgt * s; if (it.type !== 'tx') n.h = r(it.h * s); else n.fs = r(it.fs * s);
    n.x = r(cx - n.w / 2); n.y = r(cy - nh / 2); n.rot = ((it.rot || 0) + ang) % (Math.PI * 2);
    if (Math.abs(n.rot) < 1e-4) n.rot = 0;
  }
  return n;
}
const mMul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];

/* ---------- Reconnaissance de formes ---------- */
function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let dmax = 0, idx = 0; const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i][0], pts[i][1], ax, ay, bx, by); if (d > dmax) { dmax = d; idx = i; } }
  if (dmax > eps) { const a = rdp(pts.slice(0, idx + 1), eps), b = rdp(pts.slice(idx), eps); return a.slice(0, -1).concat(b); }
  return [pts[0], pts[pts.length - 1]];
}
function recognize(flat, force) {
  const P = []; for (let i = 0; i < flat.length; i += 3) P.push([flat[i], flat[i + 1]]);
  if (P.length < 3) return null;
  let len = 0; for (let i = 1; i < P.length; i++) len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; P.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  const bw = x1 - x0, bh = y1 - y0, diag = Math.hypot(bw, bh); if (diag < 8) return null;
  const [sx, sy] = P[0], [ex, ey] = P[P.length - 1], gap = Math.hypot(ex - sx, ey - sy);
  const closed = gap < Math.max(14, .22 * Math.max(bw, bh)) && len > 2.2 * Math.max(bw, bh);
  const flatten = (arr) => arr.flat().map((v) => Math.round(v * 100) / 100);
  if (!closed) {
    const chord = gap; let dev = 0; P.forEach(([x, y]) => { dev = Math.max(dev, segDist(x, y, sx, sy, ex, ey)); });
    if (dev / Math.max(chord, 1) < .09 || (force && dev / Math.max(chord, 1) < .2)) return { kind: 'line', pts: flatten([[sx, sy], [ex, ey]]), closed: false };
    const v = rdp(P, .07 * diag);
    if (v.length >= 3 && v.length <= 4) { let ok = true; for (let i = 0; i < P.length && ok; i++) { let d = Infinity; for (let k = 1; k < v.length; k++) d = Math.min(d, segDist(P[i][0], P[i][1], v[k - 1][0], v[k - 1][1], v[k][0], v[k][1])); if (d > .08 * diag) ok = false; } if (ok) return { kind: 'poly', pts: flatten(v), closed: false }; }
    return force ? { kind: 'line', pts: flatten([[sx, sy], [ex, ey]]), closed: false } : null;
  }
  // forme fermée
  const ring = P.slice(); ring.push(P[0]);
  let v = rdp(ring, .085 * diag); if (v.length > 1 && Math.hypot(v[0][0] - v[v.length - 1][0], v[0][1] - v[v.length - 1][1]) < .12 * diag) v = v.slice(0, -1);
  // fusionner les sommets trop proches
  v = v.filter((p, i) => i === 0 || Math.hypot(p[0] - v[i - 1][0], p[1] - v[i - 1][1]) > .1 * diag);
  const ellipseErr = () => { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = bw / 2 || 1, ry = bh / 2 || 1; let e = 0; P.forEach(([x, y]) => { e += Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1); }); return e / P.length; };
  const ee = ellipseErr();
  if (v.length === 3 && ee > .09) return { kind: 'tri', pts: flatten(v), closed: true };
  if (v.length === 4 && ee > .07) {
    const ang = (a, b, c) => { const u = [a[0] - b[0], a[1] - b[1]], w = [c[0] - b[0], c[1] - b[1]]; return Math.abs(Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w) || 1)))) * 180 / Math.PI - 90); };
    let rect = true; for (let i = 0; i < 4; i++) if (ang(v[(i + 3) % 4], v[i], v[(i + 1) % 4]) > 22) rect = false;
    const tilt = Math.abs(((Math.atan2(v[1][1] - v[0][1], v[1][0] - v[0][0]) * 180 / Math.PI) % 90 + 90) % 90);
    if (rect && (tilt < 12 || tilt > 78)) return { kind: 'rect', pts: flatten([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]), closed: true };
    return { kind: 'poly', pts: flatten(v), closed: true };
  }
  if (ee < .2 || force) {
    let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = bw / 2, ry = bh / 2;
    if (Math.abs(rx - ry) / Math.max(rx, ry) < .13) rx = ry = (rx + ry) / 2;
    const out = []; for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return { kind: rx === ry ? 'circle' : 'ellipse', pts: flatten(out), closed: true };
  }
  if (v.length >= 3 && v.length <= 6) return { kind: 'poly', pts: flatten(v), closed: true };
  return null;
}
// Aimant d'angle pour les lignes : horizontal, vertical et 45° si on en est à moins de 7°
function snapAngle(x0, y0, x1, y1) {
  const len = Math.hypot(x1 - x0, y1 - y0); if (len < 1) return { x: x1, y: y1 };
  const a = Math.atan2(y1 - y0, x1 - x0), step = Math.PI / 4, m = Math.round(a / step) * step;
  if (Math.abs(a - m) > 7 * Math.PI / 180) return { x: x1, y: y1 };
  const l = len * Math.cos(a - m); return { x: x0 + l * Math.cos(m), y: y0 + l * Math.sin(m) };
}
// Mise au propre juste après la reconnaissance (ligne presque droite → parfaitement droite)
function tidyShape(sh) {
  if (sh.kind === 'line') { const p = sh.pts, e = snapAngle(p[0], p[1], p[2], p[3]); sh.pts = [p[0], p[1], Math.round(e.x * 100) / 100, Math.round(e.y * 100) / 100]; }
  return sh;
}
function shapeFrom(kind, x0, y0, x1, y1) {
  const f = (a) => a.flat().map((v) => Math.round(v * 100) / 100);
  if (kind === 'line' || kind === 'arrow') return { kind: 'line', pts: f([[x0, y0], [x1, y1]]), closed: false, arrow: kind === 'arrow' };
  const ax = Math.min(x0, x1), ay = Math.min(y0, y1), bx = Math.max(x0, x1), by = Math.max(y0, y1);
  if (kind === 'rect') return { kind, pts: f([[ax, ay], [bx, ay], [bx, by], [ax, by]]), closed: true };
  if (kind === 'tri') return { kind, pts: f([[(ax + bx) / 2, ay], [bx, by], [ax, by]]), closed: true };
  const cx = (ax + bx) / 2, cy = (ay + by) / 2, rx = (bx - ax) / 2, ry = (by - ay) / 2, out = [];
  for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return { kind: 'ellipse', pts: f(out), closed: true };
}

/* ---------- Gomme partielle : découper un trait ---------- */
function splitStroke(it, x, y, r) {
  const p = it.pts, m = r + it.size * .3, parts = []; let cur = [];
  for (let i = 0; i < p.length; i += 3) {
    if (Math.hypot(p[i] - x, p[i + 1] - y) <= m) { if (cur.length >= 6) parts.push(cur); cur = []; }
    else cur.push(p[i], p[i + 1], p[i + 2]);
  }
  if (cur.length >= 6) parts.push(cur);
  if (parts.length === 1 && parts[0].length === p.length) return null; // rien touché
  return parts;
}

/* ---------- Rendu d'une page dans un canvas (miniatures, images de sélection) ---------- */
async function renderPageImage(pg, items, widthPx, region) {
  const rg = region || { x: 0, y: 0, w: pg.w, h: pg.h };
  const k = widthPx / rg.w, c = document.createElement('canvas'); c.width = Math.max(1, Math.round(rg.w * k)); c.height = Math.max(1, Math.round(rg.h * k));
  const ctx = c.getContext('2d');
  if (region && region.transparent) { /* fond transparent */ }
  else {
    ctx.setTransform(k, 0, 0, k, -rg.x * k, -rg.y * k); drawTemplate(ctx, pg);
    if (pg.bg) await drawBg(ctx, pg, k, rg, c);
  }
  ctx.setTransform(k, 0, 0, k, -rg.x * k, -rg.y * k);
  const list = sortItems(items.slice());
  // attendre les images
  await Promise.all(list.filter((it) => it.type === 'im').map((it) => new Promise((res) => { if (getImg(it.blob)) return res(); const off = onImage((s) => { if (s === it.blob) { off(); res(); } }); setTimeout(() => { off(); res(); }, 4000); })));
  drawItems(ctx, list, pg, { forceTape: region && region.forceTape });
  return c;
}
async function drawBg(ctx, pg, k, rg, canvas) {
  if (pg.bg.kind === 'img') { const b = await N.store.blobGet(pg.bg.blob); if (b) { const bmp = await createImageBitmap(new Blob([b.data], { type: b.mime })); ctx.drawImage(bmp, 0, 0, pg.w, pg.h); } return; }
  if (pg.bg.kind === 'pdf') {
    const pdf = await N.pdfDoc(pg.bg.src); const page = await pdf.getPage(pg.bg.n);
    const vp1 = page.getViewport({ scale: 1 }), s = k * pg.w / vp1.width;
    const vp = page.getViewport({ scale: s });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    await page.render({ canvasContext: ctx, viewport: vp, transform: [1, 0, 0, 1, -rg.x * k, -rg.y * k] }).promise;
    ctx.restore();
  }
}

/* ---------- Export PDF vectoriel (pdf-lib) ---------- */
let pdfLibP = null;
function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  return pdfLibP || (pdfLibP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/pdf-lib-1.17.1.min.js'; s.onload = () => res(window.PDFLib); s.onerror = () => { pdfLibP = null; rej(new Error('pdf-lib')); }; document.head.append(s); }));
}
const hexRgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || '') ; const n = m ? parseInt(m[1], 16) : 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const parseRgba = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return { c: hexRgb(s), a: 1 }; const v = m[1].split(',').map(Number); return { c: [v[0] / 255, v[1] / 255, v[2] / 255], a: v[3] == null ? 1 : v[3] }; };
async function exportPdf(nbId, pageIds, onProgress) {
  const L = await loadPdfLib(); const { PDFDocument, rgb, StandardFonts, degrees } = L;
  const nd = await N.store.get(N.paths.nbPath(nbId)); const nb = N.index().nbs[nbId];
  const out = await PDFDocument.create(); out.setTitle(nb ? nb.title : 'Cahier'); out.setCreator('Mon Q1 Biomed');
  const srcs = new Map(), fonts = {};
  const font = async (it) => {
    const fam = it.font === 'serif' ? 'Times' : it.font === 'mono' ? 'Courier' : 'Helvetica';
    const map = { Helvetica: ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'], Times: ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'], Courier: ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'] }[fam];
    const key = map[(it.bold ? 1 : 0) + (it.italic ? 2 : 0)];
    return fonts[key] || (fonts[key] = await out.embedFont(StandardFonts[key]));
  };
  const okCh = new Map();
  const clean = (f, s) => [...s].map((ch) => { const k = f.name + ch; if (!okCh.has(k)) { try { f.encodeText(ch); f.widthOfTextAtSize(ch, 10); okCh.set(k, true); } catch (_) { okCh.set(k, false); } } return okCh.get(k) ? ch : (ch === '’' ? "'" : '?'); }).join('');
  const total = pageIds.length;
  for (let i = 0; i < total; i++) {
    const pg = nd.pages[pageIds[i]]; if (!pg || pg.gone) continue;
    onProgress && onProgress(i, total);
    let p, k = 1, ox = 0, oy = 0;
    if (pg.bg && pg.bg.kind === 'pdf') {
      let src = srcs.get(pg.bg.src);
      if (!src) { src = await PDFDocument.load(await N.pdfBytes(pg.bg.src), { ignoreEncryption: true }); srcs.set(pg.bg.src, src); }
      const [cp] = await out.copyPages(src, [pg.bg.n - 1]); p = out.addPage(cp);
      const box = p.getCropBox ? p.getCropBox() : p.getMediaBox(); const rot = (p.getRotation().angle || 0) % 360;
      if (rot === 90 || rot === 270) { p.setRotation(degrees(0)); }
      k = box.width / pg.w; ox = box.x; oy = box.y; p._q1h = box.height;
    } else {
      p = out.addPage([pg.w, pg.h]); p._q1h = pg.h;
      const pc = hexRgb(paperColor(pg)); if (pg.color && pg.color !== 'white') p.drawRectangle({ x: 0, y: 0, width: pg.w, height: pg.h, color: rgb(...pc) });
      for (const o of tplOps(pg)) {
        const { c, a } = parseRgba(tplColor(pg, o.c)); const col = rgb(...c);
        if (o.l) p.drawLine({ start: { x: o.l[0], y: pg.h - o.l[1] }, end: { x: o.l[2], y: pg.h - o.l[3] }, thickness: o.w, color: col, opacity: a });
        else if (o.r) p.drawRectangle({ x: o.r[0], y: pg.h - o.r[1] - o.r[3], width: o.r[2], height: o.r[3], borderColor: col, borderWidth: o.w, borderOpacity: a });
        else if (o.dot) p.drawCircle({ x: o.dot[0], y: pg.h - o.dot[1], size: o.dot[2], color: col, opacity: a });
        else if (o.t) { const f = fonts.Helvetica || (fonts.Helvetica = await out.embedFont(StandardFonts.Helvetica)); p.drawText(clean(f, o.t[2]), { x: o.t[0], y: pg.h - o.t[1], size: o.t[3], font: f, color: col, opacity: a }); }
      }
      if (pg.bg && pg.bg.kind === 'img') { const b = await N.store.blobGet(pg.bg.blob); if (b) { const im = b.mime === 'image/png' ? await out.embedPng(b.data) : await out.embedJpg(b.data); p.drawImage(im, { x: 0, y: 0, width: pg.w, height: pg.h }); } }
    }
    const H = p._q1h;
    const top = { x: ox, y: oy + H }; // origine SVG (haut gauche)
    const doc = await N.store.get(N.paths.pgPath(nbId, pg.id));
    const items = sortItems(Object.values((doc && doc.items) || {}).filter((it) => it && !it.gone));
    for (const it of items) {
      if (it.type === 's') {
        const d = strokeD(it); if (!d) continue;
        p.drawSvgPath(d, { x: top.x, y: top.y, scale: k, color: rgb(...hexRgb(it.color)), opacity: it.tool === 'hl' ? .5 : 1, borderWidth: 0 });
      } else if (it.type === 'sh') {
        const d = shapeD(it); if (!d) continue;
        if (it.fill && it.closed) p.drawSvgPath(d, { x: top.x, y: top.y, scale: k, color: rgb(...hexRgb(it.color)), opacity: .22, borderWidth: 0 });
        p.drawSvgPath(d, { x: top.x, y: top.y, scale: k, borderColor: rgb(...hexRgb(it.color)), borderWidth: it.size * k, borderLineCap: 1 });
      } else if (it.type === 'tx') {
        const f = await font(it); const lines = textLines(it, (s) => f.widthOfTextAtSize(clean(f, s), it.fs)); const lh = it.fs * 1.3, hgt = Math.max(lh, lines.length * lh);
        const cx = it.x + it.w / 2, cy = it.y + hgt / 2, rot = it.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
        lines.forEach((ln, j) => {
          const u = -it.w / 2, v = -hgt / 2 + j * lh + it.fs * 1.02; // origine de la ligne (repère page, y vers le bas)
          const px = cx + u * c - v * s, py = cy + u * s + v * c;
          p.drawText(clean(f, ln), { x: ox + px * k, y: oy + H - py * k, size: it.fs * k, font: f, color: rgb(...hexRgb(it.color)), rotate: degrees(-rot * 180 / Math.PI) });
        });
      } else if (it.type === 'im') {
        const b = await N.store.blobGet(it.blob); if (!b) continue;
        let bytes = b.data, mime = b.mime;
        const cr = it.crop; if (cr && (cr[0] > 0 || cr[1] > 0 || cr[2] < 1 || cr[3] < 1)) {
          const bmp = await createImageBitmap(new Blob([b.data], { type: b.mime })); const cw = Math.max(1, Math.round((cr[2] - cr[0]) * bmp.width)), ch = Math.max(1, Math.round((cr[3] - cr[1]) * bmp.height));
          const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; cv.getContext('2d').drawImage(bmp, cr[0] * bmp.width, cr[1] * bmp.height, cw, ch, 0, 0, cw, ch);
          bytes = await (await new Promise((r) => cv.toBlob(r, 'image/jpeg', .9))).arrayBuffer(); mime = 'image/jpeg';
        }
        const im = mime === 'image/png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const rot = it.rot || 0, a = -rot, w = it.w * k, hh = it.h * k;
        const C = [ox + (it.x + it.w / 2) * k, oy + H - (it.y + it.h / 2) * k];
        const x = C[0] - (w / 2 * Math.cos(a) - hh / 2 * Math.sin(a)), y = C[1] - (w / 2 * Math.sin(a) + hh / 2 * Math.cos(a));
        p.drawImage(im, { x, y, width: w, height: hh, rotate: degrees(a * 180 / Math.PI) });
      }
    }
  }
  onProgress && onProgress(total, total);
  return out.save();
}

N.R = { tplOps, drawTemplate, paperColor, PAPERC, strokePath, strokeD, livePath, shapePath, shapeD, textLayout, fontCss, FONTS, bbox, itemH, getImg, onImage, drawItem, drawItems, sortItems, hit, inLasso, inBox, pointInPoly, transformItem, mMul, ap, recognize, shapeFrom, snapAngle, tidyShape, splitStroke, renderPageImage, drawBg, exportPdf, loadPdfLib, boxCorners, segDist };
N.drawTemplate = drawTemplate;
})();
