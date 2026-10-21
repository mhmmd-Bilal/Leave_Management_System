// CSV serialisation with RFC 4180 escaping and spreadsheet formula-injection protection (OWASP):
// text cells that start with = + - @ TAB or CR are prefixed with a single quote so Excel/Sheets
// treat them as text. Real numbers are written as numbers.
const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  let s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** @param {{key:string,label:string}[]} columns  @param {object[]} rows */
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => escapeCsvValue(c.label)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => escapeCsvValue(row[c.key])).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
