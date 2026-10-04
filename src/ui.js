import { getFamilyLabel, getKindLabel } from './catalog.js';
import { formatLevelRange } from './entries.js';
import { calculateStats } from './stats.js';

// Ce fichier ne contient pas de règles métier : il affiche les données
// et lit les champs de formulaire. Les validations restent dans les modules métier.

const elements = {
  entryForm: document.querySelector('#entry-form'),
  itemChoices: document.querySelector('#item-choices'),
  levels: document.querySelector('#levels'),
  occurredAt: document.querySelector('#occurred-at'),
  ongoing: document.querySelector('#ongoing'),
  note: document.querySelector('#note'),
  catalogList: document.querySelector('#catalog-list'),
  stats: document.querySelector('#stats'),
  history: document.querySelector('#history'),
  catalogDialog: document.querySelector('#catalog-dialog'),
  catalogForm: document.querySelector('#catalog-form'),
  catalogLabel: document.querySelector('#catalog-label'),
  catalogFamily: document.querySelector('#catalog-family'),
  catalogKind: document.querySelector('#catalog-kind'),
  exportData: document.querySelector('#export-data'),
  chooseImportFile: document.querySelector('#choose-import-file'),
  importFile: document.querySelector('#import-file'),
  importSummary: document.querySelector('#import-summary'),
  toast: document.querySelector('#toast')
};

function createEmptyMessage(text) {
  const p = document.createElement('p');
  p.className = 'empty-state';
  p.textContent = text;
  return p;
}

function formatLocalDateTime(isoDate) {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function getElements() {
  return elements;
}

export function setDefaultDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  elements.occurredAt.value = local;
}

export function getEntryFormInput() {
  const itemIds = [...elements.itemChoices.querySelectorAll('input[type="checkbox"]:checked')]
    .map(input => input.value);

  const levels = [...elements.levels.querySelectorAll('.level-button.is-selected')]
    .map(button => Number(button.dataset.level));

  return {
    itemIds,
    levels,
    occurredAt: elements.occurredAt.value,
    ongoing: elements.ongoing.checked,
    note: elements.note.value
  };
}

export function resetEntryForm() {
  elements.entryForm.reset();
  elements.levels.querySelectorAll('.level-button').forEach(button => {
    button.classList.remove('is-selected');
    button.setAttribute('aria-pressed', 'false');
  });
  setDefaultDateTime();
}

export function getCatalogFormInput() {
  return {
    label: elements.catalogLabel.value,
    family: elements.catalogFamily.value,
    kind: elements.catalogKind.value
  };
}

export function openCatalogDialog() {
  elements.catalogDialog.showModal();
  window.setTimeout(() => elements.catalogLabel.focus(), 0);
}

export function closeCatalogDialog() {
  elements.catalogForm.reset();
  elements.catalogDialog.close();
}

export function toggleLevelButton(button) {
  const selected = button.classList.toggle('is-selected');
  button.setAttribute('aria-pressed', String(selected));
}

export function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.dataset.type = type;
  elements.toast.hidden = false;

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 3200);
}

export function showImportSummary(result) {
  const sourceLabel = result.source === 'v3' ? 'V3' : 'V4';
  const parts = [
    `Import ${sourceLabel} terminé : ${result.addedEntries} observation(s) ajoutée(s)`,
    `${result.skippedEntries} déjà présente(s) ou ignorée(s)`,
    `${result.addedCatalogItems} élément(s) de suivi ajouté(s)`
  ];

  if (result.warnings?.length) {
    parts.push(`${result.warnings.length} avertissement(s)`);
  }

  elements.importSummary.textContent = `${parts.join(' · ')}.`;
  elements.importSummary.hidden = false;
}

export function renderCatalog(data) {
  elements.catalogList.replaceChildren();

  if (data.catalog.length === 0) {
    elements.catalogList.append(
      createEmptyMessage('Aucun élément créé pour l’instant. Ajoute une zone, un symptôme ou un événement pour commencer.')
    );
    return;
  }

  const sorted = [...data.catalog].sort((a, b) =>
    getFamilyLabel(a.family).localeCompare(getFamilyLabel(b.family), 'fr')
    || a.label.localeCompare(b.label, 'fr')
  );

  for (const item of sorted) {
    const row = document.createElement('div');
    row.className = 'catalog-row';

    const main = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.label;

    const meta = document.createElement('span');
    meta.className = 'muted';
    meta.textContent = `${getFamilyLabel(item.family)} · ${getKindLabel(item.kind)}`;

    main.append(title, meta);
    row.append(main);
    elements.catalogList.append(row);
  }
}

export function renderItemChoices(data) {
  elements.itemChoices.replaceChildren();

  if (data.catalog.length === 0) {
    elements.itemChoices.append(
      createEmptyMessage('Crée d’abord au moins un élément de suivi.')
    );
    return;
  }

  const sorted = [...data.catalog].sort((a, b) =>
    getFamilyLabel(a.family).localeCompare(getFamilyLabel(b.family), 'fr')
    || a.label.localeCompare(b.label, 'fr')
  );

  let currentFamily = null;

  for (const item of sorted) {
    if (item.family !== currentFamily) {
      currentFamily = item.family;
      const heading = document.createElement('h3');
      heading.className = 'choice-heading';
      heading.textContent = getFamilyLabel(item.family);
      elements.itemChoices.append(heading);
    }

    const label = document.createElement('label');
    label.className = 'choice-card';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = item.id;

    const text = document.createElement('span');
    text.textContent = item.label;

    const kind = document.createElement('small');
    kind.textContent = getKindLabel(item.kind);

    label.append(input, text, kind);
    elements.itemChoices.append(label);
  }
}

export function renderStats(data) {
  const stats = calculateStats(data);
  elements.stats.replaceChildren();

  const cards = [
    ['Observations', String(stats.totalEntries)],
    ['Jours suivis', String(stats.activeDays)],
    ['Encore en cours', String(stats.ongoingEntries)]
  ];

  for (const [label, value] of cards) {
    const card = document.createElement('div');
    card.className = 'stat-card';

    const strong = document.createElement('strong');
    strong.textContent = value;

    const span = document.createElement('span');
    span.textContent = label;

    card.append(strong, span);
    elements.stats.append(card);
  }

  const topSection = document.createElement('div');
  topSection.className = 'stats-top';
  const heading = document.createElement('h3');
  heading.textContent = 'Éléments les plus fréquents';
  topSection.append(heading);

  if (stats.topItems.length === 0) {
    topSection.append(createEmptyMessage('Les statistiques apparaîtront après les premières observations.'));
  } else {
    const list = document.createElement('ol');
    for (const row of stats.topItems) {
      const li = document.createElement('li');
      li.textContent = `${row.item.label} : ${row.count}`;
      list.append(li);
    }
    topSection.append(list);
  }

  elements.stats.append(topSection);
}

export function renderHistory(data) {
  elements.history.replaceChildren();

  if (data.entries.length === 0) {
    elements.history.append(createEmptyMessage('Aucune observation enregistrée.'));
    return;
  }

  for (const entry of data.entries) {
    const article = document.createElement('article');
    article.className = 'history-entry';

    const itemNames = (entry.itemIds || [])
      .map(id => data.catalog.find(item => item.id === id)?.label)
      .filter(Boolean);

    const header = document.createElement('div');
    header.className = 'history-header';

    const title = document.createElement('strong');
    title.textContent = itemNames.length ? itemNames.join(' + ') : 'Élément indisponible';

    const date = document.createElement('time');
    date.dateTime = entry.occurredAt;
    date.textContent = formatLocalDateTime(entry.occurredAt);

    header.append(title, date);

    const level = document.createElement('p');
    level.className = 'history-level';
    level.textContent = entry.levels?.length
      ? formatLevelRange(entry.levels)
      : entry.legacy?.levelLabel || 'Niveau non renseigné';

    article.append(header, level);

    if (entry.ongoing) {
      const ongoing = document.createElement('p');
      ongoing.className = 'ongoing-badge';
      ongoing.textContent = 'Encore maintenant';
      article.append(ongoing);
    }

    if (entry.note) {
      const note = document.createElement('p');
      note.className = 'history-note';
      note.textContent = entry.note;
      article.append(note);
    }

    const actions = document.createElement('div');
    actions.className = 'history-actions';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'button button-danger button-small';
    deleteButton.dataset.deleteEntry = entry.id;
    deleteButton.textContent = 'Supprimer';

    actions.append(deleteButton);
    article.append(actions);
    elements.history.append(article);
  }
}

export function renderAll(data) {
  renderCatalog(data);
  renderItemChoices(data);
  renderStats(data);
  renderHistory(data);
}
