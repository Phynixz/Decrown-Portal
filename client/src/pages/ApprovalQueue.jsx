import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme.js";
import { getJSON, sendJSON } from "../api.js";
import "../styles/admin.css";
import "../styles/delete.css";

function getPlatformToken() {
  return sessionStorage.getItem("platformToken") || "";
}

export default function ApprovalQueue() {
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState("pending_approval");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (!getPlatformToken()) {
      navigate("/platform/login", { replace: true });
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const data = await getJSON(
        "/platform/clients?status=" + tab,
        getPlatformToken(),
      );
      setClients(data);
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function approve(id) {
    if (!confirm("Approve this client and give them access?")) return;
    setBusyId(id);
    try {
      await sendJSON(
        "PUT",
        "/platform/clients/" + id + "/approve",
        {},
        getPlatformToken(),
      );
      load();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setBusyId("");
    }
  }

  async function reject(id) {
    const reason = prompt("Reason for rejecting (optional):") || "";
    setBusyId(id);
    try {
      await sendJSON(
        "PUT",
        "/platform/clients/" + id + "/reject",
        { reason },
        getPlatformToken(),
      );
      load();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setBusyId("");
    }
  }

  function logout() {
    sessionStorage.removeItem("platformToken");
    sessionStorage.removeItem("platformName");
    navigate("/platform/login", { replace: true });
  }

  const TABS = [
    { key: "pending_approval", label: "Pending" },
    { key: "active", label: "Active" },
    { key: "rejected", label: "Rejected" },
    { key: "suspended", label: "Suspended" },
  ];

  return (
    <div className="dc-admin">
      <header className="topbar" style={{ marginLeft: 0 }}>
        <div className="topbar-title-area">
          <div className="page-title">Client Sign-ups</div>
          <div className="page-sub">Platform Owner — Approval Queue</div>
        </div>
        <div className="topbar-right">
          <button className="theme-btn" onClick={toggleTheme}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="logout-btn" onClick={logout}>
            Log Out
          </button>
        </div>
      </header>

      <div className="del-page">
        <div className="filter-row">
          {TABS.map((t) => (
            <button
              key={t.key}
              className="btn-load"
              style={{
                opacity: tab === t.key ? 1 : 0.55,
                fontWeight: tab === t.key ? 700 : 500,
              }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="user-list">
          {loading ? (
            <div className="list-empty">
              <div className="spinner mx-auto mb-2.5"></div>
              Loading…
            </div>
          ) : msg ? (
            <div className="list-empty">{msg}</div>
          ) : clients.length === 0 ? (
            <div className="list-empty">No clients in this list.</div>
          ) : (
            clients.map((c) => (
              <div className="urow" key={c._id} style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div className="urow-name">{c.businessName}</div>
                  <div className="urow-meta">
                    {c.contactName} · {c.email} · {c.phone || "—"}
                  </div>
                  <div className="urow-meta">
                    Subdomain: {c.subdomain} · Signed up{" "}
                    {new Date(c.createdAt).toLocaleDateString()}
                  </div>
                  {c.status === "rejected" && c.rejectionReason && (
                    <div className="urow-meta">Reason: {c.rejectionReason}</div>
                  )}
                </div>
                {c.status === "pending_approval" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-load"
                      disabled={busyId === c._id}
                      onClick={() => approve(c._id)}
                    >
                      Approve
                    </button>
                    <button
                      className="btn-delete"
                      disabled={busyId === c._id}
                      onClick={() => reject(c._id)}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
