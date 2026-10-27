import { getItemConfig, getEditableConfig, initialValues } from "./criteria.js";
import { renderCriteriaFields, readCriteriaFields } from "./criteria-ui.js";
import { createCatalogItem, getDigestiveSymptomChoices } from "./catalog.js";
import {
  createIndependentEntries,
  getEpisode,
  getPresenceChecks,
  savePresenceCheck,
  deletePresenceCheck,
  finishEpisode,
  updateEpisode,
  addOccurrence,
  deleteEpisode,
} from "./episodes.js";
import { openDialog, closeDialog } from "./dialogs.js";

const $ = (selector) => document.querySelector(selector);
let data;
let commit;
let notify;
let callbacks;
let state = {};

function localInput(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function renderLevels(levels = []) {
  const target = $("#episode-levels");
  target.replaceChildren();
  ["Supportable", "Gênante", "Limitante", "Invalidante"].forEach(
    (label, index) => {
      const row = document.createElement("label");
      row.className = "checkbox-field";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(index + 1);
      input.checked = levels.includes(index + 1);
      row.append(input, document.createTextNode(label));
      target.append(row);
    },
  );
}

function populateSymptoms(selected = "") {
  const select = $("#episode-symptom");
  select.replaceChildren(new Option("Choisir un symptôme ou événement", ""));
  getDigestiveSymptomChoices(data).forEach((item) =>
    select.add(new Option(item.label, item.id)),
  );
  select.value = selected;
}

function selectedItem() {
  const value = $("#episode-symptom").value;
  const choice = getDigestiveSymptomChoices(data).find(
    (item) => item.id === value,
  );
  if (choice?.id.startsWith("preset:")) {
    const { id, ...input } = choice;
    return input;
  }
  return choice || null;
}

function renderSelectedSymptom() {
  const item = selectedItem();
  state.config = item ? getItemConfig(item) : { version: 1, criteria: [] };
  renderCriteriaFields(
    $("#episode-fields"),
    state.config,
    initialValues(state.config),
    { prefix: "episode" },
  );
}

export function openDigestiveSymptom() {
  state = { mode: "create", timestamp: new Date().toISOString() };
  $("#episode-form").reset();
  $("#episode-end-unknown-group").hidden = true;
  $("#episode-at-label").textContent = "Date et heure";
  $("#episode-at").disabled = false;
  $("#episode-at").required = true;
  $("#episode-title").textContent = "Symptôme digestif";
  $("#episode-symptom-group").hidden = false;
  $("#episode-symptom").required = true;
  $("#episode-levels-group").hidden = true;
  $("#episode-fields").hidden = false;
  $("#episode-preserve-group").hidden = true;
  $("#episode-at").value = localInput(state.timestamp);
  populateSymptoms();
  renderSelectedSymptom();
  openDialog($("#episode-dialog"));
}

function openEpisodeAction(
  mode,
  episode,
  checkId = null,
  clickedAt = new Date().toISOString(),
) {
  const check = checkId
    ? getPresenceChecks(episode).find((row) => row.id === checkId)
    : null;
  const item =
    data.catalog.find((row) => row.id === episode.itemId) ||
    episode.itemSnapshot;
  const rhumato =
    item?.family === "rhumatologie" ||
    (!episode.configSnapshot && episode.levels?.length > 0);
  const names = {
    edit: "Modifier l’épisode",
    still: "Encore maintenant",
    past: "Ajouter un constat passé",
    finish: "Fin constatée",
    "edit-check": "Modifier le constat",
  };
  state = {
    mode,
    entryId: episode.rawEntryId,
    key: episode.targetKey,
    checkId,
    rhumato,
    timestamp:
      mode === "edit"
        ? episode.occurredAt
        : check?.occurredAt ||
          (mode === "finish" && episode.endedAt) ||
          clickedAt,
  };
  $("#episode-form").reset();
  $("#episode-title").textContent =
    `${names[mode]} — ${item?.label || episode.itemSnapshot?.label || "Observation"}`;
  $("#episode-symptom-group").hidden = true;
  $("#episode-symptom").required = false;
  // Le constat de fin est distinct de l'heure réelle de fin.
  $("#episode-end-unknown-group").hidden = mode !== "finish";
  $("#episode-end-unknown").checked = mode === "finish" && !episode.endedAt;
  $("#episode-end-unknown").disabled = Boolean(episode.endedAt);
  $("#episode-at-label").textContent =
    mode === "finish" ? "Heure réelle de fin (si connue)" : "Date et heure";
  $("#episode-at").required = mode !== "finish" || Boolean(episode.endedAt);
  $("#episode-at").disabled = mode === "finish" && !episode.endedAt;
  $("#episode-at").value =
    mode === "past" || (mode === "finish" && !episode.endedAt)
      ? ""
      : localInput(state.timestamp);
  $("#episode-levels-group").hidden = !rhumato || mode === "finish";
  $("#episode-fields").hidden = rhumato || mode === "finish";
  $("#episode-preserve-group").hidden = mode !== "edit";
  $("#episode-preserve").checked = true;
  renderLevels(mode === "edit" ? episode.levels : check?.levels || []);
  if (!rhumato && mode !== "finish") {
    const fullConfig = getEditableConfig(item, episode);
    state.config =
      mode === "edit"
        ? fullConfig
        : {
            ...fullConfig,
            criteria: fullConfig.criteria.filter((key) =>
              ["pain", "discomfort", "comment"].includes(key),
            ),
          };
    const values =
      mode === "edit"
        ? {
            ...(episode.values || {}),
            comment: episode.note || episode.values?.comment || "",
          }
        : check
          ? {
              ...check.values,
              comment: check.note || check.values?.comment || "",
            }
          : initialValues(state.config);
    renderCriteriaFields($("#episode-fields"), state.config, values, {
      prefix: "episode",
    });
  } else {
    // Le commentaire reste facultatif pour les douleurs rhumatologiques.
    state.config = { version: 1, criteria: ["comment"] };
    if (rhumato && mode !== "finish") {
      $("#episode-fields").hidden = false;
      renderCriteriaFields(
        $("#episode-fields"),
        state.config,
        { comment: mode === "edit" ? episode.note : check?.note || "" },
        { prefix: "episode" },
      );
    }
  }
  openDialog($("#episode-dialog"));
}

function showError(error) {
  const target = $("#episode-dialog").querySelector(".dialog-error");
  if (target) target.textContent = error.message;
  notify(error.message, "error");
}

/** Les boutons de toutes les familles empruntent les mêmes commandes. */
export function handleEpisodeCommand(button) {
  const clickedAt = new Date().toISOString();
  try {
    const episode = getEpisode(
      data,
      button.dataset.entryId,
      button.dataset.targetKey,
    );
    const command = button.dataset.episodeCommand;
    if (command === "still" && button.dataset.instant === "true") {
      // Le raccourci confirme la présence uniquement : aucune intensité supposée.
      commit((next) =>
        savePresenceCheck(next, episode.rawEntryId, episode.targetKey, {
          occurredAt: clickedAt,
          values: {},
          levels: [],
          note: "",
        }),
      );
      notify("Encore présent : constat enregistré à l’heure du clic.");
    } else if (command === "occurrence") {
      commit((next) =>
        addOccurrence(next, episode.rawEntryId, episode.targetKey, clickedAt),
      );
      notify(
        "Nouvelle occurrence enregistrée. Tu peux la compléter dans l’historique.",
      );
    } else if (command === "delete-check") {
      if (window.confirm("Supprimer uniquement ce constat ?"))
        commit((next) =>
          deletePresenceCheck(
            next,
            episode.rawEntryId,
            episode.targetKey,
            button.dataset.checkId,
          ),
        );
    } else if (command === "delete") {
      if (
        window.confirm(
          "Supprimer cet épisode sans supprimer les autres zones ?",
        )
      )
        commit((next) =>
          deleteEpisode(next, episode.rawEntryId, episode.targetKey),
        );
    } else
      openEpisodeAction(command, episode, button.dataset.checkId, clickedAt);
  } catch (error) {
    showError(error);
  }
}

export function setupEpisodeUi(source, transaction, showToast, options) {
  data = source;
  commit = transaction;
  notify = showToast;
  callbacks = options;
  $("#episode-end-unknown").addEventListener("change", (event) => {
    $("#episode-at").disabled = event.target.checked;
    $("#episode-at").required = !event.target.checked;
  });
  $("#episode-symptom").addEventListener("change", renderSelectedSymptom);
  $("#episode-new-symptom").addEventListener("click", () =>
    callbacks.openCatalog({ family: "digestif" }),
  );
  $("#episode-cancel").addEventListener("click", () =>
    closeDialog($("#episode-dialog")),
  );
  document.addEventListener("catalog-saved", (event) => {
    if (
      !$("#episode-dialog").open ||
      state.mode !== "create" ||
      event.detail.family !== "digestif"
    )
      return;
    populateSymptoms(event.detail.id);
    renderSelectedSymptom();
  });
  $("#episode-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const inputTime = $("#episode-at").value;
      const occurredAt =
        state.mode === "finish" && $("#episode-end-unknown").checked
          ? null
          : inputTime === localInput(state.timestamp)
            ? state.timestamp
            : new Date(inputTime).toISOString();
      const values = readCriteriaFields($("#episode-fields"));
      const levels = [
        ...$("#episode-levels").querySelectorAll("input:checked"),
      ].map((input) => Number(input.value));
      if (state.mode === "create") {
        const chosen = selectedItem();
        if (!chosen) throw new Error("Choisis un symptôme ou un événement.");
        commit((next) => {
          const item = chosen.id
            ? next.catalog.find((row) => row.id === chosen.id)
            : createCatalogItem(next, chosen);
          return createIndependentEntries(next, {
            itemIds: [item.id],
            occurredAt,
            values,
            note: values.comment || "",
          });
        });
      } else if (state.mode === "finish")
        commit((next) =>
          finishEpisode(next, state.entryId, state.key, occurredAt),
        );
      else {
        const input = {
          occurredAt,
          values,
          levels,
          note: values.comment || "",
          preservePreviousObservation: $("#episode-preserve").checked,
        };
        if (state.mode === "edit")
          commit((next) =>
            updateEpisode(next, state.entryId, state.key, input),
          );
        else
          commit((next) =>
            savePresenceCheck(
              next,
              state.entryId,
              state.key,
              input,
              state.checkId,
            ),
          );
      }
      closeDialog($("#episode-dialog"), { saved: true });
      notify("Enregistrement effectué.");
    } catch (error) {
      showError(error);
    }
  });
}
