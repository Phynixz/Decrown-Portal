import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BedDouble, MapPin } from "lucide-react";
import { getJSON } from "../api.js";

const naira = (amount) =>
  Number(amount) > 0 ? `₦${Number(amount).toLocaleString("en-NG")}` : "Contact agency";

export default function RoomDetailsPage() {
  const { propertyId } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getJSON("/tenant-config")
      .then((data) => {
        const found = (data.locations || []).find((item) =>
          String(item.id || item.name) === propertyId
        );
        if (!cancelled) setProperty(found || null);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Could not load hostel details.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId]);

  const units = (property?.units || []).filter((unit) => unit.status === "available");

  return (
    <div className="dc-public-site min-h-screen bg-paper font-landing-sans text-ink">
      <header className="border-b border-stone bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="font-landing-display text-2xl font-semibold tracking-tight">De-Crown Cottage</Link>
          <Link to="/rooms" className="text-sm font-semibold text-moss underline underline-offset-4">Browse hostels</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <Link to="/rooms" className="inline-flex items-center gap-2 text-sm font-medium text-sage hover:text-ink"><ArrowLeft size={16} /> Back to search</Link>
        {loading && <p className="py-20 text-center text-sage" role="status">Loading hostel details…</p>}
        {!loading && error && <div className="mt-8 rounded border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>}
        {!loading && !error && !property && <div className="py-20 text-center"><h1 className="font-landing-display text-2xl font-semibold">Hostel not found</h1><p className="mt-2 text-sm text-sage">It may have been removed or is no longer listed.</p><Link to="/rooms" className="mt-5 inline-flex rounded bg-moss px-5 py-3 text-sm font-semibold text-white">Browse available hostels</Link></div>}
        {!loading && !error && property && (
          <>
            <section className="mt-7 border border-stone bg-white p-6 sm:p-9">
              <span className="inline-flex rounded-full bg-moss/10 px-3 py-1 text-[11px] font-semibold text-moss">{units.length} {units.length === 1 ? "room" : "rooms"} currently available</span>
              <h1 className="mt-4 font-landing-display text-3xl font-semibold tracking-tight sm:text-5xl">{property.name}</h1>
              <p className="mt-4 flex items-start gap-2 leading-relaxed text-sage"><MapPin size={18} className="mt-0.5 shrink-0" />{[property.address, property.lga, property.state].filter(Boolean).join(", ") || "Please contact the agency for location details."}</p>
              <p className="mt-5 max-w-3xl text-sm leading-relaxed text-sage">Review the rooms below and their listed rent. You do not need to register to browse. When you are ready, choose a room to continue to the application form.</p>
            </section>
            <section className="mt-10">
              <h2 className="font-landing-display text-2xl font-semibold">Available rooms</h2>
              {units.length === 0 && <p className="mt-4 rounded border border-stone bg-white p-6 text-sm text-sage">There are no rooms currently available in this hostel. Please return to search to explore other options.</p>}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {units.map((unit) => {
                  const rent = unit.rentAmount ?? property.rentAmount ?? 0;
                  const query = new URLSearchParams({ location: property.name, room: unit.label || "", state: property.state || "", lga: property.lga || "" });
                  return (
                    <article key={unit.id || unit.label} className="rounded border border-stone bg-white p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-sage">Room</p>
                          <h3 className="mt-1 font-landing-display text-xl font-semibold">{unit.label || "Available room"}</h3>
                        </div>
                        <BedDouble size={23} className="text-moss" />
                      </div>
                      {unit.unitType && <p className="mt-3 text-sm text-sage">{unit.unitType}</p>}
                      <p className="mt-5 font-landing-mono text-xl font-semibold">{naira(rent)}</p>
                      <p className="mt-1 text-xs text-sage">{Number(rent) > 0 ? "Rent amount set by the agency" : "Confirm rent with the agency before applying"}</p>
                      <Link to={`/register?${query.toString()}`} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded bg-moss px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink">Apply for this room <ArrowRight size={16} /></Link>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
