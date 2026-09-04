// Face names, rather than a CSS-only numeric weight, keep native Office and HTML
// on the same installed glyphs. Companies can replace all typography roles.
export function resolveTypography(input = {}, tokens) {
  if (input.body && input.body !== "Arial" && !input.semibold) throw new Error("A company body font requires an explicit semibold face mapping");
  const profile = {
    body: input.body ?? "Arial", display: input.display ?? input.body ?? "Arial", serif: input.serif ?? "Georgia",
    semibold: input.semibold ?? { family: "Arial", nativeBold: true, effectiveWeight: 700 }
  };
  for (const key of ["body", "display", "serif"]) {
    if (typeof profile[key] !== "string" || !profile[key].trim()) throw new Error(`Invalid typography ${key}`);
    tokens[`font.${key}`] = { ...tokens[`font.${key}`], value: profile[key] };
  }
  const face = profile.semibold;
  if (typeof face.family !== "string" || !face.family.trim() || typeof face.nativeBold !== "boolean" || ![600, 700].includes(face.effectiveWeight)) throw new Error("Semibold mapping requires family, nativeBold and effectiveWeight (600 or an explicit 700 fallback)");
  tokens["font.bodySemibold"] = { ...tokens["font.bodySemibold"], value: face.family, nativeBold: face.nativeBold, effectiveWeight: face.effectiveWeight };
  return { ...profile, requestedAnnotationWeight: 600, fallbacks: face.effectiveWeight === 600 ? [] : [{ role: "chart-annotation", requestedWeight: 600, effectiveWeight: face.effectiveWeight, family: face.family, reason: "Selected font has no native semibold face" }] };
}
