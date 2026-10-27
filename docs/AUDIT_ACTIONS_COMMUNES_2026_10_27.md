# Audit des actions communes — 27 octobre 2026

Bilan intermédiaire conservé. Ces corrections sont incluses dans le bilan consolidé `BILAN_AUDIT_GENERAL_2026_10_27.md`, qui est désormais le document de validation de la version 4.8.2.

**Version 4.8.2 préparée localement, non publiée.** Base distante vérifiée : `61f1465b7ce1683691f71a53db0120ef3907401d` (4.8.1 publiée). Travail demandé explicitement par l’utilisatrice après l'audit des parcours.

## Diagnostic

1. `history-ui.js` ajoutait `dataset.instant=true` uniquement sur l'accueil. `episode-ui.js` interprétait cette marque comme une sauvegarde immédiate, avec intensités vides ; l'historique ouvrait une fiche dont la douleur reprenait le zéro initial. Deux sémantiques existaient pour la même action.
2. `occurrence` enregistrait le fait puis affichait un message demandant de le compléter dans l'historique. Le moteur créait déjà correctement une occurrence indépendante ; c'était le parcours d'enrichissement qui manquait.
3. `app.js` gardait des écouteurs legacy et des appels à `recordStillPresent`, `finishEntry`, `updateEntryEnd`, `addPastPresence`, via `handleEpisodeAction`, `handleFinishSubmit` et l'ancienne fenêtre `openFinishDialog`. Une recherche sur le code actuel a confirmé qu'aucun rendu ne produisait plus leurs boutons `data-still-present-entry`, `data-finish-entry`, `data-add-presence-entry` et `data-edit-entry-end`. Ce branchement était mort, mais aurait permis de réintroduire un suivi de toute une ancienne saisie groupée au lieu d'une cible.

## Corrections

### Encore maintenant

Tous les boutons utilisent désormais `handleEpisodeCommand` → `openEpisodeAction("still")` → la fiche commune. Aucune sauvegarde à l'ouverture ; Annuler, y compris après modification confirmée abandonnée, n'ajoute pas de constat.

Le moteur commun `getLastKnownIntensity` produit les valeurs proposées :

- recherche chronologique dans la première observation puis les constats de la cible concernée ;
- recherche indépendante pour chaque intensité numérique ; zéro est une mesure connue, un champ absent/null ne remplace pas une mesure connue par zéro ;
- dernier ensemble de niveaux qualitatifs réellement renseigné pour Rhumato ;
- aucune mesure postérieure à l'heure du constat ;
- aucune copie du commentaire ni de la localisation ;
- aucune écriture dans l'historique pendant cette lecture.

Le formulaire permet de confirmer, modifier ou retirer les intensités facultatives. Enregistrer emprunte uniquement `savePresenceCheck` dans une transaction. L'heure précise capturée au clic est conservée si le champ horaire n'est pas modifié. Le préremplissage est une proposition pour le nouveau constat, pas une réécriture des anciens constats vides.

Le constat passé, qui n'a pas encore d'heure choisie à l'ouverture, n'est pas prérempli avec une mesure potentiellement postérieure, ni avec un zéro de nouvelle douleur. Les corrections de constats existants affichent leurs propres valeurs, sans leur appliquer ce préremplissage.

### Nouvelle occurrence

Tous les points d'entrée — raccourci du jour et historique — empruntent le même parcours :

1. Capturer l'heure du clic.
2. Créer et sauvegarder une occurrence via `addOccurrence` et la transaction commune.
3. Ouvrir immédiatement `openEpisodeAction("edit")` sur cette nouvelle occurrence.

Fermer sans détails conserve le fait horodaté. Abandonner un brouillon de détails après confirmation conserve aussi l'occurrence telle qu'elle était enregistrée avant l'ouverture. Enregistrer enrichit le même identifiant sans nouvelle occurrence et sans perte des secondes/millisecondes. Le symptôme source, ses valeurs et son commentaire ne sont pas recopiés ou altérés.

### Articulation avec les observations anciennes

Les branchements temporels legacy inutilisés, leur état temporaire, les imports correspondants et l'ancienne fenêtre de fin ont été retirés de `app.js`, `ui.js` et `index.html`. Le sélecteur obsolète de la barre de dialogue a également été retiré. Le gestionnaire de suppression legacy, lui aussi sans bouton produit par le rendu actuel, a été retiré : la suppression ciblée active reste `deleteEpisode`.

Les exports historiques de `entries.js` ne sont pas supprimés : ils restent disponibles pour la compatibilité et leurs tests. L'interface conserve uniquement `updateEntry` pour la correction des associations de la saisie d'origine. Cette fonction ne remplace pas le suivi temporel par cible de `episodes.js`.

Les observations V3 passent par les projections `getEpisode`/`getEpisodeViews` et le même éditeur moderne. Les anciennes saisies groupées ne sont ni décomposées ni réidentifiées ; seul `targetStates` de la cible choisie est enrichi. Les constats hérités sans intensité restent sans intensité. La fin inconnue et la fin réelle explicite continuent à utiliser `finishEpisode`.

## Fichiers

| Fichiers | Modification |
|---|---|
| `src/episodes.js` | Lecture commune et non destructive des dernières intensités connues |
| `src/episode-ui.js` | Formulaire commun pour tout constat, ouverture de l'éditeur après création d'occurrence |
| `src/history-ui.js` | Retrait du marqueur de sauvegarde immédiate ; version des imports |
| `src/app.js` | Retrait du suivi legacy et des branchements inutilisés, édition d'associations conservée |
| `src/ui.js`, `index.html`, `src/dialogs.js` | Suppression de la fenêtre legacy et de son état, ressources 4.8.2 |
| `src/entries.js` | Commentaire précisant le rôle de l'API historique, sans modifier son comportement |
| `sw.js` | Cache et références des ressources préparés pour 4.8.2 |
| `tests/audit-actions.test.mjs` (nouveau) | Neuf tests de régression métier et de branchement |
| `tests/browser-audit-actions.mjs` (nouveau) | Comparaison réelle des mêmes commandes sur 14 combinaisons type/point d'entrée |
| `tests/browser-lot2.mjs`, `tests/browser-correctifs.mjs` | Adaptation aux formulaires communs et à la conservation d'occurrence après fermeture |
| `README_LEON.md`, `ROADMAP.md`, ce bilan | Décisions et passation |

Aucun changement du schéma 1 ni du format de sauvegarde 3 ; aucun changement du moteur de stockage/transfert ; aucune migration des observations.

## Résultats des vérifications

- **105 tests automatisés réussis, aucun échec final** : les 96 tests antérieurs et neuf nouveaux.
- **16 parcours navigateur du lot 2 réussis** : dont import V3 réel, correction d'associations, observations groupées, sauvegarde/réimportation idempotente, hors ligne et petits écrans.
- **12 parcours des correctifs précédents réussis**, adaptés aux nouvelles règles de formulaire.
- **Sept matrices comparatives réussies, couvrant 14 combinaisons** :
  - Encore maintenant, depuis accueil et historique, pour mesure numérique connue, mesure inconnue, Rhumato, V3 simple et V3 groupé : dix combinaisons.
  - Fin inconnue d'une cible V3 groupée depuis accueil et historique : deux combinaisons.
  - Occurrence depuis raccourci du jour et historique : deux combinaisons.
- Les matrices vérifient les valeurs préremplies et sauvegardées, la possibilité de modification, l'annulation propre et l'abandon d'un brouillon, l'heure précise du clic, l'identité de l'occurrence, les observations initiales et anciens constats inchangés, et l'absence d'intensité inventée. Elles comparent les résultats des deux écrans.
- Aucune erreur JavaScript dans les parcours navigateur.
- Syntaxe JavaScript, structure HTML, imports précachés et `git diff --check` vérifiés.

Toutes les fixtures sont synthétiques. Le navigateur de test est isolé du téléphone. Les premières erreurs rencontrées dans la mise au point des nouveaux tests provenaient de la navigation de test (module déjà ouvert), d'une fixture V3 utilisant le mauvais champ et d'une erreur de syntaxe dans une fixture ; les tests corrigés passent sans assouplissement des validations de l'application.

## Limites et suite

Le contrôle sur le téléphone Android réel reste à effectuer. Aucun point fonctionnel bloquant identifié. La dernière intensité connue est celle de l'épisode et de la cible choisis ; elle n'est pas recherchée dans une autre occurrence ou dans un épisode précédent.

**Présenter ce bilan et attendre une autorisation distincte avant publication.** Les ressources/cache sont préparés ; la version distante reste 4.8.1 tant que cette publication n'est pas autorisée.

Commandes de contrôle : `npm test`, `node tests/browser-lot2.mjs`, `node tests/browser-correctifs.mjs`, `node tests/browser-audit-actions.mjs`, avec `PLAYWRIGHT_MODULE` et `CHROMIUM_PATH` si les outils ne sont pas dans les chemins par défaut.
