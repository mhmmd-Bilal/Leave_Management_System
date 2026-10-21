import { Router } from "express";
import * as c from "../controllers/leaveTypeController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParam } from "../validators/common.js";
import { leaveTypeBody, leaveTypeStatusBody, listLeaveTypesQuery, updateLeaveTypeBody } from "../validators/leave.js";

const r = Router();
r.use(authenticate);
r.get("/", validate({ query: listLeaveTypesQuery }), c.list);
r.get("/:id", validate({ params: idParam }), c.get);
r.post("/", authorize("admin"), validate({ body: leaveTypeBody }), c.create);
r.patch("/:id", authorize("admin"), validate({ params: idParam, body: updateLeaveTypeBody }), c.update);
r.patch("/:id/status", authorize("admin"), validate({ params: idParam, body: leaveTypeStatusBody }), c.setStatus);
export default r;
