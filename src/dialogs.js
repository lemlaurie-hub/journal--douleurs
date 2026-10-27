// Une seule gestion des fenêtres : mêmes actions, même protection contre
// l'abandon d'une saisie, quelle que soit la fiche ouverte.
const snapshots = new WeakMap();

function signature(dialog) {
  return JSON.stringify(
    [
      ...dialog.querySelectorAll(
        "input,select,textarea,#levels [aria-pressed]",
      ),
    ].map((control) => [
      control.id,
      control.name,
      control.value,
      control.checked,
      control.getAttribute("aria-pressed"),
      control.dataset.unanswered,
    ]),
  );
}

export function openDialog(dialog) {
  const error = dialog.querySelector(".dialog-error");
  if (error) error.textContent = "";
  snapshots.set(dialog, signature(dialog));
  dialog.showModal();
  // Une nouvelle ouverture commence en haut ; fermer un agrandissement ne
  // modifie pas, lui, le défilement de la fiche restée ouverte derrière.
  dialog.scrollTop = 0;
}

export function closeDialog(dialog, { saved = false } = {}) {
  if (!dialog.open) return true;
  if (
    !saved &&
    snapshots.get(dialog) !== signature(dialog) &&
    !window.confirm("Fermer sans enregistrer les modifications ?")
  )
    return false;
  dialog.close();
  snapshots.delete(dialog);
  return true;
}

/** Barre unique toujours visible ; on déplace les VRAIS boutons de soumission. */
export function setupDialogBars() {
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog(dialog, { saved: !dialog.querySelector("form") });
    });
    const form = dialog.querySelector("form");
    if (!form || form.querySelector(".dialog-toolbar")) return;
    const toolbar = document.createElement("div");
    toolbar.className = "dialog-toolbar";
    const submit = form.querySelector('button[type="submit"]');
    const cancel = form.querySelector(
      "[data-dialog-cancel],#cancel-edit,#transit-close,[data-close-catalog]:not(.icon-button)",
    );
    if (cancel) {
      cancel.hidden = false;
      cancel.textContent = "✕ Annuler";
      toolbar.append(cancel);
    }
    if (submit) {
      submit.textContent = "✓ Enregistrer";
      toolbar.append(submit);
    }
    form.prepend(toolbar);
    const error = document.createElement("p");
    error.className = "dialog-error transit-error";
    error.setAttribute("role", "alert");
    toolbar.after(error);
    form.querySelectorAll(".dialog-actions,.form-actions").forEach((group) => {
      if (!group.children.length) group.remove();
    });
    form
      .querySelectorAll(".icon-button[data-close-catalog]")
      .forEach((button) => (button.hidden = true));
  });
}
