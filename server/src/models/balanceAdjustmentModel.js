import mongoose from "mongoose";
import { cleanJson } from "../utils/toJson.js";

// Immutable record of every manual HR balance adjustment (history + mandatory reason).
const schema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },
    year: { type: Number, required: true },
    delta: { type: Number, required: true },
    reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    previousAvailable: { type: Number, required: true },
    newAvailable: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { transform: cleanJson } }
);
schema.index({ employeeId: 1, createdAt: -1 });

export default mongoose.model("BalanceAdjustment", schema);
