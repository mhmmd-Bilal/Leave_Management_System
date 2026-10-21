// Repeatable, idempotent demo data:  npm run seed
// Credentials come from the environment (see .env.example); nothing secret is hard-coded.
import connectDb, { assertTransactionSupport, disconnectDb } from "../config/db.js";
import env from "../config/env.js";
import LeaveBalance from "../models/leaveBalanceModel.js";
import LeaveRequest from "../models/leaveRequestModel.js";
import LeaveType from "../models/leaveTypeModel.js";
import User from "../models/userModel.js";
import { hashPassword } from "../services/authService.js";
import { computeLeave } from "../services/leaveCalculationService.js";
import { currentLeaveYear, getSettings, todayFor } from "../services/settingsService.js";
import { ensureBalance } from "../services/balanceService.js";
import { addDays, parseDateOnly } from "../utils/dates.js";
import { bootstrapAdmin } from "./bootstrapAdmin.js";

const LEAVE_TYPES = [
  { name: "Casual Leave", code: "CASUAL", description: "Short personal leave", yearlyLimit: 12,
    rules: { minDays: 0.5, maxDays: 5, allowHalfDay: true, advanceNoticeDays: 1 } },
  { name: "Sick Leave", code: "SICK", description: "Illness or medical appointments", yearlyLimit: 10,
    rules: { minDays: 0.5, maxDays: 15, allowHalfDay: true, maxBackdateDays: 7, requiresDocument: false } },
  { name: "Optional/Paid Leave", code: "OPTIONAL", description: "Optional / paid leave", yearlyLimit: 5,
    rules: { minDays: 1, maxDays: 5, advanceNoticeDays: 3 } },
];

const EMPLOYEES = [
  { name: "Aarav Nair", email: "aarav@example.com", employeeId: "EMP001", department: "Engineering", status: "active" },
  { name: "Diya Menon", email: "diya@example.com", employeeId: "EMP002", department: "Engineering", status: "active" },
  { name: "Kiran Das", email: "kiran@example.com", employeeId: "EMP003", department: "Finance", status: "active" },
  { name: "Meera Pillai", email: "meera@example.com", employeeId: "EMP004", department: "Finance", status: "active" },
  { name: "Rohan Varma", email: "rohan@example.com", employeeId: "EMP005", department: "Engineering", status: "pending" },
  { name: "Sana Iqbal", email: "sana@example.com", employeeId: "EMP006", department: "Finance", status: "pending" },
];

// Offsets are relative to "today" the FIRST time the seed runs (idempotencyKey keeps them stable afterwards).
const REQUESTS = [
  { key: "seed:p1", email: "aarav@example.com", type: "CASUAL", from: 10, to: 11, status: "pending", reason: "Family function" },
  { key: "seed:p2", email: "kiran@example.com", type: "OPTIONAL", from: 20, to: 21, status: "pending", reason: "Festival" },
  { key: "seed:a1", email: "diya@example.com", type: "SICK", from: -30, to: -29, status: "approved", reason: "Fever" },
  { key: "seed:a2", email: "aarav@example.com", type: "CASUAL", from: -1, to: 1, status: "approved", reason: "Personal work" },
  { key: "seed:r1", email: "meera@example.com", type: "CASUAL", from: 15, to: 16, status: "rejected", reason: "Trip", rejectionReason: "Critical month-end closing" },
];

async function main() {
  if (env.isProd && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error("Refusing to seed demo data when NODE_ENV=production (set SEED_ALLOW_PRODUCTION=true to override)");
  }
  await connectDb();
  await assertTransactionSupport();
  const settings = await getSettings();

  const need = (k) => {
    if (!process.env[k]) throw new Error(`Environment variable ${k} is required`);
    return process.env[k];
  };

  const { user: admin } = await bootstrapAdmin({
    name: process.env.SEED_ADMIN_NAME, email: need("SEED_ADMIN_EMAIL"), password: need("SEED_ADMIN_PASSWORD"),
  });

  const upsertUser = async (data, password) => {
    const existing = await User.findOne({ email: data.email });
    if (existing) return existing;
    return User.create({
      phone: "9876543210", joiningDate: new Date("2024-01-15"), ...data, passwordHash: await hashPassword(password),
    });
  };

  const hr = await upsertUser(
    { name: "Helen HR", email: need("SEED_HR_EMAIL"), employeeId: "HR001", department: "Human Resources", role: "hr", status: "active" },
    need("SEED_HR_PASSWORD")
  );
  const employees = {};
  for (const e of EMPLOYEES) employees[e.email] = await upsertUser({ ...e, role: "employee" }, need("SEED_EMPLOYEE_PASSWORD"));

  const types = {};
  for (const t of LEAVE_TYPES) {
    types[t.code] = (await LeaveType.findOne({ code: t.code })) || (await LeaveType.create(t));
  }

  // Balances for the current year (created only if missing).
  const year = currentLeaveYear(settings);
  const active = Object.values(employees).filter((e) => e.status === "active");
  for (const e of active) for (const t of Object.values(types)) await ensureBalance({ employeeId: e._id, leaveType: t, year, settings });

  // Sample requests (created once, identified by idempotencyKey).
  const today = todayFor(settings);
  for (const r of REQUESTS) {
    const emp = employees[r.email];
    if (await LeaveRequest.exists({ employeeId: emp._id, idempotencyKey: r.key })) continue;
    const start = addDays(today, r.from);
    const end = addDays(today, r.to);
    let calc;
    try {
      calc = computeLeave({ leaveType: types[r.type], start, end, isHalfDay: false, settings });
    } catch {
      continue; // e.g. the range fell entirely on a weekend; skip that sample
    }
    await LeaveRequest.create({
      employeeId: emp._id, leaveTypeId: types[r.type]._id, startDate: start, endDate: end,
      days: calc.days, yearBreakdown: calc.byYear, reason: r.reason, status: r.status, idempotencyKey: r.key,
      ...(r.status !== "pending" ? { reviewedBy: hr._id, reviewedAt: new Date() } : {}),
      ...(r.rejectionReason ? { rejectionReason: r.rejectionReason } : {}),
    });
  }

  // Make balances mathematically consistent with approved leave: used = sum(approved days per year).
  for (const e of active) {
    for (const t of Object.values(types)) {
      const approved = await LeaveRequest.find({ employeeId: e._id, leaveTypeId: t._id, status: "approved" }).lean();
      const byYear = new Map();
      for (const a of approved) for (const y of a.yearBreakdown) byYear.set(y.year, (byYear.get(y.year) || 0) + y.days);
      for (const [y, used] of byYear) {
        const bal = await ensureBalance({ employeeId: e._id, leaveType: t, year: y, settings });
        await LeaveBalance.updateOne({ _id: bal._id }, { $set: { used, available: bal.allocated - used } });
      }
    }
  }

  console.log("Seed complete:");
  console.log(`  admin: ${admin.email}`);
  console.log(`  hr:    ${hr.email}`);
  console.log(`  employees: ${EMPLOYEES.map((e) => e.email).join(", ")}`);
  console.log("  (passwords come from SEED_* environment variables)");
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
