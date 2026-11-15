"""
Construit le site chiffré « Mon Q1 Biomed » pour GitHub Pages.

Entrées (jamais publiées) :
  <src>/data/horaire.json, quiz.json, cours.json, pdfs.json, agenda.json (Google Agenda), plan.json (plan d'études, objet),
  etude.json (QCM de l'étude guidée, objet { <id du PDF>: { titre, pages: { "<n°>": [ {q, c, e} ] } } })
  <src>/pdf/*.pdf
Sortie (à publier, à la racine du dépôt) :
  cfg.json        sel + itérations PBKDF2 (public, sans secret)
  data.enc        les 4 listes, chiffrées AES-256-GCM
  pdf/<nom>.enc   chaque PDF chiffré

Usage : SITE_PASSWORD=... python3 tools/build.py <src> <dossier_du_depot>
Le sel est conservé d'un build à l'autre (cfg.json existant) pour que le
mot de passe et la clé mémorisée sur les appareils restent valables.
"""
import base64, hashlib, json, os, sys
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ITER = 250_000

def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    pw = os.environ.get("SITE_PASSWORD", "").strip()
    if not pw:
        sys.exit("SITE_PASSWORD manquant")
    cfg_path = out / "cfg.json"
    if cfg_path.exists():
        cfg = json.loads(cfg_path.read_text())
        salt = base64.b64decode(cfg["salt"])
    else:
        salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, ITER, dklen=32)
    aes = AESGCM(key)

    def enc(data: bytes) -> bytes:
        iv = os.urandom(12)
        return iv + aes.encrypt(iv, data, None)

    bundle = {}
    for name in ("horaire", "quiz", "cours", "pdfs", "agenda", "annonces", "plan"):
        f = src / "data" / f"{name}.json"
        bundle[name] = json.loads(f.read_text(encoding="utf-8")) if f.exists() else []
    f = src / "data" / "etude.json"
    bundle["etude"] = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    # Plan d'études et étude guidée : s'ils ne sont pas fournis dans <src>, on garde ceux du build précédent
    keep_prev = [k for k in ("plan", "etude") if not (src / "data" / f"{k}.json").exists()]
    if keep_prev and (out / "data.enc").exists() and cfg_path.exists():
        try:
            u = (out / "data.enc").read_bytes()
            prev = json.loads(aes.decrypt(u[:12], u[12:], None))
            for k in keep_prev:
                if isinstance(prev.get(k), dict):
                    bundle[k] = prev[k]
        except Exception:
            pass
    from datetime import datetime, timezone
    bundle["maj"] = datetime.now(timezone.utc).isoformat(timespec="minutes")

    # PDFs : nom public opaque (hash) pour ne rien révéler du contenu
    pdf_out = out / "pdf"
    pdf_out.mkdir(parents=True, exist_ok=True)
    keep = set()
    for item in bundle["pdfs"]:
        p = src / "pdf" / item["fichier"]
        if not p.exists():
            item["enc"] = None
            continue
        h = hashlib.sha256(salt + item["fichier"].encode()).hexdigest()[:20]
        target = pdf_out / f"{h}.enc"
        target.write_bytes(enc(p.read_bytes()))
        item["enc"] = f"pdf/{h}.enc"
        keep.add(target.name)
    for old in pdf_out.glob("*.enc"):
        if old.name not in keep:
            old.unlink()

    (out / "data.enc").write_bytes(enc(json.dumps(bundle, ensure_ascii=False).encode()))
    cfg_path.write_text(json.dumps({"salt": base64.b64encode(salt).decode(), "iter": ITER}))
    et = bundle["etude"] if isinstance(bundle["etude"], dict) else {}
    n_et = sum(len(l) for d in et.values() for l in d.get("pages", {}).values())
    print(f"OK : {len(bundle['quiz'])} quiz, {len(bundle['horaire'])} séances, "
          f"{len(keep)} PDF chiffrés, {n_et} QCM d'étude guidée")

if __name__ == "__main__":
    main()
