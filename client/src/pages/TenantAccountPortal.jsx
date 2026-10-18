import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, BedDouble, MapPin } from "lucide-react";
import { validateEmail, validateName, validatePassword } from "../utils/validation.js";
import { getJSON } from "../api.js";

const TOKEN_KEY = "tenantAccountToken";
const statusLabels = {
  under_review: "Application under review",
  rejected: "Needs attention — contact De-Crown",
  agreement_requested: "Agreement requested by management",
  agreement_submitted: "Signed agreement submitted",
  payment_unlocked: "Payment authorized",
  payment_submitted: "Payment awaiting verification",
  payment_verified: "Payment verified — allocation pending",
  allocated: "Room allocated",
};

const naira = (amount) => Number(amount) > 0 ? `₦${Number(amount).toLocaleString("en-NG")}` : "Contact agency";

export default function TenantAccountPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(query.get("email") || "");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [account, setAccount] = useState(null);
  const [applications, setApplications] = useState([]);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState(() => query.get("session") === "expired" ? "Your session expired. Please sign in again." : "");
  const [notice, setNotice] = useState(() => query.get("submitted") === "1" ? "Your application was submitted. De-Crown will review it and contact you about the next step." : "");
  const [busy, setBusy] = useState(false);

  async function loadAccount(authToken) {
    const response = await fetch("/tenant/account/me", { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load your account.");
    setAccount(data.account);
    setApplications(data.applications || []);

    const config = await getJSON("/tenant-config");
    const availableProperties = (config.locations || []).filter((property) =>
      property.status === "active" && property.propertyType === "hostel" &&
      (property.units || []).some((unit) => unit.status === "available"),
    );
    setProperties(availableProperties);

    const requestedPropertyId = query.get("propertyId");
    const requestedUnitId = query.get("unitId");
    if (requestedPropertyId && requestedUnitId) {
      const nextQuery = new URLSearchParams({ propertyId: requestedPropertyId, unitId: requestedUnitId });
      const clientId = query.get("clientId");
      if (clientId) nextQuery.set("clientId", clientId);
      navigate(`/tenant/application?${nextQuery.toString()}`, { replace: true });
    }
  }

  useEffect(() => {
    if (!token) return;
    loadAccount(token).catch((loadError) => {
      setError(loadError.message || "Could not load your account.");
      sessionStorage.removeItem(TOKEN_KEY);
      setToken("");
    });
    // URL selection is intentionally read on entry so the selected room survives signup/login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submitAuth(event) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (mode === "signup" && !validateName(name)) return setError("Enter your full name using at least 3 characters.");
    if (!validateEmail(cleanEmail)) return setError("Enter a valid email address.");
    if (mode === "signup" && !validatePassword(password)) return setError("Password must be between 8 and 128 characters.");
    if (!password) return setError("Enter your password.");

    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/tenant/account/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: cleanEmail, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not authenticate.");
      sessionStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setAccount(data.account);
      setNotice(mode === "signup" ? "Account created. Choose a hostel and room, then complete your application separately." : "Welcome back.");
      setPassword("");
    } catch (authError) {
      setError(authError.message || "Could not authenticate.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadApplicationDocument(applicationId, kind, file, paymentDate = "") {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    if (paymentDate) form.append("paymentDate", paymentDate);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/tenant/account/applications/${applicationId}/${kind}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setNotice(data.message || "Upload received.");
      await loadAccount(token);
    } catch (uploadError) {
      setError(uploadError.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem("tenantAccountLastActivityAt");
    setToken("");
    setAccount(null);
    setApplications([]);
    setProperties([]);
    setNotice("");
    setError("");
    navigate("/rooms", { replace: true });
  }

  const visibleProperties = properties.filter((property) => property.units?.some((unit) => unit.status === "available"));

  return (
    <div className="dc-public-site min-h-screen bg-paper font-landing-sans text-ink">
      <header className="border-b border-stone bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="font-landing-display text-xl font-semibold">De-Crown Cottage</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/rooms" className="underline underline-offset-4">Browse hostels</Link>
            {token && <button type="button" onClick={signOut} className="rounded border border-stone px-3 py-2">Sign out</button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        {!account ? (
          <section className="mx-auto max-w-md rounded border border-stone bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-moss">Tenant account</p>
            <h1 className="mt-2 font-landing-display text-3xl font-semibold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
            <p className="mt-3 text-sm leading-relaxed text-sage">{mode === "signup" ? "Start with your name, email and password only. You will provide your accommodation and supporting information after choosing a room." : "Sign in to continue to your tenant dashboard or selected room application."}</p>
            <form onSubmit={submitAuth} className="mt-6 space-y-4" noValidate>
              {mode === "signup" && <label className="block text-sm font-medium">Full name<input className="mt-1.5 block w-full rounded border border-stone bg-white px-3.5 py-3 outline-none focus:border-moss" autoComplete="name" required minLength={3} maxLength={50} value={name} onChange={(event) => setName(event.target.value)} /></label>}
              <label className="block text-sm font-medium">Email address<input className="mt-1.5 block w-full rounded border border-stone bg-white px-3.5 py-3 outline-none focus:border-moss" type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label className="block text-sm font-medium">Password<input className="mt-1.5 block w-full rounded border border-stone bg-white px-3.5 py-3 outline-none focus:border-moss" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
              <button disabled={busy} className="w-full rounded bg-moss px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
            </form>
            <p className="mt-5 text-center text-sm text-sage">{mode === "signup" ? "Already have an account?" : "New to De-Crown?"} <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }} className="font-semibold text-moss underline underline-offset-4">{mode === "signup" ? "Sign in" : "Create account"}</button></p>
          </section>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-widest text-moss">Tenant dashboard</p><h1 className="mt-2 font-landing-display text-3xl font-semibold sm:text-4xl">Hello, {account.name}</h1><p className="mt-2 text-sm text-sage">Choose a hostel and room, submit your details separately, and track management’s decision here.</p></div>
              <Link to="/rooms" className="rounded border border-stone bg-white px-4 py-2.5 text-sm font-semibold">Explore all hostels</Link>
            </div>
            {notice && <p className="mt-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{notice}</p>}
            {error && <p className="mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}

            <section className="mt-9">
              <h2 className="font-landing-display text-2xl font-semibold">Your applications</h2>
              {applications.length === 0 ? <p className="mt-3 border border-stone bg-white p-5 text-sm text-sage">You have not applied for a room yet. Choose a hostel below to begin.</p> : <div className="mt-4 space-y-3">{applications.map((application) => <article key={application._id} className="border border-stone bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{application.location} · Room {application.roomNo}</h3><p className="mt-1 text-xs text-sage">Session {application.session}</p></div><span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">{statusLabels[application.status] || application.status}</span></div>{application.managementNote && <p className="mt-3 text-sm text-sage">Management note: {application.managementNote}</p>}{application.status === "agreement_requested" && <label className="mt-4 block text-sm font-medium">Upload signed physical agreement<input type="file" accept="image/*,.pdf" className="mt-2 block w-full text-sm" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadApplicationDocument(application._id, "agreement", file); }} /></label>}{application.status === "payment_unlocked" && <label className="mt-4 block text-sm font-medium">Upload payment receipt<input type="file" accept="image/*,.pdf" className="mt-2 block w-full text-sm" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadApplicationDocument(application._id, "payment", file); }} /></label>}</article>)}</div>}
            </section>

            <section className="mt-10">
              <div><h2 className="font-landing-display text-2xl font-semibold">Available hostels</h2><p className="mt-1 text-sm text-sage">Each hostel is grouped once, with its available rooms listed underneath.</p></div>
              {visibleProperties.length === 0 ? <p className="mt-4 border border-stone bg-white p-5 text-sm text-sage">No rooms are currently available. Please check again later.</p> : <div className="mt-5 space-y-4">{visibleProperties.map((property) => {
                const units = (property.units || []).filter((unit) => unit.status === "available");
                return <article key={`${property.clientId || "shared"}-${property.id}`} className="overflow-hidden border border-stone bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-3 bg-stone/30 p-5"><div><h3 className="font-landing-display text-xl font-semibold">{property.name}</h3><p className="mt-2 flex items-start gap-2 text-sm text-sage"><MapPin size={15} className="mt-0.5 shrink-0" />{[property.address, property.lga, property.state].filter(Boolean).join(", ") || "Location available from the agency"}</p></div><span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">{units.length} available</span></div>
                  <div className="divide-y divide-stone">{units.map((unit) => <div key={unit.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5 sm:px-5"><div className="flex items-center gap-3"><span className="rounded bg-stone/50 p-2 text-moss"><BedDouble size={18} /></span><div><p className="font-semibold">{unit.label}</p><p className="mt-0.5 text-xs text-sage">{unit.unitType || "Hostel room"} · Available</p></div></div><p className="font-landing-mono text-base font-semibold sm:text-right">{naira(unit.rentAmount ?? property.rentAmount)}</p><button type="button" onClick={() => { const params = new URLSearchParams({ propertyId: String(property.id), unitId: String(unit.id) }); if (property.clientId) params.set("clientId", String(property.clientId)); navigate(`/tenant/application?${params.toString()}`); }} className="inline-flex items-center justify-center gap-2 rounded bg-moss px-4 py-3 text-sm font-semibold text-white hover:bg-ink">Apply for room <ArrowRight size={15} /></button></div>)}</div>
                </article>;
              })}</div>}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
