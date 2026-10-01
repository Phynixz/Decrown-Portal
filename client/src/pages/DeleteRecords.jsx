import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme.js";
import { getToken } from "../api.js";

export default function DeleteRecords() {
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [fLoc, setFLoc] = useState("");
  const [fSess, setFSess] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [sessions, setSessions] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("Use the filters above and click Load Records.");
  const [adminPass, setAdminPass] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) navigate("/login", { replace: true });
  }, [navigate]);

  async function loadRecords() {
    let url = "/users?";
    if (fLoc) url += "location=" + encodeURIComponent(fLoc) + "&";
    if (fSess) url += "session=" + encodeURIComponent(fSess) + "&";

    setLoading(true);
    setLoadMsg("Loading…");
    try {
      const res = await fetch(url, { headers: { Authorization: getToken() } });
      if (!res.ok) throw new Error("Failed — check your login");
      const records = await res.json();
      setAllRecords(records);
      setSelected(new Set());

      // populate session filter
      const sess = [
        ...new Set(records.map((r) => r.session).filter(Boolean)),
      ].sort((a, b) => b.localeCompare(a));
      setSessions(sess);
      if (!sess.includes(fSess)) setFSess("");

      applySearch(records);
    } catch (err) {
      setLoadMsg("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function applySearch(records = allRecords) {
    const q = fSearch.toLowerCase().trim();
    const list = q
      ? records.filter(
          (r) =>
            (r.name || "").toLowerCase().includes(q) ||
            (r.email || "").toLowerCase().includes(q) ||
            (r.phone || "").toLowerCase().includes(q),
        )
      : records.slice();
    setFiltered(list);
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked) {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((r) => {
        if (checked) next.add(r._id);
        else next.delete(r._id);
      });
      return next;
    });
  }

  const selectedRecords = filtered.filter((r) => selected.has(r._id));

  async function confirmDelete() {
    if (!adminPass) return alert("Please enter your admin password.");
    if (confirmText.trim().toUpperCase() !== "DELETE")
      return alert("Type DELETE in the confirm box to proceed.");
    if (!selected.size) return alert("No records selected.");
    if (
      !confirm(
        "Permanently delete " + selected.size + " record(s)? This cannot be undone.",
      )
    )
      return;

    setBusy(true);
    try {
      const res = await fetch("/users/delete-bulk", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: getToken(),
        },
        body: JSON.stringify({ ids: [...selected], adminPassword: adminPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Error: " + (data.error || "Deletion failed"));
        return;
      }
      alert(data.message || "Deleted successfully.");
      setSelected(new Set());
      setAdminPass("");
      setConfirmText("");
      loadRecords();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dc-admin">
      <header className="topbar" style={{ marginLeft: 0 }}>
        <div className="topbar-title-area">
          <div className="page-title">Delete Records</div>
          <div className="page-sub">De-Crown Cottage — Admin</div>
        </div>
        <div className="topbar-right">
          <button className="theme-btn" onClick={toggleTheme}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="logout-btn" onClick={() => navigate("/admin")}>
            ← Dashboard
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[860px] px-6 pt-7 pb-15">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] text-navy">Delete Tenant Records</h2>
            <p className="mt-0.75 text-[13px] text-muted">
              Filter, select records, confirm with your password. This cannot be
              undone.
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-border bg-card px-4 py-2 text-[13px] font-semibold text-navy no-underline transition-all hover:border-navy hover:bg-navy hover:text-white"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2.5 rounded-xl border border-border2 bg-card px-4.5 py-4 shadow-sm">
          <select
            className="min-w-[140px] flex-1 rounded-lg border-[1.5px] border-border bg-input px-3 py-2 font-sans text-[13px] text-text outline-none transition-colors focus:border-navy"
            value={fLoc}
            onChange={(e) => setFLoc(e.target.value)}
          >
            <option value="">All Locations</option>
            <option value="Malete">Malete</option>
            <option value="Ila-Orangun">Ila-Orangun</option>
          </select>
          <select
            className="min-w-[140px] flex-1 rounded-lg border-[1.5px] border-border bg-input px-3 py-2 font-sans text-[13px] text-text outline-none transition-colors focus:border-navy"
            value={fSess}
            onChange={(e) => setFSess(e.target.value)}
          >
            <option value="">All Sessions</option>
            {sessions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="min-w-[140px] flex-1 rounded-lg border-[1.5px] border-border bg-input px-3 py-2 font-sans text-[13px] text-text outline-none transition-colors focus:border-navy"
            placeholder="Search name, email or phone…"
            value={fSearch}
            onChange={(e) => {
              setFSearch(e.target.value);
              applySearch(allRecords);
            }}
          />
          <button
            className="rounded-lg border-none bg-navy px-5 py-2 font-sans text-[13px] font-semibold text-white transition-opacity hover:opacity-88"
            onClick={loadRecords}
          >
            Load Records
          </button>
        </div>

        {/* Select all bar */}
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text2">
            <input
              type="checkbox"
              checked={filtered.length > 0 && filtered.every((r) => selected.has(r._id))}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            Select all visible
          </label>
          <span className="text-[13px] text-muted">{selected.size} selected</span>
        </div>

        {/* List */}
        <div className="mb-5 flex flex-col gap-2">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-muted">
              <div className="spinner mx-auto mb-2.5"></div>
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted">{loadMsg}</div>
          ) : (
            filtered.map((r) => {
              const sel = selected.has(r._id);
              const img =
                r.passport ||
                "https://ui-avatars.com/api/?name=" +
                  encodeURIComponent(r.name || "?") +
                  "&background=1a3c5e&color=fff&size=80";
              return (
                <div
                  className={
                    "flex cursor-pointer items-center gap-3.5 rounded-[10px] border-[1.5px] px-4 py-2.75 transition-all hover:border-border " +
                    (sel ? "border-danger bg-danger-faint" : "border-border2 bg-card")
                  }
                  key={r._id}
                  onClick={() => toggle(r._id)}
                >
                  <input
                    type="checkbox"
                    checked={sel}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggle(r._id)}
                  />
                  <img src={img} className="h-10.5 w-10.5 shrink-0 rounded-full border-2 border-border2 object-cover" alt="" />
                  <div>
                    <div className="text-[13px] font-semibold text-text">{r.name || "—"}</div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {r.email || ""} · {r.session || ""} · Room {r.roomNo || "—"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Danger zone */}
        <div
          className={
            (selected.size ? "block " : "hidden ") +
            "rounded-xl border-[1.5px] border-[rgba(192,57,43,0.25)] bg-danger-faint px-5.5 py-5"
          }
        >
          <h4 className="mb-2 text-sm font-bold text-danger">⚠ Confirm Deletion</h4>
          <p className="mb-4 text-[13px] leading-relaxed text-text2">
            You are about to permanently delete{" "}
            <strong>{selected.size}</strong> record(s). All uploaded passport
            photos and payment receipts will also be removed. Enter your admin
            password to confirm.
          </p>
          <div className="text-[13px] text-text2 mb-4 max-h-[140px] overflow-auto border border-[rgba(192,57,43,0.12)] p-2.5 rounded-[10px] bg-[rgba(255,242,242,0.72)]">
            {selectedRecords.length === 0 ? (
              <div>No uploaded files attached to selected records.</div>
            ) : (
              selectedRecords.map((r) => {
                const files = [];
                if (r.passport) files.push("Passport: " + r.passport);
                if (r.paymentProof) files.push("Receipt: " + r.paymentProof);
                if (!files.length) files.push("No uploaded files.");
                return (
                  <div className="mb-3" key={r._id}>
                    <strong>{r.name || "Unnamed tenant"}</strong>
                    <div className="text-xs text-text2 mt-1.5 leading-[1.45]">
                      {files.join(" / ")}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <input
              type="password"
              placeholder="Your admin password"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              className="min-w-[200px] flex-1 rounded-lg border-[1.5px] border-[rgba(192,57,43,0.3)] bg-input px-3.5 py-2.5 font-sans text-[13px] text-text outline-none focus:border-danger"
            />
            <input
              placeholder="Type DELETE to confirm"
              className="p-2 border-[1.5px] border-border rounded-md flex-1 min-w-[140px] bg-input text-text font-sans text-[13px] outline-none"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <button
              className="rounded-lg border-none bg-danger px-5.5 py-2.5 font-sans text-[13px] font-bold text-white transition-opacity hover:opacity-86 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={confirmDelete}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete Permanently"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
