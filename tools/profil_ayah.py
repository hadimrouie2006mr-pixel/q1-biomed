"""
Dérive les données du profil « Ayah » (groupe B7) à partir de celles de Hadi.

Usage : AYAH_PASSWORD=... python3 tools/profil_ayah.py <src_hadi> <src_ayah> <depot> [horaire_b7.json]

  <src_hadi>        dossier source de Hadi (data/*.json + pdf/), celui passé à build.py
  <src_ayah>        dossier à créer pour Ayah (jamais publié), à passer ensuite à build.py
  <depot>           racine du dépôt (pour relire l'ancien horaire d'Ayah si besoin)
  horaire_b7.json   horaire TimeEdit du groupe B7 (tools/horaire_b7.js). Absent ou vide :
                    on garde l'horaire de la dernière publication (ayah/data.enc).

Ce qu'Ayah reçoit de Hadi : quiz (sans notes ni tentatives), cours (sans dates de visite),
PDF, annonces (« pour toi » recalculé pour B7). Jamais : Google Agenda.
Ensuite : SITE_PASSWORD=$AYAH_PASSWORD python3 tools/build.py <src_ayah> <depot>/ayah
"""
import base64, hashlib, json, os, re, shutil, sys
from pathlib import Path

GROUPE = "B7"


def load(p, default):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def ancien_horaire(depot):
    pw = os.environ.get("AYAH_PASSWORD", "").strip()
    cfg, enc = Path(depot) / "ayah" / "cfg.json", Path(depot) / "ayah" / "data.enc"
    if not (pw and cfg.exists() and enc.exists()):
        return []
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    c = json.loads(cfg.read_text())
    key = hashlib.pbkdf2_hmac("sha256", pw.encode(), base64.b64decode(c["salt"]), c["iter"], dklen=32)
    u = enc.read_bytes()
    return json.loads(AESGCM(key).decrypt(u[:12], u[12:], None)).get("horaire", [])


def main():
    hs, out, depot = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    hor_file = sys.argv[4] if len(sys.argv) > 4 else None
    d = out / "data"
    if out.exists():
        shutil.rmtree(out)
    d.mkdir(parents=True)

    quiz = load(hs / "data/quiz.json", [])
    for q in quiz:
        q["note"] = q["tentative"] = q["statut"] = None

    cours = load(hs / "data/cours.json", [])
    for c in cours:
        c["dernier_acces"] = None

    annonces = load(hs / "data/annonces.json", [])
    for a in annonces:
        m = re.match(r"^((?:[BV]d?\d+)(?:\s*(?:,|et|&)\s*[BV]d?\d+)*)\s*:", a.get("titre", ""))
        if not m:
            continue  # annonce générale : identique pour tout le monde
        groupes = re.findall(r"[BV]d?\d+", m.group(1))
        avant = a.get("pour_toi")
        a["pour_toi"] = GROUPE in groupes
        if not a["pour_toi"]:
            a["important"] = False
        elif not avant:
            a["important"] = bool(re.search(r"annul|local|déplac|horaire|examen|échéance", a["titre"], re.I))

    horaire = load(hor_file, []) if hor_file else []
    source = "TimeEdit B7"
    if not horaire:
        horaire, source = ancien_horaire(depot), "ancien horaire (TimeEdit B7 indisponible)"

    for name, val in (("quiz", quiz), ("cours", cours), ("annonces", annonces),
                      ("pdfs", load(hs / "data/pdfs.json", [])), ("horaire", horaire), ("agenda", [])):
        (d / f"{name}.json").write_text(json.dumps(val, ensure_ascii=False), encoding="utf-8")
    # Plan d'études : le même que Hadi (s'il est fourni ; sinon build.py garde le précédent)
    if (hs / "data/plan.json").exists():
        shutil.copy(hs / "data/plan.json", d / "plan.json")
    if (hs / "pdf").exists():
        shutil.copytree(hs / "pdf", out / "pdf")
    print(f"Ayah : {len(horaire)} séances ({source}), {len(quiz)} quiz, {len(annonces)} annonces")


if __name__ == "__main__":
    main()
