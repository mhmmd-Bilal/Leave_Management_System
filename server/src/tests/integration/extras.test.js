import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import AuditLog from "../../models/auditLogModel.js";
import { setCloudinaryForTests } from "../../services/cloudinaryService.js";
import LeaveRequest from "../../models/leaveRequestModel.js";
import { actor, app, createUser, D, isoDaysFromToday, makeLeaveType, request, resetDb, startTestDb, stopTestDb, submit, today } from "./helpers.js";
import { toDateOnly } from "../../utils/dates.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(resetDb);

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const upload = (emp, ltId, buf, filename, contentType) =>
  request(app).post("/api/leaves").set(emp.h)
    .field("leaveTypeId", String(ltId)).field("startDate", D.mon1).field("endDate", D.thu1)
    .field("days", "4").field("reason", "Medical appointment")
    .attach("medicalDocument", buf, { filename, contentType });

// Cloudinary is replaced by an in-memory fake so tests never need real credentials or network.
const cloud = { uploads: [], destroyed: [] };
beforeEach(() => {
  cloud.uploads = [];
  cloud.destroyed = [];
  setCloudinaryForTests({
    upload: async (buffer, { ownerId }) => {
      const publicId = `test/${ownerId}/${cloud.uploads.length + 1}`;
      cloud.uploads.push({ publicId, bytes: buffer.length });
      return { publicId, resourceType: "image", format: buffer.subarray(0, 5).toString() === "%PDF-" ? "pdf" : "png", size: buffer.length };
    },
    destroy: async (doc) => { cloud.destroyed.push(doc.publicId); },
    signedUrl: (doc, expiresAt) => `https://signed.example/${doc.publicId}?exp=${expiresAt}`,
  });
});
afterAll(() => setCloudinaryForTests(undefined));

describe("medical document uploads (Cloudinary)", () => {
  it("accepts a real PDF, uploads it to private cloud storage and hands out signed links only to owner + HR/Admin", async () => {
    const lt = await makeLeaveType();
    const owner = await actor();
    const other = await actor();
    const hr = await actor({ role: "hr" });
    const res = await upload(owner, lt._id, PDF, "report.pdf", "application/pdf");
    expect(res.status).toBe(201);
    const leave = res.body.data.leave;
    expect(leave.medicalDocument.originalName).toBe("report.pdf");
    expect(JSON.stringify(leave)).not.toMatch(/publicId|signed\.example/); // cloud identifiers never leak in normal responses
    expect(cloud.uploads).toHaveLength(1);
    const stored = (await LeaveRequest.findById(leave.id)).medicalDocument;
    expect(stored.publicId).toBe(cloud.uploads[0].publicId);

    const ownerLink = await request(app).get(`/api/leaves/${leave.id}/document`).set(owner.h);
    expect(ownerLink.status).toBe(200);
    expect(ownerLink.body.data.url).toMatch(/^https:\/\/signed\.example\//);
    expect(ownerLink.body.data.expiresInSeconds).toBeGreaterThan(0);
    expect((await request(app).get(`/api/leaves/${leave.id}/document`).set(hr.h)).status).toBe(200);
    expect((await request(app).get(`/api/leaves/${leave.id}/document`).set(other.h)).status).toBe(404);
    expect((await request(app).get(`/api/leaves/${leave.id}/document`)).status).toBe(401);
    expect(await AuditLog.countDocuments({ action: "leave.document_viewed" })).toBe(1);
  });

  it("rejects spoofed content and disallowed types WITHOUT contacting Cloudinary", async () => {
    const lt = await makeLeaveType();
    const emp = await actor();
    expect((await upload(emp, lt._id, Buffer.from("<?php system($_GET['c']); ?>"), "evil.pdf", "application/pdf")).status).toBe(422);
    expect((await upload(emp, lt._id, PDF, "doc.exe", "application/octet-stream")).status).toBe(422);
    expect(cloud.uploads).toHaveLength(0);
    expect(await LeaveRequest.countDocuments({})).toBe(0);
  });

  it("does not upload anything when the request fails validation (e.g. overlap)", async () => {
    const lt = await makeLeaveType();
    const emp = await actor();
    expect((await submit(emp, lt._id, D.mon1, D.thu1, 4)).status).toBe(201);
    expect((await upload(emp, lt._id, PDF, "report.pdf", "application/pdf")).status).toBe(409);
    expect(cloud.uploads).toHaveLength(0);
  });

  it("removes the cloud file if saving the request fails after the upload", async () => {
    const lt = await makeLeaveType();
    const emp = await actor();
    const spy = vi.spyOn(LeaveRequest, "create").mockRejectedValueOnce(new Error("db down"));
    const res = await upload(emp, lt._id, PDF, "report.pdf", "application/pdf");
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(cloud.uploads).toHaveLength(1);
    expect(cloud.destroyed).toEqual([cloud.uploads[0].publicId]);
  });

  it("reports a clear 503 when Cloudinary is not configured (no local fallback)", async () => {
    setCloudinaryForTests(undefined);
    const lt = await makeLeaveType();
    const emp = await actor();
    const res = await upload(emp, lt._id, PDF, "report.pdf", "application/pdf");
    expect(res.status).toBe(503);
    expect(await LeaveRequest.countDocuments({})).toBe(0);
  });

  it("requires the document when the leave type demands it", async () => {
    const lt = await makeLeaveType({ rules: { requiresDocument: true } });
    const emp = await actor();
    expect((await submit(emp, lt._id, D.mon1, D.thu1, 4)).status).toBe(422);
    expect((await upload(emp, lt._id, PDF, "report.pdf", "application/pdf")).status).toBe(201);
  });
});

describe("leave day preview", () => {
  it("returns server-calculated days for the application form", async () => {
    const lt = await makeLeaveType();
    const emp = await actor();
    const res = await request(app).get(`/api/leaves/calculate?leaveTypeId=${lt._id}&startDate=${D.mon1}&endDate=${D.thu1}`).set(emp.h);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ days: 4, yearBreakdown: [{ year: 2025, days: 4 }] });
    expect(res.body.data.balances[0]).toMatchObject({ available: 12, sufficient: true });
  });
});

describe("notifications", () => {
  it("users only see and modify their own notifications; unread count and read-all work", async () => {
    const hr = await actor({ role: "hr" });
    const a = await actor();
    const b = await actor();
    const lt = await makeLeaveType();
    for (const [start, end, days] of [[D.mon1, D.thu1, 4], [D.mon2, D.thu2, 4]]) {
      const id = (await submit(a, lt._id, start, end, days)).body.data.leave.id;
      await request(app).patch(`/api/hr/leaves/${id}/approve`).set(hr.h);
    }
    expect((await request(app).get("/api/notifications/unread-count").set(a.h)).body.data.unread).toBe(2);
    expect((await request(app).get("/api/notifications/unread-count").set(b.h)).body.data.unread).toBe(0);
    const list = await request(app).get("/api/notifications").set(a.h);
    const nid = list.body.data.items[0].id;
    expect((await request(app).patch(`/api/notifications/${nid}/read`).set(b.h)).status).toBe(404); // not yours
    expect((await request(app).patch(`/api/notifications/${nid}/read`).set(a.h)).status).toBe(200);
    expect((await request(app).get("/api/notifications/unread-count").set(a.h)).body.data.unread).toBe(1);
    await request(app).patch("/api/notifications/read-all").set(a.h).expect(200);
    expect((await request(app).get("/api/notifications/unread-count").set(a.h)).body.data.unread).toBe(0);
  });
});

describe("history, dashboard, calendar", () => {
  it("employee history supports filters, sorting and pagination", async () => {
    const emp = await actor();
    const lt1 = await makeLeaveType();
    const lt2 = await makeLeaveType();
    await submit(emp, lt1._id, D.mon1, D.thu1, 4);
    await submit(emp, lt2._id, D.mon2, D.thu2, 4);
    await submit(emp, lt1._id, D.mon3, D.wed3, 3);
    const page = await request(app).get("/api/employees/me/leave-history?limit=2&page=1&sortBy=startDate&order=asc").set(emp.h);
    expect(page.body.data.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(page.body.data.items.map((l) => l.startDate)).toEqual([D.mon1, D.mon2]);
    const byType = await request(app).get(`/api/leaves/my?leaveTypeId=${lt1._id}`).set(emp.h);
    expect(byType.body.data.pagination.total).toBe(2);
    const byRange = await request(app).get(`/api/leaves/my?startDate=${D.mon2}&endDate=${D.thu2}`).set(emp.h);
    expect(byRange.body.data.items).toHaveLength(1);
    expect((await request(app).get("/api/leaves/my?status=bogus").set(emp.h)).status).toBe(422);
    expect((await request(app).get("/api/leaves/my?limit=1000").set(emp.h)).status).toBe(422);
  });

  it("HR lists/filters all requests by employee, department, status; dashboard numbers come from the database", async () => {
    const hr = await actor({ role: "hr" });
    const eng = await actor({ department: "Engineering" });
    const fin = await actor({ department: "Finance" });
    await createUser({ status: "pending" });
    const lt = await makeLeaveType();
    const a = (await submit(eng, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    await submit(fin, lt._id, D.mon2, D.thu2, 4);
    await request(app).patch(`/api/hr/leaves/${a}/approve`).set(hr.h);
    // an approved leave covering today
    await LeaveRequest.create({
      employeeId: fin.user._id, leaveTypeId: lt._id, startDate: new Date(today().getTime() - 86400000), endDate: new Date(today().getTime() + 86400000),
      days: 3, reason: "On leave now", status: "approved", yearBreakdown: [],
    });
    const all = await request(app).get("/api/hr/leaves").set(hr.h);
    expect(all.body.data.pagination.total).toBe(3);
    expect((await request(app).get("/api/hr/leaves?department=finance").set(hr.h)).body.data.pagination.total).toBe(2);
    expect((await request(app).get(`/api/hr/leaves?employeeId=${eng.user._id}&status=approved`).set(hr.h)).body.data.pagination.total).toBe(1);
    const dash = (await request(app).get("/api/hr/dashboard").set(hr.h)).body.data;
    expect(dash).toMatchObject({ totalEmployees: 2, pendingRegistrations: 1, pendingLeaveRequests: 1, approvedLeaveRequests: 2, rejectedLeaveRequests: 0, employeesOnLeave: 1 });
  });

  it("calendar returns approved leave only, hides reasons, and applies visibility rules", async () => {
    const hr = await actor({ role: "hr" });
    const a = await actor({ department: "Engineering" });
    const b = await actor({ department: "Engineering" });
    const c = await actor({ department: "Finance" });
    const lt = await makeLeaveType();
    for (const emp of [a, c]) {
      const id = (await submit(emp, lt._id, D.mon1, D.thu1, 4, { reason: "SECRET REASON" })).body.data.leave.id;
      await request(app).patch(`/api/hr/leaves/${id}/approve`).set(hr.h);
    }
    await submit(b, lt._id, D.mon2, D.thu2, 4); // pending => never in the calendar
    const hrCal = await request(app).get("/api/calendar/leaves?month=3&year=2025").set(hr.h);
    expect(hrCal.body.data.events).toHaveLength(2);
    expect(hrCal.body.data.events[0]).toMatchObject({ startDate: D.mon1, endDate: D.thu1, days: 4 });
    expect(JSON.stringify(hrCal.body)).not.toMatch(/SECRET REASON|medicalDocument/);
    const finOnly = await request(app).get("/api/calendar/leaves?from=2025-03-01&to=2025-03-31&department=Finance").set(hr.h);
    expect(finOnly.body.data.events).toHaveLength(1);
    const empCal = await request(app).get("/api/calendar/leaves?month=3&year=2025&department=Finance").set(b.h);
    expect(empCal.body.data.events).toHaveLength(1); // department param ignored: own department only
    expect(empCal.body.data.events[0].employee.name).toBe(a.user.name);
    expect(empCal.body.data.events[0].leaveType).toBeNull(); // colleague's leave type stays private
    expect((await request(app).get("/api/calendar/leaves").set(b.h)).status).toBe(422);
  });
});

describe("reports and CSV export", () => {
  async function seedReportData() {
    const hr = await actor({ role: "hr" });
    const emp = await actor({ name: "=HYPERLINK(\"http://evil\")", department: "Engineering" });
    const lt = await makeLeaveType({ name: "Casual, Leave" });
    const a = (await submit(emp, lt._id, D.mon1, D.thu1, 4)).body.data.leave.id;
    await request(app).patch(`/api/hr/leaves/${a}/approve`).set(hr.h);
    await submit(emp, lt._id, D.mon2, D.thu2, 4);
    return { hr, emp, lt };
  }

  it("JSON reports use real data and honour filters", async () => {
    const { hr, emp, lt } = await seedReportData();
    const monthly = await request(app).get("/api/reports/monthly?year=2025").set(hr.h);
    expect(monthly.body.data.rows).toEqual([expect.objectContaining({ period: "2025-03", totalRequests: 2, approved: 1, pending: 1, approvedDays: 4 })]);
    const byEmp = await request(app).get(`/api/reports/employees?year=2025&employeeId=${emp.user._id}`).set(hr.h);
    expect(byEmp.body.data.rows[0]).toMatchObject({ totalRequests: 2, approvedDays: 4 });
    const byDept = await request(app).get("/api/reports/departments?year=2025&department=engineering").set(hr.h);
    expect(byDept.body.data.rows[0]).toMatchObject({ department: "Engineering", employeesWithLeave: 1 });
    const annual = await request(app).get("/api/reports/annual?year=2025").set(hr.h);
    expect(annual.body.data.rows.at(-1)).toMatchObject({ leaveType: "TOTAL", totalRequests: 2 });
    const types = await request(app).get(`/api/reports/leave-types?year=2025&leaveTypeId=${lt._id}&status=approved`).set(hr.h);
    expect(types.body.data.rows[0].totalRequests).toBe(1);
    const status = await request(app).get("/api/reports/status-summary?year=2025").set(hr.h);
    expect(status.body.data.rows.map((r) => r.status)).toEqual(["approved", "pending"]);
    const bal = await request(app).get("/api/reports/balances?year=2025").set(hr.h);
    expect(bal.body.data.rows[0]).toMatchObject({ allocated: 12, used: 4, available: 8 });
    expect((await request(app).get("/api/reports/monthly?from=2025-05-01&to=2025-04-01").set(hr.h)).status).toBe(422);
  });

  it("CSV export: headers, content type, escaping and formula-injection protection", async () => {
    const { hr } = await seedReportData();
    const res = await request(app).get("/api/reports/export/csv?report=employees&year=2025").set(hr.h);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="leave-report-employees-\d{4}-\d{2}-\d{2}\.csv"/);
    const lines = res.text.replace(/^\uFEFF/, "").split("\r\n");
    expect(lines[0]).toBe("Employee ID,Name,Department,Total Requests,Pending,Approved,Rejected,Cancelled,Approved Days,Requested Days");
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil"")"`); // neutralised formula, quotes escaped
    const types = await request(app).get("/api/reports/export/csv?report=leave-types&year=2025").set(hr.h);
    expect(types.text).toContain('"Casual, Leave"'); // comma escaped
    expect((await request(app).get("/api/reports/export/csv?report=nope").set(hr.h)).status).toBe(422);
    expect((await request(app).get("/api/reports/export/csv?report=monthly")).status).toBe(401);
  });
});
