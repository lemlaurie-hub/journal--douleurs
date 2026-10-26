# ROADMAP — Journal de suivi santé

Ce document est la feuille de route vivante du projet. Il sert à noter les idées, décisions et priorités sans devoir les implémenter immédiatement. Il doit rester compréhensible par Laurie et par tout assistant reprenant le projet.

## Vision

L'application évolue d'un simple journal de douleur vers un **journal de suivi de santé personnel**, mobile-first, utilisable hors ligne et organisé par grands domaines. Les données propres à l'utilisatrice restent dans son stockage local ou dans des sources explicitement autorisées.

L'interface pourra être découpée en pages/modules plutôt qu'en un écran unique trop chargé.

### Organisation envisagée

- **Accueil** : résumé du jour, raccourcis de saisie, dernières observations, avec une navigation visuelle par galets cliquables vers les pages/modules.
- **Rhumato** : douleurs, zones corporelles, intensité/gêne, durée et éléments associés.
- **Digestif** : symptômes digestifs et observations associées.
- **Symptômes / événements** : événements transversaux qui ne sont pas uniquement des douleurs (par exemple migraine, fourmillements, crampes, vertige, malaise, fatigue intense).
- **Mesures** : données chiffrées, saisies ou récupérées depuis une source externe autorisée (poids, fréquence cardiaque, sommeil, activité, etc.).
- **Statistiques / synthèse** : fréquences, tendances et vue utile pour préparer un rendez-vous médical.

Il n'est **pas nécessaire de créer une page “Neurologique” par principe**. On ne créera un module dédié que si les usages réels le justifient. Les symptômes neurologiques peuvent d'abord vivre dans “Symptômes / événements”.

## V4 — socle actuel

- [x] PWA installable.
- [x] Fonctionnement hors ligne.
- [x] Stockage local V4 séparé de la V3.
- [x] Catalogue personnalisable.
- [x] Saisie d'observations.
- [x] Sélection de plusieurs éléments.
- [x] Date/heure de saisie modifiable.
- [x] Statistiques de base.
- [x] Historique de base.
- [x] README_LEON de passation et règles de travail.

## V4 — prochaines étapes

- [x] Import/export sécurisé de l'historique V3 vers V4 (publié ; fusion additive, sans effacement automatique).
- [x] Idempotence et détection des doublons vérifiées par tests automatisés et simulation avec le JSON V3 fourni.
- [ ] Vérifier dans la V4 installée sur le téléphone le nombre d'entrées, les dates/heures et les notes après import réel.
- [x] Outils de correction post-import : modifier les éléments associés à une observation et la classification d’un élément du catalogue, en préservant dates, heures et notes ; ne pas appliquer de reclassement groupé ambigu.
- [x] Migration ciblée des libellés V3 exacts « Migraine » et « Migraine ophtalmique » vers Symptômes / événements ; les autres entrées restent modifiables individuellement.
- [ ] Refonte ergonomique mobile après validation de l'import.
- [x] Navigation simple par pages/modules (présentation provisoire).
- [x] Page Rhumato (présentation provisoire).
- [x] Page Digestif (présentation provisoire).
- [x] Page Symptômes / événements (présentation provisoire).
- [x] Carte corporelle Rhumato recto-verso avec zones affinées selon l’avant/l’arrière, sélection multiple et retrait direct des zones cochées.
- [ ] Page Mesures.
  - [ ] Importer des résultats d’analyses sanguines depuis une photo ou un PDF : extraction sur l’appareil, vérification/correction par Laurie, puis conservation des valeurs structurées (date, examen, résultat, unité et valeurs de référence) sans garder le document original. Prévoir PDF texte d’abord, puis OCR des scans/photos.
- [x] Ajout/modification d'un élément du catalogue via une logique métier unique.
- [x] Modification d'une observation depuis son module, avec le même formulaire et sans toucher les champs inchangés.
- [x] Suivi d'un épisode : première observation horodatée, constats « Encore maintenant » et antidatés accessibles depuis toute observation (y compris V3), conservation de l'ancien repère quand le début est antidaté, fin facultative avec correction d'une heure passée, durée minimale calculée jusqu'au dernier constat de présence et fin inconnue sans clôture automatique.
- [x] Historique et zones/éléments enregistrés repliés par défaut, ouverts à la demande.
- [x] Rattacher un élément personnalisé à une partie du corps en une fois, avec choix droite/gauche/les deux et face/dos ; conserver le côté dans les observations, statistiques et sauvegardes.
- [ ] Vérifier visuellement sur mobile le formulaire de rattachement, la sélection bilatérale et les rubriques repliables (publication autorisée malgré l’indisponibilité du navigateur de test).
- [ ] Historique filtrable et plus compact.
- [ ] Statistiques améliorées par période et catégorie.

## Sources de données externes — plus tard

- [ ] Étudier une connexion **Health Connect** en lecture principalement.
- [ ] Vérifier quelles données sont effectivement disponibles selon les applications déjà connectées au téléphone.
- [ ] Prévoir un module optionnel : l'application doit continuer à fonctionner entièrement sans Health Connect.
- [ ] Ne jamais dépendre d'une source externe pour la saisie manuelle ou l'accès à l'historique principal.

## Idées pour versions suivantes

- [ ] Export PDF lisible pour un professionnel de santé.
- [ ] Export CSV/JSON complet.
- [ ] Recherche et filtres avancés.
- [ ] Vue calendrier.
- [ ] Corrélations exploratoires entre symptômes, sommeil, activité, poids et autres mesures.
- [ ] Favoris / raccourcis de saisie fréquente.
- [ ] Résumé automatique d'une période choisie.

## Boîte à idées

Cette section sert à noter rapidement les idées de Laurie sans les transformer automatiquement en fonctionnalités validées.

- Navigation par pages pour éviter un écran trop chargé.
- Séparer clairement les domaines (rhumato, digestif, symptômes/événements, mesures).
- Éviter de créer des catégories artificielles si l'usage réel ne les justifie pas.

## Règle de gestion de cette roadmap

Une idée peut être ajoutée ici immédiatement sans modifier l'application. Passer une idée en développement nécessite de terminer la réflexion commune et d’obtenir l’accord explicite de Laurie pour coder. Après développement et tests, présenter le bilan puis attendre une validation distincte pour publier.



## Digestif — reprise du 26 octobre 2026

Voir `docs/CAHIER_DES_CHARGES_DIGESTIF.md` et `docs/BILAN_LOT_1.md`.

- [x] Lot 1 développé localement : transit, Bristol obligatoire, accidents, conditions et jours sans passage.
- [x] Sauvegardes format 2 avec lecture des anciennes versions et tests de non-régression.
- [ ] Contrôle de l'interface dans un navigateur réel, téléphone Android et hors ligne.
- [x] Illustrations validées par Laurie le 26 octobre 2026.
- [x] Publication du lot 1 autorisée le 26 octobre 2026 pour tests ; vérifier le déploiement GitHub Pages.
- [ ] Lot 2 : symptômes digestifs et épisodes indépendants par zone lors d'une saisie commune.
- [ ] Lot 3 : historique commun et constats éditables.
- [ ] Lot 4 : synthèses et PDF médical.
- [ ] Lot 5 : étude et réalisation des rappels.
