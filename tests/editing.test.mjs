import test from "node:test";
import assert from "node:assert/strict";
import { reclassifyKnownV3Items, updateCatalogItem } from "../src/catalog.js";
import { createEntry, updateEntry } from "../src/entries.js";
import { getStorageKey, loadData } from "../src/storage.js";

// Les données de test sont minimales et synthétiques; ces tests protègent les
// dates précises, les notes et les associations lors d'une correction.
test("reclasser un élément conserve son identité et les observations associées", () => {
  const data = {
    catalog: [
      {
        id: "migraine",
        label: "Migraine",
        family: "rhumatologie",
        kind: "zone",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    entries: [
      {
        id: "entry-1",
        itemIds: ["migraine"],
        occurredAt: "2026-06-10T08:14:37.421Z",
        note: "  après le réveil  ",
      },
    ],
  };

  updateCatalogItem(data, "migraine", {
    label: "Migraine",
    family: "symptomes-evenements",
    kind: "symptome",
  });

  assert.deepEqual(data.catalog[0], {
    id: "migraine",
    label: "Migraine",
    family: "symptomes-evenements",
    kind: "symptome",
    createdAt: "2026-06-01T00:00:00.000Z",
  });
  assert.equal(data.entries[0].itemIds[0], "migraine");
  assert.equal(data.entries[0].occurredAt, "2026-06-10T08:14:37.421Z");
  assert.equal(data.entries[0].note, "  après le réveil  ");
});

test("enregistrer une nouvelle observation conserve la date normalisée et la note", () => {
  const data = {
    catalog: [
      {
        id: "lombaires",
        label: "Lombaires",
        family: "rhumatologie",
        kind: "zone",
      },
    ],
    entries: [],
  };

  const entry = createEntry(data, {
    itemIds: ["lombaires"],
    levels: [2, 3],
    occurredAt: "2026-10-11T15:31:00.000Z",
    ongoing: false,
    note: "En train d’éplucher des patates",
  });

  assert.equal(entry.occurredAt, "2026-10-11T15:31:00.000Z");
  assert.equal(entry.note, "En train d’éplucher des patates");
  assert.equal(data.entries[0].id, entry.id);
  assert.equal(data.entries.length, 1);
});

test("une nouvelle observation avec une date invalide ne modifie pas l’historique", () => {
  const existing = {
    id: "entry-existing",
    occurredAt: "2026-10-10T10:00:00.000Z",
  };
  const data = {
    catalog: [
      {
        id: "lombaires",
        label: "Lombaires",
        family: "rhumatologie",
        kind: "zone",
      },
    ],
    entries: [existing],
  };

  assert.throws(
    () =>
      createEntry(data, {
        itemIds: ["lombaires"],
        levels: [2],
        occurredAt: "pas-une-date",
        note: "test",
      }),
    /date ou l’heure n’est pas valide/i,
  );
  assert.deepEqual(data.entries, [existing]);
});

test("corriger une observation conserve sa date précise, sa note et ses autres métadonnées si elles sont inchangées", () => {
  const original = {
    id: "entry-1",
    itemIds: ["hanche"],
    levels: [2],
    occurredAt: "2026-06-10T08:14:37.421Z",
    ongoing: false,
    note: "  en voiture  ",
    createdAt: "2026-06-10T08:15:00.000Z",
    source: "v3",
  };
  const data = {
    catalog: [
      {
        id: "hanche",
        label: "Hanche droite",
        family: "rhumatologie",
        kind: "zone",
      },
      {
        id: "lombaires",
        label: "Lombaires",
        family: "rhumatologie",
        kind: "zone",
      },
    ],
    entries: [structuredClone(original)],
  };

  updateEntry(data, "entry-1", {
    itemIds: ["lombaires"],
    levels: [2],
    occurredAt: original.occurredAt,
    ongoing: false,
    note: original.note,
  });

  assert.deepEqual(data.entries[0], { ...original, itemIds: ["lombaires"] });
});

test("une correction de catalogue invalide ne modifie rien", () => {
  const item = {
    id: "x",
    label: "Hanche droite",
    family: "rhumatologie",
    kind: "zone",
  };
  const data = { catalog: [item] };
  assert.throws(() =>
    updateCatalogItem(data, "x", {
      label: "Hanche droite",
      family: "invalide",
      kind: "zone",
    }),
  );
  assert.deepEqual(item, {
    id: "x",
    label: "Hanche droite",
    family: "rhumatologie",
    kind: "zone",
  });
});

test("le reclassement V3 des migraines est ciblé, idempotent et conserve les observations", () => {
  const originalEntry = {
    id: "entry-1",
    itemIds: ["item-v3-migraine"],
    occurredAt: "2026-06-10T08:14:37.421Z",
    note: "  note exacte  ",
    levels: [2],
  };
  const data = {
    catalog: [
      {
        id: "item-v3-migraine",
        label: "Migraine",
        family: "rhumatologie",
        kind: "zone",
      },
      {
        id: "custom-migraine",
        label: "Migraine",
        family: "rhumatologie",
        kind: "zone",
      },
    ],
    entries: [structuredClone(originalEntry)],
  };

  assert.equal(reclassifyKnownV3Items(data), 1);
  assert.equal(reclassifyKnownV3Items(data), 0);
  assert.equal(data.catalog[0].family, "symptomes-evenements");
  assert.equal(data.catalog[1].family, "rhumatologie");
  assert.deepEqual(data.entries[0], originalEntry);
});

test("le chargement applique et enregistre la migration sans retirer de données", () => {
  const previousStorage = globalThis.localStorage;
  const values = new Map([
    [
      getStorageKey(),
      JSON.stringify({
        schemaVersion: 1,
        catalog: [
          {
            id: "item-v3-migraine",
            label: "Migraine",
            family: "rhumatologie",
            kind: "zone",
          },
          {
            id: "item-v3-hip",
            label: "Hanche droite",
            family: "rhumatologie",
            kind: "zone",
          },
        ],
        entries: [
          {
            id: "entry-1",
            itemIds: ["item-v3-migraine", "item-v3-hip"],
            occurredAt: "2026-06-10T08:14:37.421Z",
            note: "note",
          },
        ],
        settings: { theme: "system" },
      }),
    ],
  ]);
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  try {
    const firstLoad = loadData();
    const secondLoad = loadData();
    assert.equal(firstLoad.catalog.length, 2);
    assert.equal(
      firstLoad.catalog.find((item) => item.label === "Migraine").family,
      "symptomes-evenements",
    );
    assert.equal(
      firstLoad.catalog.find((item) => item.label === "Hanche droite").family,
      "rhumatologie",
    );
    assert.equal(firstLoad.entries[0].occurredAt, "2026-06-10T08:14:37.421Z");
    assert.equal(firstLoad.entries[0].note, "note");
    assert.deepEqual(secondLoad, firstLoad);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
