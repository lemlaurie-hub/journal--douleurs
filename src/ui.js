import { getFamilyLabel, getKindLabel } from './catalog.js';
import { BODY_MAP_REGIONS, BODY_MAP_GROUPS, getBodyMapOptions, getEntrySelections, formatSelectionLabel } from './body-map.js';
import { formatLevelRange, getMinimumDurationMs } from './entries.js?v=4.4.0';
import { calculateStats } from './stats.js';

// Cette couche ne contient pas de règles métier : elle prépare les champs et
// affiche les données. Le même formulaire sert à tous les modules et éditions.
const elements = {
  homePage: document.querySelector('#home-page'),
  modulePage: document.querySelector('#module-page'),
  moduleTitle: document.querySelector('#module-title'),
  moduleDescription: document.querySelector('#module-description'),
  homeStats: document.querySelector('#home-stats'),
  homeHistory: document.querySelector('#home-history'),
  moduleStats: document.querySelector('#module-stats'),
  entryForm: document.querySelector('#entry-form'),
  itemChoices: document.querySelector('#item-choices'),
  bodyMap: document.querySelector('#body-map'),
  bodyMapFront: document.querySelector('#body-map-front'),
  bodyMapBack: document.querySelector('#body-map-back'),
  bodyFigureSvg: document.querySelector('.body-figure-svg'),
  bodyMapTitle: document.querySelector('#body-map-title'),
  bodyMapHelp: document.querySelector('#body-map-help'),
  bodyMapOptions: document.querySelector('#body-map-options'),
  bodyMapSelectedList: document.querySelector('#body-map-selected-list'),
  manualChoicesToggle: document.querySelector('#manual-choices-toggle'),
  levels: document.querySelector('#levels'),
  occurredAt: document.querySelector('#occurred-at'),
  ongoing: document.querySelector('#ongoing'),
  note: document.querySelector('#note'),
  saveEntry: document.querySelector('#save-entry'),
  cancelEdit: document.querySelector('#cancel-edit'),
  catalogList: document.querySelector('#catalog-list'),
  moduleHistory: document.querySelector('#module-history'),
  catalogDialog: document.querySelector('#catalog-dialog'),
  finishDialog: document.querySelector('#finish-dialog'),
  finishForm: document.querySelector('#finish-form'),
  finishAt: document.querySelector('#finish-at'),
  finishTitle: document.querySelector('#finish-dialog-title'),
  finishHelp: document.querySelector('#finish-dialog-help'),
  finishLabel: document.querySelector('#finish-at-label'),
  finishSubmit: document.querySelector('#finish-submit'),
  cancelFinish: document.querySelector('#cancel-finish'),
  catalogForm: document.querySelector('#catalog-form'),
  catalogDialogTitle: document.querySelector('#catalog-dialog-title'),
  catalogLabel: document.querySelector('#catalog-label'),
  catalogFamily: document.querySelector('#catalog-family'),
  catalogKind: document.querySelector('#catalog-kind'),
  catalogBodyMap: document.querySelector('#catalog-body-map'),
  catalogBodyGroup: document.querySelector('#catalog-body-group'),
  catalogBodySides: document.querySelector('#catalog-body-sides'),
  catalogBodySurfaces: document.querySelector('#catalog-body-surfaces'),
  catalogSideRight: document.querySelector('#catalog-side-right'),
  catalogSideLeft: document.querySelector('#catalog-side-left'),
  catalogSurfaceFront: document.querySelector('#catalog-surface-front'),
  catalogSurfaceBack: document.querySelector('#catalog-surface-back'),
  saveCatalogItem: document.querySelector('#save-catalog-item'),
  toast: document.querySelector('#toast')
};

const MODULES = {
  rhumatologie: {
    title: 'Rhumato',
    description: 'Douleurs et observations rhumatologiques.',
    icon: '🦴',
    families: ['rhumatologie']
  },
  digestif: {
    title: 'Digestif',
    description: 'Symptômes et événements digestifs.',
    icon: '🌿',
    families: ['digestif']
  },
  'symptomes-evenements': {
    title: 'Symptômes / événements',
    description: 'Observations qui ne sont pas propres à un seul autre module.',
    icon: '🌀',
    families: ['symptomes-evenements', 'neurologique', 'general', 'autre']
  }
};

let editingEntry = null;
let originalDateTimeFieldValue = null;
let editingCatalogId = null;
let defaultDateTimeFieldValue = null;
let finishingEntryId = null;
let correctingEntryEnd = false;
let addingPastPresence = false;

function createEmptyMessage(text) {
  const p = document.createElement('p');
  p.className = 'empty-state';
  p.textContent = text;
  return p;
}

function formatLocalDateTime(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Date non reconnue';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatMinimumDuration(milliseconds) {
  if (!milliseconds) return '';
  const totalMinutes = Math.floor(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days} j`);
  if (hours) parts.push(`${hours} h`);
  if (minutes || parts.length === 0) parts.push(`${minutes} min`);
  return `Durée minimale constatée : au moins ${parts.join(' ')}`;
}

function toLocalInputValue(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function isItemInModule(item, moduleId) {
  return MODULES[moduleId]?.families.includes(item.family) || false;
}

function filteredData(data, moduleId) {
  const catalog = data.catalog.filter(item => isItemInModule(item, moduleId));
  const ids = new Set(catalog.map(item => item.id));
  const entries = data.entries.filter(entry => (entry.itemIds || []).some(id => ids.has(id)));
  return { ...data, catalog, entries };
}

function updateAddressBar(hash = '') {
  const nextUrl = `${location.pathname}${location.search}${hash ? `#${hash}` : ''}`;
  try {
    history.replaceState(null, '', nextUrl);
  } catch (error) {
    // La navigation visuelle doit rester fonctionnelle si l’origine refuse
    // la mise à jour de l’URL (par exemple dans certains modes installés).
    console.warn('URL de navigation non mise à jour.', error);
  }
}

export function getElements() {
  return elements;
}

export function setActivePage(page, moduleId = null) {
  elements.homePage.hidden = page !== 'home';
  elements.modulePage.hidden = page !== 'module';
  if (page !== 'module' || !MODULES[moduleId]) {
    document.title = 'Journal de suivi santé';
    updateAddressBar();
    return;
  }

  const module = MODULES[moduleId];
  elements.moduleTitle.textContent = module.title;
  elements.moduleDescription.textContent = module.description;
  document.title = `${module.title} · Journal de suivi santé`;
  updateAddressBar(moduleId);
}

export function setDefaultDateTime() {
  defaultDateTimeFieldValue = toLocalInputValue(new Date().toISOString());
  elements.occurredAt.value = defaultDateTimeFieldValue;
}

function selectedItemChoices() {
  return [...elements.itemChoices.querySelectorAll('input[type="checkbox"]:checked')]
    .map(input => ({ itemId: input.value, regionId: input.dataset.regionId || '' }));
}

function selectionKey(choice) {
  return JSON.stringify([choice.itemId, choice.regionId || '']);
}

// Un côté précis remplace le choix sans côté, mais droite et gauche coexistent.
export function reconcileItemChoice(input) {
  if (!input?.checked) return;
  for (const other of elements.itemChoices.querySelectorAll('input[type="checkbox"]')) {
    if (other !== input && other.value === input.value
        && Boolean(other.dataset.regionId) !== Boolean(input.dataset.regionId)) other.checked = false;
  }
}

export function isEntryFormDirty() {
  const itemIds = [...elements.itemChoices.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
  const levels = [...elements.levels.querySelectorAll('.level-button.is-selected')].map(button => Number(button.dataset.level));
  const note = elements.note.value;
  const occurredAt = elements.occurredAt.value;

  if (!editingEntry) {
    return itemIds.length > 0 || levels.length > 0 || elements.ongoing.checked
      || note.length > 0 || occurredAt !== defaultDateTimeFieldValue;
  }

  return JSON.stringify(selectedItemChoices().map(selectionKey).sort()) !== JSON.stringify(getEntrySelections(editingEntry).map(selectionKey).sort())
    || JSON.stringify(levels) !== JSON.stringify(editingEntry.levels || [])
    || occurredAt !== originalDateTimeFieldValue
    || elements.ongoing.checked !== Boolean(editingEntry.ongoing)
    || note !== String(editingEntry.note ?? '');
}

export function getEntryFormInput() {
  const choices = selectedItemChoices();
  const itemIds = [...new Set(choices.map(choice => choice.itemId))];
  const locations = new Map();
  for (const { itemId, regionId } of choices) {
    if (regionId) locations.set(itemId, [...(locations.get(itemId) || []), regionId]);
  }
  const itemLocations = Object.fromEntries(locations);
  const levels = [...elements.levels.querySelectorAll('.level-button.is-selected')]
    .map(button => Number(button.dataset.level));

  const occurredAt = editingEntry && elements.occurredAt.value === originalDateTimeFieldValue
    ? editingEntry.occurredAt
    : elements.occurredAt.value;

  return {
    itemIds,
    itemLocations,
    levels,
    occurredAt,
    ongoing: elements.ongoing.checked,
    note: elements.note.value
  };
}

export function getEditingEntryId() {
  return editingEntry?.id || null;
}

export function openFinishDialog(entry, { edit = false, addPresence = false } = {}) {
  finishingEntryId = entry.id;
  correctingEntryEnd = edit;
  addingPastPresence = addPresence;
  const now = new Date().toISOString();
  const lastPresence = (entry.stillAt || []).at(-1) || entry.occurredAt;
  if (addPresence) {
    elements.finishTitle.textContent = 'Quand as-tu constaté que c’était encore présent ?';
    elements.finishHelp.textContent = 'Ajoute un constat passé à cet événement. Il doit se situer après la première observation et avant la fin constatée.';
    elements.finishLabel.textContent = 'Date et heure du constat';
    elements.finishSubmit.textContent = 'Ajouter ce constat';
    elements.finishAt.min = toLocalInputValue(new Date(new Date(entry.occurredAt).getTime() + 60_000));
    elements.finishAt.max = toLocalInputValue(new Date(new Date(entry.endedAt).getTime() - 60_000));
    elements.finishAt.value = '';
  } else {
    elements.finishTitle.textContent = edit
      ? 'Quand as-tu constaté que c’était terminé ?'
      : 'Quand as-tu constaté que c’était terminé ?';
    elements.finishHelp.textContent = 'L’heure actuelle est proposée. Tu peux choisir une heure passée si tu as remarqué la disparition plus tôt.';
    elements.finishLabel.textContent = 'Date et heure constatées';
    elements.finishSubmit.textContent = edit ? 'Enregistrer la correction' : 'Enregistrer la fin constatée';
    elements.finishAt.min = toLocalInputValue(lastPresence);
    elements.finishAt.max = toLocalInputValue(now);
    elements.finishAt.value = toLocalInputValue(edit ? entry.endedAt : now);
  }
  elements.finishDialog.showModal();
}

export function getFinishingEntryId() {
  return finishingEntryId;
}

export function isCorrectingEntryEnd() {
  return correctingEntryEnd;
}

export function isAddingPastPresence() {
  return addingPastPresence;
}

export function getFinishTimestamp() {
  const timestamp = new Date(elements.finishAt.value);
  if (!elements.finishAt.value || Number.isNaN(timestamp.getTime())) {
    throw new Error('Choisis une date et une heure valides.');
  }
  return timestamp.toISOString();
}

export function closeFinishDialog() {
  finishingEntryId = null;
  correctingEntryEnd = false;
  addingPastPresence = false;
  elements.finishForm.reset();
  elements.finishAt.removeAttribute('min');
  elements.finishAt.removeAttribute('max');
  elements.finishTitle.textContent = 'Quand as-tu constaté que c’était terminé ?';
  elements.finishHelp.textContent = 'L’heure actuelle est proposée. Tu peux choisir une heure passée si tu as remarqué la disparition plus tôt.';
  elements.finishLabel.textContent = 'Date et heure constatées';
  elements.finishSubmit.textContent = 'Enregistrer la fin constatée';
  elements.finishDialog.close();
}

export function resetEntryForm() {
  editingEntry = null;
  originalDateTimeFieldValue = null;
  elements.entryForm.reset();
  elements.ongoing.disabled = false;
  elements.levels.querySelectorAll('.level-button').forEach(button => {
    button.classList.remove('is-selected');
    button.setAttribute('aria-pressed', 'false');
  });
  elements.saveEntry.textContent = 'Enregistrer';
  elements.cancelEdit.hidden = true;
  elements.entryForm.closest('.panel').querySelector('h2').textContent = 'Nouvelle observation';
  setDefaultDateTime();
}

export function beginEntryEdit(entry, data, moduleId) {
  editingEntry = entry;
  renderItemChoices(data, moduleId, getEntrySelections(entry));

  elements.levels.querySelectorAll('.level-button').forEach(button => {
    const selected = (entry.levels || []).includes(Number(button.dataset.level));
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  originalDateTimeFieldValue = toLocalInputValue(entry.occurredAt);
  elements.occurredAt.value = originalDateTimeFieldValue;
  elements.ongoing.checked = Boolean(entry.ongoing);
  elements.ongoing.disabled = Boolean(entry.stillAt?.length || entry.endedAt);
  elements.note.value = String(entry.note ?? '');
  elements.saveEntry.textContent = 'Enregistrer les corrections';
  elements.cancelEdit.hidden = false;
  elements.entryForm.closest('.panel').querySelector('h2').textContent = 'Modifier l’observation';
  elements.entryForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function refreshCatalogBodyMapControls() {
  const isZone = elements.catalogFamily.value === 'rhumatologie' && elements.catalogKind.value === 'zone';
  elements.catalogBodyMap.hidden = !isZone;
  const group = BODY_MAP_GROUPS[elements.catalogBodyGroup.value];
  elements.catalogBodySides.hidden = !isZone || !group || group.regions.length === 1;
  elements.catalogBodySurfaces.hidden = !isZone || !group;
}

function getCatalogBodyMap() {
  if (elements.catalogFamily.value !== 'rhumatologie' || elements.catalogKind.value !== 'zone') return null;
  const group = BODY_MAP_GROUPS[elements.catalogBodyGroup.value];
  if (!group) return null;
  return {
    regions: group.regions.filter(region => group.regions.length === 1
      || (region.endsWith('-right') ? elements.catalogSideRight.checked : elements.catalogSideLeft.checked)),
    surfaces: [elements.catalogSurfaceFront.checked ? 'front' : null,
      elements.catalogSurfaceBack.checked ? 'back' : null].filter(Boolean)
  };
}

export function getCatalogFormInput() {
  return {
    label: elements.catalogLabel.value,
    family: elements.catalogFamily.value,
    kind: elements.catalogKind.value,
    bodyMap: getCatalogBodyMap()
  };
}

export function getEditingCatalogId() {
  return editingCatalogId;
}

export function openCatalogDialog({ family = 'rhumatologie', item = null } = {}) {
  editingCatalogId = item?.id || null;
  elements.catalogDialogTitle.textContent = item ? 'Modifier un élément' : 'Créer un élément';
  elements.saveCatalogItem.textContent = item ? 'Enregistrer' : 'Créer';
  elements.catalogLabel.value = item?.label || '';
  elements.catalogFamily.value = item?.family || family;
  elements.catalogKind.value = item?.kind || (family === 'rhumatologie' ? 'zone' : 'symptome');
  elements.catalogBodyGroup.replaceChildren(new Option('Sans rattachement au bonhomme', ''));
  for (const [id, group] of Object.entries(BODY_MAP_GROUPS)) {
    elements.catalogBodyGroup.add(new Option(group.name, id));
  }
  const binding = item?.bodyMap;
  elements.catalogBodyGroup.value = binding
    ? (Object.entries(BODY_MAP_GROUPS).find(([, group]) => binding.regions.every(id => group.regions.includes(id)))?.[0] || '') : '';
  elements.catalogSideRight.checked = binding ? binding.regions.some(id => id.endsWith('-right')) : true;
  elements.catalogSideLeft.checked = binding ? binding.regions.some(id => id.endsWith('-left')) : true;
  elements.catalogSurfaceFront.checked = binding ? binding.surfaces.includes('front') : true;
  elements.catalogSurfaceBack.checked = binding ? binding.surfaces.includes('back') : true;
  refreshCatalogBodyMapControls();
  elements.catalogDialog.showModal();
  window.setTimeout(() => elements.catalogLabel.focus(), 0);
}

export function closeCatalogDialog() {
  editingCatalogId = null;
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
  showToast.timeoutId = window.setTimeout(() => { elements.toast.hidden = true; }, 3200);
}

function renderStats(data, target) {
  const stats = calculateStats(data);
  target.replaceChildren();
  const cards = [
    ['Observations', String(stats.totalEntries)],
    ['Jours suivis', String(stats.activeDays)],
    ['Fin non renseignée', String(stats.ongoingEntries)]
  ];

  for (const [label, value] of cards) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    const strong = document.createElement('strong');
    strong.textContent = value;
    const span = document.createElement('span');
    span.textContent = label;
    card.append(strong, span);
    target.append(card);
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
  target.append(topSection);
}

function renderHistory(data, target, { moduleId = null, limit = Infinity, actions = false } = {}) {
  target.replaceChildren();
  const entries = (moduleId ? filteredData(data, moduleId).entries : data.entries)
    .slice()
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  if (entries.length === 0) {
    target.append(createEmptyMessage(moduleId
      ? 'Aucune observation dans ce module pour le moment.'
      : 'Aucune observation enregistrée.'));
    return;
  }

  for (const entry of entries.slice(0, limit)) {
    const article = document.createElement('article');
    article.className = 'history-entry';
    const itemNames = getEntrySelections(entry).map(({ itemId, regionId }) => {
      const item = data.catalog.find(candidate => candidate.id === itemId);
      return item ? formatSelectionLabel(item, regionId) : null;
    }).filter(Boolean);
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
    level.textContent = formatLevelRange(entry.levels);
    article.append(header, level);
    if (entry.ongoing) {
      const episode = document.createElement('div');
      episode.className = 'episode-status';
      const firstCheck = document.createElement('p');
      firstCheck.className = 'ongoing-badge';
      firstCheck.textContent = 'Début de l’épisode';
      episode.append(firstCheck);
      for (const timestamp of entry.stillAt || []) {
        const check = document.createElement('p');
        check.className = 'episode-check';
        check.textContent = `Encore présent le ${formatLocalDateTime(timestamp)}`;
        episode.append(check);
      }
      if (entry.endedAt) {
        const end = document.createElement('p');
        end.className = 'episode-end';
        end.textContent = `Fin constatée le ${formatLocalDateTime(entry.endedAt)}`;
        episode.append(end);
      } else {
        const unknown = document.createElement('p');
        unknown.className = 'episode-unknown';
        unknown.textContent = 'Fin non renseignée';
        episode.append(unknown);
      }
      const durationText = formatMinimumDuration(getMinimumDurationMs(entry));
      if (durationText) {
        const duration = document.createElement('p');
        duration.className = 'episode-duration';
        duration.textContent = durationText;
        episode.append(duration);
      } else {
        const duration = document.createElement('p');
        duration.className = 'episode-duration';
        duration.textContent = 'Pas assez de constats pour calculer une durée minimale.';
        episode.append(duration);
      }
      article.append(episode);
    }
    if (entry.note) {
      const note = document.createElement('p');
      note.className = 'history-note';
      note.textContent = entry.note;
      article.append(note);
    }
    if (actions) {
      const controls = document.createElement('div');
      controls.className = 'history-actions';
      if (entry.ongoing && !entry.endedAt) {
        const stillPresentButton = document.createElement('button');
        stillPresentButton.type = 'button';
        stillPresentButton.className = 'button button-secondary button-small';
        stillPresentButton.dataset.stillPresentEntry = entry.id;
        stillPresentButton.textContent = 'Encore maintenant';
        stillPresentButton.setAttribute('aria-label', `Noter que l’événement est encore présent : ${itemNames.join(', ')}`);
        const finishButton = document.createElement('button');
        finishButton.type = 'button';
        finishButton.className = 'button button-secondary button-small';
        finishButton.dataset.finishEntry = entry.id;
        finishButton.textContent = 'C’est terminé';
        controls.append(stillPresentButton, finishButton);
      } else if (entry.ongoing && entry.endedAt) {
        const addPresenceButton = document.createElement('button');
        addPresenceButton.type = 'button';
        addPresenceButton.className = 'button button-secondary button-small';
        addPresenceButton.dataset.addPresenceEntry = entry.id;
        addPresenceButton.textContent = 'Ajouter un constat passé';
        const correctEndButton = document.createElement('button');
        correctEndButton.type = 'button';
        correctEndButton.className = 'button button-secondary button-small';
        correctEndButton.dataset.editEntryEnd = entry.id;
        correctEndButton.textContent = 'Modifier l’heure de fin';
        controls.append(addPresenceButton, correctEndButton);
      }
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'button button-secondary button-small';
      editButton.dataset.editEntry = entry.id;
      editButton.textContent = 'Modifier';
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button button-danger button-small';
      deleteButton.dataset.deleteEntry = entry.id;
      deleteButton.textContent = 'Supprimer';
      controls.append(editButton, deleteButton);
      article.append(controls);
    }
    target.append(article);
  }
}

function renderCatalog(data, moduleId) {
  elements.catalogList.replaceChildren();
  const items = data.catalog
    .filter(item => isItemInModule(item, moduleId))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  if (items.length === 0) {
    elements.catalogList.append(createEmptyMessage('Aucun élément dans ce module. Tu peux en créer un.'));
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'catalog-row';
    const main = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.label;
    const meta = document.createElement('span');
    meta.className = 'muted';
    const placement = item.bodyMap ? ` · ${item.bodyMap.regions.map(id => BODY_MAP_REGIONS[id]?.name).join(', ')} · ${item.bodyMap.surfaces.map(view => view === 'front' ? 'face' : 'dos').join(' / ')}` : '';
    meta.textContent = `${getFamilyLabel(item.family)} · ${getKindLabel(item.kind)}${placement}`;
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'button button-secondary button-small';
    editButton.dataset.editCatalog = item.id;
    editButton.textContent = 'Modifier';
    main.append(title, meta);
    row.append(main, editButton);
    elements.catalogList.append(row);
  }
}

function renderItemChoices(data, moduleId, selected = []) {
  elements.itemChoices.replaceChildren();
  const selectedKeys = new Set(selected.map(selectionKey));
  const included = new Set(selected.map(choice => choice.itemId));
  const items = data.catalog.filter(item => isItemInModule(item, moduleId) || included.has(item.id));
  if (items.length === 0) {
    elements.itemChoices.append(createEmptyMessage('Aucun élément dans ce module. Crée-en un pour commencer.'));
    return;
  }
  const sorted = [...items].sort((a, b) => getFamilyLabel(a.family).localeCompare(getFamilyLabel(b.family), 'fr')
    || a.label.localeCompare(b.label, 'fr'));
  let currentFamily = null;
  for (const item of sorted) {
    if (item.family !== currentFamily) {
      currentFamily = item.family;
      const heading = document.createElement('h3');
      heading.className = 'choice-heading';
      heading.textContent = getFamilyLabel(item.family);
      elements.itemChoices.append(heading);
    }
    const regions = new Set(item.bodyMap?.regions || ['']);
    // Une ancienne sélection reste éditable même si le catalogue a changé.
    for (const choice of selected.filter(choice => choice.itemId === item.id)) regions.add(choice.regionId);
    for (const regionId of regions) {
      const label = document.createElement('label');
      label.className = 'choice-card';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = item.id;
      input.dataset.regionId = regionId;
      input.checked = selectedKeys.has(selectionKey({ itemId: item.id, regionId }));
      const text = document.createElement('span');
      text.textContent = formatSelectionLabel(item, regionId);
      const kind = document.createElement('small');
      kind.textContent = getKindLabel(item.kind);
      label.append(input, text, kind);
      elements.itemChoices.append(label);
    }
  }
}

export function renderBodyMap(data, moduleId, state) {
  const isRhumato = moduleId === 'rhumatologie';
  elements.bodyMap.hidden = !isRhumato;
  elements.manualChoicesToggle.hidden = !isRhumato;
  elements.manualChoicesToggle.textContent = state.showAllChoices
    ? 'Masquer les autres éléments du catalogue'
    : 'Voir toutes les zones du catalogue';
  elements.itemChoices.hidden = isRhumato && !state.showAllChoices;

  elements.bodyMapFront.setAttribute('aria-pressed', String(state.view === 'front'));
  elements.bodyMapBack.setAttribute('aria-pressed', String(state.view === 'back'));
  elements.bodyMapFront.classList.toggle('is-active', state.view === 'front');
  elements.bodyMapBack.classList.toggle('is-active', state.view === 'back');
  elements.bodyFigureSvg.style.transform = state.view === 'back' ? 'scaleX(-1)' : 'none';
  document.querySelectorAll('.body-side-left, .body-side-right').forEach(side => {
    const isLeft = side.classList.contains('body-side-left');
    side.textContent = state.view === 'back'
      ? (isLeft ? 'gauche' : 'droite')
      : (isLeft ? 'droite' : 'gauche');
  });
  document.querySelectorAll('[data-body-region]').forEach(button => {
    const frontLeft = Number(button.dataset.frontLeft);
    button.style.left = `${state.view === 'back' ? 100 - frontLeft : frontLeft}%`;
    button.classList.toggle('is-selected', button.dataset.bodyRegion === state.region);
  });

  const region = BODY_MAP_REGIONS[state.region];
  elements.bodyMapTitle.textContent = region?.name || 'Choisis une zone sur le bonhomme';
  elements.bodyMapHelp.textContent = region
    ? (state.view === 'front' ? 'Précisions sur l’avant du corps.' : 'Précisions sur l’arrière du corps.')
    : 'Les précisions proposées changent entre la vue de face et la vue de dos.';
  elements.bodyMapOptions.replaceChildren();

  if (region) {
    const checkedKeys = new Set(selectedItemChoices().map(selectionKey));
    for (const option of getBodyMapOptions(data.catalog, state.region, state.view)) {
      const { label, itemId, regionId } = option;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'body-map-option';
      button.dataset.bodyMapChoice = label;
      button.dataset.bodyMapItem = itemId;
      button.dataset.bodyMapRegion = regionId;
      button.textContent = label;
      const selected = checkedKeys.has(selectionKey({ itemId, regionId }));
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      elements.bodyMapOptions.append(button);
    }
  }

  const selectedItems = selectedItemChoices().map(choice => ({ ...choice,
    item: data.catalog.find(item => item.id === choice.itemId) })).filter(choice => choice.item);
  elements.bodyMapSelectedList.replaceChildren();
  if (selectedItems.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'muted';
    empty.textContent = 'Aucune zone choisie';
    elements.bodyMapSelectedList.append(empty);
    return;
  }
  for (const { item, regionId } of selectedItems) {
    const chip = document.createElement('span');
    chip.className = 'body-map-chip';
    const label = document.createElement('span');
    label.textContent = formatSelectionLabel(item, regionId);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'body-map-remove';
    remove.dataset.bodyMapRemoveItem = item.id;
    remove.dataset.bodyMapRemoveRegion = regionId;
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Retirer ${formatSelectionLabel(item, regionId)}`);
    chip.append(label, remove);
    elements.bodyMapSelectedList.append(chip);
  }
}

export function renderAll(data, moduleId, bodyMapState = { view: 'front', region: null, showAllChoices: false }) {
  document.querySelector('#catalog-title').textContent = moduleId === 'rhumatologie'
    ? 'Zones enregistrées' : 'Éléments enregistrés';
  for (const id of Object.keys(MODULES)) {
    const count = data.catalog.filter(item => isItemInModule(item, id)).length;
    const target = document.querySelector(`#count-${id}`);
    target.textContent = `${count} élément${count > 1 ? 's' : ''}`;
  }
  renderStats(data, elements.homeStats);
  renderHistory(data, elements.homeHistory, { limit: 5 });
  renderItemChoices(data, moduleId, selectedItemChoices());
  renderBodyMap(data, moduleId, bodyMapState);
  renderStats(filteredData(data, moduleId), elements.moduleStats);
  renderHistory(data, elements.moduleHistory, { moduleId, actions: true });
  renderCatalog(data, moduleId);
}
