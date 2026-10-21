import dotenv from "dotenv";
dotenv.config();

const num = (v, d) => (v === undefined || v === "" ? d : Number(v));
const bool = (v, d = false) => (v === undefined || v === "" ? d : String(v).toLowerCase() === "true");

const nodeEnv = process.env.NODE_ENV || "development";

const env = {
  nodeEnv,
  isProd: nodeEnv === "production",
  isTest: nodeEnv === "test",
  port: num(process.env.PORT, 5000),
  mongoUrl: process.env.MONGO_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresInHours: num(process.env.JWT_EXPIRES_IN_HOURS, 8),
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 12),
  exposeTokenInBody: bool(process.env.EXPOSE_TOKEN_IN_BODY, false),
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  cookieSameSite: process.env.COOKIE_SAMESITE || "strict",
  cookieSecure: bool(process.env.COOKIE_SECURE, nodeEnv === "production"),
  trustProxy: bool(process.env.TRUST_PROXY, false),
  rateLimit: {
    windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: num(process.env.RATE_LIMIT_MAX, 300),
    loginMax: num(process.env.LOGIN_RATE_LIMIT_MAX, 10),
  },
  upload: { maxBytes: num(process.env.MAX_UPLOAD_MB, 5) * 1024 * 1024 },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    folder: process.env.CLOUDINARY_FOLDER || "leave-management/medical",
    signedUrlTtlSeconds: num(process.env.SIGNED_URL_TTL_SECONDS, 120),
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: num(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASSWORD || "",
    from: process.env.SMTP_FROM || "Leave Management <no-reply@example.com>",
  },
  email: {
    intervalMs: num(process.env.EMAIL_WORKER_INTERVAL_MS, 15000),
    maxAttempts: num(process.env.EMAIL_MAX_ATTEMPTS, 5),
  },
};

/** Called once at server start. Fails fast instead of running with an insecure configuration. */
export function assertEnv() {
  const problems = [];
  if (!env.mongoUrl) problems.push("MONGO_URL is not set");
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    problems.push("JWT_SECRET must be set and at least 32 characters long");
  }
  if (!["strict", "lax", "none"].includes(env.cookieSameSite)) {
    problems.push("COOKIE_SAMESITE must be strict, lax or none");
  }
  if (env.cookieSameSite === "none" && !env.cookieSecure) {
    problems.push("COOKIE_SAMESITE=none requires COOKIE_SECURE=true");
  }
  if (problems.length) {
    throw new Error(`Invalid environment configuration:\n - ${problems.join("\n - ")}`);
  }
}

export default env;
