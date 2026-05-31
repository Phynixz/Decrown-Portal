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
    const res = await fetch(`/user/${id}`); // â† relative URL, works everywhere
    if (!res.ok) throw new Error("Record not found");
    const data = await res.json();
    populate(data);
  } catch (err) {
    document.getElementById("receiptDoc").innerHTML =
      `<p style='padding:30px;color:red'>Could not load receipt: ${err.message}</p>`;
  }
}

function populate(data) {
  const fmt = (n) =>
    "â‚¦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });

  // Receipt number â€” last 6 chars of MongoDB _id so each is unique
  const receiptNum = data._id
    ? data._id.toString().slice(-6).toUpperCase()
    : "000000";
  setText("r-number", `Receipt #${receiptNum}`);

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

  // Recipient
  setText("r-name", (data.name || "â€”").toUpperCase());
  setText(
    "r-contact",
    [data.email, data.phone].filter(Boolean).join("  Â·  ") || "â€”",
  );

  // Campus
  const campusLabel =
    data.location === "Malete"
      ? "Malete Campus"
      : data.location === "Ila-Orangun"
        ? "Ila-Orangun Campus"
        : data.location || "â€”";
  setText("r-location", campusLabel);
  if (data.location) {
    document.title = `Receipt â€” De-Crown Cottage (${campusLabel})`;
  }

  // Session
  setText("r-session", data.session || "â€”");

  // Room (was hardcoded "room 1" before)
  setText("r-room", data.roomNo || "â€”");

  // Amount in table row
  setText("r-amount-row", fmt(data.amount));

  // Totals (all the same since single payment â€” balance is 0)
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


