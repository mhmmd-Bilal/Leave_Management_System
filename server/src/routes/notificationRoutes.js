import { Router } from "express";
import * as c from "../controllers/notificationController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParam } from "../validators/common.js";
import { notificationsQuery } from "../validators/report.js";

const r = Router();
r.use(authenticate);
r.get("/", validate({ query: notificationsQuery }), c.list);
r.get("/unread-count", c.unreadCount);
r.patch("/read-all", c.markAllRead); // must be declared before "/:id/read"
r.patch("/:id/read", validate({ params: idParam }), c.markRead);
export default r;
