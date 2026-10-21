# Leave Management System - Server (API)

Role-based leave management API (Employee / HR / Admin) built with **Node.js, Express 5, MongoDB and Mongoose**.
Employees apply for leave, HR reviews requests and balances, Admins manage accounts, leave policy and settings.

> **Verification status:** see [Testing](#testing). Pure logic (leave calculator, CSV, dates, file-type detection) has been
> executed and passes. The database-backed integration suite is written but must be run on a machine with network access
> (`npm install` downloads MongoDB for the tests).

## Contents
1. [Tech stack](#tech-stack) 2. [Folder structure](#folder-structure) 3. [Installation](#installation) 4. [Environment variables](#environment-variables)
5. [MongoDB setup & transactions](#mongodb-setup--transactions) 6. [Running & seeding](#running--seeding) 7. [Authentication flow](#authentication-flow)
8. [Roles & permissions](#roles--permissions) 9. [Leave approval workflow](#leave-approval-workflow) 10. [Balance rules](#leave-balance-rules)
11. [Leave policy defaults](#leave-policy-defaults--documented-decisions) 12. [File uploads](#file-uploads) 13. [Notifications & email](#notifications--email)
14. [API reference](#api-reference) 15. [Examples](#example-requests) 16. [Errors](#response-format--errors) 17. [Testing](#testing) 18. [Deployment](#deployment-considerations)


## Tech stack
Node.js >= 22 (ES modules) · Express 5 · Mongoose 9 · JWT (`jsonwebtoken`) · `bcryptjs` (bcrypt algorithm, no native build) · Zod validation ·
Helmet · CORS · `express-rate-limit` · Multer (memory storage) · **Cloudinary** (private storage) · Nodemailer · Vitest + Supertest + `mongodb-memory-server` · `node:test` for pure unit tests.
CSV generation is a small in-repo utility (`utils/csv.js`) so the formula-injection rules are explicit and unit-tested.

## Folder structure
Source lives in `src/` (Route -> Controller -> Service -> Model).
```
server/
├── src/
│   ├── app.js / server.js     Express app (no listen) / startup (env check, DB, transaction check, email worker)
│   ├── config/                env.js, db.js
│   ├── models/                User, LeaveType, LeaveBalance, LeaveRequest, BalanceAdjustment, AuditLog, Notification, SystemSetting, EmailOutbox
│   ├── routes/ controllers/   thin HTTP layer
│   ├── services/              ALL business logic (leaveService, balanceService, cloudinaryService, ...)
│   ├── validators/            Zod schemas
│   ├── middleware/            auth (JWT, RBAC, CSRF), validate, upload (Multer memory + magic bytes), errorHandler, rateLimiters
│   ├── utils/                 dates, leaveCalculator (pure), csv, fileType, pagination, transaction, ApiError
│   ├── jobs/emailWorker.js    delivers queued emails after commit (outbox)
│   ├── seeds/                 seed.js, createAdmin.js, bootstrapAdmin.js
│   └── tests/                 unit/ (node:test)   integration/ (Vitest + Supertest)   setup/
├── scripts/                   check-imports.js, generate-postman.js
├── docs/                      leave-management.postman_collection.json
├── .env.example  vitest.config.js  package.json
```

## Installation
```bash
cd server
npm install
cp .env.example .env     # then edit: MONGO_URL, JWT_SECRET, CLOUDINARY_*, seed credentials ...
```
If npm reports a version that does not exist for a newly added package (`bcryptjs, cloudinary, helmet, express-rate-limit, multer, nodemailer, zod, vitest, supertest, mongodb-memory-server`), install the latest instead: `npm install <package>@latest`.

## Environment variables
All are documented in `.env.example`. The important ones:

| Variable | Purpose |
|---|---|
| `MONGO_URL` | MongoDB connection string. **Must be a replica set** (see below). |
| `JWT_SECRET` | >= 32 chars; the server refuses to start otherwise. |
| `JWT_EXPIRES_IN_HOURS`, `BCRYPT_ROUNDS` | token lifetime (8), hashing cost (12) |
| `CLIENT_ORIGIN` | comma-separated allowed frontend origins (CORS, credentials enabled) |
| `COOKIE_SAMESITE`, `COOKIE_SECURE`, `TRUST_PROXY` | cookie hardening (`strict`, true in production) |
| `EXPOSE_TOKEN_IN_BODY` | `true` = login also returns the JWT in JSON (Postman/mobile only) |
| `RATE_LIMIT_*`, `LOGIN_RATE_LIMIT_MAX` | global and login/register rate limits |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | **Required for document uploads.** There is no local-storage fallback. Secrets stay on the server. |
| `CLOUDINARY_FOLDER`, `SIGNED_URL_TTL_SECONDS`, `MAX_UPLOAD_MB` | cloud folder, signed-link lifetime (120 s), size limit (5 MB) |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM` | Nodemailer; **empty `SMTP_HOST` = development mode** (emails are logged, not sent) |
| `SEED_*` | initial admin/HR/employee credentials for `npm run seed` / `create-admin` |

## MongoDB setup & transactions
Approval, rejection, cancellation, balance adjustments and status changes use **multi-document transactions**, which MongoDB only supports on a **replica set** (or sharded cluster). MongoDB Atlas already is one. The server checks this at startup and exits with an explanation if it is connected to a standalone `mongod`.

Local single-node replica set:
```bash
mongod --dbpath ./data --replSet rs0 --bind_ip 127.0.0.1
mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
# MONGO_URL=mongodb://127.0.0.1:27017/leave_management?replicaSet=rs0
```
Docker alternative: `docker run -d -p 27017:27017 --name mongo mongo:7 --replSet rs0` then run the `rs.initiate(...)` command above inside the container.

## Running & seeding
```bash
npm run dev            # nodemon
npm start              # production
npm run seed           # idempotent demo data (needs SEED_* variables)
npm run create-admin   # bootstrap only an admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
```
**Admin accounts are never created through the API.** The seed/bootstrap script is the only way. Seeds create 1 admin, 1 HR, 4 active + 2 pending employees,
the three default leave types, current-year balances, and sample pending/approved/rejected requests. Balances are recomputed from approved requests, so
`used` always equals the sum of approved days. Running the seed again changes nothing. It refuses to run in production unless `SEED_ALLOW_PRODUCTION=true`.

## Authentication flow
1. `POST /api/auth/register` -> account is created as **pending**, role **employee** (role/status in the body are ignored).
2. HR/Admin approves (`PATCH /api/hr/employees/:id/approve`) or rejects the registration; the employee is notified.
3. `POST /api/auth/login` -> sets an **HTTP-only** JWT cookie (`token`) and a readable `csrfToken` cookie; the CSRF token is also returned in the body.
   Only **active** accounts can log in (pending / rejected / disabled / relieved get 403 *after* the password is verified).
4. Browser clients: send cookies (`credentials: "include"`) and put the CSRF token in the **`X-CSRF-Token`** header on every POST/PATCH/DELETE.
   Non-browser clients may use `Authorization: Bearer <jwt>` (enable `EXPOSE_TOKEN_IN_BODY`); no CSRF header is needed for bearer requests.
5. **Every request reloads the user.** Disabling/relieving an account, logout and password change bump `tokenVersion`, so tokens issued earlier stop working immediately.
6. Login/registration are rate limited; passwords are bcrypt-hashed; hashes and `tokenVersion` never appear in responses.

## Roles & permissions
| Capability | Employee | HR | Admin |
|---|:--:|:--:|:--:|
| Own profile (name/phone), balances, history, notifications, calendar (own department) | yes | - | - |
| Apply for / cancel (pending) own leave | yes | - | - |
| Review registrations; approve/reject leave; adjust balances; dashboard; reports + CSV; leave/balance/registration audit | - | yes | yes |
| Manage employees, create/disable HR, leave types, settings, yearly balance initialisation, full audit logs | - | - | yes |
| Modify admin accounts | - | no | status only, never self, never the last active admin |

Authorization is enforced by `authenticate` + `authorize(...)` middleware on every router, and by ownership filters inside services
(an employee asking for another employee's request receives **404**, so ids cannot be probed). Client-supplied employee ids are never used for "my" endpoints.

## Leave approval workflow
```
Employee submits -> status=pending (NO balance change)
HR/Admin approve -> ONE transaction:
   1. compare-and-set pending -> approved (a repeated/concurrent approval finds status != pending => 409)
   2. employee must be active; leave-type rules and calendar are re-validated (days must still match)
   3. overlap with approved leave re-checked
   4. balance deducted with a conditional atomic update:  {available >= days} $inc {used:+days, available:-days}  (per leave year)
   5. audit log + in-app notification + email outbox row
   any failure => whole transaction rolls back
HR/Admin reject  -> pending -> rejected, reason saved, no balance change, audit + notification
Employee cancel -> pending -> cancelled only (compare-and-set), no balance change, audit
```
Allowed transitions: `pending->approved`, `pending->rejected`, `pending->cancelled`. Everything else returns **409**. Approved leave cannot be cancelled and nothing is refunded (no approved-cancellation workflow was specified).

**Concurrency:** balance deduction is a conditional `$inc`, and approvals for the same employee also bump `User.leaveVersion` inside the transaction, so concurrent transactions
conflict and are retried by Mongoose (`connection.transaction`). Two 4-day requests against 5 available days can never both be approved; a double-click or two HR users approving one request deducts once.
Manual adjustments use the same conditional updates, so adjustments racing approvals cannot make a balance negative.

## Leave balance rules
`allocated = baseAllocation + adjustment` and `available = allocated - used`.
* `baseAllocation` comes from the leave type's `yearlyLimit` (or a per-code override in settings `allocationDefaults`).
* `adjustment` is the sum of manual HR adjustments (each stored in `BalanceAdjustment` with a mandatory reason, an audit log and a notification).
* One row per (employee, leave type, year) - unique index. Missing rows are created lazily and **idempotently** (`$setOnInsert`) the first time they are needed for the current year, never for history.
* `POST /api/admin/balances/initialize` is idempotent. With `updateExisting:true` it syncs **base** allocation of existing rows to the current policy but never touches `used` or manual adjustments; reductions that would make `available` negative are skipped and reported.
* Changing a leave type's `yearlyLimit` affects only new balance rows (until you run initialize with `updateExisting`). Settings changes are never applied retroactively to approved leave. A **pending** request whose computed days no longer match (policy/holiday change) cannot be approved (409) - reject it or have the employee resubmit.

## Leave policy defaults & documented decisions
Leave-type rule defaults: `minDays 0.5`, `maxDays 30`, `requiresDocument false`, `allowHalfDay false`, `countWeekends false`, `countHolidays false`, `advanceNoticeDays 0`, `maxBackdateDays 0`, `allowNegativeBalance false`.
Seeded: Casual 12 (half-day, 1 day notice, max 5) · Sick 10 (half-day, back-date 7 days, max 15) · Optional/Paid 5 (3 days notice, min 1, max 5).
System settings defaults: working days Mon-Fri, no holidays, leave year starts January, time zone `Asia/Kolkata`, max booking horizon 365 days.

* **Days are server-calculated** (`utils/leaveCalculator.js`): a day counts if it is a working day (or weekends count) and not a holiday (or holidays count). The submitted `days` must equal the result (422 otherwise).
* **Half day:** single day only, counts 0.5, requires `allowHalfDay`.
* **Cross-year requests are allowed** and split per leave year (`yearBreakdown`); each year's balance is checked and deducted separately.
* **Dates** are date-only values stored as UTC midnight (no timezone drift); "today" is evaluated in the configured business time zone. Leap days work.
* **Pending requests do not reserve balance.** The balance is checked at submission (informational) and again, atomically, at approval (binding).
* **Overlap** is date-based against pending and approved requests (two half-days on one date therefore cannot both be filed).
* **Deactivating a leave type** blocks new requests only; pending requests can still be approved or rejected; history is preserved (leave types are never deleted).
* **Disabling an employee with pending requests:** approval is blocked (409), HR can reject them.
* **Account status matrix (admin):** `active->disabled|relieved`, `disabled->active|relieved`; `relieved`, `rejected` are terminal; `pending` is resolved only through approve/reject.
* **Leave-year start month** cannot be changed once balances exist.
* **Reports:** a request belongs to the period containing its **start date**. HR/Admin only.
* **Dashboard:** `totalEmployees` = active employee accounts; leave counts honour the optional `from/to` (submission date) and `department`; `employeesOnLeave` = distinct employees with approved leave covering today.
* **Calendar:** HR/Admin see name, employee id, department and leave type (any department, optional filter). Employees see only their own department, names and dates; the leave type of colleagues is hidden. Reasons/documents are never included.

## File uploads (Cloudinary)
`multipart/form-data` field **`medicalDocument`** on `POST /api/leaves` (PDF, JPG/JPEG, PNG; default max 5 MB).
1. Multer keeps the file **in memory** (nothing is ever written to the server disk) and checks extension + MIME.
2. The **real content is inspected (magic bytes)** and must match the declared type.
3. Only after every business rule has passed (dates, policy, overlap, balance...) is the buffer streamed to Cloudinary as an **`authenticated` (private) asset** - a plain URL never works.
4. The public id + metadata are saved in MongoDB inside the leave-request transaction. If that database write fails, the cloud file is **deleted** (no orphans).
5. `GET /api/leaves/:id/document` (owner, HR, Admin) returns a **short-lived signed download URL** (default 120 s, generated with `private_download_url`). HR/Admin views are audit-logged. Cloudinary identifiers never appear in normal API responses.
6. If Cloudinary is not configured or unreachable the API answers **503 / 502** with a clear message. **There is no local fallback.**

Cloudinary setup: create a free account, copy *Cloud name*, *API key* and *API secret* from the dashboard into `.env`. Live Cloudinary behaviour could not be exercised in the development sandbox (no network); the integration tests use an in-memory fake with the same interface (`setCloudinaryForTests`).

## Notifications & email
In-app notifications (account approved/rejected, leave approved/rejected, balance adjusted) are created in the same transaction as the event. Emails use a **transactional outbox**:
an `EmailOutbox` row is written in that transaction and `jobs/emailWorker.js` delivers it after commit, retrying with exponential backoff (max `EMAIL_MAX_ATTEMPTS`). SMTP outages can therefore never undo an approval.
**Without `SMTP_HOST` (development), emails are rendered and logged to the console, not sent.**

## API reference
Base path `/api`. `A` = authenticated, roles in brackets. List endpoints return `data: { items, pagination: { page, limit, total, totalPages } }` and accept `page`, `limit` (max 100), `order`, `sortBy`.

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | /auth/register | public | pending employee |
| POST | /auth/login | public | cookies (+ token if enabled) |
| POST | /auth/logout | A | revokes all tokens |
| GET | /auth/me | A | |
| PATCH | /auth/change-password | A | |
| GET / PATCH | /employees/me | A | PATCH: name, phone |
| GET | /employees/me/balances?year= | employee | |
| GET | /employees/me/leave-history | employee | filters: leaveTypeId, status, startDate, endDate, submittedFrom/To |
| GET | /leave-types[?includeInactive=true] , /leave-types/:id | A | employees see active only |
| POST | /leave-types | admin | |
| PATCH | /leave-types/:id , /leave-types/:id/status | admin | |
| POST | /leaves | employee | JSON or multipart; optional `Idempotency-Key` header |
| GET | /leaves/my | employee | |
| GET | /leaves/calculate?leaveTypeId&startDate&endDate&isHalfDay | employee | server-side day calculation preview (used by the apply form) |
| GET | /leaves/:id , /leaves/:id/document | owner / HR / admin | `/document` returns `{ url, expiresInSeconds }` (signed, short-lived) |
| PATCH | /leaves/:id/cancel | employee | pending only |
| GET | /hr/dashboard | HR, admin | |
| GET | /hr/employees , /hr/employees/:id | HR, admin | filters: status, department, search |
| GET | /hr/registrations/pending , /hr/registrations/rejected | HR, admin | |
| PATCH | /hr/employees/:id/approve , /reject | HR, admin | |
| GET | /hr/leaves , /hr/leaves/:id | HR, admin | filters: employeeId, department, leaveTypeId, status, startDate, endDate, submittedFrom/To |
| PATCH | /hr/leaves/:id/approve , /reject | HR, admin | |
| GET | /hr/balances/:employeeId , /hr/balances/:employeeId/adjustments | HR, admin | |
| PATCH | /hr/balances/:employeeId/adjust | HR, admin | reason mandatory |
| GET | /hr/audit-logs | HR, admin | HR: leave/balance/registration only |
| GET | /admin/employees , /admin/employees/:id | admin | |
| PATCH | /admin/employees/:id , /admin/employees/:id/status | admin | |
| POST / GET | /admin/hr | admin | create / list |
| GET / PATCH | /admin/hr/:id , /admin/hr/:id/status | admin | |
| GET / PATCH | /admin/admins , /admin/admins/:id/status | admin | no self-change, last-admin guard |
| GET / PATCH | /admin/settings | admin | |
| POST | /admin/balances/initialize | admin | idempotent |
| GET | /admin/audit-logs | admin | filters: actorId, action, targetType, targetId, from, to |
| GET | /notifications , /notifications/unread-count | A | own only |
| PATCH | /notifications/:id/read , /notifications/read-all | A | own only |
| GET | /calendar/leaves?month&year or from&to [&department] | A | see visibility rules |
| GET | /reports/monthly, /annual, /employees, /departments, /leave-types, /status-summary, /balances | HR, admin | filters: employeeId, department, leaveTypeId, status, month, year, from, to |
| GET | /reports/export/csv?report=<name>&...filters | HR, admin | CSV download |

A ready-to-import **Postman collection** is in `docs/leave-management.postman_collection.json` (`npm run postman` regenerates it).

## Example requests
```bash
# Register
curl -X POST localhost:5000/api/auth/register -H 'Content-Type: application/json' -d '{
  "name":"Asha Kumar","email":"asha@example.com","phone":"9876543210","password":"Passw0rd!x",
  "employeeId":"EMP100","department":"Engineering","joiningDate":"2024-05-01"}'
# -> 201 {"success":true,"message":"Registration successful. Your account is pending approval by HR","data":{"user":{...,"status":"pending","role":"employee"}}}

# Apply for leave (token from login when EXPOSE_TOKEN_IN_BODY=true)
curl -X POST localhost:5000/api/leaves -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "leaveTypeId":"<id>","startDate":"2026-11-02","endDate":"2026-11-04","days":3,"reason":"Family function"}'
# -> 201 {"success":true,"message":"Leave request created successfully","data":{"leave":{"status":"pending","days":3,...}}}

# With a document
curl -X POST localhost:5000/api/leaves -H "Authorization: Bearer $TOKEN" \
  -F leaveTypeId=<id> -F startDate=2026-11-02 -F endDate=2026-11-02 -F days=1 -F reason=Fever -F medicalDocument=@report.pdf

# Approve
curl -X PATCH localhost:5000/api/hr/leaves/<leaveId>/approve -H "Authorization: Bearer $HR_TOKEN"
# Adjust balance
curl -X PATCH localhost:5000/api/hr/balances/<employeeId>/adjust -H "Authorization: Bearer $HR_TOKEN" -H 'Content-Type: application/json' \
  -d '{"leaveTypeId":"<id>","year":2026,"delta":2,"reason":"Carry forward from 2025"}'
# CSV
curl -OJ -H "Authorization: Bearer $HR_TOKEN" "localhost:5000/api/reports/export/csv?report=employees&year=2026"
```

## Response format & errors
```json
{ "success": true,  "message": "Leave request created successfully", "data": {} }
{ "success": false, "message": "Insufficient leave balance for 2026: 1 day(s) available, 4 requested", "errors": [] }
```
`200` ok · `201` created · `400` malformed JSON / bad id · `401` unauthenticated or revoked session · `403` forbidden / inactive account / bad CSRF · `404` not found (also for other users' private records) ·
`409` duplicate or conflicting state (duplicate email, overlap, insufficient balance, invalid transition) · `413` body too large · `422` validation (with `errors: [{field,message}]`) · `429` rate limit · `500` internal (stack only outside production).

## Testing
```bash
npm run test:unit         # node:test - pure logic, no database needed
npm run test:integration  # Vitest + Supertest; starts an in-memory MongoDB REPLICA SET (downloads the mongod binary on first run)
npm test                  # both
npm run check             # static import/export check (no dependencies needed)
```
Integration tests use a throw-away database per test file (`test_lms_*`, refused otherwise) and never touch `MONGO_URL`. To use your own replica set set `TEST_MONGO_URL`.
Covered (all in `src/tests`): registration/login/status matrix/tokens/CSRF, RBAC and IDOR, submission rules, no-deduction-on-submit, approval/rejection/cancellation, duplicate and concurrent approvals,
cancel-vs-approve race, cross-year split, holidays, half-day, idempotency key, email outbox failure/retry, admin/HR management, last-admin guard, balances & idempotent initialisation,
settings, audit immutability, notifications ownership, Cloudinary uploads (valid, spoofed, cleanup on failure, 503 without credentials, signed-link access control), history filters/pagination, dashboard, calendar, reports and CSV injection.

## Deployment considerations
Use a replica set (Atlas); set a strong `JWT_SECRET`, `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY=true` behind a proxy, and exact `CLIENT_ORIGIN`s. If the frontend is on a different **site** (not just origin)
use `COOKIE_SAMESITE=none` + HTTPS. Keep `EXPOSE_TOKEN_IN_BODY=false` for browser apps. Documents live in Cloudinary, so the API servers are stateless.
Run exactly one or more instances freely - the email outbox claims rows atomically. Never run the seed in production. Back up MongoDB; audit logs are append-only at the model level (also restrict DB user permissions).

