import mongoose from "mongoose";
import { cleanJson } from "../utils/toJson.js";

/**
 * Invariants (maintained by atomic $inc updates in balanceService / leaveService):
 *   allocated = baseAllocation + adjustment      (adjustment = sum of manual HR adjustments)
 *   available = allocated - used
 * Leave is deducted (`used` += days) ONLY when a request is approved.
 */
const leaveBalanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },
    year: { type: Number, required: true, min: 2000, max: 2200 },
    baseAllocation: { type: Number, required: true, default: 0, min: 0 },
    adjustment: { type: Number, default: 0 },
    allocated: { type: Number, required: true, default: 0 },
    used: { type: Number, default: 0, min: 0 },
    available: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, toJSON: { transform: cleanJson } }
);

leaveBalanceSchema.index({ employeeId: 1, leaveTypeId: 1, year: 1 }, { unique: true });
leaveBalanceSchema.index({ year: 1, leaveTypeId: 1 });

leaveBalanceSchema.pre("validate", function keepConsistent() {
  this.allocated = this.baseAllocation + this.adjustment;
  this.available = this.allocated - this.used;
});

const LeaveBalance = mongoose.model("LeaveBalance", leaveBalanceSchema);
export default LeaveBalance;
