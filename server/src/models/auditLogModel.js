import mongoose from "mongoose";
import { cleanJson } from "../utils/toJson.js";

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    targetType: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { transform: cleanJson } }
);

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ createdAt: -1 });

// Audit records are append-only: block every update/delete path at the model level.
const blocked = [
  "updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace",
  "deleteOne", "deleteMany", "findOneAndDelete", "replaceOne",
];
for (const op of blocked) {
  auditLogSchema.pre(op, function immutable() {
    throw new Error("Audit logs are immutable");
  });
}
auditLogSchema.pre("save", function noUpdates() {
  if (!this.isNew) throw new Error("Audit logs are immutable");
});

export default mongoose.model("AuditLog", auditLogSchema);
