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
const output = process.env.QA_OUTPUT || resolve(root, "../qa-lot2");
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
  assert.equal(
    await page.locator("#transit-passage-title").textContent(),
    "Passage aux toilettes",
  );
  assert.equal(await page.locator("#transit-day-dialog").isVisible(), false);
  ok("page Digestif : titre et deux boutons directs");

  await page.locator("#transit-open-passage").click();
  await page.locator('#transit-dialog button[type="submit"]').click();
  assert.match(
    await page.locator("#transit-dialog .dialog-error").textContent(),
    /types Bristol/,
  );
  await page.locator("#transit-dialog").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const box = await page
    .locator("#transit-dialog .dialog-toolbar")
    .boundingBox();
  assert.ok(box.y >= 0 && box.y + box.height <= 844);
  await page.screenshot({ path: `${output}/transit-barre-visible.png` });
  await page.locator('#transit-bristol input[value="3"]').check();
  await page.locator('#transit-bristol input[value="4"]').check();
  await page.locator('#transit-dialog button[type="submit"]').click();
  assert.match(
    await page.locator("#transit-dialog .dialog-error").textContent(),
    /intermédiaire/,
  );
  await page
    .locator("#transit-bristol .bristol-row")
    .first()
    .getByRole("button", { name: "Agrandir" })
    .click();
  assert.equal(await page.locator("#bristol-image-dialog").isVisible(), true);
  await page.locator("#bristol-image-close").click();
  assert.equal(
    await page.locator('#transit-bristol input[value="3"]').isChecked(),
    true,
  );
  await page.locator("#transit-mode-intermediate").check();
  await page.locator('#transit-dialog button[type="submit"]').click();
  assert.equal(await page.locator("#transit-dialog").isVisible(), false);
  assert.equal((await db()).digestive.events.length, 1);
  ok("Bristol, validation visible et barre accessible pendant le défilement");

  await page.locator("[data-go-home]").click();
  assert.match(
    await page.locator("#home-history").textContent(),
    /Bristol 3 \+ 4/,
  );
  await page.locator('[data-open-module="digestif"]').click();
  await page.locator("#transit-open-none").click();
  await page.locator("#transit-day").fill("2026-01-01");
  await page.locator('#transit-day-form button[type="submit"]').click();
  await page.locator("#module-history").evaluate((el) => {
    el.closest("details").open = true;
  });
  await page.locator("#module-history [data-day-clear]").click();
  assert.equal((await db()).digestive.days.length, 0);
  ok("accueil commun et confirmation de journée annulable dans l’historique");

  await page.locator("#transit-open-symptom").click();
  await page.locator("#episode-symptom").selectOption("preset:nausea");
  assert.equal(
    await page.locator('#episode-fields [data-criterion="location"]').count(),
    0,
  );
  await chooseDate("2026-01-02T08:00");
  await page.locator('#episode-form button[type="submit"]').click();
  assert.equal(await page.locator("#episode-dialog").isVisible(), false);
  assert.deepEqual((await db()).entries[0].values, {});
  ok("nausée sans localisation ni intensité obligatoire");

  await page.locator("#transit-open-symptom").click();
  await page.locator("#episode-new-symptom").click();
  assert.equal(
    await page
      .locator('#catalog-kind option[value="zone"]')
      .evaluate((el) => el.disabled),
    true,
  );
  assert.equal(await page.locator("#catalog-family").isVisible(), false);
  await page.locator("#catalog-label").fill("Crampe intestinale");
  await page.locator('#catalog-criteria input[value="location"]').uncheck();
  await page.locator("#catalog-criteria-group details summary").click();
  assert.equal(
    await page.locator('#catalog-preview [data-criterion="pain"]').inputValue(),
    "0",
  );
  await page.locator("#save-catalog-item").click();
  assert.equal(await page.locator("#catalog-dialog").isVisible(), false);
  await chooseDate("2026-01-02T10:00");
  await page.locator('#episode-form button[type="submit"]').click();
  let stored = await db();
  const custom = stored.catalog.find(
    (item) => item.label === "Crampe intestinale",
  );
  const old = stored.entries.find((entry) => entry.itemIds.includes(custom.id));
  assert.equal(old.values.pain, 0);
  ok("création personnalisée, aperçu partagé et douleur zéro par défaut");
  await page.locator("#module-history").evaluate((el) => {
    el.closest("details").open = true;
  });

  await page
    .locator(
      `#module-history [data-episode-command="still"][data-entry-id="${old.id}"]`,
    )
    .click();
  await chooseDate("2026-01-02T11:00");
  await page.locator('#episode-fields [data-criterion="pain"]').fill("6");
  await page
    .locator('#episode-fields [data-criterion="comment"]')
    .fill("Plus fort");
  await page.locator('#episode-form button[type="submit"]').click();
  stored = await db();
  assert.equal(
    stored.entries.find((entry) => entry.id === old.id).values.pain,
    0,
  );
  assert.equal(
    stored.entries.find((entry) => entry.id === old.id).checks[0].values.pain,
    6,
  );
  ok("constat enrichi sans écraser l’intensité initiale");

  await page.locator("#transit-open-symptom").click();
  await page.locator("#episode-symptom").selectOption(custom.id);
  await chooseDate("2026-01-03T10:00");
  await page.locator('#episode-form button[type="submit"]').click();
  stored = await db();
  assert.equal(
    stored.entries.find((entry) => entry.id === old.id).closedUnknown,
    true,
  );
  const replacement = stored.entries.find(
    (entry) => entry.id !== old.id && entry.itemIds.includes(custom.id),
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator(
      `#module-history [data-episode-command="delete"][data-entry-id="${replacement.id}"]`,
    )
    .click();
  assert.equal(
    (await db()).entries.find((entry) => entry.id === old.id).closedUnknown,
    true,
  );
  ok("clôture inconnue définitive après suppression du nouvel épisode");

  await page.locator("#open-settings").click();
  await page.locator(`[data-edit-catalog="${custom.id}"]`).click();
  await page.locator("#catalog-label").fill("Crampe renommée");
  await page.locator('#catalog-criteria input[value="pain"]').uncheck();
  await page.locator('#catalog-criteria input[value="discomfort"]').check();
  await page.locator("#save-catalog-item").click();
  await page.locator("#close-settings").click();
  await page
    .locator(
      `#module-history [data-episode-command="edit"][data-entry-id="${old.id}"]`,
    )
    .click();
  assert.equal(
    await page.locator('#episode-fields [data-criterion="pain"]').inputValue(),
    "0",
  );
  assert.equal(
    await page
      .locator('#episode-fields [data-criterion="discomfort"]')
      .getAttribute("data-unanswered"),
    "true",
  );
  await page.locator("#episode-cancel").click();
  ok(
    "critère retiré encore éditable, nouveau critère non renseigné dans le passé",
  );

  await page.locator("#transit-open-symptom").click();
  await page
    .locator("#episode-symptom")
    .selectOption({ label: "Remontée acide" });
  await chooseDate("2026-01-04T10:00");
  await page
    .locator('#episode-fields [data-criterion="refluxHeight"]')
    .selectOption("Gorge");
  await page.locator('#episode-form button[type="submit"]').click();
  stored = await db();
  const reflux = stored.entries.find((entry) =>
    entry.configSnapshot?.criteria.includes("newOccurrence"),
  );
  await page
    .locator(
      `#module-history [data-episode-command="occurrence"][data-entry-id="${reflux.id}"]`,
    )
    .click();
  const group = (await db()).entries.filter(
    (entry) => entry.occurrenceGroupId === reflux.occurrenceGroupId,
  );
  assert.equal(group.length, 2);
  assert.deepEqual(group.find((entry) => entry.id !== reflux.id).values, {});
  ok("nouvelle remontée immédiate avec hauteur et gêne non renseignées");

  await page.locator("#transit-open-passage").click();
  await page.locator("#transit-note").fill("Brouillon");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#transit-close").click();
  assert.equal(await page.locator("#transit-dialog").isVisible(), true);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#transit-close").click();
  assert.equal(await page.locator("#transit-dialog").isVisible(), false);
  ok("annulation protégée : refus puis confirmation");

  await page.locator("[data-go-home]").click();
  await page.locator('[data-open-module="rhumatologie"]').click();
  await page.locator("#module-history").evaluate((el) => {
    el.closest("details").open = true;
  });
  await page.locator("#open-entry-dialog").click();
  await page.locator('[data-body-region="hand-right"]').click();
  await page.locator("[data-body-map-choice]").first().click();
  await page.locator('[data-body-region="hand-left"]').click();
  await page.locator("[data-body-map-choice]").first().click();
  await page.locator('#levels [data-level="2"]').click();
  await page.locator("#note").fill("Pendant la conduite");
  await page.locator("#occurred-at").fill("2026-01-05T08:00");
  await page.locator("#save-entry").click();
  stored = await db();
  const simultaneous = stored.entries.filter(
    (entry) => entry.note === "Pendant la conduite",
  );
  assert.equal(simultaneous.length, 2);
  assert.equal(simultaneous[0].sourceGroupId, simultaneous[1].sourceGroupId);
  assert.equal(simultaneous[0].itemIds.length, 1);
  await page
    .locator(`#module-history [data-edit-entry="${simultaneous[0].id}"]`)
    .click();
  await page.locator("#note").fill("Conduite corrigée pour une seule zone");
  await page.locator("#save-entry").click();
  const correctedSource = (await db()).entries.find(
    (entry) => entry.id === simultaneous[0].id,
  );
  assert.equal(correctedSource.note, "Conduite corrigée pour une seule zone");
  assert.equal(
    (await db()).entries.find((entry) => entry.id === simultaneous[1].id).note,
    "Pendant la conduite",
  );
  ok(
    "saisie corporelle commune créant des épisodes séparés, correction ciblée conservée",
  );

  await page.locator("[data-go-home]").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#import-backup").setInputFiles({
    name: "v3-synthetique.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          date: "2026-01-01T07:00:00.000Z",
          zones: ["Main test V3", "Genou test V3"],
          level: "😕 Gênante",
          note: "Observation synthétique commune",
        },
      ]),
    ),
  });
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("Import terminé"),
  );
  stored = await db();
  const legacy = stored.entries.find((entry) =>
    entry.id.startsWith("entry-v3-"),
  );
  await page.locator('[data-open-module="rhumatologie"]').click();
  await page.locator("#module-history").evaluate((el) => {
    el.closest("details").open = true;
  });
  const legacyButton = page
    .locator(
      `#module-history [data-episode-command="still"][data-entry-id="${legacy.id}"]`,
    )
    .first();
  await legacyButton.click();
  await chooseDate("2026-01-01T11:00");
  await page.locator('#episode-levels input[value="3"]').check();
  await page
    .locator('#episode-fields [data-criterion="comment"]')
    .fill("Un seul endroit évolue");
  await page.locator('#episode-form button[type="submit"]').click();
  const evolvedLegacy = (await db()).entries.find(
    (entry) => entry.id === legacy.id,
  );
  assert.deepEqual(evolvedLegacy.itemIds, legacy.itemIds);
  assert.equal(Object.keys(evolvedLegacy.targetStates).length, 1);
  assert.equal(evolvedLegacy.note, legacy.note);
  ok("import V3 réel et suivi ciblé sans altération de la saisie groupée");

  await page.locator("[data-go-home]").click();
  const beforeImport = await db();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-backup").click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(backup.formatVersion, 3);
  assert.deepEqual(backup.data.entries, beforeImport.entries);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#import-backup").setInputFiles({
    name: "v4-lot2.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForFunction(() =>
    document
      .querySelector("#toast")
      .textContent.includes("Import terminé : 0 observation(s)"),
  );
  assert.deepEqual((await db()).entries, beforeImport.entries);
  ok(
    "export et réimportation réels sans doublon, constats et configurations préservés",
  );

  await page.locator('[data-open-module="digestif"]').click();
  await page.locator("#open-settings").click();
  await page.locator("#transit-open-conditions").click();
  await page.locator("#transit-condition-label").fill("Condition test");
  await page.locator("#transit-condition-save").click();
  assert.ok(
    (await db()).digestive.conditions.some(
      (condition) => condition.label === "Condition test",
    ),
  );
  await page.locator("#transit-conditions-close").click();
  await page.locator("#close-settings").click();
  ok("gestion des conditions dans une fenêtre avec sa barre d’actions");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator("#transit-open-passage").click();
    assert.equal(
      await page
        .locator("#transit-dialog")
        .evaluate((element) => element.scrollTop),
      0,
    );
    assert.equal(
      await page.locator("#transit-dialog .dialog-toolbar").count(),
      1,
    );
    assert.equal(
      await page.locator("#transit-dialog button[type=submit]").count(),
      1,
    );
    assert.equal(
      await page
        .locator("#transit-dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
      true,
    );
    assert.equal(
      await page
        .locator("#transit-dialog")
        .evaluate((element) =>
          [...element.querySelectorAll(".bristol-choice span")].every(
            (label) => label.scrollWidth <= label.clientWidth,
          ),
        ),
      true,
    );
    if (width === 320)
      await page.screenshot({ path: `${output}/fiche-320px.png` });
    await page.locator("#transit-close").click();
    assert.equal(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
      true,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${output}/digestif-mobile.png`,
    fullPage: true,
  });
  ok("page sans débordement horizontal à 320, 390 et 768 pixels");

  await context.setOffline(true);
  await page.reload();
  await page.locator("#transit-open-accident").click();
  await page.locator('#transit-dialog button[type="submit"]').click();
  await page.reload();
  assert.ok(
    (await db()).digestive.events.some((event) => event.kind === "accident"),
  );
  ok("réouverture, saisie et persistance réelles hors ligne");
  assert.deepEqual(errors, []);
  console.log(
    `${checks} scénarios navigateur réussis, aucune erreur JavaScript.`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
