import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Search, SlidersHorizontal, BedDouble } from "lucide-react";
import { getJSON } from "../api.js";
import { getLocalGovernments, NIGERIAN_STATES } from "../utils/nigeriaLocationData.js";

const availableUnits = (property) =>
  (property.units || []).filter((unit) => unit.status === "available");

const naira = (amount) =>
  amount > 0 ? `₦${Number(amount).toLocaleString("en-NG")}` : "Contact agency";

export default function RoomSearchPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [maxRent, setMaxRent] = useState("");

  useEffect(() => {
    let cancelled = false;
    getJSON("/tenant-config")
      .then((data) => {
        if (!cancelled) setProperties(data.locations || []);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Could not load hostels. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const hostels = useMemo(() => properties.filter((property) =>
    property.status === "active" && property.propertyType === "hostel" && availableUnits(property).length > 0
  ), [properties]);

  const filteredHostels = useMemo(() => hostels.filter((property) => {
    const text = `${property.name} ${property.address || ""} ${property.state || ""} ${property.lga || ""}`.toLowerCase();
    if (keyword && !text.includes(keyword.trim().toLowerCase())) return false;
    if (state && property.state !== state) return false;
    if (lga && property.lga !== lga) return false;
    if (maxRent) {
      const ceiling = Number(maxRent);
      const hasRoomWithinBudget = availableUnits(property).some((unit) =>
        Number(unit.rentAmount ?? property.rentAmount ?? 0) > 0 &&
        Number(unit.rentAmount ?? property.rentAmount ?? 0) <= ceiling
      );
      if (!hasRoomWithinBudget) return false;
    }
    return true;
  }), [hostels, keyword, state, lga, maxRent]);

  function clearFilters() {
    setKeyword("");
    setState("");
    setLga("");
    setMaxRent("");
  }

  return (
    <div className="dc-public-site min-h-screen bg-paper font-landing-sans text-ink">
      <header className="sticky top-0 z-40 border-b border-stone bg-paper/95 backdrop-blur">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="flex items-baseline gap-2" aria-label="De-Crown Cottage home">
            <span className="font-landing-display text-2xl font-semibold tracking-tight">De-Crown</span>
            <span className="hidden font-landing-mono text-[11px] uppercase tracking-[0.22em] text-sage sm:inline">Cottage</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/portal" className="rounded border border-ink/15 px-3 py-2 text-xs font-medium hover:bg-ink/5 sm:px-4 sm:py-2.5 sm:text-sm">Tenant sign in</Link>
            <Link to="/" className="hidden font-medium text-sage hover:text-ink sm:inline">Home</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-stone/30 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <p className="font-landing-mono text-xs uppercase tracking-[0.22em] text-brass">Explore accommodation</p>
            <h1 className="mt-3 max-w-3xl font-landing-display text-3xl font-semibold tracking-tight sm:text-5xl">Find an available hostel room.</h1>
            <p className="mt-4 max-w-2xl leading-relaxed text-sage">Browse hostels, compare room prices and availability, and choose what works for you. You can explore without creating an account.</p>

            <div className="mt-8 grid gap-3 rounded border border-stone bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs font-semibold text-sage">
                Search
                <span className="relative mt-2 block">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage" />
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Hostel or area" className="w-full rounded border border-stone bg-white py-3 pl-9 pr-3 text-sm font-normal text-ink outline-none focus:border-moss" />
                </span>
              </label>
              <label className="block text-xs font-semibold text-sage">
                State
                <select value={state} onChange={(event) => { setState(event.target.value); setLga(""); }} className="mt-2 w-full rounded border border-stone bg-white px-3 py-3 text-sm font-normal text-ink outline-none focus:border-moss">
                  <option value="">All states</option>
                  {NIGERIAN_STATES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-sage">
                Local Government Area
                <select value={lga} onChange={(event) => setLga(event.target.value)} disabled={!state} className="mt-2 w-full rounded border border-stone bg-white px-3 py-3 text-sm font-normal text-ink outline-none focus:border-moss disabled:bg-stone/30">
                  <option value="">All LGAs</option>
                  {getLocalGovernments(state).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-sage">
                Maximum room rent (₦)
                <input type="number" min="0" value={maxRent} onChange={(event) => setMaxRent(event.target.value)} placeholder="Any budget" className="mt-2 w-full rounded border border-stone bg-white px-3 py-3 text-sm font-normal text-ink outline-none focus:border-moss" />
              </label>
              <div className="flex items-center justify-between gap-3 text-sm text-sage sm:col-span-2 lg:col-span-4">
                <span className="inline-flex items-center gap-2"><SlidersHorizontal size={15} /> Filter results without signing in</span>
                <button type="button" onClick={clearFilters} className="font-semibold text-moss underline underline-offset-4">Clear filters</button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-landing-display text-2xl font-semibold sm:text-3xl">Hostels with available rooms</h2>
              {!loading && <p className="mt-2 text-sm text-sage">{filteredHostels.length} {filteredHostels.length === 1 ? "hostel" : "hostels"} match your search</p>}
            </div>
            <p className="text-xs text-sage">Prices and availability are provided by the agency.</p>
          </div>

          {loading && <div className="py-20 text-center text-sage" role="status">Loading available hostels…</div>}
          {!loading && error && <div className="mt-8 rounded border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p>{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-3 font-semibold underline">Try again</button></div>}
          {!loading && !error && filteredHostels.length === 0 && (
            <div className="mt-8 rounded border border-stone bg-white px-6 py-16 text-center">
              <BedDouble className="mx-auto text-sage" size={34} />
              <h3 className="mt-4 font-landing-display text-xl font-semibold">No matching hostels yet</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-sage">Try a different location or clear your filters. We only show hostels with rooms currently marked as available.</p>
              <button type="button" onClick={clearFilters} className="mt-5 rounded bg-moss px-5 py-3 text-sm font-semibold text-white hover:bg-ink">Clear filters</button>
            </div>
          )}

          {!loading && !error && filteredHostels.length > 0 && (
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredHostels.map((property) => {
                const units = availableUnits(property);
                const rents = units.map((unit) => Number(unit.rentAmount ?? property.rentAmount ?? 0)).filter((rent) => rent > 0);
                const lowestRent = rents.length ? Math.min(...rents) : 0;
                return (
                  <article key={property.id || property.name} className="flex flex-col overflow-hidden rounded border border-stone bg-white transition-shadow hover:shadow-md">
                    <div className="flex min-h-36 items-start justify-between gap-3 bg-stone/30 p-5">
                      <div>
                        <span className="inline-flex rounded-full bg-moss/10 px-3 py-1 text-[11px] font-semibold text-moss">{units.length} {units.length === 1 ? "room" : "rooms"} available</span>
                        <h3 className="mt-4 font-landing-display text-xl font-semibold">{property.name}</h3>
                      </div>
                      <BedDouble className="shrink-0 text-moss" size={24} />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="flex items-start gap-2 text-sm leading-relaxed text-sage"><MapPin size={16} className="mt-0.5 shrink-0" />{[property.address, property.lga, property.state].filter(Boolean).join(", ") || "Location details available from the agency"}</p>
                      <p className="mt-5 font-landing-mono text-lg font-semibold">{lowestRent ? `From ${naira(lowestRent)}` : "Contact agency for rent"}</p>
                      <p className="mt-1 text-xs text-sage">{lowestRent ? "Room rent · See room-specific prices" : "Rent has not been published for these rooms"}</p>
                      <Link to={`/rooms/${encodeURIComponent(property.id || property.name)}`} className="mt-6 inline-flex items-center justify-center gap-2 rounded bg-moss px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink">View rooms <ArrowRight size={16} /></Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-stone bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-sage sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>De-Crown Cottage · Hostel accommodation, centrally managed.</p>
          <Link to="/" className="font-semibold text-moss underline underline-offset-4">Back to home</Link>
        </div>
      </footer>
    </div>
  );
}
