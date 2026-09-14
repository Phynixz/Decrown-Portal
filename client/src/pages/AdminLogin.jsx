import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "../theme.js";
import { setAdminAuth } from "../api.js";
import "../styles/login.css";

export default function AdminLogin() {
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shaking, setShaking] = useState(false);

  async function doLogin() {
    if (!email.trim() || !password) {
      setErr("Please enter your email and password.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      setAdminAuth(data.token, data.name, data.role, remember);
      navigate("/admin");
    } catch (e) {
      setErr(e.message);
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dc-login">
      <div className="login-grid">
        <div className="login-columns">
          {/* ── Left image panel ────────────────────────── */}
          <div className="panel-left">
            <img
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80"
              alt="De-Crown Cottage hostel exterior"
              className="panel-left-bg"
            />
            <div className="panel-left-overlay" />

            {/* Corner brass accents */}
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
              <h2>Your hostel dashboard awaits.</h2>
              <p className="welcome-desc">
                Sign in to manage rooms, track tenants, review payments, and
                stay on top of your campus accommodation.
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
              <Link to="/portal" className="switch-link">
                🏠 I'm a Tenant →
              </Link>
            </div>
          </div>

          {/* ── Right form panel ────────────────────────── */}
          <div className="panel-right">
            <button
              className="theme-btn"
              onClick={toggleTheme}
              title="Toggle dark mode"
            >
              {dark ? "☀️" : "🌙"}
            </button>

            <div className="login-inner">
              {/* Mobile logo */}
              <div className="mobile-logo">
                <Link to="/" className="logo-brand">
                  <span className="logo-name">De-Crown</span>
                  <span className="logo-sub">Cottage</span>
                </Link>
              </div>

              <p className="login-label">Sign In</p>
              <h1 className="login-title">Welcome back</h1>
              <p className="login-subtitle">
                Sign in to your account to access your rooms, reports, and
                management tools.
              </p>

              <div className={shaking ? "shake" : ""}>
                <form
                  className="login-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    doLogin();
                  }}
                  noValidate
                >
                  {/* Email */}
                  <div className="field">
                    <label className="field-label" htmlFor="dc-email">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="dc-email"
                      placeholder="you@decrown.com"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  {/* Password */}
                  <div className="field">
                    <div className="field-header">
                      <label className="field-label" htmlFor="dc-password">
                        Password
                      </label>
                    </div>
                    <div className="pass-wrap">
                      <input
                        type={showPwd ? "text" : "password"}
                        id="dc-password"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        className="eye-btn"
                        type="button"
                        onClick={() => setShowPwd((s) => !s)}
                        aria-label={showPwd ? "Hide password" : "Show password"}
                      >
                        {showPwd ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {/* Remember me */}
                  <div className="remember-row">
                    <input
                      type="checkbox"
                      id="dc-remember"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <label className="remember-label" htmlFor="dc-remember">
                      Remember me for 30 days
                    </label>
                  </div>

                  {/* Submit */}
                  <button className="btn-login" type="submit" disabled={busy}>
                    {busy ? "Signing in…" : "Sign In"}
                  </button>

                  <div className={"error-box" + (err ? " show" : "")}>
                    {err}
                  </div>
                </form>

                {/* Divider */}
                <div className="login-divider">
                  <span>or</span>
                </div>

                {/* Tenant portal link */}
                <div className="login-footer-links">
                  <p className="portal-link">
                    🏠 <Link to="/portal">Go to Tenant Portal</Link>
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
