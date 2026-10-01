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
  const rootDomain = normalizeRootDomain(process.env.PLATFORM_ROOT_DOMAIN);
  const localHost =
    process.env.NODE_ENV !== "production"
      ? req.headers["x-local-tenant-host"]
      : "";
  const hostname = String(localHost || req.hostname || "")
    .split(":")[0]
    .toLowerCase();
  let subdomain = "";
  if (
    process.env.NODE_ENV !== "production" &&
    (req.query?.client || req.headers["x-client-subdomain"])
  ) {
    subdomain = String(
      req.query?.client || req.headers["x-client-subdomain"] || "",
    )
      .trim()
      .toLowerCase();
  } else {
    if (
      !rootDomain ||
      hostname === rootDomain ||
      hostname === `www.${rootDomain}`
    )
      return next();

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
    runWithTenantModels(getTenantModels(client.dbName), next);
  } catch (error) {
    next(error);
  }
}

module.exports = resolveTenant;
