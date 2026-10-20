// Horaire TimeEdit du groupe B1-BIME-B7 (profil Ayah).
// À exécuter TEL QUEL avec javascript_tool dans le navigateur intégré, sur un onglet
// ouvert à https://cloud.timeedit.net/be_ulb/web/public/ (même origine, sinon CORS).
// Renvoie {n, a_preparer, b64} : b64 = horaire.json compressé gzip puis base64
// (le gzip a un CRC : une erreur de recopie est détectée au décodage).
// Décodage : echo "<b64>" | base64 -d | gunzip > horaire_b7.json
const t = (await fetch('/be_ulb/web/public/ri.ics?h=t&sid=11&p=0.m%2C20270131.x&objects=39539.6').then((r) => r.text())).replace(/\r?\n[ \t]/g, '');
const tz = (s) => { const m = s.match(/(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(Z?)/); if (!m) return null; const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])); return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(' ', 'T'); };
const un = (s) => (s || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
const MAT = { BIOLG1106: 'Bio', BIOLG1108: 'Bio', CHIMG1109: 'Chimie', CHIMG1110: 'Chimie', MATHG1101: 'Maths', PHYSG1105: 'Physique', PHYSG1106: 'Physique', MORFG1111: 'Anatomie' };
const out = [];
for (const b of t.split('BEGIN:VEVENT').slice(1)) {
  const g = (k) => { const m = b.match(new RegExp('\\n' + k + '(?:;[^:\\n]*)?:([^\\r\\n]*)')); return m ? m[1] : ''; };
  const sum = un(g('SUMMARY')), desc = un(g('DESCRIPTION')), loc = un(g('LOCATION'));
  const debut = tz(g('DTSTART')), fin = tz(g('DTEND'));
  const idm = desc.match(/ID (\d+)/); const id = idm ? idm[1] : g('UID');
  if (sum.startsWith('Info:')) { const j = (g('DTSTART').match(/(\d{4})(\d\d)(\d\d)/) || []).slice(1).join('-'); out.push({ id, jour: j, debut: j + 'T00:00', fin: j + 'T23:59', code: '', matiere: 'Congé', type: 'Congé', intitule: sum.replace(/^Info:\s*/, ''), local: '', prof: '', groupe_b6: false, a_preparer: false }); continue; }
  const parts = sum.split(',').map((s) => s.trim()); const code = parts[0]; if (!/^[A-Z]{4}G?\d{4}$/.test(code)) continue;
  let type = parts[1] || ''; if (/^[A-Z]{4}G?\d{4}$/.test(type) && code === 'MATHG1101' || /appui/i.test(type)) type = 'Appui pédagogique'; if (/^Info:/.test(type)) type = 'Info';
  const b7 = /B7/.test(parts.slice(1).join(','));
  const prof = [...desc.matchAll(/Enseignant:\s*([^\n|]+?)(?=,\s*Enseignant:|\n|\||$)/g)].map((m) => m[1].trim()).join(', ');
  // groupe_b6 = « séance de son groupe » (ici B7) : le site utilise ce nom de champ pour tous les profils
  out.push({ id, jour: debut.slice(0, 10), debut, fin, code, matiere: MAT[code] || code, type, intitule: desc.split(/\n|\|/)[0].trim(), local: loc || 'Local non précisé', prof, groupe_b6: b7, a_preparer: b7 && ['Séminaire', 'Exercices', 'Travaux pratiques'].includes(type) });
}
out.sort((a, b) => a.debut.localeCompare(b.debut));
const buf = new Uint8Array(await new Response(new Blob([JSON.stringify(out)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
let bin = ''; buf.forEach((c) => { bin += String.fromCharCode(c); });
({ n: out.length, a_preparer: out.filter((x) => x.a_preparer).length, b64: btoa(bin) });
