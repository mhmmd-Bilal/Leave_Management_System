import mongoose from "mongoose";
import { cleanJson } from "../utils/toJson.js";

const rulesSchema = new mongoose.Schema(
  {
    minDays: { type: Number, default: 0.5, min: 0.5 },
    maxDays: { type: Number, default: 30, min: 0.5 },
    requiresDocument: { type: Boolean, default: false },
    allowHalfDay: { type: Boolean, default: false },
    countWeekends: { type: Boolean, default: false },
    countHolidays: { type: Boolean, default: false },
    advanceNoticeDays: { type: Number, default: 0, min: 0 },
    maxBackdateDays: { type: Number, default: 0, min: 0 },
    allowNegativeBalance: { type: Boolean, default: false },
  },
  { _id: false }
);

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9_]{2,20}$/, "Code must be 2-20 characters: A-Z, 0-9 or _"],
    },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    yearlyLimit: { type: Number, required: true, min: 0, max: 366 },
    rules: { type: rulesSchema, default: () => ({}) },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { transform: cleanJson } }
);

leaveTypeSchema.pre("validate", function checkRules() {
  const r = this.rules;
  if (r && r.minDays != null && r.maxDays != null && r.minDays > r.maxDays) {
    this.invalidate("rules.minDays", "minDays cannot be greater than maxDays");
  }
});

leaveTypeSchema.index({ active: 1 });

// Leave types are never deleted (historical requests reference them) - only deactivated.
const LeaveType = mongoose.model("LeaveType", leaveTypeSchema);
export default LeaveType;
