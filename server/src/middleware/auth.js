import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import User from "../models/userModel.js";
import ApiError from "../utils/ApiError.js";

export const AUTH_COOKIE = "token";
export const CSRF_COOKIE = "csrfToken";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion }, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: `${env.jwtExpiresInHours}h`,
  });
}

const cookieOptions = () => ({
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  maxAge: env.jwtExpiresInHours * 3600 * 1000,
  path: "/",
});

/** Sets the HTTP-only JWT cookie and a readable CSRF cookie (double-submit token). */
export function setAuthCookies(res, token) {
  const csrf = crypto.randomBytes(24).toString("hex");
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions(), httpOnly: true });
  res.cookie(CSRF_COOKIE, csrf, { ...cookieOptions(), httpOnly: false });
  return csrf;
}

export function clearAuthCookies(res) {
  const base = { secure: env.cookieSecure, sameSite: env.cookieSameSite, path: "/" };
  res.clearCookie(AUTH_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, base);
}

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

/**
 * Authenticates via `Authorization: Bearer <jwt>` or the HTTP-only cookie. The user is re-loaded
 * from the database on EVERY request, so disabling/relieving an account or bumping tokenVersion
 * (logout, password change) invalidates tokens that were issued earlier.
 * Cookie-authenticated unsafe requests must carry a matching X-CSRF-Token header.
 */
export async function authenticate(req, _res, next) {
  let token;
  let fromCookie = false;
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) token = header.slice(7).trim();
  else if (req.cookies?.[AUTH_COOKIE]) {
    token = req.cookies[AUTH_COOKIE];
    fromCookie = true;
  }
  if (!token) throw new ApiError(401, "Authentication required");

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }

  if (fromCookie && !SAFE_METHODS.has(req.method)) {
    const headerToken = req.get("x-csrf-token");
    const cookieToken = req.cookies?.[CSRF_COOKIE];
    if (!headerToken || !cookieToken || !safeEqual(headerToken, cookieToken)) {
      throw new ApiError(403, "Invalid or missing CSRF token");
    }
  }

  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) throw new ApiError(401, "Session is no longer valid");
  if (user.status !== "active") throw new ApiError(403, `Your account is ${user.status}`);

  req.user = user;
  return next();
}

/** Server-side RBAC. Example: authorize("hr", "admin"). */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, "Authentication required"));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission to perform this action"));
    }
    return next();
  };
