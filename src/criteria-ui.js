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
        : definition.type === "choice"
          ? "select"
          : "input",
    );
    let clear = null;
    control.dataset.criterion = key;
    control.id = `${prefix}-${key}`;
    if (definition.type === "choice") {
      control.add(new Option("Non renseigné", ""));
      const choices =
        definition.choices || Array.from({ length: 11 }, (_, i) => i);
      choices.forEach((value) =>
        control.add(new Option(String(value), String(value))),
      );
    } else if (definition.type === "scale") {
      const output = document.createElement("output");
      output.htmlFor = control.id;
      bindNumericRange(control, output, values[key]);
      title.append(output);
      clear = document.createElement("button");
      clear.type = "button";
      clear.className = "button button-secondary button-small";
      clear.textContent = "Non renseigné";
      clear.disabled = preview;
      clear.addEventListener("click", () => {
        control.dataset.unanswered = "true";
        output.textContent = " — Non renseigné";
      });
    } else if (definition.type === "text") {
      control.type = "text";
      control.placeholder =
        key === "location"
          ? "Estomac, intestins, œsophage, gorge, abdomen…"
          : "";
    }
    if (definition.type !== "scale") control.value = values[key] ?? "";
    if (preview) control.disabled = true;
    label.append(title, control);
    if (clear) label.append(clear);
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
      values[key] =
        CRITERIA[key]?.type === "scale" ? Number(control.value) : control.value;
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

/** Contrôle commun à toutes les échelles numériques, y compris le transit.
 * L'absence historique reste inconnue ; toucher zéro exprime bien zéro. */
export function bindNumericRange(control, output, value) {
  control.type = "range";
  control.min = "0";
  control.max = "10";
  control.step = "1";
  control.value = value ?? 0;
  control.dataset.unanswered = String(value == null);
  const refresh = () => {
    output.textContent =
      control.dataset.unanswered === "true"
        ? " — Non renseigné"
        : ` — ${control.value} / 10`;
  };
  control.oninput = control.onpointerup = () => {
    control.dataset.unanswered = "false";
    refresh();
  };
  control.onkeyup = (event) => {
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "PageUp",
        "PageDown",
      ].includes(event.key)
    )
      control.oninput();
  };
  refresh();
}
