import { REPORTS } from "../services/reportService.js";
import { toDateOnly } from "../utils/dates.js";
import { toCsv } from "../utils/csv.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const jsonReport = (name) => async (req, res) => {
  const { columns, rows, ...rest } = await REPORTS[name](req.validated.query);
  return sendSuccess(res, { message: `${name} report`, data: { report: name, ...rest, columns, rows } });
};

export async function exportCsv(req, res) {
  const { report, ...filters } = req.validated.query;
  const { columns, rows } = await REPORTS[report](filters);
  const csv = toCsv(columns, rows);
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="leave-report-${report}-${toDateOnly(new Date())}.csv"`);
  res.set("Cache-Control", "private, no-store");
  return res.status(200).send(csv);
}
