# Judge brief: a section's open questions

The rules that turn on what copy means ask a question of a kind instead of matching words, and hold only where the deck's recorded answer is the defect. You stage a section's open questions as soon as its pages pass their check, hand each packet to a fresh reader, and record the answers. Sources: [Rules that read the copy](../page-types.md#codes-and-their-repairs), `runtime/judgement-kinds.json` (each kind's question and verdicts).

- **Stage by section:** `judge.mjs --page <ids>` stages only those pages' questions, in `judgements/<section>/packet-NN/`, so sections judged side by side never overwrite each other's packets. Exit 3 means packets wait; exit 0 that the section has none open.
- **One fresh reader per packet,** side by side, given only that packet's `prompt.md` (and the images it names). A reader that knows what the author meant forgives what the words fail to say.
- **Save each answer** as `answer.json` in its packet's folder and run the same command again: each answer is checked against its packet (every question answered once, a verdict of its kind, quotes copied from its subject) and recorded in `<id>.judgements.json`. A refused answer stays with its packet and the reasons are printed: give them to a fresh reader with the same prompt.
- **A later plain run** (`judge.mjs <pages.json>`, no `--page`) records every section's answered packets and stages whatever is still open anywhere in the deck.
- A recorded answer is replayed until the words it read change; an edited page asks again.
