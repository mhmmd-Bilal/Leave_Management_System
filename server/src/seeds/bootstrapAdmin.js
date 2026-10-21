import User from "../models/userModel.js";
import { hashPassword } from "../services/authService.js";

/**
 * Secure admin bootstrap (there is NO public endpoint that creates admins).
 * Idempotent: if an account with this email exists it is left untouched.
 */
export async function bootstrapAdmin({ name, email, password, employeeId = "ADMIN001", phone = "0000000000" }) {
  if (!email || !password) throw new Error("Admin email and password are required (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)");
  if (password.length < 10) throw new Error("Admin password must be at least 10 characters");
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return { created: false, user: existing };
  const user = await User.create({
    name: name || "System Admin", email, phone, employeeId, department: "Administration",
    joiningDate: new Date(), role: "admin", status: "active", passwordHash: await hashPassword(password),
  });
  return { created: true, user };
}
