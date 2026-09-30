import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function tenantAwareProxy(options = {}) {
  return {
    target: "http://localhost:3000",
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq, request) => {
        const host = request.headers.host || "";
        proxyReq.setHeader("x-local-tenant-host", host.split(":")[0]);
      });
    },
    ...options,
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      // Forward API requests to the Express backend during dev.
      // Note: only /admin/* API endpoints are proxied — the /admin page
      // itself is a client-side route served by Vite.
      "/admin/login": tenantAwareProxy(),
      "/admin/list": tenantAwareProxy(),
      "/admin/create": tenantAwareProxy(),
      "/admin/grant-reupload": tenantAwareProxy(),
      "/admin/get-amounts": tenantAwareProxy(),
      "/admin/properties": tenantAwareProxy(),
      "/admin/set-registration": tenantAwareProxy(),
      "/admin/set-amount": tenantAwareProxy(),
      "/admin/user": tenantAwareProxy(),
      "/tenant/login": tenantAwareProxy(),
      "/tenant/me": tenantAwareProxy(),
      "/tenant/history": tenantAwareProxy(),
      "/tenant/retain": tenantAwareProxy(),
      "/tenant/upload-retain-proof": tenantAwareProxy(),
      "/tenant/reupload": tenantAwareProxy(),
      "/current-session": tenantAwareProxy(),
      "/tenant-config": tenantAwareProxy(),
      "/current-amount": tenantAwareProxy(),
      "/user": tenantAwareProxy(),
      "/submit": tenantAwareProxy(),
      "/users": tenantAwareProxy(),
      "/renew": tenantAwareProxy(),
      "/approve-retain": tenantAwareProxy(),
      "/disapprove": tenantAwareProxy(),
      "/revoke": tenantAwareProxy(),
      "/reinstate": tenantAwareProxy(),
      "/export-users": tenantAwareProxy(),
      "/client/signup": tenantAwareProxy(),
      "/client/verify-email": tenantAwareProxy(),
      "/client/resend-code": tenantAwareProxy(),
      "/platform/login": tenantAwareProxy({
        bypass(req) {
          if (req.method === "GET") return req.url;
        },
      }),
      "/platform/clients": tenantAwareProxy({
        bypass(req) {
          if (req.method === "GET" && !req.headers.authorization)
            return req.url;
        },
      }),
    },
  },
});
