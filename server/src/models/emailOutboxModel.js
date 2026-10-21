import mongoose from "mongoose";

// Transactional outbox: rows are written in the SAME transaction as the business change and sent
// afterwards by jobs/emailWorker.js, so SMTP failures can never roll back an approval.
const emailOutboxSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    text: { type: String, required: true },
    html: { type: String, required: true },
    status: { type: String, enum: ["pending", "sending", "sent", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: String,
    sentAt: Date,
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: "Notification" },
  },
  { timestamps: true }
);

emailOutboxSchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.model("EmailOutbox", emailOutboxSchema);
