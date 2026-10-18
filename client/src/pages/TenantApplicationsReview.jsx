import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, ExternalLink, UserRound } from "lucide-react";
import { getToken, withTenantContext } from "../api.js";

const statusLabels = {
  under_review: "Under review",
  rejected: "Rejected / correction required",
  agreement_requested: "Agreement requested",
  agreement_submitted: "Agreement submitted",
  payment_unlocked: "Payment authorized",
  payment_submitted: "Payment submitted",
  payment_verified: "Payment verified",
  allocated: "Allocated",
};

function DocumentLink({ label, url, preview = false }) {
  if (!url) return <div className="rounded border border-border bg-surface px-3 py-3 text-sm text-muted"><p className="font-medium">{label}</p><p className="mt-1 text-xs">Not uploaded</p></div>;
  const isPdf = /\.pdf(?:$|\?)/i.test(url);
  return <div className="min-w-0 rounded border border-border bg-card p-3">
    <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><FileText size={17} className="shrink-0 text-muted" /><span className="truncate text-sm font-semibold">{label}</span></div><a href={url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold underline underline-offset-4" aria-label={`Open ${label}`}><ExternalLink size={13} /> Open</a></div>
    {preview && !isPdf && <a href={url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded border border-border bg-surface"><img src={url} alt={`${label} uploaded by tenant`} loading="lazy" className="max-h-64 w-full object-contain" /></a>}
    {isPdf && <p className="mt-2 text-xs text-muted">PDF document · open to inspect</p>}
  </div>;
}

function Detail({ label, value }) {
  return <div className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-text">{value || "Not provided"}</dd></div>;
}

export default function TenantApplicationsReview() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { navigate("/login", { replace: true }); return; }
    const response = await fetch(withTenantContext("/admin/tenant-applications"), { headers: { Authorization: token } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load tenant applications.");
    setApplications(Array.isArray(data) ? data : []);
  }, [navigate]);

  useEffect(() => { load().catch((loadError) => setError(loadError.message)); }, [load]);

  async function updateStatus(application, status) {
    setBusyId(String(application._id));
    setError("");
    try {
      const response = await fetch(withTenantContext(`/admin/tenant-applications/${application._id}/status`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: getToken() },
        body: JSON.stringify({ status, managementNote: notes[application._id] ?? application.managementNote ?? "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update application.");
      await load();
    } catch (actionError) { setError(actionError.message); }
    finally { setBusyId(""); }
  }

  async function verifyPayment(application) {
    if (!window.confirm(`Verify payment and allocate ${application.roomNo} at ${application.location}?`)) return;
    setBusyId(String(application._id));
    setError("");
    try {
      const response = await fetch(withTenantContext(`/admin/tenant-applications/${application._id}/verify-payment`), { method: "PUT", headers: { Authorization: getToken() } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment verification failed.");
      await load();
    } catch (actionError) { setError(actionError.message); }
    finally { setBusyId(""); }
  }

  return <div className="min-h-screen bg-bg text-text">
    <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Link to="/admin" className="font-display text-xl font-semibold">De-Crown Management</Link><Link to="/admin" className="text-sm underline underline-offset-4">Back to dashboard</Link></div></header>
    <main className="mx-auto max-w-6xl px-5 py-9">
      <p className="text-xs font-semibold uppercase tracking-widest text-terra">Central management</p><h1 className="mt-2 font-display text-3xl font-semibold">Tenant room applications</h1><p className="mt-2 max-w-3xl text-sm text-muted">Review all submitted personal information and uploaded documents. Request the signed physical agreement, authorize payment only after accepting it, and verify payment before allocation.</p>
      {error && <p role="alert" className="mt-5 rounded-lg border border-danger bg-danger-faint p-4 text-sm text-danger">{error}</p>}
      {applications.length === 0 ? <p className="mt-7 rounded-lg border border-border bg-card p-6 text-sm text-muted">No new-account applications yet.</p> : <div className="mt-7 space-y-5">{applications.map((app) => <article key={app._id} className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{app.name} · {app.location}, {app.roomNo}</h2><p className="mt-1 text-sm text-muted">{app.email} · {app.phone || "Phone not provided"} · Session {app.session}</p></div><span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold">{statusLabels[app.status] || app.status}</span></div>

        <details className="mt-4 rounded-lg border border-border bg-card" open><summary className="cursor-pointer px-4 py-3 text-sm font-semibold"><span className="inline-flex items-center gap-2"><UserRound size={16} /> Applicant information and documents</span></summary><div className="border-t border-border p-4">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Full name" value={app.name} /><Detail label="Email address" value={app.email} /><Detail label="Phone number" value={app.phone} /><Detail label="Matric number" value={app.matricNumber} /><Detail label="Level / year" value={app.level} /><Detail label="Guardian name" value={app.guardianName} /><Detail label="Guardian phone" value={app.guardianPhone} /><Detail label="State" value={app.state} /><Detail label="Local government area" value={app.lga} /><Detail label="Hostel / property" value={app.location} /><Detail label="Room" value={app.roomNo} /><Detail label="Rent amount" value={Number(app.rentAmount) > 0 ? `₦${Number(app.rentAmount).toLocaleString("en-NG")}` : "Not set"} /></dl>
          <h3 className="mt-6 text-sm font-semibold">Uploaded documents</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{[["Passport photograph", app.passport, true], ["Student ID card", app.idCard, true], ["Signed agreement", app.agreementCopy, true], ["Payment proof", app.paymentProof, true]].map(([label, url, preview]) => <DocumentLink key={label} label={label} url={url} preview={preview} />)}</div>
        </div></details>

        {app.managementNote && <p className="mt-3 rounded bg-surface p-3 text-sm text-muted">Current management note: {app.managementNote}</p>}
        {app.status !== "allocated" && <><label className="mt-4 block text-sm font-medium">Management note<textarea rows={2} maxLength={1000} value={notes[app._id] ?? app.managementNote ?? ""} onChange={(event) => setNotes((old) => ({ ...old, [app._id]: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2.5" /></label><div className="mt-4 flex flex-wrap gap-2">
          {app.status === "under_review" && <><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "agreement_requested")} className="rounded bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Request signed agreement</button><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "rejected")} className="rounded border border-danger px-4 py-2.5 text-sm font-semibold text-danger disabled:opacity-50">Reject / request correction</button></>}
          {app.status === "agreement_submitted" && <><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "payment_unlocked")} className="rounded bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Accept agreement & unlock payment</button><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "rejected")} className="rounded border border-danger px-4 py-2.5 text-sm font-semibold text-danger disabled:opacity-50">Reject agreement</button></>}
          {app.status === "rejected" && <button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "under_review")} className="rounded border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Return to review</button>}
          {app.status === "payment_submitted" && <button disabled={busyId === String(app._id)} onClick={() => verifyPayment(app)} className="rounded bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Verify payment & allocate room</button>}
        </div></>}
      </article>)}</div>}
    </main>
  </div>;
}
