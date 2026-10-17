/**
 * list-property.js
 * ------------------------------------------------------------------
 * "List Your Property" form page.
 * Handles:
 *   - Toggling between For Sale / For Rent (shows/hides rent period)
 *   - Adding and removing feature tags (e.g. "Swimming Pool")
 *   - Adding multiple image URL fields
 *   - Submitting the form and redirecting to the landlord dashboard
 *
 * Depends on: utils.js (loaded before this file)
 */

document.addEventListener("DOMContentLoaded", function () {
  // ---- Get references to the page elements ---------------------------
  var form = document.getElementById("listing-form");
  var successPanel = document.getElementById("listing-success");
  var periodWrap = document.getElementById("period-wrap");
  var featureInput = document.getElementById("feature-input");
  var featureAddBtn = document.getElementById("feature-add-btn");
  var featureList = document.getElementById("feature-list");
  var imageFields = document.getElementById("image-fields");

  // This array holds the features the user has typed in (e.g. ["Swimming Pool", "CCTV"])
  var featuresList = [];

  // ====================================================================
  // LISTING TYPE TOGGLE (For Sale / For Rent)
  // ====================================================================

  // When the user picks "For Rent", show the rent period dropdown.
  // When they pick "For Sale", hide it.
  var listingTypeRadios = document.querySelectorAll(
    'input[name="listingType"]',
  );

  for (var i = 0; i < listingTypeRadios.length; i++) {
    listingTypeRadios[i].addEventListener("change", function () {
      var selected = document.querySelector(
        'input[name="listingType"]:checked',
      );
      if (selected.value === "rent") {
        periodWrap.classList.remove("hidden");
      } else {
        periodWrap.classList.add("hidden");
      }
    });
  }

  // ====================================================================
  // FEATURES TAG INPUT
  // ====================================================================

  /**
   * Rebuilds the list of feature tags shown on the page.
   * Each tag has a little "x" button to remove it.
   */
  function renderFeatureTags() {
    var html = "";

    for (var i = 0; i < featuresList.length; i++) {
      html +=
        '<span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[12px] text-ink">' +
        escapeHTML(featuresList[i]) +
        '<button type="button" data-idx="' +
        i +
        '" ' +
        'class="feature-remove font-medium text-muted transition-colors hover:text-ink" ' +
        'aria-label="Remove ' +
        escapeHTML(featuresList[i]) +
        '">' +
        '<i class="fa-solid fa-xmark text-[11px]"></i></button></span>';
    }

    featureList.innerHTML = html;

    // Add a click handler to each "x" remove button
    var removeButtons = featureList.querySelectorAll(".feature-remove");
    for (var r = 0; r < removeButtons.length; r++) {
      removeButtons[r].addEventListener("click", function () {
        var index = Number(this.getAttribute("data-idx"));
        featuresList.splice(index, 1);
        renderFeatureTags();
      });
    }
  }

  /**
   * Adds the current text in the input field as a new feature tag.
   */
  function addNewFeature() {
    var text = featureInput.value.trim();

    // Don't add empty features
    if (text === "") return;

    featuresList.push(text);
    featureInput.value = "";
    renderFeatureTags();
    featureInput.focus();
  }

  // "Add" button clicked
  featureAddBtn.addEventListener("click", addNewFeature);

  // Enter key pressed in the feature input
  featureInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addNewFeature();
    }
  });

  // ====================================================================
  // DYNAMIC IMAGE URL FIELDS
  // ====================================================================

  // When user clicks "Add Image URL", a new text field appears
  // so they can paste another image link.
  document
    .getElementById("add-image-btn")
    .addEventListener("click", function () {
      var row = document.createElement("div");
      row.className = "flex gap-2";

      row.innerHTML =
        '<input type="url" name="imageUrl" placeholder="https://images.unsplash.com/…" ' +
        'class="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder-muted/60 ' +
        'focus:border-ink/30 focus:outline-none focus:ring-[3px] focus:ring-ink/[0.06]" />' +
        '<button type="button" class="remove-image-row shrink-0 text-[12px] font-medium text-muted transition-colors hover:text-ink">' +
        "Remove</button>";

      // Wire up the Remove button for this new field
      var removeBtn = row.querySelector(".remove-image-row");
      removeBtn.addEventListener("click", function () {
        row.remove();
      });

      imageFields.appendChild(row);

      // Focus the new input field so the user can start typing right away
      row.querySelector("input").focus();
    });

  // ====================================================================
  // FORM SUBMISSION
  // ====================================================================

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Gather all form values
    // var fd = new FormData(form);
    // var selectedListingType = fd.get("listingType");

    // // Collect all image URLs (there might be multiple fields)
    // var allImageUrls = fd.getAll("imageUrl");
    // var cleanImageUrls = [];
    // for (var u = 0; u < allImageUrls.length; u++) {
    //   var url = allImageUrls[u].trim();
    //   if (url !== "") {
    //     cleanImageUrls.push(url);
    //   }
    // }

    // // Build the property object
    // var listing = {
    //   id: "lp" + Date.now(),
    //   title: fd.get("title"),
    //   type: fd.get("propertyType"),
    //   listingType: selectedListingType,
    //   status: "Available",
    //   listingStatus: "Submitted",
    //   price: Number(fd.get("price")) || 0,
    //   period: null,
    //   location: fd.get("location"),
    //   bedrooms: Number(fd.get("bedrooms")) || 0,
    //   bathrooms: Number(fd.get("bathrooms")) || 0,
    //   area: fd.get("area") || null,
    //   description: fd.get("description"),
    //   features: featuresList,
    //   images: cleanImageUrls,
    //   image: cleanImageUrls.length > 0 ? cleanImageUrls[0] : "",
    //   dateSubmitted: new Date().toISOString().slice(0, 10),
    //   contactName: fd.get("contactName"),
    //   contactPhone: fd.get("contactPhone"),
    //   contactEmail: fd.get("contactEmail"),
    //   applications: 0,
    // };

    // // Only set period if it's a rental
    // if (selectedListingType === "rent") {
    //   listing.period = fd.get("period");
    // }

    // // Save the new listing to localStorage
    // // Read any existing submissions first
    // var existing = [];
    // try {
    //   existing =
    //     JSON.parse(localStorage.getItem("haven_submitted_properties")) || [];
    // } catch (err) {
    //   existing = [];
    // }

    // existing.push(listing);
    // localStorage.setItem(
    //   "haven_submitted_properties",
    //   JSON.stringify(existing),
    // );

    // Redirect to the landlord dashboard with a flag so it shows the new listing
    window.location.href = "landlord-dashboard.html?submitted=true";
  });
});
