// Logique métier des observations.
// La création et la suppression d'une observation sont centralisées ici.

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeLevels(levels) {
  const unique = [...new Set((levels || []).map(Number))]
    .filter(level => Number.isInteger(level) && level >= 1 && level <= 4)
    .sort((a, b) => a - b);

  if (unique.length < 1 || unique.length > 2) {
    throw new Error('Choisis un ou deux niveaux de gêne.');
  }

  if (unique.length === 2 && unique[1] - unique[0] !== 1) {
    throw new Error('Les deux niveaux choisis doivent être voisins.');
  }

  return unique;
}

export function createEntry(data, input) {
  const itemIds = validateItemIds(data, input.itemIds);
  const levels = normalizeLevels(input.levels);
  const occurredAt = normalizeOccurredAt(input.occurredAt);

  const entry = {
    id: createId('entry'),
    itemIds,
    levels,
    occurredAt,
    ongoing: Boolean(input.ongoing),
    note: String(input.note || '').trim(),
    createdAt: new Date().toISOString()
  };

  data.entries.unshift(entry);
  return entry;
}

function validateItemIds(data, itemIdsInput) {
  const itemIds = [...new Set(itemIdsInput || [])]
    .filter(id => data.catalog.some(item => item.id === id));
  if (itemIds.length === 0) throw new Error('Choisis au moins un élément de suivi.');
  return itemIds;
}

function normalizeOccurredAt(value) {
  const occurredAt = new Date(value);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error('La date ou l’heure n’est pas valide.');
  }
  return occurredAt.toISOString();
}

/** Modifie une observation sans recréer son identité ni sa date de création. */
export function updateEntry(data, entryId, input) {
  const entry = data.entries.find(candidate => candidate.id === entryId);
  if (!entry) throw new Error('Cette observation n’existe plus.');

  const submittedItemIds = validateItemIds(data, input.itemIds);
  const sameItemSet = submittedItemIds.length === (entry.itemIds || []).length
    && submittedItemIds.every(id => entry.itemIds.includes(id));
  const itemIds = sameItemSet ? [...entry.itemIds] : submittedItemIds;
  const submittedLevels = normalizeLevels(input.levels);
  const sameLevels = JSON.stringify(submittedLevels) === JSON.stringify(entry.levels || []);
  const levels = sameLevels ? [...entry.levels] : submittedLevels;
  const occurredAt = normalizeOccurredAt(input.occurredAt);
  const submittedNote = String(input.note ?? '');

  // Une reclassification ne doit pas altérer les secondes/millisecondes ni
  // les espaces d'une note ancienne si l'utilisatrice ne les a pas modifiés.
  const note = submittedNote === String(entry.note ?? '')
    ? String(entry.note ?? '')
    : submittedNote.trim();

  Object.assign(entry, {
    itemIds,
    levels,
    occurredAt: occurredAt === entry.occurredAt ? entry.occurredAt : occurredAt,
    ongoing: Boolean(input.ongoing),
    note
  });
  return entry;
}

export function deleteEntry(data, entryId) {
  const index = data.entries.findIndex(entry => entry.id === entryId);

  if (index === -1) {
    return false;
  }

  data.entries.splice(index, 1);
  return true;
}

export function getLevelLabel(level) {
  const labels = {
    1: '🙂 Supportable',
    2: '😕 Gênante',
    3: '😣 Limitante',
    4: '😭 Invalidante'
  };

  return labels[level] || 'Niveau inconnu';
}

export function formatLevelRange(levels) {
  return (levels || []).map(getLevelLabel).join(' → ');
}

