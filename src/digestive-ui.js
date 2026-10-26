import {
  BRISTOL, getDigestive, localDate, saveTransit, deleteTransit,
  confirmNoPassage, clearNoPassage, getTransitDay, saveCondition,
} from "./digestive.js";

// Interface du transit : toutes les règles de données sont déléguées au moteur.
// Une seule fenêtre sert à créer et corriger les passages et les accidents.
const $ = (selector) => document.querySelector(selector);
let data;
let persist;
let notify;
let editingId = null;
let editingConditionId = null;
let originalEvent = null;

function node(tag, text, className = "") {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  element.className = className;
  return element;
}

function button(text, action) {
  const result = node("button", text, "button button-secondary button-small");
  result.type = "button";
  result.addEventListener("click", action);
  return result;
}

function dateInput(value) {
  const date = new Date(value);
  return `${localDate(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Affiche une erreur sans fermer le formulaire ni perdre les choix. */
function attempt(action) {
  const before = structuredClone(data);
  const errorField = $("#transit-error");
  errorField.textContent = "";
  try { action(); } catch (error) {
    // Quota ou lecture impossible : ne pas garder une modification non sauvegardée en mémoire.
    for (const key of Object.keys(data)) delete data[key];
    Object.assign(data, before);
    if ($("#transit-dialog").open) errorField.textContent = error.message;
    notify(error.message, "error");
  }
}

function selectedTypes() {
  return [...$("#transit-bristol").querySelectorAll("input:checked")].map((input) => Number(input.value));
}

function updateBristolMode() {
  const types = selectedTypes();
  $("#transit-mode-group").hidden = types.length !== 2;
  const intermediate = $("#transit-mode-intermediate");
  intermediate.disabled = types.length === 2 && Math.abs(types[0] - types[1]) !== 1;
  if (intermediate.disabled) $("#transit-mode-distinct").checked = true;
}

function renderConditions(event = null) {
  const target = $("#transit-conditions");
  target.replaceChildren();
  const current = getDigestive(data).conditions;
  const choices = [...current];
  for (const snapshot of event?.conditions || []) {
    if (!choices.some((c) => c.id === snapshot.id)) choices.push({ ...snapshot, active: false });
  }
  for (const condition of choices) {
    const old = event?.conditions.find((c) => c.id === condition.id);
    if (!condition.active && !old) continue;
    const label = node("label", undefined, "checkbox-field");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = condition.id;
    input.checked = Boolean(old);
    label.append(input, node("span", `${old?.label || condition.label}${condition.active ? "" : " (désactivée)"}`));
    target.append(label);
  }
}

function openTransit(kind, event = null) {
  editingId = event?.id || null;
  originalEvent = event;
  const form = $("#transit-form");
  form.reset();
  $("#transit-error").textContent = "";
  form.dataset.kind = event?.kind || kind;
  const passage = form.dataset.kind === "passage";
  $("#transit-title").textContent = `${event ? "Modifier : " : ""}${passage ? "Passage aux toilettes" : "Ça s’est échappé"}`;
  $("#transit-at").value = dateInput(event?.occurredAt || new Date());
  $("#transit-note").value = event?.note || "";
  $("#transit-passage-fields").hidden = !passage;
  $("#transit-pain").value = event?.pain ?? 0;
  $("#transit-pain-value").textContent = `${event?.pain ?? 0} / 10`;
  const types = event?.bristol.types || (passage ? [] : [7]);
  $("#transit-bristol").querySelectorAll("input").forEach((input) => {
    input.checked = types.includes(Number(input.value));
  });
  // Ne pas supposer la signification d'une double sélection : choix explicite.
  const mode = event?.bristol.mode;
  if (mode === "intermediate") $("#transit-mode-intermediate").checked = true;
  if (mode === "distinct") $("#transit-mode-distinct").checked = true;
  updateBristolMode();
  renderConditions(event);
  $("#transit-dialog").showModal();
}

/** Conserve la précision originale si le champ minute n'a pas été changé. */
function readTransit() {
  const occurredAt = originalEvent && $("#transit-at").value === dateInput(originalEvent.occurredAt)
    ? originalEvent.occurredAt : new Date($("#transit-at").value).toISOString();
  return {
    kind: $("#transit-form").dataset.kind,
    occurredAt,
    bristol: { types: selectedTypes(), mode: $("#transit-form").querySelector('[name="transit-mode"]:checked')?.value },
    pain: Number($("#transit-pain").value),
    note: $("#transit-note").value,
    conditionIds: [...$("#transit-conditions").querySelectorAll("input:checked")].map((input) => input.value),
  };
}

function showDay() {
  const date = $("#transit-day").value;
  if (!date) return;
  const day = getTransitDay(data, date);
  $("#transit-day-status").textContent = day.passages
    ? `${day.passages} passage(s) enregistré(s)${day.accidents ? ` et ${day.accidents} accident(s)` : ""}.`
    : day.noPassage
      ? `Aucun passage aux toilettes confirmé.${day.accidents ? ` ${day.accidents} accident(s) enregistré(s) : il y a eu émission de selles.` : " Aucune émission de selles enregistrée ce jour."}`
      : day.accidents
        ? `${day.accidents} accident(s) enregistré(s). Les passages aux toilettes restent non renseignés.`
        : "Journée non renseignée.";
  $("#transit-confirm-none").disabled = Boolean(day.passages || day.noPassage);
  $("#transit-clear-none").hidden = !day.noPassage;
}

function formatBristol(bristol) {
  return bristol.types.length === 1 ? `Bristol ${bristol.types[0]}`
    : `Bristol ${bristol.types.join(" + ")} — ${bristol.mode === "intermediate" ? "aspect intermédiaire" : "deux aspects présents"}`;
}

function renderTransitHistory() {
  const target = $("#transit-history");
  target.replaceChildren();
  const state = getDigestive(data);
  const rows = [
    ...state.events.map((event) => ({ date: event.localDate, time: event.occurredAt, event })),
    ...state.days.map((day) => ({ date: day.date, time: "", day })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  if (!rows.length) target.append(node("p", "Aucun transit enregistré.", "field-help"));
  for (const row of rows) {
    const article = node("article", undefined, "history-entry");
    if (row.day) {
      article.append(node("strong", `${new Intl.DateTimeFormat("fr-FR").format(new Date(`${row.date}T12:00:00`))} — Aucun passage aux toilettes`));
      if (getTransitDay(data, row.date).accidents) article.append(node("p", "Un accident avec émission de selles est enregistré ce jour."));
      article.append(button("Annuler cette confirmation", () => attempt(() => {
        clearNoPassage(data, row.date); persist();
      })));
    } else {
      const event = row.event;
      article.append(node("strong", event.kind === "passage" ? "Passage aux toilettes" : "Ça s’est échappé"));
      article.append(node("p", new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt))));
      article.append(node("p", formatBristol(event.bristol)));
      if (event.kind === "passage") article.append(node("p", `Douleur à l’évacuation : ${event.pain} / 10`));
      if (event.conditions.length) article.append(node("p", event.conditions.map((c) => c.label).join(" · ")));
      if (event.note) article.append(node("p", event.note, "history-note"));
      const actions = node("div", undefined, "form-actions");
      actions.append(button("Modifier", () => openTransit(event.kind, event)));
      actions.append(button("Supprimer", () => attempt(() => {
        if (!window.confirm("Supprimer cet enregistrement de transit ?")) return;
        deleteTransit(data, event.id); persist();
      })));
      article.append(actions);
    }
    target.append(article);
  }
}

function renderConditionManager() {
  const target = $("#transit-condition-list");
  target.replaceChildren();
  for (const c of getDigestive(data).conditions) {
    const row = node("div", undefined, "catalog-row");
    row.append(node("span", `${c.label}${c.active ? "" : " (désactivée)"}`));
    row.append(button("Renommer", () => {
      editingConditionId = c.id;
      $("#transit-condition-label").value = c.label;
      $("#transit-condition-save").textContent = "Enregistrer le nom";
      $("#transit-condition-cancel").hidden = false;
      $("#transit-condition-label").focus();
    }));
    row.append(button(c.active ? "Désactiver" : "Réactiver", () => attempt(() => {
      saveCondition(data, { label: c.label, active: !c.active }, c.id); persist();
    })));
    target.append(row);
  }
}

export function renderDigestive() {
  if (!data) return;
  renderTransitHistory();
  showDay();
  renderConditionManager();
}

export function setupDigestive(state, persistAndRender, showToast) {
  data = state;
  persist = persistAndRender;
  notify = showToast;
  $("#transit-day").value = localDate();
  $("#transit-day").max = localDate();
  const list = $("#transit-bristol");
  for (const [index, description] of BRISTOL.entries()) {
    const row = node("div", undefined, "bristol-row");
    const label = node("label", undefined, "bristol-choice");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = String(index + 1);
    const image = document.createElement("img");
    image.src = `./images/bristol-${index + 1}.webp`;
    image.alt = "";
    image.width = 120;
    image.height = 80;
    label.append(input, image, node("span", `Type ${index + 1} — ${description}`));
    row.append(label, button("Agrandir", () => {
      $("#bristol-image").src = image.src;
      $("#bristol-image").alt = `Type ${index + 1} — ${description}`;
      $("#bristol-image-description").textContent = `Type ${index + 1} — ${description}`;
      $("#bristol-image-dialog").showModal();
    }));
    list.append(row);
  }
  list.addEventListener("change", (event) => {
    if (selectedTypes().length > 2) {
      event.target.checked = false;
      notify("Choisis au maximum deux types.", "error");
    }
    updateBristolMode();
  });
  $("#transit-open-passage").addEventListener("click", () => openTransit("passage"));
  $("#transit-open-accident").addEventListener("click", () => openTransit("accident"));
  $("#transit-open-symptom").addEventListener("click", () => $("#entry-form").scrollIntoView({ behavior: "smooth" }));
  $("#transit-open-history").addEventListener("click", () => {
    $("#transit-history-details").open = true;
    $("#transit-history-details").scrollIntoView({ behavior: "smooth" });
  });
  $("#transit-close").addEventListener("click", () => $("#transit-dialog").close());
  $("#bristol-image-close").addEventListener("click", () => $("#bristol-image-dialog").close());
  $("#transit-pain").addEventListener("input", (event) => {
    $("#transit-pain-value").textContent = `${event.target.value} / 10`;
  });
  $("#transit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    attempt(() => {
      saveTransit(data, readTransit(), editingId);
      persist();
      $("#transit-dialog").close();
      notify("Transit enregistré.");
    });
  });
  $("#transit-day").addEventListener("change", showDay);
  $("#transit-confirm-none").addEventListener("click", () => attempt(() => {
    confirmNoPassage(data, $("#transit-day").value); persist();
    notify("Absence de passage confirmée pour cette journée.");
  }));
  $("#transit-clear-none").addEventListener("click", () => attempt(() => {
    clearNoPassage(data, $("#transit-day").value); persist();
  }));
  const resetCondition = () => {
    editingConditionId = null;
    $("#transit-condition-label").value = "";
    $("#transit-condition-save").textContent = "Ajouter";
    $("#transit-condition-cancel").hidden = true;
  };
  $("#transit-condition-cancel").addEventListener("click", resetCondition);
  $("#transit-condition-form").addEventListener("submit", (event) => {
    event.preventDefault();
    attempt(() => {
      const existing = getDigestive(data).conditions.find((c) => c.id === editingConditionId);
      saveCondition(data, { label: $("#transit-condition-label").value, active: existing?.active ?? true }, editingConditionId);
      persist(); resetCondition();
    });
  });
  renderDigestive();
}
