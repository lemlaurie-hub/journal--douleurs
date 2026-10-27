import { bindNumericRange } from "./criteria-ui.js";
import { openDialog, closeDialog } from "./dialogs.js";
import { openDigestiveSymptom } from "./episode-ui.js";
import {
  BRISTOL,
  getDigestive,
  localDate,
  saveTransit,
  deleteTransit,
  confirmNoPassage,
  clearNoPassage,
  getTransitDay,
  saveCondition,
} from "./digestive.js";

// Interface du transit : toutes les règles de données sont déléguées au moteur.
// Une seule fenêtre sert à créer et corriger les passages et les accidents.
const $ = (selector) => document.querySelector(selector);
let data;
let commit;
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
  const errorField = $("#transit-error");
  errorField.textContent = "";
  try {
    action();
  } catch (error) {
    // La transaction n'a pas publié sa copie en cas d'échec : aucune
    // restauration locale, qui risquerait d'annuler une écriture réussie.
    const dialog = [...document.querySelectorAll("dialog[open]")].at(-1);
    const target =
      dialog?.id === "transit-dialog"
        ? errorField
        : dialog?.querySelector(".dialog-error");
    if (target) target.textContent = error.message;
    notify(error.message, "error");
  }
}

function selectedTypes() {
  return [...$("#transit-bristol").querySelectorAll("input:checked")].map(
    (input) => Number(input.value),
  );
}

function updateBristolMode() {
  const types = selectedTypes();
  $("#transit-mode-group").hidden = types.length !== 2;
  const intermediate = $("#transit-mode-intermediate");
  intermediate.disabled =
    types.length === 2 && Math.abs(types[0] - types[1]) !== 1;
  if (intermediate.disabled) $("#transit-mode-distinct").checked = true;
}

function renderConditions(event = null) {
  const target = $("#transit-conditions");
  target.replaceChildren();
  const current = getDigestive(data).conditions;
  const choices = [...current];
  for (const snapshot of event?.conditions || []) {
    if (!choices.some((c) => c.id === snapshot.id))
      choices.push({ ...snapshot, active: false });
  }
  for (const condition of choices) {
    const old = event?.conditions.find((c) => c.id === condition.id);
    if (!condition.active && !old) continue;
    const label = node("label", undefined, "checkbox-field");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = condition.id;
    input.checked = Boolean(old);
    label.append(
      input,
      node(
        "span",
        `${old?.label || condition.label}${condition.active ? "" : " (désactivée)"}`,
      ),
    );
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
  $("#transit-title").textContent =
    `${event ? "Modifier : " : ""}${passage ? "Passage aux toilettes" : "Ça s’est échappé"}`;
  $("#transit-at").value = dateInput(event?.occurredAt || new Date());
  $("#transit-note").value = event?.note || "";
  $("#transit-passage-fields").hidden = !passage;
  bindNumericRange(
    $("#transit-pain"),
    $("#transit-pain-value"),
    event?.pain ?? 0,
  );
  const types = event?.bristol.types || (passage ? [] : [7]);
  $("#transit-bristol")
    .querySelectorAll("input")
    .forEach((input) => {
      input.checked = types.includes(Number(input.value));
    });
  // Ne pas supposer la signification d'une double sélection : choix explicite.
  const mode = event?.bristol.mode;
  if (mode === "intermediate") $("#transit-mode-intermediate").checked = true;
  if (mode === "distinct") $("#transit-mode-distinct").checked = true;
  updateBristolMode();
  renderConditions(event);
  openDialog($("#transit-dialog"));
}

/** Conserve la précision originale si le champ minute n'a pas été changé. */
function readTransit() {
  const occurredAt =
    originalEvent &&
    $("#transit-at").value === dateInput(originalEvent.occurredAt)
      ? originalEvent.occurredAt
      : new Date($("#transit-at").value).toISOString();
  return {
    kind: $("#transit-form").dataset.kind,
    occurredAt,
    bristol: {
      types: selectedTypes(),
      mode: $("#transit-form").querySelector('[name="transit-mode"]:checked')
        ?.value,
    },
    pain: Number($("#transit-pain").value),
    note: $("#transit-note").value,
    conditionIds: [
      ...$("#transit-conditions").querySelectorAll("input:checked"),
    ].map((input) => input.value),
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
}

function renderConditionManager() {
  const target = $("#transit-condition-list");
  target.replaceChildren();
  for (const c of getDigestive(data).conditions) {
    const row = node("div", undefined, "catalog-row");
    row.append(node("span", `${c.label}${c.active ? "" : " (désactivée)"}`));
    row.append(
      button("Renommer", () => {
        editingConditionId = c.id;
        $("#transit-condition-label").value = c.label;
        $("#transit-condition-save").textContent = "✓ Enregistrer";
        $("#transit-condition-cancel").hidden = false;
        $("#transit-condition-label").focus();
      }),
    );
    row.append(
      button(c.active ? "Désactiver" : "Réactiver", () =>
        attempt(() => {
          commit((next) =>
            saveCondition(next, { label: c.label, active: !c.active }, c.id),
          );
        }),
      ),
    );
    target.append(row);
  }
}

export function renderDigestive() {
  if (!data) return;
  showDay();
  const confirmed = getTransitDay(data, localDate()).noPassage;
  const none = $("#transit-open-none");
  none.classList.toggle("is-confirmed", Boolean(confirmed));
  none.textContent = confirmed ? "✓ Aucun" : "⊘ Aucun";
  none.setAttribute("aria-pressed", String(Boolean(confirmed)));
  renderConditionManager();
}

export function setupDigestive(state, transaction, showToast) {
  data = state;
  commit = transaction;
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
    label.append(
      input,
      image,
      node("span", `Type ${index + 1} — ${description}`),
    );
    row.append(
      label,
      button("Agrandir", () => {
        $("#bristol-image").src = image.src;
        $("#bristol-image").alt = `Type ${index + 1} — ${description}`;
        $("#bristol-image-description").textContent =
          `Type ${index + 1} — ${description}`;
        openDialog($("#bristol-image-dialog"));
      }),
    );
    list.append(row);
  }
  list.addEventListener("change", (event) => {
    if (selectedTypes().length > 2) {
      event.target.checked = false;
      notify("Choisis au maximum deux types.", "error");
    }
    updateBristolMode();
  });
  $("#transit-open-passage").addEventListener("click", () =>
    openTransit("passage"),
  );
  $("#transit-open-accident").addEventListener("click", () =>
    openTransit("accident"),
  );
  $("#transit-open-symptom").addEventListener("click", openDigestiveSymptom);
  $("#transit-close").addEventListener("click", () =>
    closeDialog($("#transit-dialog")),
  );
  $("#bristol-image-close").addEventListener("click", () =>
    closeDialog($("#bristol-image-dialog")),
  );
  $("#transit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    attempt(() => {
      commit((next) => saveTransit(next, readTransit(), editingId));
      closeDialog($("#transit-dialog"), { saved: true });
      notify("Transit enregistré.");
    });
  });
  $("#transit-day").addEventListener("change", showDay);
  $("#transit-open-none").addEventListener("click", () => {
    $("#transit-day").value = localDate();
    $("#transit-day").max = localDate();
    showDay();
    openDialog($("#transit-day-dialog"));
  });
  $("#transit-day-cancel").addEventListener("click", () =>
    closeDialog($("#transit-day-dialog")),
  );
  $("#transit-day-form").addEventListener("submit", (event) => {
    event.preventDefault();
    attempt(() => {
      commit((next) => confirmNoPassage(next, $("#transit-day").value));
      closeDialog($("#transit-day-dialog"), { saved: true });
      notify("Absence de passage confirmée pour cette journée.");
    });
  });
  $("#transit-open-conditions").addEventListener("click", () => {
    resetCondition();
    openDialog($("#transit-condition-dialog"));
  });
  $("#transit-conditions-close").addEventListener("click", () => {
    if (closeDialog($("#transit-condition-dialog"))) resetCondition();
  });
  const resetCondition = () => {
    editingConditionId = null;
    $("#transit-condition-label").value = "";
    $("#transit-condition-save").textContent = "✓ Enregistrer";
    $("#transit-condition-cancel").hidden = true;
  };
  $("#transit-condition-cancel").addEventListener("click", resetCondition);
  $("#transit-condition-form").addEventListener("submit", (event) => {
    event.preventDefault();
    attempt(() => {
      const existing = getDigestive(data).conditions.find(
        (c) => c.id === editingConditionId,
      );
      commit((next) =>
        saveCondition(
          next,
          {
            label: $("#transit-condition-label").value,
            active: existing?.active ?? true,
          },
          editingConditionId,
        ),
      );
      resetCondition();
    });
  });
  $("#module-history").addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-transit-edit],[data-transit-delete],[data-day-clear]",
    );
    if (!button) return;
    attempt(() => {
      if (button.dataset.transitEdit) {
        const transit = getDigestive(data).events.find(
          (row) => row.id === button.dataset.transitEdit,
        );
        if (transit) openTransit(transit.kind, transit);
      } else if (button.dataset.transitDelete) {
        if (!window.confirm("Supprimer cet enregistrement de transit ?"))
          return;
        commit((next) => deleteTransit(next, button.dataset.transitDelete));
      } else {
        commit((next) => clearNoPassage(next, button.dataset.dayClear));
      }
    });
  });
  renderDigestive();
}
