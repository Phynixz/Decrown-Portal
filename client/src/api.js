/**
 * API helpers — same endpoints and auth storage keys as the original
 * vanilla-JS app, so existing sessions stay valid.
 */

export function getToken() {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  return token ? (token.startsWith("Bearer ") ? token : "Bearer " + token) : "";
}

export function getAdminName() {
  return (
    localStorage.getItem("adminName") || sessionStorage.getItem("adminName") || ""
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
  store.setItem("token", "Bearer " + token);
  store.setItem("adminName", name);
  store.setItem("adminRole", role);
}

export function clearAdminAuth() {
  ["token", "adminName", "adminRole"].forEach((k) => {
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
}

export function clearTenantToken() {
  sessionStorage.removeItem("tenantToken");
}

/** GET JSON with optional auth header. */
export async function getJSON(url, token) {
  const res = await fetch(url, {
    headers: token ? { Authorization: token } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/** POST/PUT/DELETE JSON with optional auth header. */
export async function sendJSON(method, url, body, token) {
  const res = await fetch(url, {
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
