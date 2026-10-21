import { getCalendar } from "../services/calendarService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function leaves(req, res) {
  return sendSuccess(res, { message: "Approved leave calendar", data: await getCalendar(req.user, req.validated.query) });
}
