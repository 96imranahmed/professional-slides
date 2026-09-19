// Shared numeric label formatting; encoding continues to use the raw value.
import { groupThousands } from "./draw.mjs";
export function formatValue(value, props) {
  const format = props.valueFormat;
  // Without a declared format, labels round the way a reader reads them: whole
  // numbers from ten up, one decimal below ten. Marks keep the raw value.
  // Four figures and up read with a thousands separator, the way every
  // published page prints them: 10,156 rather than 10156.
  const group = groupThousands;
  if (!format) {
    const rounded = Number.isInteger(value) ? value : Math.abs(value) >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
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
