// Requests whose 401 means "wrong credentials / not signed in", NOT "your session expired".
// A 401 on any other request logs the user out locally (see services/apiSlice.js).
// /auth/change-password answers 401 for a wrong CURRENT password - that must not sign the user out.
const PROBES = new Set(["/auth/login", "/auth/me", "/auth/register", "/auth/change-password"]);

export function isAuthProbe(args) {
  const url = typeof args === "string" ? args : args?.url;
  return PROBES.has(url);
}
