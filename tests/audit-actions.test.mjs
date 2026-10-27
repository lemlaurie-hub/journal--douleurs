import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getLastKnownIntensity,
  getEpisode,
  savePresenceCheck,
  addOccurrence,
} from "../src/episodes.js";
const at = (hour) => `2026-01-03T${String(hour).padStart(2, "0")}:00:00.000Z`;
const numeric = {
  occurredAt: at(8),
  values: { pain: 2, discomfort: 0, comment: "Initial" },
  levels: [],
  checks: [
    {
      id: "a",
      occurredAt: at(9),
      values: { pain: 7 },
      levels: [],
      note: "Ne pas recopier",
    },
    { id: "b", occurredAt: at(10), values: { discomfort: null }, levels: [] },
    { id: "c", occurredAt: at(11), values: {}, levels: [] },
  ],
};
test("préremplissage indépendant par intensité, ignore les blancs et garde zéro", () => {
  assert.deepEqual(getLastKnownIntensity(numeric, at(12)), {
    levels: [],
    values: { pain: 7, discomfort: 0 },
  });
});
test("le préremplissage ne prend pas une intensité postérieure au constat", () => {
  assert.deepEqual(getLastKnownIntensity(numeric, at(8)), {
    levels: [],
    values: { pain: 2, discomfort: 0 },
  });
});
test("les observations et constats ne sont pas modifiés par le préremplissage", () => {
  const before = structuredClone(numeric);
  getLastKnownIntensity(numeric, at(12));
  assert.deepEqual(numeric, before);
});
test("absence totale de mesure reste inconnue et sans zéro initial ajouté", () => {
  assert.deepEqual(
    getLastKnownIntensity({ occurredAt: at(8), stillAt: [at(9)] }, at(12)),
    { levels: [], values: {} },
  );
});
test("les niveaux qualitatifs remontent au dernier renseignement, pas au dernier constat vide", () => {
  const ep = {
    occurredAt: at(8),
    levels: [1],
    checks: [
      { id: "a", occurredAt: at(9), levels: [2, 3] },
      { id: "b", occurredAt: at(10), levels: [] },
    ],
  };
  assert.deepEqual(getLastKnownIntensity(ep, at(12)), {
    levels: [2, 3],
    values: {},
  });
});
test("V3 groupé : le préremplissage respecte chaque cible et les horaires hérités vides", () => {
  const key = JSON.stringify(["a", ""]);
  const data = {
    catalog: [],
    entries: [
      {
        id: "old",
        itemIds: ["a", "b"],
        occurredAt: at(8),
        levels: [1],
        stillAt: [at(9)],
        targetStates: {
          [key]: {
            checks: [{ id: "a", occurredAt: at(10), levels: [3] }],
            stillAt: [at(9), at(10)],
          },
        },
      },
    ],
  };
  assert.deepEqual(
    getLastKnownIntensity(getEpisode(data, "old", key), at(12)).levels,
    [3],
  );
  assert.deepEqual(
    getLastKnownIntensity(
      getEpisode(data, "old", JSON.stringify(["b", ""])),
      at(12),
    ).levels,
    [1],
  );
});
test("sauver une intensité préremplie enrichit le constat sans réécrire les précédents", () => {
  const data = {
    entries: [{ ...structuredClone(numeric), id: "e", itemIds: ["a"] }],
    catalog: [],
  };
  const ep = getEpisode(data, "e");
  const before = structuredClone(ep.checks);
  savePresenceCheck(data, "e", ep.targetKey, {
    occurredAt: at(12),
    ...getLastKnownIntensity(ep, at(12)),
  });
  assert.deepEqual(data.entries[0].checks.slice(0, 3), before);
  assert.deepEqual(data.entries[0].values, numeric.values);
  assert.deepEqual(data.entries[0].checks.at(-1).values, {
    pain: 7,
    discomfort: 0,
  });
});
test("occurrence créée avant enrichissement : source et heure précise restent intactes", () => {
  const data = {
    catalog: [
      { id: "r", label: "Remontée", family: "digestif", kind: "symptome" },
    ],
    entries: [
      {
        id: "e",
        itemIds: ["r"],
        occurredAt: at(8),
        configSnapshot: {
          version: 1,
          criteria: ["refluxHeight", "discomfort", "comment", "newOccurrence"],
        },
        values: { discomfort: 6, refluxHeight: "Gorge" },
        occurrenceGroupId: "g",
        note: "Repas",
      },
    ],
  };
  const before = structuredClone(data.entries[0]);
  const ep = getEpisode(data, "e");
  const created = addOccurrence(
    data,
    "e",
    ep.targetKey,
    "2026-01-03T12:00:01.123Z",
  );
  assert.deepEqual(data.entries[0], before);
  assert.deepEqual(created.values, {});
  assert.equal(created.note, "");
  assert.equal(created.occurredAt, "2026-01-03T12:00:01.123Z");
  assert.equal(created.occurrenceGroupId, "g");
});
test("aucune branche de suivi legacy ni mode instant dans le branchement de l’interface", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../src/ui.js", import.meta.url), "utf8");
  const episode = readFileSync(
    new URL("../src/episode-ui.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    app,
    /recordStillPresent|openFinishDialog|handleEpisodeAction|handleFinishSubmit|data-still-present-entry|data-finish-entry/,
  );
  assert.doesNotMatch(ui, /openFinishDialog|finishDialog/);
  assert.doesNotMatch(episode, /dataset\.instant/);
});
