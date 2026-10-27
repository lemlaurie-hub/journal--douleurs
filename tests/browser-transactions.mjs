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
const output = process.env.QA_OUTPUT || resolve(root, "../qa-audit-general");
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

async function seed() {
  await page.goto(base);
  await page.evaluate(async () => {
    const { mergeBackup } = await import("./src/transfer.js");
    const { createIndependentEntries } = await import("./src/episodes.js");
    const { saveTransit, confirmNoPassage, localDate } =
      await import("./src/digestive.js");
    const iso = (hours) => new Date(Date.now() - hours * 3600000).toISOString();
    const data = mergeBackup(
      {
        schemaVersion: 1,
        catalog: [],
        entries: [],
        settings: {},
        extension: { keep: null },
      },
      JSON.stringify([
        {
          date: iso(10),
          zones: ["Genou V3", "Épaule V3"],
          level: "😕 Gênante",
          note: "Conduite V3",
        },
      ]),
    ).data;
    data.catalog.push(
      {
        id: "cramp",
        label: "Crampe intestinale",
        family: "digestif",
        kind: "symptome",
        config: {
          version: 1,
          criteria: [
            "pain",
            "discomfort",
            "location",
            "comment",
            "stillPresent",
            "finish",
          ],
        },
      },
      {
        id: "reflux",
        label: "Remontée acide",
        family: "digestif",
        kind: "symptome",
        config: {
          version: 1,
          criteria: ["refluxHeight", "discomfort", "comment", "newOccurrence"],
        },
      },
    );
    createIndependentEntries(data, {
      itemIds: ["cramp"],
      occurredAt: iso(2),
      values: { pain: null, location: "Intestins" },
    });
    createIndependentEntries(data, {
      itemIds: ["reflux"],
      occurredAt: iso(1),
      values: { discomfort: null },
    });
    saveTransit(data, {
      kind: "passage",
      occurredAt: iso(72),
      bristol: { types: [4] },
      pain: 0,
      conditionIds: [],
      note: "Ancien transit",
    });
    confirmNoPassage(data, localDate(new Date(Date.now() - 24 * 3600000)));
    localStorage.setItem("journalSante.v4", JSON.stringify(data));
  });
  await page.goto(base);
  await page.evaluate(() => {
    window.failJournalWrites = false;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (window.failJournalWrites && key === "journalSante.v4")
        throw new DOMException("Quota simulé", "QuotaExceededError");
      return original.call(this, key, value);
    };
    const makeURL = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      window.lastJournalExport = blob;
      return makeURL.call(this, blob);
    };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (!this.download) return click.call(this);
    };
  });
  return await db();
}
async function memory() {
  await page.locator("#export-backup").evaluate((el) => el.click());
  return page.evaluate(
    async () => JSON.parse(await window.lastJournalExport.text()).data,
  );
}
async function failureIsAtomic(before) {
  assert.deepEqual(await db(), before);
  assert.deepEqual(await memory(), before);
  const expected = await page.evaluate(async (before) => {
    const { calculateStats } = await import("./src/stats.js");
    const summarize = (stats) =>
      [stats.totalEntries, stats.activeDays, stats.ongoingEntries].map(String);
    return {
      home: summarize(calculateStats(before)),
      module: summarize(
        calculateStats(before, {
          moduleId: location.hash.slice(1) || "rhumatologie",
        }),
      ),
    };
  }, before);
  assert.deepEqual(
    await page.locator("#home-stats .stat-card strong").allTextContents(),
    expected.home,
  );
  if (await page.locator("#module-page").isVisible())
    assert.deepEqual(
      await page.locator("#module-stats .stat-card strong").allTextContents(),
      expected.module,
    );
}
const fail = (value) =>
  page.evaluate((value) => (window.failJournalWrites = value), value);
async function openDigestiveHistory() {
  await page.locator('[data-open-module="digestif"]').click();
  await page
    .locator("#module-history")
    .evaluate((el) => (el.closest("details").open = true));
}
try {
  let before = await seed();
  await page.locator('[data-open-module="rhumatologie"]').click();
  await page.locator("#open-entry-dialog").click();
  await page.locator('[data-body-region="hand-right"]').click();
  await fail(true);
  await page.locator("[data-body-map-choice]").first().click();
  await failureIsAtomic(before);
  await fail(false);
  await page.locator("[data-body-map-choice]").first().click();
  assert.equal((await db()).catalog.length, before.catalog.length + 1);
  assert.equal((await db()).entries.length, before.entries.length);
  assert.deepEqual(await memory(), await db());
  ok(
    "carte corporelle : aucune zone fantôme après quota, nouvelle tentative réussie",
  );

  before = await seed();
  await fail(true);
  await page.locator("#open-settings").click();
  await failureIsAtomic(before);
  assert.equal(await page.locator("#settings-dialog").isVisible(), false);
  await fail(false);
  await page.locator("#open-settings").click();
  before = await db();
  await page.locator("#settings-create").click();
  await page.locator("#catalog-label").fill("Test catalogue");
  await fail(true);
  await page.locator("#save-catalog-item").click();
  await failureIsAtomic(before);
  assert.equal(await page.locator("#catalog-dialog").isVisible(), true);
  await fail(false);
  await page.locator("#save-catalog-item").click();
  assert.equal((await db()).catalog.length, before.catalog.length + 1);
  ok(
    "paramètres et catalogue : initialisation/création atomiques, formulaire conservé après échec",
  );

  before = await seed();
  await page.locator('[data-open-module="digestif"]').click();
  await page.locator("#transit-open-passage").click();
  await page.locator('#transit-form button[type="submit"]').click();
  await failureIsAtomic(before);
  await page.locator('#transit-bristol input[value="4"]').check();
  await fail(true);
  await page.locator('#transit-form button[type="submit"]').click();
  await failureIsAtomic(before);
  assert.equal(await page.locator("#transit-dialog").isVisible(), true);
  await fail(false);
  await page.locator('#transit-form button[type="submit"]').click();
  assert.equal(
    (await db()).digestive.events.length,
    before.digestive.events.length + 1,
  );
  assert.deepEqual(await memory(), await db());
  ok("transit : validation et quota sans divergence, saisie récupérable");

  before = await seed();
  await openDigestiveHistory();
  const transit = before.digestive.events[0];
  await fail(true);
  page.once("dialog", (d) => d.accept());
  await page.locator(`[data-transit-delete="${transit.id}"]`).click();
  await failureIsAtomic(before);
  await fail(false);
  page.once("dialog", (d) => d.accept());
  await page.locator(`[data-transit-delete="${transit.id}"]`).click();
  assert.equal((await db()).digestive.events.length, 0);
  before = await db();
  const day = before.digestive.days[0];
  await fail(true);
  await page.locator(`[data-day-clear="${day.date}"]`).click();
  await failureIsAtomic(before);
  await fail(false);
  await page.locator(`[data-day-clear="${day.date}"]`).click();
  assert.equal((await db()).digestive.days.length, 0);
  ok(
    "historique transit/journées : suppressions atomiques et reprise sans doublon",
  );

  before = await seed();
  await page.locator("#open-settings").click();
  await page.locator("#transit-open-conditions").click();
  before = await db();
  await page.locator("#transit-condition-label").fill("Condition de test");
  await fail(true);
  await page.locator("#transit-condition-save").click();
  await failureIsAtomic(before);
  assert.equal(
    await page.locator("#transit-condition-label").inputValue(),
    "Condition de test",
  );
  await fail(false);
  await page.locator("#transit-condition-save").click();
  assert.equal(
    (await db()).digestive.conditions.length,
    before.digestive.conditions.length + 1,
  );
  ok("conditions : pas de mutation en mémoire ni perte du libellé après quota");

  before = await seed();
  await page.locator('[data-open-module="digestif"]').click();
  await page.locator("#transit-open-symptom").click();
  await page.locator("#episode-symptom").selectOption("cramp");
  await page.locator("#episode-location").fill("Intestins");
  await fail(true);
  await page.locator('#episode-form button[type="submit"]').click();
  await failureIsAtomic(before);
  assert.equal(
    (await db()).entries.find((e) => e.itemIds[0] === "cramp").closedUnknown,
    undefined,
  );
  await fail(false);
  await page.locator('#episode-form button[type="submit"]').click();
  assert.equal(
    (await db()).entries.find((e) => e.itemIds[0] === "cramp").closedUnknown,
    true,
  );
  ok(
    "nouvel épisode : échec de stockage n’applique pas sa clôture automatique",
  );

  before = await seed();
  await page.locator('[data-open-module="digestif"]').click();
  await fail(true);
  await page.locator("#today-occurrences button").click();
  await failureIsAtomic(before);
  assert.equal(await page.locator("#episode-dialog").isVisible(), false);
  await fail(false);
  await page.locator("#today-occurrences button").click();
  const created = (await db()).entries.at(-1);
  before = await db();
  await page.locator("#episode-discomfort").fill("4");
  await fail(true);
  await page.locator('#episode-form button[type="submit"]').click();
  await failureIsAtomic(before);
  assert.equal((await db()).entries.at(-1).id, created.id);
  assert.equal(await page.locator("#episode-dialog").isVisible(), true);
  await fail(false);
  await page.locator('#episode-form button[type="submit"]').click();
  assert.equal((await db()).entries.at(-1).values.discomfort, 4);
  assert.deepEqual(await memory(), await db());
  ok(
    "occurrence et détails : deux transactions distinctes, fait déjà enregistré préservé",
  );

  before = await seed();
  const legacyFile = {
    name: "audit-v3.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          date: "2026-01-02T12:00:00Z",
          zone: "Zone importée",
          level: "😕 Gênante",
          note: "V3",
        },
      ]),
    ),
  };
  await fail(true);
  page.once("dialog", (d) => d.accept());
  await page.locator("#import-backup").setInputFiles(legacyFile);
  await page.waitForFunction(
    () => document.querySelector("#import-backup").value === "",
  );
  await failureIsAtomic(before);
  await fail(false);
  page.once("dialog", (d) => d.accept());
  await page.locator("#import-backup").setInputFiles(legacyFile);
  await page.waitForFunction(
    (count) =>
      JSON.parse(localStorage.getItem("journalSante.v4")).entries.length ===
      count,
    before.entries.length + 1,
  );
  assert.deepEqual(await memory(), await db());
  assert.deepEqual((await db()).extension, { keep: null });
  ok(
    "import V3 : copie entière et extensions conservées, mémoire et disque identiques après échec/reprise",
  );
  // Une ancienne saisie reclassée sur deux modules ne doit pas mélanger
  // leurs suivis dans les cartes statistiques, même si elle reste groupée.
  await seed();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("journalSante.v4"));
    const entry = data.entries.find((e) => e.itemIds.length === 2);
    const [r, d] = entry.itemIds;
    data.catalog.find((i) => i.id === d).family = "digestif";
    entry.ongoing = true;
    entry.targetStates = {
      [JSON.stringify([r, ""])]: {
        closedUnknown: true,
        closure: { recordedAt: new Date().toISOString() },
      },
      [JSON.stringify([d, ""])]: { ongoing: true },
    };
    localStorage.setItem("journalSante.v4", JSON.stringify(data));
  });
  await page.reload();
  await page.locator('[data-open-module="rhumatologie"]').click();
  await page.locator("#module-statistics summary").click();
  assert.equal(
    (
      await page.locator("#module-stats .stat-card strong").allTextContents()
    )[2],
    "0",
  );
  assert.doesNotMatch(
    await page.locator("#module-stats").innerText(),
    /Épaule V3/,
  );
  await page
    .locator("#module-history")
    .evaluate((el) => (el.closest("details").open = true));
  assert.doesNotMatch(
    await page.locator("#module-history").innerText(),
    /Épaule V3/,
  );
  await page.locator("[data-go-home]").click();
  await page.locator('[data-open-module="digestif"]').click();
  await page.locator("#module-statistics summary").click();
  assert.equal(
    (
      await page.locator("#module-stats .stat-card strong").allTextContents()
    )[2],
    "2",
  );
  assert.match(await page.locator("#module-stats").innerText(), /Épaule V3/);
  ok(
    "ancienne saisie multi-module : historique et compteurs filtrent les mêmes cibles",
  );
  assert.deepEqual(errors, []);
  console.log(
    `${checks} scénarios d’échec/reprise réussis, aucune erreur JavaScript.`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
