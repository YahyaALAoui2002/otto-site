# Otto — Réponse au feedback V1 ("3/10, trop générique")

**Contexte :** suite au résumé de projet du 3 septembre 2026 (Stage 6, en révision) et au retour de Yahya sur la V1. Ce document tranche la direction avant de poursuivre le build — à intégrer dans `clients/otto/projects/otto-site-V1/` et référencer dans `run.json`.

---

## 1. Décision sur la piste "reveal vidéo façon pub de chaîne"

**Rejetée telle que proposée.**

Raison : contredit directement deux points déjà actés en Gate B (`docs/03-direction-creative.md`) :
- §1 rejette explicitement le registre "futuriste" / non-"sans chichis"
- §10 exclut tout effet non justifié par une raison tenue au brief

Une animation "ingrédients qui tombent façon pub de burger" importe un langage visuel de fast-food industriel sur une marque positionnée exactement à l'opposé (trattoria de quartier, artisanale, four à bois, "sans détour"). Risque : remplacer un problème ("trop générique") par un autre ("hors-marque").

**Ce n'est pas un rejet de l'ambition "plus interactif/mémorable"** — c'est un rejet de cette exécution précise.

---

## 2. Diagnostic révisé du "3/10"

Le layout actuel respecte la direction créative à la lettre (couleurs, typo, structure), mais applique un patron de mise en page très standard (hero + 3 colonnes égales + carte en liste). La cause probable du "générique" n'est pas un manque d'animation — c'est que **l'actif le plus différenciant d'Otto (les illustrations dessinées à la main : olivier, cyprès, Vespa) reste mineur dans l'exécution actuelle**, alors que c'est précisément ce qui rend Otto reconnaissable et pas un template.

## 3. Direction retenue pour la suite

**Priorité 1 — traiter le générique par la mise en page, à coût crédit nul :**
- Rendre les illustrations plus présentes et assumées (pas juste des touches en scroll-reveal ponctuel, mais un vrai rôle dans la composition)
- Casser la symétrie du hero et des 3 colonnes "piliers" — trouver une mise en page moins interchangeable
- Donner plus de respiration typographique aux moments de marque (tagline, avis) — laisser le Fraunces/Cormorant Garamond respirer au lieu de rester dans une grille serrée

**Priorité 2 — si vidéo hero il doit y avoir, la retravailler pour rester sur-marque :**
- Pas de reveal "ingrédients qui tombent", pas de rythme publicitaire de grande chaîne
- Privilégier un mouvement proche du geste réel : pâte étirée à la main, four à bois, fumée, ambiance de salle — spectaculaire sans trahir le positionnement "sans chichis"
- Reste une piste secondaire à Priorité 1, pas un prérequis pour sortir du "3/10"

## 4. Budget Higgsfield / génération vidéo

Aucun plafond crédits n'existe encore pour Otto (contrairement à Yframe, plafonné à 250 crédits). **Yahya gère personnellement le plafond et la génération** — pas d'action ni de décision côté Claude Code sur ce point.

Règle inchangée et non négociable : validation explicite de chaque prompt/coût avant toute génération individuelle, un par un. Rien n'est généré sans cette validation, quelle que soit la piste retenue au final.

---

## 5. Prochaine étape

Reprendre le Stage 6 (Développement) sur la Priorité 1 — mise en page/illustrations — avant toute nouvelle discussion vidéo. Revenir sur la Priorité 2 seulement une fois la Priorité 1 jugée suffisante ou insuffisante.
