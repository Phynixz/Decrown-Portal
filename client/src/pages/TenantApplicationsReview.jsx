import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken, withTenantContext } from "../api.js";

const statusLabels = {
  under_review: "Under review",
  rejected: "Rejected / correction required",
  agreement_requested: "Agreement requested",
  agreement_submitted: "Agreement submitted",
  payment_unlocked: "Payment authorized",
  payment_submitted: "Payment submitted",
  allocated: "Allocated",
};

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
    setApplications(data);
  }, [navigate]);

  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  async function updateStatus(application, status) {
    setBusyId(String(application._id)); setError("");
    try {
      const response = await fetch(withTenantContext(`/admin/tenant-applications/${application._id}/status`), {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: getToken() },
        body: JSON.stringify({ status, managementNote: notes[application._id] || "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update application.");
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(""); }
  }

  async function verifyPayment(application) {
    if (!window.confirm(`Verify payment and allocate Room ${application.roomNo} at ${application.location}?`)) return;
    setBusyId(String(application._id)); setError("");
    try {
      const response = await fetch(withTenantContext(`/admin/tenant-applications/${application._id}/verify-payment`), { method: "PUT", headers: { Authorization: getToken() } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment verification failed.");
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(""); }
  }

  return <div className="min-h-screen bg-bg text-text"><header className="border-b border-border bg-card"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Link to="/admin" className="font-display text-xl font-semibold">De-Crown Management</Link><Link to="/admin" className="text-sm underline underline-offset-4">Back to dashboard</Link></div></header><main className="mx-auto max-w-6xl px-5 py-9"><p className="text-xs font-semibold uppercase tracking-widest text-terra">Central management</p><h1 className="mt-2 font-display text-3xl font-semibold">Tenant room applications</h1><p className="mt-2 max-w-3xl text-sm text-muted">Review application details, request the signed physical agreement, authorize payment only after agreement review, and verify payment before allocation.</p>{error && <p role="alert" className="mt-5 rounded-lg border border-danger bg-danger-faint p-4 text-sm text-danger">{error}</p>}{applications.length === 0 ? <p className="mt-7 rounded-lg border border-border bg-card p-6 text-sm text-muted">No new-account applications yet.</p> : <div className="mt-7 space-y-5">{applications.map((app) => <article key={app._id} className="rounded-xl border border-border bg-card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{app.name} · {app.location}, Room {app.roomNo}</h2><p className="mt-1 text-sm text-muted">{app.email} · {app.phone} · Session {app.session}</p><p className="mt-1 text-sm text-muted">Matric: {app.matricNumber} · Level: {app.level} · Guardian: {app.guardianName} ({app.guardianPhone})</p></div><span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold">{statusLabels[app.status] || app.status}</span></div><div className="mt-4 flex flex-wrap gap-3 text-sm">{[["Passport", app.passport], ["ID card", app.idCard], ["Signed agreement", app.agreementCopy], ["Payment proof", app.paymentProof]].map(([label, url]) => url ? <a key={label} href={url} target="_blank" rel="noreferrer" className="rounded border border-border px-3 py-2 font-medium underline underline-offset-4">View {label}</a> : <span key={label} className="rounded border border-border px-3 py-2 text-muted">{label}: not uploaded</span>)}</div>{app.status !== "allocated" && <><label className="mt-4 block text-sm font-medium">Management note<textarea rows={2} maxLength={1000} value={notes[app._id] ?? app.managementNote ?? ""} onChange={(e) => setNotes((old) => ({ ...old, [app._id]: e.target.value }))} className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2.5" /></label><div className="mt-4 flex flex-wrap gap-2">{app.status === "under_review" && <><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "agreement_requested")} className="rounded bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Request signed agreement</button><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "rejected")} className="rounded border border-danger px-4 py-2.5 text-sm font-semibold text-danger disabled:opacity-50">Reject / request correction</button></>}{app.status === "agreement_submitted" && <><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "payment_unlocked")} className="rounded bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Accept agreement & unlock payment</button><button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "rejected")} className="rounded border border-danger px-4 py-2.5 text-sm font-semibold text-danger disabled:opacity-50">Reject agreement</button></>}{app.status === "rejected" && <button disabled={busyId === String(app._id)} onClick={() => updateStatus(app, "under_review")} className="rounded border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Return to review</button>}{app.status === "payment_submitted" && <button disabled={busyId === String(app._id)} onClick={() => verifyPayment(app)} className="rounded bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Verify payment & allocate room</button>}</div></>}</article>)}</div>}</main></div>;
}
