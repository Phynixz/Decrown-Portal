# De-Crown SaaS Conversion — Progress Tracker

Keep this file in the repo root. Update the status column as work lands;
treat it as the source of truth for "what's built vs. stubbed vs. blocked."

## Phase 1 — Client sign-up & approval

| Item | Status | Notes |
|---|---|---|
| `Client` model | ✅ Built | `models/Client.js` |
| `PlatformAdmin` model (your login) | ✅ Built | `models/PlatformAdmin.js` |
| Signup / verify-email / resend routes | ✅ Built | `routes/platform.js` |
| Platform-admin login + approve/reject routes | ✅ Built | `routes/platform.js` |
| One-time script to create your login | ✅ Built | `create-platform-admin.js` — run once, don't deploy as a live route |
| Client signup page (frontend) | ✅ Built | `pages/ClientSignup.jsx` + `styles/signup.css` |
| Platform-admin login page (frontend) | ✅ Built | `pages/PlatformLogin.jsx` |
| Approval queue dashboard (frontend) | ✅ Built | `pages/ApprovalQueue.jsx` |
| Wire everything into `App.jsx` routes | ✅ Built | `/signup`, `/platform/login`, `/platform/queue` |
| Real Resend email delivery tested | ⬜ Not yet tested | Only console-logged code confirmed so far |
| Link into `/signup` from somewhere reachable | ✅ Built | Route is reachable directly at `/signup` |

## Phase 2 — Real per-client provisioning

| Item | Status | Notes |
|---|---|---|
| Per-client database creation on approval | ⬜ Blocked | "Approve" currently only flips a status flag — no real platform gets created yet |
| `clientId` scoping on `User`, `Admin`, `Settings`, `Registration` | ⬜ Blocked | **Needs:** `models/User.js`, `models/Admin.js`, `models/Settings.js`, `models/Registration.js`, `multer.js`, full `server.js` (routes between lines 247–974 not yet seen) |
| Subdomain-aware request routing | ⬜ Not started | Depends on the above |
| Replace hardcoded `["Malete", "Ila-Orangun"]` location whitelist with per-client `locations` | ⬜ Not started | `Client.locations` field already exists, ready to use once Phase 2 wiring is in |
| Branding (logo/colors) pulled from `Client` into the app shell | ⬜ Not started | `Client.branding` field already exists |

## Integration steps still to apply (Phase 1)

1. Run `create-platform-admin.js` once with your own credentials.
2. Add `RESEND_API_KEY` / `PLATFORM_EMAIL_FROM` to `.env` and Render.
3. Test Resend delivery and the full signup-to-approval flow.

## Current blocker

Phase 2 can't start until these are shared: `models/User.js`, `models/Admin.js`,
`models/Settings.js`, `models/Registration.js`, `multer.js`, and the full
`server.js` (the middle section with most routes wasn't visible in what was
uploaded so far).
