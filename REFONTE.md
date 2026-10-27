# Refonte « bento » — plan de travail

Branche : `refonte-bento` (ne jamais pousser sur `main` : l'agent site y publie les données).
Maquettes de référence : canevas Claude Design https://claude.ai/artifact/614NQUVmfuxw8vYK6RyTnt
(lire un écran : outil Artifact, action `read`, `url` = le canevas, `path` = `project/<fichier>.dc.html`).

## Avancement (une case par lot, cochée par la tâche qui l'a terminé)

- [ ] Lot 1 — Base du thème : police, couleurs, cartes, boutons, puces, navigation en pilule, écran de connexion, mode sombre
- [ ] Lot 2 — Aujourd'hui : grille bento (iPad/PC) + version téléphone
- [ ] Lot 3 — Plan d'études, Semaine, Quiz
- [ ] Lot 4 — PDF, Cours (annonces + cours UV), lecteur PDF, minuteur
- [ ] Lot 5 — Cahiers : bibliothèque (couvertures en carnets) + éditeur (barre d'outils, pages, papier) ; puis relecture finale

## Écrans de référence par lot

| Lot | Fichiers du canevas |
|---|---|
| 1 | `J-Connexion.dc.html`, `Main.dc.html` (en-tête + navigation), `J-Sombre.dc.html`, `J-Telephone.dc.html` (barre du bas) |
| 2 | `Main.dc.html`, `J-Telephone.dc.html`, `J-Sombre.dc.html` |
| 3 | `J-Plan.dc.html`, `J-Semaine.dc.html`, `J-Quiz.dc.html` |
| 4 | `J-PDF.dc.html`, `J-Cours.dc.html`, `J-Lecteur.dc.html` |
| 5 | `J-Cahiers.dc.html`, `J-Cahier-Editeur.dc.html` |

Les textes entre [crochets], horaires, notes et pourcentages des maquettes sont des exemples : le site garde ses vraies données et ses vraies fonctions.

## Jetons de design

- Police : **Outfit** 400/500/600/700/800, auto-hébergée dans `vendor/fonts/` (woff2, via `npm pack @fontsource/outfit`), jamais chargée depuis Google (le site marche hors ligne). Poignée manuscrite des maquettes de l'éditeur : non utilisée dans le site (l'écriture est celle du Pencil).
- Clair : fond `#E9EBEE`, cartes `#FFFFFF`, texte `#111111`, texte secondaire `#555555`, remplissage `#F1F2F4`, filets `#EDEEF1`.
- Sombre : fond `#0E0F12`, cartes `#1A1C21`, texte `#F2F3F5`, secondaire `#A0A4AD`, remplissage `#2A2D34`.
- Accent : `#FF6A45` (texte posé dessus : `#111111`). Éléments forts (onglet actif, carte minuteur, boutons principaux) : `#111111` en clair, `#F2F3F5` en sombre.
- Matières (couleur / fond teinté / texte sur fond teinté) : Bio `#3D7BF7` / `#E6EEFF` / `#1D4FB8` · Chimie `#F08A24` / `#FFEBDD` / `#9A4A00` · Physique `#C9A100` / `#FFF4CC` / `#6B5300` · Maths `#C2367A` / `#FBE6F0` / `#9A1F5C` · Anatomie `#8B5CF6` / `#EFE7FF` / `#5B21B6` · Autre `#8E8E93` / `#EFEFF2` / `#444444`.
- Rayons : grandes cartes 28px, cartes moyennes 20–24px, puces et boutons en pilule (999px). Cibles tactiles ≥ 44px.
- Titres de page : 30px, graisse 800, interlettrage −0,02em. Libellés de carte : 14px, 600, couleur secondaire.
- Ombres : aucune sur les cartes (aplats), sauf les couvertures de carnets et la feuille de l'éditeur.
- Navigation : iPad/PC = barre pilule blanche en haut avec les 7 onglets en texte, onglet actif noir ; téléphone = pilule noire en bas, onglet actif couleur accent. Plus de rail latéral.

## Règles pour chaque lot

1. Ne touche ni aux données (`data.enc`, `pdf/`, `ayah/`, `cfg.json`) ni à `tools/`.
2. Garde toutes les fonctions existantes (filtres, coches, liens Moodle, minuteur, profils, synchro des Cahiers…) : on change l'apparence et la mise en page, pas le comportement.
3. Incrémente la version du cache dans `sw.js` pour que l'appareil charge la nouvelle version.
4. Vérifie avant de pousser : `node --check` sur chaque `.js` modifié et sur les scripts en ligne de `index.html` (extraits dans un fichier temporaire hors du dépôt).
5. Un commit par lot : « Refonte bento — lot N : … », puis coche la case du lot ici, dans le même commit.
