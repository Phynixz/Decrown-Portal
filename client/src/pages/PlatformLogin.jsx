import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme.js";
import { sendJSON } from "../api.js";
import { validateEmail } from "../utils/validation.js";
import "../styles/login.css";

export default function PlatformLogin() {
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function doLogin(e) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErr("Please enter your email and password.");
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setErr("Please enter a valid email address.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const data = await sendJSON("POST", "/platform/login", {
        email: trimmedEmail,
        password,
      });
      sessionStorage.setItem("platformToken", "Bearer " + data.token);
      sessionStorage.setItem("platformName", data.name);
      navigate("/platform/queue");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dc-login">
      <div className="login-grid">
        <div className="login-columns" style={{ gridTemplateColumns: "1fr" }}>
          <div className="panel-right" style={{ maxWidth: 440, margin: "0 auto" }}>
            <button className="theme-btn" onClick={toggleTheme} title="Toggle dark mode">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="login-inner">
              <p className="login-label">Platform Owner</p>
              <h1 className="login-title">Review sign-ups</h1>
              <p className="login-subtitle">
                Sign in to approve or reject new client applications.
              </p>

              <form className="login-form" onSubmit={doLogin} noValidate>
                <div className="field">
                  <label className="field-label" htmlFor="pl-email">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="pl-email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="pl-password">
                    Password
                  </label>
                  <input
                    type="password"
                    id="pl-password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button className="btn-login" type="submit" disabled={busy}>
                  {busy ? "Signing in…" : "Sign In"}
                </button>
                <div className={"error-box" + (err ? " show" : "")}>{err}</div>
              </form>

              <p className="back-link" style={{ marginTop: 16 }}>
                <Link to="/login">← Back to admin sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
