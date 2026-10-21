import { Router } from "express";
import * as c from "../controllers/adminController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { auditQuery, settingsBody } from "../validators/admin.js";
import { initializeBalancesBody } from "../validators/balance.js";
import { idParam } from "../validators/common.js";
import { createHrBody, listUsersQuery, statusBody, updateUserBody } from "../validators/user.js";

const r = Router();
r.use(authenticate, authorize("admin"));

// Employees
r.get("/employees", validate({ query: listUsersQuery }), c.listUsers("employee"));
r.get("/employees/:id", validate({ params: idParam }), c.getUser("employee"));
r.patch("/employees/:id", validate({ params: idParam, body: updateUserBody }), c.updateUser("employee"));
r.patch("/employees/:id/status", validate({ params: idParam, body: statusBody }), c.changeStatus("employee"));

// HR accounts (never creatable through public registration)
r.post("/hr", validate({ body: createHrBody }), c.createHr);
r.get("/hr", validate({ query: listUsersQuery }), c.listUsers("hr"));
r.get("/hr/:id", validate({ params: idParam }), c.getUser("hr"));
r.patch("/hr/:id", validate({ params: idParam, body: updateUserBody }), c.updateUser("hr"));
r.patch("/hr/:id/status", validate({ params: idParam, body: statusBody }), c.changeStatus("hr"));

// Admin accounts: listing + status only (creation is bootstrap-only; protected by the last-admin guard)
r.get("/admins", validate({ query: listUsersQuery }), c.listUsers("admin"));
r.patch("/admins/:id/status", validate({ params: idParam, body: statusBody }), c.changeStatus("admin"));

r.get("/settings", c.getSettings);
r.patch("/settings", validate({ body: settingsBody }), c.updateSettings);
r.post("/balances/initialize", validate({ body: initializeBalancesBody }), c.initializeBalances);
r.get("/audit-logs", validate({ query: auditQuery }), c.auditLogs);
export default r;
