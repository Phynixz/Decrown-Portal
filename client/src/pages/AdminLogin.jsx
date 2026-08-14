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
      {/* Left decorative panel */}
      <div className="panel-left">
        <div className="logo-area">
          <img src="/d420ac751563a3d498bd84cdf69386bb.jpg" alt="De-Crown Logo" />
          <h1>
            De-Crown
            <br />
            Cottage
          </h1>
          <p>
            Hostel management portal for
            <br />
            Malete &amp; Ila-Orangun campuses.
          </p>
        </div>
        <div className="left-footer">
          <p>© 2024 De-Crown Cottage. All rights reserved.</p>
          <Link to="/portal" className="switch-link">
            🏠 I'm a Tenant →
          </Link>
        </div>
      </div>

      {/* Right: login form */}
      <div className="panel-right">
        <button
          className="theme-btn"
          onClick={toggleTheme}
          title="Toggle dark mode"
        >
          {dark ? "☀️" : "🌙"}
        </button>

        <div className={"login-box" + (shaking ? " shake" : "")}>
          <h2>Admin Login</h2>
          <p className="subtitle">Sign in to the management dashboard</p>

          <div className="field">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="you@decrown.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Password</label>
            <div className="pass-wrap">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doLogin()}
              />
              <button
                className="eye-btn"
                type="button"
                onClick={() => setShowPwd((s) => !s)}
              >
                {showPwd ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <div className="remember-row">
            <label className="remember-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>
          </div>

          <button
            className="btn-login"
            onClick={doLogin}
            disabled={busy}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
          >
            {busy ? "Signing in…" : "Sign In"}
          </button>
          <div className={"error-box" + (err ? " show" : "")}>{err}</div>

          {/* Mobile only */}
          <div className="mobile-portal-link">
            <Link to="/portal">🏠 Go to Tenant Portal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
