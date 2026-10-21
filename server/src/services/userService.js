import User from "../models/userModel.js";
import ApiError from "../utils/ApiError.js";
import { parseDateOnly } from "../utils/dates.js";
import { buildPagination, skipFor, sortSpec } from "../utils/pagination.js";
import { containsCI, exactCI } from "../utils/regex.js";
import { runInTransaction } from "../utils/transaction.js";
import { hashPassword } from "./authService.js";
import { logAction } from "./auditService.js";
import { ensureBalancesForEmployee } from "./balanceService.js";
import { notifyUser } from "./notificationService.js";
import { currentLeaveYear, getSettings } from "./settingsService.js";
import SystemSetting from "../models/systemSettingModel.js";

export async function listUsers(role, q) {
  const filter = { role };
  if (q.status) filter.status = q.status;
  if (q.department) filter.department = exactCI(q.department);
  if (q.search) {
    const rx = containsCI(q.search);
    filter.$or = [{ name: rx }, { email: rx }, { employeeId: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort(sortSpec(q.sortBy, q.order)).skip(skipFor(q.page, q.limit)).limit(q.limit),
    User.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination({ page: q.page, limit: q.limit, total }) };
}

export async function getUserByRole(id, role) {
  const u = await User.findOne({ _id: id, role });
  if (!u) throw new ApiError(404, role === "hr" ? "HR account not found" : role === "admin" ? "Admin account not found" : "Employee not found");
  return u;
}

async function reviewRegistration(actor, id, decision, reason) {
  const next = decision === "approve" ? "active" : "rejected";
  const user = await runInTransaction(async (session) => {
    // Atomic pending -> active/rejected transition; only employee registrations can be reviewed.
    const u = await User.findOneAndUpdate(
      { _id: id, role: "employee", status: "pending" },
      { $set: { status: next, statusChangedBy: actor._id, statusChangedAt: new Date(), ...(decision === "reject" && reason ? { statusReason: reason } : {}) } },
      { new: true, session }
    );
    if (!u) {
      const existing = await User.findOne({ _id: id, role: "employee" }).session(session).select("status");
      if (!existing) throw new ApiError(404, "Employee not found");
      throw new ApiError(409, `Registration is already ${existing.status}; only pending registrations can be reviewed`);
    }
    await logAction(
      { actorId: actor._id, action: decision === "approve" ? "registration.approved" : "registration.rejected", targetId: u._id, targetType: "User", metadata: { employeeId: u.employeeId, reason } },
      { session }
    );
    await notifyUser(
      {
        recipient: u,
        type: decision === "approve" ? "account_approved" : "account_rejected",
        title: decision === "approve" ? "Account approved" : "Registration rejected",
        message: decision === "approve"
          ? "Your account has been approved. You can now log in and apply for leave."
          : `Your registration was not approved.${reason ? ` Reason: ${reason}` : ""}`,
        relatedEntityId: u._id,
      },
      { session }
    );
    return u;
  });
  if (decision === "approve") {
    // Idempotent and non-critical: balances are also created lazily on first use.
    const settings = await getSettings();
    await ensureBalancesForEmployee(user._id, currentLeaveYear(settings), settings).catch(() => {});
  }
  return user;
}

export const approveRegistration = (actor, id) => reviewRegistration(actor, id, "approve");
export const rejectRegistration = (actor, id, reason) => reviewRegistration(actor, id, "reject", reason);

const TRANSITIONS = { active: ["disabled", "relieved"], disabled: ["active", "relieved"] };

export async function changeUserStatus(actor, { id, role, status, reason }) {
  if (role === "admin") await getSettings(); // ensure the guard document exists
  return runInTransaction(async (session) => {
    const target = await User.findOne({ _id: id, role }).session(session);
    if (!target) throw new ApiError(404, "Account not found");
    if (String(target._id) === String(actor._id)) throw new ApiError(403, "You cannot change your own account status");
    if (!(TRANSITIONS[target.status] || []).includes(status)) {
      throw new ApiError(409, `Cannot change account status from ${target.status} to ${status}`);
    }
    if (role === "admin") {
      // Serialise concurrent admin status changes, then protect the last active administrator.
      await SystemSetting.updateOne({ key: "global" }, { $inc: { adminGuard: 1 } }, { session });
      if (status !== "active") {
        const others = await User.countDocuments({ role: "admin", status: "active", _id: { $ne: target._id } }).session(session);
        if (others === 0) throw new ApiError(409, "Cannot disable the last active administrator");
      }
    }
    const before = target.status;
    target.status = status;
    target.statusReason = reason;
    target.statusChangedBy = actor._id;
    target.statusChangedAt = new Date();
    if (status !== "active") target.tokenVersion += 1; // kicks out existing sessions immediately
    await target.save({ session });
    await logAction(
      { actorId: actor._id, action: "user.status_changed", targetId: target._id, targetType: "User", metadata: { role, before, after: status, reason } },
      { session }
    );
    return target;
  });
}

export async function updateUser(actor, { id, role }, patch) {
  return runInTransaction(async (session) => {
    const u = await User.findOne({ _id: id, role }).session(session);
    if (!u) throw new ApiError(404, "Account not found");
    const before = {};
    const after = {};
    for (const key of ["name", "email", "phone", "department", "employeeId"]) {
      if (patch[key] !== undefined && patch[key] !== u[key]) {
        before[key] = u[key];
        u[key] = patch[key];
        after[key] = u[key];
      }
    }
    if (patch.joiningDate) {
      before.joiningDate = u.joiningDate;
      u.joiningDate = parseDateOnly(patch.joiningDate);
      after.joiningDate = u.joiningDate;
    }
    await u.save({ session });
    await logAction(
      { actorId: actor._id, action: "user.updated", targetId: u._id, targetType: "User", metadata: { role, before, after } },
      { session }
    );
    return u;
  });
}

export async function createHr(actor, input) {
  const passwordHash = await hashPassword(input.password);
  return runInTransaction(async (session) => {
    const [u] = await User.create(
      [{
        name: input.name, email: input.email, phone: input.phone, passwordHash,
        employeeId: input.employeeId, department: input.department,
        joiningDate: parseDateOnly(input.joiningDate), role: "hr", status: "active",
      }],
      { session }
    );
    await logAction(
      { actorId: actor._id, action: "user.hr_created", targetId: u._id, targetType: "User", metadata: { email: u.email, employeeId: u.employeeId } },
      { session }
    );
    return u;
  });
}
