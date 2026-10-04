import { loadData, saveData } from './storage.js';
import { createCatalogItem } from './catalog.js';
import { createEntry, deleteEntry } from './entries.js';
import {
  closeCatalogDialog,
  getCatalogFormInput,
  getElements,
  getEntryFormInput,
  openCatalogDialog,
  renderAll,
  resetEntryForm,
  setDefaultDateTime,
  showToast,
  toggleLevelButton
} from './ui.js';

// Point d'entrée unique de l'application.
// Ce fichier orchestre les modules sans dupliquer leur logique métier.

const data = loadData();
const elements = getElements();

function persistAndRender() {
  saveData(data);
  renderAll(data);
}

function handleCatalogSubmit(event) {
  event.preventDefault();

  try {
    createCatalogItem(data, getCatalogFormInput());
    persistAndRender();
    closeCatalogDialog();
    showToast('Élément ajouté.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleEntrySubmit(event) {
  event.preventDefault();

  try {
    createEntry(data, getEntryFormInput());
    persistAndRender();
    resetEntryForm();
    showToast('Observation enregistrée.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleDeleteEntry(entryId) {
  const entryExists = data.entries.some(entry => entry.id === entryId);

  if (!entryExists) {
    return;
  }

  const confirmed = window.confirm('Supprimer cette observation ?');
  if (!confirmed) {
    return;
  }

  if (deleteEntry(data, entryId)) {
    persistAndRender();
    showToast('Observation supprimée.');
  }
}

function registerEvents() {
  document.querySelectorAll('[data-open-catalog]').forEach(button => {
    button.addEventListener('click', openCatalogDialog);
  });

  document.querySelector('[data-close-catalog]').addEventListener('click', closeCatalogDialog);
  elements.catalogForm.addEventListener('submit', handleCatalogSubmit);
  elements.entryForm.addEventListener('submit', handleEntrySubmit);

  elements.levels.addEventListener('click', event => {
    const button = event.target.closest('.level-button');
    if (button) {
      toggleLevelButton(button);
    }
  });

  elements.history.addEventListener('click', event => {
    const button = event.target.closest('[data-delete-entry]');
    if (button) {
      handleDeleteEntry(button.dataset.deleteEntry);
    }
  });

  elements.catalogDialog.addEventListener('click', event => {
    // Ferme la fenêtre si l'on touche l'arrière-plan, pas son contenu.
    if (event.target === elements.catalogDialog) {
      closeCatalogDialog();
    }
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
renderAll(data);
registerEvents();
registerServiceWorker();
