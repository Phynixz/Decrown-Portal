import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  Home,
  LogOut,
  Moon,
  Search,
  Settings2,
  Sun,
  Users,
} from "lucide-react";
import { clearAdminAuth, getJSON, getToken, sendJSON } from "../api.js";
import { useTenant } from "../tenantContext.jsx";
import { useTheme } from "../theme.js";

const tabs = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "properties", label: "Properties", icon: Building2 },
  { id: "units", label: "Units", icon: ClipboardList },
  { id: "tenants", label: "Tenants", icon: Users },
  { id: "settings", label: "Settings", icon: Settings2 },
];

function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted" />
      <h3 className="mt-4 font-display text-xl text-text">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{text}</p>
      {action}
    </div>
  );
}

function Panel({ title, eyebrow, children, action }) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-terra">{eyebrow}</p>}
          <h2 className="mt-1 font-display text-xl text-text">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Metric({ label, value, icon: Icon, detail }) {
  return (
    <div className="border-b border-border p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex items-center justify-between text-muted"><span className="text-[10px] font-semibold uppercase tracking-[0.14em]">{label}</span><Icon className="h-4 w-4" /></div>
      <p className="mt-3 font-mono text-3xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

export default function OperationsWorkspace({ readOnly = false, clientId = "", clientName = "" }) {
  const navigate = useNavigate();
  const { dark, toggleTheme } = useTheme();
  const tenant = useTenant();
  const [tab, setTab] = useState("overview");
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const token = readOnly ? sessionStorage.getItem("platformToken") || "" : getToken();
  const base = readOnly ? `/platform/tenants/${clientId}` : "";
  const api = (path) => `${base}${path}`;

  useEffect(() => {
    if (!readOnly && !token) {
      navigate("/login", { replace: true });
      return;
    }
    if (readOnly && (!clientId || !token)) return;
    setLoading(true);
    setError("");
    const propertyRequest = getJSON(api(readOnly ? "/properties" : "/admin/properties"), token);
    const tenantRequest = readOnly
      ? getJSON(api("/users"), token)
      : getJSON("/users", token);
    const statsRequest = readOnly ? getJSON(api("/stats"), token) : Promise.resolve(null);
    Promise.all([propertyRequest, tenantRequest, statsRequest])
      .then(([propertyData, tenantData, statsData]) => {
        setProperties(Array.isArray(propertyData) ? propertyData : []);
        setTenants(readOnly ? tenantData?.users || [] : Array.isArray(tenantData) ? tenantData : []);
        setStats(statsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clientId, navigate, readOnly]);

  function logout() {
    clearAdminAuth();
    navigate("/login", { replace: true });
  }

  async function runTenantAction(action, body = {}) {
    if (!selectedTenant || readOnly) return;
    setActionBusy(true);
    try {
      await sendJSON("PUT", `/${action}/${selectedTenant._id}`, body, token);
      const updates = action === "approve-retain"
        ? { retainPending: false }
        : action === "disapprove"
          ? { retainPending: false, disapproved: true, disapprovalReason: body.reason }
          : action === "revoke"
            ? { status: "revoked", revokeReason: body.reason }
            : { status: "active", revokeReason: null };
      setTenants((current) => current.map((tenantRecord) => tenantRecord._id === selectedTenant._id ? { ...tenantRecord, ...updates } : tenantRecord));
      setSelectedTenant((current) => ({ ...current, ...updates }));
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  }

  const units = properties.flatMap((property) => (property.units || []).map((unit) => ({ ...unit, propertyName: property.name })));
  const occupiedUnitIds = new Set(tenants.map((tenantRecord) => String(tenantRecord.unitId)).filter(Boolean));
  const filteredTenants = tenants.filter((tenantRecord) => {
    const haystack = `${tenantRecord.name || ""} ${tenantRecord.email || ""} ${tenantRecord.roomNo || ""} ${tenantRecord.location || ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const displayName = readOnly ? clientName : tenant.businessName;

  return (
    <div className="min-h-screen bg-bg font-sans text-text">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to={readOnly ? "/platform/clients" : "/admin"} className="flex items-center gap-2.5 no-underline">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-white"><Building2 className="h-4 w-4" /></div>
            <div><p className="font-display text-lg leading-none text-text">Operations</p><p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">{displayName || "Property workspace"}</p></div>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-text" title="Toggle theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            {!readOnly && <button onClick={logout} className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted hover:text-text sm:flex"><LogOut className="h-3.5 w-3.5" /> Sign out</button>}
          </div>
        </div>
      </header>

      {readOnly && <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">Viewing: <strong>{clientName}</strong> · read-only</div>}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-terra">{readOnly ? "Client inspection" : "Business operations"}</p><h1 className="mt-2 font-display text-3xl text-text sm:text-4xl">Run the property, clearly.</h1><p className="mt-2 max-w-xl text-sm text-muted">Properties, units, tenants, and settings in one working view.</p></div>
          {!readOnly && <Link to="/admin/properties/new" className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy2">Add property <ChevronRight className="h-4 w-4" /></Link>}
        </div>

        {error && <div className="mb-6 rounded-lg border-l-4 border-danger bg-danger-faint px-4 py-3 text-sm text-danger">{error}</div>}

        <div className="mb-7 flex gap-1 overflow-x-auto border-b border-border">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${tab === id ? "border-navy text-navy" : "border-transparent text-muted hover:text-text"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>

        {loading ? <div className="grid gap-4 md:grid-cols-3"><div className="h-32 animate-pulse rounded-2xl bg-card2" /><div className="h-32 animate-pulse rounded-2xl bg-card2" /><div className="h-32 animate-pulse rounded-2xl bg-card2" /></div> : tab === "overview" ? (
          <div className="space-y-6">
            <section className="grid overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-2 lg:grid-cols-4"><Metric label="Properties" value={stats?.properties ?? properties.length} detail="In this workspace" icon={Building2} /><Metric label="Units" value={stats?.units ?? units.length} detail={`${units.filter((unit) => unit.status === "available").length} available`} icon={ClipboardList} /><Metric label="Tenants" value={stats?.totalUsers ?? tenants.length} detail="Tenant records" icon={Users} /><Metric label="Occupied" value={occupiedUnitIds.size} detail="Assigned units" icon={CheckCircle2} /></section>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Panel title="Portfolio pulse" eyebrow="At a glance"><div className="space-y-4">{properties.slice(0, 4).map((property) => <div key={property._id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"><div><p className="text-sm font-semibold text-text">{property.name}</p><p className="mt-1 text-xs text-muted">{property.address || "Address not added"}</p></div><span className="text-xs text-muted">{(property.units || []).length} units</span></div>)}{properties.length === 0 && <EmptyState icon={Building2} title="No properties yet" text="Add your first property to start managing units and tenants." action={!readOnly && <Link to="/admin/properties/new" className="mt-5 inline-flex rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Add property</Link>} />}</div></Panel>
              <Panel title="Next actions" eyebrow="Keep moving"><div className="space-y-3 text-sm">{properties.length === 0 && <p className="rounded-lg bg-surface px-3 py-3 text-muted">Create a property before adding units.</p>}{properties.length > 0 && units.length === 0 && <p className="rounded-lg bg-surface px-3 py-3 text-muted">Add units to make spaces available for tenants.</p>}{tenants.length === 0 && <p className="rounded-lg bg-surface px-3 py-3 text-muted">No tenant records yet.</p>}{properties.length > 0 && units.length > 0 && tenants.length > 0 && <p className="rounded-lg bg-success-faint px-3 py-3 text-success">Your core workspace is active.</p>}</div></Panel>
            </div>
          </div>
        ) : tab === "properties" ? (
          <Panel title="Properties" eyebrow="Your portfolio" action={!readOnly && <Link to="/admin/properties/new" className="text-sm font-semibold text-navy">Add property</Link>}>
            {properties.length === 0 ? <EmptyState icon={Building2} title="No properties yet" text="Your property list is empty. Add the first one to begin." action={!readOnly && <Link to="/admin/properties/new" className="mt-5 inline-flex rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Add property</Link>} /> : <div className="grid gap-4 md:grid-cols-2">{properties.map((property) => <article key={property._id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-lg">{property.name}</h3><p className="mt-1 text-xs text-muted">{property.address || "Address not added"}</p></div><span className="rounded-full bg-surface px-2 py-1 text-[10px] font-semibold text-muted">{property.status}</span></div><div className="mt-4 flex gap-5 border-t border-border pt-3 text-xs text-muted"><span>{(property.units || []).length} units</span><span>{(property.units || []).filter((unit) => unit.status === "available").length} available</span></div></article>)}</div>}
          </Panel>
        ) : tab === "units" ? (
          <Panel title="Units" eyebrow="Grouped by property">{units.length === 0 ? <EmptyState icon={ClipboardList} title="No units yet" text="Units will appear here once they are added to a property." /> : <div className="grid gap-5 md:grid-cols-2">{properties.map((property) => <div key={property._id}><h3 className="mb-2 font-display text-lg">{property.name}</h3><div className="space-y-2">{(property.units || []).map((unit) => <div key={unit._id} className="flex items-center justify-between rounded-lg border border-border px-3 py-3"><div><p className="text-sm font-semibold">{unit.label}</p><p className="mt-1 text-[11px] text-muted">{unit.unitType} · {unit.rentAmount == null ? "Rent not set" : `₦${Number(unit.rentAmount).toLocaleString()}`}</p></div><span className={`text-[11px] font-semibold ${unit.status === "available" ? "text-success" : "text-muted"}`}>{unit.status}</span></div>)}</div></div>)}</div>}</Panel>
        ) : tab === "tenants" ? (
          <Panel title="Tenants" eyebrow="People in your properties"><div className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2"><Search className="h-4 w-4 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, room, or property" className="w-full bg-transparent text-sm outline-none placeholder:text-muted" /></div>{filteredTenants.length === 0 ? <EmptyState icon={Users} title={tenants.length === 0 ? "No tenants yet" : "No tenants match your search"} text={tenants.length === 0 ? "Tenant records will appear here after registration." : "Try a different search term."} /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs uppercase tracking-wide text-muted"><tr><th className="px-3 py-3">Tenant</th><th className="px-3 py-3">Property</th><th className="px-3 py-3">Unit</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Review</th></tr></thead><tbody className="divide-y divide-border">{filteredTenants.map((tenantRecord) => <tr key={tenantRecord._id} className="cursor-pointer hover:bg-surface" onClick={() => setSelectedTenant(tenantRecord)}><td className="px-3 py-3"><p className="font-semibold">{tenantRecord.name || "Unnamed tenant"}</p><p className="mt-1 text-xs text-muted">{tenantRecord.email || "No email"}</p></td><td className="px-3 py-3 text-muted">{tenantRecord.location || "—"}</td><td className="px-3 py-3 text-muted">{tenantRecord.roomNo || "—"}</td><td className="px-3 py-3"><span className="rounded-full bg-surface px-2 py-1 text-[11px] font-semibold">{tenantRecord.status || "active"}</span></td><td className="px-3 py-3 text-xs font-semibold text-navy">View record</td></tr>)}</tbody></table></div>}</Panel>
        ) : (
          <Panel title="Settings" eyebrow="Workspace configuration"><div className="rounded-xl border border-dashed border-border px-5 py-8 text-sm text-muted">Property-specific registration and rent controls remain available in the operations tools. This workspace will surface them here as those settings become property-scoped.</div></Panel>
        )}

        {selectedTenant && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 p-0 backdrop-blur-sm" onClick={(event) => event.target === event.currentTarget && setSelectedTenant(null)}>
            <aside className="h-full w-full max-w-xl overflow-y-auto bg-card p-6 shadow-2xl sm:p-8">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-terra">Tenant record</p><h2 className="mt-2 font-display text-2xl">{selectedTenant.name || "Unnamed tenant"}</h2><p className="mt-1 text-sm text-muted">{selectedTenant.email || "No email"} · {selectedTenant.phone || "No phone"}</p></div><button onClick={() => setSelectedTenant(null)} className="text-2xl text-muted" aria-label="Close tenant record">×</button></div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted">Property</p><p className="mt-1 font-semibold">{selectedTenant.location || "—"}</p></div><div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted">Unit</p><p className="mt-1 font-semibold">{selectedTenant.roomNo || "—"}</p></div><div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted">Session</p><p className="mt-1 font-semibold">{selectedTenant.session || "—"}</p></div><div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted">Status</p><p className="mt-1 font-semibold">{selectedTenant.status || "active"}</p></div></div>
              <div className="mt-8"><h3 className="font-display text-lg">Documents</h3><div className="mt-3 space-y-2">{[["passport", "Passport photo"], ["idCard", "ID card"], ["paymentProof", "Payment proof"], ["agreementCopy", "Agreement"]].map(([field, label]) => selectedTenant[field] ? <a key={field} href={selectedTenant[field]} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg border border-border px-3 py-3 text-sm font-semibold text-navy hover:bg-surface"><span className="flex items-center gap-2"><FileText className="h-4 w-4" />{label}</span><ExternalLink className="h-3.5 w-3.5" /></a> : <div key={field} className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted"><span>{label}</span><span>Not uploaded</span></div>)}</div></div>
              {!readOnly && <div className="mt-8 border-t border-border pt-6"><h3 className="font-display text-lg">Actions</h3><div className="mt-3 flex flex-wrap gap-2">{selectedTenant.retainPending && <button disabled={actionBusy} onClick={() => runTenantAction("approve-retain")} className="rounded-lg bg-success px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve tenant</button>}{selectedTenant.retainPending && <button disabled={actionBusy} onClick={() => runTenantAction("disapprove", { reason: "Documents require review" })} className="rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Reject</button>}{selectedTenant.status === "revoked" ? <button disabled={actionBusy} onClick={() => runTenantAction("reinstate")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">Reinstate access</button> : <button disabled={actionBusy} onClick={() => runTenantAction("revoke", { reason: "Revoked from operations workspace" })} className="rounded-lg border border-danger px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50">Revoke access</button>}</div></div>}
              {readOnly && <p className="mt-8 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Read-only inspection: document and approval actions are disabled.</p>}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
