import {
  getEpisodeViews,
  getPresenceChecks,
  getEvolution,
} from "./episodes.js";
import { getDigestive, localDate } from "./digestive.js";

// Projection commune des données : accueil et modules ne réinventent ni
// le tri ni l'identité des observations. Les rapports pourront la réutiliser.
export function getHistoryRows(data, { moduleId = null } = {}) {
  const rows = [];
  for (const source of data.entries) {
    for (const episode of getEpisodeViews(source)) {
      const item =
        data.catalog.find((candidate) => candidate.id === episode.itemId) ||
        episode.itemSnapshot;
      const family = item?.family || "autre";
      if (
        moduleId &&
        (moduleId === "symptomes-evenements"
          ? ["rhumatologie", "digestif"].includes(family)
          : family !== moduleId)
      )
        continue;
      rows.push({
        kind: "episode",
        id: `${source.id}:${episode.targetKey}`,
        occurredAt: episode.occurredAt,
        date: localDate(episode.occurredAt),
        family,
        episode,
        // Le nom courant suit un renommage ; le libellé d’origine reste sauvegardé.
        label:
          item?.label || episode.itemSnapshot?.label || "Élément indisponible",
      });
    }
  }
  if (!moduleId || moduleId === "digestif") {
    const digestive = getDigestive(data);
    for (const event of digestive.events) {
      rows.push({
        kind: "transit",
        id: event.id,
        occurredAt: event.occurredAt,
        date: event.localDate,
        family: "digestif",
        event,
        label:
          event.kind === "passage"
            ? "Passage aux toilettes"
            : "Ça s’est échappé",
      });
    }
    for (const day of digestive.days) {
      rows.push({
        kind: "day",
        id: day.id,
        date: day.date,
        family: "digestif",
        day,
        label: "Aucun passage aux toilettes",
      });
    }
  }
  return rows.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.occurredAt ? Date.parse(b.occurredAt) : -Infinity) -
        (a.occurredAt ? Date.parse(a.occurredAt) : -Infinity) ||
      a.id.localeCompare(b.id),
  );
}

/** Compare les dernières valeurs réellement connues, en sautant les blancs. */
export function getEpisodeCheckRows(episode) {
  let lastLevels = episode.levels?.length ? { levels: episode.levels } : null;
  const lastValues = {};
  for (const key of ["pain", "discomfort"]) {
    if (episode.values?.[key] != null) lastValues[key] = episode.values[key];
  }
  return getPresenceChecks(episode).map((check) => {
    let evolution = "";
    if (check.levels?.length) {
      evolution = getEvolution(lastLevels, check);
      lastLevels = check;
    } else {
      evolution = getEvolution({ values: lastValues }, check);
    }
    for (const key of ["pain", "discomfort"]) {
      if (check.values?.[key] != null) lastValues[key] = check.values[key];
    }
    return { ...check, evolution };
  });
}
