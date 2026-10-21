// All leave dates are "date-only" values stored as UTC midnight. Only "today" depends on the
// configured business time zone (SystemSetting.timezone).
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isValidDateOnly(value) {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function parseDateOnly(value) {
  if (!isValidDateOnly(value)) throw new Error(`Invalid date: ${value}`);
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export const toDateOnly = (date) => new Date(date).toISOString().slice(0, 10);
export const addDays = (date, n) => new Date(new Date(date).getTime() + n * DAY_MS);
export const diffInDays = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY_MS);

export function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The current calendar date in the given IANA time zone, as UTC midnight. */
export function todayInTimeZone(timeZone = "UTC", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return parseDateOnly(`${get("year")}-${get("month")}-${get("day")}`);
}

/** Leave year label of a date. With startMonth=1 this is the calendar year. */
export function leaveYearOf(date, startMonth = 1) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  return d.getUTCMonth() + 1 >= startMonth ? y : y - 1;
}

export function leaveYearBounds(year, startMonth = 1) {
  const start = new Date(Date.UTC(year, startMonth - 1, 1));
  const end = new Date(Date.UTC(year + 1, startMonth - 1, 1) - DAY_MS);
  return { start, end };
}

export function monthBounds(year, month) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1) - DAY_MS),
  };
}
