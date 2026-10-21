import { z } from "zod";
import { boolish, dateOnly, objectId, paginationShape } from "./common.js";

export const createLeaveBody = z.object({
  leaveTypeId: objectId,
  startDate: dateOnly,
  endDate: dateOnly,
  days: z.coerce.number().positive().max(366),
  reason: z.string().trim().min(3).max(1000),
  isHalfDay: boolish.optional().default(false),
});

export const rejectLeaveBody = z.object({
  reason: z.string().trim().max(500).optional(),
});

const leaveFilters = {
  leaveTypeId: objectId.optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  startDate: dateOnly.optional(), // leave overlapping [startDate, endDate]
  endDate: dateOnly.optional(),
  submittedFrom: dateOnly.optional(),
  submittedTo: dateOnly.optional(),
  sortBy: z.enum(["createdAt", "startDate", "endDate", "days", "status"]).default("createdAt"),
  ...paginationShape,
};

export const myLeavesQuery = z.object(leaveFilters);

export const hrLeavesQuery = z.object({
  ...leaveFilters,
  employeeId: objectId.optional(),
  department: z.string().trim().min(1).max(100).optional(),
});

export const leaveTypeBody = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,20}$/, "Code must be 2-20 characters: A-Z, 0-9 or _"),
  description: z.string().trim().max(500).optional(),
  yearlyLimit: z.coerce.number().min(0).max(366),
  rules: z
    .object({
      minDays: z.coerce.number().min(0.5).optional(),
      maxDays: z.coerce.number().min(0.5).optional(),
      requiresDocument: boolish.optional(),
      allowHalfDay: boolish.optional(),
      countWeekends: boolish.optional(),
      countHolidays: boolish.optional(),
      advanceNoticeDays: z.coerce.number().int().min(0).optional(),
      maxBackdateDays: z.coerce.number().int().min(0).optional(),
      allowNegativeBalance: boolish.optional(),
    })
    .optional(),
  active: boolish.optional(),
});

export const updateLeaveTypeBody = leaveTypeBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const leaveTypeStatusBody = z.object({ active: boolish });

export const listLeaveTypesQuery = z.object({ includeInactive: boolish.optional().default(false) });

export const calculateLeaveQuery = z.object({
  leaveTypeId: objectId,
  startDate: dateOnly,
  endDate: dateOnly,
  isHalfDay: boolish.optional().default(false),
});
