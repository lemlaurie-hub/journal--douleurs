import { normalizeBodyMap, normalizeItemLocations } from "./body-map.js";
import { validateDigestive, mergeDigestive } from "./digestive.js";
import { normalizeConfig } from "./criteria.js";
import { validateEpisodeExtensions } from "./episodes.js";

// Formats d'export et fonctions d'import/export de données.
// Ce module ne lit ni n'écrit le stockage : l'appelant valide l'import puis
// enregistre le résultat en une seule écriture.

export const BACKUP_FORMAT = "journal-sante";
// Les anciennes applications refusent le format 2 plutôt que perdre le transit.
export const BACKUP_FORMAT_VERSION = 3;
const DATA_SCHEMA_VERSION = 1;

// Les opérations de transfert travaillent sur des copies pour préserver leurs entrées.
function clone(value) {
  return structuredClone(value);
}

// Une représentation ordonnée rend les empreintes indépendantes de l'ordre des clés.
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Empreinte légère, déterministe et réservée aux identifiants d'import. */
function hash(text) {
  // Hash déterministe utilisé uniquement pour créer un ID de secours stable.
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
}

/** Refuse une propriété obligatoire absente avant de lire le reste du fichier. */
function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Fichier invalide : ${label} manquant.`);
  }
}

const LEGACY_LEVELS = new Map([
  ["🙂 Supportable", 1],
  ["😕 Gênante", 2],
  ["😣 Limitante", 3],
  ["😭 Invalidante", 4],
]);

// Convertit le format V3 réel sans rien écrire dans le stockage V3 d'origine.
function convertV3Entries(legacyEntries) {
  if (!Array.isArray(legacyEntries)) {
    throw new Error(
      "Sauvegarde V3 invalide : l’historique doit être une liste.",
    );
  }

  const zonesByName = new Map();
  const entries = legacyEntries.map((legacy, index) => {
    if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) {
      throw new Error(
        `Sauvegarde V3 invalide : entrée ${index + 1} incorrecte.`,
      );
    }
    requireString(legacy.date, `date V3 (${index + 1})`);
    if (Number.isNaN(Date.parse(legacy.date))) {
      throw new Error(
        `Sauvegarde V3 invalide : date incorrecte dans l’entrée ${index + 1}.`,
      );
    }
    if (typeof legacy.level !== "string" || !LEGACY_LEVELS.has(legacy.level)) {
      throw new Error(
        `Sauvegarde V3 invalide : niveau de gêne non reconnu dans l’entrée ${index + 1}.`,
      );
    }
    if (legacy.note !== undefined && typeof legacy.note !== "string") {
      throw new Error(
        `Sauvegarde V3 invalide : note incorrecte dans l’entrée ${index + 1}.`,
      );
    }

    // Le code V3 actuel enregistre `zones`; son ancien rendu accepte aussi
    // `zone`, donc cette variante historique est lue sans approximation.
    let zoneNames;
    if (Array.isArray(legacy.zones)) {
      zoneNames = legacy.zones;
    } else if (typeof legacy.zone === "string") {
      zoneNames = [legacy.zone];
    } else {
      throw new Error(
        `Sauvegarde V3 invalide : zones absentes dans l’entrée ${index + 1}.`,
      );
    }
    if (
      zoneNames.length === 0 ||
      zoneNames.some((name) => typeof name !== "string" || !name.trim())
    ) {
      throw new Error(
        `Sauvegarde V3 invalide : zone manquante dans l’entrée ${index + 1}.`,
      );
    }
    if (new Set(zoneNames).size !== zoneNames.length) {
      throw new Error(
        `Sauvegarde V3 invalide : zone répétée dans l’entrée ${index + 1}.`,
      );
    }

    const itemIds = zoneNames.map((label) => {
      if (!zonesByName.has(label)) {
        const isMigraine = ["migraine", "migraine ophtalmique"].includes(
          label.trim().toLocaleLowerCase("fr"),
        );
        zonesByName.set(label, {
          id: `item-v3-${hash(label)}`,
          label,
          family: isMigraine ? "symptomes-evenements" : "rhumatologie",
          kind: isMigraine ? "symptome" : "zone",
        });
      }
      return zonesByName.get(label).id;
    });

    // L'index fait partie de l'identité : deux enregistrements V3 identiques
    // restent deux événements distincts, tout en donnant le même ID lors d'une
    // nouvelle importation du même fichier.
    const legacyIdentity = stableStringify({
      index,
      date: legacy.date,
      zones: zoneNames,
      level: legacy.level,
      note: legacy.note ?? "",
    });
    return {
      id: `entry-v3-${hash(legacyIdentity)}`,
      itemIds,
      levels: [LEGACY_LEVELS.get(legacy.level)],
      occurredAt: legacy.date,
      note: legacy.note ?? "",
    };
  });

  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    catalog: [...zonesByName.values()],
    entries,
    settings: { theme: "system" },
  };
}

// Valide toute la structure avant export ou fusion, afin d'éviter une fusion partielle.
function validateData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Fichier invalide : données absentes.");
  }
  if (data.schemaVersion !== DATA_SCHEMA_VERSION) {
    throw new Error(
      `Version des données non prise en charge : ${data.schemaVersion ?? "inconnue"}.`,
    );
  }
  if (!Array.isArray(data.catalog) || !Array.isArray(data.entries)) {
    throw new Error("Fichier invalide : catalogue ou historique absent.");
  }
  validateDigestive(data.digestive);

  const catalogIds = new Set();
  for (const [index, item] of data.catalog.entries()) {
    requireString(item?.id, `identifiant du catalogue (${index + 1})`);
    requireString(item?.label, `nom du catalogue (${index + 1})`);
    requireString(item?.family, `famille du catalogue (${index + 1})`);
    requireString(item?.kind, `type du catalogue (${index + 1})`);
    if (item.config !== undefined) normalizeConfig(item.config);
    if (catalogIds.has(item.id)) {
      throw new Error(
        `Fichier invalide : identifiant de catalogue répété (${item.id}).`,
      );
    }
    if (item.bodyMap != null) {
      normalizeBodyMap(item.bodyMap);
      if (item.family !== "rhumatologie" || item.kind !== "zone")
        throw new Error("Rattachement de catalogue invalide.");
    }
    catalogIds.add(item.id);
  }

  const entryIds = new Set();
  for (const [index, entry] of data.entries.entries()) {
    requireString(entry?.id, `identifiant de l’observation (${index + 1})`);
    requireString(entry?.occurredAt, `date de l’observation (${index + 1})`);
    if (Number.isNaN(Date.parse(entry.occurredAt))) {
      throw new Error(
        `Fichier invalide : date incorrecte pour l’observation ${entry.id}.`,
      );
    }
    if (!Array.isArray(entry.itemIds) || !Array.isArray(entry.levels)) {
      throw new Error(
        `Fichier invalide : contenu incomplet pour l’observation ${entry.id}.`,
      );
    }
    if (entry.itemIds.some((id) => typeof id !== "string")) {
      throw new Error(
        `Fichier invalide : élément associé incorrect pour l’observation ${entry.id}.`,
      );
    }
    if (entry.note !== undefined && typeof entry.note !== "string") {
      throw new Error(
        `Fichier invalide : note incorrecte pour l’observation ${entry.id}.`,
      );
    }
    const startTime = Date.parse(entry.occurredAt);
    if (entry.stillAt !== undefined) {
      if (!Array.isArray(entry.stillAt)) {
        throw new Error(
          `Fichier invalide : constats temporels incorrects pour l’observation ${entry.id}.`,
        );
      }
      let previousTime = startTime;
      for (const timestamp of entry.stillAt) {
        const checkTime =
          typeof timestamp === "string" ? Date.parse(timestamp) : Number.NaN;
        if (!Number.isFinite(checkTime) || checkTime < previousTime) {
          throw new Error(
            `Fichier invalide : ordre des constats incorrect pour l’observation ${entry.id}.`,
          );
        }
        previousTime = checkTime;
      }
    }
    if (entry.endedAt !== undefined) {
      const endTime =
        typeof entry.endedAt === "string"
          ? Date.parse(entry.endedAt)
          : Number.NaN;
      const lastCheck = entry.stillAt?.length
        ? Date.parse(entry.stillAt.at(-1))
        : startTime;
      if (!Number.isFinite(endTime) || endTime < lastCheck) {
        throw new Error(
          `Fichier invalide : heure de fin incorrecte pour l’observation ${entry.id}.`,
        );
      }
    }
    if (entryIds.has(entry.id)) {
      throw new Error(
        `Fichier invalide : identifiant d’observation répété (${entry.id}).`,
      );
    }
    normalizeItemLocations(entry.itemLocations, entry.itemIds);
    validateEpisodeExtensions(entry);
    entryIds.add(entry.id);
  }
}

/** Construit une sauvegarde V4 complète après validation des données. */
export function createBackup(data, exportedAt = new Date().toISOString()) {
  validateData(data);
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt,
    data: clone(data),
  };
}

/** Détecte V3 ou V4, convertit si nécessaire, puis valide sans rien écrire. */
export function parseBackup(input) {
  const backup = typeof input === "string" ? JSON.parse(input) : input;
  if (Array.isArray(backup)) {
    const data = convertV3Entries(backup);
    validateData(data);
    return { source: "v3", data };
  }
  if (!backup || typeof backup !== "object") {
    throw new Error("Ce fichier JSON ne contient pas de sauvegarde reconnue.");
  }

  if (backup.format === BACKUP_FORMAT) {
    if (![1, 2, BACKUP_FORMAT_VERSION].includes(backup.formatVersion)) {
      throw new Error(
        `Version de sauvegarde non prise en charge : ${backup.formatVersion ?? "inconnue"}.`,
      );
    }
    validateData(backup.data);
    return { source: "v4", data: clone(backup.data) };
  }

  throw new Error(
    "Format de fichier non reconnu. Choisis une sauvegarde JSON de l’application.",
  );
}

/** Clé métier utilisée pour reconnaître un élément déjà présent. */
function catalogKey(item) {
  return `${item.label.trim().toLocaleLowerCase("fr")}|${item.family}|${item.kind}|${stableStringify(normalizeBodyMap(item.bodyMap))}|${stableStringify(item.config || null)}`;
}

/** Retire l'identifiant pour comparer le contenu d'enregistrements. */
function withoutId(record) {
  const { id, ...rest } = record;
  return rest;
}

/** Résout une collision d'identifiant sans écraser l'élément local. */
function getUnusedId(candidate, records, fingerprint = candidate) {
  const ids = new Set(records.map((record) => record.id));
  if (!ids.has(candidate)) return candidate;
  const base = `${candidate}-import-${hash(fingerprint)}`;
  let unique = base;
  let suffix = 2;
  while (ids.has(unique)) unique = `${base}-${suffix++}`;
  return unique;
}

/**
 * Fusionne une sauvegarde V3/V4 sans remplacer ni supprimer les données locales.
 * Le résultat est une copie : l'appelant choisit ensuite de l'enregistrer.
 */
export function mergeBackup(currentData, backupInput) {
  const { source, data: incoming } = parseBackup(backupInput);
  if (source !== "v4" && source !== "v3") {
    throw new Error("Cette sauvegarde ne peut pas être fusionnée.");
  }
  validateData(currentData);

  const next = clone(currentData);
  const catalogById = new Map(next.catalog.map((item) => [item.id, item]));
  const catalogByKey = new Map(
    next.catalog.map((item) => [catalogKey(item), item]),
  );
  const itemIdMap = new Map();
  let catalogAdded = 0;

  for (const sourceItem of incoming.catalog) {
    const byId = catalogById.get(sourceItem.id);
    const byKey = catalogByKey.get(catalogKey(sourceItem));
    const sameIdSameContent =
      byId &&
      stableStringify(withoutId(byId)) ===
        stableStringify(withoutId(sourceItem));
    // Un ancien export sans rattachement ne doit pas dupliquer un élément
    // dont seul le placement a été enrichi depuis (notamment après import V3).
    const sameIdWithoutIncomingPlacement =
      byId &&
      !sourceItem.bodyMap &&
      !sourceItem.config &&
      byId.label.trim().toLocaleLowerCase("fr") ===
        sourceItem.label.trim().toLocaleLowerCase("fr") &&
      byId.family === sourceItem.family &&
      byId.kind === sourceItem.kind;
    if (sameIdSameContent || sameIdWithoutIncomingPlacement || byKey) {
      itemIdMap.set(
        sourceItem.id,
        (sameIdSameContent || sameIdWithoutIncomingPlacement ? byId : byKey).id,
      );
      continue;
    }

    const item = clone(sourceItem);
    item.id = getUnusedId(item.id, next.catalog, stableStringify(item));
    next.catalog.push(item);
    catalogById.set(item.id, item);
    catalogByKey.set(catalogKey(item), item);
    itemIdMap.set(sourceItem.id, item.id);
    catalogAdded += 1;
  }

  const existingEntries = new Map(
    next.entries.map((entry) => [entry.id, entry]),
  );
  let entriesAdded = 0;

  for (const sourceEntry of incoming.entries) {
    const entry = clone(sourceEntry);
    entry.itemIds = entry.itemIds.map((id) => itemIdMap.get(id) || id);
    if (entry.targetStates) {
      entry.targetStates = Object.fromEntries(
        Object.entries(entry.targetStates).map(([key, state]) => {
          const [itemId, regionId] = JSON.parse(key);
          return [
            JSON.stringify([itemIdMap.get(itemId) || itemId, regionId]),
            state,
          ];
        }),
      );
    }
    if (entry.itemLocations) {
      const locations = new Map();
      for (const [id, regions] of Object.entries(entry.itemLocations)) {
        const mappedId = itemIdMap.get(id) || id;
        locations.set(
          mappedId,
          [...new Set([...(locations.get(mappedId) || []), ...regions])].sort(),
        );
      }
      entry.itemLocations = Object.fromEntries(locations);
    }
    const entryKey = stableStringify(withoutId(entry));
    const sameId = existingEntries.get(entry.id);
    const sameIdHasDifferentContent =
      sameId && stableStringify(withoutId(sameId)) !== entryKey;
    const remappedIdBase = `${entry.id}-import-${hash(entryKey)}`;
    const alreadyRemapped =
      sameIdHasDifferentContent &&
      next.entries.some(
        (existing) =>
          (existing.id === remappedIdBase ||
            existing.id.startsWith(`${remappedIdBase}-`)) &&
          stableStringify(withoutId(existing)) === entryKey,
      );
    if (
      (sameId && stableStringify(withoutId(sameId)) === entryKey) ||
      alreadyRemapped
    ) {
      continue;
    }

    // Un ID déjà utilisé pour une autre observation ne doit ni écraser
    // l'observation existante ni empêcher un prochain import idempotent.
    if (sameId) entry.id = getUnusedId(entry.id, next.entries, entryKey);
    next.entries.push(entry);
    existingEntries.set(entry.id, entry);
    entriesAdded += 1;
  }

  // Les préférences déjà présentes sont conservées. Seules les clés inconnues
  // ou absentes sont ajoutées pour rester compatible avec de futurs modules.
  next.settings = {
    ...(incoming.settings || {}),
    ...(currentData.settings || {}),
  };
  if (currentData.digestive || incoming.digestive) {
    next.digestive = mergeDigestive(currentData.digestive, incoming.digestive);
  }
  const digestiveAdded =
    (next.digestive?.events.length || 0) -
    (currentData.digestive?.events.length || 0);
  const daysAdded =
    (next.digestive?.days.length || 0) -
    (currentData.digestive?.days.length || 0);
  return { data: next, catalogAdded, entriesAdded, digestiveAdded, daysAdded };
}
