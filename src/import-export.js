// Import / export des données du journal.
// Ce module ne touche jamais directement au localStorage : il travaille sur l'objet
// de données que lui confie l'application. La persistance reste centralisée dans storage.js.

const EXPORT_FORMAT = 'journal-sante-backup';
const EXPORT_VERSION = 1;
const CURRENT_SCHEMA_VERSION = 1;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeLabel(value) {
  return normalizeText(value).toLocaleLowerCase('fr');
}

// Petit hash déterministe utilisé uniquement pour créer des identifiants stables
// lors d'un import V3. Il ne sert pas à la sécurité ni au chiffrement.
function stableHash(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getLegacyLevel(rawLevel) {
  if (Number.isInteger(rawLevel) && rawLevel >= 1 && rawLevel <= 4) {
    return rawLevel;
  }

  const label = normalizeText(rawLevel).toLocaleLowerCase('fr');

  if (label.includes('supportable')) return 1;
  if (label.includes('gênante') || label.includes('genante')) return 2;
  if (label.includes('limitante')) return 3;
  if (label.includes('invalidante')) return 4;

  return null;
}

function getLegacyZones(rawEntry) {
  const values = Array.isArray(rawEntry?.zones)
    ? rawEntry.zones
    : [rawEntry?.zone];

  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function findCatalogItemByLabel(data, label) {
  const normalized = normalizeLabel(label);
  return data.catalog.find(item => normalizeLabel(item.label) === normalized) || null;
}

function ensureLegacyCatalogItem(data, label, occurredAt) {
  const existing = findCatalogItemByLabel(data, label);
  if (existing) {
    return existing;
  }

  const id = `item-v3-${stableHash(normalizeLabel(label))}`;
  const itemWithId = data.catalog.find(item => item.id === id);
  if (itemWithId) {
    return itemWithId;
  }

  const item = {
    id,
    label,
    family: 'autre',
    kind: 'zone',
    createdAt: occurredAt
  };

  data.catalog.push(item);
  return item;
}

function getV3Fingerprint(rawEntry, zones) {
  return JSON.stringify({
    date: normalizeText(rawEntry?.date),
    zones: [...zones].sort((a, b) => a.localeCompare(b, 'fr')),
    level: normalizeText(rawEntry?.level),
    note: normalizeText(rawEntry?.note)
  });
}

function importV3Entries(data, legacyEntries) {
  let addedEntries = 0;
  let skippedEntries = 0;
  let addedCatalogItems = 0;
  const warnings = [];
  const occurrences = new Map();

  for (let index = 0; index < legacyEntries.length; index += 1) {
    const rawEntry = legacyEntries[index];
    const zones = getLegacyZones(rawEntry);
    const occurredAt = new Date(rawEntry?.date);

    if (zones.length === 0 || Number.isNaN(occurredAt.getTime())) {
      skippedEntries += 1;
      warnings.push(`Entrée V3 n°${index + 1} ignorée : zone ou date invalide.`);
      continue;
    }

    const beforeCatalogCount = data.catalog.length;
    const itemIds = zones.map(zone => ensureLegacyCatalogItem(
      data,
      zone,
      occurredAt.toISOString()
    ).id);
    addedCatalogItems += data.catalog.length - beforeCatalogCount;

    const fingerprint = getV3Fingerprint(rawEntry, zones);
    const occurrence = (occurrences.get(fingerprint) || 0) + 1;
    occurrences.set(fingerprint, occurrence);

    // Le numéro d'occurrence préserve deux véritables entrées V3 identiques,
    // tout en donnant les mêmes identifiants si le même fichier est réimporté.
    const entryId = `entry-v3-${stableHash(fingerprint)}-${occurrence}`;

    if (data.entries.some(entry => entry.id === entryId)) {
      skippedEntries += 1;
      continue;
    }

    const mappedLevel = getLegacyLevel(rawEntry?.level);
    const legacyLevelLabel = normalizeText(rawEntry?.level);

    const entry = {
      id: entryId,
      itemIds,
      levels: mappedLevel ? [mappedLevel] : [],
      occurredAt: occurredAt.toISOString(),
      ongoing: false,
      note: normalizeText(rawEntry?.note),
      createdAt: occurredAt.toISOString(),
      legacy: {
        source: 'v3',
        levelLabel: legacyLevelLabel
      }
    };

    data.entries.push(entry);
    addedEntries += 1;
  }

  // L'historique reste affiché du plus récent au plus ancien après import.
  data.entries.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

  return {
    source: 'v3',
    addedEntries,
    skippedEntries,
    addedCatalogItems,
    warnings
  };
}

function validateV4Data(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Le fichier V4 ne contient pas de données valides.');
  }

  if (candidate.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Version de données V4 non prise en charge : ${candidate.schemaVersion ?? 'inconnue'}.`);
  }

  if (!Array.isArray(candidate.catalog) || !Array.isArray(candidate.entries)) {
    throw new Error('Le fichier V4 est incomplet : catalogue ou historique manquant.');
  }
}

function importV4Data(data, candidate) {
  validateV4Data(candidate);

  let addedCatalogItems = 0;
  let addedEntries = 0;
  let skippedEntries = 0;

  for (const item of candidate.catalog) {
    if (!item?.id || data.catalog.some(existing => existing.id === item.id)) {
      continue;
    }

    data.catalog.push(cloneJson(item));
    addedCatalogItems += 1;
  }

  for (const entry of candidate.entries) {
    if (!entry?.id) {
      skippedEntries += 1;
      continue;
    }

    if (data.entries.some(existing => existing.id === entry.id)) {
      skippedEntries += 1;
      continue;
    }

    data.entries.push(cloneJson(entry));
    addedEntries += 1;
  }

  data.entries.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

  return {
    source: 'v4',
    addedEntries,
    skippedEntries,
    addedCatalogItems,
    warnings: []
  };
}

export function createExportPayload(data) {
  validateV4Data(data);

  return {
    format: EXPORT_FORMAT,
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: cloneJson(data)
  };
}

export function downloadExport(data) {
  const payload = createExportPayload(data);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const datePart = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `journal-sante-${datePart}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function importFromJsonText(data, text) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Le fichier sélectionné n’est pas un JSON valide.');
  }

  // Export V4 officiel.
  if (parsed?.format === EXPORT_FORMAT) {
    if (parsed.exportVersion !== EXPORT_VERSION) {
      throw new Error(`Version d’export non prise en charge : ${parsed.exportVersion ?? 'inconnue'}.`);
    }
    return importV4Data(data, parsed.data);
  }

  // Sauvegarde V4 brute : accepté pour faciliter une restauration manuelle.
  if (parsed?.schemaVersion === CURRENT_SCHEMA_VERSION
      && Array.isArray(parsed.catalog)
      && Array.isArray(parsed.entries)) {
    return importV4Data(data, parsed);
  }

  // V3 historique : soit le tableau brut contenu dans localStorage "douleurs",
  // soit un objet { douleurs: [...] } produit par un futur bouton d'export V3.
  if (Array.isArray(parsed)) {
    return importV3Entries(data, parsed);
  }

  if (Array.isArray(parsed?.douleurs)) {
    return importV3Entries(data, parsed.douleurs);
  }

  throw new Error('Format non reconnu. Utilise un export V4 ou un export JSON de la V3.');
}
