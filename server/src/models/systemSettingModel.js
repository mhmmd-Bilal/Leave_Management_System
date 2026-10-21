import mongoose from "mongoose";
import { cleanJson } from "../utils/toJson.js";

// Singleton document (key = "global").
const systemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true },
    // 0 = Sunday ... 6 = Saturday. Every other day is a "weekend" (non-working) day.
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    holidays: [
      new mongoose.Schema(
        { date: { type: Date, required: true }, name: { type: String, required: true, maxlength: 100 } },
        { _id: false }
      ),
    ],
    // Label of the leave year = calendar year in which it starts. 1 => January-December.
    leaveYearStartMonth: { type: Number, default: 1, min: 1, max: 12 },
    timezone: { type: String, default: "Asia/Kolkata" },
    // Per-leave-type allocation overrides; falls back to LeaveType.yearlyLimit.
    allocationDefaults: [
      new mongoose.Schema(
        { leaveTypeCode: { type: String, uppercase: true, required: true }, days: { type: Number, min: 0, required: true } },
        { _id: false }
      ),
    ],
    policies: {
      maxAdvanceDays: { type: Number, default: 365, min: 0 },
    },
    adminGuard: { type: Number, default: 0 }, // bumped to serialise admin status changes
  },
  { timestamps: true, toJSON: { transform: (d, r) => { const o = cleanJson(d, r); delete o.adminGuard; return o; } } }
);

export default mongoose.model("SystemSetting", systemSettingSchema);
