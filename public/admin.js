function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function esc(s) {
  return String(s ?? "—").replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c],
  );
}
// --- Auth ---
function getToken() {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  return token ? (token.startsWith("Bearer ") ? token : "Bearer " + token) : "";
}
if (!getToken()) window.location.href = "login.html";

// Load admin settings (registration open state) and bind toggle
async function loadAdminSettings() {
  try {
    const res = await fetch("/current-session");
    if (!res.ok) return;
    const d = await res.json();
    // server returns { session, next, registrationOpen }
    currentSession = d.session || currentSession;
    registrationOpen = d.registrationOpen !== false;
    updateRegistrationToggle();
  } catch (e) {
    // ignore
  }
}

function openRegModal() {
  // populate session select with current/next
  (async function () {
    try {
      const sel = document.getElementById("regSessionSelect");
      if (!sel) return;
      // clear
      while (sel.options.length > 1) sel.remove(1);
      const res = await fetch("/current-session");
      if (!res.ok) return;
      const d = await res.json();
      if (d.session) {
        const o = document.createElement("option");
        o.value = d.session;
        o.textContent = d.session + " (current)";
        sel.appendChild(o);
      }
      if (d.next && d.next !== d.session) {
        const o2 = document.createElement("option");
        o2.value = d.next;
        o2.textContent = d.next + " (next)";
        sel.appendChild(o2);
      }
    } catch {}
  })();
  document.getElementById("regConfirmText").value = "";
  openModal("regModal", "regBack");
}

function closeRegModal() {
  closeModal("regModal", "regBack");
}

async function confirmRegChange() {
  const txt = (document.getElementById("regConfirmText").value || "")
    .trim()
    .toUpperCase();
  if (!txt) {
    alert("Please type CLOSE or OPEN to confirm");
    return;
  }
  const open = txt === "OPEN";
  const close = txt === "CLOSE";
  if (!open && !close) {
    alert("Type CLOSE to close or OPEN to reopen");
    return;
  }
  // double check
  if (
    !confirm(
      "Are you sure you want to " +
        (open ? "open" : "close") +
        " registration?",
    )
  )
    return;
  try {
    const sel = document.getElementById("regSessionSelect");
    const selVal = sel ? sel.value : "";
    const res = await fetch("/admin/set-registration", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
      },
      body: JSON.stringify({ open: open, session: selVal }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Failed");
    registrationOpen = d.registrationOpen;
    updateRegistrationToggle();
    closeRegModal();
    alert(
      "Registration " +
        (registrationOpen ? "opened" : "closed") +
        " successfully.",
    );
  } catch (e) {
    alert("Failed to update registration state");
  }
}

function updateRegistrationToggle() {
  const btn = document.getElementById("regToggleBtn");
  if (!btn) return;
  if (registrationOpen) {
    btn.textContent = "Close New Registration";
    btn.classList.remove("danger");
  } else {
    btn.textContent = "Open New Registration";
    btn.classList.add("danger");
  }
}

async function toggleRegistration() {
  const btn = document.getElementById("regToggleBtn");
  if (btn) btn.disabled = true;
  try {
    const res = await fetch("/admin/set-registration", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
      },
      body: JSON.stringify({ open: !registrationOpen }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Failed");
    registrationOpen = d.registrationOpen;
    updateRegistrationToggle();
    alert(registrationOpen ? "Registration opened" : "Registration closed");
  } catch (e) {
    alert("Unable to update registration state");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// --- Theme ---
(function initTheme() {
  if ((localStorage.getItem("theme") || "light") === "dark") {
    document.documentElement.classList.add("dark");
    const btn = document.getElementById("themeBtn");
    if (btn) btn.textContent = "🌙";
  }
})();
function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", dark ? "dark" : "light");
  set("themeBtn", dark ? "🌙" : "☀️");
}
// --- Admin identity ---
const adminName =
  localStorage.getItem("adminName") ||
  sessionStorage.getItem("adminName") ||
  "";
const adminRole =
  localStorage.getItem("adminRole") ||
  sessionStorage.getItem("adminRole") ||
  "admin";
set("adminNameDisplay", adminName ? `Hello, ${adminName}` : "");
set("adminRoleLabel", adminRole === "superadmin" ? "Superadmin" : "Admin");
const mgrBtn = document.getElementById("manageAdminsBtn");
if (mgrBtn && adminRole === "superadmin") mgrBtn.style.display = "block";

// â”€â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let allUsers = [];
let currentLocation = "Malete";
let currentTab = "all";
let currentSession = null;
let registrationOpen = true;
let renewTargetId = null;
let approveTargetId = null;
let drawerHistory = [];

const locationRooms = {
  Malete: [
    "Room 1",
    "Room 2",
    "Room 3",
    "Room 4",
    "Room 5",
    "Room 6",
    "Room 7",
    "Room 8",
    "Room 9",
    "Room 10",
  ],
  "Ila-Orangun": [
    "Room 1",
    "Room 2",
    "Room 3",
    "Room 4",
    "Room 5",
    "Room 6",
    "Room 7",
    "Room 8",
    "Room 9",
    "Room 10",
    "Room 11",
    "Room 12",
    "Room 13",
    "Room 14",
    "Room 15",
    "Room 16",
    "Room 17",
    "Room 18",
    "Room 19",
    "Room 20",
    "Room 21",
    "Room 22",
  ],
};

function getRoomsForLocation(loc) {
  return locationRooms[loc] || [];
}

function switchTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll(".tab-row .tab").forEach(function (tabBtn) {
    tabBtn.classList.toggle("active", tabBtn === btn);
  });
  renderRooms();
}

function getJsArg(value) {
  return (
    "'" +
    String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r") +
    "'"
  );
}

// â”€â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("overlay").style.display = "block";
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").style.display = "none";
}

// â”€â”€â”€ Location switch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function switchLocation(loc, btn) {
  currentLocation = loc;
  document
    .querySelectorAll(".loc-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  set("pageTitle", loc);
  closeSidebar();
  loadUsers();
}

// â”€â”€â”€ Session filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function sessionVal() {
  const el = document.getElementById("sessionFilter");
  return el ? el.value : "all";
}

function populateSessionFilter() {
  const sel = document.getElementById("sessionFilter");
  if (!sel) return;
  const cur = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  [...new Set(allUsers.map((u) => u.session).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))
    .forEach((s) => {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      sel.appendChild(o);
    });
  // Ensure the current session is available and selected by default
  const opts = [...sel.options].map((o) => o.value);
  if (currentSession && !opts.includes(currentSession)) {
    const currentOption = document.createElement("option");
    currentOption.value = currentSession;
    currentOption.textContent = currentSession + " (current)";
    sel.appendChild(currentOption);
    opts.push(currentSession);
  }
  if (opts.includes(cur)) sel.value = cur;
  else if (currentSession && opts.includes(currentSession))
    sel.value = currentSession;
}

function applyFilter() {
  updateStats();
  renderRooms();
}

// â”€â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function inSession(u) {
  const s = sessionVal();
  return s === "all" || u.session === s;
}

function updateStats() {
  const visible = allUsers.filter(inSession);
  const tenants = visible.filter((u) => (u.type || "tenant") === "tenant");
  const shops = visible.filter((u) => u.type === "shop");
  const pending = visible.filter((u) => u.retainPending);
  const revenue = visible.reduce((s, u) => s + (u.amount || 0), 0);

  const roomKeys = getRoomsForLocation(currentLocation);
  const occupiedRooms = new Set(
    visible
      .map((u) => u.roomNo)
      .filter((room) => room && roomKeys.includes(room)),
  );
  const occupied = occupiedRooms.size;
  const available = Math.max(0, roomKeys.length - occupied);

  set("stTenants", tenants.length);
  set("stShops", shops.length);
  set("stOccupied", occupied);
  set("stAvailable", available);
  set("stRevenue", "₦" + revenue.toLocaleString());
  set("stPending", pending.length);

  // update top pending banner
  try {
    updatePendingBanner(pending.length);
  } catch (e) {}

  const pendingStrip = document.getElementById("statPending");
  if (pendingStrip)
    pendingStrip.style.display = pending.length ? "block" : "none";

  const badge = document.getElementById("cnt-" + currentLocation);
  if (badge) badge.textContent = allUsers.length;
}

// Top pending banner
function updatePendingBanner(count) {
  var banner = document.getElementById("adminPendingBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "adminPendingBanner";
    banner.style.cssText =
      "background:#fff4f4;border:1px solid #ffd6d6;padding:12px;margin:10px 0;border-left:6px solid #e53935;font-weight:600;display:none;";
    var container = document.querySelector("main") || document.body;
    container.insertBefore(banner, container.firstChild);
  }
  if (count && count > 0) {
    banner.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
      "<div>There are <strong>" +
      count +
      "</strong> pending retention application" +
      (count > 1 ? "s" : "") +
      " awaiting approval.</div>" +
      '<div><button class="cta" onclick="openPendingList()">View Pending</button></div>' +
      "</div>";
    banner.style.display = "block";
  } else {
    banner.style.display = "none";
  }
}

function openPendingList() {
  // Refresh the users list and scroll to the cards area so admins can review.
  loadUsers();
  var grid = document.getElementById("cardGrid");
  if (grid) grid.scrollIntoView({ behavior: "smooth" });
}

// --- Load users ---
async function loadUsers() {
  const grid = document.getElementById("cardGrid");
  grid.innerHTML =
    '<div class="grid-state"><div class="spinner"></div><p>Loading...</p></div>';

  try {
    const res = await fetch(
      "/users?location=" + encodeURIComponent(currentLocation),
      {
        headers: { Authorization: getToken() },
      },
    );
    if (!res.ok) throw new Error("Failed");
    allUsers = await res.json();
    populateSessionFilter();
    updateStats();
    renderRooms();
    refreshBadges();
  } catch (err) {
    grid.innerHTML =
      '<div class="grid-state">Failed: ' + err.message + "</div>";
  }
}

async function refreshBadges() {
  for (const loc of ["Malete", "Ila-Orangun"]) {
    try {
      const r = await fetch("/users?location=" + encodeURIComponent(loc), {
        headers: { Authorization: getToken() },
      });
      const d = await r.json();
      const el = document.getElementById("cnt-" + loc);
      if (el) el.textContent = d.length;
    } catch {}
  }
}

// â”€â”€â”€ Render rooms â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderRooms() {
  const grid = document.getElementById("cardGrid");
  let users = allUsers.filter(inSession);
  if (currentTab === "tenant") {
    users = users.filter((u) => (u.type || "tenant") === "tenant");
  } else if (currentTab === "shop") {
    users = users.filter((u) => (u.type || "tenant") === "shop");
  }
  const roomKeys = getRoomsForLocation(currentLocation);

  if (!roomKeys.length) {
    grid.innerHTML =
      '<div class="grid-state">No room inventory available.</div>';
    return;
  }

  const byRoom = {};
  users.forEach((u) => {
    const room = u.roomNo || "Unassigned";
    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push(u);
  });

  grid.innerHTML = "";
  roomKeys.forEach((room) => {
    const occupants = byRoom[room] || [];
    if (occupants.length) {
      occupants.forEach((u) => grid.appendChild(buildCard(u)));
    } else {
      grid.appendChild(buildEmptyRoomCard(room));
    }
  });

  if (byRoom.Unassigned) {
    byRoom.Unassigned.forEach((u) => grid.appendChild(buildCard(u)));
  }
}

function buildEmptyRoomCard(room) {
  const el = document.createElement("article");
  el.className = "card room-empty";
  el.innerHTML =
    '<div class="card-head">' +
    '<div class="card-identity">' +
    '<div class="card-name">' +
    esc(room) +
    "</div>" +
    '<div class="card-contact">Available for this session</div>' +
    "</div>" +
    '<div class="room-chip room-available">Available</div>' +
    "</div>" +
    '<div class="card-details">' +
    '<div class="det"><div class="det-label">Status</div><div class="det-val">Empty</div></div>' +
    "</div>";
  return el;
}

// â”€â”€â”€ Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildCard(u) {
  var el = document.createElement("article");
  el.className = "card" + (u.retainPending ? " is-pending" : "");

  var img = u.passport
    ? u.passport
    : "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(u.name || "?") +
      "&background=1a3c5e&color=fff&bold=true&size=100";

  var date = u.paymentDate
    ? new Date(u.paymentDate).toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : u.retainPending
      ? "Awaiting payment"
      : "—";

  var occupiedBadge = u.roomNo
    ? '<span class="room-chip room-occupied">✔️ Occupied</span>'
    : "";

  var histArgs = [u._id, u.email, u.name, img, u.location]
    .map(getJsArg)
    .join(",");

  // â”€â”€ Red approval banner (only for pending cards) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  var banner = u.retainPending
    ? '<div class="approval-banner">' +
      '<div class="approval-left">' +
      '<span class="approval-dot"></span>' +
      "<div>" +
      '<div class="approval-title">Awaiting Your Approval</div>' +
      '<div class="approval-sub">' +
      (u.renewedFrom
        ? "Renewal awaiting admin approval"
        : u.paymentProof
          ? "New application received with payment proof"
          : "New application awaiting admin approval") +
      "</div>" +
      "</div>" +
      "</div>" +
      '<button class="approval-btn" onclick="openApproveModal(' +
      getJsArg(u._id) +
      "," +
      getJsArg(u.session) +
      "," +
      getJsArg(u.name) +
      ')">Approve</button>' +
      "</div>"
    : "";

  var passportBtn = u.passport
    ? '<a class="cta cta-proof" href="' +
      u.passport +
      '" target="_blank" rel="noopener">View Passport</a>'
    : '<span class="cta cta-no-proof">No Passport</span>';

  var idCardBtn = u.idCard
    ? '<a class="cta cta-proof" href="' +
      u.idCard +
      '" target="_blank" rel="noopener">View ID</a>'
    : '<span class="cta cta-no-proof">No ID</span>';
  var proofUrl = u.paymentProof
    ? u.paymentProof.toLowerCase().includes(".pdf")
      ? u.paymentProof.replace("/image/upload/", "/raw/upload/")
      : u.paymentProof
    : null;

  var proofBtn = proofUrl
    ? '<a class="cta cta-proof" href="' +
      proofUrl +
      "?t=" +
      Date.now() +
      '" target="_blank" rel="noopener">' +
      (u.paymentProof.toLowerCase().includes(".pdf")
        ? "📄 View PDF"
        : "🖼 View Proof") +
      "</a>"
    : '<span class="cta cta-no-proof">No Proof</span>';

  var actionBtn =
    '<button class="cta cta-receipt" onclick="window.open(\'receipt.html?id=' +
    u._id +
    "', '_blank')\">Receipt</button>" +
    '<button class="cta cta-history" onclick="openDrawer(' +
    histArgs +
    ')">History</button>';

  el.innerHTML =
    banner +
    '<div class="card-stripe' +
    (u.retainPending ? " stripe-red" : "") +
    '"></div>' +
    '<div class="card-head">' +
    '<a href="' +
    img +
    '" target="_blank" rel="noopener" class="avatar-link" onclick="event.stopPropagation()">' +
    '<img src="' +
    img +
    '" class="avatar" alt="' +
    esc(u.name) +
    '" loading="lazy" />' +
    "</a>" +
    '<div class="card-identity">' +
    '<div class="card-name">' +
    esc(u.name) +
    "</div>" +
    '<div class="card-contact">' +
    esc(u.email) +
    "</div>" +
    '<div class="card-contact">' +
    esc(u.phone) +
    "</div>" +
    '<div class="card-badges">' +
    '<span class="badge badge-session">' +
    esc(u.session) +
    "</span>" +
    (u.renewedFrom
      ? '<span class="badge badge-renewed">&#8635; Renewed</span>'
      : "") +
    (u.retainPending
      ? '<span class="badge badge-pending-red">&#9679; Pending</span>'
      : "") +
    ((u.type || "tenant") === "shop"
      ? '<span class="badge badge-shop">Shop</span>'
      : "") +
    "</div>" +
    "</div>" +
    occupiedBadge +
    "</div>" +
    '<div class="card-details">' +
    '<div class="det"><div class="det-label">Room</div><div class="det-val">' +
    esc(u.roomNo) +
    "</div></div>" +
    '<div class="det"><div class="det-label">Level</div><div class="det-val">' +
    esc(u.level) +
    "</div></div>" +
    '<div class="det"><div class="det-label">Paid</div><div class="det-val">' +
    date +
    "</div></div>" +
    '<div class="det"><div class="det-label">Amount</div><div class="det-val amount">&#8358;' +
    Number(u.amount || 0).toLocaleString() +
    "</div></div>" +
    "</div>" +
    '<div class="card-actions">' +
    passportBtn +
    idCardBtn +
    proofBtn +
    actionBtn +
    "</div>";

  return el;
}

// â”€â”€â”€ Drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function openDrawer(id, email, name, img, location) {
  set("drawerName", name);
  set("drawerLoc", location);
  const av = document.getElementById("drawerAvatar");
  if (av) av.src = img;

  document.getElementById("drawerSessionList").innerHTML =
    '<div class="grid-state"><div class="spinner"></div></div>';
  document.getElementById("drawerBackdrop").classList.add("open");
  document.getElementById("tenantDrawer").classList.add("open");
  document.body.style.overflow = "hidden";

  try {
    const res = await fetch(
      "/users?location=" +
        encodeURIComponent(location) +
        "&email=" +
        encodeURIComponent(email),
      { headers: { Authorization: getToken() } },
    );
    drawerHistory = res.ok ? await res.json() : [];
  } catch {
    drawerHistory = [];
  }

  const latest = drawerHistory[0];
  if (latest) {
    const grid = document.getElementById("drawerInfoGrid");
    if (grid) {
      grid.innerHTML = [
        ["Email", latest.email],
        ["Phone", latest.phone],
        ["Guardian", latest.guardianName],
        ["G. Phone", latest.guardianPhone],
      ]
        .map(function (pair) {
          return (
            '<div class="drawer-info-item">' +
            '<div class="drawer-info-label">' +
            pair[0] +
            "</div>" +
            '<div class="drawer-info-val">' +
            esc(pair[1]) +
            "</div>" +
            "</div>"
          );
        })
        .join("");
    }
  }

  renderDrawerHistory();
}

function closeDrawer() {
  document.getElementById("drawerBackdrop").classList.remove("open");
  document.getElementById("tenantDrawer").classList.remove("open");
  document.body.style.overflow = "";
  drawerHistory = [];
}

// ── Edit Tenant Modal ──────────────────────────────────────────────────────────
let currentEditingUser = null;

async function openEditModal() {
  const latest = drawerHistory[0];
  if (!latest) {
    alert("Could not load user data");
    return;
  }

  currentEditingUser = latest;

  // Populate edit form with current data
  document.getElementById("editName").value = latest.name || "";
  document.getElementById("editEmail").value = latest.email || "";
  document.getElementById("editPhone").value = latest.phone || "";
  document.getElementById("editGuardianName").value = latest.guardianName || "";
  document.getElementById("editGuardianPhone").value =
    latest.guardianPhone || "";
  document.getElementById("editLocation").value = latest.location || "Malete";
  document.getElementById("editType").value = latest.type || "tenant";
  document.getElementById("editRoomNo").value = latest.roomNo || "";
  document.getElementById("editLevel").value = latest.level || "";
  document.getElementById("editSession").value = latest.session || "";
  document.getElementById("editAmount").value = latest.amount || "";
  document.getElementById("editPaymentDate").value = latest.paymentDate || "";

  openModal("editModal", "editBack");
}

function closeEditModal() {
  currentEditingUser = null;
  closeModal("editModal", "editBack");
}

async function saveEdit() {
  if (!currentEditingUser) return;

  const btn = document.getElementById("editSaveBtn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    const res = await fetch("/admin/user/" + currentEditingUser._id, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
      },
      body: JSON.stringify({
        name: document.getElementById("editName").value,
        email: document.getElementById("editEmail").value,
        phone: document.getElementById("editPhone").value,
        guardianName: document.getElementById("editGuardianName").value,
        guardianPhone: document.getElementById("editGuardianPhone").value,
        location: document.getElementById("editLocation").value,
        type: document.getElementById("editType").value,
        roomNo: document.getElementById("editRoomNo").value,
        level: document.getElementById("editLevel").value,
        session: document.getElementById("editSession").value,
        amount: document.getElementById("editAmount").value,
        paymentDate: document.getElementById("editPaymentDate").value,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update user");
    }

    const result = await res.json();
    currentEditingUser = result.user;
    closeEditModal();

    // Refresh the drawer with updated data
    if (drawerHistory.length > 0) {
      drawerHistory[0] = currentEditingUser;
      renderDrawerHistory();
      // Update contact info display
      const grid = document.getElementById("drawerInfoGrid");
      if (grid) {
        grid.innerHTML = [
          ["Email", currentEditingUser.email],
          ["Phone", currentEditingUser.phone],
          ["Guardian", currentEditingUser.guardianName],
          ["G. Phone", currentEditingUser.guardianPhone],
        ]
          .map(function (pair) {
            return (
              '<div class="drawer-info-item">' +
              '<div class="drawer-info-label">' +
              pair[0] +
              "</div>" +
              '<div class="drawer-info-val">' +
              esc(pair[1]) +
              "</div>" +
              "</div>"
            );
          })
          .join("");
      }
    }

    alert("User updated successfully");
    // Refresh main list
    await queryUsers();
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function renderDrawerHistory() {
  const list = document.getElementById("drawerSessionList");
  if (!drawerHistory.length) {
    list.innerHTML =
      '<p style="color:var(--muted);font-size:13px;padding:10px 0">No records found.</p>';
    return;
  }

  const sorted = drawerHistory.slice().sort(function (a, b) {
    return (b.session || "").localeCompare(a.session || "");
  });

  list.innerHTML = sorted
    .map(function (r) {
      var date = r.paymentDate
        ? new Date(r.paymentDate).toLocaleDateString("en-NG", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : r.retainPending
          ? "Awaiting payment"
          : "---";

      return (
        '<div class="session-row" id="sr-' +
        r._id +
        '">' +
        '<div class="session-row-head" onclick="toggleRow(\'' +
        r._id +
        "')\">" +
        '<span class="session-row-title">' +
        esc(r.session) +
        "</span>" +
        '<div class="session-row-meta">' +
        '<span class="session-row-amount">&#8358;' +
        Number(r.amount || 0).toLocaleString() +
        "</span>" +
        (r.retainPending
          ? '<span style="font-size:11px;color:var(--amber)">&#9203;</span>'
          : "") +
        '<span class="session-row-chevron">&#9660;</span>' +
        "</div>" +
        "</div>" +
        '<div class="session-row-body">' +
        '<div class="session-detail-grid">' +
        '<div class="sdet"><div class="sdet-label">Room</div><div class="sdet-val">' +
        esc(r.roomNo) +
        "</div></div>" +
        '<div class="sdet"><div class="sdet-label">Level</div><div class="sdet-val">' +
        esc(r.level) +
        "</div></div>" +
        '<div class="sdet"><div class="sdet-label">Paid</div><div class="sdet-val">' +
        date +
        "</div></div>" +
        '<div class="sdet"><div class="sdet-label">Status</div><div class="sdet-val">' +
        (r.retainPending ? "Pending" : "Confirmed") +
        "</div></div>" +
        "</div>" +
        '<div class="session-row-actions">' +
        '<button class="sbtn" onclick="window.open(\'receipt.html?id=' +
        r._id +
        "','_blank')\">Receipt</button>" +
        (r.idCard
          ? '<a class="sbtn sbtn-proof" href="' +
            r.idCard +
            '" target="_blank">ID Card</a>'
          : "") +
        (r.paymentProof
          ? '<a class="sbtn sbtn-proof" href="' +
            r.paymentProof +
            "?t=" +
            Date.now() +
            '" target="_blank">' +
            (r.paymentProof.toLowerCase().includes(".pdf")
              ? "📄 PDF"
              : "🖼 Proof") +
            "</a>"
          : "") +
        (r.retainPending
          ? '<button class="sbtn sbtn-approve" onclick="openApproveModal(' +
            getJsArg(r._id) +
            "," +
            getJsArg(r.session) +
            "," +
            getJsArg("") +
            ')">Approve</button>'
          : '<button class="sbtn sbtn-renew" onclick="openRenewModal(' +
            getJsArg(r._id) +
            "," +
            getJsArg(r.session) +
            "," +
            getJsArg(r.roomNo) +
            ')">Renew</button>') +
        "</div>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

function toggleRow(id) {
  var row = document.getElementById("sr-" + id);
  if (row) row.classList.toggle("expanded");
}

// â”€â”€â”€ Modals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openModal(mId, bId) {
  document.getElementById(bId).classList.add("open");
  document.getElementById(mId).classList.add("open");
}
function closeModal(mId, bId) {
  document.getElementById(bId).classList.remove("open");
  document.getElementById(mId).classList.remove("open");
}

async function openRentModal() {
  openModal("rentModal", "rentBack");
  try {
    var r = await fetch("/admin/get-amounts", {
      headers: { Authorization: getToken() },
    });
    var d = await r.json();
    document.getElementById("maletePrice").value =
      d.malete != null ? d.malete : "";
    document.getElementById("ilaPrice").value = d.ila != null ? d.ila : "";
  } catch {}
}
function closeRentModal() {
  closeModal("rentModal", "rentBack");
}
async function saveRent() {
  var malete = document.getElementById("maletePrice").value.trim();
  var ila = document.getElementById("ilaPrice").value.trim();
  if (!malete && !ila) {
    alert("Enter at least one value");
    return;
  }
  var payload = {};
  if (malete) payload.malete = +malete;
  if (ila) payload.ila = +ila;
  try {
    var r = await fetch("/admin/set-amount", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
      },
      body: JSON.stringify(payload),
    });
    var d = await r.json();
    if (!r.ok) {
      alert(d.error);
      return;
    }
    alert("Rent updated");
    closeRentModal();
  } catch {
    alert("Update failed");
  }
}

function openRenewModal(id, session, room) {
  renewTargetId = id;
  set("renewInfo", "Renewing Room " + room + " â€” Session " + session);
  ["rEmail", "rPhone", "rDate"].forEach(function (k) {
    document.getElementById(k).value = "";
  });
  document.getElementById("rLevel").value = "";
  openModal("renewModal", "renewBack");
}
function closeRenewModal() {
  renewTargetId = null;
  closeModal("renewModal", "renewBack");
}
async function confirmRenew() {
  if (!renewTargetId) return;
  var body = {};
  var e = document.getElementById("rEmail").value.trim();
  var p = document.getElementById("rPhone").value.trim();
  var l = document.getElementById("rLevel").value;
  var d = document.getElementById("rDate").value;
  if (e) body.email = e;
  if (p) body.phone = p;
  if (l) body.level = l;
  if (d) body.paymentDate = d;
  try {
    var r = await fetch("/renew/" + renewTargetId, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
      },
      body: JSON.stringify(body),
    });
    var d2 = await r.json();
    if (!r.ok) {
      alert(d2.error);
      return;
    }
    alert(d2.message);
    closeRenewModal();
    closeDrawer();
    loadUsers();
  } catch {
    alert("Renewal failed");
  }
}

function openApproveModal(id, session, name) {
  approveTargetId = id;
  set(
    "approveInfo",
    "Approving retention" +
      (name ? " for " + name : "") +
      " â€” Session " +
      session,
  );
  document.getElementById("aDate").value = new Date()
    .toISOString()
    .slice(0, 10);
  openModal("approveModal", "approveBack");
}
function closeApproveModal() {
  approveTargetId = null;
  closeModal("approveModal", "approveBack");
}
async function confirmApprove() {
  if (!approveTargetId) return;
  const confirmText = (document.getElementById("approveConfirm")?.value || "")
    .trim()
    .toUpperCase();
  if (confirmText !== "APPROVE") {
    alert("Please type APPROVE to confirm this approval.");
    return;
  }
  if (
    !confirm(
      "This will approve the retention and mark the tenant as paid. Proceed?",
    )
  )
    return;
  try {
    var r = await fetch("/approve-retain/" + approveTargetId, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
      },
      body: JSON.stringify({
        paymentDate: document.getElementById("aDate").value,
      }),
    });
    var d = await r.json();
    if (!r.ok) {
      alert(d.error);
      return;
    }
    alert("Retention approved");
    closeApproveModal();
    closeDrawer();
    loadUsers();
  } catch {
    alert("Approval failed");
  }
}

async function openAdminManager() {
  openModal("adminMgrModal", "adminMgrBack");
  await refreshAdminList();
}
function closeAdminManager() {
  closeModal("adminMgrModal", "adminMgrBack");
}

async function refreshAdminList() {
  var list = document.getElementById("adminList");
  list.innerHTML =
    "<p style='color:var(--muted);font-size:13px'>Loading...</p>";
  try {
    var r = await fetch("/admin/list", {
      headers: { Authorization: getToken() },
    });
    var admins = await r.json();
    var myId = parseJwt(getToken()).id;
    list.innerHTML = admins
      .map(function (a) {
        return (
          '<div class="admin-row">' +
          "<div>" +
          '<div class="admin-row-name">' +
          esc(a.name) +
          "</div>" +
          '<div class="admin-row-email">' +
          esc(a.email) +
          "</div>" +
          '<span class="admin-row-role">' +
          esc(a.role) +
          "</span>" +
          "</div>" +
          (a._id !== myId
            ? '<button class="btn-del-admin" onclick="deleteAdmin(\'' +
              a._id +
              "','" +
              esc(a.name) +
              "')\">Remove</button>"
            : '<span style="font-size:11px;color:var(--muted)">You</span>') +
          "</div>"
        );
      })
      .join("");
  } catch {
    list.innerHTML = "<p style='color:red;font-size:13px'>Failed to load</p>";
  }
}

async function createAdmin() {
  var name = document.getElementById("newAdminName").value.trim();
  var email = document.getElementById("newAdminEmail").value.trim();
  var password = document.getElementById("newAdminPass").value;
  var role = document.getElementById("newAdminRole").value;
  if (!name || !email || !password) {
    alert("All fields required");
    return;
  }
  if (password.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }
  try {
    var r = await fetch("/admin/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
      },
      body: JSON.stringify({ name, email, password, role }),
    });
    var d = await r.json();
    if (!r.ok) {
      alert(d.error);
      return;
    }
    alert("Admin created");
    ["newAdminName", "newAdminEmail", "newAdminPass"].forEach(function (k) {
      document.getElementById(k).value = "";
    });
    await refreshAdminList();
  } catch {
    alert("Failed");
  }
}

async function deleteAdmin(id, name) {
  if (!confirm('Remove admin "' + name + '"?')) return;
  try {
    var r = await fetch("/admin/" + id, {
      method: "DELETE",
      headers: { Authorization: getToken() },
    });
    var d = await r.json();
    if (!r.ok) {
      alert(d.error);
      return;
    }
    await refreshAdminList();
  } catch {
    alert("Deletion failed");
  }
}

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.replace("Bearer ", "").split(".")[1]));
  } catch {
    return {};
  }
}

async function exportUsers() {
  try {
    var r = await fetch("/export-users", {
      headers: { Authorization: getToken() },
    });
    if (!r.ok) throw new Error("Export failed");
    var blob = await r.blob();
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "decrown-" + new Date().toISOString().slice(0, 10) + ".xlsx";
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    alert("Export failed: " + e.message);
  }
}

function logout() {
  ["token", "adminName", "adminRole"].forEach(function (k) {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  window.location.href = "login.html";
}

// Init: load admin settings (current session + registration state) then users
(async function initAdmin() {
  await loadAdminSettings();
  await loadUsers();
})();

// server test cloudiniary upload
