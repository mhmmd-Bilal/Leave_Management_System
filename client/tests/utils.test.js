import assert from "node:assert/strict";
import { test } from "node:test";
import { isAuthProbe } from "../src/utils/authProbe.js";
import { cleanParams, getErrorMessage } from "../src/utils/errors.js";
import { formatDate, formatDays, titleCase, toIsoDate } from "../src/utils/format.js";

test("formatDate never shifts date-only values by time zone", () => {
  assert.equal(formatDate("2025-03-03"), "3 Mar 2025");
  assert.equal(formatDate("2025-12-31T00:00:00.000Z"), "31 Dec 2025");
  assert.equal(formatDate(""), "-");
  assert.equal(formatDate(null), "-");
});

test("formatDays / titleCase / toIsoDate", () => {
  assert.equal(formatDays(1), "1 day");
  assert.equal(formatDays(0.5), "0.5 days");
  assert.equal(titleCase("leave_approved"), "Leave approved");
  assert.equal(toIsoDate(new Date(2025, 0, 5)), "2025-01-05");
});

test("getErrorMessage prefers the server message and appends field errors", () => {
  assert.equal(getErrorMessage({ data: { message: "Nope" } }), "Nope");
  assert.equal(
    getErrorMessage({ data: { message: "Validation failed", errors: [{ field: "days", message: "Expected 4" }] } }),
    "Validation failed: days - Expected 4"
  );
  assert.match(getErrorMessage({ status: "FETCH_ERROR" }), /Cannot reach the server/);
  assert.equal(getErrorMessage(undefined, "fallback"), "fallback");
});

test("cleanParams drops empty values but keeps 0 and false", () => {
  assert.deepEqual(cleanParams({ a: "", b: undefined, c: null, d: 0, e: false, f: "x" }), { d: 0, e: false, f: "x" });
});

// Regression: a wrong CURRENT password returns 401 from /auth/change-password. That must NOT be
// treated as an expired session (it used to sign the user out).
test("isAuthProbe: auth endpoints are probes, other endpoints are not", () => {
  for (const url of ["/auth/login", "/auth/me", "/auth/register", "/auth/change-password"]) {
    assert.equal(isAuthProbe(url), true, url);
    assert.equal(isAuthProbe({ url }), true, url);
  }
  for (const url of ["/leaves/my", "/hr/leaves/1/approve", "/auth/logout"]) assert.equal(isAuthProbe({ url }), false, url);
  assert.equal(isAuthProbe(undefined), false);
});
