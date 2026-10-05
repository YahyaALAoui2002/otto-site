# Otto Pizza — site web

**Site en ligne : https://yahyaalaoui2002.github.io/otto-site/**

Site de Otto, trattoria et pizzeria de quartier au 53 bis boulevard Arago, Paris 13e.

## Tableau de bord (admin)

**Tableau de bord Otto : https://yahyaalaoui2002.github.io/otto-site/admin/**

Le fichier se trouve dans `admin/index.html`. En ligne, il s'ouvre en mode démo (données fictives générées dans le navigateur, rien n'est enregistré ni envoyé). Utilisez « Se connecter au serveur » pour lire les vraies commandes depuis l'API, ou « Ouvrir un export… » pour charger un export.

## Langues

Le site existe en 10 langues : français (racine), anglais (`en/`), italien (`it/`), espagnol (`es/`), allemand (`de/`), polonais (`pl/`), chinois (`zh/`), russe (`ru/`), japonais (`ja/`) et grec (`el/`).

Les pages anglaises servent de source : les autres langues sont générées à partir d'elles avec les dictionnaires de `tools/i18n/langs/`. Après avoir modifié une page anglaise, un dictionnaire ou le menu des langues, lancez :

```
node tools/i18n/build.js
```

Le script signale tout texte encore non traduit. Les textes affichés par JavaScript (panier, réservation, contact) sont traduits directement dans `assets/js/`.
