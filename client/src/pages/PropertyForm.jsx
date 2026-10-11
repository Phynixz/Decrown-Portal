import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { getToken, sendJSON } from "../api.js";
import { useTenant } from "../tenantContext.jsx";

const PROPERTY_TYPES = ["hostel", "apartment", "house", "commercial", "mixed", "other"];
const UNIT_TYPES = ["room", "apartment", "house", "shop", "office", "other"];
const emptyUnit = () => ({ unitCode: "", label: "", unitType: "room", rentAmount: "" });

export default function PropertyForm() {
  const navigate = useNavigate();
  const { businessName } = useTenant();
  const [property, setProperty] = useState({ name: "", propertyType: "", address: "", rentAmount: "" });
  const [units, setUnits] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [partialSave, setPartialSave] = useState(false);

  function updateProperty(event) {
    setProperty((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateUnit(index, event) {
    setUnits((current) => current.map((unit, unitIndex) => unitIndex === index ? { ...unit, [event.target.name]: event.target.value } : unit));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!getToken()) return navigate("/login", { replace: true });
    const incompleteUnit = units.findIndex(
      (unit) => !unit.unitCode.trim() || !unit.label.trim(),
    );
    if (incompleteUnit !== -1) {
      setError(`Complete the code and label for unit ${incompleteUnit + 1}.`);
      return;
    }
    const hasDuplicateCodes =
      new Set(units.map((unit) => unit.unitCode.trim().toLowerCase())).size !==
      units.length;
    const hasDuplicateLabels =
      new Set(units.map((unit) => unit.label.trim().toLowerCase())).size !==
      units.length;
    if (hasDuplicateCodes || hasDuplicateLabels) {
      setError("Unit codes and labels must each be unique within this property.");
      return;
    }
    setBusy(true);
    let propertyCreated = false;
    try {
      const created = await sendJSON("POST", "/admin/properties", {
        ...property,
        rentAmount: property.rentAmount === "" ? 0 : Number(property.rentAmount),
      }, getToken());
      propertyCreated = true;
      for (const unit of units) {
        await sendJSON("POST", `/admin/properties/${created._id}/units`, {
          ...unit,
          rentAmount: unit.rentAmount === "" ? null : Number(unit.rentAmount),
        }, getToken());
      }
      setSaved(true);
    } catch (err) {
      if (propertyCreated) {
        setPartialSave(true);
        setError(`Property created, but a unit could not be saved: ${err.message}`);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <div className="min-h-screen bg-bg px-4 py-12 font-sans text-text sm:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terra">Property saved</p>
          <h1 className="mt-3 font-display text-3xl text-text">Your property is ready.</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">{property.name} has been added to {businessName || "your portfolio"}.</p>
          <div className="mt-6 flex justify-center gap-3"><Link to="/admin" className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white">View dashboard</Link><button onClick={() => { setSaved(false); setProperty({ name: "", propertyType: "", address: "", rentAmount: "" }); setUnits([]); }} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text">Add another</button></div>
        </div>
      </div>
    );
  }

  const inputClass = "mt-1.5 w-full rounded-lg border border-border bg-input px-3.5 py-2.5 text-sm text-text outline-none focus:border-navy focus:ring-2 focus:ring-navy/10";
  return (
    <div className="min-h-screen bg-bg font-sans text-text">
      <header className="border-b border-border bg-card"><div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6"><Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> Dashboard</Link><span className="font-display text-lg">Add property</span></div></header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terra">Portfolio setup</p>
        <h1 className="mt-2 font-display text-3xl text-text sm:text-4xl">Tell us about your property.</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">Create the property first, then add the units your tenants can select. Nothing is pre-filled from another client.</p>
        {error && <div className="mt-6 rounded-lg border-l-4 border-danger bg-danger-faint px-4 py-3 text-sm text-danger">{error}</div>}
        {partialSave && <Link to="/admin/operations" className="mt-3 inline-flex text-sm font-semibold text-navy underline underline-offset-4">Open Operations to finish setup</Link>}
        <form onSubmit={submit} className="mt-8 space-y-8">
          <section className="space-y-5 border-b border-border pb-8">
            <div><label className="block text-sm font-semibold" htmlFor="property-name">Property name</label><input id="property-name" name="name" required value={property.name} onChange={updateProperty} placeholder="e.g. North Campus" className={inputClass} /></div>
            <div className="grid gap-5 sm:grid-cols-2"><div><label className="block text-sm font-semibold" htmlFor="property-type">Property type</label><select id="property-type" name="propertyType" required value={property.propertyType} onChange={updateProperty} className={inputClass}><option value="">Select a type</option>{PROPERTY_TYPES.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></div><div><label className="block text-sm font-semibold" htmlFor="property-rent">Default rent amount</label><input id="property-rent" name="rentAmount" type="number" min="0" value={property.rentAmount} onChange={updateProperty} placeholder="Optional" className={inputClass} /></div></div>
            <div><label className="block text-sm font-semibold" htmlFor="property-address">Address</label><input id="property-address" name="address" value={property.address} onChange={updateProperty} placeholder="Property address" className={inputClass} /></div>
          </section>
          <section><div className="flex items-end justify-between gap-4"><div><h2 className="font-display text-xl">Units</h2><p className="mt-1 text-sm text-muted">Add units now or create them later from Operations.</p></div><button type="button" onClick={() => setUnits((current) => [...current, emptyUnit()])} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text"><Plus className="h-3.5 w-3.5" /> Add unit</button></div>
            {units.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">No units added yet. You can add them now or continue with an empty property.</div> : <div className="mt-4 space-y-3">{units.map((unit, index) => <div key={index} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"><input name="unitCode" value={unit.unitCode} onChange={(event) => updateUnit(index, event)} placeholder="Code" className={inputClass} /><input name="label" value={unit.label} onChange={(event) => updateUnit(index, event)} placeholder="Display label" className={inputClass} /><select name="unitType" value={unit.unitType} onChange={(event) => updateUnit(index, event)} className={inputClass}>{UNIT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select><input name="rentAmount" type="number" min="0" value={unit.rentAmount} onChange={(event) => updateUnit(index, event)} placeholder="Rent" className={inputClass} /><button type="button" onClick={() => setUnits((current) => current.filter((_, unitIndex) => unitIndex !== index))} className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg text-danger hover:bg-danger-faint" title="Remove unit"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
          </section>
          <button disabled={busy || partialSave} className="w-full rounded-lg bg-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-navy2 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving property..." : partialSave ? "Property already created" : "Save property"}</button>
        </form>
      </main>
    </div>
  );
}
