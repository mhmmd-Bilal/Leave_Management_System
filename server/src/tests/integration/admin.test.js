import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import AuditLog from "../../models/auditLogModel.js";
import LeaveBalance from "../../models/leaveBalanceModel.js";
import LeaveType from "../../models/leaveTypeModel.js";
import Notification from "../../models/notificationModel.js";
import User from "../../models/userModel.js";
import { actor, app, createUser, D, makeLeaveType, PASSWORD, request, resetDb, startTestDb, stopTestDb, submit } from "./helpers.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(resetDb);

const hrBody = (over = {}) => ({
  name: "Harini HR", email: "harini@example.com", phone: "9876543210", password: PASSWORD,
  employeeId: "HR-9", department: "Human Resources", joiningDate: "2023-01-01", ...over,
});

describe("registration review (HR/Admin)", () => {
  it("HR approves a pending registration: account becomes active, employee is notified and can log in", async () => {
    const hr = await actor({ role: "hr" });
    const pending = await createUser({ status: "pending" });
    const list = await request(app).get("/api/hr/registrations/pending").set(hr.h);
    expect(list.body.data.items.map((u) => u.id)).toContain(String(pending._id));
    const res = await request(app).patch(`/api/hr/employees/${pending._id}/approve`).set(hr.h);
    expect(res.status).toBe(200);
    expect((await User.findById(pending._id)).status).toBe("active");
    expect(await Notification.countDocuments({ recipientId: pending._id, type: "account_approved" })).toBe(1);
    expect(await AuditLog.countDocuments({ action: "registration.approved" })).toBe(1);
    expect((await request(app).post("/api/auth/login").send({ email: pending.email, password: PASSWORD })).status).toBe(200);
    // approving twice is a conflict
    expect((await request(app).patch(`/api/hr/employees/${pending._id}/approve`).set(hr.h)).status).toBe(409);
  });

  it("HR rejects with a reason; rejected list shows it; rejected user cannot log in", async () => {
    const hr = await actor({ role: "hr" });
    const pending = await createUser({ status: "pending" });
    const res = await request(app).patch(`/api/hr/employees/${pending._id}/reject`).set(hr.h).send({ reason: "Unknown employee" });
    expect(res.status).toBe(200);
    const rejected = await request(app).get("/api/hr/registrations/rejected").set(hr.h);
    expect(rejected.body.data.items[0].statusReason).toBe("Unknown employee");
    expect((await request(app).post("/api/auth/login").send({ email: pending.email, password: PASSWORD })).status).toBe(403);
    expect(await Notification.countDocuments({ type: "account_rejected" })).toBe(1);
  });
});

describe("admin: HR accounts and employee status", () => {
  it("admin creates, updates and disables/reactivates an HR account; disabled HR loses access at once", async () => {
    const admin = await actor({ role: "admin" });
    const created = await request(app).post("/api/admin/hr").set(admin.h).send(hrBody());
    expect(created.status).toBe(201);
    expect(created.body.data.user.role).toBe("hr");
    expect(created.body.data.user.status).toBe("active");
    const hrId = created.body.data.user.id;

    const login = await request(app).post("/api/auth/login").send({ email: "harini@example.com", password: PASSWORD });
    const hrHeaders = { Authorization: `Bearer ${login.body.data.token}` };
    expect((await request(app).get("/api/hr/dashboard").set(hrHeaders)).status).toBe(200);

    expect((await request(app).patch(`/api/admin/hr/${hrId}`).set(admin.h).send({ department: "People Ops" })).body.data.user.department).toBe("People Ops");
    expect((await request(app).patch(`/api/admin/hr/${hrId}/status`).set(admin.h).send({ status: "disabled", reason: "Left team" })).status).toBe(200);
    expect((await request(app).get("/api/hr/dashboard").set(hrHeaders)).status).toBe(401); // old token revoked
    expect((await request(app).post("/api/auth/login").send({ email: "harini@example.com", password: PASSWORD })).status).toBe(403);
    expect((await request(app).patch(`/api/admin/hr/${hrId}/status`).set(admin.h).send({ status: "active" })).status).toBe(200);
    expect((await request(app).post("/api/auth/login").send({ email: "harini@example.com", password: PASSWORD })).status).toBe(200);
    expect(await AuditLog.countDocuments({ action: { $in: ["user.hr_created", "user.status_changed"] } })).toBe(3);
  });

  it("duplicate HR email/employee id => 409; relieved accounts cannot be reactivated", async () => {
    const admin = await actor({ role: "admin" });
    await request(app).post("/api/admin/hr").set(admin.h).send(hrBody());
    expect((await request(app).post("/api/admin/hr").set(admin.h).send(hrBody({ employeeId: "HR-10" }))).status).toBe(409);
    const emp = await createUser();
    expect((await request(app).patch(`/api/admin/employees/${emp._id}/status`).set(admin.h).send({ status: "relieved" })).status).toBe(200);
    expect((await request(app).patch(`/api/admin/employees/${emp._id}/status`).set(admin.h).send({ status: "active" })).status).toBe(409);
  });

  it("admin lists/searches/filters employees with pagination metadata", async () => {
    const admin = await actor({ role: "admin" });
    for (let i = 0; i < 5; i += 1) await createUser({ department: i < 3 ? "Finance" : "Engineering" });
    const res = await request(app).get("/api/admin/employees?department=finance&limit=2&page=1").set(admin.h);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    const page2 = await request(app).get("/api/admin/employees?department=finance&limit=2&page=2").set(admin.h);
    expect(page2.body.data.items).toHaveLength(1);
    // operator-style query keys are not parsed into objects and unknown keys are stripped
    const inj = await request(app).get("/api/admin/employees?search[$ne]=x&status[$ne]=active").set(admin.h);
    expect(inj.status).toBe(200);
    expect(inj.body.data.pagination.total).toBe(5);
    expect((await request(app).get("/api/admin/employees?status=%7B%22%24ne%22%3A%22x%22%7D").set(admin.h)).status).toBe(422);
  });
});

describe("leave types, settings and balances", () => {
  it("admin creates, updates and deactivates leave types; employees only see active ones", async () => {
    const admin = await actor({ role: "admin" });
    const emp = await actor();
    const created = await request(app).post("/api/leave-types").set(admin.h).send({
      name: "Study Leave", code: "study", yearlyLimit: 6, rules: { allowHalfDay: true, requiresDocument: true, maxDays: 3 },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.leaveType.code).toBe("STUDY");
    const id = created.body.data.leaveType.id;
    expect((await request(app).post("/api/leave-types").set(emp.h).send({ name: "X", code: "XX", yearlyLimit: 1 })).status).toBe(403);
    const upd = await request(app).patch(`/api/leave-types/${id}`).set(admin.h).send({ yearlyLimit: 8, rules: { maxDays: 4 } });
    expect(upd.body.data.leaveType.yearlyLimit).toBe(8);
    expect(upd.body.data.leaveType.rules.maxDays).toBe(4);
    expect(upd.body.data.leaveType.rules.allowHalfDay).toBe(true); // untouched rule preserved
    await request(app).patch(`/api/leave-types/${id}/status`).set(admin.h).send({ active: false }).expect(200);
    const empList = await request(app).get("/api/leave-types").set(emp.h);
    expect(empList.body.data.leaveTypes.map((t) => t.code)).not.toContain("STUDY");
    expect((await request(app).get(`/api/leave-types/${id}`).set(emp.h)).status).toBe(404);
    const adminList = await request(app).get("/api/leave-types?includeInactive=true").set(admin.h);
    expect(adminList.body.data.leaveTypes.map((t) => t.code)).toContain("STUDY");
    expect(await AuditLog.countDocuments({ action: { $regex: "^leave_type\\." } })).toBe(3);
  });

  it("HR adjusts a balance with a mandatory reason; history, audit and notification are recorded", async () => {
    const hr = await actor({ role: "hr" });
    const emp = await actor();
    const lt = await makeLeaveType({ yearlyLimit: 10 });
    const url = `/api/hr/balances/${emp.user._id}/adjust`;
    const body = { leaveTypeId: String(lt._id), year: 2025, delta: 2 };
    expect((await request(app).patch(url).set(hr.h).send(body)).status).toBe(422); // no reason
    const ok = await request(app).patch(url).set(hr.h).send({ ...body, reason: "Carry forward from last year" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.balance).toMatchObject({ baseAllocation: 10, adjustment: 2, allocated: 12, used: 0, available: 12 });
    expect((await request(app).patch(url).set(hr.h).send({ ...body, delta: -20, reason: "Too much deduction" })).status).toBe(409);
    expect((await request(app).patch(url).set(emp.h).send({ ...body, reason: "I want more leave" })).status).toBe(403);
    const hist = await request(app).get(`/api/hr/balances/${emp.user._id}/adjustments`).set(hr.h);
    expect(hist.body.data.items).toHaveLength(1);
    expect(await AuditLog.countDocuments({ action: "balance.adjusted" })).toBe(1);
    expect(await Notification.countDocuments({ type: "balance_adjusted", recipientId: emp.user._id })).toBe(1);
    const view = await request(app).get(`/api/hr/balances/${emp.user._id}?year=2025`).set(hr.h);
    expect(view.body.data.balances[0].available).toBe(12);
  });

  it("concurrent manual adjustment and approval keep available = allocated - used and never go negative", async () => {
    const hr = await actor({ role: "hr" });
    const emp = await actor();
    const lt = await makeLeaveType({ yearlyLimit: 4 });
    const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    const [adj, appr] = await Promise.all([
      request(app).patch(`/api/hr/balances/${emp.user._id}/adjust`).set(hr.h).send({ leaveTypeId: String(lt._id), year: 2025, delta: -2, reason: "Policy correction" }),
      request(app).patch(`/api/hr/leaves/${id}/approve`).set(hr.h),
    ]);
    expect([adj.status, appr.status].filter((s) => s === 200)).toHaveLength(1); // exactly one can succeed
    const b = await LeaveBalance.findOne({ employeeId: emp.user._id, leaveTypeId: lt._id, year: 2025 });
    expect(b.available).toBe(b.allocated - b.used);
    expect(b.available).toBeGreaterThanOrEqual(0);
  });

  it("yearly initialisation is idempotent and never overwrites usage", async () => {
    const admin = await actor({ role: "admin" });
    const hr = await actor({ role: "hr" });
    const e1 = await actor();
    await createUser({ status: "pending" }); // not eligible
    const lt = await makeLeaveType({ yearlyLimit: 10 });
    const init = () => request(app).post("/api/admin/balances/initialize").set(admin.h).send({ year: 2025, leaveTypeIds: [String(lt._id)] });
    const first = await init();
    expect(first.body.data.created).toBe(1);
    const second = await init();
    expect(second.body.data).toMatchObject({ created: 0, existing: 1 });
    expect(await LeaveBalance.countDocuments({ leaveTypeId: lt._id, year: 2025 })).toBe(1);

    // use 4 days, then raise the policy to 15 and sync existing balances
    const id = (await submit(e1, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    await request(app).patch(`/api/hr/leaves/${id}/approve`).set(hr.h);
    await LeaveType.updateOne({ _id: lt._id }, { yearlyLimit: 15 });
    const sync = await request(app).post("/api/admin/balances/initialize").set(admin.h).send({ year: 2025, leaveTypeIds: [String(lt._id)], updateExisting: true });
    expect(sync.body.data.updated).toBe(1);
    const b = await LeaveBalance.findOne({ employeeId: e1.user._id, leaveTypeId: lt._id, year: 2025 });
    expect([b.baseAllocation, b.used, b.available]).toEqual([15, 4, 11]);
  });

  it("settings are validated, persisted and audited", async () => {
    const admin = await actor({ role: "admin" });
    const bad = await request(app).patch("/api/admin/settings").set(admin.h).send({ workingDays: [1, 9] });
    expect(bad.status).toBe(422);
    const ok = await request(app).patch("/api/admin/settings").set(admin.h).send({
      workingDays: [1, 2, 3, 4, 5, 6], holidays: [{ date: "2025-12-25", name: "Christmas" }], timezone: "Asia/Kolkata",
    });
    expect(ok.status).toBe(200);
    const get = await request(app).get("/api/admin/settings").set(admin.h);
    expect(get.body.data.settings.weekendDays).toEqual([0]);
    expect(get.body.data.settings.holidays).toEqual([{ date: "2025-12-25", name: "Christmas" }]);
    expect(await AuditLog.countDocuments({ action: "settings.updated" })).toBe(1);
  });

  it("audit logs: admin can filter and paginate; HR sees only HR-relevant actions; records are immutable", async () => {
    const admin = await actor({ role: "admin" });
    const hr = await actor({ role: "hr" });
    await request(app).post("/api/admin/hr").set(admin.h).send(hrBody());
    await request(app).patch("/api/admin/settings").set(admin.h).send({ workingDays: [1, 2, 3, 4, 5] });
    const all = await request(app).get("/api/admin/audit-logs?limit=1").set(admin.h);
    expect(all.body.data.pagination.total).toBeGreaterThanOrEqual(2);
    const filtered = await request(app).get("/api/admin/audit-logs?action=settings.updated").set(admin.h);
    expect(filtered.body.data.items.every((a) => a.action === "settings.updated")).toBe(true);
    const hrView = await request(app).get("/api/hr/audit-logs").set(hr.h);
    expect(hrView.body.data.items.every((a) => /^(leave|balance|registration)\./.test(a.action))).toBe(true);
    await expect(AuditLog.updateOne({}, { action: "tampered" })).rejects.toThrow(/immutable/i);
    await expect(AuditLog.deleteMany({})).rejects.toThrow(/immutable/i);
  });
});
