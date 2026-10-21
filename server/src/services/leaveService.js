import LeaveBalance from "../models/leaveBalanceModel.js";
import LeaveRequest from "../models/leaveRequestModel.js";
import LeaveType from "../models/leaveTypeModel.js";
import User from "../models/userModel.js";
import env from "../config/env.js";
import ApiError from "../utils/ApiError.js";
import { addDays, parseDateOnly, toDateOnly } from "../utils/dates.js";
import { buildPagination, skipFor, sortSpec } from "../utils/pagination.js";
import { checkJoiningDate } from "../utils/joiningDate.js";
import { exactCI } from "../utils/regex.js";
import { runInTransaction } from "../utils/transaction.js";
import { logAction } from "./auditService.js";
import { ensureBalance } from "./balanceService.js";
import { deleteDocument, signedDocumentUrl, uploadDocument } from "./cloudinaryService.js";
import { checkSubmissionWindow, computeLeave } from "./leaveCalculationService.js";
import { notifyUser } from "./notificationService.js";
import { getSettings } from "./settingsService.js";

const ref = (r) => (r && r.name !== undefined ? { id: String(r._id), ...pickPublic(r) } : r ? String(r) : null);
const pickPublic = (r) => {
  const o = { name: r.name };
  for (const k of ["email", "employeeId", "department", "code"]) if (r[k] !== undefined) o[k] = r[k];
  return o;
};

/** Public shape of a leave request. The stored file name of the medical document is never exposed. */
export function serializeLeave(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    employee: ref(o.employeeId),
    leaveType: ref(o.leaveTypeId),
    startDate: toDateOnly(o.startDate),
    endDate: toDateOnly(o.endDate),
    days: o.days,
    isHalfDay: o.isHalfDay,
    yearBreakdown: o.yearBreakdown,
    reason: o.reason,
    medicalDocument: o.medicalDocument
      ? { originalName: o.medicalDocument.originalName, mimeType: o.medicalDocument.mimeType, size: o.medicalDocument.size, uploadedAt: o.medicalDocument.uploadedAt }
      : null,
    status: o.status,
    reviewedBy: ref(o.reviewedBy),
    reviewedAt: o.reviewedAt || null,
    rejectionReason: o.rejectionReason || null,
    cancelledAt: o.cancelledAt || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

const populateAll = (q) =>
  q
    .populate("employeeId", "name email employeeId department")
    .populate("leaveTypeId", "name code")
    .populate("reviewedBy", "name");

const overlapFilter = (employeeId, start, end, statuses, excludeId) => ({
  employeeId,
  status: { $in: statuses },
  startDate: { $lte: end },
  endDate: { $gte: start },
  ...(excludeId ? { _id: { $ne: excludeId } } : {}),
});

const sanitizeFileName = (name) =>
  String(name || "document").split(/[\\/]/).pop().replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "document";

// ------------------------------------------------------------------ submit
/** Creates a PENDING request. This function never touches leave balances (no deduction on submit). */
export async function submitLeave(user, input, file, idempotencyKey) {
  if (idempotencyKey) {
    const existing = await LeaveRequest.findOne({ employeeId: user._id, idempotencyKey });
    if (existing) return { request: serializeLeave(await populateAll(LeaveRequest.findById(existing._id))), duplicate: true };
  }
  const leaveType = await LeaveType.findById(input.leaveTypeId);
  if (!leaveType) throw new ApiError(404, "Leave type not found");
  if (!leaveType.active) throw new ApiError(422, "This leave type is not currently available");

  const settings = await getSettings();
  const start = parseDateOnly(input.startDate);
  const end = parseDateOnly(input.endDate);
  if (end < start) throw new ApiError(422, "End date cannot be before start date", [{ field: "endDate", message: "Must not be before startDate" }]);

  const calc = computeLeave({ leaveType, start, end, isHalfDay: input.isHalfDay, settings });
  checkSubmissionWindow({ leaveType, start, settings });
  checkJoiningDate({ start, joiningDate: user.joiningDate });

  // The client's `days` is only a cross-check; the server's calculation is the source of truth.
  if (Number(input.days) !== calc.days) {
    throw new ApiError(422, `Requested days (${input.days}) do not match the calculated eligible leave days (${calc.days})`, [
      { field: "days", message: `Expected ${calc.days}` },
    ]);
  }
  if (leaveType.rules.requiresDocument && !file) {
    throw new ApiError(422, `${leaveType.name} requires a supporting document (medicalDocument)`, [{ field: "medicalDocument", message: "Required" }]);
  }
  if (await LeaveRequest.exists(overlapFilter(user._id, start, end, ["pending", "approved"]))) {
    throw new ApiError(409, "You already have a pending or approved leave request overlapping these dates");
  }

  // Informational balance check (pending requests do not reserve balance; the binding check is at approval).
  for (const { year, days } of calc.byYear) {
    const bal = await ensureBalance({ employeeId: user._id, leaveType, year, settings });
    if (!leaveType.rules.allowNegativeBalance && bal.available < days) {
      throw new ApiError(409, `Insufficient leave balance for ${year}: ${bal.available} day(s) available, ${days} requested`);
    }
  }

  // Everything is validated: only now is the document sent to Cloudinary (private storage).
  let uploaded;
  if (file) {
    uploaded = await uploadDocument(file.buffer, { ownerId: String(user._id) });
    uploaded = { ...uploaded, originalName: sanitizeFileName(file.originalname), mimeType: file.mimetype, size: file.size };
  }
  let created;
  try {
    created = await runInTransaction(async (session) => {
      const [req] = await LeaveRequest.create(
        [{
          employeeId: user._id, leaveTypeId: leaveType._id, startDate: start, endDate: end,
          days: calc.days, isHalfDay: !!input.isHalfDay, yearBreakdown: calc.byYear, reason: input.reason,
          medicalDocument: uploaded, status: "pending", idempotencyKey,
        }],
        { session }
      );
      await logAction(
        { actorId: user._id, action: "leave.submitted", targetId: req._id, targetType: "LeaveRequest",
          metadata: { leaveType: leaveType.code, startDate: input.startDate, endDate: input.endDate, days: calc.days, hasDocument: !!file } },
        { session }
      );
      return req;
    });
  } catch (err) {
    await deleteDocument(uploaded); // never leave an orphaned cloud file behind
    throw err;
  }
  return { request: serializeLeave(await populateAll(LeaveRequest.findById(created._id))), duplicate: false };
}

// ------------------------------------------------------------------ queries
async function buildFilter(q, { forceEmployeeId } = {}) {
  const filter = {};
  const and = [];
  if (forceEmployeeId) filter.employeeId = forceEmployeeId;
  else {
    if (q.employeeId) and.push({ employeeId: q.employeeId });
    if (q.department) {
      const ids = await User.find({ role: "employee", department: exactCI(q.department) }).distinct("_id");
      and.push({ employeeId: { $in: ids } });
    }
  }
  if (q.leaveTypeId) filter.leaveTypeId = q.leaveTypeId;
  if (q.status) filter.status = q.status;
  if (q.startDate) filter.endDate = { $gte: parseDateOnly(q.startDate) };
  if (q.endDate) filter.startDate = { $lte: parseDateOnly(q.endDate) };
  if (q.submittedFrom || q.submittedTo) {
    filter.createdAt = {};
    if (q.submittedFrom) filter.createdAt.$gte = parseDateOnly(q.submittedFrom);
    if (q.submittedTo) filter.createdAt.$lt = addDays(parseDateOnly(q.submittedTo), 1);
  }
  if (and.length) filter.$and = and;
  return filter;
}

async function listLeaves(q, opts) {
  const filter = await buildFilter(q, opts);
  const [items, total] = await Promise.all([
    populateAll(LeaveRequest.find(filter).sort(sortSpec(q.sortBy, q.order)).skip(skipFor(q.page, q.limit)).limit(q.limit)),
    LeaveRequest.countDocuments(filter),
  ]);
  return { items: items.map(serializeLeave), pagination: buildPagination({ page: q.page, limit: q.limit, total }) };
}

export const listMyLeaves = (user, q) => listLeaves(q, { forceEmployeeId: user._id });
export const listAllLeaves = (q) => listLeaves(q);

/** Employees can only load their own requests (others look like 404, so ids cannot be probed). */
export async function getLeave(user, id) {
  const filter = user.role === "employee" ? { _id: id, employeeId: user._id } : { _id: id };
  const doc = await populateAll(LeaveRequest.findOne(filter));
  if (!doc) throw new ApiError(404, "Leave request not found");
  return serializeLeave(doc);
}

/** Owner or HR/Admin only. Returns a short-lived signed Cloudinary URL (the file itself is private). */
export async function getDocumentAccess(user, id) {
  const filter = user.role === "employee" ? { _id: id, employeeId: user._id } : { _id: id };
  const doc = await LeaveRequest.findOne(filter).select("medicalDocument employeeId");
  if (!doc || !doc.medicalDocument) throw new ApiError(404, "Document not found");
  if (user.role !== "employee") {
    await logAction({ actorId: user._id, action: "leave.document_viewed", targetId: doc._id, targetType: "LeaveRequest", metadata: { employeeId: String(doc.employeeId) } });
  }
  const md = doc.medicalDocument;
  return {
    url: signedDocumentUrl(md, md.originalName),
    fileName: md.originalName,
    mimeType: md.mimeType,
    expiresInSeconds: env.cloudinary.signedUrlTtlSeconds,
  };
}

// ------------------------------------------------------------------ cancel
const statusError = (status, action) =>
  new ApiError(409, `Cannot ${action} a request that is already ${status}`);

/** pending -> cancelled. Never changes any balance. */
export async function cancelLeave(user, id) {
  return runInTransaction(async (session) => {
    // The status filter makes this a compare-and-set: it either wins the race against a concurrent
    // approval or loses it cleanly.
    const req = await LeaveRequest.findOneAndUpdate(
      { _id: id, employeeId: user._id, status: "pending" },
      { $set: { status: "cancelled", cancelledAt: new Date() } },
      { new: true, session }
    );
    if (!req) {
      const existing = await LeaveRequest.findOne({ _id: id, employeeId: user._id }).session(session).select("status");
      if (!existing) throw new ApiError(404, "Leave request not found");
      throw statusError(existing.status, "cancel");
    }
    await logAction({ actorId: user._id, action: "leave.cancelled", targetId: req._id, targetType: "LeaveRequest" }, { session });
    return req;
  }).then((r) => serializeLeave(r));
}

// ------------------------------------------------------------------ approve
/**
 * pending -> approved, atomically:
 *   claim request (compare-and-set) -> check employee -> re-validate dates/policy -> re-check
 *   overlap -> conditionally deduct each year's balance -> audit log -> notification (+ email outbox).
 * Everything runs in ONE transaction; any thrown error rolls the whole thing back.
 */
export async function approveLeave(actor, id) {
  const preview = await LeaveRequest.findById(id).lean();
  if (!preview) throw new ApiError(404, "Leave request not found");
  if (preview.status !== "pending") throw statusError(preview.status, "approve");

  // Missing balance rows (e.g. a new year) are created idempotently BEFORE the transaction.
  const settings = await getSettings();
  const leaveTypeForEnsure = await LeaveType.findById(preview.leaveTypeId);
  for (const { year } of preview.yearBreakdown) {
    await ensureBalance({ employeeId: preview.employeeId, leaveType: leaveTypeForEnsure, year, settings });
  }

  const approved = await runInTransaction(async (session) => {
    const now = new Date();
    const req = await LeaveRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "approved", reviewedBy: actor._id, reviewedAt: now } },
      { new: true, session }
    );
    if (!req) {
      const cur = await LeaveRequest.findById(id).session(session).select("status");
      if (!cur) throw new ApiError(404, "Leave request not found");
      throw statusError(cur.status, "approve"); // repeated / concurrent approval => no second deduction
    }

    const employee = await User.findById(req.employeeId).session(session);
    if (!employee || employee.role !== "employee" || employee.status !== "active") {
      throw new ApiError(409, "The employee account is not active, so this request cannot be approved. Reject it instead");
    }
    // Serialises concurrent approvals for the same employee (write-conflict + automatic retry).
    await User.updateOne({ _id: employee._id }, { $inc: { leaveVersion: 1 } }, { session });

    const leaveType = await LeaveType.findById(req.leaveTypeId).session(session);
    const calc = computeLeave({ leaveType, start: req.startDate, end: req.endDate, isHalfDay: req.isHalfDay, settings });
    const sameYears =
      calc.byYear.length === req.yearBreakdown.length &&
      calc.byYear.every((y, i) => y.year === req.yearBreakdown[i].year && y.days === req.yearBreakdown[i].days);
    if (calc.days !== req.days || !sameYears) {
      throw new ApiError(409, "Leave policy or calendar settings changed after this request was submitted; ask the employee to resubmit, or reject it");
    }
    if (await LeaveRequest.exists(overlapFilter(req.employeeId, req.startDate, req.endDate, ["approved"], req._id)).session(session)) {
      throw new ApiError(409, "The employee already has approved leave overlapping these dates");
    }

    for (const { year, days } of calc.byYear) {
      const filter = { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, year };
      if (!leaveType.rules.allowNegativeBalance) filter.available = { $gte: days };
      const res = await LeaveBalance.updateOne(filter, { $inc: { used: days, available: -days } }, { session });
      if (res.modifiedCount !== 1) {
        throw new ApiError(409, `Insufficient leave balance for ${year}; the request cannot be approved`);
      }
    }

    await logAction(
      { actorId: actor._id, action: "leave.approved", targetId: req._id, targetType: "LeaveRequest",
        metadata: { employeeId: String(employee._id), leaveType: leaveType.code, days: req.days, yearBreakdown: calc.byYear } },
      { session }
    );
    await notifyUser(
      {
        recipient: employee, type: "leave_approved", title: "Leave approved",
        message: `Your ${leaveType.name} request from ${toDateOnly(req.startDate)} to ${toDateOnly(req.endDate)} (${req.days} day(s)) was approved.`,
        relatedEntityId: req._id,
      },
      { session }
    );
    return req;
  });
  return serializeLeave(await populateAll(LeaveRequest.findById(approved._id)));
}

// ------------------------------------------------------------------ reject
/** pending -> rejected. Never changes any balance. */
export async function rejectLeave(actor, id, reason) {
  const rejected = await runInTransaction(async (session) => {
    const req = await LeaveRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "rejected", reviewedBy: actor._id, reviewedAt: new Date(), ...(reason ? { rejectionReason: reason } : {}) } },
      { new: true, session }
    );
    if (!req) {
      const cur = await LeaveRequest.findById(id).session(session).select("status");
      if (!cur) throw new ApiError(404, "Leave request not found");
      throw statusError(cur.status, "reject");
    }
    const [employee, leaveType] = await Promise.all([
      User.findById(req.employeeId).session(session),
      LeaveType.findById(req.leaveTypeId).session(session),
    ]);
    await logAction(
      { actorId: actor._id, action: "leave.rejected", targetId: req._id, targetType: "LeaveRequest", metadata: { employeeId: String(req.employeeId), reason } },
      { session }
    );
    await notifyUser(
      {
        recipient: employee, type: "leave_rejected", title: "Leave rejected",
        message: `Your ${leaveType.name} request from ${toDateOnly(req.startDate)} to ${toDateOnly(req.endDate)} was rejected.${reason ? ` Reason: ${reason}` : ""}`,
        relatedEntityId: req._id,
      },
      { session }
    );
    return req;
  });
  return serializeLeave(await populateAll(LeaveRequest.findById(rejected._id)));
}

// ------------------------------------------------------------------ preview
/** Server-side day calculation for the application form (no balance or overlap side effects). */
export async function previewLeave(user, q) {
  const leaveType = await LeaveType.findById(q.leaveTypeId);
  if (!leaveType || !leaveType.active) throw new ApiError(404, "Leave type not found");
  const settings = await getSettings();
  const start = parseDateOnly(q.startDate);
  const end = parseDateOnly(q.endDate);
  if (end < start) throw new ApiError(422, "End date cannot be before start date");
  const calc = computeLeave({ leaveType, start, end, isHalfDay: q.isHalfDay, settings });
  checkSubmissionWindow({ leaveType, start, settings });
  checkJoiningDate({ start, joiningDate: user.joiningDate });
  const balances = [];
  for (const { year, days } of calc.byYear) {
    const bal = await ensureBalance({ employeeId: user._id, leaveType, year, settings });
    balances.push({ year, days, available: bal.available, sufficient: leaveType.rules.allowNegativeBalance || bal.available >= days });
  }
  return { days: calc.days, yearBreakdown: calc.byYear, balances, requiresDocument: leaveType.rules.requiresDocument };
}
