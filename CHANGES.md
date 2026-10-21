# Update: bug fixes, premium UI, tests

Changes were made in place; no feature was removed and nothing unrelated was added. Redux Toolkit,
RTK Query, MongoDB (transactions) and Cloudinary integrations are untouched.

## Bugs fixed
| # | Where | Problem | Fix |
|---|---|---|---|
| 1 | client `services/apiSlice.js` | A wrong *current password* on the Profile page returns 401, which the client treated as an expired session and **signed the user out**. | New `utils/authProbe.js`; `/auth/change-password` is now excluded from session-expiry handling. |
| 2 | client `components/ui/Modal.jsx` | The focus effect depended on `onClose`; forms in dialogs (leave types, accounts, balances) re-ran it on every keystroke and **pulled focus out of the input**. Escape also closed the dialog *under* a confirm dialog. | Effect runs only on open/close, latest `onClose` kept in a ref, Escape handled by the topmost dialog only, scroll lock/focus restore added. |
| 3 | client `features/auth/authSlice.js` | Any failed `/auth/me` (network blip, 5xx) cleared the user locally. | Only 401/403 clear the session. |
| 4 | client `app/store.js` | `refetchOnFocus/Reconnect` never worked (`setupListeners` was not called). | Wired up; enabled in `createApi`. |
| 5 | client `ApplyLeave.jsx` | Ticking "half day" with a multi-day range gave a server error. | End date follows the start date (read-only) for half days. |
| 6 | client Reports / Allocations | Default year was the *calendar* year; wrong when the leave year starts mid-year. | Blank year = server's current leave year (Allocations derives it from settings). |
| 7 | client Calendar / HR dashboard | Department filter fired one request per keystroke. | Debounced. |
| 8 | client `LeaveTypes.jsx` | Empty/invalid numbers silently became 0 and bad ranges only failed server-side. | Client validation mirrors the server rules. |
| 9 | server `leaveService` | Leave could start **before the employee's joining date**. | New rule (`utils/joiningDate.js`) on submit and on the calculate preview. |
| 10 | server `rateLimiters` | Successful logins counted toward the brute-force limit (shared office IPs could lock out valid users). | `skipSuccessfulRequests: true`. |

Reviewed and found correct (no change): deduction only on approval inside one transaction with a
conditional `available >= days` update, compare-and-set status transitions (double/concurrent
approval -> 409), cancellation/rejection never touching balances, cross-year split, server-side
day calculation, CSV formula-injection guard, RBAC and ownership filters, signed private Cloudinary URLs.

## UI
Design tokens in `tailwind.config.js` (deep ink-blue `brand`, warm `canvas`, serif headings, restrained
semantic colours; no gradients). Rebuilt: sidebar/top bar (grouped navigation, mobile drawer), auth
screens, Button, Card, Badge, StatCard, Modal, Field, DataTable (skeleton loading), PageHeader.
All pages inherit the system; `indigo-*` classes were renamed to `brand-*`.

## "Real-time"
Near-real-time via **polling**, not websockets: notification bell (30 s), HR dashboard / requests /
registrations and employee dashboard / my leaves (30 s while the tab is visible), plus refetch on tab
focus and reconnect. No websocket server was added.

## Tests actually executed (sandbox, Node 22, no network)
- Server unit tests: `node --test "src/tests/unit/*.test.js"` -> 22/22 pass (19 existing + 3 new joining-date tests).
- Client unit tests: `npm test` in `client/` -> 5/5 pass (formatting, error messages, params, auth-probe regression).
- Static: server import check (90 files) and client import check (67 files) OK; all 67 client files parse (TypeScript parser).
- Render smoke test (ad hoc harness, React 19 SSR, icons stubbed): 7/7 checks on Badge, Button, StatCard, DataTable, PageHeader/Card/EmptyState/Pagination, Input, Modal.

## NOT executed / NOT verified
- `npm install`, `vite build`, any browser run (layout, responsiveness, focus behaviour, keyboard flow).
- All integration tests (Vitest + Supertest + in-memory MongoDB), including the new joining-date test in `leave.test.js`.
- MongoDB transactions, concurrent approvals, seed script, real Cloudinary upload/signed URLs, SMTP.
- Email/notification delivery, CSV download in a browser, report correctness against real data.
- Zod 4 / Mongoose 9 / Express 5 runtime behaviour was reviewed by reading only.
- The new serif/sans fonts load from Google Fonts at runtime (fallbacks are set).
