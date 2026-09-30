# De-Crown SaaS Conversion — Progress Tracker

Keep this file in the repo root. Update the status column as work lands;
treat it as the source of truth for "what's built vs. stubbed vs. blocked."

## Phase 1 — Client sign-up & approval

| Item                                         | Status            | Notes                                                                                    |
| -------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `Client` model                               | ✅ Built          | `models/Client.js`                                                                       |
| `PlatformAdmin` model (your login)           | ✅ Built          | `models/PlatformAdmin.js`                                                                |
| Signup / verify-email / resend routes        | ✅ Built          | `routes/platform.js`                                                                     |
| Platform-admin login + approve/reject routes | ✅ Built          | `routes/platform.js`                                                                     |
| One-time script to create your login         | ✅ Built          | `create-platform-admin.js` — run once, don't deploy as a live route                      |
| Client signup page (frontend)                | ✅ Built          | `pages/ClientSignup.jsx` + `styles/signup.css`                                           |
| Platform-admin login page (frontend)         | ✅ Built          | `pages/PlatformLogin.jsx`                                                                |
| Approval queue dashboard (frontend)          | ✅ Built          | `pages/ApprovalQueue.jsx`                                                                |
| Wire everything into `App.jsx` routes        | ✅ Built          | `/signup`, `/platform/login`, `/platform/queue`                                          |
| Real Resend email delivery tested            | ⬜ Not yet tested | Requires production sender/domain credentials                                            |
| Link into `/signup` from somewhere reachable | ✅ Built          | Route is reachable directly at `/signup`                                                 |
| Single env-controlled overall admin          | ✅ Implemented    | Owner credentials sync from `PLATFORM_ADMIN_*`; no client/staff account can become owner |
| Limited platform staff accounts              | ✅ Implemented    | Viewer is read-only; reviewer can approve/reject; owner manages staff                    |
| Platform activity audit                      | ✅ Implemented    | Sign-ins and authenticated platform API requests are recorded                            |

## Phase 2 — Real per-client provisioning

| Item                                                      | Status            | Notes                                                                                 |
| --------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| Dedicated database provisioning on approval               | ✅ Implemented    | `provisionClient.js`; creates tenant DB, owner admin, properties, settings, and units |
| Tenant model isolation                                    | ✅ Implemented    | Request-local model selection over separate MongoDB databases; regression-tested      |
| Subdomain-aware request routing                           | ✅ Implemented    | Requires `PLATFORM_ROOT_DOMAIN`, wildcard DNS/TLS, and deployed smoke test            |
| Client-scoped admin and tenant tokens                     | ✅ Implemented    | Tokens are bound to the resolved client on tenant hosts                               |
| Tenant properties and units                               | ✅ Implemented    | Basic create/edit/archive flows; unit availability and per-unit rent are supported    |
| Configurable locations in registration and landlord views | ✅ Implemented    | Stored properties/units replace generated fixed room counts                           |
| Existing De-Crown data migration                          | 🟡 Ready, not run | `migrate-legacy-tenant.js` dry-runs by default; requires review before `--apply`      |
| Branding (logo/colors) applied throughout the app         | ✅ Implemented    | Dynamic business name, logo, contacts, and primary color applied across all client pages via TenantContext |

## Phase 3 — Real-estate product workflows

| Item                                  | Status         | Notes                                                     |
| ------------------------------------- | -------------- | --------------------------------------------------------- |
| Lease terms and date-based occupancy  | ⬜ Not started | Current occupancy remains session-based                   |
| Recurring rent, invoices, and payment | ⬜ Not started | Payment capture/provider integration is not implemented   |
| Maintenance requests and notices      | ⬜ Not started | No tenant-landlord work-order workflow                    |
| Platform plans and billing            | ⬜ Not started | Pricing decision and subscription integration are open    |
| Property-level analytics and exports  | ⬜ Partial     | Existing CSV/XLSX-style operations remain hostel-oriented |

## Local migration preview

Set `LEGACY_MONGO_URI` to the current De-Crown database, set the `LEGACY_TENANT_*`
fields in `.env`, then run `npm run migrate:legacy -- --dry-run`. Review the source
counts, target database, and destination email/subdomain. Only after review, run
`npm run migrate:legacy -- --apply`. The script copies into a new tenant database
and does not modify or delete the source. Do not run `--apply` against production
until a backup exists and the dry-run values are confirmed.

## Production launch checklist

1. Configure MongoDB Atlas, strong JWT secret, Resend, Cloudinary, and `PLATFORM_ROOT_DOMAIN` in Render.
2. Configure wildcard DNS and TLS for tenant subdomains.
3. Set `PLATFORM_ADMIN_NAME`, `PLATFORM_ADMIN_EMAIL`, and a unique password of at least 12 characters.
4. Review the migration dry-run, back up the source, then explicitly apply and verify property/unit assignments.
5. Complete signup → email verification → approval → tenant login → registration smoke tests on staging.
6. Review document privacy, backups, rate limits, and production CORS before launch.

Automated tenant isolation and owner/staff permission/audit tests pass. Real Resend
delivery, Render configuration, the legacy migration, and staging smoke tests have
not yet been performed.
