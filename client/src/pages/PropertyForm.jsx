import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getToken, sendJSON } from "../api.js";
import { useTenant } from "../tenantContext.jsx";
import { getLocalGovernments, NIGERIAN_STATES } from "../utils/nigeriaLocationData.js";

export default function PropertyForm() {
  const navigate = useNavigate();
  const { businessName } = useTenant();
  const [property, setProperty] = useState({ name: "", address: "", state: "", lga: "", rentAmount: "", roomCount: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [partialSave, setPartialSave] = useState(false);

  function updateProperty(event) {
    const { name, value } = event.target;
    setProperty((current) => ({ ...current, [name]: value, ...(name === "state" ? { lga: "" } : {}) }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!getToken()) return navigate("/login", { replace: true });
    const roomCount = Number(property.roomCount);
    if (!Number.isInteger(roomCount) || roomCount < 1 || roomCount > 1000) {
      setError("Enter a number of rooms between 1 and 1,000.");
      return;
    }
    const rentAmount = Number(property.rentAmount);
    if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
      setError("Enter the rent amount for one room.");
      return;
    }

    setBusy(true);
    let propertyCreated = false;
    let created;
    try {
      created = await sendJSON("POST", "/admin/properties", {
        name: property.name.trim(), propertyType: "hostel", address: property.address.trim(),
        state: property.state, lga: property.lga, rentAmount,
      }, getToken());
      propertyCreated = true;

      // Hostels are managed as individual rooms. Generate clear, consistent room labels.
      for (let index = 1; index <= roomCount; index += 1) {
        await sendJSON("POST", `/admin/properties/${created._id}/units`, {
          unitCode: `room-${index}`, label: `Room ${index}`, unitType: "room", rentAmount: null,
        }, getToken());
      }
      setSaved(true);
    } catch (err) {
      if (propertyCreated) {
        setPartialSave(true);
        setError(`The hostel was created, but room setup stopped early: ${err.message}. Open Operations to finish adding the remaining rooms.`);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1.5 w-full rounded-lg border border-border bg-input px-3.5 py-2.5 text-sm text-text outline-none focus:border-navy focus:ring-2 focus:ring-navy/10";
  if (saved) return (
    <div className="min-h-screen bg-bg px-4 py-12 font-sans text-text sm:px-6"><div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terra">Hostel saved</p><h1 className="mt-3 font-display text-3xl">Your hostel is ready.</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted">{property.name} has been added to {businessName || "your portfolio"}, with {property.roomCount} individual rooms.</p>
      <div className="mt-6 flex justify-center gap-3"><Link to="/admin" className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white">View dashboard</Link><button onClick={() => { setSaved(false); setProperty({ name: "", address: "", state: "", lga: "", rentAmount: "", roomCount: "" }); }} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">Add another hostel</button></div>
    </div></div>
  );

  return (
    <div className="min-h-screen bg-bg font-sans text-text">
      <header className="border-b border-border bg-card"><div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6"><Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> Dashboard</Link><span className="font-display text-lg">Add hostel</span></div></header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terra">Hostel setup</p><h1 className="mt-2 font-display text-3xl sm:text-4xl">Add your hostel and rooms.</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">For now, this platform supports hostels with separate rooms. Enter the total room count once; we’ll create Room 1, Room 2, Room 3, and so on. No need to invent unit codes.</p>
        {error && <div className="mt-6 rounded-lg border-l-4 border-danger bg-danger-faint px-4 py-3 text-sm text-danger">{error}</div>}
        {partialSave && <Link to="/admin/operations" className="mt-3 inline-flex text-sm font-semibold text-navy underline underline-offset-4">Open Operations to finish room setup</Link>}
        <form onSubmit={submit} className="mt-8 space-y-6">
          <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
            <div><label className="block text-sm font-semibold" htmlFor="property-name">Hostel name</label><input id="property-name" name="name" required maxLength={100} value={property.name} onChange={updateProperty} placeholder="e.g. Sunrise Hostel" className={inputClass} /></div>
            <div className="grid gap-5 sm:grid-cols-2"><div><label className="block text-sm font-semibold" htmlFor="property-state">State</label><select id="property-state" name="state" required value={property.state} onChange={updateProperty} className={inputClass}><option value="">Select a state</option>{NIGERIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></div>
              <div><label className="block text-sm font-semibold" htmlFor="property-lga">Local government area</label><select id="property-lga" name="lga" required disabled={!property.state} value={property.lga} onChange={updateProperty} className={inputClass}><option value="">{property.state ? "Select an LGA" : "Select a state first"}</option>{getLocalGovernments(property.state).map((lga) => <option key={lga} value={lga}>{lga}</option>)}</select></div></div>
            <div><label className="block text-sm font-semibold" htmlFor="property-address">Street address / area</label><input id="property-address" name="address" required maxLength={200} value={property.address} onChange={updateProperty} placeholder="Street, area, nearby landmark" className={inputClass} /></div>
          </section>
          <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7"><div><h2 className="font-display text-xl">Rooms and rent</h2><p className="mt-1 text-sm text-muted">Each room is a separate option a tenant can book.</p></div>
            <div className="grid gap-5 sm:grid-cols-2"><div><label className="block text-sm font-semibold" htmlFor="room-count">How many rooms are in this hostel?</label><input id="room-count" name="roomCount" type="number" required min="1" max="1000" step="1" value={property.roomCount} onChange={updateProperty} placeholder="e.g. 24" className={inputClass} /></div>
              <div><label className="block text-sm font-semibold" htmlFor="room-rent">Rent per room (₦)</label><input id="room-rent" name="rentAmount" type="number" required min="1" step="1" value={property.rentAmount} onChange={updateProperty} placeholder="e.g. 150000" className={inputClass} /></div></div>
            {Number(property.roomCount) > 0 && Number(property.roomCount) <= 1000 && <p className="rounded-lg bg-surface px-4 py-3 text-sm text-muted">We’ll create <strong>{Number(property.roomCount)} rooms</strong>, numbered Room 1 to Room {Number(property.roomCount)}. The rent entered above is the default rent for each room.</p>}
          </section>
          <button disabled={busy || partialSave} className="w-full rounded-lg bg-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-navy2 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Creating hostel and rooms…" : partialSave ? "Hostel already created" : "Create hostel and rooms"}</button>
        </form>
      </main>
    </div>
  );
}
