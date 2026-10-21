// Generates docs/leave-management.postman_collection.json from the table below:  npm run postman
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ID = "{{id}}";
const lm = (extra = "") => `{{baseUrl}}/api${extra}`;

// [folder, name, method, path, roles, body?]
export const ENDPOINTS = [
  ["Auth", "Register", "POST", "/auth/register", "public", { name: "Asha Kumar", email: "asha@example.com", phone: "9876543210", password: "Passw0rd!x", employeeId: "EMP100", department: "Engineering", joiningDate: "2024-05-01" }],
  ["Auth", "Login", "POST", "/auth/login", "public", { email: "{{email}}", password: "{{password}}" }],
  ["Auth", "Logout", "POST", "/auth/logout", "any"],
  ["Auth", "Current user", "GET", "/auth/me", "any"],
  ["Auth", "Change password", "PATCH", "/auth/change-password", "any", { currentPassword: "old", newPassword: "NewPassw0rd!" }],
  ["Employee", "My profile", "GET", "/employees/me", "any"],
  ["Employee", "Update my profile", "PATCH", "/employees/me", "any", { name: "New Name", phone: "9876543211" }],
  ["Employee", "My balances", "GET", "/employees/me/balances?year=2026", "employee"],
  ["Employee", "My leave history", "GET", "/employees/me/leave-history?page=1&limit=10&status=pending&sortBy=startDate&order=asc", "employee"],
  ["Leave types", "List", "GET", "/leave-types", "any"],
  ["Leave types", "Get", "GET", `/leave-types/${ID}`, "any"],
  ["Leave types", "Create", "POST", "/leave-types", "admin", { name: "Study Leave", code: "STUDY", yearlyLimit: 6, rules: { allowHalfDay: true, maxDays: 3 } }],
  ["Leave types", "Update", "PATCH", `/leave-types/${ID}`, "admin", { yearlyLimit: 8 }],
  ["Leave types", "Activate / deactivate", "PATCH", `/leave-types/${ID}/status`, "admin", { active: false }],
  ["Leaves", "Apply (JSON)", "POST", "/leaves", "employee", { leaveTypeId: "{{leaveTypeId}}", startDate: "2026-11-02", endDate: "2026-11-04", days: 3, reason: "Family function", isHalfDay: false }],
  ["Leaves", "Calculate days (preview)", "GET", "/leaves/calculate?leaveTypeId={{leaveTypeId}}&startDate=2026-11-02&endDate=2026-11-04", "employee"],
  ["Leaves", "My requests", "GET", "/leaves/my?page=1&limit=10", "employee"],
  ["Leaves", "Request details", "GET", `/leaves/${ID}`, "owner, hr, admin"],
  ["Leaves", "Cancel pending request", "PATCH", `/leaves/${ID}/cancel`, "employee"],
  ["Leaves", "Signed link for medical document (Cloudinary)", "GET", `/leaves/${ID}/document`, "owner, hr, admin"],
  ["HR", "Dashboard", "GET", "/hr/dashboard", "hr, admin"],
  ["HR", "Employees", "GET", "/hr/employees?status=active&search=asha", "hr, admin"],
  ["HR", "Employee details", "GET", `/hr/employees/${ID}`, "hr, admin"],
  ["HR", "Pending registrations", "GET", "/hr/registrations/pending", "hr, admin"],
  ["HR", "Rejected registrations", "GET", "/hr/registrations/rejected", "hr, admin"],
  ["HR", "Approve registration", "PATCH", `/hr/employees/${ID}/approve`, "hr, admin"],
  ["HR", "Reject registration", "PATCH", `/hr/employees/${ID}/reject`, "hr, admin", { reason: "Unknown employee" }],
  ["HR", "All leave requests", "GET", "/hr/leaves?status=pending&department=Engineering&page=1&limit=10", "hr, admin"],
  ["HR", "Leave request details", "GET", `/hr/leaves/${ID}`, "hr, admin"],
  ["HR", "Approve leave", "PATCH", `/hr/leaves/${ID}/approve`, "hr, admin"],
  ["HR", "Reject leave", "PATCH", `/hr/leaves/${ID}/reject`, "hr, admin", { reason: "Project deadline" }],
  ["HR", "Employee balances", "GET", "/hr/balances/{{employeeId}}?year=2026", "hr, admin"],
  ["HR", "Adjust balance", "PATCH", "/hr/balances/{{employeeId}}/adjust", "hr, admin", { leaveTypeId: "{{leaveTypeId}}", year: 2026, delta: 2, reason: "Carry forward" }],
  ["HR", "Balance adjustment history", "GET", "/hr/balances/{{employeeId}}/adjustments", "hr, admin"],
  ["HR", "Audit logs (HR view)", "GET", "/hr/audit-logs", "hr, admin"],
  ["Admin", "Employees", "GET", "/admin/employees?page=1&limit=10", "admin"],
  ["Admin", "Employee details", "GET", `/admin/employees/${ID}`, "admin"],
  ["Admin", "Update employee", "PATCH", `/admin/employees/${ID}`, "admin", { department: "Finance" }],
  ["Admin", "Employee status", "PATCH", `/admin/employees/${ID}/status`, "admin", { status: "disabled", reason: "Long absence" }],
  ["Admin", "Create HR", "POST", "/admin/hr", "admin", { name: "Harini HR", email: "harini@example.com", phone: "9876543210", password: "Passw0rd!x", employeeId: "HR009", department: "Human Resources", joiningDate: "2023-01-01" }],
  ["Admin", "List HR", "GET", "/admin/hr", "admin"],
  ["Admin", "HR details", "GET", `/admin/hr/${ID}`, "admin"],
  ["Admin", "Update HR", "PATCH", `/admin/hr/${ID}`, "admin", { department: "People Ops" }],
  ["Admin", "HR status", "PATCH", `/admin/hr/${ID}/status`, "admin", { status: "disabled" }],
  ["Admin", "List admins", "GET", "/admin/admins", "admin"],
  ["Admin", "Admin status", "PATCH", `/admin/admins/${ID}/status`, "admin", { status: "disabled" }],
  ["Admin", "Get settings", "GET", "/admin/settings", "admin"],
  ["Admin", "Update settings", "PATCH", "/admin/settings", "admin", { workingDays: [1, 2, 3, 4, 5], holidays: [{ date: "2026-12-25", name: "Christmas" }] }],
  ["Admin", "Initialize balances", "POST", "/admin/balances/initialize", "admin", { year: 2027, updateExisting: false }],
  ["Admin", "Audit logs", "GET", "/admin/audit-logs?action=leave.approved&page=1&limit=20", "admin"],
  ["Notifications", "List", "GET", "/notifications?isRead=false", "any"],
  ["Notifications", "Unread count", "GET", "/notifications/unread-count", "any"],
  ["Notifications", "Mark read", "PATCH", `/notifications/${ID}/read`, "any"],
  ["Notifications", "Mark all read", "PATCH", "/notifications/read-all", "any"],
  ["Calendar", "Approved leave calendar", "GET", "/calendar/leaves?month=11&year=2026", "any"],
  ["Reports", "Monthly", "GET", "/reports/monthly?year=2026", "hr, admin"],
  ["Reports", "Annual", "GET", "/reports/annual?year=2026", "hr, admin"],
  ["Reports", "Employee-wise", "GET", "/reports/employees?year=2026", "hr, admin"],
  ["Reports", "Department-wise", "GET", "/reports/departments?year=2026", "hr, admin"],
  ["Reports", "Leave-type-wise", "GET", "/reports/leave-types?year=2026", "hr, admin"],
  ["Reports", "Status summary", "GET", "/reports/status-summary?year=2026", "hr, admin"],
  ["Reports", "Balances", "GET", "/reports/balances?year=2026", "hr, admin"],
  ["Reports", "Export CSV", "GET", "/reports/export/csv?report=employees&year=2026", "hr, admin"],
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folders = new Map();
  for (const [folder, name, method, p, roles, body] of ENDPOINTS) {
    const item = {
      name: `${name}  [${roles}]`,
      request: {
        method,
        header: body ? [{ key: "Content-Type", value: "application/json" }] : [],
        ...(body ? { body: { mode: "raw", raw: JSON.stringify(body, null, 2) } } : {}),
        url: lm(p),
      },
    };
    if (name === "Login") {
      item.event = [{ listen: "test", script: { type: "text/javascript", exec: [
        "const d = pm.response.json().data || {};",
        "if (d.token) pm.collectionVariables.set('token', d.token);",
      ] } }];
    }
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push(item);
  }
  const collection = {
    info: {
      name: "Leave Management System API",
      description: "Set EXPOSE_TOKEN_IN_BODY=true in .env for local Postman use so Login stores {{token}} automatically. Browser apps use the HTTP-only cookie + X-CSRF-Token instead.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{token}}", type: "string" }] },
    variable: ["baseUrl:http://localhost:5000", "token:", "id:", "email:admin@example.com", "password:", "leaveTypeId:", "employeeId:"].map((v) => {
      const [key, ...rest] = v.split(":");
      return { key, value: rest.join(":") };
    }),
    item: [...folders].map(([name, item]) => ({ name, item })),
  };
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "leave-management.postman_collection.json"), JSON.stringify(collection, null, 2));
  console.log(`Wrote docs/leave-management.postman_collection.json (${ENDPOINTS.length} requests)`);
}
