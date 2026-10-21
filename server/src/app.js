import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import env from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { globalLimiter } from "./middleware/rateLimiters.js";
import routes from "./routes/index.js";

// The Express app is created here and started in server.js so tests (Supertest) can import it
// without opening a port or connecting to the production database.
const app = express();

if (env.trustProxy) app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || env.clientOrigins.includes(origin)),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "Idempotency-Key"],
  })
);
app.use(globalLimiter);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ success: true, message: "OK", data: { uptime: process.uptime() } }));
app.use("/api", routes);

// NOTE: nothing is stored on the local disk. Medical documents live in PRIVATE (authenticated)
// Cloudinary storage and are reachable only through GET /api/leaves/:id/document, which checks
// ownership/role and returns a short-lived signed URL.

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
