import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_MAP_REGIONS, getBodyMapDetails } from '../src/body-map.js';

test('la carte propose des précisions différentes selon la face du corps', () => {
  assert.deepEqual(getBodyMapDetails('trunk', 'front'), [
    'Côtes droites', 'Côtes gauches', 'Sternum', 'Ventre'
  ]);
  assert.deepEqual(getBodyMapDetails('trunk', 'back'), [
    'Haut du dos', 'Milieu du dos', 'Lombaires', 'Sacrum'
  ]);
  assert.notDeepEqual(getBodyMapDetails('trunk', 'front'), getBodyMapDetails('trunk', 'back'));
});

test('la cuisse et le pied distinguent leurs surfaces avant et arrière', () => {
  assert.ok(getBodyMapDetails('leg-right', 'front').includes('Avant de la cuisse droite'));
  assert.ok(getBodyMapDetails('leg-right', 'back').includes('Arrière de la cuisse droite'));
  assert.ok(getBodyMapDetails('foot-left', 'front').includes('Dessus du pied gauche'));
  assert.ok(getBodyMapDetails('foot-left', 'back').includes('Plante du pied gauche'));
  assert.ok(getBodyMapDetails('foot-left', 'front').includes('Pied gauche — ensemble'));
  assert.ok(getBodyMapDetails('foot-left', 'back').includes('Pied gauche — ensemble'));
});

test('toutes les zones principales ont des précisions des deux côtés', () => {
  assert.ok(Object.keys(BODY_MAP_REGIONS).length >= 12);
  for (const [regionId, region] of Object.entries(BODY_MAP_REGIONS)) {
    assert.ok(region.front.length > 0, `${regionId} doit avoir des zones avant`);
    assert.ok(region.back.length > 0, `${regionId} doit avoir des zones arrière`);
  }
  assert.deepEqual(getBodyMapDetails('unknown', 'front'), []);
});
