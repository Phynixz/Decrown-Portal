import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, CreditCard, FileText, File } from "lucide-react";
import { useTenant } from "../tenantContext.jsx";
import { getLocalGovernments, NIGERIAN_STATES } from "../utils/nigeriaLocationData.js";

const RULES = {
  name: (v) => /^[a-zA-Z\s]{3,50}$/.test(v.trim()),
  guardianName: (v) => /^[a-zA-Z\s]{3,50}$/.test(v.trim()),
  email: (v) => /^[\w.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim()),
  phone: (v) => /^\d{11}$/.test(v.trim()),
  guardianPhone: (v) => /^\d{11}$/.test(v.trim()),
};

export default function RegistrationForm() {
  const { businessName, branding, locations: tenantLocations } = useTenant();
  // --- Form state ---
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [location, setLocation] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [level, setLevel] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // --- Files ---
  const [files, setFiles] = useState({
    passport: null,
    idCard: null,
    paymentProof: null,
    agreementCopy: null,
  });
  const [previews, setPreviews] = useState({});
  const passportInput = useRef(null);
  const idCardInput = useRef(null);
  const proofInput = useRef(null);
  const agreementInput = useRef(null);

  // --- Meta ---
  const [session, setSession] = useState("Loading session…");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locations, setLocations] = useState([]);

  const displayLocation =
    location === "Malete"
      ? "Malete Campus"
      : location
        ? `${location} Campus`
        : "Choose Location";

  // Load session metadata on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/current-session");
        const data = await res.json();
        setSession(data.session);
        setRegistrationOpen(data.registrationOpen !== false);
      } catch {
        /* ignore */
      }
    })();
    if (tenantLocations?.length) {
      setLocations(tenantLocations);
    } else {
      fetch("/tenant-config")
        .then((res) => res.json())
        .then((data) => setLocations(data.locations || []))
        .catch(() => setLocations([]));
    }
  }, [tenantLocations]);

  const availableUnits =
    locations
      .find((item) => item.name === location)
      ?.units?.filter((unit) => unit.status === "available") || [];
  const availableProperties = locations.filter(
    (property) =>
      property.status === "active" &&
      property.propertyType === "hostel" &&
      property.state === state &&
      property.lga === lga &&
      property.units?.some((unit) => unit.status === "available"),
  );

  // Load the property's default rent, or the selected unit's override.
  useEffect(() => {
    if (!location) {
      setAmount("");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          "/current-amount?location=" +
            encodeURIComponent(location) +
            (roomNo ? "&unit=" + encodeURIComponent(roomNo) : ""),
        );
        const data = await res.json();
        if (res.ok) setAmount("₦" + Number(data.amount).toLocaleString());
      } catch {
        /* ignore */
      }
    })();
  }, [location, roomNo]);

  function handleUpload(field, file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File must be under 5MB.");
      if (field === "passport" && passportInput.current)
        passportInput.current.value = "";
      if (field === "idCard" && idCardInput.current)
        idCardInput.current.value = "";
      if (field === "paymentProof" && proofInput.current)
        proofInput.current.value = "";
      return;
    }
    setFiles((f) => ({ ...f, [field]: file }));
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) =>
        setPreviews((p) => ({ ...p, [field]: e.target.result }));
      reader.readAsDataURL(file);
    } else {
      setPreviews((p) => ({ ...p, [field]: file.name }));
    }
  }

  // --- Progress (mirrors form.js updateProgress) ---
  const sections = ["sec-1", "sec-2", "sec-3", "sec-4", "sec-5"];
  function sectionComplete(i) {
    if (i === 0) return !!(state && lga && location);
    if (i === 1) return !!(name && email && phone);
    if (i === 2) return !!(guardianName && guardianPhone);
    if (i === 3) return !!(level && roomNo && paymentDate);
    if (i === 4) return true; // file-only section — matches vanilla behavior
    return false;
  }
  const doneCount = sections.filter((_, i) => sectionComplete(i)).length;
  const progress = Math.round((doneCount / sections.length) * 100);

  // --- Validation ---
  const fieldValid = {
    name: RULES.name(name),
    guardianName: RULES.guardianName(guardianName),
    email: RULES.email(email),
    phone: RULES.phone(phone),
    guardianPhone: RULES.phone(guardianPhone),
  };
  const dateValid =
    !!paymentDate &&
    new Date(paymentDate) <= new Date(new Date().setHours(23, 59, 59));
  const selectValid = {
    state: !!state,
    lga: !!lga,
    location: !!location,
    level: !!level,
    roomNo: !!roomNo,
  };
  const fileValid = {
    passport: !!files.passport,
    idCard: !!files.idCard,
    paymentProof: !!files.paymentProof,
    agreementCopy: !!files.agreementCopy,
  };
  const termsValid = termsAccepted;

  // Show invalid styling once user has tried to submit
  const err = (value, valid) =>
    showErrors && !valid ? " invalid" : value ? " valid" : "";

  async function onSubmit(e) {
    e.preventDefault();

    const allValid =
      Object.values(fieldValid).every(Boolean) &&
      Object.values(selectValid).every(Boolean) &&
      dateValid &&
      Object.values(fileValid).every(Boolean) &&
      termsValid;

    if (!allValid) {
      setShowErrors(true);
      const order = [
        ["state", 0],
        ["lga", 0],
        ["location", 0],
        ["name", 1],
        ["email", 1],
        ["phone", 1],
        ["guardianName", 2],
        ["guardianPhone", 2],
        ["level", 3],
        ["roomNo", 3],
        ["paymentDate", 3],
        ["passport", 4],
        ["idCard", 4],
        ["paymentProof", 4],
        ["agreementCopy", 4],
      ];
      const first = order.find(([k]) => {
        if (k in fieldValid) return !fieldValid[k];
        if (k in selectValid) return !selectValid[k];
        if (k in fileValid) return !fileValid[k];
        return false;
      });
      const idx = first ? first[1] : 4;
      document
        .getElementById("sec-" + (idx + 1))
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("location", location);
      formData.append("state", state);
      formData.append("lga", lga);
      formData.append("name", name);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("guardianName", guardianName);
      formData.append("guardianPhone", guardianPhone);
      formData.append("level", level);
      formData.append("roomNo", roomNo);
      formData.append("paymentDate", paymentDate);
      formData.append("session", session);
      formData.append("termsAccepted", termsAccepted ? "on" : "");
      formData.append("passport", files.passport);
      formData.append("idCard", files.idCard);
      formData.append("paymentProof", files.paymentProof);
      formData.append("agreementCopy", files.agreementCopy);

      const res = await fetch("/submit", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || "Submission failed";
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
      // Reset form
      setName("");
      setState("");
      setLga("");
      setLocation("");
      setEmail("");
      setPhone("");
      setGuardianName("");
      setGuardianPhone("");
      setLevel("");
      setRoomNo("");
      setPaymentDate("");
      setFiles({
        passport: null,
        idCard: null,
        paymentProof: null,
        agreementCopy: null,
      });
      setPreviews({});
      setTermsAccepted(false);
      setShowErrors(false);
      if (passportInput.current) passportInput.current.value = "";
      if (idCardInput.current) idCardInput.current.value = "";
      if (proofInput.current) proofInput.current.value = "";
      if (agreementInput.current) agreementInput.current.value = "";
    } catch {
      alert("❌ Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const STEP_LABELS = [
    "Location",
    "Personal Info",
    "Guardian",
    "Room & Payment",
    "Documents",
  ];

  return (
    <div className="dc-form">
      <div className="progress-bar" style={{ width: progress + "%" }} />

      <div className="page-wrap">
        <aside className="form-aside">
          <img
            src={branding?.logoUrl || "/d420ac751563a3d498bd84cdf69386bb.jpg"}
            alt={businessName || "De-Crown"}
            className="aside-logo"
          />
          <h2 className="aside-title">
            {businessName || "De-Crown Cottage"}
          </h2>
          <p className="aside-sub">
            Campus Registration
          </p>

          <div className="aside-steps">
            {STEP_LABELS.map((label, i) => (
              <div key={label}>
                <div
                  className={
                    "step-item" +
                    (i === 0 ? " active" : "") +
                    (sectionComplete(i) ? " done" : "")
                  }
                >
                  <div className="step-num">{i + 1}</div>
                  <div className="step-text">{label}</div>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className="step-connector" />
                )}
              </div>
            ))}
          </div>

          <p className="aside-note">
            All fields are required. Your data is secure and only accessible to
            management.
          </p>
        </aside>

        <main className="form-main">
          <div className="form-header">
            {!registrationOpen && (
              <div className="mb-3 p-2.5 rounded-md bg-[#fff3cd] text-[#856404] border border-[#ffeeba]">
                Registration for new tenants is currently closed by the admin.
                Please check back later.
              </div>
            )}
            <h1 className="form-title">Application &amp; Payment Submission</h1>
            <p className="form-sub">
                <span>{displayLocation}</span> · <span>{session}</span>
            </p>
          </div>

          <form id="applicationForm" noValidate onSubmit={onSubmit}>
            {/* Section 1 — Location */}
            <div className="form-section location-section" id="sec-1">
              <div className="section-label">
                <span className="section-num">01</span> Find accommodation
              </div>
              <p className="location-prompt">
                Choose a state and local government area to see properties with available rooms.
              </p>
              <div className="fields-grid">
                <div className="field">
                  <label htmlFor="stateSelect">State</label>
                  <select
                    id="stateSelect"
                    className={
                      "location-select" + err(state, selectValid.state)
                    }
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setLga("");
                      setLocation("");
                      setRoomNo("");
                    }}
                  >
                    <option value="">Select a state</option>
                    {NIGERIAN_STATES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <small className="err-msg">Please select a state</small>
                </div>
                <div className="field">
                  <label htmlFor="lgaSelect">Local Government Area</label>
                  <select
                    id="lgaSelect"
                    disabled={!state}
                    className={"location-select" + err(lga, selectValid.lga)}
                    value={lga}
                    onChange={(e) => {
                      setLga(e.target.value);
                      setLocation("");
                      setRoomNo("");
                    }}
                  >
                    <option value="">{state ? "Select an LGA" : "Select a state first"}</option>
                    {getLocalGovernments(state).map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <small className="err-msg">Please select a local government area</small>
                </div>
                <div className="field full">
                  <label htmlFor="locationSelect">Property</label>
                  <select
                    id="locationSelect"
                    disabled={!lga}
                    className={"location-select" + err(location, selectValid.location)}
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setRoomNo("");
                    }}
                  >
                    <option value="">{lga ? "Select a hostel" : "Select an LGA first"}</option>
                    {availableProperties.map((item) => (
                      <option key={item.id || item.name} value={item.name}>
                        {item.name} · {item.units.filter((unit) => unit.status === "available").length} rooms available
                      </option>
                    ))}
                  </select>
                  <small className="err-msg">Please select a hostel</small>
                  {lga && availableProperties.length === 0 && <small className="hint">No hostels with available rooms in this area yet.</small>}
                </div>
              </div>
            </div>

            {/* Section 2 — Tenant info */}
            <div className="form-section" id="sec-2">
              <div className="section-label">
                <span className="section-num">02</span> Tenant Information
              </div>
              <div className="fields-grid">
                <div className="field full">
                  <label htmlFor="name">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    placeholder="e.g. Adewale Obi"
                    className={err(name, fieldValid.name)}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <small className="hint">
                    As it appears on your ID — 3 to 50 letters
                  </small>
                  <small className="err-msg">
                    Name must be 3–50 letters only
                  </small>
                </div>
                <div className="field">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    placeholder="you@gmail.com"
                    className={err(email, fieldValid.email)}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <small className="err-msg">Enter a valid email address</small>
                </div>
                <div className="field">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    placeholder="08012345678"
                    className={err(phone, fieldValid.phone)}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <small className="err-msg">Must be exactly 11 digits</small>
                </div>
              </div>
            </div>

            {/* Section 3 — Guardian */}
            <div className="form-section" id="sec-3">
              <div className="section-label">
                <span className="section-num">03</span> Parent / Guarantor
              </div>
              <div className="fields-grid">
                <div className="field full">
                  <label htmlFor="GuardianName">
                    Parent / Guarantor's Full Name
                  </label>
                  <input
                    type="text"
                    id="GuardianName"
                    placeholder="e.g. Mrs Adewale Ayuba"
                    className={err(guardianName, fieldValid.guardianName)}
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                  />
                  <small className="err-msg">
                    Name must be 3–50 letters only
                  </small>
                </div>
                <div className="field full">
                  <label htmlFor="guardianPhone">Guardian's Phone</label>
                  <input
                    type="tel"
                    id="guardianPhone"
                    placeholder="08087654321"
                    className={err(guardianPhone, fieldValid.guardianPhone)}
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                  />
                  <small className="err-msg">Must be exactly 11 digits</small>
                </div>
              </div>
            </div>

            {/* Section 4 — Room & Payment */}
            <div className="form-section" id="sec-4">
              <div className="section-label">
                <span className="section-num">04</span> Room &amp; Payment
                Details
              </div>
              <div className="fields-grid">
                <div className="field">
                  <label htmlFor="level">Academic Level</label>
                  <select
                    id="level"
                    className={err(level, selectValid.level)}
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option value="">Select Level</option>
                    {[
                      "100Level",
                      "200Level",
                      "300Level",
                      "400Level",
                      "500Level",
                    ].map((l) => (
                      <option key={l} value={l}>
                        {l.replace("Level", " Level")}
                      </option>
                    ))}
                  </select>
                  <small className="err-msg">Please select your level</small>
                </div>
                <div className="field">
                  <label htmlFor="roomNo">Room Number</label>
                  <select
                    id="roomNo"
                    disabled={!location || availableUnits.length === 0}
                    className={err(roomNo, selectValid.roomNo)}
                    value={roomNo}
                    onChange={(e) => setRoomNo(e.target.value)}
                  >
                    <option value="">{!location ? "Select a hostel first" : availableUnits.length ? "Select a room" : "No rooms available"}</option>
                    {availableUnits.map((unit) => (
                      <option key={unit.id} value={unit.label}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                  <small className="err-msg">Please select a room</small>
                  {location && availableUnits.length === 0 && <small className="hint">This hostel currently has no available rooms. Please choose another hostel.</small>}
                </div>
                <div className="field">
                  <label>Amount Due</label>
                  <input
                    type="text"
                    readOnly
                    className="readonly-field"
                    placeholder="Select a campus first"
                    value={amount}
                  />
                </div>
                <div className="field">
                  <label htmlFor="paymentDate">Payment Date</label>
                  <input
                    type="date"
                    id="paymentDate"
                    className={err(paymentDate, dateValid)}
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                  <small className="err-msg">Please enter a valid date</small>
                </div>
              </div>
            </div>

            {/* Section 5 — Documents */}
            <div className="form-section" id="sec-5">
              <div className="section-label">
                <span className="section-num">05</span> Document Uploads
              </div>
              <div className="fields-grid">
                {[
                  {
                    field: "passport",
                    label: "Passport Photograph",
                    Icon: Camera,
                    accept: "image/*",
                  },
                  {
                    field: "idCard",
                    label: "ID Card",
                    Icon: CreditCard,
                    accept: "image/*,.pdf",
                  },
                  {
                    field: "paymentProof",
                    label: "Payment Receipt",
                    Icon: File,
                    accept: "image/*,.pdf",
                  },
                  {
                    field: "agreementCopy",
                    label: "Agreement Hard Copy",
                    Icon: FileText,
                    accept: "image/*,.pdf",
                  },
                ].map(({ field, label, Icon, accept }) => (
                  <div className="field" key={field}>
                    <label htmlFor={field}>{label}</label>
                    <div
                      className={
                        "upload-zone" +
                        (files[field] ? " has-file" : "") +
                        (showErrors && !files[field] ? " invalid" : "")
                      }
                      id={field + "Zone"}
                    >
                      <input
                        type="file"
                        id={field}
                        accept={accept}
                        ref={
                          field === "passport"
                            ? passportInput
                            : field === "idCard"
                              ? idCardInput
                              : field === "paymentProof"
                                ? proofInput
                                : agreementInput
                        }
                        onChange={(e) => handleUpload(field, e.target.files[0])}
                      />
                      <div className="upload-placeholder">
                        {previews[field] &&
                        typeof previews[field] === "string" &&
                        previews[field].startsWith("data:") ? (
                          <img
                            src={previews[field]}
                            alt=""
                            className="max-h-20 max-w-full rounded-md object-contain"
                          />
                        ) : previews[field] ? (
                          <>
                            <span className="text-[26px]">📄</span>
                            <span className="text-xs text-success">
                              {previews[field]}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="upload-icon">
                              <Icon size={26} />
                            </span>
                            <span>
                              Click to upload — JPG
                              {field === "passport" ? "" : ", PNG or PDF"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <small className="err-msg">
                      Please upload{" "}
                      {field === "passport"
                        ? "a passport photo"
                        : "your " + label.toLowerCase()}
                    </small>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={
                "field full terms-row" +
                (showErrors && !termsValid ? " invalid" : "")
              }
              id="termsRow"
            >
              <label className="terms-label" htmlFor="termsAccepted">
                <input
                  type="checkbox"
                  id="termsAccepted"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                I have read and agree to the{" "}
                <Link to="/terms" target="_blank" rel="noopener">
                  Terms and Conditions
                </Link>
                .
              </label>
              <small className="err-msg terms-error">
                You must agree to the terms and conditions before submitting.
              </small>
            </div>

            <div className="form-submit-area">
              <button
                type="submit"
                className="btn-submit"
                disabled={busy || !registrationOpen}
              >
                {busy
                  ? "Submitting…"
                  : registrationOpen
                    ? "Submit Application"
                    : "Registration Closed"}
              </button>
              <p className="submit-note">
                By submitting you confirm all information is accurate.
              </p>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
