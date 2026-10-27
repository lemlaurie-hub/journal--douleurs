import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureDigestivePresets,
  getDigestiveSymptomChoices,
  updateCatalogItem,
} from "../src/catalog.js";
import { CRITERIA, normalizeValues } from "../src/criteria.js";
import {
  getFollowupRows,
  getTodayOccurrenceRows,
  nextDailyRefreshAt,
} from "../src/history.js";
import {
  createIndependentEntries,
  getEpisode,
  savePresenceCheck,
  finishEpisode,
  deleteEpisode,
} from "../src/episodes.js";
import { getMinimumDurationMs } from "../src/entries.js";
import { createBackup, mergeBackup } from "../src/transfer.js";
const empty = () => ({
  schemaVersion: 1,
  catalog: [],
  entries: [],
  settings: {},
});
const origin = Date.parse("2026-01-03T12:00:00Z");
const at = (hours) => new Date(origin + hours * 3600000).toISOString();
function fixture() {
  const data = empty();
  ensureDigestivePresets(data);
  const item = data.catalog.find((i) => i.presetKey === "nausea");
  const entry = createIndependentEntries(data, {
    itemIds: [item.id],
    occurredAt: at(0),
    values: { discomfort: 0 },
  })[0];
  return { data, item, entry };
}
test("tous les prédéfinis sont configurables sans première observation, de façon idempotente", () => {
  const data = empty();
  ensureDigestivePresets(data);
  const before = structuredClone(data);
  assert.equal(data.catalog.length, 7);
  assert.equal(data.entries.length, 0);
  ensureDigestivePresets(data);
  assert.deepEqual(data, before);
});
test("renommer un prédéfini ne le recrée ni dans la saisie ni dans les paramètres", () => {
  const { data, item } = fixture();
  updateCatalogItem(data, item.id, { ...item, label: "Ma nausée" });
  ensureDigestivePresets(data);
  assert.equal(data.catalog.length, 7);
  assert.equal(
    getDigestiveSymptomChoices(data).filter((i) => i.presetKey === "nausea")
      .length,
    1,
  );
});
test("un ancien prédéfini déjà utilisé garde son identifiant et ses observations brutes", () => {
  const { data, item } = fixture();
  delete item.presetKey;
  const entries = structuredClone(data.entries);
  const id = item.id;
  ensureDigestivePresets(data);
  assert.equal(item.id, id);
  assert.deepEqual(data.entries, entries);
});
test("douleur et gêne ont la même définition numérique, zéro distinct de vide", () => {
  assert.equal(CRITERIA.pain.type, "scale");
  assert.equal(CRITERIA.discomfort.type, "scale");
  assert.deepEqual(normalizeValues({ pain: 0, discomfort: null }), { pain: 0 });
  for (const value of [-1, 11, 0.5, "0", NaN])
    assert.throws(() => normalizeValues({ discomfort: value }));
});
test("suivi visible avant 48 heures, retiré au seuil sans modifier le stockage", () => {
  const { data } = fixture();
  const before = structuredClone(data);
  assert.equal(getFollowupRows(data, origin + 48 * 3600000 - 1).length, 1);
  assert.equal(getFollowupRows(data, origin + 48 * 3600000).length, 0);
  assert.deepEqual(data, before);
});
test("un constat relance les 48 heures sans créer de nouvel épisode", () => {
  const { data, entry } = fixture();
  const ep = getEpisode(data, entry.id);
  savePresenceCheck(data, entry.id, ep.targetKey, {
    occurredAt: at(47),
    values: {},
  });
  assert.equal(getFollowupRows(data, origin + 49 * 3600000).length, 1);
  assert.equal(getFollowupRows(data, origin + 95 * 3600000).length, 0);
  assert.equal(data.entries.length, 1);
});
test("la clôture manuelle sans heure garde constats, valeurs et durée minimale", () => {
  const { data, entry } = fixture();
  let ep = getEpisode(data, entry.id);
  savePresenceCheck(data, entry.id, ep.targetKey, {
    occurredAt: at(2),
    values: { discomfort: 4 },
  });
  ep = getEpisode(data, entry.id);
  const checks = structuredClone(ep.checks);
  const duration = getMinimumDurationMs(ep);
  finishEpisode(data, entry.id, ep.targetKey, null);
  ep = getEpisode(data, entry.id);
  assert.equal(ep.closedUnknown, true);
  assert.equal(ep.endedAt, undefined);
  assert.deepEqual(ep.checks, checks);
  assert.deepEqual(ep.values, { discomfort: 0 });
  assert.equal(getMinimumDurationMs(ep), duration);
  assert.equal(getFollowupRows(data, origin + 3 * 3600000).length, 0);
  finishEpisode(data, entry.id, ep.targetKey, at(3));
  assert.equal(getEpisode(data, entry.id).endedAt, at(3));
});
test("clôture inconnue et valeurs absentes survivent à un export/import idempotent", () => {
  const { data, entry } = fixture();
  const ep = getEpisode(data, entry.id);
  finishEpisode(data, entry.id, ep.targetKey, null);
  const backup = JSON.stringify(createBackup(data));
  const restored = mergeBackup(empty(), backup).data;
  assert.deepEqual(restored.entries, data.entries);
  assert.deepEqual(mergeBackup(restored, backup).data.entries, data.entries);
  assert.equal(Object.hasOwn(restored.entries[0].values, "pain"), false);
});
test("nouvel épisode clôture le précédent, supprimer le remplaçant ne le rouvre pas", () => {
  const { data, item, entry } = fixture();
  const next = createIndependentEntries(data, {
    itemIds: [item.id],
    occurredAt: at(1),
  })[0];
  deleteEpisode(data, next.id, getEpisode(data, next.id).targetKey);
  assert.equal(getEpisode(data, entry.id).closedUnknown, true);
  assert.equal(getFollowupRows(data, origin + 2 * 3600000).length, 0);
});
test("anciennes zones simultanées : clôture ciblée, autres zones toujours à suivre", () => {
  const data = {
    ...empty(),
    catalog: [
      { id: "a", label: "Genou", family: "rhumatologie", kind: "zone" },
      { id: "b", label: "Épaule", family: "rhumatologie", kind: "zone" },
    ],
    entries: [
      {
        id: "old",
        itemIds: ["a", "b"],
        occurredAt: at(0),
        levels: [2],
        note: "Conduite",
      },
    ],
  };
  const first = getFollowupRows(data, origin + 3600000)[0].episode;
  finishEpisode(data, "old", first.targetKey, null);
  assert.equal(getFollowupRows(data, origin + 3600000).length, 1);
  assert.deepEqual(data.entries[0].itemIds, ["a", "b"]);
  assert.equal(data.entries[0].endedAt, undefined);
});
test("remontées : raccourci du jour seulement, ponctuel donc hors des suivis à clôturer", () => {
  const data = empty();
  ensureDigestivePresets(data);
  const item = data.catalog.find((i) => i.presetKey === "reflux");
  createIndependentEntries(data, { itemIds: [item.id], occurredAt: at(0) });
  createIndependentEntries(data, { itemIds: [item.id], occurredAt: at(1) });
  assert.equal(getTodayOccurrenceRows(data, new Date(at(2))).length, 1);
  assert.equal(getTodayOccurrenceRows(data, new Date(at(24))).length, 0);
  assert.equal(getFollowupRows(data, origin + 2 * 3600000).length, 0);
  assert.equal(data.entries.length, 2);
});

test("le prochain rafraîchissement vise la première expiration ou minuit local", () => {
  const { data } = fixture();
  const now = origin + 48 * 3600000 - 1000;
  assert.equal(nextDailyRefreshAt(data, now), origin + 48 * 3600000);
  const date = new Date(origin);
  date.setHours(24, 0, 0, 0);
  assert.equal(nextDailyRefreshAt(empty(), origin), date.getTime());
});
test("une fin connue reste préservée, et sa correction doit respecter le dernier constat", () => {
  const { data, entry } = fixture();
  const ep = getEpisode(data, entry.id);
  finishEpisode(data, entry.id, ep.targetKey, at(2));
  assert.throws(() => finishEpisode(data, entry.id, ep.targetKey, null));
  assert.equal(getEpisode(data, entry.id).endedAt, at(2));
  assert.throws(() => finishEpisode(data, entry.id, ep.targetKey, at(-1)));
});
