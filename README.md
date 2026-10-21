# Leave Management System (MERN)

Role-based leave management: **employees** apply for leave, **HR** verifies registrations, reviews requests and manages balances, **admins** manage staff, leave types, allocations and system settings.

* **Client:** React 18 + Vite + Tailwind CSS + Redux Toolkit + **RTK Query** (`createApi`, cache tags, auto-invalidation; no Axios) + React Router + React Hook Form/Zod + Lucide icons.
* **Server:** Node.js (>=22) + Express 5 + MongoDB/Mongoose (transactions) + JWT in HTTP-only cookies (+CSRF) + Zod + **Cloudinary** (private document storage) + Nodemailer + Vitest/Supertest.

## Status - please read
Both update rounds were produced in a sandbox **without network access**: `npm install`, the Vite build, MongoDB, Cloudinary and every database-backed test could **not** be run there. See `CHANGES.md` for what changed in the latest update and exactly what was and was not executed. Short version: server unit tests (22) and client unit tests (5) pass; static import/syntax checks pass; a render smoke test of the shared UI components passed; **all integration tests, the Vite build and every browser/end-to-end check are NOT VERIFIED** - run the commands in "Testing" on your machine and report any failure.

## Structure
```
leave-management-system/
├── client/   React + Vite app  (src/app, features/*Api.js + slices, services/apiSlice.js, components, layouts, pages/{auth,employee,hr,admin,shared})
├── server/   Express API       (src/{config,models,controllers,services,routes,middleware,validators,utils,jobs,seeds,tests}) - see server/README.md for the full API reference
└── README.md
```

## Setup
### 1. MongoDB (replica set required)
Leave approval, rejection, cancellation and balance adjustments use **multi-document transactions**, which need a replica set (MongoDB Atlas already is one). The server refuses to start on a standalone `mongod`.
```bash
mongod --dbpath ./data --replSet rs0 --bind_ip 127.0.0.1
mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```
### 2. Server
```bash
cd server
npm install
cp .env.example .env        # fill MONGO_URL, JWT_SECRET (>= 32 chars), CLOUDINARY_*, SEED_*; SMTP_* optional
npm run seed                # admin, HR, employees, leave types, balances, sample requests (idempotent)
npm run dev                 # http://localhost:5000   (health: GET /api/health)
```
* **Cloudinary:** create an account and put cloud name / API key / API secret in `.env`. Uploads are stored as *authenticated* (private) assets and delivered only through short-lived signed URLs after an ownership/role check. Without credentials the API returns 503 for uploads - there is **no local-disk fallback**.
* **SMTP:** set `SMTP_HOST/PORT/USER/PASSWORD/FROM`. With `SMTP_HOST` empty, emails are only logged to the console (development).
* **Admin:** there is no public admin endpoint. The first admin comes from `npm run seed` or `npm run create-admin` (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`).
### 3. Client
```bash
cd client
npm install
npm run dev                 # http://localhost:5173  (Vite proxies /api to the server, so cookies just work)
npm run build               # production build in client/dist
```
For production set `VITE_API_URL=https://your-api-host` and, on the server, `CLIENT_ORIGIN`, `COOKIE_SECURE=true` and (cross-site) `COOKIE_SAMESITE=none`.

### Demo logins (after `npm run seed`)
Use the emails/passwords from your `.env` (`SEED_ADMIN_*`, `SEED_HR_*`, `SEED_EMPLOYEE_PASSWORD`; employees e.g. `aarav@example.com`, `diya@example.com`, `kiran@example.com`, `meera@example.com`; `rohan@example.com` and `sana@example.com` are pending).

## Roles
| | Employee | HR | Admin |
|---|:--:|:--:|:--:|
| Profile, balances, apply/cancel own leave, history, notifications, calendar (own department) | yes | | |
| Registrations, leave review (approve/reject), balance adjustments, dashboard, reports + CSV | | yes | yes |
| Employees/HR accounts, leave types, allocations, system settings, audit logs | | | yes |

Every permission is enforced on the server (JWT cookie -> user reloaded on each request -> role middleware -> ownership filters). The React route guards are UX only.

## Leave approval workflow
`Employee applies -> status pending (NO balance change) -> HR/Admin approves or rejects`.
Approval runs in **one MongoDB transaction**: atomic `pending -> approved` claim, employee eligibility, re-validation of rules/calendar, overlap re-check, **conditional balance deduction** (`available >= days`), audit log, in-app notification and an email-outbox row. Duplicate or concurrent approvals get `409`; two requests that together exceed the balance can never both be approved. Rejection and cancellation (pending only) never touch balances. Allowed transitions: `pending -> approved | rejected | cancelled`.
`available = allocated - used`, `allocated = baseAllocation + manual adjustments`. Details and every documented policy decision (cross-year split, half-days, weekends/holidays, time zone, deactivated leave types...) are in `server/README.md`.

## Testing
```bash
cd server && npm test          # unit tests (node:test) + integration tests (Vitest + Supertest + in-memory MongoDB replica set)
cd server && npm run check     # static import/export check
cd client && npm test          # client unit tests (node:test, no install needed)
cd client && node scripts/check-imports.js
```
Integration tests use a throw-away database per test file and a fake Cloudinary adapter; they never touch `MONGO_URL`.

## Completion report
**Legend:** VERIFIED = executed here · NOT VERIFIED = implemented, needs a run on a networked machine · INCOMPLETE.

| Area | Status |
|---|---|
| Leave-day calculation (weekends, holidays, half-day, leap year, cross-year, min/max), CSV escaping + formula-injection guard, date/time-zone helpers, content-based file-type detection | **VERIFIED** (19 unit tests pass) |
| Server syntax, import/export integrity, all 52 specified endpoints present in routers (+11 extras) | **VERIFIED** (static) |
| Client syntax (JSX), imports/exports, declared packages, no undeclared identifiers / unused imports | **VERIFIED** (static) |
| Registration, login/logout, JWT cookie + CSRF, status matrix, RBAC, IDOR protection | NOT VERIFIED (integration tests written) |
| Leave application, overlap/balance checks, approval/rejection/cancellation, no-deduction-on-submit, transactions, double/concurrent-approval safety | NOT VERIFIED (integration tests written) |
| HR balance adjustments + history, yearly initialization (idempotent), leave types, settings, audit logs (append-only), notifications, email outbox + retry | NOT VERIFIED |
| Cloudinary private upload, signed-URL access, cleanup on failure | NOT VERIFIED live (tests use a fake adapter; real Cloudinary needs credentials + network) |
| Dashboard, calendar, reports, CSV export | NOT VERIFIED |
| React/Vite/RTK Query frontend (all employee, HR and admin pages) | NOT VERIFIED (`npm run build` and a browser run not possible offline; no frontend automated tests were written) |
| Seed script | NOT VERIFIED |
| Frontend unit/component tests | INCOMPLETE (not written) |

Known limitations: no approved-leave cancellation/refund workflow (the specification forbids it); reports attribute a request to its start month/year; pending requests do not reserve balance (the binding check is at approval).
