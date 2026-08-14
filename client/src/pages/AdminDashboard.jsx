import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "../theme.js";
import {
  getToken,
  getAdminName,
  getAdminRole,
  clearAdminAuth,
  fmtNaira,
  fmtDate,
  parseJwt,
  getJSON,
  sendJSON,
} from "../api.js";
import "../styles/admin.css";

const LOCATION_ROOMS = {
  Malete: [
    "Room 1", "Room 2", "Room 3", "Room 4", "Room 5", "Room 6", "Room 7",
    "Room 8", "Room 9", "Room 10",
  ],
  "Ila-Orangun": [
    "Room 1", "Room 2", "Room 3", "Room 4", "Room 5", "Room 6", "Room 7",
    "Room 8", "Room 9", "Room 10", "Room 11", "Room 12", "Room 13", "Room 14",
    "Room 15", "Room 16", "Room 17", "Room 18", "Room 19", "Room 20",
    "Room 21", "Room 22",
  ],
};

const avatarFor = (name) =>
  "https://ui-avatars.com/api/?name=" +
  encodeURIComponent(name || "?") +
  "&background=1a3c5e&color=fff&bold=true&size=100";

const proofUrlOf = (u) =>
  u.paymentProof
    ? u.paymentProof.toLowerCase().includes(".pdf")
      ? u.paymentProof.replace("/image/upload/", "/raw/upload/")
      : u.paymentProof
    : null;

export default function AdminDashboard() {
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [allUsers, setAllUsers] = useState([]);
  const [currentLocation, setCurrentLocation] = useState("Malete");
  const [currentTab, setCurrentTab] = useState("all");
  const [currentSession, setCurrentSession] = useState(null);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [badges, setBadges] = useState({ Malete: 0, "Ila-Orangun": 0 });

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawer, setDrawer] = useState({ name: "", loc: "", img: "", history: [] });
  const [expandedRows, setExpandedRows] = useState({});

  // Sidebar (mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modals
  const [regModal, setRegModal] = useState(false);
  const [regText, setRegText] = useState("");
  const [regSession, setRegSession] = useState("");
  const [regSessions, setRegSessions] = useState([]);

  const [rentModal, setRentModal] = useState(false);
  const [rentMalete, setRentMalete] = useState("");
  const [rentIla, setRentIla] = useState("");

  const [editModal, setEditModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const [renewModal, setRenewModal] = useState(false);
  const [renewTarget, setRenewTarget] = useState(null);
  const [renewForm, setRenewForm] = useState({ email: "", phone: "", level: "", date: "" });

  const [approveModal, setApproveModal] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approveConfirm, setApproveConfirm] = useState("");
  const [approveDate, setApproveDate] = useState("");

  const [disapproveModal, setDisapproveModal] = useState(false);
  const [disapproveTarget, setDisapproveTarget] = useState(null);
  const [disapproveReason, setDisapproveReason] = useState("Invalid payment proof");
  const [disapproveNote, setDisapproveNote] = useState("");

  const [revokeModal, setRevokeModal] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState("Invalid documents");
  const [revokeNote, setRevokeNote] = useState("");

  const [reuploadModal, setReuploadModal] = useState(false);
  const [reuploadTarget, setReuploadTarget] = useState(null);
  const [reupChecks, setReupChecks] = useState({ passport: false, idCard: false, proof: false });

  const [adminModal, setAdminModal] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", password: "", role: "admin" });

  const adminName = getAdminName();
  const adminRole = getAdminRole();

  const roomKeys = LOCATION_ROOMS[currentLocation] || [];

  // ── Guards ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!getToken()) navigate("/login", { replace: true });
  }, [navigate]);

  // ── Load admin settings (session + registration state) ─────────
  useEffect(() => {
    (async () => {
      try {
        const d = await getJSON("/current-session");
        setCurrentSession(d.session || currentSession);
        setRegistrationOpen(d.registrationOpen !== false);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = useCallback(async (loc) => {
    setLoading(true);
    setLoadError("");
    try {
      const users = await getJSON(
        "/users?location=" + encodeURIComponent(loc),
        getToken(),
      );
      setAllUsers(users);
    } catch (err) {
      setLoadError("Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBadges = useCallback(async () => {
    for (const loc of ["Malete", "Ila-Orangun"]) {
      try {
        const d = await getJSON(
          "/users?location=" + encodeURIComponent(loc),
          getToken(),
        );
        setBadges((b) => ({ ...b, [loc]: d.length }));
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    loadUsers(currentLocation);
    refreshBadges();
  }, [currentLocation, loadUsers, refreshBadges]);

  // ── Derived: visible users ─────────────────────────────────────
  const visible = allUsers.filter(
    (u) => sessionFilter === "all" || u.session === sessionFilter,
  );

  const tenants = visible.filter((u) => (u.type || "tenant") === "tenant");
  const shops = visible.filter((u) => u.type === "shop");
  const pending = visible.filter((u) => u.retainPending);
  const revenue = visible.reduce((s, u) => s + (u.amount || 0), 0);
  const occupiedRooms = new Set(
    visible
      .map((u) => u.roomNo)
      .filter((room) => room && roomKeys.includes(room)),
  );
  const occupied = occupiedRooms.size;
  const available = Math.max(0, roomKeys.length - occupied);

  const sessionOptions = [
    ...new Set(allUsers.map((u) => u.session).filter(Boolean)),
  ].sort((a, b) => b.localeCompare(a));

  // Rooms render
  let gridUsers = visible;
  if (currentTab === "tenant")
    gridUsers = visible.filter((u) => (u.type || "tenant") === "tenant");
  else if (currentTab === "shop")
    gridUsers = visible.filter((u) => (u.type || "tenant") === "shop");

  const byRoom = {};
  gridUsers.forEach((u) => {
    const room = u.roomNo || "Unassigned";
    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push(u);
  });

  // ── Drawer ─────────────────────────────────────────────────────
  async function openDrawer(user) {
    setDrawer({ name: user.name, loc: user.location, img: user.passport || avatarFor(user.name), history: [] });
    setDrawerOpen(true);
    document.body.style.overflow = "hidden";
    try {
      const res = await fetch(
        "/users?location=" +
          encodeURIComponent(user.location) +
          "&email=" +
          encodeURIComponent(user.email),
        { headers: { Authorization: getToken() } },
      );
      const hist = res.ok ? await res.json() : [];
      setDrawer((d) => ({ ...d, history: hist }));
    } catch {
      setDrawer((d) => ({ ...d, history: [] }));
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    document.body.style.overflow = "";
    setDrawer((d) => ({ ...d, history: [] }));
  }

  // ── Edit tenant ────────────────────────────────────────────────
  function openEditModal() {
    const latest = drawer.history[0];
    if (!latest) {
      alert("Could not load user data");
      return;
    }
    setEditUser(latest);
    setEditForm({
      name: latest.name || "",
      email: latest.email || "",
      phone: latest.phone || "",
      guardianName: latest.guardianName || "",
      guardianPhone: latest.guardianPhone || "",
      location: latest.location || "Malete",
      type: latest.type || "tenant",
      roomNo: latest.roomNo || "",
      level: latest.level || "",
      session: latest.session || "",
      amount: latest.amount || "",
      paymentDate: latest.paymentDate || "",
    });
    setEditModal(true);
  }

  async function saveEdit() {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const user = await sendJSON(
        "PUT",
        "/admin/user/" + editUser._id,
        editForm,
        getToken(),
      );
      setEditModal(false);
      setDrawer((d) => ({
        ...d,
        history: d.history.map((r, i) => (i === 0 ? user.user : r)),
      }));
      alert("User updated successfully");
      await loadUsers(currentLocation);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setEditSaving(false);
    }
  }

  // ── Registration control ───────────────────────────────────────
  async function openRegModal() {
    try {
      const d = await getJSON("/current-session");
      const opts = [];
      if (d.session) opts.push(d.session + " (current)");
      if (d.next && d.next !== d.session) opts.push(d.next + " (next)");
      setRegSessions(opts.map((label) => ({ label, value: label.split(" ")[0] })));
    } catch {
      /* ignore */
    }
    setRegText("");
    setRegSession("");
    setRegModal(true);
  }

  async function confirmRegChange() {
    const txt = regText.trim().toUpperCase();
    if (!txt) return alert("Please type CLOSE or OPEN to confirm");
    const open = txt === "OPEN";
    const close = txt === "CLOSE";
    if (!open && !close) return alert("Type CLOSE to close or OPEN to reopen");
    if (
      !confirm("Are you sure you want to " + (open ? "open" : "close") + " registration?")
    )
      return;
    try {
      const d = await sendJSON(
        "PUT",
        "/admin/set-registration",
        { open, session: regSession },
        getToken(),
      );
      setRegistrationOpen(d.registrationOpen);
      setRegModal(false);
      alert(
        "Registration " + (d.registrationOpen ? "opened" : "closed") + " successfully.",
      );
    } catch {
      alert("Failed to update registration state");
    }
  }

  // ── Rent ───────────────────────────────────────────────────────
  async function openRentModal() {
    setRentModal(true);
    try {
      const d = await getJSON("/admin/get-amounts", getToken());
      setRentMalete(d.malete != null ? d.malete : "");
      setRentIla(d.ila != null ? d.ila : "");
    } catch {
      /* ignore */
    }
  }

  async function saveRent() {
    if (!rentMalete.trim() && !rentIla.trim())
      return alert("Enter at least one value");
    const payload = {};
    if (rentMalete.trim()) payload.malete = +rentMalete;
    if (rentIla.trim()) payload.ila = +rentIla;
    try {
      await sendJSON("PUT", "/admin/set-amount", payload, getToken());
      alert("Rent updated");
      setRentModal(false);
    } catch {
      alert("Update failed");
    }
  }

  // ── Renew ──────────────────────────────────────────────────────
  function openRenewModal(id, session, room) {
    setRenewTarget({ id, session, room });
    setRenewForm({ email: "", phone: "", level: "", date: "" });
    setRenewModal(true);
  }

  async function confirmRenew() {
    if (!renewTarget) return;
    const body = {};
    if (renewForm.email.trim()) body.email = renewForm.email.trim();
    if (renewForm.phone.trim()) body.phone = renewForm.phone.trim();
    if (renewForm.level) body.level = renewForm.level;
    if (renewForm.date) body.paymentDate = renewForm.date;
    try {
      const d = await sendJSON("POST", "/renew/" + renewTarget.id, body, getToken());
      alert(d.message || "Renewed");
      setRenewModal(false);
      closeDrawer();
      loadUsers(currentLocation);
    } catch {
      alert("Renewal failed");
    }
  }

  // ── Approve ────────────────────────────────────────────────────
  function openApproveModal(id, session, name) {
    setApproveTarget({ id, session, name });
    setApproveConfirm("");
    setApproveDate(new Date().toISOString().slice(0, 10));
    setApproveModal(true);
  }

  async function confirmApprove() {
    if (!approveTarget) return;
    if (approveConfirm.trim().toUpperCase() !== "APPROVE")
      return alert("Please type APPROVE to confirm this approval.");
    if (
      !confirm("This will approve the retention and mark the tenant as paid. Proceed?")
    )
      return;
    try {
      await sendJSON(
        "PUT",
        "/approve-retain/" + approveTarget.id,
        { paymentDate: approveDate },
        getToken(),
      );
      alert("Retention approved");
      setApproveModal(false);
      closeDrawer();
      loadUsers(currentLocation);
    } catch {
      alert("Approval failed");
    }
  }

  // ── Disapprove / Revoke / Reinstate ────────────────────────────
  function openDisapproveModal(id, name) {
    setDisapproveTarget({ id, name });
    setDisapproveNote("");
    setDisapproveModal(true);
  }

  async function confirmDisapprove() {
    if (!disapproveTarget) return;
    try {
      await sendJSON(
        "PUT",
        "/disapprove/" + disapproveTarget.id,
        { reason: disapproveReason, note: disapproveNote },
        getToken(),
      );
      alert("Application rejected and tenant notified.");
      setDisapproveModal(false);
      loadUsers(currentLocation);
    } catch {
      alert("Failed to reject application");
    }
  }

  function openRevokeModal(id, name) {
    setRevokeTarget({ id, name });
    setRevokeNote("");
    setRevokeReason("Invalid documents");
    setRevokeModal(true);
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    try {
      await sendJSON(
        "PUT",
        "/revoke/" + revokeTarget.id,
        { reason: revokeReason, note: revokeNote },
        getToken(),
      );
      alert("✅ Tenant revoked successfully");
      setRevokeModal(false);
      closeDrawer();
      loadUsers(currentLocation);
    } catch {
      alert("Revocation failed");
    }
  }

  async function reinstateUser(id) {
    if (!confirm("Reinstate this tenant?")) return;
    try {
      await sendJSON("PUT", "/reinstate/" + id, {}, getToken());
      alert("✅ Tenant reinstated");
      loadUsers(currentLocation);
    } catch {
      alert("Failed to reinstate");
    }
  }

  // ── Grant re-upload ────────────────────────────────────────────
  function openReuploadModal(id, name) {
    setReuploadTarget({ id, name });
    setReupChecks({ passport: false, idCard: false, proof: false });
    setReuploadModal(true);
  }

  async function confirmGrantReupload() {
    if (!reuploadTarget) return;
    if (!reupChecks.passport && !reupChecks.idCard && !reupChecks.proof)
      return alert("Please select at least one document");
    try {
      await sendJSON(
        "PUT",
        "/admin/grant-reupload/" + reuploadTarget.id,
        reupChecks,
        getToken(),
      );
      alert("✅ Re-upload access granted for 24 hours");
      setReuploadModal(false);
    } catch {
      alert("Failed to grant access");
    }
  }

  // ── Admin manager ──────────────────────────────────────────────
  async function refreshAdminList() {
    try {
      const list = await getJSON("/admin/list", getToken());
      setAdmins(list);
    } catch {
      setAdmins([]);
    }
  }

  async function openAdminManager() {
    setAdminModal(true);
    await refreshAdminList();
  }

  async function createAdmin() {
    if (!newAdmin.name || !newAdmin.email || !newAdmin.password)
      return alert("All fields required");
    if (newAdmin.password.length < 6)
      return alert("Password must be at least 6 characters");
    try {
      await sendJSON("POST", "/admin/create", newAdmin, getToken());
      alert("Admin created");
      setNewAdmin({ name: "", email: "", password: "", role: "admin" });
      await refreshAdminList();
    } catch {
      alert("Failed");
    }
  }

  async function deleteAdmin(id, name) {
    if (!confirm('Remove admin "' + name + '"?')) return;
    try {
      await sendJSON("DELETE", "/admin/" + id, null, getToken());
      await refreshAdminList();
    } catch {
      alert("Deletion failed");
    }
  }

  // ── Export / logout ────────────────────────────────────────────
  async function exportUsers() {
    try {
      const r = await fetch("/export-users", {
        headers: { Authorization: getToken() },
      });
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "decrown-" + new Date().toISOString().slice(0, 10) + ".xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert("Export failed: " + e.message);
    }
  }

  function logout() {
    clearAdminAuth();
    navigate("/login");
  }

  const myId = parseJwt(getToken()).id;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="dc-admin">
      {/* Overlay for sidebar on mobile */}
      <div
        className="overlay"
        id="overlay"
        style={{ display: sidebarOpen ? "block" : "none" }}
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <aside className={"sidebar" + (sidebarOpen ? " open" : "")} id="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <img src="/d420ac751563a3d498bd84cdf69386bb.jpg" alt="logo" />
            <div>
              <div className="brand-name">De-Crown</div>
              <div className="brand-role">
                {adminRole === "superadmin" ? "Superadmin" : "Admin"}
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={() => setSidebarOpen(false)}>
            ✕
          </button>
        </div>

        <div className="admin-name-display">
          {adminName ? `Hello, ${adminName}` : ""}
        </div>

        <div className="nav-label">Locations</div>
        <nav>
          {["Malete", "Ila-Orangun"].map((loc) => (
            <button
              key={loc}
              className={"loc-btn" + (currentLocation === loc ? " active" : "")}
              onClick={() => {
                setCurrentLocation(loc);
                setSidebarOpen(false);
              }}
            >
              🏠 {loc}{" "}
              <span className="loc-count">
                {loc === "Malete" ? badges.Malete : badges["Ila-Orangun"]}
              </span>
            </button>
          ))}
        </nav>

        <div className="nav-label">Tools</div>
        <button className="side-action" onClick={openRentModal}>
          Change Rent
        </button>
        <button
          className={
            "side-action" + (registrationOpen ? "" : " danger")
          }
          onClick={openRegModal}
        >
          {registrationOpen ? "Close New Registration" : "Open New Registration"}
        </button>
        <button className="side-action" onClick={exportUsers}>
          Export Excel
        </button>
        {adminRole === "superadmin" && (
          <button className="side-action" onClick={openAdminManager}>
            Manage Admins
          </button>
        )}
        <Link to="/delete" className="side-action danger">
          Delete Records
        </Link>
        <button className="side-action logout" onClick={logout}>
          Sign Out
        </button>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <button
            className="menu-btn"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="topbar-title-area">
            <div className="page-title">{currentLocation}</div>
            <div className="page-sub">Tenant Dashboard</div>
          </div>
          <div className="topbar-right">
            <select
              className="session-sel"
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
            >
              <option value="all">All Sessions</option>
              {sessionOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {s === currentSession ? " (current)" : ""}
                </option>
              ))}
              {currentSession && !sessionOptions.includes(currentSession) && (
                <option value={currentSession}>
                  {currentSession} (current)
                </option>
              )}
            </select>
            <button className="theme-btn" onClick={toggleTheme}>
              {dark ? "🌙" : "☀️"}
            </button>
            <button className="logout-btn" onClick={logout}>
              Sign Out
            </button>
          </div>
        </header>

        {/* Pending banner */}
        {pending.length > 0 && (
          <div className="my-2.5 p-3 font-semibold flex items-center justify-between gap-3 bg-[#fff4f4] border border-[#ffd6d6] border-l-[6px] border-l-[#e53935]">
            <div>
              There are <strong>{pending.length}</strong> pending retention
              application{pending.length > 1 ? "s" : ""} awaiting approval.
            </div>
            <button
              className="cta"
              onClick={() =>
                document
                  .getElementById("cardGrid")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              View Pending
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="stats-strip">
          <div className="stat">
            <div className="stat-value">{tenants.length}</div>
            <div className="stat-label">Tenants</div>
          </div>
          <div className="stat">
            <div className="stat-value">{shops.length}</div>
            <div className="stat-label">Shops</div>
          </div>
          <div className="stat">
            <div className="stat-value">{occupied}</div>
            <div className="stat-label">Occupied</div>
          </div>
          <div className="stat">
            <div className="stat-value">{available}</div>
            <div className="stat-label">Available</div>
          </div>
          <div className="stat accent">
            <div className="stat-value">{fmtNaira(revenue)}</div>
            <div className="stat-label">Revenue</div>
          </div>
          {pending.length > 0 && (
            <div className="stat warn">
              <div className="stat-value">{pending.length}</div>
              <div className="stat-label">Pending Retention</div>
            </div>
          )}
        </div>

        {/* Tabs + cards */}
        <div className="tab-row">
          {[
            ["all", "All"],
            ["tenant", "Tenants"],
            ["shop", "Shops"],
          ].map(([t, label]) => (
            <button
              key={t}
              className={"tab" + (currentTab === t ? " active" : "") + (t === "shop" ? " tab-warn" : "")}
              onClick={() => setCurrentTab(t)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="card-grid" id="cardGrid">
          {loading ? (
            <div className="grid-state">
              <div className="spinner"></div>
              <p>Loading...</p>
            </div>
          ) : loadError ? (
            <div className="grid-state">{loadError}</div>
          ) : !roomKeys.length ? (
            <div className="grid-state">No room inventory available.</div>
          ) : (
            <>
              {roomKeys.map((room) => {
                const occupants = byRoom[room] || [];
                if (occupants.length) {
                  return occupants.map((u) => <RoomCard key={u._id} u={u} onOpenDrawer={() => openDrawer(u)} onApprove={() => openApproveModal(u._id, u.session, u.name)} onDisapprove={() => openDisapproveModal(u._id, u.name)} onRevoke={() => openRevokeModal(u._id, u.name)} onReupload={() => openReuploadModal(u._id, u.name)} onReinstate={() => reinstateUser(u._id)} />);
                }
                return <EmptyRoomCard key={room} room={room} />;
              })}
              {(byRoom.Unassigned || []).map((u) => (
                <RoomCard key={u._id} u={u} onOpenDrawer={() => openDrawer(u)} onApprove={() => openApproveModal(u._id, u.session, u.name)} onDisapprove={() => openDisapproveModal(u._id, u.name)} onRevoke={() => openRevokeModal(u._id, u.name)} onReupload={() => openReuploadModal(u._id, u.name)} onReinstate={() => reinstateUser(u._id)} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Drawer ─────────────────────────────────────────────── */}
      {drawerOpen && (
        <>
          <div className="drawer-backdrop open" onClick={closeDrawer}></div>
          <div className="drawer open">
            <div className="drawer-top">
              <a href={drawer.img} target="_blank" rel="noopener">
                <img src={drawer.img} alt="" className="drawer-avatar" />
              </a>
              <div className="drawer-title-area">
                <div className="drawer-name">{drawer.name}</div>
                <div className="drawer-loc">{drawer.loc}</div>
              </div>
              <button className="drawer-close" onClick={closeDrawer}>
                ✕
              </button>
            </div>
            <div className="drawer-body">
              {drawer.history[0] && (
                <div>
                  <div className="drawer-section-label">Contact Information</div>
                  <div className="drawer-info-grid">
                    {[
                      ["Email", drawer.history[0].email],
                      ["Phone", drawer.history[0].phone],
                      ["Guardian", drawer.history[0].guardianName],
                      ["G. Phone", drawer.history[0].guardianPhone],
                    ].map(([label, val]) => (
                      <div className="drawer-info-item" key={label}>
                        <div className="drawer-info-label">{label}</div>
                        <div className="drawer-info-val">{val || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="drawer-section-label">All Sessions</div>
                {drawer.history.length === 0 ? (
                  <p className="text-[13px] text-muted py-2.5">
                    No records found.
                  </p>
                ) : (
                  <div className="session-list">
                    {[...drawer.history]
                      .sort((a, b) =>
                        (b.session || "").localeCompare(a.session || ""),
                      )
                      .map((r) => (
                        <div
                          className={
                            "session-row" +
                            (expandedRows[r._id] ? " expanded" : "")
                          }
                          key={r._id}
                        >
                          <div
                            className="session-row-head"
                            onClick={() =>
                              setExpandedRows((e) => ({
                                ...e,
                                [r._id]: !e[r._id],
                              }))
                            }
                          >
                            <span className="session-row-title">{r.session}</span>
                            <div className="session-row-meta">
                              <span className="session-row-amount">
                                {fmtNaira(r.amount)}
                              </span>              {r.retainPending && (
                <span className="text-[11px] text-amber">⏳</span>
              )}
                              <span className="session-row-chevron">▼</span>
                            </div>
                          </div>
                          <div className="session-row-body">
                            <div className="session-detail-grid">
                              {[
                                ["Room", r.roomNo],
                                ["Level", r.level],
                                [
                                  "Paid",
                                  r.retainPending
                                    ? "Awaiting payment"
                                    : fmtDate(r.paymentDate) || "—",
                                ],
                                ["Status", r.retainPending ? "Pending" : "Confirmed"],
                              ].map(([label, val]) => (
                                <div className="sdet" key={label}>
                                  <div className="sdet-label">{label}</div>
                                  <div className="sdet-val">{val || "—"}</div>
                                </div>
                              ))}
                            </div>
                            <div className="session-row-actions">
                              <button
                                className="sbtn"
                                onClick={() =>
                                  window.open(`/receipt?id=${r._id}`, "_blank")
                                }
                              >
                                Receipt
                              </button>
                              {r.idCard && (
                                <a
                                  className="sbtn sbtn-proof"
                                  href={r.idCard}
                                  target="_blank"
                                  rel="noopener"
                                >
                                  ID Card
                                </a>
                              )}
                              {r.paymentProof && (
                                <a
                                  className="sbtn sbtn-proof"
                                  href={proofUrlOf(r) + "?t=" + Date.now()}
                                  target="_blank"
                                  rel="noopener"
                                >
                                  {r.paymentProof.toLowerCase().includes(".pdf")
                                    ? "📄 PDF"
                                    : "🖼 Proof"}
                                </a>
                              )}
                              {r.retainPending ? (
                                <button
                                  className="sbtn sbtn-approve"
                                  onClick={() =>
                                    openApproveModal(r._id, r.session, "")
                                  }
                                >
                                  Approve
                                </button>
                              ) : (
                                <button
                                  className="sbtn sbtn-renew"
                                  onClick={() =>
                                    openRenewModal(r._id, r.session, r.roomNo)
                                  }
                                >
                                  Renew
                                </button>
                              )}
                            </div>
                            {r.changeLog && r.changeLog.length > 0 && (
                              <div className="px-3.5 pt-2.5 pb-3 border-t border-border2">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-[0.8px] mb-2">
                                  Document Changes
                                </p>
                                {r.changeLog.map((entry, i) => {
                                  const labelMap = {
                                    passport: "📷 Passport",
                                    idCard: "🪪 ID Card",
                                    paymentProof: "📄 Payment Proof",
                                  };
                                  return (
                                    <div
                                      key={i}
                                      className="flex justify-between items-center text-[11px] py-1.25 border-b border-border2"
                                    >
                                      <span className="text-text font-medium">
                                        {labelMap[entry.field] || entry.field}
                                      </span>
                                      <span className="text-muted">
                                        {entry.note} ·{" "}
                                        {new Date(entry.changedAt).toLocaleDateString(
                                          "en-NG",
                                          { day: "2-digit", month: "short", year: "numeric" },
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <div className="drawer-footer">
              <button
                className="drawer-btn-edit"
                onClick={openEditModal}
                title="Edit this tenant's information"
              >
                ✏️ Edit Tenant
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Registration modal ────────────────────────────────── */}
      {regModal && (
        <>
          <div className="backdrop open" onClick={() => setRegModal(false)}></div>
          <div className="modal open">
            <div className="modal-head">
              <h3>Registration Control</h3>
              <button onClick={() => setRegModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 10 }}>
                Choose which session this action applies to and confirm the
                change. Closing registration prevents new registrations and
                retain requests until reopened.
              </p>
              <div className="mfield">
                <label>Session</label>
                <select
                  value={regSession}
                  onChange={(e) => setRegSession(e.target.value)}
                >
                  <option value="">(use current session)</option>
                  {regSessions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mfield">
                <label>
                  Type <strong>CLOSE</strong> to confirm closing (or{" "}
                  <strong>OPEN</strong> to reopen)
                </label>
                <input
                  placeholder="Type CLOSE or OPEN to confirm"
                  value={regText}
                  onChange={(e) => setRegText(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="mbtn ghost" onClick={() => setRegModal(false)}>
                Cancel
              </button>
              <button className="mbtn primary" onClick={confirmRegChange}>
                Confirm
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Edit tenant modal ─────────────────────────────────── */}
      {editModal && (
        <>
          <div className="backdrop open" onClick={() => setEditModal(false)}></div>
          <div className="modal open w-[600px]">
            <div className="modal-head">
              <h3>Edit Tenant Information</h3>
              <button onClick={() => setEditModal(false)}>✕</button>
            </div>
            <div className="modal-body max-h-[70vh] overflow-y-auto">
              {[
                ["name", "Name", "text"],
                ["email", "Email", "email"],
                ["phone", "Phone", "tel"],
                ["guardianName", "Guardian Name", "text"],
                ["guardianPhone", "Guardian Phone", "tel"],
              ].map(([key, label, type]) => (
                <div className="mfield" key={key}>
                  <label>{label}</label>
                  <input
                    type={type}
                    value={editForm[key] || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="mfield">
                <label>Location</label>
                <select
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                >
                  <option value="Malete">Malete</option>
                  <option value="Ila-Orangun">Ila-Orangun</option>
                </select>
              </div>
              <div className="mfield">
                <label>Type</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                >
                  <option value="tenant">Tenant</option>
                  <option value="shop">Shop</option>
                </select>
              </div>
              {[
                ["roomNo", "Room Number", "text"],
                ["level", "Level", "text"],
                ["session", "Session", "text"],
                ["amount", "Amount (₦)", "number"],
              ].map(([key, label, type]) => (
                <div className="mfield" key={key}>
                  <label>{label}</label>
                  <input
                    type={type}
                    value={editForm[key] || ""}
                    placeholder={key === "level" ? "e.g., 100Level" : key === "session" ? "e.g., 2024/2025" : ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="mfield">
                <label>Payment Date</label>
                <input
                  type="date"
                  value={editForm.paymentDate || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, paymentDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="mbtn ghost" onClick={() => setEditModal(false)}>
                Cancel
              </button>
              <button className="mbtn primary" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Rent modal ────────────────────────────────────────── */}
      {rentModal && (
        <>
          <div className="backdrop open" onClick={() => setRentModal(false)}></div>
          <div className="modal open">
            <div className="modal-head">
              <h3>Update Rent Amounts</h3>
              <button onClick={() => setRentModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="mfield">
                <label>Malete (₦)</label>
                <input
                  type="number"
                  placeholder="150000"
                  value={rentMalete}
                  onChange={(e) => setRentMalete(e.target.value)}
                />
              </div>
              <div className="mfield">
                <label>Ila-Orangun (₦)</label>
                <input
                  type="number"
                  placeholder="120000"
                  value={rentIla}
                  onChange={(e) => setRentIla(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="mbtn ghost" onClick={() => setRentModal(false)}>
                Cancel
              </button>
              <button className="mbtn primary" onClick={saveRent}>
                Save
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Renew modal ───────────────────────────────────────── */}
      {renewModal && (
        <>
          <div className="backdrop open" onClick={() => setRenewModal(false)}></div>
          <div className="modal open">
            <div className="modal-head">
              <h3>Renew for Next Session</h3>
              <button onClick={() => setRenewModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-info">
                Renewing Room {renewTarget?.room} — Session {renewTarget?.session}
              </div>
              <div className="mfield">
                <label>New Email (optional)</label>
                <input
                  type="email"
                  placeholder="Keep existing"
                  value={renewForm.email}
                  onChange={(e) => setRenewForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="mfield">
                <label>New Phone (optional)</label>
                <input
                  type="tel"
                  placeholder="Keep existing"
                  value={renewForm.phone}
                  onChange={(e) => setRenewForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="mfield">
                <label>Level</label>
                <select
                  value={renewForm.level}
                  onChange={(e) => setRenewForm((f) => ({ ...f, level: e.target.value }))}
                >
                  <option value="">Keep current</option>
                  {["100Level", "200Level", "300Level", "400Level", "500Level"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="mfield">
                <label>Payment Date</label>
                <input
                  type="date"
                  value={renewForm.date}
                  onChange={(e) => setRenewForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="mbtn ghost" onClick={() => setRenewModal(false)}>
                Cancel
              </button>
              <button className="mbtn primary" onClick={confirmRenew}>
                Confirm Renewal
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Approve modal ─────────────────────────────────────── */}
      {approveModal && (
        <>
          <div className="backdrop open" onClick={() => setApproveModal(false)}></div>
          <div className="modal open">
            <div className="modal-head">
              <h3>Approve Retention</h3>
              <button onClick={() => setApproveModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-info">
                Approving retention
                {approveTarget?.name ? " for " + approveTarget.name : ""} —
                Session {approveTarget?.session}
              </div>
              <div className="mfield">
                <label>Confirm</label>
                <input
                  placeholder="Type APPROVE to confirm"
                  value={approveConfirm}
                  onChange={(e) => setApproveConfirm(e.target.value)}
                />
              </div>
              <div className="mfield">
                <label>Payment Date</label>
                <input
                  type="date"
                  value={approveDate}
                  onChange={(e) => setApproveDate(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="mbtn ghost" onClick={() => setApproveModal(false)}>
                Cancel
              </button>
              <button className="mbtn primary" onClick={confirmApprove}>
                Approve &amp; Mark Paid
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Disapprove modal ──────────────────────────────────── */}
      {disapproveModal && (
        <>
          <div className="backdrop open" onClick={() => setDisapproveModal(false)}></div>
          <div className="modal open">
            <div className="modal-head">
              <h3>❌ Reject Application</h3>
              <button onClick={() => setDisapproveModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-info">
                Rejecting application for {disapproveTarget?.name}. The tenant
                will need to reapply.
              </div>
              <div className="mfield">
                <label>Reason for rejection</label>
                <select
                  value={disapproveReason}
                  onChange={(e) => setDisapproveReason(e.target.value)}
                >
                  <option value="Invalid payment proof">Invalid payment proof</option>
                  <option value="Incomplete information">Incomplete information</option>
                  <option value="Room no longer available">Room no longer available</option>
                  <option value="Duplicate application">Duplicate application</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="mfield">
                <label>Additional note (optional)</label>
                <input
                  type="text"
                  placeholder="Any extra details..."
                  value={disapproveNote}
                  onChange={(e) => setDisapproveNote(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="mbtn ghost" onClick={() => setDisapproveModal(false)}>
                Cancel
              </button>
              <button
                className="mbtn bg-danger text-white border-none"
                onClick={confirmDisapprove}
              >
                Reject Application
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Revoke modal ──────────────────────────────────────── */}
      {revokeModal && (
        <>
          <div className="backdrop open" onClick={() => setRevokeModal(false)}></div>
          <div className="modal open">
            <div className="modal-head">
              <h3>🚫 Revoke Tenant</h3>
              <button onClick={() => setRevokeModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-info">
                Revoking approval for {revokeTarget?.name}. Tenant will be
                flagged but can still access their portal.
              </div>
              <div className="mfield">
                <label>Reason for revocation</label>
                <select
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                >
                  <option value="Invalid documents">Invalid documents</option>
                  <option value="Payment not verified">Payment not verified</option>
                  <option value="Policy violation">Policy violation</option>
                  <option value="Fraudulent information">Fraudulent information</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="mfield">
                <label>Additional note (optional)</label>
                <input
                  type="text"
                  placeholder="Any extra details..."
                  value={revokeNote}
                  onChange={(e) => setRevokeNote(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="mbtn ghost" onClick={() => setRevokeModal(false)}>
                Cancel
              </button>
              <button
                className="mbtn bg-danger text-white border-none"
                onClick={confirmRevoke}
              >
                Revoke Tenant
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Grant re-upload modal ─────────────────────────────── */}
      {reuploadModal && (
        <>
          <div className="backdrop open" onClick={() => setReuploadModal(false)}></div>
          <div className="modal open">
            <div className="modal-head">
              <h3>📤 Grant Re-upload Access</h3>
              <button onClick={() => setReuploadModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-info">
                Granting {reuploadTarget?.name} access to re-upload documents.
                Access expires in 24 hours.
              </div>
              <div className="mfield">
                <label>Select documents tenant can re-upload</label>
                {[
                  ["passport", "Passport Photo"],
                  ["idCard", "ID Card"],
                  ["proof", "Payment Proof"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 mt-2.5 text-[13px] font-normal"
                  >
                    <input
                      type="checkbox"
                      checked={reupChecks[key]}
                      onChange={(e) =>
                        setReupChecks((c) => ({ ...c, [key]: e.target.checked }))
                      }
                    />{" "}
                    {label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted mt-3">
                ⏰ Access expires after 24 hours automatically.
              </p>
            </div>
            <div className="modal-foot">
              <button className="mbtn ghost" onClick={() => setReuploadModal(false)}>
                Cancel
              </button>
              <button className="mbtn primary" onClick={confirmGrantReupload}>
                Grant Access
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Admin manager modal ───────────────────────────────── */}
      {adminModal && (
        <>
          <div className="backdrop open" onClick={() => setAdminModal(false)}></div>
          <div className="modal open wide">
            <div className="modal-head">
              <h3>Manage Admins</h3>
              <button onClick={() => setAdminModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {admins.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading...</p>
              ) : (
                admins.map((a) => (
                  <div className="admin-row" key={a._id}>
                    <div>
                      <div className="admin-row-name">{a.name}</div>
                      <div className="admin-row-email">{a.email}</div>
                      <span className="admin-row-role">{a.role}</span>
                    </div>
                    {a._id !== myId ? (
                      <button
                        className="btn-del-admin"
                        onClick={() => deleteAdmin(a._id, a.name)}
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted">You</span>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="modal-body border-t border-border2 pt-4">
              <p className="text-xs font-bold text-text2 uppercase tracking-[0.8px] mb-2.5">
                Add New Admin
              </p>
              {[
                ["name", "Name", "Full name", "text"],
                ["email", "Email", "email@example.com", "email"],
                ["password", "Password", "Min. 6 characters", "password"],
              ].map(([key, label, ph, type]) => (
                <div className="mfield" key={key}>
                  <label>{label}</label>
                  <input
                    type={type}
                    placeholder={ph}
                    value={newAdmin[key]}
                    onChange={(e) => setNewAdmin((a) => ({ ...a, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="mfield">
                <label>Role</label>
                <select
                  value={newAdmin.role}
                  onChange={(e) => setNewAdmin((a) => ({ ...a, role: e.target.value }))}
                >
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="mbtn ghost" onClick={() => setAdminModal(false)}>
                Close
              </button>
              <button className="mbtn primary" onClick={createAdmin}>
                Add Admin
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Room card helpers ────────────────────────────────────────────────
function EmptyRoomCard({ room }) {
  return (
    <article className="card room-empty">
      <div className="card-head">
        <div className="card-identity">
          <div className="card-name">{room}</div>
          <div className="card-contact">Available for this session</div>
        </div>
        <div className="room-chip room-available">Available</div>
      </div>
      <div className="card-details">
        <div className="det">
          <div className="det-label">Status</div>
          <div className="det-val">Empty</div>
        </div>
      </div>
    </article>
  );
}

function RoomCard({ u, onOpenDrawer, onApprove, onDisapprove, onRevoke, onReupload, onReinstate }) {
  const img = u.passport || avatarFor(u.name);
  const date = u.paymentDate
    ? fmtDate(u.paymentDate)
    : u.retainPending
      ? "Awaiting payment"
      : "—";
  const proofUrl = proofUrlOf(u);
  const isRevoked = u.status === "revoked";

  return (
    <article className={"card" + (u.retainPending ? " is-pending" : "")}>
      {u.retainPending && (
        <div className="approval-banner">
          <div className="approval-left">
            <span className="approval-dot"></span>
            <div>
              <div className="approval-title">Awaiting Your Approval</div>
              <div className="approval-sub">
                {u.renewedFrom
                  ? "Renewal awaiting admin approval"
                  : u.paymentProof
                    ? "New application received with payment proof"
                    : "New application awaiting admin approval"}
              </div>
            </div>
          </div>
          <div className="approval-actions">
            <button className="approval-btn" onClick={onApprove}>
              ✅ Approve
            </button>
            <button className="disapprove-btn" onClick={onDisapprove}>
              ❌ Reject
            </button>
          </div>
        </div>
      )}

      <div className={"card-stripe" + (u.retainPending ? " stripe-red" : "")}></div>

      <div className="card-head">
        <a
          href={img}
          target="_blank"
          rel="noopener"
          className="avatar-link"
          onClick={(e) => e.stopPropagation()}
        >
          <img src={img} className="avatar" alt={u.name} loading="lazy" />
        </a>
        <div className="card-identity">
          <div className="card-name">{u.name}</div>
          <div className="card-contact">{u.email}</div>
          <div className="card-contact">{u.phone}</div>
          <div className="card-badges">
            <span className="badge badge-session">{u.session}</span>
            {u.renewedFrom && <span className="badge badge-renewed">↻ Renewed</span>}
            {u.retainPending && (
              <span className="badge badge-pending-red">● Pending</span>
            )}
            {(u.type || "tenant") === "shop" && (
              <span className="badge badge-shop">Shop</span>
            )}
            {isRevoked && <span className="badge badge-revoked">🚫 Revoked</span>}
          </div>
        </div>
        {u.roomNo && <div className="room-chip room-occupied">✔️ Occupied</div>}
      </div>

      <div className="card-details">
        <div className="det">
          <div className="det-label">Room</div>
          <div className="det-val">{u.roomNo}</div>
        </div>
        <div className="det">
          <div className="det-label">Level</div>
          <div className="det-val">{u.level}</div>
        </div>
        <div className="det">
          <div className="det-label">Paid</div>
          <div className="det-val">{date}</div>
        </div>
        <div className="det">
          <div className="det-label">Amount</div>
          <div className="det-val amount">{fmtNaira(u.amount)}</div>
        </div>
      </div>

      <div className="card-actions">
        {u.passport ? (
          <a className="cta cta-proof" href={u.passport} target="_blank" rel="noopener">
            View Passport
          </a>
        ) : (
          <span className="cta cta-no-proof">No Passport</span>
        )}
        {u.idCard ? (
          <a className="cta cta-proof" href={u.idCard} target="_blank" rel="noopener">
            View ID
          </a>
        ) : (
          <span className="cta cta-no-proof">No ID</span>
        )}
        {proofUrl ? (
          <a
            className="cta cta-proof"
            href={proofUrl + "?t=" + Date.now()}
            target="_blank"
            rel="noopener"
          >
            {u.paymentProof.toLowerCase().includes(".pdf") ? "📄 View PDF" : "🖼 View Proof"}
          </a>
        ) : (
          <span className="cta cta-no-proof">No Proof</span>
        )}
        <button
          className="cta cta-receipt"
          onClick={() => window.open(`/receipt?id=${u._id}`, "_blank")}
        >
          Receipt
        </button>
        <button className="cta cta-history" onClick={onOpenDrawer}>
          History
        </button>
        <button className="cta cta-reupload" onClick={onReupload}>
          📤 Re-upload
        </button>
        {isRevoked ? (
          <button className="cta cta-unrevooke" onClick={onReinstate}>
            ✅ Reinstate
          </button>
        ) : (
          <button className="cta cta-revoke" onClick={onRevoke}>
            🚫 Revoke
          </button>
        )}
      </div>
    </article>
  );
}
