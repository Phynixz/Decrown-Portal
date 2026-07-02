function getSelectedLocation() {
  return document.getElementById("locationSelect")?.value || "";
}

function updateCampusDisplay(location) {
  const display = document.getElementById("campusDisplay");
  const label =
    location === "Malete"
      ? "Malete Campus"
      : location === "Ila-Orangun"
        ? "Ila-Orangun Campus"
        : "Choose Campus";
  if (display) display.textContent = label;
  document.title = `Application Form — De-Crown Cottage`;
}

const ROOM_COUNTS = {
  Malete: 10,
  "Ila-Orangun": 22,
};

function populateRoomOptions(location) {
  const roomNo = document.getElementById("roomNo");
  if (!roomNo) return;
  const previous = roomNo.value;
  roomNo.innerHTML = '<option value="">Select Room</option>';
  const total = ROOM_COUNTS[location] || 0;
  for (let i = 1; i <= total; i++) {
    const opt = document.createElement("option");
    opt.value = "Room " + i;
    opt.textContent = "Room " + i;
    roomNo.appendChild(opt);
  }
  if (previous && roomNo.querySelector(`option[value="${previous}"]`)) {
    roomNo.value = previous;
  }
  updateProgress();
}

async function loadMeta() {
  try {
    const res = await fetch("/current-session");
    const data = await res.json();
    const disp = document.getElementById("sessionDisplay");
    const fld = document.getElementById("sessionField");
    if (disp) disp.textContent = data.session;
    if (fld) fld.value = data.session;
    // If registration is closed, show banner and disable submit
    const banner = document.getElementById("registrationBanner");
    const submitBtn = document.getElementById("submitBtn");
    if (data.registrationOpen === false) {
      if (banner) banner.style.display = "block";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Registration Closed";
      }
    } else {
      if (banner) banner.style.display = "none";
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Application";
      }
    }
  } catch {}

  const location = getSelectedLocation();
  if (!location) return;
  updateCampusDisplay(location);
  populateRoomOptions(location);

  try {
    const res = await fetch(
      "/current-amount?location=" + encodeURIComponent(location),
    );
    const data = await res.json();
    const el = document.getElementById("amountPaid");
    if (el && res.ok) el.value = "₦" + Number(data.amount).toLocaleString();
  } catch {}
}
loadMeta();

const locationSelect = document.getElementById("locationSelect");
if (locationSelect) {
  locationSelect.addEventListener("change", function () {
    const location = getSelectedLocation();
    updateCampusDisplay(location);
    populateRoomOptions(location);
    loadMeta();
  });
}

// â”€â”€â”€ Progress bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateProgress() {
  const bar = document.getElementById("progressBar");
  if (!bar) return;
  const sections = document.querySelectorAll(".form-section");
  let done = 0;
  sections.forEach(function (sec, i) {
    const inputs = sec.querySelectorAll(
      "input:not([readonly]):not([type='hidden']):not([type='file']), select",
    );
    const full = Array.from(inputs).every(function (inp) {
      return inp.value.trim() !== "";
    });
    if (full) done++;
    var ind = document.getElementById("step-indicator-" + (i + 1));
    if (ind) {
      if (full) {
        ind.classList.remove("active");
        ind.classList.add("done");
      }
    }
  });
  bar.style.width =
    Math.round((done / Math.max(sections.length, 1)) * 100) + "%";
}

// â”€â”€â”€ Upload preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function handleUpload(input, zoneId, previewId) {
  const zone = document.getElementById(zoneId);
  const preview = document.getElementById(previewId);
  const file = input.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("File must be under 5MB.");
    input.value = "";
    return;
  }

  if (zone) zone.classList.add("has-file");
  if (zone) zone.classList.remove("invalid");

  if (preview) {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = function (e) {
        preview.innerHTML =
          "<img src='" +
          e.target.result +
          "' style='max-height:80px;max-width:100%;border-radius:6px;object-fit:contain;' />";
      };
      reader.readAsDataURL(file);
    } else {
      preview.innerHTML =
        "<span style='font-size:26px'>📄</span>" +
        "<span style='font-size:12px;color:var(--success)'>" +
        file.name +
        "</span>";
    }
  }
  updateProgress();
}

// â”€â”€â”€ Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var RULES = {
  name: function (v) {
    return /^[a-zA-Z\s]{3,50}$/.test(v.trim());
  },
  GuardianName: function (v) {
    return /^[a-zA-Z\s]{3,50}$/.test(v.trim());
  },
  guardianName: function (v) {
    return /^[a-zA-Z\s]{3,50}$/.test(v.trim());
  },
  email: function (v) {
    return /^[\w.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim());
  },
  phone: function (v) {
    return /^\d{11}$/.test(v.trim());
  },
  guardianPhone: function (v) {
    return /^\d{11}$/.test(v.trim());
  },
};

function validateField(el) {
  var rule = RULES[el.name] || RULES[el.id];
  if (!rule || el.hasAttribute("readonly")) return true;
  var valid = rule(el.value);
  el.classList.toggle("valid", valid);
  el.classList.toggle("invalid", !valid);
  return valid;
}

function validateSelect(sel) {
  var valid = sel.value.trim() !== "";
  sel.classList.toggle("valid", valid);
  sel.classList.toggle("invalid", !valid);
  return valid;
}

function validateDate(input) {
  if (!input.value) {
    input.classList.add("invalid");
    return false;
  }
  var d = new Date(input.value);
  var today = new Date();
  today.setHours(23, 59, 59);
  var valid = d <= today;
  input.classList.toggle("valid", valid);
  input.classList.toggle("invalid", !valid);
  return valid;
}

function validateFile(input) {
  var file = input.files[0];
  var zone = input.closest(".upload-zone");
  if (zone) zone.classList.toggle("invalid", !file);
  return !!file;
}

function validateTerms() {
  var terms = document.getElementById("termsAccepted");
  var row = document.getElementById("termsRow");
  var valid = !!(terms && terms.checked);
  if (row) row.classList.toggle("invalid", !valid);
  return valid;
}

// â”€â”€â”€ Live listeners â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document
  .querySelectorAll(
    "input:not([readonly]):not([type='hidden']):not([type='file'])",
  )
  .forEach(function (inp) {
    inp.addEventListener("input", function () {
      validateField(inp);
      updateProgress();
    });
    inp.addEventListener("blur", function () {
      if (!inp.value.trim()) inp.classList.remove("valid", "invalid");
    });
  });
document.querySelectorAll("select").forEach(function (sel) {
  sel.addEventListener("change", function () {
    validateSelect(sel);
    updateProgress();
  });
});
var dateInput = document.querySelector("input[type='date']");
if (dateInput)
  dateInput.addEventListener("change", function () {
    validateDate(this);
    updateProgress();
  });

var termsCheckbox = document.getElementById("termsAccepted");
if (termsCheckbox) {
  termsCheckbox.addEventListener("change", function () {
    validateTerms();
  });
}

// â”€â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var form = document.getElementById("applicationForm");
if (form) {
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    var valid = true;

    document
      .querySelectorAll(
        "input:not([readonly]):not([type='hidden']):not([type='file']):not([type='date'])",
      )
      .forEach(function (inp) {
        if (!validateField(inp)) valid = false;
      });
    document.querySelectorAll("select").forEach(function (sel) {
      if (!validateSelect(sel)) valid = false;
    });
    var dInp = document.getElementById("paymentDate");
    if (dInp && !validateDate(dInp)) valid = false;

    var passport = document.getElementById("passport");
    var idCard = document.getElementById("idCard");
    var proof = document.getElementById("paymentProof");
    if (passport && !validateFile(passport)) valid = false;
    if (idCard && !validateFile(idCard)) valid = false;
    if (proof && !validateFile(proof)) valid = false;
    if (!validateTerms()) valid = false;

    if (!valid) {
      var first = document.querySelector(".invalid, .upload-zone.invalid");
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    var btn = document.getElementById("submitBtn");
    btn.textContent = "Submitting…";
    btn.disabled = true;

    try {
      var formData = new FormData(form);
      var session = document.getElementById("sessionField").value;
      formData.set("session", session);

      var res = await fetch("/submit", { method: "POST", body: formData });
      var data = await res.json();

      if (!res.ok) {
        var msg = data.error || "Submission failed";
        if (msg.toLowerCase().includes("room"))
          alert("❌ This room is already occupied for this session.");
        else if (msg.toLowerCase().includes("email"))
          alert("❌ This email is already registered.");
        else if (msg.toLowerCase().includes("phone"))
          alert("❌ This phone number is already registered.");
        else alert("❌ " + msg);
        return;
      }

      alert(
        "✔️ Application submitted successfully. Please wait for admin review.",
      );
      form.reset();

      document.getElementById("progressBar").style.width = "0%";
      document.querySelectorAll(".valid,.invalid").forEach(function (el) {
        el.classList.remove("valid", "invalid");
      });
      document.querySelectorAll(".upload-zone").forEach(function (z) {
        z.classList.remove("has-file", "invalid");
      });
      document.querySelectorAll(".upload-placeholder").forEach(function (p) {
        p.innerHTML =
          '<span class="upload-icon">📁</span><span>Click to upload</span>';
      });

      loadMeta();
    } catch {
      alert("❌ Network error. Please check your connection and try again.");
    } finally {
      btn.textContent = "Submit Application";
      btn.disabled = false;
    }
  });
}
