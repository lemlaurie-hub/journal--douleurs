import test from 'node:test';
import assert from 'node:assert/strict';
import { finishEntry, getMinimumDurationMs, recordStillPresent, updateEntry } from '../src/entries.js';
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

test('une fin explicite est horodatée et clôt le compteur sans supprimer les constats', () => {
  const data = makeData();
  recordStillPresent(data, 'episode-1', '2026-10-18T12:00:00.000Z');
  finishEntry(data, 'episode-1', '2026-10-18T13:10:00.000Z');

  assert.equal(data.entries[0].endedAt, '2026-10-18T13:10:00.000Z');
  assert.deepEqual(data.entries[0].stillAt, ['2026-10-18T12:00:00.000Z']);
  assert.equal(getMinimumDurationMs(data.entries[0]), 5 * 60 * 60 * 1000 + 10 * 60 * 1000);
  assert.equal(calculateStats(data).ongoingEntries, 0);
  assert.throws(() => recordStillPresent(data, 'episode-1', '2026-10-18T14:00:00.000Z'), /fin a déjà été indiquée/i);
  assert.throws(() => finishEntry(data, 'episode-1', '2026-10-18T14:00:00.000Z'), /fin a déjà été indiquée/i);
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
