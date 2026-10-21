import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateLeave, LeaveCalculationError } from "../../utils/leaveCalculator.js";
import { parseDateOnly } from "../../utils/dates.js";

const d = parseDateOnly;
const cal = (over = {}) => ({ workingDays: [1, 2, 3, 4, 5], holidays: new Set(), leaveYearStartMonth: 1, ...over });
const rules = (over = {}) => ({ minDays: 0.5, maxDays: 30, allowHalfDay: false, countWeekends: false, countHolidays: false, ...over });

test("Mon-Wed counts 3 working days", () => {
  const r = calculateLeave({ startDate: d("2025-03-03"), endDate: d("2025-03-05"), rules: rules(), calendar: cal() });
  assert.equal(r.days, 3);
  assert.deepEqual(r.byYear, [{ year: 2025, days: 3 }]);
});

test("weekends are excluded by default (Fri-Mon = 2 days) and included when countWeekends is true", () => {
  const args = { startDate: d("2026-10-16"), endDate: d("2026-10-19"), calendar: cal() };
  assert.equal(calculateLeave({ ...args, rules: rules() }).days, 2);
  assert.equal(calculateLeave({ ...args, rules: rules({ countWeekends: true }) }).days, 4);
});

test("holidays are excluded unless countHolidays is true", () => {
  const calendar = cal({ holidays: new Set(["2026-10-20"]) }); // a Tuesday
  const args = { startDate: d("2026-10-19"), endDate: d("2026-10-21"), calendar };
  assert.equal(calculateLeave({ ...args, rules: rules() }).days, 2);
  assert.equal(calculateLeave({ ...args, rules: rules({ countHolidays: true }) }).days, 3);
});

test("leap day is counted (Mon 26 Feb - Fri 1 Mar 2024 = 5 working days)", () => {
  const r = calculateLeave({ startDate: d("2024-02-26"), endDate: d("2024-03-01"), rules: rules(), calendar: cal() });
  assert.equal(r.days, 5);
  assert.ok(r.countedDates.includes("2024-02-29"));
});

test("cross-year request is split per leave year", () => {
  const r = calculateLeave({
    startDate: d("2025-12-30"), endDate: d("2026-01-03"),
    rules: rules({ countWeekends: true }), calendar: cal({ workingDays: [0, 1, 2, 3, 4, 5, 6] }),
  });
  assert.equal(r.days, 5);
  assert.deepEqual(r.byYear, [{ year: 2025, days: 2 }, { year: 2026, days: 3 }]);
});

test("custom leave year (April start) buckets March and April into different years", () => {
  const r = calculateLeave({
    startDate: d("2026-03-31"), endDate: d("2026-04-01"),
    rules: rules(), calendar: cal({ leaveYearStartMonth: 4 }),
  });
  assert.deepEqual(r.byYear, [{ year: 2025, days: 1 }, { year: 2026, days: 1 }]);
});

test("half-day: allowed only when the rule is on and for a single working day", () => {
  const base = { startDate: d("2025-03-03"), endDate: d("2025-03-03"), isHalfDay: true, calendar: cal() };
  assert.throws(() => calculateLeave({ ...base, rules: rules() }), LeaveCalculationError);
  assert.equal(calculateLeave({ ...base, rules: rules({ allowHalfDay: true }) }).days, 0.5);
  assert.throws(
    () => calculateLeave({ ...base, endDate: d("2025-03-04"), rules: rules({ allowHalfDay: true }) }),
    /single day/
  );
});

test("a range with no eligible days is rejected", () => {
  assert.throws(
    () => calculateLeave({ startDate: d("2026-10-17"), endDate: d("2026-10-18"), rules: rules(), calendar: cal() }),
    /no eligible leave days/
  );
});

test("min/max duration and invalid ranges are enforced", () => {
  const args = { startDate: d("2025-03-03"), endDate: d("2025-03-07"), calendar: cal() };
  assert.throws(() => calculateLeave({ ...args, rules: rules({ maxDays: 3 }) }), /Maximum/);
  assert.throws(() => calculateLeave({ ...args, rules: rules({ minDays: 6 }) }), /Minimum/);
  assert.throws(() => calculateLeave({ ...args, endDate: d("2025-03-01"), rules: rules() }), /before start/);
  assert.throws(
    () => calculateLeave({ startDate: d("2025-01-01"), endDate: d("2026-06-01"), rules: rules(), calendar: cal() }),
    /cannot span more than/
  );
});
