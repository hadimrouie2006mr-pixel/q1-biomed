/* Cahiers : stockage local (IndexedDB) + synchronisation chiffrée entre appareils via GitHub.
   - Tout est chiffré AES-GCM avec la clé du site (KEY) avant d'être envoyé.
   - Branche orpheline « notes » du dépôt (jamais main) : notes/index.enc, notes/<cahier>.enc,
     notes/<cahier>/<page>.enc, notes/blobs/<sha256>.enc.
   - Fusion sans perte : chaque objet a un id, un horodatage t et l'appareil d ; dernier écrit gagne
     par objet ; les suppressions sont des pierres tombales { id, gone: true, t }. */
(() => {
'use strict';
const N = window.Q1Notes = window.Q1Notes || {};
let DBNAME = 'q1notes', TOKKEY = 'q1biomed.ghtok', CFGKEY = 'q1biomed.notesync';
const DEVKEY = 'q1biomed.dev';
let BRANCH = 'notes';
const API = 'https://api.github.com';
const DEFAULT_REPO = 'hadimrouie2006mr-pixel/q1-biomed';

let KEY = null, token = null;
let cfg = {};
const loadCfg = () => { try { cfg = JSON.parse(localStorage.getItem(CFGKEY)) || {}; } catch (_) { cfg = {}; } };
loadCfg();
// Autre profil (ex. « ayah ») : base locale, jeton, réglages et branche à part
function setProfile(id) {
  if (!id || dbp) return;
  DBNAME = 'q1notes-' + id; TOKKEY = 'q1biomed.ghtok.' + id; CFGKEY = 'q1biomed.notesync.' + id; BRANCH = 'notes-' + id; loadCfg();
}
const saveCfg = () => { try { localStorage.setItem(CFGKEY, JSON.stringify(cfg)); } catch (_) {} };
const repo = () => cfg.repo || DEFAULT_REPO;
const dev = (() => { try { let d = localStorage.getItem(DEVKEY); if (!d) { d = Math.random().toString(36).slice(2, 8); localStorage.setItem(DEVKEY, d); } return d; } catch (_) { return Math.random().toString(36).slice(2, 8); } })();
let lastT = 0;
const stamp = () => { const n = Date.now(); lastT = n > lastT ? n : lastT + 1; return lastT; };
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- Événements ---------- */
const listeners = {};
const on = (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); return () => { listeners[ev] = listeners[ev].filter((x) => x !== cb); }; };
const emit = (ev, ...a) => (listeners[ev] || []).forEach((cb) => { try { cb(...a); } catch (e) { console.warn(e); } });

/* ---------- IndexedDB ---------- */
let dbp = null;
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
function db() {
  return dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DBNAME, 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('docs', { keyPath: 'path' }); d.createObjectStore('blobs', { keyPath: 'sha' }); d.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
const store = async (name, mode) => (await db()).transaction(name, mode).objectStore(name);
const idbGet = async (name, key) => reqP((await store(name, 'readonly')).get(key));
const idbPut = async (name, val, key) => reqP((await store(name, 'readwrite')).put(val, key));
const idbAll = async (name) => reqP((await store(name, 'readonly')).getAll());
const idbKeys = async (name) => reqP((await store(name, 'readonly')).getAllKeys());

/* ---------- Chiffrement ---------- */
const enc8 = (s) => new TextEncoder().encode(s), dec8 = (b) => new TextDecoder().decode(b);
async function encryptBytes(bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, KEY, bytes));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
}
async function decryptBytes(buf) { const u = new Uint8Array(buf); return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, KEY, u.slice(12))); }
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
async function sealJSON(obj) {
  const json = enc8(JSON.stringify(obj)); let flag = 0, body = json;
  if (typeof CompressionStream === 'function') { try { body = await pipe(json, new CompressionStream('gzip')); flag = 1; } catch (_) { body = json; flag = 0; } }
  const plain = new Uint8Array(body.length + 1); plain[0] = flag; plain.set(body, 1); return encryptBytes(plain);
}
async function openJSON(buf) {
  const p = await decryptBytes(buf); let body = p.subarray(1);
  if (p[0] === 1) body = await pipe(body, new DecompressionStream('gzip'));
  return JSON.parse(dec8(body));
}
async function sealBlob(bytes, mime) {
  const m = enc8(mime || 'application/octet-stream').slice(0, 255);
  const plain = new Uint8Array(2 + m.length + bytes.length); plain[0] = 2; plain[1] = m.length; plain.set(m, 2); plain.set(bytes, 2 + m.length);
  return encryptBytes(plain);
}
async function openBlob(buf) { const p = await decryptBytes(buf); const n = p[1]; return { mime: dec8(p.subarray(2, 2 + n)), data: p.slice(2 + n).buffer }; }
const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const sha256 = async (buf) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');

/* ---------- Documents (cache mémoire + IndexedDB) ---------- */
// Un document = { collection: { id: objet } }. Chemins : notes/index.enc, notes/<cahier>.enc, notes/<cahier>/<page>.enc
const docs = new Map();          // path -> { path, data, ver }
let st = { rsha: {}, dirty: [], head: null, tree: {} }; // état de synchro (persisté dans kv)
const dirty = new Set();
let ready = null;

const newer = (a, b) => ((a.t || 0) !== (b.t || 0) ? (a.t || 0) > (b.t || 0) : String(a.d || '') > String(b.d || ''));
function mergeInto(local, remote) {
  let changed = false, localNewer = false;
  for (const k of Object.keys(remote || {})) {
    const R = remote[k]; if (!R || typeof R !== 'object') continue;
    const L = local[k] || (local[k] = {});
    for (const id of Object.keys(R)) {
      const r = R[id], l = L[id];
      if (!r || typeof r !== 'object') continue;
      if (!l || newer(r, l)) { L[id] = r; changed = true; } else if (newer(l, r)) localNewer = true;
    }
    for (const id of Object.keys(L)) if (!(id in R)) localNewer = true;
  }
  for (const k of Object.keys(local)) if (!(k in (remote || {})) && local[k] && Object.keys(local[k]).length) localNewer = true;
  return { changed, localNewer };
}

async function loadState() { const s = await idbGet('kv', 'sync'); if (s) st = Object.assign(st, s); st.dirty.forEach((p) => dirty.add(p)); }
let stateTimer = 0;
const saveState = () => { clearTimeout(stateTimer); stateTimer = setTimeout(() => { st.dirty = [...dirty]; idbPut('kv', st, 'sync').catch(() => {}); }, 150); };

async function get(path) {
  await ready;
  if (docs.has(path)) return docs.get(path).data;
  const rec = await idbGet('docs', path);
  if (!rec) return null;
  if (docs.has(path)) return docs.get(path).data; // chargé entre-temps
  docs.set(path, { path, data: rec.data, ver: 0 });
  return rec.data;
}
async function ensure(path, init) {
  const d = await get(path); if (d) return d;
  const data = init || {}; docs.set(path, { path, data, ver: 1 }); put(path); return data;
}
const saveTimers = new Map();
function writeLocal(path) {
  const rec = docs.get(path); if (!rec) return Promise.resolve();
  return idbPut('docs', { path, data: rec.data }).catch((e) => { console.warn('IDB', e); setStatus('error', 'Stockage local plein ou indisponible'); });
}
function put(path) {
  const rec = docs.get(path); if (!rec) return;
  rec.ver++; dirty.add(path); saveState();
  if (saveTimers.has(path)) clearTimeout(saveTimers.get(path)); else pendingWrites++;
  setStatus(computeStatus());
  saveTimers.set(path, setTimeout(() => { saveTimers.delete(path); writeLocal(path).finally(() => { pendingWrites = Math.max(0, pendingWrites - 1); setStatus(computeStatus()); }); }, 300));
  schedulePush();
}
let pendingWrites = 0;
async function flush() {
  const ps = [];
  for (const [path, t] of saveTimers) { clearTimeout(t); saveTimers.delete(path); ps.push(writeLocal(path).finally(() => { pendingWrites = Math.max(0, pendingWrites - 1); })); }
  st.dirty = [...dirty]; ps.push(idbPut('kv', st, 'sync').catch(() => {}));
  await Promise.all(ps); setStatus(computeStatus());
}
// Met un objet dans une collection d'un document (horodatage + appareil)
function setObj(path, coll, obj) {
  const rec = docs.get(path); if (!rec) throw new Error('doc non chargé ' + path);
  obj.t = stamp(); obj.d = dev;
  (rec.data[coll] = rec.data[coll] || {})[obj.id] = obj; put(path); return obj;
}
const tomb = (id) => ({ id, gone: true });

/* ---------- Fichiers (images, audio, PDF importés) ---------- */
const blobCache = new Map();
async function blobPut(data, mime) {
  await ready;
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const sha = await sha256(u8);
  const ex = await idbGet('blobs', sha);
  if (!ex) await idbPut('blobs', { sha, mime, data: u8.slice().buffer, up: false });
  schedulePush(); return sha;
}
async function blobGet(sha) {
  await ready;
  if (blobCache.has(sha)) return blobCache.get(sha);
  const p = (async () => {
    const rec = await idbGet('blobs', sha);
    if (rec) return { mime: rec.mime, data: rec.data };
    // pas en local : télécharger depuis GitHub
    if (!token || !KEY) return null;
    try {
      if (!st.tree['notes/blobs/' + sha + '.enc']) await refreshHead();
      const bsha = st.tree['notes/blobs/' + sha + '.enc']; if (!bsha) return null;
      const buf = await gh('GET', `/git/blobs/${bsha}`, null, true);
      const b = await openBlob(buf);
      await idbPut('blobs', { sha, mime: b.mime, data: b.data, up: true });
      return b;
    } catch (e) { return null; }
  })();
  blobCache.set(sha, p);
  const r = await p; if (!r) blobCache.delete(sha);
  return r;
}

/* ---------- GitHub ---------- */
async function gh(method, path, body, raw) {
  const [o, r] = repo().split('/');
  const res = await fetch(`${API}/repos/${o}/${r}${path}`, {
    method, cache: 'no-store',
    headers: Object.assign({ Authorization: 'Bearer ' + token, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) { const e = new Error('GitHub ' + res.status); e.status = res.status; try { e.body = await res.json(); } catch (_) {} throw e; }
  if (raw) return res.arrayBuffer();
  return res.status === 204 ? null : res.json();
}
async function getHead() {
  try {
    // matching-refs répond 200 + [] si la branche n'existe pas (pas d'erreur 404 dans la console)
    const refs = await gh('GET', `/git/matching-refs/heads/${BRANCH}`);
    const ref = (refs || []).find((r) => r.ref === `refs/heads/${BRANCH}`);
    if (!ref) return null;
    const sha = ref.object.sha;
    if (sha === st.head && st.headTree) return { commit: sha, tree: st.headTree };
    const c = await gh('GET', `/git/commits/${sha}`);
    return { commit: sha, tree: c.tree.sha };
  } catch (e) { if (e.status === 404 || e.status === 409) return null; throw e; }
}
async function createBranch() {
  const b = await gh('POST', '/git/blobs', { content: 'Cahiers chiffrés de « Mon Q1 Biomed » (AES-GCM). Illisibles sans le mot de passe du site.\n', encoding: 'utf-8' });
  const t = await gh('POST', '/git/trees', { tree: [{ path: 'README.md', mode: '100644', type: 'blob', sha: b.sha }] });
  const c = await gh('POST', '/git/commits', { message: 'Cahiers : création de la branche', tree: t.sha, parents: [] });
  try { await gh('POST', '/git/refs', { ref: `refs/heads/${BRANCH}`, sha: c.sha }); } catch (e) { if (e.status !== 422) throw e; }
}
async function refreshHead() { const head = await getHead(); if (head && head.commit !== st.head) await pull(head); return head; }

async function pull(head) {
  const tr = await gh('GET', `/git/trees/${head.tree}?recursive=1`);
  const tree = {};
  for (const e of tr.tree || []) if (e.type === 'blob' && e.path.startsWith('notes/')) tree[e.path] = e.sha;
  const changedPaths = [];
  const paths = Object.keys(tree).filter((p) => !p.startsWith('notes/blobs/') && tree[p] !== st.rsha[p]);
  // index d'abord, puis le reste (4 en parallèle)
  paths.sort((a, b) => (a === 'notes/index.enc' ? -1 : b === 'notes/index.enc' ? 1 : a.localeCompare(b)));
  let i = 0;
  const worker = async () => {
    while (i < paths.length) {
      const p = paths[i++], sha = tree[p];
      try {
        const remote = await openJSON(await gh('GET', `/git/blobs/${sha}`, null, true));
        const local = await get(p);
        if (!local) { docs.set(p, { path: p, data: remote, ver: 0 }); await writeLocal(p); changedPaths.push(p); }
        else {
          const { changed, localNewer } = mergeInto(local, remote);
          if (changed) { await writeLocal(p); changedPaths.push(p); }
          if (localNewer) dirty.add(p);
        }
        st.rsha[p] = sha;
      } catch (e) { if (e.name === 'OperationError') { setStatus('error', 'Données distantes illisibles (mot de passe différent ?)'); } throw e; }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  // fichiers marqués « envoyés » mais absents du dépôt (branche recréée) : à renvoyer
  for (const p of Object.keys(st.rsha)) if (!tree[p]) { delete st.rsha[p]; if (docs.has(p) || (await idbGet('docs', p))) dirty.add(p); }
  st.tree = tree; st.head = head.commit; st.headTree = head.tree; saveState();
  if (changedPaths.length) emit('change', changedPaths, 'remote');
}

async function push(head) {
  const paths = [...dirty];
  const entries = [], done = [];
  for (const p of paths) {
    const data = await get(p); if (!data) { dirty.delete(p); continue; }
    const ver = docs.get(p).ver;
    const sealed = await sealJSON(data);
    const b = await gh('POST', '/git/blobs', { content: toB64(sealed), encoding: 'base64' });
    entries.push({ path: p, mode: '100644', type: 'blob', sha: b.sha }); done.push([p, b.sha, ver]);
  }
  // fichiers (images, audio, PDF) pas encore envoyés
  const blobsUp = [];
  for (const rec of await idbAll('blobs')) {
    if (rec.up) continue;
    const path = 'notes/blobs/' + rec.sha + '.enc';
    if (st.tree[path]) { blobsUp.push(rec); continue; }
    const sealed = await sealBlob(new Uint8Array(rec.data), rec.mime);
    const b = await gh('POST', '/git/blobs', { content: toB64(sealed), encoding: 'base64' });
    entries.push({ path, mode: '100644', type: 'blob', sha: b.sha }); blobsUp.push(rec); done.push([path, b.sha, -1]);
  }
  if (!entries.length) { for (const rec of blobsUp) { rec.up = true; await idbPut('blobs', rec); } return true; }
  const t = await gh('POST', '/git/trees', { base_tree: head.tree, tree: entries });
  const c = await gh('POST', '/git/commits', { message: `Cahiers : synchro (${dev})`, tree: t.sha, parents: [head.commit] });
  try { await gh('PATCH', `/git/refs/heads/${BRANCH}`, { sha: c.sha, force: false }); }
  catch (e) { if (e.status === 409 || e.status === 422) return false; throw e; }
  for (const [p, sha, ver] of done) {
    st.tree[p] = sha;
    if (ver >= 0) { st.rsha[p] = sha; if (docs.get(p) && docs.get(p).ver === ver) dirty.delete(p); }
  }
  for (const rec of blobsUp) { rec.up = true; await idbPut('blobs', rec); }
  st.head = c.sha; st.headTree = t.sha; saveState();
  return true;
}

/* ---------- Planification ---------- */
let busy = false, again = false, pushTimer = 0, pollTimer = 0, active = false, lastErr = '', backoff = 0;
const online = () => navigator.onLine !== false;
function schedulePush(ms = 3000) {
  if (!token) return;
  clearTimeout(pushTimer); pushTimer = setTimeout(() => syncNow(), ms);
}
async function hasLocalBlobsToSend() { try { return (await idbAll('blobs')).some((b) => !b.up); } catch (_) { return false; } }
async function syncNow() {
  if (!token || !KEY) { setStatus(computeStatus()); return; }
  if (!online()) { setStatus('offline'); return; }
  if (busy) { again = true; return; }
  busy = true; setStatus('syncing');
  try {
    await flush();
    let ok = false;
    for (let attempt = 0; attempt < 6 && !ok; attempt++) {
      let head = await getHead();
      if (head && head.commit !== st.head) await pull(head);
      if (!dirty.size && !(await hasLocalBlobsToSend())) { ok = true; break; }
      if (!head) { await createBranch(); head = await getHead(); if (!head) throw new Error('branche'); await pull(head); }
      ok = await push(head);
      if (!ok) await new Promise((r) => setTimeout(r, 300 + attempt * 400));
    }
    lastErr = ''; backoff = 0; cfg.lastSync = Date.now(); saveCfg();
    setStatus(dirty.size ? 'pending' : 'synced');
  } catch (e) {
    console.warn('Synchro', e);
    if (!online() || e instanceof TypeError) setStatus('offline');
    else {
      lastErr = e.status === 401 ? 'Jeton refusé ou expiré : reconnecte cet appareil.' : e.status === 403 ? 'Le jeton n’a pas le droit d’écrire (Contents : Read and write).' : e.status === 404 ? 'Dépôt introuvable avec ce jeton.' : (lastErr || 'Erreur de synchronisation, nouvel essai bientôt.');
      setStatus('error', lastErr);
      backoff = Math.min(300000, (backoff || 15000) * 2); schedulePush(backoff);
    }
  } finally {
    busy = false;
    if (again) { again = false; schedulePush(500); }
  }
}
function setActive(v) {
  active = v; clearInterval(pollTimer);
  if (v && token) pollTimer = setInterval(() => { if (!document.hidden) syncNow(); }, 60000);
}

/* ---------- État affiché ---------- */
let status = 'local', statusMsg = '';
function computeStatus() {
  if (pendingWrites > 0) return 'saving';
  if (!token) return 'local';
  if (!online()) return 'offline';
  if (busy) return 'syncing';
  if (lastErr) return 'error';
  return dirty.size ? 'pending' : 'synced';
}
function setStatus(s, msg) { status = s; statusMsg = msg || (s === 'error' ? lastErr : ''); emit('status', status, statusMsg); }
const STATUS_TEXT = { saving: 'Enregistrement…', local: 'Enregistré', saved: 'Enregistré', syncing: 'Synchronisation…', synced: 'Synchronisé', pending: 'Enregistré, synchro en attente', offline: 'Hors ligne, synchro en attente', error: 'Synchro en erreur' };

/* ---------- Jeton ---------- */
async function loadToken() {
  try { const raw = localStorage.getItem(TOKKEY); if (!raw) return null; return dec8(await decryptBytes(fromB64(raw))); } catch (_) { return null; }
}
async function setToken(t) {
  token = t; const sealed = await encryptBytes(enc8(t));
  try { localStorage.setItem(TOKKEY, toB64(sealed)); } catch (_) {}
  lastErr = ''; setActive(active); emit('token', true); syncNow();
}
function disconnect() {
  token = null; try { localStorage.removeItem(TOKKEY); } catch (_) {}
  clearInterval(pollTimer); clearTimeout(pushTimer); lastErr = ''; setStatus(computeStatus()); emit('token', false);
}
async function testToken(t) {
  const old = token; token = t;
  try {
    const [o, r] = repo().split('/');
    const res = await fetch(`${API}/repos/${o}/${r}`, { cache: 'no-store', headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (res.status === 401) return { ok: false, msg: 'Jeton refusé : vérifie que tu l’as copié en entier.' };
    if (res.status === 404 || res.status === 403) return { ok: false, msg: 'Ce jeton n’a pas accès au dépôt q1-biomed. Choisis « Only select repositories » › q1-biomed.' };
    if (!res.ok) return { ok: false, msg: 'GitHub répond ' + res.status + '. Réessaie dans un instant.' };
    let head = null;
    try { head = await getHead(); } catch (e) { return { ok: false, msg: 'Accès au contenu refusé : coche Contents › Read and write.' }; }
    return { ok: true, msg: head ? 'Connexion réussie. Tes cahiers vont se synchroniser.' : 'Connexion réussie. La branche « notes » sera créée au premier envoi.' };
  } catch (e) { return { ok: false, msg: 'Pas de connexion à GitHub. Vérifie ton réseau.' }; }
  finally { token = old; }
}

/* ---------- Sauvegarde complète (export / import) ---------- */
async function exportAll() {
  await flush();
  const out = { app: 'q1biomed-cahiers', v: 1, date: new Date().toISOString(), docs: {}, blobs: {} };
  for (const rec of await idbAll('docs')) out.docs[rec.path] = docs.has(rec.path) ? docs.get(rec.path).data : rec.data;
  for (const b of await idbAll('blobs')) out.blobs[b.sha] = { mime: b.mime, b64: toB64(new Uint8Array(b.data)) };
  return out;
}
async function importAll(obj) {
  if (!obj || obj.app !== 'q1biomed-cahiers' || !obj.docs) throw new Error('Fichier de sauvegarde non reconnu');
  let n = 0; const changed = [];
  for (const [sha, b] of Object.entries(obj.blobs || {})) { if (!(await idbGet('blobs', sha))) { const u = fromB64(b.b64); await idbPut('blobs', { sha, mime: b.mime, data: u.buffer, up: false }); } }
  for (const [path, data] of Object.entries(obj.docs)) {
    if (!/^notes\/[\w./-]+\.enc$/.test(path)) continue;
    const local = await get(path);
    if (!local) docs.set(path, { path, data, ver: 0 }); else mergeInto(local, data);
    put(path); changed.push(path); n++;
  }
  await flush(); emit('change', changed, 'import'); return n;
}

/* ---------- Démarrage ---------- */
async function init(key) {
  KEY = key;
  ready = (async () => { await db(); await loadState(); })();
  await ready;
  token = await loadToken();
  setStatus(computeStatus());
  if (token) syncNow();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flush(); if (token && (dirty.size)) syncNow(); }
    else if (token) syncNow();
  });
  window.addEventListener('pagehide', () => { flush(); });
  window.addEventListener('online', () => { setStatus(computeStatus()); if (token) syncNow(); });
  window.addEventListener('offline', () => setStatus(computeStatus()));
}

N.store = {
  init, get, ensure, put, setObj, tomb, flush, stamp, uid, dev, on, mergeInto,
  blobPut, blobGet, syncNow, setActive, setToken, disconnect, testToken,
  hasToken: () => !!token, status: () => status, statusMsg: () => statusMsg, statusText: (s) => STATUS_TEXT[s || status] || '',
  repo, setRepo: (r) => { cfg.repo = r; saveCfg(); }, lastSync: () => cfg.lastSync || 0, get branch() { return BRANCH; }, setProfile,
  exportAll, importAll, allDocPaths: () => idbKeys('docs'),
  _debug: () => ({ st, dirty: [...dirty] })
};
})();
