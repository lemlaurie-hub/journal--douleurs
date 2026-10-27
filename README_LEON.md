# README_LEON — consignes de développement

Ce document sert de passation pour tout assistant qui reprend le projet **Journal de suivi santé**. Il décrit la méthode de travail convenue avec l’utilisatrice. Le dépôt reste la source de vérité technique : toujours lire le code réel avant d'agir.

## Objectif du projet

Construire une application mobile-first de suivi de santé, d'abord centrée sur les douleurs et le suivi rhumatologique, mais extensible au digestif et à d'autres symptômes ou événements. L'application doit rester utilisable hors ligne, préserver strictement l'historique et permettre à terme des exports utiles pour un professionnel de santé.

Les données propres à l'utilisatrice ne doivent jamais être codées en dur dans le dépôt. Elles restent dans le stockage local de l'application ou dans des sources explicitement autorisées par l'utilisatrice.

## 1. Toujours repartir de l'état réel

Avant toute modification :

1. Lire le code actuellement présent dans le dépôt.
2. Vérifier l'état de la branche distante `main`.
3. Ne jamais supposer qu'une correction évoquée dans une ancienne conversation a réellement été appliquée, publiée ou qu'elle fonctionne.
4. Distinguer le code du dépôt des données enregistrées sur le téléphone : le dépôt ne permet pas de connaître automatiquement les données locales de l'utilisatrice.

Une ancienne tentative, un commit local ou une phrase disant « c'est corrigé » ne constitue pas une preuve. Il faut vérifier.

## 2. Diagnostiquer avant de modifier

Lorsqu'une anomalie est signalée :

1. Reproduire ou localiser précisément le comportement.
2. Trouver la fonction qui produit la valeur ou l'affichage.
3. Identifier la donnée source.
4. Suivre son chemin complet : stockage, moteur métier, interface, exports éventuels.
5. Vérifier si plusieurs écrans recalculent différemment la même information.
6. Déterminer la cause réelle avant de coder.

Ne pas masquer un écart avec une constante, une régularisation artificielle ou une correction uniquement visuelle.

Si plusieurs causes restent plausibles, les expliquer à l’utilisatrice et préciser ce qui manque pour les départager.

## 3. Une règle métier, une seule source de vérité

Une même règle ne doit pas être recodée séparément dans chaque écran.

Exemple : si plusieurs vues utilisent une durée, un statut, une moyenne, une période, un seuil ou une donnée consolidée, elles doivent appeler la même fonction métier commune.

Éviter les variantes du type :

- `calculateSomething`
- `calculateSomethingForHistory`
- `calculateSomethingButCorrectly`

Quand deux écrans divergent, corriger le moteur commun plutôt que bricoler chaque écran.

Même principe pour les éditeurs : une même action doit utiliser le même composant ou la même commande, quel que soit l'endroit depuis lequel elle est ouverte. Exemple : une seule commande `createZone()` doit servir partout où une zone peut être créée.

## 4. Préserver les données et l'historique

Ne jamais inventer une donnée absente pour obtenir un résultat plus joli.

Distinguer clairement :

- donnée prévue ;
- donnée réellement saisie ;
- donnée importée ou reconstituée ;
- valeur consolidée ;
- projection ;
- absence de donnée.

Une modification de configuration actuelle ne doit pas réécrire silencieusement l'historique.

Toute migration de données doit être :

- ciblée ;
- prudente ;
- idempotente ;
- testée sur les anciennes données ;
- incapable d'effacer une véritable exception saisie par l'utilisatrice.

Aucune suppression ou réinitialisation large sans accord explicite.

## 5. Décisions et autorisation

Le travail suit quatre étapes distinctes, dans cet ordre :

1. **Réflexion commune.** Écouter tous les points de l’utilisatrice, lire et diagnostiquer sans modifier le code. Une idée, une précision ou un « oui » pendant cette discussion ne signifie pas que la réflexion est terminée.
2. **Développement après accord.** Attendre que l’utilisatrice indique explicitement que la réflexion est terminée et qu'on peut coder. Puis développer et tester les changements convenus.
3. **Bilan.** Présenter ce qui a été fait, les tests, les limites et ce qui reste à faire.
4. **Publication après validation séparée.** Attendre l'accord explicite de l’utilisatrice pour publier, puis publier et vérifier le dépôt distant.

Ne pas démarrer une longue phase de développement alors que l’utilisatrice expose encore ses points. Ne pas confondre accord sur une règle, accord pour coder et accord pour publier.

## 6. Tester réellement

Après chaque correction :

- vérifier la syntaxe ;
- exécuter toute la batterie de tests existante ;
- ajouter un test de régression reproduisant précisément le bug lorsqu'un environnement de tests est disponible ;
- ajouter le cas opposé pour éviter une généralisation abusive ;
- tester les cas limites ;
- vérifier les autres écrans, compteurs et exports utilisant la même donnée ;
- lancer `git diff --check` dans un environnement local lorsqu'il est disponible.

Un test spécifique qui passe ne suffit pas si le reste de l'application régresse.

Lorsqu'un ancien test échoue, vérifier s'il révèle un vrai problème ou s'il décrit une ancienne règle désormais remplacée. Ne pas le supprimer sans comprendre pourquoi.

## 7. Interface et expérience réelle

L'application est utilisée principalement sur téléphone.

Toujours vérifier :

- lisibilité sur petit écran ;
- boutons facilement utilisables ;
- nombre d'étapes nécessaire ;
- fermeture et réouverture des fenêtres ;
- conservation du contexte de navigation ;
- messages compréhensibles sans connaître le fonctionnement interne ;
- absence de dates ou valeurs techniques brutes dans l'interface.

Une donnée facultative ne doit pas être présentée comme une erreur. Une donnée obligatoire manquante doit être clairement signalée.

Éviter les informations redondantes ou ambiguës.

## 8. Application installable et cache

Pour la PWA, chaque publication modifiant le comportement doit changer la version des ressources et du cache du service worker.

Après publication, vérifier que :

- `index.html` référence bien les ressources attendues ;
- le nom du cache a changé ;
- les fichiers nécessaires sont présents dans le cache ;
- l'ancienne version sera remplacée après fermeture et réouverture de l'application.

Ne pas conclure trop vite à un bug de code si un téléphone utilise encore une ancienne version en cache : vérifier ce point au lieu de le supposer.

## 9. Documentation de passation

Maintenir ce fichier à jour avec :

- méthode de travail ;
- architecture ;
- règles fonctionnelles validées ;
- décisions importantes ;
- migrations ;
- anomalies connues ;
- corrections réalisées ;
- tests disponibles ;
- feuille de route ;
- méthode de publication GitHub.

Éviter d'y conserver des informations devenues fausses, notamment des numéros de version ou des états de déploiement anciens.

## Tests du module de transfert

Le dépôt inclut un test automatisé sans dépendance externe : `npm test`. Il couvre les exports/imports V4, les deux formes d'entrées V3 (`zones` et `zone`), la conservation des dates/heures et notes, les doublons, les collisions d'identifiants et le refus atomique des fichiers invalides. Les données personnelles ne doivent jamais être ajoutées aux fixtures du dépôt.

Les tests couvrent également la modification d'une observation sans recréer son identifiant ni changer sa date précise, sa note ou ses métadonnées intactes. Ils vérifient le reclassement ciblé et idempotent des éléments V3 nommés exactement « Migraine » et « Migraine ophtalmique ».

Les tests du suivi d'épisode vérifient que chaque clic « Encore maintenant » enregistre son horodatage dans le même événement, que la durée minimale va de la première observation au dernier constat où l'événement était encore présent, et que l'heure à laquelle l'absence est constatée est distincte de cette durée. Toute observation, y compris une ancienne entrée V3, peut recevoir un constat passé après son premier repère et avant sa fin si elle est connue. Les constats sont ordonnés et un horaire identique ne crée pas de doublon. Si le premier repère est antidaté, l'ancien repère est conservé comme constat par défaut; l'éditeur permet de l'écarter si l'heure d'origine était erronée. La fin reste facultative et explicite, et les anciennes observations ne reçoivent aucune durée inventée. Depuis le lot 2, une nouvelle saisie clôture uniquement l’ancien épisode de la même douleur à la même localisation, avec fin inconnue ; cette règle remplace l’absence de clôture automatique du socle initial.

## 10. Publication GitHub

Ne pas utiliser `git push` si l'environnement ne possède pas d'identifiants Git. Ne demander à l’utilisatrice ni jeton, ni mot de passe, ni clé SSH.

Utiliser l'interface GitHub connectée :

1. Vérifier la tête distante de `main`.
2. Pour chaque fichier existant à modifier, récupérer sa version distante et son SHA.
3. Envoyer le contenu complet avec l'action GitHub de mise à jour, en indiquant le SHA distant.
4. Créer les nouveaux fichiers avec l'action GitHub adaptée.
5. Mettre les fichiers à jour séquentiellement, jamais en parallèle pour une même publication.
6. Vérifier ensuite la nouvelle tête distante.
7. Relire les fichiers importants directement depuis GitHub.

Il est normal que le SHA final sur GitHub soit différent d'un éventuel commit local : l'interface GitHub peut créer un commit distant par fichier.

Ne jamais annoncer que c'est publié avant d'avoir vérifié le dépôt distant.

## 11. Manière de communiquer avec l’utilisatrice

- Distinguer clairement les faits, les hypothèses et les incertitudes.
- Ne pas inventer une explication quand les données manquent.
- Dire précisément ce qui a été vérifié.
- Signaler les contradictions ou comportements inhabituels.
- Ne pas surinterpréter une demande.
- Poser une question uniquement si un choix manque réellement et empêche d'avancer.
- Ne pas transformer une hypothèse ancienne en règle définitive.
- Rester concis, mais expliquer le raisonnement lorsque le problème est complexe.

## 12. Préserver l'autonomie de l’utilisatrice

- Le code doit être lisible et abondamment commenté.
- Les noms de fonctions et de variables doivent être explicites.
- Les modifications importantes doivent être découpées en étapes compréhensibles.
- L'objectif est que l’utilisatrice puisse relire, comprendre et modifier progressivement le projet sans dépendre d'une seule conversation.

## 13. Non-acharnement technique

Ne pas tourner en rond sur une même approche.

- Une méthode qui échoue peut faire l'objet d'au maximum **3 tentatives réellement différentes**.
- Si elle reste bloquée, changer d'approche au lieu d'empiler des rustines ou de répéter les mêmes manipulations.
- Si plusieurs approches raisonnables échouent, arrêter et faire à l’utilisatrice un état des lieux clair : ce qui fonctionne, ce qui bloque, ce qui a été essayé et les alternatives possibles.
- Si une solution devient anormalement tordue ou fragile, considérer cela comme un signal pour changer de voie.

## Architecture V4 initiale

La V4 est une PWA mobile-first avec données locales. Elle démarre volontairement sans historique importé.

- `index.html` : structure de l'interface.
- `styles.css` : présentation mobile-first.
- `src/storage.js` : lecture/écriture du stockage local et format de données.
- `src/catalog.js` : création et gestion des éléments de suivi.
- `src/entries.js` : création, correction, suppression et chronologie des observations/épisodes.
- `src/stats.js` : calculs statistiques communs.
- `src/transfer.js` : validation, export JSON V4, import JSON V4/V3 et fusion non destructive.
- `src/ui.js` : rendu de l'interface et orchestration des interactions.
- `src/body-map.js` : zones anatomiques proposées par la carte Rhumato, différentes selon la face du corps.
- `src/app.js` : point d'entrée de l'application.
- `manifest.webmanifest` : métadonnées d'installation PWA.
- `sw.js` : fonctionnement hors ligne et cache.

### Format de données initial

Le stockage V4 utilise une clé séparée de la V3 afin de ne jamais altérer l'ancien historique pendant la phase de transition.

Les données V4 contiennent :

- `schemaVersion` ;
- `catalog` : éléments de suivi créés par l'utilisatrice ;
- `entries` : observations enregistrées ;
- `settings` : préférences générales de l'application.

L'import V3 sera conçu séparément et ne devra jamais effacer la source V3.

## Architecture modulaire en cours

- L'accueil ouvre les pages Rhumato, Digestif et Symptômes / événements. Mesures est affiché comme module à préparer ; aucune collecte de mesure n'est encore active.
- Le même formulaire de saisie est utilisé dans chaque module et pour corriger une observation existante.
- Le classement d'un élément du catalogue est global : il déplace toutes les observations liées à cet élément. La correction d'une seule observation passe par son éditeur et ne change que les associations cochées et les champs effectivement modifiés.
- Les éléments V3 d'identifiants `item-v3-*` et de libellés exacts « Migraine » ou « Migraine ophtalmique » sont classés comme symptômes/événements. Cette migration idempotente ne change pas les observations. Les autres anciennes zones restent à corriger au cas par cas.
- Le modèle de stockage existant est conservé ; ajouter un module ne nécessite pas de convertir l'historique.
- La carte Rhumato recto-verso crée au besoin des zones précises dans le catalogue, puis les coche dans le formulaire courant. Les coches peuvent être retirées depuis le résumé de sélection ; les anciennes entrées ne sont pas modifiées.
- `occurredAt` est le premier repère de l'observation. Toute observation, y compris une ancienne entrée V3 qui n'a pas encore de données de suivi, peut recevoir des constats « Encore maintenant » ou antidatés depuis l'historique. Chaque constat est une heure de présence, pas une nouvelle observation. Les constats antidatés doivent se situer après le premier repère et, si une fin est connue, avant celle-ci. Ils sont triés et une même heure n'est stockée qu'une fois. Une fin explicite est portée par `endedAt`. Depuis le lot 2, `closedUnknown` distingue un épisode clôturé sans heure de fin. Les observations anciennes sans ces champs ne reçoivent aucune fin inventée.
- La durée minimale constatée se calcule entre `occurredAt` et le dernier constat où l'événement était encore présent. La fin constatée (`endedAt`) est séparée et ne prolonge pas cette durée. Quand l'heure de début est corrigée vers une heure antérieure, l'ancien premier repère est conservé comme constat de présence par défaut ; la case de l'éditeur permet de ne pas le conserver si cet ancien horaire était erroné. Les anciennes données ne reçoivent ni fin ni durée ultérieure inventée.

### Rubriques repliables

Dans les modules, l’historique et les zones/éléments enregistrés sont des rubriques repliées par défaut. Toucher leur titre les ouvre ou les referme. Le rendu des données ne force pas leur ouverture et ne change pas leur état.

### Éléments personnalisés sur la carte corporelle

Un seul élément de catalogue (ex. « Ongles ») peut être rattaché aux deux côtés de la même partie du corps. Le formulaire commun de création/modification propose la partie, les cases droite/gauche et les cases face/dos. Les régions non latéralisées (cou, torse/dos) ne demandent pas de côté. Le rattachement est facultatif et réservé aux zones Rhumato.

- `catalog[].bodyMap` (facultatif) contient `regions` (identifiants de régions) et `surfaces` (`front`/`back`). La validation et les choix de carte sont centralisés dans `src/body-map.js`.
- `entries[].itemLocations` (facultatif) associe chaque identifiant d'élément aux régions effectivement choisies dans cette observation. Les deux mains peuvent être choisies dans une même saisie, avec un seul élément de catalogue.
- Le rattachement actuel d'un élément ne déduit aucun côté pour les anciennes observations. Modifier ou retirer le rattachement ne réécrit pas les localisations déjà enregistrées. L'édition conserve les anciens choix, même s'ils ne figurent plus sur la carte actuelle.
- L'historique et les statistiques utilisent les mêmes libellés de sélection (ex. « Ongles — Main droite »). Le compteur d'observations compte toujours les observations, pas les côtés.
- L'export JSON conserve les deux champs. Lors d'une collision d'identifiants à l'import, les clés de `itemLocations` sont remappées avec les identifiants du catalogue. Réimporter une ancienne sauvegarde sans rattachement ne duplique pas les éléments dont seul le placement a été enrichi depuis.
- Tests de régression : `tests/body-map-locations.test.mjs` (bilatéralité, vue, conservation historique, modification ciblée, import/export et idempotence après rattachement).

### Vérification d’interface restant à faire

Le moteur est couvert par les tests automatisés. Le contrôle visuel dans un navigateur local n'a pas pu être exécuté : aucun exécutable Chromium n'est installé et son téléchargement a échoué (archive invalide). Ne pas présenter l'interface mobile comme testée. Vérifier : créer « Ongles » une fois pour les deux mains, choisir face/dos, sélectionner les deux côtés, retirer un seul côté depuis les sélections, sauvegarder/recharger, modifier l'observation, modifier le rattachement et vérifier que l'ancien côté reste intact. Vérifier aussi l'ouverture/fermeture des rubriques Historique et Zones enregistrées. l’utilisatrice a autorisé la publication le 18 octobre 2026 après avoir été informée de cette limite ; le contrôle visuel reste à effectuer.

## Lot 1 Digestif — développement local du 26 octobre 2026

État : publication autorisée le 26 octobre 2026 pour tests par l’utilisatrice ; moteur testé, contrôle Android restant à faire. Le cahier des charges et les arbitrages sont dans `docs/CAHIER_DES_CHARGES_DIGESTIF.md`.

- `src/digestive.js` : validation Bristol, commandes de transit, conditions, jours et fusion additive.
- `src/digestive-ui.js` : un seul éditeur création/correction, historique transit, jours sans passage et conditions.
- `digestive` est une extension racine optionnelle du schéma 1 : `{version:1, events, conditions, days}`. Les anciennes `entries` ne sont pas converties. Les journées utilisent des dates civiles locales explicites, distinctes des horodatages UTC.
- `events[].kind` distingue passage et accident. Bristol conserve `types` et `mode` (`simple`, `intermediate`, `distinct`). Douleur ponctuelle entière de 0 à 10 pour un passage, `null` pour un accident. Aucun épisode douloureux n'est créé.
- Les conditions sont référencées par ID avec copie du libellé à la saisie. Renommer/désactiver ne réécrit pas l'historique ; modifier une observation conserve le libellé de ses conditions inchangées.
- La confirmation quotidienne signifie aucun passage aux toilettes. Un accident peut coexister et interdit de compter ce jour comme sans émission de selles. Un passage ajouté corrige la confirmation contradictoire ; sa suppression ne recrée pas cette confirmation.
- Les sauvegardes exportent le format 2 et lisent les formats 1 et 2, ainsi que la V3. Ce numéro protège contre une restauration silencieusement incomplète dans une ancienne application. La fusion remappe les collisions digestives et ne remplace aucune observation.
- Une lecture du stockage invalide/inconnue bloque toute écriture jusqu'à un chargement réussi et affiche un avertissement. Les propriétés racine inconnues sont conservées à la sauvegarde.
- Sept visuels originaux générés par imagegen sont dans `images/bristol-1.webp` à `bristol-7.webp`, chargés localement et inclus dans le cache. Les formes ont été contrôlées avec les descriptions du NHS : https://www.england.nhs.uk/wp-content/uploads/2023/07/Bristol-stool-chart-for-carer-web-version.pdf. Illustrations validées par l’utilisatrice le 26 octobre 2026.
- Les règles de suivi des anciennes observations restent inchangées dans ce lot. Le fractionnement des saisies simultanées, les constats enrichis et la clôture ciblée sont réservés au lot 2.
- Rapports médicaux, statistiques spécialisées, historique entrelacé et notifications restent à réaliser dans leurs lots.
- Tests : `npm test`. Vérification du navigateur indisponible : installation Chromium échouée (archive téléchargée invalide). Ne pas annoncer de test mobile réel.

## Lot 2 — symptômes configurables et corrections d’ergonomie

État : **publication de la version 4.8.0 autorisée par l’utilisatrice le 26 octobre 2026 pour tests sur son téléphone**. Accord de développement explicite de l’utilisatrice après les retours du lot 1. Les décisions détaillées sont dans `docs/LOT_2_DECISIONS.md` et le bilan dans `docs/BILAN_LOT_2.md`.

### Moteurs communs

- `src/criteria.js` définit les champs/actions, configurations, valeurs initiales et validations. La douleur commence à 0 uniquement pour une nouvelle observation dont le formulaire contient ce critère. Absence de critère, gêne vide et anciennes valeurs absentes restent distinctes de zéro.
- `src/criteria-ui.js` construit les champs des aperçus, des saisies et des corrections. Les champs historiques retirés d’une configuration restent consultables et modifiables ; les nouveaux champs ajoutés ne sont pas remplis rétroactivement.
- `src/episodes.js` est le moteur temporel commun aux nouvelles observations et au suivi par cible des anciennes saisies. `src/entries.js` conserve les fonctions du socle nécessaires aux anciennes données et à la correction des associations ; l’interface utilise le moteur commun pour les nouveaux épisodes et les constats.
- `src/episode-ui.js` emploie une même fenêtre pour les symptômes, l’édition d’une cible, les constats et la fin. Les symptômes prédéfinis et personnalisés utilisent la même bibliothèque et les mêmes commandes.
- `src/history.js` produit les vues ordonnées communes à l’accueil et aux modules ; `src/history-ui.js` les rend. Transit, accidents, journées sans passage et symptômes sont tous visibles, sans doublon d’historique Digestif. L’intercalage exhaustif des constats dans une chronologie médicale reste au lot 3.
- `src/dialogs.js` assure la barre unique Annuler/Enregistrer, sa position persistante, l’abandon protégé et la fermeture par Échap. Aucun double moteur de sauvegarde n’est ajouté pour les boutons.

### Données additives

Le schéma racine reste 1 ; le format de sauvegarde passe à **3**, avec lecture des formats 1, 2 et V3. Les anciennes applications refuseront le format de sauvegarde récent au lieu de restaurer silencieusement des données incomplètes.

- Le catalogue porte une configuration optionnelle `config: {version:1, criteria:[...]}`.
- Une nouvelle observation peut porter `episodeVersion:2`, `values`, `configSnapshot`, `itemSnapshot`, `sourceGroupId`, `checks` et `occurrenceGroupId`.
- Une saisie commune crée un épisode par élément ET côté. Chaque épisode reçoit un identifiant propre, le même horaire/niveau/commentaire initial, et un `sourceGroupId` commun qui n’exprime pas de lien médical.
- Les anciens enregistrements groupés gardent leur identifiant, leurs données brutes et leurs constats. Les évolutions ciblées sont ajoutées dans `targetStates`, indexé par `JSON.stringify([itemId,regionId])`. Le transfert remappe ces clés lors d’une collision de catalogue.
- `checks` conserve l’identité, l’heure, les niveaux/valeurs et la note de chaque constat. `stillAt` reste le miroir temporel compatible. Les anciens horaires sont projetés sans intensité inventée ; éditer/supprimer un constat ne détruit pas l’épisode.
- `closedUnknown` et `closure` portent la clôture automatique définitive. `closure.nextEpisodeAt` est le repère du nouvel épisode, **pas une heure de fin estimée**. Il interdit d’ajouter un constat contradictoire après ce nouveau début. Supprimer/modifier la nouvelle entrée ne rouvre jamais l’ancienne. Une fin explicite peut être précisée après coup, dans les bornes compatibles.
- Les actions enregistrent une heure capturée au clic. La préparation du formulaire et le temps pris pour le remplir ne décalent pas cette heure si elle n’est pas modifiée.
- Une nouvelle occurrence de remontée crée sa propre observation dans le même groupe ; hauteur et gêne restent non renseignées. Un éventuel critère douleur personnalisé conserve sa convention de zéro initial.

### Vérification et publication

- `npm test` : 83 tests réussis pour le moteur et le précache. Les 58 tests antérieurs sont conservés.
- `tests/browser-lot2.mjs` exécute une série de scénarios réels avec Playwright, serveur local intégré et données synthétiques : création/édition, modalités, abandon, historique, anciennes données, réimportation, petits écrans et hors ligne. Les outils du navigateur ne font pas partie de l’application.
- Chromium a pu être installé pour ce lot via un paquet de distribution, contrairement au téléchargement standard qui avait échoué auparavant. Les essais ont réellement été exécutés. Cela ne remplace pas une validation sur le téléphone Android de l’utilisatrice.
- Les ressources et le cache sont préparés pour la version 4.8.0. Accord distinct de publication donné par l’utilisatrice le 26 octobre 2026 pour tests. Vérifier `main`, les ressources distantes et GitHub Pages avant d’annoncer la mise en ligne.
- Pour une publication atomique incluant plusieurs nouveaux modules/illustrations, l’interface GitHub peut créer les blobs, un arbre basé sur la tête vérifiée, puis un seul commit et un déplacement non forcé de `main`. Cela évite un déploiement intermédiaire incomplet. Ne jamais utiliser `git push` sans identifiants ni écraser une tête distante qui a changé.

## Correctifs du 27 octobre 2026 — version 4.8.1 préparée

Développement autorisé par la liste explicite de correctifs de l’utilisatrice ; **publication autorisée séparément par l’utilisatrice le 27 octobre 2026 après validation du bilan**. Base distante vérifiée : `3cec3eb4a721683527ba89dc1b2d9936de0a1260`. Détails : `docs/BILAN_CORRECTIFS_2026_10_27.md`.

- Paramètres via roue dentée, catalogue commun toutes familles et conditions dans les éditeurs existants. `ensureDigestivePresets` matérialise les sept propositions sans créer d'observation ; `presetKey` conserve leur identité après renommage. Le sélecteur utilise `getDigestiveSymptomChoices`.
- Tous les critères numériques 0–10 utilisent `scale` et `bindNumericRange`, y compris la douleur du transit. Zéro, vide et ancienne valeur absente restent distincts. Rhumato conserve ses niveaux qualitatifs.
- `getFollowupRows`, `getTodayOccurrenceRows` et `nextDailyRefreshAt` dans `history.js` pilotent les raccourcis, sans écriture métier. Expiration à 48 h après la dernière présence ; changement de jour civil local pour les occurrences. Minuteur et reprise après veille ; aucune fiche réinitialisée.
- Le constat direct d'accueil emprunte `savePresenceCheck`, sans intensité par défaut puisqu'aucun champ n'est présenté. Les autres constats et leurs corrections gardent leur éditeur commun.
- `finishEpisode(..., null)` clôture avec heure inconnue : `closedUnknown`, trace `closure`, aucun `endedAt` supposé. Une fin connue reste corrigeable et n'est pas effacée par ce raccourci. Les clôtures automatiques et cibles anciennes sont préservées.
- Statistiques et Historique fermés à chaque entrée dans le module ; les rendus après enregistrement ne changent pas leur ouverture. L'état n'est pas stocké.
- Aucun changement du schéma 1 ni du format de sauvegarde 3. Ressources/cache préparés pour 4.8.1 ; publication autorisée, vérifier le déploiement distant.
- Tests : 96 tests moteur et 28 parcours Chromium (16 du lot 2 + 12 correctifs), données synthétiques. Le contrôle Android réel reste à effectuer après publication autorisée.

## Audit des actions communes — 4.8.2, non publiée

Demande explicite de l’utilisatrice le 27 octobre 2026. Base distante : `61f1465b7ce1683691f71a53db0120ef3907401d`. Le bilan est dans `docs/AUDIT_ACTIONS_COMMUNES_2026_10_27.md` ; attendre sa validation et l'autorisation distincte de publication.

- Cette décision remplace le constat immédiat d'accueil de 4.8.1 : tous les boutons Encore maintenant ouvrent la même fiche `openEpisodeAction("still")`. Aucun constat n'est créé avant Enregistrer ; Annuler n'en crée pas.
- `getLastKnownIntensity` dans `episodes.js` propose les dernières intensités connues de la cible/épisode jusqu'à l'heure du clic. Recherche indépendante par critère numérique, zéro conservé, absences sautées, niveaux qualitatifs conservés. Commentaires et localisations non recopiés ; aucune réécriture historique. Sans mesure connue, laisser inconnu, pas zéro initial de nouvelle douleur.
- Les constats passés sans heure choisie et l'édition d'anciens constats n'héritent pas de ce préremplissage ; ils gardent respectivement des champs inconnus ou leurs valeurs propres.
- Toutes les commandes occurrence sauvegardent le fait à l'heure du clic via `addOccurrence`, puis ouvrent directement l'éditeur commun. Fermer la fiche ou abandonner ses détails ne supprime pas l'occurrence. Enregistrer conserve son identifiant et son heure précise.
- Les branchements temporels legacy et leur ancienne fenêtre sont supprimés de l'interface, après vérification de l'absence de boutons les produisant. Les fonctions historiques de `entries.js` restent exportées et testées. `updateEntry` reste utilisé pour les associations d'origine ; tout suivi temporel, y compris V3, utilise `episodes.js` et son éditeur.
- Aucun changement de schéma ni migration des observations. Version/cache 4.8.2 préparés localement.
- Vérifications : 105 tests automatisés ; 28 anciens parcours Chromium adaptés ; sept matrices sur 14 combinaisons type/point d'entrée. Détails, limites et fixtures synthétiques dans le bilan.

## Audit général consolidé — 4.8.2 en attente de validation

La demande complémentaire de l’utilisatrice inclut le travail `cd426b9` sur les actions communes ; ne pas le remplacer par la branche distante 4.8.1. Le bilan actuel de référence est `docs/BILAN_AUDIT_GENERAL_2026_10_27.md`. **Aucune publication sans validation de ce bilan.**

- `src/transactions.js` porte la frontière `transactData` : commande sur copie, validation/sérialisation/sauvegarde, puis publication dans la référence partagée. En cas d'échec, mémoire et stockage restent dans leur état précédent. L'affichage vient après la sauvegarde et ne déclenche jamais de restauration locale de données déjà écrites.
- Toutes les écritures d'interface passent par l'adaptateur `transact` de `app.js`, y compris carte corporelle, transit, conditions, journées et import. `persistAndRender` et la restauration propre au digestif sont supprimés.
- La migration ciblée des anciennes migraines utilise la même frontière. Si elle ne peut pas être enregistrée, conserver le classement persistant et réessayer au prochain chargement ; ne pas retourner un catalogue migré uniquement en mémoire et ne pas vider l'historique.
- `calculateStats(data, {moduleId})` utilise les projections d'historique. Une ancienne saisie groupée multi-module ne doit pas laisser le suivi d'une autre cible fausser le compteur du module. Les observations sources restent dédupliquées ; les constats ne deviennent pas des observations supplémentaires.
- `isItemInModule` est centralisé dans `catalog.js` et partagé par les choix, l'historique et les statistiques. Une famille importée inconnue reste consultable dans Symptômes / événements sans reclassement de ses données brutes.
- Tests consolidés : 130 automatisés, 37 parcours navigateur et sept matrices sur 14 combinaisons. Les nouveaux scénarios injectent un échec réel de stockage et comparent l'export mémoire au disque et aux compteurs. Fixtures synthétiques uniquement. Contrôle Android réel restant à faire.
- Schéma 1 et format de sauvegarde 3 inchangés. 4.8.2 et son précache, incluant `transactions.js`, sont préparés localement ; la version distante vérifiée reste 4.8.1.
