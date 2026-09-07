const entry = (useWhen, why, actionTitle) => Object.freeze({ useWhen, why, actionTitle });

export function guidanceNote(guidance) {
  if (!guidance?.useWhen || !guidance?.why || !guidance?.actionTitle) throw new Error("Template guidance requires useWhen, why and actionTitle");
  const note = `Guidance\nUse when: ${guidance.useWhen}\nWhy: ${guidance.why}\nAction title: ${guidance.actionTitle}`;
  if (/\[|\]/.test(note)) throw new Error("Template guidance must use parenthetical prompts, not square brackets");
  return note;
}

export const CHART_GUIDANCE = Object.freeze({
  "chart.column": entry("comparing discrete categories or showing change across a small number of periods", "a common baseline makes differences in magnitude easy to verify; one declared highlight may focus the decisive bar or category region", "state the most important difference, change or threshold shown by the columns"),
  "chart.bar": entry("ranking categories or comparing labels that need horizontal space", "ordered bar length makes relative position and distance easy to scan; one declared highlight may focus the decisive bar or category region", "state the leading, lagging or otherwise decision-relevant category and the size or consequence of the gap"),
  "chart.stacked-column": entry("showing how an absolute total and its composition change across periods", "the shared baseline preserves the total while the segments reveal contribution", "state the total movement and the segment that explains the most important change"),
  "chart.stacked-bar": entry("comparing composition across named groups", "aligned stacks expose both group totals and the contribution of each segment", "state the material mix difference or the segment driving the comparison"),
  "chart.line": entry("showing a time series, trajectory, inflection or divergence", "connected observations make direction, pace and turning points visible", "state the trend, inflection or gap that matters over the declared period"),
  "chart.area": entry("showing the scale and direction of one continuous series over time", "the filled area emphasizes accumulated magnitude while retaining the trajectory", "state the sustained rise, decline or inflection rather than merely naming the measure"),
  "chart.waterfall": entry("reconciling a starting value to an ending value through signed drivers", "the bridge makes each positive and negative contribution auditable", "state the net change and identify the largest driver or offset"),
  "chart.scatter": entry("testing the relationship between two measures and locating outliers or clusters", "position reveals association, separation and exceptions without implying causality", "state the observed relationship, cluster or outlier and its decision relevance"),
  "chart.bubble": entry("comparing two measures while a third quantitative measure controls marker area", "the third encoding adds scale while preserving the two-dimensional position", "state the relationship or outlier and explain why the size measure changes the decision"),
  "chart.pie": entry("showing a simple part-to-whole split with two to five categories", "angles and areas communicate a dominant share when the composition is uncomplicated", "state the dominant share or notable concentration; do not use a generic mix label"),
  "chart.donut": entry("showing the same simple part-to-whole comparison when a lighter visual center is useful", "the ring preserves the composition while reducing visual weight", "state the dominant share, balance or concentration supported by the segments"),
  "chart.combo": entry("comparing two directly related measures across the same categories or periods", "coordinated encodings show whether the measures move together or diverge", "state the relationship or divergence and name the measure that drives the conclusion"),
  "chart.horizons": entry("showing how current, emerging and future growth plays mature across successive time horizons", "staggered curves or stepped stages make the temporal sequence and changing value contribution explicit without implying a precise forecast", "state how the portfolio shifts across horizons and what must be protected, scaled or explored"),
  "chart-group": entry("comparing two or three peer charts that share a question, scale logic or legend", "small multiples make differences visible without overloading one plot; a quiet divider may separate a paired comparison when whitespace is insufficient", "state the cross-chart comparison, not a separate title for each panel")
});

export const SLIDE_TYPE_GUIDANCE = Object.freeze({
  cover: entry("opening a presentation and establishing its subject, audience or time frame", "a restrained cover orients the audience without competing with the argument", "not applicable; use a concise presentation title and a purpose-led subtitle"),
  "section-divider": entry("marking a material shift between chapters", "a divider creates navigation only when the audience needs a clear transition", "not applicable; use the approved section title and omit a subtitle"),
  "tracker-page": entry("orienting the audience across at least three meaningful sections", "a full tracker makes the approved sequence and current position explicit", "use a neutral navigation heading such as Contents or the parent section name"),
  "slide-chrome": entry("assembling an analytical page with the shared title, source and footer system", "consistent page furniture protects hierarchy and provenance across the deck", "state the evidence-backed answer the body of the slide proves")
});

export const STANDARD_SLIDE_GUIDANCE = Object.freeze({
  "golden-cover": SLIDE_TYPE_GUIDANCE.cover,
  "golden-chart-rail": entry("pairing one dominant comparison chart with necessary interpretation", "the rail connects the plotted evidence to a decision without duplicating the data", "state the chart's primary pattern and the consequence developed in the rail"),
  "golden-stacked-and-narrative": entry("explaining a composition chart with a small set of category definitions or drivers", "the narrative clarifies what the stack represents while the chart proves magnitude and mix", "state the material total or mix change and the category that drives it"),
  "golden-line-annotations": entry("showing a time trend with a small number of decisive events", "numbered annotations connect visible turning points to concise explanations", "state the trend or inflection demonstrated by the line"),
  "golden-scatter-rail": entry("showing a two-variable relationship that needs attached interpretation", "the scatter reveals clusters and outliers while the rail explains why they matter", "state the relationship or outlier and its decision consequence"),
  "golden-structured-rows": entry("comparing several trends, themes or workstreams using the same dimensions", "repeated rows support fast cross-item scanning and preserve developed explanations", "state the common pattern or the most important difference across rows"),
  "golden-process": entry("showing a sequential method with distinct phases and activities", "the chevrons make order and handoffs explicit", "state how the sequence reaches the intended outcome or resolves the governing constraint"),
  "golden-organization": entry("showing reporting lines, governance or decision rights", "the hierarchy makes ownership and structural relationships visible", "state the structural finding, accountability gap or change rather than naming the organization chart"),
  "golden-table": entry("comparing several categories across repeated qualitative and quantitative fields", "a typed table keeps unlike evidence aligned without reducing it to prose", "state the differentiator, trade-off or pattern the comparison establishes"),
  "golden-rollout": entry("sequencing initiatives or workstreams across a declared time horizon", "the rollout shows timing, overlap and handoffs across parallel rows", "state the pacing, critical dependency or timing consequence visible in the plan"),
  "golden-divider": SLIDE_TYPE_GUIDANCE["section-divider"],
  "golden-text": entry("presenting a short argument that does not need a quantitative exhibit", "a text-led page preserves hierarchy when the reasoning itself is the evidence", "state the governing conclusion rather than a topic label"),
  "golden-matrix": entry("prioritizing items using two explicit decision dimensions", "position makes relative priority and trade-offs visible", "state which items occupy the priority region and why that matters"),
  "golden-waterfall": CHART_GUIDANCE["chart.waterfall"],
  "golden-pie": CHART_GUIDANCE["chart.pie"],
  "golden-donut": CHART_GUIDANCE["chart.donut"],
  "golden-map": entry("showing geographic distribution, coverage or readiness", "location makes regional concentration and gaps immediately visible", "state the geographic concentration, difference or coverage implication"),
  "golden-roadmap": entry("showing a programme in waves with activities and deliverables", "the wave structure links timing to concrete outputs and decision gates", "state how the sequence delivers the outcome or where the critical dependency sits"),
  "golden-executive-summary": entry("summarizing a developed argument for an executive audience", "thematic sections preserve evidence, implication and conditions while one close states the recommendation", "use Executive summary; each internal theme heading should state a substantive conclusion"),
  "golden-table-insight-category-bullets": entry("comparing developed qualitative evidence and closing with one synthesis", "the table supports row-by-row reasoning while the insight states the governing consequence", "state the cross-row pattern that supports the synthesis"),
  "golden-table-insight-bar-columns": entry("combining qualitative comparison with in-cell quantitative bars and one synthesis", "the table keeps scale and explanatory evidence in the same scan path", "state the quantitative ranking and the qualification that changes its interpretation"),
  "golden-tracker-sequential-progress": SLIDE_TYPE_GUIDANCE["tracker-page"],
  "golden-tracker-number-strip-content": entry("using a compact numbered tracker on a page within a tracked section", "the marker preserves orientation without competing with the analytical title", "state the page answer; do not repeat the selected section label"),
  "golden-tracker-split-progress": SLIDE_TYPE_GUIDANCE["tracker-page"],
  "golden-tracker-label-content": entry("using a compact breadcrumb on a page within a tracked section", "the breadcrumb preserves hierarchy while leaving the action title to carry the conclusion", "state the page answer independently of the breadcrumb")
});

export function assertParentheticalTemplateCopy(slides) {
  const findings = [];
  for (const slide of slides) {
    for (const node of slide.nodes || []) if (typeof node.text === "string" && /\[|\]/.test(node.text)) findings.push({ slide: slide.id, role: node.role, text: node.text });
    if (typeof slide.notes === "string" && /\[|\]/.test(slide.notes)) findings.push({ slide: slide.id, role: "notes", text: slide.notes });
  }
  if (findings.length) throw new Error(`Square-bracket template copy is not allowed: ${JSON.stringify(findings)}`);
  return true;
}
