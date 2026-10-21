import BalanceAdjustment from "../models/balanceAdjustmentModel.js";
import LeaveBalance from "../models/leaveBalanceModel.js";
import LeaveType from "../models/leaveTypeModel.js";
import User from "../models/userModel.js";
import ApiError from "../utils/ApiError.js";
import { buildPagination, skipFor } from "../utils/pagination.js";
import { runInTransaction } from "../utils/transaction.js";
import { logAction } from "./auditService.js";
import { notifyUser } from "./notificationService.js";
import { currentLeaveYear, getSettings } from "./settingsService.js";

export function resolveAllocation(leaveType, settings) {
  const override = (settings.allocationDefaults || []).find((a) => a.leaveTypeCode === leaveType.code);
  return override ? override.days : leaveType.yearlyLimit;
}

export const serializeBalance = (b) => ({
  id: String(b._id),
  employeeId: String(b.employeeId?._id || b.employeeId),
  leaveType:
    b.leaveTypeId && b.leaveTypeId.name
      ? { id: String(b.leaveTypeId._id), name: b.leaveTypeId.name, code: b.leaveTypeId.code }
      : { id: String(b.leaveTypeId) },
  year: b.year,
  baseAllocation: b.baseAllocation,
  adjustment: b.adjustment,
  allocated: b.allocated,
  used: b.used,
  available: b.available,
});

/**
 * Idempotent: creates the balance row for (employee, leave type, year) only if it is missing
 * ($setOnInsert), so it can never overwrite usage. Must be called OUTSIDE transactions.
 */
export async function ensureBalance({ employeeId, leaveType, year, settings }) {
  const base = resolveAllocation(leaveType, settings);
  const filter = { employeeId, leaveTypeId: leaveType._id, year };
  try {
    return await LeaveBalance.findOneAndUpdate(
      filter,
      { $setOnInsert: { baseAllocation: base, adjustment: 0, allocated: base, used: 0, available: base } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err.code === 11000) return LeaveBalance.findOne(filter); // lost a race with a concurrent upsert
    throw err;
  }
}

export async function ensureBalancesForEmployee(employeeId, year, settings) {
  const types = await LeaveType.find({ active: true });
  for (const t of types) await ensureBalance({ employeeId, leaveType: t, year, settings });
}

export async function getEmployeeBalances(employeeId, requestedYear) {
  const settings = await getSettings();
  const thisYear = currentLeaveYear(settings);
  const year = requestedYear ?? thisYear;
  // Missing rows are only auto-created for the current leave year; history is never fabricated.
  if (year === thisYear) await ensureBalancesForEmployee(employeeId, year, settings);
  const [balances, years] = await Promise.all([
    LeaveBalance.find({ employeeId, year }).populate("leaveTypeId", "name code").sort({ leaveTypeId: 1 }),
    LeaveBalance.distinct("year", { employeeId }),
  ]);
  return { year, availableYears: years.sort((a, b) => b - a), balances: balances.map(serializeBalance) };
}

async function requireEmployee(employeeId) {
  const employee = await User.findOne({ _id: employeeId, role: "employee" });
  if (!employee) throw new ApiError(404, "Employee not found");
  return employee;
}

/** HR/Admin: add (delta > 0) or deduct (delta < 0) allocation, with a mandatory reason. */
export async function adjustBalance(actor, employeeId, { leaveTypeId, year, delta, reason }) {
  const employee = await requireEmployee(employeeId);
  const leaveType = await LeaveType.findById(leaveTypeId);
  if (!leaveType) throw new ApiError(404, "Leave type not found");
  const settings = await getSettings();
  const targetYear = year ?? currentLeaveYear(settings);
  await ensureBalance({ employeeId: employee._id, leaveType, year: targetYear, settings });

  return runInTransaction(async (session) => {
    const filter = { employeeId: employee._id, leaveTypeId: leaveType._id, year: targetYear };
    // Deducting allocation must never push the balance below zero (unless the policy allows it).
    if (delta < 0 && !leaveType.rules.allowNegativeBalance) filter.available = { $gte: -delta };
    // Conditional atomic update => safe against concurrent approvals / adjustments.
    const updated = await LeaveBalance.findOneAndUpdate(
      filter,
      { $inc: { adjustment: delta, allocated: delta, available: delta } },
      { new: true, session }
    );
    if (!updated) {
      throw new ApiError(409, "Deduction exceeds the employee's available balance for this leave type and year");
    }
    const record = (
      await BalanceAdjustment.create(
        [{
          employeeId: employee._id, leaveTypeId: leaveType._id, year: targetYear, delta, reason,
          actorId: actor._id, previousAvailable: updated.available - delta, newAvailable: updated.available,
        }],
        { session }
      )
    )[0];
    await logAction(
      {
        actorId: actor._id, action: "balance.adjusted", targetId: updated._id, targetType: "LeaveBalance",
        metadata: { employeeId: String(employee._id), leaveType: leaveType.code, year: targetYear, delta, reason, newAvailable: updated.available },
      },
      { session }
    );
    await notifyUser(
      {
        recipient: employee,
        type: "balance_adjusted",
        title: "Leave balance adjusted",
        message: `Your ${leaveType.name} balance for ${targetYear} was ${delta > 0 ? "increased" : "reduced"} by ${Math.abs(delta)} day(s). Reason: ${reason}. Available: ${updated.available}.`,
        relatedEntityId: updated._id,
      },
      { session }
    );
    return { balance: serializeBalance(updated), adjustment: record };
  });
}

export async function getAdjustmentHistory(employeeId, { year, page, limit, order }) {
  await requireEmployee(employeeId);
  const filter = { employeeId };
  if (year) filter.year = year;
  const [items, total] = await Promise.all([
    BalanceAdjustment.find(filter)
      .sort({ createdAt: order === "asc" ? 1 : -1, _id: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate("leaveTypeId", "name code")
      .populate("actorId", "name"),
    BalanceAdjustment.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination({ page, limit, total }) };
}

export async function getEmployeeBalancesForHr(employeeId, year) {
  const employee = await requireEmployee(employeeId);
  const data = await getEmployeeBalances(employee._id, year);
  return { employee: { id: String(employee._id), name: employee.name, employeeId: employee.employeeId, department: employee.department }, ...data };
}

/**
 * Admin: idempotent yearly initialisation. Running it twice creates nothing the second time.
 * With updateExisting=true the BASE allocation of existing rows is synced to the current policy
 * while `used` and manual adjustments are preserved; reductions that would make the available
 * balance negative are skipped and reported.
 */
export async function initializeYear(actor, { year, leaveTypeIds, updateExisting = false }) {
  const settings = await getSettings();
  const typeFilter = { active: true };
  if (leaveTypeIds?.length) typeFilter._id = { $in: leaveTypeIds };
  const types = await LeaveType.find(typeFilter);
  if (!types.length) throw new ApiError(404, "No matching active leave types found");
  const employeeIds = (await User.find({ role: "employee", status: "active" }).select("_id").lean()).map((e) => e._id);

  let created = 0;
  let existing = 0;
  let updated = 0;
  const skipped = [];

  for (const t of types) {
    const base = resolveAllocation(t, settings);
    if (employeeIds.length) {
      const res = await LeaveBalance.bulkWrite(
        employeeIds.map((id) => ({
          updateOne: {
            filter: { employeeId: id, leaveTypeId: t._id, year },
            update: { $setOnInsert: { baseAllocation: base, adjustment: 0, allocated: base, used: 0, available: base } },
            upsert: true,
          },
        })),
        { ordered: false }
      );
      created += res.upsertedCount;
      existing += employeeIds.length - res.upsertedCount;
    }
    if (updateExisting) {
      const stale = await LeaveBalance.find({
        leaveTypeId: t._id, year, employeeId: { $in: employeeIds }, baseAllocation: { $ne: base },
      });
      for (const b of stale) {
        const delta = base - b.baseAllocation;
        const filter = { _id: b._id, baseAllocation: b.baseAllocation };
        if (delta < 0 && !t.rules.allowNegativeBalance) filter.available = { $gte: -delta };
        const r = await LeaveBalance.updateOne(filter, { $inc: { baseAllocation: delta, allocated: delta, available: delta } });
        if (r.modifiedCount === 1) updated += 1;
        else skipped.push({ employeeId: String(b.employeeId), leaveType: t.code, reason: "Would make available balance negative" });
      }
    }
  }

  await logAction({
    actorId: actor._id, action: "balance.initialized", targetType: "LeaveBalance",
    metadata: { year, leaveTypes: types.map((t) => t.code), created, existing, updated, skipped: skipped.length, updateExisting },
  });
  return { year, created, existing, updated, skipped };
}
