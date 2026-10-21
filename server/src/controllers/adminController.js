import * as audit from "../services/auditService.js";
import * as balanceService from "../services/balanceService.js";
import * as settingsService from "../services/settingsService.js";
import * as userService from "../services/userService.js";
import { sendList, sendSuccess } from "../utils/apiResponse.js";

// One generic set of handlers per role ("employee" | "hr" | "admin"), bound in the router.
export const listUsers = (role) => async (req, res) => {
  const { items, pagination } = await userService.listUsers(role, req.validated.query);
  return sendList(res, { message: role === "hr" ? "HR accounts" : role === "admin" ? "Admin accounts" : "Employees", items, pagination });
};

export const getUser = (role) => async (req, res) =>
  sendSuccess(res, { message: "Account", data: { user: await userService.getUserByRole(req.validated.params.id, role) } });

export const updateUser = (role) => async (req, res) => {
  const user = await userService.updateUser(req.user, { id: req.validated.params.id, role }, req.validated.body);
  return sendSuccess(res, { message: "Account updated", data: { user } });
};

export const changeStatus = (role) => async (req, res) => {
  const { status, reason } = req.validated.body;
  const user = await userService.changeUserStatus(req.user, { id: req.validated.params.id, role, status, reason });
  return sendSuccess(res, { message: `Account status changed to ${status}`, data: { user } });
};

export async function createHr(req, res) {
  const user = await userService.createHr(req.user, req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: "HR account created", data: { user } });
}

export async function getSettings(_req, res) {
  return sendSuccess(res, { message: "System settings", data: { settings: settingsService.serializeSettings(await settingsService.getSettings()) } });
}

export async function updateSettings(req, res) {
  const settings = await settingsService.updateSettings(req.user, req.validated.body);
  return sendSuccess(res, { message: "System settings updated", data: { settings } });
}

export async function initializeBalances(req, res) {
  const data = await balanceService.initializeYear(req.user, req.validated.body);
  return sendSuccess(res, { message: "Leave balances initialized", data });
}

export async function auditLogs(req, res) {
  const { items, pagination } = await audit.listAuditLogs(req.validated.query);
  return sendList(res, { message: "Audit logs", items, pagination });
}
