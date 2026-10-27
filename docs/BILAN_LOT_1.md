# Lot 1 — Transit quotidien

Développé le 26 octobre 2026 à partir de `main` (`218b95e7f8bae1e76cf94c22bb74c3dfa42d6325`). **Publication autorisée par l’utilisatrice le 26 octobre 2026 pour passage en phase de tests.**

## Fonctions disponibles dans le code

- Page Digestif : accès au passage aux toilettes, à l’accident, à la saisie générale de symptômes et à l’historique du transit.
- Bristol obligatoire : un type ou deux ; signification distincte de l’aspect intermédiaire (voisins seulement) et de deux aspects présents (toutes les paires). Un passage reste une seule observation.
- Sept illustrations réalistes originales, liste tactile verticale et agrandissement.
- Conditions facultatives cumulables, ajout/renommage/désactivation et maintien du libellé historique.
- Douleur ponctuelle 0–10, valeur initiale 0, sans création d’un épisode douloureux.
- Accident indépendant, type 7 présélectionné et modifiable, commentaire et heure modifiables.
- Création, correction et suppression ciblées du transit. Les secondes d’origine restent intactes si le champ horaire n’est pas modifié.
- Confirmation manuelle pour une date choisie sans passage, annulable. Un accident ne la contredit pas mais exclut une journée sans émission de selles. Un passage ajouté corrige une confirmation contradictoire ; sa suppression ne recrée pas la confirmation.
- Sauvegarde/restauration des nouvelles données, collisions préservées et réimportation sans doublon.
- Les compteurs existants de l’accueil restent consacrés aux douleurs et symptômes, explicitement libellés ainsi. Le transit est consultable dans son propre historique jusqu’au lot 3.

## Protection des données

Aucune conversion ni suppression des anciennes observations V3/V4. Le module digestif est une extension optionnelle ; les premiers enregistrements l’ajoutent au stockage existant. Les journées civiles locales sont conservées séparément des horaires UTC.

Le nouveau format de sauvegarde est numéroté 2 : cette application lit les formats 1/2 et la V3. Une ancienne application refusera le format 2 plutôt que restaurer un historique incomplet.

Une lecture impossible du stockage bloque les écritures et affiche un avertissement. Le téléchargement de la source brute reste proposé. Les erreurs de sauvegarde du transit annulent la modification en mémoire.

## Vérifications réalisées

- **58 tests réussis**, dont les 42 tests existants.
- Cas Bristol simples et toutes les paires, absence de sélection, accident indépendant, journées inconnues, corrections, conditions renommées/désactivées, sauvegardes anciennes/nouvelles, conflits et idempotence, dates locales et protection du stockage.
- Présence des ressources hors ligne et de tous les imports transitifs dans le précache du service worker.
- Syntaxe JavaScript, `git diff --check`, unicité des identifiants HTML, cibles des contrôles et absence de formulaires imbriqués.
- Contrôle des formes des sept illustrations contre les descriptions du NHS. Détails et prompts : `ILLUSTRATIONS_BRISTOL.md`.

## Vérifications restant à faire

**L’interface n’a pas été exécutée dans un vrai navigateur.** Chromium est absent ; son installation a échoué (archive téléchargée invalide). Les contrôles statiques ne prouvent ni la disposition mobile ni le fonctionnement réel des interactions et du service worker.

Avant validation finale : ouvrir sur petit écran Android, enregistrer un passage simple et double, agrandir une illustration puis revenir au formulaire, corriger/supprimer, tester les conditions, les jours sans passage, exporter/réimporter, fermer/rouvrir et répéter une saisie hors ligne. Vérifier que les données saisies avant mise à jour sont intactes.

Les illustrations ont été validées par l’utilisatrice le 26 octobre 2026.

## Suite

Lot 2 : symptômes digestifs, remontées, constats enrichis, saisie simultanée produisant des épisodes indépendants et clôture ciblée. Puis historique commun, rapports médicaux et étude des rappels. Les lots suivants ne sont pas engagés. La publication du lot 1 pour tests a été autorisée séparément le 26 octobre 2026.
