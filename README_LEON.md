# README_LEON — consignes de développement

Ce document sert de passation pour tout assistant qui reprend le projet **Journal de suivi santé**. Il décrit la méthode de travail convenue avec Laurie. Le dépôt reste la source de vérité technique : toujours lire le code réel avant d'agir.

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

Si plusieurs causes restent plausibles, les expliquer à Laurie et préciser ce qui manque pour les départager.

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

Une correction locale, clairement déterminée et sans choix fonctionnel important peut être préparée directement.

Si plusieurs comportements sont possibles ou si la modification change une règle fonctionnelle, expliquer d'abord :

- ce que fait actuellement l'application ;
- pourquoi cela pose problème ;
- les solutions possibles ;
- celle qui paraît la plus cohérente et ses conséquences.

Laurie valide ensuite la règle.

Le correctif peut être développé et testé. **Toute publication sur GitHub attend un accord explicite de Laurie, généralement « Go ».**

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

## 10. Publication GitHub

Ne pas utiliser `git push` si l'environnement ne possède pas d'identifiants Git. Ne demander à Laurie ni jeton, ni mot de passe, ni clé SSH.

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

## 11. Manière de communiquer avec Laurie

- Distinguer clairement les faits, les hypothèses et les incertitudes.
- Ne pas inventer une explication quand les données manquent.
- Dire précisément ce qui a été vérifié.
- Signaler les contradictions ou comportements inhabituels.
- Ne pas surinterpréter une demande.
- Poser une question uniquement si un choix manque réellement et empêche d'avancer.
- Ne pas transformer une hypothèse ancienne en règle définitive.
- Rester concis, mais expliquer le raisonnement lorsque le problème est complexe.

## 12. Préserver l'autonomie de Laurie

- Le code doit être lisible et abondamment commenté.
- Les noms de fonctions et de variables doivent être explicites.
- Les modifications importantes doivent être découpées en étapes compréhensibles.
- L'objectif est que Laurie puisse relire, comprendre et modifier progressivement le projet sans dépendre d'une seule conversation.

## 13. Non-acharnement technique

Ne pas tourner en rond sur une même approche.

- Une méthode qui échoue peut faire l'objet d'au maximum **3 tentatives réellement différentes**.
- Si elle reste bloquée, changer d'approche au lieu d'empiler des rustines ou de répéter les mêmes manipulations.
- Si plusieurs approches raisonnables échouent, arrêter et faire à Laurie un état des lieux clair : ce qui fonctionne, ce qui bloque, ce qui a été essayé et les alternatives possibles.
- Si une solution devient anormalement tordue ou fragile, considérer cela comme un signal pour changer de voie.

## Architecture V4 initiale

La V4 est une PWA mobile-first avec données locales. Elle démarre volontairement sans historique importé.

- `index.html` : structure de l'interface.
- `styles.css` : présentation mobile-first.
- `src/storage.js` : lecture/écriture du stockage local et format de données.
- `src/catalog.js` : création et gestion des éléments de suivi.
- `src/entries.js` : création/suppression des observations.
- `src/stats.js` : calculs statistiques communs.
- `src/transfer.js` : validation, export JSON V4, import JSON V4/V3 et fusion non destructive.
- `src/ui.js` : rendu de l'interface et orchestration des interactions.
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