/**
 * properties.js
 * ------------------------------------------------------------------
 * Property listings for the landing page.
 * Mock data structured after the Jide Taiwo & Co. property format.
 * Shows a filterable grid of properties with a detail modal.
 *
 * Depends on: Tailwind CSS (browser build), Font Awesome icons
 */

document.addEventListener("DOMContentLoaded", function () {
  // ---- Mock data -----------------------------------------------------
  const PROPERTIES = [
    {
      id: 1,
      title: "5 Bedroom Semi Detached Duplex",
      price: 4000000,
      type: "Residential",
      location: "Satellite Town, Lagos",
      contract: "Letting",
      area: "500 sqm",
      available: true,
      bedrooms: 5,
      bathrooms: 5,
      image:
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80",
      description:
        "Spacious semi-detached duplex in a quiet residential estate. Well-maintained with modern finishes, ample parking, and 24-hour security.",
    },
    {
      id: 2,
      title: "3 Bedroom Flat",
      price: 2000000,
      type: "Residential",
      location: "Iyana-Ipaja, Lagos",
      contract: "Letting",
      area: "300 sqm",
      available: true,
      bedrooms: 3,
      bathrooms: 3,
      image:
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
      description:
        "Well-located flat in a family-friendly neighbourhood. Close to markets, schools, and major road networks. Suitable for small families.",
    },
    {
      id: 3,
      title: "4 Bedroom Detached House",
      price: 55000000,
      type: "Residential",
      location: "Ikoyi, Lagos",
      contract: "Sale",
      area: "700 sqm",
      available: true,
      bedrooms: 4,
      bathrooms: 5,
      image:
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
      description:
        "Premium detached house in the heart of Ikoyi. Features a modern kitchen, spacious living areas, staff quarters, and a private garden.",
    },
  ];

  // ---- DOM elements --------------------------------------------------
  const grid = document.getElementById("properties-grid");
  const emptyState = document.getElementById("properties-empty");
  const filterButtons = document.querySelectorAll("[data-filter]");
  const modal = document.getElementById("property-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalBackdrop = modal
    ? modal.querySelector("[data-modal-backdrop]")
    : null;
  const modalCloseBtn = modal
    ? modal.querySelector("[data-modal-close]")
    : null;

  // If the grid element doesn't exist on this page, stop
  if (!grid) return;

  // Track which filter tab is currently active
  let currentFilter = "all";

  // ---- Format price --------------------------------------------------
  function formatPrice(amount) {
    return "\u20A6" + Number(amount).toLocaleString("en-NG");
  }

  // ---- Build one property card as an HTML string ---------------------
  function renderCard(prop) {
    // Availability badge
    let availBadge = "";
    if (prop.available) {
      availBadge =
        '<span class="inline-flex items-center gap-1.5 rounded-full bg-moss/10 px-2.5 py-0.5 text-xs font-medium text-moss"><span class="h-1.5 w-1.5 rounded-full bg-moss"></span>Available</span>';
    } else {
      availBadge =
        '<span class="inline-flex items-center gap-1.5 rounded-full bg-stone px-2.5 py-0.5 text-xs font-medium text-sage"><span class="h-1.5 w-1.5 rounded-full bg-sage"></span>Unavailable</span>';
    }

    // Contract label
    let contractLabel = "For Rent / Lease";
    if (prop.contract === "Sale") {
      contractLabel = "For Sale";
    }

    // Price label
    let priceExtra = "";
    if (prop.contract !== "Sale") {
      priceExtra = '<span class="text-sm font-normal text-sage"> / yr</span>';
    }

    // Bed/bath row
    let bedBathRow = "";
    if (prop.bedrooms > 0 || prop.bathrooms > 0) {
      let bedBath =
        '<div class="mt-3 flex items-center gap-4 border-t border-stone pt-3 text-sm text-sage">';
      if (prop.bedrooms > 0) {
        const plural = prop.bedrooms > 1 ? "s" : "";
        bedBath +=
          '<span class="inline-flex items-center gap-1.5"><i class="fa-solid fa-bed h-3.5 w-3.5"></i>' +
          prop.bedrooms +
          " Bed" +
          plural +
          "</span>";
      }
      if (prop.bathrooms > 0) {
        const plural = prop.bathrooms > 1 ? "s" : "";
        bedBath +=
          '<span class="inline-flex items-center gap-1.5"><i class="fa-solid fa-bath h-3.5 w-3.5"></i>' +
          prop.bathrooms +
          " Bath" +
          plural +
          "</span>";
      }
      bedBath += "</div>";
      bedBathRow = bedBath;
    }

    // Area row
    let areaRow = "";
    if (prop.area) {
      areaRow =
        '<span class="inline-flex items-center gap-1.5"><i class="fa-solid fa-vector-square h-3 w-3"></i>' +
        prop.area +
        "</span>";
    }

    // Put the card together
    return (
      '<article class="group flex flex-col rounded border border-stone bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">' +
      '<div class="relative overflow-hidden">' +
      '<img src="' +
      prop.image +
      '" alt="' +
      prop.title +
      ", " +
      prop.location +
      '" loading="lazy" class="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] sm:h-56" />' +
      '<span class="absolute left-3 top-3 rounded bg-ink/80 px-2.5 py-1 text-xs font-medium text-paper">' +
      contractLabel +
      "</span>" +
      '<span class="absolute right-3 top-3">' +
      availBadge +
      "</span>" +
      "</div>" +
      '<div class="flex flex-1 flex-col p-5">' +
      '<p class="font-mono text-xl font-medium text-ink">' +
      formatPrice(prop.price) +
      priceExtra +
      "</p>" +
      '<h3 class="mt-2 font-display text-base font-semibold leading-snug text-ink">' +
      prop.title +
      "</h3>" +
      '<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-sage">' +
      '<span class="inline-flex items-center gap-1.5"><i class="fa-solid fa-location-dot h-3 w-3"></i>' +
      prop.location +
      "</span>" +
      '<span class="inline-flex items-center gap-1.5"><i class="fa-solid fa-tag h-3 w-3"></i>' +
      prop.type +
      "</span>" +
      areaRow +
      "</div>" +
      bedBathRow +
      '<div class="mt-auto pt-4">' +
      '<button data-view="' +
      prop.id +
      '" class="w-full rounded border border-ink/15 bg-paper px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-stone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss">View Details</button>' +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  // ---- Build a small meta item for the modal -------------------------
  function metaItem(label, value) {
    return (
      '<div class="rounded border border-stone bg-paper px-4 py-3">' +
      '<dt class="font-mono text-[11px] uppercase tracking-widest2 text-sage">' +
      label +
      "</dt>" +
      '<dd class="mt-1 text-sm font-medium text-ink">' +
      value +
      "</dd>" +
      "</div>"
    );
  }

  // ---- Show properties matching the current filter -------------------
  function renderProperties(filter) {
    let filtered = [];

    if (filter === "all") {
      // Show everything
      filtered = PROPERTIES;
    } else if (filter === "commercial") {
      // Show only commercial properties
      for (let i = 0; i < PROPERTIES.length; i++) {
        if (PROPERTIES[i].type.toLowerCase().indexOf("commercial") !== -1) {
          filtered.push(PROPERTIES[i]);
        }
      }
    } else {
      // Filter by contract type (sale / letting)
      for (let i = 0; i < PROPERTIES.length; i++) {
        if (PROPERTIES[i].contract.toLowerCase() === filter) {
          filtered.push(PROPERTIES[i]);
        }
      }
    }

    // Show empty state if no results
    if (filtered.length === 0) {
      grid.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }

    // Build and display all property cards
    emptyState.classList.add("hidden");
    let html = "";
    for (let i = 0; i < filtered.length && i < 3; i++) {
      html += renderCard(filtered[i]);
    }
    grid.innerHTML = html;
  }

  // ---- Filter tab click handlers -------------------------------------
  for (let i = 0; i < filterButtons.length; i++) {
    filterButtons[i].addEventListener("click", function () {
      const filter = this.getAttribute("data-filter");

      // Don't re-render if clicking the same filter
      if (filter === currentFilter) return;
      currentFilter = filter;

      // Update the active tab styling
      for (let j = 0; j < filterButtons.length; j++) {
        const btn = filterButtons[j];
        const isActive = btn.getAttribute("data-filter") === filter;

        btn.setAttribute("aria-selected", isActive ? "true" : "false");

        if (isActive) {
          btn.className =
            "prop-filter rounded border border-moss bg-moss px-4 py-2 text-sm font-medium text-paper transition-colors";
        } else {
          btn.className =
            "prop-filter rounded border border-stone-dark bg-white px-4 py-2 text-sm font-medium text-sage transition-colors hover:border-ink/25 hover:text-ink";
        }
      }

      // Re-render with the new filter
      // renderProperties(filter);
    });
  }

  // ---- Modal: open ---------------------------------------------------
  function openModal(propId) {
    // Find the property by ID
    let prop = null;
    for (let i = 0; i < PROPERTIES.length; i++) {
      if (PROPERTIES[i].id === Number(propId)) {
        prop = PROPERTIES[i];
        break;
      }
    }
    if (!prop) return;

    // Set the modal title
    modalTitle.textContent = prop.title;

    // Build the modal content
    let availClass = "text-sage";
    let availText = "Unavailable";
    if (prop.available) {
      availClass = "text-moss";
      availText = "Available";
    }

    let priceExtra = "";
    if (prop.contract !== "Sale") {
      priceExtra = '<span class="text-sm font-normal text-sage"> / yr</span>';
    }

    let contractLabel = "For Rent / Lease";
    if (prop.contract === "Sale") {
      contractLabel = "For Sale";
    }

    let ctaLabel = "Inquire to Rent";
    if (prop.contract === "Sale") {
      ctaLabel = "Inquire to Buy";
    }

    // Build meta items
    let metaHtml =
      metaItem("Type", prop.type) +
      metaItem("Location", prop.location) +
      metaItem("Contract", contractLabel) +
      metaItem("Area", prop.area);
    if (prop.bedrooms > 0) {
      metaHtml += metaItem("Bedrooms", prop.bedrooms);
    }
    if (prop.bathrooms > 0) {
      metaHtml += metaItem("Bathrooms", prop.bathrooms);
    }

    modalBody.innerHTML =
      '<img src="' +
      prop.image +
      '" alt="' +
      prop.title +
      ", " +
      prop.location +
      '" class="h-64 w-full rounded border border-stone object-cover sm:h-72" />' +
      '<div class="mt-5 flex flex-wrap items-center justify-between gap-3">' +
      '<p class="font-mono text-2xl font-medium text-ink">' +
      formatPrice(prop.price) +
      priceExtra +
      "</p>" +
      '<span class="' +
      availClass +
      ' text-sm font-medium">' +
      availText +
      "</span>" +
      "</div>" +
      '<dl class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">' +
      metaHtml +
      "</dl>" +
      '<div class="mt-6 border-t border-stone pt-5">' +
      '<p class="font-mono text-xs uppercase tracking-widest2 text-sage">Description</p>' +
      '<p class="mt-2 text-[15px] leading-relaxed text-ink">' +
      prop.description +
      "</p>" +
      "</div>" +
      '<div class="mt-6 flex flex-wrap gap-3 border-t border-stone pt-5">' +
      '<a href="signup.html" class="inline-flex items-center justify-center rounded bg-moss px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-moss-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss">' +
      ctaLabel +
      "</a>" +
      '<button data-modal-close class="inline-flex items-center justify-center rounded border border-stone-dark px-5 py-2.5 text-sm font-medium text-sage transition-colors hover:border-ink/25 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss">Close</button>' +
      "</div>";

    // Show the modal
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    // Wire up any close buttons inside the modal body
    const closeButtons = modalBody.querySelectorAll("[data-modal-close]");
    for (let c = 0; c < closeButtons.length; c++) {
      closeButtons[c].addEventListener("click", closeModal);
    }
  }

  // ---- Modal: close --------------------------------------------------
  function closeModal() {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  // Close when clicking the backdrop (outside the modal content)
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", closeModal);
  }

  // Close when pressing Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });

  // Handle "View Details" button clicks (event delegation on the grid)
  grid.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-view]");
    if (btn) {
      openModal(btn.getAttribute("data-view"));
    }
  });

  // ---- Initial render ------------------------------------------------
  renderProperties("all");
});
