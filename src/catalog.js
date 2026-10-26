import { normalizeBodyMap } from "./body-map.js";

// Gestion centralisée du catalogue d'éléments de suivi.
// Une seule fonction crée un élément, quel que soit l'écran qui l'appelle.

const ALLOWED_FAMILIES = [
  "rhumatologie",
  "digestif",
  "symptomes-evenements",
  "neurologique",
  "general",
  "autre",
];
const ALLOWED_KINDS = ["zone", "symptome", "evenement"];

/** Produit un identifiant unique avec un secours pour les navigateurs anciens. */
function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Valide puis ajoute un élément réutilisable par plusieurs observations. */
export function createCatalogItem(data, input) {
  const label = String(input.label || "").trim();
  const family = String(input.family || "").trim();
  const kind = String(input.kind || "").trim();
  const bodyMap = normalizeBodyMap(input.bodyMap);
  if (bodyMap && (family !== "rhumatologie" || kind !== "zone")) {
    throw new Error(
      "Le rattachement au bonhomme est réservé aux zones Rhumato.",
    );
  }

  if (!label) {
    throw new Error("Le nom de l’élément est obligatoire.");
  }

  if (!ALLOWED_FAMILIES.includes(family)) {
    throw new Error("La famille choisie n’est pas valide.");
  }

  if (!ALLOWED_KINDS.includes(kind)) {
    throw new Error("Le type choisi n’est pas valide.");
  }

  const duplicate = data.catalog.some(
    (item) =>
      item.label.toLocaleLowerCase("fr") === label.toLocaleLowerCase("fr") &&
      item.family === family &&
      item.kind === kind,
  );

  if (duplicate) {
    throw new Error("Cet élément existe déjà dans cette catégorie.");
  }

  const item = {
    id: createId("item"),
    label,
    family,
    kind,
    createdAt: new Date().toISOString(),
  };

  if (bodyMap) item.bodyMap = bodyMap;
  data.catalog.push(item);
  return item;
}

/** Cherche un élément par identifiant; renvoie null s'il a disparu. */
export function getCatalogItem(data, itemId) {
  return data.catalog.find((item) => item.id === itemId) || null;
}

/** Met à jour la classification d'un élément sans toucher aux observations liées. */
export function updateCatalogItem(data, itemId, input) {
  const item = getCatalogItem(data, itemId);
  if (!item) throw new Error("Cet élément n’existe plus dans le catalogue.");

  const label = String(input.label || "").trim();
  const family = String(input.family || "").trim();
  const kind = String(input.kind || "").trim();
  const bodyMap = normalizeBodyMap(input.bodyMap);
  if (bodyMap && (family !== "rhumatologie" || kind !== "zone")) {
    throw new Error(
      "Le rattachement au bonhomme est réservé aux zones Rhumato.",
    );
  }

  if (!label) throw new Error("Le nom de l’élément est obligatoire.");
  if (!ALLOWED_FAMILIES.includes(family))
    throw new Error("La famille choisie n’est pas valide.");
  if (!ALLOWED_KINDS.includes(kind))
    throw new Error("Le type choisi n’est pas valide.");

  const duplicate = data.catalog.some(
    (other) =>
      other.id !== itemId &&
      other.label.toLocaleLowerCase("fr") === label.toLocaleLowerCase("fr") &&
      other.family === family &&
      other.kind === kind,
  );
  if (duplicate)
    throw new Error("Cet élément existe déjà dans cette catégorie.");

  Object.assign(item, { label, family, kind });
  if (bodyMap) item.bodyMap = bodyMap;
  else if (
    input.bodyMap !== undefined ||
    family !== "rhumatologie" ||
    kind !== "zone"
  )
    delete item.bodyMap;
  return item;
}

/**
 * Classe uniquement les deux libellés migraine connus de l'import V3.
 * La migration peut être relancée : les éléments déjà déplacés sont ignorés.
 */
export function reclassifyKnownV3Items(data) {
  const migraineLabels = new Set(["migraine", "migraine ophtalmique"]);
  let changed = 0;

  for (const item of data.catalog) {
    if (typeof item.id !== "string" || !item.id.startsWith("item-v3-"))
      continue;
    const label = String(item.label || "")
      .trim()
      .toLocaleLowerCase("fr");
    if (
      !migraineLabels.has(label) ||
      item.family !== "rhumatologie" ||
      item.kind !== "zone"
    )
      continue;
    item.family = "symptomes-evenements";
    item.kind = "symptome";
    changed += 1;
  }
  return changed;
}

/** Regroupe le catalogue pour les écrans qui l'affichent par famille. */
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
    rhumatologie: "Rhumatologie",
    digestif: "Digestif",
    "symptomes-evenements": "Symptômes / événements",
    neurologique: "Neurologique",
    general: "Général",
    autre: "Autre",
  };

  return labels[family] || "Autre";
}

export function getKindLabel(kind) {
  const labels = {
    zone: "Zone",
    symptome: "Symptôme",
    evenement: "Événement",
  };

  return labels[kind] || "Élément";
}
