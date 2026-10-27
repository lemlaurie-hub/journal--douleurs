import { renderUnifiedHistory } from "./history-ui.js";
import { CRITERIA, getItemConfig, initialValues } from "./criteria.js";
import {
  renderConfigChoices,
  readConfigChoices,
  renderCriteriaFields,
} from "./criteria-ui.js";
import { openDialog, closeDialog } from "./dialogs.js";
import { getFamilyLabel, getKindLabel, isItemInModule } from "./catalog.js";
import {
  BODY_MAP_REGIONS,
  BODY_MAP_GROUPS,
  getBodyMapOptions,
  getEntrySelections,
  formatSelectionLabel,
} from "./body-map.js";
import { calculateStats } from "./stats.js";

// Cette couche ne contient pas de règles métier : elle prépare les champs et
// affiche les données. Le même formulaire sert à tous les modules et éditions.
// Références DOM centralisées : les autres fonctions n'ont pas à rechercher
// les mêmes champs à chaque interaction.
const elements = {
  homePage: document.querySelector("#home-page"),
  modulePage: document.querySelector("#module-page"),
  moduleTitle: document.querySelector("#module-title"),
  moduleDescription: document.querySelector("#module-description"),
  homeStats: document.querySelector("#home-stats"),
  homeHistory: document.querySelector("#home-history"),
  moduleStats: document.querySelector("#module-stats"),
  entryForm: document.querySelector("#entry-form"),
  itemChoices: document.querySelector("#item-choices"),
  bodyMap: document.querySelector("#body-map"),
  bodyMapFront: document.querySelector("#body-map-front"),
  bodyMapBack: document.querySelector("#body-map-back"),
  bodyFigureSvg: document.querySelector(".body-figure-svg"),
  bodyMapTitle: document.querySelector("#body-map-title"),
  bodyMapHelp: document.querySelector("#body-map-help"),
  bodyMapOptions: document.querySelector("#body-map-options"),
  bodyMapSelectedList: document.querySelector("#body-map-selected-list"),
  manualChoicesToggle: document.querySelector("#manual-choices-toggle"),
  levels: document.querySelector("#levels"),
  occurredAt: document.querySelector("#occurred-at"),
  preservePreviousGroup: document.querySelector("#preserve-previous-group"),
  preservePrevious: document.querySelector("#preserve-previous"),
  preservePreviousLabel: document.querySelector("#preserve-previous-label"),
  note: document.querySelector("#note"),
  saveEntry: document.querySelector("#save-entry"),
  cancelEdit: document.querySelector("#cancel-edit"),
  catalogList: document.querySelector("#catalog-list"),
  moduleHistory: document.querySelector("#module-history"),
  catalogDialog: document.querySelector("#catalog-dialog"),
  catalogForm: document.querySelector("#catalog-form"),
  catalogDialogTitle: document.querySelector("#catalog-dialog-title"),
  catalogLabel: document.querySelector("#catalog-label"),
  catalogFamily: document.querySelector("#catalog-family"),
  catalogKind: document.querySelector("#catalog-kind"),
  catalogBodyMap: document.querySelector("#catalog-body-map"),
  catalogBodyGroup: document.querySelector("#catalog-body-group"),
  catalogBodySides: document.querySelector("#catalog-body-sides"),
  catalogBodySurfaces: document.querySelector("#catalog-body-surfaces"),
  catalogSideRight: document.querySelector("#catalog-side-right"),
  catalogSideLeft: document.querySelector("#catalog-side-left"),
  catalogSurfaceFront: document.querySelector("#catalog-surface-front"),
  catalogSurfaceBack: document.querySelector("#catalog-surface-back"),
  saveCatalogItem: document.querySelector("#save-catalog-item"),
  toast: document.querySelector("#toast"),
};

// Configuration de navigation et de classement par module.
const MODULES = {
  rhumatologie: {
    title: "Rhumato",
    description: "Douleurs et observations rhumatologiques.",
    icon: "🦴",
  },
  digestif: {
    title: "Digestif",
    description: "Symptômes et événements digestifs.",
    icon: "🌿",
  },
  "symptomes-evenements": {
    title: "Symptômes / événements",
    description: "Observations qui ne sont pas propres à un seul autre module.",
    icon: "🌀",
  },
};

// État transitoire des formulaires; aucune de ces variables n'est une donnée persistée.
let editingEntry = null;
let originalDateTimeFieldValue = null;
let editingCatalogId = null;
let catalogFamilyLocked = false;
let defaultDateTimeFieldValue = null;

// Petits utilitaires d'affichage partagés par les vues.
function createEmptyMessage(text) {
  const p = document.createElement("p");
  p.className = "empty-state";
  p.textContent = text;
  return p;
}

function formatLocalDateTime(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Date non reconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toLocalInputValue(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

// Navigation PWA : l'URL garde le module ouvert, sans recharger la page.
function updateAddressBar(hash = "") {
  const nextUrl = `${location.pathname}${location.search}${hash ? `#${hash}` : ""}`;
  try {
    history.replaceState(null, "", nextUrl);
  } catch (error) {
    // La navigation visuelle doit rester fonctionnelle si l’origine refuse
    // la mise à jour de l’URL (par exemple dans certains modes installés).
    console.warn("URL de navigation non mise à jour.", error);
  }
}

/** Donne au point d'entrée l'ensemble des contrôles déjà résolus. */
export function getElements() {
  return elements;
}

/** Affiche l'accueil ou un module et synchronise titre et URL. */
export function setActivePage(page, moduleId = null) {
  elements.homePage.hidden = page !== "home";
  elements.modulePage.hidden = page !== "module";
  if (page !== "module" || !MODULES[moduleId]) {
    document.title = "Journal de suivi santé";
    updateAddressBar();
    return;
  }

  // Une visite repart repliée ; un rendu après saisie conserve le contexte.
  document
    .querySelectorAll("#module-page details")
    .forEach((section) => (section.open = false));
  document.querySelector("#digestive-panel").hidden = moduleId !== "digestif";
  document.querySelector("#module-entry-actions").hidden =
    moduleId === "digestif";
  document.querySelectorAll("[data-open-catalog]").forEach((button) => {
    button.textContent =
      moduleId === "digestif"
        ? "Créer un symptôme ou événement"
        : "Créer une zone ou un symptôme";
  });
  const module = MODULES[moduleId];
  elements.moduleTitle.textContent = module.title;
  elements.moduleDescription.textContent = module.description;
  document.title = `${module.title} · Journal de suivi santé`;
  updateAddressBar(moduleId);
}

/** Initialise le champ date/heure locale pour une nouvelle observation. */
export function setDefaultDateTime() {
  defaultDateTimeFieldValue = toLocalInputValue(new Date().toISOString());
  elements.occurredAt.value = defaultDateTimeFieldValue;
}

// Le couple élément/région distingue, par exemple, la main droite de la gauche.
function selectedItemChoices() {
  return [
    ...elements.itemChoices.querySelectorAll('input[type="checkbox"]:checked'),
  ].map((input) => ({
    itemId: input.value,
    regionId: input.dataset.regionId || "",
  }));
}

function selectionKey(choice) {
  return JSON.stringify([choice.itemId, choice.regionId || ""]);
}

// Un côté précis remplace le choix sans côté, mais droite et gauche coexistent.
export function reconcileItemChoice(input) {
  if (!input?.checked) return;
  for (const other of elements.itemChoices.querySelectorAll(
    'input[type="checkbox"]',
  )) {
    if (
      other !== input &&
      other.value === input.value &&
      Boolean(other.dataset.regionId) !== Boolean(input.dataset.regionId)
    )
      other.checked = false;
  }
}

/** Détecte les changements non enregistrés avant de quitter un formulaire. */
export function isEntryFormDirty() {
  const itemIds = [
    ...elements.itemChoices.querySelectorAll('input[type="checkbox"]:checked'),
  ].map((input) => input.value);
  const levels = [
    ...elements.levels.querySelectorAll(".level-button.is-selected"),
  ].map((button) => Number(button.dataset.level));
  const note = elements.note.value;
  const occurredAt = elements.occurredAt.value;

  if (!editingEntry) {
    return (
      itemIds.length > 0 ||
      levels.length > 0 ||
      note.length > 0 ||
      occurredAt !== defaultDateTimeFieldValue
    );
  }

  return (
    JSON.stringify(selectedItemChoices().map(selectionKey).sort()) !==
      JSON.stringify(
        getEntrySelections(editingEntry).map(selectionKey).sort(),
      ) ||
    JSON.stringify(levels) !== JSON.stringify(editingEntry.levels || []) ||
    occurredAt !== originalDateTimeFieldValue ||
    note !== String(editingEntry.note ?? "")
  );
}

/** Explique quel constat sera préservé lorsqu'on avance le premier repère. */
export function refreshPreviousObservationHint() {
  const earlier =
    editingEntry &&
    Date.parse(elements.occurredAt.value) < Date.parse(editingEntry.occurredAt);
  elements.preservePreviousGroup.hidden = !earlier;
  if (earlier) {
    elements.preservePreviousLabel.textContent = `Conserver le ${formatLocalDateTime(editingEntry.occurredAt)} comme constat de présence`;
  }
}

/** Transforme les cases du formulaire en objet attendu par le moteur métier. */
export function getEntryFormInput() {
  const choices = selectedItemChoices();
  const itemIds = [...new Set(choices.map((choice) => choice.itemId))];
  const locations = new Map();
  for (const { itemId, regionId } of choices) {
    if (regionId)
      locations.set(itemId, [...(locations.get(itemId) || []), regionId]);
  }
  const itemLocations = Object.fromEntries(locations);
  const levels = [
    ...elements.levels.querySelectorAll(".level-button.is-selected"),
  ].map((button) => Number(button.dataset.level));

  const occurredAt =
    editingEntry && elements.occurredAt.value === originalDateTimeFieldValue
      ? editingEntry.occurredAt
      : elements.occurredAt.value;

  return {
    itemIds,
    itemLocations,
    levels,
    occurredAt,
    ongoing: Boolean(editingEntry?.ongoing),
    preservePreviousObservation: elements.preservePrevious.checked,
    note: elements.note.value,
  };
}

/** Renvoie l'identifiant de l'observation en cours d'édition, s'il y en a une. */
export function getEditingEntryId() {
  return editingEntry?.id || null;
}

/** Réinitialise complètement le formulaire avant une nouvelle saisie. */
export function resetEntryForm() {
  editingEntry = null;
  originalDateTimeFieldValue = null;
  elements.entryForm.reset();
  elements.preservePrevious.checked = true;
  refreshPreviousObservationHint();
  elements.levels.querySelectorAll(".level-button").forEach((button) => {
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  });
  elements.saveEntry.textContent = "Enregistrer";
  elements.cancelEdit.hidden = false;
  elements.entryForm.closest(".panel").querySelector("h2").textContent =
    "Nouvelle observation";
  setDefaultDateTime();
}

/** Prépare le formulaire commun à partir d'une observation existante. */
export function beginEntryEdit(entry, data, moduleId) {
  editingEntry = entry;
  renderItemChoices(data, moduleId, getEntrySelections(entry));

  elements.levels.querySelectorAll(".level-button").forEach((button) => {
    const selected = (entry.levels || []).includes(
      Number(button.dataset.level),
    );
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  originalDateTimeFieldValue = toLocalInputValue(entry.occurredAt);
  elements.occurredAt.value = originalDateTimeFieldValue;
  elements.preservePrevious.checked = true;
  refreshPreviousObservationHint();
  elements.note.value = String(entry.note ?? "");
  elements.saveEntry.textContent = "Enregistrer les corrections";
  elements.cancelEdit.hidden = false;
  elements.entryForm.closest(".panel").querySelector("h2").textContent =
    "Modifier l’observation";
  openDialog(document.querySelector("#entry-dialog"));
}

/** Affiche les options anatomiques seulement pour une zone Rhumato. */
export function refreshCatalogBodyMapControls() {
  refreshCatalogContext();
  const isZone =
    elements.catalogFamily.value === "rhumatologie" &&
    elements.catalogKind.value === "zone";
  elements.catalogBodyMap.hidden = !isZone;
  const group = BODY_MAP_GROUPS[elements.catalogBodyGroup.value];
  elements.catalogBodySides.hidden =
    !isZone || !group || group.regions.length === 1;
  elements.catalogBodySurfaces.hidden = !isZone || !group;
}

/** Convertit les choix droite/gauche et face/dos en rattachement métier. */
function getCatalogBodyMap() {
  if (
    elements.catalogFamily.value !== "rhumatologie" ||
    elements.catalogKind.value !== "zone"
  )
    return null;
  const group = BODY_MAP_GROUPS[elements.catalogBodyGroup.value];
  if (!group) return null;
  return {
    regions: group.regions.filter(
      (region) =>
        group.regions.length === 1 ||
        (region.endsWith("-right")
          ? elements.catalogSideRight.checked
          : elements.catalogSideLeft.checked),
    ),
    surfaces: [
      elements.catalogSurfaceFront.checked ? "front" : null,
      elements.catalogSurfaceBack.checked ? "back" : null,
    ].filter(Boolean),
  };
}

/** Rassemble le nom, le classement et le rattachement anatomique du catalogue. */
export function getCatalogFormInput() {
  return {
    label: elements.catalogLabel.value,
    family: elements.catalogFamily.value,
    kind: elements.catalogKind.value,
    bodyMap: getCatalogBodyMap(),
    ...(elements.catalogFamily.value === "digestif"
      ? {
          config: readConfigChoices(
            document.querySelector("#catalog-criteria"),
          ),
        }
      : {}),
  };
}

/** Renvoie l'identifiant du catalogue en cours d'édition, s'il y en a un. */
export function getEditingCatalogId() {
  return editingCatalogId;
}

/** Préremplit la fenêtre de création ou d'édition du catalogue. */
export function openCatalogDialog({
  family = "rhumatologie",
  item = null,
} = {}) {
  editingCatalogId = item?.id || null;
  catalogFamilyLocked = !item && family === "digestif";
  elements.catalogDialogTitle.textContent = item
    ? "Modifier un élément"
    : "Créer un élément";
  elements.saveCatalogItem.textContent = item ? "Enregistrer" : "Créer";
  elements.catalogLabel.value = item?.label || "";
  elements.catalogFamily.value = item?.family || family;
  elements.catalogKind.value =
    item?.kind || (family === "rhumatologie" ? "zone" : "symptome");
  elements.catalogBodyGroup.replaceChildren(
    new Option("Sans rattachement au bonhomme", ""),
  );
  for (const [id, group] of Object.entries(BODY_MAP_GROUPS)) {
    elements.catalogBodyGroup.add(new Option(group.name, id));
  }
  const binding = item?.bodyMap;
  elements.catalogBodyGroup.value = binding
    ? Object.entries(BODY_MAP_GROUPS).find(([, group]) =>
        binding.regions.every((id) => group.regions.includes(id)),
      )?.[0] || ""
    : "";
  elements.catalogSideRight.checked = binding
    ? binding.regions.some((id) => id.endsWith("-right"))
    : true;
  elements.catalogSideLeft.checked = binding
    ? binding.regions.some((id) => id.endsWith("-left"))
    : true;
  elements.catalogSurfaceFront.checked = binding
    ? binding.surfaces.includes("front")
    : true;
  elements.catalogSurfaceBack.checked = binding
    ? binding.surfaces.includes("back")
    : true;
  refreshCatalogBodyMapControls();
  refreshCatalogContext();
  const config = getItemConfig(item || { family });
  renderConfigChoices(
    document.querySelector("#catalog-criteria"),
    config,
    refreshCatalogPreview,
  );
  refreshCatalogPreview();
  openDialog(elements.catalogDialog);
  window.setTimeout(() => elements.catalogLabel.focus(), 0);
}

/** Réinitialise et ferme la fenêtre du catalogue. */
export function closeCatalogDialog(options = {}) {
  if (!closeDialog(elements.catalogDialog, options)) return false;
  editingCatalogId = null;
  elements.catalogForm.reset();
  return true;
}

/** Met à jour le style et l'accessibilité d'un bouton de niveau. */
export function toggleLevelButton(button) {
  const selected = button.classList.toggle("is-selected");
  button.setAttribute("aria-pressed", String(selected));
}

/** Affiche un retour bref après une action utilisateur. */
export function showToast(message, type = "info") {
  if (type === "error") {
    const dialog = [...document.querySelectorAll("dialog[open]")].at(-1);
    const error = dialog?.querySelector(".dialog-error");
    if (error) error.textContent = message;
  }
  elements.toast.textContent = message;
  elements.toast.dataset.type = type;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 3200);
}

// Rendu sans injection HTML : les données utilisateur sont toujours insérées
// comme texte pour afficher les notes sans les interpréter comme du balisage.
function renderStats(data, target, options = {}) {
  const stats = calculateStats(data, options);
  target.replaceChildren();
  const cards = [
    ["Observations", String(stats.totalEntries)],
    ["Jours suivis", String(stats.activeDays)],
    ["Fin non renseignée", String(stats.ongoingEntries)],
  ];

  for (const [label, value] of cards) {
    const card = document.createElement("div");
    card.className = "stat-card";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    card.append(strong, span);
    target.append(card);
  }

  const topSection = document.createElement("div");
  topSection.className = "stats-top";
  const heading = document.createElement("h3");
  heading.textContent = "Éléments les plus fréquents";
  topSection.append(heading);
  if (stats.topItems.length === 0) {
    topSection.append(
      createEmptyMessage(
        "Les statistiques apparaîtront après les premières observations.",
      ),
    );
  } else {
    const list = document.createElement("ol");
    for (const row of stats.topItems) {
      const li = document.createElement("li");
      li.textContent = `${row.item.label} : ${row.count}`;
      list.append(li);
    }
    topSection.append(list);
  }
  target.append(topSection);
}

/** Construit l'historique commun à l'accueil et aux pages de module. */
function renderHistory(data, target, options = {}) {
  renderUnifiedHistory(data, target, options);
}

/** Affiche les éléments du module et garde leur classement modifiable. */
function renderCatalog(data, moduleId) {
  elements.catalogList.replaceChildren();
  const items = data.catalog
    .filter((item) => !moduleId || isItemInModule(item, moduleId))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  if (items.length === 0) {
    elements.catalogList.append(
      createEmptyMessage("Aucun élément dans ce module. Tu peux en créer un."),
    );
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "catalog-row";
    const main = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.label;
    const meta = document.createElement("span");
    meta.className = "muted";
    const placement = item.bodyMap
      ? ` · ${item.bodyMap.regions.map((id) => BODY_MAP_REGIONS[id]?.name).join(", ")} · ${item.bodyMap.surfaces.map((view) => (view === "front" ? "face" : "dos")).join(" / ")}`
      : "";
    meta.textContent = `${getFamilyLabel(item.family)} · ${getKindLabel(item.kind)}${placement}`;
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "button button-secondary button-small";
    editButton.dataset.editCatalog = item.id;
    editButton.textContent = "Modifier";
    main.append(title, meta);
    row.append(main, editButton);
    elements.catalogList.append(row);
  }
}

/** Construit les cases de saisie tout en conservant les anciens choix édités. */
function renderItemChoices(data, moduleId, selected = []) {
  elements.itemChoices.replaceChildren();
  const selectedKeys = new Set(selected.map(selectionKey));
  const included = new Set(selected.map((choice) => choice.itemId));
  const items = data.catalog.filter(
    (item) => isItemInModule(item, moduleId) || included.has(item.id),
  );
  if (items.length === 0) {
    elements.itemChoices.append(
      createEmptyMessage(
        "Aucun élément dans ce module. Crée-en un pour commencer.",
      ),
    );
    return;
  }
  const sorted = [...items].sort(
    (a, b) =>
      getFamilyLabel(a.family).localeCompare(getFamilyLabel(b.family), "fr") ||
      a.label.localeCompare(b.label, "fr"),
  );
  let currentFamily = null;
  for (const item of sorted) {
    if (item.family !== currentFamily) {
      currentFamily = item.family;
      const heading = document.createElement("h3");
      heading.className = "choice-heading";
      heading.textContent = getFamilyLabel(item.family);
      elements.itemChoices.append(heading);
    }
    const regions = new Set(item.bodyMap?.regions || [""]);
    // Une ancienne sélection reste éditable même si le catalogue a changé.
    for (const choice of selected.filter((choice) => choice.itemId === item.id))
      regions.add(choice.regionId);
    for (const regionId of regions) {
      const label = document.createElement("label");
      label.className = "choice-card";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = item.id;
      input.dataset.regionId = regionId;
      input.checked = selectedKeys.has(
        selectionKey({ itemId: item.id, regionId }),
      );
      const text = document.createElement("span");
      text.textContent = formatSelectionLabel(item, regionId);
      const kind = document.createElement("small");
      kind.textContent = getKindLabel(item.kind);
      label.append(input, text, kind);
      elements.itemChoices.append(label);
    }
  }
}

/** Met à jour le bonhomme, les choix détaillés et le résumé des zones cochées. */
export function renderBodyMap(data, moduleId, state) {
  const isRhumato = moduleId === "rhumatologie";
  elements.bodyMap.hidden = !isRhumato;
  elements.manualChoicesToggle.hidden = !isRhumato;
  elements.manualChoicesToggle.textContent = state.showAllChoices
    ? "Masquer les autres éléments du catalogue"
    : "Voir toutes les zones du catalogue";
  elements.itemChoices.hidden = isRhumato && !state.showAllChoices;

  elements.bodyMapFront.setAttribute(
    "aria-pressed",
    String(state.view === "front"),
  );
  elements.bodyMapBack.setAttribute(
    "aria-pressed",
    String(state.view === "back"),
  );
  elements.bodyMapFront.classList.toggle("is-active", state.view === "front");
  elements.bodyMapBack.classList.toggle("is-active", state.view === "back");
  elements.bodyFigureSvg.style.transform =
    state.view === "back" ? "scaleX(-1)" : "none";
  document
    .querySelectorAll(".body-side-left, .body-side-right")
    .forEach((side) => {
      const isLeft = side.classList.contains("body-side-left");
      side.textContent =
        state.view === "back"
          ? isLeft
            ? "gauche"
            : "droite"
          : isLeft
            ? "droite"
            : "gauche";
    });
  document.querySelectorAll("[data-body-region]").forEach((button) => {
    const frontLeft = Number(button.dataset.frontLeft);
    button.style.left = `${state.view === "back" ? 100 - frontLeft : frontLeft}%`;
    button.classList.toggle(
      "is-selected",
      button.dataset.bodyRegion === state.region,
    );
  });

  const region = BODY_MAP_REGIONS[state.region];
  elements.bodyMapTitle.textContent =
    region?.name || "Choisis une zone sur le bonhomme";
  elements.bodyMapHelp.textContent = region
    ? state.view === "front"
      ? "Précisions sur l’avant du corps."
      : "Précisions sur l’arrière du corps."
    : "Les précisions proposées changent entre la vue de face et la vue de dos.";
  elements.bodyMapOptions.replaceChildren();

  if (region) {
    const checkedKeys = new Set(selectedItemChoices().map(selectionKey));
    for (const option of getBodyMapOptions(
      data.catalog,
      state.region,
      state.view,
    )) {
      const { label, itemId, regionId } = option;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "body-map-option";
      button.dataset.bodyMapChoice = label;
      button.dataset.bodyMapItem = itemId;
      button.dataset.bodyMapRegion = regionId;
      button.textContent = label;
      const selected = checkedKeys.has(selectionKey({ itemId, regionId }));
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      elements.bodyMapOptions.append(button);
    }
  }

  const selectedItems = selectedItemChoices()
    .map((choice) => ({
      ...choice,
      item: data.catalog.find((item) => item.id === choice.itemId),
    }))
    .filter((choice) => choice.item);
  elements.bodyMapSelectedList.replaceChildren();
  if (selectedItems.length === 0) {
    const empty = document.createElement("span");
    empty.className = "muted";
    empty.textContent = "Aucune zone choisie";
    elements.bodyMapSelectedList.append(empty);
    return;
  }
  for (const { item, regionId } of selectedItems) {
    const chip = document.createElement("span");
    chip.className = "body-map-chip";
    const label = document.createElement("span");
    label.textContent = formatSelectionLabel(item, regionId);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "body-map-remove";
    remove.dataset.bodyMapRemoveItem = item.id;
    remove.dataset.bodyMapRemoveRegion = regionId;
    remove.textContent = "×";
    remove.setAttribute(
      "aria-label",
      `Retirer ${formatSelectionLabel(item, regionId)}`,
    );
    chip.append(label, remove);
    elements.bodyMapSelectedList.append(chip);
  }
}

/** Rafraîchit toutes les vues à partir du même modèle de données. */
export function renderAll(
  data,
  moduleId,
  bodyMapState = { view: "front", region: null, showAllChoices: false },
) {
  for (const id of Object.keys(MODULES)) {
    const count = data.catalog.filter((item) =>
      isItemInModule(item, id),
    ).length;
    const target = document.querySelector(`#count-${id}`);
    target.textContent = `${count} élément${count > 1 ? "s" : ""}`;
  }
  renderStats(data, elements.homeStats);
  renderHistory(data, elements.homeHistory, { limit: 5 });
  renderItemChoices(data, moduleId, selectedItemChoices());
  renderBodyMap(data, moduleId, bodyMapState);
  renderStats(data, elements.moduleStats, { moduleId });
  renderHistory(data, elements.moduleHistory, { moduleId, actions: true });
  renderCatalog(data, null);
}

/** Adapter les choix au module sans modifier le classement des anciennes données. */
function refreshCatalogContext() {
  const digestive = elements.catalogFamily.value === "digestif";
  const zone = elements.catalogKind.querySelector('option[value="zone"]');
  zone.hidden = digestive;
  zone.disabled = digestive;
  if (digestive && elements.catalogKind.value === "zone")
    elements.catalogKind.value = "symptome";
  document.querySelector("#catalog-criteria-group").hidden = !digestive;
  elements.catalogFamily.closest("label").hidden = catalogFamilyLocked;
  elements.catalogDialogTitle.textContent = editingCatalogId
    ? digestive
      ? "Modifier le symptôme ou événement"
      : "Modifier un élément"
    : digestive
      ? "Créer un symptôme ou événement digestif"
      : "Créer une zone ou un symptôme";
}

function refreshCatalogPreview() {
  const config = readConfigChoices(document.querySelector("#catalog-criteria"));
  renderCriteriaFields(
    document.querySelector("#catalog-preview"),
    config,
    initialValues(config),
    { prefix: "preview", preview: true },
  );
  document.querySelector("#catalog-preview-actions").textContent =
    config.criteria
      .filter((key) => CRITERIA[key].type === "action")
      .map((key) => CRITERIA[key].label)
      .join(" · ");
}
