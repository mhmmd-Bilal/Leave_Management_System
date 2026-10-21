import { z } from "zod";
import { isValidDateOnly, isValidTimeZone } from "../utils/dates.js";

export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid id");
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine(isValidDateOnly, "Invalid calendar date");
export const timeZone = z.string().refine(isValidTimeZone, "Invalid IANA time zone");

export const idParam = z.object({ id: objectId });

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

// Accepts true/false and "true"/"false" (multipart forms and query strings send strings).
export const boolish = z.preprocess(
  (v) => (v === "true" ? true : v === "false" ? false : v),
  z.boolean()
);

export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  order: z.enum(["asc", "desc"]).default("desc"),
};

export const name = z.string().trim().min(2).max(100);
export const phone = z.string().trim().regex(/^\+?[0-9\s-]{7,15}$/, "Invalid phone number");
export const email = z.string().trim().toLowerCase().email("Invalid email address").max(254);
export const employeeCode = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .regex(/^[A-Za-z0-9_-]+$/, "Employee ID may contain letters, numbers, - and _");
export const department = z.string().trim().min(2).max(100);
