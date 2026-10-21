import EmailOutbox from "../models/emailOutboxModel.js";
import Notification from "../models/notificationModel.js";
import ApiError from "../utils/ApiError.js";
import { buildPagination, skipFor } from "../utils/pagination.js";
import { renderEmail } from "./emailTemplates.js";

/**
 * Creates the in-app notification AND queues the email in the outbox. Call it with the caller's
 * transaction session so both rows are committed (or rolled back) together with the business
 * change. The email itself is delivered later by the email worker, so SMTP failures can never
 * undo an approval.
 */
export async function notifyUser(
  { recipient, type, title, message, relatedEntityId, sendEmail = true },
  { session } = {}
) {
  const [notification] = await Notification.create(
    [{ recipientId: recipient._id, title, message, type, relatedEntityId }],
    { session }
  );
  if (sendEmail && recipient.email) {
    const mail = renderEmail(type, { name: recipient.name, message });
    await EmailOutbox.create(
      [{ to: recipient.email, ...mail, notificationId: notification._id }],
      { session }
    );
  }
  return notification;
}

export async function listNotifications(userId, { isRead, page, limit }) {
  const filter = { recipientId: userId };
  if (isRead !== undefined) filter.isRead = isRead === "true";
  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skipFor(page, limit)).limit(limit),
    Notification.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination({ page, limit, total }) };
}

export const unreadCount = (userId) => Notification.countDocuments({ recipientId: userId, isRead: false });

export async function markRead(userId, id) {
  // The recipientId filter guarantees users can only touch their own notifications.
  const n = await Notification.findOneAndUpdate(
    { _id: id, recipientId: userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );
  if (!n) throw new ApiError(404, "Notification not found");
  return n;
}

export async function markAllRead(userId) {
  const r = await Notification.updateMany(
    { recipientId: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { updated: r.modifiedCount };
}
