/**
 * nav.js
 * ------------------------------------------------------------------
 * Toggles the mobile navigation menu open/closed.
 * Used on all pages that have a mobile menu.
 */

document.addEventListener("DOMContentLoaded", function () {

  const menuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  // If this page doesn't have a mobile menu, do nothing
  if (!menuBtn || !mobileMenu) return;

  menuBtn.addEventListener("click", function () {
    // Check if the menu is currently visible
    const menuIsOpen = !mobileMenu.classList.contains("hidden");

    if (menuIsOpen) {
      // Close the menu
      mobileMenu.classList.add("hidden");
    } else {
      // Open the menu
      mobileMenu.classList.remove("hidden");
    }

    // Update the button's accessibility label
    menuBtn.setAttribute("aria-expanded", String(!menuIsOpen));
  });

});
