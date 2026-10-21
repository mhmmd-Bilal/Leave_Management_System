import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays, diffInDays, isValidDateOnly, leaveYearBounds, leaveYearOf, parseDateOnly, toDateOnly, todayInTimeZone,
} from "../../utils/dates.js";

test("strict date-only validation (leap years, impossible dates)", () => {
  assert.equal(isValidDateOnly("2024-02-29"), true);
  assert.equal(isValidDateOnly("2025-02-29"), false);
  assert.equal(isValidDateOnly("2025-13-01"), false);
  assert.equal(isValidDateOnly("2025-1-1"), false);
  assert.equal(isValidDateOnly("not-a-date"), false);
});

test("date arithmetic is timezone independent (UTC midnight)", () => {
  const d = parseDateOnly("2025-12-31");
  assert.equal(toDateOnly(addDays(d, 1)), "2026-01-01");
  assert.equal(diffInDays(parseDateOnly("2025-03-03"), parseDateOnly("2025-03-10")), 7);
});

test("leave-year helpers", () => {
  assert.equal(leaveYearOf(parseDateOnly("2026-03-31"), 4), 2025);
  assert.equal(leaveYearOf(parseDateOnly("2026-04-01"), 4), 2026);
  const b = leaveYearBounds(2026, 4);
  assert.equal(toDateOnly(b.start), "2026-04-01");
  assert.equal(toDateOnly(b.end), "2027-03-31");
  const c = leaveYearBounds(2026, 1);
  assert.equal(toDateOnly(c.end), "2026-12-31");
});

test("today is computed in the business time zone", () => {
  const instant = new Date("2025-06-30T20:00:00Z"); // already July 1st in Kolkata (UTC+5:30)
  assert.equal(toDateOnly(todayInTimeZone("Asia/Kolkata", instant)), "2025-07-01");
  assert.equal(toDateOnly(todayInTimeZone("UTC", instant)), "2025-06-30");
});
