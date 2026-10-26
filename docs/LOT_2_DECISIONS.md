# Lot 2 — décisions validées avec Laurie

Développement autorisé par « go » après les retours sur le lot 1. Publication autorisée séparément par Laurie le 26 octobre 2026 pour tests sur son téléphone. Base distante vérifiée : `b816fb59f80e9aa668d96808b9a8ee30e984de01`.

## Symptômes et bibliothèque

L’utilisatrice crée un symptôme digestif en donnant son nom, son type Symptôme/Événement et les critères/actions souhaités ; elle dispose d’un aperçu construit avec le même moteur. Dans Digestif, la famille est attribuée automatiquement à la création et le choix Zone est exclu.

Critères : localisation, douleur, gêne, commentaire et hauteur de remontée. Actions : Encore maintenant, C’est terminé et nouvelle occurrence. Aucun champ ajouté ne devient obligatoire : seuls le symptôme et l’horaire sont indispensables.

Convention explicitement choisie : si la douleur est présente dans un NOUVEAU formulaire, elle commence à 0 et reste 0 si le curseur n’est pas touché. Un critère absent, la gêne facultative non renseignée et les valeurs anciennes manquantes ne deviennent pas zéro. Bristol reste obligatoire pour un passage aux toilettes.

Renommer un symptôme ou modifier sa configuration ne réécrit pas les observations. Le nom courant est affiché ; un instantané du libellé et des critères d’origine reste conservé. Les champs retirés restent consultables et modifiables dans les anciennes observations ; les champs nouvellement ajoutés y restent sans valeur.

## Épisodes

Nouvelle saisie = nouvel épisode. Encore maintenant = constat de poursuite. Une saisie simultanée doit produire un épisode indépendant par endroit, au même horaire, avec les valeurs et le commentaire initiaux communs. Aucune relation médicale n’est déduite.

Les constats conservent leur intensité et leur commentaire ; ils sont modifiables/supprimables individuellement. Les anciens horaires ne reçoivent pas rétroactivement une intensité. Les comparaisons impossibles ou ambiguës n’affichent pas de flèche artificielle.

Une nouvelle saisie clôture uniquement l’ancien épisode de la même douleur et de la même localisation précise, sans demander confirmation. L’heure de fin n’est pas inventée. Cette clôture reste acquise si la nouvelle saisie est supprimée ou modifiée. Un conflit entre anciens constats et nouveau début est refusé avant tout changement.

Une remontée rapide ajoutée compte comme une occurrence distincte dans le même groupe. L’heure est capturée au clic, la hauteur et la gêne restent non renseignées. La nausée n’impose aucune localisation.

## Corrections de présentation

- Toutes les saisies s’ouvrent dans une fenêtre. La consultation de l’historique reste une navigation, visuellement distinguée.
- Une seule barre Annuler/Enregistrer reste visible en haut pendant le défilement. Pas de répétition des actions en bas. L’abandon d’un formulaire modifié demande confirmation.
- « Passage aux toilettes » est un titre de groupe, avec deux boutons directement accessibles : Ajouter un passage et Aucun passage ce jour. Aucun menu intermédiaire.
- La confirmation d’absence ouvre une petite fenêtre avec la date du jour, modifiable. Sa suppression reste dans l’historique ; le bloc permanent et son deuxième bouton d’annulation sont retirés.
- L’accueil affiche effectivement les événements de toutes les familles, dont transit et accidents. Le module Digestif emploie un seul historique commun, sans deux listes concurrentes.

Les synthèses médicales, l’intercalage détaillé de chaque constat, les favoris de consultation et les rappels restent dans les lots suivants.
