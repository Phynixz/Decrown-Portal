const params = new URLSearchParams(window.location.search);
const id = params.get("id");

if (!id) {
  document.getElementById("receiptDoc").innerHTML =
    "<p style='padding:30px;color:red'>No receipt ID provided in the URL.</p>";
} else {
  loadReceipt(id);
}

async function loadReceipt(id) {
  try {
    const res = await fetch(`/user/${id}`); // <- relative URL, works everywhere
    if (!res.ok) throw new Error("Record not found");
    const data = await res.json();
    if (data.retainPending)
      throw new Error("Receipt unavailable until admin approval.");
    populate(data);
  } catch (err) {
    document.getElementById("receiptDoc").innerHTML =
      `<p style='padding:30px;color:red'>Could not load receipt: ${err.message}</p>`;
  }
}

function populate(data) {
  const fmt = (n) =>
    "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });

  // Receipt number — last 6 chars of MongoDB _id so each is unique
  const receiptNum =
    data.receiptNumber || data._id.toString().slice(-6).toUpperCase();
  setText("r-number", `Receipt #${receiptNum}`);
  const addresses = {
    Malete: "Adjacent Victory Lodge, AGT2 Area Westend, Malete",
    "Ila-Orangun": "Behind Central Mosque, College Road, Ila-Orangun",
  };
  setText("r-address", addresses[data.location] || "Kwara State, Nigeria");

  // Date
  const date = data.paymentDate
    ? new Date(data.paymentDate).toLocaleDateString("en-NG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-NG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
  setText("r-date", `Date: ${date}`);

  // User profile photo
  const photoEl = document.getElementById("userPhoto");
  if (data.passport) {
    photoEl.src = data.passport;
    photoEl.style.display = "block";
  }

  // Recipient
  setText("r-name", (data.name || "—").toUpperCase());
  setText(
    "r-contact",
    [data.email, data.phone].filter(Boolean).join("  ·  ") || "—",
  );

  // Campus
  const campusLabel =
    data.location === "Malete"
      ? "Malete Campus"
      : data.location === "Ila-Orangun"
        ? "Ila-Orangun Campus"
        : data.location || "—";
  setText("r-location", campusLabel);
  if (data.location) {
    document.title = `Receipt — De-Crown Cottage (${campusLabel})`;
  }

  // Session
  setText("r-session", data.session || "—");

  // Room (was hardcoded "room 1" before)
  setText("r-room", data.roomNo || "—");

  // Amount in table row
  setText("r-amount-row", fmt(data.amount));

  // Totals (all the same since single payment — balance is 0)
  const amount = Number(data.amount || 0);
  setText("r-total", fmt(amount));
  setText("r-paid", fmt(amount));
  setText("r-balance", fmt(0));
  setText("r-outstanding", fmt(0));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
