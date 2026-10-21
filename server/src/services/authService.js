import bcrypt from "bcryptjs";
import env from "../config/env.js";
import User from "../models/userModel.js";
import ApiError from "../utils/ApiError.js";
import { parseDateOnly } from "../utils/dates.js";
import { runInTransaction } from "../utils/transaction.js";
import { logAction } from "./auditService.js";

export const hashPassword = (plain) => bcrypt.hash(plain, env.bcryptRounds);

// Used to equalise timing when the email does not exist (prevents user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 4);

export async function registerEmployee(input) {
  const duplicate = await User.findOne({
    $or: [{ email: input.email }, { employeeId: input.employeeId.toUpperCase() }],
  }).select("email employeeId");
  if (duplicate) {
    const field = duplicate.email === input.email ? "email" : "employeeId";
    throw new ApiError(409, field === "email" ? "Email is already registered" : "Employee ID is already registered", [
      { field, message: "Already exists" },
    ]);
  }
  const passwordHash = await hashPassword(input.password);
  // role and status are set by the server - never taken from the request.
  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash,
    employeeId: input.employeeId,
    department: input.department,
    joiningDate: parseDateOnly(input.joiningDate),
    role: "employee",
    status: "pending",
  });
  await logAction({ actorId: user._id, action: "user.registered", targetId: user._id, targetType: "User", metadata: { email: user.email, employeeId: user.employeeId } });
  return user;
}

const STATUS_MESSAGES = {
  pending: "Your account is pending approval by HR",
  rejected: "Your registration was rejected",
  disabled: "Your account has been disabled. Please contact HR",
  relieved: "Your account is no longer active (relieved)",
};

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select("+passwordHash");
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "Invalid email or password");
  // Status is checked only after the password is verified, so it cannot be probed without credentials.
  if (user.status !== "active") throw new ApiError(403, STATUS_MESSAGES[user.status] || "Account is not active");
  return user;
}

/** Bumping tokenVersion invalidates every JWT issued before (logout everywhere). */
export async function logout(user) {
  await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
}

export async function changePassword(user, { currentPassword, newPassword }) {
  const full = await User.findById(user._id).select("+passwordHash");
  if (!(await bcrypt.compare(currentPassword, full.passwordHash))) {
    throw new ApiError(401, "Current password is incorrect");
  }
  if (await bcrypt.compare(newPassword, full.passwordHash)) {
    throw new ApiError(422, "New password must be different from the current password");
  }
  const passwordHash = await hashPassword(newPassword);
  return runInTransaction(async (session) => {
    const u = await User.findById(user._id).session(session);
    u.passwordHash = passwordHash;
    u.tokenVersion += 1; // all older sessions are revoked
    await u.save({ session });
    await logAction({ actorId: u._id, action: "user.password_changed", targetId: u._id, targetType: "User" }, { session });
    return u;
  });
}

export async function updateOwnProfile(user, patch) {
  const u = await User.findById(user._id);
  if (patch.name !== undefined) u.name = patch.name;
  if (patch.phone !== undefined) u.phone = patch.phone;
  await u.save();
  return u;
}
