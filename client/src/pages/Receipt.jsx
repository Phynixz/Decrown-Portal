import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTenant } from "../tenantContext.jsx";

const fmt = (n) =>
  "₦" +
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });

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
        if (d.disapproved)
          throw new Error("This application was not approved.");
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
      <div className="flex min-h-screen flex-col items-center bg-bg px-4 py-10 font-sans leading-relaxed text-red-600">{error}</div>
    );
  }

  if (!data) {
    return <div className="flex min-h-screen flex-col items-center bg-bg px-4 py-10 font-sans leading-relaxed text-text">Loading receipt…</div>;
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
  const campusLabel = data.location || "—";
  const amount = Number(data.amount || 0);

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg px-4 py-10 font-sans leading-relaxed text-text print:bg-card print:p-0 max-[740px]:px-3 max-[740px]:py-5">
      <div className="flex w-full flex-col items-center gap-6">
        <div className="w-[700px] max-w-full rounded-[14px] border border-border bg-card p-10 shadow-[0_4px_20px_rgba(44,36,24,0.08)] print:w-full print:p-5 print:shadow-none max-[740px]:px-4 max-[740px]:py-6" id="receiptDoc">
          {/* Header */}
          <div className="mb-7 flex items-start justify-between border-b-2 border-border pb-6 max-[740px]:flex-col max-[740px]:gap-3.5 max-[740px]:pb-4">
            <img
              src={branding?.logoUrl || "/d420ac751563a3d498bd84cdf69386bb.jpg"}
              alt={businessName || "Logo"}
              className="h-[90px] w-[90px] shrink-0 rounded-[10px] border-2 border-border object-cover"
            />
            <div className="text-right leading-relaxed max-[740px]:text-left">
              <h1 className="mb-2 font-display text-[26px] font-bold text-navy">{businessName || "De-Crown Cottage"}</h1>
              <p className="text-xs text-muted" id="r-address">
                {locations?.find((l) => l.name === data.location)?.address ||
                  data.address ||
                  "Address not configured"}
              </p>
              <p className="text-xs text-muted" id="r-state">Nigeria</p>
              <p className="text-xs text-muted">
                {[phone || "09036388983", email || "decrown@gmail.com"]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
            </div>
          </div>

          {/* Receipt meta */}
          <div className="mb-7 grid grid-cols-[auto_1fr_auto] gap-6 max-[740px]:grid-cols-1 max-[740px]:gap-4">
            {data.passport && (
              <img
                src={data.passport}
                alt="User Photo"
                className="block h-20 w-20 rounded-full border-2 border-border object-cover"
                style={{ display: "block" }}
              />
            )}
            <div className="flex items-start gap-4 leading-relaxed">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-muted">Receipt To</p>
                <p className="text-base font-bold uppercase text-navy" id="r-name">
                  {(data.name || "—").toUpperCase()}
                </p>
                <p className="mt-1 text-[13px] text-text2" id="r-contact">
                  {[data.email, data.phone].filter(Boolean).join("  ·  ") || "—"}
                </p>
              </div>
            </div>
            <div className="text-right text-[13px] leading-loose text-text2 max-[740px]:text-left">
              <p className="mb-1.5 text-lg font-bold text-terra" id="r-number">
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
          <div className="mb-2 w-full overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[520px] border-collapse [&_td]:border-b [&_td]:border-border [&_td]:px-3.5 [&_td]:py-3.25 [&_td]:text-[13px] [&_th]:bg-card2 [&_th]:px-3.5 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.5px] [&_th]:text-navy">
            <thead>
              <tr>
                <th className="w-9 bg-navy text-center text-card">#</th>
                <th>Description</th>
                <th className="w-[90px]">Room No.</th>
                <th className="w-[120px] bg-terra pr-3.5 text-right text-card">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="w-9 bg-navy text-center font-bold text-card">1</td>
                <td className="bg-card2">Hostel Accommodation Fee</td>
                <td className="w-[90px] bg-card2" id="r-room">
                  {data.roomNo || "—"}
                </td>
                <td className="w-[120px] bg-terra pr-3.5 text-right font-bold text-card" id="r-amount-row">
                  {fmt(data.amount)}
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          {/* Totals */}
          <div className="float-right flex min-w-[240px] flex-col gap-1 pt-4 max-[740px]:float-none max-[740px]:min-w-0">
            <div className="flex items-center justify-between py-1.5 font-display text-[13px] font-semibold uppercase tracking-[0.4px] text-text [&_span:last-child]:min-w-[90px] [&_span:last-child]:text-right [&_span:last-child]:font-bold [&_span:last-child]:text-terra">
              <span>Grand Total</span>
              <span id="r-total">{fmt(amount)}</span>
            </div>
            <div className="h-px w-full bg-border"></div>
            <div className="flex items-center justify-between py-1.5 font-display text-[13px] font-semibold uppercase tracking-[0.4px] text-text [&_span:last-child]:min-w-[90px] [&_span:last-child]:text-right [&_span:last-child]:font-bold [&_span:last-child]:text-terra">
              <span>Total Paid</span>
              <span id="r-paid">{fmt(amount)}</span>
            </div>
            <div className="h-px w-full bg-border"></div>
            <div className="flex items-center justify-between py-1.5 font-display text-[13px] font-semibold uppercase tracking-[0.4px] text-text [&_span:last-child]:min-w-[90px] [&_span:last-child]:text-right [&_span:last-child]:font-bold [&_span:last-child]:text-terra">
              <span>Balance</span>
              <span id="r-balance">{fmt(0)}</span>
            </div>
            <div className="h-px w-full bg-border"></div>
            <div className="flex items-center justify-between py-1.5 font-display text-[13px] font-semibold uppercase tracking-[0.4px] text-text [&_span:last-child]:min-w-[90px] [&_span:last-child]:text-right [&_span:last-child]:font-bold [&_span:last-child]:text-terra">
              <span>Outstanding</span>
              <span id="r-outstanding">{fmt(0)}</span>
            </div>
          </div>

          <div className="clear-both my-6 h-[1.5px] bg-border"></div>

          {/* Footer */}
          <div className="text-center leading-relaxed">
            <p className="text-sm font-semibold text-navy">Thank you for choosing {businessName || "De-Crown Cottage"}</p>
            <p className="mt-1 text-xs italic text-muted">
              This receipt is computer-generated and valid without a signature.
            </p>
          </div>
        </div>

        {/* Print button (hidden on print) */}
        <div className="print:block print:hidden">
          <button onClick={() => window.print()} className="cursor-pointer rounded-lg border-none bg-navy px-7 py-3 font-sans text-sm font-semibold text-card transition-all hover:bg-navy2 hover:shadow-[0_4px_12px_rgba(26,60,94,0.2)]">
            🖨 Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
