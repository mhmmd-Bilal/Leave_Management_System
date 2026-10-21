import * as service from "../services/notificationService.js";
import { sendList, sendSuccess } from "../utils/apiResponse.js";

export async function list(req, res) {
  const { items, pagination } = await service.listNotifications(req.user._id, req.validated.query);
  return sendList(res, { message: "Notifications", items, pagination });
}
export async function unreadCount(req, res) {
  return sendSuccess(res, { message: "Unread notifications", data: { unread: await service.unreadCount(req.user._id) } });
}
export async function markRead(req, res) {
  return sendSuccess(res, { message: "Notification marked as read", data: { notification: await service.markRead(req.user._id, req.validated.params.id) } });
}
export async function markAllRead(req, res) {
  return sendSuccess(res, { message: "All notifications marked as read", data: await service.markAllRead(req.user._id) });
}
