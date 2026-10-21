import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { inject } from "vitest";
import app from "../../app.js";
import LeaveType from "../../models/leaveTypeModel.js";
import User from "../../models/userModel.js";
import { addDays, toDateOnly, todayInTimeZone } from "../../utils/dates.js";

export { app, request };
export const PASSWORD = "Passw0rd!test";
let counter = 0;

export async function startTestDb() {
  const dbName = `test_lms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (!dbName.startsWith("test_")) throw new Error("Refusing to run tests against a non-test database");
  await mongoose.connect(inject("mongoUri"), { dbName });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // build unique indexes
}

export async function stopTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

export async function resetDb() {
  for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
}

export async function createUser(overrides = {}) {
  counter += 1;
  return User.create({
    name: `User ${counter}`,
    email: `user${counter}-${Math.random().toString(36).slice(2, 6)}@example.com`,
    phone: "9876543210",
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    role: "employee",
    employeeId: `EMP${counter}${Math.random().toString(36).slice(2, 5)}`,
    department: "Engineering",
    joiningDate: new Date("2024-01-15"),
    status: "active",
    ...overrides,
  });
}

export async function tokenFor(user) {
  const res = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed (${res.status}): ${JSON.stringify(res.body)}`);
  return res.body.data.token;
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/** Creates a user and returns { user, token, h } where h are ready-to-use auth headers. */
export async function actor(overrides = {}) {
  const user = await createUser(overrides);
  const token = await tokenFor(user);
  return { user, token, h: bearer(token) };
}

/**
 * A leave type that accepts old fixed dates (maxBackdateDays is huge), so tests are deterministic
 * and never depend on today's date.
 */
export async function makeLeaveType(over = {}) {
  counter += 1;
  return LeaveType.create({
    name: `Test Leave ${counter}`,
    code: `T${counter}X`,
    yearlyLimit: 12,
    ...over,
    rules: { maxDays: 30, maxBackdateDays: 36500, ...(over.rules || {}) },
  });
}

// Fixed dates (Mondays/weekdays in 2025). 2025-03-03 is a Monday.
export const D = {
  mon1: "2025-03-03", thu1: "2025-03-06",
  mon2: "2025-03-10", thu2: "2025-03-13",
  mon3: "2025-03-17", wed3: "2025-03-19",
  sat: "2025-03-08", sun: "2025-03-09",
};

export const leaveBody = (leaveTypeId, startDate, endDate, days, extra = {}) => ({
  leaveTypeId: String(leaveTypeId), startDate, endDate, days, reason: "Personal work", ...extra,
});

export const today = () => todayInTimeZone("Asia/Kolkata");
export const isoDaysFromToday = (n) => toDateOnly(addDays(today(), n));

export async function submit(emp, leaveTypeId, start, end, days, extra) {
  return request(app).post("/api/leaves").set(emp.h).send(leaveBody(leaveTypeId, start, end, days, extra));
}
