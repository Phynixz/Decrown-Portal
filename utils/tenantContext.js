const Client = require("../models/Client");
const { getTenantModels, runWithTenantModels } = require("./tenantModels");

function normalizeRootDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

async function resolveTenant(req, res, next) {
  // A browser document navigation must be able to load the React SPA even if
  // the browser still has a tenantSubdomain cookie from a different database
  // or an inactive tenant. Resolve tenant context on API requests instead;
  // otherwise a stale cookie can turn every client-side URL (/, /rooms,
  // /signup, /operator, etc.) into a server-side 404 before the SPA fallback.
  const accept = String(req.headers.accept || "").toLowerCase();
  if (req.method === "GET" && accept.includes("text/html")) return next();

  const rootDomain = normalizeRootDomain(process.env.PLATFORM_ROOT_DOMAIN);
  const localHost =
    process.env.NODE_ENV !== "production"
      ? req.headers["x-local-tenant-host"]
      : "";
  const hostname = String(localHost || req.hostname || "")
    .split(":")[0]
    .toLowerCase();
  const isRootHost =
    rootDomain &&
    (hostname === rootDomain || hostname === `www.${rootDomain}`);
  let subdomain = "";
  if (isRootHost) {
    subdomain = String(
      req.query?.client ||
        req.headers["x-client-subdomain"] ||
        req.cookies?.tenantSubdomain ||
        "",
    )
      .trim()
      .toLowerCase();
    if (!subdomain) return next();
  } else if (
    process.env.NODE_ENV !== "production" &&
    (req.query?.client || req.headers["x-client-subdomain"])
  ) {
    subdomain = String(
      req.query?.client || req.headers["x-client-subdomain"] || "",
    )
      .trim()
      .toLowerCase();
  } else {
    if (!rootDomain) return next();

    const suffix = `.${rootDomain}`;
    if (!hostname.endsWith(suffix)) return next();

    subdomain = hostname.slice(0, -suffix.length);
  }

  if (!subdomain || subdomain.includes(".")) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  try {
    const client = await Client.findOne({ subdomain });
    if (!client) return res.status(404).json({ error: "Tenant not found" });
    if (client.status !== "active" || !client.dbName) {
      return res.status(403).json({ error: "This platform is not active" });
    }

    req.tenantClient = client;
    res.cookie("tenantSubdomain", subdomain, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    runWithTenantModels(getTenantModels(client.dbName), next);
  } catch (error) {
    next(error);
  }
}

module.exports = resolveTenant;
