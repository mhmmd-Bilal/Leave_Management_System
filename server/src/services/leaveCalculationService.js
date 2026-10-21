import ApiError from "../utils/ApiError.js";
import { diffInDays } from "../utils/dates.js";
import { calculateLeave, LeaveCalculationError } from "../utils/leaveCalculator.js";
import { toCalendar, todayFor } from "./settingsService.js";

/** Structural calculation + leave-type duration rules; maps calculator errors to HTTP 422. */
export function computeLeave({ leaveType, start, end, isHalfDay, settings }) {
  try {
    return calculateLeave({
      startDate: start,
      endDate: end,
      isHalfDay,
      rules: leaveType.rules,
      calendar: toCalendar(settings),
    });
  } catch (err) {
    if (err instanceof LeaveCalculationError) throw new ApiError(422, err.message);
    throw err;
  }
}

/**
 * Submission-time rules (not re-applied at approval, because time passes between the two):
 * advance notice, back-dating and the global maximum booking horizon.
 */
export function checkSubmissionWindow({ leaveType, start, settings, now = new Date() }) {
  const rules = leaveType.rules;
  const notice = diffInDays(todayFor(settings, now), start); // negative => start date is in the past
  if (notice < 0) {
    if (-notice > (rules.maxBackdateDays || 0)) {
      throw new ApiError(
        422,
        rules.maxBackdateDays
          ? `${leaveType.name} cannot be applied for dates more than ${rules.maxBackdateDays} day(s) in the past`
          : `${leaveType.name} cannot be applied for past dates`
      );
    }
    return;
  }
  if (notice < (rules.advanceNoticeDays || 0)) {
    throw new ApiError(422, `${leaveType.name} requires at least ${rules.advanceNoticeDays} day(s) advance notice`);
  }
  const horizon = settings.policies?.maxAdvanceDays ?? 365;
  if (notice > horizon) {
    throw new ApiError(422, `Leave cannot be applied more than ${horizon} days in advance`);
  }
}
