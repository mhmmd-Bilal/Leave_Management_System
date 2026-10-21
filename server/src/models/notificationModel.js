import mongoose from "mongoose";
import { cleanJson } from "../utils/toJson.js";

export const NOTIFICATION_TYPES = [
  "account_approved",
  "account_rejected",
  "leave_approved",
  "leave_rejected",
  "balance_adjusted",
];

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId },
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { transform: cleanJson } }
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
