# Cahier des charges — Journal de suivi santé

## Module Digestif, historique commun et exports médicaux

**Statut : conception fonctionnelle validée.**

Ce document constitue la transmission des décisions prises pour faire évoluer l'application V4 existante. Il ne remplace pas les consignes techniques du dépôt GitHub.

## 1. Consignes impératives pour Work

Avant de développer :

1. Lire `README_LEON.md`, `ROADMAP.md` et le code actuel sur la branche principale.
2. Examiner le modèle de données, les formulaires, le suivi des épisodes, les historiques et les exports existants.
3. Repérer les fonctions et composants réutilisables. Une même règle métier doit disposer d'une seule implémentation de référence.
4. Identifier les migrations nécessaires sans supprimer ni modifier involontairement les anciennes données.
5. Présenter le découpage technique des travaux, les éventuelles difficultés et les choix encore à arbitrer.

**Ne pas considérer cette transmission comme une autorisation de développer ou publier l'ensemble en une seule opération.** Le développement sera autorisé par phase. La publication nécessitera une validation distincte.

Le code doit rester lisible, aéré, commenté et testé.

L'application reste mobile-first, utilisable hors ligne, avec stockage local des données personnelles.

---

# PHASE 1 — Enregistrement du transit

**Priorité : permettre une utilisation quotidienne dès que possible.**

## 2. Page Digestif

Prévoir une page avec de gros boutons accessibles :

- Passage aux toilettes
- Ça s'est échappé
- Symptôme digestif
- Historique et rapports

La saisie doit être rapide. Les champs secondaires restent facultatifs.

Les dates et heures sont proposées automatiquement, mais restent modifiables afin de permettre une saisie rétrospective.

## 3. Échelle de Bristol

### Sélection

Permettre de sélectionner un ou deux types parmi les sept catégories officielles.

Avec deux types :

- **Aspect intermédiaire** : uniquement entre deux types voisins.
- **Deux aspects réellement présents** : toutes les combinaisons de deux types sont possibles.

Ces deux situations doivent rester distinctes dans les données et les statistiques.

Un passage avec deux types reste un seul passage aux toilettes.

### Illustrations

Sept illustrations médicales réalistes et précises :

- Fond neutre.
- Aspect naturel.
- Textures fidèles.
- Différences clairement visibles entre les types.
- Présentation sous forme de liste verticale.
- Illustration, numéro et description sur chaque ligne.
- Sélection de la ligne au toucher.
- Possibilité d'agrandir l'illustration.

Les illustrations doivent respecter les caractéristiques médicales de l'échelle de Bristol. Les contrôler avant intégration.

## 4. Conditions du transit

Cases facultatives et cumulables :

- Urgence
- Effort pour évacuer
- Sensation d'évacuation incomplète
- Ça s'est échappé

Permettre d'ajouter, renommer et désactiver des conditions personnalisées sans perdre les observations historiques.

### Douleur pendant l'évacuation

Réglette de 0 à 10, initialisée à 0.

Cette mesure ponctuelle est associée au passage aux toilettes. Elle ne crée pas automatiquement un épisode douloureux indépendant.

### Commentaires

Champ libre facultatif permettant notamment de noter :

- Les circonstances inhabituelles.
- Les aliments consommés.
- Les sensations associées.
- Toute observation jugée pertinente.

Aucun journal alimentaire quotidien obligatoire.

## 5. Accidents

L'action « Ça s'est échappé » permet d'enregistrer une émission involontaire de selles indépendamment d'un passage aux toilettes.

- Date et heure modifiables.
- Bristol 7 présélectionné, mais modifiable.
- Commentaire facultatif.
- Pas de distinction selon la quantité.

Un accident et un passage aux toilettes sont deux événements différents.

Un accident peut coexister avec une journée sans passage aux toilettes, mais ne peut pas être assimilé à une journée sans émission de selles.

---

# PHASE 2 — Symptômes digestifs et suivi des épisodes

## 6. Enregistrement des symptômes

Séparer les deux notions :

**Localisation :** estomac, intestins, œsophage, gorge, abdomen mal localisé, autres emplacements personnalisables.

**Nature :** brûlure, crampe, spasme, ballonnement, nausée, remontée acide, douleur diffuse et autres symptômes personnalisables.

Les champs proposés peuvent s'adapter au symptôme choisi.

Un symptôme correspond à un événement indépendant. Deux symptômes simultanés peuvent avoir des évolutions différentes.

Réutiliser autant que possible le moteur temporel existant.

## 7. Remontées acides

Une remontée et une brûlure constituent deux symptômes indépendants.

Pour chaque remontée :

- Hauteur atteinte : œsophage, gorge ou bouche.
- Gêne facultative de 0 à 10.
- Date et heure.
- Commentaire facultatif.

Une gêne non renseignée doit être différente d'une gêne égale à zéro.

### Bouton « + Une nouvelle remontée »

Permet d'ajouter immédiatement une nouvelle occurrence à un groupe existant.

- Horodatage automatique à l'instant du clic.
- Hauteur et gêne laissées non renseignées.
- Possibilité de modifier ou compléter ultérieurement chaque occurrence.

Chaque remontée compte comme une occurrence distincte, même si plusieurs appartiennent au même groupe.

Ne pas confondre « Une nouvelle remontée » avec « Encore maintenant ».

## 8. Nausées

Créer le symptôme « Nausée » avec :

- Intensité facultative.
- Commentaire libre.
- Début, constats successifs et fin éventuelle.

Ne pas imposer de localisation.

---

# PHASE 3 — Historique et évolution des douleurs

## 9. Historique commun

Unifier la consultation des observations des différents modules.

Les données peuvent être consultées par journée, dans l'ordre chronologique.

Prévoir des repères visuels de famille, par exemple :

- Rhumato
- Digestif
- Symptômes / événements

Les repères servent à identifier les catégories, sans masquer les liens possibles entre elles.

Dans le PDF, toutes les familles doivent pouvoir apparaître dans une même chronologie.

## 10. « Encore maintenant »

Modifier cette fonctionnalité pour permettre de renseigner l'évolution de la gêne.

Fonctionnement :

1. L'utilisateur clique sur « Encore maintenant ».
2. L'heure est capturée immédiatement.
3. Un petit formulaire s'ouvre pour choisir l'intensité actuelle.
4. Le commentaire reste facultatif.
5. Le constat est validé.

Pour les douleurs rhumatologiques, conserver les quatre niveaux existants :

- Supportable
- Gênante
- Limitante
- Invalidante

Autoriser les deux niveaux voisins comme dans la saisie existante.

Prévoir une validation sans intensité si l'utilisateur ne souhaite pas la préciser.

Chaque constat conserve sa propre intensité, son horaire et son éventuel commentaire.

Les valeurs précédentes ne doivent jamais être écrasées.

### Modification

Permettre de modifier ou supprimer un constat individuel sans détruire l'épisode complet.

## 11. Évolution visuelle

Dans l'historique et les exports, afficher des flèches :

- ↗ Aggravation
- ↘ Amélioration
- → Stabilité

Comparer les dernières intensités réellement renseignées.

Si la comparaison est ambiguë ou impossible, ne pas afficher de tendance artificielle.

## 12. Fin des épisodes

Distinguer :

**Fin constatée :** l'utilisateur a explicitement indiqué la disparition du symptôme.

**Fin inconnue :** l'épisode est considéré comme terminé, mais son heure exacte de disparition n'est pas connue.

### Clôture automatique

La création d'une nouvelle entrée pour la même douleur et la même localisation implique que l'épisode précédent est terminé.

La clôture se fait automatiquement, sans demande de confirmation.

Le statut de clôture est enregistré sur l'ancien épisode.

La modification ou suppression ultérieure du nouvel épisode ne doit pas rouvrir automatiquement l'ancien.

Conserver tous les anciens constats.

Libellé dans l'historique et les exports :

**« Épisode terminé, heure de fin inconnue. »**

Respecter la localisation précise, notamment le côté droit ou gauche, et les identifiants des symptômes. Vérifier les cas impliquant plusieurs éléments dans une même entrée avant de modifier le moteur.

---

# PHASE 4 — Rappel quotidien

## 13. Rappel à 21 h

Horaire par défaut : **21 h**, modifiable dans les paramètres.

Message :

**« Es-tu allée à la selle aujourd'hui ? »**

Deux actions :

- **Non, pas aujourd'hui** : confirme l'absence de passage aux toilettes.
- **Oui, renseigner** : ouvre le formulaire de transit.

Une absence de réponse reste une donnée inconnue.

Si un passage a déjà été enregistré, le rappel est inutile.

Si seul un accident a été enregistré, le rappel doit toujours pouvoir être envoyé.

La réponse doit pouvoir être corrigée après coup.

### Faisabilité

Étudier la possibilité de notifications à heure fixe, avec actions directement accessibles, dans la PWA installée.

Ne pas ajouter de serveur ou modifier l'architecture de confidentialité sans présenter préalablement les conséquences et obtenir l'accord de l'utilisatrice.

Prévoir une solution alternative si les notifications à heure fixe ne sont pas réalisables dans l'architecture retenue.

---

# PHASE 5 — Statistiques et rapports médicaux

## 14. Objectif général

Le rapport doit être exploitable par un spécialiste consultant les observations d'une année entière.

Prévoir :

1. Une page de synthèse Gastro.
2. Une page de synthèse Rhumato.
3. Des statistiques détaillées.
4. Une synthèse des journées.
5. Une chronologie commune complète.

Les deux premières pages doivent pouvoir être utilisées indépendamment.

La période d'extraction est sélectionnable, avec une présentation adaptée à une année de données.

Le rapport doit rester lisible en PDF A4, y compris à l'impression.

## 15. Synthèse Gastro

Conserver la présentation compacte précédemment retenue.

Inclure :

- Nombre de passages enregistrés.
- Nombre d'accidents.
- Nombre de jours sans selles confirmés.
- Nombre de journées renseignées et non renseignées.
- Plus longue succession documentée de jours sans selles.
- Répartition des types Bristol.
- Répartition des aspects intermédiaires et des deux aspects présents.
- Nombre d'épisodes et d'occurrences des symptômes digestifs.
- Observations personnelles à discuter.

### Périodes sans selles

Seules les journées explicitement confirmées sans émission de selles peuvent entrer dans le calcul d'une série.

Une journée inconnue interrompt la série.

Un accident avec émission de selles l'interrompt également.

Afficher la plus longue période documentée, sans prétendre reconstituer une période inconnue.

### Bristol

Afficher des barres horizontales avec :

- La catégorie exacte.
- Le nombre de passages.
- Le pourcentage des passages classés.

Séparer visuellement les sept types simples des combinaisons.

Pour les combinaisons, distinguer :

- Aspects intermédiaires.
- Deux aspects réellement présents.

Afficher uniquement les catégories réellement observées.

La longueur des barres est proportionnelle à la fréquence de chaque combinaison par rapport à la combinaison la plus fréquente. Les pourcentages indiquent leur part parmi l'ensemble des passages classés.

Un passage ne doit jamais être compté deux fois.

## 16. Synthèse Rhumato

### Carte corporelle

Utiliser les zones corporelles existantes, face et dos.

Colorer les zones selon le nombre de **jours avec au moins un constat positif de douleur**.

Plusieurs constats le même jour, pour une même zone, ne comptent qu'une fois.

Ne pas supposer qu'une douleur a été présente sur les journées intermédiaires non renseignées.

Afficher une légende chiffrée pour que la carte reste interprétable.

### Graphique des douleurs par zone

Une barre horizontale par zone.

Chaque barre représente la répartition des niveaux maximaux observés par épisode.

Segments :

- Supportable
- Gênante
- Limitante
- Invalidante

**Afficher directement dans chaque segment :**
- Le pourcentage.
- Le nombre d'épisodes correspondant.

Afficher également le total d'épisodes par zone.

Si un segment est trop étroit, déplacer ses valeurs dans une étiquette extérieure lisible.

Le graphique ne doit pas nécessiter un tableau explicatif supplémentaire pour être compris.

Un épisode avec plusieurs constats compte une seule fois, avec son intensité maximale connue.

Les épisodes dont la gêne n'est pas renseignée et ceux présentant un niveau maximal intermédiaire doivent rester identifiables sans attribution arbitraire à un niveau unique.

## 17. Chronologie médicale commune

Classer toutes les observations par date et heure.

Un épisode peut produire plusieurs lignes :

- Première observation.
- Chaque « Encore maintenant ».
- Fin constatée, si renseignée.
- Fin à heure inconnue, si applicable.

Chaque ligne peut comporter son intensité, son évolution, sa famille et ses commentaires.

Les événements de transit peuvent apparaître entre deux constats d'une même douleur.

Conserver les épisodes traversant plusieurs journées sans les compter plusieurs fois.

Éviter de présenter des associations temporelles comme des relations de cause à effet.

## 18. Observations à discuter en consultation

Ajouter une étoile pour marquer un événement important.

Prévoir une rubrique regroupant les observations marquées.

Pour chaque observation :

- Date.
- Événement lié.
- Remarque personnelle facultative.
- Destination facultative : Gastro, Rhumato, les deux ou non précisée.

Les informations sélectionnées peuvent être reprises dans les synthèses médicales.

Ne pas faire générer automatiquement un diagnostic ou une interprétation causale.

---

# PHASE 6 — Fiabilité et critères de validation

## 19. Protection des données

Les nouvelles fonctionnalités doivent préserver :

- Les données V3 importées.
- Les données V4 existantes.
- Les identifiants des observations.
- Les dates et heures.
- Les notes.
- Les anciens niveaux de gêne.
- Les constats temporels.
- Les classifications et localisations.

Les migrations doivent être idempotentes et testées.

Mettre à jour les formats d'export/import afin de conserver les nouvelles données.

Aucun effacement automatique.

## 20. Statistiques : règles transversales

Distinguer systématiquement :

- Épisode et occurrence.
- Épisode et constat successif.
- Jour renseigné et jour inconnu.
- Absence de passage aux toilettes et absence d'émission de selles.
- Fin constatée et fin inconnue.
- Intensité égale à zéro et intensité non renseignée.
- Type Bristol simple, intermédiaire et deux aspects distincts.

Les calculs doivent être mutualisés entre l'application, les statistiques et les exports PDF.

## 21. Tests indispensables

Tester notamment :

- Les sept types Bristol.
- Les doubles sélections et leurs significations.
- Les accidents indépendants des passages.
- Les journées sans selles et les journées inconnues.
- Les conditions personnalisées.
- Les occurrences multiples de remontées acides.
- Les changements d'intensité pendant un épisode.
- Les modifications d'anciens constats.
- Les épisodes sans heure de fin.
- La clôture automatique définitive.
- Les épisodes traversant plusieurs journées.
- Les statistiques annuelles avec des données manquantes.
- Les pourcentages, les nombres et les graphiques.
- Les exports/imports avec l'ancien et le nouveau format.
- La mise en page PDF sur une année complète.
- L'utilisation sur téléphone et hors ligne.

La batterie de tests existante doit continuer à fonctionner.

## 22. Ordre de réalisation souhaité

**Lot 1 — Utilisation quotidienne**

Page Digestif, transit, Bristol, conditions, accidents, commentaires et sauvegarde.

**Lot 2 — Symptômes et épisodes**

Symptômes digestifs, remontées multiples, suivi temporel, intensités successives et clôture automatique.

**Lot 3 — Historique**

Chronologie commune, affichage des évolutions, modifications et observations importantes.

**Lot 4 — Exploitation médicale**

Statistiques, synthèses spécialisées, graphiques et PDF annuel.

**Lot 5 — Notifications**

Réalisation selon la faisabilité technique et les choix d'architecture validés.

Les lots peuvent être adaptés aux dépendances réelles du code, mais il faut rechercher une première version utilisable rapidement.

## 23. Points nécessitant une vérification avant réalisation

- Comment gérer dans le modèle existant une entrée qui regroupe plusieurs symptômes, lorsqu'un nouvel épisode ne concerne qu'un seul d'entre eux ?
- Comment conserver et représenter un niveau maximal correspondant à deux niveaux voisins ?
- Comment distinguer les valeurs facultatives non renseignées des valeurs égales à zéro ?
- Comment intégrer les observations de transit dans le stockage et les sauvegardes existants ?
- Quels fichiers et fonctions doivent être modifiés pour partager réellement le moteur d'historique ?
- Quelle solution de notification reste compatible avec l'usage hors ligne et la confidentialité ?
- Quelles illustrations Bristol peuvent être intégrées avec une précision médicale suffisante ?

Ces points sont à analyser et à présenter avant de prendre une décision technique ayant des conséquences fonctionnelles.

---

## Résultat attendu de Work lors de la reprise

Commencer par une analyse technique du dépôt.

Produire ensuite :

1. Un état des fonctionnalités existantes et réutilisables.
2. Les éventuels écarts entre le code actuel et le présent cahier des charges.
3. Le plan de développement par lots.
4. Les migrations et tests à prévoir.
5. Les questions réellement bloquantes.

**Priorité : rendre le suivi digestif utilisable sans compromettre l'historique existant.**

Conserver le cahier des charges et les décisions validées dans la documentation du projet.

Aucune publication sans validation explicite.


## Arbitrages confirmés le 26 octobre 2026

- Bristol obligatoire pour un passage.
- Bouton manuel sans passage dès le lot 1.
- Nouvelle saisie de douleur = nouvel épisode ; Encore maintenant = poursuite.
- La sélection simultanée de zones doit créer des épisodes indépendants, avec horaire, niveaux et commentaire initiaux communs. Ce changement relève du lot 2, sans interprétation causale.
- Un nouvel épisode ne clôture que la même douleur à la même localisation précise.
- Accord de développement du lot 1 donné ; publication non autorisée.

- Validation des illustrations et autorisation de publication du lot 1 pour tests données le 26 octobre 2026.
