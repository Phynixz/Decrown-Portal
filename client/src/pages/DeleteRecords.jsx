import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme.js";
import { getToken } from "../api.js";
import "../styles/admin.css";
import "../styles/delete.css";

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

      <div className="del-page">
        <div className="del-topbar">
          <div>
            <h2>Delete Tenant Records</h2>
            <p>
              Filter, select records, confirm with your password. This cannot be
              undone.
            </p>
          </div>
          <Link to="/admin" className="back-btn">
            ← Back to Dashboard
          </Link>
        </div>

        {/* Filters */}
        <div className="filter-row">
          <select value={fLoc} onChange={(e) => setFLoc(e.target.value)}>
            <option value="">All Locations</option>
            <option value="Malete">Malete</option>
            <option value="Ila-Orangun">Ila-Orangun</option>
          </select>
          <select value={fSess} onChange={(e) => setFSess(e.target.value)}>
            <option value="">All Sessions</option>
            {sessions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search name, email or phone…"
            value={fSearch}
            onChange={(e) => {
              setFSearch(e.target.value);
              applySearch(allRecords);
            }}
          />
          <button className="btn-load" onClick={loadRecords}>
            Load Records
          </button>
        </div>

        {/* Select all bar */}
        <div className="sel-bar">
          <label className="sel-label">
            <input
              type="checkbox"
              checked={filtered.length > 0 && filtered.every((r) => selected.has(r._id))}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            Select all visible
          </label>
          <span className="sel-count">{selected.size} selected</span>
        </div>

        {/* List */}
        <div className="user-list">
          {loading ? (
            <div className="list-empty">
              <div className="spinner mx-auto mb-2.5"></div>
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="list-empty">{loadMsg}</div>
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
                  className={"urow" + (sel ? " selected" : "")}
                  key={r._id}
                  onClick={() => toggle(r._id)}
                >
                  <input
                    type="checkbox"
                    checked={sel}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggle(r._id)}
                  />
                  <img src={img} className="urow-img" alt="" />
                  <div>
                    <div className="urow-name">{r.name || "—"}</div>
                    <div className="urow-meta">
                      {r.email || ""} · {r.session || ""} · Room {r.roomNo || "—"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Danger zone */}
        <div className={"danger-box" + (selected.size ? " show" : "")}>
          <h4>⚠ Confirm Deletion</h4>
          <p>
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
          <div className="pass-row">
            <input
              type="password"
              placeholder="Your admin password"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
            />
            <input
              placeholder="Type DELETE to confirm"
              className="p-2 border-[1.5px] border-border rounded-md flex-1 min-w-[140px] bg-input text-text font-sans text-[13px] outline-none"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <button
              className="btn-delete"
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
