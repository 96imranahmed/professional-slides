// Shared numeric label formatting; encoding continues to use the raw value.
import { groupThousands } from "./draw.mjs";
/**
 * How many decimals a chart's labels carry - decided once for the chart, not
 * per value.
 *
 * Rounding each label on its own gave a series of 6.2, 5.3, 13.5 the labels
 * "6.2", "5.3" and "14": the one bar the title was about was the only one
 * rounded, and it was rounded to a different number than the title said. A set
 * of numbers read across is written to one precision, so the chart's own
 * values decide it - a decimal while the largest of them is under a hundred
 * and any of them needs one, and whole numbers above that.
 */
function decimalsFor(props, value) {
  const all = [
    ...((props?.series || []).flatMap((item) => (Array.isArray(item?.values) ? item.values : []))),
    ...(Array.isArray(props?.values) ? props.values : []),
  ].filter((entry) => Number.isFinite(entry));
  if (all.length > 1) {
    const largest = Math.max(...all.map((entry) => Math.abs(entry)));
    if (largest >= 100) return 0;
    return all.some((entry) => !Number.isInteger(entry)) ? 1 : 0;
  }
  return Number.isInteger(value) ? 0 : Math.abs(value) >= 10 ? 0 : 1;
}

const round = (value, decimals) => (decimals
  ? Math.round(value * 10 ** decimals) / 10 ** decimals
  : Math.round(value));

export function formatValue(value, props) {
  const format = props.valueFormat;
  // Without a declared format, labels round the way a reader reads them: whole
  // numbers from ten up, one decimal below ten. Marks keep the raw value.
  // Four figures and up read with a thousands separator, the way every
  // published page prints them: 10,156 rather than 10156.
  const group = groupThousands;
  if (!format) {
    const rounded = round(value, decimalsFor(props, value));
    const [whole, fraction] = String(rounded).split(".");
    const sign = whole.startsWith("-") ? "-" : "";
    const digits = sign ? whole.slice(1) : whole;
    return `${sign}${digits.length > 3 ? group(digits) : digits}${fraction ? `.${fraction}` : ""}`;
  }
  if (format.sign !== undefined && !["auto", "always"].includes(format.sign)) throw new Error("valueFormat.sign must be auto or always");
  const units = {k: 1000, m: 1000000, bn: 1000000000};
  if (format.compactUnit !== undefined && !Object.hasOwn(units, format.compactUnit)) throw new Error("valueFormat.compactUnit must be k, m or bn");
  const divisor = units[format.compactUnit] || 1;
  const decimals = format.decimals ?? (format.compactUnit ? 1 : 0);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) throw new Error("valueFormat.decimals must be an integer from zero to six");
  if (format.grouping !== undefined && typeof format.grouping !== "boolean") throw new Error("valueFormat.grouping must be boolean");
  const raw = Number(value / divisor).toFixed(decimals);
  const number = format.grouping ? raw.split(".").map((part, index) => index === 0 ? group(part) : part).join(".") : raw;
  const sign = format.sign === "always" && Number(raw) > 0 ? "+" : "";
  return `${format.prefix || ""}${sign}${number}${format.compactUnit || ""}${format.suffix || ""}`;
}

/**
 * A formatted number with its unit, written the way the unit is written.
 *
 * "$m" after the figure gives "888$m", which no published page prints: a
 * currency symbol leads and its magnitude trails, so the same unit gives
 * "$888m". A percent closes up against the number, and everything else takes
 * the space it needs.
 */
export function withUnit(text, unit) {
  const trimmed = String(unit ?? "").trim();
  if (!trimmed) return String(text);
  const currency = trimmed.match(/^([$£€¥₹])\s*(.*)$/);
  if (currency) return `${currency[1]}${text}${currency[2]}`;
  if (/^[%‰]/.test(trimmed)) return `${text}${trimmed}`;
  return `${text} ${trimmed}`;
}
