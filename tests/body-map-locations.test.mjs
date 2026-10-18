import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogItem, updateCatalogItem } from '../src/catalog.js';
import { createEntry, updateEntry } from '../src/entries.js';
import { getBodyMapOptions, getEntrySelections, formatSelectionLabel } from '../src/body-map.js';
import { createBackup, mergeBackup } from '../src/transfer.js';
import { calculateStats } from '../src/stats.js';

const empty = () => ({ schemaVersion: 1, catalog: [], entries: [], settings: {} });
const binding = { regions: ['hand-right', 'hand-left'], surfaces: ['back'] };
const itemInput = { label: 'Ongles', family: 'rhumatologie', kind: 'zone', bodyMap: binding };
const observation = { levels: [2], occurredAt: '2026-10-18T10:00:00.000Z', note: 'note' };

test('un seul élément couvre deux mains et respecte la vue choisie', () => {
  const data = empty();
  const item = createCatalogItem(data, itemInput);
  assert.equal(data.catalog.length, 1);
  for (const side of ['hand-left', 'hand-right']) {
    const options = getBodyMapOptions(data.catalog, side, 'back');
    assert.ok(options.some(option => option.itemId === item.id && option.regionId === side));
    assert.ok(!getBodyMapOptions(data.catalog, side, 'front').some(option => option.itemId === item.id));
  }
  assert.ok(!getBodyMapOptions(data.catalog, 'foot-right', 'back').some(option => option.itemId === item.id));
});

test('une observation garde chaque côté; historique et statistiques les distinguent', () => {
  const data = empty();
  const item = createCatalogItem(data, itemInput);
  const entry = createEntry(data, { ...observation, itemIds: [item.id],
    itemLocations: { [item.id]: ['hand-right', 'hand-left'] } });
  assert.deepEqual(getEntrySelections(entry).map(choice => formatSelectionLabel(item, choice.regionId)),
    ['Ongles — Main gauche', 'Ongles — Main droite']);
  const stats = calculateStats(data);
  assert.equal(stats.totalEntries, 1);
  assert.equal(stats.topItems.length, 2);
  assert.ok(stats.topItems.every(row => row.count === 1));
  updateEntry(data, entry.id, { ...observation, itemIds: [item.id],
    itemLocations: { [item.id]: ['hand-left'] } });
  assert.deepEqual(entry.itemLocations, { [item.id]: ['hand-left'] });
});

test('rattacher un ancien élément ne donne pas de côté à ses anciennes observations', () => {
  const data = empty();
  const item = createCatalogItem(data, { ...itemInput, bodyMap: null });
  const entry = createEntry(data, { ...observation, itemIds: [item.id] });
  const before = structuredClone(entry);
  updateCatalogItem(data, item.id, itemInput);
  assert.deepEqual(entry, before);
  assert.deepEqual(getEntrySelections(entry), [{ itemId: item.id, regionId: '' }]);
  assert.equal(calculateStats(data).topItems[0].item.label, 'Ongles');
});

test('déplacer ou retirer un rattachement ne change pas les côtés déjà observés', () => {
  const data = empty();
  const item = createCatalogItem(data, itemInput);
  const entry = createEntry(data, { ...observation, itemIds: [item.id], itemLocations: { [item.id]: ['hand-right'] } });
  const before = structuredClone(entry);
  updateCatalogItem(data, item.id, { ...itemInput, bodyMap: { regions: ['foot-left'], surfaces: ['front'] } });
  assert.deepEqual(entry, before);
  assert.equal(calculateStats(data).topItems[0].item.label, 'Ongles — Main droite');
  updateCatalogItem(data, item.id, { ...itemInput, bodyMap: null });
  assert.equal(item.bodyMap, undefined);
  assert.deepEqual(entry, before);
});

test('un rattachement invalide ou une localisation invalide est refusé sans mutation', () => {
  const data = empty();
  assert.throws(() => createCatalogItem(data, { ...itemInput, bodyMap: { regions: [], surfaces: ['back'] } }));
  assert.equal(data.catalog.length, 0);
  const item = createCatalogItem(data, itemInput);
  const before = structuredClone(data);
  assert.throws(() => updateCatalogItem(data, item.id, { ...itemInput, bodyMap: { ...binding, surfaces: [] } }));
  assert.throws(() => createEntry(data, { ...observation, itemIds: [item.id], itemLocations: { [item.id]: ['unknown'] } }));
  assert.deepEqual(data, before);
});

test('export/import conserve rattachements et côtés, même avec une collision d’identifiants', () => {
  const source = empty();
  const item = createCatalogItem(source, itemInput);
  createEntry(source, { ...observation, itemIds: [item.id], itemLocations: { [item.id]: ['hand-right'] } });
  const backup = createBackup(source);
  assert.deepEqual(mergeBackup(empty(), backup).data, source);
  const current = empty();
  current.catalog.push({ id: item.id, label: 'Autre zone', family: 'rhumatologie', kind: 'zone' });
  const merged = mergeBackup(current, backup).data;
  const imported = merged.catalog.find(row => row.label === 'Ongles');
  assert.notEqual(imported.id, item.id);
  assert.deepEqual(merged.entries[0].itemIds, [imported.id]);
  assert.deepEqual(merged.entries[0].itemLocations, { [imported.id]: ['hand-right'] });
  const twice = mergeBackup(merged, backup);
  assert.equal(twice.entriesAdded, 0);
  assert.equal(twice.catalogAdded, 0);
  assert.deepEqual(twice.data, merged);
});

test('réimporter la V3 après rattachement au bonhomme ne crée aucun doublon', () => {
  const legacy = [{ date: '2026-10-01T10:00:00.000Z', zones: ['Ongles'], level: '😕 Gênante', note: 'ancienne note' }];
  const imported = mergeBackup(empty(), legacy).data;
  const id = imported.catalog[0].id;
  updateCatalogItem(imported, id, itemInput);
  const merged = mergeBackup(imported, legacy);
  assert.equal(merged.catalogAdded, 0);
  assert.equal(merged.entriesAdded, 0);
  assert.deepEqual(merged.data, imported);
});
