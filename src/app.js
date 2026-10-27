import { nextDailyRefreshAt } from "./history.js";
import { renderDailyActions } from "./history-ui.js";
import { createIndependentEntries } from "./episodes.js";
import { setupEpisodeUi, handleEpisodeCommand } from "./episode-ui.js";
import { setupDialogBars, openDialog, closeDialog } from "./dialogs.js";
import { setupDigestive, renderDigestive } from "./digestive-ui.js";
import {
  loadData,
  saveData,
  hasStorageReadError,
  getStorageKey,
} from "./storage.js";
import {
  createCatalogItem,
  updateCatalogItem,
  ensureDigestivePresets,
} from "./catalog.js";
import {
  addPastPresence,
  createEntry,
  deleteEntry,
  finishEntry,
  recordStillPresent,
  updateEntry,
  updateEntryEnd,
} from "./entries.js?v=4.8.1";
import { createBackup, mergeBackup } from "./transfer.js";
import {
  closeCatalogDialog,
  closeFinishDialog,
  beginEntryEdit,
  getCatalogFormInput,
  getFinishTimestamp,
  getFinishingEntryId,
  getEditingCatalogId,
  getEditingEntryId,
  getElements,
  getEntryFormInput,
  isEntryFormDirty,
  isCorrectingEntryEnd,
  isAddingPastPresence,
  openCatalogDialog,
  openFinishDialog,
  renderAll,
  renderBodyMap,
  refreshCatalogBodyMapControls,
  reconcileItemChoice,
  refreshPreviousObservationHint,
  resetEntryForm,
  setDefaultDateTime,
  setActivePage,
  showToast,
  toggleLevelButton,
} from "./ui.js";

// Point d'entrée unique de l'application.
// Ce fichier orchestre les modules sans dupliquer leur logique métier.

// Les observations restent en mémoire pendant la session, puis sont écrites
// localement après chaque action validée.
const data = loadData();
const elements = getElements();
let currentModule = "rhumatologie";
let dailyRefreshTimer;
const bodyMapState = { view: "front", region: null, showAllChoices: false };

// Rendu et persistance communs à tous les modules.
function renderCurrentView() {
  try {
    renderAll(data, currentModule, bodyMapState);
    renderDigestive();
    renderDailyActions(data);
    scheduleDailyRefresh();
  } catch (error) {
    // Une erreur de rendu ne doit pas laisser tous les boutons sans action.
    // Les données restent en mémoire et dans le stockage local.
    console.error("Impossible d’afficher les données de l’application.", error);
    showToast(
      "L’affichage a rencontré un problème. Les données enregistrées sont conservées.",
      "error",
    );
  }
}

function persistAndRender() {
  saveData(data);
  renderCurrentView();
}

/** Transaction commune : une erreur de validation ou de quota ne modifie rien. */
function transact(action) {
  const next = structuredClone(data);
  const result = action(next);
  saveData(next);
  for (const key of Object.keys(data)) delete data[key];
  Object.assign(data, next);
  renderCurrentView();
  return result;
}

// Les formulaires appellent les commandes métier avant toute sauvegarde.
function handleCatalogSubmit(event) {
  event.preventDefault();

  try {
    const catalogId = getEditingCatalogId();
    const input = getCatalogFormInput();
    const item = transact((next) =>
      catalogId
        ? updateCatalogItem(next, catalogId, input)
        : createCatalogItem(next, input),
    );
    closeCatalogDialog({ saved: true });
    document.dispatchEvent(new CustomEvent("catalog-saved", { detail: item }));
    showToast(catalogId ? "Élément modifié." : "Élément ajouté.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function handleEntrySubmit(event) {
  event.preventDefault();

  try {
    const entryId = getEditingEntryId();
    const input = getEntryFormInput();
    transact((next) =>
      entryId
        ? updateEntry(next, entryId, input)
        : createIndependentEntries(next, input),
    );
    closeDialog(document.querySelector("#entry-dialog"), { saved: true });
    resetEntryForm();
    showToast(entryId ? "Observation corrigée." : "Observation enregistrée.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Une suppression exige une confirmation explicite et ne vise qu'une entrée.
function handleDeleteEntry(entryId) {
  const entryExists = data.entries.some((entry) => entry.id === entryId);

  if (!entryExists) return;

  const confirmed = window.confirm("Supprimer cette observation ?");
  if (!confirmed) return;

  if (deleteEntry(data, entryId)) {
    if (getEditingEntryId() === entryId) resetEntryForm();
    persistAndRender();
    showToast("Observation supprimée.");
  }
}

// Capture le clic « Encore maintenant » ici, puis délègue la chronologie au moteur.
function handleEpisodeAction(action, entryId) {
  try {
    if (action === "still-present") {
      // Capturer l'heure au clic, avant sauvegarde et rendu.
      const clickedAt = new Date().toISOString();
      recordStillPresent(data, entryId, clickedAt);
    } else {
      const entry = data.entries.find((row) => row.id === entryId);
      if (entry) openFinishDialog(entry);
      return;
    }
    persistAndRender();
    showToast("Nouveau constat enregistré avec l’heure actuelle.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function handleFinishSubmit(event) {
  event.preventDefault();

  try {
    const entryId = getFinishingEntryId();
    const endedAt = getFinishTimestamp();
    const correctingEnd = isCorrectingEntryEnd();
    const addingPresence = isAddingPastPresence();
    if (addingPresence) addPastPresence(data, entryId, endedAt);
    else if (correctingEnd) updateEntryEnd(data, entryId, endedAt);
    else finishEntry(data, entryId, endedAt);
    closeFinishDialog({ saved: true });
    persistAndRender();
    showToast(
      addingPresence
        ? "Constat passé ajouté."
        : correctingEnd
          ? "Heure de fin corrigée."
          : "Fin constatée enregistrée.",
    );
  } catch (error) {
    showToast(error.message, "error");
  }
}

function handleBodyMapChoice(label, itemId = "", regionId = "") {
  try {
    let item = itemId
      ? data.catalog.find((candidate) => candidate.id === itemId)
      : null;
    if (!item) {
      item = createCatalogItem(data, {
        label,
        family: "rhumatologie",
        kind: "zone",
      });
      // Seul le catalogue est enregistré ici; l'observation attend Enregistrer.
      persistAndRender();
    }
    const checkbox = [
      ...elements.itemChoices.querySelectorAll('input[type="checkbox"]'),
    ].find(
      (input) =>
        input.value === item.id && (input.dataset.regionId || "") === regionId,
    );
    if (!checkbox) return;
    checkbox.checked = !checkbox.checked;
    reconcileItemChoice(checkbox);
    renderBodyMap(data, currentModule, bodyMapState);
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Les sauvegardes passent par le même moteur de validation/fusion que les tests.
function handleExport() {
  try {
    // En cas de lecture impossible, télécharger la source intacte plutôt
    // qu'une sauvegarde vide. Aucun octet n'est écrit dans le stockage.
    const content = hasStorageReadError()
      ? localStorage.getItem(getStorageKey())
      : JSON.stringify(createBackup(data), null, 2);
    if (content === null) throw new Error("Aucune source locale à récupérer.");
    const file = new Blob([content], {
      type: "application/json",
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `journal-sante-v4-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Sauvegarde JSON téléchargée.");
  } catch (error) {
    showToast(`Export impossible : ${error.message}`, "error");
  }
}

async function handleImport(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const content = await file.text();
    const result = mergeBackup(data, content);
    const confirmed = window.confirm(
      `Ajouter ${result.entriesAdded} observation(s), ${result.catalogAdded} élément(s), ${result.digestiveAdded} transit(s) et ${result.daysAdded} journée(s) sans passage ?\n\n` +
        "Les données déjà présentes seront conservées. Aucune donnée ne sera effacée.",
    );
    if (!confirmed) return;

    // La fusion est calculée et validée avant cette unique écriture locale.
    saveData(result.data);
    data.schemaVersion = result.data.schemaVersion;
    data.catalog = result.data.catalog;
    data.entries = result.data.entries;
    data.settings = result.data.settings;
    if (result.data.digestive) data.digestive = result.data.digestive;
    renderCurrentView();
    showToast(
      `Import terminé : ${result.entriesAdded} observation(s), ${result.catalogAdded} élément(s), ${result.digestiveAdded} transit(s) ajouté(s).`,
    );
  } catch (error) {
    showToast(
      error.message || "Import impossible. Aucune donnée n’a été modifiée.",
      "error",
    );
  } finally {
    input.value = "";
  }
}

// Branche les événements une seule fois, même si l'interface est re-rendue.
function registerEvents() {
  document.querySelector("#open-settings").addEventListener("click", () => {
    try {
      // Catalogue commun : les prédéfinis deviennent configurables sans saisie.
      transact(ensureDigestivePresets);
      openDialog(document.querySelector("#settings-dialog"));
    } catch (error) {
      showToast(error.message, "error");
    }
  });
  document
    .querySelector("#close-settings")
    .addEventListener("click", () =>
      closeDialog(document.querySelector("#settings-dialog"), { saved: true }),
    );
  document
    .querySelector("#settings-create")
    .addEventListener("click", () =>
      openCatalogDialog({
        family: document.querySelector("#settings-family").value,
      }),
    );
  for (const id of ["home-followup", "today-occurrences"]) {
    document.getElementById(id).addEventListener("click", (event) => {
      const command = event.target.closest("[data-episode-command]");
      if (command) handleEpisodeCommand(command);
    });
  }

  document.querySelectorAll("[data-open-module]").forEach((button) => {
    button.addEventListener("click", () => {
      currentModule = button.dataset.openModule;
      resetEntryForm();
      setActivePage("module", currentModule);
      renderCurrentView();
    });
  });

  document.querySelectorAll("[data-go-home]").forEach((button) => {
    button.addEventListener("click", () => {
      if (
        isEntryFormDirty() &&
        !window.confirm("Quitter sans enregistrer cette observation ?")
      )
        return;
      resetEntryForm();
      setActivePage("home");
    });
  });

  document.querySelectorAll("[data-open-catalog]").forEach((button) => {
    button.addEventListener("click", () =>
      openCatalogDialog({ family: currentModule }),
    );
  });

  elements.bodyMapFront.addEventListener("click", () => {
    bodyMapState.view = "front";
    renderBodyMap(data, currentModule, bodyMapState);
  });
  elements.bodyMapBack.addEventListener("click", () => {
    bodyMapState.view = "back";
    renderBodyMap(data, currentModule, bodyMapState);
  });
  elements.bodyMap.addEventListener("click", (event) => {
    const hotspot = event.target.closest("[data-body-region]");
    if (hotspot) {
      bodyMapState.region = hotspot.dataset.bodyRegion;
      renderBodyMap(data, currentModule, bodyMapState);
      return;
    }
    const choice = event.target.closest("[data-body-map-choice]");
    if (choice) {
      handleBodyMapChoice(
        choice.dataset.bodyMapChoice,
        choice.dataset.bodyMapItem,
        choice.dataset.bodyMapRegion,
      );
      return;
    }
    const remove = event.target.closest("[data-body-map-remove-item]");
    if (remove) {
      const checkbox = [
        ...elements.itemChoices.querySelectorAll('input[type="checkbox"]'),
      ].find(
        (input) =>
          input.value === remove.dataset.bodyMapRemoveItem &&
          (input.dataset.regionId || "") ===
            (remove.dataset.bodyMapRemoveRegion || ""),
      );
      if (checkbox) checkbox.checked = false;
      renderBodyMap(data, currentModule, bodyMapState);
    }
  });
  elements.manualChoicesToggle.addEventListener("click", () => {
    bodyMapState.showAllChoices = !bodyMapState.showAllChoices;
    renderBodyMap(data, currentModule, bodyMapState);
  });
  elements.itemChoices.addEventListener("change", (event) => {
    reconcileItemChoice(event.target);
    renderBodyMap(data, currentModule, bodyMapState);
  });

  document.querySelectorAll("[data-close-catalog]").forEach((button) => {
    button.addEventListener("click", closeCatalogDialog);
  });
  for (const field of [
    elements.catalogFamily,
    elements.catalogKind,
    elements.catalogBodyGroup,
  ]) {
    field.addEventListener("change", refreshCatalogBodyMapControls);
  }
  elements.catalogForm.addEventListener("submit", handleCatalogSubmit);
  elements.finishForm.addEventListener("submit", handleFinishSubmit);
  elements.cancelFinish.addEventListener("click", closeFinishDialog);
  elements.entryForm.addEventListener("submit", handleEntrySubmit);
  // Met à jour l'explication si l'heure de début est antidatée pendant l'édition.
  elements.occurredAt.addEventListener("input", refreshPreviousObservationHint);
  document
    .querySelector("#export-backup")
    .addEventListener("click", handleExport);
  document
    .querySelector("#import-backup")
    .addEventListener("change", handleImport);

  elements.levels.addEventListener("click", (event) => {
    const button = event.target.closest(".level-button");
    if (button) toggleLevelButton(button);
  });

  elements.moduleHistory.addEventListener("click", (event) => {
    const command = event.target.closest("[data-episode-command]");
    if (command) {
      handleEpisodeCommand(command);
      return;
    }
    const addPresenceButton = event.target.closest("[data-add-presence-entry]");
    if (addPresenceButton) {
      const entry = data.entries.find(
        (row) => row.id === addPresenceButton.dataset.addPresenceEntry,
      );
      if (entry) openFinishDialog(entry, { addPresence: true });
      return;
    }
    const stillPresentButton = event.target.closest(
      "[data-still-present-entry]",
    );
    if (stillPresentButton) {
      handleEpisodeAction(
        "still-present",
        stillPresentButton.dataset.stillPresentEntry,
      );
      return;
    }
    const finishButton = event.target.closest("[data-finish-entry]");
    if (finishButton) {
      handleEpisodeAction("finish", finishButton.dataset.finishEntry);
      return;
    }
    const correctEndButton = event.target.closest("[data-edit-entry-end]");
    if (correctEndButton) {
      const entry = data.entries.find(
        (row) => row.id === correctEndButton.dataset.editEntryEnd,
      );
      if (entry) openFinishDialog(entry, { edit: true });
      return;
    }
    const editButton = event.target.closest("[data-edit-entry]");
    if (editButton) {
      const entry = data.entries.find(
        (row) => row.id === editButton.dataset.editEntry,
      );
      if (entry) {
        beginEntryEdit(entry, data, currentModule);
        renderBodyMap(data, currentModule, bodyMapState);
      }
      return;
    }
    const deleteButton = event.target.closest("[data-delete-entry]");
    if (deleteButton) handleDeleteEntry(deleteButton.dataset.deleteEntry);
  });

  elements.catalogList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-catalog]");
    if (!button) return;
    const item = data.catalog.find(
      (row) => row.id === button.dataset.editCatalog,
    );
    if (item) openCatalogDialog({ item });
  });

  document.querySelector("#open-entry-dialog").addEventListener("click", () => {
    resetEntryForm();
    renderCurrentView();
    openDialog(document.querySelector("#entry-dialog"));
  });
  document
    .querySelector("#entry-dialog")
    .addEventListener("close", resetEntryForm);
  elements.cancelEdit.addEventListener("click", () => {
    if (!closeDialog(document.querySelector("#entry-dialog"))) return;
    resetEntryForm();
    renderCurrentView();
  });

  elements.catalogDialog.addEventListener("click", (event) => {
    // Ferme la fenêtre si l'on touche l'arrière-plan, pas son contenu.
    if (event.target === elements.catalogDialog) closeCatalogDialog();
  });
}

// Le service worker fournit le mode hors ligne et remplace l'ancien cache versionné.
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.error("Service worker non enregistré.", error);
      });
    });
  }
}

// Restaure le module demandé, branche les contrôles, puis dessine l'écran initial.
setDefaultDateTime();
const initialModule = location.hash.slice(1);
if (
  ["rhumatologie", "digestif", "symptomes-evenements"].includes(initialModule)
) {
  currentModule = initialModule;
}

// Les contrôles sont branchés avant le rendu : une erreur liée à l’affichage
// ne transforme plus tout l’écran d’accueil en page inerte.
setupEpisodeUi(data, transact, showToast, { openCatalog: openCatalogDialog });
setupDigestive(data, persistAndRender, showToast);
setupDialogBars();
if (hasStorageReadError()) {
  const warning = document.createElement("p");
  warning.className = "panel transit-error";
  warning.setAttribute("role", "alert");
  warning.textContent =
    "L’historique local n’a pas pu être lu. Les enregistrements sont bloqués pour le protéger. Ne te fie pas aux compteurs affichés. Le bouton de sauvegarde permet de récupérer la source enregistrée.";
  document.querySelector("main").prepend(warning);
}
registerEvents();
registerServiceWorker();

if (currentModule !== "rhumatologie") {
  try {
    setActivePage("module", currentModule);
  } catch (error) {
    console.error("Impossible d’ouvrir le module demandé.", error);
  }
}
renderCurrentView();

// Mise à jour des seuls raccourcis : expiration pendant une session ouverte,
// changement de date et retour après veille, sans toucher un formulaire actif.
function refreshDailyActions() {
  renderDailyActions(data);
  renderDigestive();
  scheduleDailyRefresh();
}
function scheduleDailyRefresh() {
  window.clearTimeout(dailyRefreshTimer);
  dailyRefreshTimer = window.setTimeout(
    refreshDailyActions,
    Math.max(1, nextDailyRefreshAt(data) - Date.now() + 5),
  );
}

window.addEventListener("focus", refreshDailyActions);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshDailyActions();
});
