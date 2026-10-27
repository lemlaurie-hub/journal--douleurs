# Bilan consolidé — audit général du 27 octobre 2026

**Version 4.8.2 préparée localement, non publiée.** La version distante vérifiée est 4.8.1, commit `61f1465b7ce1683691f71a53db0120ef3907401d`.

Ce bilan intègre les actions communes déjà préparées dans `cd426b9`, décrites dans `AUDIT_ACTIONS_COMMUNES_2026_10_27.md`, puis les corrections transactionnelles et de cohérence demandées par l’utilisatrice. Le précédent travail n'a pas été remplacé par une reprise de 4.8.1.

## 1. Actions fonctionnelles conservées et vérifiées

- Encore maintenant ouvre la même fiche depuis l'accueil et l'historique. La dernière intensité réellement connue de la cible et de l'épisode est proposée, modifiable et facultative. Un zéro connu reste zéro ; une ancienne absence ne devient pas zéro. Les commentaires ne sont pas recopiés.
- Le même `savePresenceCheck` sauvegarde le constat dans une transaction ; Annuler n'ajoute rien. L'heure précise du clic est conservée si le champ horaire n'est pas modifié.
- Nouvelle occurrence sauvegarde le fait horodaté, puis ouvre immédiatement son éditeur commun. Fermer sans détails conserve l'occurrence. La sauvegarde des détails conserve son identifiant et son horaire.
- Les anciens branchements temporels de `app.js` et leur fenêtre inutilisée sont supprimés. L'API historique de `entries.js` reste conservée et testée ; `updateEntry` demeure utilisée pour la correction des associations d'origine. Les observations V3, notamment groupées, utilisent le moteur temporel moderne par cible.

## 2. Écritures : diagnostic et corrections

### Défauts identifiés

| Chemin | Situation précédente | Correction |
|---|---|---|
| Catalogue créé par la carte corporelle | Mutation du catalogue partagé avant `saveData`. Un échec pouvait laisser une zone fantôme en mémoire. | Création dans la copie de transaction, publication seulement après sauvegarde réussie. |
| Transit, journées et conditions | Mutations du module partagé, sauvegarde puis restauration locale par `attempt()`. Cette seconde stratégie était distincte des épisodes et pouvait restaurer une ancienne mémoire après une erreur ultérieure à la sauvegarde. | Même transaction que les épisodes ; `attempt()` affiche seulement les erreurs et ne restaure aucune donnée. |
| Import | Sauvegarde de l'objet fusionné puis copie manuelle de quelques propriétés vers la mémoire. | Remplacement de l'état complet dans la copie transactionnelle ; extensions racine conservées. |
| Reclassement des anciennes migraines au chargement | En cas de quota, le catalogue migré pouvait rester uniquement en mémoire. | Même transaction. En cas d'échec, conserver le classement réellement enregistré, sans vider les données ; reprise idempotente au prochain chargement. |

### Frontière commune

`src/transactions.js` contient `transactData(data, action, persist)` :

1. Cloner les données partagées.
2. Appliquer la commande métier à la copie.
3. Valider, sérialiser et sauvegarder via `saveData`.
4. Publier la copie en mémoire après réussite, en conservant l'identité de l'objet racine utilisé par les modules.

Si la commande, la validation, la sérialisation JSON ou `localStorage.setItem` échoue, la copie est abandonnée. La mémoire partagée et la source persistée restent dans leur état précédent. Une commande transactionnelle est synchrone ; la lecture asynchrone d'un fichier d'import se fait avant la transaction.

Le rendu est exécuté après la publication des données. Il ne fait pas partie du mécanisme de restauration : une erreur d'affichage ne doit pas annuler en mémoire une sauvegarde qui a réussi. Le traitement d'erreur de rendu existant conserve les données et signale le problème.

`app.js` garde un seul adaptateur `transact`, employé par le catalogue, la carte, les observations, les épisodes, le transit, les journées, les conditions et l'import. `persistAndRender` est supprimé. Après audit, la seule écriture `localStorage.setItem` du code applicatif se trouve dans `saveData` ; la migration appelle elle aussi la transaction commune.

Une occurrence et l'ajout de ses détails sont volontairement deux transactions : si la seconde échoue, le fait déjà enregistré reste présent, sans détails partiellement appliqués.

## 3. Cohérence de l'historique et des statistiques

Le filtre de statistiques de module retenait précédemment une saisie brute entière dès qu'un de ses éléments appartenait au module. Pour une ancienne saisie groupée reclassée sur plusieurs modules, le suivi d'une autre cible pouvait fausser les jours suivis et le compteur de fins non renseignées.

- `calculateStats(data, {moduleId})` utilise maintenant `getHistoryRows`, comme l'historique, pour sélectionner les cibles du module.
- Les constats, fins réelles et statuts sont lus uniquement sur ces cibles. Les journées intermédiaires ne sont pas inventées.
- Les anciennes saisies groupées restent comptées une seule fois comme observations sources ; les constats ne deviennent pas de nouvelles observations. Les côtés restent distingués dans les fréquences.
- Le retrait d'un épisode de l'accueil après 48 h ne le clôture pas : un suivi ouvert peut donc rester dans les statistiques après sa disparition de l'accueil.
- Le classement par module est centralisé dans `catalog.js` via `isItemInModule`, utilisé par les choix de saisie et la projection d'historique/statistiques. Une famille importée inconnue reste consultable dans Symptômes / événements sans réécriture de sa valeur historique.
- Le filtre de données dupliqué dans `ui.js` et un ancien formateur de durée inutilisé ont été retirés. Les écrans affichent les résultats du moteur commun.

Les nombres de lignes d'historique et d'observations sources ne sont pas nécessairement identiques pour une ancienne saisie groupée : plusieurs cibles peuvent être consultables dans un seul enregistrement historique. Cette convention existante est conservée.

## 4. Préservation des données

Aucune migration massive, réinitialisation, suppression collective, conversion d'identifiants ou changement des règles de clôture. Les valeurs absentes, zéros explicites, observations anciennes, secondes/millisecondes, commentaires, cibles V3 et clôtures sans heure connue sont préservés.

La clôture automatique d'une même douleur à la même localisation se prépare dans la copie de transaction : un échec de sauvegarde ne clôture pas l'ancien épisode en mémoire. Supprimer le remplaçant après une sauvegarde réussie ne rouvre pas l'ancien, conformément à la règle existante.

Le schéma reste 1 et le format de sauvegarde reste 3. Les extensions racine sont conservées. Le module de transfert n'a pas nécessité de réécriture. Le nouveau module de transactions est inclus dans le précache hors ligne de 4.8.2.

## 5. Fichiers concernés

### Ajouts/modifications de ce complément d'audit

| Fichiers | Rôle |
|---|---|
| `src/transactions.js` (nouveau) | Frontière transactionnelle indépendante de l'interface |
| `src/app.js` | Adaptateur unique, carte et import transactionnels |
| `src/digestive-ui.js` | Toutes les commandes digestives utilisent cette transaction ; retrait de la restauration locale |
| `src/storage.js` | Migration ciblée transactionnelle, échec sans divergence de classement |
| `src/stats.js` | Statistiques filtrées par les mêmes cibles que l'historique |
| `src/catalog.js`, `src/history.js`, `src/ui.js` | Classement commun, retrait du filtre et du formateur inutilisés de l'interface |
| `sw.js` | Précache du nouveau module, cache préparé pour la version consolidée |
| `tests/transactions.test.mjs` (nouveau) | Échecs et reprises, validation, migration, sérialisation et cohérence des modules |
| `tests/browser-transactions.mjs` (nouveau) | Échecs réels de stockage injectés dans le navigateur, export mémoire et compteurs vérifiés |
| `README_LEON.md`, `ROADMAP.md`, ce bilan | Passation consolidée |

### Travail antérieur inclus

Les modifications déjà préparées de `index.html`, `src/episode-ui.js`, `src/episodes.js`, `src/history-ui.js`, `src/dialogs.js` et le commentaire de compatibilité dans `src/entries.js` sont conservées. Les tests `audit-actions.test.mjs`, `browser-audit-actions.mjs`, ainsi que les adaptations de `browser-lot2.mjs` et `browser-correctifs.mjs`, font partie du même ensemble. Le détail de ces changements figure dans le bilan des actions communes.

## 6. Tests exécutés

- **130 tests automatisés réussis, aucun échec final** : 96 de 4.8.1, neuf de l'audit des actions communes et 25 de ce complément.
- Les tests d'écriture couvrent création/modification du catalogue, transit créé/corrigé/supprimé, confirmation/annulation de journée, conditions, nouvel épisode avec clôture automatique, constat, fin inconnue, modification/suppression d'épisode, occurrence, associations anciennes et import V3. Chaque échec de quota est suivi d'une reprise réussie ; mémoire et disque sont comparés.
- Échec d'une commande après mutation de sa copie, validation refusée à la sauvegarde, sérialisation JSON impossible et migration de migraine avec quota simulé : état précédent conservé.
- **16 parcours navigateur du lot 2 et 12 parcours des correctifs antérieurs réussis**, comprenant sauvegarde/réimportation idempotente, V3, formulaires, annulation, largeurs 320/390/768 et utilisation hors ligne.
- **Sept matrices comparatives sur 14 combinaisons type/point d'entrée réussies**, pour les actions communes : intensités numériques connues/inconnues, Rhumato, V3 simple/groupé, fin inconnue et occurrence.
- **Neuf scénarios navigateur supplémentaires réussis** : carte corporelle, paramètres/catalogue, validation et sauvegarde de transit, suppressions transit/journées, conditions, clôture automatique préparée, création d'occurrence puis détails, import V3, ancienne saisie multi-module et compteurs.
- Dans ces scénarios, l'échec de `localStorage.setItem` est réellement injecté. Une sauvegarde JSON produite par l'application permet de comparer son état en mémoire à la source du stockage après échec et reprise ; les cartes statistiques de l'accueil et du module sont également vérifiées. Les formulaires restent ouverts et récupérables après un échec.
- Aucune erreur JavaScript dans les parcours navigateur.
- Syntaxe JavaScript, structure HTML, imports et ressources précachés, `git diff --check` vérifiés.

Les fixtures sont exclusivement synthétiques, dans une origine de test séparée. Aucune donnée du téléphone n'a été consultée ou modifiée. Une fixture de correction d'associations a été ajustée au format d'observation ancienne attendu par cet éditeur ; les validations applicatives n'ont pas été assouplies pour faire passer les tests.

Pour rejouer : `npm test`, puis `node tests/browser-lot2.mjs`, `node tests/browser-correctifs.mjs`, `node tests/browser-audit-actions.mjs` et `node tests/browser-transactions.mjs`, avec Playwright et Chromium disponibles (`PLAYWRIGHT_MODULE` et `CHROMIUM_PATH` si nécessaire).

## 7. Limites et validation

Le contrôle sur le téléphone Android réel reste nécessaire. Les transactions garantissent la cohérence d'une commande dans l'instance active ; aucun mécanisme de synchronisation entre plusieurs fenêtres simultanées n'a été ajouté. En cas de quota au chargement, le reclassement des migraines est différé plutôt qu'appliqué uniquement à l'écran.

Aucun point fonctionnel bloquant identifié. Les lots suivants ne sont pas engagés. **La version distante reste 4.8.1 ; attendre la validation de ce bilan consolidé et l'autorisation distincte de publication.**
