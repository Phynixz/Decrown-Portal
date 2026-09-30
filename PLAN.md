# De-Crown Cottage → Multi-Tenant SaaS Platform

**Master planning document.** This is the single source of truth for the
business plan, architecture decisions, and build status. `PROGRESS.md`
tracks task-by-task status; this file explains the _why_ behind each
decision so anyone picking this up later understands the reasoning, not
just the checklist.

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
| Routing/branding              | **Subdomains** (`clientname.yourplatform.com`)                                        | Cleaner than path-based routing, feels like the client's own product. Custom domains are a later, premium-tier addition, not needed on day one.                                                                                                                                                                                         |
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

See `PROGRESS.md` for the live, checkbox-level tracker. Summary:

**Built (Phase 1):**

- Backend: `Client` + `PlatformAdmin` models, signup/verify/resend routes,
  platform-admin login, approve/reject routes (`models/Client.js`,
  `models/PlatformAdmin.js`, `routes/platform.js`, `utils/email.js`)
- One-time setup script for your own login (`create-platform-admin.js`)
- Frontend: client signup page (`ClientSignup.jsx`), your login page
  (`PlatformLogin.jsx`), your approval queue dashboard (`ApprovalQueue.jsx`)

**Still required before production:**

- Create the first `PlatformAdmin` with `create-platform-admin.js`
- Add and test Resend environment variables
- Run the complete signup-to-approval smoke test
- Deploy the verified changes to Render

**Not started (Phase 2 — blocked):**

- Actual database provisioning when a client is approved
- `clientId`/multi-database scoping of `User`, `Admin`, `Settings`, `Registration`
- Subdomain-aware request routing
- Pulling locations/branding/bank details from `Client` instead of hardcoded values

**Blocking Phase 2:** need `models/User.js`, `models/Admin.js`,
`models/Settings.js`, `models/Registration.js`, `multer.js`, and the full
`server.js` (only the top ~245 lines and bottom ~250 lines have been
reviewed so far — the middle section with most routes hasn't been seen).

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
