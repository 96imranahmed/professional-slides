// Taste for tables, as a pass the build runs on every compiled page. A table whose column holds one figure a row - the
// raised amounts, the multiples, the shares the rows are compared on - read as a column of plain text on the Retell
// investor deck: forty-odd figures across its competitor tables, not one of them in a bubble or a bar, because nothing
// in the flow asked for one. drawing.md says a column of one kind of figure sits in matching bubbles and a column of
// amounts takes bars; this pass says so on the page where it is not done (`TABLE_FIGURES_PLAIN`, advised).

// One figure as a table writes it: an optional approximation or sign, a currency, the number, a magnitude and a unit,
// an optional "+" for "or more". "$4.6M", "~$270M", ">$100M", "45%", "22x", "549", "$0.07", "-55%", "$100M+".
const FIGURE = /^(?:~|c\.\s?|≈|[<>≤≥]\s?)?([+\-−]?)([$€£¥])?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s?([kKmMbBtT]n?|bn)?\s?(%|x|×|pts?|pp)?\+?$/;
// What a cell says when there is no figure: a dash, n/a, not disclosed.
const EMPTY = /^(?:|-|–|—|n\/?a|n\/?d|tbc|none|nil)$/i;
const TREATMENTS = ["bubble", "bar", "heat", "harvey", "implication", "icon", "logo", "type"];

/** A cell as text, or null where it is a typed cell (a logo, a pill, a mark), which is already treated. */
function cellText(cell) {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") return String(cell);
  if (typeof cell === "string") return cell.trim();
  if (typeof cell === "object" && !cell.type && typeof cell.text === "string" && cell.highlight === undefined) return cell.text.trim();
  return null;
}

/** The kind of figure a cell holds - its currency, magnitude and unit - or null where it holds words, a range or nothing. */
export function figureKind(text) {
  const m = FIGURE.exec(String(text).replace(/\s+/g, " ").trim());
  if (!m) return null;
  const [, , currency = "", , magnitude = "", unit = ""] = m;
  return { currency, magnitude: magnitude.toLowerCase().replace(/^(b|bn)$/, "b"), unit: unit.toLowerCase().replace("×", "x").replace(/^pts?$|^pp$/, "pt") };
}

const rowCells = (row) => (Array.isArray(row) ? row : Array.isArray(row?.cells) ? row.cells : null);
const label = (column, index) => (typeof column === "string" ? column : typeof column?.label === "string" ? column.label : `column ${index + 1}`);

/**
 * The columns of a compiled table that hold one figure of one kind on every row that has one, at least three of them,
 * with no treatment of their own: `[{ column, index, device }]`, the device the figures want - a bubble for a share, a
 * multiple or a growth rate, a bar for an amount or a count. The first column holds the rows' labels and is skipped.
 */
export function plainFigureColumns(ex) {
  if (!ex || !Array.isArray(ex.columns) || !Array.isArray(ex.rows) || ex.rows.length < 3 || ex.bubbleColumn !== undefined) return [];
  const rows = ex.rows.map(rowCells).filter(Boolean);
  return ex.columns.flatMap((column, index) => {
    if (index === 0) return [];
    if (column && typeof column === "object" && TREATMENTS.some((key) => column[key])) return [];
    const texts = rows.map((cells) => cellText(cells[index]));
    if (texts.some((text) => text === null)) return [];
    const said = texts.filter((text) => !EMPTY.test(text));
    if (said.length < 3) return [];
    const kinds = said.map(figureKind);
    if (kinds.some((kind) => !kind)) return [];
    // Pills in one column are compared at a glance, so they share one unit (tables.mjs refuses "$2M" beside "70%").
    const keys = new Set(kinds.map((kind) => `${kind.currency}|${kind.unit}`));
    if (keys.size > 1) return [];
    const { currency, unit } = kinds[0];
    const device = unit === "%" || unit === "x" || unit === "pt" ? "bubble" : currency || kinds.every((kind) => kind.magnitude) ? "bar" : "bubble";
    return [{ column: label(column, index), index, device }];
  });
}

const exhibitsOf = (slide) => [slide?.exhibit, ...(Array.isArray(slide?.exhibits) ? slide.exhibits : [])].filter((ex) => ex && typeof ex === "object");

/** `TABLE_FIGURES_PLAIN` for each compiled page whose tables leave a column of figures as plain text. */
export function tableTasteFindings(spec) {
  const findings = [];
  for (const slide of [...(spec?.slides || []), ...(spec?.appendix || [])]) {
    const plain = exhibitsOf(slide).filter((ex) => ex.type === "table").flatMap(plainFigureColumns);
    if (!plain.length) continue;
    const say = plain.map(({ column, device }) => `"${column}" (\`${device}: true\`${device === "bar" ? " with its `unit`" : ""})`).join(", ");
    findings.push({ code: "TABLE_FIGURES_PLAIN", id: String(slide.id), severity: "advisory", measured: plain.map(({ column, device }) => ({ column, device })),
      repair: `${slide.id}: ${plain.length === 1 ? "a column holds" : `${plain.length} columns hold`} one figure a row as plain text - ${say}. A share, multiple or rate the rows are compared on sits in matching bubbles; an amount or a count takes a bar in its cell (drawing.md). Leave it plain only where the figures are looked up, not compared` });
  }
  return findings;
}
