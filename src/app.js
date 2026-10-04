import { loadData, saveData } from './storage.js';
import { createCatalogItem } from './catalog.js';
import { createEntry, deleteEntry } from './entries.js';
import { downloadExport, importFromJsonText } from './import-export.js';
import {
  closeCatalogDialog,
  getCatalogFormInput,
  getElements,
  getEntryFormInput,
  openCatalogDialog,
  renderAll,
  resetEntryForm,
  setDefaultDateTime,
  showImportSummary,
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

function handleExport() {
  try {
    downloadExport(data);
    showToast('Sauvegarde exportée.');
  } catch (error) {
    console.error('Export impossible.', error);
    showToast('Impossible d’exporter la sauvegarde.', 'error');
  }
}

async function handleImportFile(event) {
  const [file] = event.target.files || [];

  // Réinitialise immédiatement le champ : le même fichier pourra être choisi
  // une seconde fois pour vérifier l'idempotence de l'import.
  event.target.value = '';

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const result = importFromJsonText(data, text);

    // La sauvegarde n'a lieu qu'après validation et conversion complètes.
    persistAndRender();
    showImportSummary(result);

    if (result.warnings?.length) {
      console.warn('Import terminé avec avertissements :', result.warnings);
      showToast('Import terminé avec avertissements.');
    } else {
      showToast('Import terminé.');
    }
  } catch (error) {
    console.error('Import impossible.', error);
    showToast(error.message || 'Impossible d’importer ce fichier.', 'error');
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

  elements.exportData.addEventListener('click', handleExport);
  elements.chooseImportFile.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', handleImportFile);
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
