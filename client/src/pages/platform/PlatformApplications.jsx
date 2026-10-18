import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw, UserRound } from "lucide-react";
import { getJSON } from "../../api.js";

const TOKEN = () => sessionStorage.getItem("platformToken") || "";
const labels = {
  under_review: "Under review",
  rejected: "Correction requested",
  agreement_requested: "Awaiting signed agreement",
  agreement_submitted: "Agreement submitted",
  payment_unlocked: "Payment authorized",
  payment_submitted: "Payment awaiting verification",
  allocated: "Room allocated",
};

function Document({ label, url, preview = false }) {
  if (!url) return <div className="rounded-lg border border-border p-3 text-sm text-muted dark:border-border-dark dark:text-muted-dark"><p className="font-medium">{label}</p><p className="mt-1 text-xs">Not uploaded</p></div>;
  const isPdf = /\.pdf(?:$|\?)/i.test(url);
  return <div className="min-w-0 rounded-lg border border-border p-3 dark:border-border-dark"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-ink dark:text-ink-dark">{label}</span><a href={url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold underline"><ExternalLink size={13} /> Open</a></div>{preview && !isPdf && <a href={url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded bg-surface dark:bg-white/5"><img src={url} alt={`${label} submitted by tenant`} loading="lazy" className="max-h-64 w-full object-contain" /></a>}{isPdf && <p className="mt-2 text-xs text-muted dark:text-muted-dark">PDF document · open to inspect</p>}</div>;
}

function Field({ label, value }) {
  return <div className="min-w-0"><dt className="text-xs text-muted dark:text-muted-dark">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-ink dark:text-ink-dark">{value || "Not provided"}</dd></div>;
}

export default function PlatformApplications() {
  const [applications, setApplications] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getJSON("/platform/tenant-applications", TOKEN());
      setApplications(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || "Could not load tenant applications.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(application, status) {
    setBusyId(String(application._id)); setError(""); setNotice("");
    try {
      const response = await fetch(`/platform/tenant-applications/${application._id}/status`, {
        method: "PUT", headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, managementNote: notes[application._id] ?? application.managementNote ?? "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update application.");
      setNotice(data.message || "Application updated."); await load();
    } catch (actionError) { setError(actionError.message || "Could not update application."); }
    finally { setBusyId(""); }
  }

  async function verifyPayment(application) {
    if (!window.confirm(`Verify payment and allocate ${application.roomNo} at ${application.location}?`)) return;
    setBusyId(String(application._id)); setError(""); setNotice("");
    try {
      const response = await fetch(`/platform/tenant-applications/${application._id}/verify-payment`, { method: "PUT", headers: { Authorization: `Bearer ${TOKEN()}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment verification failed.");
      setNotice(data.message || "Payment verified and room allocated."); await load();
    } catch (actionError) { setError(actionError.message || "Payment verification failed."); }
    finally { setBusyId(""); }
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Central agency workflow</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">Tenant applications</h1><p className="mt-1 max-w-3xl text-sm text-muted dark:text-muted-dark">Review the information and documents tenants submit across the platform. Manage agreements, payment authorization, and room allocation centrally.</p></div><button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium dark:border-border-dark dark:bg-card-dark"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh</button></header>
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading && applications.length === 0 ? <p className="py-12 text-sm text-muted dark:text-muted-dark">Loading applications…</p> : applications.length === 0 ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted dark:border-border-dark dark:text-muted-dark">No tenant applications have been submitted yet.</div> : <div className="space-y-5">{applications.map((app) => <article key={app._id} className="rounded-xl2 border border-border bg-card p-5 shadow-card dark:border-border-dark dark:bg-card-dark sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">{app.clientName}</p><h2 className="mt-1 text-lg font-semibold text-ink dark:text-ink-dark">{app.name} · {app.location}, {app.roomNo}</h2><p className="mt-1 break-all text-sm text-muted dark:text-muted-dark">{app.email} · {app.phone || "Phone not provided"}</p></div><span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink dark:bg-white/5 dark:text-ink-dark">{labels[app.status] || app.status}</span></div>
      <details className="mt-4 rounded-lg border border-border dark:border-border-dark" open><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink dark:text-ink-dark"><span className="inline-flex items-center gap-2"><UserRound size={15} /> Full applicant information and uploads</span></summary><div className="border-t border-border p-4 dark:border-border-dark"><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Full name" value={app.name} /><Field label="Email" value={app.email} /><Field label="Phone" value={app.phone} /><Field label="Matric number" value={app.matricNumber} /><Field label="Level / year" value={app.level} /><Field label="Guardian name" value={app.guardianName} /><Field label="Guardian phone" value={app.guardianPhone} /><Field label="State" value={app.state} /><Field label="LGA" value={app.lga} /><Field label="Hostel" value={app.location} /><Field label="Room" value={app.roomNo} /><Field label="Rent amount" value={Number(app.rentAmount) > 0 ? `₦${Number(app.rentAmount).toLocaleString("en-NG")}` : "Not set"} /></dl><h3 className="mt-6 text-sm font-semibold text-ink dark:text-ink-dark">Uploaded documents</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{[["Passport photograph", app.passport], ["Student ID card", app.idCard], ["Signed agreement", app.agreementCopy], ["Payment proof", app.paymentProof]].map(([label, url]) => <Document key={label} label={label} url={url} preview />)}</div></div></details>
      {app.managementNote && <p className="mt-3 rounded-lg bg-surface p-3 text-sm text-muted dark:bg-white/5 dark:text-muted-dark">Current note: {app.managementNote}</p>}
      {app.status !== "allocated" && <><label className="mt-4 block text-sm font-medium text-ink dark:text-ink-dark">Management note<textarea rows={2} maxLength={1000} value={notes[app._id] ?? app.managementNote ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [app._id]: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm dark:border-border-dark" /></label><div className="mt-4 flex flex-wrap gap-2">
        {app.status === "under_review" && <><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "agreement_requested")} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-ink">Request signed agreement</button><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "rejected")} className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">Request correction / reject</button></>}
        {app.status === "agreement_submitted" && <><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "payment_unlocked")} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-ink">Accept agreement & unlock payment</button><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "rejected")} className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">Reject agreement</button></>}
        {app.status === "rejected" && <button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "under_review")} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold dark:border-border-dark">Return to review</button>}
        {app.status === "payment_submitted" && <button disabled={busyId === String(app._id)} onClick={() => verifyPayment(app)} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Verify payment & allocate room</button>}
      </div></>}
    </article>)}</div>}
  </div>;
}
