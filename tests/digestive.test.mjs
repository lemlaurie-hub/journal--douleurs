import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyDigestive, normalizeBristol, saveTransit, getDigestive,
  saveCondition, confirmNoPassage, clearNoPassage, getTransitDay,
  deleteTransit, mergeDigestive, localDate,
} from "../src/digestive.js";
import { createBackup, mergeBackup, parseBackup } from "../src/transfer.js";
import { saveData, loadData, getStorageKey } from "../src/storage.js";

const fresh = () => ({ schemaVersion: 1, catalog: [], entries: [], settings: {} });
const passage = (types = [4], extra = {}) => ({
  kind: "passage", occurredAt: "2026-01-02T10:30:12.123Z",
  bristol: { types, mode: "distinct" }, pain: 0, note: "Conduite", conditionIds: [], ...extra,
});

test("les sept types Bristol sont acceptés, absence et types hors échelle refusés sans mutation", () => {
  for (let n = 1; n <= 7; n++) assert.deepEqual(normalizeBristol({ types: [n] }), { types: [n], mode: "simple" });
  for (const types of [[], [0], [8], [1, 1], [1, 2, 3], ["4"]]) {
    const data = fresh();
    assert.throws(() => saveTransit(data, passage(types)));
    assert.deepEqual(data, fresh());
  }
});

test("toutes les paires distinctes sont possibles, seuls les voisins sont intermédiaires", () => {
  for (let a = 1; a <= 7; a++) for (let b = a + 1; b <= 7; b++) {
    assert.deepEqual(normalizeBristol({ types: [b, a], mode: "distinct" }).types, [a, b]);
    if (b - a === 1) assert.equal(normalizeBristol({ types: [a, b], mode: "intermediate" }).mode, "intermediate");
    else assert.throws(() => normalizeBristol({ types: [a, b], mode: "intermediate" }));
    assert.throws(() => normalizeBristol({ types: [a, b] }));
  }
});

test("un passage double reste un passage, une douleur ponctuelle ne crée aucun épisode", () => {
  const data = fresh();
  saveTransit(data, passage([3, 4], { bristol: { types: [3, 4], mode: "intermediate" }, pain: 7 }));
  assert.equal(data.digestive.events.length, 1);
  assert.equal(getTransitDay(data, "2026-01-02").passages, 1);
  assert.deepEqual(data.entries, []);
});

test("accident et aucun passage coexistent mais ne constituent pas une journée sans selles", () => {
  const data = fresh();
  confirmNoPassage(data, "2026-01-02");
  assert.equal(getTransitDay(data, "2026-01-02").noStool, true);
  saveTransit(data, passage([7], { kind: "accident" }));
  assert.deepEqual(getTransitDay(data, "2026-01-02"), { passages: 0, accidents: 1, noPassage: true, noStool: false, unknown: false });
  assert.equal(data.digestive.events[0].pain, null);
});

test("un passage corrige la déclaration d’absence ; le supprimer ne recrée pas cette déclaration", () => {
  const data = fresh();
  confirmNoPassage(data, "2026-01-02");
  const e = saveTransit(data, passage());
  assert.equal(data.digestive.days.length, 0);
  assert.throws(() => confirmNoPassage(data, "2026-01-02"));
  deleteTransit(data, e.id);
  assert.equal(getTransitDay(data, "2026-01-02").unknown, true);
});

test("confirmation idempotente et annulable, journées invalides et futures refusées", () => {
  const data = fresh();
  for (const date of ["2026-02-30", "2026-13-01", "2099-01-01", ""]) assert.throws(() => confirmNoPassage(data, date));
  confirmNoPassage(data, "2026-01-02");
  confirmNoPassage(data, "2026-01-02");
  assert.equal(data.digestive.days.length, 1);
  clearNoPassage(data, "2026-01-02");
  assert.equal(getTransitDay(data, "2026-01-02").unknown, true);
});

test("renommage et désactivation conservent les observations historiques, y compris après édition", () => {
  const data = fresh();
  const c = saveCondition(data, { label: "Avant" });
  const e = saveTransit(data, passage([4], { conditionIds: [c.id] }));
  saveCondition(data, { label: "Après", active: false }, c.id);
  saveTransit(data, passage([4], { conditionIds: [c.id], note: "Correction" }), e.id);
  assert.equal(data.digestive.events[0].conditions[0].label, "Avant");
  assert.throws(() => saveTransit(data, passage([4], { conditionIds: [c.id] })));
  saveCondition(data, { label: "Après", active: true }, c.id);
  const next = saveTransit(data, passage([4], { conditionIds: [c.id] }));
  assert.equal(next.conditions[0].label, "Après");
});

test("édition ciblée conserve identité, création et secondes ; refus atomique d’une douleur invalide", () => {
  const data = fresh();
  const e = saveTransit(data, passage());
  const before = structuredClone(data);
  assert.throws(() => saveTransit(data, passage([4], { pain: 11 }), e.id));
  assert.deepEqual(data, before);
  const corrected = saveTransit(data, passage([6], { pain: 5 }), e.id);
  assert.equal(corrected.id, e.id);
  assert.equal(corrected.createdAt, e.createdAt);
  assert.equal(corrected.occurredAt, e.occurredAt);
});

test("export/import complet du transit et ancien V4, fusion répétée sans doublon", () => {
  const data = fresh();
  saveTransit(data, passage([1, 7]));
  confirmNoPassage(data, "2026-01-03");
  assert.deepEqual(parseBackup(createBackup(data)).data, data);
  const merged = mergeBackup(fresh(), createBackup(data));
  assert.deepEqual(merged.data.digestive, data.digestive);
  assert.equal(merged.digestiveAdded, 1);
  const second = mergeBackup(merged.data, createBackup(data));
  assert.deepEqual(second.data, merged.data);
  const old = { format: "journal-sante", formatVersion: 1, data: fresh() };
  assert.deepEqual(mergeBackup(data, old).data, data);
});

test("conflits d’identifiants préservent les deux contenus et restent idempotents", () => {
  const data = fresh();
  saveTransit(data, passage([4], { conditionIds: ["urgency"] }));
  const incoming = structuredClone(data.digestive);
  incoming.conditions.find((c) => c.id === "urgency").label = "Urgence renommée";
  incoming.events[0].note = "Autre version";
  incoming.events[0].conditions[0].label = "Urgence renommée";
  const merged = mergeDigestive(data.digestive, incoming);
  assert.equal(merged.events.length, 2);
  assert.equal(merged.conditions.length, 5);
  const remapped = merged.events.find((e) => e.note === "Autre version");
  assert.notEqual(remapped.conditions[0].id, "urgency");
  assert.deepEqual(mergeDigestive(merged, incoming), merged);
});

test("sauvegarde digestive malformée refusée sans toucher l’historique courant", () => {
  const data = fresh();
  const backup = createBackup({ ...fresh(), digestive: emptyDigestive() });
  backup.data.digestive.events.push({ id: "invalid" });
  assert.throws(() => mergeBackup(data, backup));
  assert.deepEqual(data, fresh());
});

test("stockage conserve transit et champs inconnus, migration additive sans modifier entries", () => {
  const values = new Map();
  globalThis.localStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const data = { ...fresh(), extension: { preserved: true } };
  saveTransit(data, passage());
  saveData(data);
  const loaded = loadData();
  assert.deepEqual(loaded, data);
  assert.deepEqual(getDigestive(fresh()), emptyDigestive());
  assert.equal(fresh().digestive, undefined);
  values.set(getStorageKey(), JSON.stringify({ schemaVersion: 999, entries: [{ id: "precious" }] }));
  const original = values.get(getStorageKey());
  loadData();
  assert.throws(() => saveData(fresh()), /bloqué/);
  assert.equal(values.get(getStorageKey()), original);
  values.delete(getStorageKey());
  loadData();
});

test("la date civile suit l’heure locale et non la tranche UTC", () => {
  const previous = process.env.TZ;
  process.env.TZ = "Europe/Paris";
  try { assert.equal(localDate("2026-01-02T23:30:00Z"), "2026-01-03"); }
  finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test("un stockage malformé ou inaccessible ne peut pas être remplacé par une base vide", () => {
  const source = JSON.stringify({ schemaVersion: 1, catalog: "illisible", entries: [{ id: "à préserver" }] });
  let stored = source;
  globalThis.localStorage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  loadData();
  assert.throws(() => saveData(fresh()), /bloqué/);
  assert.equal(stored, source);
  globalThis.localStorage.getItem = () => { throw new Error("Accès refusé"); };
  assert.deepEqual(loadData().entries, []);
  assert.throws(() => saveData(fresh()), /bloqué/);
  globalThis.localStorage.getItem = () => null;
  loadData();
});

test("un mode Bristol incohérent et des confirmations répétées sont refusés à l’import", () => {
  const data = fresh();
  saveTransit(data, passage());
  const backup = createBackup(data);
  backup.data.digestive.events[0].bristol.mode = "intermediate";
  assert.throws(() => parseBackup(backup));
  confirmNoPassage(data, "2026-01-03");
  const repeated = createBackup(data);
  repeated.data.digestive.days.push({ ...repeated.data.digestive.days[0], id: "another" });
  assert.throws(() => parseBackup(repeated));
});
