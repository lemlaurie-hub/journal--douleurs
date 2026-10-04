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

La V4 démarre volontairement avec un stockage séparé et vide. L'import de l'historique V3 sera développé séparément afin de ne pas risquer d'altérer les anciennes données.

## Architecture

Le code est volontairement découpé par responsabilité dans `src/`. Les règles détaillées de développement et de passation sont dans [`README_LEON.md`](./README_LEON.md).
