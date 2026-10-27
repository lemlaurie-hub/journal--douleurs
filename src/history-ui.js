import {
  getHistoryRows,
  getEpisodeCheckRows,
  getFollowupRows,
  getTodayOccurrenceRows,
} from "./history.js";
import { CRITERIA, getEditableConfig } from "./criteria.js";
import { formatLevelRange, getMinimumDurationMs } from "./entries.js?v=4.8.1";
import { formatSelectionLabel } from "./body-map.js";

function node(tag, text, className = "") {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  element.className = className;
  return element;
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function episodeAction(text, command, episode, check = null) {
  const button = node("button", text, "button button-secondary button-small");
  button.type = "button";
  button.dataset.episodeCommand = command;
  button.dataset.entryId = episode.rawEntryId;
  button.dataset.targetKey = episode.targetKey;
  if (check) button.dataset.checkId = check.id;
  return button;
}

/** Un rendu de critères suffit à tous les symptômes, sans cas par nom. */
export function renderValues(target, values, note = "") {
  for (const [key, value] of Object.entries(values || {})) {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      key === "comment"
    )
      continue;
    target.append(
      node(
        "p",
        `${CRITERIA[key]?.label || key} : ${value}${CRITERIA[key]?.type === "scale" ? " / 10" : ""}`,
      ),
    );
  }
  if (note || values?.comment)
    target.append(node("p", note || values.comment, "history-note"));
}

export function renderUnifiedHistory(
  data,
  target,
  { moduleId = null, limit = Infinity, actions = false } = {},
) {
  target.replaceChildren();
  const rows = getHistoryRows(data, { moduleId }).slice(0, limit);
  if (!rows.length)
    target.append(node("p", "Aucun événement enregistré.", "field-help"));
  for (const row of rows) {
    const article = node("article", undefined, "history-entry");
    const episode = row.episode;
    const title = episode
      ? formatSelectionLabel({ label: row.label }, episode.regionId)
      : row.label;
    article.append(node("strong", title));
    article.append(
      node(
        "p",
        `${row.family === "rhumatologie" ? "Rhumato" : row.family === "digestif" ? "Digestif" : "Symptômes / événements"} · ${row.occurredAt ? dateLabel(row.occurredAt) : new Intl.DateTimeFormat("fr-FR").format(new Date(`${row.date}T12:00:00`))}`,
        "history-family",
      ),
    );
    if (episode) {
      if (episode.levels?.length)
        article.append(node("p", formatLevelRange(episode.levels)));
      renderValues(article, episode.values, episode.note);
      for (const check of getEpisodeCheckRows(episode)) {
        const detail = node("div", undefined, "episode-check");
        detail.append(
          node(
            "p",
            `${check.evolution ? `${check.evolution} ` : ""}Encore présent le ${dateLabel(check.occurredAt)}${check.levels?.length ? ` — ${formatLevelRange(check.levels)}` : ""}`,
          ),
        );
        renderValues(detail, check.values, check.note);
        if (actions) {
          detail.append(
            episodeAction("Modifier le constat", "edit-check", episode, check),
            episodeAction(
              "Supprimer le constat",
              "delete-check",
              episode,
              check,
            ),
          );
        }
        article.append(detail);
      }
      if (episode.endedAt)
        article.append(
          node("p", `Fin constatée le ${dateLabel(episode.endedAt)}`),
        );
      else if (episode.closedUnknown)
        article.append(node("p", "Épisode terminé, heure de fin inconnue."));
      else if (
        !episode.configSnapshot ||
        episode.configSnapshot.criteria.some((key) =>
          ["stillPresent", "finish"].includes(key),
        )
      )
        article.append(node("p", "Fin non renseignée"));
      const duration = getMinimumDurationMs(episode);
      if (duration)
        article.append(
          node(
            "p",
            `Durée minimale constatée : au moins ${Math.floor(duration / 60000)} min`,
          ),
        );
      if (actions) {
        const controls = node("div", undefined, "history-actions");
        const currentItem = data.catalog.find(
          (item) => item.id === episode.itemId,
        );
        const criteria = episode.configSnapshot
          ? getEditableConfig(currentItem, episode).criteria
          : null;
        const temporal = !criteria || criteria.includes("stillPresent");
        if (temporal && !episode.endedAt && !episode.closedUnknown)
          controls.append(episodeAction("Encore maintenant", "still", episode));
        if (temporal)
          controls.append(
            episodeAction("Ajouter un constat passé", "past", episode),
          );
        if (!criteria || criteria.includes("finish"))
          controls.append(
            episodeAction(
              episode.closedUnknown
                ? "Préciser la fin"
                : episode.endedAt
                  ? "Modifier la fin"
                  : "C’est terminé",
              "finish",
              episode,
            ),
          );
        if (criteria?.includes("newOccurrence"))
          controls.append(
            episodeAction("+ Une nouvelle occurrence", "occurrence", episode),
          );
        controls.append(episodeAction("Modifier", "edit", episode));
        // L'édition d'origine conserve notamment la correction des associations V3.
        if (
          data.entries.find((entry) => entry.id === episode.rawEntryId)
            ?.episodeVersion !== 2 ||
          !episode.configSnapshot
        ) {
          const original = node(
            "button",
            "Modifier les éléments de la saisie d’origine",
            "button button-secondary button-small",
          );
          original.type = "button";
          original.dataset.editEntry = episode.rawEntryId;
          controls.append(original);
        }
        const remove = episodeAction(
          "Supprimer cet épisode",
          "delete",
          episode,
        );
        controls.append(remove);
        article.append(controls);
      }
    } else if (row.event) {
      const event = row.event;
      article.append(
        node(
          "p",
          `Bristol ${event.bristol.types.join(" + ")}${event.bristol.mode === "intermediate" ? " — aspect intermédiaire" : event.bristol.mode === "distinct" ? " — deux aspects présents" : ""}`,
        ),
      );
      if (event.kind === "passage")
        article.append(
          node("p", `Douleur à l’évacuation : ${event.pain} / 10`),
        );
      if (event.conditions.length)
        article.append(
          node(
            "p",
            event.conditions.map((condition) => condition.label).join(" · "),
          ),
        );
      if (event.note) article.append(node("p", event.note, "history-note"));
      if (actions) {
        const controls = node("div", undefined, "history-actions");
        const edit = node(
          "button",
          "Modifier",
          "button button-secondary button-small",
        );
        edit.type = "button";
        edit.dataset.transitEdit = event.id;
        const remove = node(
          "button",
          "Supprimer",
          "button button-secondary button-small",
        );
        remove.type = "button";
        remove.dataset.transitDelete = event.id;
        controls.append(edit, remove);
        article.append(controls);
      }
    } else if (actions && row.day) {
      const cancel = node(
        "button",
        "Annuler cette confirmation",
        "button button-secondary button-small",
      );
      cancel.type = "button";
      cancel.dataset.dayClear = row.day.date;
      article.append(cancel);
    }
    target.append(article);
  }
}

/** Raccourcis des pages quotidiennes : mêmes identifiants et commandes que
 * l'historique, sans second moteur de suivi ni sauvegarde séparée. */
export function renderDailyActions(data) {
  const target = document.querySelector("#home-followup");
  target.replaceChildren();
  const rows = getFollowupRows(data);
  if (!rows.length)
    target.append(node("p", "Aucun événement récent à suivre.", "field-help"));
  for (const row of rows) {
    const article = node("article", undefined, "history-entry");
    article.append(
      node(
        "strong",
        formatSelectionLabel({ label: row.label }, row.episode.regionId),
      ),
    );
    const controls = node("div", undefined, "compact-actions");
    const still = episodeAction("↻ Encore maintenant", "still", row.episode);
    still.dataset.instant = "true";
    controls.append(
      still,
      episodeAction("✓ C’est fini", "finish", row.episode),
    );
    article.append(controls);
    target.append(article);
  }
  const occurrences = document.querySelector("#today-occurrences");
  occurrences.replaceChildren();
  for (const row of getTodayOccurrenceRows(data)) {
    occurrences.append(
      episodeAction(
        `+ Nouvelle occurrence — ${row.label}`,
        "occurrence",
        row.episode,
      ),
    );
  }
}
