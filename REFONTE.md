# Refonte « bento » — plan de travail

Branche : `refonte-bento` (ne jamais pousser sur `main` : l'agent site y publie les données).
Maquettes de référence : canevas Claude Design https://claude.ai/artifact/614NQUVmfuxw8vYK6RyTnt
(lire un écran : outil Artifact, action `read`, `url` = le canevas, `path` = `project/<fichier>.dc.html`).

## Avancement (une case par lot, cochée par la tâche qui l'a terminé)

- [x] Lot 1 — Base du thème : police, couleurs, cartes, boutons, puces, navigation en pilule, écran de connexion, mode sombre
- [x] Lot 2 — Aujourd'hui : grille bento (iPad/PC) + version téléphone
- [x] Lot 3 — Plan d'études, Semaine, Quiz
- [ ] Lot 4 — PDF, Cours (annonces + cours UV), lecteur PDF, minuteur
- [ ] Lot 5 — Cahiers : bibliothèque (couvertures en carnets) + éditeur (barre d'outils, pages, papier) ; puis relecture finale
- [ ] Lot 6 — Animations sur tout le site (voir « Lot 6 — détail » plus bas)

## Écrans de référence par lot

| Lot | Fichiers du canevas |
|---|---|
| 1 | `J-Connexion.dc.html`, `Main.dc.html` (en-tête + navigation), `J-Sombre.dc.html`, `J-Telephone.dc.html` (barre du bas) |
| 2 | `Main.dc.html`, `J-Telephone.dc.html`, `J-Sombre.dc.html` |
| 3 | `J-Plan.dc.html`, `J-Semaine.dc.html`, `J-Quiz.dc.html` |
| 4 | `J-PDF.dc.html`, `J-Cours.dc.html`, `J-Lecteur.dc.html` |
| 5 | `J-Cahiers.dc.html`, `J-Cahier-Editeur.dc.html`, `J-Anim-Cahier.dc.html` (intérieur d'un cahier : barre d'outils, menus d'outil, pages, PDF annoté, carte de révision, audio) |
| 6 | `J-Animations.dc.html`, `J-Anim-Connexion.dc.html`, `J-Anim-Quiz.dc.html`, `J-Anim-Telephone.dc.html`, `J-Anim-Cahier.dc.html` (démos jouables : reprends leurs keyframes, durées et courbes) |

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

## Lot 6 — détail des animations

Principes : uniquement `transform` et `opacity` (fluide sur iPad), durées 150 à 600 ms, courbe `cubic-bezier(.2,.8,.2,1)` (rebond léger : `cubic-bezier(.3,1.3,.5,1)`), rien ne bloque une action, tout est coupé avec `prefers-reduced-motion: reduce`. Réutilise et étends `motion.js`. Chaque effet doit marcher en clair, en sombre, sur iPad, PC et téléphone, et pour les deux profils.

Vus dans la démo :
1. **Entrée en cascade** : à chaque ouverture d'onglet, les cartes apparaissent l'une après l'autre (montée de 16 px + fondu, ~90 ms d'écart).
2. **Pilule d'onglet qui glisse** : l'indicateur noir (haut) ou accent (téléphone, en bas) glisse vers l'onglet choisi avec un petit rebond.
3. **Cocher une tâche** (Aujourd'hui et Plan) : la case rebondit, le texte se barre, l'anneau de progression et le compteur « x/n » s'animent.
4. **Minuteur** : l'anneau se vide en continu, un point accent pulse pendant qu'il tourne, petite pulsation de la carte quand une session se termine.
5. **Ouvrir un cahier** : la couverture du carnet pivote (perspective) puis l'éditeur s'ouvre.
6. **Barres d'avancement** : elles se remplissent depuis la gauche à leur apparition.
7. **Appui sur les boutons** : léger enfoncement (scale .96) au toucher.

En plus :
8. **Passage d'un onglet à l'autre** : fondu + glissement court dans le sens de la navigation (vers la gauche ou vers la droite selon l'ordre des onglets).
9. **Pastilles « nouveau »** (PDF, annonces, cours) : petit « pop » à l'apparition.
10. **Toutes les tâches du jour faites** : petite pluie de confettis aux couleurs des matières, une seule fois par jour, sans bibliothèque externe (canvas ou éléments DOM, < 1,5 s).
11. **Chargement** : squelettes de cartes avec reflet qui passe (shimmer) pendant le déchiffrement des données, à la place d'un écran vide.
12. **Connexion** : le champ tremble en cas de mauvais mot de passe ; en cas de succès, la carte accent s'agrandit et laisse place au site.
13. **Lecteur PDF** : s'ouvre en montant depuis le bas (feuille), se ferme en redescendant.
14. **Thème clair/sombre** : fondu doux entre les deux (View Transitions API si disponible, sinon transition des couleurs).
15. **Quiz** : la note compte de 0 jusqu'à sa valeur et sa barre se remplit ; la moyenne aussi.
16. **Semaine** : le jour actuel s'encadre en noir avec une petite animation ; changer de semaine fait glisser les colonnes.
17. **Cahiers — bibliothèque** : les carnets se soulèvent légèrement au survol/appui (translateY −4 px, ombre plus marquée).
18. **Annonces importantes** : le point rouge pulse doucement deux fois à l'arrivée, puis s'arrête.

## Lot 5 — détail des Cahiers (tout doit passer au style bento)

On change l'interface autour de l'écriture, jamais l'écriture elle-même : ne touche pas au rendu des traits (perfect-freehand), au format des données des cahiers, à la synchro ni à l'export. Tout doit rester utilisable au Pencil sur iPad (cibles ≥ 44 px).

1. **Bibliothèque** : couvertures en carnets portrait (dos cousu, tranche des pages, élastique, étiquette matière), dossiers colorés, Favoris, PDF annotés, recherche, tri, sélection, corbeille, état de synchro, « Nouveau cahier » / import / transfert depuis Goodnotes, verrou par code. Cartes et menus en aplat arrondis.
2. **Éditeur** : barre d'outils en pilule blanche (stylo, plume, pinceau, surligneur, gomme, lasso, formes, texte, laser, ruban), couleurs favorites en pastilles, épaisseurs, annuler/rétablir, menu « Plus » ; panneau des pages en miniatures ; bureau gris clair (sombre en mode sombre) avec la feuille blanche à coins arrondis et ombre douce ; navigation de pages en pilule noire.
3. **Annotation de PDF** (bouton « Annoter » du lecteur et « Créer et annoter ») : même éditeur, même barre d'outils, les pages du PDF jouent le rôle du papier ; la transition depuis le lecteur doit rester fluide.
4. **Tous les panneaux et menus** : réglages d'outil, couleur personnalisée, modèles de page et papier (lignes, carreaux, points, Cornell…), insertion d'image/photo, signets, liens, enregistrement audio et lecture, recherche dans le cahier, actions du lasso (copier, couper, dupliquer, couleur, carte), cartes de révision et mode révision, export/partage PDF, mode présentation et pointeur laser, fenêtre de zoom, renommer/dupliquer/déplacer. Feuilles et popovers en cartes blanches arrondies (rayon 20–28 px), boutons en pilule, accent `#FF6A45` pour l'action principale.
5. **Mode sombre** des Cahiers cohérent avec le reste (fond `#0E0F12`, panneaux `#1A1C21`), la feuille garde sa couleur de papier choisie.
6. Si le lot ne tient pas en une seule fois : fais d'abord 1 et 2, pousse, et note « Reste à faire : 3, 4, 5 » sous le lot.
