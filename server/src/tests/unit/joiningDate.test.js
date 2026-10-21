import assert from "node:assert/strict";
import { test } from "node:test";
import { checkJoiningDate } from "../../utils/joiningDate.js";

const d = (s) => new Date(`${s}T00:00:00.000Z`);

test("leave starting before the joining date is rejected with 422", () => {
  assert.throws(
    () => checkJoiningDate({ start: d("2024-01-14"), joiningDate: d("2024-01-15") }),
    (err) => err.statusCode === 422 && /joining date/i.test(err.message)
  );
});

test("leave starting on or after the joining date is allowed", () => {
  assert.doesNotThrow(() => checkJoiningDate({ start: d("2024-01-15"), joiningDate: d("2024-01-15") }));
  assert.doesNotThrow(() => checkJoiningDate({ start: d("2025-03-03"), joiningDate: d("2024-01-15") }));
});

test("a missing joining date never blocks leave", () => {
  assert.doesNotThrow(() => checkJoiningDate({ start: d("2020-01-01"), joiningDate: undefined }));
});
