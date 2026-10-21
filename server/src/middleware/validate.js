import ApiError from "../utils/ApiError.js";

/**
 * validate({ params, query, body }) - parsed (and stripped) values are placed on req.validated.
 * Unknown keys are dropped, so only whitelisted fields ever reach controllers (no mass assignment),
 * and every value has the expected primitive type (no NoSQL operator objects in filters).
 */
export const validate = (schemas) => (req, _res, next) => {
  const errors = [];
  req.validated = {};
  for (const part of ["params", "query", "body"]) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) req.validated[part] = result.data;
    else {
      for (const issue of result.error.issues) {
        errors.push({ field: [part, ...issue.path].join(".").replace(/^body\./, ""), message: issue.message });
      }
    }
  }
  if (errors.length) return next(new ApiError(422, "Validation failed", errors));
  return next();
};
