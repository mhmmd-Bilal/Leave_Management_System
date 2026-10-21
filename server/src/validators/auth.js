import { z } from "zod";
import { dateOnly, department, email, employeeCode, name, passwordSchema, phone } from "./common.js";

// Unknown keys (role, status, ...) are stripped by zod => mass-assignment is impossible.
export const registerBody = z.object({
  name,
  email,
  phone,
  password: passwordSchema,
  employeeId: employeeCode,
  department,
  joiningDate: dateOnly,
});

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export const updateProfileBody = z
  .object({ name: name.optional(), phone: phone.optional() })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");
