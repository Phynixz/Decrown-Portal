# De-Crown Cottage — Hostel Management Portal

Hostel registration & payment portal for the Malete and Ila-Orangun campuses.

- **Backend:** Node.js / Express / MongoDB (Mongoose) — `server.js`
- **Frontend:** React (Vite) SPA styled with **Tailwind CSS v4** — `client/`

## Routes (React SPA)

| Old page (vanilla)        | New route       | Component             |
| ------------------------- | --------------- | --------------------- |
| `login.html`              | `/login`        | Admin login           |
| `form.html`               | `/register`     | Application form      |
| `admin.html`              | `/admin`        | Admin dashboard       |
| `delete.html`             | `/delete`       | Delete records        |
| `tenant-portal.html`      | `/portal`       | Tenant portal         |
| `tenant-profile.html`     | `/profile`      | Tenant profile        |
| `receipt.html?id=...`     | `/receipt?id=`  | Receipt               |
| `terms.html`              | `/terms`        | Terms & policies      |

## Running

Requirements: Node 18+, a MongoDB URI, JWT secret, and Cloudinary keys in `.env`.

```bash
# 1. Install server deps (first time only)
npm install

# 2. Build the React client
npm run build          # → client/dist

# 3. Start the server (serves the built SPA + API)
npm start
```

**Development** — run the backend and the Vite dev server with hot reload:

```bash
node server.js                     # terminal 1 (API on :3000)
npm run dev:client                 # terminal 2 (Vite on :5173, proxies API)
```

## Styling (Tailwind CSS)

- Design tokens (colors, fonts, shadows) live in `client/src/styles/index.css`
  as a Tailwind `@theme`, so the palette is available as utilities
  (`bg-navy`, `text-terra`, `border-border`, …).
- Dark mode uses a `dark` class on `<html>` via `@custom-variant dark` — the
  same key (`localStorage.theme`) as the old app.
- Page-specific component styles are Tailwind `@apply` rules in
  `client/src/styles/*.css`, loaded per page.

## Notes

- Auth storage keys (`token`, `adminName`, `adminRole`, `tenantToken`, `theme`)
  are unchanged, so sessions from the old app still work.
- The legacy vanilla-JS pages (formerly in `public/`) have been removed;
  the React app in `client/` is the only frontend.
- The admin UI now calls two newly added backend routes, `/revoke/:id` and
  `/reinstate/:id`, that the old UI referenced but the backend never implemented.
