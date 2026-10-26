# Journal de suivi santé

V4 d'une application PWA mobile-first de suivi personnel de santé.

## État du développement

Le lot 1 de suivi du transit est publié. Le lot 2 (version 4.8.0) est autorisé à la publication par Laurie pour tests sur son téléphone.

- Application mobile utilisable hors ligne, données personnelles locales.
- Carte corporelle Rhumato et catalogue personnalisable.
- Transit : Bristol obligatoire, accidents indépendants, conditions et journées sans passage.
- Symptômes digestifs configurables : champs et actions communs, aperçu, douleur à zéro par défaut, historique préservé.
- Épisodes indépendants par zone lors d’une saisie commune, constats enrichis et clôture ciblée sans heure de fin inventée.
- Fenêtres cohérentes, barre d’actions toujours visible et historique d’accueil toutes catégories.
- Sauvegardes JSON format 3 ; lecture des sauvegardes V4 anciennes et de la V3, fusion additive.

Les rapports médicaux complets et les notifications restent à développer dans leurs lots.

## Architecture

Le code est volontairement découpé par responsabilité dans `src/`. Les règles détaillées de développement et de passation sont dans [`README_LEON.md`](./README_LEON.md).
