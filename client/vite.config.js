import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Forward API requests to the Express backend during dev.
      // Note: only /admin/* API endpoints are proxied — the /admin page
      // itself is a client-side route served by Vite.
      "/admin/login": "http://localhost:3000",
      "/admin/list": "http://localhost:3000",
      "/admin/create": "http://localhost:3000",
      "/admin/grant-reupload": "http://localhost:3000",
      "/admin/get-amounts": "http://localhost:3000",
      "/admin/set-registration": "http://localhost:3000",
      "/admin/set-amount": "http://localhost:3000",
      "/admin/user": "http://localhost:3000",
      "/tenant/login": "http://localhost:3000",
      "/tenant/me": "http://localhost:3000",
      "/tenant/history": "http://localhost:3000",
      "/tenant/retain": "http://localhost:3000",
      "/tenant/upload-retain-proof": "http://localhost:3000",
      "/tenant/reupload": "http://localhost:3000",
      "/current-session": "http://localhost:3000",
      "/current-amount": "http://localhost:3000",
      "/user": "http://localhost:3000",
      "/submit": "http://localhost:3000",
      "/users": "http://localhost:3000",
      "/renew": "http://localhost:3000",
      "/approve-retain": "http://localhost:3000",
      "/disapprove": "http://localhost:3000",
      "/revoke": "http://localhost:3000",
      "/reinstate": "http://localhost:3000",
      "/export-users": "http://localhost:3000",
    },
  },
});
