import test from "node:test";
import assert from "node:assert/strict";
import { transactData } from "../src/transactions.js";
import {
  saveData,
  loadData,
  getStorageKey,
  hasStorageReadError,
} from "../src/storage.js";
import {
  createCatalogItem,
  updateCatalogItem,
  ensureDigestivePresets,
  isItemInModule,
} from "../src/catalog.js";
import {
  saveTransit,
  deleteTransit,
  confirmNoPassage,
  clearNoPassage,
  saveCondition,
} from "../src/digestive.js";
import {
  createIndependentEntries,
  getEpisode,
  savePresenceCheck,
  finishEpisode,
  deleteEpisode,
  addOccurrence,
  updateEpisode,
} from "../src/episodes.js";
import { updateEntry } from "../src/entries.js";
import { createBackup, mergeBackup } from "../src/transfer.js";
import { calculateStats } from "../src/stats.js";
import { getHistoryRows, getFollowupRows } from "../src/history.js";
const at = (hour) => `2026-01-03T${String(hour).padStart(2, "0")}:00:00.123Z`;
function fixture() {
  const data = {
    schemaVersion: 1,
    catalog: [],
    entries: [],
    settings: {},
    extension: { keep: null },
  };
  ensureDigestivePresets(data);
  const item = data.catalog.find((i) => i.presetKey === "cramp");
  createIndependentEntries(data, {
    itemIds: [item.id],
    occurredAt: at(8),
    values: { pain: null, location: "Intestins" },
  });
  saveTransit(data, {
    kind: "passage",
    occurredAt: at(8),
    bristol: { types: [4] },
    pain: 0,
    conditionIds: [],
    note: "",
  });
  confirmNoPassage(data, "2026-01-02");
  return data;
}
function withStorage(data, fn) {
  const previous = globalThis.localStorage;
  let raw = JSON.stringify(data);
  let fail = false;
  globalThis.localStorage = {
    getItem: (key) => (key === getStorageKey() ? raw : null),
    setItem: (key, value) => {
      if (fail) throw new Error("Quota simulé");
      raw = value;
    },
  };
  try {
    loadData();
    return fn({ raw: () => raw, fail: (value) => (fail = value) });
  } finally {
    globalThis.localStorage = previous;
  }
}
const commands = {
  "catalogue/carte : créer": (data) =>
    createCatalogItem(data, {
      label: "Zone nouvelle",
      family: "rhumatologie",
      kind: "zone",
    }),
  "catalogue : modifier": (data) =>
    updateCatalogItem(data, data.catalog[0].id, {
      ...data.catalog[0],
      label: "Nom corrigé",
    }),
  "prédéfinis : initialiser": (data) => {
    data.catalog = data.catalog.slice(0, 1);
    ensureDigestivePresets(data);
  },
  "transit : créer et corriger Aucun": (data) =>
    saveTransit(data, {
      kind: "passage",
      occurredAt: "2026-01-02T09:00:00.000Z",
      bristol: { types: [3] },
      pain: 0,
      conditionIds: [],
      note: "",
    }),
  "transit : corriger": (data) =>
    saveTransit(
      data,
      {
        ...data.digestive.events[0],
        bristol: { types: [5] },
        conditionIds: [],
        pain: 2,
      },
      data.digestive.events[0].id,
    ),
  "transit : supprimer": (data) =>
    deleteTransit(data, data.digestive.events[0].id),
  "journée : confirmer": (data) => confirmNoPassage(data, "2026-01-01"),
  "journée : annuler": (data) => clearNoPassage(data, "2026-01-02"),
  "condition : ajouter": (data) =>
    saveCondition(data, { label: "Condition personnelle", active: true }),
  "condition : renommer/désactiver": (data) =>
    saveCondition(
      data,
      { label: "Autre nom", active: false },
      data.digestive.conditions[0].id,
    ),
  "épisode : créer avec clôture automatique": (data) =>
    createIndependentEntries(data, {
      itemIds: [data.entries[0].itemIds[0]],
      occurredAt: at(10),
      values: { location: "Intestins", pain: 0 },
    }),
  "constat : enrichir": (data) =>
    savePresenceCheck(
      data,
      data.entries[0].id,
      getEpisode(data, data.entries[0].id).targetKey,
      { occurredAt: at(10), values: { pain: 5 } },
    ),
  "fin : clôturer sans heure": (data) =>
    finishEpisode(
      data,
      data.entries[0].id,
      getEpisode(data, data.entries[0].id).targetKey,
      null,
    ),
  "épisode : corriger": (data) =>
    updateEpisode(
      data,
      data.entries[0].id,
      getEpisode(data, data.entries[0].id).targetKey,
      { occurredAt: at(8), values: { pain: 0 }, note: "Corrigé" },
    ),
  "épisode : supprimer": (data) =>
    deleteEpisode(
      data,
      data.entries[0].id,
      getEpisode(data, data.entries[0].id).targetKey,
    ),
  "occurrence : créer": (data) =>
    addOccurrence(
      data,
      data.entries[0].id,
      getEpisode(data, data.entries[0].id).targetKey,
      at(10),
    ),
  "associations anciennes : corriger": (data) =>
    updateEntry(data, data.entries[0].id, {
      ...data.entries[0],
      note: "Associations conservées",
    }),
  "import V3 : fusionner": (data) => {
    const merged = mergeBackup(
      data,
      JSON.stringify([
        {
          date: at(7),
          zones: ["Ancienne zone"],
          level: "😕 Gênante",
          note: "Source V3",
        },
      ]),
    ).data;
    Object.assign(data, merged);
  },
};
for (const [name, action] of Object.entries(commands))
  test(`échec d’écriture atomique puis réussite : ${name}`, () => {
    const data = fixture();
    if (name.startsWith("associations"))
      data.entries[0] = {
        id: "legacy",
        itemIds: data.entries[0].itemIds,
        occurredAt: at(8),
        levels: [2],
        note: "Ancienne observation",
        ongoing: true,
        stillAt: [],
      };
    const before = structuredClone(data);
    const root = data;
    const entries = data.entries;
    withStorage(data, (storage) => {
      const originalRaw = storage.raw();
      storage.fail(true);
      assert.throws(() => transactData(data, action, saveData), /Quota/);
      assert.deepEqual(data, before);
      assert.equal(data, root);
      assert.equal(data.entries, entries);
      assert.equal(storage.raw(), originalRaw);
      storage.fail(false);
      transactData(data, action, saveData);
      assert.deepEqual(data, JSON.parse(storage.raw()));
      assert.deepEqual(data.extension, { keep: null });
    });
  });
test("commande qui modifie sa copie puis échoue : ni persistance ni publication", () => {
  const data = fixture();
  const before = structuredClone(data);
  let writes = 0;
  assert.throws(
    () =>
      transactData(
        data,
        (next) => {
          next.entries = [];
          throw new Error("Validation");
        },
        () => writes++,
      ),
    /Validation/,
  );
  assert.deepEqual(data, before);
  assert.equal(writes, 0);
});
test("validation de sauvegarde refusée après mutation : aucune divergence", () => {
  const data = fixture();
  const before = structuredClone(data);
  withStorage(data, (storage) => {
    const raw = storage.raw();
    assert.throws(() =>
      transactData(
        data,
        (next) => {
          next.entries[0].values = { pain: 11 };
        },
        saveData,
      ),
    );
    assert.deepEqual(data, before);
    assert.equal(storage.raw(), raw);
  });
});
test("migration de migraine : échec de sauvegarde conserve le classement persistant, reprise idempotente", () => {
  const data = {
    schemaVersion: 1,
    catalog: [
      {
        id: "item-v3-migraine",
        label: "Migraine",
        family: "rhumatologie",
        kind: "zone",
      },
    ],
    entries: [],
    settings: {},
  };
  const previous = globalThis.localStorage;
  let raw = JSON.stringify(data);
  let fail = true;
  globalThis.localStorage = {
    getItem: () => raw,
    setItem: (key, value) => {
      if (fail) throw new Error("Quota");
      raw = value;
    },
  };
  try {
    assert.deepEqual(loadData(), data);
    assert.equal(hasStorageReadError(), false);
    assert.deepEqual(JSON.parse(raw), data);
    fail = false;
    const migrated = loadData();
    assert.equal(migrated.catalog[0].family, "symptomes-evenements");
    assert.deepEqual(migrated, JSON.parse(raw));
    assert.deepEqual(loadData(), migrated);
  } finally {
    globalThis.localStorage = previous;
  }
});
test("statistiques d’une ancienne saisie multi-module suivent les mêmes cibles que l’historique", () => {
  const key = (id) => JSON.stringify([id, ""]);
  const data = {
    schemaVersion: 1,
    catalog: [
      { id: "r", label: "Genou", family: "rhumatologie", kind: "zone" },
      { id: "d", label: "Crampe", family: "digestif", kind: "symptome" },
    ],
    entries: [
      {
        id: "old",
        itemIds: ["r", "d"],
        occurredAt: at(8),
        ongoing: true,
        levels: [2],
        targetStates: {
          [key("r")]: { closedUnknown: true, closure: { recordedAt: at(9) } },
          [key("d")]: {
            checks: [
              {
                id: "c",
                occurredAt: "2026-01-04T09:00:00.000Z",
                values: { pain: 0 },
              },
            ],
          },
        },
      },
    ],
    settings: {},
  };
  const before = structuredClone(data);
  const rhumato = calculateStats(data, { moduleId: "rhumatologie" });
  const digestive = calculateStats(data, { moduleId: "digestif" });
  assert.equal(rhumato.ongoingEntries, 0);
  assert.equal(rhumato.activeDays, 1);
  assert.equal(digestive.ongoingEntries, 1);
  assert.equal(digestive.activeDays, 2);
  assert.deepEqual(
    rhumato.topItems.map((x) => x.itemId),
    ["r"],
  );
  assert.deepEqual(
    digestive.topItems.map((x) => x.itemId),
    ["d"],
  );
  assert.equal(getHistoryRows(data, { moduleId: "rhumatologie" }).length, 1);
  assert.equal(calculateStats(data).totalEntries, 1);
  assert.deepEqual(data, before);
});
test("échec après clôture automatique préparée conserve le suivi, l’historique et la sauvegarde exacte", () => {
  const data = fixture();
  const before = createBackup(data);
  const stats = calculateStats(data);
  withStorage(data, (storage) => {
    storage.fail(true);
    assert.throws(() =>
      transactData(
        data,
        commands["épisode : créer avec clôture automatique"],
        saveData,
      ),
    );
    assert.deepEqual(createBackup(data).data, before.data);
    assert.deepEqual(calculateStats(data), stats);
    assert.equal(getFollowupRows(data, Date.parse(at(9))).length, 1);
  });
});

test("échec de sérialisation JSON : la copie invalide n’est pas publiée", () => {
  const data = fixture();
  const before = structuredClone(data);
  withStorage(data, (storage) => {
    const raw = storage.raw();
    assert.throws(() =>
      transactData(
        data,
        (next) => {
          next.extension.invalid = 1n;
        },
        saveData,
      ),
    );
    assert.deepEqual(data, before);
    assert.equal(storage.raw(), raw);
  });
});

test("classement identique catalogue/historique/statistiques, même pour une famille importée inconnue", () => {
  const item = {
    id: "custom-import",
    label: "Ancien libellé",
    family: "famille-importée",
    kind: "symptome",
  };
  const data = {
    catalog: [item],
    entries: [
      { id: "legacy", itemIds: [item.id], occurredAt: at(8), levels: [2] },
    ],
  };
  assert.equal(isItemInModule(item, "symptomes-evenements"), true);
  assert.equal(isItemInModule(item, "rhumatologie"), false);
  assert.equal(
    getHistoryRows(data, { moduleId: "symptomes-evenements" }).length,
    1,
  );
  assert.equal(
    calculateStats(data, { moduleId: "symptomes-evenements" }).totalEntries,
    1,
  );
  assert.equal(calculateStats(data, { moduleId: "digestif" }).totalEntries, 0);
  assert.equal(item.family, "famille-importée");
});
