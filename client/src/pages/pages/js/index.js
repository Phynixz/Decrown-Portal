/**
 * index.js
 * ------------------------------------------------------------------
 * Home / listings page.
 * Shows all properties in a grid. Users can search, filter by type,
 * filter by bedrooms, filter by location, and switch between
 * For Sale / For Rent / All listings.
 *
 * Depends on: properties-data.js, utils.js (loaded before this file)
 */

document.addEventListener("DOMContentLoaded", function () {

  // ---- Get references to the page elements ---------------------------
  const grid = document.getElementById("property-grid");
  const emptyState = document.getElementById("empty-state");
  const resultsCount = document.getElementById("results-count");
  const searchInput = document.getElementById("search-input");
  const typeSelect = document.getElementById("filter-type");
  const bedroomsSelect = document.getElementById("filter-bedrooms");
  const locationSelect = document.getElementById("filter-location");
  const clearBtn = document.getElementById("clear-filters");
  const toggleButtons = document.querySelectorAll("[data-listing-toggle]");


  // ---- Track the current filters -------------------------------------
  // The page can start with ?listingType=sale or ?listingType=rent
  // in the URL, so we check for that first.
  const urlType = getParam("listingType");
  let currentListingType = "all";
  if (urlType === "rent" || urlType === "sale") {
    currentListingType = urlType;
  }

  let currentKeyword = "";
  let currentPropertyType = "";
  let currentBedrooms = "";
  let currentLocation = "";


  // ---- Set up the page when it first loads ---------------------------
  populateLocationDropdown();
  updateToggleButtons();
  showProperties();


  // ---- When user clicks Sale / Rent / All buttons --------------------
  for (let i = 0; i < toggleButtons.length; i++) {
    toggleButtons[i].addEventListener("click", function () {
      currentListingType = this.getAttribute("data-listing-toggle");
      updateToggleButtons();
      showProperties();
    });
  }


  // ---- When user types in the search box -----------------------------
  searchInput.addEventListener("input", function () {
    currentKeyword = this.value.trim().toLowerCase();
    showProperties();
  });


  // ---- When user changes the property type dropdown ------------------
  typeSelect.addEventListener("change", function () {
    currentPropertyType = this.value;
    showProperties();
  });


  // ---- When user changes the bedrooms dropdown -----------------------
  bedroomsSelect.addEventListener("change", function () {
    currentBedrooms = this.value;
    showProperties();
  });


  // ---- When user changes the location dropdown -----------------------
  locationSelect.addEventListener("change", function () {
    currentLocation = this.value;
    showProperties();
  });


  // ---- When user clicks "Clear Filters" ------------------------------
  clearBtn.addEventListener("click", function () {
    currentListingType = "all";
    currentKeyword = "";
    currentPropertyType = "";
    currentBedrooms = "";
    currentLocation = "";

    searchInput.value = "";
    typeSelect.value = "";
    bedroomsSelect.value = "";
    locationSelect.value = "";

    updateToggleButtons();
    showProperties();
  });


  // ====================================================================
  // FUNCTIONS
  // ====================================================================


  /**
   * Highlights the active toggle button (All / For Sale / For Rent).
   * The active button gets a dark background and white text.
   */
  function updateToggleButtons() {
    for (let i = 0; i < toggleButtons.length; i++) {
      const btn = toggleButtons[i];
      const isThisOne = btn.getAttribute("data-listing-toggle") === currentListingType;

      if (isThisOne) {
        btn.classList.add("bg-ink", "text-white");
        btn.classList.remove("text-muted");
      } else {
        btn.classList.remove("bg-ink", "text-white");
        btn.classList.add("text-muted");
      }
    }
  }


  /**
   * Loops through all properties and returns only the ones
   * that match the current filters.
   */
  function getFilteredProperties() {
    const allProperties = window.PROPERTIES || [];
    const results = [];

    for (let i = 0; i < allProperties.length; i++) {
      const property = allProperties[i];

      // Check listing type (sale / rent / all)
      if (currentListingType !== "all" && property.listingType !== currentListingType) {
        continue;
      }

      // Check property type (House, Apartment, etc.)
      if (currentPropertyType !== "" && property.type !== currentPropertyType) {
        continue;
      }

      // Check bedrooms (show properties with at least this many)
      if (currentBedrooms !== "" && property.bedrooms < Number(currentBedrooms)) {
        continue;
      }

      // Check location
      if (currentLocation !== "" && property.location !== currentLocation) {
        continue;
      }

      // Check search keyword (searches title and location)
      if (currentKeyword !== "") {
        const searchText = (property.title + " " + property.location).toLowerCase();
        if (searchText.indexOf(currentKeyword) === -1) {
          continue;
        }
      }

      results.push(property);
    }

    return results;
  }


  /**
   * Builds the HTML for one property card and returns it as a string.
   * Uses simple text characters instead of SVG icons.
   */
  function buildPropertyCard(property) {
    // Get the first image, or use an empty string if there are none
    let coverImage = "";
    if (property.images && property.images.length > 0) {
      coverImage = property.images[0];
    }

    // "For Sale" or "For Rent" label
    let label = "For Sale";
    if (property.listingType === "rent") {
      label = "For Rent";
    }

    // Beds and baths line (skip for land/offices with 0 bedrooms)
    let bedsAndBaths = "";
    if (property.bedrooms > 0 || property.bathrooms > 0) {
      bedsAndBaths =
        '<span class="flex items-center gap-1.5">' + property.bedrooms + " Beds</span>" +
        '<span class="flex items-center gap-1.5">' + property.bathrooms + " Baths</span>";
    }

    // Put it all together
    return `
      <a href="property-details.html?id=${encodeURIComponent(property.id)}"
         class="group block overflow-hidden rounded-xl border border-border bg-white transition-shadow hover:shadow-sm">
        <div class="relative aspect-[4/3] overflow-hidden bg-surface">
          <img src="${coverImage}"
               alt="${escapeHTML(property.title)}"
               class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
               loading="lazy" />
          <span class="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink">
            ${label}
          </span>
        </div>
        <div class="p-4 sm:p-5">
          <p class="font-mono text-[17px] font-semibold text-ink">${formatPrice(property)}</p>
          <h3 class="mt-1.5 truncate text-[15px] font-medium text-ink">${escapeHTML(property.title)}</h3>
          <p class="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
            <span class="truncate">${escapeHTML(property.location)}</span>
          </p>
          <div class="mt-3 flex items-center gap-4 border-t border-border pt-3 text-[12px] text-muted">
            ${bedsAndBaths}
            <span class="flex items-center gap-1.5">${escapeHTML(property.type)}</span>
          </div>
          <span class="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-ink px-4 py-2 text-[13px] font-medium text-ink transition-colors group-hover:bg-ink group-hover:text-white">
            View Property
          </span>
        </div>
      </a>`;
  }


  /**
   * Gets the filtered properties and displays them on the page.
   * Shows an empty state message if no properties match.
   */
  function showProperties() {
    const filtered = getFilteredProperties();

    // Update the count, e.g. "6 properties"
    let word = " properties";
    if (filtered.length === 1) {
      word = " property";
    }
    resultsCount.textContent = filtered.length + word;

    // If nothing matches, show the empty state
    if (filtered.length === 0) {
      grid.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }

    // Hide empty state and build all the property cards
    emptyState.classList.add("hidden");

    let html = "";
    for (let i = 0; i < filtered.length; i++) {
      html += buildPropertyCard(filtered[i]);
    }
    grid.innerHTML = html;
  }


  /**
   * Reads all unique locations from the property data and adds them
   * to the location dropdown so users can filter by location.
   */
  function populateLocationDropdown() {
    const allProperties = window.PROPERTIES || [];
    const uniqueLocations = [];

    // Find locations that aren't already in our list
    for (let i = 0; i < allProperties.length; i++) {
      const location = allProperties[i].location;
      let alreadyAdded = false;

      for (let j = 0; j < uniqueLocations.length; j++) {
        if (uniqueLocations[j] === location) {
          alreadyAdded = true;
          break;
        }
      }

      if (!alreadyAdded) {
        uniqueLocations.push(location);
      }
    }

    // Sort alphabetically and add each one to the dropdown
    uniqueLocations.sort();

    for (let k = 0; k < uniqueLocations.length; k++) {
      const option = document.createElement("option");
      option.value = uniqueLocations[k];
      option.textContent = uniqueLocations[k];
      locationSelect.appendChild(option);
    }
  }

});
