import { Router } from "express";
import * as c from "../controllers/employeeController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { updateProfileBody } from "../validators/auth.js";
import { balancesQuery } from "../validators/balance.js";
import { myLeavesQuery } from "../validators/leave.js";

const r = Router();
r.use(authenticate);
r.get("/me", c.getProfile);
r.patch("/me", validate({ body: updateProfileBody }), c.updateProfile);
r.get("/me/balances", authorize("employee"), validate({ query: balancesQuery }), c.myBalances);
r.get("/me/leave-history", authorize("employee"), validate({ query: myLeavesQuery }), c.myLeaveHistory);
export default r;
