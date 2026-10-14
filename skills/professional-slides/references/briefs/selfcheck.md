# Self-check brief: a section's claims against the records

You reproduce every claim of one section from the source records, once, after the section's last structural change - before the build. You also answer the questions the rules ask of the section's copy, listed under the claims: you are the section's only reader, so each line gets one fix that passes both readings. Yours is the last reading: the writer applies your replacements word for word, and no one reads the section again. So every fix you write is final text that fits, traces, adds nothing and keeps the page passing its check. You did not write the pages. Do not edit any file but your answer. Sources: [Self-check](../taste-review.md#self-check), `runtime/judgement-kinds.json` (each question's kind).

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
                  "record": "<what the record says>", "replacement": "<the field's whole new text>" } ],
  "judgements": [ { "key": "<the question's key>", "verdict": "<one of its verdicts>", "reason": "<a sentence>",
                    "quote": "<where its verdict takes one, else null>", "on": "replacement or null" } ] }
```

Every page of the sheet gets a verdict; set `verified: false` on any page with a problem. A `replacement` is the whole new text of its field, applied verbatim, with no trimming. Before you hand back, write each one and read it again against these tests:
- **It fits.** No longer than the `fits` line beside the claim: the title's words, a heading's characters, the slot's words. Cut words to make room; do not move the overrun to the writer.
- **Its numbers trace.** Print every number by token, `{{<insight>/<measure>@<period or member> | <format>}}` at the record's precision (copy the tokens from the `as written` lines), or state a value the record holds.
- **It adds nothing.** No cause, forecast, caveat or comparison the records do not hold, even to soften a claim. Name no rival the record does not set beside it.
- **It does not read the exhibit back.** The judges' restatement rule: a line says what the exhibit means, not what its bars already show.
- **It keeps the page whole.** A callout fits its box, a note its share of the page, the page's body its word band, a title its lines, a table its frame.

**The questions.** Answer every question listed under the claims once, in `judgements`, in the judge answer form: a verdict of its kind, its reason in a sentence, `quote` copied from the subject where the verdict takes one, and each field the verdict needs (a field it does not take is null). Each question names the lines of the sheet it `reads`.
- **One fix a line.** A line a question fails is mended as one of your problems - its field and whole replacement, `record` naming the question and what it found - never with a `replacement` in the judgement.
- **Judge your own replacement.** Where one of your problems replaces a line a question reads, answer the question of the line as your replacement leaves it, and set `"on": "replacement"`. An answer on the text as it stands is lost when the writer applies your fix. Your replacement passes the question it mends; write it again until it does.
- `tiles-one-measure` and the like, which no one line mends, name the change in `fix` as the judges do.

Then run `node runtime/self-check.mjs --validate <your answer> <id>.pages.json`. It refuses an answer that:
- leaves a page without a verdict;
- has a replacement that overruns its slot;
- has a replacement that prints a number no record holds;
- names a field or text not on the page;
- leaves a question unanswered, or answers it as `judge.mjs --validate` would refuse;
- answers a question on a line you replace from the text as it stands;
- has a replacement under which its page has a blocking finding the page does not have now. It composes every page you touch with all your replacements in place and runs the writer's page check, then names the finding and its repair.

Where your replacements raise a question the brief could not list, it prints the question with its key: add it to `judgements` under that key. Mend each reason it prints and run it again until it says the answer is recorded. Your judgements are then recorded in `<id>.judgements.json`, as the judges' are. After the build, `node runtime/self-check.mjs <id>.pages.json out/` records `out/self-check.json`. A page keeps your verdict if its claims are what you read, or what you read with your replacements applied. Only a page changed besides is named, with its lines.
