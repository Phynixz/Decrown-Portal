/**
 * details.js
 * ------------------------------------------------------------------
 * Property details page.
 * Reads the property ID from the URL (?id=p1), finds that property
 * in the data, and fills in all the page elements with its info.
 *
 * Depends on: properties-data.js, utils.js (loaded before this file)
 */

document.addEventListener("DOMContentLoaded", function () {

  // ---- Read the property ID from the URL -----------------------------
  const propertyId = getParam("id");
  const property = findProperty(propertyId);

  // ---- Get references to the page sections ---------------------------
  const content = document.getElementById("details-content");
  const notFound = document.getElementById("not-found-state");


  // ---- If the property wasn't found, show error state and stop -------
  if (!property) {
    content.classList.add("hidden");
    notFound.classList.remove("hidden");
    return;
  }


  // ---- Fill in all the text fields on the page -----------------------
  document.title = property.title + " | Haven Properties";

  let listingLabel = "For Sale";
  if (property.listingType === "rent") {
    listingLabel = "For Rent";
  }

  setText("prop-title", property.title);
  setText("prop-price", formatPrice(property));
  setText("prop-location-text", property.location);
  setText("prop-type-badge", listingLabel);
  setText("prop-status", property.status);
  setText("prop-beds", property.bedrooms);
  setText("prop-baths", property.bathrooms);
  setText("prop-type", property.type);
  setText("prop-description", property.description);
  setText("prop-ref", property.id.toUpperCase());
  setText("prop-contact-name", property.contactName);
  setText("prop-contact-phone", property.contactPhone);

  // These fields might be empty, so show a dash if they are
  if (property.area) {
    setText("prop-area", property.area);
  } else {
    setText("prop-area", "\u2014");
  }

  if (property.dateListed) {
    setText("prop-date", formatDate(property.dateListed));
  } else {
    setText("prop-date", "\u2014");
  }


  // ---- Build the features list ---------------------------------------
  buildFeaturesList(property.features || []);

  // ---- Build the image gallery ---------------------------------------
  buildImageGallery(property.images || [], property.title);

  // ---- Wire up the enquiry form --------------------------------------
  setupEnquiryForm(property);


  // ====================================================================
  // FUNCTIONS
  // ====================================================================


  /**
   * Sets the text content of an element by its ID.
   * If the element doesn't exist, it does nothing (avoids errors).
   */
  function setText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }


  /**
   * Builds the list of property features (e.g. "Swimming Pool", "24/7 Security").
   * Each feature gets a simple checkmark character next to it.
   */
  function buildFeaturesList(features) {
    const list = document.getElementById("prop-features");

    let html = "";
    for (let i = 0; i < features.length; i++) {
      html += '<li class="flex items-center gap-2 text-[13px] text-ink">' +
        '<i class="fa-solid fa-check text-[12px] text-accent"></i> ' + escapeHTML(features[i]) +
        '</li>';
    }
    list.innerHTML = html;
  }


  /**
   * Builds the image gallery: shows one large main image and
   * a row of clickable thumbnails below it.
   */
  function buildImageGallery(images, title) {
    const mainImage = document.getElementById("main-image");
    const thumbnailsWrap = document.getElementById("thumbnails");

    // If there are no images, do nothing
    if (images.length === 0) return;

    // Show the first image as the main image
    mainImage.src = images[0];
    mainImage.alt = title;

    // Build the thumbnail buttons
    let html = "";
    for (let i = 0; i < images.length; i++) {
      // The first thumbnail gets a darker border to show it's selected
      let border = "border-border";
      if (i === 0) {
        border = "border-ink";
      }

      html += '<button type="button" ' +
        'data-src="' + images[i] + '" ' +
        'class="thumb-btn aspect-[4/3] overflow-hidden rounded-lg border ' + border + '">' +
        '<img src="' + images[i] + '" alt="" class="h-full w-full object-cover" />' +
        '</button>';
    }
    thumbnailsWrap.innerHTML = html;

    // Now add a click handler to each thumbnail
    const allThumbs = thumbnailsWrap.querySelectorAll(".thumb-btn");

    for (let t = 0; t < allThumbs.length; t++) {
      allThumbs[t].addEventListener("click", function () {
        // Put this image in the main image area
        mainImage.src = this.getAttribute("data-src");

        // Remove the selected style from ALL thumbnails
        for (let j = 0; j < allThumbs.length; j++) {
          allThumbs[j].classList.remove("border-ink");
          allThumbs[j].classList.add("border-border");
        }

        // Add the selected style to THIS thumbnail
        this.classList.remove("border-border");
        this.classList.add("border-ink");
      });
    }
  }


  /**
   * Wires up the enquiry form at the bottom of the page.
   * When submitted, it logs the data and shows a success message.
   * (No backend is connected yet — this is a frontend demo.)
   */
  function setupEnquiryForm(property) {
    const form = document.getElementById("enquiry-form");
    const successMessage = document.getElementById("enquiry-success");

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Collect the form data into a simple object
      const formData = new FormData(form);
      const enquiryData = {};

      formData.forEach(function (value, key) {
        enquiryData[key] = value;
      });

      // Log it (ready for a real backend later)
      console.log("Enquiry submitted for " + property.id, enquiryData);

      // Hide the form and show the success message
      form.classList.add("hidden");
      successMessage.classList.remove("hidden");
    });
  }

});
