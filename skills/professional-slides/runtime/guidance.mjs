const entry = (useWhen, why, actionTitle) => Object.freeze({ useWhen, why, actionTitle });

export function guidanceNote(guidance) {
  if (!guidance?.useWhen || !guidance?.why || !guidance?.actionTitle) throw new Error("Template guidance requires useWhen, why and actionTitle");
  const note = `Guidance\nUse when: ${guidance.useWhen}\nWhy: ${guidance.why}\nAction title: ${guidance.actionTitle}`;
  if (/\[|\]/.test(note)) throw new Error("Template guidance must use parenthetical prompts, not square brackets");
  return note;
}

export const CHART_GUIDANCE = Object.freeze({
  "chart.range": entry("showing a band per category (pay ranges, min–max, confidence intervals) where both ends matter", "a floating bar from low to high with both values labelled reads as a band; two bars per category would read as two measures", "state which band sits highest or overlaps least and what that decides"),
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


export function assertParentheticalTemplateCopy(slides) {
  const findings = [];
  for (const slide of slides) {
    for (const node of slide.nodes || []) if (typeof node.text === "string" && /\[|\]/.test(node.text)) findings.push({ slide: slide.id, role: node.role, text: node.text });
    if (typeof slide.notes === "string" && /\[|\]/.test(slide.notes)) findings.push({ slide: slide.id, role: "notes", text: slide.notes });
  }
  if (findings.length) throw new Error(`Square-bracket template copy is not allowed: ${JSON.stringify(findings)}`);
  return true;
}
