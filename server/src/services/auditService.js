import AuditLog from "../models/auditLogModel.js";
import { addDays, parseDateOnly } from "../utils/dates.js";
import { buildPagination, skipFor } from "../utils/pagination.js";

// Never persist secrets in audit metadata.
const SENSITIVE_KEY = /pass|token|secret|hash|authorization|cookie/i;

export function sanitizeMetadata(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (value._bsontype === "ObjectId") return String(value);
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => sanitizeMetadata(v, depth + 1));
  if (typeof value === "object") {
    if (depth > 4) return "[truncated]";
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (!SENSITIVE_KEY.test(k)) out[k] = sanitizeMetadata(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Append an audit record. Pass { session } to make it part of the caller's transaction. */
export async function logAction({ actorId, action, targetId, targetType, metadata = {} }, { session } = {}) {
  await AuditLog.create(
    [{ actorId, action, targetId, targetType, metadata: sanitizeMetadata(metadata) }],
    { session }
  );
}

// HR may only see audit history relevant to their work.
export const HR_VISIBLE_ACTIONS = /^(leave\.|balance\.|registration\.)/;

export async function listAuditLogs(q, { hrOnly = false } = {}) {
  const filter = {};
  if (q.actorId) filter.actorId = q.actorId;
  if (q.targetType) filter.targetType = q.targetType;
  if (q.targetId) filter.targetId = q.targetId;
  if (q.action) filter.action = q.action;
  if (hrOnly) {
    // combine with any explicit action filter
    filter.$and = [{ action: HR_VISIBLE_ACTIONS }];
  }
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = parseDateOnly(q.from);
    if (q.to) filter.createdAt.$lt = addDays(parseDateOnly(q.to), 1);
  }
  const sort = { createdAt: q.order === "asc" ? 1 : -1, _id: q.order === "asc" ? 1 : -1 };
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort(sort)
      .skip(skipFor(q.page, q.limit))
      .limit(q.limit)
      .populate("actorId", "name email role")
      .lean({ virtuals: false }),
    AuditLog.countDocuments(filter),
  ]);
  return {
    items: items.map((a) => ({
      id: String(a._id),
      actor: a.actorId && a.actorId._id ? { id: String(a.actorId._id), name: a.actorId.name, role: a.actorId.role } : null,
      action: a.action,
      targetId: a.targetId ? String(a.targetId) : null,
      targetType: a.targetType,
      metadata: a.metadata,
      createdAt: a.createdAt,
    })),
    pagination: buildPagination({ page: q.page, limit: q.limit, total }),
  };
}
