import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTenant } from "../tenantContext.jsx";
import "../styles/style.css";

const fmt = (n) =>
  "₦" +
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });

const ADDRESSES = {
  Malete: "Adjacent Victory Lodge, AGT2 Area Westend, Malete",
  "Ila-Orangun": "Behind Central Mosque, College Road, Ila-Orangun",
};

export default function Receipt() {
  const { businessName, branding, locations, phone, email } = useTenant();
  const [params] = useSearchParams();
  const id = params.get("id");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("No receipt ID provided in the URL.");
      return;
    }
    (async () => {
      try {
        // Send the tenant/admin token if one exists so revoked tenants are
        // blocked server-side; anonymous access (share links) stays public.
        const tok =
          sessionStorage.getItem("tenantToken") ||
          localStorage.getItem("token") ||
          "";
        const res = await fetch(`/user/${id}`, {
          headers: tok ? { Authorization: tok } : {},
        });
        if (res.status === 403) {
          const d = await res.json().catch(() => ({}));
          throw new Error(
            d.error || "Your access has been revoked by management.",
          );
        }
        if (!res.ok) throw new Error("Record not found");
        const d = await res.json();
        if (d.retainPending)
          throw new Error("Receipt unavailable until admin approval.");
        setData(d);
      } catch (err) {
        setError("Could not load receipt: " + err.message);
      }
    })();
  }, [id]);

  if (error) {
    return (
      <div className="dc-receipt p-7.5 text-red-600">{error}</div>
    );
  }

  if (!data) {
    return <div className="dc-receipt p-7.5">Loading receipt…</div>;
  }

  const receiptNum =
    data.receiptNumber || data._id.toString().slice(-6).toUpperCase();
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
  const campusLabel =
    data.location === "Malete"
      ? "Malete Campus"
      : data.location === "Ila-Orangun"
        ? "Ila-Orangun Campus"
        : data.location || "—";
  const amount = Number(data.amount || 0);

  return (
    <div className="dc-receipt">
      <div className="receipt-wrap">
        <div className="receipt" id="receiptDoc">
          {/* Header */}
          <div className="r-head">
            <img
              src={branding?.logoUrl || "/d420ac751563a3d498bd84cdf69386bb.jpg"}
              alt={businessName || "Logo"}
              className="r-logo"
            />
            <div className="r-company">
              <h1>{businessName || "De-Crown Cottage"}</h1>
              <p id="r-address">
                {locations?.find((l) => l.name === data.location)?.address ||
                  ADDRESSES[data.location] ||
                  "Kwara State, Nigeria"}
              </p>
              <p id="r-state">Nigeria</p>
              <p>
                {[phone || "09036388983", email || "decrown@gmail.com"]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
            </div>
          </div>

          {/* Receipt meta */}
          <div className="r-meta">
            {data.passport && (
              <img
                src={data.passport}
                alt="User Photo"
                className="user-photo"
                style={{ display: "block" }}
              />
            )}
            <div className="r-recipient">
              <div className="recipient-info">
                <p className="r-to-label">Receipt To</p>
                <p className="r-name" id="r-name">
                  {(data.name || "—").toUpperCase()}
                </p>
                <p className="r-contact" id="r-contact">
                  {[data.email, data.phone].filter(Boolean).join("  ·  ") || "—"}
                </p>
              </div>
            </div>
            <div className="r-ref">
              <p className="r-number" id="r-number">
                Receipt #{receiptNum}
              </p>
              <p id="r-date">Date: {date}</p>
              <p>Mode: Bank Transfer</p>
              <p>Bank: UBA</p>
              <p>
                Campus: <span id="r-location">{campusLabel}</span>
              </p>
              <p>
                Session: <span id="r-session">{data.session || "—"}</span>
              </p>
            </div>
          </div>

          {/* Table */}
          <table className="r-table">
            <thead>
              <tr>
                <th className="col-idx">#</th>
                <th className="col-desc">Description</th>
                <th className="col-room">Room No.</th>
                <th className="col-amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="col-idx">1</td>
                <td className="col-desc">Hostel Accommodation Fee</td>
                <td className="col-room" id="r-room">
                  {data.roomNo || "—"}
                </td>
                <td className="col-amount" id="r-amount-row">
                  {fmt(data.amount)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div className="r-totals">
            <div className="r-total-row">
              <span>Grand Total</span>
              <span id="r-total">{fmt(amount)}</span>
            </div>
            <div className="r-divider"></div>
            <div className="r-total-row">
              <span>Total Paid</span>
              <span id="r-paid">{fmt(amount)}</span>
            </div>
            <div className="r-divider"></div>
            <div className="r-total-row">
              <span>Balance</span>
              <span id="r-balance">{fmt(0)}</span>
            </div>
            <div className="r-divider"></div>
            <div className="r-total-row">
              <span>Outstanding</span>
              <span id="r-outstanding">{fmt(0)}</span>
            </div>
          </div>

          <div className="r-divider-full"></div>

          {/* Footer */}
          <div className="r-foot">
            <p>Thank you for choosing {businessName || "De-Crown Cottage"}</p>
            <p className="r-foot-sub">
              This receipt is computer-generated and valid without a signature.
            </p>
          </div>
        </div>

        {/* Print button (hidden on print) */}
        <div className="no-print">
          <button onClick={() => window.print()} className="print-btn">
            🖨 Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
