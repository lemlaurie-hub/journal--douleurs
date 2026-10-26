// Zones proposées par la carte Rhumato. La face choisie détermine la liste
// des précisions afin de ne jamais proposer, par exemple, les lombaires sur
// la vue de face.
// Identifiants stables de la carte et propositions adaptées à chaque vue.
export const BODY_MAP_REGIONS = {
  neck: {
    name: "Cou",
    front: ["Avant du cou"],
    back: ["Nuque", "Base du crâne"],
  },
  "shoulder-right": {
    name: "Épaule droite",
    front: ["Avant de l’épaule droite", "Clavicule droite"],
    back: ["Arrière de l’épaule droite", "Omoplate droite"],
  },
  "shoulder-left": {
    name: "Épaule gauche",
    front: ["Avant de l’épaule gauche", "Clavicule gauche"],
    back: ["Arrière de l’épaule gauche", "Omoplate gauche"],
  },
  trunk: {
    name: "Torse",
    front: ["Côtes droites", "Côtes gauches", "Sternum", "Ventre"],
    back: ["Haut du dos", "Milieu du dos", "Lombaires", "Sacrum"],
  },
  "arm-right": {
    name: "Bras droit",
    front: ["Bras droit", "Coude droit (avant)", "Avant-bras droit"],
    back: [
      "Arrière du bras droit",
      "Coude droit (arrière)",
      "Arrière de l’avant-bras droit",
    ],
  },
  "arm-left": {
    name: "Bras gauche",
    front: ["Bras gauche", "Coude gauche (avant)", "Avant-bras gauche"],
    back: [
      "Arrière du bras gauche",
      "Coude gauche (arrière)",
      "Arrière de l’avant-bras gauche",
    ],
  },
  "hand-right": {
    name: "Main droite",
    front: ["Poignet droit", "Paume droite", "Doigts de la main droite"],
    back: [
      "Poignet droit",
      "Dos de la main droite",
      "Doigts de la main droite",
    ],
  },
  "hand-left": {
    name: "Main gauche",
    front: ["Poignet gauche", "Paume gauche", "Doigts de la main gauche"],
    back: [
      "Poignet gauche",
      "Dos de la main gauche",
      "Doigts de la main gauche",
    ],
  },
  "hip-right": {
    name: "Hanche droite",
    front: ["Avant de la hanche droite", "Aine droite"],
    back: ["Arrière de la hanche droite", "Fesse droite"],
  },
  "hip-left": {
    name: "Hanche gauche",
    front: ["Avant de la hanche gauche", "Aine gauche"],
    back: ["Arrière de la hanche gauche", "Fesse gauche"],
  },
  "leg-right": {
    name: "Jambe droite",
    front: ["Avant de la cuisse droite", "Genou droit (avant)", "Tibia droit"],
    back: [
      "Arrière de la cuisse droite",
      "Genou droit (arrière)",
      "Mollet droit",
    ],
  },
  "leg-left": {
    name: "Jambe gauche",
    front: [
      "Avant de la cuisse gauche",
      "Genou gauche (avant)",
      "Tibia gauche",
    ],
    back: [
      "Arrière de la cuisse gauche",
      "Genou gauche (arrière)",
      "Mollet gauche",
    ],
  },
  "foot-right": {
    name: "Pied droit",
    front: [
      "Pied droit — ensemble",
      "Dessus du pied droit",
      "Orteils droits",
      "Cheville droite (avant)",
    ],
    back: [
      "Pied droit — ensemble",
      "Plante du pied droit",
      "Talon droit",
      "Cheville droite (arrière)",
    ],
  },
  "foot-left": {
    name: "Pied gauche",
    front: [
      "Pied gauche — ensemble",
      "Dessus du pied gauche",
      "Orteils gauches",
      "Cheville gauche (avant)",
    ],
    back: [
      "Pied gauche — ensemble",
      "Plante du pied gauche",
      "Talon gauche",
      "Cheville gauche (arrière)",
    ],
  },
};

/** Retourne les précisions proposées pour une région de face ou de dos. */
export function getBodyMapDetails(regionId, surface) {
  if (!["front", "back"].includes(surface)) return [];
  return BODY_MAP_REGIONS[regionId]?.[surface] || [];
}

// Une partie du corps est choisie une fois, puis ses côtés sont cochés ensemble.
// Groupes du formulaire catalogue : un groupe peut couvrir les deux côtés.
export const BODY_MAP_GROUPS = {
  neck: { name: "Cou", regions: ["neck"] },
  shoulder: { name: "Épaule", regions: ["shoulder-right", "shoulder-left"] },
  trunk: { name: "Torse / dos", regions: ["trunk"] },
  arm: { name: "Bras", regions: ["arm-right", "arm-left"] },
  hand: { name: "Main", regions: ["hand-right", "hand-left"] },
  hip: { name: "Hanche", regions: ["hip-right", "hip-left"] },
  leg: { name: "Jambe", regions: ["leg-right", "leg-left"] },
  foot: { name: "Pied", regions: ["foot-right", "foot-left"] },
};

/** Valide le rattachement anatomique d'un élément du catalogue. */
export function normalizeBodyMap(binding) {
  if (binding == null) return null;
  if (
    !Array.isArray(binding.regions) ||
    !binding.regions.length ||
    binding.regions.some((id) => !Object.hasOwn(BODY_MAP_REGIONS, id))
  ) {
    throw new Error("Choisis au moins un côté ou une partie du corps valide.");
  }
  if (
    !Object.values(BODY_MAP_GROUPS).some((group) =>
      binding.regions.every((id) => group.regions.includes(id)),
    )
  ) {
    throw new Error(
      "Choisis une seule partie du corps, avec un ou deux côtés.",
    );
  }
  if (
    !Array.isArray(binding.surfaces) ||
    !binding.surfaces.length ||
    binding.surfaces.some((surface) => !["front", "back"].includes(surface))
  ) {
    throw new Error("Choisis au moins une vue : face ou dos.");
  }
  return {
    regions: [...new Set(binding.regions)].sort(),
    surfaces: [...new Set(binding.surfaces)].sort(),
  };
}

// Le côté appartient à l'observation, pas au seul catalogue actuel. Un ancien
// enregistrement sans côté reste donc sans côté après un nouveau rattachement.
/** Valide les côtés réellement cochés pour une observation précise. */
export function normalizeItemLocations(locations, itemIds) {
  if (locations === undefined) return {};
  if (!locations || typeof locations !== "object" || Array.isArray(locations)) {
    throw new Error("Les localisations de l’observation sont invalides.");
  }
  const result = {};
  for (const [itemId, regions] of Object.entries(locations)) {
    if (
      !itemIds.includes(itemId) ||
      !Array.isArray(regions) ||
      !regions.length ||
      regions.some((id) => !Object.hasOwn(BODY_MAP_REGIONS, id))
    ) {
      throw new Error(
        "Une localisation ne correspond pas aux éléments de l’observation.",
      );
    }
    Object.defineProperty(result, itemId, {
      value: [...new Set(regions)].sort(),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return result;
}

/** Déplie les côtés en choix affichables, sans inférer ceux des anciennes entrées. */
export function getEntrySelections(entry) {
  return (entry.itemIds || []).flatMap((itemId) => {
    const regions = entry.itemLocations?.[itemId];
    return regions?.length
      ? regions.map((regionId) => ({ itemId, regionId }))
      : [{ itemId, regionId: "" }];
  });
}

/** Construit le nom historique d'un élément, éventuellement avec son côté. */
export function formatSelectionLabel(item, regionId = "") {
  const region = BODY_MAP_REGIONS[regionId];
  return region ? `${item.label} — ${region.name}` : item.label;
}

/** Combine les choix anatomiques par défaut et les éléments personnalisés. */
export function getBodyMapOptions(catalog, regionId, surface) {
  const zones = catalog.filter(
    (item) => item.family === "rhumatologie" && item.kind === "zone",
  );
  const defaults = getBodyMapDetails(regionId, surface).flatMap((label) => {
    const item = zones.find(
      (candidate) =>
        candidate.label.toLocaleLowerCase("fr") ===
        label.toLocaleLowerCase("fr"),
    );
    // Un rattachement explicite prend le relais de l'ancien classement par nom.
    return item?.bodyMap
      ? []
      : [{ label, itemId: item?.id || "", regionId: "" }];
  });
  const custom = zones
    .filter(
      (item) =>
        item.bodyMap?.regions.includes(regionId) &&
        item.bodyMap.surfaces.includes(surface),
    )
    .map((item) => ({ label: item.label, itemId: item.id, regionId }));
  return [...defaults, ...custom];
}
