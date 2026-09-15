// Shared numeric label formatting; encoding continues to use the raw value.
export function formatValue(value, props) {
  const format = props.valueFormat;
  // Without a declared format, labels round the way a reader reads them: whole
  // numbers from ten up, one decimal below ten. Marks keep the raw value.
  if (!format) return Number.isInteger(value) ? String(value) : Math.abs(value) >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
  if (format.sign !== undefined && !["auto", "always"].includes(format.sign)) throw new Error("valueFormat.sign must be auto or always");
  const units = {k: 1000, m: 1000000, bn: 1000000000};
  if (format.compactUnit !== undefined && !Object.hasOwn(units, format.compactUnit)) throw new Error("valueFormat.compactUnit must be k, m or bn");
  const divisor = units[format.compactUnit] || 1;
  const decimals = format.decimals ?? (format.compactUnit ? 1 : 0);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) throw new Error("valueFormat.decimals must be an integer from zero to six");
  if (format.grouping !== undefined && typeof format.grouping !== "boolean") throw new Error("valueFormat.grouping must be boolean");
  const raw = Number(value / divisor).toFixed(decimals);
  const number = format.grouping ? raw.split(".").map((part, index) => index === 0 ? part.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : part).join(".") : raw;
  const sign = format.sign === "always" && Number(raw) > 0 ? "+" : "";
  return `${format.prefix || ""}${sign}${number}${format.compactUnit || ""}${format.suffix || ""}`;
}
