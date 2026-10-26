// Bibliothèque commune : la configuration décrit les champs et les actions,
// pas un formulaire particulier. Les valeurs absentes restent absentes.
export const CRITERIA = {
  location: { label: "Localisation", type: "text" },
  pain: { label: "Intensité de la douleur", type: "pain", min: 0, max: 10 },
  discomfort: {
    label: "Intensité de la gêne",
    type: "number",
    min: 0,
    max: 10,
  },
  comment: { label: "Commentaire", type: "textarea" },
  refluxHeight: {
    label: "Hauteur de la remontée",
    type: "choice",
    choices: ["Œsophage", "Gorge", "Bouche"],
  },
  stillPresent: { label: "Encore maintenant", type: "action" },
  finish: { label: "C’est terminé", type: "action" },
  newOccurrence: { label: "Ajouter une nouvelle occurrence", type: "action" },
};

export const DEFAULT_SYMPTOM_CONFIG = {
  version: 1,
  criteria: ["location", "pain", "comment", "stillPresent", "finish"],
};

// Les mêmes configurations sont modifiables pour un symptôme prédéfini ou créé.
export const DIGESTIVE_PRESETS = [
  {
    key: "burn",
    label: "Brûlure",
    criteria: ["location", "pain", "comment", "stillPresent", "finish"],
  },
  {
    key: "cramp",
    label: "Crampe",
    criteria: ["location", "pain", "comment", "stillPresent", "finish"],
  },
  {
    key: "spasm",
    label: "Spasme",
    criteria: ["location", "pain", "comment", "stillPresent", "finish"],
  },
  {
    key: "bloating",
    label: "Ballonnement",
    criteria: ["location", "discomfort", "comment", "stillPresent", "finish"],
  },
  {
    key: "nausea",
    label: "Nausée",
    criteria: ["discomfort", "comment", "stillPresent", "finish"],
  },
  {
    key: "reflux",
    label: "Remontée acide",
    criteria: ["refluxHeight", "discomfort", "comment", "newOccurrence"],
  },
  {
    key: "diffuse",
    label: "Douleur diffuse",
    criteria: ["location", "pain", "comment", "stillPresent", "finish"],
  },
];

/** Valide sans supprimer silencieusement un critère inconnu ou répété. */
export function normalizeConfig(config) {
  if (
    !config ||
    config.version !== 1 ||
    !Array.isArray(config.criteria) ||
    new Set(config.criteria).size !== config.criteria.length ||
    config.criteria.some((key) => !Object.hasOwn(CRITERIA, key))
  ) {
    throw new Error("La configuration des critères n’est pas valide.");
  }
  return { version: 1, criteria: [...config.criteria] };
}

export function getItemConfig(item) {
  if (item?.config) return normalizeConfig(item.config);
  const preset = DIGESTIVE_PRESETS.find(
    (p) =>
      p.label.toLocaleLowerCase("fr") === item?.label?.toLocaleLowerCase("fr"),
  );
  return normalizeConfig(
    preset ? { version: 1, criteria: preset.criteria } : DEFAULT_SYMPTOM_CONFIG,
  );
}

/** Zéro par défaut concerne la douleur d'une NOUVELLE saisie, jamais le passé. */
export function initialValues(config) {
  return normalizeConfig(config).criteria.includes("pain") ? { pain: 0 } : {};
}

/** Tous les champs sont facultatifs. Le moteur refuse une valeur invalide. */
export function normalizeValues(values = {}) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new Error("Les valeurs des critères ne sont pas valides.");
  }
  const result = {};
  for (const [key, value] of Object.entries(values)) {
    const definition = CRITERIA[key];
    if (!definition || definition.type === "action")
      throw new Error("Critère inconnu dans l’observation.");
    if (value === null || value === undefined || value === "") continue;
    if (["pain", "number"].includes(definition.type)) {
      if (
        !Number.isInteger(value) ||
        value < definition.min ||
        value > definition.max
      ) {
        throw new Error(`${definition.label} : choisis une valeur de 0 à 10.`);
      }
      result[key] = value;
    } else {
      if (typeof value !== "string")
        throw new Error(`${definition.label} : texte invalide.`);
      if (definition.choices && !definition.choices.includes(value))
        throw new Error("Hauteur de remontée invalide.");
      result[key] = value;
    }
  }
  return result;
}

/** Édition historique : les anciens champs restent accessibles, même retirés. */
export function getEditableConfig(item, entry) {
  const keys = new Set([
    ...getItemConfig(item).criteria,
    ...(entry.configSnapshot?.criteria || []),
    ...Object.keys(entry.values || {}),
  ]);
  return normalizeConfig({ version: 1, criteria: [...keys] });
}
