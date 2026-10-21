/** Extracts a readable message (and field errors) from an RTK Query error. */
export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;
  if (err.data?.message) {
    const fields = Array.isArray(err.data.errors) ? err.data.errors.filter((e) => e?.field && e?.message) : [];
    return fields.length ? `${err.data.message}: ${fields.map((e) => `${e.field} - ${e.message}`).join("; ")}` : err.data.message;
  }
  if (err.status === "FETCH_ERROR") return "Cannot reach the server. Check your connection.";
  return fallback;
}
export const cleanParams = (p = {}) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== "" && v !== undefined && v !== null));
