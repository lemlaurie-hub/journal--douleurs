# Import / export — V4

## Sauvegarde V4

Le bouton de sauvegarde télécharge un JSON versionné contenant le schéma V4 (`catalog`, `entries`, `settings`). L'import valide le fichier avant toute écriture, puis fusionne les données en une opération locale. Les données présentes ne sont jamais supprimées ni remplacées.

Les dates de saisie sont transportées comme chaînes ISO, sans conversion de fuseau ni réécriture. Les notes et champs d'historique sont conservés.

## Import V3 confirmé par le code source

La V3 écrit tout l'historique dans `localStorage` sous la clé `douleurs`. La valeur est un tableau JSON ; chaque entrée nouvellement enregistrée a la forme suivante :

```json
{
  "date": "2026-08-12T21:47:00.000Z",
  "zones": ["Migraine", "Œil droit"],
  "level": "😣 Limitante",
  "note": "Note libre"
}
```

La conversion accepte aussi la variante historique avec un champ singulier `zone`. Les libellés de niveau V3 sont convertis en valeurs numériques V4 : Supportable → 1, Gênante → 2, Limitante → 3, Invalidante → 4. Une date, un niveau ou une zone non reconnus font échouer tout l'import avant toute modification.

Les identifiants créés à l'import sont déterministes. Le même fichier V3 peut être importé à nouveau sans répéter les observations ; deux lignes V3 identiques dans un seul fichier restent deux événements distincts.

La V3 n'exporte pas encore de fichier JSON par elle-même. Son historique étant dans le stockage local du navigateur, il faudra ajouter temporairement un bouton d'export à l'application V3 (ou exécuter l'équivalent dans le contexte de cette page) pour obtenir le fichier à sélectionner dans V4. L'export doit lire `getData()` sans limiter le tableau aux 50 lignes affichées dans l'historique.

## Tests

`npm test` exécute le test Node. Les cas couvrent le JSON V4, la fusion non destructive, l'idempotence, les collisions d'identifiants, les deux formes V3, les refus de données mal formées et la conservation des événements identiques.

Avant publication, incrémenter la version des ressources dans `index.html` et le nom du cache dans `sw.js`, puis vérifier l'installation et l'import sur téléphone.
