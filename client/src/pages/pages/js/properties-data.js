/**
 * properties-data.js
 * ------------------------------------------------------------------
 * Local data source for the property listing frontend.
 *
 * Each property is a flat, serializable object. `images` is always
 * an array of URL strings. When this project connects to a real
 * backend, this file can be deleted and window.PROPERTIES can be
 * populated from the network response instead.
 *
 * Field reference:
 *  id            string   unique identifier, used in the details URL
 *  title         string
 *  type          string   "House" | "Apartment" | "Duplex" | "Bungalow" |
 *                          "Terrace" | "Penthouse" | "Office" | "Land"
 *  listingType   string   "sale" | "rent"
 *  status        string   "Available" | "Under Offer" | "Sold" | "Let"
 *  price         number   raw amount in Naira (no formatting)
 *  period        string   "year" | "month" | null (only used when listingType is "rent")
 *  location      string
 *  bedrooms      number
 *  bathrooms     number
 *  area          string   e.g. "450 sqm" (optional, may be null)
 *  description   string
 *  features      string[]
 *  images        string[] direct image URLs, first item is the cover photo
 *  dateListed    string   ISO date "YYYY-MM-DD"
 *  contactName   string
 *  contactPhone  string
 */

window.PROPERTIES = [
  {
    id: "p1",
    title: "4 Bedroom Detached Duplex",
    type: "Duplex",
    listingType: "sale",
    status: "Available",
    price: 185000000,
    period: null,
    location: "Lekki Phase 1, Lagos",
    bedrooms: 4,
    bathrooms: 5,
    area: "450 sqm",
    description:
      "A beautifully finished detached duplex set within a serene, gated estate in Lekki Phase 1. The home features a spacious open-plan living and dining area, a fitted kitchen, a private study, and a rooftop terrace with skyline views. Finished to a high standard throughout with imported fittings.",
    features: [
      "Swimming Pool",
      "24/7 Security",
      "Boys' Quarters",
      "Fitted Kitchen",
      "Ample Parking",
      "Rooftop Terrace",
      "Generator House",
      "CCTV",
    ],
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687644-c7171b46e5a4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80",
    ],
    dateListed: "2026-07-12",
    contactName: "Haven Properties",
    contactPhone: "+234 801 234 5678",
  },
  {
    id: "p2",
    title: "3 Bedroom Serviced Apartment",
    type: "Apartment",
    listingType: "rent",
    status: "Available",
    price: 6500000,
    period: "year",
    location: "Banana Island, Ikoyi",
    bedrooms: 3,
    bathrooms: 4,
    area: "220 sqm",
    description:
      "A fully serviced 3 bedroom apartment on Banana Island with panoramic waterfront views. Includes a shared gym, swimming pool, and dedicated concierge. Interiors are finished with hardwood floors and floor-to-ceiling windows in the living area.",
    features: [
      "Waterfront View",
      "Serviced",
      "Gym Access",
      "Swimming Pool",
      "Concierge",
      "24/7 Power",
    ],
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80",
    ],
    dateListed: "2026-07-28",
    contactName: "Haven Properties",
    contactPhone: "+234 801 234 5678",
  },
  {
    id: "p3",
    title: "5 Bedroom Fully Detached House",
    type: "House",
    listingType: "sale",
    status: "Available",
    price: 320000000,
    period: null,
    location: "Old Ikoyi, Lagos",
    bedrooms: 5,
    bathrooms: 6,
    area: "610 sqm",
    description:
      "An expansive five bedroom family home in Old Ikoyi with mature gardens, a private pool, and a two-car garage. Layout includes a formal living room, family lounge, and a self-contained staff annex. Rare corner plot with dual road access.",
    features: [
      "Private Pool",
      "Garden",
      "Staff Quarters",
      "Two-Car Garage",
      "Study",
      "Solar Backup",
    ],
    images: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
    ],
    dateListed: "2026-06-30",
    contactName: "Haven Properties",
    contactPhone: "+234 801 234 5678",
  },
  {
    id: "p4",
    title: "2 Bedroom Apartment",
    type: "Apartment",
    listingType: "rent",
    status: "Available",
    price: 3200000,
    period: "year",
    location: "Chevron, Lekki",
    bedrooms: 2,
    bathrooms: 3,
    area: "140 sqm",
    description:
      "A well-maintained 2 bedroom apartment in a quiet estate off Chevron Drive. Close to major supermarkets and the Lekki-Epe expressway. Comes with a dedicated parking spot and access to a shared children's play area.",
    features: ["Estate Security", "Parking Space", "Play Area", "Borehole Water"],
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1200&q=80",
    ],
    dateListed: "2026-08-05",
    contactName: "Haven Properties",
    contactPhone: "+234 801 234 5678",
  },
  {
    id: "p5",
    title: "Luxury Penthouse with Skyline View",
    type: "Penthouse",
    listingType: "rent",
    status: "Available",
    price: 950000,
    period: "month",
    location: "Victoria Island, Lagos",
    bedrooms: 3,
    bathrooms: 4,
    area: "260 sqm",
    description:
      "A striking penthouse occupying the top floor of a modern residential tower on Victoria Island, with a private wraparound terrace and unobstructed views of the lagoon. Fully furnished and available on short or long let.",
    features: [
      "Private Terrace",
      "Fully Furnished",
      "Lagoon View",
      "Elevator Access",
      "Gym Access",
    ],
    images: [
      "https://images.unsplash.com/photo-1571055107559-3e67626fa8be?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1560184897-ae75f418493e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1200&q=80",
    ],
    dateListed: "2026-08-14",
    contactName: "Haven Properties",
    contactPhone: "+234 801 234 5678",
  },
  {
    id: "p6",
    title: "3 Bedroom Terrace Duplex",
    type: "Terrace",
    listingType: "sale",
    status: "Under Offer",
    price: 95000000,
    period: null,
    location: "Ajah, Lagos",
    bedrooms: 3,
    bathrooms: 4,
    area: "190 sqm",
    description:
      "A modern terrace duplex within a newly developed gated community in Ajah. Ideal for a young family, with a compact private garden, dedicated parking, and 24-hour estate security.",
    features: ["Gated Estate", "Private Garden", "Parking", "24/7 Security"],
    images: [
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80",
    ],
    dateListed: "2026-05-19",
    contactName: "Haven Properties",
    contactPhone: "+234 801 234 5678",
  },
  {
    id: "p7",
    title: "Bungalow on Half Plot",
    type: "Bungalow",
    listingType: "sale",
    status: "Available",
    price: 62000000,
    period: null,
    location: "Magodo GRA, Lagos",
    bedrooms: 3,
    bathrooms: 3,
    area: "300 sqm",
    description:
      "A comfortable 3 bedroom bungalow sitting on a half plot in Magodo GRA Phase 2. Recently renovated with new plumbing and electrical fittings. Good access road and close to the estate's main gate.",
    features: ["Renovated", "Good Road Access", "Fenced Compound", "Borehole Water"],
    images: [
      "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    ],
    dateListed: "2026-07-02",
    contactName: "Haven Properties",
    contactPhone: "+234 801 234 5678",
  },
  {
    id: "p8",
    title: "Serviced Office Suite",
    type: "Office",
    listingType: "rent",
    status: "Available",
    price: 4800000,
    period: "year",
    location: "Ikeja GRA, Lagos",
    bedrooms: 0,
    bathrooms: 2,
    area: "180 sqm",
    description:
      "A modern serviced office suite in a commercial building on Ikeja GRA, suitable for a small to mid-sized team. Includes a reception area, two meeting rooms, and dedicated fibre internet.",
    features: ["Fibre Internet", "Meeting Rooms", "Reception Area", "Backup Power", "Parking"],
    images: [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80",
    ],
    dateListed: "2026-06-11",
    contactName: "Haven Properties",
    contactPhone: "+234 801 234 5678",
  },
  {
    id: "p9",
    title: "Waterfront Land — 1000 sqm",
    type: "Land",
    listingType: "sale",
    status: "Available",
    price: 145000000,
    period: null,
    location: "Oniru, Victoria Island",
    bedrooms: 0,
    bathrooms: 0,
    area: "1000 sqm",
    description:
      "A dry, fenced waterfront plot in the Oniru Private Estate with governor's consent in place. Suitable for a private residence or boutique residential development. Direct water access at the rear boundary.",
    features: ["Governor's Consent", "Fenced", "Water Access", "Dry Land"],
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
    ],
    dateListed: "2026-04-22",
    contactName: "Haven Properties",
    contactPhone: "+234 801 234 5678",
  },
  {
    id: "p10",
    title: "1 Bedroom Self-Contained Flat",
    type: "Apartment",
    listingType: "rent",
    status: "Available",
    price: 1400000,
    period: "year",
    location: "Yaba, Lagos",
    bedrooms: 1,
    bathrooms: 1,
    area: "55 sqm",
    description:
      "A compact, well-lit self-contained flat close to Yaba's tech hub and major transport links. Good option for a young professional. Tiled throughout with a fitted kitchenette.",
    features: ["Fitted Kitchenette", "Prepaid Meter", "Close to Transport"],
    images: [
      "https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80",
    ],
    dateListed: "2026-08-20",
    contactName: "Haven Properties",
    contactPhone: "+234 801 234 5678",
  },
];
