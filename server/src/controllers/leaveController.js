import * as leaveService from "../services/leaveService.js";
import { sendList, sendSuccess } from "../utils/apiResponse.js";

export async function create(req, res) {
  const key = req.get("idempotency-key")?.slice(0, 100);
  const { request, duplicate } = await leaveService.submitLeave(req.user, req.validated.body, req.file, key);
  if (duplicate) {
    return sendSuccess(res, { message: "Leave request already submitted", data: { leave: request } });
  }
  return sendSuccess(res, { statusCode: 201, message: "Leave request created successfully", data: { leave: request } });
}

export async function mine(req, res) {
  const { items, pagination } = await leaveService.listMyLeaves(req.user, req.validated.query);
  return sendList(res, { message: "Your leave requests", items, pagination });
}

export async function getOne(req, res) {
  return sendSuccess(res, { message: "Leave request", data: { leave: await leaveService.getLeave(req.user, req.validated.params.id) } });
}

export async function cancel(req, res) {
  const leave = await leaveService.cancelLeave(req.user, req.validated.params.id);
  return sendSuccess(res, { message: "Leave request cancelled", data: { leave } });
}

export async function documentAccess(req, res) {
  const data = await leaveService.getDocumentAccess(req.user, req.validated.params.id);
  res.set("Cache-Control", "private, no-store");
  return sendSuccess(res, { message: "Short-lived document link", data });
}

export async function preview(req, res) {
  return sendSuccess(res, { message: "Leave calculation", data: await leaveService.previewLeave(req.user, req.validated.query) });
}
