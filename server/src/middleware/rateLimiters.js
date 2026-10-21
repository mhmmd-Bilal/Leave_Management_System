import rateLimit from "express-rate-limit";
import env from "../config/env.js";

const handler = (_req, res) =>
  res.status(429).json({ success: false, message: "Too many requests, please try again later", errors: [] });

export const globalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// Brute-force protection for login / registration.
export const loginLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.loginMax,
  skipSuccessfulRequests: true, // only failed attempts count towards the brute-force limit
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
