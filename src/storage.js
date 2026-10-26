import { reclassifyKnownV3Items } from "./catalog.js";
import { validateDigestive } from "./digestive.js";

// Couche de stockage unique de la V4.
// Toute lecture/écriture des données locales passe par ce fichier.

// La clé V4 reste distincte de la V3 : lire ou enregistrer ici ne modifie pas
// la base historique de l'ancienne application.
const STORAGE_KEY = "journalSante.v4";
const SCHEMA_VERSION = 1;
// Une erreur de lecture bloque les écritures jusqu'au prochain chargement réussi.
// Le JSON original reste ainsi récupérable au lieu d'être remplacé par une base vide.
let storageReadFailed = false;

/** Valeurs par défaut d'une installation sans données V4. */
function createEmptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    catalog: [],
    entries: [],
    settings: {
      theme: "system",
    },
  };
}

/** Lit, normalise et applique uniquement les migrations additives connues. */
export function loadData() {
  storageReadFailed = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyData();
    const parsed = JSON.parse(raw);

    // Un format inconnu bloque toute écriture : ne pas remplacer l’historique.
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      console.warn("Version de données inconnue :", parsed.schemaVersion);
      throw new Error("Version de données non prise en charge.");
    }
    if (!Array.isArray(parsed.catalog) || !Array.isArray(parsed.entries)) {
      throw new Error("Catalogue ou historique illisible.");
    }

    const data = {
      ...parsed,
      schemaVersion: SCHEMA_VERSION,
      catalog: Array.isArray(parsed.catalog) ? parsed.catalog : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      settings:
        parsed.settings && typeof parsed.settings === "object"
          ? parsed.settings
          : { theme: "system" },
    };
    validateDigestive(data.digestive);

    // Correction additive et idempotente : les migraines exactes importées de
    // la V3 deviennent des symptômes. Les observations et leurs dates restent intactes.
    if (reclassifyKnownV3Items(data) > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        // Le contenu migré reste disponible en mémoire; une erreur de quota ne
        // doit jamais transformer un historique valide en base vide.
        console.warn(
          "Classement des migraines appliqué en mémoire uniquement.",
          error,
        );
      }
    }
    return data;
  } catch (error) {
    storageReadFailed = true;
    console.error("Impossible de lire les données locales.", error);
    return createEmptyData();
  }
}

/** Écrit une forme de données stable sans toucher à la clé de la V3. */
export function saveData(data) {
  if (storageReadFailed) {
    throw new Error("La lecture des données a échoué. Enregistrement bloqué pour préserver l’historique : recharge l’application après récupération de la sauvegarde.");
  }
  validateDigestive(data.digestive);
  const safeData = {
    ...data,
    schemaVersion: SCHEMA_VERSION,
    catalog: Array.isArray(data.catalog) ? data.catalog : [],
    entries: Array.isArray(data.entries) ? data.entries : [],
    settings:
      data.settings && typeof data.settings === "object"
        ? data.settings
        : { theme: "system" },
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeData));
}

/** Expose la clé pour les tests sans la dupliquer dans leurs fixtures. */
export function getStorageKey() {
  return STORAGE_KEY;
}

export function hasStorageReadError() {
  return storageReadFailed;
}

