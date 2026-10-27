import { getEntrySelections, normalizeItemLocations } from "./body-map.js";
import { normalizeLevels } from "./entries.js?v=4.8.2";
import {
  CRITERIA,
  getItemConfig,
  normalizeConfig,
  normalizeValues,
  initialValues,
} from "./criteria.js";

// Un seul moteur temporel pour Rhumato, symptômes digestifs et symptômes libres.
// Une ancienne saisie groupée n'est jamais décomposée ou réidentifiée au stockage.
export const targetKey = ({ itemId, regionId = "" }) =>
  JSON.stringify([itemId, regionId]);
const makeId = (prefix) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

function timestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new Error("Choisis une date et une heure valides.");
  if (Date.parse(value) > Date.now())
    throw new Error("La date ne peut pas être dans le futur.");
  return new Date(value).toISOString();
}

/** Vue propre à une zone : les valeurs communes anciennes ne sont pas inventées. */
export function getEpisodeViews(entry) {
  return getEntrySelections(entry).map((selection) => {
    const key = targetKey(selection);
    const override = entry.targetStates?.[key] || {};
    return {
      ...entry,
      ...override,
      itemIds: [selection.itemId],
      itemLocations: selection.regionId
        ? { [selection.itemId]: [selection.regionId] }
        : {},
      rawEntryId: entry.id,
      targetKey: key,
      ...selection,
    };
  });
}

export function getEpisode(data, entryId, key = null) {
  const source = data.entries.find((entry) => entry.id === entryId);
  if (!source) throw new Error("Cet épisode n’existe plus.");
  const views = getEpisodeViews(source);
  const view = key
    ? views.find((entry) => entry.targetKey === key)
    : views.length === 1
      ? views[0]
      : null;
  if (!view) throw new Error("Choisis la zone ou le symptôme à suivre.");
  return view;
}

/** Applique un suivi ciblé sans changer les constats des autres zones. */
function patchTarget(data, entryId, key, patch) {
  const source = data.entries.find((entry) => entry.id === entryId);
  getEpisode(data, entryId, key);
  if (getEntrySelections(source).length === 1 && !source.targetStates?.[key])
    Object.assign(source, patch);
  else
    source.targetStates = {
      ...source.targetStates,
      [key]: { ...source.targetStates?.[key], ...patch },
    };
}

/** Les anciens horaires deviennent des vues sans intensité ajoutée rétroactivement. */
export function getPresenceChecks(entry) {
  const details = new Map(
    (entry.checks || []).map((check) => [check.occurredAt, check]),
  );
  return [...new Set([...(entry.stillAt || []), ...details.keys()])]
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .map(
      (occurredAt) =>
        details.get(occurredAt) || {
          id: `legacy-${occurredAt}`,
          occurredAt,
          levels: [],
          values: {},
          note: "",
        },
    );
}

export function lastPresence(entry) {
  return getPresenceChecks(entry).at(-1)?.occurredAt || entry.occurredAt;
}

/** Valeurs proposées pour un NOUVEAU constat, sans modifier le passé.
 * Chaque intensité remonte à son dernier renseignement, même si les constats
 * suivants sont vides. Zéro est connu ; commentaires/localisations ne sont pas
 * recopiés. La borne évite de proposer une mesure postérieure au constat. */
export function getLastKnownIntensity(episode, at = new Date().toISOString()) {
  const result = { levels: [], values: {} };
  const observations = [episode, ...getPresenceChecks(episode)]
    .filter((row) => Date.parse(row.occurredAt) <= Date.parse(at))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  for (const observation of observations) {
    if (observation.levels?.length) result.levels = [...observation.levels];
    for (const [key, value] of Object.entries(observation.values || {})) {
      if (CRITERIA[key]?.type === "scale" && value != null)
        result.values[key] = value;
    }
  }
  return result;
}

function valuesFor(input, defaults = {}) {
  return normalizeValues({ ...defaults, ...(input || {}) });
}

function samePain(a, b) {
  // L'identifiant précis et le côté doivent correspondre. Un côté inconnu
  // n'est pas assimilé arbitrairement au côté droit ou gauche.
  return (
    a.itemId === b.itemId &&
    a.regionId === b.regionId &&
    String(a.values?.location || "")
      .trim()
      .toLocaleLowerCase("fr") ===
      String(b.values?.location || "")
        .trim()
        .toLocaleLowerCase("fr")
  );
}

/** Clôture définitive inconnue : le nouvel horaire n'est PAS une heure de fin. */
function closePrevious(data, fresh) {
  for (const source of data.entries) {
    for (const previous of getEpisodeViews(source)) {
      if (
        !samePain(previous, fresh) ||
        previous.endedAt ||
        previous.closedUnknown ||
        Date.parse(previous.occurredAt) >= Date.parse(fresh.occurredAt)
      )
        continue;
      if (Date.parse(lastPresence(previous)) >= Date.parse(fresh.occurredAt)) {
        throw new Error(
          "Un constat de l’ancien épisode atteint ou dépasse ce nouveau début. Corrige d’abord les horaires concernés.",
        );
      }
      patchTarget(data, source.id, previous.targetKey, {
        closedUnknown: true,
        closure: {
          recordedAt: new Date().toISOString(),
          nextEpisodeAt: fresh.occurredAt,
          reason: "new-episode",
          triggerId: fresh.id,
        },
      });
    }
  }
}

/** Nouvelle saisie commune : un épisode par élément ET côté, transaction atomique. */
export function createIndependentEntries(data, input) {
  const next = structuredClone(data);
  const occurredAt = timestamp(input.occurredAt);
  const itemIds = [...new Set(input.itemIds || [])];
  if (
    !itemIds.length ||
    itemIds.some((itemId) => !next.catalog.some((item) => item.id === itemId))
  ) {
    throw new Error("Choisis au moins un symptôme ou une zone valide.");
  }
  const itemLocations = normalizeItemLocations(input.itemLocations, itemIds);
  const selections = getEntrySelections({ itemIds, itemLocations });
  const groupId = makeId("saisie");
  const created = [];
  for (const selection of selections) {
    const item = next.catalog.find(
      (candidate) => candidate.id === selection.itemId,
    );
    const rhumato = item.family === "rhumatologie";
    const legacyScale =
      rhumato || (item.family !== "digestif" && input.levels?.length);
    const config = legacyScale ? null : getItemConfig(item);
    const values = legacyScale
      ? {}
      : valuesFor(input.values, initialValues(config));
    const levels = legacyScale ? normalizeLevels(input.levels) : [];
    const entry = {
      id: makeId("entry"),
      itemIds: [item.id],
      ...(selection.regionId
        ? { itemLocations: { [item.id]: [selection.regionId] } }
        : {}),
      levels,
      occurredAt,
      note: String(input.note ?? values.comment ?? "").trim(),
      ongoing:
        legacyScale ||
        config.criteria.some((criterion) =>
          ["stillPresent", "finish"].includes(criterion),
        ),
      stillAt: [],
      checks: [],
      createdAt: new Date().toISOString(),
      sourceGroupId: groupId,
      episodeVersion: 2,
      itemSnapshot: { label: item.label, family: item.family, kind: item.kind },
      ...(!legacyScale ? { values, configSnapshot: config } : {}),
    };
    if (config?.criteria.includes("newOccurrence"))
      entry.occurrenceGroupId = makeId("occurrences");
    const view = getEpisodeViews(entry)[0];
    // Une occurrence discrète ne clôture pas un épisode suivi dans le temps.
    if (
      legacyScale ||
      config.criteria.some((criterion) =>
        ["stillPresent", "finish"].includes(criterion),
      )
    )
      closePrevious(next, view);
    next.entries.push(entry);
    created.push(entry);
  }
  data.entries = next.entries;
  return created;
}

/** Ajoute ou corrige un constat enrichi. Une heure égale reste un seul constat. */
export function savePresenceCheck(data, entryId, key, input, checkId = null) {
  const entry = getEpisode(data, entryId, key);
  const occurredAt = timestamp(input.occurredAt);
  const checks = getPresenceChecks(entry);
  const previous = checkId
    ? checks.find((check) => check.id === checkId)
    : null;
  if (checkId && !previous) throw new Error("Ce constat n’existe plus.");
  if (
    Date.parse(occurredAt) <= Date.parse(entry.occurredAt) ||
    (entry.endedAt && Date.parse(occurredAt) >= Date.parse(entry.endedAt))
  ) {
    throw new Error(
      "Le constat doit être après le début et avant la fin constatée.",
    );
  }
  if (
    entry.closedUnknown &&
    Date.parse(occurredAt) >=
      Date.parse(
        entry.closure?.nextEpisodeAt || entry.closure?.recordedAt || occurredAt,
      )
  ) {
    throw new Error(
      "Ce constat atteindrait le nouvel épisode. Choisis un moment antérieur à son début.",
    );
  }
  const levels = input.levels?.length ? normalizeLevels(input.levels) : [];
  const values = valuesFor(input.values, previous?.values);
  const check = {
    ...previous,
    id: previous?.id || makeId("constat"),
    occurredAt,
    levels,
    values,
    note: String(input.note ?? values.comment ?? previous?.note ?? ""),
  };
  const duplicate = checks.find(
    (row) => row.occurredAt === occurredAt && row.id !== checkId,
  );
  if (duplicate) {
    if (
      JSON.stringify({
        levels: duplicate.levels || [],
        values: duplicate.values || {},
        note: duplicate.note || "",
      }) !== JSON.stringify({ levels, values, note: check.note })
    ) {
      throw new Error(
        "Un constat existe déjà à cette heure. Modifie-le plutôt que le remplacer.",
      );
    }
    return duplicate;
  }
  const updated = [...checks.filter((row) => row.id !== checkId), check].sort(
    (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
  );
  patchTarget(data, entryId, entry.targetKey, {
    checks: updated,
    stillAt: updated.map((row) => row.occurredAt),
    ongoing: true,
  });
  return check;
}

export function deletePresenceCheck(data, entryId, key, checkId) {
  const entry = getEpisode(data, entryId, key);
  const checks = getPresenceChecks(entry).filter(
    (check) => check.id !== checkId,
  );
  patchTarget(data, entryId, entry.targetKey, {
    checks,
    stillAt: checks.map((check) => check.occurredAt),
  });
}

export function finishEpisode(data, entryId, key, endedAt) {
  const entry = getEpisode(data, entryId, key);
  if (endedAt == null) {
    if (entry.endedAt)
      throw new Error(
        "Une heure réelle de fin est déjà renseignée ; elle peut être corrigée.",
      );
    patchTarget(data, entryId, entry.targetKey, {
      closedUnknown: true,
      ongoing: true,
      closure: {
        ...entry.closure,
        recordedAt: new Date().toISOString(),
        reason: entry.closure?.reason || "manual",
      },
    });
    return;
  }
  const end = timestamp(endedAt);
  if (Date.parse(end) < Date.parse(lastPresence(entry)))
    throw new Error(
      "La fin ne peut pas précéder le dernier constat de présence.",
    );
  if (
    entry.closure?.nextEpisodeAt &&
    Date.parse(end) > Date.parse(entry.closure.nextEpisodeAt)
  )
    throw new Error("La fin dépasserait le début du nouvel épisode.");
  // Corriger explicitement une fin inconnue ne réouvre jamais un épisode.
  patchTarget(data, entryId, entry.targetKey, {
    endedAt: end,
    closedUnknown: false,
    ongoing: true,
  });
}

/** Corrige le début et les valeurs d'une cible sans réécrire les autres. */
export function updateEpisode(data, entryId, key, input) {
  const entry = getEpisode(data, entryId, key);
  const occurredAt = timestamp(input.occurredAt);
  const checks = getPresenceChecks(entry);
  if (
    Date.parse(occurredAt) < Date.parse(entry.occurredAt) &&
    input.preservePreviousObservation !== false &&
    !checks.some((check) => check.occurredAt === entry.occurredAt)
  ) {
    checks.push({
      id: makeId("constat"),
      occurredAt: entry.occurredAt,
      levels: [...(entry.levels || [])],
      values: { ...(entry.values || {}) },
      note: entry.note || "",
    });
  }
  checks.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  if (
    checks.some(
      (check) => Date.parse(check.occurredAt) < Date.parse(occurredAt),
    ) ||
    (entry.endedAt && Date.parse(entry.endedAt) < Date.parse(occurredAt)) ||
    (entry.closure?.nextEpisodeAt &&
      Date.parse(occurredAt) >= Date.parse(entry.closure.nextEpisodeAt))
  ) {
    throw new Error(
      "Ce début dépasserait un constat ou la fin déjà enregistrés.",
    );
  }
  const levels = input.levels?.length ? normalizeLevels(input.levels) : [];
  const values = valuesFor(input.values, entry.values);
  patchTarget(data, entryId, entry.targetKey, {
    occurredAt,
    levels,
    values,
    note: String(input.note ?? values.comment ?? entry.note ?? ""),
    checks,
    stillAt: checks.map((check) => check.occurredAt),
  });
}

/** Une occurrence rapide a sa propre identité et aucun détail supposé. */
export function addOccurrence(
  data,
  entryId,
  key,
  clickedAt = new Date().toISOString(),
) {
  const source = getEpisode(data, entryId, key);
  const occurredAt = timestamp(clickedAt);
  const entry = {
    id: makeId("entry"),
    itemIds: [...source.itemIds],
    ...(Object.keys(source.itemLocations).length
      ? { itemLocations: structuredClone(source.itemLocations) }
      : {}),
    occurredAt,
    levels: [],
    values: {},
    note: "",
    ongoing: false,
    stillAt: [],
    checks: [],
    episodeVersion: 2,
    configSnapshot: structuredClone(
      source.configSnapshot ||
        getItemConfig(data.catalog.find((item) => item.id === source.itemId)),
    ),
    occurrenceGroupId: source.occurrenceGroupId || makeId("occurrences"),
    itemSnapshot: structuredClone(source.itemSnapshot || {}),
    createdAt: new Date().toISOString(),
  };
  entry.values = initialValues(entry.configSnapshot);
  const original = data.entries.find((row) => row.id === entryId);
  if (!source.occurrenceGroupId)
    patchTarget(data, original.id, source.targetKey, {
      occurrenceGroupId: entry.occurrenceGroupId,
    });
  data.entries.push(entry);
  return entry;
}

/** Suppression ciblée autorisée : une autre zone et ses constats restent intacts. */
export function deleteEpisode(data, entryId, key) {
  const source = data.entries.find((entry) => entry.id === entryId);
  const selected = getEpisode(data, entryId, key);
  if (getEntrySelections(source).length === 1) {
    data.entries = data.entries.filter((entry) => entry.id !== entryId);
    return;
  }
  const remaining = getEntrySelections(source).filter(
    (selection) => targetKey(selection) !== selected.targetKey,
  );
  source.itemIds = [...new Set(remaining.map((selection) => selection.itemId))];
  const locations = {};
  for (const { itemId, regionId } of remaining) {
    if (regionId) locations[itemId] = [...(locations[itemId] || []), regionId];
  }
  if (Object.keys(locations).length) source.itemLocations = locations;
  else delete source.itemLocations;
  if (source.targetStates) delete source.targetStates[selected.targetKey];
}

/** Les intervalles qui se chevauchent sont ambigus, pas « stables » par défaut. */
export function getEvolution(previous, current) {
  if (previous?.levels?.length && current?.levels?.length) {
    const a = previous.levels;
    const b = current.levels;
    if (JSON.stringify(a) === JSON.stringify(b)) return "→";
    if (Math.min(...b) > Math.max(...a)) return "↗";
    if (Math.max(...b) < Math.min(...a)) return "↘";
    return "";
  }
  for (const criterion of ["pain", "discomfort"]) {
    const a = previous?.values?.[criterion];
    const b = current?.values?.[criterion];
    if (a != null && b != null) return b === a ? "→" : b > a ? "↗" : "↘";
  }
  return "";
}

/** Validation additive des champs modernes, appelée au chargement et au transfert. */
export function validateEpisodeExtensions(entry) {
  if (!entry || typeof entry !== "object") throw new Error("Épisode invalide.");
  if (entry.configSnapshot !== undefined) normalizeConfig(entry.configSnapshot);
  if (entry.values !== undefined) normalizeValues(entry.values);
  if (
    entry.closedUnknown !== undefined &&
    typeof entry.closedUnknown !== "boolean"
  )
    throw new Error("Clôture d’épisode invalide.");
  if (
    entry.closedUnknown &&
    (!entry.closure || !Number.isFinite(Date.parse(entry.closure.recordedAt)))
  )
    throw new Error("Trace de clôture absente.");
  if (
    entry.closure?.nextEpisodeAt &&
    (!Number.isFinite(Date.parse(entry.closure.nextEpisodeAt)) ||
      Date.parse(entry.closure.nextEpisodeAt) <= Date.parse(entry.occurredAt))
  )
    throw new Error("Repère du nouvel épisode invalide.");
  if (entry.checks !== undefined) {
    if (!Array.isArray(entry.checks)) throw new Error("Constats invalides.");
    const ids = new Set();
    const hours = new Set();
    for (const check of entry.checks) {
      if (
        !check ||
        typeof check.id !== "string" ||
        !check.id ||
        ids.has(check.id) ||
        hours.has(check.occurredAt) ||
        !Number.isFinite(Date.parse(check.occurredAt)) ||
        Date.parse(check.occurredAt) < Date.parse(entry.occurredAt) ||
        (entry.endedAt &&
          Date.parse(check.occurredAt) > Date.parse(entry.endedAt)) ||
        (entry.closedUnknown &&
          entry.closure?.nextEpisodeAt &&
          Date.parse(check.occurredAt) >=
            Date.parse(entry.closure.nextEpisodeAt))
      )
        throw new Error("Constat enrichi invalide.");
      ids.add(check.id);
      hours.add(check.occurredAt);
      if (check.levels?.length) normalizeLevels(check.levels);
      normalizeValues(check.values);
      if (check.note !== undefined && typeof check.note !== "string")
        throw new Error("Commentaire de constat invalide.");
    }
  }
  if (entry.targetStates !== undefined) {
    if (
      !entry.targetStates ||
      typeof entry.targetStates !== "object" ||
      Array.isArray(entry.targetStates)
    )
      throw new Error("Suivi par zone invalide.");
    const validKeys = new Set(getEntrySelections(entry).map(targetKey));
    for (const [key, state] of Object.entries(entry.targetStates)) {
      if (
        !validKeys.has(key) ||
        !state ||
        typeof state !== "object" ||
        Array.isArray(state) ||
        state.targetStates !== undefined
      )
        throw new Error("Zone de suivi inconnue.");
      const { targetStates, ...base } = entry;
      const merged = { ...base, ...state };
      if (
        !Number.isFinite(Date.parse(merged.occurredAt)) ||
        (merged.stillAt !== undefined && !Array.isArray(merged.stillAt))
      )
        throw new Error("Chronologie de cible invalide.");
      let previous = Date.parse(merged.occurredAt);
      for (const value of merged.stillAt || []) {
        const current = Date.parse(value);
        if (!Number.isFinite(current) || current < previous)
          throw new Error("Ordre des constats de cible invalide.");
        previous = current;
      }
      if (
        merged.endedAt &&
        (!Number.isFinite(Date.parse(merged.endedAt)) ||
          Date.parse(merged.endedAt) < previous)
      )
        throw new Error("Fin de cible invalide.");
      validateEpisodeExtensions({ ...base, ...state });
    }
  }
}
