import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../theme.js";
import {
  getTenantToken,
  setTenantToken,
  clearTenantToken,
  fmtNaira,
  fmtDate,
} from "../api.js";
import "../styles/login.css";
import "../styles/tenant-portal.css";

const avatarFor = (name) =>
  "https://ui-avatars.com/api/?name=" +
  encodeURIComponent(name || "?") +
  "&background=1a3c5e&color=fff&bold=true&size=200";

export default function TenantPortal() {
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [token, setToken] = useState(() => getTenantToken());
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [nextSession, setNextSession] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [loading, setLoading] = useState(!!getTenantToken());

  // Login form
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // History selector
  const [selId, setSelId] = useState("");

  // Re-upload state
  const [reupFiles, setReupFiles] = useState({ passport: null, idCard: null, paymentProof: null });
  const [reupLabels, setReupLabels] = useState({});
  const [retainLabel, setRetainLabel] = useState("📎 Choose file (JPG, PNG or PDF)");

  // Profile modal
  const [profileOpen, setProfileOpen] = useState(false);
  const [revoked, setRevoked] = useState(null);

  const loadHistory = useCallback(async (tok) => {
    try {
      const res = await fetch("/tenant/history", {
        headers: { Authorization: tok },
      });
      if (!res.ok) return;
      setHistory(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  const showDashboard = useCallback(
    async (tok) => {
      try {
        const res = await fetch("/tenant/me", {
          headers: { Authorization: tok },
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          if (d && d.revoked) {
            setRevoked(d);
            setLoading(false);
            return;
          }
          signOut();
          return;
        }
        const p = await res.json();
        setProfile(p);

        const sessRes = await fetch("/current-session");
        const sessData = await sessRes.json();
        setNextSession(sessData.next || "");
        setRegistrationOpen(sessData.registrationOpen !== false);

        await loadHistory(tok);
        setLoading(false);
      } catch {
        signOut();
      }
    },
    [loadHistory],
  );

  useEffect(() => {
    if (getTenantToken()) showDashboard(getTenantToken());
  }, []);

  function signOut() {
    clearTenantToken();
    setToken("");
    setProfile(null);
    setHistory([]);
    setRevoked(null);
    setLoading(false);
  }

  async function tenantLogin() {
    if (!email.trim() || !phone.trim()) {
      setLoginErr("Please enter both your email and phone number.");
      return;
    }
    setLoginErr("");
    setLoginBusy(true);
    try {
      const res = await fetch("/tenant/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setTenantToken(data.token);
      setToken(getTenantToken());
      setLoading(true);
      await showDashboard(getTenantToken());
    } catch (err) {
      setLoginErr(err.message);
    } finally {
      setLoginBusy(false);
    }
  }

  // ── Retention step ──────────────────────────────────────────────
  const nextRec = history.find((r) => r.session === nextSession);
  const retainStep = !nextRec
    ? 1
    : nextRec.retainPending && !nextRec.paymentProof
      ? 2
      : nextRec.retainPending && nextRec.paymentProof
        ? 3
        : 4;

  async function retainRoom() {
    if (
      !confirm(
        `Request to retain Room ${profile?.roomNo} for ${nextSession}?\n\nYou will upload your payment receipt in the next step.`,
      )
    )
      return;

    await loadHistory(token);
    const existing = history.find((r) => r.session === nextSession);
    if (existing) {
      if (existing.retainPending && !existing.paymentProof) {
        alert(
          "You already requested retention for the next session. Please upload your payment receipt.",
        );
      } else if (existing.retainPending && existing.paymentProof) {
        alert(
          "Your retention request already has a receipt uploaded. Waiting for admin approval.",
        );
      } else {
        alert("Your room is already retained for the next session.");
      }
      return;
    }

    try {
      const res = await fetch("/tenant/retain", {
        method: "POST",
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to request retention.");
      await loadHistory(token);
      alert(
        "Retention request created. Please upload your payment receipt in the next step.",
      );
    } catch (err) {
      alert("❌ " + err.message);
    }
  }

  async function uploadReceipt() {
    const input = document.getElementById("retainFile");
    if (!input || !input.files[0]) {
      alert("Please select a file first.");
      return;
    }
    const formData = new FormData();
    formData.append("paymentProof", input.files[0]);
    try {
      const res = await fetch("/tenant/upload-retain-proof", {
        method: "POST",
        headers: { Authorization: token },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("✅ Receipt uploaded. The admin will confirm your room shortly.");
      await loadHistory(token);
      if (input) input.value = "";
    } catch (err) {
      alert("❌ " + err.message);
    }
  }

  function viewReceipt() {
    const rec = history.find((r) => r.session === nextSession);
    let receiptId = profile?._id;
    if (rec && !rec.retainPending) receiptId = rec._id;
    if (!receiptId) {
      alert("No receipt available.");
      return;
    }
    window.open(`/receipt?id=${receiptId}`, "_blank");
  }

  // ── History detail ──────────────────────────────────────────────
  const selRec = history.find((r) => r._id === selId);

  function openHistoryReceipt() {
    if (!selRec) return;
    if (selRec.retainPending) {
      alert(
        "This session is pending admin approval — receipt unavailable until approved.",
      );
      return;
    }
    window.open(`/receipt?id=${selRec._id}`, "_blank");
  }

  // ── Re-upload ───────────────────────────────────────────────────
  const hasReupAccess = !!(
    profile?.canReuploadPassport ||
    profile?.canReuploadIdCard ||
    profile?.canReuploadProof
  );
  const reupExpired =
    profile?.reuploadExpiresAt && new Date(profile.reuploadExpiresAt) < new Date();
  const showReupload = hasReupAccess && !reupExpired;
  const hoursLeft = profile?.reuploadExpiresAt
    ? Math.ceil(
        (new Date(profile.reuploadExpiresAt) - new Date()) / (1000 * 60 * 60),
      )
    : 0;

  function previewReupload(field, file, retain) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File must be under 5MB");
      return;
    }
    setReupFiles((f) => ({ ...f, [field]: file }));
    if (retain) setRetainLabel("✅ " + file.name);
    else setReupLabels((l) => ({ ...l, [field]: "✅ " + file.name }));
  }

  async function submitReupload(field) {
    const file = reupFiles[field];
    if (!file) {
      alert("Please select a file first");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("field", field);
      const res = await fetch("/tenant/reupload", {
        method: "PUT",
        headers: { Authorization: token },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("✅ " + data.message);
      setReupFiles((f) => ({ ...f, [field]: null }));
      setReupLabels((l) => ({ ...l, [field]: "" }));
      await showDashboard(token);
    } catch (e) {
      alert("❌ " + e.message);
    }
  }

  // ── Revoked screen ──────────────────────────────────────────────
  if (revoked) {
    return (
      <div className="dc-portal">
        <div className="revoked-screen">
          <div className="revoked-card">
            <div className="revoked-icon">🚫</div>
            <h2>Access Revoked</h2>
            <p>
              Your portal access has been revoked by management. You can no
              longer view your room, receipt, or make any requests.
            </p>
            {revoked.reason && (
              <div className="revoked-reason">Reason: {revoked.reason}</div>
            )}
            <button className="btn-signout" onClick={signOut}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Login screen (new design matching admin login) ──────────────
  if (!token || (!profile && !loading)) {
    return (
      <div className="dc-portal dc-login">
        <div className="login-grid">
          <div className="login-columns">
            {/* ── Left image panel ────────────────────── */}
            <div className="panel-left">
              <img
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80"
                alt="De-Crown Cottage hostel exterior"
                className="panel-left-bg"
              />
              <div className="panel-left-overlay" />

              <span aria-hidden="true" className="corner-accent corner-tl" />
              <span aria-hidden="true" className="corner-accent corner-tr" />
              <span aria-hidden="true" className="corner-accent corner-bl" />
              <span aria-hidden="true" className="corner-accent corner-br" />

              <div className="logo-area">
                <Link to="/" className="logo-brand">
                  <span className="logo-name">De-Crown</span>
                  <span className="logo-sub">Cottage</span>
                </Link>
              </div>

              <div className="left-content">
                <p className="welcome-label">Welcome Back</p>
                <h2>Your home away from home.</h2>
                <p className="welcome-desc">
                  Sign in to view your room, receipts, and manage your
                  campus accommodation.
                </p>

                <dl className="stats-grid">
                  <div className="stat-box">
                    <dd className="stat-num">2</dd>
                    <dt className="stat-desc">Campus locations</dt>
                  </div>
                  <div className="stat-box">
                    <dd className="stat-num">24/7</dd>
                    <dt className="stat-desc">Portal access</dt>
                  </div>
                </dl>
              </div>

              <div className="left-footer">
                <p>© 2025 De-Crown Cottage. All rights reserved.</p>
                <Link to="/login" className="switch-link">
                  🔐 Admin Login →
                </Link>
              </div>
            </div>

            {/* ── Right form panel ────────────────────── */}
            <div className="panel-right">
              <button
                className="theme-btn"
                onClick={toggleTheme}
                title="Toggle dark mode"
              >
                {dark ? "☀️" : "🌙"}
              </button>

              <div className="login-inner">
                <div className="mobile-logo">
                  <Link to="/" className="logo-brand">
                    <span className="logo-name">De-Crown</span>
                    <span className="logo-sub">Cottage</span>
                  </Link>
                </div>

                <p className="login-label">Tenant Portal</p>
                <h1 className="login-title">Welcome back</h1>
                <p className="login-subtitle">
                  Enter your registered email and phone number to access
                  your room, receipts, and accommodation details.
                </p>

                <div>
                  <form
                    className="login-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      tenantLogin();
                    }}
                    noValidate
                  >
                    <div className="field">
                      <label className="field-label" htmlFor="tp-email">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="tp-email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="tp-phone">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="tp-phone"
                        placeholder="08012345678"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>

                    <button
                      className="btn-login"
                      type="submit"
                      disabled={loginBusy}
                    >
                      {loginBusy ? "Checking…" : "Access My Portal"}
                    </button>

                    <div className={"error-box" + (loginErr ? " show" : "")}>
                      {loginErr}
                    </div>
                  </form>

                  <div className="login-divider">
                    <span>or</span>
                  </div>

                  <div className="login-footer-links">
                    <p className="portal-link">
                      📝 <Link to="/register">New tenant? Register here</Link>
                    </p>
                    <p className="back-link">
                      <Link to="/">← Back to De-Crown</Link>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────
  if (loading || !profile) {
    return (
      <div className="dc-portal">
        <div className="flex flex-col items-center justify-center gap-4 min-h-screen bg-bg">
          <div className="w-9 h-9 rounded-full border-[3px] border-border border-t-navy animate-spin"></div>
          <p className="text-sm text-muted">Loading your portal…</p>
        </div>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────
  const h = new Date().getHours();
  const greeting =
    h < 12 ? "Good morning," : h < 17 ? "Good afternoon," : "Good evening,";

  const reupItems = [
    { field: "passport", label: "📷 Passport Photo", accept: "image/*", hint: "Click to select image" },
    { field: "idCard", label: "🪪 ID Card", accept: "image/*,.pdf", hint: "Click to select image or PDF" },
    { field: "paymentProof", label: "📄 Payment Proof", accept: "image/*,.pdf", hint: "Click to select image or PDF" },
  ];

  return (
    <div className="dc-portal">
      <div id="dashScreen">
        <header className="dash-nav">
          <div className="nav-brand">
            <img src="/d420ac751563a3d498bd84cdf69386bb.jpg" alt="logo" />
            <span>De-Crown Cottage</span>
          </div>
          <div className="nav-right">
            <button
              className="theme-btn"
              onClick={toggleTheme}
              title="Toggle dark mode"
            >
              {dark ? "☀️" : "🌙"}
            </button>
            <button className="btn-profile" onClick={() => setProfileOpen(true)}>
              👤 View Profile
            </button>
            <button className="btn-signout" onClick={signOut}>
              Sign Out
            </button>
          </div>
        </header>

        <main className="dash-main">
          {retainStep === 3 && (
            <div className="block w-full mb-4.5 px-5 py-4.5 rounded-[14px] text-center font-extrabold text-xl leading-snug bg-[#fff0f0] border border-[#ffb3b3] text-[#961b1b]">
              ⏳ <strong>Pending retention request:</strong> your next-session
              room is awaiting admin approval.
            </div>
          )}

          {profile.status === "revoked" && (
            <div className="revoked-banner" style={{ display: "flex" }}>
              <div className="revoked-banner-left">
                <span className="revoked-icon">🚫</span>
                <div>
                  <div className="revoked-title">
                    Your Application Has Been Flagged
                  </div>
                  <div className="revoked-reason">
                    Reason: {profile.revokeReason || "Not specified"}
                  </div>
                  {profile.revokeNote && (
                    <div className="revoked-note">Note: {profile.revokeNote}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="welcome-banner">
            <div className="welcome-text">
              <p className="welcome-greeting">{greeting}</p>
              <h2 className="welcome-name">{profile.name || "—"}</h2>
              <p className="welcome-loc">
                {(profile.location || "") + " Campus"}
              </p>
            </div>
            <div className="welcome-room-wrap">
              <p className="room-label">Your Room</p>
              <p className="room-num">{profile.roomNo || "—"}</p>
            </div>
          </div>

          <div className="info-grid">
            {[
              ["📅", "Session", profile.session || "—"],
              ["🎓", "Level", profile.level || "—"],
              ["💰", "Rent Paid", fmtNaira(profile.amount)],
              ["🗓", "Payment Date", fmtDate(profile.paymentDate) || "—"],
            ].map(([icon, label, val]) => (
              <div className="info-card" key={label}>
                <span className="info-icon">{icon}</span>
                <span className="info-label">{label}</span>
                <span className="info-val">{val}</span>
              </div>
            ))}
          </div>

          {!registrationOpen && (
            <div className="mb-3 p-2.5 rounded-md bg-[#fff3cd] text-[#856404] border border-[#ffeeba]">
              New registrations are currently closed by the admin.
            </div>
          )}

          <div className="retain-card">
            <div className="retain-left">
              <h3>📋 Retain Your Room</h3>
              <p>
                Reserve your room for the next session. You will upload your
                payment receipt here — your room is confirmed once admin
                approves.
              </p>
              <span className="next-badge">Next: {nextSession || "—"}</span>
            </div>

            <div className="retain-right">
              {retainStep === 1 && (
                <div id="retainStep1">
                  <button
                    className="btn-retain"
                    onClick={retainRoom}
                    disabled={!registrationOpen}
                  >
                    {registrationOpen ? "🔒 Request Retention" : "Registration Closed"}
                  </button>
                </div>
              )}

              {retainStep === 2 && (
                <div id="retainStep2">
                  <p className="step-label">Step 2 — Upload Payment Receipt</p>
                  <label className="upload-box" htmlFor="retainFile">
                    <span id="uploadLabel">{retainLabel}</span>
                    <input
                      type="file"
                      id="retainFile"
                      accept="image/*,application/pdf"
                      style={{ display: "none" }}
                      onChange={(e) =>
                        previewReupload("paymentProof", e.target.files[0], true)
                      }
                    />
                  </label>
                  <button
                    className="btn-retain btn-upload"
                    onClick={uploadReceipt}
                    disabled={!reupFiles.paymentProof}
                  >
                    ⬆️ Submit Receipt
                  </button>
                </div>
              )}

              {retainStep === 3 && (
                <div id="retainStep3">
                  <div className="status-pill pending">
                    ⏳ Receipt received — awaiting admin approval
                  </div>
                  <p className="step-note">
                    Your room is reserved. The admin will confirm after
                    verifying your payment.
                  </p>
                </div>
              )}

              {retainStep === 4 && (
                <div id="retainStep4">
                  <div className="status-pill confirmed">
                    ✅ Room confirmed for next session
                  </div>
                </div>
              )}
            </div>
          </div>

          {showReupload && (
            <div className="reupload-section" id="reuploadSection">
              <div className="reupload-header">
                <h3>📤 Re-upload Documents</h3>
                <p>
                  Admin has granted you access to re-upload the following
                  documents. Access expires in 24 hours.
                </p>
                {profile.reuploadExpiresAt && (
                  <div className="reupload-expiry">
                    ⏰ Access expires in {Math.max(hoursLeft, 0)} hour(s)
                  </div>
                )}
              </div>

              <div className="reupload-grid">
                {reupItems
                  .filter((it) => REUP_FLAGS[it.field])
                  .filter((it) => profile[REUP_FLAGS[it.field]])
                  .map(({ field, label, accept, hint }) => (
                    <div className="reupload-item" key={field}>
                      <div className="reupload-label">{label}</div>
                      <label
                        className="upload-box"
                        htmlFor={"new" + cap(field) + "File"}
                      >
                        <span>{reupLabels[field] || hint}</span>
                        <input
                          type="file"
                          id={"new" + cap(field) + "File"}
                          accept={accept}
                          style={{ display: "none" }}
                          onChange={(e) =>
                            previewReupload(field, e.target.files[0])
                          }
                        />
                      </label>
                      <button
                        className="btn-reupload"
                        onClick={() => submitReupload(field)}
                        disabled={!reupFiles[field]}
                      >
                        ⬆️ Upload {field === "paymentProof" ? "Proof" : cap(field)}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="actions-grid">
            <button className="action-tile" onClick={viewReceipt}>
              <span className="action-icon">🧾</span>
              <span>View Receipt</span>
            </button>
            <a
              href={profile.paymentProof || "#"}
              target="_blank"
              rel="noopener"
              className={
                "action-tile" + (profile.paymentProof ? "" : " opacity-50")
              }
              onClick={(e) => {
                if (!profile.paymentProof) {
                  e.preventDefault();
                  alert("No payment proof uploaded yet.");
                }
              }}
            >
              <span className="action-icon">📄</span>
              <span>Payment Proof</span>
            </a>
            {profile.agreementCopy && (
              <a
                href={profile.agreementCopy}
                target="_blank"
                rel="noopener"
                className="action-tile"
              >
                <span className="action-icon">📋</span>
                <span>Agreement Copy</span>
              </a>
            )}
            <Link
              to="/register"
              className={
                "action-tile" + (registrationOpen ? "" : " pointer-events-none opacity-50")
              }
            >
              <span className="action-icon">📝</span>
              <span>New Registration</span>
            </Link>
          </div>

          <div className="history-section">
            <div className="history-header">
              <h3>📂 Session History</h3>
              <select
                value={selId}
                onChange={(e) => setSelId(e.target.value)}
              >
                <option value="">Select a session…</option>
                {history.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.session}
                    {r.retainPending ? " ⏳" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selRec && (
              <div id="historyDetail">
                <div className="history-grid">
                  {[
                    ["Session", selRec.session || "—"],
                    ["Room", selRec.roomNo || "—"],
                    ["Amount Paid", fmtNaira(selRec.amount)],
                    ["Payment Date", fmtDate(selRec.paymentDate) || "—"],
                    [
                      "Status",
                      selRec.retainPending ? "⏳ Pending approval" : "✅ Confirmed",
                    ],
                  ].map(([label, val]) => (
                    <div className="hdet" key={label}>
                      <div className="hdet-label">{label}</div>
                      <div className="hdet-val">{val}</div>
                    </div>
                  ))}
                </div>

                <div className="history-actions">
                  <button className="hbtn" onClick={openHistoryReceipt}>
                    🧾 Generate Receipt
                  </button>
                  <a
                    className={
                      "hbtn hbtn-proof" + (selRec.paymentProof ? "" : " opacity-45")
                    }
                    href={selRec.paymentProof || "#"}
                    target="_blank"
                    rel="noopener"
                    onClick={(e) => {
                      if (!selRec.paymentProof) {
                        e.preventDefault();
                        alert("No payment proof for this session.");
                      }
                    }}
                  >
                    📄 View Proof
                  </a>
                </div>

                {selRec.changeLog && selRec.changeLog.length > 0 && (
                  <div className="px-3.5 pt-2.5 pb-3 border-t border-border2">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-[0.8px] mb-2">
                      Document Changes
                    </p>
                    {selRec.changeLog.map((entry, i) => {
                      const labelMap = {
                        passport: "📷 Passport Photo",
                        idCard: "🪪 ID Card",
                        paymentProof: "📄 Payment Proof",
                      };
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between py-2 border-b border-border2 text-xs"
                        >
                          <span className="text-text font-medium">
                            {labelMap[entry.field] || entry.field}
                          </span>
                          <span className="text-muted">
                            {entry.note} ·{" "}
                            {new Date(entry.changedAt).toLocaleDateString(
                              "en-NG",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Profile modal */}
      {profileOpen && (
        <>
          <div
            className="profile-backdrop"
            style={{ display: "block" }}
            onClick={() => setProfileOpen(false)}
          ></div>
          <div className="profile-modal" style={{ display: "flex" }}>
            <div className="profile-modal-head">
              <h3>👤 My Profile</h3>
              <button onClick={() => setProfileOpen(false)}>✕</button>
            </div>
            <div className="profile-modal-body">
              <div className="profile-avatar-wrap">
                <img
                  src={profile.passport || avatarFor(profile.name)}
                  alt=""
                  className="profile-avatar"
                />
              </div>
              <div className="profile-fields">
                {[
                  ["Full Name", profile.name],
                  ["Email", profile.email],
                  ["Phone", profile.phone],
                  ["Location", profile.location],
                  ["Room", profile.roomNo],
                  ["Level", profile.level],
                  ["Session", profile.session],
                  ["Guardian", profile.guardianName],
                  ["Guardian Phone", profile.guardianPhone],
                ].map(([label, val]) => (
                  <div className="pfield" key={label}>
                    <span className="pfield-label">{label}</span>
                    <span className="pfield-val">{val || "—"}</span>
                  </div>
                ))}
              </div>
              <div className="profile-docs">
                <p className="profile-docs-label">Documents</p>
                <div className="profile-docs-grid">
                  {[
                    ["pPassportLink", "📷 Passport", profile.passport],
                    ["pIdLink", "🪪 ID Card", profile.idCard],
                    ["pProofLink", "📄 Payment Proof", profile.paymentProof],
                    ["pAgreementLink", "📋 Agreement", profile.agreementCopy],
                  ].map(([id, label, href]) => (
                    <a
                      key={id}
                      id={id}
                      href={href || "#"}
                      target="_blank"
                      rel="noopener"
                      className={
                        "profile-doc-btn" + (href ? "" : " opacity-40")
                      }
                      onClick={(e) => {
                        if (!href) e.preventDefault();
                      }}
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const REUP_FLAGS = {
  passport: "canReuploadPassport",
  idCard: "canReuploadIdCard",
  paymentProof: "canReuploadProof",
};

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
