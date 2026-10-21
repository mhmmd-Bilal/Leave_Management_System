import { Router } from "express";
import * as c from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { changePasswordBody, loginBody, registerBody } from "../validators/auth.js";

const r = Router();
r.post("/register", loginLimiter, validate({ body: registerBody }), c.register);
r.post("/login", loginLimiter, validate({ body: loginBody }), c.login);
r.post("/logout", authenticate, c.logout);
r.get("/me", authenticate, c.me);
r.patch("/change-password", authenticate, validate({ body: changePasswordBody }), c.changePassword);
export default r;
