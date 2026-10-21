import * as service from "../services/leaveTypeService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function list(req, res) {
  const items = await service.listLeaveTypes(req.user, req.validated.query);
  return sendSuccess(res, { message: "Leave types", data: { leaveTypes: items } });
}
export async function get(req, res) {
  return sendSuccess(res, { message: "Leave type", data: { leaveType: await service.getLeaveType(req.user, req.validated.params.id) } });
}
export async function create(req, res) {
  const leaveType = await service.createLeaveType(req.user, req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: "Leave type created", data: { leaveType } });
}
export async function update(req, res) {
  const leaveType = await service.updateLeaveType(req.user, req.validated.params.id, req.validated.body);
  return sendSuccess(res, { message: "Leave type updated", data: { leaveType } });
}
export async function setStatus(req, res) {
  const leaveType = await service.setLeaveTypeStatus(req.user, req.validated.params.id, req.validated.body.active);
  return sendSuccess(res, { message: `Leave type ${leaveType.active ? "activated" : "deactivated"}`, data: { leaveType } });
}
