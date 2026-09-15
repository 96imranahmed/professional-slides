# Inline emphasis in measured text

`runtime/text-layout.mjs` owns `measureTextRuns(runs, width, options)` for a complete paragraph with selective bold emphasis. Each input run has only `text` and boolean `bold`. The complete paragraph shares the same resolved font family, point size, line height and color. This is not a local typography override API.

The helper measures actual regular/bold glyph widths, wraps the paragraph once, and returns `text`, `lines`, `runs`, measured `width`, `height` and `lineHeight`. The returned runs concatenate exactly to the measured text, including explicit line breaks. Normal `measureText` behavior is unchanged.

Pass measured `text` and `runs` into one `textPrimitive`. The primitive rejects mismatched text, extra run properties and missing boolean weights. Its semantic ID, role, owner and dependencies belong to the complete paragraph. Both the HTML observer and native PowerPoint adapter preserve that single node: HTML uses inline spans and PowerPoint uses runs in one text box. Individual runs inherit all theme bindings from the parent; adapters do not wrap them independently.

Use selective emphasis only when it materially helps readers scan dense evidence. A lead is not a new heading and must not repeat the paragraph in another box. The phase/workstream owner offers the narrower exact-prefix `lead` contract for activity copy. Keep any source-specific prefix selection in authored inputs, not a phrase list inside the runtime.

Choose exact meaningful spans: a claim lead, a decisive magnitude with its unit and time basis, or a qualification that changes the conclusion. For example, emphasizing “$8–12M annually” must not strand “subject to service-level testing” where it becomes easy to miss. Keep the full sentence and its qualification in one semantic paragraph; bold is a scanning aid, not a substitute for connected reasoning. Avoid emphasizing every number or the whole paragraph, which removes contrast between claim and support.

Adding bold can change wrapping. Remeasure complete paragraphs and their containing bands before compilation; impossible fits reject. Native text reconstruction and observer line-break parity must be tested before accepting the exact exported candidate.
