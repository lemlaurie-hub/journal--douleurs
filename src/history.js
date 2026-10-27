import { isItemInModule } from "./catalog.js";
import {
  getEpisodeViews,
  getPresenceChecks,
  getEvolution,
  lastPresence,
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
      if (!isItemInModule({ family }, moduleId)) continue;
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

/** Le délai de 48 h est un filtre d'affichage, jamais une clôture. */
export function getFollowupRows(data, now = Date.now()) {
  return getHistoryRows(data)
    .filter((row) => {
      const episode = row.episode;
      if (!episode || episode.endedAt || episode.closedUnknown) return false;
      const criteria = episode.configSnapshot?.criteria;
      if (
        criteria &&
        !criteria.some((key) => ["stillPresent", "finish"].includes(key))
      )
        return false;
      const age = Number(now) - Date.parse(lastPresence(episode));
      return age >= 0 && age < 48 * 60 * 60 * 1000;
    })
    .sort(
      (a, b) =>
        Date.parse(lastPresence(b.episode)) -
        Date.parse(lastPresence(a.episode)),
    );
}

/** Un raccourci par symptôme déclaré ce jour, sans heure supposée. */
export function getTodayOccurrenceRows(data, now = new Date()) {
  const seen = new Set();
  return getHistoryRows(data, { moduleId: "digestif" }).filter((row) => {
    if (
      !row.episode ||
      row.date !== localDate(now) ||
      seen.has(row.episode.itemId)
    )
      return false;
    const item = data.catalog.find((item) => item.id === row.episode.itemId);
    const criteria =
      item?.config?.criteria || row.episode.configSnapshot?.criteria || [];
    if (!criteria.includes("newOccurrence")) return false;
    seen.add(row.episode.itemId);
    return true;
  });
}

/** Prochain changement d'affichage : expiration exacte ou minuit local. */
export function nextDailyRefreshAt(data, now = Date.now()) {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.min(
    midnight.getTime(),
    ...getFollowupRows(data, now).map(
      (row) => Date.parse(lastPresence(row.episode)) + 48 * 60 * 60 * 1000,
    ),
  );
}
