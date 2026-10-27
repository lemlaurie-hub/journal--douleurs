// Test d'intégration réel, exécuté séparément de npm test.
// PLAYWRIGHT_MODULE et CHROMIUM_PATH permettent d'utiliser un navigateur externe
// sans ajouter de dépendance à l'application distribuée.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = process.env.QA_OUTPUT || resolve(root, "../qa-audit-actions");
await mkdir(output, { recursive: true });
const types = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    const file = resolve(
      root,
      path === "/" ? "index.html" : `.${decodeURIComponent(path)}`,
    );
    if (!file.startsWith(`${root}/`)) throw new Error("Chemin extérieur");
    res.setHeader("Content-Type", types[extname(file)] || "text/plain");
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-zygote",
  ],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "fr-FR",
  timezoneId: "Europe/Paris",
  colorScheme: "light",
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const db = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("journalSante.v4")));
const chooseDate = (value) => page.locator("#episode-at").fill(value);
let checks = 0;
function ok(label) {
  checks++;
  console.log(`OK ${label}`);
}

const fixed = new Date("2026-02-04T12:00:01.123Z");
await page.clock.install({ time: fixed });
await page.clock.setFixedTime(fixed);

// Chaque point d'entrée repart du même historique synthétique. Les résultats
// sauvegardés sont comparés, pas seulement le titre ou l'ouverture de la fiche.
async function seed(kind) {
  await page.goto(base);
  await page.evaluate(async (kind) => {
    const {
      createIndependentEntries,
      getEpisode,
      savePresenceCheck,
      addOccurrence,
    } = await import("./src/episodes.js");
    const { mergeBackup } = await import("./src/transfer.js");
    let data = { schemaVersion: 1, catalog: [], entries: [], settings: {} };
    const at = (hour) =>
      `2026-02-04T${String(hour).padStart(2, "0")}:00:00.000Z`;
    let id;
    if (kind.startsWith("v3")) {
      const zones =
        kind === "v3-group"
          ? ["Genou droit", "Épaule gauche"]
          : ["Genou droit"];
      data = mergeBackup(
        data,
        JSON.stringify([
          {
            id: "old-import",
            date: at(8),
            zones,
            level: "😕 Gênante",
            note: "Conduite",
          },
        ]),
      ).data;
      id = data.entries[0].id;
    } else {
      const numeric = kind !== "rhumato";
      const config = {
        version: 1,
        criteria: ["pain", "discomfort", "comment", "stillPresent", "finish"],
      };
      data.catalog.push({
        id: "item",
        label: numeric ? "Crampe" : "Genou droit",
        family: numeric ? "digestif" : "rhumatologie",
        kind: numeric ? "symptome" : "zone",
        ...(numeric ? { config } : {}),
      });
      const entry = createIndependentEntries(data, {
        itemIds: ["item"],
        occurredAt: at(8),
        levels: [2],
        values:
          kind === "unknown"
            ? { pain: null, discomfort: null }
            : { pain: 3, discomfort: 0 },
        note: "Initial",
      })[0];
      id = entry.id;
    }
    const ep = getEpisode(
      data,
      id,
      kind === "v3-group"
        ? JSON.stringify([data.entries[0].itemIds[0], ""])
        : null,
    );
    if (kind !== "unknown")
      savePresenceCheck(data, id, ep.targetKey, {
        occurredAt: at(9),
        values: kind === "numeric" ? { pain: 7 } : {},
        levels: kind === "numeric" ? [] : [3],
        note: "Ne pas recopier",
      });
    savePresenceCheck(data, id, ep.targetKey, {
      occurredAt: at(10),
      values: {},
      levels: [],
      note: "",
    });
    data.testTarget = { id, key: ep.targetKey };
    localStorage.setItem("journalSante.v4", JSON.stringify(data));
  }, kind);
  await page.goto(base);
  return (await db()).testTarget;
}
async function openAction(target, entryPoint, command) {
  if (entryPoint === "history") {
    if (await page.locator("#module-page").isVisible())
      await page.locator("[data-go-home]").click();
    const stored = await db();
    const item = stored.catalog.find((i) => i.id === JSON.parse(target.key)[0]);
    const family = item.family === "digestif" ? "digestif" : "rhumatologie";
    await page.locator(`[data-open-module="${family}"]`).click();
    await page
      .locator("#module-history")
      .evaluate((el) => (el.closest("details").open = true));
  }
  const root = entryPoint === "home" ? "#home-followup" : "#module-history";
  const buttons = page.locator(`${root} [data-episode-command="${command}"]`);
  await buttons.evaluateAll(
    (nodes, key) =>
      nodes.forEach(
        (n) => (n.dataset.testTarget = String(n.dataset.targetKey === key)),
      ),
    target.key,
  );
  await page
    .locator(
      `${root} [data-episode-command="${command}"][data-test-target="true"]`,
    )
    .click();
}
async function projected(target) {
  return page.evaluate(async (target) => {
    const { getEpisode } = await import("./src/episodes.js");
    return getEpisode(
      JSON.parse(localStorage.getItem("journalSante.v4")),
      target.id,
      target.key,
    );
  }, target);
}
try {
  await page.goto(base);
  const outcomes = {};
  for (const kind of [
    "numeric",
    "unknown",
    "rhumato",
    "v3-single",
    "v3-group",
  ]) {
    for (const entryPoint of ["home", "history"]) {
      const target = await seed(kind);
      const before = await db();
      const prior = await projected(target);
      await openAction(target, entryPoint, "still");
      assert.equal(await page.locator("#episode-dialog").isVisible(), true);
      assert.deepEqual(await db(), before);
      if (kind === "numeric") {
        assert.equal(await page.locator("#episode-pain").inputValue(), "7");
        assert.equal(
          await page.locator("#episode-discomfort").inputValue(),
          "0",
        );
        assert.equal(await page.locator("#episode-comment").inputValue(), "");
      } else if (kind === "unknown") {
        assert.equal(
          await page.locator("#episode-pain").getAttribute("data-unanswered"),
          "true",
        );
        assert.equal(
          await page
            .locator("#episode-discomfort")
            .getAttribute("data-unanswered"),
          "true",
        );
      } else {
        assert.deepEqual(
          await page
            .locator("#episode-levels input:checked")
            .evaluateAll((nodes) => nodes.map((n) => n.value)),
          ["3"],
        );
      }
      await page.locator("#episode-cancel").click();
      assert.deepEqual(await db(), before);
      await openAction(target, entryPoint, "still");
      if (kind === "numeric" || kind === "unknown")
        await page.locator("#episode-pain").fill("1");
      else await page.locator('#episode-levels input[value="1"]').check();
      page.once("dialog", (dialog) => dialog.accept());
      await page.locator("#episode-cancel").click();
      assert.deepEqual(await db(), before);
      await openAction(target, entryPoint, "still");
      if (kind === "numeric") await page.locator("#episode-pain").fill("5");
      await page.locator('#episode-form button[type="submit"]').click();
      const after = await projected(target);
      const check = after.checks.at(-1);
      assert.deepEqual(after.checks.slice(0, -1), prior.checks);
      assert.equal(check.occurredAt, fixed.toISOString());
      assert.equal(check.note, "");
      if (kind === "numeric")
        assert.deepEqual(check.values, { pain: 5, discomfort: 0 });
      if (kind === "unknown") assert.deepEqual(check.values, {});
      const initial = before.entries.find((e) => e.id === target.id);
      assert.deepEqual(after.levels, initial.levels);
      assert.deepEqual(after.values, initial.values);
      assert.equal(after.occurredAt, initial.occurredAt);
      assert.equal(after.note, initial.note);
      assert.equal((await db()).entries.length, before.entries.length);
      if (kind === "v3-group") {
        const raw = (await db()).entries[0];
        const { targetStates, ...preserved } = raw;
        const { targetStates: oldStates, ...oldRaw } = initial;
        assert.deepEqual(preserved, oldRaw);
        assert.equal(Object.keys(targetStates).length, 1);
      }
      outcomes[`${kind}:${entryPoint}`] = {
        values: check.values,
        levels: check.levels,
        occurredAt: check.occurredAt,
        note: check.note,
      };
    }
    assert.deepEqual(outcomes[`${kind}:home`], outcomes[`${kind}:history`]);
    ok(
      `${kind} : Encore maintenant identique accueil/historique, prérempli, modifiable, annulable`,
    );
  }
  for (const entryPoint of ["home", "history"]) {
    const target = await seed("v3-group");
    const before = await db();
    await openAction(target, entryPoint, "finish");
    assert.equal(await page.locator("#episode-end-unknown").isChecked(), true);
    assert.equal(await page.locator("#episode-at").inputValue(), "");
    await page.locator('#episode-form button[type="submit"]').click();
    const ep = await projected(target);
    assert.equal(ep.closedUnknown, true);
    assert.equal(ep.endedAt, undefined);
    assert.deepEqual(
      ep.checks,
      before.entries[0].targetStates[target.key].checks,
    );
    const raw = (await db()).entries[0];
    assert.equal(raw.closedUnknown, undefined);
    assert.deepEqual(raw.itemIds, before.entries[0].itemIds);
  }
  ok(
    "V3 groupé : fin inconnue identique sur les deux écrans et ciblée sur un seul endroit",
  );
  for (const entryPoint of ["today", "history"]) {
    const target = await seed("numeric");
    await page.evaluate(async (target) => {
      const { updateCatalogItem } = await import("./src/catalog.js");
      const data = JSON.parse(localStorage.getItem("journalSante.v4"));
      const item = data.catalog[0];
      updateCatalogItem(data, item.id, {
        ...item,
        label: "Remontée",
        config: {
          version: 1,
          criteria: ["refluxHeight", "discomfort", "comment", "newOccurrence"],
        },
      });
      data.entries = [
        {
          id: "reflux",
          itemIds: [item.id],
          occurredAt: "2026-02-04T08:00:00.000Z",
          levels: [],
          values: { refluxHeight: "Gorge", discomfort: 6 },
          note: "Repas",
          occurrenceGroupId: "group",
          configSnapshot: item.config,
        },
      ];
      localStorage.setItem("journalSante.v4", JSON.stringify(data));
    }, target);
    await page.reload();
    await page.locator('[data-open-module="digestif"]').click();
    if (entryPoint === "history")
      await page
        .locator("#module-history")
        .evaluate((el) => (el.closest("details").open = true));
    const selector =
      entryPoint === "today"
        ? "#today-occurrences button"
        : '#module-history [data-episode-command="occurrence"][data-entry-id="reflux"]';
    const source = structuredClone((await db()).entries[0]);
    await page.locator(selector).click();
    const occurrence = (await db()).entries.at(-1);
    assert.equal(occurrence.occurredAt, fixed.toISOString());
    assert.equal(await page.locator("#episode-dialog").isVisible(), true);
    assert.deepEqual(occurrence.values, {});
    assert.deepEqual((await db()).entries[0], source);
    // Sauvegarder les détails enrichit CETTE occurrence sans la recréer.
    await page.locator("#episode-discomfort").fill("4");
    await page.locator("#episode-refluxHeight").selectOption("Bouche");
    await page.locator("#episode-comment").fill("Après repas");
    await page.locator('#episode-form button[type="submit"]').click();
    const enriched = (await db()).entries.at(-1);
    assert.equal(enriched.id, occurrence.id);
    assert.equal(enriched.occurredAt, occurrence.occurredAt);
    assert.deepEqual(enriched.values, {
      discomfort: 4,
      refluxHeight: "Bouche",
      comment: "Après repas",
    });
    assert.equal((await db()).entries.length, 2);
    assert.deepEqual((await db()).entries[0], source);
    // Le deuxième clic est un autre fait, qui survit à la fermeture sale.
    await page.locator(selector).click();
    const untouched = structuredClone((await db()).entries.at(-1));
    await page.locator("#episode-comment").fill("Brouillon");
    page.once("dialog", (d) => d.accept());
    await page.locator("#episode-cancel").click();
    assert.deepEqual((await db()).entries.at(-1), untouched);
    await page.reload();
    assert.equal((await db()).entries.length, 3);
    assert.deepEqual((await db()).entries.at(-1), untouched);
  }
  ok(
    "occurrences : même éditeur depuis saisie du jour et historique, heure conservée et fermeture sans perte",
  );
  assert.equal(await page.locator("#finish-dialog").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    `${checks} matrices réussies (14 points d'entrée), aucune erreur JavaScript.`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
