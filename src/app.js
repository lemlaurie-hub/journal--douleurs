import { loadData, saveData } from './storage.js';
import { createCatalogItem, updateCatalogItem } from './catalog.js';
import { createEntry, deleteEntry, finishEntry, recordStillPresent, updateEntry } from './entries.js?v=4.2.0';
import { createBackup, mergeBackup } from './transfer.js';
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
  resetEntryForm,
  setDefaultDateTime,
  setActivePage,
  showToast,
  toggleLevelButton
} from './ui.js';

// Point d'entrée unique de l'application.
// Ce fichier orchestre les modules sans dupliquer leur logique métier.

const data = loadData();
const elements = getElements();
let currentModule = 'rhumatologie';

function renderCurrentView() {
  try {
    renderAll(data, currentModule);
  } catch (error) {
    // Une erreur de rendu ne doit pas laisser tous les boutons sans action.
    // Les données restent en mémoire et dans le stockage local.
    console.error('Impossible d’afficher les données de l’application.', error);
    showToast('L’affichage a rencontré un problème. Les données enregistrées sont conservées.', 'error');
  }
}

function persistAndRender() {
  saveData(data);
  renderCurrentView();
}

function handleCatalogSubmit(event) {
  event.preventDefault();

  try {
    const catalogId = getEditingCatalogId();
    if (catalogId) updateCatalogItem(data, catalogId, getCatalogFormInput());
    else createCatalogItem(data, getCatalogFormInput());
    persistAndRender();
    closeCatalogDialog();
    showToast(catalogId ? 'Élément modifié.' : 'Élément ajouté.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleEntrySubmit(event) {
  event.preventDefault();

  try {
    const entryId = getEditingEntryId();
    if (entryId) updateEntry(data, entryId, getEntryFormInput());
    else createEntry(data, getEntryFormInput());
    resetEntryForm();
    persistAndRender();
    showToast(entryId ? 'Observation corrigée.' : 'Observation enregistrée.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleDeleteEntry(entryId) {
  const entryExists = data.entries.some(entry => entry.id === entryId);

  if (!entryExists) return;

  const confirmed = window.confirm('Supprimer cette observation ?');
  if (!confirmed) return;

  if (deleteEntry(data, entryId)) {
    if (getEditingEntryId() === entryId) resetEntryForm();
    persistAndRender();
    showToast('Observation supprimée.');
  }
}

function handleEpisodeAction(action, entryId) {
  try {
    if (action === 'still-present') recordStillPresent(data, entryId);
    else finishEntry(data, entryId);
    persistAndRender();
    showToast(action === 'still-present'
      ? 'Nouveau constat enregistré avec l’heure actuelle.'
      : 'Fin enregistrée avec l’heure actuelle.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleExport() {
  try {
    const backup = createBackup(data);
    const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `journal-sante-v4-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Sauvegarde JSON téléchargée.');
  } catch (error) {
    showToast(`Export impossible : ${error.message}`, 'error');
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
      `Ajouter ${result.entriesAdded} observation(s) et ${result.catalogAdded} élément(s) ?\n\n` +
      'Les données déjà présentes seront conservées. Aucune donnée ne sera effacée.'
    );
    if (!confirmed) return;

    // La fusion est calculée et validée avant cette unique écriture locale.
    data.schemaVersion = result.data.schemaVersion;
    data.catalog = result.data.catalog;
    data.entries = result.data.entries;
    data.settings = result.data.settings;
    persistAndRender();
    showToast(`Import terminé : ${result.entriesAdded} observation(s), ${result.catalogAdded} élément(s) ajouté(s).`);
  } catch (error) {
    showToast(error.message || 'Import impossible. Aucune donnée n’a été modifiée.', 'error');
  } finally {
    input.value = '';
  }
}

function registerEvents() {
  document.querySelectorAll('[data-open-module]').forEach(button => {
    button.addEventListener('click', () => {
      currentModule = button.dataset.openModule;
      resetEntryForm();
      setActivePage('module', currentModule);
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-go-home]').forEach(button => {
    button.addEventListener('click', () => {
      if (isEntryFormDirty() && !window.confirm('Quitter sans enregistrer cette observation ?')) return;
      resetEntryForm();
      setActivePage('home');
    });
  });

  document.querySelectorAll('[data-open-catalog]').forEach(button => {
    button.addEventListener('click', () => openCatalogDialog({ family: currentModule }));
  });

  document.querySelectorAll('[data-close-catalog]').forEach(button => {
    button.addEventListener('click', closeCatalogDialog);
  });
  elements.catalogForm.addEventListener('submit', handleCatalogSubmit);
  elements.entryForm.addEventListener('submit', handleEntrySubmit);
  document.querySelector('#export-backup').addEventListener('click', handleExport);
  document.querySelector('#import-backup').addEventListener('change', handleImport);

  elements.levels.addEventListener('click', event => {
    const button = event.target.closest('.level-button');
    if (button) toggleLevelButton(button);
  });

  elements.moduleHistory.addEventListener('click', event => {
    const stillPresentButton = event.target.closest('[data-still-present-entry]');
    if (stillPresentButton) {
      handleEpisodeAction('still-present', stillPresentButton.dataset.stillPresentEntry);
      return;
    }
    const finishButton = event.target.closest('[data-finish-entry]');
    if (finishButton) {
      handleEpisodeAction('finish', finishButton.dataset.finishEntry);
      return;
    }
    const editButton = event.target.closest('[data-edit-entry]');
    if (editButton) {
      const entry = data.entries.find(row => row.id === editButton.dataset.editEntry);
      if (entry) beginEntryEdit(entry, data, currentModule);
      return;
    }
    const deleteButton = event.target.closest('[data-delete-entry]');
    if (deleteButton) handleDeleteEntry(deleteButton.dataset.deleteEntry);
  });

  elements.catalogList.addEventListener('click', event => {
    const button = event.target.closest('[data-edit-catalog]');
    if (!button) return;
    const item = data.catalog.find(row => row.id === button.dataset.editCatalog);
    if (item) openCatalogDialog({ item });
  });

  elements.cancelEdit.addEventListener('click', () => {
    resetEntryForm();
    renderCurrentView();
  });

  elements.catalogDialog.addEventListener('click', event => {
    // Ferme la fenêtre si l'on touche l'arrière-plan, pas son contenu.
    if (event.target === elements.catalogDialog) closeCatalogDialog();
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(error => {
        console.error('Service worker non enregistré.', error);
      });
    });
  }
}

setDefaultDateTime();
const initialModule = location.hash.slice(1);
if (['rhumatologie', 'digestif', 'symptomes-evenements'].includes(initialModule)) {
  currentModule = initialModule;
}

// Les contrôles sont branchés avant le rendu : une erreur liée à l’affichage
// ne transforme plus tout l’écran d’accueil en page inerte.
registerEvents();
registerServiceWorker();

if (currentModule !== 'rhumatologie') {
  try {
    setActivePage('module', currentModule);
  } catch (error) {
    console.error('Impossible d’ouvrir le module demandé.', error);
  }
}
renderCurrentView();
