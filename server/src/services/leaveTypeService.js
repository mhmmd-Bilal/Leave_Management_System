import LeaveType from "../models/leaveTypeModel.js";
import ApiError from "../utils/ApiError.js";
import { runInTransaction } from "../utils/transaction.js";
import { logAction } from "./auditService.js";

export async function listLeaveTypes(user, { includeInactive }) {
  const filter = {};
  // Employees only ever see active leave types; HR/Admin may include inactive ones.
  if (!(includeInactive && user.role !== "employee")) filter.active = true;
  return LeaveType.find(filter).sort({ name: 1 });
}

export async function getLeaveType(user, id) {
  const t = await LeaveType.findById(id);
  if (!t || (!t.active && user.role === "employee")) throw new ApiError(404, "Leave type not found");
  return t;
}

const pick = (t) => ({ name: t.name, code: t.code, yearlyLimit: t.yearlyLimit, rules: t.rules?.toObject ? t.rules.toObject() : t.rules, active: t.active });

export async function createLeaveType(actor, input) {
  return runInTransaction(async (session) => {
    const [t] = await LeaveType.create([input], { session });
    await logAction(
      { actorId: actor._id, action: "leave_type.created", targetId: t._id, targetType: "LeaveType", metadata: { after: pick(t) } },
      { session }
    );
    return t;
  });
}

export async function updateLeaveType(actor, id, patch) {
  return runInTransaction(async (session) => {
    const t = await LeaveType.findById(id).session(session);
    if (!t) throw new ApiError(404, "Leave type not found");
    const before = pick(t);
    const { rules, ...rest } = patch;
    t.set(rest);
    if (rules) for (const [k, v] of Object.entries(rules)) t.set(`rules.${k}`, v);
    await t.save({ session });
    // Allocation / rule changes apply to FUTURE requests and newly created balances only; existing
    // approved leave and existing balance rows are not rewritten (use balances/initialize with
    // updateExisting to sync base allocations explicitly).
    await logAction(
      {
        actorId: actor._id,
        action: before.yearlyLimit !== t.yearlyLimit ? "leave_type.allocation_changed" : "leave_type.updated",
        targetId: t._id, targetType: "LeaveType", metadata: { before, after: pick(t) },
      },
      { session }
    );
    return t;
  });
}

export async function setLeaveTypeStatus(actor, id, active) {
  return runInTransaction(async (session) => {
    const t = await LeaveType.findById(id).session(session);
    if (!t) throw new ApiError(404, "Leave type not found");
    const before = t.active;
    t.active = active;
    await t.save({ session });
    await logAction(
      { actorId: actor._id, action: "leave_type.status_changed", targetId: t._id, targetType: "LeaveType", metadata: { before, after: active } },
      { session }
    );
    return t;
  });
}
