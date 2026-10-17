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
import { getLocalGovernments, NIGERIAN_STATES } from "../utils/nigeriaLocationData.js";

const tabs = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "properties", label: "Properties", icon: Building2 },
  { id: "units", label: "Rooms", icon: ClipboardList },
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

export default function OperationsWorkspace({ readOnly = false, directorAccess = false, clientId = "", clientName = "" }) {
  const navigate = useNavigate();
  const { dark, toggleTheme } = useTheme();
  const tenant = useTenant();
  const [tab, setTab] = useState("overview");
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [propertyForm, setPropertyForm] = useState({
    name: "",
    propertyType: "hostel",
    address: "",
    state: "",
    lga: "",
    rentAmount: "",
  });
  const [propertySaving, setPropertySaving] = useState(false);
  const [propertyUpdateId, setPropertyUpdateId] = useState("");
  const [unitDraft, setUnitDraft] = useState(null);
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitUpdateId, setUnitUpdateId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    propertyId: "",
    unitId: "",
    amount: "",
    paymentDate: "",
  });
  const [recordSaving, setRecordSaving] = useState(false);
  const [actionNotice, setActionNotice] = useState("");

  const platformView = readOnly || directorAccess;
  const canManageTenant = !readOnly || directorAccess;
  const token = platformView ? sessionStorage.getItem("platformToken") || "" : getToken();
  const base = platformView ? `/platform/tenants/${clientId}` : "";
  const api = (path) => `${base}${path}`;

  useEffect(() => {
    if (!platformView && !token) {
      navigate("/login", { replace: true });
      return;
    }
    if (platformView && (!clientId || !token)) return;
    setLoading(true);
    setError("");
    const propertyRequest = getJSON(api(platformView ? "/properties" : "/admin/properties"), token);
    const tenantRequest = platformView
      ? getJSON(api("/users"), token)
      : getJSON("/users", token);
    const statsRequest = platformView ? getJSON(api("/stats"), token) : Promise.resolve(null);
    Promise.all([propertyRequest, tenantRequest, statsRequest])
      .then(([propertyData, tenantData, statsData]) => {
        setProperties(Array.isArray(propertyData) ? propertyData : []);
        setTenants(platformView ? tenantData?.users || [] : Array.isArray(tenantData) ? tenantData : []);
        setStats(statsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clientId, navigate, platformView]);

  useEffect(() => {
    if (readOnly || tab !== "settings") return;
    let cancelled = false;
    setSettingsLoading(true);
    setSettingsMessage("");
    const settingsRequest = directorAccess
      ? getJSON(`${base}/settings`, token)
      : getJSON("/admin/get-amounts", token);
    const sessionRequest = directorAccess
      ? Promise.resolve(null)
      : getJSON("/current-session");
    Promise.all([settingsRequest, sessionRequest])
      .then(([data, sessionData]) => {
        if (cancelled) return;
        setSettings(
          (data.locations || []).map((item) => ({
            name: item.name,
            rentAmount: String(item.rentAmount ?? 0),
          })),
        );
        setRegistrationOpen(data.registrationOpen !== false);
        setCurrentSession(sessionData?.session || data.session || "");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base, directorAccess, readOnly, tab, token]);

  function logout() {
    clearAdminAuth();
    navigate("/login", { replace: true });
  }

  async function runTenantAction(action, body = {}) {
    if (!selectedTenant || !canManageTenant) return;
    setActionBusy(true);
    setActionNotice("");
    try {
      const platformUpdates = {
        "approve-retain": { retainPending: false, disapproved: false },
        disapprove: {
          retainPending: false,
          disapproved: true,
          disapprovalReason: body.reason,
        },
        revoke: { status: "revoked", revokeReason: body.reason },
        reinstate: { status: "active", revokeReason: "" },
      };
      await sendJSON(
        "PUT",
        directorAccess
          ? `${base}/users/${selectedTenant._id}`
          : `/${action}/${selectedTenant._id}`,
        directorAccess ? platformUpdates[action] : body,
        token,
      );
      const updates = action === "approve-retain"
        ? { retainPending: false }
        : action === "disapprove"
          ? { retainPending: false, disapproved: true, disapprovalReason: body.reason }
          : action === "revoke"
            ? { status: "revoked", revokeReason: body.reason }
            : { status: "active", revokeReason: null };
      setTenants((current) => current.map((tenantRecord) => tenantRecord._id === selectedTenant._id ? { ...tenantRecord, ...updates } : tenantRecord));
      setSelectedTenant((current) => ({ ...current, ...updates }));
      setActionNotice("Tenant record updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  }

  function selectTenantRecord(tenantRecord) {
    const property = properties.find(
      (item) => String(item._id) === String(tenantRecord.propertyId),
    ) || properties.find((item) => item.name === tenantRecord.location);
    const unit = property?.units?.find(
      (item) =>
        String(item._id) === String(tenantRecord.unitId) ||
        item.label === tenantRecord.roomNo,
    );
    setAssignmentForm({
      propertyId: property ? String(property._id) : "",
      unitId: unit ? String(unit._id) : "",
      amount: String(tenantRecord.amount ?? 0),
      paymentDate: String(tenantRecord.paymentDate || "").slice(0, 10),
    });
    setActionNotice("");
    setSelectedTenant(tenantRecord);
  }

  async function saveDirectorRecord(event) {
    event.preventDefault();
    if (!selectedTenant || !assignmentForm.propertyId || !assignmentForm.unitId)
      return setError("Choose an available property and unit.");
    setRecordSaving(true);
    setError("");
    setActionNotice("");
    try {
      const updated = await sendJSON(
        "PUT",
        `${base}/users/${selectedTenant._id}`,
        {
          propertyId: assignmentForm.propertyId,
          unitId: assignmentForm.unitId,
          amount: Number(assignmentForm.amount),
          paymentDate: assignmentForm.paymentDate,
        },
        token,
      );
      setTenants((current) =>
        current.map((record) =>
          record._id === updated._id ? { ...record, ...updated } : record,
        ),
      );
      setSelectedTenant(updated);
      setActionNotice("Accommodation and payment details saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordSaving(false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSettingsSaving(true);
    setSettingsMessage("");
    setError("");
    try {
      await sendJSON(
        "PUT",
        directorAccess ? `${base}/settings` : "/admin/set-amount",
        {
          locations: settings.map((item) => ({
            name: item.name,
            rentAmount: Number(item.rentAmount),
          })),
        },
        token,
      );
      setSettingsMessage("Rent settings saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function toggleRegistration() {
    setSettingsSaving(true);
    setSettingsMessage("");
    setError("");
    try {
      const result = await sendJSON(
        "PUT",
        directorAccess ? `${base}/settings` : "/admin/set-registration",
        directorAccess
          ? { registrationOpen: !registrationOpen }
          : { open: !registrationOpen },
        token,
      );
      const nextOpen = result.registrationOpen ?? !registrationOpen;
      setRegistrationOpen(nextOpen);
      setCurrentSession(result.session || currentSession);
      setSettingsMessage(
        nextOpen
          ? "Registration is open."
          : "Registration is closed.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function createDirectorProperty(event) {
    event.preventDefault();
    setPropertySaving(true);
    setError("");
    try {
      const created = await sendJSON(
        "POST",
        `${base}/properties`,
        {
          ...propertyForm,
          rentAmount:
            propertyForm.rentAmount === "" ? 0 : Number(propertyForm.rentAmount),
        },
        token,
      );
      setProperties((current) => [...current, created]);
      setPropertyForm({
        name: "",
        propertyType: "hostel",
        address: "",
        state: "",
        lga: "",
        rentAmount: "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setPropertySaving(false);
    }
  }

  async function toggleDirectorProperty(property) {
    const nextStatus = property.status === "active" ? "archived" : "active";
    setPropertyUpdateId(String(property._id));
    setError("");
    try {
      const updated = await sendJSON(
        "PUT",
        `${base}/properties/${property._id}`,
        { status: nextStatus },
        token,
      );
      setProperties((current) =>
        current.map((item) =>
          String(item._id) === String(updated._id) ? { ...item, ...updated } : item,
        ),
      );
      setSettingsMessage(`${property.name} ${nextStatus}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setPropertyUpdateId("");
    }
  }

  async function createDirectorUnit(event) {
    event.preventDefault();
    if (!unitDraft) return;
    const roomCount = Number(unitDraft.roomCount);
    if (!Number.isInteger(roomCount) || roomCount < 1 || roomCount > 500) {
      setError("Enter a number of rooms between 1 and 500.");
      return;
    }
    setUnitSaving(true);
    setError("");
    try {
      const property = properties.find((item) => String(item._id) === unitDraft.propertyId);
      if (!property) throw new Error("Select a valid hostel first.");
      const endpoint = directorAccess
        ? `${base}/properties/${unitDraft.propertyId}/units`
        : `/admin/properties/${unitDraft.propertyId}/units`;
      const existingRoomNumbers = (property.units || []).map((unit) =>
        Number(String(unit.unitCode || "").match(/^room-(\d+)$/i)?.[1] || 0),
      );
      const startAt = Math.max(0, ...existingRoomNumbers) + 1;
      const createdRooms = [];
      for (let offset = 0; offset < roomCount; offset += 1) {
        const roomNumber = startAt + offset;
        const created = await sendJSON("POST", endpoint, {
          unitCode: `room-${roomNumber}`,
          label: `Room ${roomNumber}`,
          unitType: "room",
          rentAmount: null,
        }, token);
        createdRooms.push(created);
      }
      setProperties((current) =>
        current.map((property) =>
          String(property._id) === unitDraft.propertyId
            ? { ...property, units: [...(property.units || []), ...createdRooms] }
            : property,
        ),
      );
      setUnitDraft(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUnitSaving(false);
    }
  }

  async function saveDirectorUnit(property, unit) {
    setUnitUpdateId(String(unit._id));
    setError("");
    try {
      const updated = await sendJSON(
        "PUT",
        directorAccess
          ? `${base}/properties/${property._id}/units/${unit._id}`
          : `/admin/properties/${property._id}/units/${unit._id}`,
        { status: unit.status, rentAmount: unit.rentAmount },
        token,
      );
      setProperties((current) =>
        current.map((item) =>
          String(item._id) === String(property._id)
            ? {
                ...item,
                units: item.units.map((entry) =>
                  String(entry._id) === String(updated._id)
                    ? { ...entry, ...updated }
                    : entry,
                ),
              }
            : item,
        ),
      );
      setSettingsMessage(`${updated.label} updated.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUnitUpdateId("");
    }
  }

  function updateDirectorUnit(propertyId, unitId, field, value) {
    setProperties((current) =>
      current.map((property) =>
        String(property._id) === String(propertyId)
          ? {
              ...property,
              units: property.units.map((unit) =>
                String(unit._id) === String(unitId)
                  ? { ...unit, [field]: value }
                  : unit,
              ),
            }
          : property,
      ),
    );
  }

  const units = properties.flatMap((property) => (property.units || []).map((unit) => ({ ...unit, propertyName: property.name })));
  const occupiedUnitIds = new Set(tenants.map((tenantRecord) => String(tenantRecord.unitId)).filter(Boolean));
  const filteredTenants = tenants.filter((tenantRecord) => {
    const haystack = `${tenantRecord.name || ""} ${tenantRecord.email || ""} ${tenantRecord.roomNo || ""} ${tenantRecord.location || ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const displayName = platformView ? clientName : tenant.businessName;
  const visibleTabs = readOnly ? tabs.filter((item) => item.id !== "settings") : tabs;
  const selectedProperty = properties.find(
    (property) => String(property._id) === assignmentForm.propertyId,
  );
  const currentlyOccupiedUnitIds = new Set(
    tenants
      .filter(
        (record) =>
          String(record._id) !== String(selectedTenant?._id) &&
          record.session === selectedTenant?.session &&
          record.status !== "revoked",
      )
      .map((record) => String(record.unitId))
      .filter(Boolean),
  );
  const assignableUnits = (selectedProperty?.units || []).filter(
    (unit) =>
      (unit.status === "available" ||
        String(unit._id) === assignmentForm.unitId) &&
      !currentlyOccupiedUnitIds.has(String(unit._id)),
  );

  return (
    <div className="min-h-screen bg-bg font-sans text-text">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to={platformView ? "/platform/clients" : "/admin"} className="flex items-center gap-2.5 no-underline">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-white"><Building2 className="h-4 w-4" /></div>
          <div><p className="font-display text-lg leading-none text-text">Operations</p><p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">{displayName || "Hostel workspace"}</p></div>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-text" title="Toggle theme" aria-label="Toggle theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            {!platformView && <button onClick={logout} className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted hover:text-text sm:flex"><LogOut className="h-3.5 w-3.5" /> Sign out</button>}
          </div>
        </div>
      </header>

      {readOnly && <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">Viewing: <strong>{clientName}</strong> · read-only</div>}
      {directorAccess && <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900">Director controls: <strong>{clientName}</strong></div>}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-terra">{readOnly ? "Client inspection" : "Business operations"}</p><h1 className="mt-2 font-display text-3xl text-text sm:text-4xl">Run your hostels, clearly.</h1><p className="mt-2 max-w-xl text-sm text-muted">Hostel listings, individual rooms, tenants, and settings in one working view.</p></div>
          {!platformView && <Link to="/admin/properties/new" className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy2">Add property <ChevronRight className="h-4 w-4" /></Link>}
        </div>

        {error && <div className="mb-6 rounded-lg border-l-4 border-danger bg-danger-faint px-4 py-3 text-sm text-danger">{error}</div>}
        {settingsMessage && <p role="status" className="mb-6 text-sm font-medium text-success">{settingsMessage}</p>}

        <div className="mb-7 flex gap-1 overflow-x-auto border-b border-border">{visibleTabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${tab === id ? "border-navy text-navy" : "border-transparent text-muted hover:text-text"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>

        {loading ? <div className="grid gap-4 md:grid-cols-3"><div className="h-32 animate-pulse rounded-2xl bg-card2" /><div className="h-32 animate-pulse rounded-2xl bg-card2" /><div className="h-32 animate-pulse rounded-2xl bg-card2" /></div> : tab === "overview" ? (
          <div className="space-y-6">
            <section className="grid overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-2 lg:grid-cols-4"><Metric label="Hostels" value={stats?.properties ?? properties.length} detail="In your portfolio" icon={Building2} /><Metric label="Rooms" value={stats?.units ?? units.length} detail={`${units.filter((unit) => unit.status === "available").length} available`} icon={ClipboardList} /><Metric label="Tenants" value={stats?.totalUsers ?? tenants.length} detail="Tenant records" icon={Users} /><Metric label="Occupied rooms" value={occupiedUnitIds.size} detail="Assigned rooms" icon={CheckCircle2} /></section>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Panel title="Portfolio pulse" eyebrow="At a glance"><div className="space-y-4">{properties.slice(0, 4).map((property) => <div key={property._id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"><div><p className="text-sm font-semibold text-text">{property.name}</p><p className="mt-1 text-xs text-muted">{property.address || "Address not added"}</p></div><span className="text-xs text-muted">{(property.units || []).length} units</span></div>)}{properties.length === 0 && <EmptyState icon={Building2} title="No properties yet" text="Add your first property to start managing units and tenants." action={!platformView && <Link to="/admin/properties/new" className="mt-5 inline-flex rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Add property</Link>} />}</div></Panel>
              <Panel title="Next actions" eyebrow="Keep moving"><div className="space-y-3 text-sm">{properties.length === 0 && <p className="rounded-lg bg-surface px-3 py-3 text-muted">Create a property before adding units.</p>}{properties.length > 0 && units.length === 0 && <p className="rounded-lg bg-surface px-3 py-3 text-muted">Add units to make spaces available for tenants.</p>}{tenants.length === 0 && <p className="rounded-lg bg-surface px-3 py-3 text-muted">No tenant records yet.</p>}{properties.length > 0 && units.length > 0 && tenants.length > 0 && <p className="rounded-lg bg-success-faint px-3 py-3 text-success">Your core workspace is active.</p>}</div></Panel>
            </div>
          </div>
        ) : tab === "properties" ? (
          <div className="space-y-6">
            {directorAccess && (
              <Panel title="Add property" eyebrow="Director controls">
                <form onSubmit={createDirectorProperty} className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-medium text-muted">
                    Property name
                    <input required maxLength={100} value={propertyForm.name} onChange={(event) => setPropertyForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-text" />
                  </label>
                  <label className="text-xs font-medium text-muted">
                    Property type
                    <p className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text">Hostel with individual rooms</p>
                  </label>
                  <label className="text-xs font-medium text-muted">
                    State
                    <select required value={propertyForm.state} onChange={(event) => setPropertyForm((current) => ({ ...current, state: event.target.value, lga: "" }))} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-text">
                      <option value="">Select a state</option>
                      {NIGERIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-muted">
                    Local government area
                    <select required disabled={!propertyForm.state} value={propertyForm.lga} onChange={(event) => setPropertyForm((current) => ({ ...current, lga: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-text">
                      <option value="">{propertyForm.state ? "Select an LGA" : "Select a state first"}</option>
                      {getLocalGovernments(propertyForm.state).map((lga) => <option key={lga} value={lga}>{lga}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-muted">
                    Address
                    <input maxLength={200} value={propertyForm.address} onChange={(event) => setPropertyForm((current) => ({ ...current, address: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-text" />
                  </label>
                  <label className="text-xs font-medium text-muted">
                    Default rent
                    <input type="number" min="0" step="1" value={propertyForm.rentAmount} onChange={(event) => setPropertyForm((current) => ({ ...current, rentAmount: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-text" />
                  </label>
                  <button type="submit" disabled={propertySaving} className="sm:col-span-2 justify-self-start rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{propertySaving ? "Creating…" : "Create property"}</button>
                </form>
              </Panel>
            )}
            <Panel title="Properties" eyebrow="Portfolio">
              {properties.length === 0 ? (
                <EmptyState icon={Building2} title="No properties yet" text="Add the first property to begin." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {properties.map((property) => (
                    <article key={property._id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><h3 className="font-display text-lg">{property.name}</h3><p className="mt-1 text-xs text-muted">{property.address || "Address not added"} · {property.propertyType}</p></div>
                        <span className="rounded-full bg-surface px-2 py-1 text-[10px] font-semibold text-muted">{property.status}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                        <span>{(property.units || []).length} units · {(property.units || []).filter((unit) => unit.status === "available").length} available</span>
                        {directorAccess && <button disabled={propertyUpdateId === String(property._id)} onClick={() => toggleDirectorProperty(property)} className="font-semibold text-navy disabled:opacity-50">{propertyUpdateId === String(property._id) ? "Saving…" : property.status === "active" ? "Archive" : "Reactivate"}</button>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        ) : tab === "units" ? (
          <Panel title="Rooms" eyebrow="Grouped by hostel">
            {properties.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No hostels yet" text="Create a hostel before adding rooms." />
            ) : (
              <div className="space-y-6">
                {properties.map((property) => (
                  <section key={property._id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div><h3 className="font-display text-lg">{property.name}</h3><p className="mt-1 text-xs text-muted">{(property.units || []).length} rooms</p></div>
                      {!readOnly && property.status === "active" && <button onClick={() => setUnitDraft({ propertyId: String(property._id), roomCount: "1" })} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text">Add rooms</button>}
                    </div>
                    {(property.units || []).length === 0 ? <p className="text-sm text-muted">No units configured.</p> : (
                      <div className="space-y-2">
                        {(property.units || []).map((unit) => (
                          <div key={unit._id} className="grid items-center gap-3 rounded-lg border border-border px-3 py-3 sm:grid-cols-[1fr_9rem_9rem_auto]">
                            <div><p className="text-sm font-semibold">{unit.label}</p><p className="mt-1 text-[11px] text-muted">Room · {unit.unitCode}</p></div>
                            {!readOnly ? (
                              <>
                                <select aria-label={`Status for ${unit.label}`} value={unit.status} onChange={(event) => updateDirectorUnit(property._id, unit._id, "status", event.target.value)} className="rounded-lg border border-border bg-input px-2 py-2 text-xs text-text">
                                  {["available", "maintenance", "inactive"].map((status) => <option key={status} value={status}>{status}</option>)}
                                </select>
                                <input aria-label={`Rent for ${unit.label}`} type="number" min="0" step="1" value={unit.rentAmount ?? ""} onChange={(event) => updateDirectorUnit(property._id, unit._id, "rentAmount", event.target.value === "" ? null : Number(event.target.value))} placeholder="Default rent" className="rounded-lg border border-border bg-input px-2 py-2 text-xs text-text" />
                                <button disabled={unitUpdateId === String(unit._id)} onClick={() => saveDirectorUnit(property, unit)} className="rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{unitUpdateId === String(unit._id) ? "Saving…" : "Save"}</button>
                              </>
                            ) : (
                              <span className={`text-xs font-semibold ${unit.status === "available" ? "text-success" : "text-muted"}`}>{unit.status} · {unit.rentAmount == null ? "Default rent" : `₦${Number(unit.rentAmount).toLocaleString()}`}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {!readOnly && unitDraft?.propertyId === String(property._id) && (
                      <form onSubmit={createDirectorUnit} className="mt-4 grid gap-3 rounded-lg bg-surface p-4 sm:grid-cols-2">
                        <p className="text-xs text-muted sm:col-span-2">Rooms are numbered automatically. Existing rooms will not be renamed.</p>
                        <label className="text-xs text-muted">How many rooms to add?<input required type="number" min="1" max="500" step="1" value={unitDraft.roomCount} onChange={(event) => setUnitDraft((current) => ({ ...current, roomCount: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-text" /></label>
                        <div className="flex items-end gap-2"><button type="submit" disabled={unitSaving} className="rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{unitSaving ? "Adding rooms…" : "Create rooms"}</button><button type="button" onClick={() => setUnitDraft(null)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Cancel</button></div>
                      </form>
                    )}
                  </section>
                ))}
              </div>
            )}
          </Panel>
        ) : tab === "tenants" ? (
          <Panel title="Tenants" eyebrow="People in your properties"><div className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2"><Search className="h-4 w-4 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, room, or property" className="w-full bg-transparent text-sm outline-none placeholder:text-muted" /></div>{filteredTenants.length === 0 ? <EmptyState icon={Users} title={tenants.length === 0 ? "No tenants yet" : "No tenants match your search"} text={tenants.length === 0 ? "Tenant records will appear here after registration." : "Try a different search term."} /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs uppercase tracking-wide text-muted"><tr><th className="px-3 py-3">Tenant</th><th className="px-3 py-3">Property</th><th className="px-3 py-3">Unit</th><th className="px-3 py-3">Access</th><th className="px-3 py-3">Application</th></tr></thead><tbody className="divide-y divide-border">{filteredTenants.map((tenantRecord) => <tr key={tenantRecord._id} className="cursor-pointer hover:bg-surface" onClick={() => selectTenantRecord(tenantRecord)}><td className="px-3 py-3"><p className="font-semibold">{tenantRecord.name || "Unnamed tenant"}</p><p className="mt-1 text-xs text-muted">{tenantRecord.email || "No email"}</p></td><td className="px-3 py-3 text-muted">{tenantRecord.location || "—"}</td><td className="px-3 py-3 text-muted">{tenantRecord.roomNo || "—"}</td><td className="px-3 py-3"><span className="rounded-full bg-surface px-2 py-1 text-[11px] font-semibold">{tenantRecord.status || "active"}</span></td><td className="px-3 py-3 text-xs font-semibold">{tenantRecord.disapproved ? <span className="text-danger">Not approved</span> : tenantRecord.retainPending ? <span className="text-amber-700">Pending review</span> : <span className="text-success">Approved · View record</span>}</td></tr>)}</tbody></table></div>}</Panel>
        ) : (
          <div className="space-y-6">
            <Panel
              title="Registration window"
              eyebrow="Tenant applications"
              action={
                <button
                  disabled={settingsSaving}
                  onClick={toggleRegistration}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${registrationOpen ? "border border-danger text-danger" : "bg-success text-white"}`}
                >
                  {settingsSaving
                    ? "Saving…"
                    : registrationOpen
                      ? "Close registration"
                      : "Open registration"}
                </button>
              }
            >
              {settingsLoading ? (
                <p className="text-sm text-muted">Loading registration settings…</p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text">
                      {registrationOpen ? "Applications are open" : "Applications are closed"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {currentSession ? `Current session: ${currentSession}` : "Applies to the current registration session."}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${registrationOpen ? "bg-success-faint text-success" : "bg-surface text-muted"}`}>
                    {registrationOpen ? "Open" : "Closed"}
                  </span>
                </div>
              )}
            </Panel>

            <Panel title="Default rent" eyebrow="By property">
              {settingsLoading ? (
                <p className="text-sm text-muted">Loading property settings…</p>
              ) : settings.length === 0 ? (
                <p className="text-sm text-muted">Add a property before setting its default rent.</p>
              ) : (
                <form onSubmit={saveSettings}>
                  <div className="divide-y divide-border">
                    {settings.map((item, index) => (
                      <label key={item.name} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                        <span className="text-sm font-semibold text-text">{item.name}</span>
                        <span className="flex items-center gap-2 text-sm text-muted">
                          <span>₦</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            required
                            value={item.rentAmount}
                            onChange={(event) =>
                              setSettings((current) =>
                                current.map((setting, settingIndex) =>
                                  settingIndex === index
                                    ? { ...setting, rentAmount: event.target.value }
                                    : setting,
                                ),
                              )
                            }
                            aria-label={`Default rent for ${item.name}`}
                            className="w-40 rounded-lg border border-border bg-input px-3 py-2 text-right text-sm text-text outline-none focus:border-navy focus:ring-2 focus:ring-navy/10"
                          />
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={settingsSaving}
                    className="mt-5 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy2 disabled:opacity-50"
                  >
                    {settingsSaving ? "Saving…" : "Save rent settings"}
                  </button>
                </form>
              )}
            </Panel>
          </div>
        )}

        {selectedTenant && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 p-0 backdrop-blur-sm" onClick={(event) => event.target === event.currentTarget && setSelectedTenant(null)}>
            <aside className="h-full w-full max-w-xl overflow-y-auto bg-card p-6 shadow-2xl sm:p-8">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-terra">Tenant record</p><h2 className="mt-2 font-display text-2xl">{selectedTenant.name || "Unnamed tenant"}</h2><p className="mt-1 text-sm text-muted">{selectedTenant.email || "No email"} · {selectedTenant.phone || "No phone"}</p></div><button onClick={() => setSelectedTenant(null)} className="text-2xl text-muted" aria-label="Close tenant record">×</button></div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted">Property</p><p className="mt-1 font-semibold">{selectedTenant.location || "—"}</p></div><div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted">Unit</p><p className="mt-1 font-semibold">{selectedTenant.roomNo || "—"}</p></div><div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted">Session</p><p className="mt-1 font-semibold">{selectedTenant.session || "—"}</p></div><div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted">Access</p><p className="mt-1 font-semibold">{selectedTenant.status || "active"}</p></div><div className="col-span-2 rounded-lg bg-surface p-3"><p className="text-xs text-muted">Application review</p><p className="mt-1 font-semibold">{selectedTenant.disapproved ? "Not approved" : selectedTenant.retainPending ? "Pending review" : "Approved"}</p>{selectedTenant.disapprovalReason && <p className="mt-1 text-xs text-danger">{selectedTenant.disapprovalReason}</p>}</div></div>
              {directorAccess && (
                <form onSubmit={saveDirectorRecord} className="mt-7 space-y-4 border-t border-border pt-6">
                  <div>
                    <h3 className="font-display text-lg">Accommodation and payment</h3>
                    <p className="mt-1 text-xs text-muted">Room assignment is checked against current availability before saving.</p>
                  </div>
                  <label className="block text-xs font-medium text-muted">
                    Property
                    <select
                      required
                      value={assignmentForm.propertyId}
                      onChange={(event) =>
                        setAssignmentForm((current) => ({
                          ...current,
                          propertyId: event.target.value,
                          unitId: "",
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-text"
                    >
                      <option value="">Select a property</option>
                      {properties
                        .filter((property) => property.status === "active")
                        .map((property) => (
                          <option key={property._id} value={property._id}>
                            {property.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-muted">
                    Available unit
                    <select
                      required
                      value={assignmentForm.unitId}
                      onChange={(event) =>
                        setAssignmentForm((current) => ({
                          ...current,
                          unitId: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-text"
                    >
                      <option value="">Select a unit</option>
                      {assignableUnits.map((unit) => (
                        <option key={unit._id} value={unit._id}>
                          {unit.label} · {unit.unitType}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-muted">
                      Payment amount
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={assignmentForm.amount}
                        onChange={(event) =>
                          setAssignmentForm((current) => ({
                            ...current,
                            amount: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-text"
                      />
                    </label>
                    <label className="block text-xs font-medium text-muted">
                      Payment date
                      <input
                        type="date"
                        value={assignmentForm.paymentDate}
                        onChange={(event) =>
                          setAssignmentForm((current) => ({
                            ...current,
                            paymentDate: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-text"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={recordSaving}
                    className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {recordSaving ? "Saving…" : "Save record"}
                  </button>
                </form>
              )}
              <div className="mt-8"><h3 className="font-display text-lg">Documents</h3><div className="mt-3 space-y-2">{[["passport", "Passport photo"], ["idCard", "ID card"], ["paymentProof", "Payment proof"], ["agreementCopy", "Agreement"]].map(([field, label]) => selectedTenant[field] ? <a key={field} href={selectedTenant[field]} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg border border-border px-3 py-3 text-sm font-semibold text-navy hover:bg-surface"><span className="flex items-center gap-2"><FileText className="h-4 w-4" />{label}</span><ExternalLink className="h-3.5 w-3.5" /></a> : <div key={field} className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted"><span>{label}</span><span>Not uploaded</span></div>)}</div></div>
              {canManageTenant && <div className="mt-8 border-t border-border pt-6"><h3 className="font-display text-lg">Actions</h3><div className="mt-3 flex flex-wrap gap-2">{selectedTenant.retainPending && <button disabled={actionBusy} onClick={() => runTenantAction("approve-retain")} className="rounded-lg bg-success px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve tenant</button>}{selectedTenant.retainPending && <button disabled={actionBusy} onClick={() => runTenantAction("disapprove", { reason: "Documents require review" })} className="rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Reject</button>}{selectedTenant.status === "revoked" ? <button disabled={actionBusy} onClick={() => runTenantAction("reinstate")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">Reinstate access</button> : <button disabled={actionBusy} onClick={() => runTenantAction("revoke", { reason: "Revoked from operations workspace" })} className="rounded-lg border border-danger px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50">Revoke access</button>}</div>{actionNotice && <p role="status" className="mt-3 text-sm text-success">{actionNotice}</p>}</div>}
              {readOnly && <p className="mt-8 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Read-only inspection: document and approval actions are disabled.</p>}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
