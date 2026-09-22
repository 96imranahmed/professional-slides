// Verify explicit content and visual choices survive composition before export.
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
    const nodes = pages.flatMap(page => page.nodes);
    const missingIntent = (kind, value) => findings.push({ title, code: "MISSING_VISUAL_INTENT", kind, value });
    // Check explicit choices only. Meaning and useful omissions remain the
    // author/reviewer's responsibility; no keyword-driven styling is inferred.
    if (["icon-lead", "icon-framed"].includes(slide.pointsStyle)) {
      const expected = (slide.points || []).filter(point => point.icon).map(point => point.icon);
      const actual = nodes.filter(node => node.role === "list-icon-glyph").map(node => node.data?.icon);
      for (const icon of expected) {
        const index = actual.indexOf(icon);
        if (index < 0) missingIntent("icon", icon); else actual.splice(index, 1);
      }
    }
    if (slide.evidenceStatus && !nodes.some(node => node.type === "text" && normalize(node.data?.textLayout?.source ?? node.text).includes(normalize(slide.evidenceStatus))))
      missingIntent("evidence-status", slide.evidenceStatus);
    for (const exhibit of [slide.exhibit, ...(slide.exhibits || [])].filter(Boolean)) {
      if (exhibit.type === "table") {
        for (const row of exhibit.rows || []) {
          if (row.style) continue; // Explicit totals/groups own their surface.
          const cells = Array.isArray(row) ? row : row.cells || [];
          cells.forEach((cell, column) => {
            if (cell?.type !== "category" && exhibit.columns?.[column]?.type !== "category") return;
            const surface = cell?.surface ?? exhibit.columns?.[column]?.surface
              ?? (exhibit.variant === "plain" || exhibit.treatment === "dimensions" ? "plain" : "primary");
            if (surface === "plain") return; // A deliberate plain category is valid.
            const label = normalize(typeof cell === "string" ? cell : cell?.text);
            if (!label) return;
            const texts = nodes.filter(node => node.type === "text" && node.data?.cellType === "category"
              && normalize(node.data?.textLayout?.source ?? node.text) === label);
            const filled = texts.some(text => nodes.some(node => node.role === "table-cell" && node.style.fill && node.style.fill !== "none"
              && node.data?.componentInstance === text.data.componentInstance && node.data?.row === text.data.row && node.data?.column === text.data.column));
            if (!filled) missingIntent("category", label);
          });
        }
      }
      for (const reference of exhibit.referenceLines || []) {
        if (reference.label && !nodes.some(node => node.role === "chart-reference-label" && normalize(node.data?.textLayout?.source ?? node.text) === normalize(reference.label)))
          missingIntent("reference-label", reference.label);
      }
    }
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
