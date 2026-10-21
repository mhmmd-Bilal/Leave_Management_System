import { Router } from "express";
import * as c from "../controllers/reportController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { csvQuery, reportQuery } from "../validators/report.js";

const r = Router();
r.use(authenticate, authorize("hr", "admin"));
r.get("/export/csv", validate({ query: csvQuery }), c.exportCsv);
r.get("/monthly", validate({ query: reportQuery }), c.jsonReport("monthly"));
r.get("/annual", validate({ query: reportQuery }), c.jsonReport("annual"));
r.get("/employees", validate({ query: reportQuery }), c.jsonReport("employees"));
r.get("/departments", validate({ query: reportQuery }), c.jsonReport("departments"));
r.get("/leave-types", validate({ query: reportQuery }), c.jsonReport("leave-types"));
r.get("/status-summary", validate({ query: reportQuery }), c.jsonReport("status-summary"));
r.get("/balances", validate({ query: reportQuery }), c.jsonReport("balances"));
export default r;
