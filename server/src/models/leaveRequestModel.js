import mongoose from "mongoose";
import { cleanJson } from "../utils/toJson.js";

export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"];

const documentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    publicId: { type: String, required: true }, // Cloudinary public id - never exposed in API responses
    resourceType: { type: String, default: "image" },
    format: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const leaveRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 0.5 },
    isHalfDay: { type: Boolean, default: false },
    // Days per leave year (a request spanning two years is deducted from each year's balance).
    yearBreakdown: [
      new mongoose.Schema({ year: Number, days: Number }, { _id: false }),
    ],
    reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 1000 },
    medicalDocument: { type: documentSchema, default: undefined },
    status: { type: String, enum: LEAVE_STATUSES, default: "pending" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    cancelledAt: Date,
    // Optional client-supplied key making POST /api/leaves safe to retry (duplicate HTTP requests).
    idempotencyKey: { type: String, maxlength: 100 },
  },
  { timestamps: true, toJSON: { transform: cleanJson } }
);

leaveRequestSchema.index({ employeeId: 1, status: 1 });
leaveRequestSchema.index({ employeeId: 1, startDate: 1, endDate: 1 });
leaveRequestSchema.index({ status: 1, startDate: 1, endDate: 1 });
leaveRequestSchema.index({ leaveTypeId: 1 });
leaveRequestSchema.index({ createdAt: -1 });
leaveRequestSchema.index(
  { employeeId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export default mongoose.model("LeaveRequest", leaveRequestSchema);
