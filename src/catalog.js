// Gestion centralisée du catalogue d'éléments de suivi.
// Une seule fonction crée un élément, quel que soit l'écran qui l'appelle.

const ALLOWED_FAMILIES = ['rhumatologie', 'digestif', 'neurologique', 'general', 'autre'];
const ALLOWED_KINDS = ['zone', 'symptome', 'evenement'];

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createCatalogItem(data, input) {
  const label = String(input.label || '').trim();
  const family = String(input.family || '').trim();
  const kind = String(input.kind || '').trim();

  if (!label) {
    throw new Error('Le nom de l’élément est obligatoire.');
  }

  if (!ALLOWED_FAMILIES.includes(family)) {
    throw new Error('La famille choisie n’est pas valide.');
  }

  if (!ALLOWED_KINDS.includes(kind)) {
    throw new Error('Le type choisi n’est pas valide.');
  }

  const duplicate = data.catalog.some(
    item => item.label.toLocaleLowerCase('fr') === label.toLocaleLowerCase('fr')
      && item.family === family
      && item.kind === kind
  );

  if (duplicate) {
    throw new Error('Cet élément existe déjà dans cette catégorie.');
  }

  const item = {
    id: createId('item'),
    label,
    family,
    kind,
    createdAt: new Date().toISOString()
  };

  data.catalog.push(item);
  return item;
}

export function getCatalogItem(data, itemId) {
  return data.catalog.find(item => item.id === itemId) || null;
}

export function getCatalogByFamily(data) {
  return data.catalog.reduce((groups, item) => {
    if (!groups[item.family]) {
      groups[item.family] = [];
    }

    groups[item.family].push(item);
    return groups;
  }, {});
}

export function getFamilyLabel(family) {
  const labels = {
    rhumatologie: 'Rhumatologie',
    digestif: 'Digestif',
    neurologique: 'Neurologique',
    general: 'Général',
    autre: 'Autre'
  };

  return labels[family] || 'Autre';
}

export function getKindLabel(kind) {
  const labels = {
    zone: 'Zone',
    symptome: 'Symptôme',
    evenement: 'Événement'
  };

  return labels[kind] || 'Élément';
}
