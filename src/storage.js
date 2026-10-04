// Couche de stockage unique de la V4.
// Toute lecture/écriture des données locales passe par ce fichier.

const STORAGE_KEY = 'journalSante.v4';
const SCHEMA_VERSION = 1;

function createEmptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    catalog: [],
    entries: [],
    settings: {
      theme: 'system'
    }
  };
}

export function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createEmptyData();
  }

  try {
    const parsed = JSON.parse(raw);

    // Pour cette première V4, on refuse silencieusement de mélanger
    // un format inconnu avec les données actuelles.
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      console.warn('Version de données inconnue :', parsed.schemaVersion);
      return createEmptyData();
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      catalog: Array.isArray(parsed.catalog) ? parsed.catalog : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      settings: parsed.settings && typeof parsed.settings === 'object'
        ? parsed.settings
        : { theme: 'system' }
    };
  } catch (error) {
    console.error('Impossible de lire les données locales.', error);
    return createEmptyData();
  }
}

export function saveData(data) {
  const safeData = {
    schemaVersion: SCHEMA_VERSION,
    catalog: Array.isArray(data.catalog) ? data.catalog : [],
    entries: Array.isArray(data.entries) ? data.entries : [],
    settings: data.settings && typeof data.settings === 'object'
      ? data.settings
      : { theme: 'system' }
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeData));
}

export function getStorageKey() {
  return STORAGE_KEY;
}
