import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogItem, updateCatalogItem } from "../src/catalog.js";
import {
  normalizeConfig,
  initialValues,
  getEditableConfig,
} from "../src/criteria.js";
import {
  createIndependentEntries,
  getEpisode,
  getEpisodeViews,
  targetKey,
  savePresenceCheck,
  getPresenceChecks,
  deletePresenceCheck,
  finishEpisode,
  updateEpisode,
  deleteEpisode,
  addOccurrence,
  getEvolution,
} from "../src/episodes.js";
import { getHistoryRows, getEpisodeCheckRows } from "../src/history.js";
import { saveTransit, confirmNoPassage } from "../src/digestive.js";
import { createBackup, mergeBackup, parseBackup } from "../src/transfer.js";
import { calculateStats } from "../src/stats.js";

const empty = () => ({
  schemaVersion: 1,
  catalog: [],
  entries: [],
  settings: {},
});
const time = (hour) => `2026-01-02T${String(hour).padStart(2, "0")}:00:00.000Z`;
const configure = (...criteria) => ({ version: 1, criteria });
const config = configure(
  "location",
  "pain",
  "comment",
  "stillPresent",
  "finish",
);
function symptom(data, label = "Crampe intestinale", chosen = config) {
  return createCatalogItem(data, {
    label,
    family: "digestif",
    kind: "symptome",
    config: chosen,
  });
}
function create(data, item, hour = 10, extra = {}) {
  return createIndependentEntries(data, {
    itemIds: [item.id],
    occurredAt: time(hour),
    ...extra,
  })[0];
}
function view(data, entry) {
  return getEpisode(data, entry.id);
}

test("configuration vide autorisée, critères inconnus et répétés refusés", () => {
  assert.deepEqual(normalizeConfig(configure()), configure());
  assert.throws(() => normalizeConfig(configure("pain", "pain")));
  assert.throws(() => normalizeConfig(configure("inventé")));
  assert.deepEqual(initialValues(config), { pain: 0 });
  assert.deepEqual(initialValues(configure("discomfort")), {});
});

test("symptôme sans critères enregistrable avec seulement identité et horaire", () => {
  const data = empty();
  const item = symptom(data, "Symptôme libre", configure());
  const entry = create(data, item);
  assert.deepEqual(entry.values, {});
  assert.deepEqual(entry.levels, []);
  assert.equal(entry.itemIds[0], item.id);
  assert.doesNotThrow(() => createBackup(data));
});

test("zéro par défaut seulement pour la douleur présente dans un nouveau formulaire", () => {
  const data = empty();
  const first = create(data, symptom(data));
  assert.deepEqual(first.values, { pain: 0 });
  const nausea = symptom(
    data,
    "Nausée",
    configure("discomfort", "comment", "stillPresent"),
  );
  const second = create(data, nausea);
  assert.deepEqual(second.values, {});
  assert.equal(second.values.location, undefined);
  assert.equal(second.values.discomfort, undefined);
});

test("renommer et retirer un critère ne change aucune ancienne observation", () => {
  const data = empty();
  const item = symptom(data);
  const entry = create(data, item, 10, {
    values: { pain: 7, location: "Intestins", comment: "Conduite" },
  });
  const before = structuredClone(entry);
  updateCatalogItem(data, item.id, {
    label: "Crampe renommée",
    family: "digestif",
    kind: "symptome",
    config: configure("comment", "discomfort"),
  });
  assert.deepEqual(data.entries[0], before);
  const editable = getEditableConfig(data.catalog[0], entry);
  assert.ok(editable.criteria.includes("pain"));
  assert.ok(editable.criteria.includes("discomfort"));
  updateEpisode(data, entry.id, view(data, entry).targetKey, {
    occurredAt: entry.occurredAt,
    values: { pain: 6 },
    levels: [],
  });
  assert.equal(data.entries[0].values.location, "Intestins");
  assert.equal(data.entries[0].values.pain, 6);
  assert.equal(getHistoryRows(data)[0].label, "Crampe renommée");
  assert.equal(data.entries[0].itemSnapshot.label, "Crampe intestinale");
});

test("le type Zone est refusé en Digestif sans modifier le catalogue", () => {
  const data = empty();
  assert.throws(() =>
    createCatalogItem(data, {
      label: "Genou",
      family: "digestif",
      kind: "zone",
    }),
  );
  assert.equal(data.catalog.length, 0);
});

test("une saisie simultanée crée deux épisodes indépendants au même horaire et commentaire", () => {
  const data = empty();
  const item = createCatalogItem(data, {
    label: "Mains",
    family: "rhumatologie",
    kind: "zone",
  });
  const created = createIndependentEntries(data, {
    itemIds: [item.id],
    itemLocations: { [item.id]: ["hand-right", "hand-left"] },
    levels: [2, 3],
    occurredAt: time(10),
    note: "Pendant la conduite",
  });
  assert.equal(created.length, 2);
  assert.notEqual(created[0].id, created[1].id);
  assert.equal(created[0].sourceGroupId, created[1].sourceGroupId);
  for (const entry of created) {
    assert.equal(entry.occurredAt, time(10));
    assert.equal(entry.note, "Pendant la conduite");
    assert.deepEqual(entry.levels, [2, 3]);
    assert.equal(getEpisodeViews(entry).length, 1);
  }
  const right = created.find(
    (entry) => entry.itemLocations[item.id][0] === "hand-right",
  );
  finishEpisode(data, right.id, view(data, right).targetKey, time(11));
  assert.equal(data.entries.filter((entry) => entry.endedAt).length, 1);
});

test("nouvelle douleur : clôture uniquement le même identifiant et le même côté", () => {
  const data = empty();
  const item = createCatalogItem(data, {
    label: "Mains",
    family: "rhumatologie",
    kind: "zone",
  });
  const [left, right] = createIndependentEntries(data, {
    itemIds: [item.id],
    itemLocations: { [item.id]: ["hand-left", "hand-right"] },
    levels: [2],
    occurredAt: time(10),
  });
  const replacement = create(data, item, 12, {
    itemLocations: { [item.id]: ["hand-right"] },
    levels: [3],
  });
  assert.equal(getEpisode(data, right.id).closedUnknown, true);
  assert.equal(getEpisode(data, left.id).closedUnknown, undefined);
  deleteEpisode(data, replacement.id, view(data, replacement).targetKey);
  assert.equal(getEpisode(data, right.id).closedUnknown, true);
  assert.equal(getEpisode(data, right.id).endedAt, undefined);
});

test("ancienne saisie groupée : clôture ciblée sans changer identité, valeurs et constats d’origine", () => {
  const data = empty();
  data.catalog = [
    { id: "main", label: "Main droite", family: "rhumatologie", kind: "zone" },
    {
      id: "genou",
      label: "Genou gauche",
      family: "rhumatologie",
      kind: "zone",
    },
  ];
  const original = {
    id: "v3-original",
    itemIds: ["main", "genou"],
    levels: [2],
    occurredAt: time(8),
    stillAt: [time(9)],
    note: "  Conduite  ",
  };
  data.entries = [structuredClone(original)];
  create(data, data.catalog[0], 12, { levels: [3] });
  const raw = data.entries.find((entry) => entry.id === original.id);
  const { targetStates, ...rest } = raw;
  assert.deepEqual(rest, original);
  const main = getEpisode(data, raw.id, targetKey({ itemId: "main" }));
  const knee = getEpisode(data, raw.id, targetKey({ itemId: "genou" }));
  assert.equal(main.closedUnknown, true);
  assert.equal(knee.closedUnknown, undefined);
  savePresenceCheck(data, raw.id, knee.targetKey, {
    occurredAt: time(13),
    levels: [1],
    note: "Mieux",
  });
  assert.deepEqual(
    getPresenceChecks(getEpisode(data, raw.id, main.targetKey)).map(
      (check) => check.occurredAt,
    ),
    [time(9)],
  );
  assert.equal(
    getPresenceChecks(getEpisode(data, raw.id, knee.targetKey)).length,
    2,
  );
});

test("un ancien côté inconnu n’est jamais attribué au nouveau côté droit", () => {
  const data = empty();
  const item = createCatalogItem(data, {
    label: "Mains",
    family: "rhumatologie",
    kind: "zone",
  });
  const old = create(data, item, 8, { levels: [2] });
  create(data, item, 10, {
    levels: [3],
    itemLocations: { [item.id]: ["hand-right"] },
  });
  assert.equal(getEpisode(data, old.id).closedUnknown, undefined);
});

test("localisations digestives distinctes ne se clôturent pas mutuellement", () => {
  const data = empty();
  const item = symptom(data);
  const stomach = create(data, item, 8, { values: { location: "Estomac" } });
  create(data, item, 10, { values: { location: "Intestins" } });
  assert.equal(getEpisode(data, stomach.id).closedUnknown, undefined);
});

test("un chevauchement contradictoire est refusé sans clôture partielle ni nouvelle entrée", () => {
  const data = empty();
  const item = symptom(data);
  const entry = create(data, item, 8);
  savePresenceCheck(data, entry.id, view(data, entry).targetKey, {
    occurredAt: time(12),
    values: { pain: 5 },
  });
  const before = structuredClone(data);
  assert.throws(() => create(data, item, 10), /ancien épisode/);
  assert.deepEqual(data, before);
});

test("constats successifs conservent intensités et notes ; les constats anciens n’en reçoivent pas", () => {
  const data = empty();
  const item = symptom(data);
  const entry = create(data, item, 8, { values: { pain: 2 } });
  const key = view(data, entry).targetKey;
  savePresenceCheck(data, entry.id, key, {
    occurredAt: time(9),
    values: { pain: 7 },
    note: "Pire",
  });
  savePresenceCheck(data, entry.id, key, {
    occurredAt: time(10),
    values: {},
    note: "Toujours",
  });
  savePresenceCheck(data, entry.id, key, {
    occurredAt: time(11),
    values: { pain: 4 },
  });
  const checks = getEpisodeCheckRows(view(data, entry));
  assert.equal(checks[0].values.pain, 7);
  assert.equal(checks[0].note, "Pire");
  assert.equal(checks[1].values.pain, undefined);
  assert.deepEqual(
    checks.map((check) => check.evolution),
    ["↗", "", "↘"],
  );
  const legacy = { ...entry, checks: undefined, stillAt: [time(9)] };
  assert.deepEqual(getPresenceChecks(legacy)[0].values, {});
});

test("modifier et supprimer un constat préserve l’épisode et les autres constats", () => {
  const data = empty();
  const item = symptom(data);
  const entry = create(data, item, 8);
  const key = view(data, entry).targetKey;
  const first = savePresenceCheck(data, entry.id, key, {
    occurredAt: time(9),
    values: { pain: 5 },
  });
  const second = savePresenceCheck(data, entry.id, key, {
    occurredAt: time(11),
    values: { pain: 8 },
  });
  savePresenceCheck(
    data,
    entry.id,
    key,
    { occurredAt: time(10), values: { pain: 4 } },
    first.id,
  );
  deletePresenceCheck(data, entry.id, key, second.id);
  assert.deepEqual(
    getPresenceChecks(view(data, entry)).map((check) => [
      check.id,
      check.occurredAt,
      check.values.pain,
    ]),
    [[first.id, time(10), 4]],
  );
  assert.equal(data.entries.length, 1);
  assert.equal(data.entries[0].occurredAt, time(8));
});

test("fin et constats respectent l’ordre temporel ; l’heure exacte du clic est conservée", () => {
  const data = empty();
  const item = symptom(data);
  const entry = create(data, item, 8);
  const key = view(data, entry).targetKey;
  const exact = "2026-01-02T09:14:37.123Z";
  savePresenceCheck(data, entry.id, key, { occurredAt: exact, values: {} });
  assert.equal(getPresenceChecks(view(data, entry))[0].occurredAt, exact);
  assert.throws(() => finishEpisode(data, entry.id, key, time(9)));
  finishEpisode(data, entry.id, key, time(10));
  assert.throws(() =>
    savePresenceCheck(data, entry.id, key, { occurredAt: time(11) }),
  );
});

test("antidater une cible conserve l’ancien début et son intensité comme constat", () => {
  const data = empty();
  const item = symptom(data);
  const entry = create(data, item, 10, { values: { pain: 6 } });
  updateEpisode(data, entry.id, view(data, entry).targetKey, {
    occurredAt: time(8),
    values: { pain: 3 },
    levels: [],
  });
  const checks = getPresenceChecks(view(data, entry));
  assert.equal(checks[0].occurredAt, time(10));
  assert.equal(checks[0].values.pain, 6);
});

test("remontées rapides : occurrences séparées dans un groupe, hauteur/gêne inconnues", () => {
  const data = empty();
  const item = symptom(
    data,
    "Remontée acide",
    configure("refluxHeight", "discomfort", "comment", "newOccurrence"),
  );
  const first = create(data, item, 8, {
    values: { refluxHeight: "Gorge", discomfort: 0 },
  });
  const second = addOccurrence(
    data,
    first.id,
    view(data, first).targetKey,
    time(9),
  );
  const third = addOccurrence(
    data,
    first.id,
    view(data, first).targetKey,
    time(10),
  );
  assert.equal(first.occurrenceGroupId, second.occurrenceGroupId);
  assert.equal(second.occurrenceGroupId, third.occurrenceGroupId);
  assert.deepEqual(second.values, {});
  assert.notEqual(first.id, second.id);
  assert.equal(first.values.discomfort, 0);
  assert.equal(getHistoryRows(data).length, 3);
});

test("les niveaux voisins qui se chevauchent n’inventent pas une tendance", () => {
  assert.equal(getEvolution({ levels: [2, 3] }, { levels: [3, 4] }), "");
  assert.equal(getEvolution({ levels: [2] }, { levels: [3] }), "↗");
  assert.equal(getEvolution({ levels: [2, 3] }, { levels: [2, 3] }), "→");
  assert.equal(getEvolution({ values: {} }, { values: { pain: 0 } }), "");
});

test("l’accueil mêle toutes les familles et le transit dans l’ordre, sans heure inventée pour une journée", () => {
  const data = empty();
  const item = symptom(data);
  create(data, item, 8);
  saveTransit(data, {
    kind: "passage",
    occurredAt: time(9),
    bristol: { types: [4] },
    pain: 0,
    note: "",
    conditionIds: [],
  });
  saveTransit(data, {
    kind: "accident",
    occurredAt: time(10),
    bristol: { types: [7] },
    note: "",
    conditionIds: [],
  });
  confirmNoPassage(data, "2026-01-01");
  const rows = getHistoryRows(data);
  assert.deepEqual(
    rows.map((row) => row.kind),
    ["transit", "transit", "episode", "day"],
  );
  assert.equal(rows.at(-1).occurredAt, undefined);
  assert.equal(getHistoryRows(data, { moduleId: "rhumatologie" }).length, 0);
});

test("sauvegarde complète et réimportation idempotente des configurations, constats et clôtures", () => {
  const data = empty();
  const item = symptom(data);
  const old = create(data, item, 8);
  savePresenceCheck(data, old.id, view(data, old).targetKey, {
    occurredAt: time(9),
    values: { pain: 5 },
    note: "Présent",
  });
  create(data, item, 10);
  const backup = createBackup(data);
  assert.equal(backup.formatVersion, 3);
  assert.deepEqual(parseBackup(backup).data, data);
  const first = mergeBackup(empty(), backup).data;
  assert.deepEqual(first.entries, data.entries);
  assert.deepEqual(mergeBackup(first, backup).data, first);
});

test("collision de catalogue remappe les clés du suivi par cible sans perte ni doublon", () => {
  const incoming = empty();
  incoming.catalog = [
    { id: "same", label: "Main", family: "rhumatologie", kind: "zone" },
    { id: "knee", label: "Genou", family: "rhumatologie", kind: "zone" },
  ];
  incoming.entries = [
    {
      id: "legacy",
      itemIds: ["same", "knee"],
      levels: [2],
      occurredAt: time(8),
      note: "",
    },
  ];
  create(incoming, incoming.catalog[0], 10, { levels: [3] });
  const current = empty();
  current.catalog = [
    { id: "same", label: "Autre zone", family: "rhumatologie", kind: "zone" },
  ];
  const backup = createBackup(incoming);
  const first = mergeBackup(current, backup).data;
  const legacy = first.entries.find((entry) => entry.id === "legacy");
  assert.notEqual(legacy.itemIds[0], "same");
  assert.ok(
    legacy.targetStates[targetKey({ itemId: legacy.itemIds[0] })].closedUnknown,
  );
  assert.deepEqual(mergeBackup(first, backup).data, first);
});

test("configuration et constat invalides refusés avant fusion, sans écrasement local", () => {
  const data = empty();
  const item = symptom(data);
  const entry = create(data, item);
  const source = structuredClone(data);
  const backup = createBackup(data);
  backup.data.entries[0].checks = [
    { id: "bad", occurredAt: time(8), levels: [], values: { pain: 12 } },
  ];
  assert.throws(() => mergeBackup(data, backup));
  assert.deepEqual(data, source);
  assert.throws(() =>
    updateCatalogItem(data, item.id, {
      label: "Renommé",
      family: "digestif",
      kind: "symptome",
      config: configure("inconnu"),
    }),
  );
  assert.equal(data.entries[0].id, entry.id);
  assert.equal(data.catalog[0].label, item.label);
});

test("un constat passé ne peut pas franchir le début du nouvel épisode ayant clôturé l’ancien", () => {
  const data = empty();
  const item = symptom(data);
  const first = create(data, item, 8);
  const key = view(data, first).targetKey;
  const check = savePresenceCheck(data, first.id, key, {
    occurredAt: time(9),
    values: { pain: 4 },
  });
  create(data, item, 10);
  const original = structuredClone(data);
  assert.throws(() =>
    savePresenceCheck(data, first.id, key, {
      occurredAt: time(11),
      values: { pain: 5 },
    }),
  );
  assert.throws(() =>
    savePresenceCheck(
      data,
      first.id,
      key,
      { occurredAt: time(11), values: { pain: 5 } },
      check.id,
    ),
  );
  assert.throws(() => finishEpisode(data, first.id, key, time(11)));
  assert.deepEqual(data, original);
  finishEpisode(data, first.id, key, time(9));
  assert.equal(getEpisode(data, first.id).endedAt, time(9));
  assert.equal(getEpisode(data, first.id).closedUnknown, false);
});

test("suppression ciblée d’une ancienne zone conserve le suivi et l’identité des autres", () => {
  const data = empty();
  data.catalog = [
    { id: "one", label: "Main", family: "rhumatologie", kind: "zone" },
    { id: "two", label: "Genou", family: "rhumatologie", kind: "zone" },
  ];
  data.entries = [
    {
      id: "old",
      itemIds: ["one", "two"],
      levels: [2],
      occurredAt: time(8),
      stillAt: [time(9)],
      note: "Commun",
    },
  ];
  savePresenceCheck(data, "old", targetKey({ itemId: "two" }), {
    occurredAt: time(10),
    levels: [3],
    note: "Genou",
  });
  deleteEpisode(data, "old", targetKey({ itemId: "one" }));
  assert.equal(data.entries[0].id, "old");
  assert.deepEqual(data.entries[0].itemIds, ["two"]);
  assert.equal(getPresenceChecks(getEpisode(data, "old")).length, 2);
  savePresenceCheck(data, "old", targetKey({ itemId: "two" }), {
    occurredAt: time(11),
    levels: [1],
  });
  assert.equal(getPresenceChecks(getEpisode(data, "old")).length, 3);
  assert.doesNotThrow(() => createBackup(data));
});

test("un suivi par cible incohérent est refusé avant restauration", () => {
  const data = empty();
  data.catalog = [
    { id: "one", label: "Main", family: "rhumatologie", kind: "zone" },
    { id: "two", label: "Genou", family: "rhumatologie", kind: "zone" },
  ];
  data.entries = [
    {
      id: "old",
      itemIds: ["one", "two"],
      levels: [2],
      occurredAt: time(8),
      stillAt: [],
      note: "",
    },
  ];
  const backup = createBackup(data);
  backup.data.entries[0].targetStates = {
    [targetKey({ itemId: "one" })]: {
      occurredAt: time(10),
      stillAt: [time(9)],
    },
  };
  assert.throws(() => parseBackup(backup));
});

test("compteurs communs : transit compté une fois et journées intermédiaires non inventées", () => {
  const data = empty();
  const item = symptom(data);
  const entry = create(data, item, 8);
  savePresenceCheck(data, entry.id, view(data, entry).targetKey, {
    occurredAt: "2026-01-05T08:00:00.000Z",
    values: { pain: 0 },
  });
  saveTransit(data, {
    kind: "passage",
    occurredAt: "2026-01-06T08:00:00.000Z",
    bristol: { types: [3, 4], mode: "intermediate" },
    pain: 0,
    note: "",
    conditionIds: [],
  });
  confirmNoPassage(data, "2026-01-07");
  const stats = calculateStats(data);
  assert.equal(stats.totalEntries, 3);
  assert.equal(stats.activeDays, 4);
});
