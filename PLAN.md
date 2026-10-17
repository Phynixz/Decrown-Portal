# De-Crown Cottage → Multi-Tenant SaaS Platform

**Master planning document.** This is the single source of truth for the
business plan, architecture decisions, and build status. `PROGRESS.md`
tracks task-by-task status; this file explains the _why_ behind each
decision so anyone picking this up later understands the reasoning, not
just the checklist.

> **Product workflow update (October 2026):** The platform owner/agency is
> the central operator. Tenants do not choose or manage a subdomain; they
> choose a Nigerian state, LGA, property, and available unit in the same
> hosted application. The agency manages inventory, rent settings, tenant
> review, assignment, and access from the director workspace. Client workspaces
> remain database-isolated in the current implementation; moving to one shared
> operational database would be a separate architecture/data migration and is
> not silently performed by this feature work.

---

## 1. The business problem

De-Crown Cottage is currently a single-tenant hostel management app for
two campuses in Kwara State (Malete and Ila-Orangun). A second client has
asked for a platform "exactly like this one." Rather than duplicating the
codebase per client with different credentials, the goal is to convert
De-Crown Cottage into a product: **one platform where any client can
register, get reviewed, and receive their own working instance** — their
own branding, their own locations/rooms, their own tenants, completely
isolated from every other client's data.

De-Crown Cottage itself becomes "client #1" of this new system rather
than a special case.

---

## 2. Key decisions made so far

| Decision                      | Choice                                                                                | Reasoning                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-tenancy isolation model | **Separate MongoDB database per client**, one shared Atlas cluster                    | Real data isolation (a query bug in one client's routes can't leak into another's) without the operational overhead of fully separate deployments. Appropriate at the target scale (see below) — a shared-collection + `tenantId` filter approach would be cheaper but riskier given the app stores passports, IDs, and payment proofs. |
| Client onboarding             | **Self-serve signup, but gated behind manual approval** before the platform goes live | Balances low-friction growth with keeping control over who gets a platform, especially early on.                                                                                                                                                                                                                                        |
| Pricing/billing               | **Not decided yet** — building the technical platform first                           | No Paystack/Stripe integration yet. The `Client.status` field is deliberately built to double as a future billing-status field (`trial`, `past_due`, etc.) without restructuring.                                                                                                                                                       |
| Target scale                  | **A handful of clients (3–10) over the next 6–12 months**                             | Confirms the shared-cluster/separate-DB approach is right-sized — not over- or under-engineered.                                                                                                                                                                                                                                        |
| Routing/branding              | **One hosted application; internal client routing remains**                           | Signup no longer asks the client to choose a subdomain. The platform assigns an internal client slug for the current tenant resolver; tenants select state/LGA, property, and available unit in the registration form. Custom domains remain a later decision. |
| Signup auth                   | **Custom/manual** (bcrypt + JWT + email verification code), not Firebase/Supabase     | The app already has a full identity system in MongoDB. Adding a second auth provider for just the signup flow would create two sources of truth for "who is this," and introduces a whole extra stack (Postgres, for Supabase) for one small feature. At this volume, Firebase/Supabase's scaling benefits don't apply.                 |
| Verification email            | **Resend** (transactional email API)                                                  | Generous free tier, far less setup than raw SMTP. Swappable later — the email-sending logic is isolated in one file.                                                                                                                                                                                                                    |

---

## 3. Architecture overview

### Current (single-tenant) shape

```
One Express server → One MongoDB database → One set of Admin/User records
Hardcoded: locations ["Malete", "Ila-Orangun"], branding, bank details, Terms text
```

### Target (multi-tenant) shape

```
One Express server (shared)
  → Client Management layer (Phase 1 — built)
       - Client model: business info, subdomain, status, branding, locations
       - PlatformAdmin model: your own login, separate from any client's admins
       - Signup → verify email → pending approval → (Phase 2) provisioned → active

  → Per-client data layer (Phase 2 — not started)
       - Each active Client gets its own MongoDB database
       - Admin, User, Settings, Registration models become scoped per client
       - Subdomain on each request determines which client's database to query
       - Locations, branding, bank details, Terms come from that Client's
         config instead of being hardcoded
```

### Why a two-phase build

Phase 1 (the "front door" — signup, verification, your approval queue) is
purely additive and carries zero risk to the existing De-Crown Cottage
app. Phase 2 (actually provisioning a working platform on approval) is the
part that touches core auth and data models, so it's being built second,
deliberately, once Phase 1 is proven and once the full existing codebase
(models + complete `server.js`) has been reviewed — not guessed at.

---

## 4. Data model

### `Client` (new — the top-level record per business)

- `businessName`, `contactName`, `email`, `phone`
- `subdomain` — unique, used for routing once Phase 2 lands
- `passwordHash` — the business owner's platform login
- `status` — `pending_verification → pending_approval → active`, or
  `rejected` / `suspended`
- `verified`, `verificationCodeHash`, `verificationExpires`
- `branding` — `{ logoUrl, primaryColor }`
- `bankDetails` — `{ bankName, accountName, accountNumber }` (for their receipts)
- `locations` — replaces the hardcoded `["Malete", "Ila-Orangun"]` whitelist
- `dbName` — filled in during Phase 2 provisioning

### `PlatformAdmin` (new — your login, not a client's)

- `name`, `email`, `password` (bcrypt-hashed)
- Kept as a separate model/collection deliberately, so it keeps working
  unchanged once Phase 2 splits client data into separate databases.

### Existing models (unchanged so far, will be scoped in Phase 2)

- `User` — the hostel tenant/shop record (name, email, room, session, payment info, uploaded docs)
- `Admin` — per-client staff logins (currently global, will become per-client)
- `Settings` — per-location config (rent amount, registration open/closed)
- `Registration` — (not yet reviewed in detail — part of the Phase 2 file request)

---

## 5. What's built vs. what's next

**Built (Phase 1 — Platform Foundation & Client Onboarding):**

- Backend: `Client`, `PlatformAdmin`, `PlatformStaff`, and `PlatformAudit` models
- Signup, email verification, and resend routes (`routes/platform.js`, `utils/email.js`)
- Overall platform owner auto-sync from environment (`utils/ensurePlatformOwner.js`)
- Role-based staff access (`owner`, `reviewer`, `viewer`) with audit logging (`utils/platformPermissions.js`)
- Frontend: client signup page (`ClientSignup.jsx`), platform login (`PlatformLogin.jsx`), unified platform portal (`PlatformLayout.jsx`, `PlatformOverview.jsx`, `PlatformClients.jsx`, `PlatformSettings.jsx`)

**Built (Phase 2 — Multi-Tenancy & Tenant Inventory):**

- Separate MongoDB database provisioning per approved client (`utils/provisionClient.js`)
- Request-local database scoping using `AsyncLocalStorage` and Mongoose proxies (`utils/tenantModels.js`)
- Subdomain-aware request routing with local development header fallback (`utils/tenantContext.js`)
- Dynamic property and unit management replacing hardcoded campus rooms (`models/Property.js`, `models/Unit.js`)
- Dynamic unit availability and occupancy checks in registration and admin views
- Tenant branding and business name propagation (`/tenant-config` in `App.jsx`)
- Safe De-Crown legacy data migration script with dry-run support (`migrate-legacy-tenant.js`)
- Comprehensive integration test suites passing in-memory (`tests/`)
- Central director workspace for managing properties, units, tenant records,
  application decisions, access, rent, and registration settings
- Property selection by Nigerian state and LGA, followed by available property
  and unit; legacy Malete and Ila-Orangun records remain usable without an
  automatic production-data rewrite
- Login/signup rate limits, production-safe error messages, and receipt access
  checks for unapproved applications
- CEO Control Center first slice: executive client lifecycle metrics, aggregated
  tenant/property/unit counts across active client databases, active staff count,
  recent platform activity, and safe environment-configuration readiness checks
- CEO-only aggregate data boundary; platform staff receive a reduced client
  overview without tenant-wide operational metrics or system configuration flags

**Still required before live production:**

- Configure production environment variables in Render (`PLATFORM_ROOT_DOMAIN`, Resend, Cloudinary, Atlas)
- Set up wildcard DNS and TLS certificate for `*.yourplatform.com`
- Dry-run and apply legacy De-Crown migration (`npm run migrate:legacy`)
- Run end-to-end signup-to-registration smoke test on staging environment

**Next phase (Phase 3 — Real-Estate Workflows):**

- Lease agreements and date-based occupancy
- Automated recurring invoices and payment processing (Paystack/Stripe)
- Maintenance requests and issue tracking
- Tiered subscription and billing plans

**CEO Control Center roadmap:**

- Company-wide settings with enforced behavior (platform identity, support
  contact, client signup controls, and maintenance/incident controls)
- Client lifecycle notifications, searchable audit history, and safe exports
- System health checks that verify provider reachability, not only environment
  variable presence
- Business reports based on verified leases, invoices, and recorded payments;
  rent settings and expected rent must never be presented as collected revenue

---

## 6. Open questions to resolve eventually

- **Pricing model** — subscription vs. one-time setup fee vs. still deciding. No rush, but Phase 2's provisioning step and any future billing integration depend on this being settled at some point.
- **Custom domains** — worth offering later as a premium feature once there's demand, not a day-one requirement.
- **What happens on rejection** — does a rejected business get notified by email, or just left in `rejected` status silently?

---

## 7. Tech stack (unchanged)

Node.js / Express, MongoDB Atlas, JWT auth (bcrypt password hashing),
React frontend, Cloudinary for file storage, Render for hosting,
Resend for transactional email (new, Phase 1).
