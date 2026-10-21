import LeaveRequest from "../models/leaveRequestModel.js";
import User from "../models/userModel.js";
import { addDays, parseDateOnly } from "../utils/dates.js";
import { exactCI } from "../utils/regex.js";
import { getSettings, todayFor } from "./settingsService.js";

/**
 * Real database-driven statistics.
 *  - totalEmployees: employee accounts with status "active" (breakdown by status is included).
 *  - leave counts honour the optional from/to filter on SUBMISSION date and the department filter.
 *  - employeesOnLeave: distinct employees with APPROVED leave covering today (business time zone).
 */
export async function getHrDashboard({ from, to, department }) {
  const settings = await getSettings();
  const today = todayFor(settings);

  let employeeScope = null;
  if (department) {
    employeeScope = await User.find({ role: "employee", department: exactCI(department) }).distinct("_id");
  }
  const employeeFilter = { role: "employee", ...(department ? { department: exactCI(department) } : {}) };
  const leaveBase = {};
  if (employeeScope) leaveBase.employeeId = { $in: employeeScope };
  if (from || to) {
    leaveBase.createdAt = {};
    if (from) leaveBase.createdAt.$gte = parseDateOnly(from);
    if (to) leaveBase.createdAt.$lt = addDays(parseDateOnly(to), 1);
  }

  const [byStatus, pendingLeaves, approvedLeaves, rejectedLeaves, onLeaveIds] = await Promise.all([
    User.aggregate([{ $match: employeeFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    LeaveRequest.countDocuments({ ...leaveBase, status: "pending" }),
    LeaveRequest.countDocuments({ ...leaveBase, status: "approved" }),
    LeaveRequest.countDocuments({ ...leaveBase, status: "rejected" }),
    LeaveRequest.distinct("employeeId", {
      status: "approved",
      startDate: { $lte: today },
      endDate: { $gte: today },
      ...(employeeScope ? { employeeId: { $in: employeeScope } } : {}),
    }),
  ]);
  const statusCounts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));

  return {
    asOf: today.toISOString().slice(0, 10),
    totalEmployees: statusCounts.active || 0,
    employeesByStatus: statusCounts,
    pendingRegistrations: statusCounts.pending || 0,
    pendingLeaveRequests: pendingLeaves,
    approvedLeaveRequests: approvedLeaves,
    rejectedLeaveRequests: rejectedLeaves,
    employeesOnLeave: onLeaveIds.length,
  };
}
