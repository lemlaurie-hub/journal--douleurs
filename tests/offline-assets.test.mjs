import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

// Vérifie le manifeste réel du service worker et ses dépendances transitives.
// Ce contrôle de fichiers ne remplace pas un essai en navigateur hors ligne.
test("le cache contient chaque ressource et chaque import nécessaire au démarrage hors ligne", () => {
  const root = resolve(import.meta.dirname, "..");
  const worker = readFileSync(resolve(root, "sw.js"), "utf8");
  const resources = [...worker.match(/const APP_SHELL = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const cached = new Set(resources);
  for (const resource of resources) {
    const path = resource.split("?")[0];
    assert.ok(existsSync(resolve(root, path)), `Fichier absent : ${resource}`);
    if (!path.endsWith(".js")) continue;
    const source = readFileSync(resolve(root, path), "utf8");
    for (const dependency of source.matchAll(/from\s+"(\.[^"]+)"/g)) {
      const absolute = resolve(root, dirname(path), dependency[1].split("?")[0]);
      const suffix = dependency[1].includes("?") ? `?${dependency[1].split("?")[1]}` : "";
      const relative = `.${absolute.slice(root.length)}${suffix}`;
      assert.ok(cached.has(relative), `Import non précaché : ${relative}`);
    }
  }
  const html = readFileSync(resolve(root, "index.html"), "utf8");
  for (const match of html.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)) {
    assert.ok(cached.has(match[1]), `Ressource HTML non précachée : ${match[1]}`);
  }
  for (let type = 1; type <= 7; type++) assert.ok(cached.has(`./images/bristol-${type}.webp`));
});
