/**
 * utils.js
 * ------------------------------------------------------------------
 * Small shared helpers used by the other JS files.
 * These are global functions so any script loaded after this
 * file can call them directly (e.g. formatPrice(property)).
 */

/**
 * Turns a number into a Naira price string, e.g. 6500000 → "₦6,500,000"
 */
function formatNaira(amount) {
  const n = Number(amount) || 0;
  return "\u20A6" + n.toLocaleString("en-NG");
}

/**
 * Formats a property's price. Adds "/ year" or "/ month" for rentals.
 */
function formatPrice(property) {
  const price = formatNaira(property.price);

  if (property.listingType === "rent") {
    const period = property.period === "month" ? "month" : "year";
    return price + " / " + period;
  }

  return price;
}

/**
 * Reads a query parameter from the page URL.
 * Example: getParam("id") returns "p1" from ?id=p1
 */
function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * Prevents text from being interpreted as HTML when inserted into a page.
 * This stops user input like <script> from running.
 */
function escapeHTML(value) {
  if (value == null) return "";
  const text = String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Finds a property in the PROPERTIES array by its ID.
 * Returns the property object, or null if not found.
 */
function findProperty(id) {
  const properties = window.PROPERTIES || [];

  for (let i = 0; i < properties.length; i++) {
    if (properties[i].id === id) {
      return properties[i];
    }
  }

  return null;
}

/**
 * Turns an ISO date string (e.g. "2026-07-12") into a readable format
 * like "12 July 2026". Returns "—" if the date is missing or invalid.
 */
function formatDate(isoDate) {
  if (!isoDate) return "\u2014";

  const date = new Date(isoDate);

  if (isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
