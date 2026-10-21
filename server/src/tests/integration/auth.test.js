import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import User from "../../models/userModel.js";
import { actor, app, createUser, PASSWORD, request, resetDb, startTestDb, stopTestDb, tokenFor } from "./helpers.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(resetDb);

const reg = (over = {}) => ({
  name: "Asha Kumar", email: "asha@example.com", phone: "9876543210", password: PASSWORD,
  employeeId: "E-100", department: "Engineering", joiningDate: "2024-05-01", ...over,
});

describe("registration", () => {
  it("creates a PENDING employee and never returns the password hash", async () => {
    const res = await request(app).post("/api/auth/register").send(reg());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.status).toBe("pending");
    expect(res.body.data.user.role).toBe("employee");
    expect(res.body.data.user.passwordHash).toBeUndefined();
    const stored = await User.findOne({ email: "asha@example.com" }).select("+passwordHash");
    expect(stored.passwordHash).not.toBe(PASSWORD);
    expect(stored.passwordHash.startsWith("$2")).toBe(true);
  });

  it("ignores role/status supplied by the client (cannot register as admin or active)", async () => {
    const res = await request(app).post("/api/auth/register").send(reg({ role: "admin", status: "active" }));
    expect(res.status).toBe(201);
    const u = await User.findOne({ email: "asha@example.com" });
    expect(u.role).toBe("employee");
    expect(u.status).toBe("pending");
  });

  it("rejects duplicate email and duplicate employee id with 409", async () => {
    await request(app).post("/api/auth/register").send(reg());
    const dupEmail = await request(app).post("/api/auth/register").send(reg({ employeeId: "E-101" }));
    expect(dupEmail.status).toBe(409);
    const dupId = await request(app).post("/api/auth/register").send(reg({ email: "other@example.com", employeeId: "e-100" }));
    expect(dupId.status).toBe(409);
  });

  it("validates input (422 with field errors)", async () => {
    const res = await request(app).post("/api/auth/register").send(reg({ email: "nope", password: "short", joiningDate: "2024-02-30" }));
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(["email", "password", "joiningDate"]));
  });
});

describe("login and account status", () => {
  it("denies pending, rejected, disabled and relieved accounts; allows active", async () => {
    for (const status of ["pending", "rejected", "disabled", "relieved"]) {
      const u = await createUser({ status });
      const res = await request(app).post("/api/auth/login").send({ email: u.email, password: PASSWORD });
      expect(res.status, status).toBe(403);
    }
    const ok = await createUser({ status: "active" });
    const res = await request(app).post("/api/auth/login").send({ email: ok.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(ok.email);
    expect(res.headers["set-cookie"].join(";")).toContain("HttpOnly");
  });

  it("rejects wrong password and unknown email with the same 401", async () => {
    const u = await createUser();
    const wrong = await request(app).post("/api/auth/login").send({ email: u.email, password: "Wrong-pass-1" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "ghost@example.com", password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });
});

describe("tokens and sessions", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/leaves/my")).status).toBe(401);
  });

  it("GET /me returns the current user; a disabled user's old token stops working immediately", async () => {
    const a = await actor();
    expect((await request(app).get("/api/auth/me").set(a.h)).body.data.user.id).toBe(String(a.user._id));
    await User.updateOne({ _id: a.user._id }, { status: "disabled", $inc: { tokenVersion: 1 } });
    expect((await request(app).get("/api/auth/me").set(a.h)).status).toBeGreaterThanOrEqual(401);
    // even without bumping tokenVersion a non-active status is refused
    await User.updateOne({ _id: a.user._id }, { status: "relieved" });
    expect((await request(app).get("/api/auth/me").set(a.h)).status).toBe(403);
  });

  it("logout revokes previously issued tokens", async () => {
    const a = await actor();
    expect((await request(app).post("/api/auth/logout").set(a.h)).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set(a.h)).status).toBe(401);
  });

  it("change-password verifies the current password, revokes old tokens and enables the new password", async () => {
    const a = await actor();
    const bad = await request(app).patch("/api/auth/change-password").set(a.h).send({ currentPassword: "nope", newPassword: "Another-pass-9" });
    expect(bad.status).toBe(401);
    const ok = await request(app).patch("/api/auth/change-password").set(a.h).send({ currentPassword: PASSWORD, newPassword: "Another-pass-9" });
    expect(ok.status).toBe(200);
    expect((await request(app).get("/api/auth/me").set(a.h)).status).toBe(401); // old token revoked
    const login = await request(app).post("/api/auth/login").send({ email: a.user.email, password: "Another-pass-9" });
    expect(login.status).toBe(200);
  });

  it("cookie sessions require a matching CSRF header on unsafe requests", async () => {
    const u = await createUser();
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({ email: u.email, password: PASSWORD });
    expect((await agent.get("/api/auth/me")).status).toBe(200); // safe method, cookie only
    const noCsrf = await agent.patch("/api/employees/me").send({ name: "New Name" });
    expect(noCsrf.status).toBe(403);
    const withCsrf = await agent.patch("/api/employees/me").set("X-CSRF-Token", login.body.data.csrfToken).send({ name: "New Name" });
    expect(withCsrf.status).toBe(200);
    expect(withCsrf.body.data.user.name).toBe("New Name");
  });

  it("profile update only accepts name and phone (no mass assignment)", async () => {
    const a = await actor();
    const res = await request(app).patch("/api/employees/me").set(a.h).send({ name: "Zed Zed", role: "admin", status: "active", department: "HR" });
    expect(res.status).toBe(200);
    const u = await User.findById(a.user._id);
    expect(u.role).toBe("employee");
    expect(u.department).toBe("Engineering");
  });
});
