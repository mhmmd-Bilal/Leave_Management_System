import LeaveBalance from "../models/leaveBalanceModel.js";
import SystemSetting from "../models/systemSettingModel.js";
import ApiError from "../utils/ApiError.js";
import { leaveYearOf, parseDateOnly, toDateOnly, todayInTimeZone } from "../utils/dates.js";
import { runInTransaction } from "../utils/transaction.js";
import { logAction } from "./auditService.js";

/** Returns the settings singleton as a plain object, creating it with defaults on first use. */
export async function getSettings() {
  let s = await SystemSetting.findOne({ key: "global" }).lean();
  if (!s) {
    try {
      s = (await SystemSetting.create({ key: "global" })).toObject();
    } catch (err) {
      if (err.code !== 11000) throw err;
      s = await SystemSetting.findOne({ key: "global" }).lean();
    }
  }
  return s;
}

export const serializeSettings = (s) => ({
  workingDays: s.workingDays,
  weekendDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.workingDays.includes(d)),
  holidays: (s.holidays || []).map((h) => ({ date: toDateOnly(h.date), name: h.name })),
  leaveYearStartMonth: s.leaveYearStartMonth,
  timezone: s.timezone,
  allocationDefaults: s.allocationDefaults || [],
  policies: s.policies,
  updatedAt: s.updatedAt,
});

/** Calendar view of the settings used by the pure leave calculator. */
export const toCalendar = (s) => ({
  workingDays: s.workingDays,
  holidays: new Set((s.holidays || []).map((h) => toDateOnly(h.date))),
  leaveYearStartMonth: s.leaveYearStartMonth,
});

export const todayFor = (s, now = new Date()) => todayInTimeZone(s.timezone, now);
export const currentLeaveYear = (s, now = new Date()) =>
  leaveYearOf(todayFor(s, now), s.leaveYearStartMonth);

export async function updateSettings(actor, patch) {
  await getSettings(); // make sure the singleton exists before the transaction
  if (patch.leaveYearStartMonth !== undefined) {
    const current = await getSettings();
    if (patch.leaveYearStartMonth !== current.leaveYearStartMonth && (await LeaveBalance.exists({}))) {
      throw new ApiError(
        409,
        "The leave year start month cannot be changed once leave balances exist (it would re-label existing balances)"
      );
    }
  }
  return runInTransaction(async (session) => {
    const doc = await SystemSetting.findOne({ key: "global" }).session(session);
    const before = serializeSettings(doc.toObject());
    if (patch.workingDays) doc.workingDays = patch.workingDays;
    if (patch.holidays) {
      doc.holidays = patch.holidays.map((h) => ({ date: parseDateOnly(h.date), name: h.name }));
    }
    if (patch.leaveYearStartMonth !== undefined) doc.leaveYearStartMonth = patch.leaveYearStartMonth;
    if (patch.timezone) doc.timezone = patch.timezone;
    if (patch.allocationDefaults) doc.allocationDefaults = patch.allocationDefaults;
    if (patch.policies?.maxAdvanceDays !== undefined) doc.policies.maxAdvanceDays = patch.policies.maxAdvanceDays;
    await doc.save({ session });
    const after = serializeSettings(doc.toObject());
    await logAction(
      { actorId: actor._id, action: "settings.updated", targetId: doc._id, targetType: "SystemSetting", metadata: { before, after, changed: Object.keys(patch) } },
      { session }
    );
    return after;
  });
}
