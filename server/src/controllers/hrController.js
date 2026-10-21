import * as audit from "../services/auditService.js";
import * as balanceService from "../services/balanceService.js";
import * as dashboard from "../services/dashboardService.js";
import * as leaveService from "../services/leaveService.js";
import * as userService from "../services/userService.js";
import { sendList, sendSuccess } from "../utils/apiResponse.js";

export async function getDashboard(req, res) {
  return sendSuccess(res, { message: "HR dashboard", data: await dashboard.getHrDashboard(req.validated.query) });
}

export async function listEmployees(req, res) {
  const { items, pagination } = await userService.listUsers("employee", req.validated.query);
  return sendList(res, { message: "Employees", items, pagination });
}

export async function getEmployee(req, res) {
  return sendSuccess(res, { message: "Employee", data: { employee: await userService.getUserByRole(req.validated.params.id, "employee") } });
}

export async function listPending(req, res) {
  const { items, pagination } = await userService.listUsers("employee", { ...req.validated.query, status: "pending" });
  return sendList(res, { message: "Pending registrations", items, pagination });
}

export async function listRejected(req, res) {
  const { items, pagination } = await userService.listUsers("employee", { ...req.validated.query, status: "rejected" });
  return sendList(res, { message: "Rejected registrations", items, pagination });
}

export async function approveEmployee(req, res) {
  const employee = await userService.approveRegistration(req.user, req.validated.params.id);
  return sendSuccess(res, { message: "Registration approved", data: { employee } });
}

export async function rejectEmployee(req, res) {
  const employee = await userService.rejectRegistration(req.user, req.validated.params.id, req.validated.body.reason);
  return sendSuccess(res, { message: "Registration rejected", data: { employee } });
}

export async function listLeaves(req, res) {
  const { items, pagination } = await leaveService.listAllLeaves(req.validated.query);
  return sendList(res, { message: "Leave requests", items, pagination });
}

export async function getLeave(req, res) {
  return sendSuccess(res, { message: "Leave request", data: { leave: await leaveService.getLeave(req.user, req.validated.params.id) } });
}

export async function approveLeave(req, res) {
  const leave = await leaveService.approveLeave(req.user, req.validated.params.id);
  return sendSuccess(res, { message: "Leave request approved", data: { leave } });
}

export async function rejectLeave(req, res) {
  const leave = await leaveService.rejectLeave(req.user, req.validated.params.id, req.validated.body.reason);
  return sendSuccess(res, { message: "Leave request rejected", data: { leave } });
}

export async function getBalances(req, res) {
  const data = await balanceService.getEmployeeBalancesForHr(req.validated.params.employeeId, req.validated.query.year);
  return sendSuccess(res, { message: "Employee leave balances", data });
}

export async function adjustBalance(req, res) {
  const data = await balanceService.adjustBalance(req.user, req.validated.params.employeeId, req.validated.body);
  return sendSuccess(res, { message: "Leave balance adjusted", data });
}

export async function adjustmentHistory(req, res) {
  const { items, pagination } = await balanceService.getAdjustmentHistory(req.validated.params.employeeId, req.validated.query);
  return sendList(res, { message: "Balance adjustment history", items, pagination });
}

export async function auditLogs(req, res) {
  const { items, pagination } = await audit.listAuditLogs(req.validated.query, { hrOnly: req.user.role === "hr" });
  return sendList(res, { message: "Audit logs", items, pagination });
}
