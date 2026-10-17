import { useEffect, useState, useCallback, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Loader2,
  Mail,
  Phone,
  Globe,
  CalendarDays,
  Users,
  Settings2,
  ChevronRight,
  X,
  Search,
  Building2,
  UserCheck,
  UserX,
  BarChart3,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getJSON, sendJSON } from "../../api.js";
import OperationsWorkspace from "../OperationsWorkspace.jsx";

function getPlatformToken() {
  return sessionStorage.getItem("platformToken") || "";
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending_approval", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
];

const STATUS_STYLES = {
  pending_approval:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  active:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  suspended: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300",
  pending_verification:
    "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400",
};

// ─── Tenant Drawer ────────────────────────────────────────────────────────────
function LegacyTenantDrawer({ client, onClose }) {
  const [tab, setTab] = useState("users"); // "users" | "properties"
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [props, setProps] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingProps, setLoadingProps] = useState(false);
  const [busyUserId, setBusyUserId] = useState("");
  const [err, setErr] = useState("");

  const token = getPlatformToken();
  const base = `/platform/tenants/${client._id}`;

  // Load stats on mount
  useEffect(() => {
    getJSON(`${base}/stats`, token)
      .then(setStats)
      .catch(() => {});
  }, [client._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load users whenever search / filter / page changes
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams({ page, limit: 50 });
      if (search) qs.set("search", search);
      if (statusFilter) qs.set("status", statusFilter);
      const data = await getJSON(`${base}/users?${qs}`, token);
      setUsers(data.users);
      setTotalUsers(data.total);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [base, page, search, statusFilter, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "users") loadUsers();
  }, [tab, loadUsers]);

  // Load properties on tab switch
  useEffect(() => {
    if (tab !== "properties") return;
    setLoadingProps(true);
    getJSON(`${base}/properties`, token)
      .then(setProps)
      .catch(() => {})
      .finally(() => setLoadingProps(false));
  }, [tab, base, token]);

  async function toggleUserStatus(user) {
    const next = user.status === "active" ? "revoked" : "active";
    if (
      !confirm(
        `${next === "revoked" ? "Revoke" : "Reinstate"} ${user.name}? This takes effect immediately.`,
      )
    )
      return;
    setBusyUserId(user._id);
    try {
      await sendJSON("PUT", `${base}/users/${user._id}`, { status: next }, token);
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, status: next } : u)),
      );
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setBusyUserId("");
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalUsers / 50));

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative z-10 w-full max-w-2xl h-full bg-surface dark:bg-surface-dark shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-border-dark shrink-0">
          <div>
            <h2 className="text-base font-bold text-ink dark:text-ink-dark">
              {client.businessName}
            </h2>
            <p className="text-xs text-muted dark:text-muted-dark mt-0.5">
              {client.subdomain} · {client.locations?.join(", ")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-muted dark:text-muted-dark"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="flex gap-4 px-6 py-3 bg-card dark:bg-card-dark border-b border-border dark:border-border-dark text-xs shrink-0">
            {[
              { icon: Users, label: "Total", val: stats.totalUsers },
              { icon: UserCheck, label: "Active", val: stats.activeUsers, cls: "text-emerald-600 dark:text-emerald-400" },
              { icon: UserX, label: "Revoked", val: stats.revokedUsers, cls: "text-red-500 dark:text-red-400" },
              { icon: Building2, label: "Properties", val: stats.properties },
            ].map(({ icon: Icon, label, val, cls }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${cls || "text-muted dark:text-muted-dark"}`} />
                <span className={`font-semibold ${cls || "text-ink dark:text-ink-dark"}`}>{val}</span>
                <span className="text-muted dark:text-muted-dark">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 shrink-0">
          {[
            { key: "users", label: "Users", icon: Users },
            { key: "properties", label: "Properties", icon: Building2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={
                "flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold border-b-2 transition-colors " +
                (tab === key
                  ? "border-ink dark:border-accent text-ink dark:text-ink-dark bg-card dark:bg-card-dark"
                  : "border-transparent text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark")
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {tab === "users" && (
            <>
              {/* Search + filter */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted dark:text-muted-dark pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search by name, email or room…"
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-border dark:border-border-dark rounded-lg bg-card dark:bg-card-dark text-ink dark:text-ink-dark placeholder:text-muted dark:placeholder:text-muted-dark focus:outline-none focus:ring-2 focus:ring-ink/20 dark:focus:ring-accent/30"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="text-xs border border-border dark:border-border-dark rounded-lg bg-card dark:bg-card-dark text-ink dark:text-ink-dark px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-muted dark:text-muted-dark text-sm py-6">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : err ? (
                <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted dark:text-muted-dark py-6 text-center">No users found.</p>
              ) : (
                <div className="grid gap-2">
                  {users.map((u) => (
                    <div
                      key={u._id}
                      className="flex items-center justify-between gap-3 bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink dark:text-ink-dark truncate">{u.name}</p>
                        <p className="text-[11px] text-muted dark:text-muted-dark truncate">
                          {u.email} · {u.location} · {u.roomNo || "—"}
                        </p>
                        <p className="text-[11px] text-muted dark:text-muted-dark">{u.session}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={
                            "text-[10px] font-medium px-2 py-0.5 rounded-full " +
                            (u.status === "active"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400")
                          }
                        >
                          {u.status}
                        </span>
                        <button
                          disabled={busyUserId === u._id}
                          onClick={() => toggleUserStatus(u)}
                          title={u.status === "active" ? "Revoke access" : "Reinstate"}
                          className="p-1.5 rounded-lg border border-border dark:border-border-dark hover:bg-black/5 dark:hover:bg-white/10 text-muted dark:text-muted-dark disabled:opacity-50"
                        >
                          {busyUserId === u._id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : u.status === "active" ? (
                            <UserX className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-xs text-muted dark:text-muted-dark">
                  <span>{totalUsers} users</span>
                  <div className="flex gap-1">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="px-2.5 py-1 rounded border border-border dark:border-border-dark disabled:opacity-40 hover:text-ink dark:hover:text-ink-dark"
                    >
                      Prev
                    </button>
                    <span className="px-2.5 py-1">
                      {page} / {totalPages}
                    </span>
                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-2.5 py-1 rounded border border-border dark:border-border-dark disabled:opacity-40 hover:text-ink dark:hover:text-ink-dark"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "properties" && (
            loadingProps ? (
              <div className="flex items-center gap-2 text-muted dark:text-muted-dark text-sm py-6">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : props.length === 0 ? (
              <p className="text-sm text-muted dark:text-muted-dark py-6 text-center">No properties provisioned.</p>
            ) : (
              <div className="grid gap-4">
                {props.map((p) => (
                  <div
                    key={p._id}
                    className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-ink dark:text-ink-dark">{p.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-muted dark:text-muted-dark">
                        {p.units?.length ?? 0} units
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {(p.units || []).map((u) => (
                        <div
                          key={u._id}
                          className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-surface dark:bg-surface-dark border border-border dark:border-border-dark"
                        >
                          <span className="text-ink dark:text-ink-dark font-medium">{u.label}</span>
                          <span
                            className={
                              u.status === "occupied"
                                ? "text-amber-600 dark:text-amber-400"
                                : u.status === "available"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted dark:text-muted-dark"
                            }
                          >
                            {u.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function TenantDrawer({ client, onClose }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="workspace-drawer-title" tabIndex={-1} className="h-full w-full max-w-5xl overflow-y-auto bg-bg shadow-2xl">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 dark:border-border-dark dark:bg-card-dark">
          <h2 id="workspace-drawer-title" className="min-w-0 truncate text-sm font-semibold text-ink dark:text-ink-dark">{client.businessName} workspace</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface dark:border-border-dark dark:text-ink-dark dark:hover:bg-white/5">Close workspace <span aria-hidden="true">×</span></button>
        </div>
        <OperationsWorkspace
          directorAccess
          clientId={client._id}
          clientName={client.businessName}
        />
      </div>
    </div>
  );
}

// ─── Main PlatformClients page ────────────────────────────────────────────────
export default function PlatformClients() {
  const role = sessionStorage.getItem("platformRole");
  const isOwner = role === "owner";
  const canReview = isOwner || role === "reviewer";
  const [filter, setFilter] = useState("all");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState("");
  const [drawerClient, setDrawerClient] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const qs = filter === "all" ? "" : "?status=" + filter;
      const data = await getJSON("/platform/clients" + qs, getPlatformToken());
      setClients(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function act(id, action, confirmMsg, extra) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyId(id);
    try {
      await sendJSON(
        "PUT",
        "/platform/clients/" + id + "/" + action,
        extra || {},
        getPlatformToken(),
      );
      load();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setBusyId("");
    }
  }

  async function deleteClient(client) {
    const confirmBusinessName = prompt(
      `WARNING: This permanently deletes ${client.businessName} and its provisioned tenant database, including the client's data. This cannot be undone.\n\nType the exact business name to continue:`,
    );
    if (confirmBusinessName !== client.businessName) return;
    setBusyId(client._id);
    try {
      await fetch(`/platform/clients/${client._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getPlatformToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmBusinessName }),
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not delete client");
        return data;
      });
      await load();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink dark:text-ink-dark tracking-tight">
          Clients
        </h1>
        <p className="text-sm text-muted dark:text-muted-dark mt-1">
          Review sign-ups and manage every business on the platform.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border " +
              (filter === f.key
                ? "bg-ink text-white border-ink dark:bg-accent dark:text-ink dark:border-accent"
                : "bg-card dark:bg-card-dark text-muted dark:text-muted-dark border-border dark:border-border-dark hover:text-ink dark:hover:text-ink-dark")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted dark:text-muted-dark text-sm py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : err ? (
        <div className="text-sm text-red-600 dark:text-red-400">{err}</div>
      ) : clients.length === 0 ? (
        <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl2 py-12 text-center text-sm text-muted dark:text-muted-dark flex flex-col items-center gap-2">
          <Users className="w-6 h-6 opacity-40" />
          No clients in this list.
        </div>
      ) : (
        <div className="grid gap-3">
          {clients.map((c) => (
            <div
              key={c._id}
              className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl2 p-5 shadow-card hover:shadow-card-hover transition-shadow"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="text-sm font-semibold text-ink dark:text-ink-dark truncate">
                      {c.businessName}
                    </h3>
                    <span
                      className={
                        "text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 " +
                        (STATUS_STYLES[c.status] || STATUS_STYLES.suspended)
                      }
                    >
                      {c.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted dark:text-muted-dark mb-3">
                    Contact: {c.contactName}
                  </p>

                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted dark:text-muted-dark">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> {c.email}
                    </span>
                    {c.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> {c.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" /> {c.subdomain}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {c.status === "rejected" && c.rejectionReason && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                      Reason: {c.rejectionReason}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  {/* Platform-owner: view/manage active tenant data */}
                  {isOwner && c.workspaceReady && (
                    <>
                      <Link
                        to={`/platform/clients/${c._id}/workspace`}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink dark:bg-accent text-white dark:text-ink text-xs font-semibold transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5" /> Open workspace
                      </Link>
                      <button
                        onClick={() => setDrawerClient(c)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border dark:border-border-dark text-ink dark:text-ink-dark hover:bg-surface dark:hover:bg-white/5 text-xs font-semibold transition-colors"
                      >
                        <Settings2 className="w-3.5 h-3.5" /> Quick view
                      </button>
                    </>
                  )}

                  {canReview && c.status === "pending_approval" && (
                    <>
                      <button
                        disabled={busyId === c._id}
                        onClick={() =>
                          act(
                            c._id,
                            "approve",
                            "Approve this client and give them access?",
                          )
                        }
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        disabled={busyId === c._id}
                        onClick={() => {
                          const reason =
                            prompt("Reason for rejecting (optional):") || "";
                          act(c._id, "reject", null, { reason });
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  )}
                  {isOwner && c.status === "active" && (
                    <button
                      disabled={busyId === c._id}
                      onClick={() =>
                        act(
                          c._id,
                          "suspend",
                          `Suspend ${c.businessName}? They will lose access immediately.`,
                        )
                      }
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border dark:border-border-dark text-ink dark:text-ink-dark hover:bg-surface dark:hover:bg-white/5 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <PauseCircle className="w-3.5 h-3.5" /> Suspend
                    </button>
                  )}
                  {isOwner && c.status === "suspended" && (
                    <button
                      disabled={busyId === c._id}
                      onClick={() =>
                        act(
                          c._id,
                          "reactivate",
                          `Reactivate ${c.businessName}?`,
                        )
                      }
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink dark:bg-accent text-white dark:text-ink text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <PlayCircle className="w-3.5 h-3.5" /> Reactivate
                    </button>
                  )}
                  {isOwner && (
                    <button
                      disabled={busyId === c._id}
                      onClick={() => deleteClient(c)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete client
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tenant management drawer */}
      {drawerClient && (
        <TenantDrawer client={drawerClient} onClose={() => setDrawerClient(null)} />
      )}
    </div>
  );
}
