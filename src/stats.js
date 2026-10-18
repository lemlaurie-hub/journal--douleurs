import { getEntrySelections, formatSelectionLabel } from './body-map.js';

// Moteur statistique commun.
// Toutes les vues doivent utiliser ces fonctions au lieu de recalculer les mêmes valeurs.

export function calculateStats(data) {
  const itemCounts = new Map();
  const days = new Set();

  for (const entry of data.entries) {
    if (entry.occurredAt) {
      days.add(entry.occurredAt.slice(0, 10));
    }

    for (const { itemId, regionId } of getEntrySelections(entry)) {
      const key = JSON.stringify([itemId, regionId]);
      const current = itemCounts.get(key) || { itemId, regionId, count: 0 };
      current.count += 1;
      itemCounts.set(key, current);
    }
  }

  const topItems = [...itemCounts.values()]
    .map(({ itemId, regionId, count }) => {
      const source = data.catalog.find(item => item.id === itemId);
      return { itemId, regionId, count,
        item: source ? { ...source, label: formatSelectionLabel(source, regionId) } : null };
    })
    .filter(row => row.item)
    .sort((a, b) => b.count - a.count || a.item.label.localeCompare(b.item.label, 'fr'))
    .slice(0, 8);

  return {
    totalEntries: data.entries.length,
    activeDays: days.size,
    ongoingEntries: data.entries.filter(entry => entry.ongoing && !entry.endedAt).length,
    topItems
  };
}
