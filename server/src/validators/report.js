import { z } from "zod";
import { dateOnly, objectId, paginationShape } from "./common.js";

const reportFilters = {
  employeeId: objectId.optional(),
  department: z.string().trim().min(1).max(100).optional(),
  leaveTypeId: objectId.optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
};

const rangeCheck = (v) => !v.from || !v.to || v.from <= v.to;
const rangeMsg = { message: "`from` must not be after `to`", path: ["from"] };

export const reportQuery = z.object(reportFilters).refine(rangeCheck, rangeMsg);

export const REPORT_NAMES = [
  "monthly", "annual", "employees", "departments", "leave-types", "status-summary", "balances",
];

export const csvQuery = z
  .object({ report: z.enum(REPORT_NAMES), ...reportFilters })
  .refine(rangeCheck, rangeMsg);

export const calendarQuery = z
  .object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2200).optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    department: z.string().trim().min(1).max(100).optional(),
  })
  .refine((v) => (v.from && v.to) || (v.month && v.year), {
    message: "Provide either month and year, or from and to",
    path: ["month"],
  })
  .refine(rangeCheck, rangeMsg);

export const dashboardQuery = z
  .object({
    from: dateOnly.optional(), // filters leave-request counts by submission date
    to: dateOnly.optional(),
    department: z.string().trim().min(1).max(100).optional(),
  })
  .refine(rangeCheck, rangeMsg);

export const notificationsQuery = z.object({
  isRead: z.enum(["true", "false"]).optional(),
  page: paginationShape.page,
  limit: paginationShape.limit,
});
