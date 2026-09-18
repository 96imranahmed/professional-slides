// Verify authored prose survives composition before the standard exporter runs.
// Layout selection must not turn supplied commentary into a silent no-op.
const normalize = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();

export function auditContent(spec, scene) {
  const authored = [...(spec.slides || []), ...(spec.appendix || [])];
  const findings = [];
  for (const slide of authored) {
    if (!slide.title || (slide.kind && slide.kind !== "content")) continue;
    const title = normalize(slide.title);
    const pages = scene.slides.filter((page) => page.nodes.some((n) => n.role === "action-title"
      && normalize(n.data?.textLayout?.source ?? n.text).replace(/\s*\(\d+\/\d+\)$/, "") === title));
    const rendered = normalize(pages.flatMap((page) => page.nodes.filter((n) => n.type === "text")
      .map((n) => n.data?.textLayout?.source ?? n.text)).join(" "));
    const prose = [];
    const collect = (value) => {
      if (typeof value === "string") prose.push(value);
      else if (value && typeof value === "object") {
        for (const key of ["lead", "heading", "label", "text"]) if (value[key]) prose.push(value[key]);
      }
    };
    for (const value of [...(slide.points || []), ...(slide.paragraphs || []), ...(slide.insights || []), ...(slide.pictures || [])]) collect(value);
    for (const key of ["insight", "callout", "soWhat"]) collect(slide[key]);
    for (const text of prose) if (!rendered.includes(normalize(text))) findings.push({ title, text, code: "MISSING_AUTHORED_CONTENT" });
  }
  return { accepted: findings.length === 0, findings };
}
