// Règles du transit partagées par la saisie, les sauvegardes et les futurs rapports.
// Les épisodes douloureux existants restent dans entries, sans conversion.
export const BRISTOL = [
  "Petites boules dures et séparées",
  "Selle allongée, formée de morceaux bosselés",
  "Selle allongée avec des fissures en surface",
  "Selle allongée, lisse et souple",
  "Morceaux mous aux contours nets",
  "Morceaux pâteux aux contours irréguliers",
  "Entièrement liquide, sans morceau solide",
];

const DEFAULT_CONDITIONS = [
  ["urgency", "Urgence"],
  ["effort", "Effort pour évacuer"],
  ["incomplete", "Sensation d’évacuation incomplète"],
  ["leak", "Ça s’est échappé"],
];

const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

/** Une date civile locale est conservée : une journée ne commence pas à minuit UTC. */
export function localDate(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Date invalide.");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validateDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
      new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error("La journée choisie n’est pas valide.");
  }
  return date;
}

function timestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("La date ou l’heure n’est pas valide.");
  }
  return new Date(value).toISOString();
}

export function emptyDigestive() {
  return {
    version: 1,
    events: [],
    days: [],
    conditions: DEFAULT_CONDITIONS.map(([id, label]) => ({ id, label, active: true })),
  };
}

/** Le mode décrit l'observation, jamais une moyenne numérique des types. */
export function normalizeBristol(input) {
  const types = input?.types;
  if (!Array.isArray(types) || types.length < 1 || types.length > 2 ||
      types.some((n) => !Number.isInteger(n) || n < 1 || n > 7) ||
      new Set(types).size !== types.length) {
    throw new Error("Choisis un ou deux types Bristol.");
  }
  const sorted = [...types].sort((a, b) => a - b);
  const mode = types.length === 1 ? "simple" : input.mode;
  if (types.length === 2 && !["intermediate", "distinct"].includes(mode)) {
    throw new Error("Précise : aspect intermédiaire ou deux aspects présents.");
  }
  if (mode === "intermediate" && sorted[1] - sorted[0] !== 1) {
    throw new Error("Un aspect intermédiaire nécessite deux types voisins.");
  }
  return { types: sorted, mode };
}

/** Validation sans mutation, commune à l'import et au stockage. */
export function validateDigestive(value) {
  if (value === undefined) return;
  if (!value || value.version !== 1 || !Array.isArray(value.events) ||
      !Array.isArray(value.days) || !Array.isArray(value.conditions)) {
    throw new Error("Format des données digestives non reconnu.");
  }
  const unique = (rows, label) => {
    const ids = new Set();
    for (const row of rows) {
      if (!row || typeof row.id !== "string" || !row.id || ids.has(row.id)) {
        throw new Error(`Identifiant ${label} absent ou répété.`);
      }
      ids.add(row.id);
    }
  };
  unique(value.conditions, "de condition");
  unique(value.events, "de transit");
  unique(value.days, "de journée");
  if (new Set(value.days.map((day) => day.date)).size !== value.days.length) {
    throw new Error("Une journée sans passage est répétée.");
  }
  for (const c of value.conditions) {
    if (typeof c.label !== "string" || !c.label.trim() || typeof c.active !== "boolean") {
      throw new Error("Condition de transit invalide.");
    }
  }
  for (const e of value.events) {
    if (!["passage", "accident"].includes(e.kind)) throw new Error("Type de transit invalide.");
    timestamp(e.occurredAt);
    validateDate(e.localDate);
    const bristol = normalizeBristol(e.bristol);
    if (e.bristol.mode !== bristol.mode) throw new Error("Mode Bristol invalide.");
    if (typeof e.note !== "string" || !Array.isArray(e.conditions) ||
        e.conditions.some((c) => !c || typeof c.id !== "string" || typeof c.label !== "string" || !c.label.trim())) {
      throw new Error("Détails du transit invalides.");
    }
    if (e.kind === "passage" && (!Number.isInteger(e.pain) || e.pain < 0 || e.pain > 10)) {
      throw new Error("La douleur doit être comprise entre 0 et 10.");
    }
    if (e.kind === "accident" && e.pain !== null) throw new Error("Mesure d’accident invalide.");
  }
  for (const day of value.days) {
    validateDate(day.date);
    timestamp(day.confirmedAt);
  }
}

/** Initialise uniquement le nouveau module, sans modifier les anciennes observations. */
export function getDigestive(data) {
  validateDigestive(data.digestive);
  return data.digestive || emptyDigestive();
}

/** Écrit une nouvelle version du module après validation complète de la commande. */
function commit(data, next) {
  validateDigestive(next);
  data.digestive = next;
}

export function saveTransit(data, input, eventId = null) {
  const next = structuredClone(getDigestive(data));
  const previous = eventId ? next.events.find((e) => e.id === eventId) : null;
  if (eventId && !previous) throw new Error("Ce transit n’existe plus.");
  if (!["passage", "accident"].includes(input.kind)) throw new Error("Type de transit invalide.");
  const occurredAt = timestamp(input.occurredAt);
  if (Date.parse(occurredAt) > Date.now()) throw new Error("Le transit ne peut pas être dans le futur.");
  const conditions = [...new Set(input.conditionIds || [])].map((conditionId) => {
    const current = next.conditions.find((c) => c.id === conditionId);
    const old = previous?.conditions.find((c) => c.id === conditionId);
    if (!current && !old) throw new Error("Condition inconnue.");
    if (!old && current?.active === false) throw new Error("Cette condition est désactivée.");
    // Le libellé de l'époque reste dans l'observation même après renommage.
    return old || { id: current.id, label: current.label };
  });
  const event = {
    ...(previous || {}),
    id: previous?.id || id("transit"),
    kind: input.kind,
    occurredAt,
    localDate: previous?.occurredAt === occurredAt ? previous.localDate : localDate(occurredAt),
    bristol: normalizeBristol(input.bristol),
    conditions: input.kind === "passage" ? conditions : [],
    pain: input.kind === "passage" ? input.pain : null,
    note: String(input.note || "").trim(),
    createdAt: previous?.createdAt || new Date().toISOString(),
  };
  if (previous) event.updatedAt = new Date().toISOString();
  next.events = previous ? next.events.map((e) => e.id === eventId ? event : e) : [...next.events, event];
  // Un passage saisi après la réponse quotidienne la corrige. Un accident ne la contredit pas.
  if (event.kind === "passage") next.days = next.days.filter((d) => d.date !== event.localDate);
  commit(data, next);
  return event;
}

export function deleteTransit(data, eventId) {
  const next = structuredClone(getDigestive(data));
  next.events = next.events.filter((e) => e.id !== eventId);
  commit(data, next);
}

/** La confirmation concerne uniquement les passages aux toilettes. */
export function confirmNoPassage(data, date) {
  validateDate(date);
  if (date > localDate()) throw new Error("La journée ne peut pas être dans le futur.");
  const next = structuredClone(getDigestive(data));
  if (next.events.some((e) => e.localDate === date && e.kind === "passage")) {
    throw new Error("Un passage est déjà enregistré pour cette journée.");
  }
  if (!next.days.some((d) => d.date === date)) {
    next.days.push({ id: id("day"), date, confirmedAt: new Date().toISOString() });
  }
  commit(data, next);
}

export function clearNoPassage(data, date) {
  const next = structuredClone(getDigestive(data));
  next.days = next.days.filter((d) => d.date !== date);
  commit(data, next);
}

/** Une journée inconnue ne devient jamais une journée sans selles par défaut. */
export function getTransitDay(data, date) {
  const state = getDigestive(data);
  const events = state.events.filter((e) => e.localDate === date);
  const passages = events.filter((e) => e.kind === "passage").length;
  const accidents = events.filter((e) => e.kind === "accident").length;
  const noPassage = !passages && state.days.some((d) => d.date === date);
  return { passages, accidents, noPassage, noStool: noPassage && !accidents, unknown: !passages && !accidents && !noPassage };
}

/** Ajout, renommage et désactivation ; les observations gardent leurs libellés. */
export function saveCondition(data, input, conditionId = null) {
  const next = structuredClone(getDigestive(data));
  const existing = conditionId ? next.conditions.find((c) => c.id === conditionId) : null;
  if (conditionId && !existing) throw new Error("Condition inconnue.");
  const label = String(input.label || "").trim();
  if (!label) throw new Error("Le nom de la condition est obligatoire.");
  if (next.conditions.some((c) => c.id !== conditionId && c.label.toLocaleLowerCase("fr") === label.toLocaleLowerCase("fr"))) {
    throw new Error("Cette condition existe déjà.");
  }
  const condition = { ...(existing || {}), id: existing?.id || id("condition"), label, active: input.active !== false };
  next.conditions = existing ? next.conditions.map((c) => c.id === conditionId ? condition : c) : [...next.conditions, condition];
  commit(data, next);
  return condition;
}

/** Fusion additive : conflits conservés sous une identité distincte et stable. */
export function mergeDigestive(current, incoming) {
  validateDigestive(current);
  validateDigestive(incoming);
  const next = structuredClone(current || emptyDigestive());
  if (!incoming) return next;
  const stable = (value) => {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
    return JSON.stringify(value);
  };
  const same = (a, b) => { const { id: _a, ...aa } = a; const { id: _b, ...bb } = b; return stable(aa) === stable(bb); };
  function add(rows, record) {
    const matching = rows.find((r) => (r.id === record.id || r.id.startsWith(`${record.id}-import-`)) && same(r, record));
    if (matching) return matching.id;
    const copy = structuredClone(record);
    let suffix = 1;
    while (rows.some((r) => r.id === copy.id)) copy.id = `${record.id}-import-${suffix++}`;
    rows.push(copy);
    return copy.id;
  }
  const mapped = new Map();
  for (const c of incoming.conditions) mapped.set(c.id, add(next.conditions, c));
  for (const e of incoming.events) {
    const copy = structuredClone(e);
    copy.conditions = copy.conditions.map((c) => ({ ...c, id: mapped.get(c.id) || c.id }));
    add(next.events, copy);
  }
  for (const day of incoming.days) {
    if (!next.days.some((d) => d.date === day.date)) add(next.days, day);
  }
  // Un passage explicite prime sur une ancienne déclaration d'absence.
  next.days = next.days.filter((d) => !next.events.some((e) => e.kind === "passage" && e.localDate === d.date));
  validateDigestive(next);
  return next;
}
