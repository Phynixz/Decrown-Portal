import { useEffect, useState } from "react";
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
} from "lucide-react";
import { getJSON, sendJSON } from "../../api.js";

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
  pending_approval: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  suspended: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300",
  pending_verification: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400",
};

export default function PlatformClients() {
  const [filter, setFilter] = useState("pending_approval");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState("");

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink dark:text-ink-dark tracking-tight">Clients</h1>
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
                  <p className="text-xs text-muted dark:text-muted-dark mb-3">Contact: {c.contactName}</p>

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

                <div className="flex gap-2 shrink-0">
                  {c.status === "pending_approval" && (
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
                          const reason = prompt("Reason for rejecting (optional):") || "";
                          act(c._id, "reject", null, { reason });
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  )}
                  {c.status === "active" && (
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
                  {c.status === "suspended" && (
                    <button
                      disabled={busyId === c._id}
                      onClick={() => act(c._id, "reactivate", `Reactivate ${c.businessName}?`)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink dark:bg-accent text-white dark:text-ink text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <PlayCircle className="w-3.5 h-3.5" /> Reactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
