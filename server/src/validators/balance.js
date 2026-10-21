import { z } from "zod";
import { objectId, paginationShape } from "./common.js";

const year = z.coerce.number().int().min(2000).max(2200);

export const balancesQuery = z.object({ year: year.optional() });
export const employeeIdParam = z.object({ employeeId: objectId });

export const adjustBalanceBody = z.object({
  leaveTypeId: objectId,
  year: year.optional(),
  // Positive = add allocation, negative = deduct allocation. Half-day steps allowed.
  delta: z
    .coerce.number()
    .refine((n) => n !== 0, "delta cannot be 0")
    .refine((n) => Math.abs(n) <= 366, "delta is too large")
    .refine((n) => Number.isInteger(n * 2), "delta must be a multiple of 0.5"),
  reason: z.string().trim().min(5, "A reason of at least 5 characters is required").max(500),
});

export const adjustmentHistoryQuery = z.object({
  year: year.optional(),
  ...paginationShape,
});

export const initializeBalancesBody = z.object({
  year: year,
  leaveTypeIds: z.array(objectId).max(100).optional(),
  // false (default): only create missing balances. true: also sync base allocation of existing
  // balances to the current policy (never touches `used` or manual adjustments).
  updateExisting: z.boolean().optional().default(false),
});
