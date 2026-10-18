import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { clearAdminAuth, isTokenExpired } from "./api.js";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function getActiveSession(preferredKind = null) {
  const sessions = {
    platform: { token: sessionStorage.getItem("platformToken"), key: "platformLastActivityAt" },
    admin: { token: localStorage.getItem("token") || sessionStorage.getItem("token"), key: "adminLastActivityAt" },
    "tenant-account": { token: sessionStorage.getItem("tenantAccountToken"), key: "tenantAccountLastActivityAt" },
    tenant: { token: sessionStorage.getItem("tenantToken"), key: "tenantLastActivityAt" },
  };
  if (preferredKind) {
    const preferred = sessions[preferredKind];
    return preferred?.token ? { kind: preferredKind, ...preferred } : null;
  }
  for (const kind of ["platform", "admin", "tenant-account", "tenant"]) {
    if (sessions[kind].token) return { kind, ...sessions[kind] };
  }
  return null;
}

function clearSession(kind) {
  if (kind === "platform") {
    ["platformToken", "platformName", "platformRole", "platformLastActivityAt"].forEach((key) => sessionStorage.removeItem(key));
  } else if (kind === "admin") {
    clearAdminAuth();
    sessionStorage.removeItem("adminLastActivityAt");
    localStorage.removeItem("adminLastActivityAt");
  } else if (kind === "tenant-account") {
    ["tenantAccountToken", "tenantAccountLastActivityAt"].forEach((key) => sessionStorage.removeItem(key));
  } else if (kind === "tenant") {
    ["tenantToken", "tenantSessionExpiresAt", "tenantLastActivityAt"].forEach((key) => sessionStorage.removeItem(key));
  }
}

function loginPath(kind) {
  if (kind === "platform") return "/platform/login?session=expired";
  if (kind === "admin") return "/login?session=expired";
  if (kind === "tenant-account") return "/tenant/account?session=expired";
  return "/portal?session=expired";
}

function requiredSessionForPath(pathname) {
  if ((pathname.startsWith("/platform") && pathname !== "/platform/login") || pathname.startsWith("/operator")) return "platform";
  if (pathname.startsWith("/admin") || pathname === "/delete") return "admin";
  if (pathname === "/tenant/application") return "tenant-account";
  if (pathname === "/profile") return "tenant";
  return null;
}

export default function SessionGuard() {
  const location = useLocation();

  useEffect(() => {
    let redirecting = false;
    let lastHeartbeatAt = 0;

    function expire(session) {
      if (redirecting) return;
      redirecting = true;
      clearSession(session.kind);
      // A full replace also discards a restored BFCache view of protected data.
      window.location.replace(loginPath(session.kind));
    }

    function checkSession({ recordActivity = false } = {}) {
      const requiredKind = requiredSessionForPath(location.pathname);
      const session = getActiveSession(requiredKind);
      if (!session) {
        if (requiredKind && !redirecting) {
          redirecting = true;
          window.location.replace(loginPath(requiredKind));
        }
        return;
      }
      if (requiredKind && session.kind !== requiredKind) {
        if (!redirecting) {
          redirecting = true;
          window.location.replace(loginPath(requiredKind));
        }
        return;
      }
      if (isTokenExpired(session.token)) {
        expire(session);
        return;
      }

      const now = Date.now();
      const lastActivity = Number(sessionStorage.getItem(session.key) || 0);
      if (lastActivity && now - lastActivity >= IDLE_TIMEOUT_MS) {
        expire(session);
        return;
      }
      if (!lastActivity || recordActivity) sessionStorage.setItem(session.key, String(now));
    }

    const onActivity = () => checkSession({ recordActivity: true });
    const onRestore = () => checkSession();
    async function keepActiveSessionAlive() {
      checkSession();
      const session = getActiveSession(requiredSessionForPath(location.pathname));
      if (!session) return;
      const lastActivity = Number(sessionStorage.getItem(session.key) || 0);
      const now = Date.now();
      // Only heartbeat while the person has recently interacted. A background
      // or abandoned tab must not keep an idle session alive indefinitely.
      if (!lastActivity || now - lastActivity > 5 * 60 * 1000 || now - lastHeartbeatAt < 4 * 60 * 1000) return;
      lastHeartbeatAt = now;
      try {
        const response = await fetch("/session/heartbeat", {
          method: "POST",
          headers: { Authorization: session.token },
        });
        if (response.status === 401) expire(session);
      } catch {
        // A transient network error is handled by the next protected API call.
      }
    }
    const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll", "click"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    window.addEventListener("popstate", onRestore);
    window.addEventListener("pageshow", onRestore);
    document.addEventListener("visibilitychange", onRestore);
    const timer = window.setInterval(onRestore, 15000);
    const heartbeatTimer = window.setInterval(keepActiveSessionAlive, 60_000);
    checkSession();

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      window.removeEventListener("popstate", onRestore);
      window.removeEventListener("pageshow", onRestore);
      document.removeEventListener("visibilitychange", onRestore);
      window.clearInterval(timer);
      window.clearInterval(heartbeatTimer);
    };
  }, [location.pathname]);

  return null;
}
