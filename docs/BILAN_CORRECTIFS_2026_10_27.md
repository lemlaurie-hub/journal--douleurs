# Bilan des correctifs ergonomiques et fonctionnels

27 octobre 2026 — **version 4.8.1 testée ; publication autorisée par l’utilisatrice le 27 octobre 2026**.

Base distante vérifiée : `main`, commit `3cec3eb4a721683527ba89dc1b2d9936de0a1260` (lot 2 publié). Les consignes, la roadmap, les bilans des lots 1 et 2 et les dépendances du code ont été relus. Les écarts de la copie locale avec les autres fichiers distants étaient uniquement des fins de fichiers ; ils ont été alignés sur le dépôt avant les vérifications.

## Changements fonctionnels

### Digestif

- « Passage aux toilettes » reste un titre non cliquable. Les boutons « + Ajouter » et « ⊘ Aucun » sont côte à côte, directement accessibles.
- La confirmation du jour affiche « ✓ Aucun » sur fond vert. Un passage ajouté ce même jour annule automatiquement cette confirmation avec le moteur existant. L'annulation manuelle reste accessible dans l'historique, y compris pour une ancienne journée.
- Suppression du bouton « Consulter l'historique et les rapports » et de l'annonce des futurs rapports.
- Statistiques et Historique sont repliables et fermés à chaque nouvelle visite du module. Un rendu après sauvegarde, correction ou fermeture de fiche ne referme pas l'historique déjà ouvert. Aucun état d'ouverture n'est stocké.
- Après une remontée du jour, « + Nouvelle occurrence — [symptôme] » reste accessible dans la zone de saisie, après rechargement et hors ligne. Le raccourci disparaît à minuit local ; ses observations restent intactes. Cette règle utilise le critère `newOccurrence`, sans dépendre d'un libellé précis.

### Paramètres

- Roue dentée en haut à droite, accessible depuis l'accueil et les modules.
- Catalogue commun : création, modification des noms, rattachements et critères existants ; conditions digestives dans leur éditeur actuel.
- Les sept symptômes digestifs prédéfinis sont configurables sans première observation. Leur ajout au catalogue se fait à l'ouverture des paramètres, dans une transaction ; aucune observation n'est créée. Les éléments déjà présents gardent leur identifiant.
- Une clé de provenance `presetKey` conserve l'identité d'un prédéfini après renommage. Elle est conservée par le stockage et les sauvegardes. Paramètres et sélecteur de saisie utilisent la même liste.
- Les accès redondants de configuration ont été retirés des pages de saisie. La création d'un symptôme manquant reste dans la fiche digestive ; la création d'une zone ou d'un symptôme reste dans la fiche commune.

### Réglettes

- `pain` et `discomfort` sont des critères numériques du même type `scale` ; libellés distincts, composant et validation communs.
- Douleur, gêne de nausée/remontée et douleur à l'évacuation utilisent la même réglette entière 0–10.
- Une ancienne mesure absente affiche « Non renseigné » et reste absente si elle n'est pas touchée. Un zéro explicitement choisi est sauvegardé comme zéro, y compris au clavier. Le bouton « Non renseigné » permet de retirer une mesure facultative.
- La douleur commence toujours à zéro pour un nouveau formulaire qui la propose ; la gêne reste inconnue initialement, conformément aux conventions existantes.
- Les intensités qualitatives Rhumato restent inchangées.

### Événements à suivre sur l'accueil

- Une section commune regroupe les épisodes récents non clôturés de tous les modules, y compris les cibles des anciennes saisies groupées.
- « Encore maintenant » enregistre immédiatement un constat à l'heure du clic dans le même épisode, sans supposer une intensité. Le constat reste modifiable depuis l'historique avec l'éditeur existant.
- « C'est fini » ouvre la fiche commune avec heure réelle inconnue par défaut et aucun horaire de fin prérempli. L'utilisatrice peut renseigner une heure réelle si elle la connaît. Une fin déjà connue est préservée et reste corrigeable.
- L'épisode reste visible moins de 48 heures après le dernier constat de présence, ou après sa première observation s'il n'a aucun constat. À exactement 48 heures, il quitte l'accueil sans clôture, suppression ni heure de fin inventée. Un nouveau constat relance ce délai.
- Un minuteur vise la prochaine expiration ou minuit local. Au retour après veille, les raccourcis sont recalculés. Les fiches ouvertes ne sont pas réinitialisées.
- Les événements ponctuels sans suivi de persistance, notamment les remontées par défaut et le transit, ne sont pas présentés comme des épisodes à clôturer.
- La clôture automatique pour une même douleur à la même localisation précise est conservée. Supprimer le nouvel épisode ne rouvre pas l'ancien.

### Présentation

Actions quotidiennes compactes, actions liées regroupées, configuration séparée de la saisie et cibles tactiles d'au moins 44 px. Contrôle des écrans à 320, 390 et 768 pixels ; aucun débordement horizontal détecté dans les parcours testés.

## Dépendances et données

Le catalogue définit la configuration ; le constructeur de critères sert à la saisie, l'aperçu et la correction. Les commandes d'épisodes restent communes à l'accueil et à l'historique. Les projections d'historique produisent les filtres quotidiens ; elles n'écrivent jamais de clôture. Le stockage et les transactions existants assurent la persistance.

Aucune migration des observations, suppression groupée, conversion d'identifiants ou réécriture des dates. Les anciennes cibles groupées restent dans leur enregistrement source et reçoivent seulement un suivi ciblé via `targetStates`. La clôture manuelle inconnue réutilise `closedUnknown` et `closure`, sans `endedAt` inventé. La durée minimale reste calculée jusqu'au dernier constat de présence.

Schéma 1 et format de sauvegarde 3 conservés. Le nouveau type de contrôle n'est pas stocké dans les valeurs historiques ; les clés et nombres restent identiques. Les formats antérieurs restent importables. Ressources et service worker préparés pour 4.8.1 ; publication autorisée après validation du bilan.

## Fichiers modifiés ou ajoutés

| Fichiers | Rôle |
|---|---|
| `index.html`, `styles.css` | Paramètres, rubriques, raccourcis, présentation et cibles tactiles |
| `src/app.js` | Branchement des paramètres/actions, transaction du catalogue, rafraîchissement quotidien |
| `src/catalog.js` | Liste commune des prédéfinis/personnalisés, initialisation idempotente et provenance stable |
| `src/criteria.js`, `src/criteria-ui.js` | Échelle numérique commune, lecture et validation, distinction zéro/inconnu |
| `src/digestive-ui.js` | Confirmation verte du jour, réglette commune et déplacement des paramètres |
| `src/episode-ui.js`, `src/episodes.js` | Constat direct et fin inconnue dans les moteurs existants |
| `src/history.js`, `src/history-ui.js` | Projections des 48 heures et occurrences du jour, actions communes |
| `src/ui.js` | Repli à chaque visite, catalogue de paramètres toutes familles |
| `src/dialogs.js` | Fermeture des paramètres par Échap sans fausse alerte de saisie perdue |
| `sw.js` | Cache et ressources versionnés 4.8.1 |
| `tests/correctifs.test.mjs` (nouveau) | 13 tests de régression métier |
| `tests/browser-correctifs.mjs` (nouveau) | 12 parcours navigateur des correctifs |
| `tests/browser-lot2.mjs` | Adaptation des parcours existants aux nouveaux accès et au repli à la visite |
| `README_LEON.md`, `ROADMAP.md`, ce bilan | Passation et état du travail |

`src/storage.js` et `src/transfer.js` n'ont pas nécessité de modification : les tests vérifient leur compatibilité avec ces corrections.

## Vérifications

- **96 tests automatisés réussis, aucun échec** : les 83 existants et 13 nouveaux.
- **16 parcours navigateur du lot 2 réussis**, conservés et adaptés à la navigation actuelle : Bristol et erreurs, images, barres d'actions, catalogue, constats, anciennes données, saisies communes, import V3, export/réimport idempotent, conditions, écrans et hors ligne.
- **12 nouveaux parcours navigateur réussis**, aucune erreur JavaScript : boutons et confirmation du jour ; paramètres sans première saisie ; réglage de gêne et contexte de l'historique ; actions de suivi de l'accueil ; remontées rapides ; anciennes mesures inconnues ; zéro au clavier et retrait d'une mesure ; Rhumato et anciennes zones ; fin réelle ciblée ; largeurs mobiles ; sauvegarde hors ligne ; expiration exacte et minuit local sans rechargement.
- Syntaxe JavaScript, identifiants HTML uniques, cibles des contrôles, absence de formulaires imbriqués, dépendances hors ligne et `git diff --check` vérifiés.
- Les tests utilisent exclusivement des données synthétiques et un stockage de navigateur distinct. Aucune donnée du téléphone n'a été lue ou modifiée.

Pour rejouer : `npm test`, puis `node tests/browser-lot2.mjs` et `node tests/browser-correctifs.mjs` avec Playwright/Chromium disponibles. `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` et `QA_OUTPUT` sont des options de l'environnement de test, sans dépendance ajoutée à l'application.

## Limites et validation

- La validation sur le téléphone Android réel reste à faire ; Chromium mobile simulé ne remplace pas cet essai.
- Les minuteurs peuvent être suspendus par Android lorsque l'application est en arrière-plan ; le retour au premier plan recalcule l'affichage à partir des horodatages réels.
- Aucune question fonctionnelle bloquante identifiée. Les lots suivants n'ont pas été engagés.
- **Publication autorisée séparément par l’utilisatrice le 27 octobre 2026. Vérifier la tête distante et la réussite de GitHub Pages avant d’annoncer la mise en ligne.**
