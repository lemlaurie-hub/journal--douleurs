import { normalizeItemLocations } from './body-map.js';

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
  const itemLocations = normalizeItemLocations(input.itemLocations, itemIds);
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

  if (Object.keys(itemLocations).length) entry.itemLocations = itemLocations;
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
  const existingLocations = Object.fromEntries(Object.entries(entry.itemLocations || {})
    .filter(([id]) => itemIds.includes(id)));
  const itemLocations = normalizeItemLocations(input.itemLocations ?? existingLocations, itemIds);
  const submittedLevels = normalizeLevels(input.levels);
  const sameLevels = JSON.stringify(submittedLevels) === JSON.stringify(entry.levels || []);
  const levels = sameLevels ? [...entry.levels] : submittedLevels;
  const occurredAt = normalizeOccurredAt(input.occurredAt);
  const submittedNote = String(input.note ?? '');

  // Si le premier horaire est antidaté, l'ancien horaire reste un constat
  // explicite de présence. La case du formulaire ne permet d'écarter ce repère
  // que si l'ancien horaire était une erreur de saisie.
  const preservePrevious = input.preservePreviousObservation !== false
    && Date.parse(occurredAt) < Date.parse(entry.occurredAt);
  const stillAt = preservePrevious
    ? [...new Set([...(entry.stillAt || []), normalizeOccurredAt(entry.occurredAt)])]
      .sort((a, b) => Date.parse(a) - Date.parse(b))
    : entry.stillAt;
  validateEpisodeTimeline({ ...entry, occurredAt, stillAt });

  // Une reclassification ne doit pas altérer les secondes/millisecondes ni
  // les espaces d'une note ancienne si l'utilisatrice ne les a pas modifiés.
  const note = submittedNote === String(entry.note ?? '')
    ? String(entry.note ?? '')
    : submittedNote.trim();

  Object.assign(entry, {
    itemIds,
    levels,
    occurredAt: occurredAt === entry.occurredAt ? entry.occurredAt : occurredAt,
    ongoing: Boolean(input.ongoing) || Boolean(stillAt?.length || entry.endedAt),
    note
  });
  if (preservePrevious) entry.stillAt = stillAt;
  if (Object.keys(itemLocations).length) entry.itemLocations = itemLocations;
  else delete entry.itemLocations;
  return entry;
}

/** Ajoute une heure à laquelle l'événement était encore présent. */
export function recordStillPresent(data, entryId, observedAt = new Date().toISOString()) {
  const entry = data.entries.find(candidate => candidate.id === entryId);
  if (!entry) throw new Error('Cette observation n’existe plus.');
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
  entry.ongoing = true;
  return entry;
}

/**
 * Ajoute un constat passé à toute observation, même importée ou sans fin.
 * La fin reste inconnue tant qu'aucune heure de fin n'a été saisie.
 */
export function addPastPresence(data, entryId, observedAt) {
  const entry = data.entries.find(candidate => candidate.id === entryId);
  if (!entry) throw new Error('Cette observation n’existe plus.');

  const timestamp = normalizeOccurredAt(observedAt);
  const stillAt = [...(entry.stillAt || [])].map(normalizeOccurredAt);
  validateEpisodeTimeline({ ...entry, stillAt });

  // Le premier horodatage est déjà le constat initial; un second constat doit
  // être postérieur au début et strictement antérieur à la fin constatée.
  if (new Date(timestamp) <= new Date(entry.occurredAt)) {
    throw new Error('Le constat passé doit être après la première observation.');
  }
  if (Date.parse(timestamp) > Date.now()) {
    throw new Error('Un constat passé ne peut pas être dans le futur.');
  }
  if (entry.endedAt && new Date(timestamp) >= new Date(entry.endedAt)) {
    throw new Error('Le constat de présence doit précéder l’heure de fin.');
  }

  // Réimporter la même heure ne crée pas de doublon; les constats restent triés.
  if (!stillAt.includes(timestamp)) {
    stillAt.push(timestamp);
    stillAt.sort((a, b) => new Date(a) - new Date(b));
  }
  entry.stillAt = stillAt;
  entry.ongoing = true;
  return entry;
}

/** Enregistre l'heure à laquelle l'absence de l'événement a été constatée. */
export function finishEntry(data, entryId, endedAt = new Date().toISOString()) {
  const entry = data.entries.find(candidate => candidate.id === entryId);
  if (!entry) throw new Error('Cette observation n’existe plus.');
  if (entry.endedAt) throw new Error('Une fin a déjà été indiquée pour cet événement.');

  const timestamp = normalizeOccurredAt(endedAt);
  // L'heure de fin constatée peut être antérieure à maintenant, mais elle ne
  // peut pas précéder un constat explicite où l'événement était encore là.
  validateEpisodeTimeline({ ...entry, endedAt: timestamp });
  entry.endedAt = timestamp;
  entry.ongoing = true;
  return entry;
}

/** Corrige l'heure de fin constatée sans toucher au reste de l'observation. */
export function updateEntryEnd(data, entryId, endedAt) {
  const entry = data.entries.find(candidate => candidate.id === entryId);
  if (!entry) throw new Error('Cette observation n’existe plus.');
  if (!entry.endedAt) throw new Error('Aucune fin constatée ne peut être corrigée pour cette observation.');

  const timestamp = normalizeOccurredAt(endedAt);
  validateEpisodeTimeline({ ...entry, endedAt: timestamp });
  entry.endedAt = timestamp;
  entry.ongoing = true;
  return entry;
}

/** Durée minimale prouvée entre le premier et le dernier constat de présence. */
export function getMinimumDurationMs(entry) {
  if (!entry) return null;
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

