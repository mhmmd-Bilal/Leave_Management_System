import mongoose from "mongoose";
import { cleanJson } from "../utils/toJson.js";

export const ROLES = ["employee", "hr", "admin"];
export const ACCOUNT_STATUSES = ["pending", "active", "rejected", "disabled", "relieved"];

// NOTE: the original skeleton registered this schema as "Employee" with a `password` field and a
// default status of "active". It now holds all three roles, stores `passwordHash`, and new
// accounts default to "pending" (public registration can never create an active account).
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "employee" },
    employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 30 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    joiningDate: { type: Date, required: true },
    status: { type: String, enum: ACCOUNT_STATUSES, default: "pending" },
    statusReason: { type: String, trim: true, maxlength: 500 },
    statusChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    statusChangedAt: Date,
    // Bumped on disable / relieve / logout / password change => all previously issued JWTs stop working.
    tokenVersion: { type: Number, default: 0 },
    // Bumped inside leave-approval transactions to serialise concurrent approvals for one employee.
    leaveVersion: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { transform: cleanJson } }
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ department: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model("User", userSchema);
export default User;
