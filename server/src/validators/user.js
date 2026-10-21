import { z } from "zod";
import {
  dateOnly, department, email, employeeCode, name, paginationShape, passwordSchema, phone,
} from "./common.js";

export const listUsersQuery = z.object({
  status: z.enum(["pending", "active", "rejected", "disabled", "relieved"]).optional(),
  department: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sortBy: z.enum(["createdAt", "name", "joiningDate", "employeeId", "department"]).default("createdAt"),
  ...paginationShape,
});

export const rejectRegistrationBody = z.object({ reason: z.string().trim().max(500).optional() });

export const updateUserBody = z
  .object({
    name: name.optional(),
    email: email.optional(),
    phone: phone.optional(),
    department: department.optional(),
    employeeId: employeeCode.optional(),
    joiningDate: dateOnly.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const statusBody = z.object({
  status: z.enum(["active", "disabled", "relieved"]),
  reason: z.string().trim().max(500).optional(),
});

export const createHrBody = z.object({
  name,
  email,
  phone,
  password: passwordSchema,
  employeeId: employeeCode,
  department,
  joiningDate: dateOnly,
});
