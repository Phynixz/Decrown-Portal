import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { getJSON } from "../../api.js";

function getPlatformToken() {
  return sessionStorage.getItem("platformToken") || "";
}

const STATUS_STYLES = {
  pending_approval: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  suspended: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300",
  pending_verification: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400",
};

function MetricCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl2 p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className={"w-10 h-10 rounded-xl flex items-center justify-center " + accent}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-ink dark:text-ink-dark tracking-tight">{value}</p>
      <p className="text-sm text-muted dark:text-muted-dark mt-0.5">{label}</p>
    </div>
  );
}

export default function PlatformOverview() {
  const [clients, setClients] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getJSON("/platform/clients", getPlatformToken());
        setClients(data);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, []);

  if (err)
    return <div className="text-sm text-red-600 dark:text-red-400">{err}</div>;
  if (!clients)
    return (
      <div className="flex items-center gap-2 text-muted dark:text-muted-dark text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );

  const counts = {
    total: clients.length,
    pending: clients.filter((c) => c.status === "pending_approval").length,
    active: clients.filter((c) => c.status === "active").length,
    rejected: clients.filter((c) => c.status === "rejected").length,
  };

  const recent = [...clients]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink dark:text-ink-dark tracking-tight">Overview</h1>
        <p className="text-sm text-muted dark:text-muted-dark mt-1">
          Everything running on the platform, at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={Building2}
          label="Total clients"
          value={counts.total}
          accent="bg-ink/5 text-ink dark:bg-white/10 dark:text-ink-dark"
        />
        <MetricCard
          icon={Clock}
          label="Pending approval"
          value={counts.pending}
          accent="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Active"
          value={counts.active}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        />
        <MetricCard
          icon={XCircle}
          label="Rejected"
          value={counts.rejected}
          accent="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
        />
      </div>

      {counts.pending > 0 && (
        <Link
          to="/platform/clients"
          className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-xl2 px-5 py-4 mb-8 hover:bg-accent/15 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Clock className="w-4.5 h-4.5 text-accent" />
            <p className="text-sm font-medium text-ink dark:text-ink-dark">
              {counts.pending} sign-up{counts.pending > 1 ? "s" : ""} waiting on your review
            </p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-accent" />
        </Link>
      )}

      <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl2 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-border-dark">
          <h2 className="text-sm font-semibold text-ink dark:text-ink-dark">Recent sign-ups</h2>
          <Link
            to="/platform/clients"
            className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
          >
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted dark:text-muted-dark flex flex-col items-center gap-2">
            <Users className="w-6 h-6 opacity-40" />
            No clients yet.
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-border-dark">
            {recent.map((c) => (
              <div key={c._id} className="flex items-center justify-between px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink dark:text-ink-dark truncate">
                    {c.businessName}
                  </p>
                  <p className="text-xs text-muted dark:text-muted-dark truncate">
                    {c.contactName} · {c.email}
                  </p>
                </div>
                <span
                  className={
                    "shrink-0 ml-4 text-xs font-medium px-2.5 py-1 rounded-full " +
                    (STATUS_STYLES[c.status] || STATUS_STYLES.suspended)
                  }
                >
                  {c.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
