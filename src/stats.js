import { getEntrySelections, formatSelectionLabel } from "./body-map.js";

// Moteur statistique commun : les vues affichent ces résultats sans les
// recalculer séparément, pour garder un seul sens aux compteurs.

/** Calcule les compteurs globaux ou ceux d'un sous-ensemble déjà filtré. */
export function calculateStats(data) {
  const itemCounts = new Map();
  const days = new Set();

  for (const entry of data.entries) {
    if (entry.occurredAt) {
      days.add(entry.occurredAt.slice(0, 10));
    }

    // Chaque côté est compté séparément quand l'observation le précise.
    for (const { itemId, regionId } of getEntrySelections(entry)) {
      const key = JSON.stringify([itemId, regionId]);
      const current = itemCounts.get(key) || { itemId, regionId, count: 0 };
      current.count += 1;
      itemCounts.set(key, current);
    }
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
    totalEntries: data.entries.length,
    activeDays: days.size,
    // Sans heure de fin, le dossier reste ouvert, même si la dernière
    // confirmation de présence remonte à plusieurs jours.
    ongoingEntries: data.entries.filter(
      (entry) => entry.ongoing && !entry.endedAt,
    ).length,
    topItems,
  };
}
