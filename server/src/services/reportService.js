import mongoose from "mongoose";
import LeaveBalance from "../models/leaveBalanceModel.js";
import LeaveRequest from "../models/leaveRequestModel.js";
import LeaveType from "../models/leaveTypeModel.js";
import User from "../models/userModel.js";
import { leaveYearBounds, monthBounds, parseDateOnly } from "../utils/dates.js";
import { exactCI } from "../utils/regex.js";
import { currentLeaveYear, getSettings } from "./settingsService.js";

const oid = (s) => new mongoose.Types.ObjectId(s);

/**
 * Reporting period policy: a request belongs to the period containing its START date (so a
 * request is never counted twice). Range precedence: from/to > month+year > year (leave year).
 */
function resolveRange(f, settings) {
  if (f.from || f.to) {
    return {
      from: f.from ? parseDateOnly(f.from) : new Date(Date.UTC(1970, 0, 1)),
      to: f.to ? parseDateOnly(f.to) : new Date(Date.UTC(2200, 0, 1)),
    };
  }
  if (f.year && f.month) {
    const { start, end } = monthBounds(f.year, f.month);
    return { from: start, to: end };
  }
  if (f.year) {
    const { start, end } = leaveYearBounds(f.year, settings.leaveYearStartMonth);
    return { from: start, to: end };
  }
  return null;
}

async function buildMatch(f, settings, defaultYear) {
  const match = {};
  const range = resolveRange(f, settings) || (defaultYear ? (() => {
    const { start, end } = leaveYearBounds(defaultYear, settings.leaveYearStartMonth);
    return { from: start, to: end };
  })() : null);
  if (range) match.startDate = { $gte: range.from, $lte: range.to };
  if (f.status) match.status = f.status;
  if (f.leaveTypeId) match.leaveTypeId = oid(f.leaveTypeId);
  let ids = null;
  if (f.department) ids = await User.find({ department: exactCI(f.department) }).distinct("_id");
  if (f.employeeId) {
    ids = ids && !ids.some((i) => String(i) === f.employeeId) ? [] : [oid(f.employeeId)];
  }
  if (ids) match.employeeId = { $in: ids };
  return match;
}

const counters = {
  totalRequests: { $sum: 1 },
  pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
  approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
  rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
  cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
  approvedDays: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, "$days", 0] } },
  requestedDays: { $sum: "$days" },
};
const STAT_COLS = [
  { key: "totalRequests", label: "Total Requests" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "approvedDays", label: "Approved Days" },
  { key: "requestedDays", label: "Requested Days" },
];
const stats = (r) => Object.fromEntries(STAT_COLS.map((c) => [c.key, r[c.key] ?? 0]));

export async function monthlyReport(f) {
  const settings = await getSettings();
  const year = f.year || currentLeaveYear(settings);
  const match = await buildMatch({ ...f, year }, settings);
  const rows = await LeaveRequest.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$startDate" } }, ...counters } },
    { $sort: { _id: 1 } },
  ]);
  return {
    columns: [{ key: "period", label: "Month" }, ...STAT_COLS],
    rows: rows.map((r) => ({ period: r._id, ...stats(r) })),
  };
}

async function groupByLeaveType(match) {
  const rows = await LeaveRequest.aggregate([
    { $match: match },
    { $group: { _id: "$leaveTypeId", ...counters } },
    { $lookup: { from: LeaveType.collection.name, localField: "_id", foreignField: "_id", as: "lt" } },
    { $unwind: "$lt" },
    { $sort: { "lt.name": 1 } },
  ]);
  return rows.map((r) => ({ leaveType: r.lt.name, code: r.lt.code, ...stats(r) }));
}
const LT_COLS = [{ key: "leaveType", label: "Leave Type" }, { key: "code", label: "Code" }, ...STAT_COLS];

export async function leaveTypeReport(f) {
  const settings = await getSettings();
  return { columns: LT_COLS, rows: await groupByLeaveType(await buildMatch(f, settings)) };
}

/** Annual report: leave-type breakdown for one leave year plus a TOTAL row. */
export async function annualReport(f) {
  const settings = await getSettings();
  const year = f.year || currentLeaveYear(settings);
  const rows = await groupByLeaveType(await buildMatch({ ...f, year }, settings));
  const total = { leaveType: "TOTAL", code: "" };
  for (const c of STAT_COLS) total[c.key] = rows.reduce((s, r) => s + r[c.key], 0);
  return { year, columns: LT_COLS, rows: [...rows, total] };
}

export async function employeeReport(f) {
  const settings = await getSettings();
  const rows = await LeaveRequest.aggregate([
    { $match: await buildMatch(f, settings, currentLeaveYear(settings)) },
    { $group: { _id: "$employeeId", ...counters } },
    { $lookup: { from: User.collection.name, localField: "_id", foreignField: "_id", as: "u" } },
    { $unwind: "$u" },
    { $sort: { "u.name": 1 } },
  ]);
  return {
    columns: [
      { key: "employeeCode", label: "Employee ID" }, { key: "name", label: "Name" },
      { key: "department", label: "Department" }, ...STAT_COLS,
    ],
    rows: rows.map((r) => ({ employeeCode: r.u.employeeId, name: r.u.name, department: r.u.department, ...stats(r) })),
  };
}

export async function departmentReport(f) {
  const settings = await getSettings();
  const rows = await LeaveRequest.aggregate([
    { $match: await buildMatch(f, settings, currentLeaveYear(settings)) },
    { $lookup: { from: User.collection.name, localField: "employeeId", foreignField: "_id", as: "u" } },
    { $unwind: "$u" },
    { $group: { _id: "$u.department", employees: { $addToSet: "$employeeId" }, ...counters } },
    { $sort: { _id: 1 } },
  ]);
  return {
    columns: [{ key: "department", label: "Department" }, { key: "employeesWithLeave", label: "Employees With Leave" }, ...STAT_COLS],
    rows: rows.map((r) => ({ department: r._id, employeesWithLeave: r.employees.length, ...stats(r) })),
  };
}

export async function statusSummaryReport(f) {
  const settings = await getSettings();
  const rows = await LeaveRequest.aggregate([
    { $match: await buildMatch(f, settings, currentLeaveYear(settings)) },
    { $group: { _id: "$status", requests: { $sum: 1 }, days: { $sum: "$days" } } },
    { $sort: { _id: 1 } },
  ]);
  return {
    columns: [{ key: "status", label: "Status" }, { key: "requests", label: "Requests" }, { key: "days", label: "Days" }],
    rows: rows.map((r) => ({ status: r._id, requests: r.requests, days: r.days })),
  };
}

export async function balanceReport(f) {
  const settings = await getSettings();
  const year = f.year || currentLeaveYear(settings);
  const filter = { year };
  if (f.leaveTypeId) filter.leaveTypeId = f.leaveTypeId;
  let ids = null;
  if (f.department) ids = await User.find({ role: "employee", department: exactCI(f.department) }).distinct("_id");
  if (f.employeeId) ids = ids && !ids.some((i) => String(i) === f.employeeId) ? [] : [f.employeeId];
  if (ids) filter.employeeId = { $in: ids };
  const balances = await LeaveBalance.find(filter)
    .populate("employeeId", "name employeeId department")
    .populate("leaveTypeId", "name code")
    .lean();
  const rows = balances
    .filter((b) => b.employeeId && b.leaveTypeId)
    .map((b) => ({
      employeeCode: b.employeeId.employeeId, name: b.employeeId.name, department: b.employeeId.department,
      leaveType: b.leaveTypeId.name, year: b.year, allocated: b.allocated, used: b.used, available: b.available,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.leaveType.localeCompare(b.leaveType));
  return {
    year,
    columns: [
      { key: "employeeCode", label: "Employee ID" }, { key: "name", label: "Name" }, { key: "department", label: "Department" },
      { key: "leaveType", label: "Leave Type" }, { key: "year", label: "Year" }, { key: "allocated", label: "Allocated" },
      { key: "used", label: "Used" }, { key: "available", label: "Available" },
    ],
    rows,
  };
}

export const REPORTS = {
  monthly: monthlyReport,
  annual: annualReport,
  employees: employeeReport,
  departments: departmentReport,
  "leave-types": leaveTypeReport,
  "status-summary": statusSummaryReport,
  balances: balanceReport,
};
