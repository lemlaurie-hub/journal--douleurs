import { loadData, saveData } from './storage.js';
import { createCatalogItem } from './catalog.js';
import { createEntry, deleteEntry } from './entries.js';
import { createBackup, mergeBackup } from './transfer.js';
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

function addTransferControls() {
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.setAttribute('aria-labelledby', 'backup-title');

  const heading = document.createElement('div');
  heading.className = 'section-heading';
  const titleGroup = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Sauvegarde';
  const title = document.createElement('h2');
  title.id = 'backup-title';
  title.textContent = 'Importer / exporter';
  titleGroup.append(eyebrow, title);
  heading.append(titleGroup);

  const explanation = document.createElement('p');
  explanation.className = 'field-help';
  explanation.textContent = 'Télécharge une copie JSON ou ajoute les données d’une sauvegarde sans remplacer celles de cet appareil.';

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.id = 'export-backup';
  exportButton.className = 'button button-secondary';
  exportButton.textContent = 'Télécharger la sauvegarde JSON';

  const importLabel = document.createElement('label');
  importLabel.className = 'field';
  const importText = document.createElement('span');
  importText.textContent = 'Ajouter depuis un fichier JSON';
  const importInput = document.createElement('input');
  importInput.id = 'import-backup';
  importInput.type = 'file';
  importInput.accept = '.json,application/json';
  importLabel.append(importText, importInput);

  panel.append(heading, explanation, exportButton, importLabel);
  elements.history.closest('.panel').after(panel);
}

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

  if (!entryExists) return;

  const confirmed = window.confirm('Supprimer cette observation ?');
  if (!confirmed) return;

  if (deleteEntry(data, entryId)) {
    persistAndRender();
    showToast('Observation supprimée.');
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
  document.querySelectorAll('[data-open-catalog]').forEach(button => {
    button.addEventListener('click', openCatalogDialog);
  });

  document.querySelector('[data-close-catalog]').addEventListener('click', closeCatalogDialog);
  elements.catalogForm.addEventListener('submit', handleCatalogSubmit);
  elements.entryForm.addEventListener('submit', handleEntrySubmit);
  document.querySelector('#export-backup').addEventListener('click', handleExport);
  document.querySelector('#import-backup').addEventListener('change', handleImport);

  elements.levels.addEventListener('click', event => {
    const button = event.target.closest('.level-button');
    if (button) toggleLevelButton(button);
  });

  elements.history.addEventListener('click', event => {
    const button = event.target.closest('[data-delete-entry]');
    if (button) handleDeleteEntry(button.dataset.deleteEntry);
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
renderAll(data);
addTransferControls();
registerEvents();
registerServiceWorker();
