import env from "../config/env.js";
import { clearAuthCookies, setAuthCookies, signToken } from "../middleware/auth.js";
import * as authService from "../services/authService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function register(req, res) {
  const user = await authService.registerEmployee(req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: "Registration successful. Your account is pending approval by HR", data: { user } });
}

export async function login(req, res) {
  const user = await authService.login(req.validated.body);
  const token = signToken(user);
  const csrfToken = setAuthCookies(res, token);
  const data = { user, csrfToken };
  if (env.exposeTokenInBody) data.token = token; // opt-in, for non-browser clients only
  return sendSuccess(res, { message: "Login successful", data });
}

export async function logout(req, res) {
  await authService.logout(req.user);
  clearAuthCookies(res);
  return sendSuccess(res, { message: "Logged out successfully" });
}

export async function me(req, res) {
  return sendSuccess(res, { message: "Current user", data: { user: req.user } });
}

export async function changePassword(req, res) {
  const user = await authService.changePassword(req.user, req.validated.body);
  const token = signToken(user); // the current session continues with a fresh token
  const csrfToken = setAuthCookies(res, token);
  const data = { csrfToken };
  if (env.exposeTokenInBody) data.token = token;
  return sendSuccess(res, { message: "Password changed successfully. Other sessions were signed out", data });
}
