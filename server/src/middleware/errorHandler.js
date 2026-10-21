import multer from "multer";
import env from "../config/env.js";
import ApiError from "../utils/ApiError.js";

export const notFoundHandler = (req, _res, next) =>
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl.split("?")[0]}`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = 500;
  let message = "Internal server error";
  let errors = [];

  if (err instanceof ApiError) {
    ({ statusCode: status, message, errors } = err);
  } else if (err instanceof multer.MulterError) {
    status = 422;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? `File is too large (max ${Math.round(env.upload.maxBytes / 1024 / 1024)} MB)`
        : `Upload error: ${err.message}`;
  } else if (err?.type === "entity.parse.failed") {
    status = 400;
    message = "Malformed JSON body";
  } else if (err?.type === "entity.too.large") {
    status = 413;
    message = "Request body too large";
  } else if (err?.name === "ValidationError" && err.errors) {
    status = 422;
    message = "Validation failed";
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err?.name === "CastError") {
    status = 400;
    message = "Invalid identifier or value";
  } else if (err?.code === 11000) {
    status = 409;
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    message = fields.length ? `Duplicate value for: ${fields.join(", ")}` : "Duplicate value";
    errors = fields.map((f) => ({ field: f, message: "Already exists" }));
  }

  if (status >= 500 && !env.isTest) console.error(err);

  const body = { success: false, message, errors };
  if (status >= 500 && !env.isProd) body.stack = err?.stack; // never exposed in production
  return res.status(status).json(body);
}
