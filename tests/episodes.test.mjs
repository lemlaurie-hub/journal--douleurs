import test from 'node:test';
import assert from 'node:assert/strict';
import { addPastPresence, finishEntry, getMinimumDurationMs, recordStillPresent, updateEntry, updateEntryEnd } from '../src/entries.js';
import { calculateStats } from '../src/stats.js';

function makeData(overrides = {}) {
  return {
    catalog: [{ id: 'shoulder', label: 'Épaule gauche', family: 'rhumatologie', kind: 'zone' }],
    entries: [{
      id: 'episode-1', itemIds: ['shoulder'], levels: [2],
      occurredAt: '2026-10-18T08:00:00.000Z', ongoing: true,
      stillAt: [], note: 'Au réveil'
    }],
    ...overrides
  };
}

test('chaque constat ajoute son heure sans créer une nouvelle observation', () => {
  const data = makeData();
  const first = data.entries[0];

  recordStillPresent(data, first.id, '2026-10-18T12:30:00.000Z');
  recordStillPresent(data, first.id, '2026-10-18T18:15:00.000Z');

  assert.equal(data.entries.length, 1);
  assert.equal(data.entries[0], first);
  assert.deepEqual(first.stillAt, [
    '2026-10-18T12:30:00.000Z',
    '2026-10-18T18:15:00.000Z'
  ]);
  assert.equal(first.occurredAt, '2026-10-18T08:00:00.000Z');
  assert.equal(first.note, 'Au réveil');
  assert.equal(getMinimumDurationMs(first), 10 * 60 * 60 * 1000 + 15 * 60 * 1000);
});

test('un clic sans heure fournie enregistre immédiatement son propre horodatage', () => {
  const data = makeData();
  const beforeClick = Date.now();
  recordStillPresent(data, 'episode-1');
  const afterClick = Date.now();
  const savedAt = Date.parse(data.entries[0].stillAt[0]);

  assert.ok(savedAt >= beforeClick && savedAt <= afterClick);
});

test('un constat passé ajouté à un épisode terminé recalcule la durée minimale sans changer le début ni la fin', () => {
  const data = makeData({ entries: [{
    id: 'episode-1', itemIds: ['shoulder'], levels: [2],
    occurredAt: '2026-10-06T16:44:00.000Z', ongoing: true,
    stillAt: [], endedAt: '2026-10-07T04:30:00.000Z', note: 'Partie au réveil'
  }] });

  addPastPresence(data, 'episode-1', '2026-10-06T20:30:00.000Z');
  addPastPresence(data, 'episode-1', '2026-10-06T20:30:00.000Z');

  assert.equal(data.entries.length, 1);
  assert.equal(data.entries[0].occurredAt, '2026-10-06T16:44:00.000Z');
  assert.equal(data.entries[0].endedAt, '2026-10-07T04:30:00.000Z');
  assert.equal(data.entries[0].note, 'Partie au réveil');
  assert.deepEqual(data.entries[0].stillAt, ['2026-10-06T20:30:00.000Z']);
  assert.equal(getMinimumDurationMs(data.entries[0]), 3 * 60 * 60_000 + 46 * 60_000);
});

test('un constat antidaté s’insère dans l’ordre sans retirer les constats plus récents', () => {
  const data = makeData({ entries: [{
    id: 'episode-1', itemIds: ['shoulder'], levels: [2],
    occurredAt: '2026-10-06T16:44:00.000Z', ongoing: true,
    stillAt: ['2026-10-06T21:00:00.000Z'], endedAt: '2026-10-07T04:30:00.000Z', note: ''
  }] });

  addPastPresence(data, 'episode-1', '2026-10-06T20:30:00.000Z');

  assert.deepEqual(data.entries[0].stillAt, [
    '2026-10-06T20:30:00.000Z',
    '2026-10-06T21:00:00.000Z'
  ]);
  assert.equal(getMinimumDurationMs(data.entries[0]), 4 * 60 * 60_000 + 16 * 60_000);
});

test('un constat passé doit être après le début et avant la fin, sans mutation en cas de refus', () => {
  const data = makeData({ entries: [{
    id: 'episode-1', itemIds: ['shoulder'], levels: [2],
    occurredAt: '2026-10-06T16:44:00.000Z', ongoing: true,
    stillAt: [], endedAt: '2026-10-07T04:30:00.000Z', note: 'Partie au réveil'
  }] });
  const before = structuredClone(data.entries[0]);

  assert.throws(() => addPastPresence(data, 'episode-1', '2026-10-06T16:44:00.000Z'), /après la première observation/i);
  assert.deepEqual(data.entries[0], before);
  assert.throws(() => addPastPresence(data, 'episode-1', '2026-10-07T04:30:00.000Z'), /doit précéder l’heure de fin/i);
  assert.deepEqual(data.entries[0], before);
});

test('la fin constatée ne remplace pas le dernier constat de présence pour la durée minimale', () => {
  const data = makeData();
  recordStillPresent(data, 'episode-1', '2026-10-18T12:00:00.000Z');
  finishEntry(data, 'episode-1', '2026-10-18T13:10:00.000Z');

  assert.equal(data.entries[0].endedAt, '2026-10-18T13:10:00.000Z');
  assert.deepEqual(data.entries[0].stillAt, ['2026-10-18T12:00:00.000Z']);
  assert.equal(getMinimumDurationMs(data.entries[0]), 4 * 60 * 60 * 1000);
  assert.equal(calculateStats(data).ongoingEntries, 0);
  assert.throws(() => recordStillPresent(data, 'episode-1', '2026-10-18T14:00:00.000Z'), /fin a déjà été indiquée/i);
  assert.throws(() => finishEntry(data, 'episode-1', '2026-10-18T14:00:00.000Z'), /fin a déjà été indiquée/i);
});

test('une fin constatée peut être antidatée après le dernier moment où la présence est confirmée', () => {
  const data = makeData({ entries: [{
    id: 'episode-1', itemIds: ['shoulder'], levels: [2],
    occurredAt: '2026-10-06T16:44:00.000Z', ongoing: true,
    stillAt: ['2026-10-06T20:00:00.000Z'], note: 'Disparu au réveil'
  }] });

  finishEntry(data, 'episode-1', '2026-10-07T06:30:00.000Z');

  assert.equal(data.entries[0].endedAt, '2026-10-07T06:30:00.000Z');
  assert.equal(getMinimumDurationMs(data.entries[0]), 3 * 60 * 60 * 1000 + 16 * 60 * 1000);
  assert.equal(calculateStats(data).ongoingEntries, 0);
});

test('sans constat ultérieur, l’heure de fin ne fabrique pas une durée minimale', () => {
  const data = makeData({ entries: [{
    id: 'episode-1', itemIds: ['shoulder'], levels: [2],
    occurredAt: '2026-10-06T16:44:00.000Z', ongoing: true,
    stillAt: [], note: 'Disparu le lendemain'
  }] });

  finishEntry(data, 'episode-1', '2026-10-07T06:30:00.000Z');

  assert.equal(getMinimumDurationMs(data.entries[0]), null);
});

test('corriger une fin déjà enregistrée ne modifie que son horodatage', () => {
  const data = makeData({ entries: [{
    id: 'episode-1', itemIds: ['shoulder'], levels: [2],
    occurredAt: '2026-10-06T16:44:00.000Z', ongoing: true,
    stillAt: ['2026-10-06T20:00:00.000Z'],
    endedAt: '2026-10-18T17:15:00.000Z', note: 'Disparu au réveil'
  }] });

  updateEntryEnd(data, 'episode-1', '2026-10-07T06:30:00.000Z');

  assert.equal(data.entries[0].endedAt, '2026-10-07T06:30:00.000Z');
  assert.equal(data.entries[0].note, 'Disparu au réveil');
  assert.deepEqual(data.entries[0].stillAt, ['2026-10-06T20:00:00.000Z']);
  assert.equal(getMinimumDurationMs(data.entries[0]), 3 * 60 * 60 * 1000 + 16 * 60 * 1000);

  const beforeInvalidEdit = structuredClone(data.entries[0]);
  assert.throws(() => updateEntryEnd(data, 'episode-1', '2026-10-06T19:00:00.000Z'), /fin ne peut pas précéder/i);
  assert.deepEqual(data.entries[0], beforeInvalidEdit);
});

test('les anciennes données restent valides et aucune fin ou durée n’est inventée', () => {
  const data = makeData({ entries: [{
    id: 'legacy', itemIds: ['shoulder'], occurredAt: '2026-10-06T16:00:00.000Z',
    ongoing: true, note: 'Ancien signalement'
  }] });

  assert.equal(getMinimumDurationMs(data.entries[0]), null);
  assert.equal(data.entries[0].endedAt, undefined);
  assert.equal(calculateStats(data).ongoingEntries, 1);
  recordStillPresent(data, 'legacy', '2026-10-18T12:00:00.000Z');
  assert.equal(getMinimumDurationMs(data.entries[0]), 11 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000);
  assert.equal(data.entries[0].endedAt, undefined);
});

test('un constat antérieur ou une fin antérieure au dernier constat ne modifie pas les données', () => {
  const data = makeData();
  recordStillPresent(data, 'episode-1', '2026-10-18T12:00:00.000Z');
  const before = structuredClone(data.entries[0]);

  assert.throws(() => recordStillPresent(data, 'episode-1', '2026-10-18T11:00:00.000Z'), /ne peut pas précéder/i);
  assert.deepEqual(data.entries[0], before);
  assert.throws(() => finishEntry(data, 'episode-1', '2026-10-18T11:00:00.000Z'), /fin ne peut pas précéder/i);
  assert.deepEqual(data.entries[0], before);
});

test('modifier une observation conserve son suivi; déplacer le premier constat au-delà rejette la correction', () => {
  const data = makeData();
  recordStillPresent(data, 'episode-1', '2026-10-18T12:00:00.000Z');
  const original = structuredClone(data.entries[0]);

  updateEntry(data, 'episode-1', {
    itemIds: ['shoulder'], levels: [2], occurredAt: original.occurredAt,
    ongoing: true, note: 'Après le réveil'
  });
  assert.deepEqual(data.entries[0].stillAt, original.stillAt);
  assert.equal(data.entries[0].note, 'Après le réveil');

  const beforeInvalidEdit = structuredClone(data.entries[0]);
  assert.throws(() => updateEntry(data, 'episode-1', {
    itemIds: ['shoulder'], levels: [2], occurredAt: '2026-10-18T13:00:00.000Z',
    ongoing: true, note: 'Changement invalide'
  }), /constats doivent suivre/i);
  assert.deepEqual(data.entries[0], beforeInvalidEdit);
});
