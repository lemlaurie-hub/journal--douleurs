import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, mergeBackup, parseBackup } from '../src/transfer.js';

const catalogItem = {
  id: 'item-elbow', label: 'Coude droit', family: 'rhumatologie', kind: 'zone',
  createdAt: '2026-09-12T08:00:00.000Z'
};
const entry = {
  id: 'entry-one', itemIds: ['item-elbow'], levels: [2, 3],
  occurredAt: '2026-09-12T21:47:00.000Z', ongoing: true,
  note: 'Douleur après le repas, réveil nocturne.',
  createdAt: '2026-09-12T21:48:02.123Z'
};
const emptyData = () => ({ schemaVersion: 1, catalog: [], entries: [], settings: { theme: 'system' } });

test('exporte et réimporte les données sans altérer les dates, heures et notes', () => {
  const original = { schemaVersion: 1, catalog: [catalogItem], entries: [entry], settings: { theme: 'dark' } };
  const backup = createBackup(original, '2026-10-04T18:00:00.000Z');
  assert.equal(backup.exportedAt, '2026-10-04T18:00:00.000Z');

  const parsed = parseBackup(JSON.stringify(backup));
  assert.deepEqual(parsed.data, original);
  const imported = mergeBackup(emptyData(), backup).data;
  assert.deepEqual(imported.catalog, original.catalog);
  assert.deepEqual(imported.entries, original.entries);
  // Les préférences locales initiales restent prioritaires sur celles du fichier.
  assert.equal(imported.settings.theme, 'system');
});

test('réimporter le même fichier n’ajoute aucun doublon', () => {
  const backup = createBackup({
    schemaVersion: 1, catalog: [catalogItem], entries: [entry], settings: { theme: 'system' }
  });
  const once = mergeBackup(emptyData(), backup);
  const twice = mergeBackup(once.data, backup);
  assert.equal(once.catalogAdded, 1);
  assert.equal(once.entriesAdded, 1);
  assert.equal(twice.catalogAdded, 0);
  assert.equal(twice.entriesAdded, 0);
  assert.equal(twice.data.catalog.length, 1);
  assert.equal(twice.data.entries.length, 1);
});

test('fusionne avec les données déjà présentes sans les remplacer ni les effacer', () => {
  const existingEntry = { ...entry, id: 'local-entry', note: 'Note saisie dans V4' };
  const current = {
    schemaVersion: 1,
    catalog: [catalogItem],
    entries: [existingEntry],
    settings: { theme: 'dark', keep: true }
  };
  const incoming = createBackup({
    schemaVersion: 1,
    catalog: [catalogItem, { ...catalogItem, id: 'item-new', label: 'Genou gauche' }],
    entries: [entry],
    settings: { theme: 'light', importedSetting: true }
  });
  const result = mergeBackup(current, incoming);

  assert.equal(result.catalogAdded, 1);
  assert.equal(result.entriesAdded, 1);
  assert.equal(result.data.entries.length, 2);
  assert.ok(result.data.entries.some(row => row.note === existingEntry.note));
  assert.ok(result.data.entries.some(row => row.note === entry.note));
  assert.deepEqual(result.data.settings, { theme: 'dark', keep: true, importedSetting: true });
});

test('un identifiant en collision ne remplace pas une entrée existante', () => {
  const collision = { ...entry, note: 'Une autre entrée locale.' };
  const current = { schemaVersion: 1, catalog: [catalogItem], entries: [collision], settings: {} };
  const incoming = createBackup({
    schemaVersion: 1, catalog: [catalogItem], entries: [entry], settings: {}
  });
  const first = mergeBackup(current, incoming);
  const second = mergeBackup(first.data, incoming);
  assert.equal(first.entriesAdded, 1);
  assert.equal(first.data.entries.length, 2);
  assert.equal(second.entriesAdded, 0);
  assert.equal(second.data.entries.length, 2);
  assert.ok(second.data.entries.some(row => row.note === collision.note));
  assert.ok(second.data.entries.some(row => row.note === entry.note));
});

test('refuse un fichier invalide sans toucher aux données courantes', () => {
  const current = emptyData();
  assert.throws(() => mergeBackup(current, '{incomplet'), SyntaxError);
  assert.throws(() => mergeBackup(current, { format: 'journal-sante', formatVersion: 99, data: {} }), /Version de sauvegarde/);
  assert.throws(() => mergeBackup(current, { version: 3, historique: [] }), /Format de fichier non reconnu/);
  assert.deepEqual(current, emptyData());
});

test('importe le format V3 réel en conservant dates, niveaux, notes et événements identiques', () => {
  const legacyEntry = {
    date: '2026-08-12T21:47:00.000Z',
    zones: ['Migraine', 'Œil droit'],
    level: '😣 Limitante',
    note: '  Lumière gênante.\nAprès conduite.  '
  };
  const legacy = [legacyEntry, structuredClone(legacyEntry)];
  const first = mergeBackup(emptyData(), JSON.stringify(legacy));

  assert.equal(first.catalogAdded, 2);
  assert.equal(first.entriesAdded, 2);
  assert.equal(first.data.entries.length, 2);
  assert.deepEqual(first.data.entries[0], {
    id: first.data.entries[0].id,
    itemIds: first.data.catalog.map(item => item.id),
    levels: [3],
    occurredAt: legacyEntry.date,
    note: legacyEntry.note
  });

  const second = mergeBackup(first.data, JSON.stringify(legacy));
  assert.equal(second.catalogAdded, 0);
  assert.equal(second.entriesAdded, 0);
  assert.equal(second.data.entries.length, 2);

  const v4RoundTrip = mergeBackup(emptyData(), createBackup(first.data)).data;
  assert.deepEqual(v4RoundTrip.entries, first.data.entries);
  assert.equal(v4RoundTrip.entries[0].occurredAt, legacyEntry.date);
  assert.equal(v4RoundTrip.entries[0].note, legacyEntry.note);
});

test('importe aussi l’ancienne propriété V3 `zone` et refuse les données ambiguës sans fusion partielle', () => {
  const legacySingleZone = [{
    date: '2026-01-02T03:04:05.000Z',
    zone: 'Nuque',
    level: '🙂 Supportable',
    note: ''
  }];
  const imported = mergeBackup(emptyData(), legacySingleZone);
  assert.equal(imported.data.catalog[0].label, 'Nuque');
  assert.equal(imported.data.entries[0].occurredAt, legacySingleZone[0].date);
  assert.deepEqual(imported.data.entries[0].levels, [1]);

  const current = emptyData();
  assert.throws(() => mergeBackup(current, [
    legacySingleZone[0],
    { ...legacySingleZone[0], level: 'Niveau inconnu' }
  ]), /niveau de gêne non reconnu/);
  assert.deepEqual(current, emptyData());
});

test('convertit les quatre niveaux V3 et importe aussi les lignes au-delà des 50 affichées', () => {
  const labels = ['🙂 Supportable', '😕 Gênante', '😣 Limitante', '😭 Invalidante'];
  const legacy = Array.from({ length: 60 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    zones: [`Zone ${index}`],
    level: labels[index % labels.length],
    note: `Note ${index}`
  }));
  const result = mergeBackup(emptyData(), legacy);

  assert.equal(result.entriesAdded, 60);
  assert.equal(result.data.entries.length, 60);
  assert.deepEqual(result.data.entries.slice(0, 4).map(row => row.levels[0]), [1, 2, 3, 4]);
});

test('reste idempotent si un identifiant V3 entre en collision avec une donnée locale', () => {
  const legacy = [{
    date: '2026-03-04T05:06:07.000Z',
    zones: ['Nuque'],
    level: '😕 Gênante',
    note: 'Historique V3'
  }];
  const generatedId = mergeBackup(emptyData(), legacy).data.entries[0].id;
  const localEntry = {
    ...mergeBackup(emptyData(), legacy).data.entries[0],
    id: generatedId,
    note: 'Observation locale différente'
  };
  const current = {
    schemaVersion: 1,
    catalog: [{ id: 'local-nuque', label: 'Nuque', family: 'rhumatologie', kind: 'zone' }],
    entries: [localEntry],
    settings: { theme: 'dark' }
  };

  const first = mergeBackup(current, legacy);
  const second = mergeBackup(first.data, legacy);
  assert.equal(first.entriesAdded, 1);
  assert.equal(first.data.entries.length, 2);
  assert.equal(second.entriesAdded, 0);
  assert.equal(second.data.entries.length, 2);
  assert.ok(second.data.entries.some(row => row.note === 'Observation locale différente'));
  assert.ok(second.data.entries.some(row => row.note === 'Historique V3'));
});
