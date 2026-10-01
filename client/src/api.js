/**
 * API helpers — same endpoints and auth storage keys as the original
 * vanilla-JS app, so existing sessions stay valid.
 */

export const ADMIN_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const ADMIN_REMEMBER_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;

export function getToken() {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  return token ? (token.startsWith("Bearer ") ? token : "Bearer " + token) : "";
}

export function isTokenExpired(token) {
  if (!token) return true;
  const clean = token.replace(/^Bearer\s+/i, "");
  const payloadPart = clean.split(".")[1];
  if (!payloadPart) return false;

  try {
    const payload = JSON.parse(
      atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (!payload.exp) return false;
    return Date.now() >= Number(payload.exp) * 1000;
  } catch {
    return false;
  }
}

export function getAdminName() {
  return (
    localStorage.getItem("adminName") ||
    sessionStorage.getItem("adminName") ||
    ""
  );
}

export function getAdminRole() {
  return (
    localStorage.getItem("adminRole") ||
    sessionStorage.getItem("adminRole") ||
    "admin"
  );
}

export function setAdminAuth(token, name, role, remember) {
  const store = remember ? localStorage : sessionStorage;
  const expiry =
    Date.now() +
    (remember ? ADMIN_REMEMBER_TIMEOUT_MS : ADMIN_SESSION_TIMEOUT_MS);
  store.setItem("token", "Bearer " + token);
  store.setItem("adminName", name);
  store.setItem("adminRole", role);
  store.setItem("adminSessionExpiresAt", String(expiry));
}

export function clearAdminAuth() {
  ["token", "adminName", "adminRole", "adminSessionExpiresAt"].forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
}

export function getTenantToken() {
  const t = sessionStorage.getItem("tenantToken") || "";
  return t.startsWith("Bearer ") ? t : t ? "Bearer " + t : "";
}

export function setTenantToken(token) {
  sessionStorage.setItem("tenantToken", "Bearer " + token);
  sessionStorage.setItem(
    "tenantSessionExpiresAt",
    String(Date.now() + 24 * 60 * 60 * 1000),
  );
}

export function clearTenantToken() {
  sessionStorage.removeItem("tenantToken");
  sessionStorage.removeItem("tenantSessionExpiresAt");
}

export function getTenantSubdomain() {
  const queryClient = new URLSearchParams(window.location.search).get("client");
  if (queryClient) {
    sessionStorage.setItem("tenantSubdomain", queryClient.toLowerCase());
    return queryClient.toLowerCase();
  }
  return sessionStorage.getItem("tenantSubdomain") || "";
}

export function withTenantContext(url) {
  const subdomain = getTenantSubdomain();
  if (!subdomain || !url.startsWith("/") || url.includes("client="))
    return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}client=${encodeURIComponent(subdomain)}`;
}

/** GET JSON with optional auth header. */
export async function getJSON(url, token) {
  const res = await fetch(withTenantContext(url), {
    headers: token ? { Authorization: token } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/** POST/PUT/DELETE JSON with optional auth header. */
export async function sendJSON(method, url, body, token) {
  const res = await fetch(withTenantContext(url), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function parseJwt(token) {
  try {
    return JSON.parse(atob(token.replace("Bearer ", "").split(".")[1]));
  } catch {
    return {};
  }
}

export const fmtNaira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 });

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
