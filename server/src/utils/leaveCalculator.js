import { addDays, diffInDays, leaveYearOf, toDateOnly } from "./dates.js";

export const MAX_RANGE_DAYS = 366;

export class LeaveCalculationError extends Error {
  constructor(message) {
    super(message);
    this.name = "LeaveCalculationError";
  }
}

/**
 * Pure leave-day calculation (no database access).
 *
 * @param {Date}    startDate   UTC-midnight date
 * @param {Date}    endDate     UTC-midnight date (inclusive)
 * @param {boolean} isHalfDay   half-day request (single day, counts 0.5)
 * @param {object}  rules       LeaveType.rules
 * @param {object}  calendar    { workingDays: number[] (0=Sun..6=Sat), holidays: Set<'YYYY-MM-DD'>, leaveYearStartMonth }
 * @returns {{days:number, byYear:{year:number,days:number}[], countedDates:string[]}}
 *
 * A day is counted when:
 *   - it is a working day, OR it is a non-working day and rules.countWeekends is true; AND
 *   - it is not a holiday, OR it is a holiday and rules.countHolidays is true.
 * Days are bucketed by leave year, so cross-year requests are split correctly.
 */
export function calculateLeave({ startDate, endDate, isHalfDay = false, rules, calendar }) {
  if (endDate < startDate) throw new LeaveCalculationError("End date cannot be before start date");
  const span = diffInDays(startDate, endDate) + 1;
  if (span > MAX_RANGE_DAYS) {
    throw new LeaveCalculationError(`A leave request cannot span more than ${MAX_RANGE_DAYS} days`);
  }
  if (isHalfDay) {
    if (!rules.allowHalfDay) {
      throw new LeaveCalculationError("Half-day leave is not permitted for this leave type");
    }
    if (span !== 1) throw new LeaveCalculationError("Half-day leave must be for a single day");
  }

  const working = new Set(calendar.workingDays);
  const startMonth = calendar.leaveYearStartMonth || 1;
  const perDay = isHalfDay ? 0.5 : 1;
  const byYear = new Map();
  const countedDates = [];
  let total = 0;

  for (let i = 0; i < span; i += 1) {
    const d = addDays(startDate, i);
    const iso = toDateOnly(d);
    if (!working.has(d.getUTCDay()) && !rules.countWeekends) continue;
    if (calendar.holidays.has(iso) && !rules.countHolidays) continue;
    total += perDay;
    countedDates.push(iso);
    const y = leaveYearOf(d, startMonth);
    byYear.set(y, (byYear.get(y) || 0) + perDay);
  }

  if (total === 0) {
    throw new LeaveCalculationError("The selected dates contain no eligible leave days");
  }
  if (rules.minDays != null && total < rules.minDays) {
    throw new LeaveCalculationError(`Minimum leave duration for this leave type is ${rules.minDays} day(s)`);
  }
  if (rules.maxDays != null && total > rules.maxDays) {
    throw new LeaveCalculationError(`Maximum leave duration for this leave type is ${rules.maxDays} day(s)`);
  }

  return {
    days: total,
    byYear: [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, days]) => ({ year, days })),
    countedDates,
  };
}
