import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Moon,
  Sun,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useTheme } from "../../theme.js";
import { sendJSON } from "../../api.js";
import { validateEmail } from "../../utils/validation.js";

export default function PlatformLogin() {
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
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
      sessionStorage.setItem("platformRole", data.role);
      navigate("/platform");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-surface dark:bg-surface-dark font-sans transition-colors">
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between bg-ink dark:bg-[#0b0f18] text-white p-14 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-accent-light" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Platform Control
          </span>
        </div>

        <div className="relative max-w-md">
          <p className="text-accent-light text-sm font-medium tracking-wide uppercase mb-4">
            Operator Access
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight mb-5">
            Every client, one command center.
          </h1>
          <p className="text-white/60 text-[15px] leading-relaxed">
            Review new sign-ups, approve or reject applications, and manage
            every business running on the platform — all from a single
            dashboard.
          </p>
        </div>

        <p className="relative text-white/35 text-xs">
          © 2026 Your Platform. Operator access only.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 w-9 h-9 rounded-full border border-border dark:border-border-dark bg-card dark:bg-card-dark flex items-center justify-center text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
          title="Toggle dark mode"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-xl bg-ink dark:bg-accent/20 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-accent-light" />
            </div>
            <span className="text-base font-semibold text-ink dark:text-ink-dark tracking-tight">
              Overall Admin
            </span>
          </div>

          <p className="text-accent text-xs font-semibold tracking-wider uppercase mb-2">
            Overall Admin Sign In
          </p>
          <h2 className="text-2xl font-bold text-ink dark:text-ink-dark tracking-tight mb-2">
            Welcome back
          </h2>
          <p className="text-muted dark:text-muted-dark text-sm mb-8">
            Sign in as the platform owner to manage clients and staff access.
          </p>

          <form onSubmit={doLogin} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="pl-email"
                className="block text-xs font-medium text-muted dark:text-muted-dark mb-1.5"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted dark:text-muted-dark absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="pl-email"
                  type="email"
                  required
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark text-ink dark:text-ink-dark text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  placeholder="you@yourplatform.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="pl-password"
                className="block text-xs font-medium text-muted dark:text-muted-dark mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted dark:text-muted-dark absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="pl-password"
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark text-ink dark:text-ink-dark text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {err && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-3.5 py-2.5">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-ink dark:bg-accent text-white dark:text-ink font-semibold text-sm hover:bg-ink/90 dark:hover:bg-accent-light transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-card"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted dark:text-muted-dark mt-8">
            <Link
              to="/login"
              className="hover:text-ink dark:hover:text-ink-dark underline underline-offset-2 transition-colors"
            >
              Not an operator? Go to client sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
