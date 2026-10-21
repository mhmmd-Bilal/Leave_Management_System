import { z } from "zod";
import { dateOnly, objectId, paginationShape, timeZone } from "./common.js";

export const settingsBody = z
  .object({
    workingDays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "At least one working day is required")
      .refine((a) => new Set(a).size === a.length, "workingDays must be unique")
      .optional(),
    holidays: z
      .array(z.object({ date: dateOnly, name: z.string().trim().min(1).max(100) }))
      .max(400)
      .refine((a) => new Set(a.map((h) => h.date)).size === a.length, "Holiday dates must be unique")
      .optional(),
    leaveYearStartMonth: z.number().int().min(1).max(12).optional(),
    timezone: timeZone.optional(),
    allocationDefaults: z
      .array(
        z.object({
          leaveTypeCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,20}$/),
          days: z.number().min(0).max(366),
        })
      )
      .max(100)
      .optional(),
    policies: z.object({ maxAdvanceDays: z.number().int().min(0).max(3650).optional() }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one setting to update");

export const auditQuery = z.object({
  actorId: objectId.optional(),
  action: z.string().trim().min(1).max(80).optional(),
  targetType: z.string().trim().min(1).max(40).optional(),
  targetId: objectId.optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  ...paginationShape,
});
