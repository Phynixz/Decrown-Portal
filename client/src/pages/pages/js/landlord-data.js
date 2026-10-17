/**
 * landlord-data.js
 * ------------------------------------------------------------------
 * Sample data for the Landlord Dashboard. Kept as plain objects/arrays
 * on window so this can later be swapped for a Firebase read (e.g. a
 * query scoped to the logged-in landlord's uid) without changing any
 * rendering code in landlord-dashboard.js.
 *
 * listingStatus reflects the agency's review pipeline and is distinct
 * from the public "status" field used on the live listing (Available /
 * Under Offer / etc. in properties-data.js).
 *
 *   "Submitted"     → received, awaiting first review
 *   "Under Review"  → agency is actively reviewing
 *   "Approved"      → approved, about to go live
 *   "Published"     → live on the public site
 *   "Rejected"      → not approved
 *
 * `publicId` (when present) is the matching id in properties-data.js,
 * used to link out to the live public listing once Published.
 */

window.LANDLORD = {
  name: "Adaeze Okonkwo",
  email: "adaeze.okonkwo@example.com",
  phone: "+234 802 345 6789",
};

window.LANDLORD_PROPERTIES = [
  {
    id: "lp1",
    title: "Bungalow on Half Plot",
    type: "Bungalow",
    listingType: "sale",
    price: 62000000,
    period: null,
    location: "Magodo GRA, Lagos",
    image: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80",
    dateSubmitted: "2026-08-24",
    listingStatus: "Submitted",
    applications: 0,
  },
  {
    id: "lp2",
    title: "3 Bedroom Terrace Duplex",
    type: "Terrace",
    listingType: "sale",
    price: 95000000,
    period: null,
    location: "Ajah, Lagos",
    image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=800&q=80",
    dateSubmitted: "2026-08-10",
    listingStatus: "Under Review",
    applications: 0,
  },
  {
    id: "lp3",
    title: "2 Bedroom Apartment",
    type: "Apartment",
    listingType: "rent",
    price: 3200000,
    period: "year",
    location: "Chevron, Lekki",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
    dateSubmitted: "2026-07-25",
    listingStatus: "Approved",
    applications: 2,
  },
  {
    id: "lp4",
    title: "4 Bedroom Detached Duplex",
    type: "Duplex",
    listingType: "sale",
    price: 185000000,
    period: null,
    location: "Lekki Phase 1, Lagos",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    dateSubmitted: "2026-07-12",
    listingStatus: "Published",
    applications: 6,
    publicId: "p1",
  },
  {
    id: "lp5",
    title: "Waterfront Land — 1000 sqm",
    type: "Land",
    listingType: "sale",
    price: 145000000,
    period: null,
    location: "Oniru, Victoria Island",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80",
    dateSubmitted: "2026-06-01",
    listingStatus: "Rejected",
    applications: 0,
  },
];

window.LANDLORD_ACTIVITY = [
  { id: "a1", type: "submitted", message: "You submitted \u201cBungalow on Half Plot\u201d for review.", date: "2026-08-24" },
  { id: "a2", type: "info-request", message: "The agency requested additional documents for \u201c3 Bedroom Terrace Duplex\u201d.", date: "2026-08-13" },
  { id: "a3", type: "approved", message: "\u201c2 Bedroom Apartment\u201d was approved and will be published shortly.", date: "2026-07-29" },
  { id: "a4", type: "application", message: "New application received for \u201c4 Bedroom Detached Duplex\u201d.", date: "2026-07-22" },
  { id: "a5", type: "published", message: "\u201c4 Bedroom Detached Duplex\u201d is now live on Haven.", date: "2026-07-16" },
  { id: "a6", type: "submitted", message: "You submitted \u201cWaterfront Land \u2014 1000 sqm\u201d for review.", date: "2026-06-01" },
];
