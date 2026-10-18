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
    stillAt: [],
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

  validateEpisodeTimeline({ ...entry, occurredAt });

  // Une reclassification ne doit pas altérer les secondes/millisecondes ni
  // les espaces d'une note ancienne si l'utilisatrice ne les a pas modifiés.
  const note = submittedNote === String(entry.note ?? '')
    ? String(entry.note ?? '')
    : submittedNote.trim();

  Object.assign(entry, {
    itemIds,
    levels,
    occurredAt: occurredAt === entry.occurredAt ? entry.occurredAt : occurredAt,
    ongoing: Boolean(input.ongoing) || Boolean(entry.stillAt?.length || entry.endedAt),
    note
  });
  return entry;
}

/** Ajoute une heure à laquelle l'événement était encore présent. */
export function recordStillPresent(data, entryId, observedAt = new Date().toISOString()) {
  const entry = data.entries.find(candidate => candidate.id === entryId);
  if (!entry) throw new Error('Cette observation n’existe plus.');
  if (!entry.ongoing) throw new Error('Cette observation n’a pas été signalée comme présente à l’enregistrement.');
  if (entry.endedAt) throw new Error('Une fin a déjà été indiquée pour cet événement.');

  const timestamp = normalizeOccurredAt(observedAt);
  const stillAt = [...(entry.stillAt || [])].map(normalizeOccurredAt);
  validateEpisodeTimeline({ ...entry, stillAt, endedAt: null });
  const latest = stillAt.at(-1) || entry.occurredAt;
  if (new Date(timestamp) < new Date(latest)) {
    throw new Error('Cette heure ne peut pas précéder le dernier constat enregistré.');
  }
  if (!stillAt.includes(timestamp)) stillAt.push(timestamp);
  entry.stillAt = stillAt;
  return entry;
}

/** Enregistre l'heure à laquelle l'absence de l'événement a été constatée. */
export function finishEntry(data, entryId, endedAt = new Date().toISOString()) {
  const entry = data.entries.find(candidate => candidate.id === entryId);
  if (!entry) throw new Error('Cette observation n’existe plus.');
  if (!entry.ongoing) throw new Error('Cette observation n’a pas été signalée comme présente à l’enregistrement.');
  if (entry.endedAt) throw new Error('Une fin a déjà été indiquée pour cet événement.');

  const timestamp = normalizeOccurredAt(endedAt);
  // L'heure de fin constatée peut être antérieure à maintenant, mais elle ne
  // peut pas précéder un constat explicite où l'événement était encore là.
  validateEpisodeTimeline({ ...entry, endedAt: timestamp });
  entry.endedAt = timestamp;
  return entry;
}

/** Corrige l'heure de fin constatée sans toucher au reste de l'observation. */
export function updateEntryEnd(data, entryId, endedAt) {
  const entry = data.entries.find(candidate => candidate.id === entryId);
  if (!entry) throw new Error('Cette observation n’existe plus.');
  if (!entry.ongoing || !entry.endedAt) throw new Error('Aucune fin constatée ne peut être corrigée pour cette observation.');

  const timestamp = normalizeOccurredAt(endedAt);
  validateEpisodeTimeline({ ...entry, endedAt: timestamp });
  entry.endedAt = timestamp;
  return entry;
}

/** Durée minimale prouvée entre le premier et le dernier constat de présence. */
export function getMinimumDurationMs(entry) {
  if (!entry?.ongoing) return null;
  const lastKnownAt = (entry.stillAt || []).at(-1);
  if (!lastKnownAt) return null;
  const duration = new Date(lastKnownAt).getTime() - new Date(entry.occurredAt).getTime();
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

function validateEpisodeTimeline(entry) {
  const start = new Date(entry.occurredAt).getTime();
  const stillAt = (entry.stillAt || []).map(value => new Date(value).getTime());
  if (stillAt.some((value, index) => !Number.isFinite(value) || value < start || (index > 0 && value < stillAt[index - 1]))) {
    throw new Error('Les constats doivent suivre la première observation et rester dans l’ordre chronologique.');
  }
  if (entry.endedAt) {
    const end = new Date(entry.endedAt).getTime();
    if (!Number.isFinite(end) || end < start || stillAt.some(value => value > end)) {
      throw new Error('La fin ne peut pas précéder un constat déjà enregistré.');
    }
  }
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

