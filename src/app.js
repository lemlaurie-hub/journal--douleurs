import { transactData } from "./transactions.js";
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
import { updateEntry } from "./entries.js?v=4.8.2";
import { createBackup, mergeBackup } from "./transfer.js";
import {
  closeCatalogDialog,
  beginEntryEdit,
  getCatalogFormInput,
  getEditingCatalogId,
  getEditingEntryId,
  getElements,
  getEntryFormInput,
  isEntryFormDirty,
  openCatalogDialog,
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

/** Toutes les commandes publient la copie sauvegardée, puis actualisent les vues.
 * Le rendu n'est pas une étape de persistance : un échec d'affichage ne doit
 * jamais annuler en mémoire une écriture qui a déjà réussi sur l'appareil. */
function transact(action) {
  const result = transactData(data, action, saveData);
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

// Le suivi temporel, y compris V3, est exclusivement branché sur
// handleEpisodeCommand / episodes.js. L'édition d'associations d'origine
// conserve updateEntry : elle ne remplace pas le suivi ciblé d'un épisode.
function handleBodyMapChoice(label, itemId = "", regionId = "") {
  try {
    let item = itemId
      ? data.catalog.find((candidate) => candidate.id === itemId)
      : null;
    if (!item) {
      // Créer une zone de carte est une écriture du catalogue, même avant
      // l'observation : elle bénéficie de la même transaction que les fiches.
      item = transact((next) =>
        createCatalogItem(next, {
          label,
          family: "rhumatologie",
          kind: "zone",
        }),
      );
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

    // Le fichier a été lu avant la confirmation. Appliquer l'état fusionné
    // complet à la copie de transaction conserve aussi les extensions racine.
    transact((next) => {
      for (const key of Object.keys(next)) delete next[key];
      Object.assign(next, result.data);
    });
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
  document.querySelector("#settings-create").addEventListener("click", () =>
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
setupDigestive(data, transact, showToast);
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
