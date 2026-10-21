import * as authService from "../services/authService.js";
import * as balanceService from "../services/balanceService.js";
import * as leaveService from "../services/leaveService.js";
import { sendList, sendSuccess } from "../utils/apiResponse.js";

export const getProfile = async (req, res) => sendSuccess(res, { message: "Profile", data: { user: req.user } });

export async function updateProfile(req, res) {
  const user = await authService.updateOwnProfile(req.user, req.validated.body);
  return sendSuccess(res, { message: "Profile updated", data: { user } });
}

// The employee is always taken from the authenticated session - never from the request.
export async function myBalances(req, res) {
  const data = await balanceService.getEmployeeBalances(req.user._id, req.validated.query.year);
  return sendSuccess(res, { message: "Leave balances", data });
}

export async function myLeaveHistory(req, res) {
  const { items, pagination } = await leaveService.listMyLeaves(req.user, req.validated.query);
  return sendList(res, { message: "Leave history", items, pagination });
}
