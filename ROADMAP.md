# ROADMAP — Journal de suivi santé

Ce document est la feuille de route vivante du projet. Il sert à noter les idées, décisions et priorités sans devoir les implémenter immédiatement. Il doit rester compréhensible par Laurie et par tout assistant reprenant le projet.

## Vision

L'application évolue d'un simple journal de douleur vers un **journal de suivi de santé personnel**, mobile-first, utilisable hors ligne et organisé par grands domaines. Les données propres à l'utilisatrice restent dans son stockage local ou dans des sources explicitement autorisées.

L'interface pourra être découpée en pages/modules plutôt qu'en un écran unique trop chargé.

### Organisation envisagée

- **Accueil** : résumé du jour, raccourcis de saisie, dernières observations.
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
- [ ] Refonte ergonomique mobile après validation de l'import.
- [ ] Navigation claire par pages/modules.
- [ ] Page Rhumato.
- [ ] Page Digestif.
- [ ] Page Symptômes / événements.
- [ ] Page Mesures.
  - [ ] Importer des résultats d’analyses sanguines depuis une photo ou un PDF : extraction sur l’appareil, vérification/correction par Laurie, puis conservation des valeurs structurées (date, examen, résultat, unité et valeurs de référence) sans garder le document original. Prévoir PDF texte d’abord, puis OCR des scans/photos.
- [ ] Ajout/modification d'une zone depuis n'importe quel écran via une logique unique.
- [ ] Ajout/modification d'un symptôme/événement via une logique unique.
- [ ] Suivi de durée / statut « encore maintenant ».
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

Une idée peut être ajoutée ici immédiatement sans modifier l'application. Passer une idée en développement nécessite ensuite de vérifier le code réel, préciser la règle fonctionnelle si nécessaire, développer, tester puis obtenir l'accord de Laurie avant publication.