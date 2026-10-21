import { Router } from "express";
import * as c from "../controllers/leaveController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { uploadMedicalDocument, verifyUploadedFile } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { idParam } from "../validators/common.js";
import { calculateLeaveQuery, createLeaveBody, myLeavesQuery } from "../validators/leave.js";

const r = Router();
r.use(authenticate);
// Only employees apply for leave. Multer parses multipart bodies; plain JSON requests pass through it.
r.post("/", authorize("employee"), uploadMedicalDocument, verifyUploadedFile, validate({ body: createLeaveBody }), c.create);
r.get("/calculate", authorize("employee"), validate({ query: calculateLeaveQuery }), c.preview);
r.get("/my", authorize("employee"), validate({ query: myLeavesQuery }), c.mine);
r.get("/:id", validate({ params: idParam }), c.getOne);
r.get("/:id/document", validate({ params: idParam }), c.documentAccess);
r.patch("/:id/cancel", authorize("employee"), validate({ params: idParam }), c.cancel);
export default r;
