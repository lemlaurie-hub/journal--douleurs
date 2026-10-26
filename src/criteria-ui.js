import { CRITERIA, normalizeConfig } from "./criteria.js";

// Les aperçus et les saisies utilisent ce même constructeur de champs.
export function renderCriteriaFields(
  target,
  config,
  values = {},
  { prefix = "criterion", preview = false } = {},
) {
  target.replaceChildren();
  for (const key of normalizeConfig(config).criteria) {
    const definition = CRITERIA[key];
    if (definition.type === "action") continue;
    const label = document.createElement("label");
    label.className = "field";
    const title = document.createElement("span");
    title.textContent = `${definition.label} (facultatif)`;
    const control = document.createElement(
      definition.type === "textarea"
        ? "textarea"
        : ["choice", "number"].includes(definition.type)
          ? "select"
          : "input",
    );
    control.dataset.criterion = key;
    control.id = `${prefix}-${key}`;
    if (definition.type === "choice" || definition.type === "number") {
      control.add(new Option("Non renseigné", ""));
      const choices =
        definition.choices || Array.from({ length: 11 }, (_, i) => i);
      choices.forEach((value) =>
        control.add(new Option(String(value), String(value))),
      );
    } else if (definition.type === "pain") {
      control.type = "range";
      control.min = "0";
      control.max = "10";
      control.step = "1";
      // Une ancienne absence de mesure reste inconnue jusqu'à interaction.
      control.dataset.unanswered = String(
        values[key] === undefined || values[key] === null,
      );
      const output = document.createElement("output");
      output.htmlFor = control.id;
      const refresh = () => {
        output.textContent =
          control.dataset.unanswered === "true"
            ? " — Non renseigné"
            : ` — ${control.value} / 10`;
      };
      control.addEventListener("input", () => {
        control.dataset.unanswered = "false";
        refresh();
      });
      title.append(output);
      control.value = values[key] ?? 0;
      refresh();
    } else if (definition.type === "text") {
      control.type = "text";
      control.placeholder =
        key === "location"
          ? "Estomac, intestins, œsophage, gorge, abdomen…"
          : "";
    }
    if (definition.type !== "pain") control.value = values[key] ?? "";
    if (preview) control.disabled = true;
    label.append(title, control);
    target.append(label);
  }
}

export function readCriteriaFields(target) {
  const values = {};
  target.querySelectorAll("[data-criterion]").forEach((control) => {
    const key = control.dataset.criterion;
    if (control.dataset.unanswered === "true" || control.value === "")
      values[key] = null;
    else
      values[key] = ["pain", "discomfort"].includes(key)
        ? Number(control.value)
        : control.value;
  });
  return values;
}

export function renderConfigChoices(target, config, onChange) {
  target.replaceChildren();
  for (const [key, criterion] of Object.entries(CRITERIA)) {
    const label = document.createElement("label");
    label.className = "checkbox-field";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = key;
    input.checked = config.criteria.includes(key);
    input.addEventListener("change", onChange);
    const name = document.createElement("span");
    name.textContent = criterion.label;
    label.append(input, name);
    target.append(label);
  }
}

export function readConfigChoices(target) {
  return normalizeConfig({
    version: 1,
    criteria: [...target.querySelectorAll("input:checked")].map(
      (input) => input.value,
    ),
  });
}
