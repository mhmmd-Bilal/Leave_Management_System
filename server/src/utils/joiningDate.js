import ApiError from "./ApiError.js";

/**
 * Leave cannot start before the employee joined. `joiningDate` and `start` are UTC-midnight dates.
 * Pure function (no database access) so it can be unit-tested directly.
 */
export function checkJoiningDate({ start, joiningDate }) {
  if (!joiningDate) return;
  if (new Date(start) < new Date(joiningDate)) {
    throw new ApiError(422, "Leave cannot start before your joining date", [
      { field: "startDate", message: "Must not be before the joining date" },
    ]);
  }
}
