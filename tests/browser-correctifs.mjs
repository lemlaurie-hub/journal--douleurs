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
const output = process.env.QA_OUTPUT || resolve(root, "../qa-correctifs");
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
try {
  await page.goto(base);
  await page.evaluate(() =>
    Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Service worker non prêt")), 10000),
      ),
    ]),
  );
  await page.reload();
  await page.locator('[data-open-module="digestif"]').click();
  const add = await page.locator("#transit-open-passage").boundingBox();
  const none = await page.locator("#transit-open-none").boundingBox();
  assert.equal(add.y, none.y);
  assert.ok(none.x > add.x);
  assert.equal(
    await page.locator("#transit-open-passage").innerText(),
    "+ Ajouter",
  );
  assert.equal(await page.locator("#transit-open-history").count(), 0);
  assert.equal(
    await page.locator("#module-statistics").getAttribute("open"),
    null,
  );
  await page.locator("#transit-open-none").click();
  await page.locator('#transit-day-form button[type="submit"]').click();
  assert.equal(
    await page.locator("#transit-open-none").getAttribute("aria-pressed"),
    "true",
  );
  assert.match(await page.locator("#transit-open-none").innerText(), /✓/);
  await page.locator("#transit-open-passage").click();
  await page.locator('#transit-bristol input[value="4"]').check();
  await page.locator('#transit-form button[type="submit"]').click();
  assert.equal(
    await page.locator("#transit-open-none").getAttribute("aria-pressed"),
    "false",
  );
  ok("boutons côte à côte, Aucun confirmé puis annulé par passage du jour");

  await page.locator("#open-settings").click();
  assert.equal(
    await page.locator("#catalog-list [data-edit-catalog]").count(),
    7,
  );
  let stored = await db();
  const nausea = stored.catalog.find((i) => i.presetKey === "nausea");
  await page.locator(`[data-edit-catalog="${nausea.id}"]`).click();
  await page.locator("#catalog-label").fill("Nausée personnelle");
  await page.locator("#save-catalog-item").click();
  await page.locator("#close-settings").click();
  await page.locator("#open-settings").click();
  assert.equal(
    await page.locator("#catalog-list [data-edit-catalog]").count(),
    7,
  );
  await page.locator("#transit-open-conditions").click();
  await page.locator("#transit-condition-label").fill("Position inhabituelle");
  await page.locator("#transit-condition-save").click();
  await page.locator("#transit-conditions-close").click();
  await page.locator("#close-settings").click();
  assert.equal((await db()).entries.length, 0);
  ok(
    "paramètres : tous les prédéfinis sans saisie, renommage stable, conditions",
  );

  await page.locator("#transit-open-symptom").click();
  await page.locator("#episode-symptom").selectOption(nausea.id);
  const range = page.locator("#episode-discomfort");
  assert.equal(await range.getAttribute("type"), "range");
  assert.equal(await range.getAttribute("data-unanswered"), "true");
  await range.fill("6");
  await page.locator('#episode-form button[type="submit"]').click();
  stored = await db();
  const nauseaEntry = stored.entries.at(-1);
  assert.equal(nauseaEntry.values.discomfort, 6);
  await page
    .locator("#module-history")
    .evaluate((el) => (el.closest("details").open = true));
  await page
    .locator(`[data-episode-command="edit"][data-entry-id="${nauseaEntry.id}"]`)
    .click();
  await page.locator("#episode-discomfort").fill("0");
  await page.locator('#episode-form button[type="submit"]').click();
  assert.equal((await db()).entries.at(-1).values.discomfort, 0);
  assert.equal(
    await page
      .locator("#module-history")
      .evaluate((el) => el.closest("details").open),
    true,
  );
  await page.locator("#module-statistics summary").click();
  await page.locator("[data-go-home]").click();
  assert.equal(
    await page.locator('#home-followup [data-episode-command="still"]').count(),
    1,
  );
  await page.locator('[data-open-module="digestif"]').click();
  assert.equal(
    await page
      .locator("#module-history")
      .evaluate((el) => el.closest("details").open),
    false,
  );
  assert.equal(
    await page.locator("#module-statistics").evaluate((el) => el.open),
    false,
  );
  ok(
    "gêne en réglette, zéro sauvegardé, historique conservé après fiche et replié à la visite",
  );

  await page.locator("[data-go-home]").click();
  const first = await page
    .locator('#home-followup [data-episode-command="still"]')
    .getAttribute("data-entry-id");
  await page.locator('#home-followup [data-episode-command="still"]').click();
  assert.equal(await page.locator("#episode-dialog").isVisible(), false);
  stored = await db();
  assert.equal(stored.entries.find((e) => e.id === first).checks.length, 1);
  await page.locator('#home-followup [data-episode-command="finish"]').click();
  assert.equal(await page.locator("#episode-end-unknown").isChecked(), true);
  assert.equal(await page.locator("#episode-at").isDisabled(), true);
  await page.locator('#episode-form button[type="submit"]').click();
  stored = await db();
  const closed = stored.entries.find((e) => e.id === first);
  assert.equal(closed.closedUnknown, true);
  assert.equal(closed.endedAt, undefined);
  assert.equal(
    await page.locator("#home-followup [data-episode-command]").count(),
    0,
  );
  ok(
    "accueil : constat sur même épisode puis clôture sans inventer une heure de fin",
  );

  await page.locator('[data-open-module="digestif"]').click();
  await page.locator("#transit-open-symptom").click();
  await page
    .locator("#episode-symptom")
    .selectOption({ label: "Remontée acide" });
  assert.equal(
    await page.locator("#episode-discomfort").getAttribute("type"),
    "range",
  );
  await page.locator('#episode-form button[type="submit"]').click();
  assert.equal(await page.locator("#today-occurrences button").count(), 1);
  const before = (await db()).entries.length;
  await page.locator("#today-occurrences button").click();
  assert.equal((await db()).entries.length, before + 1);
  assert.equal(await page.locator("#today-occurrences button").count(), 1);
  await page.reload();
  assert.equal(await page.locator("#today-occurrences button").count(), 1);
  ok("remontées : réglette et raccourci du jour persistant après rechargement");

  // Une ancienne valeur vide reste vide lors d'une correction sans interaction.
  await page
    .locator("#module-history")
    .evaluate((el) => (el.closest("details").open = true));
  stored = await db();
  const reflux = stored.entries.at(-1);
  await page
    .locator(`[data-episode-command="edit"][data-entry-id="${reflux.id}"]`)
    .click();
  assert.equal(
    await page.locator("#episode-discomfort").getAttribute("data-unanswered"),
    "true",
  );
  await page.locator('#episode-form button[type="submit"]').click();
  assert.equal(
    Object.hasOwn((await db()).entries.at(-1).values, "discomfort"),
    false,
  );
  ok("ancienne mesure inconnue conservée à la sauvegarde");

  await page
    .locator(`[data-episode-command="edit"][data-entry-id="${reflux.id}"]`)
    .click();
  await page.locator("#episode-discomfort").press("Home");
  await page.locator('#episode-form button[type="submit"]').click();
  assert.equal((await db()).entries.at(-1).values.discomfort, 0);
  await page
    .locator(`[data-episode-command="edit"][data-entry-id="${reflux.id}"]`)
    .click();
  await page
    .locator("#episode-fields")
    .getByRole("button", { name: "Non renseigné" })
    .click();
  await page.locator('#episode-form button[type="submit"]').click();
  assert.equal(
    Object.hasOwn((await db()).entries.at(-1).values, "discomfort"),
    false,
  );
  await page.locator("#open-settings").click();
  await page.locator("#settings-family").selectOption("rhumatologie");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#settings-dialog").isVisible(), false);
  ok(
    "zéro explicite au clavier, retour à inconnu, paramètres fermables par Échap",
  );

  // Représentation d'une ancienne saisie groupée : deux suivis indépendants.
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("journalSante.v4"));
    data.catalog.push(
      {
        id: "knee",
        label: "Genou droit",
        family: "rhumatologie",
        kind: "zone",
      },
      {
        id: "shoulder",
        label: "Épaule gauche",
        family: "rhumatologie",
        kind: "zone",
      },
    );
    data.entries.push({
      id: "legacy-pair",
      itemIds: ["knee", "shoulder"],
      levels: [2],
      occurredAt: new Date(Date.now() - 3600000).toISOString(),
      note: "Conduite",
    });
    localStorage.setItem("journalSante.v4", JSON.stringify(data));
  });
  await page.goto(base);
  assert.equal(
    await page.locator('#home-followup [data-episode-command="still"]').count(),
    2,
  );
  await page.locator('[data-open-module="rhumatologie"]').click();
  await page
    .locator("#module-history")
    .evaluate((el) => (el.closest("details").open = true));
  await page
    .locator('#module-history [data-episode-command="still"]')
    .first()
    .click();
  assert.equal(
    await page.locator('#episode-levels input[type="checkbox"]').count(),
    4,
  );
  assert.equal(
    await page.locator('#episode-fields input[type="range"]').count(),
    0,
  );
  await page.locator('#episode-form button[type="submit"]').click();
  stored = await db();
  assert.deepEqual(stored.entries.find((e) => e.id === "legacy-pair").itemIds, [
    "knee",
    "shoulder",
  ]);
  ok(
    "rhumato : anciennes zones groupées suivies séparément, intensités qualitatives conservées",
  );

  // Fin réelle du second endroit, sans inventer celle du premier.
  await page
    .locator(
      '#module-history [data-episode-command="finish"][data-entry-id="legacy-pair"]',
    )
    .last()
    .click();
  await page.locator("#episode-end-unknown").uncheck();
  const realEnd = await page.evaluate(() => {
    const date = new Date(Date.now() - 30 * 60000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  await page.locator("#episode-at").fill(realEnd);
  await page.locator('#episode-form button[type="submit"]').click();
  const knownViews = await page.evaluate(async () => {
    const { getEpisodeViews } = await import("./src/episodes.js");
    const data = JSON.parse(localStorage.getItem("journalSante.v4"));
    return getEpisodeViews(data.entries.find((e) => e.id === "legacy-pair"));
  });
  assert.equal(knownViews.filter((e) => e.endedAt).length, 1);
  ok("heure réelle de fin saisissable pour une seule zone");

  await page.locator("[data-go-home]").click();
  await page.locator('[data-open-module="digestif"]').click();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const left = await page.locator("#transit-open-passage").boundingBox();
    const right = await page.locator("#transit-open-none").boundingBox();
    assert.equal(left.y, right.y);
    assert.ok(left.height >= 44 && right.height >= 44);
    await page.locator("#open-settings").click();
    assert.ok(
      await page
        .locator("#settings-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    await page.screenshot({ path: `${output}/parametres-${width}.png` });
    await page.locator("#close-settings").click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/digestif-mobile.png` });
  ok(
    "largeurs 320, 390 et 768 : cibles tactiles et paramètres sans débordement",
  );
  await context.setOffline(true);
  await page.reload();
  await page.locator("#today-occurrences button").click();
  const offlineCount = (await db()).entries.length;
  await page.reload();
  assert.equal((await db()).entries.length, offlineCount);
  ok("raccourci et sauvegarde disponibles hors ligne");
  await context.setOffline(false);
  await page.clock.install({ time: new Date("2026-01-03T23:59:59+01:00") });
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("journalSante.v4"));
    const reflux = data.catalog.find((i) => i.presetKey === "reflux");
    data.entries = [
      {
        id: "midnight-reflux",
        itemIds: [reflux.id],
        occurredAt: new Date(Date.now() - 1000).toISOString(),
        levels: [],
        values: {},
        configSnapshot: reflux.config,
      },
      {
        id: "expiry",
        itemIds: ["knee"],
        occurredAt: new Date(Date.now() - 48 * 3600000 + 1000).toISOString(),
        levels: [2],
      },
    ];
    localStorage.setItem("journalSante.v4", JSON.stringify(data));
  });
  await page.goto(base);
  const timedBefore = (await db()).entries;
  assert.equal(
    await page.locator('#home-followup [data-episode-command="still"]').count(),
    1,
  );
  await page.locator('[data-open-module="digestif"]').click();
  assert.equal(await page.locator("#today-occurrences button").count(), 1);
  await page.clock.runFor(2000);
  assert.equal(await page.locator("#today-occurrences button").count(), 0);
  await page.locator("[data-go-home]").click();
  assert.equal(
    await page.locator('#home-followup [data-episode-command="still"]').count(),
    0,
  );
  assert.deepEqual((await db()).entries, timedBefore);
  ok(
    "expiration exacte des 48 heures et minuit local sans reload, historique inchangé",
  );
  assert.deepEqual(errors, []);
  console.log(`${checks} scénarios réussis, aucune erreur JavaScript.`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
