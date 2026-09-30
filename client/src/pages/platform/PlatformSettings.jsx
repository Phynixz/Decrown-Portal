import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Activity, UserPlus, Users } from "lucide-react";
import { getJSON, sendJSON } from "../../api.js";

function getPlatformToken() {
  return sessionStorage.getItem("platformToken") || "";
}

export default function PlatformSettings() {
  const isOwner = sessionStorage.getItem("platformRole") === "owner";
  const [staff, setStaff] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "viewer",
  });

  useEffect(() => {
    if (!isOwner) return;
    Promise.all([
      getJSON("/platform/staff", getPlatformToken()),
      getJSON("/platform/audit?limit=100", getPlatformToken()),
    ])
      .then(([staffList, auditEvents]) => {
        setStaff(staffList);
        setEvents(auditEvents);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [isOwner]);

  if (!isOwner) return <Navigate to="/platform" replace />;

  async function addStaff(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await sendJSON("POST", "/platform/staff", form, getPlatformToken());
      const list = await getJSON("/platform/staff", getPlatformToken());
      setStaff(list);
      setForm({ name: "", email: "", password: "", role: "viewer" });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStaff(member) {
    setError("");
    try {
      await sendJSON(
        "PUT",
        `/platform/staff/${member._id}`,
        { active: !member.active },
        getPlatformToken(),
      );
      setStaff((current) =>
        current.map((item) =>
          item._id === member._id ? { ...item, active: !member.active } : item,
        ),
      );
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink dark:text-ink-dark tracking-tight">
          Platform access
        </h1>
        <p className="text-sm text-muted dark:text-muted-dark mt-1">
          Manage staff accounts and review platform activity.
        </p>
      </header>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] gap-6">
        <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl2 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-5">
            <UserPlus className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink dark:text-ink-dark">
              Add staff member
            </h2>
          </div>
          <form onSubmit={addStaff} className="grid sm:grid-cols-2 gap-4">
            <label className="text-xs text-muted dark:text-muted-dark">
              Full name
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-border dark:border-border-dark bg-transparent px-3 py-2 text-sm text-ink dark:text-ink-dark"
              />
            </label>
            <label className="text-xs text-muted dark:text-muted-dark">
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-border dark:border-border-dark bg-transparent px-3 py-2 text-sm text-ink dark:text-ink-dark"
              />
            </label>
            <label className="text-xs text-muted dark:text-muted-dark">
              Temporary password
              <input
                required
                minLength={12}
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-border dark:border-border-dark bg-transparent px-3 py-2 text-sm text-ink dark:text-ink-dark"
              />
            </label>
            <label className="text-xs text-muted dark:text-muted-dark">
              Access level
              <select
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-border dark:border-border-dark bg-card dark:bg-card-dark px-3 py-2 text-sm text-ink dark:text-ink-dark"
              >
                <option value="viewer">Read only</option>
                <option value="reviewer">Review client signups</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-ink dark:bg-accent px-4 py-2.5 text-sm font-semibold text-white dark:text-ink disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {saving ? "Adding…" : "Add staff"}
            </button>
          </form>
        </div>

        <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl2 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink dark:text-ink-dark">
              Staff access
            </h2>
          </div>
          {loading ? (
            <p className="text-sm text-muted dark:text-muted-dark">Loading…</p>
          ) : staff.length === 0 ? (
            <p className="text-sm text-muted dark:text-muted-dark">
              No staff accounts yet.
            </p>
          ) : (
            <ul className="divide-y divide-border dark:divide-border-dark">
              {staff.map((member) => (
                <li
                  key={member._id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink dark:text-ink-dark">
                      {member.name}
                    </p>
                    <p className="truncate text-xs text-muted dark:text-muted-dark">
                      {member.email} · {member.role}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleStaff(member)}
                    className="shrink-0 rounded-md border border-border dark:border-border-dark px-2.5 py-1.5 text-xs font-medium text-ink dark:text-ink-dark"
                  >
                    {member.active ? "Disable" : "Re-enable"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl2 shadow-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border dark:border-border-dark px-5 py-4">
          <Activity className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink dark:text-ink-dark">
            Recent platform activity
          </h2>
        </div>
        {loading ? (
          <p className="px-5 py-4 text-sm text-muted dark:text-muted-dark">
            Loading…
          </p>
        ) : events.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted dark:text-muted-dark">
            No activity recorded.
          </p>
        ) : (
          <div className="divide-y divide-border dark:divide-border-dark">
            {events.map((event) => (
              <div
                key={event._id}
                className="grid gap-1 px-5 py-3 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="text-sm text-ink dark:text-ink-dark">
                    {event.action}
                  </p>
                  <p className="text-xs text-muted dark:text-muted-dark">
                    {event.actorName || event.actorEmail} · {event.actorRole}
                  </p>
                </div>
                <time className="text-xs text-muted dark:text-muted-dark sm:text-right">
                  {new Date(event.createdAt).toLocaleString()}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
