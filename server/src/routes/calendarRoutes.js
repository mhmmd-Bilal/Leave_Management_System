import { Router } from "express";
import * as c from "../controllers/calendarController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { calendarQuery } from "../validators/report.js";

const r = Router();
r.use(authenticate);
r.get("/leaves", validate({ query: calendarQuery }), c.leaves);
export default r;
