# Journal de suivi santé

V4 d'une application PWA mobile-first de suivi personnel de santé.

## État actuel

- données V4 stockées localement sur l'appareil ;
- catalogue personnalisable : zones, symptômes et événements ;
- familles prévues : rhumatologie, digestif, neurologique, général et autre ;
- saisie multi-éléments ;
- un ou deux niveaux de gêne voisins ;
- date et heure modifiables ;
- option « Encore maintenant » ;
- statistiques simples ;
- historique défilable ;
- fonctionnement hors ligne via service worker.

La V4 démarre volontairement avec un stockage séparé de la V3. Le module Importer / exporter permet d’ajouter un historique V3 ou une sauvegarde V4 sans effacer les données déjà présentes.

## Architecture

Le code est volontairement découpé par responsabilité dans `src/`. Les règles détaillées de développement et de passation sont dans [`README_LEON.md`](./README_LEON.md).
