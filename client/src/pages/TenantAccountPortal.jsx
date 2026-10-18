import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { validateEmail, validateName, validatePassword, validatePhone } from "../utils/validation.js";
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

export default function TenantAccountPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(new URLSearchParams(location.search).get("email") || "");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [account, setAccount] = useState(null);
  const [applications, setApplications] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [details, setDetails] = useState({ phone: "", guardianName: "", guardianPhone: "", matricNumber: "", level: "", state: "", lga: "" });
  const [passport, setPassport] = useState(null);
  const [idCard, setIdCard] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadAccount(authToken) {
    const response = await fetch("/tenant/account/me", { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load your account.");
    setAccount(data.account);
    setApplications(data.applications || []);
    const config = await getJSON("/tenant-config");
    const available = (config.locations || []).filter((p) => p.status === "active" && p.propertyType === "hostel").flatMap((property) => (property.units || []).filter((unit) => unit.status === "available").map((unit) => ({ property, unit })));
    setRooms(available);
    const query = new URLSearchParams(location.search);
    const requestedRoom = query.get("room");
    const requestedLocation = query.get("location");
    const requestedClientId = query.get("clientId") || "";
    if (requestedRoom && requestedLocation) {
      const found = available.find(({ property, unit }) => property.name === requestedLocation && unit.label === requestedRoom && String(property.clientId || "") === requestedClientId);
      if (found) {
        setSelectedRoom(found);
        const remaining = new URLSearchParams(location.search);
        ["room", "location", "state", "lga", "clientId"].forEach((key) => remaining.delete(key));
        navigate(`${location.pathname}${remaining.toString() ? `?${remaining.toString()}` : ""}`, { replace: true });
      }
    }
  }

  useEffect(() => {
    if (!token) return;
    loadAccount(token).catch((e) => { setError(e.message); sessionStorage.removeItem(TOKEN_KEY); setToken(""); });
  }, [token]);

  async function submitAuth(event) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (mode === "signup" && !validateName(name)) return setError("Enter your name using at least 3 characters.");
    if (!validateEmail(cleanEmail)) return setError("Enter a valid email address.");
    if (mode === "signup" && !validatePassword(password)) return setError("Password must be between 8 and 128 characters.");
    if (!password) return setError("Enter your password.");
    setBusy(true); setError("");
    try {
      const response = await fetch(`/tenant/account/${mode === "signup" ? "signup" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), email: cleanEmail, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not authenticate.");
      sessionStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token); setAccount(data.account); setNotice(mode === "signup" ? "Account created. You can now browse rooms and apply when ready." : "Welcome back.");
      setPassword("");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function submitApplication(event) {
    event.preventDefault();
    if (!selectedRoom) return setError("Choose an available room first.");
    if (!validatePhone(details.phone) || !validateName(details.guardianName) || !validatePhone(details.guardianPhone)) return setError("Check your phone number and guardian details.");
    if (!details.matricNumber.trim() || !details.level || !details.state.trim() || !details.lga.trim()) return setError("Complete all required student and location details.");
    if (!passport || !idCard || !termsAccepted) return setError("Upload your passport and ID card, and accept the terms.");
    const form = new FormData();
    Object.entries(details).forEach(([key, value]) => form.append(key, value));
    form.append("propertyId", selectedRoom.property.id || selectedRoom.property._id);
    form.append("unitId", selectedRoom.unit.id || selectedRoom.unit._id);
    if (selectedRoom.property.clientId) form.append("clientId", selectedRoom.property.clientId);
    form.append("termsAccepted", "true"); form.append("passport", passport); form.append("idCard", idCard);
    setBusy(true); setError("");
    try {
      const response = await fetch("/tenant/account/applications", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Application could not be submitted.");
      setNotice(data.message); setSelectedRoom(null); setPassport(null); setIdCard(null); setTermsAccepted(false);
      await loadAccount(token);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function uploadApplicationDocument(applicationId, kind, file, paymentDate = "") {
    if (!file) return setError(kind === "agreement" ? "Choose the signed agreement file first." : "Choose the payment receipt first.");
    const form = new FormData(); form.append("file", file);
    if (paymentDate) form.append("paymentDate", paymentDate);
    setBusy(true); setError("");
    try {
      const response = await fetch(`/tenant/account/applications/${applicationId}/${kind}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setNotice(data.message); await loadAccount(token);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY); setToken(""); setAccount(null); setApplications([]); setRooms([]); setSelectedRoom(null); setNotice(""); setError("");
    navigate("/rooms", { replace: true });
  }

  return <div className="min-h-screen bg-paper text-ink">
    <header className="border-b border-stone bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4"><Link to="/" className="font-landing-display text-xl font-semibold">De-Crown Cottage</Link><div className="flex items-center gap-4 text-sm"><Link to="/rooms" className="underline underline-offset-4">Room search</Link>{token && <button type="button" onClick={signOut} className="rounded border border-stone px-3 py-2">Sign out</button>}</div></div></header>
    <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      {!account ? <section className="mx-auto max-w-md rounded-xl border border-stone bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-semibold uppercase tracking-widest text-moss">Tenant account</p><h1 className="mt-2 font-landing-display text-3xl font-semibold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1><p className="mt-3 text-sm leading-relaxed text-sage">{mode === "signup" ? "Start with your name, email and password. You can complete accommodation details after browsing rooms." : "Sign in to continue your room application."}</p>
        <form onSubmit={submitAuth} className="mt-6 space-y-4" noValidate>{mode === "signup" && <label className="block text-sm font-medium">Full name<input className="mt-1.5 block w-full rounded-lg border border-stone bg-white px-3.5 py-3 outline-none focus:border-moss" autoComplete="name" required minLength={3} maxLength={50} value={name} onChange={(e) => setName(e.target.value)} /></label>}<label className="block text-sm font-medium">Email address<input className="mt-1.5 block w-full rounded-lg border border-stone bg-white px-3.5 py-3 outline-none focus:border-moss" type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="block text-sm font-medium">Password<input className="mt-1.5 block w-full rounded-lg border border-stone bg-white px-3.5 py-3 outline-none focus:border-moss" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : undefined} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}<button disabled={busy} className="w-full rounded-lg bg-moss px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button></form><p className="mt-5 text-center text-sm text-sage">{mode === "signup" ? "Already have an account?" : "New to De-Crown?"} <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }} className="font-semibold text-moss underline underline-offset-4">{mode === "signup" ? "Sign in" : "Create account"}</button></p>
      </section> : <><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-moss">Tenant dashboard</p><h1 className="mt-2 font-landing-display text-3xl font-semibold sm:text-4xl">Hello, {account.name}</h1><p className="mt-2 text-sm text-sage">Browse rooms, submit an application, and follow its progress here.</p></div><Link to="/rooms" className="rounded border border-stone bg-white px-4 py-2.5 text-sm font-semibold">Open full room search</Link></div>
        {notice && <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{notice}</p>}{error && <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
        <section className="mt-9"><h2 className="font-landing-display text-2xl font-semibold">Your applications</h2>{applications.length === 0 ? <p className="mt-3 rounded-lg border border-stone bg-white p-5 text-sm text-sage">You have not applied for a room yet. Your account is ready; browse available rooms below.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2">{applications.map((app) => <article key={app._id} className="rounded-lg border border-stone bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{app.location} · Room {app.roomNo}</h3><p className="mt-1 text-xs text-sage">Session {app.session}</p></div><span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">{statusLabels[app.status] || app.status}</span></div>{app.managementNote && <p className="mt-3 text-sm text-sage">Management note: {app.managementNote}</p>}{app.status === "agreement_requested" && <label className="mt-4 block text-sm font-medium">Upload signed physical agreement<input type="file" accept="image/*,.pdf" className="mt-2 block w-full text-sm" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadApplicationDocument(app._id, "agreement", file); }} /></label>}{app.status === "payment_unlocked" && <label className="mt-4 block text-sm font-medium">Upload payment receipt<input type="file" accept="image/*,.pdf" className="mt-2 block w-full text-sm" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadApplicationDocument(app._id, "payment", file); }} /></label>}</article>)}</div>}</section>
        <section className="mt-10"><h2 className="font-landing-display text-2xl font-semibold">Available rooms</h2>{rooms.length === 0 ? <p className="mt-3 rounded-lg border border-stone bg-white p-5 text-sm text-sage">No rooms are currently available. Please check again later.</p> : <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rooms.map(({ property, unit }) => <article key={`${property.id || property._id}-${unit.id || unit._id}`} className="rounded-lg border border-stone bg-white p-5"><p className="text-xs uppercase tracking-wider text-sage">{property.state}{property.lga ? ` · ${property.lga}` : ""}</p><h3 className="mt-2 font-landing-display text-xl font-semibold">{property.name}</h3><p className="mt-2 text-sm text-sage">Room {unit.label}</p><p className="mt-4 font-landing-mono text-lg font-semibold">{Number(unit.rentAmount ?? property.rentAmount) > 0 ? `₦${Number(unit.rentAmount ?? property.rentAmount).toLocaleString("en-NG")}` : "Contact agency"}</p><button type="button" onClick={() => { setSelectedRoom({ property, unit }); setDetails((d) => ({ ...d, state: property.state || "", lga: property.lga || "" })); setError(""); }} className="mt-4 w-full rounded bg-moss px-4 py-3 text-sm font-semibold text-white">Apply for this room</button></article>)}</div>}</section>
        {selectedRoom && <section className="mt-10 rounded-xl border border-stone bg-white p-5 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-moss">Room application</p><h2 className="mt-2 font-landing-display text-2xl font-semibold">{selectedRoom.property.name} · {selectedRoom.unit.label}</h2><p className="mt-2 text-sm text-sage">Management will review your details and contact you about a physical agreement. Payment is not collected at this stage.</p></div><button type="button" onClick={() => setSelectedRoom(null)} className="text-sm underline underline-offset-4">Cancel</button></div><form onSubmit={submitApplication} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>{[["phone","Your phone number"],["guardianName","Guardian full name"],["guardianPhone","Guardian phone number"],["matricNumber","Matric number"],["level","Level / year"],["state","State"],["lga","Local government area"]].map(([key,label]) => <label key={key} className="block text-sm font-medium">{label}<input className="mt-1.5 block w-full rounded-lg border border-stone bg-white px-3.5 py-3 outline-none focus:border-moss" required maxLength={80} value={details[key]} onChange={(e) => setDetails((d) => ({ ...d, [key]: e.target.value }))} /></label>)}<label className="block text-sm font-medium">Passport photograph<input className="mt-1.5 block w-full rounded-lg border border-stone bg-white px-3.5 py-3 text-sm" type="file" accept="image/*" required onChange={(e) => setPassport(e.target.files?.[0] || null)} /></label><label className="block text-sm font-medium">Student ID card<input className="mt-1.5 block w-full rounded-lg border border-stone bg-white px-3.5 py-3 text-sm" type="file" accept="image/*,.pdf" required onChange={(e) => setIdCard(e.target.files?.[0] || null)} /></label><label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} required className="mt-1" />I confirm that the information provided is accurate and understand that applying does not allocate or reserve the room.</label><div className="sm:col-span-2"><button disabled={busy} className="rounded bg-moss px-5 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Submitting…" : "Submit application for review"}</button></div></form></section>}
      </>}
    </main>
  </div>;
}
