import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import User from "../../models/userModel.js";
import { actor, app, createUser, D, makeLeaveType, request, resetDb, startTestDb, stopTestDb, submit } from "./helpers.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(resetDb);

describe("role-based access control", () => {
  it("employees cannot reach HR or admin routes", async () => {
    const emp = await actor();
    for (const url of ["/api/hr/dashboard", "/api/hr/employees", "/api/hr/leaves", "/api/reports/monthly", "/api/reports/export/csv?report=monthly"]) {
      expect((await request(app).get(url).set(emp.h)).status, url).toBe(403);
    }
    for (const url of ["/api/admin/employees", "/api/admin/hr", "/api/admin/settings", "/api/admin/audit-logs"]) {
      expect((await request(app).get(url).set(emp.h)).status, url).toBe(403);
    }
  });

  it("HR cannot use admin routes or create/modify admin accounts", async () => {
    const hr = await actor({ role: "hr" });
    const admin = await createUser({ role: "admin" });
    expect((await request(app).get("/api/admin/hr").set(hr.h)).status).toBe(403);
    expect((await request(app).post("/api/admin/hr").set(hr.h).send({})).status).toBe(403);
    expect((await request(app).patch(`/api/admin/admins/${admin._id}/status`).set(hr.h).send({ status: "disabled" })).status).toBe(403);
    // HR employee-review endpoints only ever touch employees: an admin id looks like "not found"
    expect((await request(app).patch(`/api/hr/employees/${admin._id}/approve`).set(hr.h)).status).toBe(404);
    expect((await User.findById(admin._id)).status).toBe("active");
  });

  it("admins may use HR routes", async () => {
    const admin = await actor({ role: "admin" });
    expect((await request(app).get("/api/hr/dashboard").set(admin.h)).status).toBe(200);
  });

  it("only employees can apply for leave", async () => {
    const hr = await actor({ role: "hr" });
    const lt = await makeLeaveType();
    expect((await submit(hr, lt._id, D.mon1, D.thu1, 4)).status).toBe(403);
  });

  it("an employee cannot read or cancel another employee's leave (looks like 404)", async () => {
    const lt = await makeLeaveType();
    const alice = await actor();
    const bob = await actor();
    const created = await submit(alice, lt._id, D.mon1, D.thu1, 4);
    expect(created.status).toBe(201);
    const id = created.body.data.leave.id;
    expect((await request(app).get(`/api/leaves/${id}`).set(bob.h)).status).toBe(404);
    expect((await request(app).patch(`/api/leaves/${id}/cancel`).set(bob.h)).status).toBe(404);
    expect((await request(app).get(`/api/leaves/${id}`).set(alice.h)).status).toBe(200);
    // history is scoped to the session user even if the client passes someone else's id
    const hist = await request(app).get(`/api/leaves/my?employeeId=${alice.user._id}`).set(bob.h);
    expect(hist.body.data.items).toHaveLength(0);
  });

  it("an admin cannot disable their own account; two admins cannot disable each other concurrently", async () => {
    const a1 = await actor({ role: "admin" });
    const a2 = await actor({ role: "admin" });
    const own = await request(app).patch(`/api/admin/admins/${a1.user._id}/status`).set(a1.h).send({ status: "disabled" });
    expect(own.status).toBe(403);
    // Race: each admin tries to disable the other. The last-admin guard serialises the two
    // transactions, so at least one administrator always remains active.
    await Promise.all([
      request(app).patch(`/api/admin/admins/${a2.user._id}/status`).set(a1.h).send({ status: "disabled" }),
      request(app).patch(`/api/admin/admins/${a1.user._id}/status`).set(a2.h).send({ status: "disabled" }),
    ]);
    expect(await User.countDocuments({ role: "admin", status: "active" })).toBeGreaterThanOrEqual(1);
  });
});
