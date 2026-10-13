# Self-check brief: a section's claims against the records

You reproduce every claim of one section from the source records, once, after the section's last structural change - before the build, beside the judges. Yours is the last reading: the writer applies your replacements word for word, and no one reads the section again. So every fix you write is final text that fits, traces and adds nothing. You did not write the pages. Do not edit any file but your answer. Sources: [Self-check](../taste-review.md#self-check).

The sheet lists every text a reader takes as a claim: titles, subtitles, headings, points, captions, callouts, notes, metric and tile labels, table cells, and row and column labels. Read each line, short ones too; a row label names the member its row is read as.

- **Numbers.** Every number agrees with its record: the insight's measure (below), and where the insight names a `sources/` file, that file. Check the period, the member, the unit and the rounding. A number the sheet marks `ok` is a value of a measure at its printed precision, so spend your time on the lines marked `CHECK` and on numbers worked out by hand ("a fifth more", "twice", "over half").
- **Ranked and universal words.** "Only", "every", "all", "best", "first", "highest", "leads" and "more than any" hold against the whole set the record holds, not the members the page shows.
- **One basis.** Both sides of a comparison share one definition, population, period and edition; the calculation notes say where they do not. The items and hazards printed under the deck (from the answer critique) bind every page.
- **No claim beyond the records.** A cause, a forecast or a fact no insight records is a problem, however plausible.

Save your answer as `out/self-check/<part>.json` (with `--spine`, `out/self-check/spine/<part>.json` and `"scope": "spine"`):

```json
{ "section": "<part>",
  "pages": { "<page id>": { "sheet": "<the sheet hash printed beside the page>", "verified": true } },
  "problems": [ { "slide": "<id>", "field": "<the field as the sheet names it>", "claim": "<its text as the sheet prints it>",
                  "record": "<what the record says>", "replacement": "<the field's whole new text>" } ] }
```

Every page of the sheet gets a verdict; set `verified: false` on any page with a problem. A `replacement` is the whole new text of its field, applied verbatim, with no trimming. Before you hand back, write each one and read it again against these tests:
- **It fits.** No longer than the `fits` line beside the claim: the title's words, a heading's characters, the slot's words. Cut words to make room; do not move the overrun to the writer.
- **Its numbers trace.** Print every number by token, `{{<insight>/<measure>@<period or member> | <format>}}` at the record's precision (copy the tokens from the `as written` lines), or state a value the record holds.
- **It adds nothing.** No cause, forecast, caveat or comparison the records do not hold, even to soften a claim. Name no rival the record does not set beside it.
- **It does not read the exhibit back.** The judges' restatement rule: a line says what the exhibit means, not what its bars already show.

Then run `node runtime/self-check.mjs --validate <your answer> <id>.pages.json`. It refuses an answer that:
- leaves a page without a verdict;
- has a replacement that overruns its slot;
- has a replacement that prints a number no record holds;
- names a field or text not on the page.

Mend each reason it prints and run it again until it says the answer would be recorded. After the build, `node runtime/self-check.mjs <id>.pages.json out/` records `out/self-check.json`. A page keeps your verdict if its claims are what you read, or what you read with your replacements applied. Only a page changed besides is named, with its lines.
