import LeaveRequest from "../models/leaveRequestModel.js";
import User from "../models/userModel.js";
import ApiError from "../utils/ApiError.js";
import { diffInDays, monthBounds, parseDateOnly, toDateOnly } from "../utils/dates.js";
import { exactCI } from "../utils/regex.js";

const MAX_RANGE = 366;

/**
 * Approved leave events for a month or a custom range.
 *  - HR/Admin: any department (optional filter); name, employee id, department and leave type.
 *  - Employees: their OWN department only; names and dates, but the leave type is shown only on
 *    their own events (e.g. a colleague's sick leave stays private).
 * Reasons and medical documents are never part of the calendar payload.
 */
export async function getCalendar(user, q) {
  let start;
  let end;
  if (q.from && q.to) {
    start = parseDateOnly(q.from);
    end = parseDateOnly(q.to);
  } else {
    ({ start, end } = monthBounds(q.year, q.month));
  }
  if (diffInDays(start, end) + 1 > MAX_RANGE) throw new ApiError(422, `Calendar range cannot exceed ${MAX_RANGE} days`);

  const privileged = user.role !== "employee";
  const department = privileged ? q.department : user.department;
  const filter = { status: "approved", startDate: { $lte: end }, endDate: { $gte: start } };
  if (department) {
    filter.employeeId = { $in: await User.find({ role: "employee", department: exactCI(department) }).distinct("_id") };
  }

  const leaves = await LeaveRequest.find(filter)
    .sort({ startDate: 1, _id: 1 })
    .populate("employeeId", "name employeeId department")
    .populate("leaveTypeId", "name code")
    .lean();

  const events = leaves
    .filter((l) => l.employeeId)
    .map((l) => {
      const own = String(l.employeeId._id) === String(user._id);
      return {
        id: String(l._id),
        employee: {
          id: String(l.employeeId._id),
          name: l.employeeId.name,
          ...(privileged ? { employeeId: l.employeeId.employeeId } : {}),
          department: l.employeeId.department,
        },
        leaveType: privileged || own ? { name: l.leaveTypeId.name, code: l.leaveTypeId.code } : null,
        startDate: toDateOnly(l.startDate),
        endDate: toDateOnly(l.endDate),
        days: l.days,
        isHalfDay: l.isHalfDay,
      };
    });

  return { from: toDateOnly(start), to: toDateOnly(end), department: department || null, events };
}
