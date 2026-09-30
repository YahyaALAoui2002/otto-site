# Otto — Plan de design (frontend-design skill) — objectif 10/10

**Contexte :** application complète de la skill frontend-design (méthode en deux passes : plan → auto-critique → build). Fait suite à `docs/08-critique-design-taste-skill.md`. Référence visuelle validée : mockup "otto_hero_v3_asymmetric".

---

## Passe 1 — Plan de design

### Couleur (6 valeurs, toutes issues du menu physique réel)
| Token | Hex | Usage |
|---|---|---|
| `--creme` | `#F7EFDD` | Fond dominant |
| `--creme-carte` | `#FFFCF5` | Fond encarts/citations |
| `--terracotta` | `#B5502D` | Accent primaire — CTA, prix |
| `--olive` | `#4B5C34` | Accent secondaire — illustrations, titres section |
| `--tampon-rouge` | `#8B3A3A` | **Réservé exclusivement au motif du tampon** — jamais ailleurs |
| `--encre` | `#2B2620` | Texte |

### Typographie
Fraunces (titres, un seul traitement, jamais scindé) / Cormorant Garamond italique (**exclusivement** citations d'avis) / Inter (UI, nav, corps de texte, en casse normale — pas de majuscules trackées).

### Layout — principe directeur
**Le menu physique d'Otto a une composition éditoriale asymétrique** (olivier en coin, tampon en coin opposé, illustration centrale, colonnes inégales) — pas une grille centrée symétrique. Le site doit traduire cette logique de composition, pas seulement sa palette. C'est la différence entre "un site aux couleurs d'Otto" et "le menu d'Otto, en version site."

- Hero : deux colonnes inégales, texte aligné en bas, photo qui déborde légèrement de la grille
- Piliers (Produit/Ambiance/Quartier) : distingués par les illustrations, jamais par une numérotation (pas une séquence)
- Page Carte : la numérotation 1-10 des pizzas **est** légitime ici — c'est une vraie séquence, contrairement aux piliers de la home
- Aucune carte encadrée à angles arrondis uniformes, aucun eyebrow-label système

### Principes
1. Traduire la composition du menu, pas seulement ses couleurs
2. Un seul moment de boldness : le tampon "Dolce Vita" s'anime comme un vrai coup de tampon au chargement — le geste mémorable de la page, unique et justifié par le sujet
3. Illustrations comme éléments de composition actifs (coins, ancrage), pas comme décoration ponctuelle
4. Chaque phrase de micro-copy est une vraie phrase humaine, jamais un label système

---

## Passe 2 — Auto-critique contre le brief

Vérification contre les 5 clusters de défauts génériques identifiés par la skill :
1. Crème + terracotta seuls → cliché #1 documenté, **mais justifié** ici (source = menu réel, pas un défaut). Compensé par la composition asymétrique, qui n'est jamais dans le cluster générique.
2. Near-black + accent vif → non applicable
3. Broadsheet hairline/dense colonnes → risque écarté par l'asymétrie délibérée (un vrai broadsheet générique est symétrique et dense ; ici la composition est volontairement déséquilibrée et calquée sur un artefact réel)
4. SaaS card kit → aucune carte à angle uniforme utilisée
5. Template chrome (eyebrows, points médians, flèches, labels capitales) → éliminé (voir `docs/08`)

**Le plan passe le test.** Construction autorisée sur cette base.

---

## Référence de construction

Le hero "otto_hero_v3_asymmetric" (Claude web) est la référence pixel-proche pour Stage 6 :
- Olivier en SVG, coin haut-gauche
- Tampon "Dolce Vita" en coin haut-droit, incliné ~8°, futur point d'animation
- Deux colonnes inégales (1.1fr / 0.9fr), photo qui déborde en bas de section
- Tagline en un seul bloc Fraunces, sous-titre en phrase naturelle, CTA terracotta plein
- Avis en phrase naturelle sous le hero, sans encart à points médians

Cette référence s'applique à la home ; la page Carte doit être pensée séparément en s'inspirant directement de la mise en page réelle du menu papier (colonnes de sections, numérotation légitime des pizzas).
