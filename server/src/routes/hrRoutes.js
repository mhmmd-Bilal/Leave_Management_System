import { Router } from "express";
import * as c from "../controllers/hrController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { auditQuery } from "../validators/admin.js";
import { adjustBalanceBody, adjustmentHistoryQuery, balancesQuery, employeeIdParam } from "../validators/balance.js";
import { idParam } from "../validators/common.js";
import { hrLeavesQuery, rejectLeaveBody } from "../validators/leave.js";
import { dashboardQuery } from "../validators/report.js";
import { listUsersQuery, rejectRegistrationBody } from "../validators/user.js";

const r = Router();
r.use(authenticate, authorize("hr", "admin")); // admins may perform every HR operation

r.get("/dashboard", validate({ query: dashboardQuery }), c.getDashboard);

r.get("/employees", validate({ query: listUsersQuery }), c.listEmployees);
r.get("/employees/:id", validate({ params: idParam }), c.getEmployee);
r.get("/registrations/pending", validate({ query: listUsersQuery }), c.listPending);
r.get("/registrations/rejected", validate({ query: listUsersQuery }), c.listRejected);
r.patch("/employees/:id/approve", validate({ params: idParam }), c.approveEmployee);
r.patch("/employees/:id/reject", validate({ params: idParam, body: rejectRegistrationBody }), c.rejectEmployee);

r.get("/leaves", validate({ query: hrLeavesQuery }), c.listLeaves);
r.get("/leaves/:id", validate({ params: idParam }), c.getLeave);
r.patch("/leaves/:id/approve", validate({ params: idParam }), c.approveLeave);
r.patch("/leaves/:id/reject", validate({ params: idParam, body: rejectLeaveBody }), c.rejectLeave);

r.get("/balances/:employeeId", validate({ params: employeeIdParam, query: balancesQuery }), c.getBalances);
r.get("/balances/:employeeId/adjustments", validate({ params: employeeIdParam, query: adjustmentHistoryQuery }), c.adjustmentHistory);
r.patch("/balances/:employeeId/adjust", validate({ params: employeeIdParam, body: adjustBalanceBody }), c.adjustBalance);

r.get("/audit-logs", validate({ query: auditQuery }), c.auditLogs);
export default r;
