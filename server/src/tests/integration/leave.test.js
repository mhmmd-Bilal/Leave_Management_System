import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import AuditLog from "../../models/auditLogModel.js";
import EmailOutbox from "../../models/emailOutboxModel.js";
import LeaveBalance from "../../models/leaveBalanceModel.js";
import LeaveRequest from "../../models/leaveRequestModel.js";
import Notification from "../../models/notificationModel.js";
import SystemSetting from "../../models/systemSettingModel.js";
import User from "../../models/userModel.js";
import { processOutbox, setTransportForTests } from "../../services/emailService.js";
import { actor, app, D, isoDaysFromToday, makeLeaveType, request, resetDb, startTestDb, stopTestDb, submit } from "./helpers.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(resetDb);

const balanceOf = (userId, ltId, year = 2025) => LeaveBalance.findOne({ employeeId: userId, leaveTypeId: ltId, year });
const approve = (hr, id) => request(app).patch(`/api/hr/leaves/${id}/approve`).set(hr.h);
const reject = (hr, id, reason) => request(app).patch(`/api/hr/leaves/${id}/reject`).set(hr.h).send({ reason });

async function setup(limit = 12, rules = {}) {
  const lt = await makeLeaveType({ yearlyLimit: limit, rules });
  const emp = await actor();
  const hr = await actor({ role: "hr" });
  return { lt, emp, hr };
}

describe("leave submission", () => {
  it("creates a pending request and does NOT deduct the balance", async () => {
    const { lt, emp } = await setup();
    const res = await submit(emp, lt._id, D.mon1, D.thu1, 4);
    expect(res.status).toBe(201);
    expect(res.body.data.leave.status).toBe("pending");
    expect(res.body.data.leave.days).toBe(4);
    const bal = await balanceOf(emp.user._id, lt._id);
    expect(bal.used).toBe(0);
    expect(bal.available).toBe(12);
  });

  it("calculates days on the server and rejects a manipulated day count", async () => {
    const { lt, emp } = await setup();
    const res = await submit(emp, lt._id, D.mon1, D.thu1, 1);
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/calculated eligible leave days \(4\)/);
  });

  it("excludes weekends from the count and rejects weekend-only requests", async () => {
    const { lt, emp } = await setup();
    expect((await submit(emp, lt._id, D.mon1, "2025-03-09", 5)).status).toBe(201); // Mon-Sun => 5 working days
    expect((await submit(emp, lt._id, D.sat, D.sun, 2)).status).toBe(422);
  });

  it("rejects invalid dates, unknown and inactive leave types", async () => {
    const { lt, emp } = await setup();
    expect((await submit(emp, lt._id, D.thu1, D.mon1, 1)).status).toBe(422); // end before start
    expect((await submit(emp, lt._id, "2025-02-30", D.mon1, 1)).status).toBe(422);
    expect((await submit(emp, "64b000000000000000000000", D.mon1, D.thu1, 4)).status).toBe(404);
    const inactive = await makeLeaveType({ active: false });
    expect((await submit(emp, inactive._id, D.mon1, D.thu1, 4)).status).toBe(422);
  });

  it("rejects insufficient balance and overlapping requests", async () => {
    const { lt, emp } = await setup(3);
    expect((await submit(emp, lt._id, D.mon1, D.thu1, 4)).status).toBe(409);
    expect((await submit(emp, lt._id, D.mon1, D.mon1, 1)).status).toBe(201);
    const overlap = await submit(emp, lt._id, D.mon1, D.mon1, 1);
    expect(overlap.status).toBe(409);
    expect(overlap.body.message).toMatch(/overlapping/);
  });

  it("enforces half-day, document and duration rules from the leave type", async () => {
    const half = await makeLeaveType({ rules: { allowHalfDay: true } });
    const noHalf = await makeLeaveType();
    const doc = await makeLeaveType({ rules: { requiresDocument: true } });
    const short = await makeLeaveType({ rules: { maxDays: 2 } });
    const emp = await actor();
    expect((await submit(emp, half._id, D.mon1, D.mon1, 0.5, { isHalfDay: true })).status).toBe(201);
    expect((await submit(emp, noHalf._id, D.mon2, D.mon2, 0.5, { isHalfDay: true })).status).toBe(422);
    expect((await submit(emp, doc._id, D.mon3, D.wed3, 3)).status).toBe(422); // missing document
    expect((await submit(emp, short._id, D.mon3, D.wed3, 3)).status).toBe(422); // above max
  });

  it("applies holidays from system settings", async () => {
    const { lt, emp } = await setup();
    await request(app).get("/api/health"); // no-op; settings are created lazily below
    await SystemSetting.findOneAndUpdate({ key: "global" }, { $set: { holidays: [{ date: new Date("2025-03-05T00:00:00Z"), name: "Test Holiday" }] } }, { upsert: true });
    expect((await submit(emp, lt._id, D.mon1, D.thu1, 4)).status).toBe(422); // Wed is a holiday => 3 days
    expect((await submit(emp, lt._id, D.mon1, D.thu1, 3)).status).toBe(201);
  });

  it("enforces advance-notice / back-dating windows using relative dates", async () => {
    const strict = await makeLeaveType({ rules: { maxBackdateDays: 0, advanceNoticeDays: 0 } });
    const emp = await actor();
    expect((await submit(emp, strict._id, isoDaysFromToday(-60), isoDaysFromToday(-60), 1)).status).toBe(422);
  });

  it("is idempotent when the same Idempotency-Key is replayed", async () => {
    const { lt, emp } = await setup();
    const send = () => request(app).post("/api/leaves").set(emp.h).set("Idempotency-Key", "abc-123").send({ leaveTypeId: String(lt._id), startDate: D.mon1, endDate: D.thu1, days: 4, reason: "Trip" });
    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.leave.id).toBe(first.body.data.leave.id);
    expect(await LeaveRequest.countDocuments({})).toBe(1);
  });

  it("splits a request spanning two years across both balances (documented policy)", async () => {
    const lt = await makeLeaveType({ yearlyLimit: 10, rules: { countWeekends: true } });
    await SystemSetting.findOneAndUpdate({ key: "global" }, { $set: { workingDays: [0, 1, 2, 3, 4, 5, 6] } }, { upsert: true });
    const emp = await actor();
    const hr = await actor({ role: "hr" });
    const res = await submit(emp, lt._id, "2025-12-30", "2026-01-03", 5);
    expect(res.status).toBe(201);
    expect(res.body.data.leave.yearBreakdown).toEqual([{ year: 2025, days: 2 }, { year: 2026, days: 3 }]);
    expect((await approve(hr, res.body.data.leave.id)).status).toBe(200);
    expect((await balanceOf(emp.user._id, lt._id, 2025)).used).toBe(2);
    expect((await balanceOf(emp.user._id, lt._id, 2026)).used).toBe(3);
  });
});

describe("approval workflow", () => {
  it("approval deducts exactly the approved days, writes audit + notification + email outbox", async () => {
    const { lt, emp, hr } = await setup();
    const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    const res = await approve(hr, id);
    expect(res.status).toBe(200);
    expect(res.body.data.leave.status).toBe("approved");
    const bal = await balanceOf(emp.user._id, lt._id);
    expect([bal.used, bal.available]).toEqual([4, 8]);
    const stored = await LeaveRequest.findById(id);
    expect(String(stored.reviewedBy)).toBe(String(hr.user._id));
    expect(stored.reviewedAt).toBeTruthy();
    expect(await AuditLog.countDocuments({ action: "leave.approved", targetId: id })).toBe(1);
    expect(await Notification.countDocuments({ recipientId: emp.user._id, type: "leave_approved" })).toBe(1);
    expect(await EmailOutbox.countDocuments({ to: emp.user.email })).toBe(1);
  });

  it("a duplicate approval is rejected and never deducts twice", async () => {
    const { lt, emp, hr } = await setup();
    const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    expect((await approve(hr, id)).status).toBe(200);
    expect((await approve(hr, id)).status).toBe(409);
    expect((await balanceOf(emp.user._id, lt._id)).used).toBe(4);
  });

  it("two HR users approving the SAME request at once: one wins, balance deducted once", async () => {
    const { lt, emp, hr } = await setup();
    const hr2 = await actor({ role: "hr" });
    const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    const results = await Promise.all([approve(hr, id), approve(hr2, id)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await balanceOf(emp.user._id, lt._id)).used).toBe(4);
  });

  it("concurrent approvals of two requests that together exceed the balance cannot overspend", async () => {
    const { lt, emp, hr } = await setup(5); // 5 days available, two requests of 4 days each
    const hr2 = await actor({ role: "hr" });
    const r1 = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    const r2 = (await submit(emp, lt._id, D.mon2, D.thu2, 4)).body.data.leave.id;
    const results = await Promise.all([approve(hr, r1), approve(hr2, r2)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const bal = await balanceOf(emp.user._id, lt._id);
    expect(bal.used).toBe(4);
    expect(bal.available).toBe(1);
    expect(await LeaveRequest.countDocuments({ status: "approved" })).toBe(1);
    expect(await LeaveRequest.countDocuments({ status: "pending" })).toBe(1); // loser stays pending
  });

  it("approval fails when the balance was reduced after submission", async () => {
    const { lt, emp, hr } = await setup(5);
    const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    await LeaveBalance.updateOne({ employeeId: emp.user._id, leaveTypeId: lt._id }, { $set: { available: 2, allocated: 2, baseAllocation: 2 } });
    const res = await approve(hr, id);
    expect(res.status).toBe(409);
    expect((await LeaveRequest.findById(id)).status).toBe("pending"); // transaction rolled back
  });

  it("cannot approve for a disabled employee (and rolls back)", async () => {
    const { lt, emp, hr } = await setup();
    const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    await User.updateOne({ _id: emp.user._id }, { status: "disabled" });
    expect((await approve(hr, id)).status).toBe(409);
    expect((await LeaveRequest.findById(id)).status).toBe("pending");
    expect((await reject(hr, id, "Account disabled")).status).toBe(200); // HR can still reject it
  });

  it("a leave type deactivated while requests are pending does not block review", async () => {
    const { lt, emp, hr } = await setup();
    const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    lt.active = false;
    await lt.save();
    expect((await approve(hr, id)).status).toBe(200);
  });

  it("approval is blocked when the calendar policy changed after submission", async () => {
    const { lt, emp, hr } = await setup();
    const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    await SystemSetting.findOneAndUpdate({ key: "global" }, { $set: { holidays: [{ date: new Date("2025-03-04T00:00:00Z"), name: "New holiday" }] } });
    const res = await approve(hr, id);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/changed/);
    expect((await balanceOf(emp.user._id, lt._id)).used).toBe(0);
  });
});

describe("rejection, cancellation and status transitions", () => {
  it("rejection stores the reason, does not deduct, notifies and audits", async () => {
    const { lt, emp, hr } = await setup();
    const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    const res = await reject(hr, id, "Project deadline");
    expect(res.status).toBe(200);
    expect(res.body.data.leave.rejectionReason).toBe("Project deadline");
    expect((await balanceOf(emp.user._id, lt._id)).used).toBe(0);
    expect(await Notification.countDocuments({ type: "leave_rejected", recipientId: emp.user._id })).toBe(1);
    expect(await AuditLog.countDocuments({ action: "leave.rejected" })).toBe(1);
  });

  it("cancelling a pending request does not touch the balance; other states cannot be cancelled", async () => {
    const { lt, emp, hr } = await setup();
    const pending = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    expect((await request(app).patch(`/api/leaves/${pending}/cancel`).set(emp.h)).status).toBe(200);
    expect((await balanceOf(emp.user._id, lt._id)).used).toBe(0);
    expect((await request(app).patch(`/api/leaves/${pending}/cancel`).set(emp.h)).status).toBe(409); // already cancelled
    expect(await AuditLog.countDocuments({ action: "leave.cancelled" })).toBe(1);

    const approved = (await submit(emp, lt._id, D.mon2, D.thu2, 4)).body.data.leave.id;
    await approve(hr, approved);
    expect((await request(app).patch(`/api/leaves/${approved}/cancel`).set(emp.h)).status).toBe(409);
    expect((await balanceOf(emp.user._id, lt._id)).used).toBe(4); // no refund

    const rejected = (await submit(emp, lt._id, D.mon3, D.wed3, 3)).body.data.leave.id;
    await reject(hr, rejected);
    expect((await request(app).patch(`/api/leaves/${rejected}/cancel`).set(emp.h)).status).toBe(409);
  });

  it("only pending requests can move to approved/rejected (invalid transitions => 409)", async () => {
    const { lt, emp, hr } = await setup();
    const a = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    await approve(hr, a);
    expect((await reject(hr, a)).status).toBe(409); // approved -> rejected
    const b = (await submit(emp, lt._id, D.mon2, D.thu2, 4)).body.data.leave.id;
    await reject(hr, b);
    expect((await approve(hr, b)).status).toBe(409); // rejected -> approved
    const c = (await submit(emp, lt._id, D.mon3, D.wed3, 3)).body.data.leave.id;
    await request(app).patch(`/api/leaves/${c}/cancel`).set(emp.h);
    expect((await approve(hr, c)).status).toBe(409); // cancelled -> approved
  });

  it("cancel vs approve race: exactly one wins and balance matches the outcome", async () => {
    const { lt, emp, hr } = await setup();
    const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    const [c, a] = await Promise.all([request(app).patch(`/api/leaves/${id}/cancel`).set(emp.h), approve(hr, id)]);
    expect([c.status, a.status].sort()).toEqual([200, 409]);
    const bal = await balanceOf(emp.user._id, lt._id);
    expect(bal.used).toBe(a.status === 200 ? 4 : 0);
  });
});

describe("email outbox", () => {
  it("delivers queued mail after commit and a failing SMTP never affects the approval", async () => {
    const { lt, emp, hr } = await setup();
    const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    setTransportForTests({ sendMail: async () => { throw new Error("SMTP down"); } });
    expect((await approve(hr, id)).status).toBe(200); // approval unaffected
    const failed = await processOutbox();
    expect(failed.retried + failed.failed).toBe(1);
    expect((await EmailOutbox.findOne({})).status).toBe("pending"); // will be retried
    const sent = [];
    setTransportForTests({ sendMail: async (m) => { sent.push(m); return {}; } });
    await EmailOutbox.updateMany({}, { nextAttemptAt: new Date(0) });
    expect((await processOutbox()).sent).toBe(1);
    expect(sent[0].to).toBe(emp.user.email);
    setTransportForTests(undefined);
  });
});

describe("joining date rule (written, requires MongoDB - not executed in the sandbox)", () => {
  it("rejects leave that starts before the employee's joining date", async () => {
    const { lt, emp } = await setup(); // helpers create employees with joiningDate 2024-01-15
    const res = await submit(emp, lt._id, "2023-12-04", "2023-12-05", 2); // Mon-Tue in 2023
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/joining date/i);
    expect(await LeaveRequest.countDocuments({ employeeId: emp.user._id })).toBe(0);
  });
});
