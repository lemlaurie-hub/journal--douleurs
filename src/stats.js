// Moteur statistique commun.
// Toutes les vues doivent utiliser ces fonctions au lieu de recalculer les mêmes valeurs.

export function calculateStats(data) {
  const itemCounts = new Map();
  const days = new Set();

  for (const entry of data.entries) {
    if (entry.occurredAt) {
      days.add(entry.occurredAt.slice(0, 10));
    }

    for (const itemId of entry.itemIds || []) {
      itemCounts.set(itemId, (itemCounts.get(itemId) || 0) + 1);
    }
  }

  const topItems = [...itemCounts.entries()]
    .map(([itemId, count]) => ({
      itemId,
      count,
      item: data.catalog.find(item => item.id === itemId) || null
    }))
    .filter(row => row.item)
    .sort((a, b) => b.count - a.count || a.item.label.localeCompare(b.item.label, 'fr'))
    .slice(0, 8);

  return {
    totalEntries: data.entries.length,
    activeDays: days.size,
    ongoingEntries: data.entries.filter(entry => entry.ongoing).length,
    topItems
  };
}
