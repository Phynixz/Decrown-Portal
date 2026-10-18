import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BedDouble, MapPin } from "lucide-react";
import { getJSON } from "../api.js";
import { validateName, validatePhone } from "../utils/validation.js";

const TOKEN_KEY = "tenantAccountToken";
const initialDetails = { phone: "", guardianName: "", guardianPhone: "", matricNumber: "", level: "" };
const naira = (amount) => Number(amount) > 0 ? `₦${Number(amount).toLocaleString("en-NG")}` : "Contact agency";

export default function TenantApplicationForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get("propertyId") || "";
  const unitId = searchParams.get("unitId") || "";
  const clientId = searchParams.get("clientId") || "";
  const [account, setAccount] = useState(null);
  const [property, setProperty] = useState(null);
  const [unit, setUnit] = useState(null);
  const [details, setDetails] = useState(initialDetails);
  const [passport, setPassport] = useState(null);
  const [idCard, setIdCard] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      const next = new URLSearchParams({ propertyId, unitId });
      if (clientId) next.set("clientId", clientId);
      navigate(`/tenant/account?${next.toString()}`, { replace: true });
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [accountResponse, config] = await Promise.all([
          fetch("/tenant/account/me", { headers: { Authorization: `Bearer ${token}` } }),
          getJSON("/tenant-config"),
        ]);
        const accountData = await accountResponse.json();
        if (!accountResponse.ok) throw new Error(accountData.error || "Please sign in again.");
        const selectedProperty = (config.locations || []).find((item) =>
          String(item.id) === propertyId && String(item.clientId || "") === clientId,
        );
        const selectedUnit = selectedProperty?.units?.find((item) => String(item.id) === unitId && item.status === "available");
        if (!selectedProperty || !selectedUnit) throw new Error("This room is no longer available or the selection has expired. Return to the hostel list and choose another room.");
        if (!cancelled) {
          setAccount(accountData.account);
          setProperty(selectedProperty);
          setUnit(selectedUnit);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Could not load the application.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clientId, navigate, propertyId, unitId]);

  async function submitApplication(event) {
    event.preventDefault();
    if (!property || !unit) return setError("Choose an available room before applying.");
    if (!validatePhone(details.phone) || !validateName(details.guardianName) || !validatePhone(details.guardianPhone)) return setError("Check your phone number and guardian details.");
    if (!details.matricNumber.trim() || !details.level.trim()) return setError("Complete your matric number and level.");
    if (!passport || !idCard || !termsAccepted) return setError("Upload your passport photograph and student ID card, and accept the terms.");

    const form = new FormData();
    Object.entries(details).forEach(([key, value]) => form.append(key, value.trim()));
    form.append("state", property.state || "");
    form.append("lga", property.lga || "");
    form.append("propertyId", propertyId);
    form.append("unitId", unitId);
    if (clientId) form.append("clientId", clientId);
    form.append("termsAccepted", "true");
    form.append("passport", passport);
    form.append("idCard", idCard);

    setBusy(true);
    setError("");
    try {
      const token = sessionStorage.getItem(TOKEN_KEY);
      const response = await fetch("/tenant/account/applications", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Application could not be submitted.");
      navigate("/tenant/account?submitted=1", { replace: true, state: { notice: data.message } });
    } catch (submitError) {
      setError(submitError.message || "Application could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="dc-public-site min-h-screen bg-paper font-landing-sans text-ink">
    <header className="border-b border-stone bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4"><Link to="/" className="font-landing-display text-xl font-semibold">De-Crown Cottage</Link><Link to="/tenant/account" className="text-sm font-semibold underline underline-offset-4">My dashboard</Link></div></header>
    <main className="mx-auto max-w-3xl px-5 py-9 sm:py-12">
      <Link to="/rooms" className="inline-flex items-center gap-2 text-sm text-sage hover:text-ink"><ArrowLeft size={16} /> Browse hostels</Link>
      <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-moss">Step 2 · Application details</p>
      <h1 className="mt-2 font-landing-display text-3xl font-semibold sm:text-4xl">Complete your room application</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-sage">Your account is already created. Add the remaining information and documents below. Submitting this form sends your application for review; it does not allocate a room or request payment.</p>

      {loading && <p className="mt-8 border border-stone bg-white p-5 text-sm text-sage" role="status">Loading your selected room…</p>}
      {!loading && error && !property && <div className="mt-8 border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert"><p>{error}</p><Link to="/rooms" className="mt-3 inline-flex font-semibold underline">Choose another room</Link></div>}
      {!loading && property && unit && <>
        <section className="mt-7 border border-stone bg-white">
          <div className="flex items-start gap-3 bg-stone/30 p-5"><span className="rounded bg-white p-2 text-moss"><BedDouble size={22} /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-sage">Selected hostel</p><h2 className="mt-1 font-landing-display text-xl font-semibold">{property.name}</h2><p className="mt-2 flex items-start gap-2 text-sm text-sage"><MapPin size={15} className="mt-0.5 shrink-0" />{[property.address, property.lga, property.state].filter(Boolean).join(", ")}</p></div><div className="text-right"><p className="font-semibold">{unit.label}</p><p className="mt-1 font-landing-mono text-sm font-semibold">{naira(unit.rentAmount ?? property.rentAmount)}</p></div></div>
          <div className="grid gap-3 p-5 text-sm sm:grid-cols-2"><div><p className="text-xs text-sage">Applicant</p><p className="mt-1 font-medium">{account?.name}</p></div><div><p className="text-xs text-sage">Account email</p><p className="mt-1 break-all font-medium">{account?.email}</p></div></div>
        </section>

        <form onSubmit={submitApplication} className="mt-6 space-y-7 border border-stone bg-white p-5 sm:p-7" noValidate>
          <section><h2 className="font-landing-display text-xl font-semibold">Personal and student information</h2><p className="mt-1 text-sm text-sage">These details are collected separately from your basic account signup.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Phone number<input type="tel" autoComplete="tel" required maxLength={20} value={details.phone} onChange={(event) => setDetails((current) => ({ ...current, phone: event.target.value }))} className="mt-1.5 block w-full rounded border border-stone px-3.5 py-3 outline-none focus:border-moss" /></label>
              <label className="block text-sm font-medium">Matric number<input required maxLength={80} value={details.matricNumber} onChange={(event) => setDetails((current) => ({ ...current, matricNumber: event.target.value }))} className="mt-1.5 block w-full rounded border border-stone px-3.5 py-3 outline-none focus:border-moss" /></label>
              <label className="block text-sm font-medium">Level / year<input required maxLength={40} placeholder="e.g. 300 level" value={details.level} onChange={(event) => setDetails((current) => ({ ...current, level: event.target.value }))} className="mt-1.5 block w-full rounded border border-stone px-3.5 py-3 outline-none focus:border-moss" /></label>
              <label className="block text-sm font-medium">State of selected hostel<input readOnly value={property.state || "Not specified"} className="mt-1.5 block w-full rounded border border-stone bg-stone/30 px-3.5 py-3 text-sage" /></label>
              <label className="block text-sm font-medium sm:col-span-2">Local government area<input readOnly value={property.lga || "Not specified"} className="mt-1.5 block w-full rounded border border-stone bg-stone/30 px-3.5 py-3 text-sage" /></label>
            </div>
          </section>

          <section className="border-t border-stone pt-6"><h2 className="font-landing-display text-xl font-semibold">Guardian information</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Guardian full name<input required maxLength={80} value={details.guardianName} onChange={(event) => setDetails((current) => ({ ...current, guardianName: event.target.value }))} className="mt-1.5 block w-full rounded border border-stone px-3.5 py-3 outline-none focus:border-moss" /></label><label className="block text-sm font-medium">Guardian phone number<input type="tel" required maxLength={20} value={details.guardianPhone} onChange={(event) => setDetails((current) => ({ ...current, guardianPhone: event.target.value }))} className="mt-1.5 block w-full rounded border border-stone px-3.5 py-3 outline-none focus:border-moss" /></label></div></section>

          <section className="border-t border-stone pt-6"><h2 className="font-landing-display text-xl font-semibold">Required documents</h2><p className="mt-1 text-sm text-sage">Upload clear, readable files. Management will be able to open these from your application.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Passport photograph<input type="file" accept="image/*" required onChange={(event) => setPassport(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-stone/50 file:px-3 file:py-2" />{passport && <span className="mt-1 block break-all text-xs text-sage">Selected: {passport.name}</span>}</label><label className="block text-sm font-medium">Student ID card<input type="file" accept="image/*,.pdf" required onChange={(event) => setIdCard(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-stone/50 file:px-3 file:py-2" />{idCard && <span className="mt-1 block break-all text-xs text-sage">Selected: {idCard.name}</span>}</label></div></section>

          <label className="flex items-start gap-3 border-t border-stone pt-5 text-sm leading-relaxed"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required className="mt-1" /><span>I confirm that the information and documents submitted are accurate. I understand this is an application only and that a room is not allocated until the agreement and payment steps have been completed and verified.</span></label>
          {error && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/tenant/account" className="text-sm font-semibold text-sage underline underline-offset-4">Save for later / return to dashboard</Link><button disabled={busy} className="rounded bg-moss px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Submitting application…" : "Submit application for review"}</button></div>
        </form>
      </>}
    </main>
  </div>;
}
