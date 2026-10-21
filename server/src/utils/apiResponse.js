export function sendSuccess(res, { statusCode = 200, message = "Success", data = {} } = {}) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function sendList(res, { message = "Success", items, pagination, extra = {} }) {
  return res.status(200).json({ success: true, message, data: { items, pagination, ...extra } });
}
