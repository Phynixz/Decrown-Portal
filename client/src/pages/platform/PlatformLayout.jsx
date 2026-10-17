import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  Settings,
  LogOut,
  ShieldCheck,
  Moon,
  Sun,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "../../theme.js";

function getPlatformToken() {
  return sessionStorage.getItem("platformToken") || "";
}

const NAV_ITEMS = [
  { to: "/platform", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/platform/clients", label: "Clients", icon: Users },
  { to: "/platform/settings", label: "Team & Audit", icon: Settings },
];

export default function PlatformLayout() {
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const name = sessionStorage.getItem("platformName") || "Operator";
  const role = sessionStorage.getItem("platformRole") || "viewer";
  const visibleNavItems =
    role === "owner"
      ? NAV_ITEMS
      : NAV_ITEMS.filter((item) => item.to !== "/platform/settings");

  useEffect(() => {
    if (!getPlatformToken()) navigate("/platform/login", { replace: true });
  }, [navigate]);

  function logout() {
    sessionStorage.removeItem("platformToken");
    sessionStorage.removeItem("platformName");
    sessionStorage.removeItem("platformRole");
    navigate("/platform/login", { replace: true });
  }

  return (
    <div className="min-h-screen flex bg-surface dark:bg-surface-dark font-sans transition-colors">
      <aside className="w-64 shrink-0 hidden md:flex flex-col bg-ink dark:bg-[#0b0f18] text-white">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-accent-light" />
          </div>
          <span className="font-semibold tracking-tight text-sm">
            Overall Admin
          </span>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {visibleNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors " +
                (isActive
                  ? "bg-accent/15 text-accent-light"
                  : "text-white/60 hover:text-white hover:bg-white/5")
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="min-h-16 shrink-0 flex items-center justify-between gap-3 px-4 py-3 sm:px-8 border-b border-border dark:border-border-dark bg-card dark:bg-card-dark">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted dark:text-muted-dark">
              Signed in as
            </p>
            <p className="truncate text-sm font-semibold text-ink dark:text-ink-dark">
              {name} · {role === "owner" ? "Overall Admin" : role}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:text-ink dark:border-border-dark dark:text-muted-dark dark:hover:text-ink-dark"
              title="Toggle dark mode"
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMobileNavOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:text-ink dark:border-border-dark dark:text-muted-dark dark:hover:text-ink-dark md:hidden"
              title={mobileNavOpen ? "Close navigation" : "Open navigation"}
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileNavOpen}
              aria-controls="platform-mobile-navigation"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {mobileNavOpen && (
          <nav id="platform-mobile-navigation" aria-label="Platform navigation" className="md:hidden border-b border-border dark:border-border-dark bg-card dark:bg-card-dark px-4 py-3">
            <div className="space-y-1">
              {visibleNavItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                    (isActive
                      ? "bg-accent/15 text-accent"
                      : "text-muted dark:text-muted-dark hover:bg-surface dark:hover:bg-white/5 hover:text-ink dark:hover:text-ink-dark")
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted dark:text-muted-dark hover:bg-surface dark:hover:bg-white/5 hover:text-ink dark:hover:text-ink-dark"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          </nav>
        )}

        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
