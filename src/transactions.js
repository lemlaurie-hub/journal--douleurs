// Frontière d'écriture commune, indépendante de l'interface et des commandes.
// Une commande ne travaille jamais sur la référence observée par les écrans.
// localStorage.setItem est atomique : si la sauvegarde échoue, la copie est
// abandonnée et l'état partagé reste exactement celui d'avant l'opération.
export function transactData(data, action, persist) {
  const next = structuredClone(data);
  const result = action(next);
  if (result && typeof result.then === "function") {
    throw new Error("Une transaction de données doit être synchrone.");
  }
  persist(next);
  // Publier en mémoire seulement après la réussite de l'écriture. Conserver
  // l'identité racine permet aux modules déjà branchés de lire le même état.
  for (const key of Object.keys(data)) delete data[key];
  Object.assign(data, next);
  return result;
}
