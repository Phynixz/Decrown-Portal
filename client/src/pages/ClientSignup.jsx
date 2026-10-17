import { useState } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useTheme } from "../theme.js";
import { sendJSON } from "../api.js";
import { validateEmail } from "../utils/validation.js";

export default function ClientSignup() {
  const { dark, toggleTheme } = useTheme();

  const [step, setStep] = useState("form"); // form -> verify -> pending
  const [clientId, setClientId] = useState("");
  const [clientSubdomain, setClientSubdomain] = useState("");

  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [code, setCode] = useState("");

  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSignup(e) {
    e.preventDefault();
    const contact = contactName.trim();
    const trimmedEmail = email.trim();

    if (!contact || !trimmedEmail || !password) {
      setErr("Please fill in your full name, email, and password.");
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setErr("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    setErr("");
    setBusy(true);
    try {
      const data = await sendJSON("POST", "/client/signup", {
        contactName: contact,
        email: trimmedEmail,
        phone: phone.trim(),
        password,
      });
      setClientId(data.clientId);
      setClientSubdomain(data.subdomain);
      setStep("verify");
      setNotice(
        data.developmentCode
          ? `Local verification code: ${data.developmentCode}`
          : "We sent a 6-digit code to " + trimmedEmail,
      );
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setErr("Enter the 6-digit code from your email.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      await sendJSON("POST", "/client/verify-email", {
        clientId,
        code: code.trim(),
      });
      setStep("pending");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      await sendJSON("POST", "/client/resend-code", { clientId });
      setNotice("A new code has been sent.");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dc-login">
      <div className="login-grid">
        <div className="login-columns">
          {/* ── Left panel ─────────────────────────────── */}
          <div className="panel-left">
            <img
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80"
              alt="Property management platform"
              className="panel-left-bg"
            />
            <div className="panel-left-overlay" />

            <span aria-hidden="true" className="corner-accent corner-tl" />
            <span aria-hidden="true" className="corner-accent corner-tr" />
            <span aria-hidden="true" className="corner-accent corner-bl" />
            <span aria-hidden="true" className="corner-accent corner-br" />

            <div className="logo-area">
              <Link to="/" className="logo-brand">
                <span className="logo-name">Your</span>
                <span className="logo-sub">Platform</span>
              </Link>
            </div>

            <div className="left-content">
              <p className="welcome-label">Get Started</p>
              <h2>Manage all your hostel branches from one account.</h2>
              <p className="welcome-desc">
                Create your landlord account first. Once your account is
                approved, you can add each hostel branch and its rooms.
              </p>

              <dl className="stats-grid">
                <div className="stat-box">
                  <dd className="stat-num">3</dd>
                  <dt className="stat-desc">Simple steps</dt>
                </div>
                <div className="stat-box">
                  <dd className="stat-num">1:1</dd>
                  <dt className="stat-desc">Reviewed sign-ups</dt>
                </div>
              </dl>
            </div>

            <div className="left-footer">
              <p>© 2026 Your Platform. All rights reserved.</p>
              <Link to="/login" className="switch-link">
                <ArrowLeft size={14} /> Already have an account? Sign in
              </Link>
            </div>
          </div>

          {/* ── Right panel ────────────────────────────── */}
          <div className="panel-right">
            <button
              className="theme-btn"
              onClick={toggleTheme}
              title="Toggle dark mode"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="login-inner">
              <div className="mobile-logo">
                <Link to="/" className="logo-brand">
                  <span className="logo-name">Your</span>
                  <span className="logo-sub">Platform</span>
                </Link>
              </div>

              {step === "form" && (
                <>
                  <p className="login-label">Step 1 of 3</p>
                  <h1 className="login-title">Create your landlord account</h1>
                  <p className="login-subtitle">
                    Start with your personal account details. You can provide
                    hostel names, locations, room counts, and rent when you add
                    each branch from your dashboard.
                  </p>

                  <form
                    className="login-form"
                    onSubmit={handleSignup}
                    noValidate
                  >
                    <div className="field">
                      <label className="field-label" htmlFor="cs-contact">
                        Full Name
                      </label>
                      <input
                        id="cs-contact"
                        autoComplete="name"
                        placeholder="Your first and last name"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="cs-email">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="cs-email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="cs-phone">
                        Phone Number
                      </label>
                      <input
                        id="cs-phone"
                        placeholder="Your phone number"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="cs-password">
                        Password
                      </label>
                      <div className="pass-wrap">
                        <input
                          type={showPwd ? "text" : "password"}
                          id="cs-password"
                          placeholder="At least 6 characters"
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          className="eye-btn"
                          type="button"
                          onClick={() => setShowPwd((s) => !s)}
                          aria-label={
                            showPwd ? "Hide password" : "Show password"
                          }
                        >
                          {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="cs-confirm">
                        Confirm Password
                      </label>
                      <input
                        type={showPwd ? "text" : "password"}
                        id="cs-confirm"
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>

                    <button className="btn-login" type="submit" disabled={busy}>
                      {busy ? "Creating account…" : "Create Account"}
                    </button>

                    <div className={"error-box" + (err ? " show" : "")}>
                      {err}
                    </div>
                  </form>
                </>
              )}

              {step === "verify" && (
                <>
                  <p className="login-label">Step 2 of 3</p>
                  <h1 className="login-title">Verify your email</h1>
                  <p className="login-subtitle">{notice}</p>

                  <form
                    className="login-form"
                    onSubmit={handleVerify}
                    noValidate
                  >
                    <div className="field">
                      <label className="field-label" htmlFor="cs-code">
                        6-Digit Code
                      </label>
                      <input
                        id="cs-code"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        className="text-center text-xl font-semibold tracking-[8px]"
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.replace(/[^0-9]/g, ""))
                        }
                      />
                    </div>

                    <button className="btn-login" type="submit" disabled={busy}>
                      {busy ? "Verifying…" : "Verify Email"}
                    </button>

                    <div className={"error-box" + (err ? " show" : "")}>
                      {err}
                    </div>
                  </form>

                  <button
                    type="button"
                    className="mx-auto mt-3.5 block cursor-pointer border-none bg-transparent text-[13px] text-terra underline disabled:cursor-default disabled:opacity-60"
                    onClick={handleResend}
                    disabled={busy}
                  >
                    Didn't get a code? Resend
                  </button>
                </>
              )}

              {step === "pending" && (
                <div className="text-center">
                  <p className="login-label">Step 3 of 3</p>
                  <h1 className="login-title">You're all set — almost</h1>
                  <p className="login-subtitle">
                    Your email is verified and your landlord account is pending
                    review by the De-Crown team. We'll email {email} when your
                    account is approved. You can then add one or more hostel
                    branches from your dashboard.
                  </p>
                  <Link to={`/login?client=${encodeURIComponent(clientSubdomain)}&email=${encodeURIComponent(email.trim())}`} className="btn-login mt-5 inline-block text-center no-underline">
                    Sign in after approval
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
