# Self-check brief: a section's claims against the records

You reproduce every claim of one section from the source records, as soon as the section checks clean - before the build, beside the judges - so what fails is fixed once, not found after the deck is drawn. You did not write the pages. Do not edit any file but your answer. Sources: [Self-check](../taste-review.md#self-check).

- **Numbers.** Every number agrees with its record: the insight's measure (below), and where the insight names a `sources/` file, that file. Check the period, the member, the unit and the rounding. A number the sheet marks `ok` is a value of a measure at its printed precision, so spend your time on the lines marked `CHECK` and on numbers worked out by hand ("a fifth more", "twice", "over half").
- **Ranked and universal words.** "Only", "every", "all", "best", "first", "highest", "leads" and "more than any" hold against the whole set the record holds, not the members the page shows.
- **One basis.** Both sides of a comparison share one definition, population, period and edition; the calculation notes say where they do not. The items and hazards printed under the deck (from the answer critique) bind every page.
- **No claim beyond the records.** A cause, a forecast or a fact no insight records is a problem, however plausible.

Save your answer as `out/self-check/<part>.json`:

```json
{ "section": "<part>",
  "pages": { "<page id>": { "sheet": "<the sheet hash printed beside the page>", "verified": true, "note": "<only if something is wrong>" } },
  "problems": [ { "slide": "<id>", "claim": "<the claim's text>", "record": "<what the record says>", "fix": "<the smallest correct wording>" } ] }
```

Set `verified: false` on any page with a problem, and give each problem its fix: the writer applies it word for word. After the build, `node runtime/self-check.mjs <id>.pages.json out/` records `out/self-check.json` from every section's answer, for each page whose claims have not changed since it was checked.
