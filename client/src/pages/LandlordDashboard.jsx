import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  LogOut,
  Menu,
  Moon,
  Plus,
  Sun,
  Users,
  X,
} from "lucide-react";
import { clearAdminAuth, getAdminName, getJSON, getToken } from "../api.js";
import { useTenant } from "../tenantContext.jsx";
import { useTheme } from "../theme.js";

function Stat({ label, value, detail, icon: Icon }) {
  return (
    <div className="border-b border-border p-5 sm:border-b-0 sm:border-r sm:p-6 last:border-r-0">
      <div className="flex items-center justify-between text-muted">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 font-mono text-3xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

export default function LandlordDashboard() {
  const navigate = useNavigate();
  const { dark, toggleTheme } = useTheme();
  const { businessName, branding } = useTenant();
  const landlordName = getAdminName();
  const [properties, setProperties] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { replace: true });
      return;
    }
    Promise.all([getJSON("/admin/properties"), getJSON("/users")])
      .then(([propertyData, userData]) => {
        setProperties(Array.isArray(propertyData) ? propertyData : []);
        setUsers(Array.isArray(userData) ? userData : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  function logout() {
    clearAdminAuth();
    navigate("/login", { replace: true });
  }

  const units = properties.flatMap((property) => property.units || []);
  const occupied = units.filter((unit) =>
    users.some((user) => String(user.unitId) === String(unit._id)),
  ).length;
  const latest = properties.reduce((current, property) => {
    if (!current) return property;
    return new Date(property.createdAt || 0) > new Date(current.createdAt || 0)
      ? property
      : current;
  }, null);

  return (
    <div className="min-h-screen bg-bg font-sans text-text">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/admin" className="flex min-w-0 items-center gap-2.5 no-underline">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <span className="max-w-[42vw] truncate font-display text-xl font-semibold tracking-tight text-text sm:max-w-none sm:text-2xl">{businessName || "Property Portal"}</span>
            )}
            {branding?.logoUrl && <span className="max-w-[42vw] truncate font-display text-lg font-semibold text-text sm:max-w-none sm:text-xl">{businessName || "Property Portal"}</span>}
          </Link>

          <nav className="hidden items-center gap-7 text-sm md:flex">
            <Link to="/admin" className="font-medium text-text">Dashboard</Link>
            <Link to="/admin/properties/new" className="font-medium text-muted transition-colors hover:text-text">Properties</Link>
            <Link to="/admin/operations" className="font-medium text-muted transition-colors hover:text-text">Operations</Link>
            <Link to="/admin/applications" className="font-medium text-muted transition-colors hover:text-text">Applications</Link>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:text-text" title="Toggle theme" aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={logout} className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted transition-colors hover:text-text sm:flex">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
            <button onClick={() => setMobileNav((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-lg text-text md:hidden" title={mobileNav ? "Close menu" : "Open menu"} aria-label={mobileNav ? "Close menu" : "Open menu"} aria-expanded={mobileNav} aria-controls="landlord-mobile-navigation">
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileNav && (
          <nav id="landlord-mobile-navigation" aria-label="Landlord navigation" className="border-t border-border px-4 py-3 md:hidden">
            <Link to="/admin" onClick={() => setMobileNav(false)} className="block py-2 text-sm">Dashboard</Link>
            <Link to="/admin/properties/new" onClick={() => setMobileNav(false)} className="block py-2 text-sm">Properties</Link>
            <Link to="/admin/operations" onClick={() => setMobileNav(false)} className="block py-2 text-sm">Operations</Link>
            <Link to="/admin/applications" onClick={() => setMobileNav(false)} className="block py-2 text-sm">Tenant applications</Link>
            <button onClick={logout} className="block py-2 text-sm text-danger">Sign out</button>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
        <section className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-terra">Landlord dashboard</p>
            <h1 className="mt-2 font-display text-3xl font-medium leading-tight text-text sm:text-4xl">Welcome back{landlordName ? `, ${landlordName}` : ""}.</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">A clear view of your hostels, individual rooms, and tenant activity.</p>
          </div>
          <Link to="/admin/properties/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy2">
            <Plus className="h-4 w-4" /> Add hostel
          </Link>
        </section>

        {error && <div className="mb-6 rounded-lg border-l-4 border-danger bg-danger-faint px-4 py-3 text-sm text-danger">{error}</div>}

        <section className="overflow-hidden rounded-2xl border border-border bg-card sm:grid sm:grid-cols-5">
          <Stat label="Hostels" value={loading ? "—" : properties.length} detail="In your portfolio" icon={Building2} />
          <Stat label="Active hostels" value={loading ? "—" : properties.filter((p) => p.status === "active").length} detail="Open for management" icon={CheckCircle2} />
          <Stat label="Pending review" value={loading ? "—" : properties.filter((p) => p.status === "pending_review").length} detail="Not public yet" icon={Clock3} />
          <Stat label="Rooms" value={loading ? "—" : units.length} detail={`${occupied} currently occupied`} icon={Building2} />
          <Stat label="Tenants" value={loading ? "—" : users.length} detail="Tenant records" icon={Users} />
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-text">Latest property</h2>
            {properties.length > 0 && <Link to="/admin/properties/new" className="text-sm font-semibold text-muted hover:text-text">Add another <ArrowRight className="inline h-3.5 w-3.5" /></Link>}
          </div>
          {loading ? (
            <div className="mt-4 rounded-2xl border border-border bg-card p-8 text-sm text-muted">Loading your portfolio...</div>
          ) : latest ? (
            <div className="mt-4 rounded-2xl border border-border bg-card p-6 sm:flex sm:items-center sm:justify-between">
              <div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${latest.status === "active" ? "bg-success-faint text-success" : latest.status === "pending_review" ? "bg-amber-50 text-amber-700" : latest.status === "rejected" ? "bg-danger-faint text-danger" : "bg-surface text-muted"}`}>{(latest.status || "active").replaceAll("_", " ")}</span>
                <h3 className="mt-3 font-display text-2xl text-text">{latest.name}</h3>
                <p className="mt-1 text-sm text-muted">{latest.address || "Address not added"} · {latest.propertyType}</p>
              </div>
              <div className="mt-5 flex gap-6 text-sm sm:mt-0">
                <div><p className="font-mono text-xl font-semibold text-text">{(latest.units || []).length}</p><p className="text-xs text-muted">Rooms</p></div>
                <div><p className="font-mono text-xl font-semibold text-text">{(latest.units || []).filter((unit) => unit.status === "available").length}</p><p className="text-xs text-muted">Available</p></div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted" />
              <h3 className="mt-4 font-display text-xl text-text">Your portfolio starts here</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">Add your first hostel and enter its room count. We’ll number the rooms automatically so tenants can choose an available room.</p>
              <Link to="/admin/properties/new" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add your first hostel</Link>
            </div>
          )}
        </section>

        <section className="mb-16 mt-10">
          <div className="flex items-center justify-between"><h2 className="font-display text-xl text-text">My properties</h2><Link to="/admin/operations" className="text-sm font-semibold text-muted hover:text-text">Open operations <ArrowRight className="inline h-3.5 w-3.5" /></Link></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {properties.map((property) => (
              <article key={property._id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-lg text-text">{property.name}</h3><p className="mt-1 text-xs text-muted">{property.address || "Address not added"}</p></div><span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted">{property.status}</span></div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted"><span>{(property.units || []).length} rooms</span><span>{(property.units || []).filter((unit) => unit.status === "available").length} available</span></div>
              </article>
            ))}
            {!loading && properties.length === 0 && <p className="text-sm text-muted">No properties yet. Add one above to begin.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
