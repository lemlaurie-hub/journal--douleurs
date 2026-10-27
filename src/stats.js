import { getHistoryRows } from "./history.js";
import { formatSelectionLabel } from "./body-map.js";
import { getPresenceChecks } from "./episodes.js";
import { localDate } from "./digestive.js";

// Moteur statistique commun : les vues affichent ces résultats sans les
// recalculer séparément, pour garder un seul sens aux compteurs.

/** Calcule les compteurs globaux ou ceux du module, via la projection commune. */
export function calculateStats(data, { moduleId = null } = {}) {
  const itemCounts = new Map();
  const days = new Set();
  const rows = getHistoryRows(data, { moduleId });
  const sourceIds = new Set();
  const ongoingIds = new Set();
  let transitRows = 0;
  // Même sélection de cibles que l'historique : filtrer seulement la saisie
  // brute laisserait les constats d'un autre module fausser les compteurs V3.
  for (const row of rows) {
    days.add(row.date);
    const view = row.episode;
    if (!view) {
      transitRows++;
      continue;
    }
    sourceIds.add(view.rawEntryId);
    getPresenceChecks(view).forEach((check) =>
      days.add(localDate(check.occurredAt)),
    );
    if (view.endedAt) days.add(localDate(view.endedAt));
    if (view.ongoing && !view.endedAt && !view.closedUnknown)
      ongoingIds.add(view.rawEntryId);
    const { itemId, regionId } = view;
    const key = JSON.stringify([itemId, regionId]);
    const current = itemCounts.get(key) || { itemId, regionId, count: 0 };
    current.count++;
    itemCounts.set(key, current);
  }

  const topItems = [...itemCounts.values()]
    .map(({ itemId, regionId, count }) => {
      const source = data.catalog.find((item) => item.id === itemId);
      return {
        itemId,
        regionId,
        count,
        item: source
          ? { ...source, label: formatSelectionLabel(source, regionId) }
          : null,
      };
    })
    .filter((row) => row.item)
    .sort(
      (a, b) =>
        b.count - a.count || a.item.label.localeCompare(b.item.label, "fr"),
    )
    .slice(0, 8);

  return {
    totalEntries: sourceIds.size + transitRows,
    activeDays: days.size,
    // On compte les saisies documentées, pas les lignes de constats. Un épisode
    // retiré de l'accueil à 48 h reste ouvert ici si sa fin est inconnue.
    ongoingEntries: ongoingIds.size,
    topItems,
  };
}
