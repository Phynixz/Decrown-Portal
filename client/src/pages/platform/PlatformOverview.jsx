import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock3,
  Cloud,
  Database,
  Mail,
  RefreshCw,
  ShieldCheck,
  Users,
  UserCheck,
  XCircle,
} from "lucide-react";
import { getJSON } from "../../api.js";

function getPlatformToken() {
  return sessionStorage.getItem("platformToken") || "";
}

const STATUS_STYLES = {
  pending_approval: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  pending_verification: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  suspended: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300",
};

function MetricCard({ icon: Icon, label, value, detail, accent }) {
  return (
    <div className="rounded-xl2 border border-border bg-card p-5 shadow-card dark:border-border-dark dark:bg-card-dark">
      <div className="mb-4 flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">{value ?? "—"}</p>
      <p className="mt-0.5 text-sm text-muted dark:text-muted-dark">{label}</p>
      {detail && <p className="mt-2 text-xs text-muted dark:text-muted-dark">{detail}</p>}
    </div>
  );
}

function SystemCheck({ icon: Icon, label, ready, note }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 rounded-lg bg-surface p-2 dark:bg-white/5">
        <Icon className="h-4 w-4 text-muted dark:text-muted-dark" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink dark:text-ink-dark">{label}</p>
        <p className="mt-0.5 text-xs text-muted dark:text-muted-dark">{note}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${ready ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"}`}>
        {ready ? "Configured" : "Check setup"}
      </span>
    </div>
  );
}

function formatAction(action = "Platform activity") {
  return action
    .replace(/^platform:/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PlatformOverview() {
  const isOwner = sessionStorage.getItem("platformRole") === "owner";
  const [overview, setOverview] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await getJSON("/platform/overview", getPlatformToken());
      setOverview(data);
    } catch (error) {
      setErr(error.message || "Unable to load the CEO overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  if (loading && !overview) {
    return <div className="flex items-center gap-2 text-sm text-muted dark:text-muted-dark"><RefreshCw className="h-4 w-4 animate-spin" /> Loading CEO control center…</div>;
  }

  if (err && !overview) {
    return (
      <div className="max-w-xl rounded-xl2 border border-red-200 bg-card p-6 dark:border-red-900 dark:bg-card-dark">
        <p className="font-semibold text-ink dark:text-ink-dark">The overview could not load</p>
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>
        <button onClick={loadOverview} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white dark:bg-accent dark:text-ink"><RefreshCw className="h-4 w-4" /> Try again</button>
      </div>
    );
  }

  const clients = overview?.clients || {};
  const operations = overview?.operations || {};
  const system = overview?.system || {};

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{isOwner ? "Executive control center" : "Platform workspace"}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">{isOwner ? "CEO overview" : "Client overview"}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted dark:text-muted-dark">{isOwner ? "A platform-wide view of client growth, property operations, access, and technical readiness." : "Review client onboarding activity and businesses registered on the platform."}</p>
        </div>
        <button onClick={loadOverview} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface disabled:opacity-60 dark:border-border-dark dark:bg-card-dark dark:text-ink-dark dark:hover:bg-white/5">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh data
        </button>
      </header>

      {err && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">Some information may be out of date: {err}</p>}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink dark:text-ink-dark">Business overview</h2>
          <Link to="/platform/clients" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">Manage clients <ArrowUpRight className="h-3 w-3" /></Link>
        </div>
        <div className={`grid grid-cols-2 gap-4 ${isOwner ? "xl:grid-cols-4" : "xl:grid-cols-2"}`}>
          <MetricCard icon={Building2} label="Total client businesses" value={clients.total} detail={`${clients.active || 0} currently active`} accent="bg-ink/5 text-ink dark:bg-white/10 dark:text-ink-dark" />
          <MetricCard icon={Clock3} label="Awaiting review" value={(clients.pendingVerification || 0) + (clients.pendingApproval || 0)} detail={`${clients.pendingVerification || 0} need email verification · ${clients.pendingApproval || 0} need approval`} accent="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" />
          {isOwner && <MetricCard icon={UserCheck} label="Registered tenants" value={operations.tenants} detail={`${operations.activeTenants || 0} marked active`} accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" />}
          {isOwner && <MetricCard icon={Users} label="Active platform staff" value={overview?.staff?.active} detail="Active reviewer and viewer accounts; CEO excluded" accent="bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" />}
        </div>
      </section>

      {(clients.pendingVerification > 0 || clients.pendingApproval > 0) && (
        <Link to="/platform/clients" className="flex items-center justify-between gap-4 rounded-xl2 border border-amber-300 bg-amber-50/70 px-5 py-4 transition-colors hover:bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/5 dark:hover:bg-amber-500/10">
          <div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="text-sm font-semibold text-ink dark:text-ink-dark">Client applications need attention</p><p className="mt-1 text-xs text-muted dark:text-muted-dark">Review new businesses before granting access to their workspaces.</p></div></div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
        </Link>
      )}

      {isOwner && <section>
        <h2 className="mb-3 text-sm font-semibold text-ink dark:text-ink-dark">Property operations across active clients</h2>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MetricCard icon={Building2} label="Properties" value={operations.properties} detail="Across provisioned active clients" accent="bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400" />
          <MetricCard icon={Users} label="Units / rooms" value={operations.units} detail="Total inventory records" accent="bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" />
          <MetricCard icon={CheckCircle2} label="Active businesses" value={clients.active} detail="Currently enabled on platform" accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" />
          <MetricCard icon={XCircle} label="Suspended businesses" value={clients.suspended} detail={`${clients.rejected || 0} rejected applications`} accent="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" />
        </div>
        {operations.unavailableWorkspaces > 0 && <p className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="h-4 w-4 shrink-0" /> {operations.unavailableWorkspaces} active client workspace(s) could not be counted. Check their database connectivity before relying on these totals.</p>}
      </section>}

      <section className={`grid gap-6 ${isOwner ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}>
        <div className="overflow-hidden rounded-xl2 border border-border bg-card shadow-card dark:border-border-dark dark:bg-card-dark">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-border-dark"><h2 className="text-sm font-semibold text-ink dark:text-ink-dark">Recently joined businesses</h2><Link to="/platform/clients" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">View clients <ArrowUpRight className="h-3 w-3" /></Link></div>
          {!overview?.recentClients?.length ? <p className="px-5 py-8 text-center text-sm text-muted dark:text-muted-dark">No client applications yet.</p> : <div className="divide-y divide-border dark:divide-border-dark">{overview.recentClients.map((client) => <div key={client._id} className="flex items-center justify-between gap-3 px-5 py-3.5"><div className="min-w-0"><p className="truncate text-sm font-medium text-ink dark:text-ink-dark">{client.businessName}</p><p className="mt-0.5 truncate text-xs text-muted dark:text-muted-dark">{client.contactName} · {client.email}</p><p className="mt-1 text-xs text-muted dark:text-muted-dark">Joined {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "date unavailable"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[client.status] || STATUS_STYLES.suspended}`}>{(client.status || "unknown").replace(/_/g, " ")}</span></div>)}</div>}
        </div>

        {isOwner && <div className="rounded-xl2 border border-border bg-card p-5 shadow-card dark:border-border-dark dark:bg-card-dark">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold text-ink dark:text-ink-dark">System readiness</h2><ShieldCheck className="h-4 w-4 text-accent" /></div>
          <p className="mb-2 text-xs text-muted dark:text-muted-dark">Configuration checks only; they do not replace live provider delivery tests.</p>
          <div className="divide-y divide-border dark:divide-border-dark">
            <SystemCheck icon={Database} label="MongoDB connection" ready={system.databaseConnected} note="Platform metadata database connection" />
            <SystemCheck icon={ShieldCheck} label="Authentication secret" ready={system.jwtConfigured} note="Secret is present and meets the minimum length check" />
            <SystemCheck icon={Mail} label="Transactional email" ready={system.emailConfigured} note="Resend key and sender address are configured" />
            <SystemCheck icon={Cloud} label="Document storage" ready={system.cloudStorageConfigured} note="Cloudinary credentials are present" />
          </div>
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface p-3 text-xs text-muted dark:bg-white/5 dark:text-muted-dark"><Activity className="h-4 w-4 shrink-0" /> A configured status confirms environment values exist, not that external services are reachable or fully operational.</p>
        </div>}
      </section>

      {isOwner && <section className="overflow-hidden rounded-xl2 border border-border bg-card shadow-card dark:border-border-dark dark:bg-card-dark">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-border-dark"><div><h2 className="text-sm font-semibold text-ink dark:text-ink-dark">Platform activity</h2><p className="mt-1 text-xs text-muted dark:text-muted-dark">Recent sign-ins and administrative actions</p></div><Link to="/platform/settings" className="text-xs font-medium text-accent hover:underline">Open security & audit</Link></div>
        {!overview?.recentActivity?.length ? <p className="px-5 py-8 text-center text-sm text-muted dark:text-muted-dark">No activity recorded yet.</p> : <div className="divide-y divide-border dark:divide-border-dark">{overview.recentActivity.map((event) => <div key={event._id} className="grid gap-1 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><p className="text-sm font-medium text-ink dark:text-ink-dark">{formatAction(event.action)}</p><p className="mt-0.5 text-xs text-muted dark:text-muted-dark">{event.actorName || event.actorEmail} · {event.actorRole}</p></div><time className="text-xs text-muted dark:text-muted-dark sm:text-right">{event.createdAt ? new Date(event.createdAt).toLocaleString() : "Time unavailable"}</time></div>)}</div>}
      </section>}
    </div>
  );
}
