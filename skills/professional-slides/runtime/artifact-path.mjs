// A deck id is a filename stem, never a path supplied to build or cleanup.
export function deckStem(spec) {
  const id = spec.deckPlan?.id || spec.id || "deck";
  if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || id.endsWith(".")) {
    throw new Error("Deck id must be a safe filename: letters, numbers, dots, underscores or hyphens");
  }
  return id;
}
