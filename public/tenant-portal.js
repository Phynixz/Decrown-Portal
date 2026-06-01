// ─── Utility (defined first so every function below can use it) ──────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── Theme (runs immediately to avoid flash) ──────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  if (saved === "dark") {
    document.documentElement.classList.add("dark");
    // Update both toggle buttons (login screen + dashboard)
    ["themeBtn", "dashThemeBtn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "☀️";
    });
  }
})();

function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", dark ? "dark" : "light");
  ["themeBtn", "dashThemeBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = dark ? "☀️" : "🌙";
  });
}

// ─── State ────────────────────────────────────────────────────────────────────
let tenantToken = sessionStorage.getItem("tenantToken") || "";
let tenantProfile = null;
let sessionHistory = []; // all DB records for this tenant
let nextSession = "";

// Skip login if already authenticated
if (tenantToken) {
  showDashboard();
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function tenantLogin() {
  const email = document.getElementById("tEmail").value.trim();
  const phone = document.getElementById("tPhone").value.trim();
  const errEl = document.getElementById("loginErr");
  const btn = document.getElementById("loginBtn");

  errEl.classList.remove("show");
  errEl.textContent = "";

  if (!email || !phone) {
    showLoginErr("Please enter both your email and phone number.");
    return;
  }

  btn.textContent = "Checking…";
  btn.disabled = true;

  try {
    const res = await fetch("/tenant/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    tenantToken = "Bearer " + data.token;
    sessionStorage.setItem("tenantToken", tenantToken);
    await showDashboard();
  } catch (err) {
    showLoginErr(err.message);
  } finally {
    btn.textContent = "Access My Portal";
    btn.disabled = false;
  }
}

function showLoginErr(msg) {
  const el = document.getElementById("loginErr");
  el.textContent = msg;
  el.classList.add("show");
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function showDashboard() {
  try {
    // 1 — load profile
    const res = await fetch("/tenant/me", {
      headers: { Authorization: tenantToken },
    });
    if (!res.ok) {
      signOut();
      return;
    }
    tenantProfile = await res.json();

    // 2 — load session info
    const sessRes = await fetch("/current-session");
    const sessData = await sessRes.json();
    nextSession = sessData.next;
    // Show registration-closed banner if admin closed registrations
    try {
      const regBanner = document.getElementById("registrationBanner");
      const retainBtn = document.getElementById("retainBtn");
      const uploadBtn = document.getElementById("uploadBtn");
      const newRegLink = document.getElementById("newRegLink");
      if (sessData.registrationOpen === false) {
        if (regBanner) regBanner.style.display = "block";
        if (retainBtn) {
          retainBtn.disabled = true;
          retainBtn.textContent = "Registration Closed";
        }
        if (uploadBtn) uploadBtn.disabled = true;
        if (newRegLink) {
          newRegLink.classList.add("disabled");
          newRegLink.href = "#";
        }
      } else {
        if (regBanner) regBanner.style.display = "none";
        if (retainBtn) {
          retainBtn.disabled = false;
          retainBtn.textContent = "🔒 Request Retention";
        }
        if (uploadBtn) uploadBtn.disabled = false;
        if (newRegLink) {
          newRegLink.classList.remove("disabled");
          newRegLink.href = "form.html";
        }
      }
    } catch {}

    // 3 — fill welcome banner (all through null-safe setText)
    const h = new Date().getHours();
    setText(
      "greeting",
      h < 12 ? "Good morning," : h < 17 ? "Good afternoon," : "Good evening,",
    );
    setText("tenantName", tenantProfile.name || "—");
    setText("tenantLoc", (tenantProfile.location || "") + " Campus");
    setText("tenantRoom", tenantProfile.roomNo || "—");
    setText("tenantSession", tenantProfile.session || "—");
    setText("tenantLevel", tenantProfile.level || "—");
    setText(
      "tenantAmount",
      "₦" + Number(tenantProfile.amount || 0).toLocaleString(),
    );
    setText(
      "tenantDate",
      tenantProfile.paymentDate
        ? new Date(tenantProfile.paymentDate).toLocaleDateString("en-NG", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "—",
    );
    setText("nextSessionBadge", `Next: ${sessData.next}`);

    // 4 — payment proof link (guarded)
    const proofTile = document.getElementById("proofLink");
    if (proofTile) {
      if (tenantProfile.paymentProof) {
        proofTile.href =
          "/uploads/" + encodeURIComponent(tenantProfile.paymentProof);
        proofTile.style.opacity = "1";
        proofTile.onclick = null;
      } else {
        proofTile.href = "#";
        proofTile.style.opacity = "0.5";
        proofTile.onclick = (e) => {
          e.preventDefault();
          alert("No payment proof uploaded yet.");
        };
      }
    }

    // 5 — history & retention step
    await loadHistory();
    setRetainStep();

    // 6 — switch screens last, after all DOM writes are done
    const loginScreen = document.getElementById("loginScreen");
    const dashScreen = document.getElementById("dashScreen");
    if (loginScreen) loginScreen.style.display = "none";
    if (dashScreen) dashScreen.style.display = "block";
  } catch (err) {
    console.error("showDashboard error:", err);
    signOut();
  }
}

// ─── Session history ──────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const res = await fetch("/tenant/history", {
      headers: { Authorization: tenantToken },
    });
    if (!res.ok) return;
    sessionHistory = await res.json(); // sorted newest first by server

    const sel = document.getElementById("historySel");
    // Clear existing options except the placeholder
    while (sel.options.length > 1) sel.remove(1);

    sessionHistory.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r._id;
      opt.textContent = r.session + (r.retainPending ? " ⏳" : "");
      sel.appendChild(opt);
    });
  } catch {}
}

function showHistoryRecord() {
  const id = document.getElementById("historySel").value;
  const detail = document.getElementById("historyDetail");
  const empty = document.getElementById("historyEmpty");

  if (!id) {
    detail.style.display = "none";
    empty.style.display = "none";
    return;
  }

  const rec = sessionHistory.find((r) => r._id === id);
  if (!rec) {
    detail.style.display = "none";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  detail.style.display = "block";

  setText("hSession", rec.session || "—");
  setText("hRoom", rec.roomNo || "—");
  setText("hAmount", "₦" + Number(rec.amount || 0).toLocaleString());
  setText(
    "hDate",
    rec.paymentDate
      ? new Date(rec.paymentDate).toLocaleDateString("en-NG", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—",
  );
  setText(
    "hStatus",
    rec.retainPending ? "⏳ Pending approval" : "✅ Confirmed",
  );

  // History receipt button stores the id
  document.getElementById("hReceiptBtn").dataset.id = rec._id;

  // Proof link
  const proofLink = document.getElementById("hProofLink");
  if (rec.paymentProof) {
    proofLink.href = "/uploads/" + encodeURIComponent(rec.paymentProof);
    proofLink.style.opacity = "1";
    proofLink.onclick = null;
  } else {
    proofLink.href = "#";
    proofLink.style.opacity = "0.45";
    proofLink.onclick = (e) => {
      e.preventDefault();
      alert("No payment proof for this session.");
    };
  }
}

function openHistoryReceipt() {
  const id = document.getElementById("hReceiptBtn").dataset.id;
  if (!id) return;
  const rec = sessionHistory.find((r) => r._id === id);
  if (!rec) return;
  if (rec.retainPending) {
    alert(
      "This session is pending admin approval — receipt unavailable until approved.",
    );
    return;
  }
  window.open(`receipt.html?id=${id}`, "_blank");
}

// ─── Retention step logic ────────────────────────────────────────────────────
// Determines which step of the retention flow to show based on actual DB state.
// Steps: 1=not requested, 2=requested+no proof, 3=proof uploaded+pending admin, 4=confirmed
function setRetainStep() {
  // Look for a record for the NEXT session belonging to this tenant
  var nextRec = sessionHistory.find(function (r) {
    return r.session === nextSession;
  });

  if (!nextRec) {
    // No next-session record at all — show request button
    showOnly("retainStep1");
    // hide pending banner
    const pb = document.getElementById("pendingBanner");
    if (pb) pb.style.display = "none";
    return;
  }

  if (nextRec.retainPending && !nextRec.paymentProof) {
    // Requested but no receipt uploaded yet
    showOnly("retainStep2");
    return;
  }

  if (nextRec.retainPending && nextRec.paymentProof) {
    // Receipt uploaded, waiting for admin
    showOnly("retainStep3");
    const pb = document.getElementById("pendingBanner");
    if (pb) pb.style.display = "block";
    return;
  }

  // retainPending is false — admin confirmed
  showOnly("retainStep4");
  const pb = document.getElementById("pendingBanner");
  if (pb) pb.style.display = "none";
}

function showOnly(stepId) {
  ["retainStep1", "retainStep2", "retainStep3", "retainStep4"].forEach(
    function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = id === stepId ? "block" : "none";
    },
  );
}

// ─── Retention step 1: request ────────────────────────────────────────────────
async function retainRoom() {
  const btn = document.getElementById("retainBtn");
  if (
    !confirm(
      `Request to retain Room ${tenantProfile.roomNo} for ${nextSession}?\n\nYou will upload your payment receipt in the next step.`,
    )
  )
    return;

  btn.textContent = "Processing…";
  btn.disabled = true;

  await loadHistory();
  const existing = sessionHistory.find((r) => r.session === nextSession);
  if (existing) {
    if (existing.retainPending && !existing.paymentProof) {
      alert(
        "You already requested retention for the next session. Please upload your payment receipt.",
      );
      showOnly("retainStep2");
    } else if (existing.retainPending && existing.paymentProof) {
      alert(
        "Your retention request already has a receipt uploaded. Waiting for admin approval.",
      );
      showOnly("retainStep3");
    } else {
      alert("Your room is already retained for the next session.");
      showOnly("retainStep4");
    }
    btn.textContent = "🔒 Request Retention";
    btn.disabled = false;
    return;
  }

  try {
    const res = await fetch("/tenant/retain", {
      method: "POST",
      headers: { Authorization: tenantToken },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to request retention.");

    // Refresh history and move to step 2
    await loadHistory();
    showOnly("retainStep2");
    alert(
      "Retention request created. Please upload your payment receipt in the next step.",
    );
  } catch (err) {
    alert("❌ " + err.message);
    btn.textContent = "🔒 Request Retention";
    btn.disabled = false;
  }
}

// ─── Retention step 2: file preview ──────────────────────────────────────────
function previewFile(input) {
  const file = input.files[0];
  if (!file) return;
  const label = document.getElementById("uploadLabel");
  label.textContent = "✅ " + file.name;
  document.getElementById("uploadBtn").disabled = false;
}

// ─── Retention step 2: upload receipt ────────────────────────────────────────
async function uploadReceipt() {
  const input = document.getElementById("retainFile");
  const uploadBtn = document.getElementById("uploadBtn");
  if (!input.files[0]) {
    alert("Please select a file first.");
    return;
  }

  const formData = new FormData();
  formData.append("paymentProof", input.files[0]);

  uploadBtn.textContent = "Uploading…";
  uploadBtn.disabled = true;

  try {
    const res = await fetch("/tenant/upload-retain-proof", {
      method: "POST",
      headers: { Authorization: tenantToken },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    alert("✅ Receipt uploaded. The admin will confirm your room shortly.");
    await loadHistory();
    showOnly("retainStep3");
  } catch (err) {
    alert("❌ " + err.message);
    uploadBtn.textContent = "⬆️ Submit Receipt";
    uploadBtn.disabled = false;
  }
}

// ─── Quick actions ────────────────────────────────────────────────────────────
function viewReceipt() {
  if (!tenantProfile) {
    alert("Profile not loaded.");
    return;
  }

  const nextRec = sessionHistory.find((r) => r.session === nextSession);
  let receiptId = tenantProfile._id;

  if (nextRec && !nextRec.retainPending) {
    receiptId = nextRec._id;
  }

  if (!receiptId) {
    alert("No receipt available.");
    return;
  }

  window.open(`receipt.html?id=${receiptId}`, "_blank");
}

function proofClick(e) {
  // handled per-tile in showDashboard
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
function signOut() {
  sessionStorage.removeItem("tenantToken");
  tenantToken = "";
  tenantProfile = null;
  sessionHistory = [];
  document.getElementById("dashScreen").style.display = "none";
  document.getElementById("loginScreen").style.display = "block";
}

// Allow Enter on login form
document.addEventListener("keydown", (e) => {
  const login = document.getElementById("loginScreen");
  if (e.key === "Enter" && login && login.style.display !== "none")
    tenantLogin();
});
